import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "@/store/resume-store";
import { createResumeBackup, parseResumeBackup } from "@/lib/backup/resume-backup";
import { EXAMPLE_USER_INPUT } from "@/store/resume-store-example";
import { runMockResumeAnalysis } from "@/services/ai/resumeAgent.mock";

describe("resume backup", () => {
  it("round-trips business documents", () => {
    const document = createEmptyDocument("backup-test");
    document.title = "产品经理简历";
    document.userInput.originalResume = "一份用于测试的原始简历文本，包含足够长度。";

    const application = {
      id: "application-1", company: "示例公司", role: "产品经理", jdUrl: "", jdText: "", status: "已投递" as const,
      appliedAt: "2026-08-03", nextStepAt: "", notes: "", resumeDocumentId: document.id,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const parsed = parseResumeBackup(createResumeBackup([document], [], [application]));

    expect(parsed.documents).toHaveLength(1);
    expect(parsed.documents[0].id).toBe("backup-test");
    expect(parsed.documents[0].schemaVersion).toBe(12);
    expect(parsed.documents[0].sourceResume).toBeNull();
    expect(parsed.backupVersion).toBe(9);
    expect(parsed.jobApplications[0]).toMatchObject({ id: "application-1", resumeDocumentId: "backup-test" });
  });

  it("migrates version 1 documents without losing resume data", () => {
    const document = createEmptyDocument("legacy-test");
    const legacy = {
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      documents: [{ ...document, schemaVersion: 1, sourceResume: undefined, importMetadata: undefined }],
    };

    const parsed = parseResumeBackup(legacy);

    expect(parsed.documents[0]).toMatchObject({
      id: "legacy-test",
      schemaVersion: 12,
      jobTargetContext: { companyName: "", notes: "", companySnapshotId: null },
      sourceResume: null,
      importMetadata: null,
    });
  });

  it("round-trips analysis created from a long JD source span", async () => {
    const document = createEmptyDocument("long-jd-backup");
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
      evidence: ["一段来自 JD 的完整原文引用。".repeat(80)],
      confidence: "high",
      verificationQuestion: "核心目标是什么？",
    }] };

    const parsed = parseResumeBackup(createResumeBackup([document], [], []));

    expect(parsed.documents[0].analysisResult?.jdAnalysis.roleInference?.items[0].evidence[0].length).toBeLessThanOrEqual(500);
  });

  it("rejects malformed or empty backups", () => {
    expect(() => parseResumeBackup({ backupVersion: 1, documents: [] })).toThrow(
      /备份文件结构无效/
    );
  });
});
