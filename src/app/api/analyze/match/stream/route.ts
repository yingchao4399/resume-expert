import { matchAnalysisRequestSchema } from "@/lib/ai/schemas";
import { parseAPIRequest, toAPIErrorResponse } from "@/lib/ai/api-response";
import { readWorkflowExecution } from "@/lib/studio/execution";
import { matchConfirmedJDServer } from "@/services/ai/jdDecisionAgent.server";

const encoder = new TextEncoder();

export async function POST(request: Request) {
  let payload: ReturnType<typeof matchAnalysisRequestSchema.parse>;
  try {
    payload = await parseAPIRequest(request, matchAnalysisRequestSchema);
  } catch (error) {
    return toAPIErrorResponse(error, "事实匹配请求无效", "analyze/match/stream");
  }
  const baseExecution = readWorkflowExecution(request);
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  const stream = new ReadableStream<Uint8Array>({
    start(output) {
      let closed = false;
      const startedAt = Date.now();
      const send = (event: Record<string, unknown>) => { if (!closed) output.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); };
      const heartbeat = setInterval(() => send({ type: "heartbeat", elapsedMs: Date.now() - startedAt, message: "模型仍在匹配事实" }), 5_000);
      send({ type: "started", elapsedMs: 0 });
      void matchConfirmedJDServer(payload.input, payload.jobTargetContext, payload.jdAnalysisDocument, payload.careerClaims, {
        ...baseExecution,
        signal: controller.signal,
        onDecisionProgress: (event) => send({ ...event, elapsedMs: Date.now() - startedAt }),
      }).then(({ result, mode }) => {
        send({ type: "completed", result, mode, elapsedMs: Date.now() - startedAt, promptSnapshots: baseExecution.capture?.snapshots });
      }).catch((error) => {
        send(controller.signal.aborted
          ? { type: "cancelled", message: "事实匹配已取消，已有数据未改变。", elapsedMs: Date.now() - startedAt }
          : { type: "failed", error: error instanceof Error ? error.message : "事实匹配失败", elapsedMs: Date.now() - startedAt, promptSnapshots: baseExecution.capture?.snapshots });
      }).finally(() => {
        clearInterval(heartbeat);
        request.signal.removeEventListener("abort", abort);
        if (!closed) { closed = true; output.close(); }
      });
    },
    cancel() { controller.abort(); request.signal.removeEventListener("abort", abort); },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
