import { chatCompletionJSON } from "@/lib/ai/client";
import {
  createCompactJDModelResultSchema,
  createDiagnosisMatchCoreResultSchema,
  createInterviewPrepResultSchema,
  finalResumeResultSchema,
  followUpBulletResultSchema,
  optimizedItemsResultSchema,
  jobOverviewModelResultSchema,
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
import { buildDeepJDPrompt, buildFollowUpGuidancePrompt, buildJobOverviewPrompt, buildRequirementInterviewPrompt, buildRequirementMatchPrompt } from "@/lib/ai/jd-prompts";
import { assembleRequirements, rankCareerClaimsForRequirements, splitJDSourceItems, summarizeRequirementMap, validateMatchReferences } from "@/lib/jd/deep-analysis";
import type { CareerAnalysisClaim } from "@/lib/career/career-context";
import type { AnalysisResult, JobTargetContext, OptimizeStyle, UserInput } from "@/types/resume";
import type { WorkflowExecutionOptions } from "@/lib/studio/execution";
import { StructuredAnalysisExecutor } from "@/lib/ai/structured-analysis-executor";
import {
  ANALYSIS_STAGE_COUNT,
  AnalysisExecutionBudget,
  type AnalysisStageId,
} from "@/lib/ai/analysis-execution";
import { buildConservativeResume } from "@/lib/resume/conservative-resume";
import type { z } from "zod";

type DiagnosisMatchResult = Pick<AnalysisResult, "diagnosis" | "matchItems">;
type DeepJDModelResult = z.infer<ReturnType<typeof createCompactJDModelResultSchema>>;
type InterviewPrepResult = z.infer<ReturnType<typeof createInterviewPrepResultSchema>>;
type JobOverviewResult = z.infer<typeof jobOverviewModelResultSchema>;

function uniqueTexts(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function mergeDeepJDResults(results: DeepJDModelResult[]): DeepJDModelResult {
  return {
    sourceClassifications: results.flatMap((result) => result.sourceClassifications),
    requirements: results.flatMap((result) => result.requirements),
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
  "jd-requirements": { index: 1, label: "生成 JD 需求地图" },
  "match-and-insights": { index: 2, label: "匹配事实并生成岗位概览" },
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
    capture: execution.capture,
    signal: execution.signal,
    analysisBudget: budget,
  };
  const executor = new StructuredAnalysisExecutor(undefined, budget);
  budget.assertActive();
  const sourceItems = splitJDSourceItems(input.jobDescription);
  if (!sourceItems.length) throw new Error("JD 中没有可分析的文本条目。");
  emitStage(execution, budget, "stage-started", "jd-requirements");
  const jdModel = await executor.executeBatched({
    stage: "JD 需求解析",
    items: sourceItems,
    batchSize: 16,
    createRequest: (items, signal) => ({
      promptId: "resume.deep-jd",
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildDeepJDPrompt(input, jobTargetContext, items),
      schema: createCompactJDModelResultSchema(items.map((item) => item.id)),
      schemaName: "compact_jd_requirement_map",
      maxTokens: 6000,
      timeoutMs: 60_000,
      batchSize: items.length,
      analysisStage: "JD 需求解析",
      ...completionExecution,
      signal,
    }),
    merge: mergeDeepJDResults,
    signal: execution.signal,
    onProgress: batchProgress(execution, budget, "jd-requirements"),
  });
  budget.assertActive();

  const classificationById = new Map(jdModel.sourceClassifications.map((item) => [item.sourceItemId, item.classification]));
  const classifiedSources = sourceItems.map((item) => ({ ...item, classification: classificationById.get(item.id) ?? item.classification }));
  const requirements = assembleRequirements(classifiedSources, jdModel.requirements);
  const validatedRequirements = requirements.filter((item) => item.anchorStatus === "validated");
  if (!validatedRequirements.length) throw new Error("模型未能生成可校验的 JD 原文引用，请检查 JD 后重新分析。");
  emitStage(execution, budget, "stage-completed", "jd-requirements");
  const selectedClaims = rankCareerClaimsForRequirements(careerClaims, validatedRequirements, input, 12);

  emitStage(execution, budget, "stage-started", "match-and-insights");
  const [diagnosisMatch, overview] = await Promise.all([
    executor.executeBatched({
      stage: "要求—事实匹配",
      items: validatedRequirements,
      batchSize: 12,
      createRequest: (requirements, signal) => ({
        promptId: "resume.requirement-match",
        system: RESUME_AGENT_SYSTEM_PROMPT,
        user: buildRequirementMatchPrompt(input, jobTargetContext, requirements, selectedClaims),
        schema: createDiagnosisMatchCoreResultSchema(requirements.map((item) => item.id), selectedClaims.map((item) => item.id)),
        schemaName: "requirement_fact_match_core",
        maxTokens: 6000,
        timeoutMs: 60_000,
        batchSize: requirements.length,
        analysisStage: "要求—事实匹配",
        ...completionExecution,
        signal,
      }),
      merge: mergeDiagnosisMatchResults,
      signal: execution.signal,
      onProgress: batchProgress(execution, budget, "match-and-insights"),
    }),
    executor.execute<JobOverviewResult>({
      promptId: "resume.job-overview",
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildJobOverviewPrompt(input, jobTargetContext, validatedRequirements),
      schema: jobOverviewModelResultSchema,
      schemaName: "job_overview",
      maxTokens: 4000,
      timeoutMs: 60_000,
      batchSize: validatedRequirements.length,
      analysisStage: "要求—事实匹配",
      ...completionExecution,
    }),
  ]);
  budget.assertActive();

  const validatedMatches = validateMatchReferences(diagnosisMatch.matchItems, validatedRequirements, selectedClaims, input.originalResume);
  const followUpQuestions: AnalysisResult["followUpQuestions"] = [];
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
  emitStage(execution, budget, "stage-completed", "match-and-insights");
  const summary = summarizeRequirementMap(requirements);

  const raw: AnalysisResult = {
    jdAnalysis: {
      ...summary,
      idealCandidate: overview.idealCandidate,
      sourceItems: classifiedSources, requirements, roleInference: overview.roleInference, clarificationNeeds: overview.clarificationNeeds,
    },
    diagnosis: diagnosisMatch.diagnosis,
    matchItems: validatedMatches,
    followUpQuestions,
    optimizedItems: [],
    finalResume: buildConservativeResume(input),
    interviewPrep: emptyInterviewPrep(),
  };

  budget.assertActive();
  return normalizeAnalysisResult(raw, input);
}

function emptyInterviewPrep(): AnalysisResult["interviewPrep"] {
  return { likelyQuestions: [], evidenceToPrepare: [], possibleExaggerations: [], dataToSupplement: [], selfIntroduction: "", requirementStrategies: [], reverseQuestions: [] };
}

export async function runLLMInterviewPreparation(
  input: UserInput,
  jobTargetContext: JobTargetContext,
  analysisResult: AnalysisResult,
  execution: AnalysisExecution = {},
  onBatchProgress?: (progress: { batchIndex: number; batchCount: number; status: "started" | "completed" | "split" }) => void,
): Promise<AnalysisResult["interviewPrep"]> {
  const requirements = (analysisResult.jdAnalysis.requirements ?? []).filter((item) => item.anchorStatus === "validated");
  if (!requirements.length) throw new Error("当前分析没有可校验的岗位要求，请重新分析后再生成面试策略。");
  const budget = execution.analysisBudget ?? new AnalysisExecutionBudget({ signal: execution.signal });
  const executor = new StructuredAnalysisExecutor(undefined, budget);
  const result = await executor.executeBatched({
    stage: "面试策略",
    items: requirements,
    batchSize: 5,
    createRequest: (batch, signal) => {
      const ids = new Set(batch.map((item) => item.id));
      return {
        promptId: "resume.interview-strategy",
        system: RESUME_AGENT_SYSTEM_PROMPT,
        user: buildRequirementInterviewPrompt(input, jobTargetContext, batch, analysisResult.matchItems.filter((item) => Boolean(item.requirementId && ids.has(item.requirementId))), analysisResult.jdAnalysis.clarificationNeeds ?? []),
        schema: createInterviewPrepResultSchema(batch.map((item) => item.id), (analysisResult.jdAnalysis.clarificationNeeds ?? []).map((item) => item.id)),
        schemaName: "requirement_interview_strategy",
        maxTokens: 6000,
        timeoutMs: 60_000,
        batchSize: batch.length,
        analysisStage: "面试策略",
        model: execution.model,
        capture: execution.capture,
        signal,
      };
    },
    merge: mergeInterviewResults,
    signal: execution.signal,
    onProgress: onBatchProgress,
  });
  budget.assertActive();
  return result.interviewPrep;
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
