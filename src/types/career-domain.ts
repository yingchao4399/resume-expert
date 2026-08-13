import type { EvidenceSourceReference } from "@/types/resume";

export type CareerExperienceType = "work" | "project" | "internship" | "inbox";
export type CareerRecordStatus = "candidate" | "confirmed" | "needs-review" | "superseded";
export type EvidenceClaimKind = "responsibility" | "action" | "decision" | "result" | "skill-practice";
export type CapabilityCategory = "product" | "technology" | "data" | "industry" | "collaboration" | "custom";
export type CapabilityLevel = 0 | 1 | 2 | 3 | 4;

export interface CareerExperience {
  id: string;
  type: CareerExperienceType;
  title: string;
  organization: string;
  role: string;
  startDate: string;
  endDate: string;
  periodText: string;
  summary: string;
  order: number;
  status: CareerRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceClaim {
  id: string;
  experienceId: string;
  kind: EvidenceClaimKind;
  text: string;
  contribution: "assisted" | "independent" | "led";
  complexity: "routine" | "complex";
  hasTradeoff: boolean;
  hasMethodReuse: boolean;
  status: CareerRecordStatus;
  sourceReference: EvidenceSourceReference | null;
  sourceQuote: string;
  sourceRunId: string | null;
  sourceRound: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MetricEvidence {
  id: string;
  claimId: string;
  value: string;
  unit: string;
  baseline: string;
  method: string;
  period: string;
  sourceNote: string;
  status: CareerRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Capability {
  id: string;
  name: string;
  category: CapabilityCategory;
  aliases: string[];
  selfLevel: CapabilityLevel;
  createdAt: string;
  updatedAt: string;
}

export interface CapabilityEvidenceLink {
  id: string;
  capabilityId: string;
  claimId: string;
  status: "candidate" | "confirmed" | "needs-review";
  source: "suggested" | "manual";
  createdAt: string;
  updatedAt: string;
}

export interface CareerInterviewAnswer {
  questionId: string;
  question: string;
  answer: string;
  round: number;
}

export interface CareerInterviewSession {
  id: string;
  experienceId: string | null;
  targetRole: string;
  experienceTitle: string;
  background: string;
  round: number;
  status: "active" | "review" | "completed";
  answers: CareerInterviewAnswer[];
  latestTurn: CareerInterviewTurn | null;
  createdAt: string;
  updatedAt: string;
}

export interface CareerInterviewQuestion {
  id: string;
  question: string;
  purpose: string;
}

export interface CareerInterviewClaimDraft {
  id: string;
  kind: EvidenceClaimKind;
  text: string;
  contribution: EvidenceClaim["contribution"];
  complexity: EvidenceClaim["complexity"];
  hasTradeoff: boolean;
  hasMethodReuse: boolean;
  sourceQuote: string;
  sourceRound: number;
  status: "candidate" | "needs-review";
}

export interface CareerInterviewTurn {
  runId: string;
  round: number;
  coverage: { responsibility: boolean; action: boolean; result: boolean; metric: boolean; decision: boolean };
  claimDrafts: CareerInterviewClaimDraft[];
  metricDrafts: Array<Omit<MetricEvidence, "id" | "claimId" | "status" | "createdAt" | "updatedAt"> & { claimDraftId: string }>;
  capabilitySuggestions: Array<{ name: string; category: CapabilityCategory; claimDraftIds: string[] }>;
  nextQuestions: CareerInterviewQuestion[];
  shouldFinish: boolean;
  finishReason: "sufficient" | "user-ended" | "max-rounds" | "continue";
  reviewWarnings: string[];
}

export interface CareerDomainSnapshot {
  schemaVersion: 1;
  experiences: CareerExperience[];
  claims: EvidenceClaim[];
  metrics: MetricEvidence[];
  capabilities: Capability[];
  capabilityLinks: CapabilityEvidenceLink[];
  interviewSessions: CareerInterviewSession[];
  quarantined: Array<{ store: string; value: unknown; reason: string }>;
}
