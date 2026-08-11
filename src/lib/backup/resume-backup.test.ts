import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "@/store/resume-store";
import { createResumeBackup, parseResumeBackup } from "@/lib/backup/resume-backup";

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
    expect(parsed.documents[0].schemaVersion).toBe(5);
    expect(parsed.documents[0].sourceResume).toBeNull();
    expect(parsed.backupVersion).toBe(2);
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
      schemaVersion: 5,
      sourceResume: null,
      importMetadata: null,
    });
  });

  it("rejects malformed or empty backups", () => {
    expect(() => parseResumeBackup({ backupVersion: 1, documents: [] })).toThrow(
      /备份文件结构无效/
    );
  });
});
