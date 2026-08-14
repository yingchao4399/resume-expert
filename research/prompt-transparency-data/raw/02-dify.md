# Dify 官方资料摘录

> 访问日期：2026-08-14
> 类型：官方文档与官方 GitHub

## 资料

- LLM 节点：https://docs.dify.ai/en/cloud/use-dify/nodes/llm
- 版本控制：https://docs.dify.ai/en/cloud/use-dify/build/version-control
- Snippets：https://docs.dify.ai/en/cloud/use-dify/build/snippet
- Run History：https://docs.dify.ai/en/cloud/use-dify/debug/history-and-logs
- 单节点调试：https://docs.dify.ai/en/cloud/use-dify/debug/step-run
- GitHub：https://github.com/langgenius/dify
- DSL 服务源码：https://github.com/langgenius/dify/blob/main/api/services/app_dsl_service.py

## 已核验事实

- LLM 节点按 System、User、Assistant 角色编辑消息，支持 `{{variable}}`、Jinja2、上下文变量、结构化输出和模型参数。
- 结构化输出可用可视化编辑器、原始 JSON Schema 或 AI 生成；非原生支持模型会把 Schema 加入提示词。
- 工作流实行 Current Draft、Latest Version、Previous Versions；发布、命名、发布说明、恢复旧版本均有明确概念。
- Snippet 是可发布、可版本化的节点组；工作流插入的是副本，后续原 Snippet 更新不会自动影响已插入副本。
- 可单独运行节点、编辑缓存变量、查看节点输入/输出/耗时；Run History 展示执行顺序和数据流。
- 工作流可导出和导入 YAML DSL。

## 公开证据没有证明的能力

- Dify 文档没有证明它能自动扫描任意 TypeScript/Markdown 仓库并生成完整提示词清单。
- Run History 文档明确证明节点输入、输出、耗时和数据流可见，但没有明确保证展示 Provider 适配和 Schema 注入后的“最终完整请求消息”。
- 提示词主要是 LLM 节点配置的一部分，而不是跨任意源码统一管理的独立资产。
