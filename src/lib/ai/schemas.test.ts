import { describe, expect, it } from "vitest";
import {
  analyzeRequestSchema,
  finalResumeSchema,
} from "@/lib/ai/schemas";
import { defaultUserInput } from "@/store/resume-store";

const finalResume = {
  personalInfo: {
    name: "张三",
    email: "a@example.com",
    phone: "13800000000",
    location: "上海",
  },
  jobIntent: "产品经理",
  summary: "三年产品经验",
  coreSkills: ["需求分析"],
  workExperience: [],
  projectExperience: [],
  skillsAndTools: ["Figma"],
  education: {
    school: "某大学",
    degree: "本科",
    period: "2016-2020",
  },
};

describe("AI schemas", () => {
  it("accepts a complete final resume", () => {
    expect(finalResumeSchema.safeParse(finalResume).success).toBe(true);
  });

  it("rejects a final resume with a missing required section", () => {
    const invalid: Partial<typeof finalResume> = { ...finalResume };
    delete invalid.summary;
    expect(finalResumeSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects an analyze request without JD and resume text", () => {
    const parsed = analyzeRequestSchema.safeParse({
      input: { ...defaultUserInput, targetRole: "产品经理" },
    });
    expect(parsed.success).toBe(false);
  });
});
