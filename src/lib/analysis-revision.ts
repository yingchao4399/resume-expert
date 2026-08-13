import type { AnalysisResult, ResumeDocument } from "@/types/resume";

export interface AnalysisRevisionState {
  analysisResult: AnalysisResult | null;
  materialRevision: number;
  analysisRevision: number | null;
}

export function isAnalysisFresh(state: AnalysisRevisionState): boolean {
  return Boolean(
    state.analysisResult &&
      state.analysisRevision !== null &&
      state.analysisRevision === state.materialRevision
  );
}

export function isDocumentAnalysisFresh(document: ResumeDocument): boolean {
  return isAnalysisFresh(document);
}
