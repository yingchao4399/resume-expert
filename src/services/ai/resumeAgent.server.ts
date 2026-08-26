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
  runLLMKeywordEnhancement,
  runLLMResumeAnalysis,
  runLLMInterviewPreparation,
} from "@/services/ai/resumeAgent.llm";
import type { CareerAnalysisClaim } from "@/lib/career/career-context";
import type { AnalysisResult, JobTargetContext, OptimizeStyle, UserInput } from "@/types/resume";
import type { KeywordEnhancementDraft } from "@/types/resume";
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
  execution: WorkflowExecutionOptions = { forceMock: false },
  customInstruction = ""
): Promise<{ optimizedItems: AnalysisResult["optimizedItems"]; mode: AIMode }> {
  const mode = currentMode(execution.forceMock);

  if (mode === "llm") {
    const optimizedItems = await runLLMRegenerateOptimizedItems(input, style, execution, customInstruction);
    return { optimizedItems, mode };
  }

  const optimizedItems = await runMockRegenerateOptimizedItems(style, input);
  return { optimizedItems, mode };
}

export async function enhanceMissingKeywordsServer(
  input: UserInput,
  items: Array<{ itemId: string; section: string; currentText: string; selectedKeywords: string[]; evidence: Array<{ id: string; text: string }> }>,
  allowedKeywords: string[],
  customInstruction: string,
  execution: WorkflowExecutionOptions = { forceMock: false },
): Promise<{ enhancements: KeywordEnhancementDraft[]; mode: AIMode }> {
  const mode = currentMode(execution.forceMock);
  const allowed = new Set(allowedKeywords.map(normalizeKeyword));
  for (const item of items) {
    if (item.selectedKeywords.some((keyword) => !allowed.has(normalizeKeyword(keyword)))) {
      throw new Error(`优化项 ${item.itemId} 包含未确认的 JD 关键词。`);
    }
  }

  const model = mode === "llm"
    ? await runLLMKeywordEnhancement(input, items, customInstruction, execution)
    : { enhancements: items.map((item) => {
        const supported = item.selectedKeywords.filter((keyword) => item.evidence.some((evidence) => normalizeKeyword(evidence.text).includes(normalizeKeyword(keyword))));
        return {
          itemId: item.itemId,
          enhancedText: supported.length ? `${item.currentText}（相关能力：${supported.join("、")}）` : item.currentText,
          appliedKeywords: supported,
          evidenceClaimIds: item.evidence.filter((evidence) => supported.some((keyword) => normalizeKeyword(evidence.text).includes(normalizeKeyword(keyword)))).map((evidence) => evidence.id),
          foundEvidence: supported,
          missingEvidence: item.selectedKeywords.filter((keyword) => !supported.includes(keyword)),
          riskWarnings: supported.length === item.selectedKeywords.length ? [] : ["Mock 不会补造缺少证据的关键词，请由用户核验或补正事实。"],
        };
      }) };

  const inputById = new Map(items.map((item) => [item.itemId, item]));
  const rawById = new Map(model.enhancements.map((item) => [item.itemId, item]));
  if (inputById.size !== items.length) throw new Error("请求中存在重复的优化项 ID。");
  if (model.enhancements.length !== items.length || rawById.size !== model.enhancements.length) throw new Error("模型返回了重复或缺失的优化项。");
  const generatedAt = new Date().toISOString();
  const enhancements = items.map((item) => {
    const raw = rawById.get(item.itemId);
    if (!raw) throw new Error(`模型遗漏了优化项 ${item.itemId}。`);
    const selected = new Set(item.selectedKeywords.map(normalizeKeyword));
    const evidenceIds = new Set(item.evidence.map((evidence) => evidence.id));
    if (raw.appliedKeywords.some((keyword) => !selected.has(normalizeKeyword(keyword)))) throw new Error(`模型为 ${item.itemId} 返回了未选择的关键词。`);
    if (raw.evidenceClaimIds.some((id) => !evidenceIds.has(id))) throw new Error(`模型为 ${item.itemId} 返回了不存在的事实引用。`);
    const missing = item.selectedKeywords.filter((keyword) => !raw.appliedKeywords.some((applied) => normalizeKeyword(applied) === normalizeKeyword(keyword)) || raw.missingEvidence.some((value) => normalizeKeyword(value).includes(normalizeKeyword(keyword))));
    const status = raw.evidenceClaimIds.length === 0 ? "missing" : missing.length ? "partial" : "supported";
    return {
      id: `keyword-enhancement:${item.itemId}:${hashText(item.selectedKeywords.join("|"))}`,
      itemId: item.itemId,
      selectedKeywords: item.selectedKeywords,
      enhancedText: raw.enhancedText,
      sourceAfter: item.currentText,
      evidenceStatus: status,
      evidenceClaimIds: raw.evidenceClaimIds,
      evidenceCorrectionSourceIds: [],
      foundEvidence: item.evidence.filter((evidence) => raw.evidenceClaimIds.includes(evidence.id)).map((evidence) => evidence.text),
      missingEvidence: raw.missingEvidence,
      riskWarnings: raw.riskWarnings,
      adoptionStatus: "unverified",
      generatedAt,
      verifiedAt: null,
    } satisfies KeywordEnhancementDraft;
  });
  if (rawById.size !== inputById.size) throw new Error("模型返回了重复或未知的优化项。");
  return { enhancements, mode };
}

function normalizeKeyword(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s\u3000·•,，。:：;；()（）/\\_-]+/g, "");
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
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
  execution: WorkflowExecutionOptions = { forceMock: false },
  customInstruction = ""
): Promise<{ finalResume: AnalysisResult["finalResume"]; mode: AIMode }> {
  const mode = currentMode(execution.forceMock);

  if (mode === "llm") {
    const finalResume = await runLLMFinalizeResume(input, style, optimizedItems, followUpQuestions, execution, customInstruction);
    return { finalResume, mode };
  }

  const finalResume = await runMockFinalizeResume(input, optimizedItems, followUpQuestions);
  return { finalResume, mode };
}
