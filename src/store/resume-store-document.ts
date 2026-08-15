import { getDefaultLayoutConfig } from "@/lib/templates/resume-templates";
import type { ResumeDocument, UserInput } from "@/types/resume";
import { defaultUserInput } from "@/store/resume-store-example";
import type { ResumeStore } from "@/store/resume-store.types";

export function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `resume-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

function dateLabel(): string {
  return new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function suggestedTitle(input: UserInput): string {
  return input.targetRole.trim()
    ? `${input.targetRole.trim()} · ${dateLabel()}`
    : "未命名简历";
}

export function createEmptyDocument(id = createId()): ResumeDocument {
  const timestamp = nowISO();
  return {
    schemaVersion: 10,
    id,
    title: "未命名简历",
    createdAt: timestamp,
    updatedAt: timestamp,
    userInput: { ...defaultUserInput },
    jobTargetContext: { companyName: "", notes: "", companySnapshotId: null },
    currentStep: "input",
    analysisResult: null,
    materialRevision: 0,
    analysisRevision: null,
    jdAnalysisDocument: null,
    analysisBasis: null,
    sourceResume: null,
    importedResume: null,
    importMetadata: null,
    layoutConfig: getDefaultLayoutConfig(),
    optimizeStyle: "ai-product",
    finalResumeStatus: "draft",
    hasManualEdits: false,
  };
}

export function workingStateFromDocument(document: ResumeDocument) {
  return {
    userInput: document.userInput,
    jobTargetContext: document.jobTargetContext,
    currentStep: document.currentStep,
    analysisResult: document.analysisResult,
    materialRevision: document.materialRevision,
    analysisRevision: document.analysisRevision,
    jdAnalysisDocument: document.jdAnalysisDocument,
    analysisBasis: document.analysisBasis,
    sourceResume: document.sourceResume,
    importedResume: document.importedResume,
    importMetadata: document.importMetadata,
    layoutConfig: document.layoutConfig,
    optimizeStyle: document.optimizeStyle,
    finalResumeStatus: document.finalResumeStatus,
    hasManualEdits: document.hasManualEdits,
    analysisError: null,
    copied: false,
  };
}

export function getActiveDocument(state: ResumeStore): ResumeDocument {
  return (
    state.documents.find((document) => document.id === state.activeDocumentId) ??
    state.documents[0]
  );
}

export function updateActiveDocument(
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
