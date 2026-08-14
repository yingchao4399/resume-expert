import { NextResponse } from "next/server";
import { projectEvidenceRequestSchema } from "@/lib/flowise/schemas";
import { runProjectEvidence } from "@/lib/flowise/client.server";
import { readWorkflowExecution } from "@/lib/studio/execution";
import type { PromptRuntimeSnapshot } from "@/lib/studio/prompt-types";

export async function POST(request: Request) {
  const execution = readWorkflowExecution(request);
  try {
    const parsed = projectEvidenceRequestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "参数无效" }, { status: 400 });
    const result = await runProjectEvidence(parsed.data.provider, parsed.data.input, parsed.data.allowFallback, execution);
    const response = NextResponse.json(withStudioSnapshots(result, execution.capture?.snapshots));
    response.headers.set("X-AI-Mode", result.actualProvider === "flowise" ? "flowise" : result.actualProvider === "direct" ? "llm" : "mock");
    response.headers.set("X-AI-Provider", result.actualProvider);
    return response;
  } catch (error) {
    return NextResponse.json(withStudioSnapshots({ error: error instanceof Error ? error.message : "项目证据梳理失败" }, execution.capture?.snapshots), { status: 502 });
  }
}

function withStudioSnapshots<T extends object>(body: T, snapshots: PromptRuntimeSnapshot[] = []) {
  return snapshots.length ? { ...body, __studio: { promptSnapshots: snapshots } } : body;
}
