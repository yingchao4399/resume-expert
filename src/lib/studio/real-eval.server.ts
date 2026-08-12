import "server-only";

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

interface RealEvalRun {
  mode?: string;
  createdAt?: string;
  caseCount?: number;
  metrics?: {
    schemaValidityRate?: number;
    unsupportedClaimRate?: number;
    finalResumeFactAccuracy?: number;
    jdRequirementRecall?: number;
    failureTypes?: Record<string, number>;
  };
}

export async function getLatestSuccessfulRealEval() {
  try {
    const directory = join(process.cwd(), "evals", "results");
    const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
    const runs = await Promise.all(files.map(async (file) => JSON.parse(await readFile(join(directory, file), "utf8")) as RealEvalRun));
    const successful = runs.filter(isSuccessful).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    const run = successful[0];
    return run ? { available: true, evaluatedAt: run.createdAt!, caseCount: run.caseCount ?? 0, metrics: run.metrics } : { available: false, evaluatedAt: null, reason: "没有找到达标的本机真实模型评测" };
  } catch {
    return { available: false, evaluatedAt: null, reason: "无法读取本机真实评测结果" };
  }
}

function isSuccessful(run: RealEvalRun): boolean {
  if (run.mode !== "ai" || !run.createdAt || !run.metrics) return false;
  const failures = Object.values(run.metrics.failureTypes ?? {}).reduce((sum, value) => sum + value, 0);
  return (run.caseCount ?? 0) >= 20 && (run.metrics.schemaValidityRate ?? 0) >= 0.95 && (run.metrics.unsupportedClaimRate ?? 1) <= 0.05 && (run.metrics.finalResumeFactAccuracy ?? 0) >= 0.95 && (run.metrics.jdRequirementRecall ?? 0) >= 0.9 && failures === 0;
}
