import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  DialogueTurn,
  FailurePoint,
  InterviewAnalysisResult,
  KnowledgePoint,
} from "@/types/interview";
import { MindMap } from "@/components/interview/mind-map";
import { Fishbone } from "@/components/interview/fishbone";
import { cn } from "@/lib/utils";

const SEVERITY_CONFIG = {
  high: { label: "严重", variant: "danger" as const },
  medium: { label: "中等", variant: "warning" as const },
  low: { label: "轻微", variant: "secondary" as const },
};

const MASTERY_CONFIG: Record<
  KnowledgePoint["masteryLevel"],
  { label: string; variant: "success" | "warning" | "danger" | "secondary" }
> = {
  proficient: { label: "熟练", variant: "success" },
  familiar: { label: "熟悉", variant: "warning" },
  weak: { label: "薄弱", variant: "danger" },
  unknown: { label: "未知", variant: "secondary" },
};

const COVERAGE_CONFIG = {
  covered: { label: "已覆盖", variant: "success" as const },
  partial: { label: "部分覆盖", variant: "warning" as const },
  missing: { label: "缺失", variant: "danger" as const },
  overstated: { label: "过度包装", variant: "danger" as const },
};

const PRIORITY_CONFIG = {
  high: { label: "高", variant: "danger" as const },
  medium: { label: "中", variant: "warning" as const },
  low: { label: "低", variant: "secondary" as const },
};

export function InterviewAnalysisResultView({ result }: { result: InterviewAnalysisResult }) {
  return (
    <div className="space-y-6">
      {/* 1. 对话转写记录 */}
      <TranscriptView transcript={result.transcript} />

      {/* 2. 整体表现评分 */}
      <PerformanceView performance={result.performance} />

      {/* 3. 知识点与技术领域 */}
      <KnowledgeView knowledgePoints={result.knowledgePoints} />

      {/* 4. 失败点与回答不佳 */}
      <FailurePointsView failurePoints={result.failurePoints} />

      {/* 5. 可视化图表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">可视化图表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="mb-2 text-xs font-medium text-neutral-600">思维导图 - 知识结构</h4>
            <MindMap data={result.mindMap} />
          </div>
          <div>
            <h4 className="mb-2 text-xs font-medium text-neutral-600">鱼骨图 - 问题根因分析</h4>
            <Fishbone data={result.fishbone} />
          </div>
        </CardContent>
      </Card>

      {/* 6. 关键线索 */}
      <CluesView clues={result.clues} />

      {/* 7. 可积累经验与改进方向 */}
      <ExperienceAndImprovementsView
        insights={result.experienceInsights}
        improvements={result.improvements}
      />

      {/* 8. 简历优化匹配 */}
      <ResumeGapsView gaps={result.resumeGaps} />

      {/* 9. 心理学复盘建议 */}
      <PsychologyView advice={result.psychologyAdvice} />

      {/* 10. 摘要总结 */}
      <SummaryView summary={result.summary} />
    </div>
  );
}

function TranscriptView({ transcript }: { transcript: DialogueTurn[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">对话转写记录</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-md bg-neutral-50 p-3">
          {transcript.length === 0 ? (
            <p className="text-center text-xs text-neutral-400">无转写数据</p>
          ) : (
            transcript.map((turn) => {
              const isInterviewer = turn.speaker === "interviewer";
              return (
                <div
                  key={turn.id}
                  className={cn("flex", isInterviewer ? "justify-start" : "justify-end")}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-xs",
                      isInterviewer
                        ? "bg-white text-neutral-700 border border-neutral-200"
                        : "bg-blue-50 text-blue-900 border border-blue-100"
                    )}
                  >
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <span className={cn("text-[10px] font-medium", isInterviewer ? "text-neutral-500" : "text-blue-500")}>
                        {isInterviewer ? "面试官" : "我"}
                      </span>
                      {turn.timestamp && (
                        <span className="text-[10px] text-neutral-400">{turn.timestamp}</span>
                      )}
                    </div>
                    <p className="leading-relaxed">{turn.text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PerformanceView({ performance }: { performance: InterviewAnalysisResult["performance"] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">整体表现评估</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-4">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "text-4xl font-semibold tabular-nums",
                performance.overallScore >= 70
                  ? "text-emerald-600"
                  : performance.overallScore >= 50
                    ? "text-amber-600"
                    : "text-red-600"
              )}
            >
              {performance.overallScore}
            </span>
            <span className="text-xs text-neutral-500">总分 /100</span>
          </div>
          <div className="flex-1 space-y-1.5">
            {performance.dimensions.map((d) => (
              <div key={d.dimension} className="flex items-center gap-2">
                <span className="w-20 text-xs text-neutral-600">{d.dimension}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      d.score >= 70 ? "bg-emerald-500" : d.score >= 50 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${d.score}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs tabular-nums text-neutral-700">{d.score}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="mb-1.5 text-xs font-medium text-emerald-700">亮点</h4>
            <ul className="space-y-1">
              {performance.strengths.map((s, i) => (
                <li key={i} className="flex gap-1.5 text-xs text-neutral-600">
                  <span className="text-emerald-500">+</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-1.5 text-xs font-medium text-red-700">不足</h4>
            <ul className="space-y-1">
              {performance.weaknesses.map((s, i) => (
                <li key={i} className="flex gap-1.5 text-xs text-neutral-600">
                  <span className="text-red-500">-</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KnowledgeView({ knowledgePoints }: { knowledgePoints: KnowledgePoint[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">知识点与技术领域</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {knowledgePoints.map((kp, i) => {
          const cfg = MASTERY_CONFIG[kp.masteryLevel];
          return (
            <div key={i} className="rounded-md border border-neutral-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-medium text-neutral-900">{kp.domain}</h4>
                <Badge variant={cfg.variant}>{cfg.label}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {kp.points.map((p, j) => (
                  <span
                    key={j}
                    className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function FailurePointsView({ failurePoints }: { failurePoints: FailurePoint[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">失败点与回答不佳之处</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {failurePoints.map((fp) => {
          const cfg = SEVERITY_CONFIG[fp.severity];
          return (
            <div
              key={fp.id}
              className={cn(
                "rounded-md border-l-4 bg-neutral-50 p-3",
                fp.severity === "high"
                  ? "border-l-red-500"
                  : fp.severity === "medium"
                    ? "border-l-amber-500"
                    : "border-l-neutral-300"
              )}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <Badge variant={cfg.variant}>{cfg.label}</Badge>
                <span className="text-[10px] text-neutral-400">{fp.id}</span>
              </div>
              <p className="mb-1.5 text-xs font-medium text-neutral-900">Q：{fp.question}</p>
              <p className="mb-1.5 text-xs text-neutral-600">
                <span className="text-neutral-400">我的回答：</span>
                {fp.userAnswer}
              </p>
              <p className="mb-1.5 text-xs text-red-700">
                <span className="font-medium">问题：</span>
                {fp.issue}
              </p>
              <p className="text-xs text-emerald-700">
                <span className="font-medium">建议：</span>
                {fp.suggestion}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CluesView({ clues }: { clues: InterviewAnalysisResult["clues"] }) {
  const typeLabel: Record<string, string> = {
    focus: "关注点",
    implicit_expectation: "隐含期望",
    concern: "顾虑核实",
    signal: "岗位信号",
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">关键线索提取</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {clues.map((clue, i) => (
          <div key={i} className="rounded-md border border-neutral-200 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Badge variant="outline" className="font-normal">
                {typeLabel[clue.type] || clue.type}
              </Badge>
              <span className="text-xs font-medium text-neutral-900">{clue.label}</span>
            </div>
            <p className="mb-1 text-xs text-neutral-600">{clue.detail}</p>
            <p className="text-[11px] italic text-neutral-400">依据：{clue.evidence}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ExperienceAndImprovementsView({
  insights,
  improvements,
}: {
  insights: InterviewAnalysisResult["experienceInsights"];
  improvements: InterviewAnalysisResult["improvements"];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">可积累的面试经验</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {insights.map((ins, i) => (
            <div key={i} className="rounded-md bg-neutral-50 p-2.5">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-medium text-neutral-500">{ins.category}</span>
                {ins.reusable && (
                  <Badge variant="success" className="font-normal">
                    可复用
                  </Badge>
                )}
              </div>
              <p className="text-xs text-neutral-700">{ins.insight}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">改进方向与行动</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {improvements.map((imp, i) => {
            const cfg = PRIORITY_CONFIG[imp.priority];
            return (
              <div key={i} className="rounded-md border border-neutral-200 p-2.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-900">{imp.area}</span>
                  <Badge variant={cfg.variant}>{cfg.label}优先级</Badge>
                </div>
                <p className="mb-0.5 text-[11px] text-neutral-500">
                  现状：{imp.current}
                </p>
                <p className="mb-0.5 text-[11px] text-neutral-500">
                  目标：{imp.target}
                </p>
                <p className="text-xs text-emerald-700">行动：{imp.action}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function ResumeGapsView({ gaps }: { gaps: InterviewAnalysisResult["resumeGaps"] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">简历优化匹配（能力缺口 vs 简历）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {gaps.map((gap, i) => {
          const cfg = COVERAGE_CONFIG[gap.resumeCoverage];
          return (
            <div key={i} className="rounded-md border border-neutral-200 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-900">{gap.capability}</span>
                <Badge variant={cfg.variant}>{cfg.label}</Badge>
              </div>
              {gap.resumeEvidence && (
                <p className="mb-1 text-[11px] text-neutral-500">
                  简历依据：{gap.resumeEvidence}
                </p>
              )}
              <p className="text-xs text-blue-700">建议：{gap.suggestion}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function PsychologyView({ advice }: { advice: InterviewAnalysisResult["psychologyAdvice"] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">心理学复盘建议</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {advice.map((a, i) => (
          <div key={i} className="rounded-md border-l-4 border-l-purple-400 bg-purple-50/40 p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-semibold text-purple-800">{a.methodology}</span>
            </div>
            <p className="mb-1 text-[11px] text-neutral-500">适用情境：{a.situation}</p>
            <p className="mb-1.5 text-xs text-neutral-700">{a.advice}</p>
            {a.exercise && (
              <div className="rounded bg-white/60 p-2 text-[11px] text-purple-700">
                <span className="font-medium">练习：</span>
                {a.exercise}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SummaryView({ summary }: { summary: InterviewAnalysisResult["summary"] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">面试摘要总结</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="mb-1 text-xs font-medium text-neutral-500">整体概述</h4>
          <p className="text-sm leading-relaxed text-neutral-700">{summary.overview}</p>
        </div>

        <div>
          <h4 className="mb-1.5 text-xs font-medium text-neutral-500">核心问答</h4>
          <div className="space-y-2">
            {summary.keyQA.map((qa, i) => (
              <div key={i} className="rounded-md bg-neutral-50 p-2.5">
                <p className="mb-0.5 text-xs font-medium text-neutral-900">Q：{qa.question}</p>
                <p className="text-[11px] text-neutral-600">{qa.answerSummary}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-1.5 text-xs font-medium text-neutral-500">关键问题</h4>
          <ul className="space-y-1">
            {summary.keyIssues.map((issue, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-neutral-600">
                <span className="text-amber-500">!</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-1 text-xs font-medium text-neutral-500">整体评价</h4>
          <p className="text-sm leading-relaxed text-neutral-700">{summary.overallEvaluation}</p>
        </div>

        {summary.resultPrediction && (
          <div className="rounded-md bg-amber-50 p-3">
            <h4 className="mb-1 text-xs font-medium text-amber-700">结果预判</h4>
            <p className="text-xs text-amber-800">{summary.resultPrediction}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
