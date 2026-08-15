import { Packer } from "docx";
import { describe, expect, it } from "vitest";
import { buildResumeDocument } from "@/lib/export/docx";
import { getDefaultLayoutConfig } from "@/lib/templates/resume-templates";
import type { FinalResume, ResumeTemplateId } from "@/types/resume";

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
});
