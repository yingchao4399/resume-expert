"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, EvidenceBadge, SectionTitle } from "@/components/shared/ui-helpers";
import { ATSAssessmentCard } from "@/components/resume/ats-assessment-card";
import { calculateATSAssessment } from "@/lib/ats";
import { useResumeStore } from "@/store/resume-store";

export function MatchStep() {
  const { analysisResult, userInput, setCurrentStep, openFollowUpForRequirement } = useResumeStore();
  if (!analysisResult) return <EmptyState message="请先完成输入材料并开始分析" />;
  const { matchItems } = analysisResult;
  const assessment = calculateATSAssessment(userInput, analysisResult);
  return (
    <div>
      <SectionTitle title="岗位要求与事实匹配" description="逐条核对已确认事实、原简历引用、证据强度与缺口；引用 ID 已由服务端校验" />
      <ATSAssessmentCard assessment={assessment} />
      <Card className="mb-6">
        <CardHeader className="pb-3"><CardTitle className="text-sm">逐条岗位要求</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {matchItems.map((item, index) => (
            <div key={`${item.requirementId}-${index}`} className="rounded-md border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-mono text-neutral-400">{item.requirementId || "旧版要求"}</p><p className="mt-1 text-sm font-medium">{item.jdRequirement}</p></div>
                <div className="flex items-center gap-2"><EvidenceBadge strength={item.evidenceStrength} /><Badge variant={item.needsSupplement ? "warning" : "success"}>{item.needsSupplement ? "需补充" : "已覆盖"}</Badge></div>
              </div>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded bg-neutral-50 p-3"><p className="text-xs font-medium text-neutral-500">已确认事实</p><p className="mt-1">{item.evidenceClaimIds?.length ? `${item.resumeEvidence}（${item.evidenceClaimIds.join("、")}）` : "无明确相关事实"}</p></div>
                <div className="rounded bg-neutral-50 p-3"><p className="text-xs font-medium text-neutral-500">原简历原文</p><p className="mt-1">{item.resumeQuotes?.length ? item.resumeQuotes.join("；") : "无可校验引用"}</p></div>
              </div>
              <p className="mt-3 text-xs text-neutral-600">匹配理由：{item.matchRationale || item.resumeEvidence}</p>
              {!!item.missingEvidenceTypes?.length && <p className="mt-1 text-xs text-amber-700">缺失证据：{item.missingEvidenceTypes.join("、")}</p>}
              <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-neutral-600">建议：{item.optimizationSuggestion}</p>{item.needsSupplement && item.requirementId && <Button size="sm" variant="outline" onClick={() => openFollowUpForRequirement(item.requirementId!)}>针对该要求补证</Button>}</div>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => setCurrentStep("follow-up")}>下一步：经历追问<ChevronRight className="h-4 w-4" /></Button></div>
    </div>
  );
}
