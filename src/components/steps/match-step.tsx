"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, EvidenceBadge, SectionTitle } from "@/components/shared/ui-helpers";
import { useResumeStore } from "@/store/resume-store";

export function MatchStep() {
  const { analysisResult, setCurrentStep, openFollowUpForRequirement } = useResumeStore();
  if (!analysisResult) return <EmptyState message="请先完成输入材料并开始分析" />;
  const { matchItems } = analysisResult;
  const assessmentById = new Map(analysisResult.jobReadinessV2?.requirementAssessments.map((item) => [item.requirementId, item]) ?? []);
  return (
    <div>
      <SectionTitle title="岗位要求与事实匹配" description="逐条核对已确认事实、原简历引用、证据强度与缺口；引用 ID 已由服务端校验" />
      <div className="mb-4 rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">这里展示 JD 要求覆盖情况。ATS 只会在最终简历确认后计算。</div>
      <Card className="mb-6">
        <CardHeader className="pb-3"><CardTitle className="text-sm">逐条岗位要求</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {matchItems.map((item, index) => {
            const assessment = assessmentById.get(item.requirementId ?? "");
            const coverageLabel = assessment?.coverageStatus === "covered" ? "已覆盖" : assessment?.coverageStatus === "partial" ? "部分覆盖" : "缺失";
            const trustLabel = assessment?.trustStatus === "confirmed" ? "事实已确认" : assessment?.trustStatus === "resume-unverified" ? "原简历待核验" : "无证据";
            return (
            <div key={`${item.requirementId}-${index}`} className="rounded-md border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-mono text-neutral-400">{item.requirementId || "旧版要求"}</p><p className="mt-1 text-sm font-medium">{item.jdRequirement}</p></div>
                <div className="flex items-center gap-2"><EvidenceBadge strength={item.evidenceStrength} /><Badge variant={assessment?.coverageStatus === "covered" ? "success" : "warning"}>{coverageLabel}</Badge><Badge variant="outline">{trustLabel}</Badge></div>
              </div>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded bg-neutral-50 p-3"><p className="text-xs font-medium text-neutral-500">已确认事实</p><p className="mt-1">{item.evidenceClaimIds?.length ? `${item.resumeEvidence}（${item.evidenceClaimIds.join("、")}）` : "无明确相关事实"}</p></div>
                <div className="rounded bg-neutral-50 p-3"><p className="text-xs font-medium text-neutral-500">原简历原文</p><p className="mt-1">{item.resumeQuotes?.length ? item.resumeQuotes.join("；") : "无可校验引用"}</p></div>
              </div>
              <p className="mt-3 text-xs text-neutral-600">匹配理由：{item.matchRationale || item.resumeEvidence}</p>
              {assessment?.evidenceBasis?.length ? <p className="mt-1 text-xs text-neutral-500">判断依据：{assessment.evidenceBasis.join("；")}</p> : null}
              {assessment?.matchConfidence && <p className="mt-1 text-xs text-neutral-500">匹配置信度：{assessment.matchConfidence === "high" ? "高" : assessment.matchConfidence === "medium" ? "中" : "低"}</p>}
              {!!item.missingEvidenceTypes?.length && <p className="mt-1 text-xs text-amber-700">缺失证据：{item.missingEvidenceTypes.join("、")}</p>}
              <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-neutral-600">建议：{item.optimizationSuggestion}</p>{item.needsSupplement && item.requirementId && <Button size="sm" variant="outline" onClick={() => openFollowUpForRequirement(item.requirementId!)}>针对该要求补证</Button>}</div>
            </div>);
          })}
        </CardContent>
      </Card>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setCurrentStep("follow-up")}>可选：核验或补充经历<ChevronRight className="h-4 w-4" /></Button><Button size="sm" onClick={() => setCurrentStep("optimize")}>直接进入制作<ChevronRight className="h-4 w-4" /></Button></div>
    </div>
  );
}
