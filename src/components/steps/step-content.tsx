"use client";

import { useResumeStore } from "@/store/resume-store";
import { InputStep } from "@/components/steps/input-step";
import { EvidenceLibraryStep } from "@/components/steps/evidence-library-step";
import { JDAnalysisStep } from "@/components/steps/jd-analysis-step";
import { DiagnosisStep } from "@/components/steps/diagnosis-step";
import { MatchStep } from "@/components/steps/match-step";
import { FollowUpStep } from "@/components/steps/follow-up-step";
import { OptimizeStep } from "@/components/steps/optimize-step";
import { InterviewRecordingStep } from "@/components/steps/interview-recording-step";
import { FinalResumeStep } from "@/components/steps/final-resume-step";
import { InterviewStep } from "@/components/steps/interview-step";
import { ExportStep } from "@/components/steps/export-step";
import { ApplicationsStep } from "@/components/steps/applications-step";
import { isAnalysisFresh } from "@/lib/analysis-revision";

const ANALYSIS_RESULT_STEPS = new Set(["jd-analysis", "diagnosis", "match", "follow-up", "interview"]);

export function StepContent() {
  const { currentStep, analysisResult, materialRevision, analysisRevision, setCurrentStep } = useResumeStore();

  const staleBanner = analysisResult && !isAnalysisFresh({ analysisResult, materialRevision, analysisRevision }) && ANALYSIS_RESULT_STEPS.has(currentStep) ? (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
      <span>这是修改材料前的旧分析，仅供查看；补证、制作和交付已锁定。</span>
      <button type="button" className="font-medium underline" onClick={() => setCurrentStep("input")}>返回重新分析</button>
    </div>
  ) : null;

  let content: React.ReactNode;

  switch (currentStep) {
    case "input":
      content = <InputStep />; break;
    case "evidence":
      content = <EvidenceLibraryStep />; break;
    case "jd-analysis":
      content = <JDAnalysisStep />; break;
    case "diagnosis":
      content = <DiagnosisStep />; break;
    case "match":
      content = <MatchStep />; break;
    case "follow-up":
      content = <FollowUpStep />; break;
    case "optimize":
      content = <OptimizeStep />; break;
    case "interview-recording":
      content = <InterviewRecordingStep />; break;
    case "final-resume":
      content = <FinalResumeStep />; break;
    case "interview":
      content = <InterviewStep />; break;
    case "applications":
      content = <ApplicationsStep />; break;
    case "export":
      content = <ExportStep />; break;
    default:
      content = <InputStep />;
  }
  return <>{staleBanner}{content}</>;
}
