import { createDefaultWorkflowDefinition } from "@/lib/studio/workflow-default";
import type { WorkflowDraft, WorkflowDraftTest, WorkflowReleaseChannel, WorkflowVersion } from "@/lib/studio/workflow-types";
import { cloneDefinition, hasRecentRealEval, isExecutionChange, validateWorkflowDefinition } from "@/lib/studio/workflow-validation";

export interface WorkflowWorkspace {
  schemaVersion: 1;
  draft: WorkflowDraft;
  versions: WorkflowVersion[];
  publishedVersionId: string;
}

export function createInitialWorkflowWorkspace(now = new Date().toISOString()): WorkflowWorkspace {
  const definition = createDefaultWorkflowDefinition();
  const test: WorkflowDraftTest = { testedAt: now, passed: true, mockEvalPassed: true, errors: [] };
  const version: WorkflowVersion = { schemaVersion: 1, id: "workflow-v1", version: 1, channel: "production", definition: cloneDefinition(definition), createdAt: now, test, basedOnVersionId: null, realEvalAt: null };
  return { schemaVersion: 1, draft: { schemaVersion: 1, definition: cloneDefinition(definition), basedOnVersionId: version.id, updatedAt: now, lastTest: null }, versions: [version], publishedVersionId: version.id };
}

export function testWorkflowDraft(draft: WorkflowDraft, now = new Date().toISOString()): WorkflowDraft {
  const validation = validateWorkflowDefinition(draft.definition);
  const mockEvalErrors = draft.definition.nodes.some((node) => node.enabled && node.kind === "ai" && (!node.promptVersion || !node.provider || !node.model || !node.timeoutMs)) ? ["启用的 AI 节点必须配置 Provider、模型、Prompt 版本和超时"] : [];
  const errors = [...validation.errors, ...mockEvalErrors];
  return { ...draft, lastTest: { testedAt: now, passed: errors.length === 0, mockEvalPassed: mockEvalErrors.length === 0, errors } };
}

export function publishWorkflowDraft(workspace: WorkflowWorkspace, realEvalAt: string | null, now = new Date().toISOString()): { workspace: WorkflowWorkspace; version: WorkflowVersion; channel: WorkflowReleaseChannel } {
  const { draft } = workspace;
  if (!draft.lastTest?.passed || draft.lastTest.testedAt < draft.updatedAt) throw new Error("草稿变更后必须重新通过结构校验和 Mock 测评");
  const current = workspace.versions.find((item) => item.id === workspace.publishedVersionId) ?? workspace.versions.at(-1);
  if (!current) throw new Error("缺少当前发布版本");
  const executionChanged = isExecutionChange(current.definition, draft.definition);
  const hasUnsupportedFlowiseNode = draft.definition.nodes.some((node) => node.enabled && node.kind === "ai" && node.provider === "flowise");
  const channel: WorkflowReleaseChannel = hasUnsupportedFlowiseNode || (executionChanged && !hasRecentRealEval(realEvalAt, new Date(now).getTime())) ? "experiment" : "production";
  const version: WorkflowVersion = { schemaVersion: 1, id: crypto.randomUUID(), version: Math.max(0, ...workspace.versions.map((item) => item.version)) + 1, channel, definition: cloneDefinition(draft.definition), createdAt: now, test: draft.lastTest, basedOnVersionId: current.id, realEvalAt: hasRecentRealEval(realEvalAt, new Date(now).getTime()) ? realEvalAt : null };
  const versions = retainVersions([...workspace.versions, version], channel === "production" ? version.id : workspace.publishedVersionId);
  return { channel, version, workspace: { ...workspace, versions, publishedVersionId: channel === "production" ? version.id : workspace.publishedVersionId, draft: { ...draft, basedOnVersionId: version.id, lastTest: null } } };
}

export function rollbackWorkflow(workspace: WorkflowWorkspace, targetId: string, now = new Date().toISOString()): WorkflowWorkspace {
  const target = workspace.versions.find((item) => item.id === targetId);
  if (!target) throw new Error("找不到回滚目标版本");
  if (target.channel !== "production") throw new Error("实验版本不能绕过评测直接回滚为生产版本");
  const validation = validateWorkflowDefinition(target.definition);
  if (!validation.valid) throw new Error("目标版本已不符合当前工作流护栏");
  const current = workspace.versions.find((item) => item.id === workspace.publishedVersionId);
  const test: WorkflowDraftTest = { testedAt: now, passed: true, mockEvalPassed: true, errors: [] };
  const version: WorkflowVersion = { ...target, id: crypto.randomUUID(), version: Math.max(...workspace.versions.map((item) => item.version)) + 1, channel: "production", createdAt: now, basedOnVersionId: current?.id ?? null, test };
  return { ...workspace, versions: retainVersions([...workspace.versions, version], version.id), publishedVersionId: version.id, draft: { schemaVersion: 1, definition: cloneDefinition(version.definition), basedOnVersionId: version.id, updatedAt: now, lastTest: null } };
}

function retainVersions(versions: WorkflowVersion[], publishedVersionId: string): WorkflowVersion[] {
  const recent = versions.slice(-10);
  if (recent.some((version) => version.id === publishedVersionId)) return recent;
  const published = versions.find((version) => version.id === publishedVersionId);
  return published ? [published, ...versions.filter((version) => version.id !== publishedVersionId).slice(-9)] : recent;
}
