import {
  parseAPIRequest,
  toAPIErrorResponse,
} from "@/lib/ai/api-response";
import { optimizeRequestSchema } from "@/lib/ai/schemas";
import { regenerateOptimizedItemsServer } from "@/services/ai/resumeAgent.server";
import { tracedAIResponse } from "@/lib/studio/response";
import { readWorkflowExecution } from "@/lib/studio/execution";

export async function POST(request: Request) {
  const execution = readWorkflowExecution(request);
  try {
    const { input, style } = await parseAPIRequest(
      request,
      optimizeRequestSchema
    );
    const { optimizedItems, mode } =
      await regenerateOptimizedItemsServer(input, style, execution);
    return tracedAIResponse({ optimizedItems, mode }, mode, execution.capture?.snapshots);
  } catch (error) {
    return toAPIErrorResponse(
      error,
      "优化生成失败，请稍后重试",
      "optimize",
      execution.capture?.snapshots,
    );
  }
}
