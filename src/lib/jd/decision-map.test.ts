import { describe, expect, it } from "vitest";
import {
  buildJDAnalysisDocument,
  confirmJDAnalysisDocument,
  confirmRequirement,
  confirmSafeRequirements,
  parseJDSourceSpans,
  updateRequirementAtom,
} from "@/lib/jd/decision-map";

describe("JD decision map", () => {
  it("keeps requirement IDs stable when model drafts arrive in a different order", () => {
    const spans = parseJDSourceSpans("任职要求\n- 熟悉 TypeScript 和 React");
    const requirementSpan = spans.find((span) => span.text.includes("TypeScript"));
    expect(requirementSpan).toBeDefined();

    const drafts = [
      {
        sourceSpanId: requirementSpan!.id,
        sourceQuote: "TypeScript",
        normalizedText: "能够使用 TypeScript 开发",
        kind: "skill" as const,
        modality: "required" as const,
        priority: "high" as const,
        priorityBasis: ["任职要求章节"],
      },
      {
        sourceSpanId: requirementSpan!.id,
        sourceQuote: "React",
        normalizedText: "能够使用 React 开发",
        kind: "skill" as const,
        modality: "required" as const,
        priority: "high" as const,
        priorityBasis: ["任职要求章节"],
      },
    ];

    const first = buildJDAnalysisDocument({ sourceText: "任职要求\n- 熟悉 TypeScript 和 React", materialRevision: 2, spans, drafts });
    const second = buildJDAnalysisDocument({ sourceText: "任职要求\n- 熟悉 TypeScript 和 React", materialRevision: 2, spans, drafts: [...drafts].reverse() });

    expect(first.requirements.map((item) => [item.normalizedText, item.id])).toEqual(
      second.requirements.map((item) => [item.normalizedText, item.id]),
    );
  });

  it("uses deterministic wording cues instead of trusting model modality", () => {
    const sourceText = "任职要求\n- 必须具备 3 年以上 B 端产品经验\n- 有 SQL 经验优先\n- 不要求有管理经验";
    const spans = parseJDSourceSpans(sourceText).filter((span) => span.role === "requirement");
    const document = buildJDAnalysisDocument({
      sourceText,
      materialRevision: 1,
      spans: parseJDSourceSpans(sourceText),
      drafts: spans.map((span) => ({
        sourceSpanId: span.id,
        sourceQuote: span.text,
        normalizedText: span.text.replace(/^[-•]\s*/, ""),
        kind: "experience" as const,
        modality: "optional" as const,
        priority: "low" as const,
        priorityBasis: [],
      })),
    });

    expect(document.requirements.map((item) => item.modality)).toEqual(["required", "preferred", "negated"]);
    expect(document.requirements[0].priority).toBe("high");
    expect(document.requirements[2].isHardGate).toBe(false);
  });

  it("requires every requirement source span to be resolved before confirmation", () => {
    const sourceText = "岗位职责\n- 负责用户研究\n- 推动需求落地";
    const spans = parseJDSourceSpans(sourceText);
    const requirementSpans = spans.filter((span) => span.role === "requirement");
    let document = buildJDAnalysisDocument({
      sourceText,
      materialRevision: 3,
      spans,
      drafts: [{
        sourceSpanId: requirementSpans[0].id,
        sourceQuote: requirementSpans[0].text,
        normalizedText: "负责用户研究",
        kind: "task",
        modality: "required",
        priority: "high",
        priorityBasis: ["岗位职责"],
      }],
    });

    document = confirmSafeRequirements(document, "2026-08-15T00:00:00.000Z");
    document = confirmRequirement(document, document.requirements[0].id);
    expect(() => confirmJDAnalysisDocument(document)).toThrow(/仍有原文条目未覆盖/);

    document = updateRequirementAtom(document, document.requirements[0].id, { normalizedText: "独立负责用户研究" });
    expect(document.requirements[0].reviewStatus).toBe("needs-review");
    expect(document.status).toBe("draft");
  });
});
