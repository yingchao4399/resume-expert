import type {
  AnalyzeResponseBody,
  AIConnectionTestRequest,
  AIConnectionTestResult,
  AIModelCatalogRequest,
  AIModelCatalogResult,
  FinalizeResumeResponseBody,
  FollowUpBulletResponseBody,
  FollowUpGuidanceRequestBody,
  FollowUpGuidanceResponseBody,
  InterviewAnalyzeRequestBody,
  InterviewAnalyzeResponseBody,
  OptimizeResponseBody,
  PublicAIConfig,
  SaveAIConfigBody,
} from "@/lib/ai/types";
import type { CareerAnalysisClaim } from "@/lib/career/career-context";
import type { AnalysisResult, JobTargetContext, OptimizeStyle, UserInput } from "@/types/resume";
import type { InterviewAnalysisResult } from "@/types/interview";
import { reportTraceStorageError, saveTraceSpan } from "@/lib/studio/trace-store";
import type { WorkflowNodeId } from "@/lib/studio/trace-types";
import { getPublishedWorkflowNode } from "@/lib/studio/workflow-store";
import { isStudioEnabled } from "@/lib/studio/settings";
import type { PromptRuntimeSnapshot } from "@/lib/studio/prompt-types";
import type { AnalysisProgressEvent } from "@/lib/ai/analysis-execution";

export { STYLE_LABELS } from "@/lib/ai/types";

class ResumeAgentClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeAgentClientError";
  }
}

export class ResumeAnalysisCancelledError extends Error {
  constructor(message = "分析已取消，当前材料和已有结果均未改变。") {
    super(message);
    this.name = "ResumeAnalysisCancelledError";
  }
}

async function buildWorkflowHeaders(url: string, traceId: string): Promise<Record<string, string>> {
  const publishedNode = await getPublishedWorkflowNode(workflowDefinitionNodeId(nodeIdForURL(url))).catch(() => null);
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Workflow-Trace-Id": traceId };
  if (isStudioEnabled()) headers["X-Studio-Capture"] = "full";
  if (publishedNode?.provider === "mock") headers["X-Workflow-Provider"] = "mock";
  if (publishedNode?.provider === "direct" && publishedNode.model && publishedNode.model !== "configured-model") headers["X-Workflow-Model"] = publishedNode.model;
  if (publishedNode?.provider === "direct" && publishedNode.timeoutMs) headers["X-Workflow-Timeout"] = String(publishedNode.timeoutMs);
  return headers;
}

export async function postWorkflowJSON<T>(url: string, body: unknown): Promise<T> {
  const startedAt = new Date();
  const traceId = crypto.randomUUID();
  const headers = await buildWorkflowHeaders(url, traceId);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const rawData = (await response.json().catch(() => ({}))) as T & { error?: string; __studio?: { promptSnapshots?: PromptRuntimeSnapshot[] } };
  const promptSnapshots = rawData.__studio?.promptSnapshots ?? [];
  if (rawData && typeof rawData === "object") delete rawData.__studio;
  const data = rawData as T & { error?: string };

  const finishedAt = new Date();
  const nodeId = nodeIdForURL(url);
  const status = response.ok ? "success" : "error";
  void saveTraceSpan({ id: traceId, nodeId, label: labelForNode(nodeId), status, mode: (response.headers.get("X-AI-Mode") as "mock" | "llm" | "flowise" | null) ?? undefined, provider: response.headers.get("X-AI-Provider") ?? undefined, model: response.headers.get("X-AI-Model") ?? undefined, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), latencyMs: finishedAt.getTime() - startedAt.getTime(), input: body, output: response.ok ? data : undefined, error: response.ok ? undefined : data.error || `HTTP ${response.status}`, promptSnapshots }).catch(reportTraceStorageError);
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
  jobTargetContext: JobTargetContext,
  careerClaims: CareerAnalysisClaim[],
  optimizeStyle: OptimizeStyle = "ai-product"
): Promise<AnalysisResult> {
  const data = await postWorkflowJSON<AnalyzeResponseBody>("/api/analyze", { input, jobTargetContext, careerClaims, optimizeStyle });
  return data.result;
}

export async function runResumeAnalysisStreaming(
  input: UserInput,
  jobTargetContext: JobTargetContext,
  careerClaims: CareerAnalysisClaim[],
  optimizeStyle: OptimizeStyle = "ai-product",
  options: {
    signal?: AbortSignal;
    onProgress?: (event: AnalysisProgressEvent) => void;
    watchdogMs?: number;
  } = {},
): Promise<AnalysisResult> {
  const url = "/api/analyze/stream";
  const body = { input, jobTargetContext, careerClaims, optimizeStyle };
  const startedAt = new Date();
  const traceId = crypto.randomUUID();
  const headers = await buildWorkflowHeaders(url, traceId);
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  let watchdogExpired = false;
  const watchdog = globalThis.setTimeout(() => {
    watchdogExpired = true;
    controller.abort();
  }, options.watchdogMs ?? 365_000);
  let result: AnalysisResult | undefined;
  let mode: "mock" | "llm" | undefined;
  let promptSnapshots: PromptRuntimeSnapshot[] = [];
  const traceProgress: Array<Record<string, unknown>> = [];
  let terminalError: string | undefined;

  try {
    if (options.signal?.aborted) throw new ResumeAnalysisCancelledError();
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      throw new ResumeAgentClientError(data.error || `请求失败 (${response.status})`);
    }
    if (!response.body) throw new ResumeAgentClientError("分析连接未返回可读取的数据流");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as AnalysisProgressEvent;
        traceProgress.push({
          type: event.type,
          requestId: event.requestId,
          elapsedMs: event.elapsedMs,
          remainingMs: event.remainingMs,
          ...("stage" in event ? { stage: event.stage } : {}),
          ...("batchIndex" in event ? { batchIndex: event.batchIndex, batchCount: event.batchCount, batchStatus: event.batchStatus } : {}),
        });
        if ("promptSnapshots" in event && event.promptSnapshots?.length) {
          promptSnapshots = event.promptSnapshots;
        }
        options.onProgress?.(event);
        if (event.type === "completed") {
          result = event.result;
          mode = event.mode;
          promptSnapshots = event.promptSnapshots ?? [];
        } else if (event.type === "failed") {
          promptSnapshots = event.promptSnapshots ?? [];
          throw new ResumeAgentClientError(event.error);
        } else if (event.type === "cancelled") {
          promptSnapshots = event.promptSnapshots ?? [];
          throw new ResumeAnalysisCancelledError(event.message);
        }
      }
      if (done) break;
    }

    if (!result || !mode) throw new ResumeAgentClientError("分析连接意外结束，未收到完整结果；本次未写入任何数据。请重试。");
    return result;
  } catch (error) {
    if (error instanceof ResumeAnalysisCancelledError) {
      terminalError = error.message;
      throw error;
    }
    if (options.signal?.aborted) {
      terminalError = "分析已取消，当前材料和已有结果均未改变。";
      throw new ResumeAnalysisCancelledError(terminalError);
    }
    if (watchdogExpired) {
      terminalError = "分析连接已超过 365 秒，客户端已停止等待；本次未写入任何数据。";
      throw new ResumeAgentClientError(terminalError);
    }
    terminalError = error instanceof Error ? error.message : "分析失败";
    throw error;
  } finally {
    globalThis.clearTimeout(watchdog);
    options.signal?.removeEventListener("abort", abortFromCaller);
    const finishedAt = new Date();
    const latestSnapshot = promptSnapshots.at(-1);
    void saveTraceSpan({
      id: traceId,
      nodeId: "analyze",
      label: "岗位分析",
      status: result ? "success" : "error",
      mode,
      provider: latestSnapshot?.provider,
      model: latestSnapshot?.model,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      latencyMs: finishedAt.getTime() - startedAt.getTime(),
      input: body,
      output: result ?? { progress: traceProgress },
      error: result ? undefined : terminalError,
      promptSnapshots,
    }).catch(reportTraceStorageError);
  }
}

export async function generateFollowUpGuidance(input: FollowUpGuidanceRequestBody): Promise<string> {
  const data = await postWorkflowJSON<FollowUpGuidanceResponseBody>("/api/follow-up/guidance", input);
  return data.example;
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

export async function refreshAIModels(config: AIModelCatalogRequest): Promise<AIModelCatalogResult> {
  const response = await fetch("/api/ai/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
  const data = (await response.json().catch(() => ({}))) as Partial<AIModelCatalogResult> & { error?: string };
  if (response.ok && Array.isArray(data.models)) return data as AIModelCatalogResult;
  throw new ResumeAgentClientError(data.error || `刷新模型清单失败 (${response.status})`);
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
