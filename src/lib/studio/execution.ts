import type { PromptCaptureContext } from "@/lib/studio/prompt-types";

export interface WorkflowExecutionOptions {
  forceMock: boolean;
  model?: string;
  timeoutMs?: number;
  capture?: PromptCaptureContext;
}

export function readWorkflowExecution(request: Request): WorkflowExecutionOptions {
  const rawModel = request.headers.get("X-Workflow-Model")?.trim();
  const rawTimeout = Number(request.headers.get("X-Workflow-Timeout"));
  const rawTraceId = request.headers.get("X-Workflow-Trace-Id")?.trim();
  return {
    forceMock: request.headers.get("X-Workflow-Provider") === "mock",
    model: rawModel && /^[a-zA-Z0-9._:/-]{1,128}$/.test(rawModel) ? rawModel : undefined,
    timeoutMs: Number.isFinite(rawTimeout) ? Math.max(1_000, Math.min(120_000, rawTimeout)) : undefined,
    capture: request.headers.get("X-Studio-Capture") === "full"
      ? { traceId: rawTraceId && /^[a-zA-Z0-9-]{1,128}$/.test(rawTraceId) ? rawTraceId : undefined, snapshots: [] }
      : undefined,
  };
}
