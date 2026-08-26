"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Loader2, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResumePaginatedView } from "@/components/resume/resume-paginated-view";
import { downloadATSTextPdf, downloadVisualPdf } from "@/lib/export/resume-pdf";
import { isAnalysisFresh } from "@/lib/analysis-revision";
import { useResumeStore } from "@/store/resume-store";

export default function PrintResumePage() {
  const router = useRouter();
  const { documents, activeDocumentId, hasHydrated } = useResumeStore();
  const [requestedId, setRequestedId] = useState<string | null>(null);
  const [queryReady, setQueryReady] = useState(false);
  const [exporting, setExporting] = useState<"ats-text" | "visual" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRequestedId(new URLSearchParams(window.location.search).get("documentId"));
    setQueryReady(true);
    void Promise.resolve(useResumeStore.persist.rehydrate()).finally(() => useResumeStore.getState().markHydrated());
  }, []);

  const resumeDocument = useMemo(
    () => documents.find((item) => item.id === requestedId) ?? documents.find((item) => item.id === activeDocumentId) ?? null,
    [activeDocumentId, documents, requestedId],
  );
  const analysisFresh = resumeDocument?.analysisResult
    ? isAnalysisFresh({ analysisResult: resumeDocument.analysisResult, materialRevision: resumeDocument.materialRevision, analysisRevision: resumeDocument.analysisRevision })
    : false;
  const blockedReason = !resumeDocument?.analysisResult
    ? "该岗位版本还没有可预览的最终简历。"
    : resumeDocument.finalResumeStatus !== "confirmed"
      ? resumeDocument.finalResumeStatus === "stale" ? "最终简历已过期，请返回制作页重新生成。" : "当前内容仍是草稿，请先确认最终简历。"
      : !analysisFresh ? "岗位材料已变化，旧简历已锁定，请重新分析并生成。" : null;

  const download = async (mode: "ats-text" | "visual") => {
    if (!resumeDocument?.analysisResult || blockedReason) return;
    setExporting(mode); setError(null);
    try {
      if (mode === "ats-text") await downloadATSTextPdf(resumeDocument.analysisResult.finalResume, resumeDocument.userInput.targetRole, resumeDocument.layoutConfig);
      else {
        const pages = Array.from(pagesRef.current?.querySelectorAll<HTMLElement>("[data-pdf-page]") ?? []);
        await downloadVisualPdf(pages, resumeDocument.analysisResult.finalResume, resumeDocument.userInput.targetRole);
      }
    } catch (next) { setError(next instanceof Error ? next.message : "PDF 生成失败，请稍后重试。"); }
    finally { setExporting(null); }
  };

  if (!hasHydrated || !queryReady) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-neutral-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在读取本地简历并完成分页…</main>;
  }

  if (!resumeDocument?.analysisResult) {
    return <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center"><p className="text-sm text-neutral-600">{blockedReason}</p><Button variant="outline" onClick={() => router.push("/")}><ArrowLeft className="h-4 w-4" />返回简历助手</Button></main>;
  }

  return <main className="min-h-screen bg-neutral-100 py-6 print:bg-white print:py-0">
    <style>{`@page { size: A4; margin: ${resumeDocument.layoutConfig.pageMargin}mm; }`}</style>
    <div className="print-controls mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm">
      <div><p className="text-sm font-medium">A4 简历预览 · {resumeDocument.title}</p><p className="text-xs text-neutral-500">直接下载 PDF，或使用系统打印。工具栏不会进入文件。</p></div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={Boolean(blockedReason) || exporting !== null} onClick={() => void download("ats-text")}>
          {exporting === "ats-text" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}下载 ATS PDF
        </Button>
        <Button size="sm" variant="outline" disabled={Boolean(blockedReason) || exporting !== null} onClick={() => void download("visual")}>
          {exporting === "visual" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}下载视觉 PDF
        </Button>
        <Button size="sm" variant="outline" disabled={Boolean(blockedReason) || exporting !== null} onClick={() => window.print()}><Printer className="h-4 w-4" />系统打印</Button>
        <Button size="sm" variant="outline" onClick={() => router.push("/")}><ArrowLeft className="h-4 w-4" />返回</Button>
        <Button size="sm" variant="ghost" aria-label="关闭窗口" onClick={() => { window.close(); window.setTimeout(() => { if (!window.closed) router.push("/"); }, 150); }}><X className="h-4 w-4" />关闭</Button>
      </div>
    </div>
    {blockedReason && <div className="print-controls mx-auto mb-4 max-w-[210mm] rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">{blockedReason}</div>}
    {error && <div className="print-controls mx-auto mb-4 max-w-[210mm] rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert" aria-live="assertive">{error}</div>}
    <div ref={pagesRef}><ResumePaginatedView resume={resumeDocument.analysisResult.finalResume} layoutConfig={resumeDocument.layoutConfig} /></div>
  </main>;
}
