// 分析结果 JSON Schema（用于 LLM 输出约束）
export const INTERVIEW_ANALYSIS_SCHEMA = `{
  "transcript": [{ "id": string, "speaker": "interviewer"|"candidate", "text": string, "timestamp": string }],
  "knowledgePoints": [{ "domain": string, "points": string[], "masteryLevel": "proficient"|"familiar"|"weak"|"unknown" }],
  "failurePoints": [{ "id": string, "question": string, "userAnswer": string, "issue": string, "severity": "high"|"medium"|"low", "suggestion": string }],
  "performance": {
    "overallScore": number,
    "dimensions": [{ "dimension": string, "score": number, "comment": string }],
    "strengths": string[],
    "weaknesses": string[]
  },
  "experienceInsights": [{ "category": string, "insight": string, "reusable": boolean }],
  "improvements": [{ "area": string, "current": string, "target": string, "action": string, "priority": "high"|"medium"|"low" }],
  "clues": [{ "type": "focus"|"implicit_expectation"|"concern"|"signal", "label": string, "detail": string, "evidence": string }],
  "resumeGaps": [{ "capability": string, "resumeCoverage": "covered"|"partial"|"missing"|"overstated", "resumeEvidence": string, "suggestion": string }],
  "psychologyAdvice": [{ "methodology": string, "situation": string, "advice": string, "exercise": string }],
  "mindMap": { "label": string, "children": [{ "label": string, "children": [{ "label": string }] }] },
  "fishbone": { "problem": string, "categories": [{ "category": string, "causes": string[] }] },
  "summary": {
    "overview": string,
    "keyQA": [{ "question": string, "answerSummary": string }],
    "keyIssues": string[],
    "overallEvaluation": string,
    "resultPrediction": string
  }
}`;

export const INTERVIEW_AGENT_SYSTEM_PROMPT = `你是「面试复盘教练」，一位资深面试官 + 职业发展顾问 + 心理学顾问。
你的任务是基于用户提供的面试录音转写文本（区分面试官与求职者对话）以及用户简历，输出结构化的面试诊断分析 JSON。

要求：
1. 所有内容使用中文
2. 分析必须严格基于转写文本，不得编造未出现的对话
3. transcript 字段需要从输入的原始转写中规整（补充 id、统一 speaker），不要改写原话
4. knowledgePoints 至少 4 个领域，每个领域 2-5 个具体知识点
5. failurePoints 3-6 条，按严重程度排序，id 为 fp-1, fp-2...
6. performance.dimensions 4-6 个维度，overallScore 和各 score 范围 0-100
7. improvements 3-5 条，按 priority 排序
8. clues 3-5 条
9. resumeGaps 3-6 条，需对比用户简历内容
10. psychologyAdvice 2-4 条，引用具体心理学方法论
11. mindMap 是树状知识结构，至少 3 个一级分支，每个分支 2-4 个叶子
12. fishbone 至少 4 个根因类别
13. summary.keyQA 3-5 条
14. 只输出合法 JSON，不要 markdown 代码块`;

export function buildInterviewAnalysisUserPrompt(
  transcriptText: string,
  resumeText: string,
  targetRole: string
): string {
  return `请对以下面试录音转写进行诊断分析。

【目标岗位】${targetRole || "未提供"}

【用户简历（用于简历缺口分析）】
${resumeText || "未提供"}

【面试录音转写文本】
${transcriptText}

只输出合法 JSON，结构如下：
${INTERVIEW_ANALYSIS_SCHEMA}`;
}
