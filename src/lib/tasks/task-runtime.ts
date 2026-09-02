import type { AppErrorPayload } from "@/lib/errors/app-error";

export type TaskOperationId =
  | "jd-analysis"
  | "jd-consolidation"
  | "requirement-match"
  | "interview-prepare"
  | "optimize"
  | "finalize"
  | "resume-import"
  | "career-interview"
  | "interview-review"
  | "export";

export type TaskRunStatus = "idle" | "running" | "succeeded" | "failed" | "cancelled";

export interface TaskRunState {
  key: string;
  documentId: string;
  operationId: TaskOperationId;
  status: TaskRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  progress: number | null;
  message: string | null;
  error: AppErrorPayload | null;
}

const runs = new Map<string, TaskRunState>();
const listeners = new Set<() => void>();

export function taskRunKey(documentId: string, operationId: TaskOperationId): string {
  return `${documentId}:${operationId}`;
}

function idleState(documentId: string, operationId: TaskOperationId): TaskRunState {
  return { key: taskRunKey(documentId, operationId), documentId, operationId, status: "idle", startedAt: null, finishedAt: null, progress: null, message: null, error: null };
}

function publish(state: TaskRunState): TaskRunState {
  runs.set(state.key, state);
  listeners.forEach((listener) => listener());
  return state;
}

export function getTaskRunState(documentId: string, operationId: TaskOperationId): TaskRunState {
  const key = taskRunKey(documentId, operationId);
  const existing = runs.get(key);
  if (existing) return existing;
  const idle = idleState(documentId, operationId);
  runs.set(key, idle);
  return idle;
}

export function beginTask(documentId: string, operationId: TaskOperationId, message: string | null = null): TaskRunState {
  return publish({ ...idleState(documentId, operationId), status: "running", startedAt: new Date().toISOString(), message });
}

export function updateTask(documentId: string, operationId: TaskOperationId, patch: Pick<Partial<TaskRunState>, "progress" | "message">): TaskRunState {
  return publish({ ...getTaskRunState(documentId, operationId), ...patch });
}

export function completeTask(documentId: string, operationId: TaskOperationId, message: string | null = null): TaskRunState {
  return publish({ ...getTaskRunState(documentId, operationId), status: "succeeded", finishedAt: new Date().toISOString(), progress: 100, message, error: null });
}

export function failTask(documentId: string, operationId: TaskOperationId, error: AppErrorPayload): TaskRunState {
  return publish({ ...getTaskRunState(documentId, operationId), status: "failed", finishedAt: new Date().toISOString(), error, message: error.userMessage });
}

export function cancelTask(documentId: string, operationId: TaskOperationId, message = "任务已取消，已有数据未改变。"): TaskRunState {
  const current = getTaskRunState(documentId, operationId);
  if (current.status !== "running") return current;
  return publish({ ...current, status: "cancelled", finishedAt: new Date().toISOString(), message, error: null });
}

export function resetTask(documentId: string, operationId: TaskOperationId): void {
  runs.delete(taskRunKey(documentId, operationId));
  listeners.forEach((listener) => listener());
}

export function hasRunningTask(documentId?: string): boolean {
  return [...runs.values()].some((run) => run.status === "running" && (!documentId || run.documentId === documentId));
}

export function subscribeTaskRuns(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetTaskRuntime(): void {
  runs.clear();
  listeners.forEach((listener) => listener());
}
