import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEmptyDocument,
  RESUME_STORAGE_KEY,
  RESUME_RECOVERY_KEY,
  useResumeStore,
} from "@/store/resume-store";
import type { AnalysisResult, CareerEvidence, FinalResume, ImportedResumeProfile } from "@/types/resume";

function analysisWithLinkedEvidence(evidenceId: string): AnalysisResult {
  return {
    jdAnalysis: { responsibilities: [], hardRequirements: [], implicitRequirements: [], keywords: ["TypeScript"], idealCandidate: "", coreCompetencies: [] },
    diagnosis: { overallScore: 60, dimensionScores: [], mainIssues: [], prioritySuggestions: [] },
    matchItems: [{ jdRequirement: "TypeScript", resumeEvidence: "used TypeScript", evidenceStrength: "strong", needsSupplement: false, optimizationSuggestion: "" }],
    followUpQuestions: [], optimizedItems: [],
    finalResume: {
      personalInfo: { name: "Test User", email: "", phone: "", location: "" }, jobIntent: "Engineer", summary: "", coreSkills: ["TypeScript"],
      workExperience: [{ company: "Example", role: "Engineer", period: "2024", bullets: [{
        id: "bullet-1", text: "Built a TypeScript service", sourceType: "ai-generated", evidenceIds: [evidenceId],
        evidenceLinks: [{ evidenceId, status: "confirmed", method: "manual", sourceReference: null }],
        originalText: "", aiText: "Built a TypeScript service", manualText: "",
      }] }],
      projectExperience: [], skillsAndTools: [], education: { school: "", degree: "", period: "" },
    },
    interviewPrep: { likelyQuestions: [], evidenceToPrepare: [], possibleExaggerations: [], dataToSupplement: [], selfIntroduction: "" },
  };
}

function evidence(id: string): CareerEvidence {
  return {
    id, type: "achievement", title: "TypeScript service", organization: "Example", role: "Engineer", period: "2024",
    description: "Built a TypeScript service", metrics: [], skills: ["TypeScript"], status: "confirmed", sourceType: "manual",
    sourceDocumentId: null, sourceReference: null, createdAt: "2026-08-13T00:00:00.000Z", updatedAt: "2026-08-13T00:00:00.000Z",
  };
}

describe("resume document library", () => {
  it("loads example materials and resets job context", () => {
    useResumeStore.getState().setUserInput({ targetRole: "已有岗位" });
    useResumeStore.getState().setJobTargetContext({ companyName: "已有公司", notes: "已有背景" });
    expect(useResumeStore.getState().loadExampleData()).toBe(true);
    const next = useResumeStore.getState();
    expect(next.userInput.targetRole).toBe("AI 产品经理");
    expect(next.jobTargetContext).toEqual({ companyName: "", notes: "", companySnapshotId: null });
    expect(next.analysisResult).toBeNull();
    expect(next.finalResumeStatus).toBe("draft");
  });
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
      sourceResume: null,
      importedResume: null,
      importMetadata: null,
      materialRevision: document.materialRevision,
      analysisRevision: document.analysisRevision,
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
      materialRevision: blank.materialRevision,
      analysisRevision: blank.analysisRevision,
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

  it("protects unsaved drafts when switching documents", () => {
    const values = new Map<string, string>();
    const confirm = vi.fn(() => false);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { confirm, dispatchEvent: () => true, localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } },
    });
    useResumeStore.getState().createDocument();
    const firstId = useResumeStore.getState().documents[0].id;
    const activeId = useResumeStore.getState().activeDocumentId;
    useResumeStore.getState().setDirtyScope("resume");
    useResumeStore.getState().selectDocument(firstId);
    expect(useResumeStore.getState().activeDocumentId).toBe(activeId);
    expect(confirm).toHaveBeenCalledOnce();
    Reflect.deleteProperty(globalThis, "window");
  });

  it("preserves corrupt persisted data in a recovery slot and locks overwrite", async () => {
    const values = new Map<string, string>([[RESUME_STORAGE_KEY, "{broken-json"]]);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { confirm: () => true, dispatchEvent: () => true, localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } },
    });
    await useResumeStore.persist.rehydrate();
    useResumeStore.getState().markHydrated();
    expect(useResumeStore.getState().recoveryAvailable).toBe(true);
    expect(values.get(RESUME_RECOVERY_KEY)).toContain("{broken-json");
    useResumeStore.getState().renameDocument("不应覆盖异常数据");
    expect(values.get(RESUME_STORAGE_KEY)).toBe("{broken-json");
    useResumeStore.getState().clearCorruptStorage();
    Reflect.deleteProperty(globalThis, "window");
  });

  it("invalidates old analysis when materials change and rejects a late result", () => {
    const state = useResumeStore.getState();
    const revision = state.materialRevision;
    useResumeStore.getState().setUserInput({ targetRole: "新岗位" });
    expect(useResumeStore.getState().materialRevision).toBe(revision + 1);
    expect(useResumeStore.getState().setAnalysisResult({} as never, revision)).toBe(false);
    expect(useResumeStore.getState().analysisError).toContain("材料已在分析期间发生变化");
  });

  it("writes interview preparation atomically only for the current material revision", () => {
    const revision = useResumeStore.getState().materialRevision;
    const result = analysisWithLinkedEvidence("evidence-1");
    expect(useResumeStore.getState().setAnalysisResult(result, revision)).toBe(true);
    const prep = { ...result.interviewPrep, selfIntroduction: "当前版本面试策略" };
    expect(useResumeStore.getState().setInterviewPrep(prep, revision)).toBe(true);
    expect(useResumeStore.getState().analysisResult?.interviewPrep.selfIntroduction).toBe("当前版本面试策略");
    useResumeStore.getState().setUserInput({ targetRole: "变化后的岗位" });
    expect(useResumeStore.getState().setInterviewPrep({ ...prep, selfIntroduction: "迟到结果" }, revision)).toBe(false);
    expect(useResumeStore.getState().analysisResult?.interviewPrep.selfIntroduction).toBe("当前版本面试策略");
  });

  it("creates evidence candidates only from user-confirmed imported records", () => {
    const source: FinalResume = {
      personalInfo: { name: "李明", email: "", phone: "", location: "" },
      jobIntent: "产品经理", summary: "", coreSkills: [],
      workExperience: [{ company: "示例公司", role: "产品经理", period: "2024", bullets: ["负责需求分析"] }],
      projectExperience: [], skillsAndTools: [], education: { school: "", degree: "", period: "" },
    };
    const profile: ImportedResumeProfile = {
      schemaVersion: 1, personalInfo: source.personalInfo, jobIntent: source.jobIntent, summary: "",
      workExperience: [{ id: "work-1", organization: "示例公司", name: "", role: "产品经理", period: "2024", summary: "", sourceQuote: "示例公司 产品经理 2024\n负责需求分析", status: "candidate", confidence: "high", bullets: [{ id: "item-1", text: "负责需求分析", sourceQuote: "负责需求分析", status: "candidate", confidence: "high" }] }],
      internshipExperience: [], projectExperience: [], educationHistory: [], skillsAndTools: [], certifications: [], languages: [], awards: [], links: [], otherSections: [], unmappedSegments: [],
    };
    const metadata = { sourceType: "text" as const, fileName: "resume.txt", importedAt: "2026-08-16T00:00:00.000Z", warnings: [] };

    useResumeStore.getState().setImportedResume("示例公司 产品经理 2024\n负责需求分析", source, metadata, profile);
    expect(useResumeStore.getState().careerEvidence).toHaveLength(0);

    const confirmed = { ...profile, workExperience: profile.workExperience.map((item) => ({ ...item, status: "confirmed" as const, bullets: item.bullets.map((bullet) => ({ ...bullet, status: "confirmed" as const })) })) };
    useResumeStore.getState().setImportedResume("示例公司 产品经理 2024\n负责需求分析", source, metadata, confirmed);
    expect(useResumeStore.getState().careerEvidence).toHaveLength(1);
    expect(useResumeStore.getState().careerEvidence[0].description).toBe("负责需求分析");
  });

  it("preserves imported extended sections when an AI result omits them", () => {
    const source: FinalResume = {
      personalInfo: { name: "李明", email: "", phone: "", location: "" }, jobIntent: "产品经理", summary: "", coreSkills: [],
      workExperience: [], projectExperience: [], skillsAndTools: [], education: { school: "A大学", degree: "本科", period: "2020" },
      educationHistory: [{ id: "edu-1", school: "A大学", degree: "本科", period: "2020", details: [], sourceQuote: "A大学 本科 2020", status: "confirmed", confidence: "high" }],
      certifications: [{ id: "cert-1", text: "PMP", sourceQuote: "PMP", status: "confirmed", confidence: "high" }],
      languages: [], awards: [], links: [], otherSections: [],
    };
    useResumeStore.getState().setImportedResume("A大学 本科 2020\nPMP", source, { sourceType: "text", fileName: "resume.txt", importedAt: "2026-08-16T00:00:00.000Z", warnings: [] });
    const revision = useResumeStore.getState().materialRevision;
    useResumeStore.getState().setAnalysisResult(analysisWithLinkedEvidence("evidence-1"), revision);
    expect(useResumeStore.getState().analysisResult?.finalResume.certifications?.[0].text).toBe("PMP");
    expect(useResumeStore.getState().analysisResult?.finalResume.educationHistory).toHaveLength(1);
  });

  it("updates repeated follow-up candidates instead of duplicating them", () => {
    const state = useResumeStore.getState();
    const result = {
      followUpQuestions: [{ id: "fu-1", question: "问题", purpose: "补证", userAnswer: "", generatedBullet: "" }],
      finalResume: { personalInfo: { name: "", email: "", phone: "", location: "" }, jobIntent: "", summary: "", coreSkills: [], workExperience: [], projectExperience: [], skillsAndTools: [], education: { school: "", degree: "", period: "" } },
    } as never;
    useResumeStore.setState({ analysisResult: result, analysisRevision: state.materialRevision });
    useResumeStore.getState().setFollowUpBullet("fu-1", "第一次回答");
    useResumeStore.getState().setFollowUpBullet("fu-1", "第二次回答");
    expect(useResumeStore.getState().careerEvidence).toHaveLength(1);
    expect(useResumeStore.getState().careerEvidence[0].description).toBe("第二次回答");
  });

  it("remaps evidence foreign keys when merging a backup copy", () => {
    const imported = createEmptyDocument("imported-document");
    imported.analysisResult = analysisWithLinkedEvidence("imported-evidence");
    imported.analysisRevision = imported.materialRevision;
    imported.finalResumeStatus = "confirmed";

    useResumeStore.getState().importDocuments([imported], "merge", [evidence("imported-evidence")]);

    const state = useResumeStore.getState();
    const importedEvidence = state.careerEvidence.find((item) => item.title === "TypeScript service");
    const importedDocument = state.documents.find((item) => item.id !== "test-document");
    const bullet = importedDocument?.analysisResult?.finalResume.workExperience[0].bullets[0];
    expect(importedEvidence?.id).toBeTruthy();
    expect(typeof bullet === "string" ? null : bullet?.evidenceLinks[0].evidenceId).toBe(importedEvidence?.id);
    expect(importedEvidence?.id).not.toBe("imported-evidence");
  });

  it("marks linked resumes stale when confirmed evidence changes or is deleted", () => {
    const document = createEmptyDocument("linked-document");
    document.analysisResult = analysisWithLinkedEvidence("evidence-1");
    document.analysisRevision = document.materialRevision;
    document.finalResumeStatus = "confirmed";
    useResumeStore.setState({
      documents: [document], activeDocumentId: document.id, careerEvidence: [evidence("evidence-1")],
      userInput: document.userInput, currentStep: document.currentStep, analysisResult: document.analysisResult,
      materialRevision: document.materialRevision, analysisRevision: document.analysisRevision,
      optimizeStyle: document.optimizeStyle, finalResumeStatus: document.finalResumeStatus, hasManualEdits: document.hasManualEdits,
    });

    useResumeStore.getState().updateCareerEvidence("evidence-1", { description: "Corrected fact" });
    let state = useResumeStore.getState();
    let bullet = state.analysisResult?.finalResume.workExperience[0].bullets[0];
    expect(state.careerEvidence[0].status).toBe("candidate");
    expect(state.finalResumeStatus).toBe("stale");
    expect(typeof bullet === "string" ? null : bullet?.evidenceLinks[0].status).toBe("needs-review");

    useResumeStore.getState().deleteCareerEvidence("evidence-1");
    state = useResumeStore.getState();
    bullet = state.analysisResult?.finalResume.workExperience[0].bullets[0];
    expect(state.careerEvidence).toHaveLength(0);
    expect(typeof bullet === "string" ? null : bullet?.evidenceLinks).toEqual([]);
  });

  it("recovers valid collections independently and keeps the recovery slot until confirmation", () => {
    const values = new Map<string, string>();
    const document = createEmptyDocument("recover-document");
    const raw = JSON.stringify({
      state: {
        schemaVersion: 10, documents: [document], activeDocumentId: document.id,
        careerEvidence: [evidence("recover-evidence"), { id: "broken" }], jobApplications: [], interviewReviews: [],
      }, version: 8,
    });
    values.set(RESUME_RECOVERY_KEY, JSON.stringify({ capturedAt: "2026-08-13T00:00:00.000Z", reason: "partial corruption", raw }));
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { dispatchEvent: () => true, localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } },
    });

    const report = useResumeStore.getState().attemptStorageRecovery();
    expect(report).toMatchObject({ documents: 1, careerEvidence: 1, skipped: 1 });
    expect(useResumeStore.getState().careerEvidence[0].id).toBe("recover-evidence");
    expect(values.has(RESUME_RECOVERY_KEY)).toBe(true);

    useResumeStore.getState().confirmStorageRecovery();
    expect(values.has(RESUME_RECOVERY_KEY)).toBe(false);
    Reflect.deleteProperty(globalThis, "window");
  });
});
