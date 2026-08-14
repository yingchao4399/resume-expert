import { createHash } from "node:crypto";
import { PROMPT_REGISTRY } from "@/lib/studio/prompt-registry";
import { PROMPT_BASELINE } from "@/config/prompt-baseline";

export const runtime = "nodejs";

export async function GET() {
  const manifest = JSON.stringify(PROMPT_REGISTRY);
  return Response.json({
    definitions: PROMPT_REGISTRY,
    manifestHash: createHash("sha256").update(manifest).digest("hex"),
    baseline: PROMPT_BASELINE,
    generatedAt: new Date().toISOString(),
  });
}
