import { describe, expect, it } from "vitest";
import { z } from "zod";
import { vi } from "vitest";
import { StructuredAnalysisExecutor, planAnalysisBatches, planQuickAnalysis, type StructuredModelAdapter } from "@/lib/ai/structured-analysis-executor";

describe("structured analysis request planning", () => {
  it("keeps the built-in thirteen-item example within four provider requests", () => {
    const plan = planQuickAnalysis(13, 13);

    expect(plan.jdBatches).toEqual([13]);
    expect(plan.matchBatches).toEqual([12, 1]);
    expect(plan.overviewRequests).toBe(1);
    expect(plan.totalProviderRequests).toBe(4);
  });

  it("uses task-specific predictive batch limits", () => {
    expect(planAnalysisBatches(40, 16)).toEqual([16, 16, 8]);
    expect(planAnalysisBatches(40, 12)).toEqual([12, 12, 12, 4]);
    expect(planAnalysisBatches(13, 5)).toEqual([5, 5, 3]);
    expect(planAnalysisBatches(0, 12)).toEqual([]);
  });

  it("runs production and fake adapters through the same batched interface", async () => {
    const schema = z.object({ sizes: z.array(z.number()) });
    const execute = vi.fn(async <T,>(request: { schema: { parse: (value: unknown) => T }; batchSize?: number }) => request.schema.parse({ sizes: [request.batchSize] }));
    const executor = new StructuredAnalysisExecutor({ execute } as StructuredModelAdapter);
    const result = await executor.executeBatched({
      stage: "要求—事实匹配",
      items: Array.from({ length: 13 }, (_, index) => index),
      batchSize: 12,
      createRequest: (items) => ({ promptId: "resume.requirement-match", system: "system", user: "user", schema, schemaName: "fake", batchSize: items.length }),
      merge: (parts) => ({ sizes: parts.flatMap((part) => part.sizes) }),
    });
    expect(result.sizes).toEqual([12, 1]);
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
