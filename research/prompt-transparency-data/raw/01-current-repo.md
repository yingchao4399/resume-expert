# 当前仓库原始审计记录

> 审计日期：2026-08-14
> 基线：`v1.9.1` / `0817dc6`
> 类型：本地一手代码证据

## Studio 当前入口

- `src/components/studio/studio-shell.tsx` 当前提供五个页签：工作流地图、运行追踪、测评中心、开发记录、Flowise 实验室。
- `src/components/studio/workflow-studio.tsx` 的 AI 节点编辑器只展示 Provider、模型、`promptVersion` 字符串、超时和人工确认。
- `src/lib/studio/workflow-types.ts` 中 `WorkflowNode` 只有 `promptVersion?: string`，没有 prompt ID、源文件、内容、哈希、Schema 或变量定义。
- `src/lib/studio/workflow-default.ts` 使用 `analysis-v1`、`interview-v1`、`optimize-v1` 三个标签；没有代码证明这些标签与实际提示词文本一一绑定。

## 提示词实际分布

- `src/lib/ai/prompts.ts`：简历系统提示词及分析、优化、补证、最终简历等用户提示词构造器。
- `src/lib/ai/jd-prompts.ts`：深度 JD、要求—事实匹配、面试策略、补证示范。
- `src/lib/ai/interview-prompts.ts`：面试复盘系统提示词和用户提示词。
- `src/lib/career/interview.server.ts`：项目访谈内联系统提示词。
- `src/services/ai/importResume.server.ts`：简历结构化导入内联提示词。
- `src/lib/flowise/client.server.ts`：Flowise 回退路径内联提示词。
- `src/lib/ai/client.ts`：Provider 兼容时注入 JSON Schema；第一次失败后还会构造 JSON 修复系统提示词。

这意味着“源码里看到的模板”与“最终发给模型的完整 system/user 消息”并不总相同。

## 追踪与文档

- `WorkflowSpan` 记录节点、模式、Provider、模型、输入、输出、耗时和错误，但不记录 prompt ID、版本、哈希、原始模板或解析后的最终消息。
- Trace 存在 IndexedDB，最多 50 次、30 天、50MB，并会脱敏和截断。
- 当前 Git 跟踪的 Markdown 文件为 27 个；未跟踪的 `prd/` 按既有边界未纳入、未读取、未修改。

## 结论

现有 Studio 已经具备工作流、追踪、测评和发布骨架，但还不能回答三个审计问题：

1. 这个节点实际调用了哪一份提示词？
2. 这次运行最终发送给模型的 system/user 内容是什么？
3. 某个提示词或 Markdown 文件变更后，影响了哪些节点、测评和发布版本？
