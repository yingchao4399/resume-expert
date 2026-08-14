import { analyzeRequestSchema } from "@/lib/ai/schemas";
import { parseAPIRequest, toAPIErrorResponse } from "@/lib/ai/api-response";
import {
  AnalysisExecutionBudget,
  type AnalysisProgressEvent,
  type AnalysisStageId,
} from "@/lib/ai/analysis-execution";
import { AnalysisCancelledError, LLMError, LLMTruncationError } from "@/lib/ai/errors";
import { readWorkflowExecution } from "@/lib/studio/execution";
import { analyzeResumeServer } from "@/services/ai/resumeAgent.server";

const encoder = new TextEncoder();

function stageForError(error: unknown): AnalysisStageId | undefined {
  if (!(error instanceof LLMTruncationError)) return undefined;
  if (error.stage === "JD 需求解析") return "jd-analysis";
  if (error.stage === "要求—事实匹配") return "requirement-match";
  if (error.stage === "面试策略") return "interview-strategy";
  return undefined;
}

export async function POST(request: Request) {
  const baseExecution = readWorkflowExecution(request);
  let payload: ReturnType<typeof analyzeRequestSchema.parse>;
  try {
    payload = await parseAPIRequest(request, analyzeRequestSchema);
  } catch (error) {
    return toAPIErrorResponse(error, "分析请求无效", "analyze/stream");
  }

  const taskController = new AbortController();
  const abortTask = () => taskController.abort();
  request.signal.addEventListener("abort", abortTask, { once: true });
  const budget = new AnalysisExecutionBudget({ signal: taskController.signal });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: AnalysisProgressEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
          taskController.abort();
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        request.signal.removeEventListener("abort", abortTask);
        try {
          controller.close();
        } catch {
          // The browser may already have cancelled the stream.
        }
      };

      void (async () => {
        const execution = {
          ...baseExecution,
          signal: taskController.signal,
          analysisBudget: budget,
          onAnalysisProgress: (event: AnalysisProgressEvent) => send({
            ...event,
            ...(event.type === "stage-completed" && execution.capture?.snapshots.length
              ? { promptSnapshots: [...execution.capture.snapshots] }
              : {}),
          }),
        };
        try {
          const { result, mode } = await analyzeResumeServer(
            payload.input,
            payload.jobTargetContext,
            payload.careerClaims,
            payload.optimizeStyle,
            execution,
          );
          send(budget.progress({
            type: "completed",
            result,
            mode,
            promptSnapshots: execution.capture?.snapshots,
          }));
        } catch (error) {
          if (error instanceof AnalysisCancelledError || taskController.signal.aborted) {
            send(budget.progress({
              type: "cancelled",
              message: "分析已取消，当前材料和已有结果均未改变。",
              promptSnapshots: execution.capture?.snapshots,
            }));
          } else {
            const message = error instanceof Error ? error.message : "分析失败，请稍后重试";
            console.error("[analyze/stream]", error);
            send(budget.progress({
              type: "failed",
              error: message,
              category: error instanceof LLMError ? error.category : undefined,
              stage: stageForError(error),
              promptSnapshots: execution.capture?.snapshots,
            }));
          }
        } finally {
          close();
        }
      })();
    },
    cancel() {
      taskController.abort();
      request.signal.removeEventListener("abort", abortTask);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no",
    },
  });
}
