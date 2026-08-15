"use client";

import { useMemo } from "react";
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { WORKFLOW_STAGES } from "@/config/workflow";
import { getWorkflowProgress } from "@/lib/workflow-progress";
import { useResumeStore } from "@/store/resume-store";

const positions = [{ x: 40, y: 80 }, { x: 300, y: 80 }, { x: 560, y: 80 }, { x: 820, y: 80 }];

export function WorkflowMap() {
  const state = useResumeStore();
  const progress = getWorkflowProgress({ currentStep: state.currentStep, userInput: state.userInput, analysisResult: state.analysisResult, finalResumeStatus: state.finalResumeStatus, materialRevision: state.materialRevision, analysisRevision: state.analysisRevision, jdAnalysisDocument: state.jdAnalysisDocument, analysisBasis: state.analysisBasis });
  const nodes = useMemo<Node[]>(() => WORKFLOW_STAGES.map((stage, index) => {
    const item = progress.find((entry) => entry.id === stage.id)!;
    return { id: stage.id, position: positions[index], draggable: false, data: { label: <div className="min-w-44"><div className="flex items-center justify-between gap-3"><strong>{stage.label}</strong><span className="text-[10px] uppercase text-neutral-400">{item.status}</span></div><p className="mt-1 text-xs text-neutral-500">{stage.description}</p><p className="mt-2 text-[11px] text-amber-700">{item.blocker ?? item.actionLabel}</p></div> }, style: { borderRadius: 10, border: `1px solid ${item.status === "completed" ? "#86efac" : item.status === "blocked" ? "#fcd34d" : "#d4d4d4"}`, background: item.status === "active" ? "#fafafa" : "#fff", padding: 14 } };
  }), [progress]);
  const edges = useMemo<Edge[]>(() => WORKFLOW_STAGES.slice(0, -1).map((stage, index) => ({ id: `${stage.id}-${WORKFLOW_STAGES[index + 1].id}`, source: stage.id, target: WORKFLOW_STAGES[index + 1].id, markerEnd: { type: MarkerType.ArrowClosed }, animated: progress[index].status === "active" })), [progress]);
  return <div className="h-[360px] overflow-hidden rounded-lg border border-neutral-200 bg-white"><ReactFlow nodes={nodes} edges={edges} nodesDraggable={false} nodesConnectable={false} elementsSelectable fitView minZoom={0.65} maxZoom={1.4}><Background gap={20} size={1} /><Controls showInteractive={false} /></ReactFlow></div>;
}
