import type {
  AnalyzeResponseBody,
  AIConnectionTestRequest,
  AIConnectionTestResult,
  FinalizeResumeResponseBody,
  FollowUpBulletResponseBody,
  InterviewAnalyzeRequestBody,
  InterviewAnalyzeResponseBody,
  OptimizeResponseBody,
  PublicAIConfig,
  SaveAIConfigBody,
} from "@/lib/ai/types";
import type { AnalysisResult, OptimizeStyle, UserInput } from "@/types/resume";
import type { InterviewAnalysisResult } from "@/types/interview";
import { saveTraceSpan } from "@/lib/studio/trace-store";
import type { WorkflowNodeId } from "@/lib/studio/trace-types";
import { getPublishedWorkflowNode } from "@/lib/studio/workflow-store";

export { STYLE_LABELS } from "@/lib/ai/types";

class ResumeAgentClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeAgentClientError";
  }
}

export async function postWorkflowJSON<T>(url: string, body: unknown): Promise<T> {
  const startedAt = new Date();
  const traceId = crypto.randomUUID();
  const publishedNode = await getPublishedWorkflowNode(workflowDefinitionNodeId(nodeIdForURL(url))).catch(() => null);
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Workflow-Trace-Id": traceId };
  if (publishedNode?.provider === "mock") headers["X-Workflow-Provider"] = "mock";
  if (publishedNode?.provider === "direct" && publishedNode.model && publishedNode.model !== "configured-model") headers["X-Workflow-Model"] = publishedNode.model;
  if (publishedNode?.provider === "direct" && publishedNode.timeoutMs) headers["X-Workflow-Timeout"] = String(publishedNode.timeoutMs);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  const finishedAt = new Date();
  const nodeId = nodeIdForURL(url);
  const status = response.ok ? "success" : "error";
  void saveTraceSpan({ id: traceId, nodeId, label: labelForNode(nodeId), status, mode: (response.headers.get("X-AI-Mode") as "mock" | "llm" | "flowise" | null) ?? undefined, provider: response.headers.get("X-AI-Provider") ?? undefined, model: response.headers.get("X-AI-Model") ?? undefined, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), latencyMs: finishedAt.getTime() - startedAt.getTime(), input: body, output: response.ok ? data : undefined, error: response.ok ? undefined : data.error || `HTTP ${response.status}` }).catch(() => undefined);
  if (!response.ok) throw new ResumeAgentClientError(data.error || `请求失败 (${response.status})`);

  return data;
}

function workflowDefinitionNodeId(nodeId: WorkflowNodeId): string {
  if (nodeId === "analyze") return "analysis";
  if (nodeId === "interview-review") return "interview-prep";
  if (nodeId === "optimize" || nodeId === "follow-up" || nodeId === "finalize") return "optimize";
  return nodeId;
}

function nodeIdForURL(url: string): WorkflowNodeId {
  if (url.includes("career/interview")) return "career-interview";
  if (url.includes("project-evidence")) return "project-evidence";
  if (url.includes("follow-up")) return "follow-up";
  if (url.includes("finalize")) return "finalize";
  if (url.includes("optimize")) return "optimize";
  if (url.includes("import")) return "import-structure";
  if (url.includes("interview")) return "interview-review";
  return "analyze";
}

function labelForNode(nodeId: WorkflowNodeId): string {
  return ({ analyze: "岗位分析", optimize: "AI 优化", "follow-up": "经历补证", finalize: "最终生成", "import-structure": "简历结构化", "interview-review": "面试复盘", "project-evidence": "项目证据", "career-interview": "项目经历访谈" } as const)[nodeId];
}

export async function fetchAIStatus() {
  const response = await fetch("/api/ai/status", { cache: "no-store" });
  if (!response.ok) {
    return { mode: "mock" as const };
  }
  return response.json() as Promise<{
    mode: "mock" | "llm";
    model?: string;
    provider?: string;
    reason?: "missing_api_key" | "invalid_api_key" | "forced";
  }>;
}

export async function runResumeAnalysis(
  input: UserInput,
  optimizeStyle: OptimizeStyle = "ai-product"
): Promise<AnalysisResult> {
  const data = await postWorkflowJSON<AnalyzeResponseBody>("/api/analyze", { input, optimizeStyle });
  return data.result;
}

export async function structureImportedResume(text: string): Promise<{
  finalResume: AnalysisResult["finalResume"];
  mode: "mock" | "llm";
}> {
  return postWorkflowJSON("/api/import/structure", { text });
}

export async function regenerateOptimizedItems(
  input: UserInput,
  style: OptimizeStyle
): Promise<AnalysisResult["optimizedItems"]> {
  const data = await postWorkflowJSON<OptimizeResponseBody>("/api/optimize", { input, style });
  return data.optimizedItems;
}

export async function generateFollowUpBullet(
  input: UserInput,
  question: string,
  purpose: string,
  userAnswer: string
): Promise<string> {
  const data = await postWorkflowJSON<FollowUpBulletResponseBody>("/api/follow-up/bullet", {
    input,
    question,
    purpose,
    userAnswer,
  });
  return data.bullet;
}

export async function finalizeResume(
  input: UserInput,
  style: OptimizeStyle,
  optimizedItems: AnalysisResult["optimizedItems"],
  followUpQuestions: AnalysisResult["followUpQuestions"]
): Promise<AnalysisResult["finalResume"]> {
  const data = await postWorkflowJSON<FinalizeResumeResponseBody>("/api/finalize", {
    input, style, optimizedItems, followUpQuestions,
  });
  return data.finalResume;
}

// ===== AI 配置管理（运行时切换模型/模式） =====

export async function fetchAIConfig(): Promise<PublicAIConfig> {
  const response = await fetch("/api/ai/config", { cache: "no-store" });
  if (!response.ok) {
    throw new ResumeAgentClientError("获取 AI 配置失败");
  }
  return response.json() as Promise<PublicAIConfig>;
}

export async function saveAIConfig(config: SaveAIConfigBody): Promise<PublicAIConfig> {
  const data = await postWorkflowJSON<PublicAIConfig & { saved?: boolean }>("/api/ai/config", config);
  return data;
}

export async function testAIConfig(config: AIConnectionTestRequest): Promise<AIConnectionTestResult> {
  const response = await fetch("/api/ai/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<AIConnectionTestResult> & { error?: string };
  if (typeof data.ok === "boolean") return data as AIConnectionTestResult;
  throw new ResumeAgentClientError(data.error || `连接测试失败 (${response.status})`);
}

// ===== 面试录音诊断与分析 =====

export async function analyzeInterview(
  body: InterviewAnalyzeRequestBody
): Promise<InterviewAnalysisResult> {
  const data = await postWorkflowJSON<InterviewAnalyzeResponseBody>("/api/interview-recording/analyze", body);
  return data.result;
}

export async function uploadInterviewRecording(file: File): Promise<{ id: string; fileName: string; fileSize: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/interview-recording/upload", {
    method: "POST",
    body: formData,
  });
  const data = (await response.json().catch(() => ({}))) as { id?: string; fileName?: string; fileSize?: number; error?: string };
  if (!response.ok || !data.id) {
    throw new ResumeAgentClientError(data.error || `上传失败 (${response.status})`);
  }
  return { id: data.id, fileName: data.fileName!, fileSize: data.fileSize! };
}

export async function deleteInterviewRecording(id: string): Promise<void> {
  const response = await fetch(`/api/interview-recording/${encodeURIComponent(id)}`, { method: "DELETE" });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new ResumeAgentClientError(data.error || `删除失败 (${response.status})`);
}
