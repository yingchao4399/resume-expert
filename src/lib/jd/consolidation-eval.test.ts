import { describe, expect, it } from "vitest";
import cases from "../../../evals/consolidation-cases.json";
import { buildJDAnalysisDocument, parseJDSourceSpans } from "./decision-map";
import { applyConsolidation, mockConsolidation, sourceReferences } from "./consolidation";
import type { JDRequirementKind } from "@/types/jd-analysis";

describe("consolidation synthetic Mock baseline (not semantic model quality)", () => {
  for (const sample of cases) it(sample.id, () => {
    const sourceText = sample.texts.join("\n");
    const spans = parseJDSourceSpans(sourceText);
    const document = buildJDAnalysisDocument({ sourceText, materialRevision: 1, spans, drafts: spans.map(span => ({ sourceSpanId: span.id, sourceQuote: span.text, normalizedText: span.text, kind: sample.kind as JDRequirementKind, modality: "required", priority: "high", priorityBasis: ["合成原文"] })) });
    const proposal = mockConsolidation(document);
    const result = applyConsolidation(document, proposal);
    expect(proposal.merges.length > 0).toBe(sample.mockMerge);
    expect(new Set(result.requirements.flatMap(atom => sourceReferences(result, atom).map(ref => ref.sourceSpanId)))).toEqual(new Set(spans.map(span => span.id)));
    expect(result.groups?.flatMap(group => group.requirementIds).sort()).toEqual(result.requirements.map(item => item.id).sort());
  });
});
