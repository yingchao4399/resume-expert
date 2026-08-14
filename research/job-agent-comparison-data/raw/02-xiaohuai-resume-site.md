# 小坏简历公开网站原始证据

> 采集日期：2026-08-15
>
> 采集对象：[小坏简历](https://ai.e404e.cn/)、[履历定制入口](https://ai.e404e.cn/package)
>
> 方法：公开页面、robots/sitemap、公开产品接口、前端静态资源与无头 Chromium 只读核验。

## 1. 可直接运行验证的公开页面

- 首页标题为“小坏简历 · AI 简历优化与履历定制”，公开定位是全行业 AI 简历平台。
- 首页把用户分成两个明确入口：
  - “已有 PDF / WORD 简历”进入简历智能优化。
  - “经历不足 / 转行 / 跨行业”进入求职履历定制。
- 首页用“诊断 → 对齐 → 撰写 → 把关 → 备战”解释价值链，并公开展示 JD 匹配、行业语境、智能追问、证据链、人机确认、Job-Ready 和面试问答等能力。
- [会员页](https://ai.e404e.cn/membership)公开说明新用户可完整体验 1 次，月度会员同时解锁“包装老师”和 Studio。
- [公开产品接口](https://ai.e404e.cn/api/pay/alipay/products)在采集时返回：
  - 月度会员：9.90 元 / 30 天。
  - 全栈学习资料：509.15 元，标注原价 599 元。
  - 智能体代码：99 元。
- [公开简历库](https://ai.e404e.cn/library/public)存在独立入口，页面说明只展示脱敏发布内容；采集时没有公开模板。
- `/package` 未登录时跳转到微信验证码登录页，无法在不登录的条件下验证完整业务执行结果。

## 2. 前端可见的履历定制状态链

公开前端资源在采集时引用 `/assets/index-DJlRajsh.js`。其中履历定制侧栏定义了六步：

1. 填写档案：目标岗位、行业、经验阶段、专业/学历、技能、课程、校园活动、工作片段、包装目标和可选 JD。
2. 素材挖掘：按行业与经验阶段生成追问，用户回答保存在会话中并可继续对话。
3. 经历包装：AI 先提出经历大纲；用户至少选择两条并确认后，才流式生成完整经历。
4. 完整简历：并行匹配、撰写、质检、循环润色、投递就绪和 HITL 审批。
5. 版式预览：模板预览和 PDF/DOCX 导出。
6. 面试备战：按项目生成业务背景、关键流程、可追问细节、连环问答，并支持 PDF/Markdown 导出。

前端调用契约还显示：

- 会话启动、恢复、回答保存和多轮对话。
- 项目大纲提出、确认、增加、编辑和单项目重新生成。
- 简历流式生成、敏感主张审批、Job-Ready 刷新和 Agent 执行回放。
- 最多 3 个 JD 分支，每个分支拥有适配简历和独立就绪度。
- 履历定制结果可以 `handoff-to-studio`，将从零梳理结果交给已有简历编辑流程继续加工。
- 导出项包括简历 PDF、DOCX、审计 PDF、面试手册 PDF 和 Markdown。

相关公开接口路径：

- `/api/packaging/start`
- `/api/packaging/session/{id}/discovery/stream`
- `/api/packaging/session/{id}/projects/propose/stream`
- `/api/packaging/session/{id}/projects/confirm/stream`
- `/api/packaging/session/{id}/resume/stream`
- `/api/packaging/session/{id}/claims/review`
- `/api/packaging/session/{id}/job-ready/refresh`
- `/api/packaging/session/{id}/interview-prep/generate/stream`
- `/api/packaging/session/{id}/branches`
- `/api/packaging/session/{id}/handoff-to-studio`

以上证明前端产品契约存在；因为工作台需要登录，本次未验证服务端是否在所有边界条件下完整执行这些能力。

## 3. 可借鉴的视觉与信息架构事实

- 首屏只给“立即优化”和“定制履历”两个主要动作，并用绿色与紫色区分路径。
- 产品价值以岗位结果语言表达，而不是先介绍模型或技术栈。
- 功能先按五条链路解释，再按诊断、撰写、质量和履历定制四组展开，复杂能力仍可扫描。
- 会员页只展示双线价值、Skills 和一个主价格，支付动作集中，没有把大量配置暴露给首次访问者。
- 工作台采用宽屏侧栏步骤轨，步骤有完成、当前和禁用状态；前端文本明确说明手机端未完整适配。

## 4. 信任与边界问题

- 首页实际渲染的“近期购买动态”中包含前端固定姓名和 `Date.now() - N 分钟` 生成的相对时间；页面没有把这些条目标成演示数据。不能把它当作真实销量证据，也不应借鉴这种社会证明方式。
- 前端包含开发者工具检测弹窗，文案声称正在采集并上报环境指纹、操作轨迹和页面上下文；审计到的相邻代码只直接证明了弹窗及模拟进度。
- 独立页面访问埋点可直接确认：它生成本地 visitor ID，并向 `/api/track/pageview` 发送路径、visitor ID 和 referrer。
- 采集时公开路由与 sitemap 未发现独立隐私政策或服务条款页面；这不证明网站没有其他形式的条款，但公开可发现性不足。
- `/package`、`/studio`、`/apply`、`/api/` 在 robots.txt 中禁止搜索引擎抓取；登录后业务内容不应由本报告推断为公开资料。
- “多 Agent、RAG、质检、Job-Ready”是产品界面和前端契约中的名称；没有服务端源码与测评结果，不能据此判断模型质量或实际效果。

## 5. 一手来源

- [首页](https://ai.e404e.cn/)
- [履历定制入口](https://ai.e404e.cn/package)
- [会员与定价](https://ai.e404e.cn/membership)
- [公开产品接口](https://ai.e404e.cn/api/pay/alipay/products)
- [公开简历库](https://ai.e404e.cn/library/public)
- [robots.txt](https://ai.e404e.cn/robots.txt)
- [sitemap.xml](https://ai.e404e.cn/sitemap.xml)
- [采集时前端资源](https://ai.e404e.cn/assets/index-DJlRajsh.js)
