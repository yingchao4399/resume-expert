import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import { buildResumeFileName } from "@/lib/export/resume-docx";
import { buildResumeRenderModel } from "@/lib/export/resume-render-model";
import { isPaginationPlanCurrent } from "@/lib/export/resume-pagination";
import { getDefaultLayoutConfig } from "@/lib/templates/resume-templates";
import type { FinalResume, PdfGenerationProgress, ResumeLayoutConfig, ResumePaginationPlan } from "@/types/resume";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MM_TO_PT = 2.83465;
const FONT_URL = "/fonts/NotoSansSC-Variable.ttf";

export interface PdfGenerationOptions {
  archivedAt?: string;
  fontBytes?: ArrayBuffer | Uint8Array;
  paginationPlan?: ResumePaginationPlan;
  onProgress?: (progress: PdfGenerationProgress) => void;
}

export async function generateATSTextPdf(
  resume: FinalResume,
  layoutConfig: ResumeLayoutConfig = getDefaultLayoutConfig(),
  options: PdfGenerationOptions = {},
): Promise<Uint8Array> {
  options.onProgress?.({ mode: "ats-text", stage: "loading-font", page: 0, pageCount: 0 });
  const fontBytes = options.fontBytes ?? await loadBundledFont();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const model = buildResumeRenderModel(resume, layoutConfig);
  const paginationPlan = options.paginationPlan;
  if (paginationPlan && !isPaginationPlanCurrent(paginationPlan, model)) {
    throw new Error("A4 分页结果已过期，请等待预览重新分页后再下载。");
  }
  const plannedPageByBlockId = new Map(
    paginationPlan?.pages.flatMap((plannedPage) => plannedPage.blockIds.map((id) => [id, plannedPage.index] as const)) ?? [],
  );
  const margin = model.layout.pageMargin * MM_TO_PT;
  const width = A4_WIDTH - margin * 2;
  const baseSize = model.tokens.bodyFontSizePt;
  const lineHeight = model.tokens.lineHeightPt;
  const accent = parseHex(model.layout.accentColor);
  let page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  let pageNumber = 1;
  let plannedPageIndex = 0;
  let y = A4_HEIGHT - margin;
  options.onProgress?.({ mode: "ats-text", stage: "paginating", page: pageNumber, pageCount: 0 });

  const addPage = () => {
    page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    pageNumber += 1;
    y = A4_HEIGHT - margin;
  };
  const requireSpace = (height: number) => {
    if (y - height >= margin) return;
    if (paginationPlan) throw new Error("ATS PDF 内容超出统一 A4 分页计划，请返回模板页执行一键适配或手动缩小排版。");
    addPage();
  };

  const nameSize = model.tokens.nameFontSizePt;
  const nameWidth = font.widthOfTextAtSize(model.name, nameSize);
  page.drawText(model.name, { x: model.layout.templateId === "modern-clean" ? margin : (A4_WIDTH - nameWidth) / 2, y: y - nameSize, size: nameSize, font, color: model.layout.templateId === "modern-clean" ? accent : rgb(0.1, 0.1, 0.1) });
  y -= nameSize + 8;
  if (model.contactLine) {
    const contactSize = model.tokens.contactFontSizePt;
    const contactWidth = font.widthOfTextAtSize(model.contactLine, contactSize);
    page.drawText(model.contactLine, { x: model.layout.templateId === "modern-clean" ? margin : Math.max(margin, (A4_WIDTH - contactWidth) / 2), y: y - contactSize, size: contactSize, font, color: rgb(0.35, 0.35, 0.35) });
    y -= contactSize + 10;
  }
  page.drawLine({ start: { x: margin, y }, end: { x: A4_WIDTH - margin, y }, thickness: model.layout.templateId === "modern-clean" ? 1.6 : 0.7, color: accent });
  y -= 12;

  for (let index = 0; index < model.blocks.length; index += 1) {
    const block = model.blocks[index];
    const targetPageIndex = plannedPageByBlockId.get(block.id) ?? plannedPageIndex;
    while (paginationPlan && plannedPageIndex < targetPageIndex) {
      addPage();
      plannedPageIndex += 1;
    }
    const next = model.blocks[index + 1];
    const estimated = block.kind === "section-heading" || block.kind === "experience-heading"
      ? 20 + (next ? lineHeight : 0)
      : lineHeight;
    requireSpace(estimated);
    if (block.kind === "section-heading") {
      y -= model.tokens.sectionSpacingPt;
      const headingSize = model.tokens.headingFontSizePt;
      page.drawText(block.text, { x: margin, y: y - headingSize, size: headingSize, font, color: accent });
      y -= headingSize + model.tokens.headingAfterPt / 2;
      if (model.layout.templateId !== "modern-clean") page.drawLine({ start: { x: margin, y }, end: { x: A4_WIDTH - margin, y }, thickness: 0.45, color: accent });
      y -= model.tokens.headingAfterPt / 2;
      continue;
    }
    if (block.kind === "experience-heading") {
      y -= model.tokens.experienceBeforePt;
      const period = block.secondaryText ?? "";
      const periodSize = Math.max(8, baseSize - 1);
      page.drawText(block.text, { x: margin, y: y - baseSize, size: baseSize, font, color: rgb(0.12, 0.12, 0.12) });
      if (period) page.drawText(period, { x: A4_WIDTH - margin - font.widthOfTextAtSize(period, periodSize), y: y - periodSize, size: periodSize, font, color: rgb(0.4, 0.4, 0.4) });
      y -= lineHeight + model.tokens.experienceAfterPt;
      continue;
    }
    const prefix = block.kind === "bullet" ? `${model.layout.bulletStyle === "dash" ? "-" : model.layout.bulletStyle === "square" ? "▪" : "•"} ` : "";
    const indent = block.kind === "bullet" ? 14 : 0;
    const lines = wrapText(block.text, font, baseSize, width - indent);
    requireSpace(lines.length * lineHeight + 4);
    lines.forEach((line, lineIndex) => {
      requireSpace(lineHeight + 3);
      const text = `${lineIndex === 0 ? prefix : ""}${line}`;
      page.drawText(text, { x: margin + (lineIndex === 0 ? 0 : indent), y: y - baseSize, size: baseSize, font, color: rgb(0.22, 0.22, 0.22) });
      y -= lineHeight;
    });
    y -= block.kind === "bullet" ? model.tokens.bulletAfterPt : model.tokens.paragraphAfterPt;
  }

  pdf.setTitle(`${model.name} - 简历`);
  pdf.setCreator("简历专家 Resume Expert");
  const pageCount = pdf.getPageCount();
  options.onProgress?.({ mode: "ats-text", stage: "rendering", page: pageCount, pageCount });
  return pdf.save();
}

export async function generateVisualPdf(
  pageElements: HTMLElement[],
  options: Pick<PdfGenerationOptions, "onProgress" | "paginationPlan"> = {},
): Promise<Uint8Array> {
  if (!pageElements.length) throw new Error("A4 预览尚未完成分页，请稍后重试。");
  if (options.paginationPlan) {
    if (pageElements.length !== options.paginationPlan.pageCount) throw new Error("A4 预览页数与分页计划不一致，请等待重新分页后再下载。");
    if (pageElements.some((element) => element.dataset.contentHash !== options.paginationPlan!.contentHash)) {
      throw new Error("A4 预览内容已变化，请等待重新分页后再下载。");
    }
  }
  const [{ default: html2canvas }, pdf] = await Promise.all([import("html2canvas"), PDFDocument.create()]);
  for (const [index, element] of pageElements.entries()) {
    options.onProgress?.({ mode: "visual", stage: "rendering", page: index + 1, pageCount: pageElements.length });
    const canvas = await html2canvas(element, { backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false });
    const image = await pdf.embedPng(canvas.toDataURL("image/png"));
    const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    page.drawImage(image, { x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT });
  }
  return pdf.save();
}

export async function downloadATSTextPdf(resume: FinalResume, targetRole: string, layoutConfig: ResumeLayoutConfig, options: PdfGenerationOptions = {}) {
  const bytes = await generateATSTextPdf(resume, layoutConfig, options);
  downloadBytes(bytes, buildResumePdfFileName(resume, targetRole, "ATS", options.archivedAt));
}

export async function downloadVisualPdf(pageElements: HTMLElement[], resume: FinalResume, targetRole: string, options: Pick<PdfGenerationOptions, "onProgress" | "paginationPlan" | "archivedAt"> = {}) {
  const bytes = await generateVisualPdf(pageElements, options);
  downloadBytes(bytes, buildResumePdfFileName(resume, targetRole, "视觉版", options.archivedAt));
}

export function buildResumePdfFileName(resume: FinalResume, targetRole: string, suffix: "ATS" | "视觉版", archivedAt?: string) {
  return buildResumeFileName(resume, targetRole, "pdf", archivedAt).replace(/\.pdf$/, `-${suffix}.pdf`);
}

function downloadBytes(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadBundledFont(): Promise<ArrayBuffer> {
  const response = await fetch(FONT_URL);
  if (!response.ok) throw new Error(`中文字体加载失败 (${response.status})，请刷新后重试。`);
  return response.arrayBuffer();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const char of Array.from(text.replace(/\r?\n/g, " "))) {
    const candidate = current + char;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) { lines.push(current.trimEnd()); current = char.trimStart(); }
    else current = candidate;
  }
  if (current) lines.push(current.trimEnd());
  return lines.length ? lines : [""];
}

function parseHex(hex: string) {
  const value = hex.replace("#", "");
  return rgb(Number.parseInt(value.slice(0, 2), 16) / 255, Number.parseInt(value.slice(2, 4), 16) / 255, Number.parseInt(value.slice(4, 6), 16) / 255);
}
