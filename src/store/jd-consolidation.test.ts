import { afterEach, describe, expect, it } from "vitest";
import { useResumeStore } from "./resume-store";
import { createEmptyDocument, workingStateFromDocument } from "./resume-store-document";
import { buildJDAnalysisDocument, confirmJDAnalysisDocument, confirmSafeRequirements, parseJDSourceSpans } from "@/lib/jd/decision-map";
import { applyConsolidation, migrateJDMap, mockConsolidation, restorePreviousMap } from "@/lib/jd/consolidation";
import { createResumeBackup, parseResumeBackup } from "@/lib/backup/resume-backup";
import { runMockResumeAnalysis } from "@/services/ai/resumeAgent.mock";
import { EXAMPLE_USER_INPUT } from "./resume-store-example";

function map(count = 4) {
  const sourceText = Array.from({ length: count }, (_, index) => `必须完成任务${Math.floor(index / 2)}`).join("\n");
  const spans = parseJDSourceSpans(sourceText);
  return buildJDAnalysisDocument({ sourceText, materialRevision: 1, spans, drafts: spans.map(span => ({ sourceSpanId: span.id, sourceQuote: span.text, normalizedText: span.text, kind: "task", modality: "required", priority: "high", priorityBasis: ["合成原文"] })) });
}
const original = useResumeStore.getState();
afterEach(() => useResumeStore.setState(original, true));
describe("JD consolidation storage boundaries", () => {
  it("retains every source when reducing 240 candidates to 120 without a forced target group count", () => {
    const before = map(240);
    const result = applyConsolidation(before, mockConsolidation(before), undefined, false);
    expect(result.requirements).toHaveLength(120);
    expect(result.requirements.flatMap(item => item.sourceReferences!)).toHaveLength(240);
    expect(() => map(241)).toThrow("240");
  });
  it("round-trips a V9 backup including the original map and merge lineage", () => {
    const document = createEmptyDocument("merge-backup");
    const before = confirmJDAnalysisDocument(confirmSafeRequirements(map()));
    document.jdAnalysisDocument = applyConsolidation(before, mockConsolidation(before));
    const backup = parseResumeBackup(createResumeBackup([document]));
    const restored = backup.documents[0].jdAnalysisDocument!;
    expect(backup.backupVersion).toBe(10);
    expect(restored.requirements).toHaveLength(2);
    expect(restored.requirements[0].originalRequirementIds).toHaveLength(2);
    expect(restorePreviousMap(restored).requirements).toHaveLength(4);
  });
  it("makes downstream results stale and refuses a late proposal from another version", async () => {
    const document = createEmptyDocument("merge-store");
    document.jdAnalysisDocument = confirmJDAnalysisDocument(confirmSafeRequirements(map()));
    document.materialRevision = 1;
    document.analysisRevision = 1;
    document.analysisResult = await runMockResumeAnalysis(EXAMPLE_USER_INPUT);
    document.finalResumeStatus = "confirmed";
    useResumeStore.setState({ documents: [document], activeDocumentId: document.id, ...workingStateFromDocument(document) });
    const proposal = mockConsolidation(document.jdAnalysisDocument);
    expect(useResumeStore.getState().applyJDConsolidation(proposal, proposal.merges.map(item => item.id), "other-version")).toBe(false);
    expect(useResumeStore.getState().jdAnalysisDocument?.requirements).toHaveLength(4);
    expect(useResumeStore.getState().applyJDConsolidation(proposal, proposal.merges.map(item => item.id), document.id)).toBe(true);
    expect(useResumeStore.getState().finalResumeStatus).toBe("stale");
    expect(useResumeStore.getState().analysisRevision).toBeNull();
    expect(useResumeStore.getState().restoreJDMap()).toBe(true);
    expect(useResumeStore.getState().jdAnalysisDocument?.requirements).toHaveLength(4);
    expect(useResumeStore.getState().applyJDConsolidation(proposal, [], document.id)).toBe(false);
  });
  it("does not group-confirm invalid source references", () => {
    const document = createEmptyDocument("group-guard");
    const draft = migrateJDMap(map());
    draft.requirements[0].sourceReferences![0].quote = "伪造引用";
    document.jdAnalysisDocument = draft;
    document.materialRevision = 1;
    useResumeStore.setState({ documents: [document], activeDocumentId: document.id, ...workingStateFromDocument(document) });
    useResumeStore.getState().confirmJDGroup(draft.groups![0].id);
    expect(useResumeStore.getState().jdAnalysisDocument?.requirements[0].reviewStatus).not.toBe("confirmed");
  });
  it("refuses restoring or confirming a map after materials change", () => {
    const document = createEmptyDocument("stale-map");
    const before = confirmJDAnalysisDocument(confirmSafeRequirements(map()));
    document.jdAnalysisDocument = { ...applyConsolidation(before, mockConsolidation(before)), status: "stale" };
    document.materialRevision = 2;
    useResumeStore.setState({ documents: [document], activeDocumentId: document.id, ...workingStateFromDocument(document) });
    expect(useResumeStore.getState().restoreJDMap()).toBe(false);
    expect(useResumeStore.getState().confirmJDAnalysis()).toBe(false);
    expect(useResumeStore.getState().jdAnalysisDocument?.status).toBe("stale");
  });
});
