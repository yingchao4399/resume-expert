import { NextResponse } from "next/server";
import { getAIConfig } from "@/lib/ai/config";
import type { AIMode } from "@/lib/ai/types";

export function tracedAIResponse(body: unknown, mode: AIMode) {
  const config = getAIConfig();
  const response = NextResponse.json(body);
  response.headers.set("X-AI-Mode", mode);
  if (mode === "llm") {
    response.headers.set("X-AI-Provider", config.provider);
    response.headers.set("X-AI-Model", config.model);
  }
  return response;
}
