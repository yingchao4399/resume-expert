import type { ResumeArchive, ResumeDocument, ResumeLibraryState } from "@/types/resume";
import { isDocumentAnalysisFresh } from "@/lib/analysis-revision";
import { formatResumeAsText } from "@/lib/utils";
import { mapResumeBullets } from "@/lib/evidence/resume-evidence";
import { createEmptyDocument, createId } from "@/store/resume-store-document";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

// Change detector only; never an authentication/trust decision. Compare actual
// content as well before deduplicating, so hash collisions cannot discard data.
function fingerprint(value: unknown): string {
  const text = canonical(value);
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i); }
  return `${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}-${text.length}`;
}

export function archiveContentFingerprint(document: Pick<ResumeArchive, "finalResume" | "layoutConfig" | "targetRole" | "companyName">): string {
  return fingerprint([formatResumeAsText(document.finalResume), document.layoutConfig, document.targetRole, document.companyName]);
}

export function sameArchiveContent(a: ResumeArchive, b: ResumeArchive): boolean {
  return a.sourceDocumentId === b.sourceDocumentId && a.contentFingerprint === b.contentFingerprint &&
    canonical([formatResumeAsText(a.finalResume), a.layoutConfig, a.targetRole, a.companyName]) === canonical([formatResumeAsText(b.finalResume), b.layoutConfig, b.targetRole, b.companyName]);
}

export function documentArchiveFingerprint(document: ResumeDocument): string {
  return fingerprint([document.materialRevision, document.jdAnalysisDocument?.revision ?? null,
    document.finalResumeStatus, document.analysisBasis, document.analysisRevision,
    document.analysisResult?.finalResume ?? null, document.layoutConfig]);
}

export function archiveBlockedReason(document: ResumeDocument | undefined, dirty = false, busy = false): string | null {
  if (!document) return "该岗位版本不存在。";
  if (dirty) return "请先保存或取消未保存的修改，再存档成品。";
  if (busy) return "请等待当前任务结束后再存档。";
  if (!document.analysisResult || document.finalResumeStatus !== "confirmed" || !isDocumentAnalysisFresh(document)) return "仅能存档已确认且分析有效的最终简历。";
  return null;
}

export function createArchive(document: ResumeDocument, title: string, notes: string, archivedAt = new Date().toISOString()): ResumeArchive {
  const blocked = archiveBlockedReason(document);
  if (blocked) throw new Error(blocked);
  if (!title.trim() || title.trim().length > 120 || notes.length > 1000) throw new Error("存档名称须为 1–120 字，备注最多 1000 字。");
  const content = { finalResume: structuredClone(document.analysisResult!.finalResume), layoutConfig: structuredClone(document.layoutConfig), targetRole: document.userInput.targetRole, companyName: document.jobTargetContext.companyName };
  return { id: createId(), title: title.trim(), notes: notes.trim(), archivedAt,
    sourceDocumentId: document.id, sourceFingerprint: documentArchiveFingerprint(document),
    contentFingerprint: archiveContentFingerprint(content), ...content };
}

export function archiveSourceWarning(archive: ResumeArchive, documents: ResumeDocument[]): string {
  const source = documents.find(item => item.id === archive.sourceDocumentId);
  if (!source) return "来源版本已删除或不在当前文档库中，存档仍保留。";
  return documentArchiveFingerprint(source) === archive.sourceFingerprint
    ? "历史存档：仅代表存档时的内容，不自动跟随岗位版本更新。"
    : "历史版本，来源已变化，请核验。仍可按存档时内容下载。";
}

export function draftFromArchive(archive: ResumeArchive): ResumeDocument {
  const draft = createEmptyDocument();
  // Historical associations must never silently become current trusted links.
  const sourceResume = mapResumeBullets(structuredClone(archive.finalResume), bullet => ({ ...bullet, sourceType: "imported", evidenceIds: [], evidenceLinks: [] }));
  return { ...draft, title: `${archive.title} · 新草稿`, userInput: { ...draft.userInput, targetRole: archive.targetRole, originalResume: formatResumeAsText(sourceResume) },
    jobTargetContext: { ...draft.jobTargetContext, companyName: archive.companyName },
    sourceResume, layoutConfig: structuredClone(archive.layoutConfig) };
}

export function resolveResumeRecord(library: Pick<ResumeLibraryState, "documents" | "archives" | "activeDocumentId">, query: { documentId: string | null; archiveId: string | null }) {
  if (query.documentId !== null && query.archiveId !== null) return { error: "只能指定一种记录：岗位版本或历史存档。" } as const;
  if (query.archiveId !== null) {
    const archive = library.archives.find(item => item.id === query.archiveId);
    return archive ? { archive, document: null, error: null } : { error: "指定的历史存档不存在或已删除。" } as const;
  }
  const document = library.documents.find(item => item.id === (query.documentId ?? library.activeDocumentId));
  return document ? { document, archive: null, error: null } : { error: "指定的岗位版本不存在或已删除。" } as const;
}
