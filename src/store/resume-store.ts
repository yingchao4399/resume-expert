"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CareerEvidence, ResumeDocument, ResumeLibraryState } from "@/types/resume";
import { WORKFLOW_STEPS } from "@/config/workflow";
import { sanitizeLayoutConfig } from "@/lib/templates/resume-templates";
import { buildEvidenceCandidates, normalizeFinalResumeBullets } from "@/lib/evidence/resume-evidence";
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
} from "@/store/resume-store-persistence";

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
  if (!state.dirtyScope || typeof window === "undefined") return true;
  const label = state.dirtyScope === "resume" ? "简历内容" : "排版设置";
  return window.confirm(`${label}还有未保存修改，离开后将丢失。是否继续？`);
}

const initialDocument = createEmptyDocument("initial-draft");

export const useResumeStore = create<ResumeStore>()(
  persist<ResumeStore, [], [], ResumeLibraryState>(
    (set, get) => ({
      documents: [initialDocument],
      activeDocumentId: initialDocument.id,
      careerEvidence: [],
      jobApplications: [],
      interviewReviews: [],
      hasHydrated: false,
      storageError: null,
      recoveryAvailable: false,
      recoveryReason: null,
      dirtyScope: null,

      ...workingStateFromDocument(initialDocument),
      isAnalyzing: false,
      aiMode: null,

      createDocument: () =>
        set((state) => {
          if (!confirmUnsavedChanges(state)) return state;
          const document = createEmptyDocument();
          return {
            documents: [...state.documents, document],
            activeDocumentId: document.id,
            dirtyScope: null,
            ...workingStateFromDocument(document),
          };
        }),

      duplicateDocument: () =>
        set((state) => {
          if (!confirmUnsavedChanges(state)) return state;
          const source = getActiveDocument(state);
          const timestamp = nowISO();
          const document: ResumeDocument = {
            ...structuredClone(source),
            id: createId(),
            title: `${source.title} · 副本`,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          return {
            documents: [...state.documents, document],
            activeDocumentId: document.id,
            dirtyScope: null,
            ...workingStateFromDocument(document),
          };
        }),

      renameDocument: (title) =>
        set((state) => {
          const normalized = title.trim();
          if (!normalized) return state;
          return updateActiveDocument(state, { title: normalized });
        }),

      deleteDocument: (id) =>
        set((state) => {
          const targetId = id ?? state.activeDocumentId;
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
            return {
              documents: [document],
              activeDocumentId: document.id,
              jobApplications,
              interviewReviews,
              ...workingStateFromDocument(document),
            };
          }

          const nextActiveId =
            targetId === state.activeDocumentId
              ? remaining[0].id
              : state.activeDocumentId;
          const nextActive =
            remaining.find((document) => document.id === nextActiveId) ??
            remaining[0];

          return {
            documents: remaining,
            activeDocumentId: nextActive.id,
            jobApplications,
            interviewReviews,
            ...workingStateFromDocument(nextActive),
          };
        }),

      selectDocument: (id) =>
        set((state) => {
          const document = state.documents.find((item) => item.id === id);
          if (!document || document.id === state.activeDocumentId) return state;
          if (!confirmUnsavedChanges(state)) return state;
          return {
            activeDocumentId: document.id,
            dirtyScope: null,
            ...workingStateFromDocument(document),
          };
        }),

      setStorageError: (error) => set({ storageError: error }),
      markHydrated: () => {
        const recovery = getPendingRecovery();
        set({
          hasHydrated: true,
          recoveryAvailable: Boolean(recovery),
          recoveryReason: recovery?.reason ?? null,
        });
      },
      setDirtyScope: (scope) => set({ dirtyScope: scope }),
      attemptStorageRecovery: () => {
        const recovery = readRecoveryRecord();
        if (!recovery) return false;
        try {
          const parsed = JSON.parse(recovery.raw) as { state?: Partial<ResumeLibraryState> };
          const candidates = Array.isArray(parsed.state?.documents) ? parsed.state.documents : [];
          const recoveredDocuments: ResumeDocument[] = [];
          for (const candidate of candidates) {
            try {
              const backup = parseResumeBackup({ backupVersion: 2, exportedAt: nowISO(), documents: [candidate] });
              recoveredDocuments.push(...backup.documents);
            } catch {
              // Keep recovering other independent documents.
            }
          }
          if (recoveredDocuments.length === 0) return false;
          const activeDocumentId = recoveredDocuments.some((item) => item.id === parsed.state?.activeDocumentId)
            ? parsed.state?.activeDocumentId as string
            : recoveredDocuments[0].id;
          const recoveredValue = JSON.stringify({
            state: { schemaVersion: 6, documents: recoveredDocuments, activeDocumentId, careerEvidence: [], jobApplications: [], interviewReviews: [] },
            version: 6,
          });
          validatePersistedLibrary(recoveredValue);
          unlockStorageWrites();
          window.localStorage.setItem(RESUME_STORAGE_KEY, recoveredValue);
          window.localStorage.removeItem(RESUME_RECOVERY_KEY);
          lockStorageWrites();
          clearPendingRecovery();
          set({ recoveryAvailable: false, recoveryReason: null, storageError: null });
          queueMicrotask(() => void useResumeStore.persist.rehydrate());
          return true;
        } catch {
          lockStorageWrites();
          return false;
        }
      },
      clearCorruptStorage: () => {
        unlockStorageWrites();
        window.localStorage.removeItem(RESUME_RECOVERY_KEY);
        window.localStorage.removeItem(RESUME_STORAGE_KEY);
        clearPendingRecovery();
        const document = createEmptyDocument();
        set({
          documents: [document], activeDocumentId: document.id, recoveryAvailable: false,
          recoveryReason: null, storageError: null, dirtyScope: null,
          ...workingStateFromDocument(document),
        });
        lockStorageWrites();
      },

      importDocuments: (documents, mode, evidence = [], applications = [], reviews = []) =>
        set((state) => {
          if (documents.length === 0) return state;
          const idMap = new Map<string, string>();
          const applicationIdMap = new Map<string, string>();
          const imported = documents.map((document) => {
            const nextId = mode === "merge" ? createId() : document.id;
            idMap.set(document.id, nextId);
            return migrateDocument({
              ...structuredClone(document),
              id: nextId,
              title: mode === "merge" ? `${document.title} · 导入副本` : document.title,
              updatedAt: nowISO(),
            });
          });
          const importedEvidence = evidence.map((item) => ({
            ...structuredClone(item),
            id: mode === "merge" ? createId() : item.id,
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
          return {
            documents: mode === "replace" ? imported : [...state.documents, ...imported],
            careerEvidence: mode === "replace" ? importedEvidence : [...state.careerEvidence, ...importedEvidence],
            jobApplications: mode === "replace" ? importedApplications : [...state.jobApplications, ...importedApplications],
            interviewReviews: mode === "replace" ? importedReviews : [...state.interviewReviews, ...importedReviews],
            activeDocumentId: active.id,
            ...workingStateFromDocument(active),
          };
        }),

      addCareerEvidence: (evidence) =>
        set((state) => {
          const timestamp = nowISO();
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
        set((state) => ({
          careerEvidence: state.careerEvidence.map((item) =>
            item.id === id ? { ...item, ...patch, id: item.id, updatedAt: nowISO() } : item
          ),
        })),

      deleteCareerEvidence: (id) =>
        set((state) => ({
          careerEvidence: state.careerEvidence.filter((item) => item.id !== id),
        })),

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
          const active = getActiveDocument(state);
          const title =
            active.title === "未命名简历" && userInput.targetRole.trim()
              ? suggestedTitle(userInput)
              : active.title;
          return updateActiveDocument(state, {
            userInput,
            title,
            finalResumeStatus: state.analysisResult ? "stale" : "draft",
          });
        }),

      setImportedResume: (text, sourceResume, metadata) =>
        set((state) => {
          const normalizedSource = sourceResume
            ? normalizeFinalResumeBullets(sourceResume, "imported")
            : null;
          const active = getActiveDocument(state);
          const candidates = normalizedSource
            ? buildEvidenceCandidates(normalizedSource, active.id)
            : [];
          const retained = state.careerEvidence.filter(
            (item) => !(item.sourceDocumentId === active.id && item.status === "candidate")
          );
          return {
            ...updateActiveDocument(state, {
              userInput: { ...state.userInput, originalResume: text },
              sourceResume: normalizedSource,
              importMetadata: metadata,
              analysisResult: null,
              currentStep: "input",
              finalResumeStatus: "draft",
              hasManualEdits: false,
            }),
            careerEvidence: [...retained, ...candidates],
          };
        }),

      setLayoutConfig: (config) =>
        set((state) => updateActiveDocument(state, { layoutConfig: sanitizeLayoutConfig(config) })),

      loadExampleData: () =>
        set((state) =>
          updateActiveDocument(state, {
            title: suggestedTitle(EXAMPLE_USER_INPUT),
            userInput: { ...EXAMPLE_USER_INPUT },
            analysisResult: null,
            sourceResume: null,
            importMetadata: null,
            currentStep: "input",
            finalResumeStatus: "draft",
            hasManualEdits: false,
          })
        ),

      setCurrentStep: (step) =>
        set((state) => {
          if (step === state.currentStep) return state;
          if (!confirmUnsavedChanges(state)) return state;
          return { ...updateActiveDocument(state, { currentStep: step }), dirtyScope: null };
        }),

      setAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),

      setAnalysisResult: (result) =>
        set((state) => {
          const active = getActiveDocument(state);
          return {
            ...updateActiveDocument(state, {
              title:
                active.title === "未命名简历"
                  ? suggestedTitle(state.userInput)
                  : active.title,
              analysisResult: { ...result, finalResume: normalizeFinalResumeBullets(result.finalResume, "ai-generated", state.careerEvidence) },
              finalResumeStatus: "draft",
              hasManualEdits: false,
            }),
            analysisError: null,
          };
        }),

      setOptimizedItems: (items) =>
        set((state) => {
          if (!state.analysisResult) return state;
          return updateActiveDocument(state, {
            analysisResult: { ...state.analysisResult, optimizedItems: items },
            finalResumeStatus: "stale",
          });
        }),

      setFinalResume: (resume, options) =>
        set((state) => {
          if (!state.analysisResult) return state;
          return updateActiveDocument(state, {
            analysisResult: { ...state.analysisResult, finalResume: normalizeFinalResumeBullets(resume, options?.manual ? "manual" : "ai-generated", state.careerEvidence) },
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

      setFollowUpBullet: (id, bullet) =>
        set((state) => {
          if (!state.analysisResult) return state;
          const question = state.analysisResult.followUpQuestions.find((item) => item.id === id);
          const timestamp = nowISO();
          const candidate: CareerEvidence | null = question
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
                createdAt: timestamp,
                updatedAt: timestamp,
              }
            : null;
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
            careerEvidence: candidate ? [...state.careerEvidence, candidate] : state.careerEvidence,
          };
        }),

      getStepStatus: (step) => {
        const { currentStep, analysisResult } = get();
        const stepIndex = WORKFLOW_STEPS.findIndex((item) => item.id === step);
        const currentIndex = WORKFLOW_STEPS.findIndex(
          (item) => item.id === currentStep
        );

        if (step === "evidence") {
          if (currentStep === "evidence") return "active";
          return get().careerEvidence.some((item) => item.status === "confirmed") ? "completed" : "pending";
        }

        if (step === "input") {
          if (currentStep === "input") return "active";
          return analysisResult ? "completed" : "pending";
        }

        if (!analysisResult) return "disabled";
        if (stepIndex < currentIndex) return "completed";
        if (stepIndex === currentIndex) return "active";
        return "pending";
      },

      setCopied: (copied) => set({ copied }),
    }),
    {
      name: RESUME_STORAGE_KEY,
      version: 6,
      skipHydration: true,
      storage: createJSONStorage<ResumeLibraryState>(() => safeLocalStorage),
      partialize: (state) => ({
        schemaVersion: 6,
        documents: state.documents,
        activeDocumentId: state.activeDocumentId,
        careerEvidence: state.careerEvidence,
        jobApplications: state.jobApplications,
        interviewReviews: state.interviewReviews,
      }),
      migrate: (persistedState) => {
        const persisted = persistedState as Partial<ResumeLibraryState> & {
          documents?: LegacyResumeDocument[];
        };
        const documents = Array.isArray(persisted.documents)
          ? persisted.documents.map((document) => migrateDocument(document))
          : [];
        return {
          schemaVersion: 6,
          documents,
          activeDocumentId: persisted.activeDocumentId ?? documents[0]?.id ?? "",
          careerEvidence: Array.isArray(persisted.careerEvidence)
            ? persisted.careerEvidence
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
          careerEvidence: Array.isArray(persisted.careerEvidence) ? persisted.careerEvidence : [],
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
        state?.markHydrated();
      },
    }
  )
);
