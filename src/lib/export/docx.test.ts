import { Packer } from "docx";
import { describe, expect, it } from "vitest";
import {
  buildResumeDocument,
  buildResumeFileName,
} from "@/lib/export/docx";
import type { FinalResume } from "@/types/resume";

const resume: FinalResume = {
  personalInfo: {
    name: "张/三",
    email: "a@example.com",
    phone: "13800000000",
    location: "上海",
  },
  jobIntent: "产品经理",
  summary: "三年产品经验",
  coreSkills: ["需求分析"],
  workExperience: [
    {
      company: "某公司",
      role: "产品经理",
      period: "2021-至今",
      bullets: ["负责产品规划"],
    },
  ],
  projectExperience: [],
  skillsAndTools: ["Figma"],
  education: {
    school: "某大学",
    degree: "本科",
    period: "2016-2020",
  },
};

describe("DOCX export", () => {
  it("sanitizes the generated filename", () => {
    const filename = buildResumeFileName(resume, "AI:产品经理", "docx");
    expect(filename).toMatch(/^张-三-AI-产品经理-\d{8}\.docx$/);
  });

  it("creates a non-empty Word document", async () => {
    const buffer = await Packer.toBuffer(buildResumeDocument(resume));
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});
