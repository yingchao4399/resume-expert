import {
  parseAPIRequest,
  toAPIErrorResponse,
} from "@/lib/ai/api-response";
import { analyzeRequestSchema } from "@/lib/ai/schemas";
import { analyzeJDDecisionMapServer } from "@/services/ai/jdDecisionAgent.server";
import { tracedAIResponse } from "@/lib/studio/response";
import { readWorkflowExecution } from "@/lib/studio/execution";

export async function POST(request: Request) {
  const execution = readWorkflowExecution(request);
  try {
    const { input, jobTargetContext, materialRevision } = await parseAPIRequest(
      request,
      analyzeRequestSchema
    );
    const { document, mode } = await analyzeJDDecisionMapServer(input, jobTargetContext, materialRevision, execution);
    return tracedAIResponse({ document, mode }, mode, execution.capture?.snapshots);
  } catch (error) {
    return toAPIErrorResponse(error, "分析失败，请稍后重试", "analyze", execution.capture?.snapshots);
  }
}
