import { randomUUID } from "node:crypto";
import type { AIMode } from "@/lib/ai/types";
import type { PromptRuntimeSnapshot } from "@/lib/studio/prompt-types";
import type { AnalysisResult } from "@/types/resume";
import {
  AnalysisCancelledError,
  AnalysisDeadlineError,
  AnalysisRetryBudgetError,
} from "@/lib/ai/errors";

export const ANALYSIS_TOTAL_TIMEOUT_MS = 180_000;
export const ANALYSIS_PROVIDER_TIMEOUT_MS = 60_000;
export const ANALYSIS_MAX_PROVIDER_REQUESTS = 10;
export const ANALYSIS_STAGE_COUNT = 2;

export type AnalysisStageId = "jd-requirements" | "match-and-insights";

interface AnalysisProgressBase {
  requestId: string;
  elapsedMs: number;
  remainingMs: number;
}

export type AnalysisProgressEvent =
  | (AnalysisProgressBase & { type: "started" })
  | (AnalysisProgressBase & {
      type: "heartbeat";
      stage?: AnalysisStageId;
      stageIndex?: number;
      stageCount: number;
      batchIndex?: number;
      batchCount?: number;
      message: string;
    })
  | (AnalysisProgressBase & {
      type: "stage-started" | "stage-completed";
      stage: AnalysisStageId;
      stageIndex: number;
      stageCount: number;
      message: string;
      promptSnapshots?: PromptRuntimeSnapshot[];
    })
  | (AnalysisProgressBase & {
      type: "batch-progress";
      stage: AnalysisStageId;
      stageIndex: number;
      stageCount: number;
      batchIndex: number;
      batchCount: number;
      batchStatus: "started" | "completed" | "split";
      message: string;
      promptSnapshots?: PromptRuntimeSnapshot[];
    })
  | (AnalysisProgressBase & {
      type: "completed";
      result: AnalysisResult;
      mode: AIMode;
      promptSnapshots?: PromptRuntimeSnapshot[];
    })
  | (AnalysisProgressBase & {
      type: "failed";
      error: string;
      category?: string;
      stage?: AnalysisStageId;
      promptSnapshots?: PromptRuntimeSnapshot[];
    })
  | (AnalysisProgressBase & {
      type: "cancelled";
      message: string;
      promptSnapshots?: PromptRuntimeSnapshot[];
    });

type WithoutProgressBase<T> = T extends AnalysisProgressBase
  ? Omit<T, keyof AnalysisProgressBase>
  : never;
export type AnalysisProgressPayload = WithoutProgressBase<AnalysisProgressEvent>;

export interface AnalysisExecutionBudgetOptions {
  requestId?: string;
  startedAt?: number;
  deadlineAt?: number;
  maxProviderRequests?: number;
  providerTimeoutMs?: number;
  signal?: AbortSignal;
  now?: () => number;
}

export class AnalysisExecutionBudget {
  readonly requestId: string;
  readonly startedAt: number;
  readonly deadlineAt: number;
  readonly maxProviderRequests: number;
  readonly providerTimeoutMs: number;
  readonly signal?: AbortSignal;
  private readonly now: () => number;
  private providerRequests = 0;

  constructor(options: AnalysisExecutionBudgetOptions = {}) {
    this.now = options.now ?? Date.now;
    this.requestId = options.requestId ?? randomUUID();
    this.startedAt = options.startedAt ?? this.now();
    this.deadlineAt = options.deadlineAt ?? this.startedAt + ANALYSIS_TOTAL_TIMEOUT_MS;
    this.maxProviderRequests = options.maxProviderRequests ?? ANALYSIS_MAX_PROVIDER_REQUESTS;
    this.providerTimeoutMs = options.providerTimeoutMs ?? ANALYSIS_PROVIDER_TIMEOUT_MS;
    this.signal = options.signal;
  }

  get providerRequestCount(): number {
    return this.providerRequests;
  }

  elapsedMs(): number {
    return Math.max(0, this.now() - this.startedAt);
  }

  remainingMs(): number {
    return Math.max(0, this.deadlineAt - this.now());
  }

  assertActive(): void {
    if (this.signal?.aborted) throw new AnalysisCancelledError();
    if (this.remainingMs() <= 0) throw new AnalysisDeadlineError();
  }

  claimProviderRequest(requestedTimeoutMs?: number): number {
    this.assertActive();
    if (this.providerRequests >= this.maxProviderRequests) {
      throw new AnalysisRetryBudgetError(this.maxProviderRequests);
    }
    this.providerRequests += 1;
    return Math.max(
      1,
      Math.min(requestedTimeoutMs ?? this.providerTimeoutMs, this.providerTimeoutMs, this.remainingMs()),
    );
  }

  progress(event: AnalysisProgressPayload): AnalysisProgressEvent {
    return {
      ...event,
      requestId: this.requestId,
      elapsedMs: this.elapsedMs(),
      remainingMs: this.remainingMs(),
    } as AnalysisProgressEvent;
  }
}
