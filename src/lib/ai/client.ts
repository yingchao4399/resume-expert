import { z, type ZodType } from "zod";
import { getAIConfig } from "@/lib/ai/config";
import { LLMError } from "@/lib/ai/errors";
import { parseJSONFromMessage } from "@/lib/ai/parse-json";

export { LLMError } from "@/lib/ai/errors";

interface ChatCompletionOptions<T> {
  system: string;
  user: string;
  schema: ZodType<T>;
  schemaName: string;
  strictOutput?: boolean;
  temperature?: number;
  maxTokens?: number;
}

interface ChatMessage {
  content?: string | null;
  reasoning_content?: string | null;
}

interface ChatCompletionData {
  choices?: Array<{
    finish_reason?: string;
    message?: ChatMessage;
  }>;
}

export async function chatCompletionJSON<T>(
  options: ChatCompletionOptions<T>
): Promise<T> {
  try {
    return await requestChatCompletionJSON(options);
  } catch (error) {
    if (error instanceof LLMError) throw error;
    throw new LLMError(
      error instanceof Error ? error.message : "大模型请求异常"
    );
  }
}

async function requestChatCompletionJSON<T>(
  options: ChatCompletionOptions<T>
): Promise<T> {
  const config = getAIConfig();
  if (!config.apiKey) throw new LLMError("未配置 LLM_API_KEY");

  const data = await callChatCompletions(config, options);
  const choice = data.choices?.[0];
  const contents = extractMessageContents(choice?.message);
  const raw = contents.join("\n\n");

  try {
    return parseAndValidate(contents, options.schema);
  } catch (firstError) {
    if (choice?.finish_reason === "length") {
      throw new LLMError(
        "大模型输出被截断，请缩短 JD/简历内容后重试",
        502
      );
    }
    if (!raw) {
      throw new LLMError("大模型返回内容为空", 502);
    }

    const issue = formatValidationIssue(firstError);
    const fixed = await callChatCompletions(config, {
      ...options,
      temperature: 0,
      system:
        "你是 JSON 修复器。根据结构错误修复输入，只输出符合要求的 JSON，不要解释。",
      user: [
        `结构错误：${issue}`,
        "待修复内容：",
        raw.slice(0, 14000),
      ].join("\n"),
    });
    const fixedContents = extractMessageContents(
      fixed.choices?.[0]?.message
    );

    try {
      return parseAndValidate(fixedContents, options.schema);
    } catch (secondError) {
      throw new LLMError(
        `大模型返回结构不符合要求：${formatValidationIssue(secondError)}`,
        502
      );
    }
  }
}

function parseAndValidate<T>(
  contents: string[],
  schema: ZodType<T>
): T {
  const parsed = parseJSONFromMessage<unknown>(contents);
  const result = schema.safeParse(parsed);
  if (!result.success) throw result.error;
  return result.data;
}

function formatValidationIssue(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .slice(0, 6)
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "root";
        return `${path}: ${issue.message}`;
      })
      .join("；");
  }
  return error instanceof Error ? error.message : "JSON 无法解析";
}

async function callChatCompletions<T>(
  config: ReturnType<typeof getAIConfig>,
  options: ChatCompletionOptions<T>
): Promise<ChatCompletionData> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 8192,
      response_format: buildResponseFormat(config.provider, options),
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new LLMError(
      detail
        ? `大模型请求失败 (${response.status}): ${detail.slice(0, 300)}`
        : `大模型请求失败 (${response.status})`,
      response.status
    );
  }

  return (await response.json()) as ChatCompletionData;
}

function buildResponseFormat<T>(
  provider: string,
  options: ChatCompletionOptions<T>
) {
  if (provider !== "openai" || options.strictOutput === false) {
    return { type: "json_object" };
  }

  const jsonSchema = z.toJSONSchema(options.schema) as Record<string, unknown>;
  delete jsonSchema.$schema;

  return {
    type: "json_schema",
    json_schema: {
      name: options.schemaName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64),
      strict: true,
      schema: jsonSchema,
    },
  };
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
