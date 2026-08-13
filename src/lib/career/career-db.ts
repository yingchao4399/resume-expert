"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CareerDomainSnapshot } from "@/types/career-domain";
import type { CareerEvidence } from "@/types/resume";
import {
  capabilityLinkSchema, capabilitySchema, careerExperienceSchema, careerInterviewSessionSchema,
  evidenceClaimSchema, metricEvidenceSchema,
} from "@/lib/career/schemas";
import { mergeCareerSnapshots, migrateLegacyEvidence } from "@/lib/career/migration";

const DB_NAME = "resume-expert-career";
const META_KEY = "domain-meta";
const ARCHIVE_KEY = "legacy-career-evidence-v1";

type StoreName = "experiences" | "claims" | "metrics" | "capabilities" | "capabilityLinks" | "interviewSessions" | "quarantine" | "meta";
interface CareerDB extends DBSchema {
  experiences: { key: string; value: CareerDomainSnapshot["experiences"][number] };
  claims: { key: string; value: CareerDomainSnapshot["claims"][number] };
  metrics: { key: string; value: CareerDomainSnapshot["metrics"][number] };
  capabilities: { key: string; value: CareerDomainSnapshot["capabilities"][number] };
  capabilityLinks: { key: string; value: CareerDomainSnapshot["capabilityLinks"][number] };
  interviewSessions: { key: string; value: CareerDomainSnapshot["interviewSessions"][number] };
  quarantine: { key: string; value: CareerDomainSnapshot["quarantined"][number] & { id: string } };
  meta: { key: string; value: unknown };
}

const EMPTY: CareerDomainSnapshot = { schemaVersion: 1, experiences: [], claims: [], metrics: [], capabilities: [], capabilityLinks: [], interviewSessions: [], quarantined: [] };

async function database(): Promise<IDBPDatabase<CareerDB>> {
  return openDB<CareerDB>(DB_NAME, 1, { upgrade(db) {
    for (const store of ["experiences", "claims", "metrics", "capabilities", "capabilityLinks", "interviewSessions"] as const) db.createObjectStore(store, { keyPath: "id" });
    db.createObjectStore("quarantine", { keyPath: "id" }); db.createObjectStore("meta");
  } });
}

export async function readCareerDomain(): Promise<CareerDomainSnapshot> {
  if (typeof indexedDB === "undefined") return structuredClone(EMPTY);
  const db = await database();
  const tx = db.transaction(["experiences", "claims", "metrics", "capabilities", "capabilityLinks", "interviewSessions", "quarantine"], "readonly");
  const results = await Promise.all([
    tx.objectStore("experiences").getAll(), tx.objectStore("claims").getAll(), tx.objectStore("metrics").getAll(),
    tx.objectStore("capabilities").getAll(), tx.objectStore("capabilityLinks").getAll(), tx.objectStore("interviewSessions").getAll(), tx.objectStore("quarantine").getAll(),
  ]);
  await tx.done; db.close();
  const [rawExperiences, rawClaims, rawMetrics, rawCapabilities, rawCapabilityLinks, rawInterviewSessions, quarantine] = results;
  const rejected: Array<{ store: Exclude<StoreName, "quarantine" | "meta">; value: unknown; reason: string; id?: string }> = [];
  const valid = <T,>(store: Exclude<StoreName, "quarantine" | "meta">, values: unknown[], schema: { safeParse: (value: unknown) => { success: boolean; data?: T; error?: { message: string } } }) => values.flatMap((value) => {
    const result = schema.safeParse(value);
    if (result.success) return [result.data as T];
    rejected.push({ store, value, reason: result.error?.message ?? "Schema 校验失败", id: typeof value === "object" && value !== null && "id" in value && typeof value.id === "string" ? value.id : undefined });
    return [];
  });
  const experiences = valid("experiences", rawExperiences, careerExperienceSchema);
  const claims = valid("claims", rawClaims, evidenceClaimSchema);
  const metrics = valid("metrics", rawMetrics, metricEvidenceSchema);
  const capabilities = valid("capabilities", rawCapabilities, capabilitySchema);
  const capabilityLinks = valid("capabilityLinks", rawCapabilityLinks, capabilityLinkSchema);
  const interviewSessions = valid("interviewSessions", rawInterviewSessions, careerInterviewSessionSchema);
  if (rejected.length) {
    const repairDb = await database();
    const repair = repairDb.transaction(["experiences", "claims", "metrics", "capabilities", "capabilityLinks", "interviewSessions", "quarantine"], "readwrite");
    for (const [index, item] of rejected.entries()) {
      await repair.objectStore("quarantine").put({ id: `quarantine-${Date.now()}-${index}`, store: item.store, value: item.value, reason: item.reason });
      if (item.id) await repair.objectStore(item.store).delete(item.id);
    }
    await repair.done; repairDb.close();
  }
  return { schemaVersion: 1, experiences, claims, metrics, capabilities, capabilityLinks, interviewSessions, quarantined: [
    ...quarantine.map((item) => ({ store: item.store, value: item.value, reason: item.reason })),
    ...rejected.map(({ store, value, reason }) => ({ store, value, reason })),
  ] };
}

export async function replaceCareerDomain(snapshot: CareerDomainSnapshot): Promise<void> {
  const parsed = {
    experiences: snapshot.experiences.map((item) => careerExperienceSchema.parse(item)),
    claims: snapshot.claims.map((item) => evidenceClaimSchema.parse(item)),
    metrics: snapshot.metrics.map((item) => metricEvidenceSchema.parse(item)),
    capabilities: snapshot.capabilities.map((item) => capabilitySchema.parse(item)),
    capabilityLinks: snapshot.capabilityLinks.map((item) => capabilityLinkSchema.parse(item)),
    interviewSessions: snapshot.interviewSessions.map((item) => careerInterviewSessionSchema.parse(item)),
  };
  const db = await database();
  const stores: StoreName[] = ["experiences", "claims", "metrics", "capabilities", "capabilityLinks", "interviewSessions", "quarantine", "meta"];
  const tx = db.transaction(stores, "readwrite");
  for (const store of stores.filter((item) => item !== "meta")) await tx.objectStore(store).clear();
  for (const item of parsed.experiences) await tx.objectStore("experiences").put(item);
  for (const item of parsed.claims) await tx.objectStore("claims").put(item);
  for (const item of parsed.metrics) await tx.objectStore("metrics").put(item);
  for (const item of parsed.capabilities) await tx.objectStore("capabilities").put(item);
  for (const item of parsed.capabilityLinks) await tx.objectStore("capabilityLinks").put(item);
  for (const item of parsed.interviewSessions) await tx.objectStore("interviewSessions").put(item);
  for (const [index, item] of snapshot.quarantined.entries()) await tx.objectStore("quarantine").put({ id: `quarantine-${Date.now()}-${index}`, ...item });
  await tx.objectStore("meta").put({ schemaVersion: 1, updatedAt: new Date().toISOString() }, META_KEY);
  await tx.done; db.close();
}

export async function migrateCareerEvidenceOnce(legacy: CareerEvidence[]): Promise<{ migrated: boolean; snapshot: CareerDomainSnapshot }> {
  const db = await database();
  const already = await db.get("meta", ARCHIVE_KEY);
  db.close();
  if (already) return { migrated: false, snapshot: await readCareerDomain() };
  const migrated = migrateLegacyEvidence(legacy);
  const merged = mergeCareerSnapshots(await readCareerDomain(), migrated);
  await replaceCareerDomain(merged);
  const next = await database();
  await next.put("meta", structuredClone(legacy), ARCHIVE_KEY);
  next.close();
  return { migrated: legacy.length > 0, snapshot: merged };
}

export async function saveCareerRecord<K extends "experiences" | "claims" | "metrics" | "capabilities" | "capabilityLinks" | "interviewSessions">(store: K, value: CareerDB[K]["value"]): Promise<void> {
  const db = await database(); await db.put(store, value as never); db.close();
}

export async function deleteCareerRecord(store: Exclude<StoreName, "quarantine" | "meta">, id: string): Promise<void> {
  const db = await database(); await db.delete(store, id); db.close();
}
