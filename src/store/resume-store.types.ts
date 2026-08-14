import type {
  AnalysisResult,
  CareerEvidence,
  ResumeEvidenceLinkStatus,
  FinalResumeStatus,
  FinalResume,
  JobApplication,
  JobTargetContext,
  OptimizeStyle,
  ResumeImportMetadata,
  ResumeLayoutConfig,
  ResumeDocument,
  StepId,
  StepStatus,
  UserInput,
} from "@/types/resume";
import type { AIMode } from "@/lib/ai/types";
import type { InterviewReviewRecord } from "@/types/interview";

export type UnsavedScope = "resume" | "layout" | "career";

export interface StorageRecoveryReport {
  documents: number;
  careerEvidence: number;
  jobApplications: number;
  interviewReviews: number;
  skipped: number;
  warnings: string[];
}

export interface ResumeStore {
  documents: ResumeDocument[];
  activeDocumentId: string;
  careerEvidence: CareerEvidence[];
  jobApplications: JobApplication[];
  interviewReviews: InterviewReviewRecord[];
  hasHydrated: boolean;
  storageError: string | null;
  recoveryAvailable: boolean;
  recoveryReason: string | null;
  recoveryReport: StorageRecoveryReport | null;
  dirtyScope: UnsavedScope | null;

  userInput: UserInput;
  jobTargetContext: JobTargetContext;
  currentStep: StepId;
  isAnalyzing: boolean;
  analysisResult: AnalysisResult | null;
  materialRevision: number;
  analysisRevision: number | null;
  sourceResume: FinalResume | null;
  importMetadata: ResumeImportMetadata | null;
  layoutConfig: ResumeLayoutConfig;
  analysisError: string | null;
  aiMode: AIMode | null;
  optimizeStyle: OptimizeStyle;
  finalResumeStatus: FinalResumeStatus;
  hasManualEdits: boolean;
  copied: boolean;

  createDocument: () => void;
  duplicateDocument: () => void;
  renameDocument: (title: string) => void;
  deleteDocument: (id?: string) => void;
  selectDocument: (id: string) => void;
  setStorageError: (error: string | null) => void;
  markHydrated: () => void;
  setDirtyScope: (scope: UnsavedScope | null) => void;
  attemptStorageRecovery: () => StorageRecoveryReport | null;
  confirmStorageRecovery: () => void;
  clearCorruptStorage: () => void;
  importDocuments: (documents: ResumeDocument[], mode: "merge" | "replace", evidence?: CareerEvidence[], applications?: JobApplication[], reviews?: InterviewReviewRecord[], preserveEvidenceIds?: boolean) => void;
  addCareerEvidence: (evidence: Omit<CareerEvidence, "id" | "createdAt" | "updatedAt">) => void;
  confirmCareerEvidence: (id: string) => void;
  updateCareerEvidence: (id: string, patch: Partial<CareerEvidence>) => void;
  deleteCareerEvidence: (id: string) => void;
  setResumeEvidenceLinkStatus: (bulletId: string, evidenceId: string, status: ResumeEvidenceLinkStatus | "removed") => void;
  addJobApplication: (application: Omit<JobApplication, "id" | "createdAt" | "updatedAt">) => void;
  updateJobApplication: (id: string, patch: Partial<JobApplication>) => void;
  deleteJobApplication: (id: string) => void;
  saveInterviewReview: (review: Omit<InterviewReviewRecord, "id" | "createdAt" | "updatedAt">) => void;
  deleteInterviewReview: (id: string) => void;
  unlinkInterviewRecording: (recordingId: string) => void;

  setUserInput: (input: Partial<UserInput>) => void;
  setJobTargetContext: (input: Partial<JobTargetContext>) => void;
  setFollowUpGuidance: (id: string, example: string) => void;
  openFollowUpForRequirement: (requirementId: string) => void;
  focusedRequirementId: string | null;
  setImportedResume: (text: string, sourceResume: FinalResume | null, metadata: ResumeImportMetadata) => void;
  setLayoutConfig: (config: ResumeLayoutConfig) => void;
  loadExampleData: () => boolean;
  setCurrentStep: (step: StepId) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setAnalysisResult: (result: AnalysisResult, expectedMaterialRevision: number) => boolean;
  setOptimizedItems: (items: AnalysisResult["optimizedItems"]) => void;
  setInterviewPrep: (prep: AnalysisResult["interviewPrep"], expectedMaterialRevision: number) => boolean;
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
