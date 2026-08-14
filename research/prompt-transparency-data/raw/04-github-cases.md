# GitHub 开源案例原始摘录

> 访问日期：2026-08-14
> 类型：官方文档与官方 GitHub 仓库

## Langfuse

- GitHub：https://github.com/langfuse/langfuse
- Prompt Management：https://langfuse.com/docs/prompt-management/overview
- 数据模型：https://langfuse.com/docs/prompt-management/data-model
- Playground：https://langfuse.com/docs/prompt-management/features/playground
- Trace 关联：https://langfuse.com/docs/prompt-management/features/link-to-traces
- Prompt 组合：https://langfuse.com/docs/prompt-management/features/composability

已核验：集中管理 text/chat prompt；每次修改生成不可变版本；用 `production`、`latest` 或自定义 label 指向版本；支持变量、Prompt 引用和消息占位；Playground 并排比较；运行记录可关联确切 Prompt 版本并汇总延迟、Token、成本和评分。

## Opik

- GitHub：https://github.com/comet-ml/opik
- Prompt Library：https://www.comet.com/docs/opik/latest/development/prompt-library/getting-started
- Agent Playground：https://www.comet.com/docs/opik/latest/development/agent-playground

已核验：Prompt 可放在代码之外并自动版本化；运行 Trace 关联确切版本；可固定 `v3` 等版本复现；Agent Playground 可运行本机 Agent、调整 Prompt/参数并生成完整 Trace。`opik connect` 可让其 Agent 读取源码并提出修改，但这不是自动生成“全仓库 Prompt/Markdown 目录”。

## Promptfoo

- GitHub：https://github.com/promptfoo/promptfoo
- 配置：https://www.promptfoo.dev/docs/configuration/guide/
- Web Viewer：https://www.promptfoo.dev/docs/usage/web-ui/

已核验：Prompt 可通过 `file://prompt.txt` 留在 Git 文件中；YAML 定义 Provider、变量、案例和断言；Web UI 用矩阵、筛选、通过率、分数分布和两两对比查看结果。强项是测试和回归，不是生产 Prompt 注册中心或全仓库内容审计。

## Agenta

- GitHub：https://github.com/Agenta-AI/agenta

已核验：集成 Playground、Prompt/配置版本、分支与环境、评测和可观测；适合团队协作，但对本机个人项目意味着新增完整 LLMOps 平台。

## 当前公开版本快照

- Langfuse：v4.11.0（2026-08-14）。
- Opik：2.2.28（2026-08-13）。
- Promptfoo：0.122.0（2026-08-04）。
- Agenta：v0.111.0（2026-08-09）。
- Dify：1.16.1（2026-07-28）。
- Coze Loop：v1.5.1（2026-01-20）。

版本信息来自 2026-08-14 的 GitHub API，只用于说明调研快照时点，不用于判断产品质量。
