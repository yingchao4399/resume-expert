import type { WorkflowDefinition, WorkflowNode } from "@/lib/studio/workflow-types";

const node = (value: WorkflowNode): WorkflowNode => value;

export function createDefaultWorkflowDefinition(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    id: "resume-workflow",
    name: "简历专家固定工作流",
    nodes: [
      node({ id: "start", label: "开始", description: "接收岗位和简历材料", kind: "start", position: { x: 0, y: 180 }, inputType: "none", outputType: "materials", locked: true, optional: false, enabled: true, requiresHumanApproval: false }),
      node({ id: "materials-validation", label: "材料校验", description: "目标岗位、JD 与原始简历齐全", kind: "gate", position: { x: 240, y: 180 }, inputType: "materials", outputType: "materials", locked: true, optional: false, enabled: true, requiresHumanApproval: false }),
      node({ id: "analysis", label: "岗位分析", description: "解析 JD、诊断匹配和证据缺口", kind: "ai", position: { x: 480, y: 180 }, inputType: "materials", outputType: "analysis", locked: false, optional: false, enabled: true, provider: "direct", model: "configured-model", promptVersion: "analysis-v1", timeoutMs: 120000, requiresHumanApproval: false }),
      node({ id: "interview-prep", label: "面试准备", description: "可选生成面试问题与证据清单", kind: "ai", position: { x: 720, y: 20 }, inputType: "analysis", outputType: "analysis", locked: false, optional: true, enabled: true, provider: "direct", model: "configured-model", promptVersion: "interview-v1", timeoutMs: 120000, requiresHumanApproval: false }),
      node({ id: "evidence-confirmation", label: "证据确认", description: "用户核对候选事实，拒绝无依据成果", kind: "human", position: { x: 720, y: 180 }, inputType: "analysis", outputType: "evidence", locked: true, optional: false, enabled: true, requiresHumanApproval: true }),
      node({ id: "optimize", label: "简历优化", description: "根据已确认事实改写岗位版本", kind: "ai", position: { x: 960, y: 180 }, inputType: "evidence", outputType: "resume-draft", locked: false, optional: false, enabled: true, provider: "direct", model: "configured-model", promptVersion: "optimize-v1", timeoutMs: 120000, requiresHumanApproval: false }),
      node({ id: "final-resume-confirmation", label: "最终简历确认", description: "AI 生成或人工保存后确认最终简历", kind: "human", position: { x: 1200, y: 180 }, inputType: "resume-draft", outputType: "resume-confirmed", locked: true, optional: false, enabled: true, requiresHumanApproval: true }),
      node({ id: "export-gate", label: "导出门禁", description: "仅已确认且未过期简历允许交付", kind: "gate", position: { x: 1440, y: 180 }, inputType: "resume-confirmed", outputType: "delivery", locked: true, optional: false, enabled: true, requiresHumanApproval: false }),
      node({ id: "end", label: "交付", description: "DOCX、PDF、备份与投递准备", kind: "end", position: { x: 1680, y: 180 }, inputType: "delivery", outputType: "none", locked: true, optional: false, enabled: true, requiresHumanApproval: false }),
    ],
    edges: [
      edge("start", "materials-validation"), edge("materials-validation", "analysis"),
      edge("analysis", "evidence-confirmation"), edge("analysis", "interview-prep"), edge("interview-prep", "evidence-confirmation"),
      edge("evidence-confirmation", "optimize"), edge("optimize", "final-resume-confirmation"),
      edge("final-resume-confirmation", "export-gate"), edge("export-gate", "end"),
    ],
  };
}

function edge(source: string, target: string) { return { id: `${source}-${target}`, source, target }; }
