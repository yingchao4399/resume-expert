import { delay } from "@/lib/utils";
import type { InterviewAnalysisResult } from "@/types/interview";

// Mock 对话转写（模拟一次 AI 产品经理岗位的技术+业务混合面试）
const MOCK_TRANSCRIPT = [
  { id: "t1", speaker: "interviewer" as const, text: "你好，先简单自我介绍一下，重点说下你和 AI 相关的经历。", timestamp: "00:30" },
  { id: "t2", speaker: "candidate" as const, text: "好的，我是张明，3.5 年 B 端产品经理经验，主导过 WMS 仓储系统和经营数据报表平台。最近自学了 Prompt Engineering 和 LangChain，做过一个内部文档问答 Demo。", timestamp: "00:45" },
  { id: "t3", speaker: "interviewer" as const, text: "你那个文档问答 Demo 用的是什么模型？怎么做的检索？", timestamp: "02:10" },
  { id: "t4", speaker: "candidate" as const, text: "用的 GPT-3.5，检索就是先切片然后 embedding 相似度匹配。", timestamp: "02:30" },
  { id: "t5", speaker: "interviewer" as const, text: "为什么用 GPT-3.5 不用 4？切片策略怎么定的？遇到长文档怎么处理上下文？", timestamp: "03:00" },
  { id: "t6", speaker: "candidate" as const, text: "嗯……3.5 便宜嘛，切片我就是按 500 字切。长文档……其实没特别处理。", timestamp: "03:30" },
  { id: "t7", speaker: "interviewer" as const, text: "好。那你说说，如果让你设计一个 ToB 的智能客服，你会怎么拆解这个产品？", timestamp: "05:00" },
  { id: "t8", speaker: "candidate" as const, text: "我会先做用户调研，看客户现在的客服痛点是什么。然后定 MVP，比如先做意图识别，再做自动回复。", timestamp: "05:30" },
  { id: "t9", speaker: "interviewer" as const, text: "MVP 范围怎么定？怎么衡量效果？客服场景里准确率和召回率你怎么平衡？", timestamp: "06:30" },
  { id: "t10", speaker: "candidate" as const, text: "MVP 我可能先覆盖 top 10 高频问题。效果嘛……看客户满意度吧。准确率召回率这个，我可能需要再研究一下。", timestamp: "07:00" },
  { id: "t11", speaker: "interviewer" as const, text: "你在 WMS 项目里说盘点效率提升 40%，这个数据怎么算的？", timestamp: "09:00" },
  { id: "t12", speaker: "candidate" as const, text: "就是上线前后盘点耗时对比，平均一次盘点从 8 小时降到 4.8 小时。", timestamp: "09:20" },
  { id: "t13", speaker: "interviewer" as const, text: "这个提升里，你负责的部分占多少？是流程优化还是系统功能带来的？", timestamp: "10:00" },
  { id: "t14", speaker: "candidate" as const, text: "主要是我重构了盘点流程，把线下步骤搬到线上。功能层面其实改动不大。", timestamp: "10:30" },
  { id: "t15", speaker: "interviewer" as const, text: "好，最后你有什么想问我的？", timestamp: "15:00" },
  { id: "t16", speaker: "candidate" as const, text: "想了解下团队目前 AI 产品的进度，以及这个岗位最看重什么能力？", timestamp: "15:30" },
];

export async function runMockInterviewAnalysis(
  _resumeText: string,
  _targetRole: string
): Promise<InterviewAnalysisResult> {
  void _resumeText;
  void _targetRole;
  await delay(1200);

  return {
    recordingId: "mock-rec-1",
    transcript: MOCK_TRANSCRIPT,
    knowledgePoints: [
      {
        domain: "LLM 基础",
        points: ["模型选型（GPT-3.5 vs 4）", "Embedding 检索", "上下文长度处理"],
        masteryLevel: "familiar",
      },
      {
        domain: "RAG 工程",
        points: ["文档切片策略", "相似度匹配", "长文档处理"],
        masteryLevel: "weak",
      },
      {
        domain: "AI 产品设计",
        points: ["ToB 智能客服拆解", "MVP 范围界定", "效果指标体系"],
        masteryLevel: "familiar",
      },
      {
        domain: "数据驱动",
        points: ["效果衡量指标", "准确率/召回率权衡", "用户满意度度量"],
        masteryLevel: "weak",
      },
      {
        domain: "项目数据归因",
        points: ["提升数据溯源", "贡献度拆解", "流程优化 vs 功能贡献"],
        masteryLevel: "proficient",
      },
    ],
    failurePoints: [
      {
        id: "fp1",
        question: "为什么用 GPT-3.5 不用 4？切片策略怎么定的？长文档怎么处理上下文？",
        userAnswer: "3.5 便宜嘛，切片按 500 字切。长文档没特别处理。",
        issue: "回答停留在表面理由（便宜），未体现对模型能力差异、切片策略（按语义/重叠窗口）、长上下文方案（map-reduce/父子文档）的理解。暴露 RAG 工程经验不足。",
        severity: "high",
        suggestion: "建议回答：选型上权衡成本与效果，3.5 用于 POC 验证可行性；切片采用语义+重叠窗口策略；长文档用父子检索或 map-reduce 摘要。并主动提及用 OpenAI evals 做了效果对比。",
      },
      {
        id: "fp2",
        question: "MVP 范围怎么定？怎么衡量效果？准确率和召回率怎么平衡？",
        userAnswer: "MVP 先覆盖 top 10 高频问题。效果看客户满意度。准确率召回率需要再研究。",
        issue: "MVP 定义偏粗（top10 太宽泛），效果指标只有满意度太滞后。准确率/召回率是 AI 产品核心指标，回答不上是硬伤。",
        severity: "high",
        suggestion: "MVP 应聚焦单一场景（如订单查询自动回复），效果指标分层：在线（准确率/召回率/转人工率）+ 离线（满意度/NPS）。准确率优先于召回率（错误回复比转人工代价更大）。",
      },
      {
        id: "fp3",
        question: "盘点效率提升 40% 里，你负责的部分占多少？是流程优化还是系统功能带来的？",
        userAnswer: "主要是我重构了盘点流程，把线下步骤搬到线上。功能层面改动不大。",
        issue: "回答诚实但缺乏结构。没主动量化个人贡献占比，没区分流程贡献与系统贡献的权重，错失展示数据归因能力的机会。",
        severity: "medium",
        suggestion: "建议回答：整体 40% 中，流程重构贡献约 60%，系统功能约 40%；个人主导流程设计并协同研发落地功能。给出归因方法（A/B 对比、分阶段上线验证）。",
      },
    ],
    performance: {
      overallScore: 62,
      dimensions: [
        { dimension: "技术深度", score: 48, comment: "RAG、模型选型回答浅，准确率/召回率失分严重" },
        { dimension: "产品思维", score: 70, comment: "ToB 拆解方向正确，但 MVP 与指标体系不够精细" },
        { dimension: "项目经验", score: 78, comment: "WMS 数据扎实，能说清提升来源，但归因表达待优化" },
        { dimension: "沟通表达", score: 75, comment: "条理清晰，但面对追问稍显被动，主动引导不足" },
        { dimension: "学习潜力", score: 65, comment: "有自学行动，但深度不够，未形成方法论" },
      ],
      strengths: [
        "B 端产品经验扎实，能讲清业务流程与数据结果",
        "有主动学习 AI 的行动（自学 Prompt/LangChain 并落地 Demo）",
        "面对追问诚实，不夸大",
      ],
      weaknesses: [
        "AI/LLM 技术深度不足，RAG 工程细节答不上",
        "AI 产品核心指标（准确率/召回率）掌握不牢",
        "项目贡献归因表达不够结构化",
      ],
    },
    experienceInsights: [
      {
        category: "高频考点",
        insight: "AI 产品岗必问：模型选型理由 + 效果指标体系 + 准确率/召回率权衡",
        reusable: true,
      },
      {
        category: "项目讲解技巧",
        insight: "讲项目数据时主动做归因（流程 vs 功能 vs 个人贡献占比），并用方法验证",
        reusable: true,
      },
      {
        category: "技术纵深",
        insight: "RAG 是 AI 产品岗基础考点，需掌握切片策略、检索增强、长文档处理三件套",
        reusable: true,
      },
      {
        category: "回答结构",
        insight: "面对开放式问题（如怎么拆解产品），先给框架再展开，避免直接跳到执行细节",
        reusable: true,
      },
    ],
    improvements: [
      {
        area: "RAG 工程知识",
        current: "仅做过简单 Demo，对切片、长文档、检索增强无深入理解",
        target: "能清晰讲解 RAG 主流方案与选型权衡",
        action: "精读 LangChain 文档的 RAG 章节；实现一个带父子检索的 Demo；整理 3 种切片策略对比笔记",
        priority: "high",
      },
      {
        area: "AI 产品指标体系",
        current: "只会用满意度，不了解准确率/召回率如何权衡",
        target: "能独立设计 AI 产品的分层效果指标",
        action: "学习搜索/推荐系统的评估方法；做一份智能客服的指标设计文档",
        priority: "high",
      },
      {
        area: "项目归因表达",
        current: "能说清结果，但归因被动",
        target: "主动用结构化方式讲清个人贡献与归因方法",
        action: "为每个简历项目准备 STAR + 归因两段式表达模板",
        priority: "medium",
      },
      {
        area: "面试主动引导",
        current: "被动回答追问较多",
        target: "能在回答中埋钩子，引导面试官问自己擅长的领域",
        action: "模拟面试练习，每答一题预留一个可深挖的点",
        priority: "low",
      },
    ],
    clues: [
      {
        type: "focus",
        label: "技术深度考察",
        detail: "面试官连问模型选型/切片/长文档三个纵深问题，明显在试探 RAG 实战深度",
        evidence: "t5: 为什么用 GPT-3.5 不用 4？切片策略？长文档？",
      },
      {
        type: "implicit_expectation",
        label: "期望有指标体系思维",
        detail: "问准确率/召回率，隐含期望候选人具备搜索/推荐背景或至少理解 ML 评估",
        evidence: "t9: 准确率和召回率你怎么平衡？",
      },
      {
        type: "concern",
        label: "对项目贡献度的核实",
        detail: "追问 40% 提升的归因，是在核实简历数据的真实性以及个人贡献占比",
        evidence: "t13: 这个提升里你负责的部分占多少？",
      },
      {
        type: "signal",
        label: "岗位偏向技术型产品经理",
        detail: "全程技术问题占比 60%+，说明这个 AI 产品岗偏技术型，非纯业务型",
        evidence: "整体问题分布：技术深度问题 4 题 / 产品设计 2 题 / 项目 1 题",
      },
    ],
    resumeGaps: [
      {
        capability: "RAG 工程实战（切片/长文档/检索增强）",
        resumeCoverage: "missing",
        suggestion: "简历只提'做过文档问答 Demo'，建议补一句技术细节：'基于语义切片 + 父子检索实现长文档问答，支持 50+ 页文档'",
      },
      {
        capability: "AI 产品效果指标体系设计",
        resumeCoverage: "missing",
        suggestion: "简历无任何 AI 效果指标描述，建议在报表平台项目里加：'建立分层效果指标（在线准确率 + 离线 NPS），驱动 3 轮迭代'",
      },
      {
        capability: "模型选型与评估方法论",
        resumeCoverage: "missing",
        suggestion: "简历未体现选型能力，建议补充：'对比 GPT-3.5/4 在文档问答任务的效果与成本，完成选型评估报告'",
      },
      {
        capability: "B 端 SaaS 产品经验",
        resumeCoverage: "covered",
        resumeEvidence: "WMS 服务 50+ 企业客户、报表平台覆盖三大主题",
        suggestion: "已覆盖，保持。面试中表现良好，可作为主线亮点",
      },
      {
        capability: "数据驱动与归因能力",
        resumeCoverage: "partial",
        resumeEvidence: "盘点效率提升 40%、月活 200+",
        suggestion: "数据有但归因弱，建议简历加：'通过 A/B 验证归因，流程重构贡献占比 60%'",
      },
    ],
    psychologyAdvice: [
      {
        methodology: "成长型思维（Growth Mindset）",
        situation: "面对连续追问答不上时容易自我否定",
        advice: "把'答不上'重新定义为'发现了知识边界'，这是面试最有价值的产出。每次卡壳后记下边界，下次就是成长点。",
        exercise: "面试后立即写下 3 个'今天发现我不知道的领域'，并标注优先级",
      },
      {
        methodology: "系统脱敏（Systematic Desensitization）",
        situation: "对技术深度面试有焦虑预期",
        advice: "把恐惧拆解到具体知识点（RAG 切片、指标权衡），逐个攻克，而不是笼统地怕'技术面'。",
        exercise: "列出害怕被问的 5 个具体问题，每个问题准备一段 30 秒的标准回答",
      },
      {
        methodology: "自我效能感建设（Self-Efficacy）",
        situation: "因 AI 经验不足产生冒名顶替感",
        advice: "回顾你已有的迁移优势（B 端产品方法论、数据驱动习惯），AI 是新场景但底层能力可复用。用'已有能力 + 待补能力'框架看待自己，而非'我什么都不懂'。",
        exercise: "写下 3 个'从 B 端产品迁移到 AI 产品的可复用能力'，作为面试开场自我介绍的底气",
      },
    ],
    mindMap: {
      label: "本次面试知识结构",
      children: [
        {
          label: "LLM 基础",
          children: [
            { label: "模型选型（3.5 vs 4）✓" },
            { label: "成本权衡 ✓" },
            { label: "能力差异对比 ✗" },
          ],
        },
        {
          label: "RAG 工程",
          children: [
            { label: "文档切片策略 ✗" },
            { label: "Embedding 检索 ✓" },
            { label: "长文档处理 ✗" },
            { label: "检索增强方案 ✗" },
          ],
        },
        {
          label: "AI 产品设计",
          children: [
            { label: "ToB 场景拆解 ✓" },
            { label: "MVP 范围界定 △" },
            { label: "效果指标体系 ✗" },
            { label: "准确率/召回率权衡 ✗" },
          ],
        },
        {
          label: "项目数据归因",
          children: [
            { label: "结果数据呈现 ✓" },
            { label: "归因方法（A/B）✗" },
            { label: "个人贡献占比 △" },
          ],
        },
      ],
    },
    fishbone: {
      problem: "面试表现未达预期（62/100，技术深度失分严重）",
      categories: [
        {
          category: "知识（Knowledge）",
          causes: [
            "RAG 工程知识停留在 Demo 层",
            "不了解准确率/召回率等 ML 评估指标",
            "模型选型只考虑成本，未考虑能力差异",
          ],
        },
        {
          category: "方法（Method）",
          causes: [
            "回答开放式问题直接跳细节，缺框架",
            "项目讲解未做归因结构化",
            "未提前准备 AI 产品指标设计案例",
          ],
        },
        {
          category: "人（Person）",
          causes: [
            "对 AI 技术深度有畏难预期",
            "面对追问被动应对，未主动引导",
          ],
        },
        {
          category: "环境（Environment）",
          causes: [
            "自学的 LangChain 资料偏入门，未深入工程实践",
            "缺乏 AI 产品的实际操盘环境",
          ],
        },
        {
          category: "材料（Material）",
          causes: [
            "简历 AI 相关内容单薄，无法支撑技术深问",
            "Demo 缺少可量化的效果数据",
          ],
        },
      ],
    },
    summary: {
      overview:
        "本次为 AI 产品经理岗位的技术+业务混合面试，时长约 16 分钟，覆盖 LLM/RAG 基础、AI 产品设计、项目数据归因三大板块。整体方向正确但技术深度不足，AI 核心指标（准确率/召回率）失分严重，最终预估通过概率偏低。",
      keyQA: [
        {
          question: "文档问答 Demo 的模型选型与切片策略？",
          answerSummary: "答 GPT-3.5（便宜）+ 500 字切片，长文档未处理。暴露 RAG 工程经验不足。",
        },
        {
          question: "ToB 智能客服如何拆解与衡量效果？",
          answerSummary: "方向对（调研→MVP→意图识别→自动回复），但 MVP 过宽、指标仅满意度、准确率召回率答不上。",
        },
        {
          question: "WMS 盘点效率 40% 提升的归因？",
          answerSummary: "诚实说明主要是流程重构贡献，但未量化占比，错失展示数据归因能力的机会。",
        },
      ],
      keyIssues: [
        "RAG 工程三件套（切片/长文档/检索增强）全面失分",
        "AI 产品核心指标（准确率/召回率）掌握不牢",
        "项目贡献归因表达不够结构化",
      ],
      overallEvaluation:
        "候选人 B 端产品基础扎实、有主动学习 AI 的行动力，但 AI 技术深度与产品指标思维距离岗位要求仍有差距。建议优先补齐 RAG 工程与 AI 指标体系两块短板后再战。",
      resultPrediction: "通过概率中等偏下（约 40%），主要取决于岗位是否接受'有潜力但需培养'的候选人。",
    },
  };
}
