import { NextResponse } from "next/server";
import { projectEvidenceRequestSchema } from "@/lib/flowise/schemas";
import { runProjectEvidence } from "@/lib/flowise/client.server";

export async function POST(request: Request) {
  try {
    const parsed = projectEvidenceRequestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "参数无效" }, { status: 400 });
    const result = await runProjectEvidence(parsed.data.provider, parsed.data.input, parsed.data.allowFallback);
    const response = NextResponse.json(result);
    response.headers.set("X-AI-Mode", result.actualProvider === "flowise" ? "flowise" : result.actualProvider === "direct" ? "llm" : "mock");
    response.headers.set("X-AI-Provider", result.actualProvider);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "项目证据梳理失败" }, { status: 502 });
  }
}
