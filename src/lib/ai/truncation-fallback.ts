import { LLMTruncationError, type AnalysisStage } from "@/lib/ai/errors";

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export async function runWithTruncationFallback<TItem, TResult>(options: {
  stage: AnalysisStage;
  items: TItem[];
  run: (items: TItem[]) => Promise<TResult>;
  merge: (results: TResult[]) => TResult;
}): Promise<TResult> {
  try {
    return await options.run(options.items);
  } catch (error) {
    if (!(error instanceof LLMTruncationError)) throw error;
  }

  const results: TResult[] = [];
  for (const batch of chunks(options.items, 8)) {
    try {
      results.push(await options.run(batch));
    } catch (error) {
      if (!(error instanceof LLMTruncationError)) throw error;
      for (const smallerBatch of chunks(batch, 4)) {
        try {
          results.push(await options.run(smallerBatch));
        } catch (retryError) {
          if (retryError instanceof LLMTruncationError) throw new LLMTruncationError(options.stage);
          throw retryError;
        }
      }
    }
  }
  return options.merge(results);
}
