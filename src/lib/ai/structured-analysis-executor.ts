import { chatCompletionJSON, type ChatCompletionOptions } from "@/lib/ai/client";
import type { AnalysisExecutionBudget } from "@/lib/ai/analysis-execution";
import { runWithTruncationFallback, type TruncationBatchProgress } from "@/lib/ai/truncation-fallback";

export interface AnalysisBatchPlan {
  jdBatches: number[];
  matchBatches: number[];
  overviewRequests: number;
  totalProviderRequests: number;
}

export function planAnalysisBatches(itemCount: number, batchSize: number): number[] {
  if (itemCount <= 0) return [];
  const sizes: number[] = [];
  for (let remaining = itemCount; remaining > 0; remaining -= batchSize) {
    sizes.push(Math.min(batchSize, remaining));
  }
  return sizes;
}

export function planQuickAnalysis(sourceItemCount: number, requirementCount: number): AnalysisBatchPlan {
  const jdBatches = planAnalysisBatches(sourceItemCount, 16);
  const matchBatches = planAnalysisBatches(requirementCount, 12);
  const overviewRequests = requirementCount > 0 ? 1 : 0;
  return {
    jdBatches,
    matchBatches,
    overviewRequests,
    totalProviderRequests: jdBatches.length + matchBatches.length + overviewRequests,
  };
}

export interface StructuredModelAdapter {
  execute<T>(request: ChatCompletionOptions<T>): Promise<T>;
}

export const productionStructuredModelAdapter: StructuredModelAdapter = {
  execute: chatCompletionJSON,
};

export interface StructuredBatchTask<TItem, TResult> {
  items: TItem[];
  batchSize: number;
  stage: ChatCompletionOptions<TResult>["analysisStage"];
  createRequest: (items: TItem[], signal: AbortSignal) => ChatCompletionOptions<TResult>;
  merge: (results: TResult[]) => TResult;
  signal?: AbortSignal;
  onProgress?: (progress: TruncationBatchProgress) => void;
}

export class StructuredAnalysisExecutor {
  constructor(
    private readonly adapter: StructuredModelAdapter = productionStructuredModelAdapter,
    readonly budget?: AnalysisExecutionBudget,
  ) {}

  execute<T>(request: ChatCompletionOptions<T>): Promise<T> {
    return this.adapter.execute({ ...request, analysisBudget: request.analysisBudget ?? this.budget });
  }

  executeBatched<TItem, TResult>(task: StructuredBatchTask<TItem, TResult>): Promise<TResult> {
    return runWithTruncationFallback({
      stage: task.stage ?? "简历优化",
      items: task.items,
      batchSize: task.batchSize,
      maxConcurrency: 2,
      run: (items, signal) => this.execute(task.createRequest(items, signal)),
      merge: task.merge,
      signal: task.signal,
      onProgress: task.onProgress,
    });
  }
}
