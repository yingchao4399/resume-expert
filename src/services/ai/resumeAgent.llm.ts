import { chatCompletionJSON } from "@/lib/ai/client";
import {
  diagnosisMatchResultSchema,
  finalResumeResultSchema,
  followUpBulletResultSchema,
  interviewPrepResultSchema,
  jdAnalysisResultSchema,
  optimizedItemsResultSchema,
  optimizeResumeResultSchema,
} from "@/lib/ai/schemas";
import {
  RESUME_AGENT_SYSTEM_PROMPT,
  buildAnalyzeCorePrompt,
  buildAnalyzeDiagnosisPrompt,
  buildAnalyzeInterviewPrompt,
  buildAnalyzeOutputPrompt,
  buildFinalizeResumePrompt,
  buildFollowUpBulletPrompt,
  buildOptimizeUserPrompt,
  normalizeAnalysisResult,
  normalizeFinalResume,
  normalizeOptimizedItems,
} from "@/lib/ai/prompts";
import type { AnalysisResult, OptimizeStyle, UserInput } from "@/types/resume";
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
  optimizeStyle: OptimizeStyle = "ai-product",
  execution: Pick<WorkflowExecutionOptions, "model" | "timeoutMs"> = {}
): Promise<AnalysisResult> {
  const jd = await chatCompletionJSON({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildAnalyzeCorePrompt(input),
    schema: jdAnalysisResultSchema,
    schemaName: "resume_jd_analysis",
    maxTokens: 3000,
    ...execution,
  });

  const diagnosisMatch = await chatCompletionJSON({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildAnalyzeDiagnosisPrompt(input),
    schema: diagnosisMatchResultSchema,
    schemaName: "resume_diagnosis_match",
    maxTokens: 4000,
    ...execution,
  });

  const coreSummary = buildCoreSummary(diagnosisMatch);

  const [optimizeResume, interview] = await Promise.all([
    chatCompletionJSON({
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildAnalyzeOutputPrompt(input, optimizeStyle, coreSummary),
      schema: optimizeResumeResultSchema,
      schemaName: "resume_optimized_output",
      maxTokens: 4500,
      ...execution,
    }),
    chatCompletionJSON({
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildAnalyzeInterviewPrompt(input, coreSummary),
      schema: interviewPrepResultSchema,
      schemaName: "resume_interview_prep",
      maxTokens: 3500,
      ...execution,
    }),
  ]);

  const raw: AnalysisResult = {
    jdAnalysis: jd.jdAnalysis,
    diagnosis: diagnosisMatch.diagnosis,
    matchItems: diagnosisMatch.matchItems,
    followUpQuestions: diagnosisMatch.followUpQuestions,
    optimizedItems: optimizeResume.optimizedItems,
    finalResume: optimizeResume.finalResume,
    interviewPrep: interview.interviewPrep,
  };

  return normalizeAnalysisResult(raw, input);
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
