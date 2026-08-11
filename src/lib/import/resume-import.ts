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
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      cMapUrl: "/api/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/api/pdfjs/standard-fonts/",
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    const pages: string[] = [];
    let imagePageCount = 0;
    let rawTextItemCount = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const textItems: PDFTextItem[] = content.items.flatMap((item) => "str" in item ? [item] : []);
      rawTextItemCount += textItems.length;
      pages.push(reconstructPDFText(textItems));
      if (textItems.every((item) => !item.str.trim())) {
        const operators = await page.getOperatorList();
        if (operators.fnArray.some((operator) =>
          operator === pdfjs.OPS.paintImageXObject ||
          operator === pdfjs.OPS.paintInlineImageXObject ||
          operator === pdfjs.OPS.paintImageMaskXObject
        )) imagePageCount += 1;
      }
    }
    await loadingTask.destroy();
    const text = normalizeText(pages.join("\n\n"));
    if (text.length < 20) {
      if (imagePageCount > 0 && rawTextItemCount === 0) {
        throw new Error("PDF_SCAN_DETECTED");
      }
      if (rawTextItemCount > 0) {
        throw new Error("PDF_FONT_ENCODING");
      }
      throw new Error("PDF_NO_TEXT");
    }
    return ensureUsefulText({
      fileType: "pdf",
      fileName: file.name,
      text,
      warnings: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    if (/password|encrypted/i.test(message)) {
      throw new Error("该 PDF 已加密，请先解除密码保护后再导入。");
    }
    if (message === "PDF_SCAN_DETECTED") {
      throw new Error("该 PDF 是扫描版或主要由图片组成，当前版本不提供 OCR。请粘贴文本或改用文字型 PDF。 ");
    }
    if (message === "PDF_FONT_ENCODING") {
      throw new Error("PDF 包含文字对象，但字体编码无法正确提取。请在 PDF 阅读器中复制文本后粘贴，或导出为标准 Unicode 字体 PDF。 ");
    }
    if (message === "PDF_NO_TEXT") {
      throw new Error("PDF 中没有可提取文字，请确认文件内容后重试。 ");
    }
    throw new Error(`PDF 解析失败：${message}`);
  }
}

interface PDFTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}

export function reconstructPDFText(items: PDFTextItem[]): string {
  const positioned = items
    .filter((item) => item.str)
    .map((item, index) => ({
      ...item,
      index,
      x: item.transform[4] ?? 0,
      y: item.transform[5] ?? 0,
      fontSize: Math.max(Math.abs(item.transform[0] ?? 0), Math.abs(item.transform[3] ?? 0), item.height || 0, 1),
    }));
  if (positioned.length === 0) return "";

  const lines: typeof positioned[] = [];
  for (const item of positioned.sort((a, b) => b.y - a.y || a.x - b.x || a.index - b.index)) {
    const tolerance = Math.max(2, item.fontSize * 0.35);
    const line = lines.find((candidate) => Math.abs(candidate[0].y - item.y) <= tolerance);
    if (line) line.push(item);
    else lines.push([item]);
  }

  return lines
    .sort((a, b) => b[0].y - a[0].y)
    .map((line) => {
      const sorted = line.sort((a, b) => a.x - b.x || a.index - b.index);
      let result = "";
      let previousEnd = 0;
      for (const item of sorted) {
        const gap = item.x - previousEnd;
        const needsSpace = result && gap > item.fontSize * 0.45 && !/\s$/.test(result);
        result += `${needsSpace ? " " : ""}${item.str}`;
        previousEnd = Math.max(previousEnd, item.x + Math.max(item.width, item.str.length * item.fontSize * 0.45));
      }
      return result.trim();
    })
    .filter(Boolean)
    .join("\n");
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
