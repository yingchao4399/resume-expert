import { describe, expect, it } from "vitest";
import {
  buildOnePageFitCandidates,
  createResumePaginationPlan,
} from "@/lib/export/resume-pagination";
import { buildResumeRenderModel } from "@/lib/export/resume-render-model";
import { getDefaultLayoutConfig } from "@/lib/templates/resume-templates";
import type { FinalResume } from "@/types/resume";

const resume: FinalResume = {
  personalInfo: { name: "分页测试", email: "test@example.com", phone: "13800000000", location: "上海" },
  jobIntent: "产品经理",
  summary: "用于验证真实 A4 分页计划。",
  coreSkills: ["需求分析"],
  workExperience: [{ company: "示例公司", role: "产品经理", period: "2022-至今", bullets: ["完成流程重构"] }],
  projectExperience: [],
  skillsAndTools: [],
  education: { school: "示例大学", degree: "本科", period: "2018-2022" },
};

describe("resume pagination public interface", () => {
  it("uses measured A4 heights and keeps a heading with its first content block", () => {
    const model = buildResumeRenderModel(resume, {
      ...getDefaultLayoutConfig("ats-classic"),
      sectionOrder: ["jobIntent", "summary"],
      hiddenSections: ["coreSkills", "workExperience", "projectExperience", "skillsAndTools", "education", "certifications", "languages", "awards", "links", "otherSections"],
    });
    const [jobHeading, jobBody, summaryHeading, summaryBody] = model.blocks;
    const plan = createResumePaginationPlan(model, {
      pageContentHeight: 400,
      headerHeight: 80,
      blockHeights: {
        [jobHeading.id]: 40,
        [jobBody.id]: 200,
        [summaryHeading.id]: 40,
        [summaryBody.id]: 100,
      },
    });

    expect(plan.pageCount).toBe(2);
    expect(plan.pages[0].blockIds).toEqual([jobHeading.id, jobBody.id]);
    expect(plan.pages[1].blockIds).toEqual([summaryHeading.id, summaryBody.id]);
    expect(plan.pages[0].availableHeight).toBeCloseTo(296);
    expect(plan.compatibilityRatio).toBe(0.94);
    expect(plan.overflow).toBe(false);
  });

  it("changes its content hash when resume content or layout changes", () => {
    const classic = buildResumeRenderModel(resume, getDefaultLayoutConfig("ats-classic"));
    const compact = buildResumeRenderModel(resume, getDefaultLayoutConfig("compact-professional"));
    const measurements = {
      pageContentHeight: 600,
      headerHeight: 60,
      blockHeights: Object.fromEntries(classic.blocks.map((block) => [block.id, 20])),
    };
    const classicPlan = createResumePaginationPlan(classic, measurements);
    const compactPlan = createResumePaginationPlan(compact, {
      ...measurements,
      blockHeights: Object.fromEntries(compact.blocks.map((block) => [block.id, 20])),
    });

    expect(classicPlan.contentHash).not.toBe(compactPlan.contentHash);
  });

  it("marks an indivisible block taller than the A4 budget as overflow", () => {
    const model = buildResumeRenderModel(resume, {
      ...getDefaultLayoutConfig("ats-classic"),
      sectionOrder: ["summary"],
      hiddenSections: ["jobIntent", "coreSkills", "workExperience", "projectExperience", "skillsAndTools", "education", "certifications", "languages", "awards", "links", "otherSections"],
    });
    const plan = createResumePaginationPlan(model, {
      pageContentHeight: 400,
      headerHeight: 80,
      blockHeights: Object.fromEntries(model.blocks.map((block) => [block.id, block.kind === "paragraph" ? 500 : 30])),
    });

    expect(plan.pageCount).toBe(1);
    expect(plan.overflow).toBe(true);
  });

  it("builds bounded one-page fit candidates without hiding content", () => {
    const layout = {
      ...getDefaultLayoutConfig("ats-classic"),
      baseFontSize: 10,
      lineHeight: 1.5,
      sectionSpacing: 9,
      pageMargin: 12,
    };
    const candidates = buildOnePageFitCandidates(layout);

    expect(candidates[0]).toMatchObject({ sectionSpacing: 8, pageMargin: 12, lineHeight: 1.5, baseFontSize: 10 });
    expect(candidates.at(-1)).toMatchObject({ sectionSpacing: 6, pageMargin: 10, lineHeight: 1.15, baseFontSize: 8.5 });
    expect(candidates.every((candidate) => candidate.hiddenSections === layout.hiddenSections)).toBe(true);
  });
});
