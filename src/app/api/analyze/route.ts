import { NextResponse } from "next/server";
import {
  parseAPIRequest,
  toAPIErrorResponse,
} from "@/lib/ai/api-response";
import { analyzeRequestSchema } from "@/lib/ai/schemas";
import { analyzeResumeServer } from "@/services/ai/resumeAgent.server";

export async function POST(request: Request) {
  try {
    const { input, optimizeStyle } = await parseAPIRequest(
      request,
      analyzeRequestSchema
    );
    const { result, mode } = await analyzeResumeServer(input, optimizeStyle);
    return NextResponse.json({ result, mode });
  } catch (error) {
    return toAPIErrorResponse(error, "分析失败，请稍后重试", "analyze");
  }
}
