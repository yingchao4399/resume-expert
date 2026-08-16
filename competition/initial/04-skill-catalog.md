# 04 · Skill 清单（Skill Catalog）

> 依据赛道手册附录 B 与「统一表格」要求披露：名称、用途、输入、输出、调用条件、依赖、失败处理、权限安全、复用价值、关联 Agent。Skill 是能力抽象层（不是一次性脚本），工具连接由 05 中的连接器契约承担。

## 总览

| Skill | 用途 | 关联 Agent |
| --- | --- | --- |
| `material-validation` | 岗位/JD/简历材料校验 | 主控 |
| `jd-decision-map` | JD 拆解为带锚点需求地图 | JobRequirementAnalyst |
| `fact-retrieval` | 从事实库检索可追溯事实 | EvidenceCurator |
| `evidence-curation` | 定向补证与候选事实确认 | EvidenceCurator |
| `trusted-rewrite` | 基于已确认事实的可信改写 | ResumeStrategist |
| `delivery-gate` | Schema/引用/过期/ATS/导出门禁 | QualityDeliveryGuardian |
| `trace-observability` | 全链路 Trace/Prompt/评测可回放 | 全部 |
| `mock-evaluation` | 合成评测与回放 | 全部（评测） |

---

## 1. `material-validation`（材料校验）

| 字段 | 内容 |
| --- | --- |
| Skill 类型 | 自定义 Skill |
| 使用场景 | 创建/切换岗位版本时，校验岗位信息、JD 与原始简历是否齐全 |
| 输入参数 | 岗位信息、JD 原文、原始简历（文本或导入）、资料 |
| 输出结果 | 合法材料版本 / 缺失字段清单（聚焦定位） |
| 调用条件 | 进入分析阶段前强制调用 |
| 依赖工具/系统 | 简历导入（PDF/DOCX 解析） |
| 失败处理 | 缺失字段明确提示并聚焦修复，不进入下游 |
| 权限与安全 | 本地浏览器存储，材料不离开本机 |
| 复用价值 | 任何「先校验再分析」的材料型任务可复用 |
| 关联 Agent | 主控（前置门禁） |

## 2. `jd-decision-map`（JD 决策地图）

| 字段 | 内容 |
| --- | --- |
| Skill 类型 | 自定义 Skill（LLM 结构化解析） |
| 使用场景 | 将 JD 原文结构化，支撑匹配与准备度计算 |
| 输入参数 | JD 原文 |
| 输出结果 | 需求地图：`requirementId` + 原文 span + 原子要求 + 必须/优先/否定 + 优先级依据 + 假设 + 风险 |
| 调用条件 | 材料校验通过后调用 |
| 依赖工具/系统 | DirectLLM（OpenAI 兼容 + 严格 JSON Schema），可降级 Mock |
| 失败处理 | Zod 校验失败先做一次完整 Schema 修复请求，再失败则明确报错且不写库 |
| 权限与安全 | 引用必须存在于原文，禁止越权补写 |
| 复用价值 | 可复用于任意「文档→结构化决策地图」场景 |
| 关联 Agent | JobRequirementAnalyst |

## 3. `fact-retrieval`（事实检索与追溯）

| 字段 | 内容 |
| --- | --- |
| Skill 类型 | 自定义 Skill（确定性筛选，非向量 RAG） |
| 使用场景 | 从项目化经历事实库按岗位要求检索匹配事实 |
| 输入参数 | 已确认需求地图、事实库（工作/项目/实习/原子事实/量化证据/能力标签） |
| 输出结果 | 匹配事实 + 证据强度 + 缺口清单 |
| 调用条件 | 需求地图确认后调用 |
| 依赖工具/系统 | Career Domain / IndexedDB（结构化事实、稳定 ID） |
| 失败处理 | 缺事实时输出缺口并触发补证，不臆造 |
| 权限与安全 | 本地事实库，事实带原文引用与确认状态 |
| 复用价值 | 稳定的「结构化事实 + 确定性筛选」可替代 RAG，迁移到向量检索仅需换检索实现 |
| 关联 Agent | EvidenceCurator |

## 4. `evidence-curation`（定向补证与事实确认）

| 字段 | 内容 |
| --- | --- |
| Skill 类型 | 自定义 Skill |
| 使用场景 | 针对岗位缺口定向补证、项目梳理（1–5 轮动态追问） |
| 输入参数 | 缺口、项目背景、已有事实 |
| 输出结果 | 候选事实（保留原文引用）、量化证据、补证问题 |
| 调用条件 | 存在事实缺口时调用 |
| 依赖工具/系统 | DirectLLM/Mock |
| 失败处理 | 候选事实必须逐条人工确认；未确认不写入事实库 |
| 权限与安全 | 候选/待复核/已确认三级状态，改写保留来源关联 |
| 复用价值 | 「AI 生成候选 + 人工确认」模式可复用于任何高可信度采集 |
| 关联 Agent | EvidenceCurator |

## 5. `trusted-rewrite`（可信改写与简历优化）

| 字段 | 内容 |
| --- | --- |
| Skill 类型 | 自定义 Skill（LLM 生成） |
| 使用场景 | 生成岗位定制优化方案与最终简历草稿 |
| 输入参数 | 已确认事实、匹配结果、当前简历、优化风格 |
| 输出结果 | 优化项（逐项候选）+ FinalResume 草稿（带引用） |
| 调用条件 | 事实与匹配就绪、用户点击「生成优化方案」后调用 |
| 依赖工具/系统 | DirectLLM（流式）/Mock |
| 失败处理 | 结构校验失败重试一次，再失败明确报错不写库 |
| 权限与安全 | 仅用已确认事实；逐项采用由人工决定 |
| 复用价值 | 「受约束改写」可复用于文案/文档类生成 |
| 关联 Agent | ResumeStrategist |

## 6. `delivery-gate`（交付与导出门禁）

| 字段 | 内容 |
| --- | --- |
| Skill 类型 | 自定义 Skill（确定性校验） |
| 使用场景 | ATS 就绪度估算、DOCX/PDF 导出与审计 |
| 输入参数 | 已确认 FinalResume、导出配置 |
| 输出结果 | 门禁结果、ATS 评分（关键词/证据/量化/完整度）、DOCX/PDF、审计 |
| 调用条件 | 交付阶段，仅「已确认」且「非过期」触发 |
| 依赖工具/系统 | docx 生成、浏览器打印 |
| 失败处理 | stale/draft 禁止导出并说明原因 |
| 权限与安全 | 只读校验 + 受控导出；不写入业务数据 |
| 复用价值 | 「交付前门禁」可复用于任何生成类系统 |
| 关联 Agent | QualityDeliveryGuardian |

## 7. `trace-observability`（Trace 可观测）

| 字段 | 内容 |
| --- | --- |
| Skill 类型 | 自定义 Skill（基础设施） |
| 使用场景 | 记录 Prompt、模型输出、错误、耗时、引用关系 |
| 输入参数 | promptId、runId、模型快照、校验结果 |
| 输出结果 | 可回放 Trace（Studio Trace / IndexedDB） |
| 调用条件 | 每次 LLM 调用与门禁判定自动记录 |
| 依赖工具/系统 | Studio Trace 存储 |
| 失败处理 | 记录失败与耗时，供评测回放 |
| 权限与安全 | Trace 脱敏，不落 API Key；演示用合成数据 |
| 复用价值 | 可观测层可复用于任何 Agent 系统 |
| 关联 Agent | 全部 |

## 8. `mock-evaluation`（合成评测与回放）

| 字段 | 内容 |
| --- | --- |
| Skill 类型 | 自定义 Skill（评测） |
| 使用场景 | 用冻结合成用例验证 Schema 有效性、事实保持、召回、F1 等指标 |
| 输入参数 | 冻结评测用例集（synthetic cases） |
| 输出结果 | 指标 JSON（schemaValidityRate、immutableFactRetentionRate、jdRequirementRecall、evidenceStrengthMacroF1 等） |
| 调用条件 | `npm run eval:mock / eval:career / eval:jd` |
| 依赖工具/系统 | evals/runner.mjs、career-eval.mjs、jd-eval.test.ts |
| 失败处理 | 指标回落触发修复，不静默通过 |
| 权限与安全 | 合成数据，不含真实简历/密钥 |
| 复用价值 | 评测集可开放复用为回归与回放基准 |
| 关联 Agent | 全部（评测闭环） |
