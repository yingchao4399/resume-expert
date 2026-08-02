import type { StepId } from "@/types/resume";

export interface WorkflowGroup {
  id: "resume" | "interview-review";
  label: string;
  steps: ReadonlyArray<{ id: StepId; label: string }>;
}

export const WORKFLOW_GROUPS: readonly WorkflowGroup[] = [
  {
    id: "resume",
    label: "简历优化",
    steps: [
      { id: "input", label: "输入材料" },
      { id: "jd-analysis", label: "JD 解析" },
      { id: "diagnosis", label: "简历诊断" },
      { id: "match", label: "匹配分析" },
      { id: "follow-up", label: "经历补证" },
      { id: "optimize", label: "简历优化" },
      { id: "final-resume", label: "最终简历" },
      { id: "interview", label: "面试准备" },
      { id: "export", label: "导出结果" },
    ],
  },
  {
    id: "interview-review",
    label: "面试复盘",
    steps: [{ id: "interview-recording", label: "对话诊断" }],
  },
];

export const WORKFLOW_STEPS = WORKFLOW_GROUPS.flatMap((group) => group.steps);
