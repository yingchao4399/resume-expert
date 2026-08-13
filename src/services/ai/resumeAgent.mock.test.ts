import { describe, expect, it } from "vitest";
import { runMockFinalizeResume, runMockFollowUpBullet, runMockResumeAnalysis } from "@/services/ai/resumeAgent.mock";
import { defaultUserInput } from "@/store/resume-store-example";
import { formatResumeAsText } from "@/lib/utils";

const input = {
  ...defaultUserInput,
  targetRole: "测试工程师",
  jobDescription: "负责质量保障与自动化测试",
  originalResume: "李雷 | 测试工程师\n邮箱：lilei@example.com\n负责接口测试与缺陷跟踪。",
};

describe("safe resume mock", () => {
  it("does not return the fixed example person or fabricated employers and metrics", async () => {
    const result = await runMockResumeAnalysis(input);
    const text = formatResumeAsText(result.finalResume);
    expect(text).toContain("李雷");
    expect(text).not.toContain("张明");
    expect(text).not.toContain("某 SaaS 公司");
    expect(text).not.toMatch(/50\+|提升 40%|准确率达 85%/);
  });

  it("finalizes only from conservative input and user-provided supplements", async () => {
    const resume = await runMockFinalizeResume(input, [], [{ id: "fu-1", question: "", purpose: "", userAnswer: "", generatedBullet: "人工确认的补充事实" }]);
    const text = formatResumeAsText(resume);
    expect(text).not.toContain("张明");
    expect(text).not.toContain("某 SaaS 公司");
  });

  it("returns the user's answer verbatim for a mock follow-up bullet", async () => {
    await expect(runMockFollowUpBullet("量化成果", "我独立完成回归测试")).resolves.toBe("我独立完成回归测试");
  });
});
