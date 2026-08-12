# 本轮调研完成度核对

> 核对日期：2026-08-13。该表用于证明用户提出的方向均已进入结论、设计规范或路线图，而不是用“报告篇幅”替代交付完成度。

| 用户关切 | 研究结论/交付位置 | 下一落地点 |
|---|---|---|
| 梳理工作、项目、Demo；支持增删改排 | [领域模型](./domain-model-spec.md)、[信息架构](./information-architecture.md) | V1.8.0 `CareerProject/CareerExperience` CRUD、排序、归档、版本 |
| 项目补证、能力校验、熟练度 | [评分与证据规范](./scoring-and-evidence-spec.md) | 原子事实、数字口径、0–4 自评/证据双等级 |
| Skills、工作流、Agent、Flowise | [架构选型](./architecture-options.md)、[主报告](./resume-expert-strategy-report.md) | Skill 产候选；TypeScript 掌门禁；Agent 选下一问；Flowise 只实验 |
| RAG、数据库、标签库 | [架构选型](./architecture-options.md)、[开源与标准](./open-source-and-standards.md) | IndexedDB/Dexie 优先；ESCO/O*NET 可选映射；RAG 后置 |
| 自适应提问、不会回答时辅助 | [评分规范](./scoring-and-evidence-spec.md)、[信息架构](./information-architecture.md) | 依据信息增益停止；回忆线索→框架→标注示例→稍后任务 |
| JD 深度分析、项目智能匹配、追问 | [领域模型](./domain-model-spec.md)、[路线图](./roadmap.md) | V1.8.2 Requirement 原文锚点、证据标准和可解释排序 |
| 简历/面试/作品集话术统一 | [主报告](./resume-expert-strategy-report.md)、[领域模型](./domain-model-spec.md) | `NarrativeAsset` 统一引用 claim IDs |
| 个人素材与作品集 | [信息架构](./information-architecture.md)、[路线图](./roadmap.md) | 附件 Blob 分离、素材引用、作品集章节 |
| 目标公司类型、团队信息、背调 | [公司研究规范](./company-research-spec.md)、[商业产品研究](./external-product-analysis.md) | 自定义公司画像；事实/信号/推断/主观样本分层；禁止私人画像 |
| JD 潜台词、工作重心、汇报关系、反问 | [需求可落地表](./requirements-traceability.md)、[主报告](./resume-expert-strategy-report.md) | 全部标为带依据和置信度的推断，不伪装明文事实 |
| AI 评分透明、ATS 可信度 | [当前代码审计](./current-product-audit.md)、[评分规范](./scoring-and-evidence-spec.md) | V1.7.3 先修虚分；固定 rubric 与本地确定性计算 |
| 面试抽题、回答、对照、复盘回写 | [信息架构](./information-architecture.md)、[路线图](./roadmap.md) | V1.9.0 题库→答题→评分→修订→候选事实确认 |
| AI 风格与逐项采用 | [需求可落地表](./requirements-traceability.md)、[主报告](./resume-expert-strategy-report.md) | 可组合参数、AI 推荐理由、逐项采用/拒绝/编辑 |
| 多教育经历、课程/GPA/荣誉/继续教育 | [需求可落地表](./requirements-traceability.md)、[路线图](./roadmap.md) | 教育数组和条件显隐；未来规划不默认进简历 |
| 投递漏斗、耗时、失败原因和岗位聚类 | [信息架构](./information-architecture.md)、[路线图](./roadmap.md) | V1.9.1 只做相关性分析，不承诺因果 |
| 商业竞品、GitHub 案例、全球产品 | [商业产品研究](./external-product-analysis.md)、[开源与标准](./open-source-and-standards.md)、[来源目录](./source-catalog.md) | 已形成模式、风险和差异化结论 |
| 当前版本真实 Bug 与不能使用处 | [当前产品与代码审计](./current-product-audit.md) | V1.7.3 P1 回归测试清零 |
| 当前流程 UI/UX 与可访问性 | [运行截图审计](./runtime-ux-audit.md) | 6 步截图证据和优先整改项 |
| 是否需要 MCP | [MCP 技术决策](./mcp-decision.md) | 不进核心；V1.8.3 默认关闭的只读公司研究试点 |

## 最终完成标准

- 研究对象、深度和重点已由用户确认；
- 本地代码、数据模型、运行流程和 6 个关键页面均已审计；
- 商业产品、开源项目、职业标准、编排框架和 MCP 均有公开来源；
- 事实、产品推断与本项目建议已分开表达；
- 形成了产品定位、领域模型、信息架构、评分规范、公司研究规范、技术选型、路线图和验收矩阵；
- 未写入真实简历、API Key、Trace 或第三方凭证；
- `prd/` 未被修改或纳入提交范围。
