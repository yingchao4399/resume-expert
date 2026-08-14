import {
  parseAPIRequest,
  toAPIErrorResponse,
} from "@/lib/ai/api-response";
import { analyzeRequestSchema } from "@/lib/ai/schemas";
import { analyzeResumeServer } from "@/services/ai/resumeAgent.server";
import { tracedAIResponse } from "@/lib/studio/response";
import { readWorkflowExecution } from "@/lib/studio/execution";

export async function POST(request: Request) {
  const execution = readWorkflowExecution(request);
  try {
    const { input, optimizeStyle, jobTargetContext, careerClaims } = await parseAPIRequest(
      request,
      analyzeRequestSchema
    );
    const { result, mode } = await analyzeResumeServer(input, jobTargetContext, careerClaims, optimizeStyle, execution);
    return tracedAIResponse({ result, mode }, mode, execution.capture?.snapshots);
  } catch (error) {
    return toAPIErrorResponse(error, "分析失败，请稍后重试", "analyze", execution.capture?.snapshots);
  }
}
