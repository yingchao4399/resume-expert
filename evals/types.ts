export type EvalCategory =
  | "complete"
  | "evidence-gap"
  | "number-risk"
  | "immutable-fields"
  | "career-stage"
  | "malformed-output";

export interface FactLedger {
  immutableFacts: string[];
  allowedFacts: string[];
  forbiddenClaims: string[];
}

export interface EvalExpectation {
  requiredKeywords: string[];
  supplementRequirements: string[];
  evidenceStrength: Record<string, "strong" | "medium" | "weak" | "none">;
}

export interface EvalCase {
  id: string;
  name: string;
  category: EvalCategory;
  input: {
    targetRole: string;
    jobStage: string;
    jobDescription: string;
    originalResume: string;
  };
  facts: FactLedger;
  expected: EvalExpectation;
}

export interface EvalMetricResult {
  schemaValidityRate: number;
  immutableFactRetentionRate: number;
  unsupportedClaimRate: number;
  finalResumeFactAccuracy: number;
  jdRequirementRecall: number;
  needsSupplementF1: number;
  evidenceStrengthMacroF1: number;
  averageLatencyMs: number;
  totalTokens: number;
  failureTypes: Record<string, number>;
}

export interface EvalRun {
  schemaVersion: 1;
  id: string;
  mode: "mock" | "ai";
  createdAt: string;
  model?: string;
  caseCount: number;
  metrics: EvalMetricResult;
  cases: Array<{ id: string; passed: boolean; latencyMs: number; failures: string[] }>;
}
