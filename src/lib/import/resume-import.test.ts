import { describe, expect, it } from "vitest";
import { extractResumeText } from "@/lib/import/resume-import";

describe("resume file import", () => {
  it("rejects unsupported files", async () => {
    const file = new File(["plain text"], "resume.txt", { type: "text/plain" });
    await expect(extractResumeText(file)).rejects.toThrow(/仅支持 PDF 和 DOCX/);
  });

  it("rejects empty files", async () => {
    const file = new File([], "resume.pdf", { type: "application/pdf" });
    await expect(extractResumeText(file)).rejects.toThrow(/文件为空/);
  });

  it("rejects files larger than ten megabytes", async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "resume.pdf");
    await expect(extractResumeText(file)).rejects.toThrow(/10 MB/);
  });
});
