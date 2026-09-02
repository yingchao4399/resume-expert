import type { JDRequirementAtom, JobReadinessAssessmentV2, ReadinessMetric, RequirementAssessment } from "@/types/jd-analysis";
import type { MatchItem } from "@/types/resume";

const PRIORITY_WEIGHT: Record<JDRequirementAtom["priority"], number> = { critical: 4, high: 3, medium: 2, low: 1 };
const COVERAGE_VALUE = { covered: 1, partial: 0.5, missing: 0 } as const;
const TRUST_VALUE = { confirmed: 1, "resume-unverified": 0.5, none: 0 } as const;

function uniqueDimensions(item: MatchItem): RequirementAssessment["missingDimensions"] {
  const text = (item.missingEvidenceTypes ?? []).join(" ");
  const dimensions: RequirementAssessment["missingDimensions"] = [];
  if (/范围|场景|scope/i.test(text)) dimensions.push("scope");
  if (/贡献|角色|职责|独立|contribution/i.test(text)) dimensions.push("contribution");
  if (/行动|方法|过程|action/i.test(text)) dimensions.push("action");
  if (/结果|成果|影响|result|outcome/i.test(text)) dimensions.push("result");
  if (/指标|数据|口径|metric|量化/i.test(text)) dimensions.push("metric");
  if (!item.evidenceClaimIds?.length && !item.resumeQuotes?.length) dimensions.push("experience");
  if (item.resumeQuotes?.length && dimensions.length === 0) dimensions.push("contribution", "result", "metric");
  if (item.evidenceClaimIds?.length && item.evidenceStrength !== "strong" && dimensions.length === 0) dimensions.push("result", "metric");
  return [...new Set(dimensions)];
}

export function assessRequirements(requirements: JDRequirementAtom[], matches: MatchItem[]): RequirementAssessment[] {
  const byId = new Map(matches.map((item) => [item.requirementId, item]));
  return requirements.filter((item) => item.reviewStatus === "confirmed").map((requirement) => {
    const match = byId.get(requirement.id);
    const claimIds = [...new Set(match?.evidenceClaimIds ?? [])];
    const quotes = [...new Set((match?.resumeQuotes ?? []).filter(Boolean))];
    const strength = match?.evidenceStrength ?? "none";
    const trustStatus: RequirementAssessment["trustStatus"] = claimIds.length ? "confirmed" : quotes.length ? "resume-unverified" : "none";
    const coverageStatus: RequirementAssessment["coverageStatus"] = claimIds.length && ["strong", "medium"].includes(strength)
      ? "covered" : claimIds.length || quotes.length ? "partial" : "missing";
    const missingDimensions = match ? uniqueDimensions(match) : ["experience" as const];
    const supplementNeed: RequirementAssessment["supplementNeed"] = trustStatus === "none"
      ? "new-evidence" : trustStatus === "resume-unverified" ? "verify-existing" : strength === "strong" && missingDimensions.length === 0 ? "none" : "add-detail";
    const matchConfidence: RequirementAssessment["matchConfidence"] = strength === "strong" ? "high" : strength === "medium" ? "medium" : trustStatus === "none" ? "low" : "medium";
    const recommendedAction: RequirementAssessment["recommendedAction"] = supplementNeed === "none" ? "无需补充" : supplementNeed === "verify-existing" ? "核验现有内容" : supplementNeed === "add-detail" ? "补充细节" : "补充新经历";
    const evidenceBasis = [
      claimIds.length ? `已确认事实 ${claimIds.length} 条` : "未关联已确认事实",
      quotes.length ? `原简历原文引用 ${quotes.length} 条（候选证据）` : "无原简历连续引用",
      strength === "strong" ? "包含完整行动、结果或指标" : "仍缺少可核验的完整结果或指标",
    ];
    return {
      requirementId: requirement.id, coverageStatus, trustStatus, supplementNeed, evidenceStrength: strength,
      resumeQuotes: quotes, evidenceClaimIds: claimIds, missingDimensions,
      rationale: trustStatus === "confirmed" ? "已关联用户确认的结构化事实。" : trustStatus === "resume-unverified" ? "原简历已有合法引用，等待用户核验。" : "尚未找到可核验经历。",
      matchConfidence, evidenceBasis, candidateEvidenceClaimIds: [], recommendedAction,
    };
  });
}

function metric(label: string, numerator: number, denominator: number): ReadinessMetric {
  return { label, numerator, denominator, applicable: denominator > 0, value: denominator > 0 ? Math.round((numerator / denominator) * 100) : null };
}

export function calculateJobReadinessV2(input: { requirements: JDRequirementAtom[]; requirementAssessments: RequirementAssessment[]; unresolvedHighImpactUnknowns: number }): JobReadinessAssessmentV2 {
  const requirements = input.requirements.filter((item) => item.reviewStatus === "confirmed");
  const byId = new Map(input.requirementAssessments.map((item) => [item.requirementId, item]));
  const missingAssessment = (requirementId: string): RequirementAssessment => ({
    requirementId, coverageStatus: "missing", trustStatus: "none", supplementNeed: "new-evidence", evidenceStrength: "none",
    resumeQuotes: [], evidenceClaimIds: [], missingDimensions: ["experience"], rationale: "尚未形成有效匹配结果。",
  });
  const weighted = (value: (item: RequirementAssessment) => number, subset = requirements) => {
    const denominator = subset.reduce((sum, item) => sum + PRIORITY_WEIGHT[item.priority], 0);
    const numerator = subset.reduce((sum, item) => sum + PRIORITY_WEIGHT[item.priority] * value(byId.get(item.id) ?? missingAssessment(item.id)), 0);
    return { numerator, denominator };
  };
  const coverage = weighted((item) => COVERAGE_VALUE[item.coverageStatus]);
  const trust = weighted((item) => TRUST_VALUE[item.trustStatus]);
  const resultRequirements = requirements.filter((item) => item.kind === "deliverable" || Boolean(item.expectedOutcome?.trim()));
  const result = weighted((item) => item.missingDimensions.includes("result") || item.missingDimensions.includes("metric") ? 0 : item.evidenceStrength === "strong" ? 1 : 0.67, resultRequirements);
  const hardGates = requirements.filter((item) => item.isHardGate);
  const critical = requirements.filter((item) => item.priority === "critical");
  const hard = weighted((item) => COVERAGE_VALUE[item.coverageStatus], hardGates);
  const criticalCoverage = weighted((item) => COVERAGE_VALUE[item.coverageStatus], critical);
  const metrics = [
    { weight: 0.5, value: metric("要求覆盖", coverage.numerator, coverage.denominator) },
    { weight: 0.3, value: metric("证据可信度", trust.numerator, trust.denominator) },
    { weight: 0.2, value: metric("成果与指标质量", result.numerator, result.denominator) },
  ];
  const activeWeight = metrics.filter((item) => item.value.applicable).reduce((sum, item) => sum + item.weight, 0);
  const overallScore = activeWeight ? Math.round(metrics.reduce((sum, item) => sum + (item.value.value ?? 0) * item.weight, 0) / activeWeight) : 0;
  const missingHardGate = hardGates.some((item) => (byId.get(item.id)?.coverageStatus ?? "missing") === "missing");
  const weakHardGate = hardGates.some((item) => (byId.get(item.id)?.trustStatus ?? "none") !== "confirmed");
  let recommendation: JobReadinessAssessmentV2["recommendation"] = "supplement-before-apply";
  if (overallScore < 50 || missingHardGate) recommendation = "cautious-apply";
  else if (overallScore >= 75 && !weakHardGate && (criticalCoverage.denominator === 0 || criticalCoverage.numerator / criticalCoverage.denominator >= 0.7) && input.unresolvedHighImpactUnknowns === 0) recommendation = "priority-apply";
  const ordered = [...requirements].sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
  return {
    version: 2, experimental: true, overallScore, recommendation,
    confidence: input.requirementAssessments.some((item) => item.trustStatus === "confirmed") ? "high" : input.requirementAssessments.some((item) => item.trustStatus === "resume-unverified") ? "medium" : "low",
    coverageScore: metric("要求覆盖", coverage.numerator, coverage.denominator),
    trustScore: metric("证据可信度", trust.numerator, trust.denominator),
    resultQualityScore: metric("成果与指标质量", result.numerator, result.denominator),
    hardGateCoverage: metric("硬门槛覆盖", hard.numerator, hard.denominator),
    criticalRequirementCoverage: metric("关键要求覆盖", criticalCoverage.numerator, criticalCoverage.denominator),
    unresolvedHighImpactUnknowns: input.unresolvedHighImpactUnknowns,
    requirementAssessments: input.requirementAssessments,
    strongestRequirementIds: ordered.filter((item) => byId.get(item.id)?.coverageStatus === "covered").slice(0, 5).map((item) => item.id),
    gapRequirementIds: ordered.filter((item) => byId.get(item.id)?.supplementNeed !== "none").slice(0, 5).map((item) => item.id),
    explanation: ["总分是实验估算，页面结论以覆盖、可信证据和高价值缺口为主。", hardGates.length ? (missingHardGate ? "存在完全缺失证据的硬门槛。" : "硬门槛已有候选或可信覆盖。") : "当前 JD 未识别出适用的硬门槛。", input.unresolvedHighImpactUnknowns ? `仍有 ${input.unresolvedHighImpactUnknowns} 个高影响未知项。` : "没有未解决的高影响未知项。"],
  };
}
