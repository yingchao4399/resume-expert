"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, CircleStop, Loader2, Pencil, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, SectionTitle } from "@/components/shared/ui-helpers";
import { useResumeStore } from "@/store/resume-store";
import { useCareerDomain } from "@/hooks/use-career-domain";
import { buildCareerAnalysisClaims } from "@/lib/career/career-context";
import { ResumeAnalysisCancelledError, runRequirementMatchStreaming, type DecisionStreamEvent } from "@/services/ai/resumeAgent";
import type { JDRequirementAtom } from "@/types/jd-analysis";

const KIND_LABEL: Record<JDRequirementAtom["kind"], string> = {
  task: "任务", deliverable: "产出", knowledge: "知识", skill: "技能", tool: "工具", experience: "经验",
  education: "学历", credential: "证书", industry: "行业", collaboration: "协作", "work-context": "工作情境", constraint: "限制",
};
const MODALITY_LABEL: Record<JDRequirementAtom["modality"], string> = {
  required: "必须", preferred: "优先", optional: "可选", informational: "背景", negated: "否定条件",
};
const PRIORITY_LABEL: Record<JDRequirementAtom["priority"], string> = { critical: "关键", high: "高", medium: "中", low: "低" };
const REVIEW_LABEL: Record<JDRequirementAtom["reviewStatus"], string> = {
  "auto-validated": "可批量确认", "needs-review": "待复核", confirmed: "已确认", rejected: "已拒绝",
};

export function JDAnalysisStep() {
  const { snapshot } = useCareerDomain();
  const {
    jdAnalysisDocument, userInput, jobTargetContext, optimizeStyle, materialRevision, analysisResult,
    isAnalyzing, analysisError, setAnalyzing, setAnalysisError, updateJDRequirement,
    confirmSafeJDRequirements, confirmJDRequirement, rejectJDRequirement, confirmJDAnalysis,
    setAnalysisResult, setCurrentStep, openFollowUpForRequirement,
  } = useResumeStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editKind, setEditKind] = useState<JDRequirementAtom["kind"]>("task");
  const [editPriority, setEditPriority] = useState<JDRequirementAtom["priority"]>("medium");
  const [editModality, setEditModality] = useState<JDRequirementAtom["modality"]>("required");
  const [editHardGate, setEditHardGate] = useState(false);
  const [progress, setProgress] = useState<DecisionStreamEvent | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const requirements = jdAnalysisDocument?.requirements ?? [];
  const unresolved = requirements.filter((item) => !["confirmed", "rejected"].includes(item.reviewStatus));
  const confirmed = requirements.filter((item) => item.reviewStatus === "confirmed");
  const coveredSpans = useMemo(() => new Set(confirmed.flatMap((item) => item.sourceSpanIds)), [confirmed]);
  const requirementSpans = jdAnalysisDocument?.sourceSpans.filter((item) => item.role === "requirement") ?? [];

  if (!jdAnalysisDocument) {
    if (!analysisResult) return <EmptyState message="请先在材料页解析 JD" />;
    return (
      <div>
        <SectionTitle title="旧版 JD 分析（只读）" description="这份结果没有 V1.9.5 的需求地图 revision，不能继续匹配或制作" />
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">旧分析仍可查看，但已锁定。请返回材料页重新解析 JD，并逐条确认需求地图。</div>
        <div className="space-y-3">{(analysisResult.jdAnalysis.requirements ?? []).map((requirement) => <Card key={requirement.id}><CardContent className="p-4"><p className="text-sm font-medium">{requirement.requirement}</p><blockquote className="mt-2 border-l-2 pl-3 text-xs text-neutral-500">原文：{requirement.sourceQuote}</blockquote></CardContent></Card>)}</div>
        <Button className="mt-4" variant="outline" onClick={() => setCurrentStep("input")}>返回材料页重新解析</Button>
      </div>
    );
  }

  const beginEdit = (requirement: JDRequirementAtom) => {
    setEditingId(requirement.id);
    setEditText(requirement.normalizedText);
    setEditKind(requirement.kind);
    setEditPriority(requirement.priority);
    setEditModality(requirement.modality);
    setEditHardGate(requirement.isHardGate);
  };
  const saveEdit = () => {
    if (!editingId || !editText.trim()) return;
    updateJDRequirement(editingId, { normalizedText: editText.trim(), kind: editKind, modality: editModality, priority: editPriority, isHardGate: editHardGate, priorityBasis: ["用户人工复核"] });
    setEditingId(null);
  };
  const confirmMap = () => {
    setAnalysisError(null);
    confirmJDAnalysis();
  };
  const runMatch = async () => {
    if (jdAnalysisDocument.status !== "confirmed") {
      setAnalysisError("请先处理全部待复核项并确认整张需求地图。");
      return;
    }
    setAnalyzing(true);
    setAnalysisError(null);
    setProgress(null);
    const controller = new AbortController();
    controllerRef.current = controller;
    const expectedJDRevision = jdAnalysisDocument.revision;
    try {
      const result = await runRequirementMatchStreaming(
        userInput, jobTargetContext, buildCareerAnalysisClaims(snapshot), jdAnalysisDocument, optimizeStyle,
        { signal: controller.signal, onProgress: setProgress },
      );
      if (setAnalysisResult(result, materialRevision, expectedJDRevision)) setCurrentStep("diagnosis");
    } catch (error) {
      setAnalysisError(error instanceof ResumeAnalysisCancelledError ? error.message : error instanceof Error ? error.message : "事实匹配失败");
    } finally {
      controllerRef.current = null;
      setAnalyzing(false);
    }
  };

  const conclusion = confirmed.filter((item) => ["critical", "high"].includes(item.priority));
  const topMatch = analysisResult?.jobReadiness?.strongestRequirementIds[0];
  const topGap = analysisResult?.jobReadiness?.gapRequirementIds[0];

  return (
    <div>
      <SectionTitle title="JD 决策地图" description="先审核岗位要求，再用已确认要求匹配你的真实经历" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={confirmSafeJDRequirements} disabled={!requirements.some((item) => item.reviewStatus === "auto-validated")}>
          <ShieldCheck className="h-4 w-4" />批量确认安全项
        </Button>
        <Button size="sm" variant="outline" onClick={confirmMap} disabled={jdAnalysisDocument.status === "confirmed" || unresolved.length > 0}>
          <Check className="h-4 w-4" />确认需求地图
        </Button>
        <Button size="sm" onClick={runMatch} disabled={isAnalyzing || jdAnalysisDocument.status !== "confirmed"}>
          {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {isAnalyzing ? "匹配中" : "匹配真实经历"}
        </Button>
        {isAnalyzing && <Button size="sm" variant="outline" onClick={() => controllerRef.current?.abort()}><CircleStop className="h-4 w-4" />取消</Button>}
        <span className="text-xs text-neutral-500">已确认 {confirmed.length} · 待处理 {unresolved.length} · revision {jdAnalysisDocument.revision}</span>
      </div>
      {progress && "message" in progress && <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900" role="status">{progress.message}</div>}
      {analysisError && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{analysisError}</div>}
      {jdAnalysisDocument.status === "stale" && <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">材料已变化，这张需求地图只能查看。请返回材料页重新解析。</div>}

      <Tabs defaultValue="summary">
        <TabsList className="mb-4 grid h-auto w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="summary">先看结论</TabsTrigger>
          <TabsTrigger value="requirements">逐条要求</TabsTrigger>
          <TabsTrigger value="hypotheses">推断与未知</TabsTrigger>
          <TabsTrigger value="audit">原文审计</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card><CardHeader><CardTitle className="text-sm">岗位使命与核心产出</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{conclusion.slice(0, 5).map((item) => <p key={item.id}>{item.normalizedText}</p>)}{!conclusion.length && <p className="text-neutral-500">确认要求后生成。</p>}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">准入门槛</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{confirmed.filter((item) => item.isHardGate || item.modality === "required").slice(0, 5).map((item) => <p key={item.id}>{item.normalizedText}</p>)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">最大匹配</CardTitle></CardHeader><CardContent className="text-sm">{topMatch ? confirmed.find((item) => item.id === topMatch)?.normalizedText : "完成事实匹配后显示"}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">最高价值缺口</CardTitle></CardHeader><CardContent className="text-sm">{topGap ? confirmed.find((item) => item.id === topGap)?.normalizedText : "完成事实匹配后显示"}</CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="requirements" className="space-y-3">
          {requirements.map((requirement) => (
            <Card key={requirement.id} className={requirement.reviewStatus === "rejected" ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                  <span>{KIND_LABEL[requirement.kind]}</span><span>{MODALITY_LABEL[requirement.modality]}</span><span>优先级：{PRIORITY_LABEL[requirement.priority]}</span>
                  <span className={requirement.reviewStatus === "confirmed" ? "text-emerald-700" : "text-amber-700"}>{REVIEW_LABEL[requirement.reviewStatus]}</span>
                  {requirement.isHardGate && <span className="text-red-700">硬门槛</span>}
                </div>
                {editingId === requirement.id ? (
                  <div className="mt-3 space-y-3">
                    <Input value={editText} onChange={(event) => setEditText(event.target.value)} aria-label="规范化岗位要求" />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Select value={editKind} onValueChange={(value) => setEditKind(value as JDRequirementAtom["kind"])}><SelectTrigger aria-label="要求类别"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(KIND_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                      <Select value={editPriority} onValueChange={(value) => setEditPriority(value as JDRequirementAtom["priority"])}><SelectTrigger aria-label="要求优先级"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PRIORITY_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                      <Select value={editModality} onValueChange={(value) => setEditModality(value as JDRequirementAtom["modality"])}><SelectTrigger aria-label="要求语气"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MODALITY_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editHardGate} onChange={(event) => setEditHardGate(event.target.checked)} />这是用户确认的硬门槛</label>
                    <div className="flex gap-2"><Button size="sm" onClick={saveEdit}><Check className="h-4 w-4" />保存</Button><Button size="sm" variant="outline" onClick={() => setEditingId(null)}><X className="h-4 w-4" />取消</Button></div>
                  </div>
                ) : <p className="mt-2 text-sm font-medium">{requirement.normalizedText}</p>}
                <blockquote className="mt-2 border-l-2 pl-3 text-xs text-neutral-500">原文：{requirement.sourceQuote}</blockquote>
                <p className="mt-2 text-xs text-neutral-500">依据：{requirement.priorityBasis.join("；") || "待人工补充"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => beginEdit(requirement)}><Pencil className="h-4 w-4" />编辑</Button>
                  {requirement.reviewStatus !== "confirmed" && <Button size="sm" variant="outline" onClick={() => confirmJDRequirement(requirement.id)}><Check className="h-4 w-4" />确认</Button>}
                  {requirement.reviewStatus !== "rejected" && <Button size="sm" variant="outline" onClick={() => rejectJDRequirement(requirement.id)}><X className="h-4 w-4" />拒绝</Button>}
                  <Button size="sm" variant="outline" disabled={!analysisResult} onClick={() => openFollowUpForRequirement(requirement.id)}>补证</Button>
                  <Button size="sm" variant="outline" disabled={!analysisResult} onClick={() => setCurrentStep("interview")}>准备面试</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="hypotheses" className="space-y-3">
          {jdAnalysisDocument.hypotheses.map((item) => <Card key={item.id}><CardContent className="p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{item.conclusion}</p><span className="text-xs text-neutral-500">{item.status === "unknown" ? "信息不足" : "有依据推断"} · {item.decisionImpact === "high" ? "高影响" : item.decisionImpact === "medium" ? "中影响" : "低影响"}</span></div><p className="mt-2 text-xs text-neutral-500">依据：{item.confidenceBasis.join("；") || "无可校验原文依据"}</p><p className="mt-2 text-xs text-blue-700">验证问题：{item.verificationQuestion}</p>{item.alternativeExplanations.length > 0 && <p className="mt-2 text-xs text-neutral-500">替代解释：{item.alternativeExplanations.join("；")}</p>}</CardContent></Card>)}
          {!jdAnalysisDocument.hypotheses.length && <EmptyState message="Mock 模式不会生成岗位推断；请直接审核原文要求" />}
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card><CardHeader><CardTitle className="text-sm">原文覆盖</CardTitle></CardHeader><CardContent><p className="text-sm">岗位要求条目 {requirementSpans.length} 条，已由确认 atom 覆盖 {requirementSpans.filter((item) => coveredSpans.has(item.id)).length} 条。</p><div className="mt-3 space-y-2">{jdAnalysisDocument.sourceSpans.map((span) => <div key={span.id} className="flex gap-3 rounded bg-neutral-50 p-2 text-xs"><span className="shrink-0 text-neutral-500">{span.startOffset}–{span.endOffset}</span><span className="shrink-0">{span.role === "requirement" ? "岗位要求" : span.role === "heading" ? "标题" : span.role === "background" ? "岗位背景" : span.role === "benefit" ? "福利" : "无关"}</span><span>{span.text}</span>{span.role === "requirement" && !coveredSpans.has(span.id) && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />}</div>)}</div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">JD 质量风险</CardTitle></CardHeader><CardContent className="space-y-2">{jdAnalysisDocument.qualityFindings.map((item) => <div key={item.id} className="rounded border p-3 text-sm"><span className="mr-2 text-xs text-amber-700">{item.severity === "high" ? "高" : item.severity === "medium" ? "中" : "低"}</span>{item.message}</div>)}{!jdAnalysisDocument.qualityFindings.length && <p className="text-sm text-neutral-500">未发现确定性质量风险。</p>}</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
