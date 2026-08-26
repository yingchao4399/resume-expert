import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseJDSourceSpans } from "@/lib/jd/decision-map";
import type { UserInput } from "@/types/resume";

const { chatCompletionJSON } = vi.hoisted(() => ({ chatCompletionJSON: vi.fn() }));

vi.mock("@/lib/ai/config", () => ({
  getAIConfig: () => ({ mode: "llm", provider: "qwen", model: "qwen3.7-flash", baseUrl: "https://example.test/v1", apiKey: "test" }),
}));
vi.mock("@/lib/ai/client", () => ({ chatCompletionJSON }));

import { analyzeJDDecisionMapServer } from "@/services/ai/jdDecisionAgent.server";

const input: UserInput = {
  targetRole: "产品经理",
  industry: "SaaS",
  companyType: "中型公司",
  jobStage: "社招-中级",
  highlightSkills: "需求分析",
  jobDescription: "岗位职责\n- 负责企业产品需求分析与迭代\n任职要求\n- 具备跨团队协作能力",
  originalResume: "测试简历",
  additionalInfo: "",
};

describe("JD decision map optional overview", () => {
  beforeEach(() => chatCompletionJSON.mockReset());

  it("keeps parsed requirements and marks the overview unknown when the overview times out", async () => {
    const requirementSpans = parseJDSourceSpans(input.jobDescription).filter((span) => span.role !== "heading");
    chatCompletionJSON
      .mockResolvedValueOnce({
        sourceClassifications: requirementSpans.map((span) => ({ sourceItemId: span.id, classification: "requirement" })),
        requirements: requirementSpans.map((span) => ({
          sourceItemId: span.id,
          sourceQuote: span.text,
          requirement: span.text.replace(/^-\s*/, ""),
          category: "responsibility",
          priority: "must",
          keywords: ["需求分析"],
          interviewFocus: "说明真实项目",
        })),
      })
      .mockRejectedValueOnce(new Error("模型请求超时（60 秒）"));

    const progress: string[] = [];
    const result = await analyzeJDDecisionMapServer(input, { companyName: "", notes: "", companySnapshotId: null }, 3, {
      forceMock: false,
      onDecisionProgress: (event) => progress.push(event.message),
    });

    expect(result.document.requirements).toHaveLength(requirementSpans.length);
    expect(result.document.hypotheses).toHaveLength(9);
    expect(result.document.hypotheses.every((item) => item.status === "unknown" && item.conclusion === "信息不足")).toBe(true);
    expect(progress).toContain("岗位画像暂不可用，已保留需求地图并标记为信息不足");
  });
});
