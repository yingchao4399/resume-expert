import { NextResponse } from "next/server";
import { z } from "zod";
import { getAIConfig, type AIConfig } from "@/lib/ai/config";
import { listAIModels } from "@/lib/ai/model-catalog";
import { normalizeAPIKey, readUserConfig, validateAIConfigFields } from "@/lib/ai/user-config";

const requestSchema = z.object({
  provider: z.string().trim().min(1), apiKey: z.string().optional(), baseUrl: z.string().trim().min(1),
  model: z.string().trim().min(1), useMock: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "模型清单参数无效" }, { status: 400 });
    const existing = readUserConfig(); const current = getAIConfig();
    const apiKey = normalizeAPIKey(parsed.data.apiKey && parsed.data.apiKey !== "__unchanged__" ? parsed.data.apiKey : existing?.apiKey || current.apiKey);
    const validationError = validateAIConfigFields({ ...parsed.data, apiKey });
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    const config: AIConfig = { mode: "llm", apiKey, baseUrl: parsed.data.baseUrl.replace(/\/$/, ""), model: parsed.data.model, provider: parsed.data.provider, invalidApiKey: false };
    return NextResponse.json(await listAIModels(config));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "刷新模型清单失败" }, { status: 400 });
  }
}
