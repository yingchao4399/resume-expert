import { createInitialWorkflowWorkspace, type WorkflowWorkspace } from "@/lib/studio/workflow-release";
import type { WorkflowDraft } from "@/lib/studio/workflow-types";
import { openStudioDB, STUDIO_WORKFLOW_STORE as STORE_NAME } from "@/lib/studio/studio-db";

const KEY = "current";

export async function loadWorkflowWorkspace(): Promise<WorkflowWorkspace> {
  const db = await openStudioDB();
  const value = await requestValue(db.transaction(STORE_NAME).objectStore(STORE_NAME).get(KEY)) as WorkflowWorkspace | undefined;
  db.close();
  if (value?.schemaVersion === 1 && Array.isArray(value.versions)) return value;
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
