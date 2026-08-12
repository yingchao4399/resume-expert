import { describe, expect, it } from "vitest";
import { createDefaultWorkflowDefinition } from "@/lib/studio/workflow-default";
import { hasRecentRealEval, isExecutionChange, validateWorkflowDefinition } from "@/lib/studio/workflow-validation";

describe("workflow definition guardrails", () => {
  it("accepts the fixed default workflow", () => expect(validateWorkflowDefinition(createDefaultWorkflowDefinition())).toEqual({ valid: true, errors: [] }));
  it("rejects cycles, incompatible edges and bypassed gates", () => {
    const cycle = createDefaultWorkflowDefinition(); cycle.edges.push({ id: "cycle", source: "optimize", target: "evidence-confirmation" });
    expect(validateWorkflowDefinition(cycle).errors.some((item) => item.includes("循环"))).toBe(true);
    const incompatible = createDefaultWorkflowDefinition(); incompatible.edges.push({ id: "bad", source: "analysis", target: "export-gate" });
    expect(validateWorkflowDefinition(incompatible).errors.some((item) => item.includes("不兼容"))).toBe(true);
    const bypass = createDefaultWorkflowDefinition(); bypass.edges.push({ id: "bypass", source: "analysis", target: "optimize" });
    const result = validateWorkflowDefinition(bypass);
    expect(result.errors.some((item) => item.includes("evidence-confirmation"))).toBe(true);
  });
  it("rejects removing a locked required gate", () => { const value = createDefaultWorkflowDefinition(); value.nodes = value.nodes.filter((node) => node.id !== "export-gate"); expect(validateWorkflowDefinition(value).valid).toBe(false); });
  it("detects execution changes and seven-day real eval freshness", () => {
    const base = createDefaultWorkflowDefinition(); const next = structuredClone(base); next.nodes.find((node) => node.id === "analysis")!.provider = "flowise";
    expect(isExecutionChange(base, next)).toBe(true);
    expect(hasRecentRealEval(new Date(Date.now() - 6 * 86400000).toISOString())).toBe(true);
    expect(hasRecentRealEval(new Date(Date.now() - 8 * 86400000).toISOString())).toBe(false);
  });
});
