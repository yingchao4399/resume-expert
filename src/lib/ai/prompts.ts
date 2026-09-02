import type {
  AnalysisResult,
  EvidenceStrength,
  FinalResume,
  FollowUpQuestion,
  OptimizeStyle,
  OptimizedItem,
  UserInput,
} from "@/types/resume";
import { STYLE_LABELS } from "@/lib/ai/types";

export const RESUME_AGENT_SYSTEM_PROMPT = `你是「简历专家」，一位 JD 定制简历优化 Agent。
你的任务是基于目标岗位 JD 与用户原始简历，输出结构化 JSON 分析结果。
要求：
1. 所有内容使用中文
2. 分析必须基于用户提供的 JD 与简历，不得编造无法从材料推断的虚假经历
3. 对缺失证据要明确标注 needsSupplement 或 evidenceStrength 为 weak/none
4. followUpQuestions 只针对真实证据缺口生成 0-10 条，id 格式 fu-1, fu-2...
5. optimizedItems 生成 0-12 条，id 格式 opt-1, opt-2...
6. interviewPrep.likelyQuestions 生成 5-10 条
7. overallScore 与各 dimensionScores.score 范围 0-100
8. 只输出合法 JSON，不要 markdown 代码块`;

function buildInputContext(input: UserInput): string {
  return `【目标岗位】${input.targetRole}
【行业】${input.industry}
【公司类型】${input.companyType}
【求职阶段】${input.jobStage}
【希望突出能力】${input.highlightSkills || "无"}

【目标 JD】
${input.jobDescription}

【原始简历】
${input.originalResume}

【补充信息】
${input.additionalInfo || "无"}`;
}

export function buildAnalyzeCorePrompt(input: UserInput): string {
  return `请完成 JD 解析（第一部分）。
${buildInputContext(input)}

只输出合法 JSON，结构：
{
  "jdAnalysis": {
    "responsibilities": string[],
    "hardRequirements": string[],
    "implicitRequirements": string[],
    "keywords": string[],
    "idealCandidate": string,
    "coreCompetencies": [{ "name": string, "importance": "high"|"medium"|"low", "description": string }]
  }
}`;
}

export function buildAnalyzeDiagnosisPrompt(input: UserInput): string {
  return `请完成简历诊断、匹配分析、经历追问（第二部分）。
${buildInputContext(input)}

只输出合法 JSON，结构：
{
  "diagnosis": {
    "overallScore": number,
    "dimensionScores": [{ "dimension": string, "score": number, "comment": string }],
    "mainIssues": string[],
    "prioritySuggestions": string[]
  },
  "matchItems": [{
    "jdRequirement": string,
    "resumeEvidence": string,
    "evidenceStrength": "strong"|"medium"|"weak"|"none",
    "needsSupplement": boolean,
    "optimizationSuggestion": string
  }],
  "followUpQuestions": [{
    "id": string,
    "question": string,
    "purpose": string,
    "userAnswer": "",
    "generatedBullet": ""
  }]
}

要求：matchItems 1-12 条；followUpQuestions 0-10 条，只有存在 needsSupplement=true 的缺口时才生成，id 为 fu-1...。`;
}

export function buildAnalyzeOutputPrompt(
  input: UserInput,
  optimizeStyle: OptimizeStyle,
  coreSummary: string
): string {
  return `请完成简历优化与最终简历（第三部分）。
优化风格：${STYLE_LABELS[optimizeStyle]}

${buildInputContext(input)}

${coreSummary ? `【前序分析摘要】\n${coreSummary}\n` : ""}
只输出合法 JSON，结构：
{
  "optimizedItems": [{
    "id": string,
    "section": string,
    "before": string,
    "after": string,
    "reason": string,
    "riskWarning": string
  }],
  "finalResume": {
    "personalInfo": { "name": string, "email": string, "phone": string, "location": string },
    "jobIntent": string,
    "summary": string,
    "coreSkills": string[],
    "workExperience": [{ "company": string, "role": string, "period": string, "bullets": string[] }],
    "projectExperience": [{ "name": string, "role": string, "period": string, "bullets": string[] }],
    "skillsAndTools": string[],
    "education": { "school": string, "degree": string, "period": string }
  }
}

要求：optimizedItems 0-12 条，id 为 opt-1...；没有可靠修改依据时允许为空。`;
}

export function buildAnalyzeInterviewPrompt(input: UserInput, coreSummary: string): string {
  return `请完成面试准备（第四部分）。
${buildInputContext(input)}

${coreSummary ? `【前序分析摘要】\n${coreSummary}\n` : ""}
只输出合法 JSON，结构：
{
  "interviewPrep": {
    "likelyQuestions": [{ "question": string, "suggestedAnswer": string, "evidenceNeeded": string[] }],
    "evidenceToPrepare": string[],
    "possibleExaggerations": string[],
    "dataToSupplement": string[],
    "selfIntroduction": string
  }
}

要求：likelyQuestions 5-10 条，只覆盖材料中有依据或明确需要补证的方向。`;
}

export function buildOptimizeUserPrompt(input: UserInput, style: OptimizeStyle, customInstruction = ""): string {
  const styleInstruction = style === "custom" ? customInstruction.trim() : STYLE_LABELS[style];
  return `请基于以下材料，按「${styleInstruction || "语气稳健、表达清晰"}」风格重新生成 optimizedItems（0-12 条）。
自定义风格只能调整表达，不得覆盖事实真实性、信息保留和证据边界。

【目标岗位】${input.targetRole}
【目标 JD】
${input.jobDescription}

【原始简历】
${input.originalResume}

【补充信息】
${input.additionalInfo || "无"}

输出 JSON：
{
  "optimizedItems": [{
    "id": string,
    "section": string,
    "before": string,
    "after": string,
    "reason": string,
    "riskWarning": string
  }]
}`;
}

export function buildKeywordEnhancementPrompt(input: UserInput, items: Array<{
  itemId: string; section: string; currentText: string; selectedKeywords: string[];
  evidence: Array<{ id: string; text: string }>;
}>, customInstruction = ""): string {
  return `请为简历优化项生成可核验的关键词增强候选稿。候选稿只供用户核验，不得自动成为事实。

【目标岗位】${input.targetRole}
【自定义表达要求】${customInstruction.trim() || "无"}
【待增强项目】
${JSON.stringify(items, null, 2)}

规则：
1. 只能使用 selectedKeywords 中的关键词，不得创建新关键词。
2. 只能使用 currentText 和 evidence 中已有事实；证据不足时保守表达并列入 missingEvidence 与 riskWarnings。
3. 不得补造公司、项目、职责、日期、数字、规模或成果。
4. appliedKeywords 必须是 selectedKeywords 的子集；evidenceClaimIds 必须来自输入 evidence。
5. 每个 itemId 恰好返回一条结果。
6. 只输出合法 JSON：{ "enhancements": [{ "itemId": string, "enhancedText": string, "appliedKeywords": string[], "evidenceClaimIds": string[], "foundEvidence": string[], "missingEvidence": string[], "riskWarnings": string[] }] }`;
}

export function buildFollowUpBulletPrompt(
  input: UserInput,
  question: string,
  purpose: string,
  userAnswer: string
): string {
  return `请将用户的追问回答改写为一条专业、可写入简历的中文 bullet。
要求：动作 + 方法/场景 + 量化结果（如有）；不要夸大；长度 1-2 句；不要引号包裹。

【目标岗位】${input.targetRole}
【追问目的】${purpose}
【追问】${question}
【用户回答】${userAnswer}

输出 JSON：{ "bullet": string }`;
}

export function buildFinalizeResumePrompt(
  input: UserInput,
  style: OptimizeStyle,
  optimizedItems: OptimizedItem[],
  followUpQuestions: FollowUpQuestion[],
  customInstruction = ""
): string {
  const confirmedOptimizedItems = optimizedItems.map(({ keywordEnhancement, ...item }) => {
    const adopted = keywordEnhancement && (
      keywordEnhancement.adoptionStatus === "user-confirmed" ||
      keywordEnhancement.adoptionStatus === "evidence-confirmed"
    );
    return {
      ...item,
      after: keywordEnhancement && !adopted ? keywordEnhancement.sourceAfter : item.after,
      adoptedKeywordEnhancement: adopted ? {
        keywords: keywordEnhancement.selectedKeywords,
        verification: keywordEnhancement.adoptionStatus,
      } : undefined,
    };
  });
  const supplements = followUpQuestions
    .filter((item) => item.decision === "answered" && item.userAnswer.trim() && item.generatedBullet.trim())
    .map((item) => ({
      question: item.question,
      purpose: item.purpose,
      userAnswer: item.userAnswer,
      generatedBullet: item.generatedBullet,
    }));

  return `请生成一份可直接投递的最终中文简历。
优化风格：${style === "custom" ? customInstruction.trim() || "语气稳健、表达清晰" : STYLE_LABELS[style]}
风格要求只调整表达，不得覆盖事实真实性、信息保留和证据边界。

${buildInputContext(input)}

【已经确认的优化建议】
${JSON.stringify(confirmedOptimizedItems, null, 2)}

【用户补充的经历证据】
${supplements.length ? JSON.stringify(supplements, null, 2) : "无"}

要求：
1. 将用户补充的真实经历自然合并到对应的工作或项目经历中，不要简单堆在末尾。
2. generatedBullet 只是表达草稿，必须结合原始简历和 userAnswer 校验后再使用。
3. 不得编造公司、时间、项目、技术、数据或成果；证据不足时使用保守表述。
4. 保留原始简历中的个人信息、公司、岗位、时间和教育背景。
5. 只输出合法 JSON，结构：
{
  "finalResume": {
    "personalInfo": { "name": string, "email": string, "phone": string, "location": string },
    "jobIntent": string,
    "summary": string,
    "coreSkills": string[],
    "workExperience": [{ "company": string, "role": string, "period": string, "bullets": string[] }],
    "projectExperience": [{ "name": string, "role": string, "period": string, "bullets": string[] }],
    "skillsAndTools": string[],
    "education": { "school": string, "degree": string, "period": string }
  }
}`;
}

const EVIDENCE_STRENGTHS: EvidenceStrength[] = ["strong", "medium", "weak", "none"];

export function normalizeAnalysisResult(raw: AnalysisResult, input?: UserInput): AnalysisResult {
  return {
    jdAnalysis: {
      responsibilities: raw.jdAnalysis?.responsibilities ?? [],
      hardRequirements: raw.jdAnalysis?.hardRequirements ?? [],
      implicitRequirements: raw.jdAnalysis?.implicitRequirements ?? [],
      keywords: raw.jdAnalysis?.keywords ?? [],
      idealCandidate: raw.jdAnalysis?.idealCandidate ?? "",
      coreCompetencies: (raw.jdAnalysis?.coreCompetencies ?? []).map((item) => ({
        name: item.name ?? "",
        importance: item.importance ?? "medium",
        description: item.description ?? "",
      })),
      sourceItems: raw.jdAnalysis?.sourceItems ?? [],
      requirements: raw.jdAnalysis?.requirements ?? [],
      roleInference: raw.jdAnalysis?.roleInference ?? { items: [] },
      clarificationNeeds: raw.jdAnalysis?.clarificationNeeds ?? [],
    },
    diagnosis: {
      overallScore: clampScore(raw.diagnosis?.overallScore ?? 0),
      dimensionScores: (raw.diagnosis?.dimensionScores ?? []).map((item) => ({
        dimension: item.dimension ?? "",
        score: clampScore(item.score ?? 0),
        comment: item.comment ?? "",
      })),
      mainIssues: raw.diagnosis?.mainIssues ?? [],
      prioritySuggestions: raw.diagnosis?.prioritySuggestions ?? [],
    },
    matchItems: (raw.matchItems ?? []).map((item) => ({
      requirementId: item.requirementId ?? "",
      jdRequirement: item.jdRequirement ?? "",
      resumeEvidence: item.resumeEvidence ?? "",
      evidenceClaimIds: item.evidenceClaimIds ?? [],
      resumeQuotes: item.resumeQuotes ?? [],
      matchRationale: item.matchRationale ?? "",
      evidenceStrength: EVIDENCE_STRENGTHS.includes(item.evidenceStrength)
        ? item.evidenceStrength
        : "none",
      needsSupplement: Boolean(item.needsSupplement),
      missingEvidenceTypes: item.missingEvidenceTypes ?? [],
      optimizationSuggestion: item.optimizationSuggestion ?? "",
    })),
    followUpQuestions: (raw.followUpQuestions ?? []).map((item, index) => ({
      id: item.id || `fu-${index + 1}`,
      question: item.question ?? "",
      purpose: item.purpose ?? "",
      requirementId: item.requirementId ?? "",
      thinkingPrompts: item.thinkingPrompts ?? [],
      answerFramework: item.answerFramework ?? [],
      honestNoExperience: item.honestNoExperience ?? "",
      placeholderExample: item.placeholderExample ?? "",
      userAnswer: item.userAnswer ?? "",
      generatedBullet: item.generatedBullet ?? "",
      supplementNeed: item.supplementNeed,
      decision: item.decision,
      missingDimensions: item.missingDimensions,
      existingQuote: item.existingQuote,
      impactLabel: item.impactLabel,
    })),
    optimizedItems: (raw.optimizedItems ?? []).map((item, index) => ({
      id: item.id || `opt-${index + 1}`,
      section: item.section ?? "",
      before: item.before ?? "",
      after: item.after ?? "",
      reason: item.reason ?? "",
      riskWarning: item.riskWarning ?? "",
      keywordEnhancement: item.keywordEnhancement ?? null,
    })),
    finalResume: normalizeFinalResume(raw.finalResume, input),
    interviewPrep: {
      likelyQuestions: raw.interviewPrep?.likelyQuestions ?? [],
      evidenceToPrepare: raw.interviewPrep?.evidenceToPrepare ?? [],
      possibleExaggerations: raw.interviewPrep?.possibleExaggerations ?? [],
      dataToSupplement: raw.interviewPrep?.dataToSupplement ?? [],
      selfIntroduction: raw.interviewPrep?.selfIntroduction ?? "",
      requirementStrategies: raw.interviewPrep?.requirementStrategies ?? [],
      reverseQuestions: raw.interviewPrep?.reverseQuestions ?? [],
    },
    jobReadiness: raw.jobReadiness,
    jobReadinessV2: raw.jobReadinessV2,
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function normalizeOptimizedItems(
  items: AnalysisResult["optimizedItems"]
): AnalysisResult["optimizedItems"] {
  return (items ?? []).map((item, index) => ({
    id: item.id || `opt-${index + 1}`,
    section: item.section ?? "",
    before: item.before ?? "",
    after: item.after ?? "",
    reason: item.reason ?? "",
    riskWarning: item.riskWarning ?? "",
    keywordEnhancement: item.keywordEnhancement ?? null,
  }));
}

export function normalizeFinalResume(
  resume: FinalResume,
  input?: UserInput
): FinalResume {
  return {
    personalInfo: {
      name: resume?.personalInfo?.name ?? "",
      email: resume?.personalInfo?.email ?? "",
      phone: resume?.personalInfo?.phone ?? "",
      location: resume?.personalInfo?.location ?? "",
    },
    jobIntent: resume?.jobIntent || (input ? `${input.targetRole} | ${input.industry}` : ""),
    summary: resume?.summary ?? "",
    coreSkills: resume?.coreSkills ?? [],
    workExperience: resume?.workExperience ?? [],
    projectExperience: resume?.projectExperience ?? [],
    skillsAndTools: resume?.skillsAndTools ?? [],
    education: resume?.education ?? { school: "", degree: "", period: "" },
    educationHistory: resume?.educationHistory ?? [],
    certifications: resume?.certifications ?? [],
    languages: resume?.languages ?? [],
    awards: resume?.awards ?? [],
    links: resume?.links ?? [],
    otherSections: resume?.otherSections ?? [],
  };
}
