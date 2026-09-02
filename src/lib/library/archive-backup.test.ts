import { describe, expect, it, vi } from "vitest";
import { syntheticLibraryDocument } from "@/test-fixtures/library";
import { createArchive } from "./resume-archives";
import { createResumeBackupV11, parseResumeBackup } from "@/lib/backup/resume-backup";

vi.mock("@/lib/career/career-db", () => ({ readCareerDomain: async () => ({ schemaVersion: 1, experiences: [], claims: [], metrics: [], capabilities: [], capabilityLinks: [], interviewSessions: [], quarantined: [] }) }));

describe("archive backup scope", () => {
  it("includes only related archives for a current backup, and orphan archives for a full backup", async () => {
    const a = syntheticLibraryDocument("a"), b = syntheticLibraryDocument("b");
    const archives = [createArchive(a, "a", ""), createArchive(b, "b", ""), { ...createArchive(a, "orphan", ""), sourceDocumentId: null }];
    const current = await createResumeBackupV11([a], [], [], [], "current", archives);
    expect(current.archives).toHaveLength(1);
    expect(current.archives[0].sourceDocumentId).toBe("a");
    const all = await createResumeBackupV11([a, b], [], [], [], "all", archives);
    expect(parseResumeBackup(all).archives).toHaveLength(3);
    expect(JSON.stringify(all)).not.toContain("apiKey");
  });
});
