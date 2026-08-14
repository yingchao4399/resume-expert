import { NextResponse } from "next/server";
import { getAIConfig } from "@/lib/ai/config";
import type { AIMode } from "@/lib/ai/types";
import type { PromptRuntimeSnapshot } from "@/lib/studio/prompt-types";

export function tracedAIResponse(body: unknown, mode: AIMode, promptSnapshots: PromptRuntimeSnapshot[] = []) {
  const config = getAIConfig();
  const responseBody = promptSnapshots.length && body && typeof body === "object" && !Array.isArray(body)
    ? { ...(body as Record<string, unknown>), __studio: { promptSnapshots } }
    : body;
  const response = NextResponse.json(responseBody);
  response.headers.set("X-AI-Mode", mode);
  if (mode === "llm") {
    response.headers.set("X-AI-Provider", config.provider);
    response.headers.set("X-AI-Model", config.model);
  }
  return response;
}
