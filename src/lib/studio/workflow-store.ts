import { createInitialWorkflowWorkspace, type WorkflowWorkspace } from "@/lib/studio/workflow-release";
import type { WorkflowDefinition, WorkflowDraft, WorkflowVersion } from "@/lib/studio/workflow-types";
import { openStudioDB, STUDIO_WORKFLOW_STORE as STORE_NAME } from "@/lib/studio/studio-db";

const KEY = "current";

export async function loadWorkflowWorkspace(): Promise<WorkflowWorkspace> {
  const db = await openStudioDB();
  const value = await requestValue(db.transaction(STORE_NAME).objectStore(STORE_NAME).get(KEY)) as WorkflowWorkspace | undefined;
  db.close();
  if (value?.schemaVersion === 1 && Array.isArray(value.versions)) {
    const canonicalIds = new Set(createInitialWorkflowWorkspace().draft.definition.nodes.map((node) => node.id));
    const storedIds = new Set(value.draft.definition.nodes.map((node) => node.id));
    if ([...canonicalIds].every((id) => storedIds.has(id))) return value;
    const migrated = migrateWorkspace(value);
    await saveWorkflowWorkspace(migrated);
    return migrated;
  }
  const initial = createInitialWorkflowWorkspace(); await saveWorkflowWorkspace(initial); return initial;
}

export async function saveWorkflowWorkspace(value: WorkflowWorkspace): Promise<void> {
  const db = await openStudioDB(); const tx = db.transaction(STORE_NAME, "readwrite"); tx.objectStore(STORE_NAME).put(value, KEY);
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
}

export async function saveWorkflowDraft(draft: WorkflowDraft): Promise<WorkflowWorkspace> {
  const workspace = await loadWorkflowWorkspace(); const next = { ...workspace, draft }; await saveWorkflowWorkspace(next); return next;
}

export async function getPublishedWorkflowNode(nodeId: string) {
  const workspace = await loadWorkflowWorkspace();
  const published = workspace.versions.find((version) => version.id === workspace.publishedVersionId);
  return published?.definition.nodes.find((node) => node.id === nodeId && node.enabled) ?? null;
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }

function migrateDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  const canonical = createInitialWorkflowWorkspace().draft.definition;
  const oldNodes = new Map(definition.nodes.map((node) => [node.id, node]));
  return {
    ...canonical,
    id: definition.id || canonical.id,
    name: definition.name || canonical.name,
    nodes: canonical.nodes.map((node) => {
      const old = oldNodes.get(node.id);
      if (!old) return node;
      return { ...node, position: old.position ?? node.position, provider: old.provider ?? node.provider, model: old.model ?? node.model, promptVersion: old.promptVersion ?? node.promptVersion, timeoutMs: old.timeoutMs ?? node.timeoutMs };
    }),
  };
}

function migrateWorkspace(value: WorkflowWorkspace): WorkflowWorkspace {
  const draft: WorkflowDraft = { ...value.draft, definition: migrateDefinition(value.draft.definition), lastTest: null, updatedAt: new Date().toISOString() };
  const versions: WorkflowVersion[] = value.versions.map((version) => ({ ...version, definition: migrateDefinition(version.definition) }));
  return { ...value, draft, versions };
}
