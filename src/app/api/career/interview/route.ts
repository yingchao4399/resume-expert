import { NextResponse } from "next/server";
import { careerInterviewRequestSchema } from "@/lib/career/schemas";
import { runCareerInterview } from "@/lib/career/interview.server";
import { getAIConfig } from "@/lib/ai/config";
import { LLMStructureError } from "@/lib/ai/errors";

export async function POST(request: Request) {
  try {
    const parsed = careerInterviewRequestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "参数无效" }, { status: 400 });
    const result = await runCareerInterview(parsed.data);
    const response = NextResponse.json(result);
    const config = getAIConfig();
    response.headers.set("X-AI-Mode", result.mode);
    response.headers.set("X-AI-Provider", result.mode === "mock" ? "mock" : config.provider);
    response.headers.set("X-AI-Model", result.mode === "mock" ? "mock" : config.model);
    return response;
  } catch (error) {
    const config = getAIConfig();
    if (error instanceof LLMStructureError) {
      return NextResponse.json({
        error: `${error.message}。本次未保存会话、事实或指标。请重新尝试，或打开 AI 设置刷新模型、测试连接、手动选择推荐模型或 Mock。`,
        code: "MODEL_STRUCTURE_INVALID", provider: error.provider, model: error.model, invalidFields: error.invalidFields,
      }, { status: 502 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "项目访谈失败", code: "CAREER_INTERVIEW_FAILED", provider: config.provider, model: config.model }, { status: 502 });
  }
}
