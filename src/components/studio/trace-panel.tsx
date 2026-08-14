"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearTraces, downloadTraces, listTraces } from "@/lib/studio/trace-store";
import type { WorkflowTrace } from "@/lib/studio/trace-types";

export function TracePanel({ onOpenPrompt }: { onOpenPrompt?: (promptId: string) => void }) {
  const [traces, setTraces] = useState<WorkflowTrace[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => listTraces().then(setTraces).catch(() => setError("无法读取本地运行记录")), []);
  useEffect(() => { void load(); }, [load]);
  const clear = async () => { if (!window.confirm("确认清空全部本地运行追踪？")) return; await clearTraces(); await load(); };
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-sm font-semibold">运行追踪</h2><p className="mt-1 text-xs text-neutral-500">完整内容仅存本机，包含简历、JD 和实际提示词；导出文件同样包含敏感正文。</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw />刷新</Button><Button variant="outline" size="sm" disabled={!traces.length} onClick={() => downloadTraces(traces, "resume-expert-full-traces-sensitive")}><Download />导出完整追踪（含敏感正文）</Button><Button variant="outline" size="sm" disabled={!traces.length} onClick={() => void clear()}><Trash2 />清空</Button></div>
    </div>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    <div className="space-y-2">{traces.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-xs text-neutral-500">运行一次岗位分析或 AI 优化后，这里会显示节点输入、输出、耗时、错误和提示词快照。</div> : traces.map((trace) => {
      const snapshots = trace.spans.flatMap((span) => span.promptSnapshots ?? []);
      return <details key={trace.id} className="rounded-lg border bg-white px-4 py-3"><summary className="cursor-pointer text-xs font-medium">{trace.spans[0]?.label ?? trace.id} · {trace.status} · {snapshots.length} 个提示词快照 · {new Date(trace.createdAt).toLocaleString("zh-CN")}</summary>{snapshots.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{[...new Map(snapshots.map((snapshot) => [snapshot.promptId, snapshot])).values()].map((snapshot) => <button key={snapshot.promptId} onClick={() => onOpenPrompt?.(snapshot.promptId)} className="flex items-center gap-1 rounded border bg-neutral-50 px-2 py-1 text-[10px] hover:border-neutral-800"><ExternalLink className="h-3 w-3"/>{snapshot.promptId}</button>)}</div>}<pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-neutral-950 p-3 text-[11px] text-neutral-100">{JSON.stringify(trace, null, 2)}</pre></details>;
    })}</div>
  </section>;
}
