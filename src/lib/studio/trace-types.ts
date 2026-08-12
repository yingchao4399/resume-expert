export type WorkflowRunStatus = "running" | "success" | "error";
export type WorkflowNodeId = "analyze" | "optimize" | "follow-up" | "finalize" | "import-structure" | "interview-review" | "project-evidence";

export interface WorkflowSpan {
  id: string;
  nodeId: WorkflowNodeId;
  label: string;
  status: WorkflowRunStatus;
  mode?: "mock" | "llm" | "flowise";
  provider?: string;
  model?: string;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  input: unknown;
  output?: unknown;
  error?: string;
  truncated?: boolean;
}

export interface WorkflowTrace {
  schemaVersion: 1;
  id: string;
  documentId?: string;
  status: WorkflowRunStatus;
  createdAt: string;
  updatedAt: string;
  spans: WorkflowSpan[];
}
