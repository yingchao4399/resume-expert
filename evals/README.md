# AI evaluation baseline

This directory contains synthetic resume cases only. It must never contain user resumes, API keys, or local model output.

```bash
npm run eval:validate
npm run eval:mock
npm run eval:career
npm run eval:jd
npm run eval:readiness
npm run eval:report
```

`eval:jd` 实际运行确定性 JD 解析与引用校验，不直接把 Gold 标签当作模型输出。`eval:readiness` 使用 60 组完全合成的岗位、层级和证据状态组合，校验覆盖、可信度、补证必要性、不适用维度和准备度计算。

Real-provider evaluation is deliberately manual. Start the app with a configured provider, acknowledge cost and third-party data transfer, then run:

```powershell
$env:CONFIRM_REAL_AI_EVAL="yes"
npm run eval:ai
```

Generated runs are stored under `evals/results/` and ignored by Git. Promote only reviewed aggregate metrics to `baseline.json`; never commit raw model responses.
