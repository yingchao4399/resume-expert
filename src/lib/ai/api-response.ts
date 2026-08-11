import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";
import { LLMError } from "@/lib/ai/errors";

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
  scope: string
) {
  console.error(`[${scope}]`, error);

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message || "请求参数不合法" },
      { status: 400 }
    );
  }

  if (error instanceof LLMError) {
    return NextResponse.json(
      { error: error.message, category: error.category },
      { status: error.status && error.status >= 400 && error.status <= 599 ? error.status : 500 }
    );
  }

  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : fallbackMessage,
    },
    { status: 500 }
  );
}
