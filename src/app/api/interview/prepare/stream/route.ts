import { interviewPrepareRequestSchema } from "@/lib/ai/schemas";
import { parseAPIRequest, toAPIErrorResponse } from "@/lib/ai/api-response";
import { AnalysisExecutionBudget } from "@/lib/ai/analysis-execution";
import { AnalysisCancelledError, LLMError } from "@/lib/ai/errors";
import { createInterviewProgressClock, type InterviewPreparationProgressEvent } from "@/lib/ai/interview-preparation";
import { readWorkflowExecution } from "@/lib/studio/execution";
import { prepareInterviewServer } from "@/services/ai/resumeAgent.server";

const encoder = new TextEncoder();

export async function POST(request: Request) {
  const baseExecution = readWorkflowExecution(request);
  let payload: ReturnType<typeof interviewPrepareRequestSchema.parse>;
  try {
    payload = await parseAPIRequest(request, interviewPrepareRequestSchema);
  } catch (error) {
    return toAPIErrorResponse(error, "面试策略请求无效", "interview/prepare/stream");
  }

  const taskController = new AbortController();
  const abortTask = () => taskController.abort();
  request.signal.addEventListener("abort", abortTask, { once: true });
  const startedAt = Date.now();
  const budget = new AnalysisExecutionBudget({ signal: taskController.signal, startedAt, deadlineAt: startedAt + 180_000 });
  const clock = createInterviewProgressClock(startedAt, budget.requestId);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let currentBatch: { index: number; count: number } | undefined;
      const send = (event: InterviewPreparationProgressEvent) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); }
        catch { closed = true; taskController.abort(); }
      };
      const heartbeat = setInterval(() => send(clock.event({ type: "heartbeat", message: currentBatch ? `模型仍在处理第 ${currentBatch.index}/${currentBatch.count} 批` : "模型仍在准备面试策略" })), 5_000);
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        request.signal.removeEventListener("abort", abortTask);
        try { controller.close(); } catch { /* browser already cancelled */ }
      };
      void (async () => {
        const execution = { ...baseExecution, signal: taskController.signal, analysisBudget: budget };
        send(clock.event({ type: "started", message: "开始生成面试策略" }));
        try {
          const { interviewPrep, mode } = await prepareInterviewServer(payload.input, payload.jobTargetContext, payload.analysisResult, execution, (progress) => {
            currentBatch = { index: progress.batchIndex, count: progress.batchCount };
            send(clock.event({ type: "batch-progress", batchIndex: progress.batchIndex, batchCount: progress.batchCount, batchStatus: progress.status, message: `${progress.status === "completed" ? "已完成" : progress.status === "split" ? "截断后拆分" : "正在处理"}第 ${progress.batchIndex}/${progress.batchCount} 批` }));
          });
          send(clock.event({ type: "completed", interviewPrep, mode, promptSnapshots: execution.capture?.snapshots }));
        } catch (error) {
          if (error instanceof AnalysisCancelledError || taskController.signal.aborted) send(clock.event({ type: "cancelled", message: "面试策略生成已取消，已有内容未改变。", promptSnapshots: execution.capture?.snapshots }));
          else {
            console.error("[interview/prepare/stream]", error);
            send(clock.event({ type: "failed", error: error instanceof Error ? error.message : "面试策略生成失败", category: error instanceof LLMError ? error.category : undefined, promptSnapshots: execution.capture?.snapshots }));
          }
        } finally { close(); }
      })();
    },
    cancel() { taskController.abort(); request.signal.removeEventListener("abort", abortTask); },
  });

  return new Response(stream, { status: 200, headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate, no-transform", "X-Content-Type-Options": "nosniff", "X-Accel-Buffering": "no" } });
}
