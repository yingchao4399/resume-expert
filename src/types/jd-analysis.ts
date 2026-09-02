export type JDSourceRole = "heading" | "requirement" | "background" | "benefit" | "irrelevant";
export type JDRequirementKind =
  | "task"
  | "deliverable"
  | "knowledge"
  | "skill"
  | "tool"
  | "experience"
  | "education"
  | "credential"
  | "industry"
  | "collaboration"
  | "work-context"
  | "constraint";
export type RequirementModality = "required" | "preferred" | "optional" | "informational" | "negated";
export type JDRequirementPriority = "critical" | "high" | "medium" | "low";
export type JDReviewStatus = "auto-validated" | "needs-review" | "confirmed" | "rejected";

export interface JDSourceSpan {
  id: string;
  sectionId: string | null;
  text: string;
  startOffset: number;
  endOffset: number;
  listLevel: number;
  role: JDSourceRole;
}

export interface JDRequirementAtomDraft {
  sourceSpanId: string;
  sourceQuote: string;
  normalizedText: string;
  kind: JDRequirementKind;
  modality: RequirementModality;
  priority: JDRequirementPriority;
  priorityBasis: string[];
  expectedBehavior?: string;
  expectedOutcome?: string | null;
  proficiencySignal?: "awareness" | "independent" | "proficient" | "lead" | "unknown";
  keywords?: string[];
}

export interface JDRequirementAtom extends JDRequirementAtomDraft {
  id: string;
  sourceSpanIds: string[];
  anchorStatus: "validated" | "needs-review";
  reviewStatus: JDReviewStatus;
  isHardGate: boolean;
  userEdited: boolean;
  sourceReferences?: JDSourceReference[];
  originalRequirementIds?: string[];
  mergeReason?: string;
  reviewWarnings?: string[];
}

export interface JDSourceReference {
  sourceSpanId: string;
  quote: string;
  startOffset: number;
  endOffset: number;
}

export interface JDRequirementGroup {
  id: string;
  title: string;
  meaning: string;
  outcome: string;
  proof: string;
  requirementIds: string[];
}

export interface JDConsolidationMerge {
  id: string;
  memberIds: string[];
  text: string;
  reason: string;
}

export interface JDConsolidationProposal {
  materialRevision: number;
  baseRevision: number;
  baseFingerprint: string;
  mode: "llm" | "mock";
  merges: JDConsolidationMerge[];
  groups: JDRequirementGroup[];
  warnings: string[];
  createdAt: string;
}

export interface RoleHypothesis {
  id: string;
  type: "role-mission" | "work-focus" | "business-line" | "team-pain" | "reporting-line" | "implicit-expectation";
  conclusion: string;
  sourceSpanIds: string[];
  confidenceBasis: string[];
  alternativeExplanations: string[];
  verificationQuestion: string;
  decisionImpact: "high" | "medium" | "low";
  status: "inferred" | "unknown" | "user-confirmed";
}

export interface JDQualityFinding {
  id: string;
  type: "conflict" | "ambiguous" | "overbroad" | "negation" | "seniority-mismatch" | "missing-outcome";
  sourceSpanIds: string[];
  message: string;
  severity: "high" | "medium" | "low";
}

export interface JDAnalysisDocument {
  schemaVersion: 1 | 2;
  sourceText: string;
  materialRevision: number;
  revision: number;
  status: "draft" | "confirmed" | "stale";
  confirmedRevision: number | null;
  sourceSpans: JDSourceSpan[];
  requirements: JDRequirementAtom[];
  hypotheses: RoleHypothesis[];
  qualityFindings: JDQualityFinding[];
  createdAt: string;
  updatedAt: string;
  groups?: JDRequirementGroup[];
  consolidationWarnings?: string[];
  consolidationMode?: "llm" | "mock";
  previousMap?: Omit<JDAnalysisDocument, "previousMap"> | null;
}

export type ApplicationRecommendation = "priority-apply" | "supplement-before-apply" | "cautious-apply";

export interface JobReadinessAssessment {
  overallScore: number;
  recommendation: ApplicationRecommendation;
  hardGateCoverage: number;
  criticalRequirementCoverage: number;
  resultEvidenceScore: number;
  metricCompletenessScore: number;
  unresolvedHighImpactUnknowns: number;
  strongestRequirementIds: string[];
  gapRequirementIds: string[];
  explanation: string[];
}

export type RequirementCoverageStatus = "covered" | "partial" | "missing";
export type EvidenceTrustStatus = "confirmed" | "resume-unverified" | "none";
export type SupplementNeed = "none" | "verify-existing" | "add-detail" | "new-evidence";
export type SupplementDecision = "unreviewed" | "verified-existing" | "answered" | "no-experience" | "skipped";
export type EvidenceDimension = "experience" | "scope" | "contribution" | "action" | "result" | "metric";

export interface RequirementAssessment {
  requirementId: string;
  coverageStatus: RequirementCoverageStatus;
  trustStatus: EvidenceTrustStatus;
  supplementNeed: SupplementNeed;
  evidenceStrength: import("@/types/resume").EvidenceStrength;
  resumeQuotes: string[];
  evidenceClaimIds: string[];
  missingDimensions: EvidenceDimension[];
  rationale: string;
}

export interface ReadinessMetric {
  value: number | null;
  applicable: boolean;
  numerator: number;
  denominator: number;
  label: string;
}

export interface JobReadinessAssessmentV2 {
  version: 2;
  experimental: true;
  overallScore: number;
  recommendation: ApplicationRecommendation;
  confidence: "low" | "medium" | "high";
  coverageScore: ReadinessMetric;
  trustScore: ReadinessMetric;
  resultQualityScore: ReadinessMetric;
  hardGateCoverage: ReadinessMetric;
  criticalRequirementCoverage: ReadinessMetric;
  unresolvedHighImpactUnknowns: number;
  requirementAssessments: RequirementAssessment[];
  strongestRequirementIds: string[];
  gapRequirementIds: string[];
  explanation: string[];
}
