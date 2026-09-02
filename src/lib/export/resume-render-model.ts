import { getBulletText } from "@/lib/evidence/resume-evidence";
import { getDefaultLayoutConfig, getTypographyConfig, RESUME_SECTION_LABELS, sanitizeLayoutConfig } from "@/lib/templates/resume-templates";
import type { FinalResume, ResumeBulletValue, ResumeFormattedText, ResumeLayoutConfig, ResumeSectionId } from "@/types/resume";
import type { ResumeEditableTarget, ResumeTypographyLevel } from "@/types/resume";
import { sliceRichText } from "@/lib/resume/rich-text";

export type ResumeRenderBlockKind = "section-heading" | "paragraph" | "experience-heading" | "bullet" | "ordered-item";

export interface ResumeRenderBlock {
  id: string;
  sectionId: ResumeSectionId;
  kind: ResumeRenderBlockKind;
  text: string;
  secondaryText?: string;
  formattedText?: ResumeFormattedText;
  ordinal?: number;
  typographyLevel: ResumeTypographyLevel;
  editableTarget?: ResumeEditableTarget;
}

export interface ResumeRenderModel {
  name: string;
  contactLine: string;
  blocks: ResumeRenderBlock[];
  layout: ResumeLayoutConfig;
  tokens: ResumeTypographyTokens;
  typography: ReturnType<typeof getTypographyConfig>;
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
    blocks.push({ id: `${sectionId}-heading`, sectionId, kind: "section-heading", text: RESUME_SECTION_LABELS[sectionId], typographyLevel: "h2" }, ...content);
  }
  return {
    name: resume.personalInfo.name || "姓名",
    contactLine: [resume.personalInfo.email, resume.personalInfo.phone, resume.personalInfo.location].filter(Boolean).join(" · "),
    blocks,
    layout,
    tokens: buildResumeTypographyTokens(layout),
    typography: getTypographyConfig(layout),
  };
}

export function buildResumeTypographyTokens(layout: ResumeLayoutConfig): ResumeTypographyTokens {
  const base = getTypographyConfig(layout).body.fontSize;
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

export function resolveTypographyLevel(kind: ResumeRenderBlockKind, sectionId: ResumeSectionId): ResumeTypographyLevel {
  if (kind === "section-heading") return "h2";
  if (kind === "experience-heading") return "h3";
  if (sectionId === "jobIntent") return "h4";
  if (sectionId === "summary") return "h5";
  if (sectionId === "coreSkills") return "h6";
  if (["education", "certifications", "languages", "awards", "links", "otherSections", "skillsAndTools"].includes(sectionId) && kind === "paragraph") return "h7";
  return "body";
}

function sectionBlocks(sectionId: ResumeSectionId, resume: FinalResume): ResumeRenderBlock[] {
  const paragraph = (text: string, id: string = sectionId, formattedText?: ResumeFormattedText): ResumeRenderBlock[] => text.trim()
    ? [{ id, sectionId, kind: "paragraph", text: text.trim(), formattedText, typographyLevel: resolveTypographyLevel("paragraph", sectionId), ...(sectionId === "summary" ? { editableTarget: { kind: "summary" } as const } : {}) }]
    : [];
  const itemList = (values: Array<{ text: string }> | undefined) => (values ?? []).flatMap((item, index) => paragraph(item.text, `${sectionId}-${index}`));
  switch (sectionId) {
    case "jobIntent": return paragraph(resume.jobIntent);
    case "summary": return paragraph(resume.summary, sectionId, resume.summaryFormatting);
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
      return resume.workExperience.flatMap((item, itemIndex) => experienceBlocks(sectionId, `work-${itemIndex}`, [item.company, item.role].filter(Boolean).join(" · "), item.period, item.bullets));
    case "projectExperience":
      return resume.projectExperience.flatMap((item, itemIndex) => experienceBlocks(sectionId, `project-${itemIndex}`, [item.name, item.role].filter(Boolean).join(" · "), item.period, item.bullets));
  }
}

function experienceBlocks(sectionId: ResumeSectionId, id: string, title: string, period: string, bullets: ResumeBulletValue[]): ResumeRenderBlock[] {
  const result: ResumeRenderBlock[] = [{ id: `${id}-heading`, sectionId, kind: "experience-heading", text: title, secondaryText: period, typographyLevel: "h3" }];
  result.push(...bullets.filter((value) => getBulletText(value).trim()).flatMap((value, index) => numberedBulletBlocks(sectionId, id, value, index)));
  return result;
}

function numberedBulletBlocks(sectionId: ResumeSectionId, id: string, value: ResumeBulletValue, index: number): ResumeRenderBlock[] {
  const text = getBulletText(value);
  const formattedText = typeof value === "string" ? undefined : value.richText;
  const bulletId = typeof value === "string" ? `${id}-bullet-${index}` : value.id;
  const editableTarget = { kind: "bullet", bulletId } as const;
  // Treat numbered sub-items as their own blocks.  The delimiter also
  // includes a Chinese/ASCII colon so strings such as “项目：1. … 2. …”
  // do not leave the first number embedded in the label.
  const markers = [...text.matchAll(/(?:^|[\s：:；;])(\d{1,2})[.、)]\s*/g)];
  if (markers.length < 2) return [{ id: `${id}-bullet-${index}`, sectionId, kind: "bullet", text, formattedText, typographyLevel: "body", editableTarget }];
  const blocks: ResumeRenderBlock[] = [];
  const firstMarker = markers[0];
  const firstIndex = firstMarker.index ?? 0;
  const numberOffset = firstMarker[0].search(/\d/);
  const prefixEnd = firstIndex + Math.max(0, numberOffset);
  const prefix = text.slice(0, prefixEnd).trim();
  if (prefix) blocks.push({ id: `${id}-bullet-${index}-label`, sectionId, kind: "paragraph", text: prefix, formattedText: sliceRichText(formattedText, 0, prefixEnd, prefix), typographyLevel: "body", editableTarget: { ...editableTarget, textOffset: 0 } });
  markers.forEach((marker, markerIndex) => {
    const start = (marker.index ?? 0) + marker[0].length;
    const end = markers[markerIndex + 1]?.index ?? text.length;
    const itemText = text.slice(start, end).trim();
    if (itemText) blocks.push({ id: `${id}-ordered-${index}-${markerIndex}`, sectionId, kind: "ordered-item", ordinal: Number(marker[1]), text: itemText, formattedText: sliceRichText(formattedText, start, end, itemText), typographyLevel: "body", editableTarget: { ...editableTarget, textOffset: start } });
  });
  return blocks.length ? blocks : [{ id: `${id}-bullet-${index}`, sectionId, kind: "bullet", text, formattedText, typographyLevel: "body", editableTarget }];
}
