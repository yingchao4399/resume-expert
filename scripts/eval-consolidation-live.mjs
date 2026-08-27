// Manual-only synthetic semantic evaluation. Reads no credentials or user data.
import { readFile, mkdir, writeFile } from "node:fs/promises";
const cases = JSON.parse(await readFile(new URL("../evals/consolidation-cases.json", import.meta.url), "utf8"));
const baseURL = process.env.RESUME_EXPERT_URL || "http://127.0.0.1:3000";
const limitArg = process.argv.find(arg => arg.startsWith("--limit="));
const selected = cases.slice(0, limitArg ? Number(limitArg.split("=")[1]) : cases.length);
const results = [];
for (const sample of selected) {
  let offset = 0;
  const spans = sample.texts.map((text, index) => { const startOffset = offset; offset += text.length + 1; return { id: `source-${index}`, text, sectionId: null, startOffset, endOffset: startOffset + text.length, listLevel: 0, role: "requirement" }; });
  const document = { schemaVersion: 2, sourceText: sample.texts.join("\n"), materialRevision: 1, revision: 1, status: "draft", confirmedRevision: null,
    sourceSpans: spans, requirements: spans.map((span, index) => ({ id: `req-${index}`, sourceSpanId: span.id, sourceSpanIds: [span.id], sourceQuote: span.text, normalizedText: span.text, kind: sample.kind,
      modality: /不要求|无需/.test(span.text) ? "negated" : /优先/.test(span.text) ? "preferred" : "required", priority: "high", priorityBasis: ["合成原文"], anchorStatus: "validated", reviewStatus: "needs-review", isHardGate: false, userEdited: false,
      proficiencySignal: /主导/.test(span.text) ? "lead" : /^了解.+方法$/.test(span.text) ? "awareness" : "unknown" })),
    hypotheses: [], qualityFindings: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const started = Date.now();
  try {
    const response = await fetch(`${baseURL}/api/analyze/consolidate/stream`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jdAnalysisDocument: document }), signal: AbortSignal.timeout(365000) });
    const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
    const last = events.at(-1);
    if (!response.ok || last?.type !== "completed") throw new Error(last?.error || "No completed event");
    const proposal = last.proposal;
    if (proposal.mode !== "llm") throw new Error("当前为 Mock，不能当作真实语义评测。请自行配置模型后重试。");
    const pass = (proposal.merges.length > 0) === sample.semanticMerge;
    const result = { id: sample.id, mode: proposal.mode, passed: pass, merges: proposal.merges.length, warnings: proposal.warnings.length, latencyMs: Date.now() - started };
    results.push(result); console.log(JSON.stringify(result));
  } catch (error) { results.push({ id: sample.id, passed: false, error: error.message, latencyMs: Date.now() - started }); console.log(`${sample.id}: evaluation failed`); }
}
await mkdir(new URL("../evals/results/", import.meta.url), { recursive: true });
await writeFile(new URL("../evals/results/consolidation-live.json", import.meta.url), JSON.stringify({ evaluatedAt: new Date().toISOString(), results }, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
