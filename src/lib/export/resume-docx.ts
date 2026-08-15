import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
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
import type { FinalResume, ResumeBulletValue, ResumeLayoutConfig, ResumeSectionId } from "@/types/resume";
import { getBulletText } from "@/lib/evidence/resume-evidence";

function colorValue(hex: string) {
  return hex.replace("#", "");
}

export function buildResumeDocument(
  resume: FinalResume,
  layoutConfig: ResumeLayoutConfig = getDefaultLayoutConfig()
): Document {
  const layout = sanitizeLayoutConfig(layoutConfig);
  const font = getDocxFont(layout.fontFamily);
  const bodySize = Math.round(layout.baseFontSize * 2);
  const accent = colorValue(layout.accentColor);
  const spacingLine = Math.round(layout.lineHeight * 240);
  const sectionBefore = Math.round(layout.sectionSpacing * 12);

  const run = (text: string, options: { bold?: boolean; size?: number; color?: string } = {}) =>
    new TextRun({
      text,
      bold: options.bold,
      size: options.size ?? bodySize,
      font,
      color: options.color,
    });

  const heading = (id: ResumeSectionId) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: sectionBefore, after: 80 },
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

  const bodyParagraph = (text: string) =>
    new Paragraph({
      spacing: { after: 60, line: spacingLine },
      children: [run(text)],
    });

  const bulletParagraph = (text: string) => {
    if (layout.bulletStyle === "disc") {
      return new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 40, line: spacingLine },
        children: [run(text)],
      });
    }
    const prefix = layout.bulletStyle === "square" ? "▪ " : "– ";
    return new Paragraph({
      indent: { left: 300, hanging: 180 },
      spacing: { after: 40, line: spacingLine },
      children: [run(`${prefix}${text}`)],
    });
  };

  const experiences = (
    items: Array<{ title: string; period: string; bullets: ResumeBulletValue[] }>
  ): Paragraph[] =>
    items.flatMap((item) => [
      new Paragraph({
        keepNext: true,
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        spacing: { before: 70, after: 50 },
        children: [run(item.title, { bold: true }), run(item.period ? `\t${item.period}` : "", { color: "666666" })],
      }),
      ...item.bullets.map((bullet) => bulletParagraph(getBulletText(bullet))),
    ]);

  const sectionContent = (id: ResumeSectionId): Paragraph[] => {
    switch (id) {
      case "jobIntent":
        return [bodyParagraph(resume.jobIntent)];
      case "summary":
        return [bodyParagraph(resume.summary)];
      case "coreSkills":
        return [bodyParagraph(resume.coreSkills.join(" · "))];
      case "workExperience":
        return experiences(
          resume.workExperience.map((item) => ({
            title: [item.company, item.role].filter(Boolean).join(" · "),
            period: item.period,
            bullets: item.bullets,
          }))
        );
      case "projectExperience":
        return experiences(
          resume.projectExperience.map((item) => ({
            title: [item.name, item.role].filter(Boolean).join(" · "),
            period: item.period,
            bullets: item.bullets,
          }))
        );
      case "skillsAndTools":
        return [bodyParagraph(resume.skillsAndTools.join(" · "))];
      case "certifications":
        return (resume.certifications ?? []).filter((item) => item.text.trim()).map((item) => bodyParagraph(item.text));
      case "languages":
        return (resume.languages ?? []).filter((item) => item.text.trim()).map((item) => bodyParagraph(item.text));
      case "awards":
        return (resume.awards ?? []).filter((item) => item.text.trim()).map((item) => bodyParagraph(item.text));
      case "links":
        return (resume.links ?? []).filter((item) => item.text.trim()).map((item) => bodyParagraph(item.text));
      case "otherSections":
        return (resume.otherSections ?? []).filter((item) => item.text.trim()).map((item) => bodyParagraph(item.text));
      case "education":
        return (resume.educationHistory?.length ? resume.educationHistory : [resume.education]).map((education) => bodyParagraph([education.school, education.degree, education.period].filter(Boolean).join(" · ")));
    }
  };

  const headerAlignment = layout.templateId === "modern-clean" ? AlignmentType.LEFT : AlignmentType.CENTER;
  const children: Paragraph[] = [
    new Paragraph({
      alignment: headerAlignment,
      spacing: { after: 60 },
      children: [run(resume.personalInfo.name || "姓名", { bold: true, size: bodySize + 12, color: layout.templateId === "modern-clean" ? accent : undefined })],
    }),
    new Paragraph({
      alignment: headerAlignment,
      spacing: { after: 120 },
      border: { bottom: { color: accent, size: layout.templateId === "modern-clean" ? 8 : 4, space: 5, style: BorderStyle.SINGLE } },
      children: [
        run(
          [resume.personalInfo.email, resume.personalInfo.phone, resume.personalInfo.location]
            .filter(Boolean)
            .join("  |  "),
          { size: Math.max(16, bodySize - 2), color: "666666" }
        ),
      ],
    }),
    ...layout.sectionOrder.flatMap((id) =>
      layout.hiddenSections.includes(id) || !hasDocxSectionContent(id, resume) ? [] : [heading(id), ...sectionContent(id)]
    ),
  ];

  const margin = Math.round(layout.pageMargin * 56.7);
  return new Document({
    styles: {
      default: {
        document: {
          run: { font, size: bodySize },
          paragraph: { spacing: { line: spacingLine } },
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

function hasDocxSectionContent(id: ResumeSectionId, resume: FinalResume): boolean {
  if (id === "education") return Boolean(resume.education.school || resume.education.degree || resume.education.period || resume.educationHistory?.length);
  if (id === "certifications") return Boolean(resume.certifications?.some((item) => item.text.trim()));
  if (id === "languages") return Boolean(resume.languages?.some((item) => item.text.trim()));
  if (id === "awards") return Boolean(resume.awards?.some((item) => item.text.trim()));
  if (id === "links") return Boolean(resume.links?.some((item) => item.text.trim()));
  if (id === "otherSections") return Boolean(resume.otherSections?.some((item) => item.text.trim()));
  if (id === "workExperience") return resume.workExperience.length > 0;
  if (id === "projectExperience") return resume.projectExperience.length > 0;
  if (id === "skillsAndTools") return resume.skillsAndTools.length > 0;
  if (id === "coreSkills") return resume.coreSkills.length > 0;
  if (id === "jobIntent") return Boolean(resume.jobIntent.trim());
  if (id === "summary") return Boolean(resume.summary.trim());
  return true;
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
  layoutConfig: ResumeLayoutConfig = getDefaultLayoutConfig()
): Promise<void> {
  const blob = await Packer.toBlob(buildResumeDocument(resume, layoutConfig));
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildResumeFileName(resume, targetRole, "docx");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
