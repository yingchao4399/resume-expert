"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useResumeStore } from "@/store/resume-store";
import { runJDConsolidationStreaming } from "@/services/ai/resumeAgent";
import { applyConsolidation, mapFingerprint } from "@/lib/jd/consolidation";
import type { JDConsolidationProposal } from "@/types/jd-analysis";

export function JDConsolidationPanel() {
  const { activeDocumentId, jdAnalysisDocument: document, isAnalyzing, setAnalyzing, applyJDConsolidation, restoreJDMap, setDirtyScope } = useResumeStore();
  const [proposal, setProposal] = useState<JDConsolidationProposal | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setProposal(null); setSelected([]); setError(""); setMessage(""); setRunning(false);
    return () => { if (controller.current) { controller.current.abort(); controller.current = null; setAnalyzing(false); } };
  }, [activeDocumentId, setAnalyzing]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  if (!document) return null;

  const run = async () => {
    if (proposal && !window.confirm("放弃尚未应用的整理提案，重新生成吗？")) return;
    setError(""); setMessage("正在整理需求…"); setAnalyzing(true); setRunning(true);
    const abort = new AbortController(); controller.current = abort;
    const fingerprint = mapFingerprint(document);
    try {
      const result = await runJDConsolidationStreaming(document, { signal: abort.signal, onProgress: event => { if ("message" in event) setMessage(event.message ?? "正在整理"); } });
      const current = useResumeStore.getState();
      if (abort.signal.aborted || current.activeDocumentId !== activeDocumentId || !current.jdAnalysisDocument || mapFingerprint(current.jdAnalysisDocument) !== fingerprint) return;
      setProposal(result); setSelected(result.merges.map(item => item.id)); setDirtyScope("jd");
      setMessage("整理提案已生成，尚未覆盖原地图。请核对每项合并。");
    } catch (cause) { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "整理失败，原地图未改变。"); else setMessage("整理已取消，原地图未改变。"); }
    finally { if (controller.current === abort) { controller.current = null; setAnalyzing(false); setRunning(false); } }
  };
  let afterCount = document.requirements.length;
  let previewError = "";
  if (proposal) {
    try { afterCount = applyConsolidation(document, proposal, selected).requirements.length; }
    catch (cause) { previewError = cause instanceof Error ? cause.message : "提案已过期"; }
  }
  return <section className="mb-4 space-y-3 rounded-lg border bg-white p-4" aria-label="需求语义整理">
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => void run()} disabled={isAnalyzing || document.status === "stale"}>重新整理需求</Button>
      {running && <Button variant="outline" onClick={() => controller.current?.abort()}>取消整理</Button>}
      {document.previousMap && <Button variant="outline" disabled={isAnalyzing || document.status === "stale"} onClick={() => { if (window.confirm("恢复整理前地图？现有匹配和成品将过期，需要重新确认地图。") && restoreJDMap()) { setProposal(null); setMessage("已恢复整理前地图，请核对并重新确认。"); } }}>恢复整理前地图</Button>}
    </div>
    <p className="text-xs text-neutral-500">同义项自动归并，独立门槛不丢失。整理只生成提案，不自动覆盖你的确认结果。</p>
    {message && <p role="status" className="text-sm text-blue-700">{message}</p>}
    {(error || previewError) && <div ref={errorRef} role="alert" tabIndex={-1} className="text-sm text-red-700">{error || previewError}</div>}
    {proposal && <div className="space-y-3" aria-label="合并前后对照">
      <h3 className="font-semibold">原要求 → 合并结果</h3>
      <p className="text-sm">{document.requirements.length} 条 → {afterCount} 条独立细则 · {proposal.groups.length} 项核心要求 · {proposal.mode === "mock" ? "Mock：仅确定性去重和分类" : "模型语义整理：需人工核验"}</p>
      {!proposal.merges.length && <p className="text-sm">没有可安全自动合并的重复项；可仅应用核心分组，不删减独立要求。</p>}
      {proposal.merges.map(merge => <div key={merge.id} className="rounded border p-3 text-sm">
        <label className="flex gap-2 font-medium"><input type="checkbox" checked={selected.includes(merge.id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, merge.id] : previous.filter(id => id !== merge.id))} />采用此项合并：{merge.text}</label>
        <ul className="my-2 list-disc pl-6 text-neutral-600">{merge.memberIds.map(id => <li key={id}>{document.requirements.find(item => item.id === id)?.normalizedText}</li>)}</ul>
        <p>合并理由：{merge.reason}</p><p className="mt-1 text-xs text-amber-700">应用后此项须重新核验；取消勾选会保留原来的独立细则。</p>
      </div>)}
      {proposal.warnings.map((warning, index) => <p key={index} className="text-sm text-amber-700">{warning}</p>)}
      <details><summary className="cursor-pointer text-sm">查看核心分组提案</summary>{proposal.groups.map(group => <div key={group.id} className="mt-2 text-sm"><strong>{group.title}</strong><p>岗位含义解释：{group.meaning}</p><p>明示成果：{group.outcome}</p><p>准备建议：{group.proof}</p></div>)}</details>
      <div className="flex gap-2"><Button disabled={Boolean(previewError) || isAnalyzing} onClick={() => { if (applyJDConsolidation(proposal, selected, activeDocumentId)) { setProposal(null); setDirtyScope(null); setMessage("整理已应用；未变化项保留确认记录，合并项请重新核验。"); } }}>应用选中整理结果</Button>
        <Button variant="outline" onClick={() => { if (window.confirm("放弃当前整理提案？原地图保持不变。")) { setProposal(null); setDirtyScope(null); setMessage("原地图保持不变。"); } }}>取消应用</Button></div>
    </div>}
  </section>;
}
