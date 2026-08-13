import { chatCompletionJSON } from "@/lib/ai/client";
import {
  createDeepJDModelResultSchema,
  createDiagnosisMatchResultSchema,
  createInterviewPrepResultSchema,
  finalResumeResultSchema,
  followUpBulletResultSchema,
  optimizedItemsResultSchema,
  optimizeResumeResultSchema,
} from "@/lib/ai/schemas";
import { followUpGuidanceResultSchema } from "@/lib/ai/schemas";
import {
  RESUME_AGENT_SYSTEM_PROMPT,
  buildAnalyzeOutputPrompt,
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

type DiagnosisMatchResult = Pick<
  AnalysisResult,
  "diagnosis" | "matchItems" | "followUpQuestions"
>;

function buildCoreSummary(parts: DiagnosisMatchResult): string {
  return [
    `匹配度：${parts.diagnosis.overallScore}/100`,
    `主要问题：${parts.diagnosis.mainIssues.slice(0, 3).join("；") || "无"}`,
    `优先建议：${parts.diagnosis.prioritySuggestions.slice(0, 3).join("；") || "无"}`,
    `关键缺口：${
      parts.matchItems
        .filter((item) => item.needsSupplement)
        .slice(0, 4)
        .map((item) => item.jdRequirement)
        .join("；") || "无"
    }`,
  ].join("\n");
}

export async function runLLMResumeAnalysis(
  input: UserInput,
  jobTargetContext: JobTargetContext,
  careerClaims: CareerAnalysisClaim[],
  optimizeStyle: OptimizeStyle = "ai-product",
  execution: Pick<WorkflowExecutionOptions, "model" | "timeoutMs"> = {}
): Promise<AnalysisResult> {
  const sourceItems = splitJDSourceItems(input.jobDescription);
  if (!sourceItems.length) throw new Error("JD 中没有可分析的文本条目。");
  const jdModel = await chatCompletionJSON({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildDeepJDPrompt(input, jobTargetContext, sourceItems),
    schema: createDeepJDModelResultSchema(sourceItems.map((item) => item.id)),
    schemaName: "deep_jd_requirement_map",
    maxTokens: 12000,
    ...execution,
  });

  const classificationById = new Map(jdModel.sourceClassifications.map((item) => [item.sourceItemId, item.classification]));
  const classifiedSources = sourceItems.map((item) => ({ ...item, classification: classificationById.get(item.id) ?? item.classification }));
  const requirements = assembleRequirements(classifiedSources, jdModel.requirements);
  const validatedRequirements = requirements.filter((item) => item.anchorStatus === "validated");
  if (!validatedRequirements.length) throw new Error("模型未能生成可校验的 JD 原文引用，请检查 JD 后重新分析。");
  const selectedClaims = rankCareerClaimsForRequirements(careerClaims, validatedRequirements, input, 12);

  const diagnosisMatch = await chatCompletionJSON({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildRequirementMatchPrompt(input, jobTargetContext, validatedRequirements, selectedClaims),
    schema: createDiagnosisMatchResultSchema(validatedRequirements.map((item) => item.id), selectedClaims.map((item) => item.id)),
    schemaName: "requirement_fact_match",
    maxTokens: 12000,
    ...execution,
  });

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

  const coreSummary = buildCoreSummary(diagnosisMatch);

  const interview = await chatCompletionJSON({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildRequirementInterviewPrompt(input, jobTargetContext, validatedRequirements, validatedMatches, jdModel.clarificationNeeds),
    schema: createInterviewPrepResultSchema(validatedRequirements.map((item) => item.id), jdModel.clarificationNeeds.map((item) => item.id)),
    schemaName: "requirement_interview_strategy",
    maxTokens: 12000,
    ...execution,
  });

  const optimizeResume = await chatCompletionJSON({
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildAnalyzeOutputPrompt(input, optimizeStyle, coreSummary),
      schema: optimizeResumeResultSchema,
      schemaName: "resume_optimized_output",
      maxTokens: 4500,
      ...execution,
  });

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
    optimizedItems: optimizeResume.optimizedItems,
    finalResume: optimizeResume.finalResume,
    interviewPrep: interview.interviewPrep,
  };

  return normalizeAnalysisResult(raw, input);
}

export async function runLLMFollowUpGuidance(
  input: Parameters<typeof buildFollowUpGuidancePrompt>[0],
  execution: Pick<WorkflowExecutionOptions, "model" | "timeoutMs"> = {},
): Promise<string> {
  const result = await chatCompletionJSON({
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
  execution: Pick<WorkflowExecutionOptions, "model" | "timeoutMs"> = {}
): Promise<AnalysisResult["optimizedItems"]> {
  const raw = await chatCompletionJSON({
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
  execution: Pick<WorkflowExecutionOptions, "model" | "timeoutMs"> = {}
): Promise<string> {
  const raw = await chatCompletionJSON({
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
  execution: Pick<WorkflowExecutionOptions, "model" | "timeoutMs"> = {}
): Promise<AnalysisResult["finalResume"]> {
  const raw = await chatCompletionJSON({
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
