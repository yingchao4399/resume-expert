// 面试录音诊断与分析 - 类型定义

// 录音分类标签
export type RecordingCategory =
  | "技术面"
  | "行为面"
  | "HR 面"
  | "业务面"
  | "终面"
  | "其他";

// 录音元信息
export interface RecordingMeta {
  id: string;
  fileName: string;
  fileSize: number;
  durationSec?: number;
  uploadedAt: string; // ISO
  category: RecordingCategory;
  company?: string;
  position?: string;
  note?: string;
}

// 对话片段（区分面试官/求职者）
export type SpeakerRole = "interviewer" | "candidate";

export interface DialogueTurn {
  id: string;
  speaker: SpeakerRole;
  text: string;
  timestamp?: string; // 录音内时间戳 mm:ss
}

// 知识点 / 技术领域
export interface KnowledgePoint {
  domain: string; // 如 "前端基础"、"系统设计"
  points: string[]; // 具体知识点
  masteryLevel: "proficient" | "familiar" | "weak" | "unknown";
}

// 失败点 / 回答不佳之处
export interface FailurePoint {
  id: string;
  question: string;
  userAnswer: string; // 求职者的回答
  issue: string; // 问题在哪
  severity: "high" | "medium" | "low";
  suggestion: string; // 怎么答更好
}

// 整体表现评估
export interface PerformanceEvaluation {
  overallScore: number; // 0-100
  dimensions: {
    dimension: string; // 如 "技术深度"、"沟通表达"
    score: number;
    comment: string;
  }[];
  strengths: string[];
  weaknesses: string[];
}

// 可积累的面试经验
export interface ExperienceInsight {
  category: string; // 如 "高频考点"、"项目讲解技巧"
  insight: string;
  reusable: boolean; // 是否可复用到下次面试
}

// 改进方向
export interface ImprovementDirection {
  area: string;
  current: string; // 现状
  target: string; // 目标
  action: string; // 具体行动
  priority: "high" | "medium" | "low";
}

// 关键线索（面试官关注点、隐含期望等）
export interface InterviewClue {
  type: "focus" | "implicit_expectation" | "concern" | "signal";
  label: string;
  detail: string;
  evidence: string; // 对应的对话片段
}

// 简历优化匹配（能力缺口 vs 简历）
export interface ResumeGapItem {
  capability: string; // 暴露的能力缺口
  resumeCoverage: "covered" | "partial" | "missing" | "overstated";
  resumeEvidence?: string; // 简历中的相关内容
  suggestion: string; // 简历需要补充/强化/弱化的内容
}

// 心理学复盘建议
export interface PsychologyAdvice {
  methodology: string; // 方法论名称，如 "成长型思维"、"系统脱敏"
  situation: string; // 适用情境
  advice: string; // 具体建议
  exercise?: string; // 可执行的练习
}

// 鱼骨图（问题根因分析）
export interface FishboneCategory {
  category: string; // 如 "人"、"方法"、"知识"
  causes: string[];
}

export interface FishboneAnalysis {
  problem: string; // 中心问题
  categories: FishboneCategory[];
}

// 思维导图（知识结构）
export interface MindMapNode {
  label: string;
  children?: MindMapNode[];
}

// 结构化摘要
export interface InterviewSummary {
  overview: string; // 整体概述
  keyQA: { question: string; answerSummary: string }[]; // 核心问答
  keyIssues: string[]; // 关键问题
  overallEvaluation: string; // 整体评价
  resultPrediction?: string; // 结果预判
}

// 完整分析结果
export interface InterviewAnalysisResult {
  recordingId: string;
  transcript: DialogueTurn[];
  knowledgePoints: KnowledgePoint[];
  failurePoints: FailurePoint[];
  performance: PerformanceEvaluation;
  experienceInsights: ExperienceInsight[];
  improvements: ImprovementDirection[];
  clues: InterviewClue[];
  resumeGaps: ResumeGapItem[];
  psychologyAdvice: PsychologyAdvice[];
  mindMap: MindMapNode;
  fishbone: FishboneAnalysis;
  summary: InterviewSummary;
}
