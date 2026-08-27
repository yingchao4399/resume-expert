import { matchAnalysisRequestSchema } from "@/lib/ai/schemas";
import { parseAPIRequest, toAPIErrorResponse } from "@/lib/ai/api-response";
import { decisionStream } from "@/lib/ai/decision-stream.server";
import { matchConfirmedJDServer } from "@/services/ai/jdDecisionAgent.server";

export async function POST(request: Request) {
  try {
    const payload = await parseAPIRequest(request, matchAnalysisRequestSchema);
    return decisionStream(request, async (execution, progress) => matchConfirmedJDServer(payload.input, payload.jobTargetContext, payload.jdAnalysisDocument, payload.careerClaims, { ...execution, onDecisionProgress: progress }));
  } catch (error) { return toAPIErrorResponse(error, "事实匹配请求无效", "analyze/match/stream"); }
}
