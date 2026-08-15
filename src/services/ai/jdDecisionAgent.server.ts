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
import type { WorkflowExecutionOptions } from "@/lib/studio/execution";
import type { CareerAnalysisClaim } from "@/lib/career/career-context";
import type { AnalysisResult, EvidenceStrength, JobRequirement, JobRoleInferenceItem, JobTargetContext, UserInput } from "@/types/resume";
import type { JDAnalysisDocument, JDRequirementAtom, JDRequirementAtomDraft, RoleHypothesis } from "@/types/jd-analysis";
import type { AIMode } from "@/lib/ai/types";

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

function decisionBudget(execution: Execution): AnalysisExecutionBudget {
  return execution.analysisBudget ?? new AnalysisExecutionBudget({
    signal: execution.signal,
    deadlineAt: Date.now() + 120_000,
    maxProviderRequests: 6,
    providerTimeoutMs: 60_000,
  });
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

function mockJDDocument(input: UserInput, materialRevision: number): JDAnalysisDocument {
  const spans = parseJDSourceSpans(input.jobDescription);
  const drafts: JDRequirementAtomDraft[] = spans.filter((span) => span.role === "requirement").slice(0, 40).map((span) => ({
    sourceSpanId: span.id,
    sourceQuote: span.text,
    normalizedText: span.text.replace(/^\s*(?:[-*•·▪◦]|\d+[.)、])\s*/, ""),
    kind: /负责|推动|制定|完成|搭建/.test(span.text) ? "task" : /学历|本科|硕士/.test(span.text) ? "education" : /经验|年/.test(span.text) ? "experience" : "skill",
    modality: /优先|加分/.test(span.text) ? "preferred" : /不要求|无需|不限/.test(span.text) ? "negated" : "required",
    priority: /必须|至少|以上/.test(span.text) ? "high" : "medium",
    priorityBasis: ["Mock 仅按原文显式词拆分"],
    keywords: [],
  }));
  const document = buildJDAnalysisDocument({ sourceText: input.jobDescription, materialRevision, spans, drafts });
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

  const budget = decisionBudget(execution);
  const executor = new StructuredAnalysisExecutor(undefined, budget);
  const spans = parseJDSourceSpans(input.jobDescription);
  if (!spans.some((span) => span.role === "requirement")) throw new Error("JD 中没有可分析的岗位要求。");
  execution.onDecisionProgress?.({ type: "stage-started", stage: "jd-draft", message: "正在拆分 JD 原子要求" });
  const sourceItems = spans.filter((span) => span.role !== "heading").map((span) => ({
    id: span.id, text: span.text, startOffset: span.startOffset, endOffset: span.endOffset,
    classification: span.role === "benefit" ? "benefit" as const : span.role === "background" ? "background" as const : span.role === "irrelevant" ? "irrelevant" as const : "requirement" as const,
  }));
  const results = await executor.executeBatched({
    stage: "JD 需求解析",
    items: sourceItems,
    batchSize: 16,
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
  const legacyRequirements = document.requirements.filter((item) => item.anchorStatus === "validated").map(toLegacyRequirement);
  if (legacyRequirements.length) {
    const overview = await chatCompletionJSON({
      promptId: "resume.job-overview", system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildJobOverviewPrompt(input, jobTargetContext, legacyRequirements), schema: jobOverviewModelResultSchema,
      schemaName: "jd_role_hypotheses", maxTokens: 4000, timeoutMs: 60_000, batchSize: legacyRequirements.length,
      analysisStage: "JD 需求解析", model: execution.model, capture: execution.capture, analysisBudget: budget, signal: execution.signal,
    });
    document = { ...document, hypotheses: overviewHypotheses(overview.roleInference.items, document) };
  }
  document = { ...document, qualityFindings: deterministicQualityFindings(document) };
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
    evidence: item.sourceSpanIds.map((id) => spanMap.get(id)).filter((value): value is string => Boolean(value)),
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
  const mode = modeFor(execution);
  const atoms = document.requirements.filter((item) => item.reviewStatus === "confirmed" && item.modality !== "negated");
  if (!atoms.length) throw new Error("当前需求地图中没有已确认的有效岗位要求。");
  const requirements = atoms.map(toLegacyRequirement);
  const claimsByRequirement = rankCareerClaimsByRequirement(careerClaims, requirements, input, 3);
  execution.onDecisionProgress?.({ type: "stage-started", stage: "fact-match", message: "正在逐条匹配已确认事实" });

  let modelMatches: AnalysisResult["matchItems"] = [];
  if (mode === "llm") {
    const budget = decisionBudget(execution);
    const executor = new StructuredAnalysisExecutor(undefined, budget);
    const response = await executor.executeBatched({
      stage: "要求—事实匹配", items: requirements, batchSize: 12,
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
  const evidenceByRequirement = new Map<string, EvidenceStrength>();
  const resultEvidenceRequirementIds = new Set<string>();
  const completeMetricRequirementIds = new Set<string>();
  const matchItems = requirements.map((requirement) => {
    const raw = modelMatches.find((item) => item.requirementId === requirement.id);
    const allowed = new Set((claimsByRequirement.get(requirement.id) ?? []).map((claim) => claim.id));
    const evidenceClaimIds = [...new Set((raw?.evidenceClaimIds ?? []).filter((id) => allowed.has(id)))];
    const resumeQuotes = [...new Set((raw?.resumeQuotes ?? []).map((item) => item.trim()).filter((item) => item.length >= 2 && input.originalResume.includes(item)))];
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
  const followUpQuestions: AnalysisResult["followUpQuestions"] = matchItems.filter((item) => item.needsSupplement).slice(0, 10).map((item, index) => ({
    id: `fu-${index + 1}`, requirementId: item.requirementId, question: `请提供能证明“${item.jdRequirement}”的真实经历；如果没有，也请如实说明。`,
    purpose: `补充“${item.jdRequirement}”的可核验证据`, thinkingPrompts: ["当时是什么场景？", "你本人做了什么？", "结果如何验证？"],
    answerFramework: ["场景", "个人职责", "关键行动", "结果与口径"], honestNoExperience: "说明暂无直接经历，再补充最相近的可迁移经验。",
    placeholderExample: "", userAnswer: "", generatedBullet: "",
  }));
  const summary = summaryFromConfirmed(document);
  const dimensionScores = [
    { dimension: "硬门槛覆盖", score: readiness.hardGateCoverage, comment: "已确认硬门槛中存在可核验证据的比例" },
    { dimension: "关键任务覆盖", score: readiness.criticalRequirementCoverage, comment: "关键要求中存在可核验证据的比例" },
    { dimension: "结果证据", score: readiness.resultEvidenceScore, comment: "已关联结果事实的要求比例" },
    { dimension: "指标完整度", score: readiness.metricCompletenessScore, comment: "已关联完整量化口径的要求比例" },
  ];
  const raw: AnalysisResult = {
    jdAnalysis: {
      ...summary,
      sourceItems: document.sourceSpans.filter((item) => item.role !== "heading").map((item) => ({ id: item.id, text: item.text, startOffset: item.startOffset, endOffset: item.endOffset, classification: item.role === "requirement" ? "requirement" : item.role === "background" ? "background" : item.role === "benefit" ? "benefit" : "irrelevant" })),
      requirements,
      roleInference: legacyRoleInference(document.hypotheses, document),
      clarificationNeeds: document.hypotheses.filter((item) => item.status === "unknown").map((item) => ({ id: `clarify-${item.id}`, topic: item.type, missingInformation: item.conclusion, impact: `决策影响：${item.decisionImpact}`, suggestedInput: "向招聘方确认", verificationQuestion: item.verificationQuestion })),
    },
    diagnosis: {
      overallScore: readiness.overallScore,
      dimensionScores,
      mainIssues: readiness.gapRequirementIds.map((id) => atoms.find((item) => item.id === id)?.normalizedText ?? id),
      prioritySuggestions: readiness.explanation,
    },
    matchItems,
    followUpQuestions,
    optimizedItems: [],
    finalResume: buildConservativeResume(input),
    interviewPrep: { likelyQuestions: [], evidenceToPrepare: [], possibleExaggerations: [], dataToSupplement: [], selfIntroduction: "", requirementStrategies: [], reverseQuestions: [] },
    jobReadiness: readiness,
  };
  execution.onDecisionProgress?.({ type: "stage-completed", stage: "fact-match", message: "事实匹配与岗位准备度已完成" });
  return { result: normalizeAnalysisResult(raw, input), mode };
}
