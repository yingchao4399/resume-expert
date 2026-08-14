# 两个求职 Agent 仓库原始证据

> 采集日期：2026-08-15
>
> 方法：GitHub 元数据核对、浅克隆、README 与核心源码只读审计。
> 说明：本文件只记录仓库可直接支持的事实，不包含产品建议。

## 1. AgentMesh-JobAgent

- 仓库：[jiyangnan/AgentMesh-JobAgent](https://github.com/jiyangnan/AgentMesh-JobAgent)
- 审计提交：[`a11c2b0`](https://github.com/jiyangnan/AgentMesh-JobAgent/tree/a11c2b0fc5c5587ca3690f3fb42927ee0a4f38f0)，提交时间 2026-08-15。
- GitHub 快照：29 stars、4 forks；仓库有连续版本提交，当前项目版本为 `0.5.23`。
- 许可证：仓库内 [`LICENSE`](https://github.com/jiyangnan/AgentMesh-JobAgent/blob/a11c2b0fc5c5587ca3690f3fb42927ee0a4f38f0/LICENSE) 为 Apache License 2.0。
- 技术形态：Python CLI，依赖 PyMuPDF、python-docx、cryptography 和 websocket-client；通过用户自己的浏览器会话连接招聘平台。
- 平台范围：BOSS 直聘、猎聘、智联招聘、51Job 四条相互隔离的流程；LinkedIn 在能力注册表中明确标为放弃。
- 核心流程：`login -> discover -> review -> delivery preview -> delivery confirmation -> send -> audit`；只有审计完成后才推进到下一平台。
- README 声明：云端负责 36 维候选人画像、搜索计划、岗位决策和个性化沟通；原简历和招聘网站 Cookie 留在本机，但画像和候选岗位字段会发送到 AgentMesh360 云端。
- 云端返回的搜索计划和决策清单使用 Ed25519 签名；客户端校验协议版本、平台、过期时间、请求 ID、候选集合摘要等上下文。
- 发现任务使用稳定 `request_id` / `discover_id`；可重试请求复用原 ID，并明确返回 `retryable`、`request_preserved`、`billing_status` 和 `next_suggested`。
- 每个平台在真实投递前生成完整预览，并通过 `interaction_required` 协议要求用户选择确认、排除或取消。
- 用户确认后生成 fail-closed 的投递授权，绑定账号、轮次、平台、发现任务、预览摘要、候选集合摘要和交互 ID；列表变化或跨平台复用会失败。
- 平台能力注册表分别声明动作、简历来源、个性化消息支持、字符上限、成功证据和不支持的行为。
- 长任务输出阶段事件和心跳；浏览器诊断把 CDP 可达、标签页存在、页面就绪和登录证据分开。
- 测试目录有 39 个文件，源码中约 375 个 `test_*` 测试函数，覆盖确认、轮次、签名、浏览器恢复和各平台解析。

关键源码：

- [交互协议](https://github.com/jiyangnan/AgentMesh-JobAgent/blob/a11c2b0fc5c5587ca3690f3fb42927ee0a4f38f0/src/jobagent/infra/interaction_protocol.py)
- [投递授权](https://github.com/jiyangnan/AgentMesh-JobAgent/blob/a11c2b0fc5c5587ca3690f3fb42927ee0a4f38f0/src/jobagent/infra/delivery_authorization.py)
- [投递预览](https://github.com/jiyangnan/AgentMesh-JobAgent/blob/a11c2b0fc5c5587ca3690f3fb42927ee0a4f38f0/src/jobagent/infra/delivery_preview.py)
- [签名协议](https://github.com/jiyangnan/AgentMesh-JobAgent/blob/a11c2b0fc5c5587ca3690f3fb42927ee0a4f38f0/src/jobagent/infra/protocol.py)
- [轮次工作流](https://github.com/jiyangnan/AgentMesh-JobAgent/blob/a11c2b0fc5c5587ca3690f3fb42927ee0a4f38f0/src/jobagent/infra/rounds.py)
- [平台能力注册表](https://github.com/jiyangnan/AgentMesh-JobAgent/blob/a11c2b0fc5c5587ca3690f3fb42927ee0a4f38f0/src/jobagent/platforms/registry.py)

## 2. ai-job-assistant

- 仓库：[SouthMountain88/ai-job-assistant](https://github.com/SouthMountain88/ai-job-assistant)
- 审计提交：[`f4f202d`](https://github.com/SouthMountain88/ai-job-assistant/tree/f4f202d83a4d51aae02b366bd86d4be8b3a0ec0c)，提交时间 2026-06-07。
- GitHub 快照：18 stars、5 forks；仓库只有一次提交，没有 tag、release 或许可证文件。
- 技术形态：Vue 3 + Element Plus 前端、FastAPI + SQLAlchemy + SQLite 后端、Manifest V3 浏览器扩展示例。
- 业务实体：Resume、AnalysisRecord、JobRecord。JobRecord 包含岗位、公司、薪资、地点、JD、来源、扫描批次、匹配分、HR 活跃度、状态和面试问题等字段。
- 状态流：`captured / analyzed / recommended / communicated / ignored / interview`；看板提供总量、分数分布、岗位漏斗、近期推荐、HR 活跃分布和 PDF 报告。
- 浏览器扩展从 BOSS 直聘页面提取岗位，发送到本机后端；DOM 失败时可截图后调用 EasyOCR，PaddleOCR 是可选后备。
- 扩展清单申请 `activeTab`、`tabs`、`scripting`，并包含 `<all_urls>` 主机权限；后端开发配置允许任意 CORS 来源且允许凭证。
- AI 分析以 DeepSeek 为主；无 Key 时自动进入固定 Mock。模型输出采用手工 JSON 提取和字段修补，解析失败时返回低分兜底结果，而不是拒绝写入。
- 数据库迁移直接在启动时按列执行 SQLite `ALTER TABLE`，没有独立迁移版本或回滚机制。
- 仓库共 51 个文件，只有 1 个测试文件；该文件以打印和手工聚合错误为主，不是完整的自动化单元/端到端测试体系。

关键源码：

- [后端入口和 CORS](https://github.com/SouthMountain88/ai-job-assistant/blob/f4f202d83a4d51aae02b366bd86d4be8b3a0ec0c/backend/app/main.py)
- [数据模型](https://github.com/SouthMountain88/ai-job-assistant/blob/f4f202d83a4d51aae02b366bd86d4be8b3a0ec0c/backend/app/models.py)
- [分析与评分](https://github.com/SouthMountain88/ai-job-assistant/blob/f4f202d83a4d51aae02b366bd86d4be8b3a0ec0c/backend/app/services/analysis_service.py)
- [浏览器插件服务](https://github.com/SouthMountain88/ai-job-assistant/blob/f4f202d83a4d51aae02b366bd86d4be8b3a0ec0c/backend/app/services/plugin_service.py)
- [OCR 服务](https://github.com/SouthMountain88/ai-job-assistant/blob/f4f202d83a4d51aae02b366bd86d4be8b3a0ec0c/backend/app/services/ocr_service.py)
- [统计接口](https://github.com/SouthMountain88/ai-job-assistant/blob/f4f202d83a4d51aae02b366bd86d4be8b3a0ec0c/backend/app/routers/statistics.py)
- [扩展权限](https://github.com/SouthMountain88/ai-job-assistant/blob/f4f202d83a4d51aae02b366bd86d4be8b3a0ec0c/extension-demo/manifest.json)

## 3. 当前 Resume Expert 基线

- 审计提交：`966f5fa`，版本 `v1.9.4`。
- 当前强项：原子经历事实、量化证据、能力标签、人工确认、事实与 Bullet 引用、深度 JD 需求地图、多岗位简历版本、模板与 DOCX/PDF、结构化 AI 校验、测评集、Trace 和提示词透明工作台。
- 当前投递模块只支持手工新增，字段为公司、岗位、JD 链接/文本、状态、投递时间、下一步、备注和简历版本。
- 当前统计只有状态数量、面试率和 Offer 率；没有岗位采集队列、来源快照、阶段事件、失败原因、阶段耗时或平台连接器。
- 当前明确不包含职位抓取、自动投递、OCR、账号和云同步。

当前项目依据：[`README.md`](../../../README.md)、[`JobApplication`](../../../src/types/resume.ts)、[`ApplicationsStep`](../../../src/components/steps/applications-step.tsx)。
