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
}

export interface ResumeRenderPage {
  index: number;
  includeHeader: boolean;
  blocks: ResumeRenderBlock[];
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
  };
}

export function paginateResumeRenderModel(model: ResumeRenderModel): ResumeRenderPage[] {
  const contentWidthPt = (210 - model.layout.pageMargin * 2) * 2.83465;
  const pageHeightPt = (297 - model.layout.pageMargin * 2) * 2.83465;
  const pages: ResumeRenderPage[] = [];
  let current: ResumeRenderPage = { index: 0, includeHeader: true, blocks: [] };
  let remaining = pageHeightPt - estimateHeaderHeight(model);

  const pushPage = () => {
    pages.push(current);
    current = { index: pages.length, includeHeader: false, blocks: [] };
    remaining = pageHeightPt;
  };

  for (let index = 0; index < model.blocks.length; index += 1) {
    const block = model.blocks[index];
    const height = estimateBlockHeight(block, model.layout, contentWidthPt);
    const nextHeight = model.blocks[index + 1]
      ? estimateBlockHeight(model.blocks[index + 1], model.layout, contentWidthPt)
      : 0;
    const keepWithNext = block.kind === "section-heading" || block.kind === "experience-heading";
    const required = height + (keepWithNext ? Math.min(nextHeight, 90) : 0);
    if (current.blocks.length > 0 && remaining < required) pushPage();
    current.blocks.push(block);
    remaining -= height;
  }
  if (current.blocks.length || pages.length === 0) pages.push(current);
  return pages;
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

function estimateHeaderHeight(model: ResumeRenderModel): number {
  return model.contactLine ? 76 : 56;
}

function estimateBlockHeight(block: ResumeRenderBlock, layout: ResumeLayoutConfig, widthPt: number): number {
  if (block.kind === "section-heading") return 20 + layout.sectionSpacing * 0.75;
  if (block.kind === "experience-heading") return 21;
  const indentation = block.kind === "bullet" ? 18 : 0;
  const charsPerLine = Math.max(18, Math.floor((widthPt - indentation) / Math.max(layout.baseFontSize, 8.5)));
  const weightedLength = Array.from(block.text).reduce((total, char) => total + (/\s/.test(char) ? 0.4 : /[\u0000-\u00ff]/.test(char) ? 0.55 : 1), 0);
  const lines = Math.max(1, Math.ceil(weightedLength / charsPerLine));
  return lines * layout.baseFontSize * layout.lineHeight + (block.kind === "bullet" ? 4 : 6);
}
