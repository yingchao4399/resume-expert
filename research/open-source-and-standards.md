# 开源案例、职业标准与编排框架研究

> 访问日期：2026-08-13。版本信息按当日公开仓库/发布页记录，未来可能变化。

## 1. 对照矩阵

| 对象 | 当日公开状态 | 可复用设计模式 | 主要风险/边界 |
|---|---|---|---|
| Reactive Resume | v5.1.7，MIT | 版本化 JSON Schema、最小变更、锁、结构化导入导出 | 它的分数不能当真实 ATS；MCP 能力不等于本项目需要立即接入 MCP |
| OpenResume | 无正式 release；主分支最后公开提交停在 2024-10-29，AGPL-3.0 | 浏览器本地解析、解析器/渲染器边界 | AGPL 代码不可无审查复制进现项目；维护活跃度有限 |
| Resume Matcher | v1.2.0，Apache-2.0 | Master resume → tailored resume、差异展示、按区块重生成、反幻觉约束 | 关键词/相似度仍不能替代证据真实性 |
| ESCO | v1.2.1；欧盟职业与技能分类 | 稳定 URI、层级、别名、职业与技能关系、essential/optional | 中文覆盖不足；需保存版本和本地映射，不能把词表当个人能力证明 |
| O*NET | 数据库 30.3；季度更新 | 把“岗位重要性”和“能力水平”分开；行为锚定量表 | 美国职业语境，需做中国岗位适配；岗位要求不等于个人熟练度 |
| Flowise | v3.1.4 | 可视化 Agentflow、HITL、工具/RAG/MCP、Trace | 适合实验层；不接管业务真相、写入门禁和数据迁移 |
| Dify | v1.16.1 | 工作流、Prompt IDE、RAG、Agent、日志与 API | 对本机个人版偏重；引入会造成第二套状态/权限/发布系统 |
| LangGraph | v1.2.9 | durable execution、checkpoint、HITL、可测试图执行 | 只有真正需要跨会话动态 Agent 时才值得；恢复必须绑定工作流版本 |

## 2. 简历与匹配项目

### Reactive Resume

值得借鉴的是“结构化简历是事实源，渲染和导出是派生物”，以及版本 Schema、JSON Patch 和编辑锁的思路。其 MCP 文档说明了外部客户端可访问简历数据的方式，但这只是互操作手段，不应反推本项目现在必须加入运行时 MCP。

来源：[GitHub](https://github.com/AmruthPillai/Reactive-Resume)、[v5.1.7](https://github.com/AmruthPillai/Reactive-Resume/releases/tag/v5.1.7)、[JSON Resume Schema](https://docs.rxresu.me/guides/json-resume-schema)、[MCP Server](https://docs.rxresu.me/guides/using-the-mcp-server)、[导出](https://docs.rxresu.me/guides/exporting-your-resume)

### OpenResume

值得借鉴其“浏览器本地 PDF 解析 → 结构化状态 → PDF 渲染”的职责边界。由于许可证为 AGPL-3.0，本项目更适合学习架构而不是直接拷贝代码。

来源：[GitHub](https://github.com/xitanggg/open-resume)、[提交历史](https://github.com/xitanggg/open-resume/commits/main/)

### Resume Matcher

最有用的是 master resume、岗位定向版本、差异/改进说明和分区再生成。简历专家应进一步要求每个生成 bullet 引用 `EvidenceClaim`，使“反幻觉”从 Prompt 约束升级为数据约束。

来源：[GitHub](https://github.com/srbhr/Resume-Matcher)、[v1.2.0](https://github.com/srbhr/Resume-Matcher/releases/tag/v1.2.0)、[Releases](https://github.com/srbhr/Resume-Matcher/releases)、[Setup](https://github.com/srbhr/Resume-Matcher/blob/main/SETUP.md)

## 3. 能力标签与熟练度标准

### ESCO：适合做规范标签骨架

ESCO 提供职业与技能两大支柱、稳定标识、标签/别名以及职业—技能关系。建议把它作为可选规范词表来源，而不是硬编码为唯一分类：

- `Capability.externalRefs[]` 保存 ESCO URI 与版本；
- 中文展示名、用户自定义标签、JD 原词与规范标签并存；
- 允许别名合并/拆分和人工覆盖；
- 外部词表升级产生映射报告，不静默改用户资产。

来源：[版本](https://esco.ec.europa.eu/en/about-esco/escopedia/escopedia/esco-versions)、[版权](https://esco.ec.europa.eu/en/copyright-notice-esco-skills-competences)、[双支柱结构](https://esco.ec.europa.eu/en/about-esco/escopedia/escopedia/two-pillar-structure-esco)、[Skills 分类](https://esco.ec.europa.eu/en/classification/skill)、[API](https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api)

### O*NET：适合学习量表，不适合直接给用户认证

O*NET 的关键启示是把岗位侧的 importance、level 和个人侧的 proficiency 分开。简历专家应并列显示：

- 岗位要求重要性；
- 用户自评熟练度；
- 证据校验熟练度；
- 证据数量、质量和最近使用时间。

来源：[数据库](https://www.onetcenter.org/database.html)、[内容模型](https://www.onetcenter.org/content.html)、[量表说明](https://www.onetonline.org/help/online/scales)、[Web Services](https://services.onetcenter.org/reference/start/overview)

## 4. Flowise、Dify 与 LangGraph 怎么选

### 保留 Flowise 作为实验层

项目已有本机 Flowise 集成，继续用于动态访谈、分支 Prompt、同案例对比和新 Skill 原型是合理的。它的输出只能是候选草稿，必须经过 TypeScript Schema、评测和用户确认后写入。

来源：[GitHub](https://github.com/FlowiseAI/Flowise)、[v3.1.4](https://github.com/FlowiseAI/Flowise/releases/tag/flowise%403.1.4)、[Document Stores](https://docs.flowiseai.com/using-flowise/document-stores)、[Analytics](https://docs.flowiseai.com/using-flowise/analytics)、[Tools and MCP](https://docs.flowiseai.com/tutorials/tools-and-mcp)

### 暂不引入 Dify

Dify 的工作流、RAG、Agent、Prompt 和日志能力全面，但会和现有 Studio、TypeScript 工作流、Flowise 实验层重叠。现阶段增加它的迁移、权限和部署成本高于收益。

来源：[GitHub](https://github.com/langgenius/dify)、[v1.16.1](https://github.com/langgenius/dify/releases/tag/1.16.1)

### LangGraph 只在“动态 Agent 跨会话恢复”成立时引入

如果未来项目访谈需要长时间暂停、人工确认后恢复、动态路由和多 Agent 协作，LangGraph 的 durable execution/HITL 有价值。现有固定求职流程仍应保留 TypeScript 状态机；不要为了画图而重写执行器。

来源：[GitHub](https://github.com/langchain-ai/langgraph)、[Releases](https://github.com/langchain-ai/langgraph/releases)、[Overview](https://docs.langchain.com/oss/javascript/langgraph/overview)、[Backward Compatibility](https://docs.langchain.com/oss/javascript/langgraph/backward-compatibility)、[测试](https://docs.langchain.com/oss/javascript/langgraph/test)

## 5. 测评系统的可复用模式

当前 `evals/` 方向正确。下一阶段不是另起一个重平台，而是在 Studio 测评中心补充：

- 冻结合成案例与事实账本；
- 同案例 DirectLLM/Flowise/Mock 对比；
- 原子事实保留率、无依据事实率、引用完整率；
- JD Requirement 逐条召回和证据排序指标；
- 自适应提问的信息增益、停止正确性；
- 人工 rubric 与模型裁判分开保存；
- Prompt、模型、Provider、工作流版本与运行结果绑定。

可参考 LangSmith 的[评测概览](https://docs.langchain.com/langsmith/evaluation)与[评测方法](https://docs.langchain.com/langsmith/evaluation-approaches)，但无需为了这些能力把用户业务数据迁入云平台。

## 6. 最终选型结论

- **现在采用**：TypeScript + Zod 领域模型、IndexedDB/Dexie、现有固定工作流、Studio 测评、Flowise 实验层。
- **借鉴但不直接依赖**：Reactive Resume 的版本结构、Resume Matcher 的定向版本/差异、ESCO/O*NET 的词表与量表原则。
- **暂缓**：Dify、LangGraph、向量数据库、运行时 MCP。
- **触发后再做**：长文档召回不足时加混合 RAG；动态跨会话 Agent 成为真实需求时加 LangGraph；外部多数据源互操作成立时做窄范围 MCP。
