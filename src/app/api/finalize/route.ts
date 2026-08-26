import {
  parseAPIRequest,
  toAPIErrorResponse,
} from "@/lib/ai/api-response";
import { finalizeResumeRequestSchema } from "@/lib/ai/schemas";
import { finalizeResumeServer } from "@/services/ai/resumeAgent.server";
import { tracedAIResponse } from "@/lib/studio/response";
import { readWorkflowExecution } from "@/lib/studio/execution";

export async function POST(request: Request) {
  const execution = readWorkflowExecution(request);
  try {
    const { input, style, optimizedItems, followUpQuestions, customInstruction } =
      await parseAPIRequest(request, finalizeResumeRequestSchema);
    const { finalResume, mode } = await finalizeResumeServer(
      input,
      style,
      optimizedItems,
      followUpQuestions,
      execution,
      customInstruction
    );
    return tracedAIResponse({ finalResume, mode }, mode, execution.capture?.snapshots);
  } catch (error) {
    return toAPIErrorResponse(
      error,
      "最终简历生成失败，请稍后重试",
      "finalize",
      execution.capture?.snapshots,
    );
  }
}
