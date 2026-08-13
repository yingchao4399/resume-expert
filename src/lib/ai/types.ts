export const STYLE_LABELS = {
  concise: "更简洁",
  "reduce-exaggeration": "降低夸张",
  "ai-product": "更偏 AI 产品",
  "tob-saas": "更偏 ToB SaaS",
} as const;

export type AIMode = "mock" | "llm";

export interface AIStatus {
  mode: AIMode;
  model?: string;
  provider?: string;
  reason?: "missing_api_key" | "invalid_api_key" | "forced";
}

export interface AnalyzeRequestBody {
  input: import("@/types/resume").UserInput;
  optimizeStyle?: import("@/types/resume").OptimizeStyle;
  jobTargetContext: import("@/types/resume").JobTargetContext;
  careerClaims: import("@/lib/career/career-context").CareerAnalysisClaim[];
}

export interface OptimizeRequestBody {
  input: import("@/types/resume").UserInput;
  style: import("@/types/resume").OptimizeStyle;
}

export interface FollowUpBulletRequestBody {
  input: import("@/types/resume").UserInput;
  question: string;
  purpose: string;
  userAnswer: string;
}

export interface FinalizeResumeRequestBody {
  input: import("@/types/resume").UserInput;
  style: import("@/types/resume").OptimizeStyle;
  optimizedItems: import("@/types/resume").OptimizedItem[];
  followUpQuestions: import("@/types/resume").FollowUpQuestion[];
}

export interface APIErrorResponse {
  error: string;
}

export interface AnalyzeResponseBody {
  result: import("@/types/resume").AnalysisResult;
  mode: AIMode;
}

export interface OptimizeResponseBody {
  optimizedItems: import("@/types/resume").OptimizedItem[];
  mode: AIMode;
}

export interface FollowUpBulletResponseBody {
  bullet: string;
  mode: AIMode;
}

// ===== AI 配置管理（运行时切换模型/模式） =====
export interface FinalizeResumeResponseBody {
  finalResume: import("@/types/resume").FinalResume;
  mode: AIMode;
}


export type APIKeySource = "user" | "env" | "none";

export interface PublicAIConfig {
  provider: string;
  baseUrl: string;
  model: string;
  mode: AIMode;
  useMock: boolean;
  hasApiKey: boolean;
  invalidApiKey: boolean;
  apiKeyMasked: string;
  apiKeySource: APIKeySource;
}

export interface SaveAIConfigBody {
  provider?: string;
  apiKey?: string; // 空或 "__unchanged__" 表示保留原值
  baseUrl?: string;
  model?: string;
  useMock?: boolean;
}

export interface FollowUpGuidanceRequestBody {
  targetRole: string;
  requirementId: string;
  requirement: string;
  question: string;
  purpose: string;
  thinkingPrompts: string[];
  answerFramework: string[];
}

export interface FollowUpGuidanceResponseBody {
  example: string;
  mode: AIMode;
}

export type AIConnectionErrorCategory =
  | "authentication"
  | "model"
  | "base_url"
  | "rate_limit"
  | "network"
  | "timeout";

export type AIConnectionTestRequest = SaveAIConfigBody;

export interface AIConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  provider: string;
  model: string;
  message: string;
  category?: AIConnectionErrorCategory;
}

export type AIModelSource = "official" | "account";

export type AIModelCatalogRequest = SaveAIConfigBody;

export interface AIModelCatalogEntry {
  id: string;
  source: AIModelSource;
}

export interface AIModelCatalogResult {
  provider: string;
  models: AIModelCatalogEntry[];
  refreshedAt: string;
  warning?: string;
}

// ===== 面试录音诊断 =====

export interface InterviewAnalyzeRequestBody {
  transcriptText: string;
  resumeText?: string;
  targetRole?: string;
}

export interface InterviewAnalyzeResponseBody {
  result: import("@/types/interview").InterviewAnalysisResult;
  mode: AIMode;
}
