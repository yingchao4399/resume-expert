import { describe, expect, it, vi } from "vitest";
import { LLMTruncationError } from "@/lib/ai/errors";
import { runWithTruncationFallback } from "@/lib/ai/truncation-fallback";

describe("analysis truncation fallback", () => {
  it("keeps a single fast path for twenty items or fewer", async () => {
    const run = vi.fn(async (items: number[]) => items);
    await expect(runWithTruncationFallback({ stage: "JD 需求解析", items: [1, 2], run, merge: (parts) => parts.flat() })).resolves.toEqual([1, 2]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("pre-splits more than twenty items into two balanced batches", async () => {
    const run = vi.fn(async (items: number[]) => items);
    const items = Array.from({ length: 40 }, (_, index) => index + 1);
    await expect(runWithTruncationFallback({ stage: "要求—事实匹配", items, run, merge: (parts) => parts.flat() })).resolves.toEqual(items);
    expect(run.mock.calls.map(([batch]) => batch.length).sort((a, b) => b - a)).toEqual([20, 20]);
  });

  it("splits a truncated batch once and then stops", async () => {
    const run = vi.fn(async (items: number[]) => {
      if (items.length > 5 || items.includes(7)) throw new LLMTruncationError("面试策略");
      return items;
    });
    await expect(runWithTruncationFallback({ stage: "面试策略", items: Array.from({ length: 10 }, (_, index) => index + 1), run, merge: (parts) => parts.flat() }))
      .rejects.toMatchObject({ name: "LLMTruncationError", stage: "面试策略" });
    expect(run.mock.calls.map(([batch]) => batch.length)).toEqual([10, 5, 5]);
  });

  it("never runs more than two model batches concurrently", async () => {
    let active = 0;
    let peak = 0;
    const run = vi.fn(async (items: number[]) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      if (items.length > 10) throw new LLMTruncationError("JD 需求解析");
      return items;
    });
    const items = Array.from({ length: 40 }, (_, index) => index + 1);
    await expect(runWithTruncationFallback({ stage: "JD 需求解析", items, run, merge: (parts) => parts.flat() })).resolves.toEqual(items);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("aborts sibling batches after an unrecoverable failure", async () => {
    let siblingAborted = false;
    const run = vi.fn(async (items: number[], signal: AbortSignal) => {
      if (items[0] === 1) throw new Error("unrecoverable");
      await new Promise<void>((resolve) => {
        signal.addEventListener("abort", () => { siblingAborted = true; resolve(); }, { once: true });
      });
      return items;
    });
    const items = Array.from({ length: 40 }, (_, index) => index + 1);
    await expect(runWithTruncationFallback({ stage: "JD 需求解析", items, run, merge: (parts) => parts.flat() })).rejects.toThrow("unrecoverable");
    expect(siblingAborted).toBe(true);
  });
});
