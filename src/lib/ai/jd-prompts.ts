import type { CareerAnalysisClaim } from "@/lib/career/career-context";
import type { JDSourceItem, JobRequirement, JobTargetContext, MatchItem, UserInput } from "@/types/resume";

function targetContext(input: UserInput, context: JobTargetContext): string {
  return [
    `目标岗位：${input.targetRole}`,
    `行业：${input.industry || "未填写"}`,
    `目标公司：${context.companyName || "未填写"}`,
    `岗位背景补充：${context.notes || "未填写"}`,
    `求职阶段：${input.jobStage}`,
  ].join("\n");
}

export function buildDeepJDPrompt(input: UserInput, context: JobTargetContext, sourceItems: JDSourceItem[]): string {
  return `请把下列 JD 做成可追溯的岗位需求地图。只能使用给出的 JD 与岗位背景，不得联网或杜撰公司事实。

${targetContext(input, context)}

【确定性拆分后的原始条目】
${JSON.stringify(sourceItems.map(({ id, text }) => ({ id, text })), null, 2)}

要求：
1. sourceClassifications 必须逐条覆盖每个原始条目，分类只能是 requirement/background/benefit/irrelevant，不得遗漏。
2. 一条原文包含多个能力或条件时拆成多个原子要求，但它们保留同一个 sourceItemId；最多 40 条。
3. sourceQuote 必须逐字截取对应原始条目的连续片段。
4. 每条要求提供类别、must/preferred/context 优先级、关键词及面试验证重点。
5. roleInference.items 覆盖 work-content、work-focus、business-line、team-state、business-scenario、team-pain、implicit-expectation、reporting-line、industry-experience。
6. level=explicit 仅用于原文明示；level=inferred 必须有可引用依据；level=unknown 时 conclusion 写“信息不足”，并给出验证问题，不得下确定结论。
7. clarificationNeeds 说明未知信息会带来的影响、建议补充内容和验证问题。
8. responsibilities、hardRequirements、implicitRequirements、keywords、idealCandidate、coreCompetencies 同时给出供概览使用。
9. 所有描述保持简洁：单条尽量不超过 80 个汉字，概览列表各不超过 12 条，避免重复原文。

只返回 JSON。`;
}

export function buildRequirementMatchPrompt(
  input: UserInput,
  context: JobTargetContext,
  requirements: JobRequirement[],
  claims: CareerAnalysisClaim[],
): string {
  return `请基于已校验的岗位要求完成简历诊断、逐条事实匹配和定向补证。不得重新解释或创建岗位要求 ID、事实 ID。

${targetContext(input, context)}

【已校验岗位要求】
${JSON.stringify(requirements, null, 2)}

【服务端确定性筛选出的已确认事实，可能为空】
${claims.length ? JSON.stringify(claims, null, 2) : "[]（没有明确相关事实，不得回退或虚构其他事实）"}

【原简历】
${input.originalResume}

要求：
1. matchItems 必须每个 requirementId 恰好一条。evidenceClaimIds 只能引用上方事实 ID；resumeQuotes 只能逐字引用原简历连续片段。
2. 无可核验证据时 evidenceClaimIds/resumeQuotes 为空，evidenceStrength=none，needsSupplement=true。
3. matchRationale 解释匹配逻辑；missingEvidenceTypes 写明缺少职责、行动、决策、结果、指标或方法中的哪些类型。
4. followUpQuestions 最多 10 条，只针对最重要缺口。每条关联 requirementId，并给出 thinkingPrompts、answerFramework、honestNoExperience；placeholderExample 必须为空字符串。
5. 不得把示例、建议或岗位要求本身当作用户事实。
6. 诊断分是 AI 诊断分，不是 ATS 分。
7. 单条说明尽量不超过 100 个汉字，避免重复粘贴完整 JD 或简历。

只返回 JSON。`;
}

export function buildRequirementInterviewPrompt(
  input: UserInput,
  context: JobTargetContext,
  requirements: JobRequirement[],
  matchItems: MatchItem[],
  clarificationNeeds: Array<{ id: string; topic: string; missingInformation: string; verificationQuestion: string }>,
): string {
  return `请仅基于已校验 requirementId 生成逐条面试准备策略，不得重新理解 JD 或创造 ID。

${targetContext(input, context)}

【岗位要求】
${JSON.stringify(requirements, null, 2)}

【匹配结果】
${JSON.stringify(matchItems, null, 2)}

【未知项】
${JSON.stringify(clarificationNeeds, null, 2)}

要求：
1. requirementStrategies 对每个岗位要求恰好一条，包含验证方式、应体现内容、回答结构、事实、指标和夸大风险。
2. likelyQuestions 生成 5-10 题并关联 requirementId；建议回答只能给结构和真实材料提示，不得编造成就。
3. reverseQuestions 覆盖岗位边界、业务目标、团队现状、成功指标、协作关系、汇报关系；尽量关联 requirementId 或 clarificationNeedId。
4. selfIntroduction 保守使用原简历信息；不确定处省略，不补造公司、时间或数字。
5. 单条策略字段各使用 1-3 个简短要点，避免重复岗位原文。

只返回 JSON。`;
}

export function buildFollowUpGuidancePrompt(input: {
  targetRole: string; requirementId: string; requirement: string; question: string; purpose: string; thinkingPrompts: string[]; answerFramework: string[];
}): string {
  return `为用户提供一段“结构示范”，帮助其回答岗位补证问题。示范不是用户事实。

目标岗位：${input.targetRole}
岗位要求 ${input.requirementId}：${input.requirement}
问题：${input.question}
目的：${input.purpose}
思考提示：${input.thinkingPrompts.join("；")}
回答框架：${input.answerFramework.join(" → ")}

硬性要求：
1. example 必须包含【你的项目】或【你的经历】，并包含【指标口径】或【真实结果】。
2. 其他事实位置继续使用【你的角色】【具体行动】【约束条件】【时间范围】等占位符。
3. 不得写真实公司名、具体项目名、看似真实的数字或完整虚构案例。
4. 只返回 {"example":"..."}。`;
}
