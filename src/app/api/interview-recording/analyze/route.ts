import {
  parseAPIRequest,
  toAPIErrorResponse,
} from "@/lib/ai/api-response";
import { interviewAnalyzeRequestSchema } from "@/lib/ai/schemas";
import { analyzeInterviewServer } from "@/services/ai/interviewAgent.server";
import { tracedAIResponse } from "@/lib/studio/response";

export async function POST(request: Request) {
  try {
    const { transcriptText, resumeText, targetRole } = await parseAPIRequest(
      request,
      interviewAnalyzeRequestSchema
    );
    const { result, mode } = await analyzeInterviewServer(
      transcriptText,
      resumeText,
      targetRole
    );
    return tracedAIResponse({ result, mode }, mode);
  } catch (error) {
    return toAPIErrorResponse(
      error,
      "面试分析失败，请稍后重试",
      "interview-recording/analyze"
    );
  }
}
