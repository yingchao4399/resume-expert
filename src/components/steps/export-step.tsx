"use client";

import { useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileText,
  Loader2,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState, SectionTitle } from "@/components/shared/ui-helpers";
import { ATSAssessmentCard } from "@/components/resume/ats-assessment-card";
import { ResumeDocumentView } from "@/components/resume/resume-document-view";
import { ResumePaginatedView } from "@/components/resume/resume-paginated-view";
import { useResumeStore } from "@/store/resume-store";
import { calculateATSAssessment } from "@/lib/ats";
import { downloadResumeDocx } from "@/lib/export/docx";
import { downloadATSTextPdf, downloadVisualPdf } from "@/lib/export/resume-pdf";
import { copyToClipboard, formatResumeAsText } from "@/lib/utils";
import { isAnalysisFresh } from "@/lib/analysis-revision";

export function ExportStep() {
  const {
    analysisResult,
    userInput,
    copied,
    finalResumeStatus,
    layoutConfig,
    setCopied,
    setCurrentStep,
    materialRevision,
    analysisRevision,
    activeDocumentId,
  } = useResumeStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [pdfExport, setPdfExport] = useState<"ats-text" | "visual" | null>(null);
  const visualPagesRef = useRef<HTMLDivElement>(null);

  const finalResume = analysisResult?.finalResume;
  const assessment = useMemo(
    () =>
      analysisResult
        ? calculateATSAssessment(userInput, analysisResult)
        : null,
    [analysisResult, userInput]
  );

  if (!analysisResult || !finalResume || !assessment) {
    return <EmptyState message="请先完成输入材料并开始分析" />;
  }

  const resumeText = formatResumeAsText(finalResume);
  const analysisFresh = isAnalysisFresh({ analysisResult, materialRevision, analysisRevision });
  const exportBlocked = finalResumeStatus !== "confirmed" || !analysisFresh;

  const handleCopy = async () => {
    if (exportBlocked) return;
    const success = await copyToClipboard(resumeText);
    if (success) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      setExportError("复制失败，请在预览窗口中手动选择文本。");
    }
  };

  const handleDocx = async () => {
    if (exportBlocked) return;
    setExporting(true);
    setExportError(null);
    try {
      await downloadResumeDocx(finalResume, userInput.targetRole, layoutConfig);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Word 文件生成失败"
      );
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    if (exportBlocked) return;
    const printWindow = window.open(`/print?documentId=${encodeURIComponent(activeDocumentId)}`, "_blank");
    if (!printWindow) {
      setExportError("浏览器阻止了打印窗口，请允许本站打开新窗口后重试。");
    }
  };

  const handlePdf = async (mode: "ats-text" | "visual") => {
    if (exportBlocked) return;
    setPdfExport(mode); setExportError(null);
    try {
      if (mode === "ats-text") await downloadATSTextPdf(finalResume, userInput.targetRole, layoutConfig);
      else {
        const pages = Array.from(visualPagesRef.current?.querySelectorAll<HTMLElement>("[data-pdf-page]") ?? []);
        await downloadVisualPdf(pages, finalResume, userInput.targetRole);
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "PDF 生成失败，请稍后重试。");
    } finally { setPdfExport(null); }
  };

  return (
    <div>
      <SectionTitle
        title="导出结果"
        description="下载 ATS 友好 Word，或通过浏览器打印保存为 PDF"
      />

      {exportBlocked && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p>
            {!analysisFresh
              ? "岗位或简历材料已变化，旧分析与旧简历已锁定。"
              : finalResumeStatus === "stale"
              ? "当前内容尚未应用最新补充、材料或优化风格，交付已锁定。"
              : "当前内容仍是分析草稿，请先生成并确认最终简历。"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(analysisFresh ? "optimize" : "input")}
            >
              {analysisFresh ? "返回重新生成" : "返回重新分析"}
            </Button>
          </div>
        </div>
      )}

      {exportError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {exportError}
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <ExportCard
          icon={<Download className="h-4 w-4" />}
          title="下载 Word"
          description="单栏 DOCX，可在 Word / WPS 中继续修改"
        >
          <Button
            className="w-full"
            disabled={exportBlocked || exporting}
            onClick={handleDocx}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {exporting ? "正在生成…" : "下载 DOCX"}
          </Button>
        </ExportCard>

        <ExportCard
          icon={<Printer className="h-4 w-4" />}
          title="PDF 与打印"
          description="直接下载可检索 ATS 版或视觉还原版，也可打开 A4 预览"
        >
          <div className="space-y-2">
            <Button className="w-full" disabled={exportBlocked || pdfExport !== null} onClick={() => void handlePdf("ats-text")}>
              {pdfExport === "ats-text" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {pdfExport === "ats-text" ? "正在生成 ATS PDF…" : "下载 ATS 文字版"}
            </Button>
            <Button variant="outline" className="w-full" disabled={exportBlocked || pdfExport !== null} onClick={() => void handlePdf("visual")}>
              {pdfExport === "visual" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {pdfExport === "visual" ? "正在生成视觉 PDF…" : "下载视觉还原版"}
            </Button>
            <Button variant="outline" className="w-full" disabled={exportBlocked || pdfExport !== null} onClick={handlePrint}>
              <Printer className="h-4 w-4" />打开 A4 预览
            </Button>
          </div>
        </ExportCard>

        <ExportCard
          icon={<Copy className="h-4 w-4" />}
          title="复制纯文本"
          description="适合粘贴到招聘网站或其他编辑器"
        >
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full"
                disabled={exportBlocked}
              >
                <Copy className="h-4 w-4" />
                预览与复制
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>最终简历预览</DialogTitle>
                <DialogDescription>
                  预览内容与 Word、打印版本使用同一份最终简历数据。
                </DialogDescription>
              </DialogHeader>
              <ResumeDocumentView
                resume={finalResume}
                layoutConfig={layoutConfig}
                className="rounded-md border p-6"
              />
              <div className="flex justify-end">
                <Button onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "已复制" : "复制纯文本"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </ExportCard>
      </div>

      <ATSAssessmentCard assessment={assessment} />
      <div ref={visualPagesRef} className="pointer-events-none fixed left-[-10000px] top-0" aria-hidden="true">
        <ResumePaginatedView resume={finalResume} layoutConfig={layoutConfig} />
      </div>
    </div>
  );
}

function ExportCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
