import { describe, expect, it } from "vitest";
import {
  ANALYSIS_MAX_PROVIDER_REQUESTS,
  ANALYSIS_PROVIDER_TIMEOUT_MS,
  AnalysisExecutionBudget,
} from "@/lib/ai/analysis-execution";

describe("analysis execution budget", () => {
  it("caps every provider request at 90 seconds and the remaining deadline", () => {
    let now = 1_000;
    const budget = new AnalysisExecutionBudget({ startedAt: now, deadlineAt: now + 100_000, now: () => now });
    expect(budget.claimProviderRequest(120_000)).toBe(ANALYSIS_PROVIDER_TIMEOUT_MS);
    now += 95_000;
    expect(budget.claimProviderRequest(120_000)).toBe(5_000);
  });

  it("stops after ten provider requests", () => {
    const budget = new AnalysisExecutionBudget();
    for (let index = 0; index < ANALYSIS_MAX_PROVIDER_REQUESTS; index += 1) budget.claimProviderRequest();
    expect(() => budget.claimProviderRequest()).toThrow(/10 次调用上限/);
  });

  it("distinguishes cancellation from the total deadline", () => {
    const controller = new AbortController();
    const cancelled = new AnalysisExecutionBudget({ signal: controller.signal });
    controller.abort();
    expect(() => cancelled.assertActive()).toThrow(/分析已取消/);

    const expired = new AnalysisExecutionBudget({ startedAt: 0, deadlineAt: 10, now: () => 10 });
    expect(() => expired.assertActive()).toThrow(/6 分钟上限/);
  });
});

