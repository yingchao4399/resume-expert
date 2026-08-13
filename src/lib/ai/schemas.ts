import { z } from "zod";
import type { MindMapNode } from "@/types/interview";

const nonEmptyText = z.string().min(1);

export const optimizeStyleSchema = z.enum([
  "concise",
  "reduce-exaggeration",
  "ai-product",
  "tob-saas",
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
  jdRequirement: z.string(),
  resumeEvidence: z.string(),
  evidenceStrength: z.enum(["strong", "medium", "weak", "none"]),
  needsSupplement: z.boolean(),
  optimizationSuggestion: z.string(),
});

export const followUpQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  purpose: z.string(),
  userAnswer: z.string(),
  generatedBullet: z.string(),
});

export const optimizedItemSchema = z.object({
  id: z.string(),
  section: z.string(),
  before: z.string(),
  after: z.string(),
  reason: z.string(),
  riskWarning: z.string(),
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
});

const interviewQuestionSchema = z.object({
  question: z.string(),
  suggestedAnswer: z.string(),
  evidenceNeeded: z.array(z.string()),
});

export const persistedInterviewPrepSchema = z.object({
  likelyQuestions: z.array(interviewQuestionSchema),
  evidenceToPrepare: z.array(z.string()),
  possibleExaggerations: z.array(z.string()),
  dataToSupplement: z.array(z.string()),
  selfIntroduction: z.string(),
});

export const interviewPrepSchema = persistedInterviewPrepSchema.extend({
  likelyQuestions: z.array(interviewQuestionSchema).min(5).max(10),
});

export const persistedAnalysisResultSchema = z.object({
  jdAnalysis: jdAnalysisSchema,
  diagnosis: resumeDiagnosisSchema,
  matchItems: z.array(matchItemSchema),
  followUpQuestions: z.array(followUpQuestionSchema),
  optimizedItems: z.array(optimizedItemSchema),
  finalResume: finalResumeSchema,
  interviewPrep: persistedInterviewPrepSchema,
});

export const analysisResultSchema = persistedAnalysisResultSchema.extend({
  matchItems: z.array(matchItemSchema).min(1).max(12),
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

export const optimizeResumeResultSchema = z.object({
  optimizedItems: z.array(optimizedItemSchema).max(12),
  finalResume: finalResumeSchema,
});

export const interviewPrepResultSchema = z.object({
  interviewPrep: interviewPrepSchema,
});

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
  text: z.string().trim().min(20, "??????").max(100000, "???????? 100000 ?"),
});

export const structureResumeResultSchema = finalResumeResultSchema;

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
});

export const optimizeRequestSchema = z.object({
  input: userInputSchema.refine(
    (input) => Boolean(input.originalResume.trim()),
    "缺少原始简历"
  ),
  style: optimizeStyleSchema,
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
