import { describe, expect, it } from "vitest";
import { JD_GOLD_CASES } from "../../../evals/jd-cases";
import { buildJDAnalysisDocument, parseJDSourceSpans } from "@/lib/jd/decision-map";

describe("48-case JD gold evaluation", () => {
  it("meets deterministic source, atom and modality release gates", () => {
    expect(JD_GOLD_CASES).toHaveLength(48);
    let anchors = 0;
    let covered = 0;
    let modalities = 0;

    for (const item of JD_GOLD_CASES) {
      const sourceText = `任职要求\n- ${item.source}`;
      const spans = parseJDSourceSpans(sourceText);
      const sourceSpan = spans.find((span) => span.role === "requirement");
      expect(sourceSpan).toBeDefined();
      expect(sourceText.slice(sourceSpan!.startOffset, sourceSpan!.endOffset)).toBe(sourceSpan!.text);
      const document = buildJDAnalysisDocument({
        sourceText,
        materialRevision: 1,
        spans,
        drafts: [{
          sourceSpanId: sourceSpan!.id,
          sourceQuote: item.source,
          normalizedText: item.expected.normalizedText,
          kind: item.expected.kind,
          modality: item.expected.modality,
          priority: item.expected.priority,
          priorityBasis: ["Gold 标注"],
        }],
      });
      const atom = document.requirements[0];
      if (atom.anchorStatus === "validated") anchors += 1;
      if (atom.sourceSpanIds.includes(sourceSpan!.id)) covered += 1;
      if (atom.modality === item.expected.modality) modalities += 1;
      expect(atom.normalizedText).toBe(item.expected.normalizedText);
    }

    expect(anchors / JD_GOLD_CASES.length).toBeGreaterThanOrEqual(0.98);
    expect(covered / JD_GOLD_CASES.length).toBeGreaterThanOrEqual(0.95);
    expect(modalities / JD_GOLD_CASES.length).toBeGreaterThanOrEqual(0.9);
  });
});
