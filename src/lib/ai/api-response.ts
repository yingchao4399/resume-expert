import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";
import { LLMError } from "@/lib/ai/errors";
import type { PromptRuntimeSnapshot } from "@/lib/studio/prompt-types";

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
    return NextResponse.json(
      withStudioSnapshots({ error: error.issues[0]?.message || "请求参数不合法" }, promptSnapshots),
      { status: 400 }
    );
  }

  if (error instanceof LLMError) {
    return NextResponse.json(
      withStudioSnapshots({ error: error.message, category: error.category }, promptSnapshots),
      { status: error.status && error.status >= 400 && error.status <= 599 ? error.status : 500 }
    );
  }

  return NextResponse.json(
    withStudioSnapshots({
      error: error instanceof Error ? error.message : fallbackMessage,
    }, promptSnapshots),
    { status: 500 }
  );
}

function withStudioSnapshots(body: Record<string, unknown>, promptSnapshots: PromptRuntimeSnapshot[]) {
  return promptSnapshots.length ? { ...body, __studio: { promptSnapshots } } : body;
}
