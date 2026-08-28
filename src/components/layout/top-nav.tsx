"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, FlaskConical, Settings2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchAIStatus } from "@/services/ai/resumeAgent";
import { RESUME_STORAGE_STATUS_EVENT, useResumeStore } from "@/store/resume-store";
import { AISettingsDialog } from "@/components/settings/ai-settings-dialog";
import { ResumeDocumentMenu } from "@/components/documents/resume-document-menu";
import { isStudioEnabled, STUDIO_SETTING_EVENT } from "@/lib/studio/settings";

export function TopNav() {
  const { aiMode, setAiMode } = useResumeStore();
  const [mockReason, setMockReason] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveState, setSaveState] = useState<{ status: "idle" | "saving" | "saved" | "error"; savedAt?: string }>({ status: "idle" });
  const [studioEnabled, setStudioVisible] = useState(false);

  const refreshStatus = useCallback(() => {
    fetchAIStatus()
      .then((status) => {
        setAiMode(status.mode);
        if (status.reason === "missing_api_key") {
          setMockReason("未配置 API Key");
        } else if (status.reason === "forced") {
          setMockReason("已强制 Mock");
        } else if (status.reason === "invalid_api_key") {
          setMockReason("API Key 格式错误");
        } else {
          setMockReason(null);
        }
      })
      .catch(() => {
        setAiMode("mock");
        setMockReason("状态读取失败");
      });
  }, [setAiMode]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const openSettings = () => setSettingsOpen(true);
    window.addEventListener("resume-expert-open-ai-settings", openSettings);
    return () => window.removeEventListener("resume-expert-open-ai-settings", openSettings);
  }, []);

  useEffect(() => {
    setStudioVisible(isStudioEnabled());
    const update = (event: Event) => setStudioVisible(event instanceof CustomEvent ? Boolean(event.detail) : isStudioEnabled());
    window.addEventListener(STUDIO_SETTING_EVENT, update);
    return () => window.removeEventListener(STUDIO_SETTING_EVENT, update);
  }, []);

  useEffect(() => {
    const handleStorageStatus = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      setSaveState(event.detail);
    };
    window.addEventListener(RESUME_STORAGE_STATUS_EVENT, handleStorageStatus);
    return () => window.removeEventListener(RESUME_STORAGE_STATUS_EVENT, handleStorageStatus);
  }, []);

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
          <span className={`hidden text-[10px] lg:inline ${saveState.status === "error" ? "text-red-600" : "text-neutral-400"}`} role="status" aria-live="polite">
            {saveState.status === "saving"
              ? "保存中…"
              : saveState.status === "saved" && saveState.savedAt
                ? `已保存 ${new Date(saveState.savedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`
                : saveState.status === "error"
                  ? "保存失败"
                  : "本地保存"}
          </span>
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
        <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs"><Link href="/library" onNavigate={event => { if (!useResumeStore.getState().prepareNavigation()) event.preventDefault(); }}>我的简历库</Link></Button>
        {studioEnabled && <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs"><Link href="/studio"><FlaskConical className="h-3.5 w-3.5" />开发者工作台</Link></Button>}
        <Button
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1.5 px-2 text-xs"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 className="h-3.5 w-3.5" />
          AI 设置
        </Button>
        </div>
      </header>

      <AISettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={refreshStatus}
      />
    </>
  );
}
