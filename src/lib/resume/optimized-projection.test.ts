import { describe, expect, it } from "vitest";
import { applyOptimizedItemsToFinalResume } from "./optimized-projection";
import type { FinalResume, OptimizedItem } from "@/types/resume";

const resume: FinalResume = { personalInfo: { name: "测试", email: "", phone: "", location: "" }, jobIntent: "产品经理", summary: "旧摘要", coreSkills: [], workExperience: [{ company: "示例 SaaS", role: "产品经理", period: "", bullets: ["负责 WMS 核心模块"] }], projectExperience: [{ name: "补货", role: "", period: "", bullets: ["旧项目内容"] }], skillsAndTools: ["旧技能"], education: { school: "", degree: "", period: "" } };

describe("optimized resume projection", () => {
  it("keeps final resume rows aligned with the optimization table", () => {
    const items: OptimizedItem[] = [
      { id: "summary", section: "职业摘要", before: "旧摘要", after: "新摘要", reason: "", riskWarning: "" },
      { id: "work", section: "工作经历 - WMS", before: "负责 WMS 核心模块", after: "负责 WMS 核心模块并完成迭代", reason: "", riskWarning: "" },
      { id: "skills", section: "技能工具", before: "旧技能", after: "产品：Figma | 数据：SQL", reason: "", riskWarning: "" },
      { id: "new", section: "新增 - AI 项目", before: "（简历中未体现）", after: "完成 AI 项目原型", reason: "", riskWarning: "" },
    ];
    const result = applyOptimizedItemsToFinalResume(resume, items);
    expect(result.summary).toBe("新摘要");
    expect(result.workExperience[0].bullets).toContain("负责 WMS 核心模块并完成迭代");
    expect(result.skillsAndTools).toEqual(["产品：Figma", "数据：SQL"]);
    expect(result.projectExperience.at(-1)?.bullets).toContain("完成 AI 项目原型");
  });

  it("matches work and project rows by meaningful section/bullet text without duplicating content", () => {
    const items: OptimizedItem[] = [
      {
        id: "opt-3",
        section: "工作经历 - 盘点",
        before: "主导库存盘点功能重构，盘点效率提升 40%",
        after: "主导库存盘点流程重构（移动端扫码 + 差异自动核对），单次盘点耗时从 4h 降至 2.4h，效率提升 40%",
        reason: "",
        riskWarning: "",
      },
      {
        id: "opt-4",
        section: "项目经历 - 智能补货",
        before: "基于历史销售数据设计补货策略模型，推动补货建议功能上线，缺货率下降 25%",
        after: "设计基于历史销售与季节性波动的智能补货策略（规则引擎 + 安全库存模型），经 3 个月 A/B 验证后全量上线，缺货率从 12% 降至 9%",
        reason: "",
        riskWarning: "",
      },
    ];

    const result = applyOptimizedItemsToFinalResume({
      ...resume,
      workExperience: [{ ...resume.workExperience[0], bullets: ["主导库存盘点流程重构，盘点效率提升 40%"] }],
      projectExperience: [{ ...resume.projectExperience[0], name: "WMS 智能补货", bullets: ["基于历史销售与季节性波动设计补货策略模型"] }],
    }, items);
    const workBullets = result.workExperience.flatMap((experience) => experience.bullets.map(bulletTextForTest));
    const projectBullets = result.projectExperience.flatMap((experience) => experience.bullets.map(bulletTextForTest));
    expect(workBullets).toContain(items[0].after);
    expect(workBullets.filter((bullet) => bullet.includes("库存盘点")).length).toBe(1);
    expect(workBullets).not.toContain("主导库存盘点流程重构，盘点效率提升 40%");
    expect(projectBullets).toContain(items[1].after);
    expect(projectBullets.filter((bullet) => bullet.includes("智能补货策略")).length).toBe(1);
    expect(projectBullets).not.toContain("基于历史销售与季节性波动设计补货策略模型");
  });
});

function bulletTextForTest(value: string | { text: string }): string {
  return typeof value === "string" ? value : value.text;
}
