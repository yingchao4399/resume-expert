import type { WorkflowNodeId } from "@/lib/studio/trace-types";

export const CALLABLE_PROMPT_IDS = [
  "resume.jd-consolidation",
  "resume.deep-jd",
  "resume.job-overview",
  "resume.requirement-match",
  "resume.interview-strategy",
  "resume.follow-up-guidance",
  "resume.optimize-items",
  "resume.keyword-enhancement",
  "resume.follow-up-bullet",
  "resume.finalize",
  "resume.import-structure",
  "career.interview",
  "interview.review",
  "project-evidence.direct",
] as const;

export type PromptId = (typeof CALLABLE_PROMPT_IDS)[number];
export type PromptArtifactKind =
  | "system-prompt"
  | "user-prompt-template"
  | "runtime-user-prompt"
  | "schema-instruction"
  | "structure-repair"
  | "output-schema"
  | "model-policy"
  | "markdown";

export interface PromptSourceRef {
  path: string;
  symbol?: string;
  kind: PromptArtifactKind;
}

export interface PromptEvaluationBinding {
  suites: string[];
  approvedPromptHash?: string;
  approvedAt?: string;
}

export interface PromptDefinition {
  id: string;
  callable: boolean;
  lifecycle?: "active" | "retired";
  name: string;
  description: string;
  module: string;
  workflowNodeId?: WorkflowNodeId;
  version: string;
  variables: string[];
  schemaName?: string;
  sourceRefs: PromptSourceRef[];
  systemTemplatePreview: string;
  userTemplatePreview: string;
  modelPolicy: {
    provider: "configured" | "runtime";
    strictOutput?: boolean;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  };
  evaluation: PromptEvaluationBinding;
}

export type PromptAttemptKind = "primary" | "response-format-fallback" | "reasoning-control-fallback" | "schema-repair";
export type PromptSnapshotStatus = "prepared" | "success" | "http-error" | "validation-error" | "cancelled";

export interface PromptRuntimeSnapshot {
  schemaVersion: 1;
  id: string;
  invocationId: string;
  traceId?: string;
  promptId: PromptId;
  promptVersion: string;
  attempt: number;
  attemptKind: PromptAttemptKind;
  status: PromptSnapshotStatus;
  createdAt: string;
  finishedAt?: string;
  provider: string;
  model: string;
  structuredOutputStrategy: string;
  responseFormat: string;
  schemaName: string;
  schemaContract: string;
  schemaHash: string;
  promptHash: string;
  baseSystemPrompt: string;
  runtimeUserPrompt: string;
  sentSystemPrompt: string;
  sentUserPrompt: string;
  temperature?: number;
  maxTokens: number;
  timeoutMs: number;
  reasoningMode?: "disabled" | "provider-default";
  requestParameters?: Record<string, unknown>;
  latencyMs?: number;
  finishReason?: string;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  batchSize?: number;
  repairCount?: number;
  validationIssues: string[];
}

export interface PromptCaptureContext {
  traceId?: string;
  snapshots: PromptRuntimeSnapshot[];
}

export type SourceCatalogKind = "markdown" | "prompt-source" | "schema-source" | "model-policy";
export type SourceGitStatus = "tracked" | "modified" | "untracked" | "ignored" | "unknown";

export interface SourceCatalogEntry {
  path: string;
  name: string;
  kind: SourceCatalogKind;
  size: number;
  modifiedAt: string;
  hash: string;
  gitStatus: SourceGitStatus;
  promptIds: string[];
}

export interface SourceCatalogContent {
  entry: SourceCatalogEntry;
  content: string;
}
