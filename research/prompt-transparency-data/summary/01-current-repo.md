# 当前产品摘要

- 优势：TypeScript 工作流、Zod 结构校验、一次修复、Mock/真实测评、Trace、草稿测试、发布与回滚、本机隐私边界。
- 主要缺口：没有中央 Prompt 注册表；`promptVersion` 只是自由字符串；无法从节点定位真实源码；Trace 不包含 Prompt ID/版本/哈希或最终 system/user；Markdown 无统一浏览入口。
- 风险：Provider 适配、Schema 注入和修复提示词会改变最终请求，但当前审计界面无法呈现这种运行时差异。
- 资产规模：27 个受 Git 跟踪的 Markdown 文件；至少 12 个导出的 Prompt 构造器，另有多个内联提示词和运行时注入提示词。
