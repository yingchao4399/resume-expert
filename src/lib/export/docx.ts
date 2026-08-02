import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { FinalResume } from "@/types/resume";

const BODY_FONT = "Microsoft YaHei";

function textRun(text: string, options: { bold?: boolean; size?: number } = {}) {
  return new TextRun({
    text,
    bold: options.bold,
    size: options.size ?? 20,
    font: BODY_FONT,
  });
}

function sectionHeading(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 80 },
    border: {
      bottom: {
        color: "D4D4D4",
        size: 4,
        space: 3,
        style: "single",
      },
    },
    children: [textRun(title, { bold: true, size: 22 })],
  });
}

function bulletParagraph(bullet: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 50, line: 300 },
    children: [textRun(bullet)],
  });
}

function experienceParagraphs(
  title: string,
  period: string,
  bullets: string[]
): Paragraph[] {
  return [
    new Paragraph({
      keepNext: true,
      spacing: { before: 100, after: 60 },
      children: [
        textRun(title, { bold: true }),
        textRun(period ? `    ${period}` : ""),
      ],
    }),
    ...bullets.map(bulletParagraph),
  ];
}

export function buildResumeDocument(resume: FinalResume): Document {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 70 },
      children: [textRun(resume.personalInfo.name || "姓名", { bold: true, size: 32 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        textRun(
          [
            resume.personalInfo.email,
            resume.personalInfo.phone,
            resume.personalInfo.location,
          ]
            .filter(Boolean)
            .join("  |  "),
          { size: 18 }
        ),
      ],
    }),
    sectionHeading("求职意向"),
    new Paragraph({
      spacing: { after: 80, line: 300 },
      children: [textRun(resume.jobIntent)],
    }),
    sectionHeading("职业摘要"),
    new Paragraph({
      spacing: { after: 80, line: 320 },
      children: [textRun(resume.summary)],
    }),
    sectionHeading("核心能力"),
    ...resume.coreSkills.map(bulletParagraph),
    sectionHeading("工作经历"),
    ...resume.workExperience.flatMap((work) =>
      experienceParagraphs(
        [work.company, work.role].filter(Boolean).join(" · "),
        work.period,
        work.bullets
      )
    ),
    sectionHeading("项目经历"),
    ...resume.projectExperience.flatMap((project) =>
      experienceParagraphs(
        [project.name, project.role].filter(Boolean).join(" · "),
        project.period,
        project.bullets
      )
    ),
    sectionHeading("技能工具"),
    new Paragraph({
      spacing: { after: 80, line: 300 },
      children: [textRun(resume.skillsAndTools.join(" · "))],
    }),
    sectionHeading("教育背景"),
    new Paragraph({
      children: [
        textRun(
          [
            resume.education.school,
            resume.education.degree,
            resume.education.period,
          ]
            .filter(Boolean)
            .join(" · ")
        ),
      ],
    }),
  ];

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: BODY_FONT, size: 20 },
          paragraph: { spacing: { line: 300 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 850, right: 850, bottom: 850, left: 850 },
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
  targetRole: string
): Promise<void> {
  const blob = await Packer.toBlob(buildResumeDocument(resume));
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildResumeFileName(resume, targetRole, "docx");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
