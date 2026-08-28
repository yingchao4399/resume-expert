"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useResumeStore } from "@/store/resume-store";
import { archiveBlockedReason, archiveSourceWarning, resolveResumeRecord } from "@/lib/library/resume-archives";
import { ResumeRecordPreview } from "@/components/documents/resume-record-preview";

export default function PrintResumePage() {
  const router = useRouter();
  const state = useResumeStore();
  const [query, setQuery] = useState<{ documentId: string | null; archiveId: string | null } | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery({ documentId: params.get("documentId"), archiveId: params.get("archiveId") });
    void Promise.resolve(useResumeStore.persist.rehydrate()).finally(() => useResumeStore.getState().markHydrated());
  }, []);
  if (!state.hasHydrated || !query) return <main className="p-8" role="status">正在读取本地简历并完成分页…</main>;
  const record = resolveResumeRecord(state, query);
  const back = query.archiveId !== null ? "/library" : "/";
  if (record.error) return <main className="p-8"><p role="alert">{record.error}</p><Button onClick={() => router.push(back)}>返回</Button></main>;
  const { archive, document } = record;
  const resume = archive?.finalResume ?? document?.analysisResult?.finalResume;
  const layout = archive?.layoutConfig ?? document!.layoutConfig;
  const blocked = archive ? null : archiveBlockedReason(document ?? undefined);
  return <main className="min-h-screen bg-neutral-100 py-6 print:bg-white print:py-0">
    <style>{`@page { size: A4; margin: ${layout.pageMargin}mm; }`}</style>
    <div className="print-controls mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4"><div><h1 className="font-semibold">A4 简历预览 · {archive?.title ?? document!.title}</h1><p className="text-xs text-neutral-500">{archive ? archiveSourceWarning(archive, state.documents) : "工具栏不会进入打印或 PDF。"}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => router.push(back)}>返回{archive ? "简历库" : "简历助手"}</Button><Button size="sm" variant="ghost" onClick={() => { window.close(); window.setTimeout(() => { if (!window.closed) router.push(back); }, 150); }}>关闭窗口</Button></div></div>
    <div className="mx-auto max-w-5xl print:max-w-none">
      {resume ? <ResumeRecordPreview key={archive?.id ?? document!.id} resume={resume} layoutConfig={layout} targetRole={archive?.targetRole ?? document!.userInput.targetRole} archivedAt={archive?.archivedAt} blockedReason={blocked} printControls /> : <p className="p-4" role="alert">此版本还没有最终简历，请先完成材料核验和制作。</p>}
    </div>
  </main>;
}
