import { z } from "zod";
import { jdAnalysisDocumentSchema } from "@/lib/jd/schemas";
import { parseAPIRequest, toAPIErrorResponse } from "@/lib/ai/api-response";
import { decisionStream } from "@/lib/ai/decision-stream.server";
import { consolidateJDServer } from "@/services/ai/jdConsolidation.server";

const requestSchema = z.object({ jdAnalysisDocument: jdAnalysisDocumentSchema });
export async function POST(request: Request) {
  try {
    const payload = await parseAPIRequest(request, requestSchema);
    return decisionStream(request, async (execution, progress) => {
      progress({ type: "stage-started", stage: "jd-draft", message: "正在重新整理需求：全局语义归并" });
      const proposal = await consolidateJDServer(payload.jdAnalysisDocument, execution);
      return { proposal, mode: proposal.mode };
    });
  } catch (error) { return toAPIErrorResponse(error, "需求整理请求无效", "analyze/consolidate/stream"); }
}
