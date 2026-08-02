"use client";

import {
  Brain,
  Check,
  Circle,
  ClipboardList,
  Database,
  Download,
  FileSearch,
  FileText,
  GitCompare,
  LockKeyhole,
  Mic,
  MessageSquare,
  Sparkles,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useResumeStore } from "@/store/resume-store";
import type { StepId } from "@/types/resume";
import { INTERVIEW_REVIEW_STEPS, WORKFLOW_STAGES } from "@/config/workflow";
import { getWorkflowProgress, type WorkflowStageStatus } from "@/lib/workflow-progress";

const STEP_ICONS: Record<StepId, React.ElementType> = {
  input: FileText,
  evidence: Database,
  "jd-analysis": FileSearch,
  diagnosis: Target,
  match: GitCompare,
  "follow-up": MessageSquare,
  optimize: Sparkles,
  "final-resume": ClipboardList,
  interview: Brain,
  export: Download,
  "interview-recording": Mic,
};

const STATUS_LABELS: Record<WorkflowStageStatus, string> = {
  pending: "待开始",
  active: "进行中",
  completed: "已完成",
  blocked: "有阻塞",
};

export function StepSidebar() {
  const {
    setCurrentStep,
    getStepStatus,
    analysisResult,
    userInput,
    currentStep,
    isFinalResumeStale,
  } = useResumeStore();
  const progress = getWorkflowProgress({ currentStep, userInput, analysisResult, isFinalResumeStale });
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
              {stage.steps.map((step, stepIndex) => {
                const status = getStepStatus(step.id);
                const Icon = STEP_ICONS[step.id];
                const isDisabled = status === "disabled";
                return (
                  <button
                    key={step.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => !isDisabled && setCurrentStep(step.id)}
                    className={cn(
                      "mb-0.5 flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                      status === "active" && "bg-neutral-100 text-neutral-900",
                      status === "completed" && "text-neutral-600 hover:bg-neutral-50",
                      status === "pending" && "text-neutral-500 hover:bg-neutral-50",
                      status === "disabled" && "cursor-not-allowed text-neutral-300"
                    )}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {status === "completed" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : status === "active" ? <Icon className="h-3.5 w-3.5" /> : isDisabled ? <LockKeyhole className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 truncate">{step.label}</span>
                    <span className="text-[10px] tabular-nums text-neutral-400">{stageIndex + 1}.{stepIndex + 1}</span>
                  </button>
                );
              })}
            </section>
          );
        })}

        <section className="mt-4 border-t border-neutral-200 pt-3">
          <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-neutral-400">独立模块 · 面试复盘</p>
          {INTERVIEW_REVIEW_STEPS.map((step) => {
            const Icon = STEP_ICONS[step.id];
            const active = currentStep === step.id;
            return <button key={step.id} type="button" onClick={() => setCurrentStep(step.id)} className={cn("flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-50", active && "bg-neutral-100 text-neutral-900")}>
              <Icon className="h-3.5 w-3.5" /><span className="flex-1">{step.label}</span><span className="text-[10px] text-neutral-400">独立</span>
            </button>;
          })}
        </section>
      </nav>
      {analysisResult && (
        <div className="border-t border-neutral-200 p-3">
          <p className="text-xs text-neutral-400">ATS 就绪度参考</p>
          <p className="text-2xl font-semibold tabular-nums text-neutral-900">{analysisResult.diagnosis.overallScore}<span className="text-sm font-normal text-neutral-400">/100</span></p>
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