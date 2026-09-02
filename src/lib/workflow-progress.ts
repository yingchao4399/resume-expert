import type { AnalysisResult, FinalResumeStatus, StepId, UserInput } from "@/types/resume";
import type { JDAnalysisDocument } from "@/types/jd-analysis";
import type { WorkflowNode } from "@/lib/studio/workflow-types";

export type WorkflowStageId = "materials" | "analysis" | "creation" | "delivery";
export type WorkflowStageStatus = "pending" | "active" | "completed" | "blocked";

export interface WorkflowStageProgress {
  id: WorkflowStageId;
  status: WorkflowStageStatus;
  blocker: string | null;
  nextStep: StepId;
  actionLabel: string;
}

export interface WorkflowNodeRuntimeState {
  status: "pending" | "active" | "completed" | "blocked" | "optional";
  blocker: string | null;
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
  materials: ["input"],
  analysis: ["jd-analysis", "diagnosis", "match", "follow-up"],
  creation: ["optimize", "final-resume"],
  delivery: ["export"],
};

const OPTIONAL_TOOL_CONTEXT: Partial<Record<StepId, WorkflowStageId>> = {
  evidence: "materials",
  interview: "analysis",
  applications: "delivery",
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
      nextStep: "input",
      actionLabel: missingMaterials.length ? "补齐材料" : "查看材料",
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
      nextStep: materialsReady ? "jd-analysis" : "input",
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
      nextStep: finalReady ? "export" : analysisReady ? "optimize" : "input",
      actionLabel: finalReady ? "ATS 与导出" : "解决阻塞",
    },
  ];
  return progress;
}

export function workflowStageForStep(step: StepId): WorkflowStageId | "interview-review" {
  if (step === "interview-recording") return "interview-review";
  return OPTIONAL_TOOL_CONTEXT[step]
    ?? (Object.entries(STAGE_STEPS).find(([, steps]) => steps.includes(step))?.[0] ?? "materials") as WorkflowStageId;
}

/**
 * Maps the persisted application state to the canonical Studio node IDs.
 * Keeping this mapping next to the stage progress prevents the Studio canvas
 * from inventing a second, divergent interpretation of the workflow.
 */
export function getWorkflowNodeRuntimeState(
  node: Pick<WorkflowNode, "id" | "optional">,
  input: ProgressInput,
): WorkflowNodeRuntimeState {
  const materialsReady = [input.userInput.targetRole, input.userInput.jobDescription, input.userInput.originalResume].every((value) => value.trim());
  const map = input.jdAnalysisDocument;
  const mapReady = Boolean(map && map.materialRevision === input.materialRevision && map.status !== "stale");
  const mapConfirmed = Boolean(mapReady && map?.status === "confirmed" && map.confirmedRevision === map.revision);
  const analysisReady = Boolean(input.analysisResult) && (input.analysisBasis
    ? input.analysisBasis.materialRevision === input.materialRevision && input.analysisBasis.jdAnalysisRevision === map?.revision
    : input.materialRevision === undefined || input.analysisRevision === input.materialRevision);
  const finalReady = Boolean(input.analysisResult?.finalResume) && input.finalResumeStatus === "confirmed";
  const current = input.currentStep;
  const active = (...steps: StepId[]) => steps.includes(current);
  const optional = (blocker: string | null = null): WorkflowNodeRuntimeState => ({ status: node.optional ? "optional" : blocker ? "blocked" : "pending", blocker });
  switch (node.id) {
    case "start": return { status: "completed", blocker: null };
    case "materials-validation": return materialsReady ? { status: "completed", blocker: null } : { status: active("input") ? "active" : "blocked", blocker: "还缺少目标岗位、JD 或原始简历" };
    case "analysis": return !materialsReady ? { status: "blocked", blocker: "材料未齐" } : mapReady ? { status: "completed", blocker: null } : { status: active("jd-analysis") ? "active" : "pending", blocker: null };
    case "jd-consolidation": return !mapReady ? { status: "pending", blocker: "等待生成 JD 需求地图" } : map?.groups?.length ? { status: "completed", blocker: null } : { status: active("jd-analysis") ? "active" : "pending", blocker: "等待需求整理" };
    case "jd-confirmation": return !mapReady ? { status: "blocked", blocker: "需要先生成需求地图" } : mapConfirmed ? { status: "completed", blocker: null } : { status: active("jd-analysis") ? "active" : "blocked", blocker: "需求地图尚未确认" };
    case "fact-match": return !mapConfirmed ? { status: "blocked", blocker: "需求地图尚未确认" } : analysisReady ? { status: "completed", blocker: null } : { status: active("diagnosis", "match") ? "active" : "pending", blocker: null };
    case "interview-prep": return input.analysisResult?.interviewPrep?.requirementStrategies?.length ? { status: "completed", blocker: null } : optional("按需生成，不阻塞制作");
    case "supplement": return input.analysisResult?.followUpQuestions?.some((item) => item.decision === "answered" || item.decision === "verified-existing") ? { status: "completed", blocker: null } : optional("可选补证，不阻塞制作");
    case "evidence-confirmation": return optional("仅采用候选事实或增强内容时需要确认");
    case "optimize": return !analysisReady ? { status: "blocked", blocker: "尚无有效事实匹配结果" } : input.analysisResult?.optimizedItems?.length ? { status: "completed", blocker: null } : { status: active("optimize") ? "active" : "pending", blocker: null };
    case "final-resume-confirmation": return finalReady ? { status: "completed", blocker: null } : { status: active("final-resume") ? "active" : "pending", blocker: input.finalResumeStatus === "stale" ? "最终简历已过期" : null };
    case "export-gate": return finalReady ? { status: "completed", blocker: null } : { status: "blocked", blocker: "最终简历未确认" };
    case "end": return finalReady ? { status: "completed", blocker: null } : { status: "pending", blocker: null };
    default: return optional();
  }
}
