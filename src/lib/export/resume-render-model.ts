import { getBulletText } from "@/lib/evidence/resume-evidence";
import { getDefaultLayoutConfig, RESUME_SECTION_LABELS, sanitizeLayoutConfig } from "@/lib/templates/resume-templates";
import type { FinalResume, ResumeLayoutConfig, ResumeSectionId } from "@/types/resume";

export type ResumeRenderBlockKind = "section-heading" | "paragraph" | "experience-heading" | "bullet";

export interface ResumeRenderBlock {
  id: string;
  sectionId: ResumeSectionId;
  kind: ResumeRenderBlockKind;
  text: string;
  secondaryText?: string;
}

export interface ResumeRenderModel {
  name: string;
  contactLine: string;
  blocks: ResumeRenderBlock[];
  layout: ResumeLayoutConfig;
  tokens: ResumeTypographyTokens;
}

export interface ResumeTypographyTokens {
  bodyFontSizePt: number;
  lineHeightPt: number;
  nameFontSizePt: number;
  contactFontSizePt: number;
  headingFontSizePt: number;
  sectionSpacingPt: number;
  headingAfterPt: number;
  experienceBeforePt: number;
  experienceAfterPt: number;
  paragraphAfterPt: number;
  bulletAfterPt: number;
  headerRuleBeforePt: number;
  headerToContentPt: number;
}

export function buildResumeRenderModel(
  resume: FinalResume,
  layoutConfig: ResumeLayoutConfig = getDefaultLayoutConfig(),
): ResumeRenderModel {
  const layout = sanitizeLayoutConfig(layoutConfig);
  const blocks: ResumeRenderBlock[] = [];
  for (const sectionId of layout.sectionOrder) {
    if (layout.hiddenSections.includes(sectionId)) continue;
    const content = sectionBlocks(sectionId, resume);
    if (!content.length) continue;
    blocks.push({ id: `${sectionId}-heading`, sectionId, kind: "section-heading", text: RESUME_SECTION_LABELS[sectionId] }, ...content);
  }
  return {
    name: resume.personalInfo.name || "姓名",
    contactLine: [resume.personalInfo.email, resume.personalInfo.phone, resume.personalInfo.location].filter(Boolean).join(" · "),
    blocks,
    layout,
    tokens: buildResumeTypographyTokens(layout),
  };
}

export function buildResumeTypographyTokens(layout: ResumeLayoutConfig): ResumeTypographyTokens {
  const base = layout.baseFontSize;
  return {
    bodyFontSizePt: base,
    lineHeightPt: base * layout.lineHeight,
    nameFontSizePt: base + 12,
    contactFontSizePt: Math.max(8, base - 1),
    headingFontSizePt: base + 1,
    sectionSpacingPt: layout.sectionSpacing * 0.75,
    headingAfterPt: 6,
    experienceBeforePt: base * 0.65,
    experienceAfterPt: base * 0.25,
    paragraphAfterPt: base * 0.35,
    bulletAfterPt: base * 0.2,
    headerRuleBeforePt: layout.templateId === "modern-clean" ? 9 : 12,
    headerToContentPt: 12,
  };
}

function sectionBlocks(sectionId: ResumeSectionId, resume: FinalResume): ResumeRenderBlock[] {
  const paragraph = (text: string, id: string = sectionId): ResumeRenderBlock[] => text.trim()
    ? [{ id, sectionId, kind: "paragraph", text: text.trim() }]
    : [];
  const itemList = (values: Array<{ text: string }> | undefined) => (values ?? []).flatMap((item, index) => paragraph(item.text, `${sectionId}-${index}`));
  switch (sectionId) {
    case "jobIntent": return paragraph(resume.jobIntent);
    case "summary": return paragraph(resume.summary);
    case "coreSkills": return paragraph(resume.coreSkills.join(" · "));
    case "skillsAndTools": return paragraph(resume.skillsAndTools.join(" · "));
    case "certifications": return itemList(resume.certifications);
    case "languages": return itemList(resume.languages);
    case "awards": return itemList(resume.awards);
    case "links": return itemList(resume.links);
    case "otherSections": return itemList(resume.otherSections);
    case "education": {
      const education = resume.educationHistory?.length ? resume.educationHistory : [resume.education];
      return education.flatMap((item, index) => paragraph([item.school, item.degree, item.period].filter(Boolean).join(" · "), `education-${index}`));
    }
    case "workExperience":
      return resume.workExperience.flatMap((item, itemIndex) => experienceBlocks(sectionId, `work-${itemIndex}`, [item.company, item.role].filter(Boolean).join(" · "), item.period, item.bullets.map(getBulletText)));
    case "projectExperience":
      return resume.projectExperience.flatMap((item, itemIndex) => experienceBlocks(sectionId, `project-${itemIndex}`, [item.name, item.role].filter(Boolean).join(" · "), item.period, item.bullets.map(getBulletText)));
  }
}

function experienceBlocks(sectionId: ResumeSectionId, id: string, title: string, period: string, bullets: string[]): ResumeRenderBlock[] {
  const result: ResumeRenderBlock[] = [{ id: `${id}-heading`, sectionId, kind: "experience-heading", text: title, secondaryText: period }];
  result.push(...bullets.filter((text) => text.trim()).map((text, index) => ({ id: `${id}-bullet-${index}`, sectionId, kind: "bullet" as const, text })));
  return result;
}
