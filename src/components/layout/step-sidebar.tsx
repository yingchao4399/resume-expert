"use client";

import { useMemo } from "react";

import {
  Brain,
  BriefcaseBusiness,
  Check,
  Circle,
  Database,
  LockKeyhole,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useResumeStore } from "@/store/resume-store";
import { INTERVIEW_REVIEW_STEPS, WORKFLOW_STAGES } from "@/config/workflow";
import { getWorkflowProgress, type WorkflowStageStatus } from "@/lib/workflow-progress";
import { calculateATSAssessment } from "@/lib/ats";
import { isAnalysisFresh } from "@/lib/analysis-revision";

const STATUS_LABELS: Record<WorkflowStageStatus, string> = {
  pending: "待开始",
  active: "进行中",
  completed: "已完成",
  blocked: "有阻塞",
};

export function StepSidebar() {
  const {
    setCurrentStep,
    analysisResult,
    userInput,
    currentStep,
    finalResumeStatus,
    materialRevision,
    analysisRevision,
    jdAnalysisDocument,
    analysisBasis,
  } = useResumeStore();
  const progress = getWorkflowProgress({ currentStep, userInput, analysisResult, finalResumeStatus, materialRevision, analysisRevision, jdAnalysisDocument, analysisBasis });
  const atsAssessment = useMemo(
    () => (finalResumeStatus === "confirmed" && isAnalysisFresh({ analysisResult, materialRevision, analysisRevision, jdAnalysisDocument, analysisBasis }) ? calculateATSAssessment(userInput, analysisResult!) : null),
    [analysisResult, userInput, finalResumeStatus, materialRevision, analysisRevision, jdAnalysisDocument, analysisBasis]
  );
  const progressById = new Map(progress.map((item) => [item.id, item]));

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">证据驱动求职工作台</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {WORKFLOW_STAGES.map((stage, stageIndex) => {
          const stageProgress = progressById.get(stage.id)!;
          return (
            <section key={stage.id} className={cn(stageIndex > 0 && "mt-3")}>
              <button
                type="button"
                className="mb-1 w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-left hover:bg-neutral-100"
                onClick={() => setCurrentStep(stageProgress.nextStep)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
                    <StageStatusIcon status={stageProgress.status} />
                    {stageIndex + 1}. {stage.label}
                  </span>
                  <span className={cn(
                    "text-[10px]",
                    stageProgress.status === "completed" && "text-emerald-600",
                    stageProgress.status === "blocked" && "text-amber-700",
                    stageProgress.status === "active" && "text-blue-600",
                    stageProgress.status === "pending" && "text-neutral-400"
                  )}>{STATUS_LABELS[stageProgress.status]}</span>
                </div>
                <p className="mt-1 text-[10px] text-neutral-500">{stageProgress.blocker ?? stage.description}</p>
                <p className="mt-1 text-[10px] font-medium text-neutral-600">下一步：{stageProgress.actionLabel}</p>
              </button>
            </section>
          );
        })}

        <section className="mt-4 border-t border-neutral-200 pt-3">
          <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-neutral-400">按需工具 · 不阻塞主流程</p>
          {[
            { id: "evidence" as const, label: "经历证据库", Icon: Database },
            { id: "interview" as const, label: "面试准备", Icon: Brain },
            { id: "applications" as const, label: "投递管理", Icon: BriefcaseBusiness },
          ].map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => setCurrentStep(id)} className={cn("flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-50", currentStep === id && "bg-neutral-100 text-neutral-900")}>
            <Icon className="h-3.5 w-3.5" /><span className="flex-1">{label}</span><span className="text-[10px] text-neutral-400">按需</span>
          </button>)}
          {INTERVIEW_REVIEW_STEPS.map((step) => {
            const Icon = Mic;
            const active = currentStep === step.id;
            return <button key={step.id} type="button" onClick={() => setCurrentStep(step.id)} className={cn("flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-50", active && "bg-neutral-100 text-neutral-900")}>
              <Icon className="h-3.5 w-3.5" /><span className="flex-1">{step.label}</span><span className="text-[10px] text-neutral-400">独立</span>
            </button>;
          })}
        </section>
      </nav>
      {atsAssessment && (
        <div className="border-t border-neutral-200 p-3">
          <p className="text-xs text-neutral-400">ATS 就绪度参考</p>
          <p data-testid="sidebar-ats-score" className="text-2xl font-semibold tabular-nums text-neutral-900">{atsAssessment.overallScore}<span className="text-sm font-normal text-neutral-400">/100</span></p>
        </div>
      )}
    </aside>
  );
}

function StageStatusIcon({ status }: { status: WorkflowStageStatus }) {
  if (status === "completed") return <Check className="h-3.5 w-3.5 text-emerald-600" />;
  if (status === "blocked") return <LockKeyhole className="h-3.5 w-3.5 text-amber-700" />;
  if (status === "active") return <Circle className="h-3.5 w-3.5 fill-blue-100 text-blue-600" />;
  return <Circle className="h-3.5 w-3.5 text-neutral-300" />;
}
