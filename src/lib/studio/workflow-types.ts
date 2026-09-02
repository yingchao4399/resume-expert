export type WorkflowProvider = "direct" | "flowise" | "mock";
export type WorkflowNodeKind = "start" | "end" | "ai" | "human" | "gate" | "action";
export type WorkflowDataType = "none" | "materials" | "analysis" | "evidence" | "resume-draft" | "resume-confirmed" | "delivery";
export type WorkflowReleaseChannel = "production" | "experiment";

export interface WorkflowNode {
  id: string;
  label: string;
  description: string;
  kind: WorkflowNodeKind;
  position: { x: number; y: number };
  inputType: WorkflowDataType;
  outputType: WorkflowDataType;
  locked: boolean;
  optional: boolean;
  enabled: boolean;
  provider?: WorkflowProvider;
  model?: string;
  promptVersion?: string;
  timeoutMs?: number;
  requiresHumanApproval: boolean;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface WorkflowDefinition {
  schemaVersion: 1;
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowDraft {
  schemaVersion: 1;
  definition: WorkflowDefinition;
  basedOnVersionId: string | null;
  updatedAt: string;
  lastTest: WorkflowDraftTest | null;
}

export interface WorkflowDraftTest {
  testedAt: string;
  passed: boolean;
  mockEvalPassed: boolean;
  errors: string[];
}

export interface WorkflowVersion {
  schemaVersion: 1;
  id: string;
  version: number;
  channel: WorkflowReleaseChannel;
  definition: WorkflowDefinition;
  createdAt: string;
  test: WorkflowDraftTest;
  basedOnVersionId: string | null;
  realEvalAt: string | null;
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
}

export const REQUIRED_GATE_IDS = ["materials-validation", "jd-confirmation", "final-resume-confirmation", "export-gate"] as const;
