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
    const progress = getWorkflowProgress({ currentStep: "input", userInput: defaultUserInput, analysisResult: null, isFinalResumeStale: false });
    expect(progress[0].status).toBe("active");
    expect(progress[0].blocker).toContain("目标岗位");
    expect(progress[1].blocker).toContain("材料未齐");
  });
});
