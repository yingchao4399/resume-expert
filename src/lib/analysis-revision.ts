import type { AnalysisResult, ResumeDocument } from "@/types/resume";
import type { JDAnalysisDocument } from "@/types/jd-analysis";

export interface AnalysisRevisionState {
  analysisResult: AnalysisResult | null;
  materialRevision: number;
  analysisRevision: number | null;
  jdAnalysisDocument?: JDAnalysisDocument | null;
  analysisBasis?: { materialRevision: number; jdAnalysisRevision: number } | null;
}

export function isAnalysisFresh(state: AnalysisRevisionState): boolean {
  if (state.analysisBasis) {
    return Boolean(
      state.analysisResult &&
      state.jdAnalysisDocument?.status === "confirmed" &&
      state.analysisBasis.materialRevision === state.materialRevision &&
      state.analysisBasis.jdAnalysisRevision === state.jdAnalysisDocument.revision
    );
  }
  return Boolean(
    state.analysisResult &&
      state.analysisRevision !== null &&
      state.analysisRevision === state.materialRevision
  );
}

export function isDocumentAnalysisFresh(document: ResumeDocument): boolean {
  return isAnalysisFresh(document);
}
