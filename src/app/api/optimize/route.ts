import { NextResponse } from "next/server";
import {
  parseAPIRequest,
  toAPIErrorResponse,
} from "@/lib/ai/api-response";
import { optimizeRequestSchema } from "@/lib/ai/schemas";
import { regenerateOptimizedItemsServer } from "@/services/ai/resumeAgent.server";

export async function POST(request: Request) {
  try {
    const { input, style } = await parseAPIRequest(
      request,
      optimizeRequestSchema
    );
    const { optimizedItems, mode } =
      await regenerateOptimizedItemsServer(input, style);
    return NextResponse.json({ optimizedItems, mode });
  } catch (error) {
    return toAPIErrorResponse(
      error,
      "优化生成失败，请稍后重试",
      "optimize"
    );
  }
}
