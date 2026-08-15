import type { AnalysisResult, FinalResumeStatus, StepId, UserInput } from "@/types/resume";
import type { JDAnalysisDocument } from "@/types/jd-analysis";

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
  jdAnalysisDocument?: JDAnalysisDocument | null;
  analysisBasis?: { materialRevision: number; jdAnalysisRevision: number } | null;
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
  const jdReady = Boolean(input.jdAnalysisDocument && input.jdAnalysisDocument.materialRevision === input.materialRevision && input.jdAnalysisDocument.status !== "stale");
  const analysisReady = Boolean(input.analysisResult) && (input.analysisBasis
    ? input.analysisBasis.materialRevision === input.materialRevision && input.analysisBasis.jdAnalysisRevision === input.jdAnalysisDocument?.revision
    : input.materialRevision === undefined || input.analysisRevision === input.materialRevision);
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
          : !jdReady
            ? input.jdAnalysisDocument
              ? "材料已变化，旧需求地图已锁定，请重新解析 JD"
              : input.analysisResult
                ? "旧分析已锁定，请重新解析 JD 并确认需求地图"
                : "需要先解析 JD"
            : input.jdAnalysisDocument?.status !== "confirmed"
              ? "需求地图尚未确认"
              : "需求地图已确认，等待匹配真实经历"
        : "材料未齐，暂不能分析",
      nextStep: materialsReady && jdReady ? "jd-analysis" : "input",
      actionLabel: analysisReady ? "查看分析" : !jdReady ? "解析 JD" : input.jdAnalysisDocument?.status !== "confirmed" ? "审核需求地图" : "匹配真实经历",
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
