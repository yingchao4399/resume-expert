import { parseAPIRequest, toAPIErrorResponse } from "@/lib/ai/api-response";
import { structureResumeRequestSchema } from "@/lib/ai/schemas";
import { structureImportedResumeServer } from "@/services/ai/importResume.server";
import { tracedAIResponse } from "@/lib/studio/response";
import { readWorkflowExecution } from "@/lib/studio/execution";

export async function POST(request: Request) {
  const execution = readWorkflowExecution(request);
  try {
    const { text } = await parseAPIRequest(request, structureResumeRequestSchema);
    const result = await structureImportedResumeServer(text, execution);
    return tracedAIResponse(result, result.mode, execution.capture?.snapshots);
  } catch (error) {
    return toAPIErrorResponse(error, "简历结构化失败，请检查提取文本后重试", "import-structure", execution.capture?.snapshots);
  }
}
