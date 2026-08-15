import type { JDRequirementAtomDraft } from "../src/types/jd-analysis";

export interface JDGoldCase {
  id: string;
  family: "product" | "engineering-data" | "operations-sales" | "corporate";
  seniority: "campus" | "regular" | "senior" | "lead";
  source: string;
  expected: Pick<JDRequirementAtomDraft, "normalizedText" | "kind" | "modality" | "priority">;
}

const groups: Array<{
  family: JDGoldCase["family"];
  rows: Array<[JDGoldCase["seniority"], string, JDGoldCase["expected"]]>;
}> = [
  { family: "product", rows: [
    ["campus", "具备基础的数据分析能力", { normalizedText: "具备基础的数据分析能力", kind: "skill", modality: "required", priority: "medium" }],
    ["campus", "有校园产品项目经验者优先", { normalizedText: "有校园产品项目经验", kind: "experience", modality: "preferred", priority: "medium" }],
    ["regular", "负责用户研究并输出需求方案", { normalizedText: "负责用户研究并输出需求方案", kind: "task", modality: "required", priority: "high" }],
    ["regular", "必须具备 3 年以上 B 端产品经验", { normalizedText: "具备 3 年以上 B 端产品经验", kind: "experience", modality: "required", priority: "high" }],
    ["regular", "不要求有团队管理经验", { normalizedText: "不要求有团队管理经验", kind: "experience", modality: "negated", priority: "low" }],
    ["senior", "主导复杂产品方案并说明关键取舍", { normalizedText: "主导复杂产品方案并说明关键取舍", kind: "task", modality: "required", priority: "critical" }],
    ["senior", "有 AI 产品落地经验优先", { normalizedText: "有 AI 产品落地经验", kind: "experience", modality: "preferred", priority: "high" }],
    ["senior", "推动跨团队协作并对业务结果负责", { normalizedText: "推动跨团队协作并对业务结果负责", kind: "collaboration", modality: "required", priority: "high" }],
    ["lead", "必须能够制定产品战略与年度路线图", { normalizedText: "制定产品战略与年度路线图", kind: "task", modality: "required", priority: "critical" }],
    ["lead", "负责团队方法沉淀和人才培养", { normalizedText: "负责团队方法沉淀和人才培养", kind: "task", modality: "required", priority: "high" }],
    ["lead", "有海外业务经验为加分项", { normalizedText: "有海外业务经验", kind: "industry", modality: "preferred", priority: "medium" }],
    ["lead", "学历不限", { normalizedText: "学历不限", kind: "education", modality: "negated", priority: "low" }],
  ] },
  { family: "engineering-data", rows: [
    ["campus", "熟悉 TypeScript 基础语法", { normalizedText: "熟悉 TypeScript 基础语法", kind: "skill", modality: "required", priority: "medium" }],
    ["campus", "有开源项目贡献者优先", { normalizedText: "有开源项目贡献", kind: "experience", modality: "preferred", priority: "medium" }],
    ["regular", "负责 React 前端模块开发", { normalizedText: "负责 React 前端模块开发", kind: "task", modality: "required", priority: "high" }],
    ["regular", "必须掌握 SQL 与数据建模", { normalizedText: "掌握 SQL 与数据建模", kind: "skill", modality: "required", priority: "high" }],
    ["regular", "无需具备算法竞赛经历", { normalizedText: "无需具备算法竞赛经历", kind: "experience", modality: "negated", priority: "low" }],
    ["senior", "设计高可用服务并解释架构取舍", { normalizedText: "设计高可用服务并解释架构取舍", kind: "task", modality: "required", priority: "critical" }],
    ["senior", "有大模型应用工程经验优先", { normalizedText: "有大模型应用工程经验", kind: "experience", modality: "preferred", priority: "high" }],
    ["senior", "建立数据质量监控与故障复盘机制", { normalizedText: "建立数据质量监控与故障复盘机制", kind: "deliverable", modality: "required", priority: "high" }],
    ["lead", "必须主导跨系统技术规划", { normalizedText: "主导跨系统技术规划", kind: "task", modality: "required", priority: "critical" }],
    ["lead", "负责技术标准沉淀与工程师培养", { normalizedText: "负责技术标准沉淀与工程师培养", kind: "task", modality: "required", priority: "high" }],
    ["lead", "有多地域部署经验更佳", { normalizedText: "有多地域部署经验", kind: "experience", modality: "preferred", priority: "medium" }],
    ["lead", "不要求特定云厂商认证", { normalizedText: "不要求特定云厂商认证", kind: "credential", modality: "negated", priority: "low" }],
  ] },
  { family: "operations-sales", rows: [
    ["campus", "具备基础内容运营能力", { normalizedText: "具备基础内容运营能力", kind: "skill", modality: "required", priority: "medium" }],
    ["campus", "有社群实践经验优先", { normalizedText: "有社群实践经验", kind: "experience", modality: "preferred", priority: "medium" }],
    ["regular", "负责活动策划与复盘", { normalizedText: "负责活动策划与复盘", kind: "task", modality: "required", priority: "high" }],
    ["regular", "必须具备企业客户销售经验", { normalizedText: "具备企业客户销售经验", kind: "experience", modality: "required", priority: "high" }],
    ["regular", "不限于互联网行业背景", { normalizedText: "不限于互联网行业背景", kind: "industry", modality: "negated", priority: "low" }],
    ["senior", "制定增长策略并验证渠道效率", { normalizedText: "制定增长策略并验证渠道效率", kind: "task", modality: "required", priority: "critical" }],
    ["senior", "有渠道生态建设经验优先", { normalizedText: "有渠道生态建设经验", kind: "experience", modality: "preferred", priority: "high" }],
    ["senior", "协同产品和交付团队推进客户成功", { normalizedText: "协同产品和交付团队推进客户成功", kind: "collaboration", modality: "required", priority: "high" }],
    ["lead", "必须对区域收入目标负责", { normalizedText: "对区域收入目标负责", kind: "deliverable", modality: "required", priority: "critical" }],
    ["lead", "负责销售方法论和组织能力建设", { normalizedText: "负责销售方法论和组织能力建设", kind: "task", modality: "required", priority: "high" }],
    ["lead", "有国际客户拓展经验为加分项", { normalizedText: "有国际客户拓展经验", kind: "experience", modality: "preferred", priority: "medium" }],
    ["lead", "无需自带客户资源", { normalizedText: "无需自带客户资源", kind: "constraint", modality: "negated", priority: "low" }],
  ] },
  { family: "corporate", rows: [
    ["campus", "具备基础财务分析能力", { normalizedText: "具备基础财务分析能力", kind: "skill", modality: "required", priority: "medium" }],
    ["campus", "有人力资源实习经验优先", { normalizedText: "有人力资源实习经验", kind: "experience", modality: "preferred", priority: "medium" }],
    ["regular", "负责预算编制与执行跟踪", { normalizedText: "负责预算编制与执行跟踪", kind: "task", modality: "required", priority: "high" }],
    ["regular", "必须持有人力资源相关证书", { normalizedText: "持有人力资源相关证书", kind: "credential", modality: "required", priority: "high" }],
    ["regular", "不要求法律职业资格", { normalizedText: "不要求法律职业资格", kind: "credential", modality: "negated", priority: "low" }],
    ["senior", "设计组织制度并处理复杂员工关系", { normalizedText: "设计组织制度并处理复杂员工关系", kind: "task", modality: "required", priority: "critical" }],
    ["senior", "有上市公司治理经验优先", { normalizedText: "有上市公司治理经验", kind: "experience", modality: "preferred", priority: "high" }],
    ["senior", "推动业务部门与职能团队达成共识", { normalizedText: "推动业务部门与职能团队达成共识", kind: "collaboration", modality: "required", priority: "high" }],
    ["lead", "必须建立公司级风险管理体系", { normalizedText: "建立公司级风险管理体系", kind: "deliverable", modality: "required", priority: "critical" }],
    ["lead", "负责职能团队建设和专业标准沉淀", { normalizedText: "负责职能团队建设和专业标准沉淀", kind: "task", modality: "required", priority: "high" }],
    ["lead", "有跨境合规经验更佳", { normalizedText: "有跨境合规经验", kind: "experience", modality: "preferred", priority: "medium" }],
    ["lead", "专业背景不限", { normalizedText: "专业背景不限", kind: "education", modality: "negated", priority: "low" }],
  ] },
];

export const JD_GOLD_CASES: JDGoldCase[] = groups.flatMap((group) => group.rows.map(([seniority, source, expected], index) => ({
  id: `${group.family}-${index + 1}`,
  family: group.family,
  seniority,
  source,
  expected,
})));
