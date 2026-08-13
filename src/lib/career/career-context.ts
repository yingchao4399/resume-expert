import type { CareerDomainSnapshot, EvidenceClaim } from "@/types/career-domain";
import type { CareerEvidence } from "@/types/resume";

export interface CareerAnalysisClaim {
  id: string;
  experienceId: string;
  experienceTitle: string;
  organization: string;
  role: string;
  text: string;
  kind: EvidenceClaim["kind"];
  contribution: EvidenceClaim["contribution"];
  complexity: EvidenceClaim["complexity"];
  hasTradeoff: boolean;
  hasMethodReuse: boolean;
  capabilities: Array<{ id: string; name: string; aliases: string[] }>;
  metrics: Array<{ id: string; value: string; unit: string; baseline: string; method: string; period: string; sourceNote: string }>;
}

function terms(value: string): string[] {
  return [...new Set(value.toLocaleLowerCase().split(/[\s,，。；;、|/()（）【】\[\]·+]+/).map((item) => item.trim()).filter((item) => item.length >= 2))];
}

export function selectRelevantClaims(snapshot: CareerDomainSnapshot, targetRole: string, jobDescription: string, limit = 12): EvidenceClaim[] {
  const target = `${targetRole}\n${jobDescription}`.toLocaleLowerCase();
  const targetTerms = terms(target);
  const confirmedExperiences = new Set(snapshot.experiences.filter((item) => item.status === "confirmed").map((item) => item.id));
  const capabilityById = new Map(snapshot.capabilities.map((item) => [item.id, item]));
  const claimCapabilityTerms = new Map<string, string[]>();
  for (const link of snapshot.capabilityLinks.filter((item) => item.status === "confirmed")) {
    const capability = capabilityById.get(link.capabilityId);
    if (capability) claimCapabilityTerms.set(link.claimId, [...(claimCapabilityTerms.get(link.claimId) ?? []), capability.name, ...capability.aliases]);
  }
  return snapshot.claims.filter((claim) => claim.status === "confirmed" && confirmedExperiences.has(claim.experienceId)).map((claim) => ({
    claim,
    score: [...terms(claim.text), ...(claimCapabilityTerms.get(claim.id) ?? []).flatMap(terms)].filter((term) =>
      target.includes(term) || targetTerms.some((targetTerm) => term.includes(targetTerm) || targetTerm.includes(term)),
    ).length,
  })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || b.claim.updatedAt.localeCompare(a.claim.updatedAt)).slice(0, limit).map((item) => item.claim);
}

export function buildCareerAnalysisClaims(snapshot: CareerDomainSnapshot): CareerAnalysisClaim[] {
  const experiences = new Map(snapshot.experiences.filter((item) => item.status === "confirmed").map((item) => [item.id, item]));
  const capabilities = new Map(snapshot.capabilities.map((item) => [item.id, item]));
  return snapshot.claims
    .filter((claim) => claim.status === "confirmed" && experiences.has(claim.experienceId))
    .map((claim) => {
      const experience = experiences.get(claim.experienceId)!;
      return {
        id: claim.id,
        experienceId: claim.experienceId,
        experienceTitle: experience.title,
        organization: experience.organization,
        role: experience.role,
        text: claim.text,
        kind: claim.kind,
        contribution: claim.contribution,
        complexity: claim.complexity,
        hasTradeoff: claim.hasTradeoff,
        hasMethodReuse: claim.hasMethodReuse,
        capabilities: snapshot.capabilityLinks
          .filter((link) => link.claimId === claim.id && link.status === "confirmed")
          .flatMap((link) => {
            const capability = capabilities.get(link.capabilityId);
            return capability ? [{ id: capability.id, name: capability.name, aliases: capability.aliases }] : [];
          }),
        metrics: snapshot.metrics
          .filter((metric) => metric.claimId === claim.id && metric.status === "confirmed")
          .map(({ id, value, unit, baseline, method, period, sourceNote }) => ({ id, value, unit, baseline, method, period, sourceNote })),
      };
    });
}

export function careerClaimsPrompt(snapshot: CareerDomainSnapshot, claims: EvidenceClaim[]): string {
  if (!claims.length) return "当前没有与此岗位明确相关的已确认原子事实，不得回退到整个资料库；证据不足时必须追问。";
  const experienceById = new Map(snapshot.experiences.map((item) => [item.id, item]));
  return [
    "以下事实来自已确认经历，ID 必须作为后续简历来源引用；仅允许使用已确认指标：",
    ...claims.map((claim) => {
      const experience = experienceById.get(claim.experienceId);
      const metrics = snapshot.metrics.filter((item) => item.claimId === claim.id && item.status === "confirmed").map((item) => `${item.value}${item.unit}（${item.method}；来源：${item.sourceNote}）`);
      return `[${claim.id}] ${experience?.title ?? "经历"}｜${experience?.organization ?? ""}｜${claim.text}${metrics.length ? `｜指标：${metrics.join("；")}` : ""}`;
    }),
  ].join("\n");
}

export function projectClaimsToLegacyEvidence(snapshot: CareerDomainSnapshot): CareerEvidence[] {
  const experiences = new Map(snapshot.experiences.map((item) => [item.id, item]));
  const capabilities = new Map(snapshot.capabilities.map((item) => [item.id, item]));
  const timestamp = new Date().toISOString();
  return snapshot.claims.map((claim) => {
    const experience = experiences.get(claim.experienceId);
    const metrics = snapshot.metrics.filter((item) => item.claimId === claim.id && item.status === "confirmed").map((item) => `${item.value}${item.unit}`);
    return {
      id: claim.id, type: experience?.type === "project" ? "project" : "work", title: experience?.title ?? "待整理事实",
      organization: experience?.organization ?? "", role: experience?.role ?? "", period: experience?.periodText ?? "", description: claim.text,
      metrics, skills: snapshot.capabilityLinks.filter((link) => link.claimId === claim.id && link.status === "confirmed").flatMap((link) => {
        const capability = capabilities.get(link.capabilityId); return capability ? [capability.name, ...capability.aliases] : [];
      }), status: claim.status === "confirmed" && experience?.status === "confirmed" ? "confirmed" : "candidate",
      sourceType: claim.sourceReference?.kind ?? "manual", sourceDocumentId: null, sourceReference: claim.sourceReference,
      createdAt: claim.createdAt || timestamp, updatedAt: claim.updatedAt || timestamp,
    };
  });
}
