import "server-only";

import { chatCompletionJSON } from "@/lib/ai/client";
import { LLMError } from "@/lib/ai/errors";
import { readFlowiseConfig } from "@/lib/flowise/config";
import { classifyFlowiseStatus, parseFlowisePrediction, withMockFallback, type FlowiseFailureCategory } from "@/lib/flowise/response";
import {
  projectEvidenceDraftSchema,
  type ProjectEvidenceDraft,
  type ProjectEvidenceInput,
  type ProjectEvidenceProvider,
  type ProjectEvidenceResult,
} from "@/lib/flowise/schemas";
import type { WorkflowExecutionOptions } from "@/lib/studio/execution";

export class FlowiseError extends Error {
  constructor(message: string, readonly category: FlowiseFailureCategory) {
    super(message);
    this.name = "FlowiseError";
  }
}

export async function probeFlowise() {
  const config = readFlowiseConfig();
  const started = Date.now();
  try {
    const response = await fetchWithTimeout(`${config.baseUrl}/api/v1/version`, { cache: "no-store" }, 5_000);
    const text = await response.text();
    return { online: response.ok, version: response.ok ? extractVersion(text) : undefined, latencyMs: Date.now() - started };
  } catch {
    return { online: false, latencyMs: Date.now() - started };
  }
}

export async function runProjectEvidence(
  provider: ProjectEvidenceProvider,
  input: ProjectEvidenceInput,
  allowFallback = true,
  execution: Pick<WorkflowExecutionOptions, "model" | "timeoutMs" | "capture"> = {},
): Promise<ProjectEvidenceResult> {
  const outcome = await withMockFallback(provider, allowFallback, () => provider === "mock"
    ? Promise.resolve(buildMockDraft(input))
    : provider === "direct" ? runDirect(input, execution) : runFlowise(input), () => buildMockDraft(input));
  return {
    runId: crypto.randomUUID(),
    draft: outcome.value,
    requestedProvider: provider,
    actualProvider: outcome.actual,
    fallbackUsed: outcome.fallbackUsed,
    warning: outcome.fallbackUsed ? `${provider === "flowise" ? "Flowise" : "DirectLLM"} 不可用，已保留输入并生成 Mock 草稿：${outcome.error}` : undefined,
  };
}

async function runDirect(input: ProjectEvidenceInput, execution: Pick<WorkflowExecutionOptions, "model" | "timeoutMs" | "capture">): Promise<ProjectEvidenceDraft> {
  return chatCompletionJSON({
    promptId: "project-evidence.direct",
    schema: projectEvidenceDraftSchema,
    schemaName: "project_evidence_draft",
    strictOutput: true,
    temperature: 0.2,
    system: "你是项目证据梳理助手。只整理用户明确提供的事实，不创造数据、用户、收益或技术结论。证据不足时写入 missingEvidence 和 questions。",
    user: JSON.stringify(input),
    ...execution,
  });
}

async function runFlowise(input: ProjectEvidenceInput): Promise<ProjectEvidenceDraft> {
  const config = readFlowiseConfig();
  if (!config.enabled || !config.flowId || !config.apiKey) {
    throw new FlowiseError("本机 Flowise 尚未启用或流程/API Key 未配置", "configuration");
  }
  let response: Response;
  try {
    response = await fetchWithTimeout(`${config.baseUrl}/api/v1/prediction/${encodeURIComponent(config.flowId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ question: JSON.stringify(input), overrideConfig: { sessionId: crypto.randomUUID() } }),
    }, config.timeoutMs);
  } catch (error) {
    if (error instanceof FlowiseError) throw error;
    throw new FlowiseError("Flowise 离线或网络连接失败", "offline");
  }
  if (!response.ok) {
    const category = classifyFlowiseStatus(response.status);
    throw new FlowiseError(category === "authentication" ? "Flowise 流程 API Key 无效" : `Flowise 请求失败 (${response.status})`, category);
  }
  const body = await response.json() as Record<string, unknown>;
  try {
    return parseFlowisePrediction(body);
  } catch {
    throw new FlowiseError("Flowise 输出不符合 ProjectEvidenceDraft Schema", "schema");
  }
}

function buildMockDraft(input: ProjectEvidenceInput): ProjectEvidenceDraft {
  const lines = input.currentDemo.split(/[。！？\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 5);
  return projectEvidenceDraftSchema.parse({
    targetRole: input.targetRole,
    projectTitle: input.projectTitle,
    maturity: /上线|用户|使用|验证/.test(input.currentDemo) ? "validated" : /完成|实现|开发|demo/i.test(input.currentDemo) ? "demo" : "idea",
    factDrafts: lines.length ? lines : [input.currentDemo],
    missingEvidence: ["项目使用者或验收方式", "可复核的规模、效率或质量指标"],
    improvementTasks: ["补充实现范围与个人职责", "记录测试结果和可复核截图", "为关键结论标注数据来源"],
    interviewNarrative: `我围绕${input.targetRole}方向梳理了“${input.projectTitle}”，当前先以已完成事实为准，并持续补齐验证数据。`,
    questions: ["哪些功能由你独立完成？", "目前有哪些可以出示的测试或使用证据？"],
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new FlowiseError("Flowise 请求超时", "timeout");
    if (error instanceof LLMError) throw error;
    throw new FlowiseError("Flowise 离线或网络连接失败", "offline");
  } finally {
    clearTimeout(timer);
  }
}

function extractVersion(text: string): string | undefined {
  try {
    const value = JSON.parse(text) as string | { version?: string };
    return typeof value === "string" ? value : value.version;
  } catch {
    return text.match(/\d+\.\d+\.\d+/)?.[0];
  }
}
