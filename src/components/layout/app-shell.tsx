"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Download, RotateCcw, Trash2, X } from "lucide-react";
import { StepSidebar } from "@/components/layout/step-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { StepContent } from "@/components/steps/step-content";
import { Button } from "@/components/ui/button";
import { migrateCareerEvidenceOnce, replaceCareerDomain } from "@/lib/career/career-db";
import { projectClaimsToLegacyEvidence } from "@/lib/career/career-context";
import { mergeCareerSnapshots, migrateLegacyEvidence } from "@/lib/career/migration";
import {
  RESUME_STORAGE_ERROR_EVENT,
  downloadRecoveryData,
  useResumeStore,
} from "@/store/resume-store";

export function AppShell() {
  const { storageError, setStorageError, recoveryAvailable, recoveryReason, recoveryReport, attemptStorageRecovery, confirmStorageRecovery, clearCorruptStorage, dirtyScope } = useResumeStore();
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  useEffect(() => {
    void Promise.resolve(useResumeStore.persist.rehydrate())
      .then(async () => {
        const legacyEvidence = useResumeStore.getState().careerEvidence;
        let { snapshot } = await migrateCareerEvidenceOnce(legacyEvidence);
        const claimIds = new Set(snapshot.claims.map((claim) => claim.id));
        if (legacyEvidence.some((item) => !claimIds.has(item.id))) {
          snapshot = mergeCareerSnapshots(snapshot, migrateLegacyEvidence(legacyEvidence));
          await replaceCareerDomain(snapshot);
        }
        useResumeStore.setState({ careerEvidence: projectClaimsToLegacyEvidence(snapshot) });
      })
      .finally(() => {
        useResumeStore.getState().markHydrated();
        window.dispatchEvent(new Event("resume-expert-library-hydrated"));
      });
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

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyScope) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirtyScope]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopNav />
      {recoveryAvailable && (
        <div className="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900" role="alert" aria-live="assertive">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="flex-1">检测到损坏或非法的本地数据，自动覆盖已锁定。{recoveryReason ? `原因：${recoveryReason}` : ""}</span>
            <Button variant="outline" size="sm" onClick={() => downloadRecoveryData()}><Download className="h-3.5 w-3.5" />下载异常数据</Button>
            {!recoveryReport && <Button variant="outline" size="sm" onClick={() => { const report = attemptStorageRecovery(); setRecoveryMessage(report ? `已恢复：简历 ${report.documents}、证据 ${report.careerEvidence}、投递 ${report.jobApplications}、复盘 ${report.interviewReviews}；跳过 ${report.skipped} 项。请核对后确认。` : "自动恢复失败，请先下载异常数据后再决定是否清空。"); }}><RotateCcw className="h-3.5 w-3.5" />尝试恢复</Button>}
            {recoveryReport && <Button variant="outline" size="sm" onClick={() => { confirmStorageRecovery(); setRecoveryMessage(null); }}><Check className="h-3.5 w-3.5" />确认恢复结果</Button>}
            <Button variant="destructive" size="sm" onClick={() => { if (window.confirm("确认清空损坏存储并创建空白草稿？此操作不会保留恢复槽，请先下载异常数据。")) clearCorruptStorage(); }}><Trash2 className="h-3.5 w-3.5" />确认清空</Button>
          </div>
          {recoveryMessage && <p className="mt-2" role="status">{recoveryMessage}</p>}
        </div>
      )}
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
