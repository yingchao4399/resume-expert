import { z } from "zod";

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

export const jdAnalysisDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  sourceText: z.string(),
  materialRevision: z.number().int().nonnegative(),
  revision: z.number().int().positive(),
  status: z.enum(["draft", "confirmed", "stale"]),
  confirmedRevision: z.number().int().positive().nullable(),
  sourceSpans: z.array(jdSourceSpanSchema),
  requirements: z.array(jdRequirementAtomSchema).max(40),
  hypotheses: z.array(roleHypothesisSchema),
  qualityFindings: z.array(jdQualityFindingSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

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
