import type {
  AnalyzeResponseBody,
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

export { STYLE_LABELS } from "@/lib/ai/types";

class ResumeAgentClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeAgentClientError";
  }
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new ResumeAgentClientError(data.error || `请求失败 (${response.status})`);
  }

  return data;
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
  const data = await postJSON<AnalyzeResponseBody>("/api/analyze", { input, optimizeStyle });
  return data.result;
}

export async function regenerateOptimizedItems(
  input: UserInput,
  style: OptimizeStyle
): Promise<AnalysisResult["optimizedItems"]> {
  const data = await postJSON<OptimizeResponseBody>("/api/optimize", { input, style });
  return data.optimizedItems;
}

export async function generateFollowUpBullet(
  input: UserInput,
  question: string,
  purpose: string,
  userAnswer: string
): Promise<string> {
  const data = await postJSON<FollowUpBulletResponseBody>("/api/follow-up/bullet", {
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
  const data = await postJSON<FinalizeResumeResponseBody>("/api/finalize", {
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
  const data = await postJSON<PublicAIConfig & { saved?: boolean }>("/api/ai/config", config);
  return data;
}

// ===== 面试录音诊断与分析 =====

export async function analyzeInterview(
  body: InterviewAnalyzeRequestBody
): Promise<InterviewAnalysisResult> {
  const data = await postJSON<InterviewAnalyzeResponseBody>("/api/interview-recording/analyze", body);
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
