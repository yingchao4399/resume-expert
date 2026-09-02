"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  EmptyState,
  ListSection,
  SectionTitle,
} from "@/components/shared/ui-helpers";
import { useResumeStore } from "@/store/resume-store";

export function DiagnosisStep() {
  const { analysisResult, setCurrentStep } = useResumeStore();

  if (!analysisResult) {
    return <EmptyState message="请先完成输入材料并开始分析" />;
  }

  const { diagnosis, jobReadiness } = analysisResult;
  const readiness = analysisResult.jobReadinessV2;
  const recommendation = readiness?.recommendation ?? jobReadiness?.recommendation;
  const recommendationLabel = recommendation === "priority-apply"
    ? "优先投"
    : recommendation === "cautious-apply"
      ? "谨慎投"
      : "补证后再投";
  const metrics = readiness ? [readiness.coverageScore, readiness.trustScore, readiness.resultQualityScore, readiness.hardGateCoverage, readiness.criticalRequirementCoverage] : diagnosis.dimensionScores.map((item) => ({ label: item.dimension, value: item.score, applicable: true, numerator: item.score, denominator: 100 }));
  const covered = readiness?.requirementAssessments.filter((item) => item.coverageStatus === "covered").length ?? 0;
  const trusted = readiness?.requirementAssessments.filter((item) => item.trustStatus === "confirmed").length ?? 0;

  return (
    <div>
      <SectionTitle
        title="岗位准备情况"
        description="先看覆盖、可信证据和高价值缺口；数字总分仅为实验估算，不代表录用概率"
      />

      {readiness && <div className="mb-5 grid gap-3 sm:grid-cols-4"><Summary label="已覆盖要求" value={`${covered}/${readiness.requirementAssessments.length}`} /><Summary label="可信事实" value={`${trusted}/${readiness.requirementAssessments.length}`} /><Summary label="高价值缺口" value={`${readiness.gapRequirementIds.length}`} /><Summary label="推荐行动" value={recommendationLabel} /></div>}

      <div className="mb-6 grid gap-4 sm:grid-cols-[160px_1fr]">
        <Card className="flex items-center justify-center py-6">
          <div className="text-center">
            <p className="text-xs text-neutral-400">实验估算</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-neutral-700">{readiness?.overallScore ?? diagnosis.overallScore}<span className="text-sm font-normal text-neutral-400">/100</span></p>
            <p className="mt-2 text-xs text-neutral-500">用于发现准备缺口，不作为核心结论</p>
          </div>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">确定性分项</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.map((d) => (
              <div key={d.label}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{d.label}</span>
                  <span className="tabular-nums text-neutral-500">{d.applicable ? d.value : "不适用"}</span>
                </div>
                {d.applicable && <Progress value={d.value ?? 0} className="mb-1" />}
                <p className="text-xs text-neutral-500">{d.applicable ? "按已确认需求和当前证据确定性计算" : "当前 JD 没有这一类适用项，不计入总分"}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">高价值缺口</CardTitle>
          </CardHeader>
          <CardContent>
            <ListSection title="" items={diagnosis.mainIssues} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">准备建议</CardTitle>
          </CardHeader>
          <CardContent>
            <ListSection title="" items={diagnosis.prioritySuggestions} />
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setCurrentStep("match")}>
          下一步：匹配分析
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="py-4"><p className="text-xs text-neutral-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></CardContent></Card>;
}
