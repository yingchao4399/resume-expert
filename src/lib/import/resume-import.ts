"use client";

export type ResumeImportFileType = "pdf" | "docx";

export interface ExtractedResumeText {
  fileType: ResumeImportFileType;
  fileName: string;
  text: string;
  warnings: string[];
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function extractResumeText(file: File): Promise<ExtractedResumeText> {
  if (!file.size) throw new Error("文件为空，请重新选择。");
  if (file.size > MAX_FILE_BYTES) throw new Error("文件不能超过 10 MB。");

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "docx") return extractDocx(file);
  if (extension === "pdf") return extractPdf(file);
  throw new Error("仅支持 PDF 和 DOCX 文件。");
}

async function extractDocx(file: File): Promise<ExtractedResumeText> {
  try {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return ensureUsefulText({
      fileType: "docx",
      fileName: file.name,
      text: normalizeText(result.value),
      warnings: result.messages.map((message: { message: string }) => message.message).filter(Boolean),
    });
  } catch (error) {
    throw new Error(
      error instanceof Error ? `DOCX 解析失败：${error.message}` : "DOCX 解析失败，请确认文件未损坏。"
    );
  }
}

async function extractPdf(file: File): Promise<ExtractedResumeText> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await loadingTask.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .trim()
      );
    }
    await loadingTask.destroy();
    return ensureUsefulText({
      fileType: "pdf",
      fileName: file.name,
      text: normalizeText(pages.join("\n\n")),
      warnings: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    if (/password|encrypted/i.test(message)) {
      throw new Error("该 PDF 已加密，请先解除密码保护后再导入。");
    }
    throw new Error(`PDF 解析失败：${message}`);
  }
}

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ensureUsefulText(result: ExtractedResumeText): ExtractedResumeText {
  if (result.text.length < 20) {
    throw new Error("未提取到可用文字。该文件可能是扫描版，请改用可复制文字的文件或直接粘贴简历文本。");
  }
  return result;
}
