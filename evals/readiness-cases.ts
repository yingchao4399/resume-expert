export interface ReadinessGoldCase {
  id: string;
  family: string;
  level: string;
  scenario: "resume-quote" | "confirmed-fact" | "no-evidence";
  requirement: string;
  resume: string;
  expectedNeed: "verify-existing" | "add-detail" | "new-evidence";
}

const families = [
  ["产品", "负责 ERP/WMS 与 ToB SaaS 产品规划"],
  ["研发数据", "使用 TypeScript 与 SQL 交付稳定系统"],
  ["运营销售", "策划增长活动并复盘渠道效果"],
  ["职能", "推动跨部门协作并完善风险机制"],
  ["设计研究", "开展用户研究并维护设计系统"],
] as const;
const levels = ["校招", "初级", "资深", "负责人"] as const;
const scenarios = ["resume-quote", "confirmed-fact", "no-evidence"] as const;

export const READINESS_GOLD_CASES: ReadinessGoldCase[] = families.flatMap(([family, requirement], familyIndex) =>
  levels.flatMap((level, levelIndex) => scenarios.map((scenario, scenarioIndex) => ({
    id: `readiness-${familyIndex + 1}-${levelIndex + 1}-${scenarioIndex + 1}`,
    family, level, scenario, requirement,
    resume: scenario === "resume-quote" ? `候选人在项目中${requirement}。` : scenario === "confirmed-fact" ? `候选人有相关项目，事实已单独确认。` : "候选人暂无相关内容。",
    expectedNeed: scenario === "resume-quote" ? "verify-existing" : scenario === "confirmed-fact" ? "add-detail" : "new-evidence",
  })))
);
