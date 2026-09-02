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
import type { StepId } from "@/types/resume";
import { cn } from "@/lib/utils";

const ANALYSIS_RESULT_STEPS = new Set(["jd-analysis", "diagnosis", "match", "follow-up", "interview"]);

export function StepContent() {
  const { currentStep, analysisResult, materialRevision, analysisRevision, setCurrentStep, getStepStatus } = useResumeStore();

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
  const tabs: Array<{ id: StepId; label: string }> = ["jd-analysis", "diagnosis", "match", "follow-up"].includes(currentStep)
    ? [{ id: "jd-analysis", label: "需求地图" }, { id: "diagnosis", label: "准备度" }, { id: "match", label: "逐条匹配" }, { id: "follow-up", label: "可选补证" }]
    : ["optimize", "final-resume"].includes(currentStep)
      ? [{ id: "optimize", label: "优化方案" }, { id: "final-resume", label: "最终编辑与模板" }]
      : [];
  return <>{tabs.length > 0 && <nav aria-label="阶段内工作区" className="mb-5 flex flex-wrap gap-2 rounded-lg border bg-white p-2">
    {tabs.map((tab) => { const disabled = getStepStatus(tab.id) === "disabled"; return <button key={tab.id} type="button" disabled={disabled} onClick={() => setCurrentStep(tab.id)} className={cn("rounded-md px-3 py-2 text-sm", currentStep === tab.id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100", disabled && "cursor-not-allowed opacity-40")}>{tab.label}</button>; })}
  </nav>}{staleBanner}{content}</>;
}
