import { parseAPIRequest, toAPIErrorResponse } from "@/lib/ai/api-response";
import { keywordEnhancementRequestSchema } from "@/lib/ai/schemas";
import { readWorkflowExecution } from "@/lib/studio/execution";
import { tracedAIResponse } from "@/lib/studio/response";
import { enhanceMissingKeywordsServer } from "@/services/ai/resumeAgent.server";

export async function POST(request: Request) {
  const execution = readWorkflowExecution(request);
  try {
    const { input, items, allowedKeywords, customInstruction } = await parseAPIRequest(request, keywordEnhancementRequestSchema);
    const result = await enhanceMissingKeywordsServer(input, items, allowedKeywords, customInstruction, execution);
    return tracedAIResponse(result, result.mode, execution.capture?.snapshots);
  } catch (error) {
    return toAPIErrorResponse(error, "缺失关键词增强失败，请核对关键词和证据后重试", "optimize", execution.capture?.snapshots);
  }
}
