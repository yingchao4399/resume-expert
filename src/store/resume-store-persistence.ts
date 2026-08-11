import type { StateStorage } from "zustand/middleware";
import type { FinalResumeStatus, ResumeDocument, ResumeLibraryState } from "@/types/resume";
import { parseResumeBackup } from "@/lib/backup/resume-backup";
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
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(RESUME_STORAGE_ERROR_EVENT, { detail: message })
    );
  }
}

function emitStorageStatus(status: "saving" | "saved" | "error", savedAt?: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(RESUME_STORAGE_STATUS_EVENT, { detail: { status, savedAt } }));
  }
}

export function readRecoveryRecord(): RecoveryRecord | null {
  try {
    const raw = window.localStorage.getItem(RESUME_RECOVERY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RecoveryRecord>;
    return typeof parsed.raw === "string" && typeof parsed.reason === "string"
      ? { raw: parsed.raw, reason: parsed.reason, capturedAt: parsed.capturedAt ?? nowISO() }
      : null;
  } catch {
    return null;
  }
}

export function validatePersistedLibrary(raw: string): void {
  const parsed = JSON.parse(raw) as { state?: Partial<ResumeLibraryState>; version?: number };
  if (!parsed || typeof parsed !== "object" || !parsed.state || !Array.isArray(parsed.state.documents)) {
    throw new Error("持久化数据缺少文档库结构");
  }
  parseResumeBackup({
    backupVersion: 2,
    exportedAt: nowISO(),
    documents: parsed.state.documents,
    careerEvidence: parsed.state.careerEvidence ?? [],
    jobApplications: parsed.state.jobApplications ?? [],
    interviewReviews: parsed.state.interviewReviews ?? [],
  });
}

function preserveCorruptStorage(raw: string, error: unknown): RecoveryRecord {
  const record = {
    capturedAt: nowISO(),
    reason: error instanceof Error ? error.message : "本地数据结构无效",
    raw,
  };
  window.localStorage.setItem(RESUME_RECOVERY_KEY, JSON.stringify(record));
  pendingRecovery = record;
  return record;
}

export const safeLocalStorage: StateStorage = {
  getItem(name) {
    try {
      const existingRecovery = readRecoveryRecord();
      if (existingRecovery) {
        pendingRecovery = existingRecovery;
        return null;
      }
      const value = window.localStorage.getItem(name);
      if (value) {
        try {
          validatePersistedLibrary(value);
        } catch (error) {
          preserveCorruptStorage(value, error);
          emitStorageError("检测到异常本地数据，已进入恢复模式并锁定自动覆盖。");
          return null;
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
  const analysisResult = document.analysisResult
    ? {
        ...document.analysisResult,
        finalResume: normalizeFinalResumeBullets(document.analysisResult.finalResume, "ai-generated"),
      }
    : null;
  const finalResumeStatus: FinalResumeStatus =
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
    schemaVersion: 5,
    sourceResume,
    analysisResult,
    finalResumeStatus,
    layoutConfig: sanitizeLayoutConfig(document.layoutConfig),
  } as ResumeDocument;
}
