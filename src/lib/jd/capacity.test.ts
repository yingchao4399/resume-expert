import { describe, expect, it } from "vitest";
import { buildJDAnalysisDocument, confirmJDAnalysisDocument, confirmSafeRequirements, parseJDSourceSpans } from "./decision-map";
import { jdAnalysisDocumentSchema } from "./schemas";
import { matchAnalysisRequestSchema } from "@/lib/ai/schemas";
import { createEmptyDocument } from "@/store/resume-store-document";
import { createResumeBackup, parseResumeBackup } from "@/lib/backup/resume-backup";
import { validatePersistedLibrary } from "@/store/resume-store-persistence";

export function syntheticMap(count: number) {
  const sourceText = Array.from({ length: count }, (_, i) => `必须完成测试任务${i + 1}`).join("\n");
  const spans = parseJDSourceSpans(sourceText);
  return confirmJDAnalysisDocument(confirmSafeRequirements(buildJDAnalysisDocument({
    sourceText, materialRevision: 1, spans,
    drafts: spans.map(span => ({ sourceSpanId: span.id, sourceQuote: span.text, normalizedText: span.text, kind: "task", modality: "required", priority: "high", priorityBasis: ["原文明示"] })),
  })));
}

describe("JD whole-document capacity regression", () => {
  for (const count of [40, 41, 56, 120]) it(`preserves ${count} confirmed requirements through request, backup and hydration`, () => {
    const map = syntheticMap(count);
    const document = createEmptyDocument("synthetic-capacity");
    document.jdAnalysisDocument = map;
    document.userInput = { ...document.userInput, targetRole: "测试岗位", jobDescription: map.sourceText, originalResume: "合成测试材料" };
    expect(matchAnalysisRequestSchema.parse({ input: document.userInput, jdAnalysisDocument: map }).jdAnalysisDocument.requirements).toHaveLength(count);
    expect(parseResumeBackup(createResumeBackup([document])).documents[0].jdAnalysisDocument?.requirements).toHaveLength(count);
    expect(() => validatePersistedLibrary(JSON.stringify({ version: 12, state: { documents: [{ ...document, schemaVersion: 11, jdAnalysisDocument: { ...map, schemaVersion: 1 } }] } }))).not.toThrow();
  });
  it("rejects 121 independent requirements with actionable Chinese guidance", () => {
    const map = syntheticMap(120);
    map.requirements.push({ ...map.requirements[0], id: "extra" });
    const result = jdAnalysisDocumentSchema.safeParse(map);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain("120");
  });
});
