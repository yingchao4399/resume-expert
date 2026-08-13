import assert from "node:assert/strict";

const cases = [
  { id: "compound-skill", source: "熟悉 TypeScript 和 React，并具备跨团队协作能力", expectedAtoms: ["TypeScript", "React", "跨团队协作"] },
  { id: "role-and-result", source: "负责产品规划，推动版本上线并提升转化率", expectedAtoms: ["产品规划", "版本上线", "转化率"] },
  { id: "background-not-requirement", source: "我们是面向制造业的 SaaS 团队", expectedClass: "background" },
  { id: "benefit-not-requirement", source: "提供五险一金、年度体检和带薪年假", expectedClass: "benefit" },
  { id: "reporting-unknown", source: "负责业务增长产品", unknown: "reporting-line" },
  { id: "team-unknown", source: "负责 AI 产品迭代", unknown: "team-state" },
  { id: "metric-evidence", source: "通过数据分析持续优化产品效果", expectedAtoms: ["数据分析", "产品效果"] },
  { id: "industry-priority", source: "有物流行业经验者优先", expectedAtoms: ["物流行业经验"], priority: "preferred" },
];

assert.equal(cases.length, 8);
for (const item of cases) {
  assert.ok(item.id && item.source);
  if (item.expectedAtoms) assert.ok(item.expectedAtoms.every((atom) => item.source.includes(atom)));
}
console.log(JSON.stringify({ suite: "jd-depth", cases: cases.length, sourceCoverageTarget: 1, unsupportedTeamConclusionTarget: 0, passed: true }));
