import { createHash, randomUUID } from "node:crypto";
import { z, type ZodType } from "zod";
import { getAIConfig, type AIConfig } from "@/lib/ai/config";
import { classifyAIHTTPError, LLMError, LLMStructureError, LLMTruncationError, type AnalysisStage } from "@/lib/ai/errors";
import { AnalysisCancelledError, AnalysisDeadlineError } from "@/lib/ai/errors";
import type { AnalysisExecutionBudget } from "@/lib/ai/analysis-execution";
import { parseJSONFromMessage } from "@/lib/ai/parse-json";
import { getProviderPreset, getStructuredOutputStrategy, type StructuredOutputStrategy } from "@/lib/ai/presets";
import { getCallablePromptDefinition } from "@/lib/studio/prompt-registry";
import type { PromptAttemptKind, PromptCaptureContext, PromptId, PromptRuntimeSnapshot } from "@/lib/studio/prompt-types";

export { LLMError, LLMStructureError, LLMTruncationError } from "@/lib/ai/errors";

export interface ChatCompletionOptions<T> {
  promptId: PromptId;
  system: string;
  user: string;
  schema: ZodType<T>;
  schemaName: string;
  strictOutput?: boolean;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  timeoutMs?: number;
  configOverride?: AIConfig;
  analysisStage?: AnalysisStage;
  capture?: PromptCaptureContext;
  invocationId?: string;
  signal?: AbortSignal;
  analysisBudget?: AnalysisExecutionBudget;
}

interface ChatMessage { content?: string | null; reasoning_content?: string | null }
interface ChatCompletionData { choices?: Array<{ finish_reason?: string; message?: ChatMessage }> }

export const FORMAL_AI_TIMEOUT_MS = 120_000;

export async function chatCompletionJSON<T>(options: ChatCompletionOptions<T>): Promise<T> {
  try {
    getCallablePromptDefinition(options.promptId);
    return await requestChatCompletionJSON({ ...options, invocationId: options.invocationId ?? randomUUID() });
  } catch (error) {
    if (error instanceof LLMError) throw error;
    throw new LLMError(error instanceof Error ? error.message : "大模型请求异常");
  }
}

async function requestChatCompletionJSON<T>(options: ChatCompletionOptions<T>): Promise<T> {
  const config = options.configOverride ?? getAIConfig();
  if (!config.apiKey) throw new LLMError("未配置 LLM_API_KEY");
  const model = options.model || config.model;
  const data = await callChatCompletions(config, options, "primary");
  const choice = data.choices?.[0];
  const contents = extractMessageContents(choice?.message);
  const raw = contents.join("\n\n");
  if (choice?.finish_reason === "length") {
    markLatestSnapshot(options, "validation-error", ["finish_reason=length：模型输出被截断"]);
    throw new LLMTruncationError(options.analysisStage ?? "简历优化");
  }

  try {
    return parseAndValidate(contents, options.schema);
  } catch (firstError) {
    const validationIssues = formatValidationIssue(firstError);
    markLatestSnapshot(options, "validation-error", validationIssues);
    if (!raw) throw new LLMError("大模型返回内容为空", 502);

    const schemaContract = buildSchemaContract(options.schema);
    const fixed = await callChatCompletions(config, {
      ...options,
      temperature: 0,
      system: [
        "你是严格的 JSON 结构修复器。只输出一个 JSON 对象，不要解释。",
        "只能重排或修复已有内容，禁止补造任何事实、数字、人名、公司或日期。",
        "缺失的集合必须使用空数组；缺失的可空值使用 null；所有必填字段都必须存在。",
        `完整 JSON Schema：${schemaContract}`,
      ].join("\n"),
      user: `校验错误：${validationIssues.join("；")}\n待修复内容：\n${raw.slice(0, 14000)}`,
    }, "schema-repair", validationIssues);
    const fixedContents = extractMessageContents(fixed.choices?.[0]?.message);
    if (fixed.choices?.[0]?.finish_reason === "length") {
      markLatestSnapshot(options, "validation-error", ["finish_reason=length：结构修复输出被截断"]);
      throw new LLMTruncationError(options.analysisStage ?? "简历优化");
    }
    try {
      return parseAndValidate(fixedContents, options.schema);
    } catch (secondError) {
      markLatestSnapshot(options, "validation-error", formatValidationIssue(secondError));
      throw new LLMStructureError(config.provider, model, formatValidationIssue(secondError));
    }
  }
}

function parseAndValidate<T>(contents: string[], schema: ZodType<T>): T {
  const parsed = parseJSONFromMessage<unknown>(contents);
  const result = schema.safeParse(parsed);
  if (!result.success) throw result.error;
  return result.data;
}

export function formatValidationIssue(error: unknown): string[] {
  if (error instanceof z.ZodError) {
    return error.issues.slice(0, 6).map((issue) => `${issue.path.length ? issue.path.join(".") : "root"}: ${issue.message}`);
  }
  return [error instanceof Error ? error.message : "JSON 无法解析"];
}

function buildSchemaContract<T>(schema: ZodType<T>): string {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return JSON.stringify(jsonSchema);
}

function addPromptSchema<T>(strategy: StructuredOutputStrategy, options: ChatCompletionOptions<T>): ChatCompletionOptions<T> {
  if (strategy === "json-schema" && options.strictOutput !== false) return options;
  return {
    ...options,
    system: [
      options.system,
      "只输出一个 JSON 对象，不要 Markdown、代码块或解释。所有必填字段都必须出现；没有内容的集合使用空数组，禁止为了填字段而补造事实。",
      `完整 JSON Schema：${buildSchemaContract(options.schema)}`,
    ].join("\n\n"),
  };
}

export function buildCompletionRequestBody<T>(config: AIConfig, options: ChatCompletionOptions<T>, omitResponseFormat = false): Record<string, unknown> {
  const model = options.model || config.model;
  const strategy = getStructuredOutputStrategy(config.provider);
  const adapted = addPromptSchema(strategy, options);
  const capability = getProviderPreset(config.provider)?.capability;
  const useCompletionTokens = capability?.maxTokenParameter === "max_completion_tokens" ||
    (capability?.maxTokenParameter === "model-dependent" && /^(?:gpt-5|o\d)/i.test(model));
  const omitSampling = capability?.samplingParameters === "model-dependent" && /^(?:gpt-5|o\d)/i.test(model);
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "system", content: adapted.system }, { role: "user", content: adapted.user }],
  };
  if (!omitSampling) body.temperature = options.temperature ?? 0.3;
  body[useCompletionTokens ? "max_completion_tokens" : "max_tokens"] = options.maxTokens ?? 8192;
  if (!omitResponseFormat) body.response_format = buildResponseFormat(strategy, options);
  return body;
}

async function callChatCompletions<T>(
  config: AIConfig,
  options: ChatCompletionOptions<T>,
  attemptKind: PromptAttemptKind,
  validationIssues: string[] = [],
): Promise<ChatCompletionData> {
  try {
    return await performChatCompletion(config, options, false, attemptKind, validationIssues);
  } catch (error) {
    if (config.provider === "custom" && error instanceof LLMError && /response[_ ]format|json[_ ]object|unsupported|not support/i.test(error.message)) {
      return performChatCompletion(config, options, true, "response-format-fallback", validationIssues);
    }
    throw error;
  }
}

async function performChatCompletion<T>(
  config: AIConfig,
  options: ChatCompletionOptions<T>,
  omitResponseFormat: boolean,
  attemptKind: PromptAttemptKind,
  validationIssues: string[],
): Promise<ChatCompletionData> {
  const requestBody = buildCompletionRequestBody(config, options, omitResponseFormat);
  const requestTimeoutMs = options.analysisBudget
    ? options.analysisBudget.claimProviderRequest(options.timeoutMs)
    : options.timeoutMs ?? FORMAL_AI_TIMEOUT_MS;
  const snapshot = capturePromptSnapshot(
    config,
    { ...options, timeoutMs: requestTimeoutMs },
    requestBody,
    attemptKind,
    validationIssues,
  );
  let response: Response;
  try {
    response = await fetchAIResponse(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(requestBody),
    }, requestTimeoutMs, options.signal, options.analysisBudget);
  } catch (error) {
    finishSnapshot(snapshot, error instanceof AnalysisCancelledError ? "cancelled" : "http-error");
    throw error;
  }

  if (!response.ok) {
    finishSnapshot(snapshot, "http-error");
    const detail = await response.text().catch(() => "");
    const classified = classifyAIHTTPError(response.status, detail);
    throw new LLMError(`${classified.message} (${response.status})${detail ? `：${detail.slice(0, 180)}` : ""}`, response.status, classified.category);
  }
  finishSnapshot(snapshot, "success");
  return (await response.json()) as ChatCompletionData;
}

function capturePromptSnapshot<T>(
  config: AIConfig,
  options: ChatCompletionOptions<T>,
  body: Record<string, unknown>,
  attemptKind: PromptAttemptKind,
  validationIssues: string[],
): PromptRuntimeSnapshot | undefined {
  if (!options.capture) return undefined;
  const definition = getCallablePromptDefinition(options.promptId);
  const messages = Array.isArray(body.messages) ? body.messages as Array<{ role?: string; content?: string }> : [];
  const sentSystemPrompt = messages.find((message) => message.role === "system")?.content ?? options.system;
  const sentUserPrompt = messages.find((message) => message.role === "user")?.content ?? options.user;
  const schemaContract = buildSchemaContract(options.schema);
  const invocationId = options.invocationId ?? randomUUID();
  const snapshot: PromptRuntimeSnapshot = {
    schemaVersion: 1,
    id: randomUUID(),
    invocationId,
    traceId: options.capture.traceId,
    promptId: options.promptId,
    promptVersion: definition.version,
    attempt: options.capture.snapshots.filter((item) => item.invocationId === invocationId).length + 1,
    attemptKind,
    status: "prepared",
    createdAt: new Date().toISOString(),
    provider: config.provider,
    model: options.model || config.model,
    structuredOutputStrategy: getStructuredOutputStrategy(config.provider),
    responseFormat: body.response_format ? JSON.stringify(body.response_format) : "none",
    schemaName: options.schemaName,
    schemaContract,
    schemaHash: sha256(schemaContract),
    promptHash: sha256(`${sentSystemPrompt}\n\n${sentUserPrompt}\n\n${schemaContract}`),
    baseSystemPrompt: options.system,
    runtimeUserPrompt: options.user,
    sentSystemPrompt,
    sentUserPrompt,
    temperature: typeof body.temperature === "number" ? body.temperature : undefined,
    maxTokens: Number(body.max_tokens ?? body.max_completion_tokens ?? options.maxTokens ?? 8192),
    timeoutMs: options.timeoutMs ?? FORMAL_AI_TIMEOUT_MS,
    validationIssues: [...validationIssues],
  };
  options.capture.snapshots.push(snapshot);
  return snapshot;
}

function finishSnapshot(snapshot: PromptRuntimeSnapshot | undefined, status: PromptRuntimeSnapshot["status"]): void {
  if (!snapshot) return;
  snapshot.status = status;
  snapshot.finishedAt = new Date().toISOString();
}

function markLatestSnapshot<T>(options: ChatCompletionOptions<T>, status: PromptRuntimeSnapshot["status"], validationIssues: string[]): void {
  const snapshot = [...(options.capture?.snapshots ?? [])].reverse().find((item) => item.invocationId === options.invocationId);
  if (!snapshot) return;
  snapshot.status = status;
  snapshot.finishedAt = new Date().toISOString();
  snapshot.validationIssues = [...validationIssues];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function fetchAIResponse(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
  analysisBudget?: AnalysisExecutionBudget,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  try {
    if (externalSignal?.aborted) throw new AnalysisCancelledError();
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof AnalysisCancelledError || externalSignal?.aborted) {
      throw new AnalysisCancelledError();
    }
    if (error instanceof Error && (error.name === "AbortError" || controller.signal.aborted)) {
      if (analysisBudget?.remainingMs() === 0) throw new AnalysisDeadlineError();
      throw new LLMError(`模型请求超时（${Math.round(timeoutMs / 1000)} 秒）`, 504, "timeout");
    }
    throw new LLMError("无法连接模型服务，请检查网络和 Base URL", 503, "network");
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

function buildResponseFormat<T>(strategy: StructuredOutputStrategy, options: ChatCompletionOptions<T>) {
  if (strategy !== "json-schema" || options.strictOutput === false) return { type: "json_object" };
  const jsonSchema = z.toJSONSchema(options.schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return { type: "json_schema", json_schema: { name: options.schemaName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64), strict: true, schema: jsonSchema } };
}

function extractMessageContents(message?: ChatMessage): string[] {
  const results: string[] = [];
  const content = message?.content?.trim();
  if (content) results.push(content);
  const reasoning = message?.reasoning_content?.trim();
  if (reasoning) {
    const jsonMatch = reasoning.match(/\{[\s\S]*\}/);
    if (jsonMatch?.[0]) results.push(jsonMatch[0]);
  }
  return results;
}
