import { describe, expect, it } from "vitest";
import { buildFinalizeResumePrompt, buildOptimizeUserPrompt, getOptimizedTextLimit, normalizeOptimizedItems } from "@/lib/ai/prompts";
import { EXAMPLE_USER_INPUT } from "@/store/resume-store-example";
import type { FollowUpQuestion, KeywordEnhancementDraft, OptimizedItem } from "@/types/resume";

function draft(adoptionStatus: KeywordEnhancementDraft["adoptionStatus"]): KeywordEnhancementDraft {
  return {
    id: "draft-1", itemId: "opt-1", selectedKeywords: ["产品规划"], enhancedText: "负责企业服务产品规划", sourceAfter: "负责需求分析",
    evidenceStatus: "missing", evidenceClaimIds: [], evidenceCorrectionSourceIds: [], foundEvidence: [], missingEvidence: ["缺少事实"], riskWarnings: ["待核验"],
    adoptionStatus, generatedAt: "2026-08-26T00:00:00.000Z", verifiedAt: adoptionStatus === "user-confirmed" ? "2026-08-26T01:00:00.000Z" : null,
  };
}

function item(adoptionStatus: KeywordEnhancementDraft["adoptionStatus"]): OptimizedItem {
  return { id: "opt-1", section: "职业摘要", before: "原摘要", after: "负责企业服务产品规划", reason: "对齐 JD", riskWarning: "核对事实", keywordEnhancement: draft(adoptionStatus) };
}

describe("optimization prompt safety", () => {
  it("keeps generated comparison copy within readable section limits", () => {
    const longText = "负责企业级产品规划与跨部门协作，".repeat(30);
    const [normalized] = normalizeOptimizedItems([{ id: "long", section: "工作经历", before: "", after: longText, reason: "", riskWarning: "" }]);
    expect(normalized.after.length).toBeLessThanOrEqual(getOptimizedTextLimit("after", "工作经历"));
    expect(normalized.after.endsWith("…")).toBe(true);
  });

  it("keeps custom style subordinate to factual and evidence constraints", () => {
    const prompt = buildOptimizeUserPrompt(EXAMPLE_USER_INPUT, "custom", "突出平台化能力");
    expect(prompt).toContain("突出平台化能力");
    expect(prompt).toContain("不得覆盖事实真实性、信息保留和证据边界");
  });

  it("excludes unverified enhancement text from final generation", () => {
    const prompt = buildFinalizeResumePrompt(EXAMPLE_USER_INPUT, "concise", [item("unverified")], []);
    expect(prompt).toContain('"after": "负责需求分析"');
    expect(prompt).not.toContain('"after": "负责企业服务产品规划"');
    expect(prompt).not.toContain("adoptedKeywordEnhancement");
  });

  it("includes user-confirmed enhancement text and its audit status", () => {
    const prompt = buildFinalizeResumePrompt(EXAMPLE_USER_INPUT, "concise", [item("user-confirmed")], []);
    expect(prompt).toContain('"after": "负责企业服务产品规划"');
    expect(prompt).toContain('"verification": "user-confirmed"');
  });

  it("excludes skipped, unverified and no-experience supplements from final generation", () => {
    const question = (decision: FollowUpQuestion["decision"]): FollowUpQuestion => ({
      id: `follow-up-${decision}`,
      question: "请补充相关经历",
      purpose: "验证岗位要求",
      userAnswer: "这是一段尚未确认的输入",
      generatedBullet: "这是一条尚未确认的 bullet",
      decision,
    });
    const prompt = buildFinalizeResumePrompt(
      EXAMPLE_USER_INPUT,
      "concise",
      [],
      [question("unreviewed"), question("skipped"), question("no-experience")]
    );
    expect(prompt).not.toContain("这是一段尚未确认的输入");
    expect(prompt).not.toContain("这是一条尚未确认的 bullet");
    expect(prompt).toContain("【用户补充的经历证据】\n无");
  });
});
