export const STUDIO_DB_NAME = "resume-expert-studio";
export const STUDIO_DB_VERSION = 3;
export const STUDIO_TRACE_STORE = "traces";
export const STUDIO_WORKFLOW_STORE = "workflow-workspace";
export const STUDIO_INCIDENT_STORE = "incidents";

export function openStudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(STUDIO_DB_NAME, STUDIO_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STUDIO_TRACE_STORE)) db.createObjectStore(STUDIO_TRACE_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STUDIO_WORKFLOW_STORE)) db.createObjectStore(STUDIO_WORKFLOW_STORE);
      if (!db.objectStoreNames.contains(STUDIO_INCIDENT_STORE)) db.createObjectStore(STUDIO_INCIDENT_STORE, { keyPath: "requestId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
