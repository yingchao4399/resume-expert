import { chatCompletionJSON } from "@/lib/ai/client";
import { interviewAnalysisResultSchema } from "@/lib/ai/schemas";
import {
  INTERVIEW_AGENT_SYSTEM_PROMPT,
  buildInterviewAnalysisUserPrompt,
} from "@/lib/ai/interview-prompts";
import type { InterviewAnalysisResult } from "@/types/interview";

export async function runLLMInterviewAnalysis(
  transcriptText: string,
  resumeText: string,
  targetRole: string
): Promise<InterviewAnalysisResult> {
  const result = await chatCompletionJSON({
    system: INTERVIEW_AGENT_SYSTEM_PROMPT,
    user: buildInterviewAnalysisUserPrompt(
      transcriptText,
      resumeText,
      targetRole
    ),
    schema: interviewAnalysisResultSchema,
    schemaName: "interview_analysis",
    strictOutput: false,
    temperature: 0.3,
    maxTokens: 8000,
  });

  return {
    ...result,
    recordingId: result.recordingId || `llm-${Date.now()}`,
  };
}
