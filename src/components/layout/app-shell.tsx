"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { StepSidebar } from "@/components/layout/step-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { StepContent } from "@/components/steps/step-content";
import { Button } from "@/components/ui/button";
import {
  RESUME_STORAGE_ERROR_EVENT,
  useResumeStore,
} from "@/store/resume-store";

export function AppShell() {
  const { storageError, setStorageError } = useResumeStore();

  useEffect(() => {
    void useResumeStore.persist.rehydrate();
    const handleStorageError = (event: Event) => {
      const message =
        event instanceof CustomEvent && typeof event.detail === "string"
          ? event.detail
          : "浏览器本地保存失败。";
      setStorageError(message);
    };

    window.addEventListener(
      RESUME_STORAGE_ERROR_EVENT,
      handleStorageError as EventListener
    );
    return () =>
      window.removeEventListener(
        RESUME_STORAGE_ERROR_EVENT,
        handleStorageError as EventListener
      );
  }, [setStorageError]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopNav />
      {storageError && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          <span>{storageError}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-red-700"
            aria-label="关闭本地保存错误"
            onClick={() => setStorageError(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <StepSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl p-6">
            <StepContent />
          </div>
        </main>
      </div>
    </div>
  );
}
