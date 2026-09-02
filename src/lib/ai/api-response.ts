import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";
import { LLMError } from "@/lib/ai/errors";
import type { PromptRuntimeSnapshot } from "@/lib/studio/prompt-types";
import { createAppErrorPayload, type AppErrorCategory } from "@/lib/errors/app-error";

export async function parseAPIRequest<T>(
  request: Request,
  schema: ZodType<T>
): Promise<T> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new z.ZodError([
      {
        code: "custom",
        path: [],
        message: "请求体必须是合法 JSON",
        input: undefined,
      },
    ]);
  }
  return schema.parse(payload);
}

export function toAPIErrorResponse(
  error: unknown,
  fallbackMessage: string,
  scope: string,
  promptSnapshots: PromptRuntimeSnapshot[] = [],
) {
  console.error(`[${scope}]`, error);

  if (error instanceof z.ZodError) {
    const payload = createAppErrorPayload(error, { code: "INVALID_REQUEST", category: "validation", userMessage: error.issues[0]?.message || "请求参数不合法", retryable: false });
    return NextResponse.json(
      withStudioSnapshots({ error: payload.userMessage, appError: payload }, promptSnapshots),
      { status: 400 }
    );
  }

  if (error instanceof LLMError) {
    const category = (error.category === "rate_limit" ? "rate_limit" : error.category === "authentication" ? "authentication" : error.category === "base_url" ? "base_url" : error.category === "timeout" ? "timeout" : error.category === "cancelled" ? "cancelled" : error.category === "model" ? "model" : "network") satisfies AppErrorCategory;
    const payload = createAppErrorPayload(error, { code: `AI_${category.toUpperCase()}`, category, userMessage: error.message, retryable: !["authentication", "cancelled"].includes(category) });
    return NextResponse.json(
      withStudioSnapshots({ error: payload.userMessage, category: error.category, appError: payload }, promptSnapshots),
      { status: error.status && error.status >= 400 && error.status <= 599 ? error.status : 500 }
    );
  }

  const payload = createAppErrorPayload(error, { code: "UNEXPECTED_ERROR", category: "unexpected", userMessage: error instanceof Error ? error.message : fallbackMessage, retryable: true });
  return NextResponse.json(
    withStudioSnapshots({
      error: payload.userMessage,
      appError: payload,
    }, promptSnapshots),
    { status: 500 }
  );
}

function withStudioSnapshots(body: Record<string, unknown>, promptSnapshots: PromptRuntimeSnapshot[]) {
  return promptSnapshots.length ? { ...body, __studio: { promptSnapshots } } : body;
}
