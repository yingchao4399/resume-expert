import type { CareerAnalysisClaim } from "@/lib/career/career-context";
import type { EvidenceStrength } from "@/types/resume";
import type { JDRequirementAtom, JobReadinessAssessment } from "@/types/jd-analysis";

const PRIORITY_WEIGHT: Record<JDRequirementAtom["priority"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const EVIDENCE_VALUE: Record<EvidenceStrength, number> = {
  strong: 1,
  medium: 0.67,
  weak: 0.33,
  none: 0,
};

export function determineEvidenceStrength(input: {
  claim: CareerAnalysisClaim | null;
  resumeQuotes: string[];
}): EvidenceStrength {
  if (!input.claim) return input.resumeQuotes.some((item) => item.trim()) ? "weak" : "none";
  const claim = input.claim;
  const hasCompleteMetric = claim.metrics.some((metric) =>
    metric.value.trim() && metric.unit.trim() && metric.method.trim() && metric.sourceNote.trim()
  );
  const strongSignals = [
    claim.contribution === "led",
    claim.complexity === "complex",
    claim.hasTradeoff,
    claim.hasMethodReuse,
    claim.kind === "result",
    hasCompleteMetric,
  ].filter(Boolean).length;
  if (strongSignals >= 4 && (claim.contribution === "led" || claim.contribution === "independent")) return "strong";
  if (claim.contribution !== "assisted" && (strongSignals >= 2 || hasCompleteMetric)) return "medium";
  return "weak";
}

function percentage(numerator: number, denominator: number): number {
  return denominator ? Math.round((numerator / denominator) * 100) : 0;
}

export function calculateJobReadiness(input: {
  requirements: JDRequirementAtom[];
  evidenceByRequirement: Map<string, EvidenceStrength>;
  resultEvidenceRequirementIds: Set<string>;
  completeMetricRequirementIds: Set<string>;
  unresolvedHighImpactUnknowns: number;
}): JobReadinessAssessment {
  const requirements = input.requirements.filter((item) => item.reviewStatus === "confirmed");
  const totalWeight = requirements.reduce((sum, item) => sum + PRIORITY_WEIGHT[item.priority], 0);
  const weightedEvidence = requirements.reduce((sum, item) =>
    sum + PRIORITY_WEIGHT[item.priority] * EVIDENCE_VALUE[input.evidenceByRequirement.get(item.id) ?? "none"], 0);
  const overallScore = percentage(weightedEvidence, totalWeight);
  const hardGates = requirements.filter((item) => item.isHardGate);
  const critical = requirements.filter((item) => item.priority === "critical");
  const covered = (requirement: JDRequirementAtom) => (input.evidenceByRequirement.get(requirement.id) ?? "none") !== "none";
  const hardGateCoverage = percentage(hardGates.filter(covered).length, hardGates.length);
  const criticalRequirementCoverage = percentage(critical.filter(covered).length, critical.length);
  const resultEvidenceScore = percentage(input.resultEvidenceRequirementIds.size, requirements.length);
  const metricCompletenessScore = percentage(input.completeMetricRequirementIds.size, requirements.length);
  const missingHardGate = hardGates.some((item) => (input.evidenceByRequirement.get(item.id) ?? "none") === "none");
  const weakHardGate = hardGates.some((item) => (input.evidenceByRequirement.get(item.id) ?? "none") === "weak");

  let recommendation: JobReadinessAssessment["recommendation"] = "supplement-before-apply";
  if (overallScore < 50 || missingHardGate) recommendation = "cautious-apply";
  else if (overallScore >= 75 && !weakHardGate && criticalRequirementCoverage >= 70 && input.unresolvedHighImpactUnknowns === 0) {
    recommendation = "priority-apply";
  }

  const ordered = [...requirements].sort((a, b) => {
    const evidenceDelta = EVIDENCE_VALUE[input.evidenceByRequirement.get(b.id) ?? "none"] - EVIDENCE_VALUE[input.evidenceByRequirement.get(a.id) ?? "none"];
    return evidenceDelta || PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  });
  const strongestRequirementIds = ordered.filter((item) => (input.evidenceByRequirement.get(item.id) ?? "none") !== "none").slice(0, 5).map((item) => item.id);
  const gapRequirementIds = [...requirements]
    .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])
    .filter((item) => ["none", "weak"].includes(input.evidenceByRequirement.get(item.id) ?? "none"))
    .slice(0, 5)
    .map((item) => item.id);

  return {
    overallScore,
    recommendation,
    hardGateCoverage,
    criticalRequirementCoverage,
    resultEvidenceScore,
    metricCompletenessScore,
    unresolvedHighImpactUnknowns: input.unresolvedHighImpactUnknowns,
    strongestRequirementIds,
    gapRequirementIds,
    explanation: [
      `岗位准备度按已确认要求的优先级和证据强度确定性计算，当前为 ${overallScore} 分。`,
      missingHardGate ? "存在完全没有证据的硬门槛。" : "未发现完全缺失证据的硬门槛。",
      input.unresolvedHighImpactUnknowns ? `仍有 ${input.unresolvedHighImpactUnknowns} 个高影响未知项。` : "没有未解决的高影响未知项。",
    ],
  };
}
