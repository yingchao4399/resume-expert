import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildResumePdfFileName, generateATSTextPdf } from "@/lib/export/resume-pdf";
import { getDefaultLayoutConfig } from "@/lib/templates/resume-templates";
import type { FinalResume } from "@/types/resume";

const resume: FinalResume = {
  personalInfo: { name: "测试用户", email: "test@example.com", phone: "13800000000", location: "上海" },
  jobIntent: "AI 产品经理", summary: "负责可信 AI 产品设计与交付。", coreSkills: ["需求分析", "TypeScript"],
  workExperience: [{ company: "示例科技", role: "产品经理", period: "2023-至今", bullets: ["主导需求地图设计，保证事实可追溯。"] }],
  projectExperience: [], skillsAndTools: ["Figma", "SQL"], education: { school: "示例大学", degree: "本科", period: "2018-2022" },
};

describe("ATS text PDF public interface", () => {
  it("生成标准 A4 且嵌入中文字体的有效 PDF", async () => {
    const font = await readFile(new URL("../../../public/fonts/NotoSansSC-Variable.ttf", import.meta.url));
    const bytes = await generateATSTextPdf(resume, getDefaultLayoutConfig("ats-classic"), { fontBytes: font });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(0);
    for (const page of pdf.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.28, 1);
      expect(page.getHeight()).toBeCloseTo(841.89, 1);
    }
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const parsed = await pdfjs.getDocument({ data: bytes.slice() }).promise;
    const content = await (await parsed.getPage(1)).getTextContent();
    const extracted = content.items.map((item) => "str" in item ? item.str : "").join(" ");
    expect(extracted).toContain("测试用户");
    expect(extracted).toContain("AI 产品经理");
    expect(bytes.byteLength).toBeGreaterThan(10_000);
  }, 30_000);

  it("文件名区分 ATS 与视觉版并清理非法字符", () => {
    expect(buildResumePdfFileName(resume, "AI/产品经理", "ATS")).toMatch(/^测试用户-AI-产品经理-\d{8}-ATS\.pdf$/);
    expect(buildResumePdfFileName(resume, "AI/产品经理", "视觉版")).toMatch(/-视觉版\.pdf$/);
  });
});
