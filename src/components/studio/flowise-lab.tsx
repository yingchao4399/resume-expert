"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FlaskConical, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectEvidenceProvider, ProjectEvidenceResult } from "@/lib/flowise/schemas";
import { postWorkflowJSON } from "@/services/ai/resumeAgent";
import { evidenceSourceReference } from "@/lib/evidence/resume-evidence";
import { useCareerDomain } from "@/hooks/use-career-domain";

interface FlowiseStatus {
  enabled: boolean;
  baseUrl: string;
  flowConfigured: boolean;
  flowId: string;
  securityAuditPassed: boolean;
  securitySummary: string;
  startCommand: string;
  online: boolean;
  version?: string;
  latencyMs: number;
}

const initialInput = {
  targetRole: "AI 产品经理",
  projectTitle: "简历专家",
  currentDemo: "完成了简历材料分析、证据补充、模板排版和本地导出，并用自动化测试验证核心流程。",
};

export function FlowiseLab() {
  const { snapshot, save: saveCareerDomain } = useCareerDomain();
  const [status, setStatus] = useState<FlowiseStatus | null>(null);
  const [input, setInput] = useState(initialInput);
  const [provider, setProvider] = useState<ProjectEvidenceProvider>("mock");
  const [result, setResult] = useState<ProjectEvidenceResult | null>(null);
  const [comparison, setComparison] = useState<ProjectEvidenceResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refreshStatus = async () => {
    setMessage("");
    try {
      const response = await fetch("/api/flowise/status", { cache: "no-store" });
      setStatus(await response.json() as FlowiseStatus);
    } catch {
      setStatus(null);
      setMessage("无法读取 Flowise 本机状态。");
    }
  };

  useEffect(() => { void refreshStatus(); }, []);

  const run = async (selected: ProjectEvidenceProvider) => {
    setBusy(true);
    setMessage("");
    try {
      const next = await postWorkflowJSON<ProjectEvidenceResult>("/api/flowise/project-evidence", { provider: selected, input, allowFallback: true });
      setResult(next);
      setComparison([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "实验运行失败");
    } finally {
      setBusy(false);
    }
  };

  const compare = async () => {
    setBusy(true);
    setMessage("");
    try {
      const values = await Promise.all(["direct", "flowise"].map((item) =>
        postWorkflowJSON<ProjectEvidenceResult>("/api/flowise/project-evidence", { provider: item, input, allowFallback: true })));
      setComparison(values);
      setResult(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "对比运行失败");
    } finally {
      setBusy(false);
    }
  };

  const accept = async (value: ProjectEvidenceResult) => {
    const draft = value.draft;
    const timestamp = new Date().toISOString();
    const experienceId = `flowise-experience-${value.runId}`;
    await saveCareerDomain({
      ...snapshot,
      experiences: snapshot.experiences.some((item) => item.id === experienceId) ? snapshot.experiences : [...snapshot.experiences, {
        id: experienceId, type: "project", title: draft.projectTitle, organization: "个人项目", role: draft.targetRole,
        startDate: "", endDate: "", periodText: "", summary: "Flowise 实验候选", order: snapshot.experiences.length,
        status: "candidate", createdAt: timestamp, updatedAt: timestamp,
      }],
      claims: [...snapshot.claims.filter((item) => item.sourceRunId !== value.runId), ...draft.factDrafts.map((fact, index) => ({
        id: `flowise-claim-${value.runId}-${index}`, experienceId, kind: "action" as const, text: fact,
        contribution: "independent" as const, complexity: "routine" as const, hasTradeoff: false, hasMethodReuse: false,
        status: "candidate" as const, sourceReference: evidenceSourceReference("flowise", `${value.runId}:${index}`, fact, value.runId),
        sourceQuote: fact, sourceRunId: value.runId, sourceRound: null, createdAt: timestamp, updatedAt: timestamp,
      }))],
    });
    setMessage(`${draft.factDrafts.length} 条独立候选事实已进入证据库；重复确认同一运行不会重复写入。`);
  };

  return <div className="space-y-5">
    <div><h2 className="text-lg font-semibold">Flowise 实验室</h2><p className="mt-1 text-sm text-neutral-500">可替换 AI 节点的本机实验层；TypeScript 校验、确认门禁和业务数据仍由主应用负责。</p></div>
    <section className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">{status?.online ? <CheckCircle2 className="h-5 w-5 text-emerald-600"/> : <AlertTriangle className="h-5 w-5 text-amber-600"/>}<div><h3 className="text-sm font-semibold">本机 Flowise：{status?.online ? "在线" : "离线"}</h3><p className="mt-1 text-xs text-neutral-500">{status?.baseUrl ?? "http://127.0.0.1:3200"}{status?.version ? ` · v${status.version}` : ""}{status ? ` · ${status.latencyMs}ms` : ""}</p><p className="mt-1 text-xs text-neutral-500">流程配置：{status?.flowConfigured ? status.flowId : "未配置"} · {status?.startCommand ?? "pnpm start"}</p></div></div>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void refreshStatus()}><RefreshCw/>测试连接</Button><Button asChild variant="outline" size="sm"><a href="http://127.0.0.1:3200" target="_blank" rel="noreferrer"><ExternalLink/>打开 Flowise</a></Button></div>
      </div>
      <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800"><strong>安全审计未通过。</strong> {status?.securitySummary ?? "Flowise 当前上游依赖仍含高危漏洞，因此默认禁用并仅限 127.0.0.1 本机隔离实验。"}</div>
    </section>
    <section className="rounded-xl border bg-white p-5">
      <div className="flex items-center gap-2"><FlaskConical className="h-5 w-5"/><h3 className="font-semibold">新手项目梳理</h3></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><Label htmlFor="flowise-role">目标岗位</Label><Input id="flowise-role" className="mt-1.5" value={input.targetRole} onChange={(event) => setInput({ ...input, targetRole: event.target.value })}/></div><div><Label htmlFor="flowise-project">项目名称</Label><Input id="flowise-project" className="mt-1.5" value={input.projectTitle} onChange={(event) => setInput({ ...input, projectTitle: event.target.value })}/></div><div className="sm:col-span-2"><Label htmlFor="flowise-demo">现有 Demo / 已完成事实</Label><Textarea id="flowise-demo" className="mt-1.5 min-h-28" value={input.currentDemo} onChange={(event) => setInput({ ...input, currentDemo: event.target.value })}/></div></div>
      <div className="mt-4 flex flex-wrap items-end gap-3"><div className="w-44"><Label htmlFor="flowise-provider">运行方式</Label><Select value={provider} onValueChange={(value) => setProvider(value as ProjectEvidenceProvider)}><SelectTrigger id="flowise-provider" className="mt-1.5"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="mock">Mock（零成本）</SelectItem><SelectItem value="direct">DirectLLM</SelectItem><SelectItem value="flowise">Flowise</SelectItem></SelectContent></Select></div><Button disabled={busy || input.currentDemo.trim().length < 10} onClick={() => void run(provider)}>{busy && <Loader2 className="animate-spin"/>}运行实验</Button><Button variant="outline" disabled={busy || input.currentDemo.trim().length < 10} onClick={() => void compare()}>DirectLLM / Flowise 对比</Button></div>
      <p className="mt-3 text-xs text-neutral-500">Flowise 或 DirectLLM 不可用时只回退为 Mock 草稿，并明确标记；不会自动写入简历或证据库。</p>
    </section>
    {message && <p aria-live="polite" className="rounded-md border bg-white p-3 text-sm">{message}</p>}
    {result && <ResultCard result={result} onAccept={() => void accept(result)}/>}
    {comparison.length > 0 && <div className="grid gap-4 xl:grid-cols-2">{comparison.map((item) => <ResultCard key={item.requestedProvider} result={item} onAccept={() => void accept(item)}/>)}</div>}
  </div>;
}

function ResultCard({ result, onAccept }: { result: ProjectEvidenceResult; onAccept: () => void }) {
  const draft = result.draft;
  return <article className="rounded-xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{draft.projectTitle}</h3><span className="rounded border px-2 py-1 text-[10px] uppercase">请求 {result.requestedProvider} · 实际 {result.actualProvider}</span></div>{result.warning && <p className="mt-3 rounded bg-amber-50 p-3 text-xs text-amber-800">{result.warning}</p>}<div className="mt-4 space-y-4 text-sm"><List title="事实草稿" values={draft.factDrafts}/><List title="证据缺口" values={draft.missingEvidence}/><List title="改进任务" values={draft.improvementTasks}/><div><h4 className="text-xs font-semibold text-neutral-500">面试叙述草稿</h4><p className="mt-1 leading-6">{draft.interviewNarrative}</p></div><List title="自适应追问" values={draft.questions}/></div><Button className="mt-5" size="sm" onClick={onAccept}>确认进入证据库（候选）</Button></article>;
}

function List({ title, values }: { title: string; values: string[] }) {
  return <div><h4 className="text-xs font-semibold text-neutral-500">{title}</h4><ul className="mt-1 list-disc space-y-1 pl-5 leading-6">{values.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}
