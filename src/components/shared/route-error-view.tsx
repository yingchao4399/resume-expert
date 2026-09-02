"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Copy, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAppErrorPayload } from "@/lib/errors/app-error";
import { saveIncident } from "@/lib/studio/incident-store";

export function RouteErrorView({ error, reset, scope = "route" }: { error: Error & { digest?: string }; reset: () => void; scope?: string }) {
  const router = useRouter();
  const payload = useMemo(() => createAppErrorPayload(error, {
    code: "UI_RENDER_ERROR",
    category: "unexpected",
    userMessage: "这个页面暂时无法显示，但简历数据没有被删除。",
    retryable: true,
    requestId: error.digest || undefined,
    diagnostic: { scope, name: error.name, digest: error.digest },
  }), [error, scope]);

  useEffect(() => { void saveIncident({ ...payload, scope, occurredAt: new Date().toISOString() }); }, [payload, scope]);

  return <main className="mx-auto flex min-h-[60vh] max-w-xl items-center p-6">
    <div className="w-full rounded-xl border border-red-200 bg-white p-6 shadow-sm" role="alert">
      <AlertTriangle className="h-6 w-6 text-red-600" />
      <h1 className="mt-3 text-lg font-semibold">当前模块发生错误</h1>
      <p className="mt-2 text-sm text-neutral-600">{payload.userMessage}</p>
      <p className="mt-2 text-xs text-neutral-400">诊断编号：{payload.requestId}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={reset}><RotateCcw className="h-4 w-4" />重试当前模块</Button>
        <Button variant="outline" onClick={() => router.push("/")}><Home className="h-4 w-4" />返回首页</Button>
        <Button variant="outline" onClick={() => void navigator.clipboard.writeText(JSON.stringify(payload, null, 2))}><Copy className="h-4 w-4" />复制诊断信息</Button>
      </div>
    </div>
  </main>;
}
