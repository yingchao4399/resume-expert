# Flowise 实验服务

Flowise 只承担可替换的 AI 实验节点，简历文档、证据库、排版、导出、Schema 校验和确认门禁仍由 TypeScript 主应用负责。

## 安全状态

- 升级前已备份本机数据库、流程导出和锁文件。
- 本机 Flowise 已从 3.1.3 升至 3.1.4。
- 2026-08-12 生产审计仍有 12 个 critical、72 个 high 上游依赖漏洞。
- 服务因此默认禁用、只允许本机访问，不嵌入主应用，也不自动接管主流程。

## 启动和配置

1. 执行 `powershell -ExecutionPolicy Bypass -File scripts/start-flowise.ps1`。
2. 在 Flowise 导入 `flowise/project-evidence-agentflow.json`，为 LLM 节点选择本机凭证并给流程设置 API Key。
3. 复制 `.flowise.example.json` 为 `.flowise-local.json`，填写 `flowId` 和 `apiKey`，将 `enabled` 改为 `true`。

服务只监听 `http://127.0.0.1:3200`。API Key 只由 Next.js 服务端读取，Studio 只接收脱敏状态。流程结果通过 Zod 校验，用户确认后才进入证据库候选区。
