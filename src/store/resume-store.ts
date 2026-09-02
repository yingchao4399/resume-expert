"use client";

import { create } from "zustand";
import { applyConsolidation, restorePreviousMap, migrateJDMap, validReferences } from "@/lib/jd/consolidation";
import { jdAnalysisDocumentSchema } from "@/lib/jd/schemas";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CareerEvidence, FinalResume, ImportedResumeProfile, ResumeDocument, ResumeLibraryState, ResumeArchive } from "@/types/resume";
import { archiveBlockedReason, createArchive, draftFromArchive, sameArchiveContent } from "@/lib/library/resume-archives";
import { WORKFLOW_STAGES } from "@/config/workflow";
import { sanitizeLayoutConfig } from "@/lib/templates/resume-templates";
import { buildEvidenceCandidates, evidenceSourceReference, mapResumeBullets, normalizeFinalResumeBullets } from "@/lib/evidence/resume-evidence";
import { isAnalysisFresh } from "@/lib/analysis-revision";
import {
  confirmJDAnalysisDocument as confirmDecisionMap,
  confirmRequirement as confirmDecisionRequirement,
  confirmSafeRequirements,
  rejectRequirement as rejectDecisionRequirement,
  updateRequirementAtom,
} from "@/lib/jd/decision-map";
import { parseResumeBackup } from "@/lib/backup/resume-backup";
import { EXAMPLE_USER_INPUT } from "@/store/resume-store-example";
import type { ResumeStore } from "@/store/resume-store.types";
import {
  createEmptyDocument,
  createId,
  getActiveDocument,
  nowISO,
  suggestedTitle,
  updateActiveDocument,
  workingStateFromDocument,
} from "@/store/resume-store-document";
import {
  RESUME_RECOVERY_KEY,
  RESUME_STORAGE_KEY,
  clearPendingRecovery,
  emitStorageError,
  getPendingRecovery,
  lockStorageWrites,
  migrateDocument,
  type LegacyResumeDocument,
  readRecoveryRecord,
  safeLocalStorage,
  unlockStorageWrites,
  validatePersistedLibrary,
  writeLibraryOrThrow,
  librarySnapshot,
} from "@/store/resume-store-persistence";
import { hasRunningTask } from "@/lib/tasks/task-runtime";

export { defaultUserInput } from "@/store/resume-store-example";
export { createEmptyDocument } from "@/store/resume-store-document";
export {
  RESUME_RECOVERY_KEY,
  RESUME_STORAGE_ERROR_EVENT,
  RESUME_STORAGE_KEY,
  RESUME_STORAGE_STATUS_EVENT,
  downloadRecoveryData,
} from "@/store/resume-store-persistence";

function confirmUnsavedChanges(state: ResumeStore): boolean {
  if (hasRunningTask(state.activeDocumentId) && typeof window !== "undefined") {
    if (!window.confirm("当前任务仍在进行，离开会取消本次任务且不会写入半成品。是否继续？")) return false;
  }
  if (!state.dirtyScope || typeof window === "undefined") return true;
  const label = state.dirtyScope === "resume" ? "简历内容" : state.dirtyScope === "layout" ? "排版设置" : state.dirtyScope === "jd" ? "需求地图" : "经历资料";
  return window.confirm(`${label}还有未保存修改，离开后将丢失。是否继续？`);
}

function confirmDocumentNavigation(state: ResumeStore): boolean {
  if (typeof window !== "undefined" && !window.dispatchEvent(new Event("resume-expert-before-navigate", { cancelable: true }))) return false;
  return confirmUnsavedChanges(state);
}

const ANALYSIS_STEPS = new Set(WORKFLOW_STAGES.slice(1).flatMap((stage) => stage.steps.map((step) => step.id)));

function mapDocumentResume(document: ResumeDocument, mapper: (resume: FinalResume) => FinalResume): ResumeDocument {
  if (!document.analysisResult) return document;
  return { ...document, analysisResult: { ...document.analysisResult, finalResume: mapper(document.analysisResult.finalResume) } };
}

function preserveImportedSections(resume: FinalResume, sourceResume: FinalResume | null): FinalResume {
  if (!sourceResume) return resume;
  const fallback = <T,>(current: T[] | undefined, source: T[] | undefined): T[] | undefined =>
    current?.length ? current : source;
  return {
    ...resume,
    educationHistory: fallback(resume.educationHistory, sourceResume.educationHistory),
    certifications: fallback(resume.certifications, sourceResume.certifications),
    languages: fallback(resume.languages, sourceResume.languages),
    awards: fallback(resume.awards, sourceResume.awards),
    links: fallback(resume.links, sourceResume.links),
    otherSections: fallback(resume.otherSections, sourceResume.otherSections),
  };
}

function confirmedImportedContent(profile: ImportedResumeProfile): Set<string> {
  const values = new Set<string>();
  const add = (value: string) => {
    const normalized = value.trim();
    if (normalized) values.add(normalized);
  };
  for (const experience of [...profile.workExperience, ...profile.internshipExperience, ...profile.projectExperience]) {
    if (experience.status !== "confirmed") continue;
    experience.bullets.filter((item) => item.status === "confirmed").forEach((item) => add(item.text));
  }
  profile.skillsAndTools.filter((item) => item.status === "confirmed").forEach((item) => add(item.text));
  return values;
}

function updateEvidenceLinks(document: ResumeDocument, evidenceId: string, mode: "review" | "remove"): ResumeDocument {
  let affected = false;
  const next = mapDocumentResume(document, (resume) => mapResumeBullets(resume, (bullet) => {
    if (!bullet.evidenceLinks.some((link) => link.evidenceId === evidenceId)) return bullet;
    affected = true;
    const links = mode === "remove"
      ? bullet.evidenceLinks.filter((link) => link.evidenceId !== evidenceId)
      : bullet.evidenceLinks.map((link) => link.evidenceId === evidenceId ? { ...link, status: "needs-review" as const } : link);
    return { ...bullet, evidenceLinks: links, evidenceIds: links.map((link) => link.evidenceId) };
  }));
  return affected ? { ...next, finalResumeStatus: "stale", updatedAt: nowISO() } : next;
}

function remapDocumentEvidence(document: ResumeDocument, evidenceIdMap: Map<string, string>, existingIds: Set<string>): ResumeDocument {
  return mapDocumentResume(document, (resume) => mapResumeBullets(resume, (bullet) => {
    const links = bullet.evidenceLinks.flatMap((link) => {
      const mapped = evidenceIdMap.get(link.evidenceId) ?? (existingIds.has(link.evidenceId) ? link.evidenceId : null);
      return mapped ? [{ ...link, evidenceId: mapped }] : [];
    });
    return { ...bullet, evidenceLinks: links, evidenceIds: links.map((link) => link.evidenceId) };
  }));
}

function migrateEvidence(item: CareerEvidence): CareerEvidence {
  return { ...item, sourceReference: item.sourceReference ?? null };
}

const initialDocument = createEmptyDocument("initial-draft");

export const useResumeStore = create<ResumeStore>()(
  persist<ResumeStore, [], [], ResumeLibraryState>(
    (set, get) => ({
      documents: [initialDocument],
      archives: [],
      activeDocumentId: initialDocument.id,
      careerEvidence: [],
      jobApplications: [],
      interviewReviews: [],
      hasHydrated: false,
      storageError: null,
      recoveryAvailable: false,
      recoveryReason: null,
      recoveryReport: null,
      dirtyScope: null,

      ...workingStateFromDocument(initialDocument),
      aiMode: null,
      focusedRequirementId: null,

      createDocument: () =>
        set((state) => {
          if (!confirmDocumentNavigation(state)) return state;
          const document = createEmptyDocument();
          return {
            documents: [...state.documents, document],
            activeDocumentId: document.id,
            dirtyScope: null,
            ...workingStateFromDocument(document),
          };
        }),

      duplicateDocument: (id) =>
        set((state) => {
          if (id === undefined && !confirmDocumentNavigation(state)) return state;
          const source = id === undefined ? getActiveDocument(state) : state.documents.find(item => item.id === id);
          if (!source) throw new Error("指定的岗位版本不存在。");
          const timestamp = nowISO();
          const document: ResumeDocument = {
            ...structuredClone(source),
            id: createId(),
            title: `${source.title} · 副本`,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          const next = {
            documents: [...state.documents, document],
            ...(id === undefined ? { activeDocumentId: document.id, dirtyScope: null, ...workingStateFromDocument(document) } : {}),
          };
          writeLibraryOrThrow(librarySnapshot({ ...state, ...next }));
          return next;
        }),

      renameDocument: (title, id) =>
        set((state) => {
          const normalized = title.trim();
          if (!normalized) return state;
          const targetId = id ?? state.activeDocumentId;
          if (!state.documents.some(item => item.id === targetId)) throw new Error("指定的岗位版本不存在。");
          const next = { documents: state.documents.map(item => item.id === targetId ? { ...item, title: normalized, updatedAt: nowISO() } : item) };
          writeLibraryOrThrow(librarySnapshot({ ...state, ...next }));
          return next;
        }),

      deleteDocument: (id) =>
        set((state) => {
          const targetId = id ?? state.activeDocumentId;
          if (targetId === state.activeDocumentId && !confirmDocumentNavigation(state)) return state;
          const remaining = state.documents.filter(
            (document) => document.id !== targetId
          );
          const jobApplications = state.jobApplications.map((application) =>
            application.resumeDocumentId === targetId
              ? { ...application, resumeDocumentId: null, updatedAt: nowISO() }
              : application
          );
          const interviewReviews = state.interviewReviews.map((review) =>
            review.resumeDocumentId === targetId
              ? { ...review, resumeDocumentId: null, updatedAt: nowISO() }
              : review
          );

          if (remaining.length === 0) {
            const document = createEmptyDocument();
            const next = {
              documents: [document],
              activeDocumentId: document.id,
              dirtyScope: null,
              jobApplications,
              interviewReviews,
              ...workingStateFromDocument(document),
            };
            writeLibraryOrThrow(librarySnapshot({ ...state, ...next }));
            return next;
          }

          const nextActiveId =
            targetId === state.activeDocumentId
              ? remaining[0].id
              : state.activeDocumentId;
          const nextActive =
            remaining.find((document) => document.id === nextActiveId) ??
            remaining[0];

          const next = {
            documents: remaining,
            activeDocumentId: nextActive.id,
            jobApplications,
            interviewReviews,
            ...(targetId === state.activeDocumentId ? { dirtyScope: null, ...workingStateFromDocument(nextActive) } : {}),
          };
          writeLibraryOrThrow(librarySnapshot({ ...state, ...next }));
          return next;
        }),

      selectDocument: (id) =>
        set((state) => {
          const document = state.documents.find((item) => item.id === id);
          if (!document || document.id === state.activeDocumentId) return state;
          if (!confirmDocumentNavigation(state)) return state;
          return {
            activeDocumentId: document.id,
            dirtyScope: null,
            ...workingStateFromDocument(document),
          };
        }),

      prepareNavigation: () => {
        if (!confirmDocumentNavigation(get())) return false;
        set({ dirtyScope: null });
        return true;
      },
      archiveDocument: (id, title, notes) => {
        const state = get();
        const document = state.documents.find(item => item.id === id);
        const blocked = archiveBlockedReason(document, Boolean(state.dirtyScope), hasRunningTask(document?.id ?? id));
        if (blocked) throw new Error(blocked);
        const archive = createArchive(document!, title, notes);
        const existing = state.archives.find(item => sameArchiveContent(item, archive));
        if (existing) return { id: existing.id, duplicate: true };
        const archives = [...state.archives, archive];
        writeLibraryOrThrow(librarySnapshot({ ...state, archives }));
        set({ archives });
        return { id: archive.id, duplicate: false };
      },
      updateArchive: (id, title, notes) => {
        if (!title.trim() || title.trim().length > 120 || notes.length > 1000) throw new Error("名称须为 1–120 字，备注最多 1000 字。");
        const state = get();
        if (!state.archives.some(item => item.id === id)) throw new Error("存档不存在。");
        const archives = state.archives.map(item => item.id === id ? { ...item, title: title.trim(), notes: notes.trim() } : item);
        writeLibraryOrThrow(librarySnapshot({ ...state, archives }));
        set({ archives });
      },
      deleteArchive: id => {
        const state = get();
        const archives = state.archives.filter(item => item.id !== id);
        writeLibraryOrThrow(librarySnapshot({ ...state, archives }));
        set({ archives });
      },
      copyArchiveToDraft: id => {
        const state = get();
        const archive = state.archives.find(item => item.id === id);
        if (!archive) throw new Error("存档不存在。");
        const document = draftFromArchive(archive);
        const documents = [...state.documents, document];
        writeLibraryOrThrow(librarySnapshot({ ...state, documents }));
        set({ documents });
        return document.id;
      },

      setStorageError: (error) => set({ storageError: error }),
      markHydrated: () => {
        const recovery = getPendingRecovery();
        set({
          hasHydrated: true,
          recoveryAvailable: Boolean(recovery),
          recoveryReason: recovery?.reason ?? null,
          recoveryReport: null,
        });
      },
      setDirtyScope: (scope) => set({ dirtyScope: scope }),
      attemptStorageRecovery: () => {
        const recovery = readRecoveryRecord();
        if (!recovery) return null;
        try {
          // Preserve the recovery copy durably before replacing the primary
          // slot. An in-memory fallback alone would be lost on refresh.
          if (!window.localStorage.getItem(RESUME_RECOVERY_KEY)) {
            window.localStorage.setItem(RESUME_RECOVERY_KEY, JSON.stringify(recovery));
          }
          const parsed = JSON.parse(recovery.raw) as { state?: Partial<ResumeLibraryState> };
          const candidates = Array.isArray(parsed.state?.documents) ? parsed.state.documents : [];
          const recoveredDocuments: ResumeDocument[] = [];
          let skipped = 0;
          for (const candidate of candidates) {
            try {
              const backup = parseResumeBackup({ backupVersion: 3, exportedAt: nowISO(), documents: [candidate] });
              recoveredDocuments.push(...backup.documents);
            } catch {
              skipped += 1;
            }
          }
          const recoverCollection = <T,>(values: unknown, key: "careerEvidence" | "jobApplications" | "interviewReviews" | "archives"): T[] => {
            if (!Array.isArray(values)) return [];
            const recovered: T[] = [];
            for (const value of values) {
              try {
                const base = { backupVersion: 3, exportedAt: nowISO(), documents: recoveredDocuments.length ? [recoveredDocuments[0]] : [createEmptyDocument("recovery-placeholder")], careerEvidence: [], jobApplications: [], interviewReviews: [], [key]: [value] };
                const backup = parseResumeBackup(base);
                recovered.push(...(backup[key] as T[]));
              } catch { skipped += 1; }
            }
            return recovered;
          };
          const careerEvidence = recoverCollection<CareerEvidence>(parsed.state?.careerEvidence, "careerEvidence");
          const jobApplications = recoverCollection<ResumeLibraryState["jobApplications"][number]>(parsed.state?.jobApplications, "jobApplications");
          const interviewReviews = recoverCollection<ResumeLibraryState["interviewReviews"][number]>(parsed.state?.interviewReviews, "interviewReviews");
          const archives = recoverCollection<ResumeArchive>(parsed.state?.archives, "archives");
          if (recoveredDocuments.length === 0 && careerEvidence.length === 0 && jobApplications.length === 0 && interviewReviews.length === 0 && archives.length === 0) return null;
          if (recoveredDocuments.length === 0) recoveredDocuments.push(createEmptyDocument());
          const activeDocumentId = recoveredDocuments.some((item) => item.id === parsed.state?.activeDocumentId)
            ? parsed.state?.activeDocumentId as string
            : recoveredDocuments[0].id;
          const recoveredValue = JSON.stringify({
            state: { schemaVersion: 14, documents: recoveredDocuments, archives, activeDocumentId, careerEvidence, jobApplications, interviewReviews },
            version: 14,
          });
          validatePersistedLibrary(recoveredValue);
          unlockStorageWrites();
          window.localStorage.setItem(RESUME_STORAGE_KEY, recoveredValue);
          lockStorageWrites();
          const warnings = skipped ? [`${skipped} 项损坏数据无法恢复，已跳过。`] : [];
          const report = { documents: recoveredDocuments.length, archives: archives.length, careerEvidence: careerEvidence.length, jobApplications: jobApplications.length, interviewReviews: interviewReviews.length, skipped, warnings };
          const active = recoveredDocuments.find((item) => item.id === activeDocumentId) ?? recoveredDocuments[0];
          set({
            documents: recoveredDocuments, archives, activeDocumentId, careerEvidence, jobApplications, interviewReviews,
            recoveryReport: report, storageError: null, ...workingStateFromDocument(active),
          });
          return report;
        } catch {
          lockStorageWrites();
          return null;
        }
      },
      confirmStorageRecovery: () => {
        unlockStorageWrites();
        window.localStorage.removeItem(RESUME_RECOVERY_KEY);
        clearPendingRecovery();
        lockStorageWrites();
        set({ recoveryAvailable: false, recoveryReason: null, recoveryReport: null });
      },
      clearCorruptStorage: () => {
        unlockStorageWrites();
        window.localStorage.removeItem(RESUME_RECOVERY_KEY);
        window.localStorage.removeItem(RESUME_STORAGE_KEY);
        clearPendingRecovery();
        const document = createEmptyDocument();
        set({
          documents: [document], archives: [], activeDocumentId: document.id, recoveryAvailable: false,
          recoveryReason: null, recoveryReport: null, storageError: null, dirtyScope: null,
          ...workingStateFromDocument(document),
        });
        lockStorageWrites();
      },

      importDocuments: (documents, mode, evidence = [], applications = [], reviews = [], preserveEvidenceIds = false, archives = []) =>
        set((state) => {
          if (documents.length === 0) return state;
          const idMap = new Map<string, string>();
          const evidenceIdMap = new Map<string, string>();
          const applicationIdMap = new Map<string, string>();
          evidence.forEach((item) => evidenceIdMap.set(item.id, mode === "merge" && !preserveEvidenceIds ? createId() : item.id));
          const migrated = documents.map((document) => {
            const nextId = mode === "merge" ? createId() : document.id;
            idMap.set(document.id, nextId);
            return migrateDocument({
              ...structuredClone(document),
              id: nextId,
              title: mode === "merge" ? `${document.title} · 导入副本` : document.title,
              updatedAt: nowISO(),
            });
          });
          const existingEvidenceIds = new Set(mode === "replace" ? evidence.map((item) => item.id) : state.careerEvidence.map((item) => item.id));
          const imported = migrated.map((document) => remapDocumentEvidence(document, evidenceIdMap, existingEvidenceIds));
          const importedEvidence = evidence.map((item) => ({
            ...structuredClone(item),
            id: evidenceIdMap.get(item.id)!,
            sourceDocumentId: item.sourceDocumentId ? idMap.get(item.sourceDocumentId) ?? item.sourceDocumentId : null,
            updatedAt: nowISO(),
          }));
          const importedApplications = applications.map((item) => {
            const nextId = mode === "merge" ? createId() : item.id;
            applicationIdMap.set(item.id, nextId);
            return {
              ...structuredClone(item),
              id: nextId,
              resumeDocumentId: item.resumeDocumentId ? idMap.get(item.resumeDocumentId) ?? item.resumeDocumentId : null,
              updatedAt: nowISO(),
            };
          });
          const importedReviews = reviews.map((item) => ({
            ...structuredClone(item),
            id: mode === "merge" ? createId() : item.id,
            applicationId: item.applicationId ? applicationIdMap.get(item.applicationId) ?? item.applicationId : null,
            resumeDocumentId: item.resumeDocumentId ? idMap.get(item.resumeDocumentId) ?? item.resumeDocumentId : null,
            updatedAt: nowISO(),
          }));
          const active = imported[0];
          const importedArchives = archives.map(archive => ({ ...structuredClone(archive),
            id: mode === "merge" ? createId() : archive.id,
            sourceDocumentId: archive.sourceDocumentId ? idMap.get(archive.sourceDocumentId) ?? null : null,
            finalResume: mapResumeBullets(archive.finalResume, bullet => {
              const evidenceLinks = bullet.evidenceLinks.map(link => ({ ...link, evidenceId: evidenceIdMap.get(link.evidenceId) ?? link.evidenceId }));
              return { ...bullet, evidenceLinks, evidenceIds: evidenceLinks.map(link => link.evidenceId) };
            }),
          }));
          const next = {
            documents: mode === "replace" ? imported : [...state.documents, ...imported],
            archives: mode === "replace" ? importedArchives : [...state.archives, ...importedArchives],
            careerEvidence: mode === "replace" ? importedEvidence : [...state.careerEvidence, ...importedEvidence],
            jobApplications: mode === "replace" ? importedApplications : [...state.jobApplications, ...importedApplications],
            interviewReviews: mode === "replace" ? importedReviews : [...state.interviewReviews, ...importedReviews],
            activeDocumentId: active.id,
            ...workingStateFromDocument(active),
          };
          writeLibraryOrThrow(librarySnapshot({ ...state, ...next }));
          return next;
        }),

      addCareerEvidence: (evidence) =>
        set((state) => {
          const timestamp = nowISO();
          const sourceReference = evidence.sourceReference;
          if (sourceReference && state.careerEvidence.some((item) =>
            item.sourceReference?.kind === sourceReference.kind &&
            item.sourceReference.referenceId === sourceReference.referenceId &&
            item.sourceReference.fingerprint === sourceReference.fingerprint
          )) return state;
          return {
            careerEvidence: [
              ...state.careerEvidence,
              { ...evidence, id: createId(), createdAt: timestamp, updatedAt: timestamp },
            ],
          };
        }),

      confirmCareerEvidence: (id) =>
        set((state) => ({
          careerEvidence: state.careerEvidence.map((item) =>
            item.id === id ? { ...item, status: "confirmed", updatedAt: nowISO() } : item
          ),
        })),

      updateCareerEvidence: (id, patch) =>
        set((state) => {
          const current = state.careerEvidence.find((item) => item.id === id);
          if (!current) return state;
          const factualKeys = ["title", "organization", "role", "period", "description", "metrics", "skills"] as const;
          const factualChange = factualKeys.some((key) => patch[key] !== undefined && JSON.stringify(patch[key]) !== JSON.stringify(current[key]));
          return {
            careerEvidence: state.careerEvidence.map((item) => item.id === id ? { ...item, ...patch, id: item.id, status: factualChange ? "candidate" : patch.status ?? item.status, updatedAt: nowISO() } : item),
            documents: factualChange ? state.documents.map((document) => updateEvidenceLinks(document, id, "review")) : state.documents,
            ...(factualChange ? workingStateFromDocument(updateEvidenceLinks(getActiveDocument(state), id, "review")) : {}),
          };
        }),

      deleteCareerEvidence: (id) =>
        set((state) => {
          const documents = state.documents.map((document) => updateEvidenceLinks(document, id, "remove"));
          const active = documents.find((document) => document.id === state.activeDocumentId) ?? documents[0];
          return { careerEvidence: state.careerEvidence.filter((item) => item.id !== id), documents, ...workingStateFromDocument(active) };
        }),

      setResumeEvidenceLinkStatus: (bulletId, evidenceId, status) =>
        set((state) => {
          const document = mapDocumentResume(getActiveDocument(state), (resume) => mapResumeBullets(resume, (bullet) => {
            if (bullet.id !== bulletId) return bullet;
            const links = status === "removed" ? bullet.evidenceLinks.filter((link) => link.evidenceId !== evidenceId) : bullet.evidenceLinks.map((link) => link.evidenceId === evidenceId ? { ...link, status, method: status === "confirmed" ? "manual" as const : link.method } : link);
            return { ...bullet, evidenceLinks: links, evidenceIds: links.map((link) => link.evidenceId) };
          }));
          return updateActiveDocument(state, { ...document, finalResumeStatus: status === "confirmed" ? state.finalResumeStatus : "stale" });
        }),

      addJobApplication: (application) =>
        set((state) => {
          const timestamp = nowISO();
          return {
            jobApplications: [
              ...state.jobApplications,
              { ...application, id: createId(), createdAt: timestamp, updatedAt: timestamp },
            ],
          };
        }),

      updateJobApplication: (id, patch) =>
        set((state) => ({
          jobApplications: state.jobApplications.map((item) =>
            item.id === id ? { ...item, ...patch, id: item.id, updatedAt: nowISO() } : item
          ),
        })),

      deleteJobApplication: (id) =>
        set((state) => ({
          jobApplications: state.jobApplications.filter((item) => item.id !== id),
          interviewReviews: state.interviewReviews.map((review) =>
            review.applicationId === id
              ? { ...review, applicationId: null, updatedAt: nowISO() }
              : review
          ),
        })),

      saveInterviewReview: (review) =>
        set((state) => {
          const timestamp = nowISO();
          return {
            interviewReviews: [
              ...state.interviewReviews,
              { ...review, id: createId(), createdAt: timestamp, updatedAt: timestamp },
            ],
          };
        }),

      deleteInterviewReview: (id) =>
        set((state) => ({
          interviewReviews: state.interviewReviews.filter((item) => item.id !== id),
        })),

      unlinkInterviewRecording: (recordingId) =>
        set((state) => ({
          interviewReviews: state.interviewReviews.map((review) =>
            review.recording?.id === recordingId
              ? { ...review, recording: null, updatedAt: nowISO() }
              : review
          ),
        })),

      setUserInput: (input) =>
        set((state) => {
          const userInput = { ...state.userInput, ...input };
          const changed = Object.entries(input).some(([key, value]) => state.userInput[key as keyof typeof state.userInput] !== value);
          if (!changed) return state;
          const active = getActiveDocument(state);
          const title =
            active.title === "未命名简历" && userInput.targetRole.trim()
              ? suggestedTitle(userInput)
              : active.title;
          return updateActiveDocument(state, {
            userInput,
            title,
            materialRevision: state.materialRevision + 1,
            analysisRevision: null,
            jdAnalysisDocument: state.jdAnalysisDocument ? { ...state.jdAnalysisDocument, status: "stale" } : null,
            analysisBasis: null,
            finalResumeStatus: state.analysisResult ? "stale" : "draft",
          });
        }),

      setJobTargetContext: (input) =>
        set((state) => {
          const jobTargetContext = { ...state.jobTargetContext, ...input, companySnapshotId: null } satisfies import("@/types/resume").JobTargetContext;
          const changed = Object.entries(input).some(([key, value]) => state.jobTargetContext[key as keyof typeof state.jobTargetContext] !== value);
          if (!changed) return state;
          return updateActiveDocument(state, {
            jobTargetContext,
            materialRevision: state.materialRevision + 1,
            analysisRevision: null,
            jdAnalysisDocument: state.jdAnalysisDocument ? { ...state.jdAnalysisDocument, status: "stale" } : null,
            analysisBasis: null,
            finalResumeStatus: state.analysisResult ? "stale" : "draft",
          });
        }),

      setImportedResume: (text, sourceResume, metadata, importedResume?: ImportedResumeProfile | null) =>
        set((state) => {
          const normalizedSource = sourceResume
            ? normalizeFinalResumeBullets(sourceResume, "imported")
            : null;
          const active = getActiveDocument(state);
          const candidates = normalizedSource
            ? buildEvidenceCandidates(normalizedSource, active.id)
            : [];
          const trustedContent = importedResume ? confirmedImportedContent(importedResume) : null;
          const confirmedCandidates = trustedContent
            ? candidates.filter((item) => trustedContent.has(item.description.trim()))
            : candidates;
          const retained = state.careerEvidence.filter(
            (item) => !(item.sourceDocumentId === active.id && item.status === "candidate")
          );
          return {
            ...updateActiveDocument(state, {
              userInput: { ...state.userInput, originalResume: text },
              sourceResume: normalizedSource,
              importedResume: importedResume ?? null,
              importMetadata: metadata,
              materialRevision: state.materialRevision + 1,
              analysisRevision: null,
              jdAnalysisDocument: state.jdAnalysisDocument ? { ...state.jdAnalysisDocument, status: "stale" } : null,
              analysisBasis: null,
              currentStep: "input",
              finalResumeStatus: state.analysisResult ? "stale" : "draft",
            }),
            careerEvidence: [...retained, ...confirmedCandidates],
          };
        }),

      setLayoutConfig: (config) =>
        set((state) => updateActiveDocument(state, { layoutConfig: sanitizeLayoutConfig(config) })),

      loadExampleData: () => {
        const state = get();
        const hasMaterials = Boolean(
          state.userInput.targetRole.trim() ||
          state.userInput.jobDescription.trim() ||
          state.userInput.originalResume.trim() ||
          state.jobTargetContext.companyName.trim() ||
          state.jobTargetContext.notes.trim()
        );
        if (hasMaterials && typeof window !== "undefined" && !window.confirm("使用示例数据会覆盖当前岗位材料，是否继续？")) {
          return false;
        }
        set((current) =>
          updateActiveDocument(current, {
            title: suggestedTitle(EXAMPLE_USER_INPUT),
            userInput: { ...EXAMPLE_USER_INPUT },
            jobTargetContext: { companyName: "", notes: "", companySnapshotId: null },
            analysisResult: null,
            materialRevision: current.materialRevision + 1,
            analysisRevision: null,
            jdAnalysisDocument: null,
            analysisBasis: null,
            sourceResume: null,
            importedResume: null,
            importMetadata: null,
            currentStep: "input",
            finalResumeStatus: "draft",
            hasManualEdits: false,
          })
        );
        return true;
      },

      setCurrentStep: (step) =>
        set((state) => {
          if (step === state.currentStep) return state;
          if (!confirmUnsavedChanges(state)) return state;
          return { ...updateActiveDocument(state, { currentStep: step }), dirtyScope: null };
        }),

      setJDAnalysisDocument: (document, expectedMaterialRevision) => {
        const parsed = jdAnalysisDocumentSchema.safeParse(document);
        if (!parsed.success) { set({ analysisError: parsed.error.issues[0]?.message ?? "需求地图结构无效，旧地图未改变。" }); return false; }
        let accepted = false;
        set((state) => {
          if (state.materialRevision !== expectedMaterialRevision || document.materialRevision !== expectedMaterialRevision) {
            return { analysisError: "材料已在 JD 解析期间变化，本次草稿未写入。请重新解析。" };
          }
          accepted = true;
          return {
            ...updateActiveDocument(state, {
              jdAnalysisDocument: migrateJDMap(parsed.data),
              analysisRevision: null,
              analysisBasis: null,
              finalResumeStatus: state.analysisResult ? "stale" : "draft",
            }),
            analysisError: null,
          };
        });
        return accepted;
      },

      updateJDRequirement: (requirementId, patch) =>
        set((state) => state.jdAnalysisDocument ? updateActiveDocument(state, {
          jdAnalysisDocument: updateRequirementAtom(state.jdAnalysisDocument, requirementId, patch),
          analysisRevision: null,
          analysisBasis: null,
          finalResumeStatus: state.analysisResult ? "stale" : "draft",
        }) : state),

      confirmSafeJDRequirements: () =>
        set((state) => state.jdAnalysisDocument ? updateActiveDocument(state, {
          jdAnalysisDocument: confirmSafeRequirements(state.jdAnalysisDocument),
          analysisRevision: null,
          analysisBasis: null,
          finalResumeStatus: state.analysisResult ? "stale" : "draft",
        }) : state),

      confirmJDRequirement: (requirementId) => set(state => {
        if (!state.jdAnalysisDocument) return state;
        try { return updateActiveDocument(state, { jdAnalysisDocument: confirmDecisionRequirement(state.jdAnalysisDocument, requirementId), analysisRevision: null, analysisBasis: null, finalResumeStatus: state.analysisResult ? "stale" : "draft" }); }
        catch (error) { return { analysisError: error instanceof Error ? error.message : "要求无法确认" }; }
      }),

      rejectJDRequirement: (requirementId) =>
        set((state) => state.jdAnalysisDocument ? updateActiveDocument(state, {
          jdAnalysisDocument: rejectDecisionRequirement(state.jdAnalysisDocument, requirementId),
          analysisRevision: null,
          analysisBasis: null,
          finalResumeStatus: state.analysisResult ? "stale" : "draft",
        }) : state),

      confirmJDAnalysis: () => {
        let confirmed = false;
        set((state) => {
          if (!state.jdAnalysisDocument) return state;
          if (state.materialRevision !== state.jdAnalysisDocument.materialRevision) return { analysisError: "材料已变化，请重新解析 JD。" };
          try {
            const jdAnalysisDocument = confirmDecisionMap(state.jdAnalysisDocument);
            confirmed = true;
            return updateActiveDocument(state, { jdAnalysisDocument });
          } catch (error) {
            return { analysisError: error instanceof Error ? error.message : "需求地图无法确认" };
          }
        });
        return confirmed;
      },

      applyJDConsolidation: (proposal, selectedIds, expectedDocumentId) => {
        let applied = false;
        set(state => {
          if (!state.jdAnalysisDocument || state.activeDocumentId !== expectedDocumentId || state.materialRevision !== proposal.materialRevision) return { analysisError: "岗位版本或材料已变化，整理结果未应用。" };
          try {
            const next = jdAnalysisDocumentSchema.parse(applyConsolidation(state.jdAnalysisDocument, proposal, selectedIds));
            applied = true;
            return { ...updateActiveDocument(state, { jdAnalysisDocument: next, analysisRevision: null, analysisBasis: null, finalResumeStatus: state.analysisResult ? "stale" : "draft" }), dirtyScope: null };
          } catch (error) { return { analysisError: error instanceof Error ? error.message : "整理结果未应用。" }; }
        });
        return applied;
      },
      restoreJDMap: () => {
        let restored = false;
        set(state => {
          if (!state.jdAnalysisDocument) return state;
          if (state.materialRevision !== state.jdAnalysisDocument.materialRevision || state.jdAnalysisDocument.status === "stale") return { analysisError: "材料已变化，不能恢复旧材料的地图；请重新解析 JD。" };
          try {
            const next = restorePreviousMap(state.jdAnalysisDocument);
            restored = true;
            return { ...updateActiveDocument(state, { jdAnalysisDocument: next, analysisRevision: null, analysisBasis: null, finalResumeStatus: state.analysisResult ? "stale" : "draft" }), dirtyScope: null };
          } catch (error) { return { analysisError: error instanceof Error ? error.message : "恢复失败" }; }
        });
        return restored;
      },
      confirmJDGroup: groupId => set(state => {
        const map = state.jdAnalysisDocument;
        if (!map) return state;
        if (map.status === "stale" || map.materialRevision !== state.materialRevision) return { analysisError: "材料已变化，请重新解析 JD。" };
        const ids = new Set(map.groups?.find(group => group.id === groupId)?.requirementIds ?? []);
        const next = { ...map, revision: map.revision + 1, status: "draft" as const, confirmedRevision: null, updatedAt: nowISO(), requirements: map.requirements.map(item => ids.has(item.id) && item.reviewStatus === "auto-validated" && item.anchorStatus === "validated" && validReferences(map, item) && !item.reviewWarnings?.length ? { ...item, reviewStatus: "confirmed" as const } : item) };
        return updateActiveDocument(state, { jdAnalysisDocument: next, analysisRevision: null, analysisBasis: null, finalResumeStatus: state.analysisResult ? "stale" : "draft" });
      }),

      setAnalysisResult: (result, expectedMaterialRevision, expectedJDRevision) => {
        let accepted = false;
        set((state) => {
          if (state.materialRevision !== expectedMaterialRevision) return { analysisError: "材料已在分析期间发生变化，本次结果未写入。请重新分析。" };
          if (expectedJDRevision !== undefined && (!state.jdAnalysisDocument || state.jdAnalysisDocument.status !== "confirmed" || state.jdAnalysisDocument.revision !== expectedJDRevision)) {
            return { analysisError: "需求地图已在匹配期间发生变化，本次结果未写入。请重新匹配。" };
          }
          accepted = true;
          const active = getActiveDocument(state);
          return {
            ...updateActiveDocument(state, {
              title:
                active.title === "未命名简历"
                  ? suggestedTitle(state.userInput)
                  : active.title,
              analysisResult: { ...result, finalResume: normalizeFinalResumeBullets(preserveImportedSections(result.finalResume, state.sourceResume), "ai-generated", state.careerEvidence) },
              analysisRevision: expectedMaterialRevision,
              analysisBasis: expectedJDRevision === undefined ? null : { materialRevision: expectedMaterialRevision, jdAnalysisRevision: expectedJDRevision },
              finalResumeStatus: "draft",
              hasManualEdits: false,
            }),
            analysisError: null,
          };
        });
        return accepted;
      },

      setOptimizedItems: (items) =>
        set((state) => {
          if (!state.analysisResult) return state;
          return updateActiveDocument(state, {
            analysisResult: { ...state.analysisResult, optimizedItems: items },
            finalResumeStatus: "stale",
          });
        }),

      setInterviewPrep: (prep, expectedMaterialRevision) => {
        let accepted = false;
        set((state) => {
          if (!state.analysisResult || state.materialRevision !== expectedMaterialRevision || state.analysisRevision !== expectedMaterialRevision) return state;
          accepted = true;
          return updateActiveDocument(state, { analysisResult: { ...state.analysisResult, interviewPrep: prep } });
        });
        return accepted;
      },

      setFinalResume: (resume, options) =>
        set((state) => {
          if (!state.analysisResult) return state;
          return updateActiveDocument(state, {
            analysisResult: { ...state.analysisResult, finalResume: normalizeFinalResumeBullets(preserveImportedSections(resume, state.sourceResume), options?.manual ? "manual" : "ai-generated", state.careerEvidence) },
            finalResumeStatus: "confirmed",
            hasManualEdits: options?.manual === true,
          });
        }),

      setAnalysisError: (error) => set({ analysisError: error }),
      setAiMode: (mode) => set({ aiMode: mode }),

      setOptimizeStyle: (style) =>
        set((state) =>
          updateActiveDocument(state, {
            optimizeStyle: style,
            finalResumeStatus: state.analysisResult ? "stale" : "draft",
          })
        ),

      setCustomOptimizeInstruction: (instruction) =>
        set((state) =>
          updateActiveDocument(state, {
            customOptimizeInstruction: instruction.slice(0, 300),
            finalResumeStatus: state.analysisResult ? "stale" : "draft",
          })
        ),

      updateFollowUpAnswer: (id, answer) =>
        set((state) => {
          if (!state.analysisResult) return state;
          return updateActiveDocument(state, {
            analysisResult: {
              ...state.analysisResult,
              followUpQuestions: state.analysisResult.followUpQuestions.map((q) =>
                q.id === id ? { ...q, userAnswer: answer } : q
              ),
            },
            finalResumeStatus: "stale",
          });
        }),

      setFollowUpGuidance: (id, example) =>
        set((state) => {
          if (!state.analysisResult) return state;
          return updateActiveDocument(state, { analysisResult: { ...state.analysisResult, followUpQuestions: state.analysisResult.followUpQuestions.map((item) => item.id === id ? { ...item, placeholderExample: example } : item) } });
        }),

      openFollowUpForRequirement: (requirementId) =>
        set((state) => ({ ...updateActiveDocument(state, { currentStep: "follow-up" }), focusedRequirementId: requirementId })),

      setFollowUpBullet: (id, bullet) =>
        set((state) => {
          if (!state.analysisResult) return state;
          const question = state.analysisResult.followUpQuestions.find((item) => item.id === id);
          const timestamp = nowISO();
          const reference = question ? evidenceSourceReference("follow-up", `${state.activeDocumentId}:${id}`, bullet) : null;
          const previous = question ? state.careerEvidence.find((item) => item.sourceReference?.kind === "follow-up" && item.sourceReference.referenceId === `${state.activeDocumentId}:${id}`) : null;
          const candidate: CareerEvidence | null = question && (!previous || previous.status === "confirmed")
            ? {
                id: createId(),
                type: "achievement",
                title: question.purpose || "补充经历",
                organization: "",
                role: "",
                period: "",
                description: bullet,
                metrics: bullet.match(/\d+(?:\.\d+)?\s*(?:%|％|万|千|百|家|人|次|项|天|月|年|倍)/g) ?? [],
                skills: [],
                status: "candidate",
                sourceType: "follow-up",
                sourceDocumentId: state.activeDocumentId,
                sourceReference: reference,
                createdAt: timestamp,
                updatedAt: timestamp,
              }
            : null;
          const careerEvidence = previous?.status === "candidate"
            ? state.careerEvidence.map((item) => item.id === previous.id ? { ...item, description: bullet, metrics: bullet.match(/\d+(?:\.\d+)?\s*(?:%|％|万|千|百|家|人|次|项|天|月|年|倍)/g) ?? [], sourceReference: reference, updatedAt: timestamp } : item)
            : candidate ? [...state.careerEvidence, candidate] : state.careerEvidence;
          return {
            ...updateActiveDocument(state, {
              analysisResult: {
                ...state.analysisResult,
                followUpQuestions: state.analysisResult.followUpQuestions.map((q) =>
                  q.id === id ? { ...q, generatedBullet: bullet } : q
                ),
              },
              finalResumeStatus: "stale",
            }),
            careerEvidence,
          };
        }),

      getStepStatus: (step) => {
        const state = get();
        const { currentStep, analysisResult } = state;
        const analysisFresh = isAnalysisFresh(state);

        if (step === "evidence") {
          if (currentStep === "evidence") return "active";
          return get().careerEvidence.some((item) => item.status === "confirmed") ? "completed" : "pending";
        }

        if (step === "input") {
          if (currentStep === "input") return "active";
          return state.jdAnalysisDocument?.materialRevision === state.materialRevision ? "completed" : "pending";
        }

        if (step === "jd-analysis") {
          if (currentStep === step) return "active";
          return state.jdAnalysisDocument?.status === "confirmed" ? "completed" : state.jdAnalysisDocument ? "pending" : "disabled";
        }

        const analysisSteps = new Set(["diagnosis", "match", "follow-up"]);
        if (step === "interview-recording") return currentStep === step ? "active" : "pending";
        if (step === "interview") {
          if (!analysisResult || !analysisFresh) return "disabled";
          if (currentStep === step) return "active";
          const prep = analysisResult.interviewPrep;
          return prep.selfIntroduction.trim() || prep.likelyQuestions.length || (prep.requirementStrategies?.length ?? 0) ? "completed" : "pending";
        }
        if (analysisResult && analysisSteps.has(step)) return currentStep === step ? "active" : analysisFresh ? "completed" : "pending";
        if (!analysisResult || !analysisFresh) return "disabled";
        if (currentStep === step) return "active";
        if (step === "optimize") return state.finalResumeStatus === "confirmed" ? "completed" : "pending";
        if (step === "final-resume") return state.finalResumeStatus === "confirmed" ? "completed" : "pending";
        if (step === "applications" || step === "export") return state.finalResumeStatus === "confirmed" ? "pending" : "disabled";
        return ANALYSIS_STEPS.has(step) ? "pending" : "disabled";
      },

      setCopied: (copied) => set({ copied }),
    }),
    {
      name: RESUME_STORAGE_KEY,
       version: 14,
      skipHydration: true,
      storage: createJSONStorage<ResumeLibraryState>(() => safeLocalStorage),
      partialize: librarySnapshot,
      migrate: (persistedState) => {
        const persisted = persistedState as Partial<ResumeLibraryState> & {
          documents?: LegacyResumeDocument[];
        };
        const documents = Array.isArray(persisted.documents)
          ? persisted.documents.map((document) => migrateDocument(document))
          : [];
        return {
           schemaVersion: 14,
          documents,
          archives: Array.isArray(persisted.archives) ? persisted.archives : [],
          activeDocumentId: persisted.activeDocumentId ?? documents[0]?.id ?? "",
          careerEvidence: Array.isArray(persisted.careerEvidence)
            ? persisted.careerEvidence.map(migrateEvidence)
            : [],
          jobApplications: Array.isArray(persisted.jobApplications) ? persisted.jobApplications : [],
          interviewReviews: Array.isArray(persisted.interviewReviews) ? persisted.interviewReviews : [],
        };
      },
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ResumeLibraryState>;
        const documents = Array.isArray(persisted.documents)
          ? persisted.documents
              .filter((document) => typeof document?.id === "string" && typeof document.title === "string")
              .map((document) => migrateDocument(document))
          : [];

        if (documents.length === 0) return currentState;

        const active =
          documents.find((document) => document.id === persisted.activeDocumentId) ?? documents[0];

        return {
          ...currentState,
          documents,
          archives: Array.isArray(persisted.archives) ? persisted.archives : [],
          careerEvidence: (() => {
            const projected = Array.isArray(persisted.careerEvidence) ? persisted.careerEvidence.map(migrateEvidence) : [];
            // React Strict Mode may invoke rehydrate twice. A second pass can
            // observe the compatibility field after it was cleared for the
            // IndexedDB migration; never let that empty projection erase
            // records already restored in memory.
            return projected.length > 0 || currentState.careerEvidence.length === 0
              ? projected
              : currentState.careerEvidence;
          })(),
          jobApplications: Array.isArray(persisted.jobApplications) ? persisted.jobApplications : [],
          interviewReviews: Array.isArray(persisted.interviewReviews) ? persisted.interviewReviews : [],
          activeDocumentId: active.id,
          ...workingStateFromDocument(active),
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          emitStorageError("本地简历恢复失败，已打开新的空白文档。");
        }
      },
    }
  )
);
