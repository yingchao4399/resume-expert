# 提示词透明化平台研究汇总

> 汇总日期：2026-08-14

## 当前状态

简历专家已经有工作流、Trace、评测和发布骨架，但 Prompt 没有成为一级资产。真实提示词横跨 3 个集中 Prompt 文件、多个服务端内联字符串和 `client.ts` 的运行时 Schema/修复注入。Studio 的 `promptVersion` 未绑定内容，Trace 也没有记录确切版本或最终请求。

## 行业做法

1. Dify：把 Prompt 放在工作流 LLM 节点中，同屏管理角色、变量、Schema、模型与调试；工作流负责版本。
2. Coze Loop：把 Prompt 独立建模为 Draft/Commit/Version，Diff 同时比较内容、变量、模型和工具，并连接 Playground、Eval 和 Trace。
3. Langfuse/Opik：把 Prompt 从代码中抽成注册资产，运行时按版本/标签获取，并把确切版本关联到 Trace。
4. Promptfoo：保留 Prompt-as-Code，用 Git 文件和 YAML 测评配置建立回归矩阵。
5. Agenta：把以上能力放进一套团队 LLMOps 平台，适合多人和复杂环境，但对个人本机应用较重。

## 共识

- “看得到 Prompt 模板”不等于“看得到最终发送给模型的消息”。运行时变量、Schema、Provider 适配、工具和修复提示词必须形成不可变快照。
- Prompt 内容、模型配置、输出 Schema、工具、变量和评测基线应作为一个可审计发布单元。
- 工作流节点应引用稳定 Prompt ID/版本，而不是自由文本标签。
- 每次运行应绑定确切 Prompt 版本和内容哈希，才能复现、比较和回滚。
- Markdown/源码浏览属于 Source Catalog，不等同于 Prompt Registry；主流产品通常把二者分开。

## 核心判断

没有单一现成平台完全满足“本机简历应用 + TypeScript 唯一事实源 + 全部 Prompt/Schema/Markdown 可见 + 最终运行快照 + 受控编辑”。最合理的产品形态是本地混合式：保留 Git/TypeScript 事实源，同时借鉴 Coze Loop/Langfuse 的 Prompt 资产模型、Dify 的节点上下文和 Promptfoo 的测评门禁。
