"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Lightbulb, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, SectionTitle } from "@/components/shared/ui-helpers";
import { generateFollowUpBullet, generateFollowUpGuidance } from "@/services/ai/resumeAgent";
import { useResumeStore } from "@/store/resume-store";
import { careerClaimsPrompt, selectRelevantClaims } from "@/lib/career/career-context";
import { useCareerDomain } from "@/hooks/use-career-domain";
import { isAnalysisFresh } from "@/lib/analysis-revision";

export function FollowUpStep() {
  const { snapshot: careerDomain } = useCareerDomain();
  const {
    analysisResult,
    userInput,
    updateFollowUpAnswer,
    setFollowUpBullet,
    setCurrentStep,
    materialRevision,
    analysisRevision,
    focusedRequirementId,
    setFollowUpGuidance,
    setFollowUpDecision,
  } = useResumeStore();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [guidanceLoadingId, setGuidanceLoadingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!focusedRequirementId) return;
    const questionId = analysisResult?.followUpQuestions.find((item) => item.requirementId === focusedRequirementId)?.id;
    if (questionId) setExpanded((value) => ({ ...value, [questionId]: true }));
    window.setTimeout(() => document.querySelector(`[data-requirement-id="${CSS.escape(focusedRequirementId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }, [analysisResult, focusedRequirementId]);

  if (!analysisResult) {
    return <EmptyState message="请先完成输入材料并开始分析" />;
  }
  const analysisFresh = isAnalysisFresh({ analysisResult, materialRevision, analysisRevision });

  const { followUpQuestions } = analysisResult;
  const requirements = analysisResult.jdAnalysis.requirements ?? [];

  const handleGuidance = async (id: string) => {
    const question = followUpQuestions.find((item) => item.id === id);
    if (!question?.requirementId) return;
    const requirement = requirements.find((item) => item.id === question.requirementId);
    if (!requirement) return;
    setGuidanceLoadingId(id); setError(null);
    try {
      const example = await generateFollowUpGuidance({ targetRole: userInput.targetRole, requirementId: requirement.id, requirement: requirement.requirement, question: question.question, purpose: question.purpose, thinkingPrompts: question.thinkingPrompts ?? [], answerFramework: question.answerFramework ?? [] });
      setFollowUpGuidance(id, example);
    } catch (err) { setError(err instanceof Error ? err.message : "示范生成失败"); }
    finally { setGuidanceLoadingId(null); }
  };

  const handleGenerateBullet = async (id: string) => {
    const question = followUpQuestions.find((q) => q.id === id);
    if (!question?.userAnswer.trim()) return;

    setLoadingId(id);
    setError(null);
    try {
      const bullet = await generateFollowUpBullet(
        { ...userInput, additionalInfo: [userInput.additionalInfo, careerClaimsPrompt(careerDomain, selectRelevantClaims(careerDomain, userInput.targetRole, userInput.jobDescription))].filter(Boolean).join("\n\n") },
        question.question,
        question.purpose,
        question.userAnswer
      );
      setFollowUpBullet(id, bullet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bullet 生成失败");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div>
      <SectionTitle title="可选核验与补充" description="默认只展示最高价值的 3 项；可以核验已有内容、补一个细节、说明没有经历或暂时跳过，均不阻塞制作" />

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 space-y-4">
        {followUpQuestions.slice(0, showMore ? followUpQuestions.length : 3).map((q, index) => (
          <Card key={q.id} data-requirement-id={q.requirementId} className={focusedRequirementId === q.requirementId ? "border-blue-300 ring-1 ring-blue-100" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-400">
                      追问 {index + 1}
                    </span>
                    <Badge variant="outline" className="font-normal">
                      {q.purpose}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-medium leading-snug">{q.question}</CardTitle>
                  {q.requirementId && <p className="mt-1 text-xs font-mono text-neutral-400">{q.requirementId}</p>}
                  {q.impactLabel && <p className="mt-1 text-xs text-blue-700">{q.impactLabel}</p>}
                </div>
                {q.decision && q.decision !== "unreviewed" && <Badge variant="outline">{q.decision === "verified-existing" ? "已核验" : q.decision === "answered" ? "已补充" : q.decision === "no-experience" ? "暂无经历" : "已跳过"}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {q.supplementNeed === "verify-existing" && <Button type="button" size="sm" variant="outline" onClick={() => setFollowUpDecision(q.id, "verified-existing")}>核验现有内容</Button>}
                <Button type="button" size="sm" variant="outline" onClick={() => setFollowUpDecision(q.id, "no-experience")}>明确没有相关经历</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setFollowUpDecision(q.id, "skipped")}>暂时跳过</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setExpanded((value) => ({ ...value, [q.id]: !value[q.id] }))}><Lightbulb className="h-3.5 w-3.5" />{expanded[q.id] ? "收起回答帮助" : "展开思考提示与框架"}</Button>
                <Button type="button" variant="outline" size="sm" disabled={guidanceLoadingId === q.id || !analysisFresh} onClick={() => handleGuidance(q.id)}>{guidanceLoadingId === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}生成占位符示范</Button>
              </div>
              {expanded[q.id] && <div className="rounded-md border border-blue-100 bg-blue-50/50 p-3 text-xs text-neutral-700">
                <p className="font-medium text-blue-800">思考提示</p><ul className="mt-1 list-disc space-y-1 pl-5">{(q.thinkingPrompts ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
                <p className="mt-3 font-medium text-blue-800">回答框架</p><p className="mt-1">{(q.answerFramework ?? []).join(" → ") || "场景 → 任务 → 行动 → 结果"}</p>
                <p className="mt-3 font-medium text-blue-800">没有相关经历时</p><p className="mt-1">{q.honestNoExperience || "如实说明，并补充最相近的可迁移经验。"}</p>
              </div>}
              {q.placeholderExample && <div className="rounded-md border border-violet-200 bg-violet-50 p-3"><p className="text-xs font-medium text-violet-800">虚构结构示范（不会自动填入或保存为事实）</p><p className="mt-1 text-sm">{q.placeholderExample}</p></div>}
              <div className="space-y-2">
                <Label htmlFor={`answer-${q.id}`}>你的回答</Label>
                <Textarea
                  id={`answer-${q.id}`}
                  className="min-h-[80px] text-sm"
                  placeholder="填写具体经历、数据和方法..."
                  value={q.userAnswer}
                  disabled={!analysisFresh}
                  onChange={(e) => updateFollowUpAnswer(q.id, e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!analysisFresh || !q.userAnswer.trim() || loadingId === q.id}
                onClick={() => handleGenerateBullet(q.id)}
              >
                {loadingId === q.id ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    生成简历 bullet
                  </>
                )}
              </Button>
              {q.generatedBullet && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
                  <p className="mb-1 text-xs font-medium text-emerald-700">生成的 bullet</p>
                  <p className="text-sm leading-relaxed text-neutral-700">{q.generatedBullet}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {followUpQuestions.length > 3 && <div className="-mt-3 mb-6 text-center"><Button type="button" variant="ghost" onClick={() => setShowMore((value) => !value)}>{showMore ? "收起更多可选补充" : `更多可选补充（${followUpQuestions.length - 3}）`}</Button></div>}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setCurrentStep(analysisFresh ? "optimize" : "input")}>
          {analysisFresh ? "进入制作（补证可稍后继续）" : "返回重新分析"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
