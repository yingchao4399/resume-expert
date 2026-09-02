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

你是一名有招聘和业务面试经验的 JD 分析专家。不要把 JD 当作关键词清单，而要回答“入职后要完成什么、交付什么、在什么约束下完成、招聘方如何验证”。

要求：
1. sourceClassifications 必须逐条覆盖每个原始条目，分类只能是 requirement/background/benefit/irrelevant，不得遗漏。
2. 一条原文包含多个能力或条件时拆成多个原子要求，但它们保留同一个 sourceItemId；每批最多 40 条候选，后续由独立全局归并阶段去重；不得为了条数合并不同要求。
3. sourceQuote 必须逐字截取对应原始条目的连续片段。
4. 每条要求提供类别、must/preferred/context 优先级、关键词及面试验证重点；规范表述必须包含动作、对象或产出，不能只复制原句。
5. 识别复合句中的独立任务、工具、经验年限、学历/证书、协作边界、否定条件和数字约束；不同约束不能合并成泛化能力。
6. 对“负责/推动/搭建”等职责，说明实际工作对象和可验证产出；JD 未写明的结果、指标或团队情况必须留空，不得推断成事实。
7. 本次只返回 sourceClassifications 和 requirements，不生成岗位画像、概览、补证问题或面试策略。
8. 单条尽量不超过 80 个汉字。

只返回 JSON。`;
}

export function buildRequirementMatchPrompt(
  input: UserInput,
  context: JobTargetContext,
  requirements: JobRequirement[],
  claims: Array<CareerAnalysisClaim & { candidateRequirementIds?: string[] }>,
): string {
  return `请基于已校验的岗位要求完成简历诊断和逐条事实匹配。不得重新解释或创建岗位要求 ID、事实 ID。

${targetContext(input, context)}

【已校验岗位要求】
${JSON.stringify(requirements, null, 2)}

【服务端确定性筛选出的已确认事实，可能为空】
${claims.length ? JSON.stringify(claims, null, 2) : "[]（没有明确相关事实，不得回退或虚构其他事实）"}

【原简历】
${input.originalResume}

要求：
1. matchItems 必须每个 requirementId 恰好一条。evidenceClaimIds 只能引用上方事实 ID，且该事实的 candidateRequirementIds 必须包含当前 requirementId；resumeQuotes 只能逐字引用原简历连续片段。
2. 无可核验证据时 evidenceClaimIds/resumeQuotes 为空，evidenceStrength=none，needsSupplement=true。
3. matchRationale 解释匹配逻辑；missingEvidenceTypes 写明缺少职责、行动、决策、结果、指标或方法中的哪些类型。
4. 本次只返回 diagnosis 和 matchItems；补证问题由系统根据缺口生成。
5. 不得把示例、建议或岗位要求本身当作用户事实。
6. diagnosis 只提供简短语义观察；服务端会忽略模型分数和 evidenceStrength，并根据已确认事实确定性重算岗位准备度。
7. 单条说明尽量不超过 100 个汉字，避免重复粘贴完整 JD 或简历。

只返回 JSON。`;
}

export function buildJobOverviewPrompt(input: UserInput, context: JobTargetContext, requirements: JobRequirement[]): string {
  return `请基于已校验的岗位要求生成紧凑岗位画像。不得联网，不得把推断写成公司事实。

${targetContext(input, context)}

【已校验岗位要求】
${JSON.stringify(requirements.map(({ id, requirement, sourceQuote, category, priority }) => ({ id, requirement, sourceQuote, category, priority })), null, 2)}

要求：
1. roleInference.items 覆盖 work-content、work-focus、business-line、team-state、business-scenario、team-pain、implicit-expectation、reporting-line、industry-experience。
2. level=explicit 仅用于原文明示；level=inferred 必须给出原文依据；level=unknown 时 conclusion 写“信息不足”。
3. clarificationNeeds 只列真正影响判断的未知项；idealCandidate 不超过 200 字。
4. 只返回 idealCandidate、roleInference 和 clarificationNeeds，不重复输出岗位要求。

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
