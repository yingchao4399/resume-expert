import { getAIConfig } from "@/lib/ai/config";
import type { AIMode } from "@/lib/ai/types";
import {
  runMockFinalizeResume,
  runMockFollowUpBullet,
  runMockRegenerateOptimizedItems,
  runMockResumeAnalysis,
  runMockInterviewPreparation,
} from "@/services/ai/resumeAgent.mock";
import {
  runLLMFinalizeResume,
  runLLMFollowUpGuidance,
  runLLMFollowUpBullet,
  runLLMRegenerateOptimizedItems,
  runLLMResumeAnalysis,
  runLLMInterviewPreparation,
} from "@/services/ai/resumeAgent.llm";
import type { CareerAnalysisClaim } from "@/lib/career/career-context";
import type { AnalysisResult, JobTargetContext, OptimizeStyle, UserInput } from "@/types/resume";
import type { WorkflowExecutionOptions } from "@/lib/studio/execution";
import {
  ANALYSIS_STAGE_COUNT,
  AnalysisExecutionBudget,
  type AnalysisStageId,
} from "@/lib/ai/analysis-execution";

const MOCK_STAGES: Array<{ id: AnalysisStageId; label: string }> = [
  { id: "jd-requirements", label: "生成 JD 需求地图" },
  { id: "match-and-insights", label: "匹配事实并生成岗位概览" },
];

function currentMode(forceMock = false): AIMode {
  return forceMock ? "mock" : getAIConfig().mode;
}

export async function analyzeResumeServer(
  input: UserInput,
  jobTargetContext: JobTargetContext,
  careerClaims: CareerAnalysisClaim[],
  optimizeStyle: OptimizeStyle = "ai-product",
  execution: WorkflowExecutionOptions = { forceMock: false }
): Promise<{ result: AnalysisResult; mode: AIMode }> {
  const mode = currentMode(execution.forceMock);
  const budget = execution.analysisBudget ?? new AnalysisExecutionBudget({ signal: execution.signal });
  const boundedExecution = { ...execution, analysisBudget: budget };
  budget.assertActive();
  execution.onAnalysisProgress?.(budget.progress({ type: "started" }));

  if (mode === "llm") {
    const result = await runLLMResumeAnalysis(input, jobTargetContext, careerClaims, optimizeStyle, boundedExecution);
    return { result, mode };
  }

  const firstStage = MOCK_STAGES[0];
  execution.onAnalysisProgress?.(budget.progress({
    type: "stage-started",
    stage: firstStage.id,
    stageIndex: 1,
    stageCount: ANALYSIS_STAGE_COUNT,
    message: firstStage.label,
  }));
  const result = await runMockResumeAnalysis(input, optimizeStyle, jobTargetContext, careerClaims, execution.signal);
  budget.assertActive();
  for (const [index, stage] of MOCK_STAGES.entries()) {
    if (index > 0) {
      execution.onAnalysisProgress?.(budget.progress({
        type: "stage-started",
        stage: stage.id,
        stageIndex: index + 1,
        stageCount: ANALYSIS_STAGE_COUNT,
        message: stage.label,
      }));
    }
    execution.onAnalysisProgress?.(budget.progress({
      type: "stage-completed",
      stage: stage.id,
      stageIndex: index + 1,
      stageCount: ANALYSIS_STAGE_COUNT,
      message: stage.label,
    }));
  }
  return { result, mode };
}

export async function prepareInterviewServer(
  input: UserInput,
  jobTargetContext: JobTargetContext,
  analysisResult: AnalysisResult,
  execution: WorkflowExecutionOptions = { forceMock: false },
  onBatchProgress?: (progress: { batchIndex: number; batchCount: number; status: "started" | "completed" | "split" }) => void,
): Promise<{ interviewPrep: AnalysisResult["interviewPrep"]; mode: AIMode }> {
  const mode = currentMode(execution.forceMock);
  if (mode === "llm") {
    return { interviewPrep: await runLLMInterviewPreparation(input, jobTargetContext, analysisResult, execution, onBatchProgress), mode };
  }
  return { interviewPrep: await runMockInterviewPreparation(input, jobTargetContext, [], execution.signal), mode };
}

export async function generateFollowUpGuidanceServer(
  input: Parameters<typeof runLLMFollowUpGuidance>[0],
  execution: WorkflowExecutionOptions = { forceMock: false },
): Promise<{ example: string; mode: AIMode }> {
  const mode = currentMode(execution.forceMock);
  if (mode === "llm") return { example: await runLLMFollowUpGuidance(input, execution), mode };
  return { example: "在【你的项目】中，我负责【你的角色】，面对【约束条件】，采取【具体行动】，并按【指标口径】核对后得到【真实结果】。", mode };
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

  const optimizedItems = await runMockRegenerateOptimizedItems(style, input);
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
