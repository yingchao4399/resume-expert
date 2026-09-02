"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, SectionTitle } from "@/components/shared/ui-helpers";
import { KeywordEvidenceCorrectionDialog, KeywordVerificationDialog } from "@/components/optimize/keyword-enhancement-dialogs";
import { useResumeStore } from "@/store/resume-store";
import { enhanceMissingKeywords, finalizeResume, regenerateOptimizedItems, STYLE_LABELS } from "@/services/ai/resumeAgent";
import type { OptimizeStyle, OptimizedItem } from "@/types/resume";
import { cn } from "@/lib/utils";
import { careerClaimsPrompt, selectRelevantClaims } from "@/lib/career/career-context";
import { useCareerDomain } from "@/hooks/use-career-domain";
import { useNavigationTaskGuard } from "@/hooks/use-navigation-task-guard";
import { isAnalysisFresh } from "@/lib/analysis-revision";
import { findCoveredKeywords, getConfirmedJDKeywords, getMissingKeywordCandidates, normalizeKeyword, splitTextByKeywords } from "@/lib/optimize/keyword-enhancement";
import { beginTask, completeTask, failTask } from "@/lib/tasks/task-runtime";
import { taskErrorPayload } from "@/lib/errors/app-error";

const STYLE_OPTIONS: { value: Exclude<OptimizeStyle, "custom">; label: string }[] = [
  { value: "concise", label: "更简洁" }, { value: "reduce-exaggeration", label: "降低夸张" },
  { value: "ai-product", label: "更偏 AI 产品" }, { value: "tob-saas", label: "更偏 ToB SaaS" },
];

export function OptimizeStep() {
  const { snapshot: careerDomain, save: saveCareerDomain } = useCareerDomain();
  const store = useResumeStore();
  const { analysisResult, userInput, optimizeStyle, customOptimizeInstruction, finalResumeStatus, hasManualEdits, materialRevision, analysisRevision, jdAnalysisDocument, activeDocumentId } = store;
  const [customDraft, setCustomDraft] = useState(customOptimizeInstruction);
  const [regenerating, setRegenerating] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [verifyItemId, setVerifyItemId] = useState<string | null>(null);
  const [correctItemId, setCorrectItemId] = useState<string | null>(null);
  useNavigationTaskGuard(regenerating || enhancing || finalizing);
  useEffect(() => { setCustomDraft(customOptimizeInstruction); setSelected({}); }, [activeDocumentId, customOptimizeInstruction]);

  const confirmedKeywords = useMemo(() => getConfirmedJDKeywords(jdAnalysisDocument), [jdAnalysisDocument]);
  if (!analysisResult) return <EmptyState message="请先完成输入材料并开始分析" />;
  if (!isAnalysisFresh({ analysisResult, materialRevision, analysisRevision })) return <EmptyState message="材料已变化，旧优化结果已锁定。请返回材料页重新分析。" />;

  const evidencePrompt = careerClaimsPrompt(careerDomain, selectRelevantClaims(careerDomain, userInput.targetRole, userInput.jobDescription));
  const updateItems = (mapper: (items: OptimizedItem[]) => OptimizedItem[]) => store.setOptimizedItems(mapper(useResumeStore.getState().analysisResult?.optimizedItems ?? []));
  const generateOptimizedItems = async (style: OptimizeStyle, instruction = customOptimizeInstruction) => {
    beginTask(activeDocumentId, "optimize", "正在生成优化方案");
    setRegenerating(true); setOptimizeError(null);
    try {
      const items = await regenerateOptimizedItems({ ...userInput, additionalInfo: [userInput.additionalInfo, evidencePrompt].filter(Boolean).join("\n\n") }, style, instruction);
      store.setOptimizedItems(items); setSelected({}); completeTask(activeDocumentId, "optimize", "优化方案已生成");
    } catch (error) { const payload = taskErrorPayload(error, "优化生成失败"); failTask(activeDocumentId, "optimize", payload); setOptimizeError(payload.userMessage); }
    finally { setRegenerating(false); }
  };
  const handleStyleChange = async (style: Exclude<OptimizeStyle, "custom">) => { store.setOptimizeStyle(style); await generateOptimizedItems(style); };
  const applyCustomStyle = async () => {
    const instruction = customDraft.trim();
    if (!instruction) { setOptimizeError("请先填写自定义优化风格。"); return; }
    store.setCustomOptimizeInstruction(instruction); store.setOptimizeStyle("custom");
    await generateOptimizedItems("custom", instruction);
  };

  const batchEnhance = async () => {
    const currentItems = useResumeStore.getState().analysisResult?.optimizedItems ?? [];
    const requestItems = currentItems.flatMap((item) => {
      const selectedKeywords = selected[item.id] ?? [];
      if (!selectedKeywords.length) return [];
      const evidence = careerDomain.claims.filter((claim) => claim.status === "confirmed" && careerDomain.experiences.some((experience) => experience.id === claim.experienceId && experience.status === "confirmed") && selectedKeywords.some((keyword) => normalizeKeyword(claim.text).includes(normalizeKeyword(keyword)))).slice(0, 12).map((claim) => ({ id: claim.id, text: claim.text }));
      return [{ itemId: item.id, section: item.section, currentText: item.after, selectedKeywords, evidence }];
    });
    if (!requestItems.length) { setOptimizeError("请先勾选需要增强的缺失关键词。"); return; }
    beginTask(activeDocumentId, "optimize", "正在增强缺失关键词"); setEnhancing(true); setOptimizeError(null);
    try {
      const enhancements = await enhanceMissingKeywords({ input: userInput, items: requestItems, allowedKeywords: confirmedKeywords, customInstruction: optimizeStyle === "custom" ? customOptimizeInstruction : "" });
      const byId = new Map(enhancements.map((draft) => [draft.itemId, draft]));
      updateItems((items) => items.map((item) => byId.has(item.id) ? { ...item, keywordEnhancement: byId.get(item.id)! } : item)); completeTask(activeDocumentId, "optimize", "关键词增强稿已生成");
    } catch (error) { const payload = taskErrorPayload(error, "关键词增强失败"); failTask(activeDocumentId, "optimize", payload); setOptimizeError(payload.userMessage); }
    finally { setEnhancing(false); }
  };

  const adopt = (itemId: string) => {
    updateItems((items) => items.map((item) => {
      const draft = item.id === itemId ? item.keywordEnhancement : null;
      if (!draft) return item;
      const adoptionStatus = draft.evidenceCorrectionSourceIds.length ? "evidence-confirmed" : "user-confirmed";
      return { ...item, after: draft.enhancedText, keywordEnhancement: { ...draft, adoptionStatus, verifiedAt: new Date().toISOString() } };
    }));
    setVerifyItemId(null);
  };
  const rejectOrRevoke = (itemId: string) => updateItems((items) => items.map((item) => {
    const draft = item.id === itemId ? item.keywordEnhancement : null;
    if (!draft) return item;
    const adopted = draft.adoptionStatus === "user-confirmed" || draft.adoptionStatus === "evidence-confirmed";
    return { ...item, after: adopted ? draft.sourceAfter : item.after, keywordEnhancement: { ...draft, adoptionStatus: "rejected", verifiedAt: null } };
  }));
  const regenerateAfterCorrection = async (claimId: string, sourceId: string, claimText: string) => {
    const item = useResumeStore.getState().analysisResult?.optimizedItems.find((value) => value.id === correctItemId);
    const draft = item?.keywordEnhancement;
    if (!item || !draft) return;
    const previousEvidence = careerDomain.claims
      .filter((claim) => draft.evidenceClaimIds.includes(claim.id))
      .map((claim) => ({ id: claim.id, text: claim.text }));
    const evidence = [...previousEvidence.filter((claim) => claim.id !== claimId), { id: claimId, text: claimText }];
    const [enhancement] = await enhanceMissingKeywords({ input: userInput, items: [{ itemId: item.id, section: item.section, currentText: draft.sourceAfter, selectedKeywords: draft.selectedKeywords, evidence }], allowedKeywords: confirmedKeywords, customInstruction: optimizeStyle === "custom" ? customOptimizeInstruction : "" });
    updateItems((items) => items.map((value) => value.id === item.id ? { ...value, keywordEnhancement: { ...enhancement, evidenceCorrectionSourceIds: Array.from(new Set([...draft.evidenceCorrectionSourceIds, sourceId])), adoptionStatus: "unverified" } } : value));
  };

  const handleContinue = async () => {
    const currentResult = useResumeStore.getState().analysisResult;
    if (!currentResult?.optimizedItems.length) { setOptimizeError("请先生成优化方案，再生成最终简历。"); return; }
    if (finalResumeStatus === "confirmed") { store.setCurrentStep("final-resume"); return; }
    if (hasManualEdits && !window.confirm("重新生成会覆盖你在最终简历中的人工修改，是否继续？")) return;
    beginTask(activeDocumentId, "finalize", "正在生成最终简历"); setFinalizing(true); setOptimizeError(null);
    try {
      const latestResult = useResumeStore.getState().analysisResult;
      if (!latestResult) return;
      const resume = await finalizeResume({ ...userInput, additionalInfo: [userInput.additionalInfo, evidencePrompt].filter(Boolean).join("\n\n") }, optimizeStyle, latestResult.optimizedItems, latestResult.followUpQuestions, optimizeStyle === "custom" ? customOptimizeInstruction : "");
      store.setFinalResume(resume); completeTask(activeDocumentId, "finalize", "最终简历已生成"); store.setCurrentStep("final-resume");
    } catch (error) { const payload = taskErrorPayload(error, "最终简历生成失败"); failTask(activeDocumentId, "finalize", payload); setOptimizeError(payload.userMessage); }
    finally { setFinalizing(false); }
  };

  const { optimizedItems } = analysisResult;
  const verifyItem = optimizedItems.find((item) => item.id === verifyItemId) ?? null;
  const correctItem = optimizedItems.find((item) => item.id === correctItemId) ?? null;
  return <div>
    <SectionTitle title="简历优化" description="对照修改内容，可选使用缺失关键词 AI 增强；补正证据不是下一步的强制条件" />
    <div className="mb-4 flex flex-wrap items-center gap-2"><span className="text-xs text-neutral-500">优化风格：</span>{STYLE_OPTIONS.map((option) => <Button key={option.value} variant={optimizeStyle === option.value ? "default" : "outline"} size="sm" disabled={regenerating || finalizing} onClick={() => void handleStyleChange(option.value)} className={cn("h-7 text-xs")}>{option.label}</Button>)}<Button variant={optimizeStyle === "custom" ? "default" : "outline"} size="sm" onClick={() => store.setOptimizeStyle("custom")}>自定义</Button>{regenerating && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}</div>
    {optimizeStyle === "custom" && <div className="mb-5 rounded-lg border bg-neutral-50 p-4"><label htmlFor="custom-optimize-instruction" className="text-sm font-medium">自定义优化风格</label><Textarea id="custom-optimize-instruction" className="mt-2" maxLength={300} value={customDraft} onChange={(event) => setCustomDraft(event.target.value)} placeholder="突出平台化能力，语气稳健，避免营销化表达" /><div className="mt-2 flex items-center justify-between"><span className="text-xs text-neutral-500">{customDraft.length}/300 · 只改变表达，不允许覆盖事实与证据边界</span><Button size="sm" disabled={regenerating || finalizing || !customDraft.trim()} onClick={() => void applyCustomStyle()}>应用自定义风格并生成</Button></div></div>}
    {optimizedItems.length === 0 && <Button className="mb-4" size="sm" disabled={regenerating || finalizing || optimizeStyle === "custom" && !customOptimizeInstruction.trim()} onClick={() => void generateOptimizedItems(optimizeStyle)}>{regenerating ? "正在生成优化方案…" : "生成优化方案"}</Button>}
    {optimizeError && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert" aria-live="assertive">{optimizeError}</div>}
    {optimizedItems.length > 0 ? <Card className="mb-6"><CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="text-sm">修改对照表<Badge variant="secondary" className="ml-2 font-normal">{STYLE_LABELS[optimizeStyle]}</Badge></CardTitle><Button size="sm" disabled={enhancing || !Object.values(selected).some((values) => values.length)} onClick={() => void batchEnhance()}>{enhancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{enhancing ? "正在批量增强…" : "批量 AI 增强"}</Button></div><p className="text-xs text-neutral-500">绿色=已覆盖，蓝色=已选择/采用，琥珀色=证据不足的候选，红色=尚未核验或高风险。</p></CardHeader><CardContent className="overflow-x-auto p-0 pb-2"><Table><TableHeader><TableRow><TableHead className="w-[90px]">模块</TableHead><TableHead className="min-w-[180px]">修改前</TableHead><TableHead className="min-w-[200px]">修改后</TableHead><TableHead className="min-w-[130px]">修改理由</TableHead><TableHead className="min-w-[280px]">缺失关键词 AI 增强</TableHead><TableHead className="min-w-[130px]">风险提示</TableHead></TableRow></TableHeader><TableBody>{optimizedItems.map((item) => <OptimizationRow key={item.id} item={item} allKeywords={confirmedKeywords} selected={selected[item.id] ?? []} onSelected={(keywords) => setSelected((value) => ({ ...value, [item.id]: keywords }))} onVerify={() => setVerifyItemId(item.id)} onCorrect={() => setCorrectItemId(item.id)} onReject={() => rejectOrRevoke(item.id)} />)}</TableBody></Table></CardContent></Card> : <div className="mb-6 rounded-lg border border-dashed bg-neutral-50 px-6 py-10 text-center"><p className="text-sm font-medium text-neutral-800">岗位分析已完成，尚未生成简历优化方案</p><p className="mt-2 text-xs text-neutral-500">点击“生成优化方案”后才会调用模型。</p></div>}
    <div className="flex flex-col items-end gap-2"><p className="text-xs text-neutral-500">关键词增强可全部跳过；未核验或暂不采用的增强稿不会进入最终简历。</p>{finalResumeStatus !== "confirmed" && <p className="text-xs text-amber-700">{finalResumeStatus === "stale" ? "当前制作内容已变化，重新生成后才可交付。" : "分析结果只是草稿，请生成最终简历后再进入交付。"}</p>}<Button size="sm" onClick={() => void handleContinue()} disabled={regenerating || finalizing || optimizedItems.length === 0}>{finalizing ? "正在生成最终简历..." : finalResumeStatus === "stale" ? "重新生成最终简历" : finalResumeStatus === "draft" ? "确认并生成最终简历" : "下一步：最终简历"}<ChevronRight className="h-4 w-4" /></Button></div>
    <KeywordVerificationDialog item={verifyItem} open={Boolean(verifyItem)} onOpenChange={(open) => !open && setVerifyItemId(null)} onConfirm={() => verifyItem && adopt(verifyItem.id)} />
    <KeywordEvidenceCorrectionDialog item={correctItem} documentId={activeDocumentId} snapshot={careerDomain} open={Boolean(correctItem)} onOpenChange={(open) => !open && setCorrectItemId(null)} persist={saveCareerDomain} onSaved={regenerateAfterCorrection} />
  </div>;
}

function OptimizationRow({ item, allKeywords, selected, onSelected, onVerify, onCorrect, onReject }: { item: OptimizedItem; allKeywords: string[]; selected: string[]; onSelected: (keywords: string[]) => void; onVerify: () => void; onCorrect: () => void; onReject: () => void }) {
  const covered = findCoveredKeywords(item.after, allKeywords);
  const candidates = getMissingKeywordCandidates(item, allKeywords);
  const draft = item.keywordEnhancement;
  const adopted = draft?.adoptionStatus === "user-confirmed" || draft?.adoptionStatus === "evidence-confirmed";
  return <TableRow><TableCell className="font-medium">{item.section}</TableCell><TableCell className="text-neutral-500">{item.before}</TableCell><TableCell className="text-neutral-900"><HighlightedText text={item.after} green={covered.filter((keyword) => !adopted || !draft?.selectedKeywords.includes(keyword))} blue={adopted ? draft?.selectedKeywords ?? [] : []} />{covered.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{covered.map((keyword) => <Badge key={keyword} variant="outline" className={adopted && draft?.selectedKeywords.includes(keyword) ? "border-blue-200 bg-blue-50 text-blue-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{keyword}</Badge>)}</div>}</TableCell><TableCell className="text-neutral-600">{item.reason}</TableCell><TableCell><div className="space-y-3">{candidates.length ? <div className="flex flex-wrap gap-1">{candidates.map((keyword) => <label key={keyword} className={cn("cursor-pointer rounded border px-2 py-1 text-xs", selected.includes(keyword) ? "border-blue-300 bg-blue-50 text-blue-700" : "border-amber-300 bg-amber-50 text-amber-800")}><input type="checkbox" className="sr-only" checked={selected.includes(keyword)} onChange={(event) => onSelected(event.target.checked ? [...selected, keyword].slice(0, 8) : selected.filter((value) => value !== keyword))} />{keyword}</label>)}</div> : <p className="text-xs text-emerald-700">当前文本已覆盖可用关键词</p>}{draft && <div className={cn("rounded-md border p-3 text-sm", adopted ? "border-blue-200 bg-blue-50" : draft.adoptionStatus === "rejected" ? "border-neutral-200 bg-neutral-50" : "border-red-200 bg-red-50")}><p className="leading-6">{draft.enhancedText}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className={adopted ? "text-blue-700" : draft.adoptionStatus === "rejected" ? "text-neutral-600" : "text-red-700"}>状态：{adopted ? "已核验采用" : draft.adoptionStatus === "rejected" ? "暂不采用" : "尚未核验"}</span>{draft.evidenceStatus !== "supported" && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">{draft.evidenceStatus === "missing" ? "缺少直接证据" : "证据不完整"}</Badge>}</div><div className="mt-3 flex flex-wrap gap-2">{!adopted && draft.adoptionStatus !== "rejected" && <><Button size="sm" onClick={onVerify}><ShieldCheck className="h-4 w-4" />核验并采用</Button><Button size="sm" variant="outline" onClick={onCorrect}>补正证据后采用</Button><Button size="sm" variant="ghost" onClick={onReject}>暂不采用</Button></>}{adopted && <Button size="sm" variant="outline" onClick={onReject}>撤销采用</Button>}{draft.adoptionStatus === "rejected" && <Button size="sm" variant="outline" onClick={onVerify}>重新核验</Button>}</div></div>}</div></TableCell><TableCell><span className="text-amber-700">{item.riskWarning}</span></TableCell></TableRow>;
}

function HighlightedText({ text, green, blue }: { text: string; green: string[]; blue: string[] }) {
  return <>{splitTextByKeywords(text, [...green, ...blue]).map((segment, index) => segment.keyword ? <mark key={`${segment.text}-${index}`} className={blue.some((value) => normalizeKeyword(value) === normalizeKeyword(segment.keyword!)) ? "rounded bg-blue-100 px-0.5 text-blue-900" : "rounded bg-emerald-100 px-0.5 text-emerald-900"}>{segment.text}</mark> : <span key={`${segment.text}-${index}`}>{segment.text}</span>)}</>;
}
