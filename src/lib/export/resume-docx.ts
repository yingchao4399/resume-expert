import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LineRuleType,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
} from "docx";
import {
  getDefaultLayoutConfig,
  getDocxFont,
  RESUME_SECTION_LABELS,
  sanitizeLayoutConfig,
} from "@/lib/templates/resume-templates";
import type { FinalResume, ResumeLayoutConfig, ResumeSectionId } from "@/types/resume";
import { buildResumeRenderModel } from "@/lib/export/resume-render-model";
import { isPaginationPlanCurrent } from "@/lib/export/resume-pagination";
import type { ResumePaginationPlan } from "@/types/resume";

function colorValue(hex: string) {
  return hex.replace("#", "");
}

export function buildResumeDocument(
  resume: FinalResume,
  layoutConfig: ResumeLayoutConfig = getDefaultLayoutConfig(),
  paginationPlan?: ResumePaginationPlan,
): Document {
  const layout = sanitizeLayoutConfig(layoutConfig);
  const renderModel = buildResumeRenderModel(resume, layout);
  if (paginationPlan && !isPaginationPlanCurrent(paginationPlan, renderModel)) {
    throw new Error("A4 分页结果已过期，请等待预览重新分页后再下载。");
  }
  if (paginationPlan?.overflow) {
    throw new Error("当前内容存在无法安全分页的超长区块，请压缩排版或精简内容后再下载 Word。");
  }
  const font = getDocxFont(layout.fontFamily);
  const wordFont = { ascii: font, hAnsi: font, eastAsia: font, cs: font };
  const bodySize = Math.round(renderModel.tokens.bodyFontSizePt * 2);
  const accent = colorValue(layout.accentColor);
  const spacingLine = Math.round(renderModel.tokens.lineHeightPt * 20);
  const sectionBefore = Math.round(renderModel.tokens.sectionSpacingPt * 20);
  const pageBreakBlockIds = new Set(
    paginationPlan?.pages.slice(1).map((page) => page.blockIds[0]).filter((id): id is string => Boolean(id)) ?? [],
  );

  const run = (text: string, options: { bold?: boolean; size?: number; color?: string } = {}) =>
    new TextRun({
      text,
      bold: options.bold,
      size: options.size ?? bodySize,
      font: wordFont,
      color: options.color,
    });

  const heading = (id: ResumeSectionId, pageBreakBefore = false) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      keepNext: true,
      pageBreakBefore,
      spacing: { before: sectionBefore, after: Math.round(renderModel.tokens.headingAfterPt * 20) },
      border:
        layout.templateId === "modern-clean"
          ? {
              left: { color: accent, size: 12, space: 6, style: BorderStyle.SINGLE },
            }
          : {
              bottom: { color: accent, size: 4, space: 3, style: BorderStyle.SINGLE },
            },
      children: [run(RESUME_SECTION_LABELS[id], { bold: true, size: bodySize + 2, color: accent })],
    });

  const bodyParagraph = (text: string, pageBreakBefore = false) =>
    new Paragraph({
      pageBreakBefore,
      widowControl: true,
      spacing: { after: Math.round(renderModel.tokens.paragraphAfterPt * 20), line: spacingLine, lineRule: LineRuleType.EXACT },
      children: [run(text)],
    });

  const bulletParagraph = (text: string, pageBreakBefore = false) => {
    const prefix = layout.bulletStyle === "square" ? "▪ " : layout.bulletStyle === "dash" ? "– " : "• ";
    return new Paragraph({
      keepLines: true,
      widowControl: true,
      pageBreakBefore,
      indent: { left: 180, hanging: 120 },
      spacing: { after: Math.round(renderModel.tokens.bulletAfterPt * 20), line: spacingLine, lineRule: LineRuleType.EXACT },
      children: [run(`${prefix}${text}`)],
    });
  };

  const renderBlock = (block: (typeof renderModel.blocks)[number]): Paragraph[] => {
    const pageBreakBefore = pageBreakBlockIds.has(block.id);
    if (block.kind === "section-heading") return [heading(block.sectionId, pageBreakBefore)];
    if (block.kind === "bullet") return [bulletParagraph(block.text, pageBreakBefore)];
    if (block.kind === "experience-heading") return [new Paragraph({
      keepNext: true,
      pageBreakBefore,
      widowControl: true,
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      spacing: { before: Math.round(renderModel.tokens.experienceBeforePt * 20), after: Math.round(renderModel.tokens.experienceAfterPt * 20) },
      children: [run(block.text, { bold: true }), run(block.secondaryText ? `\t${block.secondaryText}` : "", { color: "666666" })],
    })];
    return [bodyParagraph(block.text, pageBreakBefore)];
  };

  const headerAlignment = layout.templateId === "modern-clean" ? AlignmentType.LEFT : AlignmentType.CENTER;
  const children: Paragraph[] = [
    new Paragraph({
      alignment: headerAlignment,
      spacing: { after: 60 },
      children: [run(resume.personalInfo.name || "姓名", { bold: true, size: Math.round(renderModel.tokens.nameFontSizePt * 2), color: layout.templateId === "modern-clean" ? accent : undefined })],
    }),
    new Paragraph({
      alignment: headerAlignment,
      spacing: { after: Math.round(renderModel.tokens.headerToContentPt * 20) },
      border: { bottom: { color: accent, size: layout.templateId === "modern-clean" ? 8 : 4, space: 5, style: BorderStyle.SINGLE } },
      children: [
        run(
          [resume.personalInfo.email, resume.personalInfo.phone, resume.personalInfo.location]
            .filter(Boolean)
            .join("  |  "),
          { size: Math.round(renderModel.tokens.contactFontSizePt * 2), color: "666666" }
        ),
      ],
    }),
    ...renderModel.blocks.flatMap(renderBlock),
  ];

  const margin = Math.round(layout.pageMargin * 56.7);
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: wordFont, size: bodySize },
          paragraph: { spacing: { line: spacingLine, lineRule: LineRuleType.EXACT } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: margin, right: margin, bottom: margin, left: margin },
          },
        },
        children,
      },
    ],
  });
}

export function buildResumeFileName(
  resume: FinalResume,
  targetRole: string,
  extension: "docx" | "pdf"
): string {
  const base = [resume.personalInfo.name, targetRole]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("-");
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const safe = (base || "简历")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return `${safe}-${date}.${extension}`;
}

export async function downloadResumeDocx(
  resume: FinalResume,
  targetRole: string,
  layoutConfig: ResumeLayoutConfig = getDefaultLayoutConfig(),
  paginationPlan?: ResumePaginationPlan,
): Promise<void> {
  const blob = await Packer.toBlob(buildResumeDocument(resume, layoutConfig, paginationPlan));
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildResumeFileName(resume, targetRole, "docx");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
