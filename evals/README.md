# AI evaluation baseline

This directory contains synthetic resume cases only. It must never contain user resumes, API keys, or local model output.

```bash
npm run eval:validate
npm run eval:mock
npm run eval:report
```

Real-provider evaluation is deliberately manual. Start the app with a configured provider, acknowledge cost and third-party data transfer, then run:

```powershell
$env:CONFIRM_REAL_AI_EVAL="yes"
npm run eval:ai
```

Generated runs are stored under `evals/results/` and ignored by Git. Promote only reviewed aggregate metrics to `baseline.json`; never commit raw model responses.
