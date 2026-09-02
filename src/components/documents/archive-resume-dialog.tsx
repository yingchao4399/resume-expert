"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useResumeStore } from "@/store/resume-store";
import { hasRunningTask } from "@/lib/tasks/task-runtime";
import { archiveBlockedReason } from "@/lib/library/resume-archives";

export function ArchiveResumeButton({ documentId, onArchived }: { documentId: string; onArchived?: (id: string) => void }) {
  const state = useResumeStore();
  const document = state.documents.find(item => item.id === documentId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; duplicate: boolean } | null>(null);
  const [changed, setChanged] = useState(false);
  const uid = useId();
  const blocked = archiveBlockedReason(document, !!state.dirtyScope, hasRunningTask(documentId));
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (open && changed && !result) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [open, changed, result]);
  const close = (next: boolean) => {
    if (!next && !result && changed && !window.confirm("放弃未保存的存档信息？")) return;
    setOpen(next);
  };
  return <>
    <Button size="sm" variant="outline" disabled={!!blocked} title={blocked ?? "保存不可变的历史成品"} onClick={() => {
      setTitle([document?.analysisResult?.finalResume.personalInfo.name || "简历", document?.userInput.targetRole || "未指定岗位", new Date().toLocaleDateString("sv-SE")].join("－").slice(0, 120));
      setNotes(""); setChanged(false); setResult(null); setError(null); setOpen(true);
    }}>存档当前成品</Button>
    <Dialog open={open} onOpenChange={close}><DialogContent><DialogHeader><DialogTitle>存档当前成品</DialogTitle><DialogDescription>冻结当前正文和排版。原版本后续修改或删除，不会覆盖此存档。</DialogDescription></DialogHeader>
      <label htmlFor={`${uid}-title`} className="text-sm">存档名称</label>
      <input id={`${uid}-title`} className="rounded border p-2" value={title} maxLength={120} disabled={!!result} onChange={event => { setTitle(event.target.value); setChanged(true); }} />
      <label htmlFor={`${uid}-notes`} className="text-sm">备注（可选）</label>
      <textarea id={`${uid}-notes`} className="rounded border p-2" value={notes} maxLength={1000} disabled={!!result} onChange={event => { setNotes(event.target.value); setChanged(true); }} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {result ? <div role="status" className="space-y-3 text-sm"><p>{result.duplicate ? "已有相同内容的存档，未重复保存。" : "存档已保存到当前浏览器。"}</p><Button asChild size="sm"><Link href={`/library?archiveId=${encodeURIComponent(result.id)}`} onClick={() => { setOpen(false); onArchived?.(result.id); }}>查看存档</Link></Button></div>
        : <Button disabled={!title.trim() || !!blocked} onClick={() => { try { setResult(state.archiveDocument(documentId, title, notes)); setError(null); } catch (next) { setError(next instanceof Error ? next.message : "存档失败"); } }}>确认存档</Button>}
    </DialogContent></Dialog>
  </>;
}
