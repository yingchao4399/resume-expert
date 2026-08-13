import { z, type ZodType } from "zod";
import { getAIConfig, type AIConfig } from "@/lib/ai/config";
import { classifyAIHTTPError, LLMError, LLMStructureError, LLMTruncationError, type AnalysisStage } from "@/lib/ai/errors";
import { parseJSONFromMessage } from "@/lib/ai/parse-json";
import { getProviderPreset, getStructuredOutputStrategy, type StructuredOutputStrategy } from "@/lib/ai/presets";

export { LLMError, LLMStructureError, LLMTruncationError } from "@/lib/ai/errors";

export interface ChatCompletionOptions<T> {
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
}

interface ChatMessage { content?: string | null; reasoning_content?: string | null }
interface ChatCompletionData { choices?: Array<{ finish_reason?: string; message?: ChatMessage }> }

export const FORMAL_AI_TIMEOUT_MS = 120_000;

export async function chatCompletionJSON<T>(options: ChatCompletionOptions<T>): Promise<T> {
  try {
    return await requestChatCompletionJSON(options);
  } catch (error) {
    if (error instanceof LLMError) throw error;
    throw new LLMError(error instanceof Error ? error.message : "大模型请求异常");
  }
}

async function requestChatCompletionJSON<T>(options: ChatCompletionOptions<T>): Promise<T> {
  const config = options.configOverride ?? getAIConfig();
  if (!config.apiKey) throw new LLMError("未配置 LLM_API_KEY");
  const model = options.model || config.model;
  const data = await callChatCompletions(config, options);
  const choice = data.choices?.[0];
  const contents = extractMessageContents(choice?.message);
  const raw = contents.join("\n\n");

  try {
    return parseAndValidate(contents, options.schema);
  } catch (firstError) {
    if (choice?.finish_reason === "length") throw new LLMTruncationError(options.analysisStage ?? "简历优化");
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
      user: `校验错误：${formatValidationIssue(firstError).join("；")}\n待修复内容：\n${raw.slice(0, 14000)}`,
    });
    const fixedContents = extractMessageContents(fixed.choices?.[0]?.message);
    try {
      return parseAndValidate(fixedContents, options.schema);
    } catch (secondError) {
      if (fixed.choices?.[0]?.finish_reason === "length") throw new LLMTruncationError(options.analysisStage ?? "简历优化");
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

async function callChatCompletions<T>(config: AIConfig, options: ChatCompletionOptions<T>): Promise<ChatCompletionData> {
  try {
    return await performChatCompletion(config, options, false);
  } catch (error) {
    if (config.provider === "custom" && error instanceof LLMError && /response[_ ]format|json[_ ]object|unsupported|not support/i.test(error.message)) {
      return performChatCompletion(config, options, true);
    }
    throw error;
  }
}

async function performChatCompletion<T>(config: AIConfig, options: ChatCompletionOptions<T>, omitResponseFormat: boolean): Promise<ChatCompletionData> {
  const response = await fetchAIResponse(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify(buildCompletionRequestBody(config, options, omitResponseFormat)),
  }, options.timeoutMs ?? FORMAL_AI_TIMEOUT_MS);

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const classified = classifyAIHTTPError(response.status, detail);
    throw new LLMError(`${classified.message} (${response.status})${detail ? `：${detail.slice(0, 180)}` : ""}`, response.status, classified.category);
  }
  return (await response.json()) as ChatCompletionData;
}

export async function fetchAIResponse(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || controller.signal.aborted)) {
      throw new LLMError(`模型请求超时（${Math.round(timeoutMs / 1000)} 秒）`, 504, "timeout");
    }
    throw new LLMError("无法连接模型服务，请检查网络和 Base URL", 503, "network");
  } finally {
    clearTimeout(timeout);
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
