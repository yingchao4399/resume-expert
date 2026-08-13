import { describe, expect, it } from "vitest";
import { getWorkflowProgress, workflowStageForStep } from "@/lib/workflow-progress";
import { defaultUserInput } from "@/store/resume-store";

describe("workflow progress", () => {
  it("keeps every legacy step mapped to one of four stages", () => {
    expect(workflowStageForStep("input")).toBe("materials");
    expect(workflowStageForStep("interview")).toBe("analysis");
    expect(workflowStageForStep("final-resume")).toBe("creation");
    expect(workflowStageForStep("export")).toBe("delivery");
    expect(workflowStageForStep("interview-recording")).toBe("interview-review");
  });

  it("reports actionable material blockers", () => {
    const progress = getWorkflowProgress({ currentStep: "input", userInput: defaultUserInput, analysisResult: null, finalResumeStatus: "draft" });
    expect(progress[0].status).toBe("active");
    expect(progress[0].blocker).toContain("目标岗位");
    expect(progress[1].blocker).toContain("材料未齐");
  });

  it("locks stale analysis when the material revision changes", () => {
    const progress = getWorkflowProgress({
      currentStep: "optimize", userInput: { ...defaultUserInput, targetRole: "产品经理", jobDescription: "JD", originalResume: "简历" },
      analysisResult: {} as never, finalResumeStatus: "stale", materialRevision: 2, analysisRevision: 1,
    });
    expect(progress.find((item) => item.id === "analysis")?.blocker).toContain("旧分析已锁定");
    expect(progress.find((item) => item.id === "creation")?.blocker).toBe("尚无分析结果");
  });
});
