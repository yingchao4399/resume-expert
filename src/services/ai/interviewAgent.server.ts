import { getAIConfig } from "@/lib/ai/config";
import type { AIMode } from "@/lib/ai/types";
import { runMockInterviewAnalysis } from "@/services/ai/interviewAgent.mock";
import { runLLMInterviewAnalysis } from "@/services/ai/interviewAgent.llm";
import type { InterviewAnalysisResult } from "@/types/interview";
import type { WorkflowExecutionOptions } from "@/lib/studio/execution";

function currentMode(forceMock = false): AIMode {
  return forceMock ? "mock" : getAIConfig().mode;
}

export async function analyzeInterviewServer(
  transcriptText: string,
  resumeText: string,
  targetRole: string,
  execution: WorkflowExecutionOptions = { forceMock: false }
): Promise<{ result: InterviewAnalysisResult; mode: AIMode }> {
  const mode = currentMode(execution.forceMock);

  if (mode === "llm") {
    const result = await runLLMInterviewAnalysis(transcriptText, resumeText, targetRole, execution);
    return { result, mode };
  }

  const result = await runMockInterviewAnalysis(resumeText, targetRole);
  return { result, mode };
}
