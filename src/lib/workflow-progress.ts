import type { AnalysisResult, FinalResumeStatus, StepId, UserInput } from "@/types/resume";

export type WorkflowStageId = "materials" | "analysis" | "creation" | "delivery";
export type WorkflowStageStatus = "pending" | "active" | "completed" | "blocked";

export interface WorkflowStageProgress {
  id: WorkflowStageId;
  status: WorkflowStageStatus;
  blocker: string | null;
  nextStep: StepId;
  actionLabel: string;
}

interface ProgressInput {
  currentStep: StepId;
  userInput: UserInput;
  analysisResult: AnalysisResult | null;
  finalResumeStatus: FinalResumeStatus;
  materialRevision?: number;
  analysisRevision?: number | null;
}

const STAGE_STEPS: Record<WorkflowStageId, StepId[]> = {
  materials: ["input", "evidence"],
  analysis: ["jd-analysis", "diagnosis", "match", "follow-up", "interview"],
  creation: ["optimize", "final-resume"],
  delivery: ["applications", "export"],
};

export function getWorkflowProgress(input: ProgressInput): WorkflowStageProgress[] {
  const missingMaterials = [
    !input.userInput.targetRole.trim() && "目标岗位",
    !input.userInput.jobDescription.trim() && "目标 JD",
    !input.userInput.originalResume.trim() && "原始简历",
  ].filter(Boolean) as string[];
  const materialsReady = missingMaterials.length === 0;
  const analysisReady = Boolean(input.analysisResult) &&
    (input.materialRevision === undefined || input.analysisRevision === input.materialRevision);
  const finalReady = Boolean(input.analysisResult?.finalResume) && input.finalResumeStatus === "confirmed";

  const active = (id: WorkflowStageId) => STAGE_STEPS[id].includes(input.currentStep);
  const progress: WorkflowStageProgress[] = [
    {
      id: "materials",
      status: active("materials") ? "active" : materialsReady ? "completed" : "blocked",
      blocker: missingMaterials.length ? `还缺：${missingMaterials.join("、")}` : null,
      nextStep: missingMaterials.length ? "input" : "evidence",
      actionLabel: missingMaterials.length ? "补齐材料" : "核对证据",
    },
    {
      id: "analysis",
      status: active("analysis") ? (materialsReady ? "active" : "blocked") : analysisReady ? "completed" : "pending",
      blocker: materialsReady
        ? analysisReady
          ? null
          : input.analysisResult
            ? "材料已变化，旧分析已锁定，请重新分析"
            : "需要先运行岗位分析"
        : "材料未齐，暂不能分析",
      nextStep: analysisReady ? "jd-analysis" : "input",
      actionLabel: analysisReady ? "查看分析" : input.analysisResult ? "重新分析" : "开始分析",
    },
    {
      id: "creation",
      status: active("creation") ? (analysisReady ? "active" : "blocked") : finalReady ? "completed" : "pending",
      blocker: !analysisReady
        ? "尚无分析结果"
        : input.finalResumeStatus === "draft"
          ? "最终简历尚未生成确认"
          : input.finalResumeStatus === "stale"
            ? "最终简历未应用最新补证、材料或风格"
            : null,
      nextStep: finalReady ? "final-resume" : "optimize",
      actionLabel: finalReady ? "编辑与排版" : input.finalResumeStatus === "stale" ? "重新生成" : "生成最终简历",
    },
    {
      id: "delivery",
      status: active("delivery") ? (finalReady ? "active" : "blocked") : "pending",
      blocker: finalReady ? null : "最终简历未就绪，暂不能导出",
      nextStep: finalReady ? "applications" : analysisReady ? "optimize" : "input",
      actionLabel: finalReady ? "ATS 与导出" : "解决阻塞",
    },
  ];
  return progress;
}

export function workflowStageForStep(step: StepId): WorkflowStageId | "interview-review" {
  if (step === "interview-recording") return "interview-review";
  return (Object.entries(STAGE_STEPS).find(([, steps]) => steps.includes(step))?.[0] ?? "materials") as WorkflowStageId;
}
