import type { StateStorage } from "zustand/middleware";
import { migrateJDMap } from "@/lib/jd/consolidation";
import type { FinalResumeStatus, ImportedResumeProfile, ResumeDocument, ResumeLibraryState } from "@/types/resume";
import { parseResumeBackup, resumeArchiveSchema } from "@/lib/backup/resume-backup";
import { normalizeFinalResumeBullets } from "@/lib/evidence/resume-evidence";
import { sanitizeLayoutConfig } from "@/lib/templates/resume-templates";
import { createEmptyDocument, createId, nowISO } from "@/store/resume-store-document";

export const RESUME_STORAGE_KEY = "resume-expert-library";
export const RESUME_STORAGE_ERROR_EVENT = "resume-expert-storage-error";
export const RESUME_STORAGE_STATUS_EVENT = "resume-expert-storage-status";
export const RESUME_RECOVERY_KEY = `${RESUME_STORAGE_KEY}-recovery`;

export interface RecoveryRecord {
  capturedAt: string;
  reason: string;
  raw: string;
}

let pendingRecovery: RecoveryRecord | null = null;
let storageWriteUnlocked = false;
let savedStatusTimer: ReturnType<typeof setTimeout> | null = null;
let reportingStorageError = false;

export function getPendingRecovery(): RecoveryRecord | null {
  return pendingRecovery;
}

export function unlockStorageWrites(): void {
  storageWriteUnlocked = true;
}

export function lockStorageWrites(): void {
  storageWriteUnlocked = false;
}

export function clearPendingRecovery(): void {
  pendingRecovery = null;
}

export function downloadRecoveryData(): boolean {
  const recovery = readRecoveryRecord();
  if (!recovery || typeof document === "undefined") return false;
  const blob = new Blob([recovery.raw], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `resume-expert-corrupt-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

export function emitStorageError(message: string) {
  // Recording the error in Zustand also invokes persist. Do not recursively
  // report the resulting write failure when browser storage remains full.
  if (typeof window === "undefined" || reportingStorageError) return;
  reportingStorageError = true;
  try {
    window.dispatchEvent(new CustomEvent(RESUME_STORAGE_ERROR_EVENT, { detail: message }));
  } finally { reportingStorageError = false; }
}

function emitStorageStatus(status: "saving" | "saved" | "error", savedAt?: string) {
  if (status === "error" && savedStatusTimer) { clearTimeout(savedStatusTimer); savedStatusTimer = null; }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(RESUME_STORAGE_STATUS_EVENT, { detail: { status, savedAt } }));
  }
}

export function readRecoveryRecord(): RecoveryRecord | null {
  try {
    const raw = window.localStorage.getItem(RESUME_RECOVERY_KEY);
    if (!raw) return pendingRecovery;
    const parsed = JSON.parse(raw) as Partial<RecoveryRecord>;
    return typeof parsed.raw === "string" && typeof parsed.reason === "string"
      ? { raw: parsed.raw, reason: parsed.reason, capturedAt: parsed.capturedAt ?? nowISO() }
      : pendingRecovery;
  } catch {
    return pendingRecovery;
  }
}

export function validatePersistedLibrary(raw: string): void {
  const parsed = JSON.parse(raw) as { state?: Partial<ResumeLibraryState>; version?: number };
  if (!parsed || typeof parsed !== "object" || !parsed.state || !Array.isArray(parsed.state.documents)) {
    throw new Error("持久化数据缺少文档库结构");
  }
  parseResumeBackup({
    backupVersion: 3,
    exportedAt: nowISO(),
    documents: parsed.state.documents,
    archives: parsed.state.archives ?? [],
    careerEvidence: parsed.state.careerEvidence ?? [],
    jobApplications: parsed.state.jobApplications ?? [],
    interviewReviews: parsed.state.interviewReviews ?? [],
  });
}

/** Explicit library operations must fail before publishing optimistic state. */
export function writeLibraryOrThrow(state: ResumeLibraryState): void {
  if (typeof window === "undefined") return;
  if (readRecoveryRecord()) throw new Error("恢复模式下禁止修改，请先确认恢复结果或导出异常数据。");
  const value = JSON.stringify({ state, version: 14 });
  validatePersistedLibrary(value);
  try {
    emitStorageStatus("saving");
    window.localStorage.setItem(RESUME_STORAGE_KEY, value);
    emitStorageStatus("saved", nowISO());
  } catch {
    const message = "本地保存失败，浏览器空间可能已满。此次操作未生效，请先导出完整备份。";
    emitStorageError(message);
    emitStorageStatus("error");
    throw new Error(message);
  }
}

export function librarySnapshot(state: Pick<ResumeLibraryState, "documents" | "archives" | "activeDocumentId" | "jobApplications" | "interviewReviews">): ResumeLibraryState {
  return { schemaVersion: 14, documents: state.documents, archives: state.archives, activeDocumentId: state.activeDocumentId, careerEvidence: [], jobApplications: state.jobApplications, interviewReviews: state.interviewReviews };
}

function preserveCorruptStorage(raw: string, error: unknown): RecoveryRecord {
  const record = {
    capturedAt: nowISO(),
    reason: error instanceof Error ? error.message : "本地数据结构无效",
    raw,
  };
  pendingRecovery = record;
  try {
    window.localStorage.setItem(RESUME_RECOVERY_KEY, JSON.stringify(record));
  } catch {
    // Keep the original slot locked even when duplicating it into the recovery
    // slot fails. A smaller blank state must never replace that original.
    record.reason += "；恢复槽空间不足，原始数据仍已锁定，请先下载异常数据。";
    emitStorageStatus("error");
  }
  return record;
}

function readableLibraryWithIsolatedArchives(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.state || !Array.isArray(parsed.state.archives)) return null;
    const valid = parsed.state.archives.filter((item: unknown) => resumeArchiveSchema.safeParse(item).success);
    const isolated = JSON.stringify({ ...parsed, state: { ...parsed.state, archives: valid } });
    validatePersistedLibrary(isolated);
    return isolated;
  } catch { return null; }
}

export const safeLocalStorage: StateStorage = {
  getItem(name) {
    try {
      const existingRecovery = readRecoveryRecord();
      if (existingRecovery) {
        pendingRecovery = existingRecovery;
        const saved = window.localStorage.getItem(name);
        if (saved) {
          try { validatePersistedLibrary(saved); return saved; } catch { /* Keep the original recovery slot. */ }
        }
        return readableLibraryWithIsolatedArchives(existingRecovery.raw);
      }
      const value = window.localStorage.getItem(name);
      if (value) {
        try {
          validatePersistedLibrary(value);
        } catch (error) {
          preserveCorruptStorage(value, error);
          emitStorageError("检测到异常本地数据，已进入恢复模式并锁定自动覆盖。");
          return readableLibraryWithIsolatedArchives(value);
        }
      }
      return value;
    } catch {
      emitStorageError("无法读取浏览器本地数据，请检查隐私模式或存储权限。");
      return null;
    }
  },
  setItem(name, value) {
    try {
      if (!storageWriteUnlocked && readRecoveryRecord()) {
        emitStorageError("恢复模式下已暂停自动保存，请先下载、恢复或确认清空异常数据。");
        emitStorageStatus("error");
        return;
      }
      emitStorageStatus("saving");
      window.localStorage.setItem(name, value);
      if (savedStatusTimer) clearTimeout(savedStatusTimer);
      savedStatusTimer = setTimeout(() => emitStorageStatus("saved", nowISO()), 120);
    } catch {
      emitStorageError("本地保存失败，浏览器存储空间可能已满。请先导出重要简历。");
      emitStorageStatus("error");
    }
  },
  removeItem(name) {
    try {
      window.localStorage.removeItem(name);
    } catch {
      emitStorageError("无法清除浏览器本地数据，请检查存储权限。");
    }
  },
};

export type LegacyResumeDocument = Omit<Partial<ResumeDocument>, "schemaVersion"> & {
  schemaVersion?: number;
  isFinalResumeStale?: boolean;
};

export function migrateDocument(document: LegacyResumeDocument): ResumeDocument {
  const base = createEmptyDocument(typeof document.id === "string" ? document.id : createId());
  const sourceResume = document.sourceResume
    ? normalizeFinalResumeBullets(document.sourceResume, "imported")
    : null;
  const importedResume = document.importedResume ?? (sourceResume ? migrateSourceResume(sourceResume) : null);
  const analysisResult = document.analysisResult
    ? {
        ...document.analysisResult,
        finalResume: normalizeFinalResumeBullets(document.analysisResult.finalResume, "ai-generated", [], "needs-review"),
      }
    : null;
  const hasCurrentRequirementMap = Boolean(document.schemaVersion && document.schemaVersion >= 9 && document.jdAnalysisDocument);
  const finalResumeStatus: FinalResumeStatus = analysisResult && !hasCurrentRequirementMap
    ? "stale"
    :
    document.finalResumeStatus === "draft" ||
    document.finalResumeStatus === "confirmed" ||
    document.finalResumeStatus === "stale"
      ? document.finalResumeStatus
      : document.isFinalResumeStale
        ? "stale"
        : analysisResult?.finalResume
          ? "confirmed"
          : "draft";
  const { isFinalResumeStale: _legacyStale, ...documentWithoutLegacyStatus } = document;
  void _legacyStale;
  return {
    ...base,
    ...documentWithoutLegacyStatus,
    schemaVersion: 12,
    jobTargetContext: document.jobTargetContext ?? { companyName: "", notes: "", companySnapshotId: null },
    materialRevision: typeof document.materialRevision === "number" ? document.materialRevision : 0,
    analysisRevision: analysisResult && hasCurrentRequirementMap && typeof document.analysisRevision === "number" ? document.analysisRevision : null,
    jdAnalysisDocument: hasCurrentRequirementMap && document.jdAnalysisDocument ? migrateJDMap(document.jdAnalysisDocument) : null,
    analysisBasis: hasCurrentRequirementMap && document.analysisBasis ? document.analysisBasis : null,
    sourceResume,
    importedResume,
    analysisResult,
    finalResumeStatus,
    customOptimizeInstruction: typeof document.customOptimizeInstruction === "string"
      ? document.customOptimizeInstruction.slice(0, 300)
      : "",
    layoutConfig: sanitizeLayoutConfig(document.layoutConfig),
  } as ResumeDocument;
}

function migrateSourceResume(sourceResume: NonNullable<ResumeDocument["sourceResume"]>): ImportedResumeProfile {
  const item = (text: string) => ({ id: `legacy-import-${stableLegacyHash(text)}`, text, sourceQuote: text, status: "needs-review" as const, confidence: "low" as const });
  return {
    schemaVersion: 1,
    personalInfo: sourceResume.personalInfo,
    jobIntent: sourceResume.jobIntent,
    summary: sourceResume.summary,
    workExperience: sourceResume.workExperience.map((entry) => ({ id: `legacy-work-${stableLegacyHash(entry.company + entry.role)}`, organization: entry.company, name: "", role: entry.role, period: entry.period, summary: "", bullets: entry.bullets.map((bullet) => item(typeof bullet === "string" ? bullet : bullet.text)), sourceQuote: entry.company, status: "needs-review", confidence: "low" })),
    internshipExperience: [],
    projectExperience: sourceResume.projectExperience.map((entry) => ({ id: `legacy-project-${stableLegacyHash(entry.name + entry.role)}`, organization: "", name: entry.name, role: entry.role, period: entry.period, summary: "", bullets: entry.bullets.map((bullet) => item(typeof bullet === "string" ? bullet : bullet.text)), sourceQuote: entry.name, status: "needs-review", confidence: "low" })),
    educationHistory: sourceResume.education.school ? [{ id: `legacy-education-${stableLegacyHash(sourceResume.education.school)}`, school: sourceResume.education.school, degree: sourceResume.education.degree, period: sourceResume.education.period, details: [], sourceQuote: sourceResume.education.school, status: "needs-review", confidence: "low" }] : [],
    skillsAndTools: sourceResume.skillsAndTools.map(item), certifications: sourceResume.certifications ?? [], languages: sourceResume.languages ?? [], awards: sourceResume.awards ?? [], links: sourceResume.links ?? [], otherSections: sourceResume.otherSections ?? [], unmappedSegments: [],
  };
}

function stableLegacyHash(value: string): string {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}
