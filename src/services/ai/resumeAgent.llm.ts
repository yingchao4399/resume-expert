import { chatCompletionJSON } from "@/lib/ai/client";
import {
  createDeepJDModelResultSchema,
  createDiagnosisMatchResultSchema,
  createInterviewPrepResultSchema,
  finalResumeResultSchema,
  followUpBulletResultSchema,
  optimizedItemsResultSchema,
} from "@/lib/ai/schemas";
import { followUpGuidanceResultSchema } from "@/lib/ai/schemas";
import {
  RESUME_AGENT_SYSTEM_PROMPT,
  buildFinalizeResumePrompt,
  buildFollowUpBulletPrompt,
  buildOptimizeUserPrompt,
  normalizeAnalysisResult,
  normalizeFinalResume,
  normalizeOptimizedItems,
} from "@/lib/ai/prompts";
import { buildDeepJDPrompt, buildFollowUpGuidancePrompt, buildRequirementInterviewPrompt, buildRequirementMatchPrompt } from "@/lib/ai/jd-prompts";
import { assembleRequirements, rankCareerClaimsForRequirements, splitJDSourceItems, validateMatchReferences } from "@/lib/jd/deep-analysis";
import type { CareerAnalysisClaim } from "@/lib/career/career-context";
import type { AnalysisResult, JobTargetContext, OptimizeStyle, UserInput } from "@/types/resume";
import type { WorkflowExecutionOptions } from "@/lib/studio/execution";
import { runWithTruncationFallback } from "@/lib/ai/truncation-fallback";
import {
  ANALYSIS_STAGE_COUNT,
  AnalysisExecutionBudget,
  type AnalysisStageId,
} from "@/lib/ai/analysis-execution";
import { buildConservativeResume } from "@/lib/resume/conservative-resume";
import type { z } from "zod";

type DiagnosisMatchResult = Pick<
  AnalysisResult,
  "diagnosis" | "matchItems" | "followUpQuestions"
>;
type DeepJDModelResult = z.infer<ReturnType<typeof createDeepJDModelResultSchema>>;
type InterviewPrepResult = z.infer<ReturnType<typeof createInterviewPrepResultSchema>>;

function uniqueTexts(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function mergeDeepJDResults(results: DeepJDModelResult[]): DeepJDModelResult {
  const inferenceRank = { explicit: 3, inferred: 2, unknown: 1 } as const;
  const inferenceByTopic = new Map<string, DeepJDModelResult["roleInference"]["items"][number]>();
  for (const item of results.flatMap((result) => result.roleInference.items)) {
    const current = inferenceByTopic.get(item.topic);
    if (!current || inferenceRank[item.level] > inferenceRank[current.level]) inferenceByTopic.set(item.topic, item);
  }
  const clarificationNeeds = results.flatMap((result) => result.clarificationNeeds)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.topic === item.topic && candidate.missingInformation === item.missingInformation) === index)
    .map((item, index) => ({ ...item, id: `clarification-${index + 1}` }));
  return {
    sourceClassifications: results.flatMap((result) => result.sourceClassifications),
    requirements: results.flatMap((result) => result.requirements),
    responsibilities: uniqueTexts(results.flatMap((result) => result.responsibilities)).slice(0, 12),
    hardRequirements: uniqueTexts(results.flatMap((result) => result.hardRequirements)).slice(0, 12),
    implicitRequirements: uniqueTexts(results.flatMap((result) => result.implicitRequirements)).slice(0, 12),
    keywords: uniqueTexts(results.flatMap((result) => result.keywords)).slice(0, 30),
    idealCandidate: results.map((result) => result.idealCandidate.trim()).filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? "",
    coreCompetencies: results.flatMap((result) => result.coreCompetencies)
      .filter((item, index, all) => all.findIndex((candidate) => candidate.name === item.name) === index).slice(0, 12),
    roleInference: { items: [...inferenceByTopic.values()] },
    clarificationNeeds,
  };
}

function mergeDiagnosisMatchResults(results: DiagnosisMatchResult[]): DiagnosisMatchResult {
  const scores = results.map((result) => result.diagnosis.overallScore);
  return {
    diagnosis: {
      overallScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
      dimensionScores: results.flatMap((result) => result.diagnosis.dimensionScores)
        .filter((item, index, all) => all.findIndex((candidate) => candidate.dimension === item.dimension) === index),
      mainIssues: uniqueTexts(results.flatMap((result) => result.diagnosis.mainIssues)),
      prioritySuggestions: uniqueTexts(results.flatMap((result) => result.diagnosis.prioritySuggestions)),
    },
    matchItems: results.flatMap((result) => result.matchItems),
    followUpQuestions: results.flatMap((result) => result.followUpQuestions)
      .filter((item, index, all) => all.findIndex((candidate) => candidate.requirementId === item.requirementId) === index)
      .slice(0, 10)
      .map((item, index) => ({ ...item, id: `fu-${index + 1}` })),
  };
}

function mergeInterviewResults(results: InterviewPrepResult[]): InterviewPrepResult {
  const preps = results.map((result) => result.interviewPrep);
  return { interviewPrep: {
    likelyQuestions: preps.flatMap((prep) => prep.likelyQuestions)
      .filter((item, index, all) => all.findIndex((candidate) => candidate.question === item.question) === index).slice(0, 10),
    evidenceToPrepare: uniqueTexts(preps.flatMap((prep) => prep.evidenceToPrepare)),
    possibleExaggerations: uniqueTexts(preps.flatMap((prep) => prep.possibleExaggerations)),
    dataToSupplement: uniqueTexts(preps.flatMap((prep) => prep.dataToSupplement)),
    selfIntroduction: preps.map((prep) => prep.selfIntroduction.trim()).filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? "",
    requirementStrategies: preps.flatMap((prep) => prep.requirementStrategies)
      .filter((item, index, all) => all.findIndex((candidate) => candidate.requirementId === item.requirementId) === index),
    reverseQuestions: preps.flatMap((prep) => prep.reverseQuestions)
      .filter((item, index, all) => all.findIndex((candidate) => candidate.question === item.question) === index)
      .map((item, index) => ({ ...item, id: `reverse-${index + 1}` })),
  } };
}

type AnalysisExecution = Pick<
  WorkflowExecutionOptions,
  "model" | "timeoutMs" | "capture" | "signal" | "analysisBudget" | "onAnalysisProgress"
>;

const ANALYSIS_STAGE_DETAILS: Record<AnalysisStageId, { index: number; label: string }> = {
  "jd-analysis": { index: 1, label: "解析 JD 需求" },
  "requirement-match": { index: 2, label: "匹配经历事实" },
  "interview-strategy": { index: 3, label: "生成面试策略" },
};

function emitStage(
  execution: AnalysisExecution,
  budget: AnalysisExecutionBudget,
  type: "stage-started" | "stage-completed",
  stage: AnalysisStageId,
): void {
  const detail = ANALYSIS_STAGE_DETAILS[stage];
  execution.onAnalysisProgress?.(budget.progress({
    type,
    stage,
    stageIndex: detail.index,
    stageCount: ANALYSIS_STAGE_COUNT,
    message: detail.label,
  }));
}

function batchProgress(
  execution: AnalysisExecution,
  budget: AnalysisExecutionBudget,
  stage: AnalysisStageId,
) {
  return (progress: { batchIndex: number; batchCount: number; status: "started" | "completed" | "split" }) => {
    const detail = ANALYSIS_STAGE_DETAILS[stage];
    const action = progress.status === "started" ? "正在处理" : progress.status === "completed" ? "已完成" : "输出截断，拆分重试";
    execution.onAnalysisProgress?.(budget.progress({
      type: "batch-progress",
      stage,
      stageIndex: detail.index,
      stageCount: ANALYSIS_STAGE_COUNT,
      batchIndex: progress.batchIndex,
      batchCount: progress.batchCount,
      batchStatus: progress.status,
      message: `${action}第 ${progress.batchIndex}/${progress.batchCount} 批`,
    }));
  };
}

export async function runLLMResumeAnalysis(
  input: UserInput,
  jobTargetContext: JobTargetContext,
  careerClaims: CareerAnalysisClaim[],
  _optimizeStyle: OptimizeStyle = "ai-product",
  execution: AnalysisExecution = {},
): Promise<AnalysisResult> {
  void _optimizeStyle;
  const budget = execution.analysisBudget ?? new AnalysisExecutionBudget({ signal: execution.signal });
  const completionExecution = {
    model: execution.model,
    timeoutMs: execution.timeoutMs,
    capture: execution.capture,
    signal: execution.signal,
    analysisBudget: budget,
  };
  budget.assertActive();
  const sourceItems = splitJDSourceItems(input.jobDescription);
  if (!sourceItems.length) throw new Error("JD 中没有可分析的文本条目。");
  emitStage(execution, budget, "stage-started", "jd-analysis");
  const jdModel = await runWithTruncationFallback({
    stage: "JD 需求解析",
    items: sourceItems,
    run: (items, signal) => chatCompletionJSON({
      promptId: "resume.deep-jd",
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildDeepJDPrompt(input, jobTargetContext, items),
      schema: createDeepJDModelResultSchema(items.map((item) => item.id)),
      schemaName: "deep_jd_requirement_map",
      maxTokens: 12000,
      analysisStage: "JD 需求解析",
      ...completionExecution,
      signal,
    }),
    merge: mergeDeepJDResults,
    signal: execution.signal,
    onProgress: batchProgress(execution, budget, "jd-analysis"),
  });
  budget.assertActive();

  const classificationById = new Map(jdModel.sourceClassifications.map((item) => [item.sourceItemId, item.classification]));
  const classifiedSources = sourceItems.map((item) => ({ ...item, classification: classificationById.get(item.id) ?? item.classification }));
  const requirements = assembleRequirements(classifiedSources, jdModel.requirements);
  const validatedRequirements = requirements.filter((item) => item.anchorStatus === "validated");
  if (!validatedRequirements.length) throw new Error("模型未能生成可校验的 JD 原文引用，请检查 JD 后重新分析。");
  emitStage(execution, budget, "stage-completed", "jd-analysis");
  const selectedClaims = rankCareerClaimsForRequirements(careerClaims, validatedRequirements, input, 12);

  emitStage(execution, budget, "stage-started", "requirement-match");
  const diagnosisMatch = await runWithTruncationFallback({
    stage: "要求—事实匹配",
    items: validatedRequirements,
    run: (requirements, signal) => chatCompletionJSON({
      promptId: "resume.requirement-match",
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildRequirementMatchPrompt(input, jobTargetContext, requirements, selectedClaims),
      schema: createDiagnosisMatchResultSchema(requirements.map((item) => item.id), selectedClaims.map((item) => item.id)),
      schemaName: "requirement_fact_match",
      maxTokens: 12000,
      analysisStage: "要求—事实匹配",
      ...completionExecution,
      signal,
    }),
    merge: mergeDiagnosisMatchResults,
    signal: execution.signal,
    onProgress: batchProgress(execution, budget, "requirement-match"),
  });
  budget.assertActive();

  const validatedMatches = validateMatchReferences(diagnosisMatch.matchItems, validatedRequirements, selectedClaims, input.originalResume);
  const followUpQuestions = [...diagnosisMatch.followUpQuestions];
  for (const match of validatedMatches.filter((item) => item.needsSupplement)) {
    if (followUpQuestions.length >= 10 || followUpQuestions.some((item) => item.requirementId === match.requirementId)) continue;
    followUpQuestions.push({
      id: `fu-${followUpQuestions.length + 1}`,
      requirementId: match.requirementId,
      question: `请提供能证明“${match.jdRequirement}”的真实经历；如果没有，也请如实说明。`,
      purpose: `补充“${match.jdRequirement}”的可核验证据`,
      thinkingPrompts: ["当时是什么业务场景？", "你本人具体做了什么？", "结果如何验证？"],
      answerFramework: ["场景", "个人职责", "关键行动", "结果与口径"],
      honestNoExperience: "如实说明暂无直接经历，再补充最相近的可迁移经验和具体学习计划。",
      placeholderExample: "",
      userAnswer: "",
      generatedBullet: "",
    });
  }
  emitStage(execution, budget, "stage-completed", "requirement-match");

  emitStage(execution, budget, "stage-started", "interview-strategy");
  const interview = await runWithTruncationFallback({
    stage: "面试策略",
    items: validatedRequirements,
    run: (requirements, signal) => {
      const ids = new Set(requirements.map((item) => item.id));
      return chatCompletionJSON({
        promptId: "resume.interview-strategy",
        system: RESUME_AGENT_SYSTEM_PROMPT,
        user: buildRequirementInterviewPrompt(input, jobTargetContext, requirements, validatedMatches.filter((item) => Boolean(item.requirementId && ids.has(item.requirementId))), jdModel.clarificationNeeds),
        schema: createInterviewPrepResultSchema(requirements.map((item) => item.id), jdModel.clarificationNeeds.map((item) => item.id)),
        schemaName: "requirement_interview_strategy",
        maxTokens: 12000,
        analysisStage: "面试策略",
        ...completionExecution,
        signal,
      });
    },
    merge: mergeInterviewResults,
    signal: execution.signal,
    onProgress: batchProgress(execution, budget, "interview-strategy"),
  });
  budget.assertActive();
  emitStage(execution, budget, "stage-completed", "interview-strategy");

  const raw: AnalysisResult = {
    jdAnalysis: {
      responsibilities: jdModel.responsibilities, hardRequirements: jdModel.hardRequirements,
      implicitRequirements: jdModel.implicitRequirements, keywords: jdModel.keywords,
      idealCandidate: jdModel.idealCandidate, coreCompetencies: jdModel.coreCompetencies,
      sourceItems: classifiedSources, requirements, roleInference: jdModel.roleInference, clarificationNeeds: jdModel.clarificationNeeds,
    },
    diagnosis: diagnosisMatch.diagnosis,
    matchItems: validatedMatches,
    followUpQuestions,
    optimizedItems: [],
    finalResume: buildConservativeResume(input),
    interviewPrep: interview.interviewPrep,
  };

  budget.assertActive();
  return normalizeAnalysisResult(raw, input);
}

export async function runLLMFollowUpGuidance(
  input: Parameters<typeof buildFollowUpGuidancePrompt>[0],
  execution: Pick<WorkflowExecutionOptions, "model" | "timeoutMs" | "capture"> = {},
): Promise<string> {
  const result = await chatCompletionJSON({
    promptId: "resume.follow-up-guidance",
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildFollowUpGuidancePrompt(input),
    schema: followUpGuidanceResultSchema,
    schemaName: "follow_up_placeholder_guidance",
    temperature: 0.2,
    maxTokens: 600,
    ...execution,
  });
  return result.example.trim();
}

export async function runLLMRegenerateOptimizedItems(
  input: UserInput,
  style: OptimizeStyle,
  execution: Pick<WorkflowExecutionOptions, "model" | "timeoutMs" | "capture"> = {}
): Promise<AnalysisResult["optimizedItems"]> {
  const raw = await chatCompletionJSON({
    promptId: "resume.optimize-items",
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildOptimizeUserPrompt(input, style),
    schema: optimizedItemsResultSchema,
    schemaName: "resume_optimized_items",
    temperature: 0.5,
    maxTokens: 4000,
    ...execution,
  });

  return normalizeOptimizedItems(raw.optimizedItems);
}

export async function runLLMFollowUpBullet(
  input: UserInput,
  question: string,
  purpose: string,
  userAnswer: string,
  execution: Pick<WorkflowExecutionOptions, "model" | "timeoutMs" | "capture"> = {}
): Promise<string> {
  const raw = await chatCompletionJSON({
    promptId: "resume.follow-up-bullet",
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildFollowUpBulletPrompt(input, question, purpose, userAnswer),
    schema: followUpBulletResultSchema,
    schemaName: "resume_follow_up_bullet",
    temperature: 0.3,
    maxTokens: 500,
    ...execution,
  });

  return raw.bullet.trim();
}

export async function runLLMFinalizeResume(
  input: UserInput,
  style: OptimizeStyle,
  optimizedItems: AnalysisResult["optimizedItems"],
  followUpQuestions: AnalysisResult["followUpQuestions"],
  execution: Pick<WorkflowExecutionOptions, "model" | "timeoutMs" | "capture"> = {}
): Promise<AnalysisResult["finalResume"]> {
  const raw = await chatCompletionJSON({
    promptId: "resume.finalize",
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildFinalizeResumePrompt(
      input,
      style,
      optimizedItems,
      followUpQuestions
    ),
    schema: finalResumeResultSchema,
    schemaName: "resume_final_document",
    temperature: 0.2,
    maxTokens: 5000,
    ...execution,
  });

  return normalizeFinalResume(raw.finalResume, input);
}
