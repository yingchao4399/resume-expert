import {
  CALLABLE_PROMPT_IDS,
  type PromptDefinition,
  type PromptId,
  type PromptSourceRef,
} from "@/lib/studio/prompt-types";

const prompts = (path: string, symbol: string): PromptSourceRef => ({ path, symbol, kind: "user-prompt-template" });
const system = (path: string, symbol: string): PromptSourceRef => ({ path, symbol, kind: "system-prompt" });
const schema = (path: string, symbol: string): PromptSourceRef => ({ path, symbol, kind: "output-schema" });
const policy = (): PromptSourceRef => ({ path: "src/lib/ai/presets.ts", kind: "model-policy" });

const resumeSystem = system("src/lib/ai/prompts.ts", "RESUME_AGENT_SYSTEM_PROMPT");
const aiSchemaSource = "src/lib/ai/schemas.ts";

export const PROMPT_REGISTRY: PromptDefinition[] = [
  definition("resume.jd-consolidation", "JD 全局语义归并", "归并同义要求并整理核心分组；保留独立细则及全部原文出处，变更须核验。", "岗位分析", "analyze", "jd-consolidation-v1", ["document"], "jd_semantic_consolidation", [system("src/lib/ai/consolidation-prompts.ts", "JD_CONSOLIDATION_SYSTEM"), prompts("src/lib/ai/consolidation-prompts.ts", "buildConsolidationPrompt"), schema("src/lib/jd/consolidation.ts", "consolidationModelSchema"), policy()], "buildConsolidationPrompt({{document}})", ["eval:jd", "eval:consolidation"], { timeoutMs: 60000, maxTokens: 8000, temperature: 0.1 }),
  definition("resume.deep-jd", "深度 JD 解析", "把 JD 原始条目拆成等待用户确认的可追溯原子要求。", "岗位分析", "analyze", "deep-jd-v5", ["input", "jobTargetContext", "sourceItems"], "compact_jd_requirement_map", [resumeSystem, prompts("src/lib/ai/jd-prompts.ts", "buildDeepJDPrompt"), schema(aiSchemaSource, "createCompactJDModelResultSchema"), policy()], "buildDeepJDPrompt({{input}}, {{jobTargetContext}}, {{sourceItems}})", ["eval:jd", "eval:mock"], { timeoutMs: 60000, maxTokens: 6000 }),
  definition("resume.job-overview", "岗位推断与未知", "基于 JD 草稿生成带原文依据、替代解释和验证问题的岗位假设。", "岗位分析", "analyze", "job-overview-v3", ["input", "jobTargetContext", "requirements"], "job_overview", [resumeSystem, prompts("src/lib/ai/jd-prompts.ts", "buildJobOverviewPrompt"), schema(aiSchemaSource, "jobOverviewModelResultSchema"), policy()], "buildJobOverviewPrompt({{input}}, {{jobTargetContext}}, {{requirements}})", ["eval:jd", "eval:mock"], { timeoutMs: 60000, maxTokens: 4000 }),
  definition("resume.requirement-match", "要求—事实匹配", "按每条已确认要求召回最多 3 条事实；模型判断语义相关性，服务端重算证据强度。", "岗位准备度", "analyze", "requirement-match-v5", ["input", "jobTargetContext", "requirements", "careerClaims"], "requirement_fact_match_core", [resumeSystem, prompts("src/lib/ai/jd-prompts.ts", "buildRequirementMatchPrompt"), schema(aiSchemaSource, "createDiagnosisMatchCoreResultSchema"), policy()], "buildRequirementMatchPrompt({{input}}, {{jobTargetContext}}, {{requirements}}, {{careerClaims}})", ["eval:jd", "eval:mock"], { timeoutMs: 60000, maxTokens: 6000 }),
  definition("resume.interview-strategy", "逐条面试策略", "围绕岗位要求生成验证方向、回答结构和反向提问。", "面试准备", "interview-review", "interview-strategy-v3", ["input", "jobTargetContext", "requirements", "matches", "clarificationNeeds"], "requirement_interview_strategy", [resumeSystem, prompts("src/lib/ai/jd-prompts.ts", "buildRequirementInterviewPrompt"), schema(aiSchemaSource, "createInterviewPrepResultSchema"), policy()], "buildRequirementInterviewPrompt({{input}}, {{jobTargetContext}}, {{requirements}}, {{matches}}, {{clarificationNeeds}})", ["eval:jd", "eval:mock"], { timeoutMs: 60000, maxTokens: 6000 }),
  {
    id: "resume.analysis-output", callable: false, lifecycle: "retired", name: "分析后的简历优化（历史）", description: "V1.9.2 及以前在岗位分析阶段生成优化草稿；V1.9.3 起已移至制作阶段。", module: "历史提示词", workflowNodeId: "optimize", version: "analysis-output-v1-retired", variables: ["input", "optimizeStyle", "coreSummary"], schemaName: "resume_optimized_output", sourceRefs: [resumeSystem, prompts("src/lib/ai/prompts.ts", "buildAnalyzeOutputPrompt"), schema(aiSchemaSource, "optimizeResumeResultSchema"), policy()], systemTemplatePreview: "RESUME_AGENT_SYSTEM_PROMPT（完整内容见系统提示词来源）", userTemplatePreview: "buildAnalyzeOutputPrompt({{input}}, {{optimizeStyle}}, {{coreSummary}})", modelPolicy: { provider: "configured", timeoutMs: 120000, maxTokens: 12000 }, evaluation: { suites: ["eval:mock", "eval:ai"] },
  },
  definition("resume.follow-up-guidance", "补证回答结构示范", "生成只含占位符的回答框架，不写入事实库。", "经历补证", "follow-up", "follow-up-guidance-v1", ["requirement", "question", "thinkingHints", "answerFramework", "honestFallback"], "follow_up_placeholder_guidance", [resumeSystem, prompts("src/lib/ai/jd-prompts.ts", "buildFollowUpGuidancePrompt"), schema(aiSchemaSource, "followUpGuidanceResultSchema"), policy()], "buildFollowUpGuidancePrompt({{guidanceInput}})", ["eval:jd", "eval:mock"], { temperature: 0.2, maxTokens: 600 }),
  definition("resume.optimize-items", "重新生成优化项", "按照用户选择的风格重新生成简历优化建议。", "简历制作", "optimize", "optimize-items-v2", ["input", "style", "customInstruction"], "resume_optimized_items", [resumeSystem, prompts("src/lib/ai/prompts.ts", "buildOptimizeUserPrompt"), schema(aiSchemaSource, "optimizedItemsResultSchema"), policy()], "buildOptimizeUserPrompt({{input}}, {{style}}, {{customInstruction}})", ["eval:mock", "eval:ai"], { temperature: 0.5, maxTokens: 4000 }),
  definition("resume.keyword-enhancement", "缺失关键词 AI 增强", "只基于用户选定的已确认 JD 关键词与提供证据生成候选增强稿。", "简历制作", "optimize", "keyword-enhancement-v1", ["input", "items", "customInstruction"], "keyword_enhancements", [resumeSystem, prompts("src/lib/ai/prompts.ts", "buildKeywordEnhancementPrompt"), schema(aiSchemaSource, "keywordEnhancementModelResultSchema"), policy()], "buildKeywordEnhancementPrompt({{input}}, {{items}}, {{customInstruction}})", ["eval:mock", "eval:ai"], { temperature: 0.2, maxTokens: 5000 }),
  definition("resume.follow-up-bullet", "补证 Bullet 生成", "只依据用户回答生成一条可核对的简历 Bullet。", "经历补证", "follow-up", "follow-up-bullet-v1", ["input", "question", "purpose", "userAnswer"], "resume_follow_up_bullet", [resumeSystem, prompts("src/lib/ai/prompts.ts", "buildFollowUpBulletPrompt"), schema(aiSchemaSource, "followUpBulletResultSchema"), policy()], "buildFollowUpBulletPrompt({{input}}, {{question}}, {{purpose}}, {{userAnswer}})", ["eval:mock", "eval:ai"], { temperature: 0.3, maxTokens: 500 }),
  definition("resume.finalize", "最终简历生成", "汇总材料、优化项和已确认补证生成最终简历。", "简历制作", "finalize", "finalize-v2", ["input", "style", "optimizedItems", "followUpQuestions", "customInstruction"], "resume_final_document", [resumeSystem, prompts("src/lib/ai/prompts.ts", "buildFinalizeResumePrompt"), schema(aiSchemaSource, "finalResumeResultSchema"), policy()], "buildFinalizeResumePrompt({{input}}, {{style}}, {{optimizedItems}}, {{followUpQuestions}}, {{customInstruction}})", ["eval:mock", "eval:ai"], { temperature: 0.2, maxTokens: 5000 }),
  definition("resume.import-structure", "导入简历结构化", "从已确认的 PDF/DOCX 提取文本中保守提取简历字段。", "材料导入", "import-structure", "import-structure-v1", ["resumeText"], "structured_imported_resume", [system("src/services/ai/importResume.server.ts", "inline system"), prompts("src/services/ai/importResume.server.ts", "inline user"), schema(aiSchemaSource, "structureResumeResultSchema"), policy()], "Resume text: {{resumeText}}", ["eval:mock"], { temperature: 0 }),
  definition("career.interview", "项目经历结构化访谈", "基于用户原文逐轮提取候选事实、指标和能力建议。", "经历资料库", "career-interview", "career-interview-v1", ["sessionId", "targetRole", "experienceTitle", "background", "round", "answers", "endRequested"], "career_interview_model_output", [system("src/lib/career/interview.server.ts", "inline system"), prompts("src/lib/career/interview.server.ts", "input JSON"), schema("src/lib/career/schemas.ts", "careerInterviewModelOutputSchema"), policy()], "JSON.stringify({{careerInterviewInput}})", ["eval:career", "eval:mock"], { temperature: 0.2 }),
  definition("interview.review", "面试复盘分析", "根据转写文本、简历和岗位生成结构化面试复盘。", "面试复盘", "interview-review", "interview-review-v1", ["transcriptText", "resumeText", "targetRole"], "interview_analysis", [system("src/lib/ai/interview-prompts.ts", "INTERVIEW_AGENT_SYSTEM_PROMPT"), prompts("src/lib/ai/interview-prompts.ts", "buildInterviewAnalysisUserPrompt"), schema(aiSchemaSource, "interviewAnalysisResultSchema"), policy()], "buildInterviewAnalysisUserPrompt({{transcriptText}}, {{resumeText}}, {{targetRole}})", ["eval:mock", "eval:ai"], { temperature: 0.3, maxTokens: 8000 }),
  definition("project-evidence.direct", "Flowise DirectLLM 后备", "Flowise 实验室中直接调用模型生成项目证据候选草稿。", "Flowise 实验室", "project-evidence", "project-evidence-direct-v1", ["targetRole", "projectTitle", "currentDemo"], "project_evidence_draft", [system("src/lib/flowise/client.server.ts", "runDirect system"), prompts("src/lib/flowise/client.server.ts", "runDirect input JSON"), schema("src/lib/flowise/schemas.ts", "projectEvidenceDraftSchema"), policy()], "JSON.stringify({{projectEvidenceInput}})", ["eval:mock"], { temperature: 0.2 }),
  {
    id: "runtime.schema-instruction", callable: false, name: "JSON Schema 运行时注入", description: "为不支持严格 JSON Schema 的 Provider 注入完整输出约束。", module: "AI 运行时", version: "schema-instruction-v1", variables: ["schemaContract"], sourceRefs: [{ path: "src/lib/ai/client.ts", symbol: "addPromptSchema", kind: "schema-instruction" }, policy()], systemTemplatePreview: "只输出一个 JSON 对象……\n完整 JSON Schema：{{schemaContract}}", userTemplatePreview: "不修改用户提示词。", modelPolicy: { provider: "runtime" }, evaluation: { suites: ["unit:ai-client"] },
  },
  {
    id: "runtime.structure-repair", callable: false, name: "结构修复提示词", description: "首次 JSON 解析或 Schema 校验失败后进行且仅进行一次修复。", module: "AI 运行时", version: "structure-repair-v1", variables: ["schemaContract", "validationIssues", "rawModelOutput"], sourceRefs: [{ path: "src/lib/ai/client.ts", symbol: "requestChatCompletionJSON repair", kind: "structure-repair" }, policy()], systemTemplatePreview: "你是严格的 JSON 结构修复器……禁止补造事实。", userTemplatePreview: "校验错误：{{validationIssues}}\n待修复内容：{{rawModelOutput}}", modelPolicy: { provider: "runtime", temperature: 0 }, evaluation: { suites: ["unit:ai-client"] },
  },
];

function definition(
  id: PromptId,
  name: string,
  description: string,
  module: string,
  workflowNodeId: PromptDefinition["workflowNodeId"],
  version: string,
  variables: string[],
  schemaName: string,
  sourceRefs: PromptSourceRef[],
  userTemplatePreview: string,
  suites: string[],
  modelPolicy: Omit<PromptDefinition["modelPolicy"], "provider">,
): PromptDefinition {
  return {
    id, callable: true, name, description, module, workflowNodeId, version, variables, schemaName, sourceRefs,
    systemTemplatePreview: sourceRefs.some((item) => item.symbol === "RESUME_AGENT_SYSTEM_PROMPT")
      ? "RESUME_AGENT_SYSTEM_PROMPT（完整内容见系统提示词来源）"
      : "完整内容见系统提示词来源",
    userTemplatePreview,
    modelPolicy: { provider: "configured", timeoutMs: 120000, ...modelPolicy },
    evaluation: { suites },
  };
}

export function getPromptDefinition(id: string): PromptDefinition | undefined {
  return PROMPT_REGISTRY.find((item) => item.id === id);
}

export function getCallablePromptDefinition(id: PromptId): PromptDefinition {
  const definition = getPromptDefinition(id);
  if (!definition?.callable) throw new Error(`未注册的正式提示词：${id}`);
  return definition;
}

export function registeredSourcePaths(): Set<string> {
  return new Set(PROMPT_REGISTRY.flatMap((item) => item.sourceRefs.map((sourceRef) => sourceRef.path)));
}

export function assertPromptRegistry(): void {
  const ids = PROMPT_REGISTRY.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error("提示词注册 ID 存在重复");
  for (const id of CALLABLE_PROMPT_IDS) getCallablePromptDefinition(id);
}
