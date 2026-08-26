import { describe, expect, it } from "vitest";
import { findCoveredKeywords, getConfirmedJDKeywords, getMissingKeywordCandidates, normalizeKeyword, splitTextByKeywords, stableKeywordSource } from "@/lib/optimize/keyword-enhancement";
import type { JDAnalysisDocument } from "@/types/jd-analysis";
import type { OptimizedItem } from "@/types/resume";

const document: JDAnalysisDocument = {
  schemaVersion: 1, sourceText: "熟悉 TypeScript，具备 AI 产品经验", materialRevision: 1, revision: 1,
  status: "confirmed", confirmedRevision: 1, sourceSpans: [], hypotheses: [], qualityFindings: [],
  requirements: [
    { id: "req-1", sourceSpanId: "s1", sourceSpanIds: ["s1"], sourceQuote: "熟悉 TypeScript", normalizedText: "熟悉 TypeScript", kind: "skill", modality: "required", priority: "high", priorityBasis: [], keywords: ["TypeScript", "AI 产品"], anchorStatus: "validated", reviewStatus: "confirmed", isHardGate: false, userEdited: false },
    { id: "req-2", sourceSpanId: "s2", sourceSpanIds: ["s2"], sourceQuote: "React", normalizedText: "React", kind: "tool", modality: "optional", priority: "low", priorityBasis: [], keywords: ["React"], anchorStatus: "needs-review", reviewStatus: "needs-review", isHardGate: false, userEdited: false },
  ], createdAt: "2026-01-01", updatedAt: "2026-01-01",
};

describe("keyword enhancement public behavior", () => {
  it("只暴露已确认且有合法原文锚点的 JD 关键词", () => {
    expect(getConfirmedJDKeywords(document)).toEqual(["TypeScript", "AI 产品"]);
  });

  it("忽略大小写、空格和常见中英文标点后判断覆盖", () => {
    expect(normalizeKeyword("Type Script，AI-产品")).toBe("typescriptai产品");
    expect(findCoveredKeywords("负责 typescript / AI 产品方案", ["TypeScript", "AI 产品", "React"])).toEqual(["TypeScript", "AI 产品"]);
  });

  it("为每个优化项只返回尚未覆盖的候选关键词", () => {
    const item: OptimizedItem = { id: "opt-1", section: "技能", before: "JS", after: "使用 TypeScript", reason: "对齐", riskWarning: "" };
    expect(getMissingKeywordCandidates(item, ["TypeScript", "AI 产品"])).toEqual(["AI 产品"]);
  });

  it("安全拆分高亮文本且生成稳定去重来源", () => {
    expect(splitTextByKeywords("掌握 TypeScript 与 AI 产品", ["AI 产品", "TypeScript"]).filter((item) => item.keyword).map((item) => item.keyword)).toEqual(["TypeScript", "AI 产品"]);
    expect(stableKeywordSource("doc", "opt", "AI 产品")).toBe(stableKeywordSource("doc", "opt", "AI-产品"));
  });
});
