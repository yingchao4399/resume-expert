"use client";

import { useCallback, useEffect, useState } from "react";
import type { CareerDomainSnapshot } from "@/types/career-domain";
import { readCareerDomain, replaceCareerDomain } from "@/lib/career/career-db";
import { projectClaimsToLegacyEvidence } from "@/lib/career/career-context";
import { mergeCareerSnapshots, migrateLegacyEvidence } from "@/lib/career/migration";
import { useResumeStore } from "@/store/resume-store";

const EMPTY: CareerDomainSnapshot = { schemaVersion: 1, experiences: [], claims: [], metrics: [], capabilities: [], capabilityLinks: [], interviewSessions: [], quarantined: [] };
const CAREER_DOMAIN_UPDATED_EVENT = "resume-expert-career-domain-updated";

export function useCareerDomain() {
  const hasHydrated = useResumeStore((state) => state.hasHydrated);
  const [snapshot, setSnapshot] = useState<CareerDomainSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      let next = await readCareerDomain();
      // A slow first IndexedDB open can race the legacy localStorage migration.
      // If the new database is still empty while legacy evidence is present, repair
      // it from the same deterministic migration path before rendering an empty UI.
      const legacyEvidence = useResumeStore.getState().careerEvidence;
      if (!next.experiences.length && !next.claims.length && legacyEvidence.length) {
        next = mergeCareerSnapshots(next, migrateLegacyEvidence(legacyEvidence));
        await replaceCareerDomain(next);
        useResumeStore.setState({ careerEvidence: projectClaimsToLegacyEvidence(next) });
      }
      setSnapshot(next); setError(null);
    }
    catch (next) { setError(next instanceof Error ? next.message : "经历事实库读取失败"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const load = () => { void refresh(); };
    if (hasHydrated) load();
    else window.addEventListener("resume-expert-library-hydrated", load, { once: true });
    return () => window.removeEventListener("resume-expert-library-hydrated", load);
  }, [hasHydrated, refresh]);

  useEffect(() => {
    const sync = () => { void refresh(); };
    window.addEventListener(CAREER_DOMAIN_UPDATED_EVENT, sync);
    return () => window.removeEventListener(CAREER_DOMAIN_UPDATED_EVENT, sync);
  }, [refresh]);

  const save = useCallback(async (next: CareerDomainSnapshot) => {
    await replaceCareerDomain(next);
    setSnapshot(next);
    useResumeStore.setState({ careerEvidence: projectClaimsToLegacyEvidence(next) });
    queueMicrotask(() => window.dispatchEvent(new Event(CAREER_DOMAIN_UPDATED_EVENT)));
  }, []);

  return { snapshot, loading, error, save, refresh };
}
