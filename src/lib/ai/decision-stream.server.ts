import { readWorkflowExecution, type WorkflowExecutionOptions } from "@/lib/studio/execution";
import { JD_TASK_TIMEOUT_MS } from "@/lib/jd/limits";

/** Shared termination and cancellation for JD operations. */
export function decisionStream(request: Request, task: (execution: WorkflowExecutionOptions, progress: (event: Record<string, unknown>) => void) => Promise<Record<string, unknown>>) {
  const base = readWorkflowExecution(request);
  const taskController = new AbortController();
  const abort = () => taskController.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  let closed = false;
  let timedOut = false;
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(output) {
      const started = Date.now();
      const encoder = new TextEncoder();
      let current: Record<string, unknown> = { message: "任务正在运行" };
      const send = (event: Record<string, unknown>) => {
        if (closed) return;
        try { output.enqueue(encoder.encode(JSON.stringify({ ...event, elapsedMs: Date.now() - started, remainingMs: Math.max(0, JD_TASK_TIMEOUT_MS - (Date.now() - started)), requestId: base.capture?.traceId }) + "\n")); }
        catch { closed = true; abort(); }
      };
      const finish = () => { cleanup(); if (!closed) { closed = true; output.close(); } };
      const heartbeat = setInterval(() => send({ ...current, type: "heartbeat" }), 5_000);
      const timer = setTimeout(() => {
        timedOut = true; abort();
        send({ type: "failed", error: "任务超过 360 秒总时限，已停止；已有材料和地图未改变。请缩短 JD 或测试模型连接。", promptSnapshots: base.capture?.snapshots });
        finish();
      }, JD_TASK_TIMEOUT_MS);
      cleanup = () => { clearInterval(heartbeat); clearTimeout(timer); request.signal.removeEventListener("abort", abort); };
      send({ type: "started" });
      void Promise.resolve().then(() => task({ ...base, signal: taskController.signal }, event => { current = event; send(event); })).then(result => {
        if (taskController.signal.aborted) send({ type: "cancelled", message: "任务已取消，已有数据未改变。", promptSnapshots: base.capture?.snapshots });
        else send({ type: "completed", ...result, promptSnapshots: base.capture?.snapshots });
      }).catch(error => {
        if (!timedOut) send({ type: taskController.signal.aborted ? "cancelled" : "failed", message: "任务已取消，已有数据未改变。", error: error instanceof Error ? error.message : "任务失败，请重试。", promptSnapshots: base.capture?.snapshots });
      }).finally(finish);
    },
    cancel() { closed = true; abort(); cleanup(); },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
