"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchAIStatus } from "@/services/ai/resumeAgent";
import { useResumeStore } from "@/store/resume-store";
import { AISettingsDialog } from "@/components/settings/ai-settings-dialog";
import { ResumeDocumentMenu } from "@/components/documents/resume-document-menu";

export function TopNav() {
  const { aiMode, setAiMode } = useResumeStore();
  const [mockReason, setMockReason] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const refreshStatus = useCallback(() => {
    fetchAIStatus()
      .then((status) => {
        setAiMode(status.mode);
        if (status.reason === "missing_api_key") {
          setMockReason("未配置 API Key");
        } else if (status.reason === "forced") {
        } else if (status.reason === "invalid_api_key") {
          setMockReason("API Key 格式错误");
          setMockReason("已强制 Mock");
        } else {
          setMockReason(null);
        }
      })
      .catch(() => setAiMode("mock"));
  }, [setAiMode]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return (
    <>
      <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-white px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50">
            <FileText className="h-3.5 w-3.5 text-neutral-700" />
          </div>
          <h1 className="shrink-0 text-sm font-semibold tracking-tight text-neutral-900">
            简历专家
          </h1>
          <span className="hidden rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 lg:inline">
            JD 定制简历优化 Agent
          </span>
          <ResumeDocumentMenu />
          {aiMode && (
            <Badge
              variant={aiMode === "llm" ? "success" : "secondary"}
              className="hidden shrink-0 font-normal md:inline-flex"
            >
              {aiMode === "llm"
                ? "AI 模式"
                : mockReason
                  ? `Mock · ${mockReason}`
                  : "Mock 模式"}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1.5 px-2 text-xs"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 className="h-3.5 w-3.5" />
          AI 设置
        </Button>
      </header>

      <AISettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={refreshStatus}
      />
    </>
  );
}
