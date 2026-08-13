import type { AIConfig } from "@/lib/ai/config";
import type { AIModelCatalogEntry, AIModelCatalogResult } from "@/lib/ai/types";
import { fetchAIResponse } from "@/lib/ai/client";
import { getProviderPreset } from "@/lib/ai/presets";

const NON_TEXT_MODEL = /(?:^|[-_.])(embedding|embed|audio|realtime|moderation|tts|whisper|transcribe|image|imagen|veo)(?:$|[-_.])/i;

export function filterTextModelIds(values: unknown[]): string[] {
  const ids = values.flatMap((value) => {
    if (typeof value === "string") return [value];
    if (value && typeof value === "object") {
      const item = value as { id?: unknown; name?: unknown };
      const id = typeof item.id === "string" ? item.id : typeof item.name === "string" ? item.name.replace(/^models\//, "") : "";
      return id ? [id] : [];
    }
    return [];
  });
  return [...new Set(ids.map((id) => id.trim()).filter((id) => id && !NON_TEXT_MODEL.test(id)))].sort();
}

export async function listAIModels(config: AIConfig): Promise<AIModelCatalogResult> {
  const preset = getProviderPreset(config.provider);
  const official = preset?.models ?? [];
  const refreshedAt = new Date().toISOString();
  try {
    const response = await fetchAIResponse(`${config.baseUrl.replace(/\/$/, "")}/models`, {
      method: "GET", headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" },
    }, 15_000);
    if (!response.ok) {
      return buildResult(config.provider, official, [], refreshedAt, `账号模型清单刷新失败（HTTP ${response.status}）；请检查 Key、Base URL 和账号权限。`);
    }
    const payload = await response.json() as { data?: unknown[]; models?: unknown[] };
    const account = filterTextModelIds(Array.isArray(payload.data) ? payload.data : Array.isArray(payload.models) ? payload.models : []);
    return buildResult(config.provider, official, account, refreshedAt, account.length ? undefined : "接口返回了空清单；仍可使用官方预设或手动模型 ID。" );
  } catch (error) {
    return buildResult(config.provider, official, [], refreshedAt, error instanceof Error ? `模型清单刷新失败：${error.message}` : "模型清单刷新失败");
  }
}

function buildResult(provider: string, official: string[], account: string[], refreshedAt: string, warning?: string): AIModelCatalogResult {
  const entries = new Map<string, AIModelCatalogEntry>();
  official.forEach((id) => entries.set(id, { id, source: "official" }));
  account.forEach((id) => entries.set(id, { id, source: "account" }));
  return { provider, models: [...entries.values()], refreshedAt, warning };
}
