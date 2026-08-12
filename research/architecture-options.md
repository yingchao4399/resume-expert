# 技术架构选型草案

## 结论先行

建议采用“关系型职业资产库 + TypeScript 确定性工作流 + 可替换 AI Skills + 受控检索”的混合架构。

- 不建议现在把所有文本直接丢入向量库。
- 不建议让 Flowise / Dify 直接写业务数据。
- 不建议为每一个产品功能创建独立 Agent。
- 建议先把对象、关系、来源和确认状态做正确，再添加检索增强。

## 1. 为什么需要数据库

当前浏览器 Zustand 适合单机 MVP，但以下需求需要结构化关系：

- 一个能力关联多个项目与多个证据。
- 一个项目生成多个简历 bullet、面试话术和作品集片段。
- 一个岗位要求关联多个能力与证据，并记录缺口。
- 一个数字需要保存计算口径、来源、确认状态和风险。
- 一份公司情报需要记录来源、抓取时间、有效期和冲突信息。

初期仍可使用本机数据库，不需要账号或云同步。推荐顺序：

1. 先定义 TypeScript + Zod 领域模型。
2. 使用 IndexedDB（Dexie）完成本机迁移和验证。
3. 当关系查询、全文检索和附件数量明显增长后，再迁移到本机 SQLite。

SQLite 比“先上 Postgres”更符合当前个人、本地优先边界；云数据库应等到账号和多端同步被验证后再考虑。

## 2. 是否需要 RAG

### 需要 RAG 的地方

- 从大量个人项目 / 经历中找出与某个 JD 最相关的素材。
- 从 ESCO、O*NET 或自建能力词表中归一化技能名称和同义词。
- 检索历史面试记录、作品集片段和已确认数字口径。
- 检索公司公开情报快照，并把结论绑定到来源片段。

### 不需要 RAG 的地方

- ATS 确定性评分。
- 材料必填校验、流程门禁、状态迁移。
- 数字是否有来源、证据是否已确认。
- 简历模板、DOCX/PDF 导出。
- 项目、能力、岗位要求之间的稳定关系查询。

### 推荐实现

第一阶段用“结构化过滤 + 关键词 / BM25”即可；个人素材通常只有几十到几百条。只有当召回不足时再增加 embedding。每条检索结果都必须返回稳定 ID，AI 只能引用 ID，不能把检索文本直接当成已确认事实。

## 3. 是否需要 Skills

Skill 适合“可复用的一套访谈或研究方法”，例如：

- `career-story-interview`：从模糊叙述中追问背景、动作、结果和证据。
- `project-demo-decomposer`：拆解 Demo 的目标、角色、技术、约束、结果与可展示产物。
- `metric-evidence-coach`：帮助用户找到可计算的代理指标和计算口径。
- `jd-requirement-analyst`：逐条要求拆解、潜台词、场景、面试准备。
- `company-research`：按允许的数据源采集公开公司情报并输出引用。
- `interview-answer-coach`：评估用户回答、建议答案、缺失证据和风险。

Skill 不应拥有数据库写权限。它返回候选结构，经过 Zod 校验和用户确认后由 TypeScript 操作写入。

## 4. 是否需要工作流 / Agent

### 固定工作流负责

- 状态机、重试、超时、错误分类。
- 确认门禁和写入权限。
- 事实 / 推断 / 公开信号分层。
- 测评、版本、回滚和可观测性。

### Agent 适合

- 根据回答质量动态决定下一个问题。
- 在多个项目之间选择最值得深挖的对象。
- 根据岗位要求选择访谈分支。
- 在“用户不知道怎么答”时逐层给提示，而不是直接代答。

推荐 Agent 每次只做一个有边界的任务，并使用有限步数、结构化输出和人工确认。不要做一个“全能求职 Agent”同时研究公司、写简历、评分和投递。

## 5. 分类统计与标签库

建议三层标签：

1. 规范标签：由系统维护，ID 稳定，可映射到 ESCO / O*NET。
2. 用户标签：用户自己的叫法、行业黑话、公司内部术语。
3. 岗位标签：从 JD 抽取，带岗位版本和来源。

关系表中记录：

- `evidenceStrength`
- `selfProficiency`
- `verifiedProficiency`
- `lastUsedAt`
- `targetRequirementLevel`
- `sourceIds`

可支持的统计：

- 各能力的项目数量与证据覆盖。
- 各能力最近使用时间。
- 不同岗位族的匹配覆盖率。
- 数字证据、作品集附件和面试故事完整度。
- 用户自评与证据推断的偏差。

统计是解释与导航，不应包装成精确的录用概率。

## 6. 推荐领域对象

```text
CareerAsset
├─ ExperienceAsset
├─ ProjectAsset
├─ AchievementAsset
├─ SkillEvidence
└─ PortfolioArtifact

Capability ← CapabilityEvidence → CareerAsset
JobRequirement ← RequirementEvidenceMatch → CareerAsset
MetricClaim → EvidenceSource
ResumeBullet → CareerAsset / MetricClaim / JobRequirement
InterviewStory → CareerAsset / JobRequirement
CompanyResearchSnapshot → SourceCitation
```

每个 AI 产物都应有：

- `sourceIds`
- `generationMode`
- `promptVersion`
- `confidence`
- `userDecision`
- `createdAt`
- `supersedesId`

## 7. 建议开发顺序

1. 职业资产领域模型和数据迁移。
2. 项目 / 经历梳理工作台。
3. 能力标签、熟练度标尺和证据绑定。
4. JD 逐条要求与资产匹配。
5. 自适应追问与提示阶梯。
6. 数字证据和风险检测。
7. 面试回答训练与作品集沉淀。
8. 公司公开情报；最后再考虑 embedding RAG。

