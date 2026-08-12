import {
  parseAPIRequest,
  toAPIErrorResponse,
} from "@/lib/ai/api-response";
import { followUpBulletRequestSchema } from "@/lib/ai/schemas";
import { generateFollowUpBulletServer } from "@/services/ai/resumeAgent.server";
import { tracedAIResponse } from "@/lib/studio/response";
import { readWorkflowExecution } from "@/lib/studio/execution";

export async function POST(request: Request) {
  try {
    const { input, question, purpose, userAnswer } = await parseAPIRequest(
      request,
      followUpBulletRequestSchema
    );
    const { bullet, mode } = await generateFollowUpBulletServer(
      input,
      question,
      purpose,
      userAnswer,
      readWorkflowExecution(request)
    );
    return tracedAIResponse({ bullet, mode }, mode);
  } catch (error) {
    return toAPIErrorResponse(
      error,
      "Bullet 生成失败，请稍后重试",
      "follow-up/bullet"
    );
  }
}
