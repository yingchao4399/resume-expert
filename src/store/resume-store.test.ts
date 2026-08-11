import { beforeEach, describe, expect, it } from "vitest";
import {
  createEmptyDocument,
  RESUME_STORAGE_KEY,
  useResumeStore,
} from "@/store/resume-store";

describe("resume document library", () => {
  beforeEach(() => {
    const document = createEmptyDocument("test-document");
    useResumeStore.setState({
      documents: [document],
      activeDocumentId: document.id,
      careerEvidence: [],
      jobApplications: [],
      interviewReviews: [],
      userInput: document.userInput,
      currentStep: document.currentStep,
      analysisResult: document.analysisResult,
      optimizeStyle: document.optimizeStyle,
      finalResumeStatus: document.finalResumeStatus,
      hasManualEdits: document.hasManualEdits,
      storageError: null,
    });
  });

  it("creates, renames, duplicates, selects and deletes documents", () => {
    const store = useResumeStore.getState();
    store.renameDocument("产品经理版本");
    expect(useResumeStore.getState().documents[0].title).toBe("产品经理版本");

    useResumeStore.getState().duplicateDocument();
    const duplicated = useResumeStore.getState();
    expect(duplicated.documents).toHaveLength(2);
    expect(duplicated.documents[1].title).toContain("副本");

    const firstId = duplicated.documents[0].id;
    useResumeStore.getState().selectDocument(firstId);
    expect(useResumeStore.getState().activeDocumentId).toBe(firstId);

    useResumeStore.getState().deleteDocument(firstId);
    expect(useResumeStore.getState().documents).toHaveLength(1);
    expect(useResumeStore.getState().activeDocumentId).not.toBe(firstId);
  });

  it("always leaves a blank document after deleting the last one", () => {
    useResumeStore.getState().deleteDocument("test-document");
    const state = useResumeStore.getState();
    expect(state.documents).toHaveLength(1);
    expect(state.documents[0].title).toBe("未命名简历");
  });

  it("rehydrates documents from browser storage", async () => {
    const values = new Map<string, string>();
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

    useResumeStore.getState().renameDocument("已持久化版本");
    const saved = values.get(RESUME_STORAGE_KEY);
    expect(saved).toContain("已持久化版本");

    const blank = createEmptyDocument("blank");
    useResumeStore.setState({
      documents: [blank],
      activeDocumentId: blank.id,
      userInput: blank.userInput,
      currentStep: blank.currentStep,
      analysisResult: null,
      optimizeStyle: blank.optimizeStyle,
      finalResumeStatus: "draft",
      hasManualEdits: false,
    });
    values.set(RESUME_STORAGE_KEY, saved ?? "");

    await useResumeStore.persist.rehydrate();

    expect(useResumeStore.getState().documents[0].title).toBe("已持久化版本");
    Reflect.deleteProperty(globalThis, "window");
  });

  it("keeps application records and unlinks a deleted resume", () => {
    useResumeStore.getState().addJobApplication({
      company: "示例公司", role: "产品经理", jdUrl: "", jdText: "", status: "已投递",
      appliedAt: "2026-08-03", nextStepAt: "", notes: "", resumeDocumentId: "test-document",
    });
    expect(useResumeStore.getState().jobApplications[0].resumeDocumentId).toBe("test-document");
    useResumeStore.getState().deleteDocument("test-document");
    expect(useResumeStore.getState().jobApplications).toHaveLength(1);
    expect(useResumeStore.getState().jobApplications[0].resumeDocumentId).toBeNull();
  });

  it("unlinks deleted recordings without deleting interview reviews", () => {
    const review = {
      id: "review-1", applicationId: null, resumeDocumentId: null, transcriptText: "面试文本",
      result: {} as never,
      recording: { id: "rec-1", fileName: "interview.mp3", fileSize: 10, uploadedAt: "2026-08-11T00:00:00.000Z" },
      createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z",
    };
    useResumeStore.setState({ interviewReviews: [review] });
    useResumeStore.getState().unlinkInterviewRecording("rec-1");
    expect(useResumeStore.getState().interviewReviews).toHaveLength(1);
    expect(useResumeStore.getState().interviewReviews[0].recording).toBeNull();
  });
});
