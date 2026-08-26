# 07 · 开源与合规（Open Source & Compliance）

## 1. 当前公开仓库

| 项目 | 内容 |
| --- | --- |
| 仓库 | https://github.com/yingchao4399/resume-expert |
| 分支 | `main` |
| 版本 | v1.9.7 |
| 技术栈 | Next.js（App Router）+ TypeScript + React + Zustand + Zod + IndexedDB + docx |

## 2. 第三方依赖披露

- 核心依赖：Next.js、React、Zustand（状态持久化）、Zod（Schema 校验）、docx（DOCX 导出）、idb（IndexedDB）、@xyflow/react（工作流可视化）、mammoth/pdfjs-dist（导入解析）、Tailwind CSS、Radix UI、lucide-react。
- 测试/工程：Vitest、Playwright、ESLint、TypeScript。
- 完整依赖与版本见 `package.json` / `package-lock.json`。

## 3. 商业模型（模型服务）

- **用户自行配置的 OpenAI 兼容模型服务**（`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`），非本项目售卖模型能力。
- **默认 Mock 模式可复现**：离线、确定性、零 API 成本，评测与演示均可在 Mock 下复现。
- API Key 仅存于浏览器本地（`.env.local`，已被 `.gitignore` 排除），**不进浏览器外传、不进 Git、不进备份、不进演示材料**。

## 4. 数据与隐私

- 本地优先：简历、事实库、Trace 均存于浏览器本地（Zustand 持久化 + IndexedDB），无服务端数据库。
- 不采集、不上传用户数据；演示与评测一律使用合成/示例数据。
- `.env*.local`、`data/recordings/*`、`*.log`、`evals/results/*` 均已列入 `.gitignore`，不提交真实录音、日志与本地配置。

## 5. 开源计划

- 仓库已公开；本阶段（初赛）**不新增开源协议**。
- 复赛前完成：LICENSE 选择与落地、依赖清单、部署指南、贡献规范（CONTRIBUTING）。
- 计划开放复用：Skill 契约、连接器契约、合成评测集、回放评测与部署脚本。

## 6. 维护边界

- 本阶段以初赛材料为主，不实现真实 AgentTeams 运行时，不重新发布产品版本；`prd/` 保持不提交。
- 复赛新增：可运行的多 Agent 协同层（AgentTeams 运行时）、Skill 包、可执行 Demo、回放评测与公开工程材料。
