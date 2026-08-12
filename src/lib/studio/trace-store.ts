import type { WorkflowSpan, WorkflowTrace } from "@/lib/studio/trace-types";

const DB_NAME = "resume-expert-studio";
const STORE_NAME = "traces";
const WORKFLOW_STORE_NAME = "workflow-workspace";
const MAX_TRACES = 50;
const MAX_TOTAL_BYTES = 50_000_000;
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const MAX_SPAN_BYTES = 900_000;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!request.result.objectStoreNames.contains(WORKFLOW_STORE_NAME)) request.result.createObjectStore(WORKFLOW_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function redactTraceValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactTraceValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) =>
    /api.?key|authorization|password|credential|configpath/i.test(key)
      ? [key, "[REDACTED]"]
      : [key, redactTraceValue(item)]));
}

function compactSpan(span: WorkflowSpan): WorkflowSpan {
  const sanitized = { ...span, input: redactTraceValue(span.input), output: redactTraceValue(span.output) };
  const raw = JSON.stringify(sanitized);
  if (new Blob([raw]).size <= MAX_SPAN_BYTES) return sanitized;
  return { ...sanitized, input: "[内容过大，已截断]", output: "[内容过大，已截断]", truncated: true };
}

export async function saveTraceSpan(span: WorkflowSpan, documentId?: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  const trace: WorkflowTrace = {
    schemaVersion: 1,
    id: span.id,
    documentId,
    status: span.status,
    createdAt: span.startedAt,
    updatedAt: span.finishedAt,
    spans: [compactSpan(span)],
  };
  store.put(trace);
  await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
  db.close();
  await pruneTraces();
}

export async function listTraces(): Promise<WorkflowTrace[]> {
  const db = await openDB();
  const values = await requestValue(db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll()) as WorkflowTrace[];
  db.close();
  return values.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function clearTraces(): Promise<void> {
  const db = await openDB();
  await requestValue(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear());
  db.close();
}

async function pruneTraces(): Promise<void> {
  const traces = await listTraces();
  const expired = Date.now() - MAX_AGE;
  let retainedBytes = 0;
  const remove = traces.filter((trace, index) => {
    const size = new Blob([JSON.stringify(trace)]).size;
    const shouldRemove = index >= MAX_TRACES || new Date(trace.createdAt).getTime() < expired || retainedBytes + size > MAX_TOTAL_BYTES;
    if (!shouldRemove) retainedBytes += size;
    return shouldRemove;
  });
  if (!remove.length) return;
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  for (const trace of remove) tx.objectStore(STORE_NAME).delete(trace.id);
  await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
  db.close();
}

export function downloadTraces(traces: WorkflowTrace[], name = "resume-expert-traces"): void {
  const blob = new Blob([JSON.stringify(traces, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `${name}-${new Date().toISOString().slice(0, 10)}.json`; link.click();
  URL.revokeObjectURL(url);
}
