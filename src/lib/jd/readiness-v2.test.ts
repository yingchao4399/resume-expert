import { describe, expect, it } from "vitest";
import { assessRequirements, calculateJobReadinessV2 } from "@/lib/jd/readiness-v2";
import type { JDRequirementAtom } from "@/types/jd-analysis";
import type { MatchItem } from "@/types/resume";

function requirement(id: string, kind: JDRequirementAtom["kind"] = "task", hardGate = false): JDRequirementAtom {
  return { id, sourceSpanId: `span-${id}`, sourceSpanIds: [`span-${id}`], sourceQuote: id, normalizedText: id,
    kind, modality: "required", priority: hardGate ? "critical" : "high", priorityBasis: ["测试"], expectedOutcome: null,
    anchorStatus: "validated", reviewStatus: "confirmed", isHardGate: hardGate, userEdited: false };
}

function match(requirementId: string, patch: Partial<MatchItem> = {}): MatchItem {
  return { requirementId, jdRequirement: requirementId, evidenceClaimIds: [], resumeQuotes: [], resumeEvidence: "",
    evidenceStrength: "none", missingEvidenceTypes: [], needsSupplement: true, optimizationSuggestion: "", ...patch };
}

describe("job readiness v2", () => {
  it("treats a valid original-resume quote as candidate coverage that needs verification, not a new experience", () => {
    const [assessment] = assessRequirements([requirement("erp")], [match("erp", { resumeQuotes: ["负责 ERP 与 WMS 产品"], evidenceStrength: "weak" })]);
    expect(assessment.coverageStatus).toBe("partial");
    expect(assessment.trustStatus).toBe("resume-unverified");
    expect(assessment.supplementNeed).toBe("verify-existing");
  });

  it("marks confirmed structured facts as trusted coverage", () => {
    const [assessment] = assessRequirements([requirement("saas")], [match("saas", { evidenceClaimIds: ["claim-1"], evidenceStrength: "medium" })]);
    expect(assessment.coverageStatus).toBe("covered");
    expect(assessment.trustStatus).toBe("confirmed");
    expect(assessment.supplementNeed).toBe("add-detail");
  });

  it("excludes dimensions with no applicable requirements instead of reporting zero", () => {
    const assessments = assessRequirements([requirement("collab", "collaboration")], [match("collab", { evidenceClaimIds: ["claim-1"], evidenceStrength: "medium" })]);
    const result = calculateJobReadinessV2({ requirements: [requirement("collab", "collaboration")], requirementAssessments: assessments, unresolvedHighImpactUnknowns: 0 });
    expect(result.resultQualityScore.applicable).toBe(false);
    expect(result.resultQualityScore.value).toBeNull();
    expect(result.hardGateCoverage.applicable).toBe(false);
    expect(result.overallScore).toBeGreaterThan(0);
  });

  it("treats a missing hard-gate assessment as uncovered instead of silently passing it", () => {
    const hardGate = requirement("required-license", "credential", true);
    const result = calculateJobReadinessV2({ requirements: [hardGate], requirementAssessments: [], unresolvedHighImpactUnknowns: 0 });
    expect(result.hardGateCoverage.value).toBe(0);
    expect(result.recommendation).toBe("cautious-apply");
    expect(result.explanation).toContain("存在完全缺失证据的硬门槛。");
  });
});
