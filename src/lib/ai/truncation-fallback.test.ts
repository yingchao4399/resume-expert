import { describe, expect, it, vi } from "vitest";
import { LLMTruncationError } from "@/lib/ai/errors";
import { runWithTruncationFallback } from "@/lib/ai/truncation-fallback";

describe("analysis truncation fallback", () => {
  it("keeps the single fast path when output is complete", async () => {
    const run = vi.fn(async (items: number[]) => items);
    await expect(runWithTruncationFallback({ stage: "JD 需求解析", items: [1, 2], run, merge: (parts) => parts.flat() })).resolves.toEqual([1, 2]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("falls back from the full request to eight-item batches", async () => {
    const run = vi.fn(async (items: number[]) => {
      if (items.length > 8) throw new LLMTruncationError("要求—事实匹配");
      return items;
    });
    const items = Array.from({ length: 18 }, (_, index) => index + 1);
    await expect(runWithTruncationFallback({ stage: "要求—事实匹配", items, run, merge: (parts) => parts.flat() })).resolves.toEqual(items);
    expect(run.mock.calls.map(([batch]) => batch.length)).toEqual([18, 8, 8, 2]);
  });

  it("shrinks a truncated batch to four and then stops with its stage", async () => {
    const run = vi.fn(async (items: number[]) => {
      if (items.length > 4 || items.includes(7)) throw new LLMTruncationError("面试策略");
      return items;
    });
    await expect(runWithTruncationFallback({ stage: "面试策略", items: Array.from({ length: 10 }, (_, index) => index + 1), run, merge: (parts) => parts.flat() }))
      .rejects.toMatchObject({ name: "LLMTruncationError", stage: "面试策略" });
  });
});
