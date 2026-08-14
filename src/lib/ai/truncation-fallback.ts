import { LLMTruncationError, type AnalysisStage } from "@/lib/ai/errors";

export interface TruncationBatchProgress {
  stage: AnalysisStage;
  batchIndex: number;
  batchCount: number;
  status: "started" | "completed" | "split";
}

function splitBalanced<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const middle = Math.ceil(items.length / 2);
  return [items.slice(0, middle), items.slice(middle)];
}

function chunkBySize<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}

function createLimiter(maxConcurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const release = () => {
    active -= 1;
    queue.shift()?.();
  };
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= maxConcurrency) await new Promise<void>((resolve) => queue.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      release();
    }
  };
}

export async function runWithTruncationFallback<TItem, TResult>(options: {
  stage: AnalysisStage;
  items: TItem[];
  run: (items: TItem[], signal: AbortSignal) => Promise<TResult>;
  merge: (results: TResult[]) => TResult;
  splitThreshold?: number;
  batchSize?: number;
  maxConcurrency?: number;
  signal?: AbortSignal;
  onProgress?: (progress: TruncationBatchProgress) => void;
}): Promise<TResult> {
  const splitThreshold = options.batchSize ?? options.splitThreshold ?? 20;
  const limit = createLimiter(options.maxConcurrency ?? 2);
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  if (options.signal?.aborted) controller.abort();
  const initialBatches = options.items.length > splitThreshold
    ? options.batchSize ? chunkBySize(options.items, options.batchSize) : splitBalanced(options.items)
    : [options.items];

  const executeBatch = async (
    batch: TItem[],
    batchIndex: number,
    batchCount: number,
    maySplit: boolean,
  ): Promise<TResult> => {
    options.onProgress?.({ stage: options.stage, batchIndex, batchCount, status: "started" });
    try {
      const result = await limit(() => {
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        return options.run(batch, controller.signal);
      });
      options.onProgress?.({ stage: options.stage, batchIndex, batchCount, status: "completed" });
      return result;
    } catch (error) {
      if (!(error instanceof LLMTruncationError) || !maySplit || batch.length <= 1) {
        controller.abort();
        throw error;
      }
      options.onProgress?.({ stage: options.stage, batchIndex, batchCount, status: "split" });
      const smallerBatches = splitBalanced(batch);
      const results = await Promise.all(
        smallerBatches.map((smallerBatch, index) =>
          executeBatch(smallerBatch, index + 1, smallerBatches.length, false),
        ),
      );
      return options.merge(results);
    }
  };

  try {
    const results = await Promise.all(
      initialBatches.map((batch, index) => executeBatch(batch, index + 1, initialBatches.length, true)),
    );
    return options.merge(results);
  } finally {
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
