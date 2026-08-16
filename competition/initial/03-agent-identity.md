# 03 · Agent 身份清单（Agent Identity）

> 依据赛道手册附录 A 的 Agent Identity 字段填写。多 Agent 协同以 **AgentTeams** 为设计基点：主控（Orchestrator）按阶段路由，四个职能 Agent 通过共享岗位文档与事实引用协作，以 `requirementId / claimId / traceId` 传递上下文。

## 主控（AgentTeams Orchestrator）

| 字段 | 内容 |
| --- | --- |
| Name | `JobDecisionOrchestrator`（主控，非参赛 Agent，是 AgentTeams 协同基点的落地映射） |
| Role | 任务拆解、阶段路由、上下文编排、状态追踪、升级决策 |
| 与 AgentTeams 映射 | `任务拆解 → 按阶段创建子任务`；`上下文传递 → 共享 JobDocument/FactStore`；`协同执行 → 依赖图调度`；`状态追踪 → workflow state + traceId 关联` |
| Decision Boundary | 仅做路由与编排，不直接写简历/事实/导出结果；高风险写入与最终导出必须上抛人工确认 |

---

## 1. JobRequirementAnalyst（岗位需求分析）

| 字段 | 内容 |
| --- | --- |
| Name | `JobRequirementAnalyst` |
| Role | 将 JD 原文拆解为带原文锚点、优先级与风险提示的岗位需求地图 |
| Capabilities | 能做：结构化解析 JD，产出原子要求（必须/优先/否定条件）、优先级依据、岗位假设、质量风险；引用必须锚定原文。不能做：不自行补充岗位外要求，不判定事实真伪 |
| Inputs | JD 原文、岗位信息（职位/级别/地点） |
| Outputs | `RequirementMap`：`requirementId` + 原文跨度（span）+ 原子要求 + 优先级 + 风险 + 假设，状态为「草稿待确认」 |
| Dependencies | Skill：`jd-decision-map`；工具：DirectLLM（可降级 Mock） |
| Decision Boundary | 产出为候选，必须经人工确认/修改/拒绝后才进入匹配；禁止越过确认直接写入 |
| Trace | 每次解析记录 promptId、runId、模型与原始输出快照至 Studio Trace |

## 2. EvidenceCurator（经历事实策展）

| 字段 | 内容 |
| --- | --- |
| Name | `EvidenceCurator` |
| Role | 从项目化经历库检索、筛选、追溯并维护候选事实 |
| Capabilities | 能做：检索经历事实、生成定向补证问题、生成候选事实并保留原文引用。不能做：不替用户虚构成果，不把候选事实当作已确认事实 |
| Inputs | 已确认需求地图、经历事实库（Career Domain）、岗位缺口 |
| Outputs | 候选 `EvidenceClaim`（`claimId` + 原文引用 + 证据强度）+ 补证问题，状态为「候选/待复核」 |
| Dependencies | Skill：`fact-retrieval`、`evidence-curation`；存储：Career Domain / IndexedDB |
| Decision Boundary | 事实必须逐条人工确认后成为「已确认」；证据变化触发相关匹配与简历过期 |
| Trace | 候选来源、确认动作与引用关系写入 Trace 与事实库 |

## 3. ResumeStrategist（简历策略）

| 字段 | 内容 |
| --- | --- |
| Name | `ResumeStrategist` |
| Role | 仅基于已确认事实生成岗位定制优化方案与简历草稿 |
| Capabilities | 能做：基于已确认事实与匹配结果产出优化项与草稿。不能做：不引入未经确认的成果/数字，不绕过过期门禁 |
| Inputs | 已确认事实、匹配结果、当前简历、优化风格 |
| Outputs | 优化方案（逐项候选）+ `FinalResume` 草稿，含来源引用 |
| Dependencies | Skill：`trusted-rewrite`；工具：DirectLLM/Mock |
| Decision Boundary | 逐项采用/编辑/拒绝由人工确认；草稿须确认为「已确认」才能进入交付 |
| Trace | prompt 快照、引用关系与运行轨迹写入 Studio Trace |

## 4. QualityDeliveryGuardian（质量交付守护）

| 字段 | 内容 |
| --- | --- |
| Name | `QualityDeliveryGuardian` |
| Role | 执行 Schema、引用、过期状态、ATS 与导出门禁 |
| Capabilities | 能做：确定性校验（Schema/引用/过期）、ATS 就绪度、导出与审计。不能做：不做主观内容判断，不越权放行 stale/draft |
| Inputs | 已确认 FinalResume、依赖版本、导出配置 |
| Outputs | 门禁结果（通过/阻塞+原因）、ATS 评分、DOCX/PDF、审计记录 |
| Dependencies | Skill：`delivery-gate`；Zod 运行时校验 |
| Decision Boundary | 仅「已确认」且「非过期」可导出；阻塞原因可回放 |
| Trace | 门禁判定、导出门禁与审计写入 Trace |

---

## 协作闭环映射（对应手册 8.3）

| 闭环环节 | 本项目落地 |
| --- | --- |
| 任务输入 | JD 原文 + 原始简历 + 经历事实 |
| 任务拆解 | 主控按「分析/补证/制作/交付」阶段拆解 |
| 上下文传递 | requirementId / claimId / traceId + 共享岗位文档与事实引用 |
| 工具调用 | Skill（能力抽象）+ 连接器契约（工具连接，见 05） |
| 结果验证 | Zod Schema + 业务层确定性校验 + 人工确认 |
| 执行证据沉淀 | Studio Trace + 事实库引用 + 评测结果 |
| 审批与回滚 | 高风险写入/证据确认/最终导出人工确认；过期传播锁定 |
| 经验沉淀 | 需求地图、事实库、优化项均可复用为后续岗位输入 |
