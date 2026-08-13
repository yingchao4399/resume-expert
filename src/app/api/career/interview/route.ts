import { NextResponse } from "next/server";
import { careerInterviewRequestSchema } from "@/lib/career/schemas";
import { runCareerInterview } from "@/lib/career/interview.server";

export async function POST(request: Request) {
  try {
    const parsed = careerInterviewRequestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "参数无效" }, { status: 400 });
    const result = await runCareerInterview(parsed.data);
    const response = NextResponse.json(result);
    response.headers.set("X-AI-Mode", result.mode);
    response.headers.set("X-AI-Provider", result.mode === "mock" ? "mock" : "configured-provider");
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "项目访谈失败" }, { status: 502 });
  }
}
