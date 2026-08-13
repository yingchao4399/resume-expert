import { afterEach, describe, expect, it } from "vitest";
import { createEmptyDocument } from "@/store/resume-store-document";
import {
  RESUME_RECOVERY_KEY,
  RESUME_STORAGE_KEY,
  clearPendingRecovery,
  getPendingRecovery,
  migrateDocument,
  safeLocalStorage,
  validatePersistedLibrary,
} from "@/store/resume-store-persistence";

describe("resume store persistence", () => {
  afterEach(() => {
    clearPendingRecovery();
    Reflect.deleteProperty(globalThis, "window");
  });

  it("validates the current persisted library envelope", () => {
    const document = createEmptyDocument("document-1");
    const raw = JSON.stringify({
      state: {
        schemaVersion: 8,
        documents: [document],
        activeDocumentId: document.id,
        careerEvidence: [],
        jobApplications: [],
        interviewReviews: [],
      },
      version: 8,
    });

    expect(() => validatePersistedLibrary(raw)).not.toThrow();
    expect(() => validatePersistedLibrary("{}"))
      .toThrow("持久化数据缺少文档库结构");
  });

  it("preserves corrupt storage before returning an empty hydration value", () => {
    const values = new Map<string, string>([[RESUME_STORAGE_KEY, "{broken-json"]]);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        dispatchEvent: () => true,
        localStorage: {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => values.set(key, value),
          removeItem: (key: string) => values.delete(key),
        },
      },
    });

    expect(safeLocalStorage.getItem(RESUME_STORAGE_KEY)).toBeNull();
    expect(values.get(RESUME_RECOVERY_KEY)).toContain("{broken-json");
    expect(getPendingRecovery()?.raw).toBe("{broken-json");
  });

  it("keeps the existing schema versions when migrating legacy documents", () => {
    const legacy = {
      ...createEmptyDocument("legacy-document"),
      schemaVersion: 1,
      finalResumeStatus: undefined,
      isFinalResumeStale: true,
    };

    const migrated = migrateDocument(legacy);

    expect(migrated.schemaVersion).toBe(8);
    expect(migrated.analysisRevision).toBeNull();
    expect(migrated.finalResumeStatus).toBe("stale");
    expect(migrated.layoutConfig.templateId).toBe("ats-classic");
  });
});
