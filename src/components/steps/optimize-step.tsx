"use client";

import { useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, SectionTitle } from "@/components/shared/ui-helpers";
import { useResumeStore } from "@/store/resume-store";
import {
  finalizeResume,
  regenerateOptimizedItems,
  STYLE_LABELS,
} from "@/services/ai/resumeAgent";
import type { OptimizeStyle } from "@/types/resume";
import { cn } from "@/lib/utils";
import { confirmedEvidencePrompt } from "@/lib/evidence/resume-evidence";

const STYLE_OPTIONS: { value: OptimizeStyle; label: string }[] = [
  { value: "concise", label: "更简洁" },
  { value: "reduce-exaggeration", label: "降低夸张" },
  { value: "ai-product", label: "更偏 AI 产品" },
  { value: "tob-saas", label: "更偏 ToB SaaS" },
];

export function OptimizeStep() {
  const {
    analysisResult,
    userInput,
    careerEvidence,
    optimizeStyle,
    setOptimizeStyle,
    isFinalResumeStale,
    hasManualEdits,
    setOptimizedItems,
    setFinalResume,
    setCurrentStep,
  } = useResumeStore();
  const [regenerating, setRegenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  if (!analysisResult) {
    return <EmptyState message="请先完成输入材料并开始分析" />;
  }

  const handleStyleChange = async (style: OptimizeStyle) => {
    setOptimizeStyle(style);
    setRegenerating(true);
    setOptimizeError(null);
    try {
      const items = await regenerateOptimizedItems({ ...userInput, additionalInfo: [userInput.additionalInfo, confirmedEvidencePrompt(careerEvidence)].filter(Boolean).join("\n\n") }, style);
      setOptimizedItems(items);
    } catch (error) {
      setOptimizeError(error instanceof Error ? error.message : "优化生成失败");
    } finally {
      setRegenerating(false);
    }
  };


  const handleContinue = async () => {
    if (!isFinalResumeStale) {
      setCurrentStep("final-resume");
      return;
    }
    if (
      hasManualEdits &&
      !window.confirm(
        "重新生成会覆盖你在最终简历中的人工修改，是否继续？"
      )
    ) {
      return;
    }

    setFinalizing(true);
    setOptimizeError(null);
    try {
      const latestResult = useResumeStore.getState().analysisResult;
      if (!latestResult) return;
      const resume = await finalizeResume(
        { ...userInput, additionalInfo: [userInput.additionalInfo, confirmedEvidencePrompt(careerEvidence)].filter(Boolean).join("\n\n") },
        optimizeStyle,
        latestResult.optimizedItems,
        latestResult.followUpQuestions
      );
      setFinalResume(resume);
      setCurrentStep("final-resume");
    } catch (error) {
      setOptimizeError(error instanceof Error ? error.message : "最终简历生成失败");
    } finally {
      setFinalizing(false);
    }
  };

  const { optimizedItems } = analysisResult;

  return (
    <div>
      <SectionTitle
        title="简历优化"
        description="对照展示修改前/后的表达，附修改理由与风险提示"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-500">优化风格：</span>
        {STYLE_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={optimizeStyle === opt.value ? "default" : "outline"}
            size="sm"
            disabled={regenerating || finalizing}
            onClick={() => handleStyleChange(opt.value)}
            className={cn("h-7 text-xs")}
          >
            {opt.label}
          </Button>
        ))}
        {regenerating && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
      </div>

      {optimizeError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {optimizeError}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            修改对照表
            <Badge variant="secondary" className="ml-2 font-normal">
              {STYLE_LABELS[optimizeStyle]}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">模块</TableHead>
                <TableHead className="min-w-[180px]">修改前</TableHead>
                <TableHead className="min-w-[180px]">修改后</TableHead>
                <TableHead className="min-w-[120px]">修改理由</TableHead>
                <TableHead className="min-w-[120px]">风险提示</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {optimizedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.section}</TableCell>
                  <TableCell className="text-neutral-500">{item.before}</TableCell>
                  <TableCell className="text-neutral-900">{item.after}</TableCell>
                  <TableCell className="text-neutral-600">{item.reason}</TableCell>
                  <TableCell>
                    <span className="text-amber-700">{item.riskWarning}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-col items-end gap-2">
        {isFinalResumeStale && (
          <p className="text-xs text-amber-700">
            已检测到新的补充经历或优化风格，生成后才会写入最终简历。
          </p>
        )}
        <Button size="sm" onClick={handleContinue} disabled={regenerating || finalizing}>
          {finalizing ? "正在生成最终简历..." : isFinalResumeStale ? "应用补充并生成最终简历" : "下一步：最终简历"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
