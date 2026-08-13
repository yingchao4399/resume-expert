"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResumeDocumentView } from "@/components/resume/resume-document-view";
import { useResumeStore } from "@/store/resume-store";

export default function PrintResumePage() {
  const { analysisResult, hasHydrated, userInput, layoutConfig } = useResumeStore();


  useEffect(() => {
    void Promise.resolve(useResumeStore.persist.rehydrate()).finally(() => {
      useResumeStore.getState().markHydrated();
    });
  }, []);
  if (!hasHydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        正在读取本地简历…
      </main>
    );
  }

  if (!analysisResult) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-neutral-600">当前版本还没有可打印的最终简历。</p>
        <Button variant="outline" onClick={() => window.close()}>
          关闭
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: ${layoutConfig.pageMargin}mm; }`}</style>
      <div className="print-controls mx-auto mb-4 flex max-w-[210mm] items-center justify-between rounded-lg border bg-white px-4 py-3">
        <div>
          <p className="text-sm font-medium">A4 简历打印预览</p>
          <p className="text-xs text-neutral-500">
            在打印窗口中选择“另存为 PDF”，建议关闭页眉和页脚。
          </p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          打印 / 保存为 PDF
        </Button>
      </div>

      <div
        className="print-page mx-auto min-h-[297mm] w-[210mm] bg-white shadow-sm print:min-h-0 print:w-auto print:p-0 print:shadow-none"
        style={{ padding: `${layoutConfig.pageMargin}mm` }}
      >
        <ResumeDocumentView resume={analysisResult.finalResume} layoutConfig={layoutConfig} />
        <p className="print-controls mt-8 text-center text-xs text-neutral-400">
          当前目标岗位：{userInput.targetRole || "未填写"}
        </p>
      </div>
    </main>
  );
}
