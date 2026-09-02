import type { StepId } from "@/types/resume";
import type { WorkflowStageId } from "@/lib/workflow-progress";

export interface WorkflowStageConfig {
  id: WorkflowStageId;
  label: string;
  description: string;
  steps: ReadonlyArray<{ id: StepId; label: string }>;
}

export const WORKFLOW_STAGES: readonly WorkflowStageConfig[] = [
  {
    id: "materials",
    label: "材料",
    description: "岗位、JD 与原始简历",
    steps: [
      { id: "input", label: "岗位与简历材料" },
    ],
  },
  {
    id: "analysis",
    label: "分析",
    description: "岗位解析、匹配与补证",
    steps: [
      { id: "jd-analysis", label: "JD 解析" },
      { id: "diagnosis", label: "简历诊断" },
      { id: "match", label: "匹配分析" },
      { id: "follow-up", label: "经历补证" },
    ],
  },
  {
    id: "creation",
    label: "制作",
    description: "AI 优化、人工编辑与排版",
    steps: [
      { id: "optimize", label: "AI 优化" },
      { id: "final-resume", label: "编辑与模板" },
    ],
  },
  {
    id: "delivery",
    label: "交付",
    description: "成品检查、导出与存档",
    steps: [
      { id: "export", label: "ATS 与导出" },
    ],
  },
];

export const INTERVIEW_REVIEW_STEPS = [
  { id: "interview-recording" as const, label: "对话诊断" },
];

export const WORKFLOW_STEPS = [
  ...WORKFLOW_STAGES.flatMap((stage) => stage.steps),
  ...INTERVIEW_REVIEW_STEPS,
];
