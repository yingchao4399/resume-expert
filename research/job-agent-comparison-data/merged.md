# 求职 AI 产品与 Agent 项目对比及 Resume Expert 借鉴报告

> 对比对象：[`AgentMesh-JobAgent`](https://github.com/jiyangnan/AgentMesh-JobAgent)、[`ai-job-assistant`](https://github.com/SouthMountain88/ai-job-assistant)、[小坏简历](https://ai.e404e.cn/)与当前 Resume Expert `v1.9.4`
>
> 研究日期：2026-08-15
> 结论口径：仓库事实与本项目判断分开；外部代码固定到审计提交，不把 README 宣称等同于服务端能力证明。

## 1. 执行结论

三个外部对象都值得学，但价值所在不同。

- **AgentMesh-JobAgent 更值得学习工程边界**：它把不稳定、不可逆的投递动作做成了有状态、可恢复、可确认、可审计的协议，并让每个平台适配器互不污染。
- **ai-job-assistant 更值得学习产品入口**：浏览器采集岗位、岗位记录列表、漏斗看板、按岗位生成面试题，能把“看到职位”到“后续跟进”连接起来。
- **小坏简历更值得学习任务分流和产物化工作流**：已有简历进入 Studio，经历不足进入“包装老师”；履历定制经过素材、大纲、成稿、审批、版式和面试六类产物，而不是只展示模型对话。
- **Resume Expert 不应该变成这些对象的复制品**。当前项目已经有更扎实的事实库、JD 原子要求、证据引用、版本过期传播和结构化 AI 校验。更合理的演进是先把现有能力组织成清晰任务入口，再补岗位机会、可解释决策和受约束交付协议。

加入小坏简历后，优先级需要略作调整：先把已有能力整理成**双入口 + 大纲确认 + 成稿交接 + 面试负债**的清晰体验，再建设岗位机会和交付连接器。

建议形成新的闭环：

`个人可信事实 → 岗位机会 → JD 要求地图 → 事实匹配 → 岗位版简历 → 交付预览/授权 → 投递事件 → 面试复盘 → 事实库更新`

## 2. 四个产品/项目的真实位置

| 维度 | AgentMesh-JobAgent | ai-job-assistant | 小坏简历 | Resume Expert v1.9.4 |
|---|---|---|---|---|
| 核心定位 | Agent 可调用的岗位发现与投递 CLI | 岗位采集、匹配和看板 Web 原型 | 商业化双线 AI 简历平台 | 证据驱动的简历与求职工作台 |
| 职业事实底座 | 云端候选人画像，开源端字段较轻 | 简历文本和分析 JSON | 档案、问答、大纲、项目和敏感主张 | 原子事实、指标、能力、来源和确认状态 |
| JD 分析 | 云端签名决策，开源端验证 | 单次 Prompt + 固定评分封顶 | JD 对齐、Job-Ready 和多 JD 分支 | 原子要求、原文锚点、事实外键和推断边界 |
| 岗位采集 | 四个平台浏览器自动化 | BOSS 浏览器扩展示例 | 前端存在岗位队列、截图 OCR 与连投入口 | 仅手工录入投递 |
| 人工确认 | 投递预览与授权很强 | 状态按钮为主 | 大纲确认、敏感主张 HITL、导出门禁 | 事实、简历、导出门禁很强；外部动作尚无协议 |
| 幂等/恢复 | 请求、发现、确认和轮次均有稳定 ID | 扫描批次和岗位去重键 | 登录会话可恢复，支付订单可续查 | AI 原子写入较强；暂无投递任务账本 |
| 工作流呈现 | 命令与结构化下一步 | 页面和状态列表 | 六步侧栏、流式阶段、Agent 回放 | 四阶段主流程和 Studio Trace |
| 审计 | 平台事件、发送证据和轮次审计 | 历史记录和统计 | 审计 PDF、面试负债、敏感审批 | Studio Trace、提示词快照、数据恢复 |
| 商业模式 | 开源客户端 + 云端积分 | 未公开 | 免费 1 次 + 9.90 元月度会员 + 课程/源码 | 本机个人版，不收费 |
| 可验证成熟度 | 测试充分，但云端算法不可审计 | 单提交原型 | 公开页面和前端契约丰富，后端效果未验证 | Vitest、Playwright、eval、CI |
| 关键判断 | 执行层较成熟，云端依赖明显 | 不宜直接复用代码 | 产品化强，透明度和社会证明有风险 | 内容可信链强，入口与交付层仍薄 |

## 3. AgentMesh-JobAgent 最值得借鉴什么

### 3.1 把“下一步”变成机器可读协议

AgentMesh 的命令不只返回成功或失败，还返回 `requires_user_action`、`request_preserved`、`retryable`、`next_suggested`、`continue_required` 和 `workflow_complete` 等状态。它的 [`interaction_required`](https://github.com/jiyangnan/AgentMesh-JobAgent/blob/a11c2b0fc5c5587ca3690f3fb42927ee0a4f38f0/src/jobagent/infra/interaction_protocol.py) 同时提供卡片字段、文本兜底、continuation action 和 idempotency key。

**对本项目的启示**：当前四阶段 UI 已能显示阻塞原因，但对开发者工作台、未来 Codex/Flowise 调用方仍缺少统一输出契约。可以新增：

```ts
interface WorkflowActionResult<T> {
  actionId: string;
  status: "completed" | "interaction-required" | "retryable" | "failed";
  data?: T;
  userAction?: InteractionRequest;
  nextAction?: WorkflowActionRef;
  requestPreserved: boolean;
  workflowComplete: boolean;
}
```

这不是引入新 Agent 框架，而是把现有 TypeScript 固定工作流变成可被 UI、Studio 和外部 Host 一致理解的协议。

### 3.2 不可逆动作采用“预览—授权—执行—审计”

AgentMesh 的 [`delivery_authorization`](https://github.com/jiyangnan/AgentMesh-JobAgent/blob/a11c2b0fc5c5587ca3690f3fb42927ee0a4f38f0/src/jobagent/infra/delivery_authorization.py) 不是一个普通确认布尔值。授权会绑定平台、轮次、岗位列表、预览摘要和交互 ID；内容变化后旧授权立即失效。

**对本项目的启示**：未来发送简历、发送招呼语、发布作品集或写入外部平台，都应该使用同一类 `ActionAuthorization`。首版甚至可以只做“模拟投递”，验证用户能否看清：

- 投给哪个岗位和平台。
- 使用哪一份已确认简历。
- 将发送哪些字段和话术。
- 哪些信息会离开本机。
- 成功依据和失败后的恢复方式。

在没有这层门禁前，不应实现真实自动投递。

### 3.3 用能力注册表隔离平台脆弱性

AgentMesh 的 [`platforms/registry.py`](https://github.com/jiyangnan/AgentMesh-JobAgent/blob/a11c2b0fc5c5587ca3690f3fb42927ee0a4f38f0/src/jobagent/platforms/registry.py) 不把所有平台假设成同一种能力，而是声明每个平台是否支持简历提交、个性化消息、字符限制、成功证据和明确不支持的行为。

**建议借鉴的数据结构**：

```ts
interface JobPlatformCapability {
  platformId: string;
  capture: "supported" | "manual" | "unavailable";
  delivery: "preview-only" | "supported" | "unavailable";
  messagePolicy: { supported: boolean; maxChars?: number };
  requiredEvidence: DeliveryEvidenceType[];
  limitations: string[];
}
```

这样页面改版只影响一个 adapter，核心简历、证据和投递数据不依赖网页 DOM。

### 3.4 请求账本和故障证据

AgentMesh 对长任务保留请求 ID、候选集合和计费状态，有限重试后返回精确恢复动作；浏览器诊断也把“浏览器不可达、无目标标签页、页面未就绪、未登录”分开。

**建议借鉴**：给未来岗位采集和外部投递增加本地 `ActionAttempt`，保存输入摘要、幂等键、阶段、已完成副作用、错误分类、下一动作和审计证据。不能只用 UI 的 loading/error 状态。

## 4. ai-job-assistant 最值得借鉴什么

### 4.1 浏览器中的“捕获到工作台”入口

其扩展示例会从 BOSS 页面提取岗位、公司、薪资、地点、JD、HR 活跃状态和扫描批次，再写入本机 JobRecord。这个入口降低了用户复制粘贴 JD 的成本。

**建议借鉴，但重新设计**：做“岗位采集助手”，而不是“自动沟通插件”。采集结果先进入待核对区，用户确认后才进入正式岗位库：

- 保存原始页面 URL、采集时间和原始文本快照。
- 标记字段来源为 DOM、OCR 或人工修改。
- 用平台岗位 ID + URL + 公司/岗位摘要去重。
- 页面变化导致字段不全时进入待修复，而不是自动分析。
- 权限限定到支持的平台域名，不能申请 `<all_urls>`。

### 4.2 岗位列表和漏斗比单条投递表更有用

它的 JobRecord 比当前 Resume Expert 的 JobApplication 多出来源、扫描批次、匹配分、岗位标签、HR 状态和组合推荐等字段，并提供漏斗与分布图。

真正值得借鉴的是**岗位机会与正式投递分离**：

- `JobOpportunity`：捕获、待核对、已分析、短名单、放弃。
- `JobApplication`：准备、已投递、笔试、面试、Offer、结束。
- `ApplicationEvent`：记录每次状态变化、日期、原因、下一动作和使用的简历版本。

不要把 HR 活跃度直接混入匹配分。它最多是一个带采集时间的运营信号，不能证明岗位适合用户。

### 4.3 OCR 只适合作为字段级后备

该项目在 DOM 抽取失败后尝试 EasyOCR/PaddleOCR，并保留调试信息。这个降级顺序是合理的，但当前 Resume Expert 仍不需要立刻加入 OCR：岗位页面优先使用 DOM/用户粘贴，扫描简历才是 OCR 的真实需求。

后续若加入，应坚持本地、用户显式触发、展示原图/识别文本对照，并让低置信度字段逐项确认。

## 5. 小坏简历最值得借鉴什么

### 5.1 先按用户任务分流，而不是先展示功能菜单

[小坏简历首页](https://ai.e404e.cn/)首先让用户选择“已有简历要优化”或“经历不足要定制”，然后分别进入 Studio 和“包装老师”。这个分法直接对应用户所处状态，比让用户先理解证据库、项目访谈、分析和制作模块更自然。

**对本项目的启示**：Resume Expert 首页可以先出现一个紧凑的起点选择器：

- **优化已有简历**：导入/粘贴 → JD 分析 → 补证 → 制作。
- **从零梳理经历**：建立经历 → 访谈 → 事实确认 → 交接制作。
- **继续上次任务**：恢复当前文档和未完成产物。

这只是入口层，不拆成两套数据。两条路径仍然共用 CareerExperience、EvidenceClaim、Capability、ResumeDocument 和同一个 TypeScript 工作流。

### 5.2 “先大纲、后成稿”比一次长生成更可控

其履历定制先通过素材追问提出经历大纲，用户至少选择两条后才生成完整经历。前端把六个用户可见产物固定为：填写档案、素材挖掘、经历包装、完整简历、版式预览和面试备战。

**建议借鉴**：在当前项目访谈与最终简历之间新增轻量 `ExperienceOutline`：

- 名称、场景、角色、推荐原因。
- 关联的用户回答和候选 claim ID。
- `candidate / accepted / rejected` 状态。
- 只有已接受大纲才进入成稿任务。

这能减少无价值长输出，也让用户在内容生成前纠正方向。它不替代原子事实确认，只是更好地组织事实。

### 5.3 把“可信门禁”翻译成用户能理解的清单

小坏简历把可能新增数字、职责或工具的内容集中为“敏感主张审批”，并把可能被面试深问的内容显示为“面试负债”。这两个名称比底层 evidence link 状态更贴近用户决策。

Resume Expert 已经有更严谨的证据关联，可在不改变可信规则的情况下增加两种投影视图：

- **导出前事实清单**：新增、变更、待复核和无证据主张逐条批准/拒绝。
- **面试负债清单**：claim、证据强度、最可能追问、诚实回答边界和需要补充的指标。

不要再造一个不透明总分；现有确定性 ATS、证据状态和分析结果应作为这些视图的来源。

### 5.4 明确“访谈结果交接到制作”的时刻

前端契约存在 `handoff-to-studio`：从零梳理得到的项目和简历可以交给 Studio 继续修改。当前 Resume Expert 虽然数据上已经能连通访谈、事实库和最终简历，但用户感知仍像在多个模块间跳转。

**建议借鉴**：访谈完成后生成一张“交接单”，列明已确认经历、事实、指标、能力、未解决问题和目标岗位，并用一个主按钮创建/更新岗位简历草稿。交接动作应保存来源映射，不能只复制 Markdown。

### 5.5 多 JD 分支比无血缘复制更清楚

其前端允许同一素材生成最多 3 个 JD 分支，并为每个分支展示适配简历和独立就绪度。Resume Expert 当前可以复制岗位文档，但复制后分支血缘和差异不明显。

可以新增 `parentDocumentId`、`branchLabel` 和 `branchedAtRevision`，在版本选择器中显示“基础版 → A 公司 → B 公司”的关系，并支持比较：岗位要求、采用事实、Bullet 和模板差异。仍然让每个分支拥有独立快照，避免父文档变化静默覆盖已投递版本。

### 5.6 商业包装值得观察，但不是当前建设重点

[会员页](https://ai.e404e.cn/membership)使用“免费完整体验一次 → 9.90 元 / 30 天不限次”的低门槛订阅，同时销售课程与源码。[公开产品接口](https://ai.e404e.cn/api/pay/alipay/products)可以核验当前价格。

这说明它把“先体验完整结果”作为转化手段，而不是只开放残缺功能。不过 Resume Expert 当前仍是本机个人版，不应为了模仿定价而引入账号、支付和云端成本。真正值得借鉴的是**首次体验必须跑通完整价值链**。

## 6. 哪些东西不能照搬

### AgentMesh-JobAgent

- **不要照搬云端权威决策**：开源客户端无法证明其 36 维画像与云端评分实现；Resume Expert 的优势正是本地可见事实和确定性门禁。
- **不要立即接四个平台自动投递**：页面适配成本、平台条款、验证码、账号风控和误投风险会压过当前产品价值。
- **不要复制积分/签名体系**：单机个人版没有多租户计费和不可信云端响应边界，先用本地摘要与授权即可。
- **不要把串行平台轮次变成简历主流程**：它应该是交付连接器的内部执行状态，不应污染材料、分析和制作阶段。

### ai-job-assistant

- **不能直接复制代码**：仓库没有许可证，法律上不等于可自由使用。
- **不能采用任意 CORS + `<all_urls>`**：这会扩大本机后端和浏览器扩展的攻击面。
- **不能解析失败后伪造低分结果**：结构错误必须失败并保留原数据，不能让用户误以为得到了有效诊断。
- **不能依赖固定 Mock 生成业务结论**：Mock 只能验证流程，不能参与真实投递建议。
- **不能用当前状态代替事件历史**：否则无法计算阶段耗时、回退、重复投递和真实转化。
- **不能把模型分和 HR 活跃度简单加权成投递决策**：两者都不是可靠的成功概率。

### 小坏简历

- **不照搬“多 Agent”作为能力证明**：公开页面和前端契约能证明产品结构存在，不能证明后端模型质量和实际效果。
- **不照搬 Job-Ready 黑盒总分**：本项目应优先呈现事实覆盖、风险项和确定性计算口径。
- **不照搬近期购买动态**：采集时首页渲染了前端固定姓名和相对当前时间生成的购买记录，且未标记为演示数据；这种社会证明会伤害可信定位。
- **不照搬反调试威吓**：前端弹窗声称上传环境指纹和操作轨迹，而公开可直接确认的是页面访问埋点。任何遥测都应清晰说明字段、用途、保留期和关闭方式。
- **不混合课程、源码与求职主流程**：它们有商业协同，但会稀释职业工作台定位。
- **不强制微信登录和云端保存**：当前项目的本机数据、用户自带模型和可导出备份仍是差异化优势。

## 7. 推荐的新领域切片

不要继续扩大 `JobApplication` 单一对象。建议新增以下独立模型：

| 模型 | 责任 |
|---|---|
| `JobSourceSnapshot` | 原始 URL、平台、采集时间、原始文本、字段来源和解析警告 |
| `JobOpportunity` | 规范化岗位、公司、地点、薪资、当前决策和去重键 |
| `OpportunityDecision` | 短名单/待补证/放弃、理由、关联 requirement/claim ID 和用户确认 |
| `DeliveryPlan` | 平台、简历快照、话术、待发送字段和数据离开说明 |
| `ActionAuthorization` | 绑定计划摘要、用户确认、有效期和一次性使用状态 |
| `ApplicationEvent` | 投递、笔试、面试、Offer、结束等状态事件及原因 |
| `ConnectorAttempt` | 外部执行请求、阶段、错误、恢复动作和成功证据 |

关系保持清楚：

`JobSourceSnapshot -> JobOpportunity -> OpportunityDecision -> ResumeDocument snapshot -> DeliveryPlan -> ActionAuthorization -> ConnectorAttempt -> ApplicationEvent`

职业事实库仍然独立，机会和投递只能引用已确认事实与简历快照，不能反向静默修改事实。

## 8. 建议版本路线

### V1.9.5：双入口与产物化履历流程

- 首页增加“优化已有简历 / 从零梳理经历 / 继续上次任务”三个入口。
- 在访谈和成稿之间增加经历大纲候选与用户确认。
- 访谈完成后通过交接单进入制作，完整保留 claim、metric 和 capability 引用。
- 将现有待复核证据投影成“导出前事实清单”和“面试负债”，不新增黑盒总分。
- 为岗位文档增加可见分支血缘和差异比较设计，先不改变存储 Schema，完成原型和迁移评审后再实施。

**验收**：新用户不需要理解底层模块即可选对路径；AI 不会在大纲确认前生成长简历；交接后的每条内容仍可回到事实；未批准主张无法导出。

### V1.10.0：岗位机会收件箱

- 新增手工粘贴和浏览器显式采集入口。
- 建立来源快照、字段来源、去重、待核对、短名单和放弃原因。
- 将当前投递记录与岗位机会关联，但不做真实自动投递。
- 先支持一个平台的只读采集，权限只开放该域名。

**验收**：同一岗位重复采集不会重复；用户能看到原始快照与规范化字段差异；未确认内容不进入分析。

### V1.10.1：可解释机会决策与投递漏斗

- 使用现有 JobRequirement 和 EvidenceClaim 生成事实级推荐理由。
- 将匹配度、岗位偏好、地点薪资等决策维度分开显示，不输出伪概率。
- 新增 ApplicationEvent、阶段耗时、失败/结束原因和下一动作。

**验收**：每个“推荐/不推荐”都能回到 JD requirement 和 claim；漏斗由事件计算而不是手填总数。

### V1.10.2：交付预览与授权协议

- 实现统一 `WorkflowActionResult`、`InteractionRequest`、`DeliveryPlan` 和 `ActionAuthorization`。
- 先做模拟发送和审计，不打开招聘平台或发送信息。
- Studio 展示每次授权、摘要变化、取消和失败恢复。

**验收**：计划内容变化后旧授权必然失效；重复确认或刷新不会产生重复动作；缺少授权不能执行。

### V1.11.0：单平台可选连接器实验

- 只在前面三版稳定后选择一个平台做本机连接器。
- 默认关闭、显式授权、串行执行、失败即停、可手工接管。
- 先把“打开岗位并辅助填写”作为成功目标，再评估是否允许最终提交。

**验收**：连接器关闭时主产品完全不受影响；任何外发都有完整预览、授权和结果证据；适配器故障不污染职业事实库。

## 9. 关于 Agent、Flowise 和 MCP 的判断

- **Agent 设计值得加强，但形式应是协议化行动，不是增加更多角色名称**。稳定动作 ID、交互请求、下一步和幂等语义比“多 Agent”标签更重要。
- **TypeScript 工作流继续作为唯一业务事实来源**。Flowise 仍用于候选草稿实验，不能绕过事实确认或交付授权。
- **本轮不需要 MCP**。浏览器采集和平台执行各只有清晰的本机边界，直接定义 connector interface 更简单。只有将来需要让多个 Host 以统一协议调用多个独立外部工具时，再评估 MCP adapter。

## 10. 最终建议

推荐顺序是：先借鉴小坏简历的**双入口、先大纲后成稿和明确交接**，把现有能力变得更容易使用；再借鉴 ai-job-assistant 的**岗位采集和看板入口**；任何外部动作开始前，必须先实现 AgentMesh 的**预览、授权、幂等和审计协议**。

这个顺序既能快速改善当前体验，也能防止未来先接浏览器自动化、后补安全门禁，最终形成“能点按钮但不可控”的自动投递工具。

Resume Expert 最有价值的差异化应保持为：

> 用可核验的个人事实理解岗位，生成可追溯的求职材料，再以用户明确授权的方式完成交付并从结果中学习。

这比“抓更多岗位”或“自动多投几份”更难复制，也更符合当前项目已经建立的证据底座。

## 11. 来源与证据边界

- AgentMesh 仓库与 README：[`a11c2b0`](https://github.com/jiyangnan/AgentMesh-JobAgent/tree/a11c2b0fc5c5587ca3690f3fb42927ee0a4f38f0)
- ai-job-assistant 仓库：[`f4f202d`](https://github.com/SouthMountain88/ai-job-assistant/tree/f4f202d83a4d51aae02b366bd86d4be8b3a0ec0c)
- 小坏简历：[首页](https://ai.e404e.cn/)、[履历定制](https://ai.e404e.cn/package)、[会员页](https://ai.e404e.cn/membership)、[产品接口](https://ai.e404e.cn/api/pay/alipay/products)
- 当前项目能力：[`README.md`](../../README.md)、[`JobApplication`](../../src/types/resume.ts)、[`ApplicationsStep`](../../src/components/steps/applications-step.tsx)
- 详细仓库事实见：[原始证据](./raw/01-repository-evidence.md)
- 小坏简历公开证据见：[网站证据](./raw/02-xiaohuai-resume-site.md)
- 归纳版见：[分析摘要](./summary/01-findings.md)
- 小坏简历归纳版见：[专项摘要](./summary/02-xiaohuai-findings.md)

限制：AgentMesh 的云端画像和决策实现不在审计仓库内，因此本报告只确认客户端契约和 README 声明；`ai-job-assistant` 没有许可证和发布历史，所有借鉴仅限独立产品思路，不建议复制其源码；小坏简历工作台需要登录，本次只确认公开页面、产品接口和前端契约，未验证其服务端输出质量。
