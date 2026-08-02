import { NextResponse } from "next/server";
import { getPublicAIConfig } from "@/lib/ai/config";
import {
  getAPIKeyValidationError,
  normalizeAPIKey,
  readUserConfig,
  saveUserConfig,
  type UserAIConfig,
} from "@/lib/ai/user-config";

interface SaveConfigBody {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  useMock?: boolean;
}

export async function GET() {
  return NextResponse.json(getPublicAIConfig());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveConfigBody;
    const existing = readUserConfig();
    const hasNewKey =
      body.apiKey !== undefined &&
      body.apiKey !== "__unchanged__" &&
      body.apiKey !== "";

    let apiKey = hasNewKey
      ? normalizeAPIKey(body.apiKey ?? "")
      : existing?.apiKey || "";

    if (hasNewKey) {
      const keyError = getAPIKeyValidationError(apiKey);
      if (keyError) {
        return NextResponse.json({ error: keyError }, { status: 400 });
      }
    }

    const provider = body.provider ?? existing?.provider ?? "";
    const baseUrl = body.baseUrl ?? existing?.baseUrl ?? "";
    const model = body.model ?? existing?.model ?? "";
    const useMock = body.useMock ?? existing?.useMock ?? false;

    if (!useMock) {
      const keyError = getAPIKeyValidationError(apiKey);
      if (keyError) {
        return NextResponse.json({ error: keyError }, { status: 400 });
      }
    }

    apiKey = normalizeAPIKey(apiKey);
    const newConfig: UserAIConfig = {
      provider,
      apiKey,
      baseUrl,
      model,
      useMock,
    };
    saveUserConfig(newConfig);

    return NextResponse.json({
      ...getPublicAIConfig(),
      saved: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `保存配置失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`,
      },
      { status: 500 }
    );
  }
}
