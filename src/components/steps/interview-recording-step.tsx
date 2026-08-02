"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  FileAudio,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmptyState, SectionTitle } from "@/components/shared/ui-helpers";
import { useResumeStore } from "@/store/resume-store";
import { analyzeInterview, uploadInterviewRecording } from "@/services/ai/resumeAgent";
import type {
  InterviewAnalysisResult,
  DialogueTurn,
  FailurePoint,
  KnowledgePoint,
  InterviewRecordingMetadata,
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

const SAMPLE_TRANSCRIPT = `面试官：你好，先简单自我介绍一下，重点说下你和 AI 相关的经历。
求职者：好的，我是张明，3.5 年 B 端产品经理经验，主导过 WMS 仓储系统和经营数据报表平台。最近自学了 Prompt Engineering 和 LangChain，做过一个内部文档问答 Demo。
面试官：你那个文档问答 Demo 用的是什么模型？怎么做的检索？
求职者：用的 GPT-3.5，检索就是先切片然后 embedding 相似度匹配。
面试官：为什么用 GPT-3.5 不用 4？切片策略怎么定的？遇到长文档怎么处理上下文？
求职者：嗯……3.5 便宜嘛，切片我就是按 500 字切。长文档……其实没特别处理。
面试官：好。那你说说，如果让你设计一个 ToB 的智能客服，你会怎么拆解这个产品？
求职者：我会先做用户调研，看客户现在的客服痛点是什么。然后定 MVP，比如先做意图识别，再做自动回复。
面试官：MVP 范围怎么定？怎么衡量效果？准确率和召回率你怎么平衡？
求职者：MVP 我可能先覆盖 top 10 高频问题。效果嘛……看客户满意度吧。准确率召回率这个，我可能需要再研究一下。`;

export function InterviewRecordingStep() {
  const { userInput, activeDocumentId, jobApplications, interviewReviews, saveInterviewReview, deleteInterviewReview, setCurrentStep } = useResumeStore();
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [recordingMeta, setRecordingMeta] = useState<InterviewRecordingMetadata | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InterviewAnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded = await uploadInterviewRecording(file);
      setRecordingId(uploaded.id);
      setFileName(uploaded.fileName);
      setRecordingMeta({ id: uploaded.id, fileName: uploaded.fileName, fileSize: uploaded.fileSize, uploadedAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!transcriptText.trim()) {
      setError("请粘贴面试对话文本（可点击「使用示例对话」快速填充）");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const res = await analyzeInterview({
        transcriptText,
        resumeText: userInput.originalResume,
        targetRole: userInput.targetRole,
      });
      setResult(res);
      saveInterviewReview({ applicationId: applicationId || null, resumeDocumentId: activeDocumentId || null, transcriptText: transcriptText.trim(), result: res, recording: recordingMeta });
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div>
      <SectionTitle
        title="面试对话复盘"
        description="粘贴面试对话文本后进行 AI 分析；录音上传目前仅用于本地保存"
      />

      {interviewReviews.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-3"><CardTitle className="text-sm">已保存复盘记录</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[...interviewReviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((record) => {
              const application = jobApplications.find((item) => item.id === record.applicationId);
              return <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setTranscriptText(record.transcriptText); setResult(record.result); setApplicationId(record.applicationId ?? ""); setRecordingMeta(record.recording); setRecordingId(record.recording?.id ?? null); setFileName(record.recording?.fileName ?? null); }}>
                  <span className="font-medium">{application ? `${application.company} · ${application.role}` : "未关联投递"}</span>
                  <span className="ml-2 text-neutral-500">{new Date(record.createdAt).toLocaleString("zh-CN")} · {record.result.performance.overallScore} 分</span>
                </button>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => deleteInterviewReview(record.id)}>删除</Button>
              </div>;
            })}
          </CardContent>
        </Card>
      )}

      {/* 输入区 */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">1. 录音上传与对话文本</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1.5 block text-xs text-neutral-500">关联投递记录（可选）</Label>
            <select className="h-9 w-full max-w-md rounded-md border border-neutral-200 bg-white px-3 text-sm" value={applicationId} onChange={(event) => setApplicationId(event.target.value)}>
              <option value="">不关联投递</option>
              {jobApplications.map((item) => <option key={item.id} value={item.id}>{item.company} · {item.role} · {item.status}</option>)}
            </select>
          </div>

          {/* 上传 */}
          <div>
            <Label className="mb-1.5 block text-xs text-neutral-500">录音文件（音频，本地存储）</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    上传中
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    选择录音文件
                  </>
                )}
              </Button>
              {fileName && (
                <span className="flex items-center gap-1.5 text-xs text-neutral-600">
                  <FileAudio className="h-3.5 w-3.5 text-emerald-600" />
                  {fileName}
                  {recordingId && (
                    <Badge variant="secondary" className="font-normal">
                      已上传
                    </Badge>
                  )}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-neutral-400">
              上传的录音仅用于本地回放与管理。因本地无 STT 服务，转写需手动完成或在下方直接粘贴对话文本。
            </p>
          </div>

          {/* 对话文本输入 */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="text-xs text-neutral-500">面试对话文本（区分“面试官：”和“求职者：”）</Label>
              <button
                type="button"
                onClick={() => setTranscriptText(SAMPLE_TRANSCRIPT)}
                className="text-[11px] text-blue-500 hover:underline"
              >
                使用示例对话
              </button>
            </div>
            <Textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder={`面试官：你好，请先自我介绍一下。\n求职者：好的，我是……\n面试官：你说说你做过哪些项目？\n求职者：……`}
              className="min-h-[200px] font-mono text-xs leading-relaxed"
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              字数：{transcriptText.length}（建议至少 200 字以获得有效分析）
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button onClick={handleAnalyze} disabled={analyzing || !transcriptText.trim()}>
              {analyzing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  AI 分析中…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  开始 AI 诊断分析
                </>
              )}
            </Button>
            {result && (
              <Button variant="outline" size="sm" onClick={() => setResult(null)}>
                重置
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 分析结果 */}
      {result ? (
        <AnalysisResultView result={result} />
      ) : !analyzing ? (
        <EmptyState message="上传录音或粘贴对话文本后，点击「开始 AI 诊断分析」查看完整诊断结果" />
      ) : null}

      <div className="mt-6 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setCurrentStep("interview")}>
          查看面试准备
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ===== 分析结果展示 =====
function AnalysisResultView({ result }: { result: InterviewAnalysisResult }) {
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
