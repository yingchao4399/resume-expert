import { NextResponse } from "next/server";
import { z } from "zod";
import { getAIConfig, type AIConfig } from "@/lib/ai/config";
import { testAIConnection } from "@/lib/ai/connection-test";
import {
  normalizeAPIKey,
  readUserConfig,
  validateAIConfigFields,
} from "@/lib/ai/user-config";

const requestSchema = z.object({
  provider: z.string().trim().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().trim().min(1),
  model: z.string().trim().min(1),
  useMock: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "连接测试参数无效" },
        { status: 400 }
      );
    }
    const existing = readUserConfig();
    const currentConfig = getAIConfig();
    const apiKey = normalizeAPIKey(
      parsed.data.apiKey && parsed.data.apiKey !== "__unchanged__"
        ? parsed.data.apiKey
        : existing?.apiKey || currentConfig.apiKey
    );
    const validationError = validateAIConfigFields({ ...parsed.data, apiKey });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    const config: AIConfig = {
      mode: "llm",
      apiKey,
      baseUrl: parsed.data.baseUrl.replace(/\/$/, ""),
      model: parsed.data.model,
      provider: parsed.data.provider,
      invalidApiKey: false,
    };
    const result = await testAIConnection(config);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "连接测试失败" },
      { status: 400 }
    );
  }
}
