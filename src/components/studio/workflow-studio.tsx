"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addEdge, Background, Controls, MarkerType, ReactFlow, type Connection, type Edge, type Node, type NodeChange } from "@xyflow/react";
import { AlertTriangle, CheckCircle2, GitCompare, RotateCcw, Save, TestTube2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createInitialWorkflowWorkspace, publishWorkflowDraft, rollbackWorkflow, testWorkflowDraft, type WorkflowWorkspace } from "@/lib/studio/workflow-release";
import { loadWorkflowWorkspace, saveWorkflowWorkspace } from "@/lib/studio/workflow-store";
import type { WorkflowDefinition, WorkflowNode, WorkflowProvider, WorkflowVersion } from "@/lib/studio/workflow-types";
import { cloneDefinition, compareWorkflowVersions, validateWorkflowDefinition } from "@/lib/studio/workflow-validation";

interface RealEvalStatus { available: boolean; evaluatedAt: string | null; reason?: string; caseCount?: number }

export function WorkflowStudio() {
  const [workspace, setWorkspace] = useState<WorkflowWorkspace | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [realEval, setRealEval] = useState<RealEvalStatus>({ available: false, evaluatedAt: null });
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null);

  useEffect(() => { void Promise.all([loadWorkflowWorkspace(), fetch("/api/evals/latest-real", { cache: "no-store" }).then((response) => response.json() as Promise<RealEvalStatus>)]).then(([stored, evaluation]) => { setWorkspace(stored); setRealEval(evaluation); }); }, []);

  const updateDefinition = useCallback((updater: (value: WorkflowDefinition) => WorkflowDefinition) => {
    setWorkspace((current) => current ? { ...current, draft: { ...current.draft, definition: updater(cloneDefinition(current.draft.definition)), updatedAt: new Date().toISOString(), lastTest: null } } : current);
  }, []);

  const nodes = useMemo<Node[]>(() => workspace?.draft.definition.nodes.map((node) => ({ id: node.id, position: node.position, draggable: true, ariaLabel: node.label, data: { label: <NodeLabel node={node}/> }, style: nodeStyle(node) })) ?? [], [workspace]);
  const edges = useMemo<Edge[]>(() => workspace?.draft.definition.edges.map((edge) => ({ ...edge, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#a3a3a3" } })) ?? [], [workspace]);
  const selected = workspace?.draft.definition.nodes.find((node) => node.id === selectedId) ?? null;

  const onNodesChange = (changes: NodeChange<Node>[]) => {
    const positions = new Map(changes.flatMap((change) => change.type === "position" && change.position ? [[change.id, change.position] as const] : []));
    if (!positions.size) return;
    updateDefinition((definition) => ({ ...definition, nodes: definition.nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position })) }));
  };
  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target || !workspace) return;
    const candidate = cloneDefinition(workspace.draft.definition);
    candidate.edges = addEdge({ ...connection, id: `${connection.source}-${connection.target}-${Date.now()}` }, candidate.edges as Edge[]) as typeof candidate.edges;
    const validation = validateWorkflowDefinition(candidate);
    if (!validation.valid) { setMessage(`连接被拒绝：${validation.errors[0]}`); return; }
    updateDefinition(() => candidate); setMessage("连接已写入草稿，发布前仍需重新测试。 ");
  };
  const onEdgesDelete = (removed: Edge[]) => {
    if (!workspace) return;
    const candidate = cloneDefinition(workspace.draft.definition);
    candidate.edges = candidate.edges.filter((edge) => !removed.some((item) => item.id === edge.id));
    const validation = validateWorkflowDefinition(candidate);
    if (!validation.valid) { setMessage(`连接不可删除：${validation.errors[0]}`); return; }
    updateDefinition(() => candidate); setMessage("连接已从草稿移除，发布前仍需重新测试。 ");
  };
  const patchNode = (patch: Partial<WorkflowNode>) => updateDefinition((definition) => ({ ...definition, nodes: definition.nodes.map((node) => node.id === selectedId ? { ...node, ...patch, id: node.id, locked: node.locked } : node) }));

  const save = async () => { if (!workspace) return; await saveWorkflowWorkspace(workspace); setMessage("草稿已保存到本机 IndexedDB。 "); };
  const testDraft = async () => { if (!workspace) return; const next = { ...workspace, draft: testWorkflowDraft(workspace.draft) }; await saveWorkflowWorkspace(next); setWorkspace(next); setMessage(next.draft.lastTest?.passed ? "结构校验和 Mock 测评通过，可以发布。" : `测试失败：${next.draft.lastTest?.errors.join("；")}`); };
  const publish = async () => { if (!workspace) return; try { const result = publishWorkflowDraft(workspace, realEval.evaluatedAt); await saveWorkflowWorkspace(result.workspace); setWorkspace(result.workspace); setMessage(result.channel === "production" ? `生产版本 v${result.version.version} 已发布。` : `实验版本 v${result.version.version} 已发布；主流程继续使用上一生产版本。`); } catch (error) { setMessage(error instanceof Error ? error.message : "发布失败"); } };
  const rollback = async (id: string) => { if (!workspace || !window.confirm("确认生成一个新的回滚版本？历史版本不会被覆盖。")) return; try { const next = rollbackWorkflow(workspace, id); await saveWorkflowWorkspace(next); setWorkspace(next); setMessage(`已回滚并发布生产版本 v${next.versions.at(-1)?.version}。`); } catch (error) { setMessage(error instanceof Error ? error.message : "回滚失败"); } };
  const restoreDefault = async () => { if (!window.confirm("确认丢弃当前草稿并恢复固定工作流？")) return; const initial = createInitialWorkflowWorkspace(); await saveWorkflowWorkspace(initial); setWorkspace(initial); setSelectedId(null); setMessage("已恢复默认固定工作流。 "); };

  if (!workspace) return <div className="rounded-lg border bg-white p-8 text-sm text-neutral-500">正在加载本机工作流版本…</div>;
  const currentPublished = workspace.versions.find((item) => item.id === workspace.publishedVersionId);
  const diff = compareIds ? compareVersions(workspace.versions, compareIds) : null;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">可视化工作流</h2><p className="mt-1 text-sm text-neutral-500">画布编辑独立草稿；TypeScript 执行器、业务 Schema 和锁定门禁仍是唯一事实来源。</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void restoreDefault()}><RotateCcw/>恢复默认</Button><Button variant="outline" size="sm" onClick={() => void save()}><Save/>保存草稿</Button><Button variant="outline" size="sm" onClick={() => void testDraft()}><TestTube2/>测试草稿</Button><Button size="sm" onClick={() => void publish()}>发布</Button></div></div>
    <div className="grid gap-3 sm:grid-cols-3"><Status label="当前生产版本" value={`v${currentPublished?.version ?? 1}`}/><Status label="草稿测试" value={workspace.draft.lastTest?.passed ? "已通过" : "待测试"} good={workspace.draft.lastTest?.passed}/><Status label="7 天真实评测" value={realEval.available ? `${realEval.caseCount} 案例 · 有效` : "无有效结果"} good={realEval.available}/></div>
    {!realEval.available && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><AlertTriangle className="mr-2 inline h-4 w-4"/>涉及 Prompt、Provider、模型或超时的改动只能发布为实验版本。运行 `npm run eval:ai` 并达到门槛后，DirectLLM/Mock 改动才可影响主流程；Flowise 主流程适配器尚未批准，始终保留为实验版本。</div>}
    {message && <p aria-live="polite" className="rounded-md border bg-white p-3 text-sm">{message}</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="h-[520px] overflow-hidden rounded-lg border bg-white"><ReactFlow nodes={nodes} edges={edges} onInit={(instance) => window.setTimeout(() => instance.fitView({ padding: 0.08 }), 0)} onNodesChange={onNodesChange} onNodeClick={(_, node) => setSelectedId(node.id)} onConnect={onConnect} onEdgesDelete={onEdgesDelete} nodesConnectable edgesReconnectable fitView minZoom={0.25} maxZoom={1.4}><Background gap={20} size={1}/><Controls/></ReactFlow></div><aside className="rounded-lg border bg-white p-4">{selected ? <NodeEditor node={selected} onChange={patchNode}/> : <p className="text-sm text-neutral-500">选择一个节点编辑说明和允许的执行参数。锁定节点只能移动和查看，不能停用或绕过。</p>}</aside></div>
    <VersionHistory workspace={workspace} onRollback={rollback} onCompare={setCompareIds}/>
    {diff && <div className="rounded-lg border bg-white p-4 text-sm"><h3 className="font-semibold">版本差异</h3><p className="mt-2 text-neutral-600">新增：{diff.added.join("、") || "无"} · 删除：{diff.removed.join("、") || "无"} · 变更：{diff.changed.join("、") || "无"}</p></div>}
  </div>;
}

function NodeLabel({ node }: { node: WorkflowNode }) { return <div className="w-40"><div className="flex items-center justify-between gap-2"><strong className="text-xs">{node.label}</strong>{node.locked && <span title="锁定门禁" className="text-[10px]">🔒</span>}</div><p className="mt-1 text-[10px] leading-4 text-neutral-500">{node.description}</p>{node.kind === "ai" && <p className="mt-2 text-[10px] uppercase text-blue-700">{node.provider} · {node.promptVersion}</p>}</div>; }
function nodeStyle(node: WorkflowNode) { return { borderRadius: 10, border: `1px solid ${node.locked ? "#f59e0b" : node.kind === "ai" ? "#93c5fd" : "#d4d4d4"}`, background: node.kind === "gate" || node.kind === "human" ? "#fffbeb" : "#fff", padding: 12, opacity: node.enabled ? 1 : .45 }; }

function NodeEditor({ node, onChange }: { node: WorkflowNode; onChange: (patch: Partial<WorkflowNode>) => void }) { return <div className="space-y-4"><div><h3 className="font-semibold">{node.label}</h3><div className="mt-2 flex gap-2"><Badge variant={node.locked ? "warning" : "outline"}>{node.locked ? "锁定" : node.kind}</Badge>{node.optional && <Badge variant="secondary">可选</Badge>}</div></div><div><Label htmlFor="node-description">节点说明</Label><Textarea id="node-description" className="mt-1.5" value={node.description} onChange={(event) => onChange({ description: event.target.value })}/></div>{node.optional && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={node.enabled} onChange={(event) => onChange({ enabled: event.target.checked })}/>启用可选节点</label>}{node.kind === "ai" && <><div><Label htmlFor="node-provider">Provider</Label><Select value={node.provider} onValueChange={(value) => onChange({ provider: value as WorkflowProvider })}><SelectTrigger id="node-provider" className="mt-1.5"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="direct">DirectLLM</SelectItem><SelectItem value="flowise">Flowise</SelectItem><SelectItem value="mock">Mock</SelectItem></SelectContent></Select></div><div><Label htmlFor="node-model">模型</Label><Input id="node-model" className="mt-1.5" value={node.model ?? ""} onChange={(event) => onChange({ model: event.target.value })} placeholder="configured-model"/></div><div><Label htmlFor="node-prompt">Prompt 版本</Label><Input id="node-prompt" className="mt-1.5" value={node.promptVersion ?? ""} onChange={(event) => onChange({ promptVersion: event.target.value })}/></div><div><Label htmlFor="node-timeout">超时（毫秒）</Label><Input id="node-timeout" className="mt-1.5" type="number" min={1000} max={120000} value={node.timeoutMs ?? 120000} onChange={(event) => onChange({ timeoutMs: Math.max(1000, Math.min(120000, Number(event.target.value))) })}/></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={node.requiresHumanApproval} onChange={(event) => onChange({ requiresHumanApproval: event.target.checked })}/>运行后需要人工确认</label></>}</div>; }
function Status({ label, value, good }: { label: string; value: string; good?: boolean }) { return <div className="rounded-lg border bg-white p-4"><p className="text-xs text-neutral-500">{label}</p><p className="mt-2 flex items-center gap-2 font-semibold">{good === true && <CheckCircle2 className="h-4 w-4 text-emerald-600"/>}{value}</p></div>; }

function VersionHistory({ workspace, onRollback, onCompare }: { workspace: WorkflowWorkspace; onRollback: (id: string) => void; onCompare: (ids: [string, string]) => void }) { const [left, setLeft] = useState(workspace.versions[0]?.id ?? ""); const [right, setRight] = useState(workspace.versions.at(-1)?.id ?? ""); return <section className="rounded-lg border bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">发布历史</h3><p className="mt-1 text-xs text-neutral-500">最多保留最近 10 个版本，回滚会生成新的生产版本；实验版本不能直接回滚为生产。</p></div><div className="flex items-center gap-2"><Select value={left} onValueChange={setLeft}><SelectTrigger className="w-28"><SelectValue/></SelectTrigger><SelectContent>{workspace.versions.map((item) => <SelectItem key={item.id} value={item.id}>v{item.version}</SelectItem>)}</SelectContent></Select><Select value={right} onValueChange={setRight}><SelectTrigger className="w-28"><SelectValue/></SelectTrigger><SelectContent>{workspace.versions.map((item) => <SelectItem key={item.id} value={item.id}>v{item.version}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="sm" onClick={() => onCompare([left, right])}><GitCompare/>比较</Button></div></div><div className="mt-4 space-y-2">{[...workspace.versions].reverse().map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3 text-xs"><div className="flex items-center gap-2"><strong>v{item.version}</strong><Badge variant={item.channel === "production" ? "success" : "warning"}>{item.channel === "production" ? "生产" : "实验"}</Badge>{workspace.publishedVersionId === item.id && <Badge>当前</Badge>}<span className="text-neutral-500">{new Date(item.createdAt).toLocaleString("zh-CN")}</span></div><Button variant="ghost" size="sm" disabled={workspace.publishedVersionId === item.id || item.channel === "experiment"} onClick={() => onRollback(item.id)}>回滚到此版本</Button></div>)}</div></section>; }
function compareVersions(versions: WorkflowVersion[], ids: [string, string]) { const left = versions.find((item) => item.id === ids[0]); const right = versions.find((item) => item.id === ids[1]); return left && right ? compareWorkflowVersions(left, right) : null; }
