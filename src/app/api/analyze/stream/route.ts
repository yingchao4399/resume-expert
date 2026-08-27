import { analyzeRequestSchema } from "@/lib/ai/schemas";
import { parseAPIRequest, toAPIErrorResponse } from "@/lib/ai/api-response";
import { decisionStream } from "@/lib/ai/decision-stream.server";
import { analyzeJDDecisionMapServer } from "@/services/ai/jdDecisionAgent.server";

export async function POST(request: Request) {
  try {
    const payload = await parseAPIRequest(request, analyzeRequestSchema);
    return decisionStream(request, async (execution, progress) => analyzeJDDecisionMapServer(payload.input, payload.jobTargetContext, payload.materialRevision, { ...execution, onDecisionProgress: progress }));
  } catch (error) { return toAPIErrorResponse(error, "JD 解析请求无效", "analyze/stream"); }
}
