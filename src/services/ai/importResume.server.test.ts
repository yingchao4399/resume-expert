import { describe, expect, it } from "vitest";
import { projectFinalResume, sanitizeImportedProfile, structureLocally } from "@/services/ai/importResume.server";

const resumeText = `张三 | 产品经理 | 上海
电话：13812345678 | 邮箱：san@example.com

工作经历
示例科技 | 产品经理 | 2021-2024
- 负责订单产品规划，覆盖 3 个业务团队

项目经历
库存重构 | 项目负责人 | 2023
- 将盘点效率提升 40%

教育背景
复旦大学 | 本科 | 2017-2021
清华大学 | 硕士 | 2021-2024

技能
产品规划、SQL、Figma

证书
PMP

语言
英语 CET-6

奖项
年度优秀员工

链接
https://github.com/example`;

describe("local resume structure parser", () => {
  it("keeps common resume sections and multiple education records", () => {
    const profile = structureLocally(resumeText);
    expect(profile.personalInfo).toMatchObject({ name: "张三", email: "san@example.com", phone: "13812345678", location: "上海" });
    expect(profile.workExperience).toHaveLength(1);
    expect(profile.projectExperience).toHaveLength(1);
    expect(profile.educationHistory).toHaveLength(2);
    expect(profile.skillsAndTools.map((item) => item.text)).toEqual(expect.arrayContaining(["产品规划", "SQL", "Figma"]));
    expect(profile.certifications[0]?.text).toBe("PMP");
    expect(profile.languages[0]?.text).toContain("英语");
    expect(profile.awards[0]?.text).toContain("年度优秀员工");
    expect(profile.links[0]?.text).toContain("github.com");
    expect(new Set(profile.skillsAndTools.map((item) => item.id)).size).toBe(profile.skillsAndTools.length);
  });

  it("does not fabricate unknown facts", () => {
    const profile = structureLocally("候选人\n\n个人介绍\n正在寻找新的机会");
    expect(profile.workExperience).toEqual([]);
    expect(profile.projectExperience).toEqual([]);
    expect(profile.educationHistory).toEqual([]);
    expect(JSON.stringify(profile)).not.toContain("示例科技");
  });

  it("quarantines empty or invalid source quotes instead of exporting them", () => {
    const profile = structureLocally(resumeText);
    profile.certifications.push({
      id: "fabricated-certificate",
      text: "不存在的高级证书",
      sourceQuote: "",
      status: "candidate",
      confidence: "high",
    });
    profile.workExperience.push({
      id: "fabricated-job", organization: "不存在的公司", name: "", role: "高级顾问", period: "2030",
      summary: "负责不存在的业务", bullets: [], sourceQuote: "", status: "candidate", confidence: "high",
    });

    const sanitized = sanitizeImportedProfile(profile, resumeText);
    const resume = projectFinalResume(sanitized);

    expect(sanitized.certifications.at(-1)?.status).toBe("needs-review");
    expect(sanitized.unmappedSegments.some((item) => item.text === "不存在的高级证书")).toBe(true);
    expect(sanitized.unmappedSegments.some((item) => item.text === "负责不存在的业务")).toBe(true);
    expect(resume.certifications?.some((item) => item.text === "不存在的高级证书")).toBe(false);
    expect(resume.workExperience.some((item) => item.company === "不存在的公司")).toBe(false);
  });
});
