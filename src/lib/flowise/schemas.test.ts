import { describe, expect, it } from "vitest";
import { projectEvidenceDraftSchema, projectEvidenceInputSchema } from "@/lib/flowise/schemas";

describe("ProjectEvidenceDraft", () => {
  it("accepts a grounded project draft", () => {
    const result = projectEvidenceDraftSchema.safeParse({
      targetRole: "AI 产品经理",
      projectTitle: "简历专家",
      maturity: "demo",
      factDrafts: ["完成本地简历导出"],
      missingEvidence: ["缺少真实用户验证"],
      improvementTasks: ["补充测试记录"],
      interviewNarrative: "先说明已完成事实，再说明验证计划。",
      questions: ["谁使用过这个项目？"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty facts and undersized input", () => {
    expect(projectEvidenceDraftSchema.safeParse({ targetRole: "x", projectTitle: "x", maturity: "demo", factDrafts: [], missingEvidence: [], improvementTasks: [], interviewNarrative: "x", questions: [] }).success).toBe(false);
    expect(projectEvidenceInputSchema.safeParse({ targetRole: "x", projectTitle: "x", currentDemo: "短" }).success).toBe(false);
  });
});
