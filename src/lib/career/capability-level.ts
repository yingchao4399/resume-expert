import type { CapabilityEvidenceLink, CapabilityLevel, CareerExperience, EvidenceClaim, MetricEvidence } from "@/types/career-domain";

export interface CapabilityLevelResult { level: CapabilityLevel; reasons: string[] }

export function calculateVerifiedCapabilityLevel(
  capabilityId: string,
  experiences: CareerExperience[],
  claims: EvidenceClaim[],
  metrics: MetricEvidence[],
  links: CapabilityEvidenceLink[]
): CapabilityLevelResult {
  const confirmedClaimIds = new Set(links.filter((link) => link.capabilityId === capabilityId && link.status === "confirmed").map((link) => link.claimId));
  const evidence = claims.filter((claim) => confirmedClaimIds.has(claim.id) && claim.status === "confirmed");
  const confirmedExperiences = new Set(experiences.filter((item) => item.status === "confirmed").map((item) => item.id));
  const valid = evidence.filter((claim) => confirmedExperiences.has(claim.experienceId));
  if (!valid.length) return { level: 0, reasons: ["没有已确认经历中的已确认事实"] };

  const independent = valid.some((claim) => claim.contribution === "independent" || claim.contribution === "led");
  const complex = valid.some((claim) => claim.complexity === "complex" && (claim.hasTradeoff || metrics.some((metric) => metric.claimId === claim.id && metric.status === "confirmed")));
  const led = valid.some((claim) => claim.contribution === "led" && claim.hasMethodReuse);
  const experienceCount = new Set(valid.map((claim) => claim.experienceId)).size;
  if (led && experienceCount >= 2) return { level: 4, reasons: ["至少两个经历提供证据", "包含主导及方法沉淀事实"] };
  if (complex) return { level: 3, reasons: ["包含复杂场景", "有取舍说明或已确认结果指标"] };
  if (independent) return { level: 2, reasons: ["存在独立完成或主导的事实"] };
  return { level: 1, reasons: ["存在实际接触或协助完成的事实"] };
}

export function isMetricComplete(metric: Pick<MetricEvidence, "value" | "method" | "sourceNote">): boolean {
  return Boolean(metric.value.trim() && metric.method.trim() && metric.sourceNote.trim());
}
