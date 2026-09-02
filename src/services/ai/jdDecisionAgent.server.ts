import { getAIConfig } from "@/lib/ai/config";
import { chatCompletionJSON } from "@/lib/ai/client";
import { createCompactJDModelResultSchema, createDiagnosisMatchCoreResultSchema, jobOverviewModelResultSchema } from "@/lib/ai/schemas";
import { buildDeepJDPrompt, buildJobOverviewPrompt, buildRequirementMatchPrompt } from "@/lib/ai/jd-prompts";
import { RESUME_AGENT_SYSTEM_PROMPT, normalizeAnalysisResult } from "@/lib/ai/prompts";
import { AnalysisExecutionBudget } from "@/lib/ai/analysis-execution";
import { StructuredAnalysisExecutor } from "@/lib/ai/structured-analysis-executor";
import { buildConservativeResume } from "@/lib/resume/conservative-resume";
import { buildJDAnalysisDocument, parseJDSourceSpans } from "@/lib/jd/decision-map";
import { rankCareerClaimsByRequirement } from "@/lib/jd/deep-analysis";
import { calculateJobReadiness, determineEvidenceStrength } from "@/lib/jd/readiness";
import { assessRequirements, calculateJobReadinessV2 } from "@/lib/jd/readiness-v2";
import { planSupplementTasks } from "@/lib/jd/supplement-planner";
import { findResumeQuotes } from "@/lib/jd/resume-quote-recall";
import type { WorkflowExecutionOptions } from "@/lib/studio/execution";
import type { CareerAnalysisClaim } from "@/lib/career/career-context";
import type { AnalysisResult, EvidenceStrength, JobRequirement, JobRoleInferenceItem, JobTargetContext, UserInput } from "@/types/resume";
import type { JDAnalysisDocument, JDRequirementAtom, JDRequirementAtomDraft, RoleHypothesis } from "@/types/jd-analysis";
import type { AIMode } from "@/lib/ai/types";
import { AnalysisCancelledError } from "@/lib/ai/errors";
import { createJDTaskBudget } from "@/lib/ai/jd-task-budget";
import { JD_MAX_REQUIREMENTS, JD_CAPACITY_MESSAGE, JD_BATCH_SIZE, MATCH_BATCH_SIZE } from "@/lib/jd/limits";
import { applyConsolidation, mockConsolidation } from "@/lib/jd/consolidation";
import { jdAnalysisDocumentSchema } from "@/lib/jd/schemas";
import { persistedAnalysisResultSchema } from "@/lib/ai/schemas";
import { consolidateJDServer } from "./jdConsolidation.server";

type Progress = (event: {
  type: "stage-started" | "batch-progress" | "stage-completed";
  stage: "jd-draft" | "fact-match";
  message: string;
  batchIndex?: number;
  batchCount?: number;
}) => void;

type Execution = WorkflowExecutionOptions & { onDecisionProgress?: Progress };

const CATEGORY_TO_KIND: Record<string, JDRequirementAtom["kind"]> = {
  responsibility: "task",
  result: "deliverable",
  skill: "skill",
  experience: "experience",
  education: "education",
  industry: "industry",
  collaboration: "collaboration",
  other: "work-context",
};

const KIND_TO_CATEGORY: Record<JDRequirementAtom["kind"], JobRequirement["category"]> = {
  task: "responsibility", deliverable: "result", knowledge: "skill", skill: "skill", tool: "skill",
  experience: "experience", education: "education", credential: "education", industry: "industry",
  collaboration: "collaboration", "work-context": "other", constraint: "other",
};

function modeFor(execution: WorkflowExecutionOptions): AIMode {
  return execution.forceMock ? "mock" : getAIConfig().mode;
}

function decisionBudget(execution: Execution, expectedRequests: number): AnalysisExecutionBudget {
  return execution.analysisBudget ?? createJDTaskBudget(expectedRequests, execution.signal);
}

function deterministicQualityFindings(document: JDAnalysisDocument): JDAnalysisDocument["qualityFindings"] {
  const findings: JDAnalysisDocument["qualityFindings"] = [];
  for (const requirement of document.requirements) {
    if (requirement.modality === "negated") findings.push({
      id: `finding-negation-${requirement.id}`, type: "negation", sourceSpanIds: requirement.sourceSpanIds,
      message: `存在否定条件：${requirement.normalizedText}`, severity: "medium",
    });
    if (["task", "deliverable"].includes(requirement.kind) && ["critical", "high"].includes(requirement.priority) && !requirement.expectedOutcome) findings.push({
      id: `finding-outcome-${requirement.id}`, type: "missing-outcome", sourceSpanIds: requirement.sourceSpanIds,
      message: `要求“${requirement.normalizedText}”未说明可验证的成功结果。`, severity: "medium",
    });
    if (/较强|优秀|一定|若干|相关经验/.test(requirement.sourceQuote)) findings.push({
      id: `finding-ambiguous-${requirement.id}`, type: "ambiguous", sourceSpanIds: requirement.sourceSpanIds,
      message: `原文包含模糊量词：${requirement.sourceQuote}`, severity: "low",
    });
  }
  return findings;
}

function overviewHypotheses(
  items: Array<{ topic: string; level: "explicit" | "inferred" | "unknown"; conclusion: string; evidence: string[]; confidence: "high" | "medium" | "low"; verificationQuestion: string }>,
  document: JDAnalysisDocument,
): RoleHypothesis[] {
  const typeByTopic: Record<string, RoleHypothesis["type"]> = {
    "work-content": "role-mission", "work-focus": "work-focus", "business-line": "business-line",
    "team-state": "team-pain", "business-scenario": "team-pain", "team-pain": "team-pain",
    "implicit-expectation": "implicit-expectation", "reporting-line": "reporting-line", "industry-experience": "implicit-expectation",
  };
  return items.map((item, index) => {
    const sourceSpanIds = document.sourceSpans.filter((span) => item.evidence.some((quote) => span.text.includes(quote) || quote.includes(span.text))).map((span) => span.id);
    const supported = item.level !== "unknown" && sourceSpanIds.length > 0;
    return {
      id: `hypothesis-${index + 1}`,
      type: typeByTopic[item.topic] ?? "implicit-expectation",
      conclusion: supported ? item.conclusion : "信息不足",
      sourceSpanIds,
      confidenceBasis: supported ? item.evidence : [],
      alternativeExplanations: supported ? ["也可能由团队分工或业务阶段不同导致，需向招聘方确认。"] : [],
      verificationQuestion: item.verificationQuestion,
      decisionImpact: item.confidence === "high" ? "high" : item.confidence === "medium" ? "medium" : "low",
      status: supported ? "inferred" : "unknown",
    };
  });
}

function unknownOverviewHypotheses(): RoleHypothesis[] {
  const items: Array<Pick<RoleHypothesis, "id" | "type" | "verificationQuestion" | "decisionImpact">> = [
    { id: "hypothesis-work-content", type: "role-mission", verificationQuestion: "这个岗位入职后最核心的工作内容是什么？", decisionImpact: "high" },
    { id: "hypothesis-work-focus", type: "work-focus", verificationQuestion: "这个岗位当前阶段最重要的工作重心是什么？", decisionImpact: "high" },
    { id: "hypothesis-business-line", type: "business-line", verificationQuestion: "岗位具体服务哪条业务线或产品线？", decisionImpact: "medium" },
    { id: "hypothesis-team-state", type: "team-pain", verificationQuestion: "团队目前处于什么阶段，人员和分工情况如何？", decisionImpact: "medium" },
    { id: "hypothesis-business-scenario", type: "team-pain", verificationQuestion: "这个岗位主要面对哪些业务场景和用户？", decisionImpact: "medium" },
    { id: "hypothesis-team-pain", type: "team-pain", verificationQuestion: "团队招聘这个岗位最希望优先解决什么问题？", decisionImpact: "high" },
    { id: "hypothesis-implicit-expectation", type: "implicit-expectation", verificationQuestion: "除 JD 明示要求外，还有哪些隐性期待？", decisionImpact: "medium" },
    { id: "hypothesis-reporting-line", type: "reporting-line", verificationQuestion: "这个岗位向谁汇报，主要协作对象有哪些？", decisionImpact: "medium" },
    { id: "hypothesis-industry-experience", type: "implicit-expectation", verificationQuestion: "行业经验在筛选和定级中占多大权重？", decisionImpact: "low" },
  ];
  return items.map((item) => ({
    ...item,
    conclusion: "信息不足",
    sourceSpanIds: [],
    confidenceBasis: [],
    alternativeExplanations: [],
    status: "unknown" as const,
  }));
}

function mockJDDocument(input: UserInput, materialRevision: number): JDAnalysisDocument {
  const spans = parseJDSourceSpans(input.jobDescription);
  const drafts: JDRequirementAtomDraft[] = spans.filter((span) => span.role === "requirement").map((span) => ({
    sourceSpanId: span.id,
    sourceQuote: span.text,
    normalizedText: span.text.replace(/^\s*(?:[-*•·▪◦]|\d+[.)、])\s*/, ""),
    kind: /负责|推动|制定|完成|搭建/.test(span.text) ? "task" : /学历|本科|硕士/.test(span.text) ? "education" : /经验|年/.test(span.text) ? "experience" : "skill",
    modality: /优先|加分/.test(span.text) ? "preferred" : /不要求|无需|不限/.test(span.text) ? "negated" : "required",
    priority: /必须|至少|以上/.test(span.text) ? "high" : "medium",
    priorityBasis: ["Mock 仅按原文显式词拆分"],
    keywords: [],
  }));
  const draft = buildJDAnalysisDocument({ sourceText: input.jobDescription, materialRevision, spans, drafts });
  const document = applyConsolidation(draft, mockConsolidation(draft), undefined, false);
  return { ...document, qualityFindings: deterministicQualityFindings(document) };
}

export async function analyzeJDDecisionMapServer(
  input: UserInput,
  jobTargetContext: JobTargetContext,
  materialRevision: number,
  execution: Execution = { forceMock: false },
): Promise<{ document: JDAnalysisDocument; mode: AIMode }> {
  const mode = modeFor(execution);
  if (mode === "mock") {
    execution.onDecisionProgress?.({ type: "stage-started", stage: "jd-draft", message: "正在按原文拆分 JD" });
    if (execution.signal?.aborted) throw new Error("JD 解析已取消");
    const document = mockJDDocument(input, materialRevision);
    execution.onDecisionProgress?.({ type: "stage-completed", stage: "jd-draft", message: "JD 草稿已生成，等待人工确认" });
    return { document, mode };
  }

  const spans = parseJDSourceSpans(input.jobDescription);
  const budget = decisionBudget(execution, Math.ceil(spans.filter(span => span.role !== "heading").length / JD_BATCH_SIZE) + 2);
  const executor = new StructuredAnalysisExecutor(undefined, budget);
  if (!spans.some((span) => span.role === "requirement")) throw new Error("JD 中没有可分析的岗位要求。");
  execution.onDecisionProgress?.({ type: "stage-started", stage: "jd-draft", message: "正在拆分 JD 原子要求" });
  const sourceItems = spans.filter((span) => span.role !== "heading").map((span) => ({
    id: span.id, text: span.text, startOffset: span.startOffset, endOffset: span.endOffset,
    classification: span.role === "benefit" ? "benefit" as const : span.role === "background" ? "background" as const : span.role === "irrelevant" ? "irrelevant" as const : "requirement" as const,
  }));
  const results = await executor.executeBatched({
    stage: "JD 需求解析",
    items: sourceItems,
    batchSize: JD_BATCH_SIZE,
    createRequest: (items, signal) => ({
      promptId: "resume.deep-jd", system: RESUME_AGENT_SYSTEM_PROMPT, user: buildDeepJDPrompt(input, jobTargetContext, items),
      schema: createCompactJDModelResultSchema(items.map((item) => item.id)), schemaName: "jd_decision_map_draft",
      maxTokens: 6000, timeoutMs: 60_000, batchSize: items.length, analysisStage: "JD 需求解析",
      model: execution.model, capture: execution.capture, analysisBudget: budget, signal,
    }),
    merge: (batches) => ({ sourceClassifications: batches.flatMap((item) => item.sourceClassifications), requirements: batches.flatMap((item) => item.requirements) }),
    signal: execution.signal,
    onProgress: (progress) => execution.onDecisionProgress?.({ type: "batch-progress", stage: "jd-draft", message: `处理 JD 第 ${progress.batchIndex}/${progress.batchCount} 批`, batchIndex: progress.batchIndex, batchCount: progress.batchCount }),
  });
  const classifications = new Map(results.sourceClassifications.map((item) => [item.sourceItemId, item.classification]));
  const classifiedSpans = spans.map((span) => span.role === "heading" ? span : {
    ...span,
    role: classifications.get(span.id) ?? span.role,
  });
  const drafts: JDRequirementAtomDraft[] = results.requirements.map((item) => ({
    sourceSpanId: item.sourceItemId,
    sourceQuote: item.sourceQuote,
    normalizedText: item.requirement,
    kind: CATEGORY_TO_KIND[item.category] ?? "work-context",
    modality: item.priority === "must" ? "required" : item.priority === "preferred" ? "preferred" : "informational",
    priority: item.priority === "must" ? "high" : item.priority === "preferred" ? "medium" : "low",
    priorityBasis: [`模型分类：${item.priority}`],
    expectedBehavior: item.interviewFocus,
    expectedOutcome: item.category === "result" ? item.requirement : null,
    keywords: item.keywords,
  }));
  let document = buildJDAnalysisDocument({ sourceText: input.jobDescription, materialRevision, spans: classifiedSpans, drafts });
  execution.onDecisionProgress?.({ type: "batch-progress", stage: "jd-draft", message: "正在进行全局语义归并" });
  const proposal = await consolidateJDServer(document, { ...execution, analysisBudget: budget });
  execution.onDecisionProgress?.({ type: "batch-progress", stage: "jd-draft", message: "正在整理核心要求与独立细则" });
  document = applyConsolidation(document, proposal, undefined, false);
  const legacyRequirements = document.requirements.filter((item) => item.anchorStatus === "validated").map(toLegacyRequirement);
  if (legacyRequirements.length) {
    execution.onDecisionProgress?.({ type: "batch-progress", stage: "jd-draft", message: "正在生成岗位画像", batchIndex: 1, batchCount: 1 });
    try {
      const overview = await chatCompletionJSON({
        promptId: "resume.job-overview", system: RESUME_AGENT_SYSTEM_PROMPT,
        user: buildJobOverviewPrompt(input, jobTargetContext, legacyRequirements), schema: jobOverviewModelResultSchema,
        schemaName: "jd_role_hypotheses", maxTokens: 4000, timeoutMs: 60_000, batchSize: legacyRequirements.length,
        analysisStage: "JD 需求解析", model: execution.model, capture: execution.capture, analysisBudget: budget, signal: execution.signal,
      });
      document = { ...document, hypotheses: overviewHypotheses(overview.roleInference.items, document) };
    } catch (error) {
      if (error instanceof AnalysisCancelledError || execution.signal?.aborted) throw error;
      document = { ...document, hypotheses: unknownOverviewHypotheses() };
      execution.onDecisionProgress?.({ type: "batch-progress", stage: "jd-draft", message: "岗位画像暂不可用，已保留需求地图并标记为信息不足", batchIndex: 1, batchCount: 1 });
    }
  }
  document = { ...document, qualityFindings: deterministicQualityFindings(document) };
  budget.assertActive();
  jdAnalysisDocumentSchema.parse(document);
  execution.onDecisionProgress?.({ type: "stage-completed", stage: "jd-draft", message: "JD 草稿已生成，等待人工确认" });
  return { document, mode };
}

function toLegacyRequirement(item: JDRequirementAtom): JobRequirement {
  return {
    id: item.id,
    sourceItemId: item.sourceSpanId,
    sourceQuote: item.sourceQuote,
    requirement: item.normalizedText,
    category: KIND_TO_CATEGORY[item.kind],
    priority: item.modality === "required" ? "must" : item.modality === "preferred" ? "preferred" : "context",
    keywords: item.keywords ?? [],
    interviewFocus: item.expectedBehavior ?? "",
    anchorStatus: item.anchorStatus,
  };
}

function strengthRank(value: EvidenceStrength): number {
  return ({ none: 0, weak: 1, medium: 2, strong: 3 } as const)[value];
}

function legacyRoleInference(hypotheses: RoleHypothesis[], document: JDAnalysisDocument): { items: JobRoleInferenceItem[] } {
  const spanMap = new Map(document.sourceSpans.map((span) => [span.id, span.text]));
  return { items: hypotheses.map((item) => ({
    topic: item.type === "role-mission" ? "work-content" : item.type === "work-focus" ? "work-focus" : item.type === "business-line" ? "business-line" : item.type === "reporting-line" ? "reporting-line" : item.type === "team-pain" ? "team-pain" : "implicit-expectation",
    level: item.status === "unknown" ? "unknown" : "inferred",
    conclusion: item.conclusion,
    evidence: item.sourceSpanIds
      .map((id) => spanMap.get(id)?.slice(0, 500))
      .filter((value): value is string => Boolean(value)),
    confidence: item.decisionImpact,
    verificationQuestion: item.verificationQuestion,
  })) };
}

function summaryFromConfirmed(document: JDAnalysisDocument) {
  const requirements = document.requirements.filter((item) => item.reviewStatus === "confirmed");
  const keywords = [...new Set(requirements.flatMap((item) => item.keywords ?? []).filter(Boolean))];
  const competencyPriority = new Map<string, JDRequirementAtom["priority"]>();
  const priorityRank = { low: 0, medium: 1, high: 2, critical: 3 } as const;
  for (const requirement of requirements) for (const keyword of requirement.keywords ?? []) {
    const current = competencyPriority.get(keyword);
    if (!current || priorityRank[requirement.priority] > priorityRank[current]) competencyPriority.set(keyword, requirement.priority);
  }
  return {
    responsibilities: requirements.filter((item) => ["task", "deliverable"].includes(item.kind)).map((item) => item.normalizedText),
    hardRequirements: requirements.filter((item) => item.modality === "required").map((item) => item.normalizedText),
    implicitRequirements: document.hypotheses.filter((item) => item.status === "inferred" && item.type === "implicit-expectation").map((item) => item.conclusion),
    keywords,
    idealCandidate: requirements.filter((item) => ["critical", "high"].includes(item.priority)).slice(0, 5).map((item) => item.normalizedText).join("；"),
    coreCompetencies: [...competencyPriority].map(([name, priority]) => ({
      name,
      importance: priority === "critical" || priority === "high" ? "high" as const : priority === "medium" ? "medium" as const : "low" as const,
      description: "由已确认岗位要求及其优先级汇总",
    })),
  };
}

export async function matchConfirmedJDServer(
  input: UserInput,
  jobTargetContext: JobTargetContext,
  document: JDAnalysisDocument,
  careerClaims: CareerAnalysisClaim[],
  execution: Execution = { forceMock: false },
): Promise<{ result: AnalysisResult; mode: AIMode }> {
  if (document.status !== "confirmed" || document.confirmedRevision !== document.revision) throw new Error("请先确认当前 JD 需求地图，再运行事实匹配。");
  if (document.requirements.length > JD_MAX_REQUIREMENTS) throw new Error(JD_CAPACITY_MESSAGE);
  jdAnalysisDocumentSchema.parse(document);
  const mode = modeFor(execution);
  const atoms = document.requirements.filter((item) => item.reviewStatus === "confirmed" && item.modality !== "negated");
  if (!atoms.length) throw new Error("当前需求地图中没有已确认的有效岗位要求。");
  const requirements = atoms.map(toLegacyRequirement);
  const claimsByRequirement = rankCareerClaimsByRequirement(careerClaims, requirements, input, 3);
  execution.onDecisionProgress?.({ type: "stage-started", stage: "fact-match", message: "正在逐条匹配已确认事实" });

  let modelMatches: AnalysisResult["matchItems"] = [];
  if (mode === "llm") {
    const budget = decisionBudget(execution, Math.ceil(requirements.length / MATCH_BATCH_SIZE));
    const executor = new StructuredAnalysisExecutor(undefined, budget);
    const response = await executor.executeBatched({
      stage: "要求—事实匹配", items: requirements, batchSize: MATCH_BATCH_SIZE,
      createRequest: (batch, signal) => {
        const allowed = [...new Map(batch.flatMap((item) => claimsByRequirement.get(item.id) ?? []).map((claim) => [claim.id, claim])).values()];
        const annotatedClaims = allowed.map((claim) => ({
          ...claim,
          candidateRequirementIds: batch.filter((requirement) => (claimsByRequirement.get(requirement.id) ?? []).some((item) => item.id === claim.id)).map((requirement) => requirement.id),
        }));
        return {
          promptId: "resume.requirement-match", system: RESUME_AGENT_SYSTEM_PROMPT,
          user: buildRequirementMatchPrompt(input, jobTargetContext, batch, annotatedClaims),
          schema: createDiagnosisMatchCoreResultSchema(batch.map((item) => item.id), allowed.map((item) => item.id)),
          schemaName: "confirmed_requirement_fact_match", maxTokens: 6000, timeoutMs: 60_000, batchSize: batch.length,
          analysisStage: "要求—事实匹配", model: execution.model, capture: execution.capture, analysisBudget: budget, signal,
        };
      },
      merge: (parts) => ({ diagnosis: parts[0]?.diagnosis ?? { overallScore: 0, dimensionScores: [], mainIssues: [], prioritySuggestions: [] }, matchItems: parts.flatMap((item) => item.matchItems) }),
      signal: execution.signal,
      onProgress: (progress) => execution.onDecisionProgress?.({ type: "batch-progress", stage: "fact-match", message: `匹配第 ${progress.batchIndex}/${progress.batchCount} 批`, batchIndex: progress.batchIndex, batchCount: progress.batchCount }),
    });
    modelMatches = response.matchItems;
    budget.assertActive();
  } else {
    modelMatches = requirements.map((requirement) => ({
      requirementId: requirement.id, jdRequirement: requirement.requirement,
      evidenceClaimIds: (claimsByRequirement.get(requirement.id) ?? []).slice(0, 1).map((claim) => claim.id), resumeQuotes: [],
      resumeEvidence: (claimsByRequirement.get(requirement.id) ?? [])[0]?.text ?? "未找到明确相关事实",
      matchRationale: "Mock 仅展示确定性召回结果，不生成语义结论。", evidenceStrength: "none",
      missingEvidenceTypes: [], needsSupplement: !(claimsByRequirement.get(requirement.id)?.length), optimizationSuggestion: "请核对并补充真实事实。",
    }));
  }

  const claimById = new Map(careerClaims.map((claim) => [claim.id, claim]));
  const atomById = new Map(atoms.map((item) => [item.id, item]));
  const evidenceByRequirement = new Map<string, EvidenceStrength>();
  const resultEvidenceRequirementIds = new Set<string>();
  const completeMetricRequirementIds = new Set<string>();
  const matchItems = requirements.map((requirement) => {
    const raw = modelMatches.find((item) => item.requirementId === requirement.id);
    const allowed = new Set((claimsByRequirement.get(requirement.id) ?? []).map((claim) => claim.id));
    const evidenceClaimIds = [...new Set((raw?.evidenceClaimIds ?? []).filter((id) => allowed.has(id)))];
    const resumeQuotes = [...new Set([
      ...(raw?.resumeQuotes ?? []).map((item) => item.trim()).filter((item) => item.length >= 2 && input.originalResume.includes(item)),
      ...findResumeQuotes(input.originalResume, atomById.get(requirement.id)!),
    ])].slice(0, 3);
    let strength: EvidenceStrength = resumeQuotes.length ? "weak" : "none";
    for (const id of evidenceClaimIds) {
      const claim = claimById.get(id) ?? null;
      const next = determineEvidenceStrength({ claim, resumeQuotes });
      if (strengthRank(next) > strengthRank(strength)) strength = next;
      if (claim?.kind === "result") resultEvidenceRequirementIds.add(requirement.id);
      if (claim?.metrics.some((metric) => metric.value && metric.unit && metric.method && metric.sourceNote)) completeMetricRequirementIds.add(requirement.id);
    }
    evidenceByRequirement.set(requirement.id, strength);
    return {
      requirementId: requirement.id,
      jdRequirement: requirement.requirement,
      evidenceClaimIds,
      resumeQuotes,
      resumeEvidence: evidenceClaimIds.length || resumeQuotes.length ? raw?.resumeEvidence ?? "已找到可校验引用" : "未找到可校验事实或原简历引用",
      matchRationale: raw?.matchRationale ?? "",
      evidenceStrength: strength,
      missingEvidenceTypes: raw?.missingEvidenceTypes ?? [],
      needsSupplement: strength === "none" || strength === "weak",
      optimizationSuggestion: raw?.optimizationSuggestion ?? "补充真实事实后再生成简历表述。",
    };
  });
  const unresolvedHighImpactUnknowns = document.hypotheses.filter((item) => item.status === "unknown" && item.decisionImpact === "high").length;
  const readiness = calculateJobReadiness({ requirements: atoms, evidenceByRequirement, resultEvidenceRequirementIds, completeMetricRequirementIds, unresolvedHighImpactUnknowns });
  const requirementAssessments = assessRequirements(atoms, matchItems);
  const readinessV2 = calculateJobReadinessV2({ requirements: atoms, requirementAssessments, unresolvedHighImpactUnknowns });
  const supplementPlan = planSupplementTasks(atoms, requirementAssessments);
  const followUpQuestions: AnalysisResult["followUpQuestions"] = [...supplementPlan.primary, ...supplementPlan.optional].slice(0, 12);
  const summary = summaryFromConfirmed(document);
  const dimensionScores = [readinessV2.coverageScore, readinessV2.trustScore, readinessV2.resultQualityScore].map((item) => ({
    dimension: item.label, score: item.value ?? 0, comment: item.applicable ? "按当前已确认需求与可核验引用确定性计算" : "当前岗位要求中不适用",
  }));
  const raw: AnalysisResult = {
    jdAnalysis: {
      ...summary,
      sourceItems: document.sourceSpans.filter((item) => item.role !== "heading").map((item) => ({ id: item.id, text: item.text, startOffset: item.startOffset, endOffset: item.endOffset, classification: item.role === "requirement" ? "requirement" : item.role === "background" ? "background" : item.role === "benefit" ? "benefit" : "irrelevant" })),
      requirements,
      roleInference: legacyRoleInference(document.hypotheses, document),
      clarificationNeeds: document.hypotheses.filter((item) => item.status === "unknown").map((item) => ({ id: `clarify-${item.id}`, topic: item.type, missingInformation: item.conclusion, impact: `决策影响：${item.decisionImpact}`, suggestedInput: "向招聘方确认", verificationQuestion: item.verificationQuestion })),
    },
    diagnosis: {
      overallScore: readinessV2.overallScore,
      dimensionScores,
      mainIssues: readinessV2.gapRequirementIds.map((id) => atoms.find((item) => item.id === id)?.normalizedText ?? id),
      prioritySuggestions: readinessV2.explanation,
    },
    matchItems,
    followUpQuestions,
    optimizedItems: [],
    finalResume: buildConservativeResume(input),
    interviewPrep: { likelyQuestions: [], evidenceToPrepare: [], possibleExaggerations: [], dataToSupplement: [], selfIntroduction: "", requirementStrategies: [], reverseQuestions: [] },
    jobReadiness: readiness,
    jobReadinessV2: readinessV2,
  };
  execution.onDecisionProgress?.({ type: "stage-completed", stage: "fact-match", message: "事实匹配与岗位准备度已完成" });
  if (execution.signal?.aborted) throw new AnalysisCancelledError();
  return { result: persistedAnalysisResultSchema.parse(normalizeAnalysisResult(raw, input)), mode };
}
