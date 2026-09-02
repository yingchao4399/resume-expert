import { z } from "zod";
import { JD_MAX_REQUIREMENTS, JD_CAPACITY_MESSAGE } from "./limits";

export const jdSourceReferenceSchema = z.object({ sourceSpanId: z.string(), quote: z.string(), startOffset: z.number().int().nonnegative(), endOffset: z.number().int().nonnegative() });
export const jdRequirementGroupSchema = z.object({ id: z.string(), title: z.string(), meaning: z.string(), outcome: z.string(), proof: z.string(), requirementIds: z.array(z.string()) });
export const jdConsolidationProposalSchema = z.object({
  materialRevision: z.number().int().nonnegative(), baseRevision: z.number().int().positive(), baseFingerprint: z.string(), mode: z.enum(["llm", "mock"]),
  merges: z.array(z.object({ id: z.string(), memberIds: z.array(z.string()).min(2), text: z.string(), reason: z.string() })),
  groups: z.array(jdRequirementGroupSchema).max(12), warnings: z.array(z.string()), createdAt: z.string(),
});

export const jdSourceSpanSchema = z.object({
  id: z.string().min(1),
  sectionId: z.string().nullable(),
  text: z.string(),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  listLevel: z.number().int().nonnegative(),
  role: z.enum(["heading", "requirement", "background", "benefit", "irrelevant"]),
});

export const jdRequirementAtomSchema = z.object({
  id: z.string().min(1),
  sourceSpanId: z.string().min(1),
  sourceSpanIds: z.array(z.string().min(1)).min(1),
  sourceQuote: z.string(),
  normalizedText: z.string(),
  kind: z.enum(["task", "deliverable", "knowledge", "skill", "tool", "experience", "education", "credential", "industry", "collaboration", "work-context", "constraint"]),
  modality: z.enum(["required", "preferred", "optional", "informational", "negated"]),
  priority: z.enum(["critical", "high", "medium", "low"]),
  priorityBasis: z.array(z.string()),
  expectedBehavior: z.string().optional(),
  expectedOutcome: z.string().nullable().optional(),
  proficiencySignal: z.enum(["awareness", "independent", "proficient", "lead", "unknown"]).optional(),
  keywords: z.array(z.string()).optional(),
  anchorStatus: z.enum(["validated", "needs-review"]),
  reviewStatus: z.enum(["auto-validated", "needs-review", "confirmed", "rejected"]),
  isHardGate: z.boolean(),
  userEdited: z.boolean(),
  sourceReferences: z.array(jdSourceReferenceSchema).optional(),
  originalRequirementIds: z.array(z.string()).optional(),
  mergeReason: z.string().optional(),
  reviewWarnings: z.array(z.string()).optional(),
  actionVerb: z.string().optional(),
  objectText: z.string().optional(),
  requiredEvidenceTypes: z.array(z.string()).optional(),
  numericConstraints: z.array(z.string()).optional(),
});

export const roleHypothesisSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["role-mission", "work-focus", "business-line", "team-pain", "reporting-line", "implicit-expectation"]),
  conclusion: z.string(),
  sourceSpanIds: z.array(z.string()),
  confidenceBasis: z.array(z.string()),
  alternativeExplanations: z.array(z.string()),
  verificationQuestion: z.string(),
  decisionImpact: z.enum(["high", "medium", "low"]),
  status: z.enum(["inferred", "unknown", "user-confirmed"]),
});

export const jdQualityFindingSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["conflict", "ambiguous", "overbroad", "negation", "seniority-mismatch", "missing-outcome"]),
  sourceSpanIds: z.array(z.string()),
  message: z.string(),
  severity: z.enum(["high", "medium", "low"]),
});

const jdMapContentSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  sourceText: z.string(),
  materialRevision: z.number().int().nonnegative(),
  revision: z.number().int().positive(),
  status: z.enum(["draft", "confirmed", "stale"]),
  confirmedRevision: z.number().int().positive().nullable(),
  sourceSpans: z.array(jdSourceSpanSchema),
  requirements: z.array(jdRequirementAtomSchema).max(JD_MAX_REQUIREMENTS, JD_CAPACITY_MESSAGE),
  hypotheses: z.array(roleHypothesisSchema),
  qualityFindings: z.array(jdQualityFindingSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  groups: z.array(jdRequirementGroupSchema).max(12).optional(),
  consolidationWarnings: z.array(z.string()).optional(),
  consolidationMode: z.enum(["llm", "mock"]).optional(),
  expertSummary: z.object({ mission: z.string(), coreOutcomes: z.array(z.string()), hardGates: z.array(z.string()), workFocus: z.array(z.string()), highValueUnknowns: z.array(z.string()), riskFlags: z.array(z.string()) }).optional(),
});

// Accept legacy maps (including previously persisted >40-item maps) before migrating.
export const jdAnalysisDocumentSchema = jdMapContentSchema.extend({ previousMap: jdMapContentSchema.nullable().optional() })
  .superRefine((value, context) => {
    const ids = value.requirements.map(item => item.id);
    if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", path: ["requirements"], message: "需求 ID 不能重复。" });
    if (value.groups?.length) {
      const grouped = value.groups.flatMap(group => group.requirementIds);
      if (grouped.length !== ids.length || new Set(grouped).size !== ids.length || grouped.some(id => !ids.includes(id))) context.addIssue({ code: "custom", path: ["groups"], message: "核心分组必须完整且唯一覆盖全部细则。" });
    }
  })
  .transform(value => ({ ...value, schemaVersion: 3 as const }));

export const analysisBasisSchema = z.object({
  materialRevision: z.number().int().nonnegative(),
  jdAnalysisRevision: z.number().int().positive(),
});

export const jobReadinessAssessmentSchema = z.object({
  overallScore: z.number().min(0).max(100),
  recommendation: z.enum(["priority-apply", "supplement-before-apply", "cautious-apply"]),
  hardGateCoverage: z.number().min(0).max(100),
  criticalRequirementCoverage: z.number().min(0).max(100),
  resultEvidenceScore: z.number().min(0).max(100),
  metricCompletenessScore: z.number().min(0).max(100),
  unresolvedHighImpactUnknowns: z.number().int().nonnegative(),
  strongestRequirementIds: z.array(z.string()),
  gapRequirementIds: z.array(z.string()),
  explanation: z.array(z.string()),
});

export const requirementAssessmentSchema = z.object({
  requirementId: z.string(),
  coverageStatus: z.enum(["covered", "partial", "missing"]),
  trustStatus: z.enum(["confirmed", "resume-unverified", "none"]),
  supplementNeed: z.enum(["none", "verify-existing", "add-detail", "new-evidence"]),
  evidenceStrength: z.enum(["strong", "medium", "weak", "none"]),
  resumeQuotes: z.array(z.string()),
  evidenceClaimIds: z.array(z.string()),
  missingDimensions: z.array(z.enum(["experience", "scope", "contribution", "action", "result", "metric"])),
  rationale: z.string(),
  matchConfidence: z.enum(["high", "medium", "low"]).optional(),
  evidenceBasis: z.array(z.string()).optional(),
  candidateEvidenceClaimIds: z.array(z.string()).optional(),
  recommendedAction: z.enum(["核验现有内容", "补充细节", "补充新经历", "无需补充"]).optional(),
});

const readinessMetricSchema = z.object({
  value: z.number().min(0).max(100).nullable(), applicable: z.boolean(), numerator: z.number().nonnegative(), denominator: z.number().nonnegative(), label: z.string(),
});

export const jobReadinessAssessmentV2Schema = z.object({
  version: z.literal(2), experimental: z.literal(true), overallScore: z.number().min(0).max(100),
  recommendation: z.enum(["priority-apply", "supplement-before-apply", "cautious-apply"]), confidence: z.enum(["low", "medium", "high"]),
  coverageScore: readinessMetricSchema, trustScore: readinessMetricSchema, resultQualityScore: readinessMetricSchema,
  hardGateCoverage: readinessMetricSchema, criticalRequirementCoverage: readinessMetricSchema,
  unresolvedHighImpactUnknowns: z.number().int().nonnegative(), requirementAssessments: z.array(requirementAssessmentSchema),
  strongestRequirementIds: z.array(z.string()), gapRequirementIds: z.array(z.string()), explanation: z.array(z.string()),
});
