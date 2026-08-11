"use client";

import { useMemo, useState } from "react";
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
import { useResumeStore } from "@/store/resume-store";
import { calculateATSAssessment } from "@/lib/ats";
import { downloadResumeDocx } from "@/lib/export/docx";
import { copyToClipboard, formatResumeAsText } from "@/lib/utils";

export function ExportStep() {
  const {
    analysisResult,
    userInput,
    copied,
    finalResumeStatus,
    layoutConfig,
    setCopied,
    setCurrentStep,
  } = useResumeStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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
  const exportBlocked = finalResumeStatus !== "confirmed";

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
    const printWindow = window.open("/print", "_blank");
    if (!printWindow) {
      setExportError("浏览器阻止了打印窗口，请允许本站打开新窗口后重试。");
    }
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
            {finalResumeStatus === "stale"
              ? "当前内容尚未应用最新补充、材料或优化风格，交付已锁定。"
              : "当前内容仍是分析草稿，请先生成并确认最终简历。"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep("optimize")}
            >
              返回重新生成
            </Button>
          </div>
        </div>
      )}

      {exportError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {exportError}
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
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
          title="打印为 PDF"
          description="打开 A4 预览，在打印窗口选择另存为 PDF"
        >
          <Button
            variant="outline"
            className="w-full"
            disabled={exportBlocked}
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            打开打印页
          </Button>
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
