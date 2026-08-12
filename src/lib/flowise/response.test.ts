import { describe, expect, it } from "vitest";
import { classifyFlowiseStatus, parseFlowisePrediction, withMockFallback } from "@/lib/flowise/response";

const draft = {
  targetRole: "AI 产品经理",
  projectTitle: "简历专家",
  maturity: "demo" as const,
  factDrafts: ["完成 Mock 流程"],
  missingEvidence: [],
  improvementTasks: [],
  interviewNarrative: "仅陈述已完成事实。",
  questions: [],
};

describe("Flowise response handling", () => {
  it("classifies authentication separately from offline failures", () => {
    expect(classifyFlowiseStatus(401)).toBe("authentication");
    expect(classifyFlowiseStatus(403)).toBe("authentication");
    expect(classifyFlowiseStatus(500)).toBe("offline");
  });

  it("parses JSON text and rejects malformed structured output", () => {
    expect(parseFlowisePrediction({ text: JSON.stringify(draft) })).toEqual(draft);
    expect(() => parseFlowisePrediction({ text: "not-json" })).toThrow();
    expect(() => parseFlowisePrediction({ json: { projectTitle: "missing fields" } })).toThrow();
  });

  it("uses Mock only when fallback is allowed", async () => {
    const outcome = await withMockFallback("flowise", true, async () => { throw new Error("请求超时"); }, () => draft);
    expect(outcome).toMatchObject({ actual: "mock", fallbackUsed: true, error: "请求超时", value: draft });
    await expect(withMockFallback("flowise", false, async () => { throw new Error("认证失败"); }, () => draft)).rejects.toThrow("认证失败");
  });
});
