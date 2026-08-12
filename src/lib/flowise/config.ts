import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const flowiseConfigSchema = z.object({
  enabled: z.boolean().default(false),
  baseUrl: z.string().url().default("http://127.0.0.1:3200"),
  flowId: z.string().trim().default(""),
  apiKey: z.string().trim().default(""),
  timeoutMs: z.number().int().min(1_000).max(120_000).default(120_000),
});

export type FlowiseConfig = z.infer<typeof flowiseConfigSchema>;

const DEFAULT_CONFIG: FlowiseConfig = {
  enabled: false,
  baseUrl: "http://127.0.0.1:3200",
  flowId: "",
  apiKey: "",
  timeoutMs: 120_000,
};

export function readFlowiseConfig(): FlowiseConfig {
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), ".flowise-local.json"), "utf8"));
    const parsed = flowiseConfigSchema.parse(raw);
    const url = new URL(parsed.baseUrl);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.port !== "3200") {
      throw new Error("Flowise 仅允许连接 http://127.0.0.1:3200");
    }
    return { ...parsed, baseUrl: parsed.baseUrl.replace(/\/$/, "") };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function getPublicFlowiseConfig(config = readFlowiseConfig()) {
  return {
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    flowConfigured: Boolean(config.flowId && config.apiKey),
    flowId: config.flowId ? `${config.flowId.slice(0, 6)}…` : "",
    securityAuditPassed: false,
    securitySummary: "Flowise 3.1.4 上游生产依赖审计仍有 12 个严重和 72 个高危项，仅限本机隔离实验。",
    startCommand: "pnpm start（127.0.0.1:3200）",
  };
}
