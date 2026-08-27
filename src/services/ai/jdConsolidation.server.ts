import { chatCompletionJSON } from "@/lib/ai/client";
import { getAIConfig } from "@/lib/ai/config";
import { createJDTaskBudget } from "@/lib/ai/jd-task-budget";
import { JD_CONSOLIDATION_SYSTEM, buildConsolidationPrompt } from "@/lib/ai/consolidation-prompts";
import { consolidationModelSchema, mockConsolidation, prepareConsolidation } from "@/lib/jd/consolidation";
import type { JDAnalysisDocument } from "@/types/jd-analysis";
import type { WorkflowExecutionOptions } from "@/lib/studio/execution";

export async function consolidateJDServer(document: JDAnalysisDocument, execution: WorkflowExecutionOptions = { forceMock: false }) {
  const budget = execution.analysisBudget ?? createJDTaskBudget(1, execution.signal);
  budget.assertActive();
  if (execution.forceMock || getAIConfig().mode === "mock") return mockConsolidation(document);
  const output = await chatCompletionJSON({
    promptId: "resume.jd-consolidation", system: JD_CONSOLIDATION_SYSTEM, user: buildConsolidationPrompt(document),
    schema: consolidationModelSchema, schemaName: "jd_semantic_consolidation", maxTokens: 8000, temperature: 0.1,
    timeoutMs: 60_000, model: execution.model, analysisBudget: budget, signal: execution.signal, capture: execution.capture,
    analysisStage: "JD 需求解析", batchSize: document.requirements.length,
  });
  budget.assertActive();
  return prepareConsolidation(document, output, "llm");
}
