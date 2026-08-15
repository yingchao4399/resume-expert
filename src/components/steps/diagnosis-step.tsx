"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  EmptyState,
  ListSection,
  ScoreRing,
  SectionTitle,
} from "@/components/shared/ui-helpers";
import { useResumeStore } from "@/store/resume-store";

export function DiagnosisStep() {
  const { analysisResult, setCurrentStep } = useResumeStore();

  if (!analysisResult) {
    return <EmptyState message="请先完成输入材料并开始分析" />;
  }

  const { diagnosis, jobReadiness } = analysisResult;
  const recommendationLabel = jobReadiness?.recommendation === "priority-apply"
    ? "优先投"
    : jobReadiness?.recommendation === "cautious-apply"
      ? "谨慎投"
      : "补证后再投";

  return (
    <div>
      <SectionTitle
        title="岗位准备度"
        description="按已确认岗位要求的优先级和可核验证据确定性计算，不代表录用概率"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-[160px_1fr]">
        <Card className="flex items-center justify-center py-6">
          <div className="text-center">
            <ScoreRing score={diagnosis.overallScore} />
            <p className="mt-2 text-xs text-neutral-500">岗位准备度估算</p>
            {jobReadiness && <p className="mt-1 text-sm font-medium text-blue-700">{recommendationLabel}</p>}
          </div>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">确定性分项</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {diagnosis.dimensionScores.map((d) => (
              <div key={d.dimension}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{d.dimension}</span>
                  <span className="tabular-nums text-neutral-500">{d.score}</span>
                </div>
                <Progress value={d.score} className="mb-1" />
                <p className="text-xs text-neutral-500">{d.comment}</p>
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
