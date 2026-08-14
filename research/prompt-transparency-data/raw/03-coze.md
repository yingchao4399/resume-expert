# 扣子编程与 Coze Loop 官方资料摘录

> 访问日期：2026-08-14
> 类型：官方页面、官方 GitHub/Wiki、源码与 SDK

## 资料

- 扣子编程：https://code.coze.cn/
- Coze Loop：https://github.com/coze-dev/coze-loop
- Coze Loop Wiki：https://github.com/coze-dev/coze-loop/wiki/1.-%E4%BB%80%E4%B9%88%E6%98%AF-Coze-Loop
- Prompt 领域模型：https://github.com/coze-dev/coze-loop/blob/main/frontend/packages/loop-base/api-schema/src/api/idl/prompt/domain/prompt.ts
- Prompt Diff：https://github.com/coze-dev/coze-loop/blob/main/frontend/packages/loop-components/prompt-components-v2/src/components/prompt-diff/diff-content.tsx
- Go SDK：https://github.com/coze-dev/cozeloop-go

## 扣子编程

- 官网公开定位是“AI 开发伙伴 / Vibe Coding 基础设施”，支持用自然语言开发智能体、工作流、网页和移动应用并部署。
- 公开首页是动态页面，当前可抓取资料不足以证明其内部是否具备“全仓库提示词清单、任意 Markdown 审计、运行时最终 prompt 绑定”等具体能力。
- 因此不能把扣子编程与 Coze Loop 的能力直接等同。

## Coze Loop

- 官方定位覆盖 Prompt 开发、调试、优化、版本管理、评测和 Trace 观测。
- 源码把 Prompt 作为一级领域实体：`PromptDraft`、`PromptCommit`、`version`、`base_version`、提交说明、提交人和时间。
- `PromptDetail` 同时保存消息模板、变量、模型配置、工具配置、MCP 配置和扩展信息。
- 消息角色包括 System、User、Assistant、Tool、Placeholder；模板支持 Normal、Jinja2、GoTemplate 和自定义类型。
- Prompt Diff 源码比较消息、变量、元数据、模板类型、模型参数和工具配置，并支持展开嵌套 Snippet。
- 调试数据包含输入/输出 Token、耗时、Mock 变量和工具结果；SDK 可按 `PromptKey` 取回并格式化 Prompt，也可上报 Trace。
- Prompt 支持 L1-L4 安全等级。

## 边界

- Coze Loop 管理的是“已注册为 Prompt 的资产”，不是任意仓库文件浏览器。
- 它最值得学习的是 Prompt 的领域模型和 Prompt—Trace—Eval 闭环，而不是把整个简历业务工作流迁走。
