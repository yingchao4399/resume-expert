import { getAIConfig } from "@/lib/ai/config";
import type { AIMode } from "@/lib/ai/types";
import { runMockInterviewAnalysis } from "@/services/ai/interviewAgent.mock";
import { runLLMInterviewAnalysis } from "@/services/ai/interviewAgent.llm";
import type { InterviewAnalysisResult } from "@/types/interview";

function currentMode(): AIMode {
  return getAIConfig().mode;
}

export async function analyzeInterviewServer(
  transcriptText: string,
  resumeText: string,
  targetRole: string
): Promise<{ result: InterviewAnalysisResult; mode: AIMode }> {
  const mode = currentMode();

  if (mode === "llm") {
    const result = await runLLMInterviewAnalysis(transcriptText, resumeText, targetRole);
    return { result, mode };
  }

  const result = await runMockInterviewAnalysis(resumeText, targetRole);
  return { result, mode };
}
