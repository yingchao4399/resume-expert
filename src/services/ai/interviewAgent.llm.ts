import { chatCompletionJSON } from "@/lib/ai/client";
import { interviewAnalysisResultSchema } from "@/lib/ai/schemas";
import {
  INTERVIEW_AGENT_SYSTEM_PROMPT,
  buildInterviewAnalysisUserPrompt,
} from "@/lib/ai/interview-prompts";
import type { InterviewAnalysisResult } from "@/types/interview";
import type { WorkflowExecutionOptions } from "@/lib/studio/execution";

export async function runLLMInterviewAnalysis(
  transcriptText: string,
  resumeText: string,
  targetRole: string,
  execution: Pick<WorkflowExecutionOptions, "model" | "timeoutMs" | "capture"> = {}
): Promise<InterviewAnalysisResult> {
  const result = await chatCompletionJSON({
    promptId: "interview.review",
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
    ...execution,
  });

  return {
    ...result,
    recordingId: result.recordingId || `llm-${Date.now()}`,
  };
}
