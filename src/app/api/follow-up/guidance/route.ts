import { parseAPIRequest, toAPIErrorResponse } from "@/lib/ai/api-response";
import { followUpGuidanceRequestSchema } from "@/lib/ai/schemas";
import { readWorkflowExecution } from "@/lib/studio/execution";
import { tracedAIResponse } from "@/lib/studio/response";
import { generateFollowUpGuidanceServer } from "@/services/ai/resumeAgent.server";

export async function POST(request: Request) {
  try {
    const input = await parseAPIRequest(request, followUpGuidanceRequestSchema);
    const { example, mode } = await generateFollowUpGuidanceServer(input, readWorkflowExecution(request));
    return tracedAIResponse({ example, mode }, mode);
  } catch (error) {
    return toAPIErrorResponse(error, "生成回答结构示范失败，请稍后重试", "follow-up-guidance");
  }
}
