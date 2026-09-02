import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syntheticLibraryDocument } from "@/test-fixtures/library";
import { archiveBlockedReason, archiveSourceWarning, createArchive, documentArchiveFingerprint, draftFromArchive, resolveResumeRecord, sameArchiveContent } from "./resume-archives";
import { createResumeBackup, parseResumeBackup } from "@/lib/backup/resume-backup";
import { useResumeStore } from "@/store/resume-store";
import { createEmptyDocument, workingStateFromDocument } from "@/store/resume-store-document";
import { clearPendingRecovery, RESUME_RECOVERY_KEY, RESUME_STORAGE_KEY, RESUME_STORAGE_ERROR_EVENT, safeLocalStorage } from "@/store/resume-store-persistence";
import { formatResumeAsText } from "@/lib/utils";
import { buildResumeFileName } from "@/lib/export/resume-docx";

const original = useResumeStore.getState();
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("window", { dispatchEvent: () => true, confirm: () => true, localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => values.delete(key),
  } });
  const document = syntheticLibraryDocument();
  useResumeStore.setState({ ...original, documents: [document], archives: [], activeDocumentId: document.id, ...workingStateFromDocument(document) }, true);
});
afterEach(() => { clearPendingRecovery(); vi.unstubAllGlobals(); useResumeStore.setState(original, true); });

describe("immutable resume library archives", () => {
  it("freezes content and layout, deduplicates and does not switch documents", () => {
    const state = useResumeStore.getState();
    const a = state.archiveDocument(state.activeDocumentId, "第一版", "存档说明");
    const b = state.archiveDocument(state.activeDocumentId, "再次点击", "");
    expect(b).toEqual({ id: a.id, duplicate: true });
    const archive = useResumeStore.getState().archives[0];
    const frozen = structuredClone(archive);
    const updated = { ...state.analysisResult!.finalResume, summary: "修改后的摘要" };
    state.setFinalResume(updated, { manual: true });
    expect(useResumeStore.getState().archives[0]).toEqual(frozen);
    expect(archiveSourceWarning(archive, useResumeStore.getState().documents)).toContain("来源已变化");
    useResumeStore.setState({ dirtyScope: "resume" });
    state.deleteDocument(state.activeDocumentId);
    expect(useResumeStore.getState().archives).toHaveLength(1);
    expect(useResumeStore.getState().dirtyScope).toBeNull();
    expect(archiveSourceWarning(archive, useResumeStore.getState().documents)).toContain("已删除");
  });
  it("blocks draft, stale, changed JD revision, dirty and running states", () => {
    const document = syntheticLibraryDocument();
    expect(archiveBlockedReason(document)).toBeNull();
    expect(archiveBlockedReason({ ...document, finalResumeStatus: "draft" })).toBeTruthy();
    expect(archiveBlockedReason({ ...document, finalResumeStatus: "stale" })).toBeTruthy();
    expect(archiveBlockedReason({ ...document, jdAnalysisDocument: { ...document.jdAnalysisDocument!, revision: 999 } })).toBeTruthy();
    expect(archiveBlockedReason(document, true)).toContain("未保存");
    expect(archiveBlockedReason(document, false, true)).toContain("任务");
  });
  it("copies history only into an untrusted material draft", () => {
    const archive = createArchive(syntheticLibraryDocument(), "history", "");
    const draft = draftFromArchive(archive);
    expect(draft.analysisResult).toBeNull();
    expect(draft.jdAnalysisDocument).toBeNull();
    expect(draft.finalResumeStatus).toBe("draft");
    expect(draft.layoutConfig).toEqual(archive.layoutConfig);
    expect(draft.userInput.originalResume).toBe(formatResumeAsText(archive.finalResume));
    expect(draft.sourceResume?.workExperience[0].bullets[0]).toMatchObject({ evidenceLinks: [], evidenceIds: [] });
  });
  it("renames or copies a specified inactive document without changing the active working state", () => {
    const active = useResumeStore.getState().activeDocumentId;
    const other = createEmptyDocument("other");
    useResumeStore.setState(state => ({ documents: [...state.documents, other], dirtyScope: "resume" }));
    useResumeStore.getState().renameDocument("其他版本", other.id);
    useResumeStore.getState().duplicateDocument(other.id);
    useResumeStore.getState().deleteDocument(other.id);
    expect(useResumeStore.getState().activeDocumentId).toBe(active);
    expect(useResumeStore.getState().dirtyScope).toBe("resume");
    expect(useResumeStore.getState().documents[1].title).toBe("其他版本 · 副本");
  });
  it("honors a task navigation veto for every operation that changes the editing document", () => {
    useResumeStore.setState(state => ({ documents: [...state.documents, createEmptyDocument("other")] }));
    const before = useResumeStore.getState();
    window.dispatchEvent = event => event.type !== "resume-expert-before-navigate";
    before.createDocument();
    before.duplicateDocument();
    before.deleteDocument();
    before.selectDocument("other");
    expect(before.prepareNavigation()).toBe(false);
    expect(useResumeStore.getState().documents).toEqual(before.documents);
    expect(useResumeStore.getState().activeDocumentId).toBe(before.activeDocumentId);
  });
  it("fails before publishing an archive if storage is full", () => {
    const state = useResumeStore.getState();
    const before = values.get(RESUME_STORAGE_KEY);
    window.localStorage.setItem = () => { throw new Error("quota"); };
    expect(() => state.archiveDocument(state.activeDocumentId, "不会保存", "")).toThrow("未生效");
    expect(useResumeStore.getState().archives).toEqual([]);
    expect(values.get(RESUME_STORAGE_KEY)).toBe(before);
  });
  it("does not recursively report storage errors when the UI records the error in Zustand", () => {
    let errors = 0;
    window.localStorage.setItem = () => { throw new Error("quota"); };
    window.dispatchEvent = event => {
      if (event.type === RESUME_STORAGE_ERROR_EVENT) {
        errors++;
        // Bound the reproduction so a regression cannot overflow the test process.
        if (errors < 3) useResumeStore.getState().setStorageError("空间不足");
      }
      return true;
    };
    safeLocalStorage.setItem(RESUME_STORAGE_KEY, "{}");
    expect(errors).toBe(1);
  });
  it("retains valid archives while isolating one broken record and keeping recovery evidence", () => {
    const document = syntheticLibraryDocument();
    const archive = createArchive(document, "历史", "");
    values.set(RESUME_STORAGE_KEY, JSON.stringify({ version: 14, state: { documents: [document], archives: [archive, { id: "broken" }], activeDocumentId: document.id } }));
    const readable = JSON.parse(safeLocalStorage.getItem(RESUME_STORAGE_KEY) as string);
    expect(readable.state.documents).toHaveLength(1);
    expect(readable.state.archives).toHaveLength(1);
    const report = useResumeStore.getState().attemptStorageRecovery();
    expect(report).toMatchObject({ documents: 1, archives: 1, skipped: 1 });
    expect(values.has(RESUME_RECOVERY_KEY)).toBe(true);
    expect(useResumeStore.getState().archives[0].finalResume).toMatchObject(archive.finalResume);
  });
  it("never overwrites the original if the recovery slot itself exceeds storage quota", () => {
    const document = syntheticLibraryDocument();
    const raw = JSON.stringify({ version: 14, state: { documents: [document], archives: [{ id: "broken" }], activeDocumentId: document.id } });
    values.set(RESUME_STORAGE_KEY, raw);
    window.localStorage.setItem = (key, value) => {
      if (key === RESUME_RECOVERY_KEY) throw new Error("quota while preserving recovery");
      values.set(key, value);
    };
    safeLocalStorage.getItem(RESUME_STORAGE_KEY);
    safeLocalStorage.setItem(RESUME_STORAGE_KEY, "unsafe replacement");
    expect(values.get(RESUME_STORAGE_KEY)).toBe(raw);
    expect(useResumeStore.getState().attemptStorageRecovery()).toBeNull();
    expect(values.get(RESUME_STORAGE_KEY)).toBe(raw);
  });
  it("supports V11 roundtrip, empty legacy archives, merge remapping and replacement", () => {
    const state = useResumeStore.getState();
    const document = state.documents[0];
    const archive = createArchive(document, "历史", "");
    const backup = parseResumeBackup(createResumeBackup([document], [], [], [], [archive]));
    expect(backup.backupVersion).toBe(11);
    expect(backup.archives[0].finalResume).toMatchObject(archive.finalResume);
    expect(parseResumeBackup({ ...backup, backupVersion: 9, archives: undefined }).archives).toEqual([]);
    state.importDocuments(backup.documents, "merge", [], [], [], true, backup.archives);
    const after = useResumeStore.getState();
    expect(after.archives[0].id).not.toBe(archive.id);
    expect(after.archives[0].sourceDocumentId).toBe(after.documents[1].id);
    expect(formatResumeAsText(after.archives[0].finalResume)).toBe(formatResumeAsText(archive.finalResume));
    after.importDocuments(backup.documents, "replace", [], [], [], true, backup.archives);
    expect(useResumeStore.getState().archives[0].id).toBe(archive.id);
    expect(useResumeStore.getState().documents).toHaveLength(1);
  });
  it("never falls back from a missing or ambiguous explicit print ID", () => {
    const state = useResumeStore.getState();
    expect(resolveResumeRecord(state, { documentId: "missing", archiveId: null }).error).toContain("不存在");
    expect(resolveResumeRecord(state, { documentId: null, archiveId: "missing" }).error).toContain("不存在");
    expect(resolveResumeRecord(state, { documentId: "one", archiveId: "two" }).error).toContain("只能");
    expect(resolveResumeRecord(state, { documentId: null, archiveId: null }).document?.id).toBe(state.activeDocumentId);
  });
  it("preserves date and only changes metadata without altering archive content", () => {
    const state = useResumeStore.getState();
    const { id } = state.archiveDocument(state.activeDocumentId, "版本1", "");
    const before = useResumeStore.getState().archives[0];
    state.updateArchive(id, "投递留底", "备注");
    const after = useResumeStore.getState().archives[0];
    expect(sameArchiveContent(before, after)).toBe(true);
    expect(after.archivedAt).toBe(before.archivedAt);
    expect(buildResumeFileName(after.finalResume, "产品经理", "docx", "2026-01-02T00:00:00.000Z")).toContain("20260102.docx");
    expect(documentArchiveFingerprint({ ...state.documents[0], updatedAt: "changed", title: "rename" })).toBe(before.sourceFingerprint);
  });
});
