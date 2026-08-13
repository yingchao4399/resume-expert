import type { CareerEvidence } from "@/types/resume";
import type { CareerDomainSnapshot, CareerExperience, EvidenceClaim } from "@/types/career-domain";

function id(prefix: string, value: string): string {
  let hash = 2166136261;
  for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `${prefix}-${(hash >>> 0).toString(16)}`;
}

function groupKey(item: CareerEvidence): string | null {
  if (item.type === "skill" || (!item.organization.trim() && item.type === "achievement")) return null;
  const title = item.type === "project" ? item.title : item.organization;
  return [item.type, title, item.role, item.period].map((value) => value.trim().toLocaleLowerCase()).join("|");
}

export function migrateLegacyEvidence(evidence: CareerEvidence[]): CareerDomainSnapshot {
  const timestamp = new Date().toISOString();
  const groups = new Map<string, CareerEvidence[]>();
  const inbox: CareerEvidence[] = [];
  for (const item of evidence) {
    const key = groupKey(item);
    if (!key) inbox.push(item);
    else groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const experiences: CareerExperience[] = [];
  const claims: EvidenceClaim[] = [];
  let order = 0;
  for (const [key, items] of groups) {
    const first = items[0];
    const experienceId = id("experience", key);
    experiences.push({
      id: experienceId, type: first.type === "project" ? "project" : "work",
      title: first.type === "project" ? first.title : first.role || first.organization,
      organization: first.organization, role: first.role, startDate: "", endDate: "", periodText: first.period,
      summary: "", order: order++, status: "candidate", createdAt: timestamp, updatedAt: timestamp,
    });
    claims.push(...items.map((item) => legacyClaim(item, experienceId)));
  }
  if (inbox.length) {
    const experienceId = "experience-inbox";
    experiences.push({ id: experienceId, type: "inbox", title: "待整理箱", organization: "", role: "", startDate: "", endDate: "", periodText: "", summary: "无法可靠归组的旧证据", order, status: "needs-review", createdAt: timestamp, updatedAt: timestamp });
    claims.push(...inbox.map((item) => legacyClaim(item, experienceId)));
  }
  return { schemaVersion: 1, experiences, claims, metrics: [], capabilities: [], capabilityLinks: [], interviewSessions: [], quarantined: [] };
}

function legacyClaim(item: CareerEvidence, experienceId: string): EvidenceClaim {
  return {
    id: item.id, experienceId, kind: item.type === "skill" ? "skill-practice" : item.metrics.length ? "result" : "action",
    text: item.description, contribution: "independent", complexity: "routine", hasTradeoff: false, hasMethodReuse: false,
    status: "needs-review", sourceReference: item.sourceReference, sourceQuote: item.description, sourceRunId: item.sourceReference?.runId ?? null,
    sourceRound: null, createdAt: item.createdAt, updatedAt: item.updatedAt,
  };
}

export function mergeCareerSnapshots(existing: CareerDomainSnapshot, incoming: CareerDomainSnapshot): CareerDomainSnapshot {
  const merge = <T extends { id: string }>(left: T[], right: T[]) => [...new Map([...left, ...right].map((item) => [item.id, item])).values()];
  return {
    schemaVersion: 1,
    experiences: merge(existing.experiences, incoming.experiences), claims: merge(existing.claims, incoming.claims),
    metrics: merge(existing.metrics, incoming.metrics), capabilities: merge(existing.capabilities, incoming.capabilities),
    capabilityLinks: merge(existing.capabilityLinks, incoming.capabilityLinks), interviewSessions: merge(existing.interviewSessions, incoming.interviewSessions),
    quarantined: [...existing.quarantined, ...incoming.quarantined],
  };
}
