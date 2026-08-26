import { describe, expect, it } from "vitest";
import type { ResumeStore } from "@/store/resume-store.types";
import {
  createEmptyDocument,
  suggestedTitle,
  updateActiveDocument,
  workingStateFromDocument,
} from "@/store/resume-store-document";

describe("resume document helpers", () => {
  it("creates a schema 11 blank document with dual revision tracking", () => {
    const document = createEmptyDocument("document-1");

    expect(document).toMatchObject({
      schemaVersion: 11,
      customOptimizeInstruction: "",
      jobTargetContext: { companyName: "", notes: "", companySnapshotId: null },
      id: "document-1",
      title: "未命名简历",
      currentStep: "input",
      finalResumeStatus: "draft",
      hasManualEdits: false,
      materialRevision: 0,
      analysisRevision: null,
      jdAnalysisDocument: null,
      analysisBasis: null,
    });
    expect(document.layoutConfig.templateId).toBe("ats-classic");
  });

  it("maps and updates the active document without changing its id", () => {
    const document = createEmptyDocument("document-1");
    const state = {
      documents: [document],
      activeDocumentId: document.id,
    } as ResumeStore;

    const next = updateActiveDocument(state, { title: "产品经理版本" });
    const updated = next.documents?.[0];

    expect(updated?.id).toBe(document.id);
    expect(updated?.title).toBe("产品经理版本");
    expect(next).toMatchObject(workingStateFromDocument(updated!));
  });

  it("uses the target role in suggested document titles", () => {
    const title = suggestedTitle({
      ...createEmptyDocument().userInput,
      targetRole: "产品经理",
    });

    expect(title).toContain("产品经理");
  });
});
