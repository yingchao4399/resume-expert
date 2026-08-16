# 06 · 证据与评测（Evidence & Evaluation）

> 所有「已实现」表述均可在仓库代码、测试、评测或 Trace 中验证；截图使用合成/示例数据，不含真实简历、API Key、录音或本机配置。

## 1. 验证命令结果（2026-08-16 复跑）

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | ✅ exit 0 |
| `npm run typecheck` | ✅ exit 0（next typegen + tsc --noEmit） |
| `npm test` | ✅ 46 个测试文件 / 155 个用例全部通过 |
| `npm run eval:mock` | ✅ 24 个冻结合成用例，schemaValidityRate=1、immutableFactRetentionRate=1、unsupportedClaimRate=0、finalResumeFactAccuracy=1、jdRequirementRecall=1、needsSupplementF1=1、evidenceStrengthMacroF1=1 |
| `npm run eval:career` | ✅ 6 个用例，sourceGroundingRate=1、unsupportedClaimRate=0、quoteRetentionRate=1、duplicateClaimRate=0、questionRelevant=1、deterministicTermination=1 |
| `npm run eval:jd` | ✅ 2 个文件 / 9 个用例全部通过 |
| `npm run build` | ✅ exit 0（27 个静态页 + 服务端 API 路由） |
| `npm run test:e2e` | ⚠️ 32 passed / 3 failed（环境相关：PDF.js CMap 字体路径、Studio 视图与审计用例；详见 test-results/） |

## 2. 测试覆盖（仓库内 `*.test.ts` / `*.spec.ts`）

- 单元/集成：`src/lib/ai`（Schema、错误、结构化执行、截断回退、模型目录）、`src/lib/jd`（决策地图、深度分析、准备度）、`src/lib/career`（能力等级、上下文、迁移）、`src/lib/evidence`、`src/lib/export`（DOCX/模板）、`src/lib/studio`（Prompt 注册、Trace 存储、工作流校验/发布）、`src/store`（持久化）等。
- 端到端：`e2e/core-flow.spec.ts` 覆盖核心流程与 ATS 模板截图快照；fixtures 含中文 PDF/DOCX 简历样例。

## 3. 评测体系（evals/）

- 合成评测：`evals/runner.mjs`（validate/mock/ai/compare/report），24 个冻结合成用例，`baseline.json` 为已批准基线。
- 职业/事实评测：`evals/career-eval.mjs` 覆盖来源落地率、无依据主张率、原文引用保持率、重复主张率、追问相关性与确定性终止。
- JD 评测：`evals/jd-cases.ts` + `src/lib/jd/jd-eval.test.ts` + `deep-analysis.test.ts`。

## 4. Trace 与可观测

- Studio Trace（IndexedDB）记录每次 LLM 调用的 promptId、runId、模型快照、输出、错误与耗时；Prompt Registry 统一管理 promptId；支持可视化与回放。
- 门禁判定、引用关系（requirementId → claimId → 简历 bullet）全程可追溯。

## 5. 截图索引（合成数据，见 `assets/screenshots/`）

| 截图 | 文件 | 说明 |
| --- | --- | --- |
| 示例材料 | `01-materials.png` | 岗位/JD/原始简历（合成） |
| 需求地图确认 | `02-requirement-map.png` | JD 决策地图确认门禁 |
| 事实匹配 | `03-fact-match.png` | 要求↔事实匹配与证据强度 |
| 最终简历 | `04-final-resume.png` | 最终简历与来源引用 |
| 导出门禁 | `05-export-gate.png` | ATS 与导出门禁 |
| Studio Trace | `06-studio-trace.png` | Prompt/运行轨迹可视化 |
| Mock 评测 | `07-mock-eval.png` | 合成评测指标 |

## 6. 复现步骤

```bash
git clone https://github.com/yingchao4399/resume-expert.git
cd resume-expert
npm install
npm run dev          # 打开 http://127.0.0.1:3000（本地回环）
npm run verify:local # 首页与脚本完整性自检
npm test             # 单测
npm run eval:mock && npm run eval:career && npm run eval:jd  # 评测
```
