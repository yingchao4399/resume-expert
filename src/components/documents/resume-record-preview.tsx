"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { FinalResume, ResumeLayoutConfig, ResumePaginationPlan, ResumePaginationStatus } from "@/types/resume";
import { ResumePaginatedView } from "@/components/resume/resume-paginated-view";
import { Button } from "@/components/ui/button";
import { buildResumeRenderModel } from "@/lib/export/resume-render-model";
import { isPaginationPlanCurrent } from "@/lib/export/resume-pagination";

export function ResumeRecordPreview({ resume, layoutConfig, targetRole, archivedAt, blockedReason, printControls = false }:
  { resume: FinalResume; layoutConfig: ResumeLayoutConfig; targetRole: string; archivedAt?: string; blockedReason?: string | null; printControls?: boolean }) {
  const [plan, setPlan] = useState<ResumePaginationPlan | null>(null);
  const [status, setStatus] = useState<ResumePaginationStatus>("measuring");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pages = useRef<HTMLDivElement>(null);
  const model = useMemo(() => buildResumeRenderModel(resume, layoutConfig), [resume, layoutConfig]);
  const ready = status === "ready" && plan && !plan.overflow && isPaginationPlanCurrent(plan, model);
  const onPlan = useCallback((next: ResumePaginationPlan | null, nextStatus: ResumePaginationStatus) => { setPlan(next); setStatus(nextStatus); }, []);
  const download = async (mode: "ats" | "visual" | "word") => {
    if (!ready || !plan || blockedReason || busy) return;
    setBusy(mode); setError(null);
    try {
      if (mode === "word") {
        const { downloadResumeDocx } = await import("@/lib/export/resume-docx");
        await downloadResumeDocx(resume, targetRole, layoutConfig, plan, archivedAt);
      } else {
        const { downloadATSTextPdf, downloadVisualPdf } = await import("@/lib/export/resume-pdf");
        if (mode === "ats") await downloadATSTextPdf(resume, targetRole, layoutConfig, { paginationPlan: plan, archivedAt });
        else await downloadVisualPdf(Array.from(pages.current?.querySelectorAll<HTMLElement>("[data-pdf-page]") ?? []), resume, targetRole, { paginationPlan: plan, archivedAt });
      }
    } catch (next) { setError(next instanceof Error ? next.message : "下载失败，请重试。"); }
    finally { setBusy(null); }
  };
  return <section>
    <div className="print-controls mb-3 flex flex-wrap gap-2">
      <Button size="sm" disabled={!ready || !!blockedReason || !!busy} onClick={() => void download("ats")}>下载 ATS PDF</Button>
      <Button size="sm" variant="outline" disabled={!ready || !!blockedReason || !!busy} onClick={() => void download("visual")}>下载视觉 PDF</Button>
      <Button size="sm" variant="outline" disabled={!ready || !!blockedReason || !!busy} onClick={() => void download("word")}>下载 Word</Button>
      {printControls && <Button size="sm" variant="outline" disabled={!ready || !!blockedReason || !!busy} onClick={() => window.print()}>系统打印</Button>}
    </div>
    <div className="print-controls mb-3 text-sm" aria-live="polite">
      {blockedReason || (busy ? "正在本地生成文件，请稍候…" : plan?.overflow ? "单个内容块超过一页，请调整原版本排版后重新存档。" : status === "error" ? "A4 分页失败，请重试。" : !ready ? "正在加载字体并测量 A4 分页…" : "分页完成，可下载。")}
    </div>
    {error && <p className="print-controls mb-3 text-red-700" role="alert">{error}</p>}
    <div ref={pages} className="overflow-x-auto bg-neutral-100 print:overflow-visible print:bg-white">
      <ResumePaginatedView resume={resume} layoutConfig={layoutConfig} onPaginationPlanChange={onPlan} />
    </div>
  </section>;
}
