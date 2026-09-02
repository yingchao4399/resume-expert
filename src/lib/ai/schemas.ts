import { z } from "zod";
import { JD_MAX_REQUIREMENTS, JD_CAPACITY_MESSAGE } from "@/lib/jd/limits";
import { jdAnalysisDocumentSchema, jobReadinessAssessmentSchema, jobReadinessAssessmentV2Schema } from "@/lib/jd/schemas";
import type { MindMapNode } from "@/types/interview";

const nonEmptyText = z.string().min(1);

export const optimizeStyleSchema = z.enum([
  "concise",
  "reduce-exaggeration",
  "ai-product",
  "tob-saas",
  "custom",
]);

export const userInputSchema = z.object({
  targetRole: z.string(),
  industry: z.string(),
  companyType: z.enum(["大厂", "中型公司", "创业公司", "外企", "国企"]),
  jobStage: z.enum(["校招", "社招-初级", "社招-中级", "社招-高级", "转行"]),
  highlightSkills: z.string(),
  jobDescription: z.string(),
  originalResume: z.string(),
  additionalInfo: z.string(),
});

export const jobTargetContextSchema = z.object({
  companyName: z.string(),
  notes: z.string(),
  companySnapshotId: z.null(),
});

const jdSourceItemSchema = z.object({
  id: z.string(), text: z.string(), startOffset: z.number().int().min(0), endOffset: z.number().int().min(0),
  classification: z.enum(["requirement", "background", "benefit", "irrelevant"]),
});

const jobRequirementSchema = z.object({
  id: z.string(), sourceItemId: z.string(), sourceQuote: z.string(), requirement: z.string(),
  category: z.enum(["responsibility", "experience", "skill", "education", "industry", "collaboration", "result", "other"]),
  priority: z.enum(["must", "preferred", "context"]), keywords: z.array(z.string()), interviewFocus: z.string(),
  anchorStatus: z.enum(["validated", "needs-review"]),
});

const conciseText = z.string().max(500);
const boundedInferenceEvidenceSchema = z.preprocess(
  (value) => (Array.isArray(value)
    ? value.slice(0, 4).map((item) => typeof item === "string" ? item.slice(0, 500) : item)
    : value),
  z.array(conciseText).max(4),
);
const roleInferenceItemSchema = z.object({
  topic: z.enum(["work-content", "work-focus", "business-line", "team-state", "business-scenario", "team-pain", "implicit-expectation", "reporting-line", "industry-experience"]),
  level: z.enum(["explicit", "inferred", "unknown"]), conclusion: conciseText, evidence: boundedInferenceEvidenceSchema,
  confidence: z.enum(["high", "medium", "low"]), verificationQuestion: conciseText,
});

const clarificationNeedSchema = z.object({
  id: z.string(), topic: conciseText, missingInformation: conciseText, impact: conciseText, suggestedInput: conciseText, verificationQuestion: conciseText,
});

const coreCompetencySchema = z.object({
  name: z.string(),
  importance: z.enum(["high", "medium", "low"]),
  description: z.string(),
});

export const jdAnalysisSchema = z.object({
  responsibilities: z.array(z.string()),
  hardRequirements: z.array(z.string()),
  implicitRequirements: z.array(z.string()),
  keywords: z.array(z.string()),
  idealCandidate: z.string(),
  coreCompetencies: z.array(coreCompetencySchema),
  sourceItems: z.array(jdSourceItemSchema).optional().default([]),
  requirements: z.array(jobRequirementSchema).max(JD_MAX_REQUIREMENTS, JD_CAPACITY_MESSAGE).optional().default([]),
  roleInference: z.object({ items: z.array(roleInferenceItemSchema) }).optional().default({ items: [] }),
  clarificationNeeds: z.array(clarificationNeedSchema).optional().default([]),
});

const jdRequirementDraftSchema = jobRequirementSchema.omit({ id: true, anchorStatus: true });
function normalizeSourceClassification(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLocaleLowerCase();
  if (/benefit|福利|待遇|薪酬/.test(normalized)) return "benefit";
  if (/background|背景|公司介绍|团队介绍/.test(normalized)) return "background";
  if (/irrelevant|无关|其他内容/.test(normalized)) return "irrelevant";
  if (/requirement|qualification|preferred|preference|要求|职责|任职|资格|技能|经验|优先/.test(normalized)) return "requirement";
  return value;
}
const sourceClassificationSchema = z.object({
  sourceItemId: z.string(),
  classification: z.preprocess(normalizeSourceClassification, z.enum(["requirement", "background", "benefit", "irrelevant"])),
});

export function createDeepJDModelResultSchema(sourceItemIds: string[]) {
  const allowed = new Set(sourceItemIds);
  return z.object({
    sourceClassifications: z.array(sourceClassificationSchema).max(sourceItemIds.length),
    requirements: z.array(jdRequirementDraftSchema).max(40),
    responsibilities: z.array(conciseText).max(12), hardRequirements: z.array(conciseText).max(12), implicitRequirements: z.array(conciseText).max(12),
    keywords: z.array(z.string().max(80)).max(30), idealCandidate: z.string().max(1000), coreCompetencies: z.array(coreCompetencySchema).max(12),
    roleInference: z.object({ items: z.array(roleInferenceItemSchema).max(12) }), clarificationNeeds: z.array(clarificationNeedSchema).max(12),
  }).superRefine((value, context) => {
    const requiredTopics = ["work-content", "work-focus", "business-line", "team-state", "business-scenario", "team-pain", "implicit-expectation", "reporting-line", "industry-experience"];
    for (const topic of requiredTopics) if (!value.roleInference.items.some((item) => item.topic === topic)) context.addIssue({ code: "custom", path: ["roleInference", "items"], message: `缺少 ${topic} 推断边界` });
    const returned = value.sourceClassifications.map((item) => item.sourceItemId);
    if (new Set(returned).size !== returned.length) context.addIssue({ code: "custom", path: ["sourceClassifications"], message: "原始条目分类不得重复" });
    for (const id of sourceItemIds) if (!returned.includes(id)) context.addIssue({ code: "custom", path: ["sourceClassifications"], message: `缺少原始条目 ${id} 的分类` });
    for (const id of returned) if (!allowed.has(id)) context.addIssue({ code: "custom", path: ["sourceClassifications"], message: `不存在的原始条目 ${id}` });
    for (const requirement of value.requirements) if (!allowed.has(requirement.sourceItemId)) context.addIssue({ code: "custom", path: ["requirements"], message: `要求引用了不存在的原始条目 ${requirement.sourceItemId}` });
    for (const inference of value.roleInference.items) {
      if (inference.level === "unknown" && inference.conclusion.trim() && !/信息不足|未知|无法判断/.test(inference.conclusion)) {
        context.addIssue({ code: "custom", path: ["roleInference"], message: "信息不足项不得输出确定结论" });
      }
      if (inference.level !== "unknown" && inference.evidence.length === 0) context.addIssue({ code: "custom", path: ["roleInference"], message: "明示或推断结论必须提供依据" });
    }
  });
}

export function createCompactJDModelResultSchema(sourceItemIds: string[]) {
  const allowed = new Set(sourceItemIds);
  return z.object({
    sourceClassifications: z.array(sourceClassificationSchema).max(sourceItemIds.length),
    requirements: z.array(jdRequirementDraftSchema).max(40),
  }).superRefine((value, context) => {
    const returned = value.sourceClassifications.map((item) => item.sourceItemId);
    if (new Set(returned).size !== returned.length) context.addIssue({ code: "custom", path: ["sourceClassifications"], message: "原始条目分类不得重复" });
    for (const id of sourceItemIds) if (!returned.includes(id)) context.addIssue({ code: "custom", path: ["sourceClassifications"], message: `缺少原始条目 ${id} 的分类` });
    for (const id of returned) if (!allowed.has(id)) context.addIssue({ code: "custom", path: ["sourceClassifications"], message: `不存在的原始条目 ${id}` });
    for (const requirement of value.requirements) if (!allowed.has(requirement.sourceItemId)) context.addIssue({ code: "custom", path: ["requirements"], message: `要求引用了不存在的原始条目 ${requirement.sourceItemId}` });
  });
}

export const jobOverviewModelResultSchema = z.object({
  idealCandidate: z.string().max(600),
  roleInference: z.object({ items: z.array(roleInferenceItemSchema).max(12) }),
  clarificationNeeds: z.array(clarificationNeedSchema).max(12),
}).superRefine((value, context) => {
  const requiredTopics = ["work-content", "work-focus", "business-line", "team-state", "business-scenario", "team-pain", "implicit-expectation", "reporting-line", "industry-experience"];
  for (const topic of requiredTopics) if (!value.roleInference.items.some((item) => item.topic === topic)) context.addIssue({ code: "custom", path: ["roleInference", "items"], message: `缺少 ${topic} 推断边界` });
  for (const inference of value.roleInference.items) {
    if (inference.level === "unknown" && inference.conclusion.trim() && !/信息不足|未知|无法判断/.test(inference.conclusion)) context.addIssue({ code: "custom", path: ["roleInference"], message: "信息不足项不得输出确定结论" });
    if (inference.level !== "unknown" && inference.evidence.length === 0) context.addIssue({ code: "custom", path: ["roleInference"], message: "明示或推断结论必须提供依据" });
  }
});

const dimensionScoreSchema = z.object({
  dimension: z.string(),
  score: z.number().min(0).max(100),
  comment: z.string(),
});

export const resumeDiagnosisSchema = z.object({
  overallScore: z.number().min(0).max(100),
  dimensionScores: z.array(dimensionScoreSchema),
  mainIssues: z.array(z.string()),
  prioritySuggestions: z.array(z.string()),
});

export const matchItemSchema = z.object({
  requirementId: z.string().optional().default(""),
  jdRequirement: z.string(),
  evidenceClaimIds: z.array(z.string()).optional().default([]),
  resumeQuotes: z.array(z.string()).optional().default([]),
  resumeEvidence: z.string(),
  matchRationale: z.string().optional().default(""),
  evidenceStrength: z.enum(["strong", "medium", "weak", "none"]),
  missingEvidenceTypes: z.array(z.string()).optional().default([]),
  needsSupplement: z.boolean(),
  optimizationSuggestion: z.string(),
});

export const followUpQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  purpose: z.string(),
  requirementId: z.string().optional().default(""),
  thinkingPrompts: z.array(z.string()).optional().default([]),
  answerFramework: z.array(z.string()).optional().default([]),
  honestNoExperience: z.string().optional().default(""),
  placeholderExample: z.string().optional().default(""),
  userAnswer: z.string(),
  generatedBullet: z.string(),
  supplementNeed: z.enum(["none", "verify-existing", "add-detail", "new-evidence"]).optional(),
  decision: z.enum(["unreviewed", "verified-existing", "answered", "no-experience", "skipped"]).optional(),
  missingDimensions: z.array(z.enum(["experience", "scope", "contribution", "action", "result", "metric"])).optional(),
  existingQuote: z.string().optional(),
  impactLabel: z.string().optional(),
});

export const optimizedItemSchema = z.object({
  id: z.string(),
  section: z.string(),
  before: z.string(),
  after: z.string(),
  reason: z.string(),
  riskWarning: z.string(),
  keywordEnhancement: z.object({
    id: z.string(), itemId: z.string(), selectedKeywords: z.array(z.string()).max(8),
    enhancedText: z.string(), sourceAfter: z.string(),
    evidenceStatus: z.enum(["supported", "partial", "missing"]),
    evidenceClaimIds: z.array(z.string()), evidenceCorrectionSourceIds: z.array(z.string()).optional().default([]), foundEvidence: z.array(z.string()),
    missingEvidence: z.array(z.string()), riskWarnings: z.array(z.string()),
    adoptionStatus: z.enum(["draft", "unverified", "user-confirmed", "evidence-confirmed", "rejected"]),
    generatedAt: z.string(), verifiedAt: z.string().nullable(),
  }).nullable().optional(),
});

const resumeBulletSchema = z.union([
  z.string(),
  z.object({
    id: z.string(),
    text: z.string(),
    sourceType: z.enum(["imported", "ai-generated", "manual"]),
    evidenceIds: z.array(z.string()),
    evidenceLinks: z.array(z.object({
      evidenceId: z.string(),
      status: z.enum(["candidate", "confirmed", "needs-review"]),
      method: z.enum(["suggested", "manual"]),
      sourceReference: z.object({
        kind: z.enum(["resume-import", "manual", "follow-up", "flowise"]),
        referenceId: z.string(), runId: z.string().nullable(), fingerprint: z.string(),
      }).nullable(),
    })).optional().default([]),
    originalText: z.string(),
    aiText: z.string(),
    manualText: z.string(),
  }),
]);

const workExperienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  period: z.string(),
  bullets: z.array(resumeBulletSchema),
});

const projectExperienceSchema = z.object({
  name: z.string(),
  role: z.string(),
  period: z.string(),
  bullets: z.array(resumeBulletSchema),
});

const importedResumeItemSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  sourceQuote: z.string(),
  status: z.enum(["candidate", "confirmed", "needs-review"]).default("candidate"),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

const importedExperienceSchema = z.object({
  id: z.string().min(1),
  organization: z.string(),
  name: z.string(),
  role: z.string(),
  period: z.string(),
  summary: z.string(),
  bullets: z.array(importedResumeItemSchema),
  sourceQuote: z.string(),
  status: z.enum(["candidate", "confirmed", "needs-review"]).default("candidate"),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

const importedEducationSchema = z.object({
  id: z.string().min(1),
  school: z.string(),
  degree: z.string(),
  period: z.string(),
  details: z.array(importedResumeItemSchema),
  sourceQuote: z.string(),
  status: z.enum(["candidate", "confirmed", "needs-review"]).default("candidate"),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

export const importedResumeProfileSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  personalInfo: z.object({ name: z.string(), email: z.string(), phone: z.string(), location: z.string() }),
  jobIntent: z.string(),
  summary: z.string(),
  workExperience: z.array(importedExperienceSchema),
  internshipExperience: z.array(importedExperienceSchema),
  projectExperience: z.array(importedExperienceSchema),
  educationHistory: z.array(importedEducationSchema),
  skillsAndTools: z.array(importedResumeItemSchema),
  certifications: z.array(importedResumeItemSchema),
  languages: z.array(importedResumeItemSchema),
  awards: z.array(importedResumeItemSchema),
  links: z.array(importedResumeItemSchema),
  otherSections: z.array(importedResumeItemSchema),
  unmappedSegments: z.array(importedResumeItemSchema),
});

export const finalResumeSchema = z.object({
  personalInfo: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
  }),
  jobIntent: z.string(),
  summary: z.string(),
  coreSkills: z.array(z.string()),
  workExperience: z.array(workExperienceSchema),
  projectExperience: z.array(projectExperienceSchema),
  skillsAndTools: z.array(z.string()),
  education: z.object({
    school: z.string(),
    degree: z.string(),
    period: z.string(),
  }),
  educationHistory: z.array(importedEducationSchema).optional().default([]),
  certifications: z.array(importedResumeItemSchema).optional().default([]),
  languages: z.array(importedResumeItemSchema).optional().default([]),
  awards: z.array(importedResumeItemSchema).optional().default([]),
  links: z.array(importedResumeItemSchema).optional().default([]),
  otherSections: z.array(importedResumeItemSchema).optional().default([]),
});

const interviewQuestionSchema = z.object({
  requirementId: z.string().optional().default(""),
  question: z.string(),
  suggestedAnswer: z.string(),
  evidenceNeeded: z.array(z.string()),
});

const requirementInterviewStrategySchema = z.object({
  requirementId: z.string(), validationApproaches: z.array(z.string()), demonstrationPoints: z.array(z.string()),
  answerStructure: z.array(z.string()), evidenceNeeded: z.array(z.string()), metricsNeeded: z.array(z.string()), exaggerationRisks: z.array(z.string()),
});

const reverseInterviewQuestionSchema = z.object({
  id: z.string(), requirementId: z.string().nullable(), clarificationNeedId: z.string().nullable(),
  topic: z.enum(["role-boundary", "business-goal", "team-state", "success-metric", "collaboration", "reporting-line"]),
  question: z.string(), purpose: z.string(),
});

export const persistedInterviewPrepSchema = z.object({
  likelyQuestions: z.array(interviewQuestionSchema),
  evidenceToPrepare: z.array(z.string()),
  possibleExaggerations: z.array(z.string()),
  dataToSupplement: z.array(z.string()),
  selfIntroduction: z.string(),
  requirementStrategies: z.array(requirementInterviewStrategySchema).max(JD_MAX_REQUIREMENTS, JD_CAPACITY_MESSAGE).optional().default([]),
  reverseQuestions: z.array(reverseInterviewQuestionSchema).optional().default([]),
});

export const interviewPrepSchema = persistedInterviewPrepSchema.extend({
  likelyQuestions: z.array(interviewQuestionSchema).min(5).max(10),
});

export const persistedAnalysisResultSchema = z.object({
  jdAnalysis: jdAnalysisSchema,
  diagnosis: resumeDiagnosisSchema,
  matchItems: z.array(matchItemSchema).max(JD_MAX_REQUIREMENTS, JD_CAPACITY_MESSAGE),
  followUpQuestions: z.array(followUpQuestionSchema),
  optimizedItems: z.array(optimizedItemSchema),
  finalResume: finalResumeSchema,
  interviewPrep: persistedInterviewPrepSchema,
  jobReadiness: jobReadinessAssessmentSchema.optional(),
  jobReadinessV2: jobReadinessAssessmentV2Schema.optional(),
});

export const analysisResultSchema = persistedAnalysisResultSchema.extend({
  matchItems: z.array(matchItemSchema).min(1).max(JD_MAX_REQUIREMENTS, JD_CAPACITY_MESSAGE),
  followUpQuestions: z.array(followUpQuestionSchema).max(10),
  optimizedItems: z.array(optimizedItemSchema).max(12),
  interviewPrep: interviewPrepSchema,
}).superRefine((result, context) => {
  if (result.matchItems.some((item) => item.needsSupplement) && result.followUpQuestions.length === 0) {
    context.addIssue({ code: "custom", path: ["followUpQuestions"], message: "存在证据缺口时至少需要一个补证问题" });
  }
});

export const jdAnalysisResultSchema = z.object({
  jdAnalysis: jdAnalysisSchema,
});

export const diagnosisMatchResultSchema = z.object({
  diagnosis: resumeDiagnosisSchema,
  matchItems: z.array(matchItemSchema).min(1).max(12),
  followUpQuestions: z.array(followUpQuestionSchema).max(10),
}).superRefine((result, context) => {
  if (result.matchItems.some((item) => item.needsSupplement) && result.followUpQuestions.length === 0) {
    context.addIssue({ code: "custom", path: ["followUpQuestions"], message: "存在证据缺口时至少需要一个补证问题" });
  }
});

export function createDiagnosisMatchResultSchema(requirementIds: string[], allowedClaimIds: string[]) {
  const requirementSet = new Set(requirementIds);
  const claimSet = new Set(allowedClaimIds);
  return z.object({
    diagnosis: resumeDiagnosisSchema,
    matchItems: z.array(matchItemSchema).length(requirementIds.length),
    followUpQuestions: z.array(followUpQuestionSchema).max(10),
  }).superRefine((result, context) => {
    const returned = result.matchItems.map((item) => item.requirementId);
    for (const id of requirementIds) if (!returned.includes(id)) context.addIssue({ code: "custom", path: ["matchItems"], message: `缺少岗位要求 ${id} 的匹配结果` });
    for (const item of result.matchItems) {
      if (!requirementSet.has(item.requirementId)) context.addIssue({ code: "custom", path: ["matchItems"], message: `不存在的岗位要求 ${item.requirementId}` });
      for (const claimId of item.evidenceClaimIds) if (!claimSet.has(claimId)) context.addIssue({ code: "custom", path: ["matchItems"], message: `不存在或未提供的事实 ${claimId}` });
    }
    for (const question of result.followUpQuestions) if (!requirementSet.has(question.requirementId)) context.addIssue({ code: "custom", path: ["followUpQuestions"], message: `追问引用了不存在的岗位要求 ${question.requirementId}` });
    if (result.matchItems.some((item) => item.needsSupplement) && result.followUpQuestions.length === 0) context.addIssue({ code: "custom", path: ["followUpQuestions"], message: "存在证据缺口时至少需要一个补证问题" });
  });
}

export function createDiagnosisMatchCoreResultSchema(requirementIds: string[], allowedClaimIds: string[]) {
  const requirementSet = new Set(requirementIds);
  const claimSet = new Set(allowedClaimIds);
  return z.object({
    diagnosis: resumeDiagnosisSchema,
    matchItems: z.array(matchItemSchema).length(requirementIds.length),
  }).superRefine((result, context) => {
    const returned = result.matchItems.map((item) => item.requirementId);
    for (const id of requirementIds) if (!returned.includes(id)) context.addIssue({ code: "custom", path: ["matchItems"], message: `缺少岗位要求 ${id} 的匹配结果` });
    for (const item of result.matchItems) {
      if (!requirementSet.has(item.requirementId)) context.addIssue({ code: "custom", path: ["matchItems"], message: `不存在的岗位要求 ${item.requirementId}` });
      for (const claimId of item.evidenceClaimIds) if (!claimSet.has(claimId)) context.addIssue({ code: "custom", path: ["matchItems"], message: `不存在或未提供的事实 ${claimId}` });
    }
  });
}

export const optimizeResumeResultSchema = z.object({
  optimizedItems: z.array(optimizedItemSchema).max(12),
  finalResume: finalResumeSchema,
});

export const interviewPrepResultSchema = z.object({
  interviewPrep: interviewPrepSchema,
});

export function createInterviewPrepResultSchema(requirementIds: string[], clarificationIds: string[]) {
  const requirementSet = new Set(requirementIds);
  const clarificationSet = new Set(clarificationIds);
  return z.object({ interviewPrep: persistedInterviewPrepSchema }).superRefine((result, context) => {
    if (result.interviewPrep.likelyQuestions.length < 5 || result.interviewPrep.likelyQuestions.length > 10) context.addIssue({ code: "custom", path: ["interviewPrep", "likelyQuestions"], message: "面试准备必须包含 5-10 题" });
    const strategyIds = result.interviewPrep.requirementStrategies.map((item) => item.requirementId);
    if (strategyIds.length !== requirementIds.length || new Set(strategyIds).size !== strategyIds.length) context.addIssue({ code: "custom", path: ["interviewPrep", "requirementStrategies"], message: "每条本批次岗位要求必须且只能对应一份面试策略" });
    for (const id of requirementIds) if (!strategyIds.includes(id)) context.addIssue({ code: "custom", path: ["interviewPrep", "requirementStrategies"], message: `缺少岗位要求 ${id} 的面试策略` });
    for (const item of result.interviewPrep.requirementStrategies) if (!requirementSet.has(item.requirementId)) context.addIssue({ code: "custom", path: ["interviewPrep"], message: `不存在的岗位要求 ${item.requirementId}` });
    for (const item of result.interviewPrep.reverseQuestions) {
      if (item.requirementId && !requirementSet.has(item.requirementId)) context.addIssue({ code: "custom", path: ["interviewPrep", "reverseQuestions"], message: `反向提问引用了不存在的岗位要求 ${item.requirementId}` });
      if (item.clarificationNeedId && !clarificationSet.has(item.clarificationNeedId)) context.addIssue({ code: "custom", path: ["interviewPrep", "reverseQuestions"], message: `反向提问引用了不存在的未知项 ${item.clarificationNeedId}` });
    }
  });
}

export const optimizedItemsResultSchema = z.object({
  optimizedItems: z.array(optimizedItemSchema).max(12),
});

export const followUpBulletResultSchema = z.object({
  bullet: z.string(),
});

export const finalResumeResultSchema = z.object({
  finalResume: finalResumeSchema,
});

export const structureResumeRequestSchema = z.object({
  text: z.string().trim().min(20, "简历文本至少需要 20 个字符").max(100000, "简历文本不能超过 100000 个字符"),
});

export const structureResumeResultSchema = finalResumeResultSchema.extend({
  importedResume: importedResumeProfileSchema.optional(),
  unmappedSegments: z.array(importedResumeItemSchema).optional().default([]),
});

export const analyzeRequestSchema = z.object({
  input: userInputSchema.refine(
    (input) =>
      Boolean(
        input.targetRole.trim() &&
          input.jobDescription.trim() &&
          input.originalResume.trim()
      ),
    "请填写目标岗位、JD 和原始简历"
  ),
  optimizeStyle: optimizeStyleSchema.optional().default("ai-product"),
  jobTargetContext: jobTargetContextSchema.optional().default({ companyName: "", notes: "", companySnapshotId: null }),
  careerClaims: z.array(z.object({
    id: z.string(), experienceId: z.string(), experienceTitle: z.string(), organization: z.string(), role: z.string(), text: z.string(),
    kind: z.enum(["responsibility", "action", "decision", "result", "skill-practice"]),
    contribution: z.enum(["assisted", "independent", "led"]), complexity: z.enum(["routine", "complex"]), hasTradeoff: z.boolean(), hasMethodReuse: z.boolean(),
    capabilities: z.array(z.object({ id: z.string(), name: z.string(), aliases: z.array(z.string()) })),
    metrics: z.array(z.object({ id: z.string(), value: z.string(), unit: z.string(), baseline: z.string(), method: z.string(), period: z.string(), sourceNote: z.string() })),
  })).optional().default([]),
  materialRevision: z.number().int().nonnegative().optional().default(0),
});

export const matchAnalysisRequestSchema = analyzeRequestSchema.extend({
  jdAnalysisDocument: jdAnalysisDocumentSchema,
});

export const interviewPrepareRequestSchema = z.object({
  input: userInputSchema,
  jobTargetContext: jobTargetContextSchema,
  analysisResult: persistedAnalysisResultSchema,
  materialRevision: z.number().int().min(0),
});

export const followUpGuidanceRequestSchema = z.object({
  targetRole: z.string(), requirementId: z.string(), requirement: z.string(), question: nonEmptyText,
  purpose: z.string(), thinkingPrompts: z.array(z.string()), answerFramework: z.array(z.string()),
});

export const followUpGuidanceResultSchema = z.object({
  example: z.string().min(10),
}).superRefine((value, context) => {
  if (!/【你的项目】|【你的经历】/.test(value.example) || !/【指标口径】|【真实结果】/.test(value.example)) {
    context.addIssue({ code: "custom", path: ["example"], message: "示范必须包含项目/经历和指标/结果占位符" });
  }
});

export const optimizeRequestSchema = z.object({
  input: userInputSchema.refine(
    (input) => Boolean(input.originalResume.trim()),
    "缺少原始简历"
  ),
  style: optimizeStyleSchema,
  customInstruction: z.string().trim().max(300).optional().default(""),
});

const keywordEnhancementItemRequestSchema = z.object({
  itemId: z.string().min(1), section: z.string(), currentText: z.string().min(1),
  selectedKeywords: z.array(z.string().min(1)).min(1).max(8),
  evidence: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })).max(12),
});

export const keywordEnhancementRequestSchema = z.object({
  input: userInputSchema,
  items: z.array(keywordEnhancementItemRequestSchema).min(1).max(12),
  allowedKeywords: z.array(z.string().min(1)).min(1).max(80),
  customInstruction: z.string().trim().max(300).optional().default(""),
}).superRefine((value, context) => {
  const allowed = new Set(value.allowedKeywords.map(normalizeCatalogKeyword));
  for (const [itemIndex, item] of value.items.entries()) {
    for (const keyword of item.selectedKeywords) {
      if (!allowed.has(normalizeCatalogKeyword(keyword))) context.addIssue({
        code: "custom", path: ["items", itemIndex, "selectedKeywords"], message: `关键词“${keyword}”不在当前已确认 JD 中`,
      });
    }
  }
});

function normalizeCatalogKeyword(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

export const keywordEnhancementModelResultSchema = z.object({
  enhancements: z.array(z.object({
    itemId: z.string().min(1), enhancedText: z.string().min(1),
    appliedKeywords: z.array(z.string()).max(8), evidenceClaimIds: z.array(z.string()).max(12),
    foundEvidence: z.array(z.string()).max(12), missingEvidence: z.array(z.string()).max(12),
    riskWarnings: z.array(z.string()).max(12),
  })).max(12),
});

export const followUpBulletRequestSchema = z.object({
  input: userInputSchema,
  question: nonEmptyText,
  purpose: z.string(),
  userAnswer: z.string().trim().min(1, "请先填写回答"),
});

export const finalizeResumeRequestSchema = z.object({
  input: userInputSchema.refine(
    (input) =>
      Boolean(input.originalResume.trim() && input.targetRole.trim()),
    "缺少原始简历或目标岗位"
  ),
  style: optimizeStyleSchema.optional().default("ai-product"),
  customInstruction: z.string().trim().max(300).optional().default(""),
  optimizedItems: z.array(optimizedItemSchema).optional().default([]),
  followUpQuestions: z.array(followUpQuestionSchema).optional().default([]),
});

const dialogueTurnSchema = z.object({
  id: z.string(),
  speaker: z.enum(["interviewer", "candidate"]),
  text: z.string(),
  timestamp: z.string().optional(),
});

const knowledgePointSchema = z.object({
  domain: z.string(),
  points: z.array(z.string()),
  masteryLevel: z.enum(["proficient", "familiar", "weak", "unknown"]),
});

const failurePointSchema = z.object({
  id: z.string(),
  question: z.string(),
  userAnswer: z.string(),
  issue: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  suggestion: z.string(),
});

const mindMapNodeSchema: z.ZodType<MindMapNode> = z.lazy(() =>
  z.object({
    label: z.string(),
    children: z.array(mindMapNodeSchema).optional(),
  })
);

export const interviewAnalysisResultSchema = z.object({
  recordingId: z.string().optional().default(""),
  transcript: z.array(dialogueTurnSchema),
  knowledgePoints: z.array(knowledgePointSchema),
  failurePoints: z.array(failurePointSchema),
  performance: z.object({
    overallScore: z.number().min(0).max(100),
    dimensions: z.array(
      z.object({
        dimension: z.string(),
        score: z.number().min(0).max(100),
        comment: z.string(),
      })
    ),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
  }),
  experienceInsights: z.array(
    z.object({
      category: z.string(),
      insight: z.string(),
      reusable: z.boolean(),
    })
  ),
  improvements: z.array(
    z.object({
      area: z.string(),
      current: z.string(),
      target: z.string(),
      action: z.string(),
      priority: z.enum(["high", "medium", "low"]),
    })
  ),
  clues: z.array(
    z.object({
      type: z.enum(["focus", "implicit_expectation", "concern", "signal"]),
      label: z.string(),
      detail: z.string(),
      evidence: z.string(),
    })
  ),
  resumeGaps: z.array(
    z.object({
      capability: z.string(),
      resumeCoverage: z.enum([
        "covered",
        "partial",
        "missing",
        "overstated",
      ]),
      resumeEvidence: z.string().optional(),
      suggestion: z.string(),
    })
  ),
  psychologyAdvice: z.array(
    z.object({
      methodology: z.string(),
      situation: z.string(),
      advice: z.string(),
      exercise: z.string().optional(),
    })
  ),
  mindMap: mindMapNodeSchema,
  fishbone: z.object({
    problem: z.string(),
    categories: z.array(
      z.object({
        category: z.string(),
        causes: z.array(z.string()),
      })
    ),
  }),
  summary: z.object({
    overview: z.string(),
    keyQA: z.array(
      z.object({
        question: z.string(),
        answerSummary: z.string(),
      })
    ),
    keyIssues: z.array(z.string()),
    overallEvaluation: z.string(),
    resultPrediction: z.string().optional(),
  }),
});

export const interviewAnalyzeRequestSchema = z.object({
  transcriptText: z
    .string()
    .trim()
    .min(50, "对话文本过短，请提供完整的面试对话（至少 50 字）"),
  resumeText: z.string().optional().default(""),
  targetRole: z.string().optional().default(""),
});
