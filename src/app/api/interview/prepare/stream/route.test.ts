import { describe, expect, it } from "vitest";
import { POST as prepare } from "@/app/api/interview/prepare/stream/route";
import { EXAMPLE_USER_INPUT } from "@/store/resume-store-example";
import { runMockResumeAnalysis } from "@/services/ai/resumeAgent.mock";

const context = { companyName: "", notes: "", companySnapshotId: null } as const;

async function events(response: Response) {
  return (await response.text()).split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function mockAnalysisResult() {
  return runMockResumeAnalysis(EXAMPLE_USER_INPUT, "ai-product", context, []);
}

describe("on-demand interview preparation stream", () => {
  it("generates interview content only after an explicit request", async () => {
    const analysisResult = await mockAnalysisResult();
    expect(analysisResult.interviewPrep.likelyQuestions).toEqual([]);
    const response = await prepare(new Request("http://localhost/api/interview/prepare/stream", { method: "POST", headers: { "Content-Type": "application/json", "X-Workflow-Provider": "mock" }, body: JSON.stringify({ input: EXAMPLE_USER_INPUT, jobTargetContext: context, analysisResult, materialRevision: 1 }) }));
    const output = await events(response);
    expect(output.map((event) => event.type)).toEqual(["started", "completed"]);
    expect(output.at(-1).interviewPrep.likelyQuestions.length).toBeGreaterThan(0);
  });

  it("accepts legacy analysis with a long JD evidence excerpt", async () => {
    const analysisResult = await mockAnalysisResult();
    analysisResult.jdAnalysis.roleInference = { items: [{
      topic: "work-content",
      level: "explicit",
      conclusion: "负责复杂业务系统建设",
      evidence: ["负责复杂业务系统建设、需求分析、跨团队协同与持续交付。".repeat(30)],
      confidence: "high",
      verificationQuestion: "该岗位最重要的交付目标是什么？",
    }] };

    const response = await prepare(new Request("http://localhost/api/interview/prepare/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Workflow-Provider": "mock" },
      body: JSON.stringify({ input: EXAMPLE_USER_INPUT, jobTargetContext: context, analysisResult, materialRevision: 1 }),
    }));
    const output = await events(response);

    expect(response.status).toBe(200);
    expect(output.at(-1).type).toBe("completed");
  });

  it("emits cancellation without a completed payload", async () => {
    const analysisResult = await mockAnalysisResult();
    const controller = new AbortController();
    const response = await prepare(new Request("http://localhost/api/interview/prepare/stream", { method: "POST", headers: { "Content-Type": "application/json", "X-Workflow-Provider": "mock" }, body: JSON.stringify({ input: EXAMPLE_USER_INPUT, jobTargetContext: context, analysisResult, materialRevision: 1 }), signal: controller.signal }));
    controller.abort();
    const output = await events(response);
    expect(output.at(-1).type).toBe("cancelled");
    expect(output.some((event) => event.type === "completed")).toBe(false);
  });
});
