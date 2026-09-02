import type { AppErrorPayload } from "@/lib/errors/app-error";
import { redactDiagnosticValue } from "@/lib/errors/app-error";
import { openStudioDB, STUDIO_INCIDENT_STORE as STORE_NAME } from "@/lib/studio/studio-db";

export interface AppIncident extends AppErrorPayload {
  scope: string;
  occurredAt: string;
}

const MAX_INCIDENTS = 100;

export async function saveIncident(incident: AppIncident): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openStudioDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put({ ...incident, diagnostic: redactDiagnosticValue(incident.diagnostic) });
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  const values = await listIncidents();
  if (values.length > MAX_INCIDENTS) {
    const trim = db.transaction(STORE_NAME, "readwrite");
    for (const item of values.slice(MAX_INCIDENTS)) trim.objectStore(STORE_NAME).delete(item.requestId);
    await new Promise<void>((resolve) => { trim.oncomplete = () => resolve(); });
  }
  db.close();
}

export async function listIncidents(): Promise<AppIncident[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openStudioDB();
  const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll();
  const values = await new Promise<AppIncident[]>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  db.close();
  return values.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function clearIncidents(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openStudioDB();
  const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear();
  await new Promise<void>((resolve, reject) => { request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
  db.close();
}
