import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { aggregateScores, scoreCase, validateCase } from "./scorer.mjs";

const evalDir = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(evalDir, "results");
const baselinePath = path.join(evalDir, "baseline.json");
const cases = JSON.parse(await readFile(path.join(evalDir, "cases.json"), "utf8"));

function mockOutput(testCase) {
  if (testCase.category === "malformed-output") return null;
  const strengths = { ...testCase.expected.evidenceStrength };
  for (const requirement of testCase.expected.supplementRequirements) {
    strengths[requirement] ??= "none";
  }
  return {
    finalResumeText: [testCase.input.originalResume, ...testCase.facts.allowedFacts].join("\n"),
    coveredRequirements: [...testCase.expected.requiredKeywords],
    matchItems: Object.entries(strengths).map(([requirement, evidenceStrength]) => ({
      requirement,
      evidenceStrength,
      needsSupplement: testCase.expected.supplementRequirements.includes(requirement),
    })),
  };
}

async function validate() {
  const ids = new Set();
  const errors = [];
  if (cases.length < 24) errors.push(`案例不足 24 个，当前 ${cases.length} 个`);
  for (const item of cases) {
    for (const error of validateCase(item)) errors.push(`${item.id ?? "unknown"}: ${error}`);
    if (ids.has(item.id)) errors.push(`案例 ID 重复：${item.id}`);
    ids.add(item.id);
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Validated ${cases.length} frozen synthetic evaluation cases.`);
}

async function writeRun(run) {
  await mkdir(resultsDir, { recursive: true });
  const file = path.join(resultsDir, `${run.id}.json`);
  await writeFile(file, JSON.stringify(run, null, 2), "utf8");
  console.log(file);
  return file;
}

async function runMock() {
  await validate();
  const results = cases.map((item) => scoreCase(item, mockOutput(item), 0));
  const run = aggregateScores(results, { mode: "mock", model: "deterministic-fixture" });
  await writeRun(run);
  console.log(JSON.stringify(run.metrics, null, 2));
}

function normalizeAIOutput(value) {
  const result = value?.result ?? value;
  const finalResumeText = JSON.stringify(result?.finalResume ?? result ?? {});
  const coveredRequirements = result?.jdAnalysis?.keywords ?? [];
  const matchItems = (result?.matchItems ?? []).map((item) => ({
    requirement: item.jdRequirement,
    evidenceStrength: item.evidenceStrength,
    needsSupplement: item.needsSupplement,
  }));
  return { finalResumeText, coveredRequirements, matchItems };
}

async function runAI() {
  if (process.env.CONFIRM_REAL_AI_EVAL !== "yes") {
    throw new Error("真实评测会发送合成简历并产生模型费用。确认后设置 CONFIRM_REAL_AI_EVAL=yes。 ");
  }
  const baseUrl = process.env.EVAL_APP_URL ?? "http://127.0.0.1:3000";
  const results = [];
  for (const item of cases.filter((value) => value.category !== "malformed-output")) {
    const startedAt = Date.now();
    try {
      const response = await fetch(`${baseUrl}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { targetRole: item.input.targetRole, industry: "", companyType: "中型公司", jobStage: item.input.jobStage, highlightSkills: "", jobDescription: item.input.jobDescription, originalResume: item.input.originalResume, additionalInfo: "" }, optimizeStyle: "ai-product" }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
      results.push(scoreCase(item, normalizeAIOutput(await response.json()), Date.now() - startedAt));
    } catch (error) {
      const scored = scoreCase(item, null, Date.now() - startedAt);
      scored.failures.push(error instanceof Error ? `request:${error.message}` : "request:unknown");
      results.push(scored);
    }
  }
  const run = aggregateScores(results, { mode: "ai", model: process.env.LLM_MODEL ?? "configured-provider" });
  await writeRun(run);
  console.log(JSON.stringify(run.metrics, null, 2));
}

async function listRuns() {
  await mkdir(resultsDir, { recursive: true });
  const files = (await readdir(resultsDir)).filter((file) => file.endsWith(".json"));
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(resultsDir, file), "utf8"))));
}

async function compare() {
  const runs = (await listRuns()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (runs.length < 2) throw new Error("至少需要两个评测结果才能比较。");
  const [before, after] = runs.slice(-2);
  const delta = {};
  for (const key of Object.keys(after.metrics)) {
    if (typeof after.metrics[key] === "number") delta[key] = Number((after.metrics[key] - before.metrics[key]).toFixed(4));
  }
  console.log(JSON.stringify({ before: before.id, after: after.id, delta }, null, 2));
}

async function report() {
  const runs = (await listRuns()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const run = runs[0] ?? JSON.parse(await readFile(baselinePath, "utf8"));
  const rows = Object.entries(run.metrics).filter(([, value]) => typeof value === "number").map(([key, value]) => `<tr><th>${key}</th><td>${value}</td></tr>`).join("");
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Resume Expert Eval</title><style>body{font:14px system-ui;max-width:900px;margin:40px auto;color:#171717}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#f5f5f5}</style><h1>简历专家评测报告</h1><p>${run.id} · ${run.createdAt} · ${run.caseCount} cases</p><table>${rows}</table></html>`;
  await mkdir(resultsDir, { recursive: true });
  const file = path.join(resultsDir, "latest.html");
  await writeFile(file, html, "utf8");
  console.log(file);
}

const command = process.argv[2];
const commands = { validate, mock: runMock, ai: runAI, compare, report };
if (!commands[command]) throw new Error(`未知命令：${command ?? "(empty)"}`);
await commands[command]();
