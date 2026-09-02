"use client";

import { useMemo } from "react";
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { createDefaultWorkflowDefinition } from "@/lib/studio/workflow-default";
import { getWorkflowNodeRuntimeState } from "@/lib/workflow-progress";
import { useResumeStore } from "@/store/resume-store";

export function WorkflowMap() {
  const state = useResumeStore();
  const definition = useMemo(() => createDefaultWorkflowDefinition(), []);
  const runtimeInput = useMemo(() => ({ currentStep: state.currentStep, userInput: state.userInput, analysisResult: state.analysisResult, finalResumeStatus: state.finalResumeStatus, materialRevision: state.materialRevision, analysisRevision: state.analysisRevision, jdAnalysisDocument: state.jdAnalysisDocument, analysisBasis: state.analysisBasis }), [state.currentStep, state.userInput, state.analysisResult, state.finalResumeStatus, state.materialRevision, state.analysisRevision, state.jdAnalysisDocument, state.analysisBasis]);
  const nodes = useMemo<Node[]>(() => definition.nodes.map((node) => {
    const item = getWorkflowNodeRuntimeState(node, runtimeInput);
    return { id: node.id, position: node.position, draggable: false, data: { label: <div className="w-40"><div className="flex items-center justify-between gap-2"><strong className="text-[11px]">{node.label}</strong><span className="text-[10px] uppercase text-neutral-400">{item.status === "optional" ? "可选" : item.status}</span></div><p className="mt-1 text-[10px] leading-4 text-neutral-500">{node.description}</p><p className="mt-1 text-[10px] text-amber-700">{item.blocker ?? (node.kind === "ai" ? `${node.provider ?? "direct"} · ${node.promptVersion ?? "未配置"}` : "")}</p></div> }, style: { borderRadius: 10, border: `1px solid ${node.locked ? "#f59e0b" : item.status === "completed" ? "#86efac" : item.status === "blocked" ? "#fcd34d" : node.optional ? "#c4b5fd" : "#d4d4d4"}`, background: item.status === "active" ? "#fafafa" : node.optional ? "#faf5ff" : "#fff", padding: 10 } };
  }), [definition.nodes, runtimeInput]);
  const edges = useMemo<Edge[]>(() => definition.edges.map((edge) => ({ ...edge, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#a3a3a3" } })), [definition.edges]);
  return <div className="h-[520px] overflow-hidden rounded-lg border border-neutral-200 bg-white"><ReactFlow nodes={nodes} edges={edges} nodesDraggable={false} nodesConnectable={false} elementsSelectable fitView minZoom={0.25} maxZoom={1.4}><Background gap={20} size={1} /><Controls showInteractive={false} /></ReactFlow></div>;
}
