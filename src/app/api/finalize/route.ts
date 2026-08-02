import { NextResponse } from "next/server";
import {
  parseAPIRequest,
  toAPIErrorResponse,
} from "@/lib/ai/api-response";
import { finalizeResumeRequestSchema } from "@/lib/ai/schemas";
import { finalizeResumeServer } from "@/services/ai/resumeAgent.server";

export async function POST(request: Request) {
  try {
    const { input, style, optimizedItems, followUpQuestions } =
      await parseAPIRequest(request, finalizeResumeRequestSchema);
    const { finalResume, mode } = await finalizeResumeServer(
      input,
      style,
      optimizedItems,
      followUpQuestions
    );
    return NextResponse.json({ finalResume, mode });
  } catch (error) {
    return toAPIErrorResponse(
      error,
      "最终简历生成失败，请稍后重试",
      "finalize"
    );
  }
}
