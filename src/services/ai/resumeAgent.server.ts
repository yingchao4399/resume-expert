import { getAIConfig } from "@/lib/ai/config";
import type { AIMode } from "@/lib/ai/types";
import {
  runMockFinalizeResume,
  runMockFollowUpBullet,
  runMockRegenerateOptimizedItems,
  runMockResumeAnalysis,
} from "@/services/ai/resumeAgent.mock";
import {
  runLLMFinalizeResume,
  runLLMFollowUpBullet,
  runLLMRegenerateOptimizedItems,
  runLLMResumeAnalysis,
} from "@/services/ai/resumeAgent.llm";
import type { AnalysisResult, OptimizeStyle, UserInput } from "@/types/resume";
import type { WorkflowExecutionOptions } from "@/lib/studio/execution";

function currentMode(forceMock = false): AIMode {
  return forceMock ? "mock" : getAIConfig().mode;
}

export async function analyzeResumeServer(
  input: UserInput,
  optimizeStyle: OptimizeStyle = "ai-product",
  execution: WorkflowExecutionOptions = { forceMock: false }
): Promise<{ result: AnalysisResult; mode: AIMode }> {
  const mode = currentMode(execution.forceMock);

  if (mode === "llm") {
    const result = await runLLMResumeAnalysis(input, optimizeStyle, execution);
    return { result, mode };
  }

  const result = await runMockResumeAnalysis(input, optimizeStyle);
  return { result, mode };
}

export async function regenerateOptimizedItemsServer(
  input: UserInput,
  style: OptimizeStyle,
  execution: WorkflowExecutionOptions = { forceMock: false }
): Promise<{ optimizedItems: AnalysisResult["optimizedItems"]; mode: AIMode }> {
  const mode = currentMode(execution.forceMock);

  if (mode === "llm") {
    const optimizedItems = await runLLMRegenerateOptimizedItems(input, style, execution);
    return { optimizedItems, mode };
  }

  const optimizedItems = await runMockRegenerateOptimizedItems(style);
  return { optimizedItems, mode };
}

export async function generateFollowUpBulletServer(
  input: UserInput,
  question: string,
  purpose: string,
  userAnswer: string,
  execution: WorkflowExecutionOptions = { forceMock: false }
): Promise<{ bullet: string; mode: AIMode }> {
  const mode = currentMode(execution.forceMock);

  if (mode === "llm") {
    const bullet = await runLLMFollowUpBullet(input, question, purpose, userAnswer, execution);
    return { bullet, mode };
  }

  const bullet = await runMockFollowUpBullet(purpose, userAnswer);
  return { bullet, mode };
}

export async function finalizeResumeServer(
  input: UserInput,
  style: OptimizeStyle,
  optimizedItems: AnalysisResult["optimizedItems"],
  followUpQuestions: AnalysisResult["followUpQuestions"],
  execution: WorkflowExecutionOptions = { forceMock: false }
): Promise<{ finalResume: AnalysisResult["finalResume"]; mode: AIMode }> {
  const mode = currentMode(execution.forceMock);

  if (mode === "llm") {
    const finalResume = await runLLMFinalizeResume(input, style, optimizedItems, followUpQuestions, execution);
    return { finalResume, mode };
  }

  const finalResume = await runMockFinalizeResume(input, optimizedItems, followUpQuestions);
  return { finalResume, mode };
}
