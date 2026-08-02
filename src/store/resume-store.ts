"use client";

import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import type {
  AnalysisResult,
  CareerEvidence,
  FinalResume,
  JobApplication,
  OptimizeStyle,
  ResumeImportMetadata,
  ResumeLayoutConfig,
  ResumeDocument,
  ResumeLibraryState,
  StepId,
  StepStatus,
  UserInput,
} from "@/types/resume";
import type { AIMode } from "@/lib/ai/types";
import type { InterviewReviewRecord } from "@/types/interview";
import { WORKFLOW_STEPS } from "@/config/workflow";
import { getDefaultLayoutConfig, sanitizeLayoutConfig } from "@/lib/templates/resume-templates";
import { buildEvidenceCandidates, normalizeFinalResumeBullets } from "@/lib/evidence/resume-evidence";

export const RESUME_STORAGE_KEY = "resume-expert-library";
export const RESUME_STORAGE_ERROR_EVENT = "resume-expert-storage-error";

interface ResumeStore {
  documents: ResumeDocument[];
  activeDocumentId: string;
  careerEvidence: CareerEvidence[];
  jobApplications: JobApplication[];
  interviewReviews: InterviewReviewRecord[];
  hasHydrated: boolean;
  storageError: string | null;

  userInput: UserInput;
  currentStep: StepId;
  isAnalyzing: boolean;
  analysisResult: AnalysisResult | null;
  sourceResume: FinalResume | null;
  importMetadata: ResumeImportMetadata | null;
  layoutConfig: ResumeLayoutConfig;
  analysisError: string | null;
  aiMode: AIMode | null;
  optimizeStyle: OptimizeStyle;
  isFinalResumeStale: boolean;
  hasManualEdits: boolean;
  copied: boolean;

  createDocument: () => void;
  duplicateDocument: () => void;
  renameDocument: (title: string) => void;
  deleteDocument: (id?: string) => void;
  selectDocument: (id: string) => void;
  setStorageError: (error: string | null) => void;
  markHydrated: () => void;
  importDocuments: (documents: ResumeDocument[], mode: "merge" | "replace", evidence?: CareerEvidence[], applications?: JobApplication[], reviews?: InterviewReviewRecord[]) => void;
  addCareerEvidence: (evidence: Omit<CareerEvidence, "id" | "createdAt" | "updatedAt">) => void;
  confirmCareerEvidence: (id: string) => void;
  updateCareerEvidence: (id: string, patch: Partial<CareerEvidence>) => void;
  deleteCareerEvidence: (id: string) => void;
  addJobApplication: (application: Omit<JobApplication, "id" | "createdAt" | "updatedAt">) => void;
  updateJobApplication: (id: string, patch: Partial<JobApplication>) => void;
  deleteJobApplication: (id: string) => void;
  saveInterviewReview: (review: Omit<InterviewReviewRecord, "id" | "createdAt" | "updatedAt">) => void;
  deleteInterviewReview: (id: string) => void;

  setUserInput: (input: Partial<UserInput>) => void;
  setImportedResume: (text: string, sourceResume: FinalResume | null, metadata: ResumeImportMetadata) => void;
  setLayoutConfig: (config: ResumeLayoutConfig) => void;
  loadExampleData: () => void;
  setCurrentStep: (step: StepId) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setAnalysisResult: (result: AnalysisResult) => void;
  setOptimizedItems: (items: AnalysisResult["optimizedItems"]) => void;
  setFinalResume: (
    resume: AnalysisResult["finalResume"],
    options?: { manual?: boolean }
  ) => void;
  setAnalysisError: (error: string | null) => void;
  setAiMode: (mode: AIMode | null) => void;
  setOptimizeStyle: (style: OptimizeStyle) => void;
  updateFollowUpAnswer: (id: string, answer: string) => void;
  setFollowUpBullet: (id: string, bullet: string) => void;
  getStepStatus: (step: StepId) => StepStatus;
  setCopied: (copied: boolean) => void;
}

export const defaultUserInput: UserInput = {
  targetRole: "",
  industry: "",
  companyType: "中型公司",
  jobStage: "社招-中级",
  highlightSkills: "",
  jobDescription: "",
  originalResume: "",
  additionalInfo: "",
};

const EXAMPLE_USER_INPUT: UserInput = {
  targetRole: "AI 产品经理",
  industry: "企业服务 / SaaS / AI",
  companyType: "中型公司",
  jobStage: "转行",
  highlightSkills: "AI 产品规划、Prompt 设计、数据驱动、ToB 需求分析、跨团队协作",
  jobDescription: `【岗位职责】
1. 负责 AI 功能的产品规划与迭代，包括智能问答、文档理解、工作流自动化等模块
2. 深入理解 B 端客户业务场景，将 AI 能力转化为可落地的产品方案
3. 与算法、工程团队协作，推动 AI 功能从 POC 到规模化上线
4. 建立 AI 产品效果评估体系，通过数据驱动持续优化
5. 跟踪 AI 行业趋势，输出竞品分析与产品策略

【任职要求】
1. 3年以上产品经理经验，有 ToB SaaS 或企业服务产品经验
2. 了解 LLM 基本原理，有 AI 产品或智能化功能落地经验者优先
3. 具备优秀的需求分析和逻辑思维能力，能将复杂业务抽象为产品方案
4. 有数据报表、ERP/WMS 等系统产品经验者优先
5. 良好的跨部门沟通能力和项目管理能力
6. 本科及以上学历，计算机或相关专业优先`,
  originalResume: `张明 | 产品经理 | 3.5年经验

【个人信息】
电话：138****5678 | 邮箱：zhangming@email.com | 上海

【职业摘要】
3.5年 B 端产品经理经验，主导 ERP 库存管理、WMS 仓储系统及经营数据报表平台的产品设计与迭代。擅长需求调研、流程梳理与跨部门协作，具备从 0 到 1 搭建数据产品的经验。

【工作经历】
某 SaaS 公司 | 产品经理 | 2021.06 - 至今
• 负责 WMS 仓储管理系统核心模块，服务 50+ 企业客户
• 主导库存盘点功能重构，盘点效率提升 40%
• 设计经营数据报表平台，支持 20+ 自定义报表模板
• 协调研发、测试、实施团队，按时交付 3 个 major 版本

某软件公司 | 产品助理 | 2020.07 - 2021.05
• 参与 ERP 采购模块需求分析与原型设计
• 编写 PRD 文档，跟进开发进度与 UAT 测试
• 收集客户反馈，优化订单审批流程

【项目经历】
经营数据报表平台 | 产品负责人 | 2022.03 - 2023.06
• 从 0 到 1 搭建 BI 报表平台，覆盖销售、库存、财务三大主题
• 设计拖拽式报表配置器，降低业务人员使用门槛
• 上线后月活用户 200+，报表生成效率提升 60%

WMS 智能补货 | 产品经理 | 2023.01 - 2023.09
• 基于历史销售数据设计补货策略模型
• 推动补货建议功能上线，缺货率下降 25%

【技能】
Axure、Figma、SQL、Jira、Confluence、数据分析

【教育】
某大学 | 信息管理与信息系统 | 本科 | 2016-2020`,
  additionalInfo:
    "最近自学了 Prompt Engineering 和 LangChain 基础，做过一个内部文档问答 Demo。希望突出数据产品背景和 ToB 经验，弱化纯执行类描述。",
};

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `resume-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function dateLabel(): string {
  return new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function suggestedTitle(input: UserInput): string {
  return input.targetRole.trim()
    ? `${input.targetRole.trim()} · ${dateLabel()}`
    : "未命名简历";
}

export function createEmptyDocument(id = createId()): ResumeDocument {
  const timestamp = nowISO();
  return {
    schemaVersion: 4,
    id,
    title: "未命名简历",
    createdAt: timestamp,
    updatedAt: timestamp,
    userInput: { ...defaultUserInput },
    currentStep: "input",
    analysisResult: null,
    sourceResume: null,
    importMetadata: null,
    layoutConfig: getDefaultLayoutConfig(),
    optimizeStyle: "ai-product",
    isFinalResumeStale: false,
    hasManualEdits: false,
  };
}

function workingStateFromDocument(document: ResumeDocument) {
  return {
    userInput: document.userInput,
    currentStep: document.currentStep,
    analysisResult: document.analysisResult,
    sourceResume: document.sourceResume,
    importMetadata: document.importMetadata,
    layoutConfig: document.layoutConfig,
    optimizeStyle: document.optimizeStyle,
    isFinalResumeStale: document.isFinalResumeStale,
    hasManualEdits: document.hasManualEdits,
    analysisError: null,
    copied: false,
  };
}

function getActiveDocument(state: ResumeStore): ResumeDocument {
  return (
    state.documents.find((document) => document.id === state.activeDocumentId) ??
    state.documents[0]
  );
}

function updateActiveDocument(
  state: ResumeStore,
  patch: Partial<ResumeDocument>
): Partial<ResumeStore> {
  const active = getActiveDocument(state);
  const next: ResumeDocument = {
    ...active,
    ...patch,
    updatedAt: nowISO(),
  };

  return {
    documents: state.documents.map((document) =>
      document.id === next.id ? next : document
    ),
    ...workingStateFromDocument(next),
  };
}

function emitStorageError(message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(RESUME_STORAGE_ERROR_EVENT, { detail: message })
    );
  }
}

const safeLocalStorage: StateStorage = {
  getItem(name) {
    try {
      return window.localStorage.getItem(name);
    } catch {
      emitStorageError("无法读取浏览器本地数据，请检查隐私模式或存储权限。");
      return null;
    }
  },
  setItem(name, value) {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      emitStorageError("本地保存失败，浏览器存储空间可能已满。请先导出重要简历。");
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

function migrateDocument(document: Partial<ResumeDocument>): ResumeDocument {
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
  return {
    ...base,
    ...document,
    schemaVersion: 4,
    sourceResume,
    analysisResult,
    layoutConfig: sanitizeLayoutConfig(document.layoutConfig),
  } as ResumeDocument;
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

      ...workingStateFromDocument(initialDocument),
      isAnalyzing: false,
      aiMode: null,

      createDocument: () => {
        const document = createEmptyDocument();
        set((state) => ({
          documents: [...state.documents, document],
          activeDocumentId: document.id,
          ...workingStateFromDocument(document),
        }));
      },

      duplicateDocument: () =>
        set((state) => {
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
          return {
            activeDocumentId: document.id,
            ...workingStateFromDocument(document),
          };
        }),

      setStorageError: (error) => set({ storageError: error }),
      markHydrated: () => set({ hasHydrated: true }),

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
            isFinalResumeStale: Boolean(state.analysisResult),
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
              isFinalResumeStale: false,
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
            isFinalResumeStale: false,
            hasManualEdits: false,
          })
        ),

      setCurrentStep: (step) =>
        set((state) => updateActiveDocument(state, { currentStep: step })),

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
              isFinalResumeStale: false,
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
            isFinalResumeStale: true,
          });
        }),

      setFinalResume: (resume, options) =>
        set((state) => {
          if (!state.analysisResult) return state;
          return updateActiveDocument(state, {
            analysisResult: { ...state.analysisResult, finalResume: normalizeFinalResumeBullets(resume, options?.manual ? "manual" : "ai-generated", state.careerEvidence) },
            isFinalResumeStale: false,
            hasManualEdits: options?.manual === true,
          });
        }),

      setAnalysisError: (error) => set({ analysisError: error }),
      setAiMode: (mode) => set({ aiMode: mode }),

      setOptimizeStyle: (style) =>
        set((state) => updateActiveDocument(state, { optimizeStyle: style })),

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
            isFinalResumeStale: true,
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
              isFinalResumeStale: true,
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
      version: 5,
      skipHydration: true,
      storage: createJSONStorage<ResumeLibraryState>(() => safeLocalStorage),
      partialize: (state) => ({
        schemaVersion: 5,
        documents: state.documents,
        activeDocumentId: state.activeDocumentId,
        careerEvidence: state.careerEvidence,
        jobApplications: state.jobApplications,
        interviewReviews: state.interviewReviews,
      }),
      migrate: (persistedState) => {
        const persisted = persistedState as Partial<ResumeLibraryState> & {
          documents?: Array<Partial<ResumeDocument> & { schemaVersion?: number }>;
        };
        const documents = Array.isArray(persisted.documents)
          ? persisted.documents.map((document) => migrateDocument(document))
          : [];
        return {
          schemaVersion: 5,
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
