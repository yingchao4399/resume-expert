import { describe, expect, it } from "vitest";
import { planSupplementTasks } from "@/lib/jd/supplement-planner";
import type { JDRequirementAtom, RequirementAssessment } from "@/types/jd-analysis";

function requirement(id: string, priority: JDRequirementAtom["priority"]): JDRequirementAtom {
  return { id, sourceSpanId: `s-${id}`, sourceSpanIds: [`s-${id}`], sourceQuote: id, normalizedText: id,
    kind: "task", modality: "required", priority, priorityBasis: [], expectedOutcome: null,
    anchorStatus: "validated", reviewStatus: "confirmed", isHardGate: false, userEdited: false };
}

function assessment(requirementId: string, need: RequirementAssessment["supplementNeed"], quote = ""): RequirementAssessment {
  return { requirementId, coverageStatus: quote ? "partial" : "missing", trustStatus: quote ? "resume-unverified" : "none",
    supplementNeed: need, evidenceStrength: quote ? "weak" : "none", resumeQuotes: quote ? [quote] : [], evidenceClaimIds: [],
    missingDimensions: quote ? ["result", "metric"] : ["experience"], rationale: "测试" };
}

describe("adaptive supplement planner", () => {
  it("shows at most three highest-value tasks first and asks only for the missing detail when a quote exists", () => {
    const requirements = [requirement("a", "low"), requirement("b", "critical"), requirement("c", "high"), requirement("d", "medium")];
    const tasks = planSupplementTasks(requirements, [assessment("a", "new-evidence"), assessment("b", "verify-existing", "负责 ERP"), assessment("c", "add-detail", "跨部门推进"), assessment("d", "new-evidence")]);
    expect(tasks.primary).toHaveLength(3);
    expect(tasks.primary[0].requirementId).toBe("b");
    expect(tasks.primary[0].question).toContain("核验");
    expect(tasks.primary[0].question).not.toContain("完整经历");
    expect(tasks.optional).toHaveLength(1);
  });
});
