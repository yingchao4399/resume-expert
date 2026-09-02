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
      node({ id: "analysis", label: "JD 语义解析", description: "从原文提取岗位要求与原文锚点", kind: "ai", position: { x: 480, y: 180 }, inputType: "materials", outputType: "analysis", locked: false, optional: false, enabled: true, provider: "direct", model: "configured-model", promptVersion: "jd-semantic-v1", timeoutMs: 120000, requiresHumanApproval: false }),
      node({ id: "jd-consolidation", label: "需求归并", description: "跨段落去重并保留独立细则与来源", kind: "action", position: { x: 700, y: 180 }, inputType: "analysis", outputType: "analysis", locked: false, optional: false, enabled: true, requiresHumanApproval: false }),
      node({ id: "jd-confirmation", label: "确认需求地图", description: "用户核对岗位要求、语气、优先级和引用", kind: "human", position: { x: 920, y: 180 }, inputType: "analysis", outputType: "analysis", locked: true, optional: false, enabled: true, requiresHumanApproval: true }),
      node({ id: "fact-match", label: "事实匹配", description: "按要求召回已确认经历事实并计算缺口", kind: "ai", position: { x: 1140, y: 180 }, inputType: "analysis", outputType: "evidence", locked: false, optional: false, enabled: true, provider: "direct", model: "configured-model", promptVersion: "fact-match-v1", timeoutMs: 120000, requiresHumanApproval: false }),
      node({ id: "interview-prep", label: "面试准备", description: "可选生成逐条面试策略与反向提问", kind: "ai", position: { x: 1140, y: 20 }, inputType: "analysis", outputType: "analysis", locked: false, optional: true, enabled: true, provider: "direct", model: "configured-model", promptVersion: "interview-v1", timeoutMs: 120000, requiresHumanApproval: false }),
      node({ id: "supplement", label: "可选补证", description: "补充缺失细节，不阻塞继续制作", kind: "human", position: { x: 1360, y: 20 }, inputType: "evidence", outputType: "evidence", locked: false, optional: true, enabled: true, requiresHumanApproval: true }),
      node({ id: "evidence-confirmation", label: "候选事实确认", description: "仅在采用候选事实或增强内容时人工确认", kind: "human", position: { x: 1360, y: 180 }, inputType: "evidence", outputType: "evidence", locked: false, optional: true, enabled: true, requiresHumanApproval: true }),
      node({ id: "optimize", label: "简历优化", description: "根据已确认事实改写岗位版本", kind: "ai", position: { x: 1580, y: 180 }, inputType: "evidence", outputType: "resume-draft", locked: false, optional: false, enabled: true, provider: "direct", model: "configured-model", promptVersion: "optimize-v1", timeoutMs: 120000, requiresHumanApproval: false }),
      node({ id: "final-resume-confirmation", label: "最终简历确认", description: "AI 生成或人工保存后确认最终简历", kind: "human", position: { x: 1800, y: 180 }, inputType: "resume-draft", outputType: "resume-confirmed", locked: true, optional: false, enabled: true, requiresHumanApproval: true }),
      node({ id: "export-gate", label: "导出门禁", description: "仅已确认且未过期简历允许交付", kind: "gate", position: { x: 2020, y: 180 }, inputType: "resume-confirmed", outputType: "delivery", locked: true, optional: false, enabled: true, requiresHumanApproval: false }),
      node({ id: "end", label: "交付", description: "DOCX、PDF、备份与投递准备", kind: "end", position: { x: 2240, y: 180 }, inputType: "delivery", outputType: "none", locked: true, optional: false, enabled: true, requiresHumanApproval: false }),
    ],
    edges: [
      edge("start", "materials-validation"), edge("materials-validation", "analysis"),
      edge("analysis", "jd-consolidation"), edge("jd-consolidation", "jd-confirmation"), edge("jd-confirmation", "fact-match"),
      edge("jd-confirmation", "interview-prep"), edge("interview-prep", "fact-match"),
      edge("fact-match", "optimize"), edge("fact-match", "supplement"), edge("supplement", "optimize"),
      edge("fact-match", "evidence-confirmation"), edge("evidence-confirmation", "optimize"), edge("optimize", "final-resume-confirmation"),
      edge("final-resume-confirmation", "export-gate"), edge("export-gate", "end"),
    ],
  };
}

function edge(source: string, target: string) { return { id: `${source}-${target}`, source, target }; }
