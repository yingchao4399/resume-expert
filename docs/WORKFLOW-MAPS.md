# 简历专家工作流图谱

本文档按当前 V1.9.7 代码整理，分开描述正式业务流程、AI 执行流程、数据流和开发者工作台。外部工作流平台只应承载可替换的 AI 节点；状态、校验、持久化和门禁仍由 TypeScript 主应用负责。

## 1. 用户使用流程

这是适合向产品经理、用户或面试官展示的主流程图。

```mermaid
flowchart TD
    A[创建或选择岗位版本] --> B[填写岗位信息]
    B --> C[粘贴 JD]
    C --> D[粘贴或导入原始简历]
    D --> E{材料是否完整}
    E -- 否 --> B1[提示缺失字段并聚焦修复] --> B
    E -- 是 --> F[确认材料与来源]
    F --> G[生成 JD 需求地图]
    G --> H{需求地图是否需要人工确认}
    H -- 是 --> H1[确认、修改或拒绝要求] --> H
    H -- 否 --> I[确认需求地图]
    I --> J[按岗位要求匹配已确认事实]
    J --> K[查看岗位准备度与证据缺口]
    K --> L{需要补充事实吗}
    L -- 是 --> M[定向补证 / 项目梳理] --> N[逐条确认候选事实]
    N --> J
    L -- 否 --> O[进入制作]
    O --> P[生成优化方案]
    P --> Q[逐项采用、编辑或拒绝]
    Q --> R[生成最终简历草稿]
    R --> S[人工编辑与模板排版]
    S --> T{最终简历已确认}
    T -- 否 --> S
    T -- 是 --> U[ATS 就绪度检查]
    U --> V[导出 DOCX / 打印 PDF]
    V --> W[关联投递记录与面试准备]
```

关键原则：

- “识别到”不等于“可信”。需求、事实和最终简历都有确认门禁。
- JD、材料、已确认事实或优化风格变化后，依赖结果会过期，不能继续导出旧结果。
- 面试准备和面试复盘是辅助流程，不应阻塞简历交付。

## 2. TypeScript 正式业务工作流

这是当前应用的事实来源。外部平台不能绕过这些节点直接写入简历、证据库或导出结果。

```mermaid
flowchart LR
    subgraph Materials[材料阶段]
        M1[input: 岗位与简历材料]
        M2[evidence: 个人经历事实库]
        M1 --> M3{材料校验}
        M2 --> M3
    end

    subgraph Analysis[分析阶段]
        A1[jd-analysis: JD 结构化解析]
        A2[人工确认需求地图]
        A3[match: 要求-事实匹配]
        A4[diagnosis: 岗位准备度]
        A5[follow-up: 定向补证]
        A6[interview: 按需生成面试策略]
        A1 --> A2 --> A3 --> A4
        A4 --> A5
        A5 --> M2
        A5 --> A3
        A4 -. 可选 .-> A6
    end

    subgraph Creation[制作阶段]
        C1[optimize: 生成优化方案]
        C2[用户逐项采用或编辑]
        C3[final-resume: 最终简历与模板]
        C1 --> C2 --> C3
    end

    subgraph Delivery[交付阶段]
        D1[applications: 投递记录]
        D2[export: ATS / DOCX / PDF]
        D1 --> D2
    end

    M3 --> A1
    A4 --> C1
    C3 --> D1
    C3 --> D2

    G1[(ResumeDocument / Zustand)]
    G2[(Career Domain / IndexedDB)]
    G3[(Studio Trace / IndexedDB)]
    M1 -.保存.-> G1
    A1 -.保存需求地图.-> G1
    A3 -.保存匹配结果.-> G1
    M2 -.读写确认事实.-> G2
    C3 -.保存最终简历.-> G1
    A1 -.记录运行轨迹.-> G3
    A3 -.记录运行轨迹.-> G3
    C1 -.记录运行轨迹.-> G3
```

### 节点职责表

| 节点 | 输入 | 输出 | 是否允许 AI | 写入门禁 |
| --- | --- | --- | --- | --- |
| 材料校验 | 岗位、JD、原始简历、导入资料 | 合法材料版本 | 否 | 必填字段和版本校验 |
| JD 结构化解析 | JD 原文 | 原文跨度、原子要求、推断和风险 | 是 | 引用必须存在于原文 |
| 需求地图确认 | JD 草稿 | confirmed 需求地图 | 否 | 用户确认/修改/拒绝 |
| 要求-事实匹配 | confirmed 需求、确认事实 | 证据强度、缺口、岗位准备度 | 可选 | requirementId、claimId 校验 |
| 定向补证 | 岗位缺口、项目背景 | 候选事实、指标、问题 | 是 | 用户逐条确认 |
| 优化方案 | 当前简历、匹配结果、事实 | 优化项 | 是 | 用户逐项采用 |
| 最终简历 | 原简历、优化项、补证结果 | FinalResume | 是 | confirmed 才能交付 |
| ATS / 导出 | confirmed FinalResume | 评分、DOCX、PDF | 否 | stale 或 draft 禁止导出 |

## 3. AI/API 执行流程

正式 AI 调用都通过统一客户端，DirectLLM 是主路径，Mock 是离线验证路径，Flowise 只在 Studio 实验层使用。

```mermaid
flowchart TD
    U[TypeScript 工作流节点] --> R[创建 runId / traceId]
    R --> P[Prompt Registry 选择 promptId]
    P --> I[组装系统提示词、用户提示词、Schema]
    I --> C{AI 配置}
    C -- Mock --> MK[确定性 Mock]
    C -- DirectLLM --> DL[Provider 适配器]
    C -- Flowise 实验 --> FL[Flowise 本机实验接口]
    DL --> Q[超时、取消、调用次数预算]
    FL --> Q
    MK --> V[Zod 运行时校验]
    Q --> V
    V -->|通过| S[业务层确定性校验]
    V -->|失败一次| F[完整 Schema 修复请求]
    F --> V
    V -->|再次失败| E[明确错误，不写入业务数据]
    S --> G{是否需要用户确认}
    G -- 是 --> H[候选区 / 待复核]
    G -- 否 --> W[仅写入允许的工作流结果]
    H --> X[用户确认]
    X --> W
    P -.快照.-> T[(Studio Trace)]
    DL -.快照.-> T
    FL -.快照.-> T
    V -.错误和耗时.-> T
```

### AI 节点注册建议

| promptId | 所属阶段 | 外部平台节点名称 | 结果是否直接写库 |
| --- | --- | --- | --- |
| `resume.jd-analysis` | JD 解析 | JD 需求地图提取 | 否，先进入草稿 |
| `resume.match` | 事实匹配 | 岗位要求证据匹配 | 否，需 TypeScript 校验 |
| `resume.follow-up` | 补证 | 定向补证问题 | 否 |
| `resume.optimize-items` | 制作 | 简历优化方案 | 否，逐项采用 |
| `resume.finalize` | 制作 | 最终简历生成 | 否，需人工确认 |
| `resume.import-structure` | 材料 | 简历结构化导入 | 否，待确认内容隔离 |
| `career.project-interview` | 经历库 | 项目经历访谈 | 否，逐条确认事实 |
| `interview.prepare` | 面试 | 面试策略生成 | 否 |
| `interview.review` | 复盘 | 面试复盘分析 | 写入复盘记录，不改简历 |

## 4. 数据与证据流

```mermaid
flowchart TD
    T1[原始 JD] --> T2[JDSourceSpan]
    T2 --> T3[JDRequirementAtom]
    T3 --> T4[用户确认需求]
    T4 --> T5[按 requirementId 检索事实]

    R1[原始简历文本] --> R2[ImportedResumeProfile]
    R2 --> R3{用户确认结构化内容}
    R3 --> R4[CareerExperience]
    R3 --> R5[EvidenceClaim]
    R5 --> R6[MetricEvidence]
    R5 --> R7[CapabilityLink]
    R4 --> T5
    R5 --> T5
    R6 --> T5

    T5 --> T6[MatchItem]
    T6 --> T7[岗位准备度]
    T7 --> T8[补证问题]
    T8 --> R5
    T6 --> T9[优化方案]
    T9 --> T10[FinalResume Bullet]
    R5 -. evidenceIds / 来源 .-> T10
    T10 --> T11{人工确认}
    T11 --> T12[ATS / DOCX / PDF]
```

这里最重要的是引用关系：

```text
JDRequirementAtom.id
        ↓
MatchItem.requirementId
        ↓
EvidenceClaim.id / MetricEvidence.id
        ↓
ResumeBullet.evidenceLinks
        ↓
FinalResume → ATS / DOCX / PDF
```

任何一层引用失效，都应该把下游结果标记为待复核或过期，而不是继续当作可信成品。

## 5. 开发者工作台流程

开发者工作台不是第二套业务执行器，而是对 TypeScript 工作流的观察、评测和受约束调整界面。

```mermaid
flowchart LR
    S1[Source Catalog\n.md / Prompt / Schema 源码] --> S2[Prompt Registry]
    S2 --> S3[Workflow Map]
    S2 --> S4[运行快照]
    S5[实际业务运行] --> S4
    S4 --> S6[Trace 面板]
    S6 --> S7[失败类型 / 延迟 / Token / Schema 修复]
    S8[合成测评集] --> S9[Mock 评测]
    S9 --> S10{门槛通过}
    S10 -- 否 --> S11[修改代码 / Prompt 草稿]
    S11 --> S8
    S10 -- 是 --> S12[测试工作流版本]
    S12 --> S13[发布 / 回滚]
    S13 --> S3
    S14[Flowise 实验室] --> S15[候选 ProjectEvidenceDraft]
    S15 --> S16[用户确认]
    S16 --> S17[写入 Career Domain 候选]
```

### 工作台里的四个可视化区域

1. **工作流地图**：看节点、依赖、状态、阻塞原因和当前路径。
2. **运行追踪**：看每次调用的阶段、耗时、模型、输入输出摘要、错误和快照。
3. **提示词与设定**：看 Prompt、Schema、Provider 参数和对应源码文件。
4. **测评与发布**：看 Mock 基线、版本差异、测试结果、发布和回滚状态。

## 6. Flowise / Dify / 扣子平台如何落图

建议在外部平台只画“AI 编排子流程”，不要把整个产品数据库和状态机搬过去。

### 推荐的最小外部子流程

```mermaid
flowchart TD
    E1[接收已确认 JD 与岗位要求] --> E2[提取要求上下文]
    E2 --> E3[接收最多 12 条相关确认事实]
    E3 --> E4[AI 生成匹配解释与补证建议]
    E4 --> E5[输出严格 JSON]
    E5 --> E6[TypeScript Zod 校验]
    E6 -->|失败| E7[一次结构修复]
    E7 --> E6
    E6 -->|通过| E8[返回候选结果]
    E8 --> E9[用户确认]
    E9 --> E10[主应用写入 ResumeDocument / Career Domain]
```

平台节点对应关系：

| 外部节点 | 平台类型 | 说明 |
| --- | --- | --- |
| 输入校验 | 参数/代码节点 | 只接受已确认需求和脱敏后的相关事实 |
| JD 要求整理 | LLM 节点 | 输出候选 JSON，不直接写库 |
| 事实匹配 | LLM 或规则节点 | 每个 requirementId 单独匹配，最多 3 条候选 |
| Schema 校验 | 代码节点 / HTTP 回调 | 最终以 TypeScript Zod 为准 |
| 人工确认 | 人工审核节点 | 只有确认后才能进入业务库 |
| 失败回退 | 条件分支 | 回到 DirectLLM 或 Mock，不伪造事实 |

不要放到外部平台的内容：

- Zustand、IndexedDB、ResumeDocument 迁移。
- 证据删除后的过期传播。
- ATS 评分和导出门禁。
- API Key、完整简历库和任意文件系统访问。
- 任意 SQL、通用浏览器抓取、自动写入 Git 或自动发布。

## 7. 在 diagrams.net / Dify / Flowise 中的画法

### diagrams.net

画四张图：

1. 用户主流程：从材料到交付。
2. 业务状态机：四阶段与门禁。
3. AI/API 数据流：Prompt、Provider、Schema、Trace。
4. 开发者工作台：源码、测评、运行追踪、发布回滚。

颜色建议：

- 蓝色：用户操作。
- 紫色：AI 候选输出。
- 绿色：TypeScript 确定性校验。
- 黄色：人工确认或待复核。
- 红色：失败、过期、取消和阻塞。
- 灰色：存储和日志。

### Dify / Flowise / 扣子

先只建立一个“岗位要求-事实匹配实验流”：

```text
开始
 → 输入 Schema 校验
 → 需求上下文整理
 → 相关事实筛选
 → LLM 匹配
 → JSON Schema 校验
 → 失败时一次修复
 → 返回候选结果
 → 人工确认
 → HTTP 回调主应用
```

这个子流验证稳定后，再拆出“JD 需求地图”“项目经历访谈”“面试策略”三个独立实验流。主应用仍通过 TypeScript 统一调度，外部平台只替换 AI 节点。

## 8. 最终建议

你在工作流平台上首先画“业务总图”，再画“AI 子流程”，不要直接画成一个巨大的 Agent 流程。最适合当前项目的边界是：

```text
TypeScript：状态、版本、校验、事实、确认、持久化、导出门禁
AI 平台：解析、匹配、追问、改写等候选内容生成
用户：确认事实、确认需求、采用改写、确认最终简历
Studio：观察、评测、审计、实验和发布回滚
```
