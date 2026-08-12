import { REQUIRED_GATE_IDS, type WorkflowDefinition, type WorkflowValidationResult, type WorkflowVersion } from "@/lib/studio/workflow-types";

export function validateWorkflowDefinition(definition: WorkflowDefinition): WorkflowValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const node of definition.nodes) {
    if (ids.has(node.id)) errors.push(`节点 ID 重复：${node.id}`);
    ids.add(node.id);
  }
  const starts = definition.nodes.filter((node) => node.kind === "start" && node.enabled);
  const ends = definition.nodes.filter((node) => node.kind === "end" && node.enabled);
  if (starts.length !== 1) errors.push("工作流必须且只能有一个启用的开始节点");
  if (ends.length !== 1) errors.push("工作流必须且只能有一个启用的结束节点");
  for (const id of REQUIRED_GATE_IDS) {
    const gate = definition.nodes.find((node) => node.id === id);
    if (!gate || !gate.locked || !gate.enabled) errors.push(`必经锁定节点不可删除或停用：${id}`);
  }
  const enabled = new Map(definition.nodes.filter((node) => node.enabled).map((node) => [node.id, node]));
  const edges = definition.edges.filter((edge) => enabled.has(edge.source) && enabled.has(edge.target));
  for (const edge of definition.edges) {
    const source = definition.nodes.find((node) => node.id === edge.source);
    const target = definition.nodes.find((node) => node.id === edge.target);
    if (!source || !target) { errors.push(`连接引用不存在的节点：${edge.id}`); continue; }
    if (edge.source === edge.target) errors.push(`不允许节点连接自身：${edge.source}`);
    if (source.enabled && target.enabled && source.outputType !== target.inputType) errors.push(`数据类型不兼容：${source.label}(${source.outputType}) → ${target.label}(${target.inputType})`);
  }
  if (hasCycle([...enabled.keys()], edges)) errors.push("工作流不能包含循环");
  if (starts[0] && ends[0]) {
    const reachable = reachableFrom(starts[0].id, edges);
    for (const node of enabled.values()) if (!reachable.has(node.id)) errors.push(`存在不可达节点：${node.label}`);
    if (!reachable.has(ends[0].id)) errors.push("结束节点不可达");
    for (const id of REQUIRED_GATE_IDS) if (canReach(starts[0].id, ends[0].id, edges, id)) errors.push(`必经节点可被绕过：${id}`);
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function isExecutionChange(base: WorkflowDefinition, next: WorkflowDefinition): boolean {
  const settings = (definition: WorkflowDefinition) => definition.nodes.filter((node) => node.kind === "ai").map((node) => ({ id: node.id, enabled: node.enabled, provider: node.provider, model: node.model, promptVersion: node.promptVersion, timeoutMs: node.timeoutMs, requiresHumanApproval: node.requiresHumanApproval })).sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(settings(base)) !== JSON.stringify(settings(next));
}

export function hasRecentRealEval(evaluatedAt: string | null, now = Date.now()): boolean {
  if (!evaluatedAt) return false;
  const value = new Date(evaluatedAt).getTime();
  return Number.isFinite(value) && value <= now && now - value <= 7 * 24 * 60 * 60 * 1000;
}

export function compareWorkflowVersions(left: WorkflowVersion, right: WorkflowVersion) {
  const before = new Map(left.definition.nodes.map((node) => [node.id, node]));
  const after = new Map(right.definition.nodes.map((node) => [node.id, node]));
  return {
    added: [...after.keys()].filter((id) => !before.has(id)),
    removed: [...before.keys()].filter((id) => !after.has(id)),
    changed: [...after.keys()].filter((id) => before.has(id) && JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id))),
  };
}

function hasCycle(nodes: string[], edges: Array<{ source: string; target: string }>): boolean {
  const state = new Map(nodes.map((id) => [id, 0]));
  const visit = (id: string): boolean => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    for (const edge of edges.filter((item) => item.source === id)) if (visit(edge.target)) return true;
    state.set(id, 2); return false;
  };
  return nodes.some(visit);
}

function reachableFrom(start: string, edges: Array<{ source: string; target: string }>, removed?: string): Set<string> {
  const seen = new Set<string>(); const queue = [start];
  while (queue.length) { const id = queue.shift()!; if (id === removed || seen.has(id)) continue; seen.add(id); for (const edge of edges) if (edge.source === id && edge.target !== removed) queue.push(edge.target); }
  return seen;
}

function canReach(start: string, end: string, edges: Array<{ source: string; target: string }>, removed: string): boolean {
  return reachableFrom(start, edges, removed).has(end);
}

export function cloneDefinition(value: WorkflowDefinition): WorkflowDefinition { return structuredClone(value); }
