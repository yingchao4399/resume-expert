import { describe, expect, it } from "vitest";
import { extractResumeText, reconstructPDFText } from "@/lib/import/resume-import";

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

  it("reconstructs PDF lines from text coordinates", () => {
    const transform = (x: number, y: number) => [10, 0, 0, 10, x, y];
    expect(reconstructPDFText([
      { str: "第二行", transform: transform(20, 80), width: 30, height: 10 },
      { str: "产品经理", transform: transform(20, 100), width: 40, height: 10 },
      { str: "张明", transform: transform(90, 100), width: 20, height: 10 },
    ])).toBe("产品经理 张明\n第二行");
  });
});
