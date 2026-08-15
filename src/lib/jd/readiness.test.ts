import { describe, expect, it } from "vitest";
import { calculateJobReadiness, determineEvidenceStrength } from "@/lib/jd/readiness";
import type { CareerAnalysisClaim } from "@/lib/career/career-context";
import type { JDRequirementAtom } from "@/types/jd-analysis";

function requirement(id: string, priority: JDRequirementAtom["priority"], hardGate = false): JDRequirementAtom {
  return {
    id,
    sourceSpanId: `span-${id}`,
    sourceSpanIds: [`span-${id}`],
    sourceQuote: id,
    normalizedText: id,
    kind: "task",
    modality: "required",
    priority,
    priorityBasis: ["测试"],
    expectedBehavior: "",
    expectedOutcome: null,
    proficiencySignal: "unknown",
    keywords: [],
    anchorStatus: "validated",
    reviewStatus: "confirmed",
    isHardGate: hardGate,
    userEdited: false,
  };
}

const strongClaim: CareerAnalysisClaim = {
  id: "claim-1",
  experienceId: "experience-1",
  experienceTitle: "项目",
  organization: "组织",
  role: "负责人",
  text: "独立完成复杂项目并取得结果",
  kind: "result",
  contribution: "led",
  complexity: "complex",
  hasTradeoff: true,
  hasMethodReuse: true,
  capabilities: [],
  metrics: [{ id: "metric-1", value: "20", unit: "%", baseline: "改造前", method: "同期对比", period: "3个月", sourceNote: "业务报表" }],
};

describe("job readiness", () => {
  it("never treats resume text alone as stronger than weak evidence", () => {
    expect(determineEvidenceStrength({ claim: null, resumeQuotes: ["负责相关工作"] })).toBe("weak");
    expect(determineEvidenceStrength({ claim: strongClaim, resumeQuotes: [] })).toBe("strong");
  });

  it("calculates the approved weighted formula and recommendation deterministically", () => {
    const assessment = calculateJobReadiness({
      requirements: [requirement("critical", "critical"), requirement("high", "high"), requirement("medium", "medium"), requirement("low", "low")],
      evidenceByRequirement: new Map([
        ["critical", "strong"],
        ["high", "medium"],
        ["medium", "weak"],
        ["low", "none"],
      ]),
      resultEvidenceRequirementIds: new Set(["critical", "high"]),
      completeMetricRequirementIds: new Set(["critical"]),
      unresolvedHighImpactUnknowns: 0,
    });

    expect(assessment.overallScore).toBe(67);
    expect(assessment.recommendation).toBe("supplement-before-apply");
  });

  it("returns cautious-apply when a confirmed hard gate has no evidence", () => {
    const assessment = calculateJobReadiness({
      requirements: [requirement("gate", "critical", true), requirement("task", "high")],
      evidenceByRequirement: new Map([["gate", "none"], ["task", "strong"]]),
      resultEvidenceRequirementIds: new Set(),
      completeMetricRequirementIds: new Set(),
      unresolvedHighImpactUnknowns: 0,
    });
    expect(assessment.recommendation).toBe("cautious-apply");
  });
});
