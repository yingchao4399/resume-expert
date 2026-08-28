"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useResumeStore } from "@/store/resume-store";
import { archiveBlockedReason, archiveSourceWarning } from "@/lib/library/resume-archives";
import { ResumeRecordPreview } from "@/components/documents/resume-record-preview";
import { ArchiveResumeButton } from "@/components/documents/archive-resume-dialog";
import { ResumeBackupDialog } from "@/components/documents/resume-backup-dialog";
import type { ResumeDocument } from "@/types/resume";

function documentStatus(document: ResumeDocument): "draft" | "confirmed" | "stale" {
  return document.finalResumeStatus === "draft" ? "draft" : archiveBlockedReason(document) ? "stale" : "confirmed";
}
const STATUS_LABEL = { draft: "草稿", confirmed: "已确认", stale: "已过期" };

export function ResumeLibrary() {
  const state = useResumeStore();
  const router = useRouter();
  const uid = useId();
  const [tab, setTab] = useState<"documents" | "archives">("documents");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selection, setSelection] = useState<{ kind: "document" | "archive"; id: string } | null>(null);
  const [edit, setEdit] = useState<{ kind: "document" | "archive"; id: string; title: string; notes: string } | null>(null);
  const [editDirty, setEditDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  useEffect(() => {
    const update = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.has("archiveId")) { setTab("archives"); setSelection({ kind: "archive", id: params.get("archiveId")! }); }
      else if (params.has("documentId")) { setTab("documents"); setSelection({ kind: "document", id: params.get("documentId")! }); }
      else setSelection(null);
    };
    update(); window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (editDirty) { event.preventDefault(); event.returnValue = ""; } };
    const navigate = (event: Event) => { if (editDirty && !window.confirm("放弃未保存的名称和备注修改？")) event.preventDefault(); };
    window.addEventListener("beforeunload", unload); window.addEventListener("resume-expert-before-navigate", navigate);
    return () => { window.removeEventListener("beforeunload", unload); window.removeEventListener("resume-expert-before-navigate", navigate); };
  }, [editDirty]);
  const show = (kind: "document" | "archive", id: string) => {
    setSelection({ kind, id });
    window.history.replaceState(null, "", `/library?${kind === "archive" ? "archiveId" : "documentId"}=${encodeURIComponent(id)}`);
  };
  const closePreview = () => { setSelection(null); window.history.replaceState(null, "", "/library"); };
  const run = (action: () => void, success?: string) => {
    setError(null); setMessage(null);
    try { action(); if (success) setMessage(success); }
    catch (next) { setError(next instanceof Error ? next.message : "操作失败，请重试。"); }
  };
  const openDocument = (id: string) => {
    state.selectDocument(id);
    if (useResumeStore.getState().activeDocumentId === id && useResumeStore.getState().prepareNavigation()) router.push("/");
  };
  const document = selection?.kind === "document" ? state.documents.find(item => item.id === selection.id) : undefined;
  const archive = selection?.kind === "archive" ? state.archives.find(item => item.id === selection.id) : undefined;
  const search = query.trim().toLocaleLowerCase();
  const matches = (...values: string[]) => values.join(" ").toLocaleLowerCase().includes(search);
  const documents = state.documents.filter(item => matches(item.title, item.userInput.targetRole, item.jobTargetContext.companyName) && (filter === "all" || documentStatus(item) === filter)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const archives = state.archives.filter(item => matches(item.title, item.targetRole, item.companyName)).sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
  const closeEdit = () => { if (!editDirty || window.confirm("放弃未保存的名称和备注修改？")) { setEdit(null); setEditDirty(false); } };
  if (!state.hasHydrated) return <p role="status">正在读取本地简历库…</p>;
  return <div className="space-y-5">
    <header className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">我的简历库</h2><p className="mt-1 text-sm text-neutral-500">岗位版本持续更新，历史存档保留当时成品。</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setBackupOpen(true)}>备份与恢复</Button><Button variant="outline" onClick={() => { if (state.prepareNavigation()) router.push("/"); }}>返回简历助手</Button></div>
    </header>
    <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">仅保存在当前浏览器和站点，不跨浏览器或电脑同步。清除站点数据会丢失记录，请定期导出完整备份。</p>
    <div role="tablist" aria-label="简历库分类" className="flex gap-2">
      <Button role="tab" aria-selected={tab === "documents"} variant={tab === "documents" ? "default" : "outline"} onClick={() => setTab("documents")}>岗位版本（{state.documents.length}）</Button>
      <Button role="tab" aria-selected={tab === "archives"} variant={tab === "archives" ? "default" : "outline"} onClick={() => setTab("archives")}>历史存档（{state.archives.length}）</Button>
    </div>
    <div className="flex flex-wrap items-center gap-3"><label className="sr-only" htmlFor={`${uid}-search`}>搜索简历</label><input id={`${uid}-search`} value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索名称、公司或岗位" className="min-w-60 flex-1 rounded-md border p-2 text-sm" />
      {tab === "documents" && <><label htmlFor={`${uid}-filter`} className="text-sm">状态</label><select id={`${uid}-filter`} value={filter} onChange={event => setFilter(event.target.value)} className="rounded border p-2 text-sm"><option value="all">全部状态</option>{Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></>}
    </div>
    {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div role="tabpanel" className="grid gap-4 md:grid-cols-2">
      {tab === "documents" ? documents.map(item => <article key={item.id} className="rounded-lg border bg-white p-4" aria-label={item.title}>
        <div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{item.title}</h3><span className="shrink-0 rounded border px-2 py-1 text-xs">{STATUS_LABEL[documentStatus(item)]}</span></div>
        <p className="mt-2 text-sm">{item.jobTargetContext.companyName || "未填写公司"} · {item.userInput.targetRole || "未填写岗位"}</p><p className="mt-1 text-xs text-neutral-500">更新于 {new Date(item.updatedAt).toLocaleString("zh-CN")}{item.id === state.activeDocumentId ? " · 当前编辑版本" : ""}</p>
        <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => show("document", item.id)}>查看</Button><Button size="sm" variant="outline" onClick={() => openDocument(item.id)}>继续编辑</Button><ArchiveResumeButton documentId={item.id} onArchived={id => { setTab("archives"); show("archive", id); }} />
          <Button size="sm" variant="ghost" onClick={() => run(() => state.duplicateDocument(item.id), "已复制岗位版本，原编辑版本未切换。")}>复制</Button>
          <Button size="sm" variant="ghost" onClick={() => { setEdit({ kind: "document", id: item.id, title: item.title, notes: "" }); setEditDirty(false); }}>重命名</Button>
          <Button size="sm" variant="ghost" onClick={() => { const refs = state.jobApplications.filter(value => value.resumeDocumentId === item.id).length + state.interviewReviews.filter(value => value.resumeDocumentId === item.id).length; if (window.confirm(`删除“${item.title}”？${refs ? `关联的 ${refs} 条投递或复盘将解除关联。` : ""}历史存档仍会保留。此操作只能从备份恢复。`)) run(() => state.deleteDocument(item.id), "岗位版本已删除；历史存档未删除，可从备份恢复原版本。"); }}>删除</Button>
        </div>
      </article>) : archives.map(item => <article key={item.id} className="rounded-lg border bg-white p-4" aria-label={item.title}>
        <h3 className="font-semibold">{item.title}</h3><p className="mt-2 text-sm">{item.companyName || "未填写公司"} · {item.targetRole || "未填写岗位"}</p><p className="mt-1 text-xs text-neutral-500">存档于 {new Date(item.archivedAt).toLocaleString("zh-CN")}</p>{item.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{item.notes}</p>}
        <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => show("archive", item.id)}>查看与下载</Button><Button variant="outline" size="sm" onClick={() => run(() => { state.copyArchiveToDraft(item.id); setTab("documents"); setFilter("all"); setQuery(""); }, "已复制为新草稿，请重新核验材料。未继承分析或创建可信事实。")}>复制为新草稿</Button><Button size="sm" variant="ghost" onClick={() => { setEdit({ kind: "archive", id: item.id, title: item.title, notes: item.notes }); setEditDirty(false); }}>修改名称与备注</Button><Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`删除历史存档“${item.title}”？不会删除原岗位版本；删除后只能从备份恢复。`)) run(() => state.deleteArchive(item.id), "历史存档已删除，可从备份恢复。"); }}>删除存档</Button></div>
      </article>)}
      {(tab === "documents" ? !documents.length : !archives.length) && <p className="col-span-full rounded border border-dashed p-8 text-center text-sm text-neutral-500">{search ? "没有匹配的记录。" : tab === "archives" ? "尚无历史存档。请在已确认的最终简历上点击“存档当前成品”。" : "没有符合筛选条件的岗位版本。"}</p>}
    </div>
    <Dialog open={!!selection} onOpenChange={open => { if (!open) closePreview(); }}><DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>{archive?.title ?? document?.title ?? "记录不存在"}</DialogTitle><DialogDescription>{archive ? archiveSourceWarning(archive, state.documents) : "只读查看，不会切换当前编辑版本。"}</DialogDescription></DialogHeader>
      {archive || (document?.analysisResult && document.finalResumeStatus !== "draft") ? <>
        <Button asChild size="sm" variant="outline"><Link href={`/print?${archive ? `archiveId=${encodeURIComponent(archive.id)}` : `documentId=${encodeURIComponent(document!.id)}`}`}>打开 A4 预览</Link></Button>
        <ResumeRecordPreview key={`${selection?.kind}-${selection?.id}`} resume={archive?.finalResume ?? document!.analysisResult!.finalResume} layoutConfig={archive?.layoutConfig ?? document!.layoutConfig} targetRole={archive?.targetRole ?? document!.userInput.targetRole} archivedAt={archive?.archivedAt} blockedReason={archive ? null : archiveBlockedReason(document)} />
      </> : document ? <div className="space-y-3 text-sm"><p>此版本还没有已确认的最终简历，以下为材料记录。</p><h4>目标岗位</h4><p>{document.userInput.targetRole || "未填写"}</p><h4>JD 原文</h4><p className="whitespace-pre-wrap">{document.userInput.jobDescription || "未填写"}</p><h4>原始简历</h4><p className="whitespace-pre-wrap">{document.userInput.originalResume || "未填写"}</p></div> : <p role="alert">指定的记录不存在或已删除，不会显示其他版本。</p>}
    </DialogContent></Dialog>
    <Dialog open={!!edit} onOpenChange={open => { if (!open) closeEdit(); }}><DialogContent><DialogHeader><DialogTitle>{edit?.kind === "archive" ? "修改存档名称与备注" : "重命名岗位版本"}</DialogTitle><DialogDescription>只修改名称和备注，不改变正文、排版或存档时间。</DialogDescription></DialogHeader>
      <label htmlFor={`${uid}-title`}>名称</label><input id={`${uid}-title`} className="rounded border p-2" maxLength={120} value={edit?.title ?? ""} onChange={event => { setEdit(value => value ? { ...value, title: event.target.value } : null); setEditDirty(true); }} />
      {edit?.kind === "archive" && <><label htmlFor={`${uid}-notes`}>备注</label><textarea id={`${uid}-notes`} className="rounded border p-2" maxLength={1000} value={edit.notes} onChange={event => { setEdit(value => value ? { ...value, notes: event.target.value } : null); setEditDirty(true); }} /></>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={closeEdit}>取消</Button><Button disabled={!edit?.title.trim()} onClick={() => run(() => { if (!edit) return; if (edit.kind === "archive") state.updateArchive(edit.id, edit.title, edit.notes); else state.renameDocument(edit.title, edit.id); setEdit(null); setEditDirty(false); }, "已保存。")}>保存</Button></div>
    </DialogContent></Dialog>
    <ResumeBackupDialog open={backupOpen} onOpenChange={setBackupOpen} />
  </div>;
}
