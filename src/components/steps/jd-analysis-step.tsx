"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EmptyState,
  ImportanceBadge,
  KeywordTags,
  ListSection,
  SectionTitle,
} from "@/components/shared/ui-helpers";
import { useResumeStore } from "@/store/resume-store";

export function JDAnalysisStep() {
  const { analysisResult, setCurrentStep } = useResumeStore();

  if (!analysisResult) {
    return <EmptyState message="请先完成输入材料并开始分析" />;
  }

  const { jdAnalysis } = analysisResult;
  const requirements = jdAnalysis.requirements ?? [];
  const sourceItems = jdAnalysis.sourceItems ?? [];
  const roleInferences = jdAnalysis.roleInference?.items ?? [];
  const clarificationNeeds = jdAnalysis.clarificationNeeds ?? [];
  const levelLabel = { explicit: "原文明示", inferred: "有依据推断", unknown: "信息不足" } as const;

  return (
    <div>
      <SectionTitle
        title="JD 解析"
        description="从目标岗位描述中提取职责、要求、关键词与理想候选人画像"
      />

      {clarificationNeeds.length > 0 && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">岗位背景仍有 {clarificationNeeds.length} 个未知项</p>
          <p className="mt-1 text-xs">补充已知背景后需要重新分析；也可以把验证问题留到面试反向提问。</p>
          <Button className="mt-3" variant="outline" size="sm" onClick={() => setCurrentStep("input")}>返回材料页补充</Button>
        </div>
      )}

      <Card className="mb-6">
        <CardHeader className="pb-3"><CardTitle className="text-sm">原子岗位要求（{requirements.length}/40）</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {requirements.map((requirement) => (
            <div key={requirement.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-mono text-neutral-500">{requirement.id}</span><span className="rounded bg-neutral-100 px-2 py-0.5">{requirement.priority}</span><span className={requirement.anchorStatus === "validated" ? "text-emerald-700" : "text-amber-700"}>{requirement.anchorStatus === "validated" ? "引用已校验" : "引用待复核"}</span></div>
              <p className="mt-2 text-sm font-medium">{requirement.requirement}</p>
              <blockquote className="mt-2 border-l-2 pl-3 text-xs text-neutral-500">原文：{requirement.sourceQuote}</blockquote>
              <p className="mt-2 text-xs text-neutral-600">面试验证：{requirement.interviewFocus}</p>
            </div>
          ))}
          {!requirements.length && <p className="text-sm text-amber-700">这是旧版分析，尚无岗位需求地图。请返回材料页重新分析。</p>}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="pb-3"><CardTitle className="text-sm">岗位与团队推断边界</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {roleInferences.map((item, index) => (
            <div key={`${item.topic}-${index}`} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium">{item.topic}</span><span className="text-xs text-neutral-500">{levelLabel[item.level]} · {item.confidence}</span></div>
              <p className="mt-2 text-sm">{item.conclusion}</p>
              {item.evidence.length > 0 && <p className="mt-2 text-xs text-neutral-500">依据：{item.evidence.join("；")}</p>}
              <p className="mt-2 text-xs text-blue-700">验证问题：{item.verificationQuestion}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="pb-3"><CardTitle className="text-sm">JD 原始条目覆盖（{sourceItems.length} 条）</CardTitle></CardHeader>
        <CardContent className="space-y-2">{sourceItems.map((item) => <div key={item.id} className="flex gap-3 rounded bg-neutral-50 p-2 text-xs"><span className="shrink-0 font-mono text-neutral-400">{item.id}</span><span className="shrink-0 text-blue-700">{item.classification}</span><span>{item.text}</span></div>)}</CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">岗位职责</CardTitle>
          </CardHeader>
          <CardContent>
            <ListSection title="" items={jdAnalysis.responsibilities} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">硬性要求</CardTitle>
          </CardHeader>
          <CardContent>
            <ListSection title="" items={jdAnalysis.hardRequirements} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">隐性要求</CardTitle>
          </CardHeader>
          <CardContent>
            <ListSection title="" items={jdAnalysis.implicitRequirements} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">关键词</CardTitle>
          </CardHeader>
          <CardContent>
            <KeywordTags keywords={jdAnalysis.keywords} />
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">理想候选人画像</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-neutral-600">{jdAnalysis.idealCandidate}</p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">核心能力表</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">能力</TableHead>
                <TableHead className="w-[60px]">重要性</TableHead>
                <TableHead>说明</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jdAnalysis.coreCompetencies.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <ImportanceBadge importance={c.importance} />
                  </TableCell>
                  <TableCell className="text-neutral-600">{c.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setCurrentStep("diagnosis")}>
          下一步：简历诊断
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
