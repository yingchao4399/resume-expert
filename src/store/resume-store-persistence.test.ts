import { afterEach, describe, expect, it } from "vitest";
import { createEmptyDocument } from "@/store/resume-store-document";
import { EXAMPLE_USER_INPUT } from "@/store/resume-store-example";
import { runMockResumeAnalysis } from "@/services/ai/resumeAgent.mock";
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
        schemaVersion: 10,
        documents: [document],
        activeDocumentId: document.id,
        careerEvidence: [],
        jobApplications: [],
        interviewReviews: [],
      },
      version: 10,
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

  it("accepts persisted analysis containing a legacy long JD evidence excerpt", async () => {
    const document = createEmptyDocument("long-evidence-document");
    document.analysisResult = await runMockResumeAnalysis(
      EXAMPLE_USER_INPUT,
      "ai-product",
      { companyName: "", notes: "", companySnapshotId: null },
      [],
    );
    document.analysisResult.jdAnalysis.roleInference = { items: [{
      topic: "work-content",
      level: "explicit",
      conclusion: "负责复杂业务系统建设",
      evidence: ["来自历史版本的超长岗位原文。".repeat(80)],
      confidence: "high",
      verificationQuestion: "核心交付是什么？",
    }] };
    const raw = JSON.stringify({
      state: {
        schemaVersion: 10,
        documents: [document],
        activeDocumentId: document.id,
        careerEvidence: [],
        jobApplications: [],
        interviewReviews: [],
      },
      version: 10,
    });

    expect(() => validatePersistedLibrary(raw)).not.toThrow();
  });

  it("keeps the existing schema versions when migrating legacy documents", () => {
    const legacy = {
      ...createEmptyDocument("legacy-document"),
      schemaVersion: 1,
      finalResumeStatus: undefined,
      isFinalResumeStale: true,
    };

    const migrated = migrateDocument(legacy);

    expect(migrated.schemaVersion).toBe(14);
    expect(migrated.customOptimizeInstruction).toBe("");
    expect(migrated.analysisRevision).toBeNull();
    expect(migrated.finalResumeStatus).toBe("stale");
    expect(migrated.layoutConfig.templateId).toBe("ats-classic");
  });

  it("recomputes V2 readiness from existing references without calling a model", async () => {
    const document = createEmptyDocument("v11-document");
    const analysis = await runMockResumeAnalysis(EXAMPLE_USER_INPUT, "ai-product", { companyName: "", notes: "", companySnapshotId: null }, []);
    const requirement = {
      id: "req-erp", sourceSpanId: "span-erp", sourceSpanIds: ["span-erp"], sourceQuote: "熟悉 ERP", normalizedText: "熟悉 ERP",
      kind: "tool" as const, modality: "required" as const, priority: "high" as const, priorityBasis: ["原文明示"], expectedOutcome: null,
      anchorStatus: "validated" as const, reviewStatus: "confirmed" as const, isHardGate: false, userEdited: false,
    };
    analysis.matchItems = [{ requirementId: "req-erp", jdRequirement: "熟悉 ERP", evidenceClaimIds: [], resumeQuotes: ["负责 ERP 产品"], resumeEvidence: "负责 ERP 产品", evidenceStrength: "weak", missingEvidenceTypes: [], needsSupplement: true, optimizationSuggestion: "核验" }];
    const migrated = migrateDocument({ ...document, schemaVersion: 12, analysisResult: analysis, jdAnalysisDocument: { schemaVersion: 2, sourceText: "熟悉 ERP", materialRevision: 0, revision: 1, status: "confirmed", confirmedRevision: 1, sourceSpans: [{ id: "span-erp", sectionId: null, text: "熟悉 ERP", startOffset: 0, endOffset: 6, listLevel: 0, role: "requirement" }], requirements: [requirement], hypotheses: [], qualityFindings: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    expect(migrated.analysisResult?.jobReadinessV2?.requirementAssessments[0]).toMatchObject({ coverageStatus: "partial", trustStatus: "resume-unverified", supplementNeed: "verify-existing" });
  });
});
