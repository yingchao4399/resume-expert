"use client";

import {
  Brain,
  Check,
  Circle,
  ClipboardList,
  Download,
  FileSearch,
  FileText,
  GitCompare,
  Database,
  Mic,
  MessageSquare,
  Sparkles,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useResumeStore } from "@/store/resume-store";
import type { StepId } from "@/types/resume";
import { WORKFLOW_GROUPS } from "@/config/workflow";

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

const STEPS = WORKFLOW_GROUPS.flatMap((group) =>
  group.steps.map((step) => ({
    ...step,
    groupId: group.id,
    groupLabel: group.label,
    icon: STEP_ICONS[step.id],
  }))
);

export function StepSidebar() {
  const { setCurrentStep, getStepStatus, analysisResult } = useResumeStore();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">求职工作台</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;
          const isDisabled = status === "disabled";
          const isGroupStart = index === 0 || STEPS[index - 1].groupId !== step.groupId;


          return (
            <div key={step.id} className={isGroupStart && index > 0 ? "mt-4" : ""}>
              {isGroupStart && (
                <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-neutral-400">{step.groupLabel}</p>
              )}
              <button
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) setCurrentStep(step.id);
              }}
              className={cn(
                "mb-0.5 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors",
                status === "active" && "bg-neutral-100 text-neutral-900",
                status === "completed" && "text-neutral-600 hover:bg-neutral-50",
                status === "pending" && "text-neutral-500 hover:bg-neutral-50",
                status === "disabled" && "cursor-not-allowed text-neutral-300"
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {status === "completed" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : status === "active" ? (
                  <Icon className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </span>
              <span className="flex-1 truncate">{step.label}</span>
              <span className="text-[10px] tabular-nums text-neutral-400">{step.groupId === "resume" ? index + 1 : "独立"}</span>
            </button>
            </div>
          );
        })}
      </nav>
      {analysisResult && (
        <div className="border-t border-neutral-200 p-3">
          <p className="text-xs text-neutral-400">整体匹配度</p>
          <p className="text-2xl font-semibold tabular-nums text-neutral-900">
            {analysisResult.diagnosis.overallScore}
            <span className="text-sm font-normal text-neutral-400">/100</span>
          </p>
        </div>
      )}
    </aside>
  );
}
