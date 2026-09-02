import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildResumeDocument } from "@/lib/export/docx";
import { buildResumeRenderModel } from "@/lib/export/resume-render-model";
import { hashResumeRenderModel } from "@/lib/export/resume-pagination";
import { getDefaultLayoutConfig } from "@/lib/templates/resume-templates";
import type { FinalResume, ResumePaginationPlan, ResumeTemplateId } from "@/types/resume";

const resume: FinalResume = {
  personalInfo: { name: "模板测试", email: "test@example.com", phone: "13800000000", location: "上海" },
  jobIntent: "产品经理",
  summary: "用于验证三种模板导出的固定测试数据。",
  coreSkills: ["需求分析", "数据分析"],
  workExperience: [{ company: "示例公司", role: "产品经理", period: "2022-至今", bullets: ["完成产品迭代"] }],
  projectExperience: [],
  skillsAndTools: ["Figma"],
  education: { school: "示例大学", degree: "本科", period: "2018-2022" },
  educationHistory: [
    { id: "edu-1", school: "示例大学", degree: "本科", period: "2018-2022", details: [], sourceQuote: "示例大学 本科", status: "confirmed", confidence: "high" },
    { id: "edu-2", school: "进修学院", degree: "产品课程", period: "2024", details: [], sourceQuote: "进修学院 产品课程", status: "confirmed", confidence: "high" },
  ],
  certifications: [{ id: "cert-1", text: "PMP", sourceQuote: "PMP", status: "confirmed", confidence: "high" }],
  languages: [{ id: "language-1", text: "英语 CET-6", sourceQuote: "英语 CET-6", status: "confirmed", confidence: "high" }],
  awards: [],
  links: [{ id: "link-1", text: "https://example.com", sourceQuote: "https://example.com", status: "confirmed", confidence: "high" }],
  otherSections: [{ id: "other-1", text: "可接受出差", sourceQuote: "可接受出差", status: "confirmed", confidence: "high" }],
};

describe("template DOCX export", () => {
  it.each<ResumeTemplateId>(["ats-classic", "modern-clean", "compact-professional"])(
    "builds the %s template",
    async (templateId) => {
      const buffer = await Packer.toBuffer(
        buildResumeDocument(resume, getDefaultLayoutConfig(templateId))
      );
      expect(buffer.byteLength).toBeGreaterThan(1000);
    }
  );

  it("writes the shared A4 page boundaries as explicit DOCX page breaks", async () => {
    const layout = getDefaultLayoutConfig("ats-classic");
    const model = buildResumeRenderModel(resume, layout);
    const splitAt = Math.max(1, Math.floor(model.blocks.length / 2));
    const plan: ResumePaginationPlan = {
      contentHash: hashResumeRenderModel(model),
      pageCount: 2,
      pages: [
        { index: 0, includeHeader: true, blockIds: model.blocks.slice(0, splitAt).map((block) => block.id), usedHeight: 200, availableHeight: 650 },
        { index: 1, includeHeader: false, blockIds: model.blocks.slice(splitAt).map((block) => block.id), usedHeight: 200, availableHeight: 720 },
      ],
      overflow: false,
      compatibilityRatio: 0.94,
      measuredAt: "2026-08-26T00:00:00.000Z",
    };
    const buffer = await Packer.toBuffer(buildResumeDocument(resume, layout, plan));
    const archive = await JSZip.loadAsync(buffer);
    const xml = await archive.file("word/document.xml")!.async("string");
    expect(xml.match(/w:pageBreakBefore/g)).toHaveLength(plan.pageCount - 1);
    expect(xml).toContain('w:lineRule="exact"');
  });

  it("rejects an overflowing A4 plan instead of exporting a misleading DOCX", () => {
    const layout = getDefaultLayoutConfig("ats-classic");
    const model = buildResumeRenderModel(resume, layout);
    const plan: ResumePaginationPlan = {
      contentHash: hashResumeRenderModel(model), pageCount: 1,
      pages: [{ index: 0, includeHeader: true, blockIds: model.blocks.map((block) => block.id), usedHeight: 800, availableHeight: 700 }],
      overflow: true, compatibilityRatio: 0.94, measuredAt: "2026-08-26T00:00:00.000Z",
    };
    expect(() => buildResumeDocument(resume, layout, plan)).toThrow(/无法安全分页/);
  });

  it("keeps typography roles and selected paragraph formatting in editable Word", async () => {
    const layout = {
      ...getDefaultLayoutConfig("ats-classic"),
      typography: {
        h1: { fontFamily: "songti" as const, fontSize: 23, color: "#123456" },
        h4: { fontFamily: "arial" as const, fontSize: 12, color: "#234567" },
        body: { fontFamily: "calibri" as const, fontSize: 10, color: "#345678" },
      },
    };
    const formattedResume: FinalResume = {
      ...resume,
      workExperience: [{ ...resume.workExperience[0], bullets: [{
        id: "bullet-format", text: "完成产品迭代", sourceType: "manual", evidenceIds: [], evidenceLinks: [], originalText: "", aiText: "", manualText: "完成产品迭代",
        richText: { runs: [{ text: "完成", bold: true, italic: true, underline: true }, { text: "产品迭代" }], alignment: "right", firstLineIndent: 0.5, hangingIndent: 1 },
      }] }],
    };
    const buffer = await Packer.toBuffer(buildResumeDocument(formattedResume, layout));
    const archive = await JSZip.loadAsync(buffer);
    const xml = await archive.file("word/document.xml")!.async("string");
    expect(xml).toContain('w:val="right"');
    expect(xml).toContain("<w:b/>");
    expect(xml).toContain("<w:i/>");
    expect(xml).toContain("<w:u");
    expect(xml).toContain('w:val="123456"');
    expect(xml).toContain('w:val="234567"');
    expect(xml).toContain("SimSun");
  });
});
