# 职途智策 AgentTeam —— 初赛材料包（competition/initial/）

面向 GOAI「新智基座｜Agent Infra」赛道 · 赛题「复杂任务多 Agent 自主协同」初赛提交。

## 提交清单

| 文件 | 用途 | 打开方式 |
| --- | --- | --- |
| `00-project-introduction.md` | 500 字内作品简介 | 任意 Markdown 阅读器 / 在线提交粘贴 |
| `01-solution-deck.pptx` | 13 页初赛方案（可编辑） | PowerPoint / WPS |
| `01-solution-deck.pdf` | 13 页初赛方案（同内容） | PDF 阅读器 |
| `02-project-one-pager.pdf` | 项目一页纸 | PDF 阅读器 |
| `03-agent-identity.md` | 4 个 Agent 身份清单 | Markdown |
| `04-skill-catalog.md` | 核心 Skill 清单（统一表格） | Markdown |
| `05-architecture-and-contracts.md` | AgentTeams 映射、共享状态、工具契约、MCP/RAG 替代 | Markdown |
| `06-evidence-and-evaluation.md` | 测试/评测/Trace/截图/复现证据索引 | Markdown |
| `07-open-source-and-compliance.md` | 仓库/依赖/商业模型/数据/隐私/开源计划 | Markdown |
| `assets/screenshots/` | 合成数据截图（证据） | 图片查看器 |

## 演示入口

- 本地运行：`npm install && npm run dev` → 打开 http://127.0.0.1:3000（仅本机回环）。
- 工作流图谱：`docs/WORKFLOW-MAPS.md`（四阶段工作流与门禁的可视化说明）。
- Studio Trace：应用内「Studio」页（http://127.0.0.1:3000/studio）查看 Prompt/运行轨迹。

## 材料约定

- 所有截图与示例均使用**合成/示例数据**，不含真实简历、API Key、Trace 正文、录音或本机配置。
- 项目名称：**职途智策 AgentTeam —— 面向求职决策的可信多 Agent 协作系统**。
- `prd/` 保持不提交、不覆盖；本阶段不实现真实 AgentTeams 运行时，多 Agent 协同层为复赛路线。

## 复赛路线（预告）

实现 AgentTeams 运行时、Skill 包、可执行 Demo、回放评测与公开工程材料。
