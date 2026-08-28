"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, CircleStop, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ListSection, SectionTitle } from "@/components/shared/ui-helpers";
import { useResumeStore } from "@/store/resume-store";
import { prepareInterviewStreaming, ResumeAnalysisCancelledError } from "@/services/ai/resumeAgent";
import type { InterviewPreparationProgressEvent } from "@/lib/ai/interview-preparation";
import { useNavigationTaskGuard } from "@/hooks/use-navigation-task-guard";

export function InterviewStep() {
  const { analysisResult, userInput, jobTargetContext, materialRevision, analysisRevision, setInterviewPrep, setCurrentStep } = useResumeStore();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<InterviewPreparationProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useNavigationTaskGuard(generating, () => abortRef.current?.abort());
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!analysisResult) {
    return <EmptyState message="请先完成输入材料并开始分析" />;
  }

  const { interviewPrep } = analysisResult;
  const requirements = new Map((analysisResult.jdAnalysis.requirements ?? []).map((item) => [item.id, item]));
  const strategies = interviewPrep.requirementStrategies ?? [];
  const reverseQuestions = interviewPrep.reverseQuestions ?? [];
  const hasInterviewPrep = Boolean(interviewPrep.selfIntroduction.trim() || interviewPrep.likelyQuestions.length || strategies.length || reverseQuestions.length);
  const analysisFresh = materialRevision === analysisRevision;

  const generate = async () => {
    if (!analysisFresh || generating) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true); setError(null); setNotice(null); setProgress(null);
    try {
      const prep = await prepareInterviewStreaming(userInput, jobTargetContext, analysisResult, materialRevision, { signal: controller.signal, onProgress: setProgress });
      if (!controller.signal.aborted && !setInterviewPrep(prep, materialRevision)) setError("材料已在生成期间变化，迟到结果未保存。请重新分析后再生成。");
    } catch (next) {
      if (next instanceof ResumeAnalysisCancelledError) setNotice(next.message);
      else setError(next instanceof Error ? next.message : "面试策略生成失败");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setGenerating(false);
    }
  };

  return (
    <div>
      <SectionTitle
        title="面试准备"
        description="核心诊断完成后按需生成，不阻塞简历制作"
      />

      {!hasInterviewPrep && (
        <Card className="mb-4">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">尚未生成面试策略</p>
            <p className="mt-2 text-xs text-neutral-500">将按每批最多 5 条岗位要求生成，已有分析和材料不会被覆盖。</p>
            <Button className="mt-4" size="sm" onClick={() => void generate()} disabled={!analysisFresh || generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "生成中" : "生成面试策略"}
            </Button>
            {generating && <Button className="ml-2 mt-4" size="sm" variant="outline" onClick={() => abortRef.current?.abort()}><CircleStop className="h-4 w-4" />取消</Button>}
            {!analysisFresh && <p className="mt-3 text-xs text-amber-700">材料已变化，请先重新分析。</p>}
            {progress && "message" in progress && <p className="mt-3 text-xs text-blue-700" role="status" aria-live="polite">{progress.message} · 已用 {Math.round(progress.elapsedMs / 1000)}s</p>}
            {notice && <p className="mt-3 text-xs text-neutral-600" role="status">{notice}</p>}
            {error && <div className="mt-3 text-xs text-red-700" role="alert">{error}<div><Button className="mt-2" size="sm" variant="outline" onClick={() => void generate()}>重新尝试</Button></div></div>}
          </CardContent>
        </Card>
      )}

      {hasInterviewPrep && <>

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">自我介绍</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-neutral-700">{interviewPrep.selfIntroduction}</p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-3"><CardTitle className="text-sm">逐条岗位要求面试策略</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {strategies.map((strategy) => <details key={strategy.requirementId} className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium"><span className="mr-2 font-mono text-xs text-neutral-400">{strategy.requirementId}</span>{requirements.get(strategy.requirementId)?.requirement ?? "岗位要求"}</summary>
            <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2"><div><p className="font-medium">面试官可能如何验证</p><ListSection title="" items={strategy.validationApproaches} /></div><div><p className="font-medium">回答应体现</p><ListSection title="" items={strategy.demonstrationPoints} /></div><div><p className="font-medium">推荐结构</p><p className="mt-1">{strategy.answerStructure.join(" → ")}</p></div><div><p className="font-medium">事实与指标</p><p className="mt-1">{[...strategy.evidenceNeeded, ...strategy.metricsNeeded].join("；")}</p></div><div className="sm:col-span-2"><p className="font-medium text-amber-700">夸大风险</p><p className="mt-1">{strategy.exaggerationRisks.join("；")}</p></div></div>
          </details>)}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-3"><CardTitle className="text-sm">反向提问：确认未知岗位信息</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">{reverseQuestions.map((item) => <div key={item.id} className="rounded-md border p-3"><p className="text-xs text-neutral-500">{item.topic}{item.clarificationNeedId ? ` · 对应未知项 ${item.clarificationNeedId}` : ""}</p><p className="mt-1 text-sm font-medium">{item.question}</p><p className="mt-1 text-xs text-neutral-600">目的：{item.purpose}</p></div>)}</CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">可能追问（{interviewPrep.likelyQuestions.length} 题）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {interviewPrep.likelyQuestions.map((q, i) => (
            <div key={i} className="rounded-md border border-neutral-100 p-4">
              <p className="mb-2 text-sm font-medium">
                Q{i + 1}. {q.question}
              </p>
              <p className="mb-2 text-sm text-neutral-600">
                <span className="font-medium text-neutral-700">建议回答：</span>
                {q.suggestedAnswer}
              </p>
              {q.evidenceNeeded.length > 0 && (
                <p className="text-xs text-neutral-500">
                  <span className="font-medium">需准备证据：</span>
                  {q.evidenceNeeded.join("；")}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">需要准备的证据</CardTitle>
          </CardHeader>
          <CardContent>
            <ListSection title="" items={interviewPrep.evidenceToPrepare} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">可能夸大的表达</CardTitle>
          </CardHeader>
          <CardContent>
            <ListSection title="" items={interviewPrep.possibleExaggerations} />
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">建议补充的数据</CardTitle>
          </CardHeader>
          <CardContent>
            <ListSection title="" items={interviewPrep.dataToSupplement} />
          </CardContent>
        </Card>
      </div>
      </>}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setCurrentStep("optimize")}>
          下一步：制作优化
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
