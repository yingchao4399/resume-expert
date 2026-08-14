"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, Braces, Database, FileCode2, FileText, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownPreview } from "@/components/studio/markdown-preview";
import { listTraces, readTraceStorageError, TRACE_STORAGE_ERROR_EVENT } from "@/lib/studio/trace-store";
import type { PromptDefinition, PromptRuntimeSnapshot, SourceCatalogContent, SourceCatalogEntry } from "@/lib/studio/prompt-types";
import type { WorkflowTrace } from "@/lib/studio/trace-types";

type View = "center" | "sources" | "snapshots" | "versions";
type PromptManifest = { definitions: PromptDefinition[]; manifestHash: string; baseline: { version: string; approvedAt: string; manifestHash: string }; generatedAt: string };

export function PromptStudio({ selectedPromptId, onSelectedPrompt }: { selectedPromptId?: string; onSelectedPrompt?: (id: string) => void }) {
  const [view, setView] = useState<View>("center");
  const [manifest, setManifest] = useState<PromptManifest | null>(null);
  const [sources, setSources] = useState<SourceCatalogEntry[]>([]);
  const [traces, setTraces] = useState<WorkflowTrace[]>([]);
  const [activePromptId, setActivePromptId] = useState(selectedPromptId ?? "resume.deep-jd");
  const [sourceContent, setSourceContent] = useState<SourceCatalogContent | null>(null);
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [gitFilter, setGitFilter] = useState("all");
  const [rawMarkdown, setRawMarkdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [promptResponse, sourceResponse, traceValues] = await Promise.all([
        fetch("/api/studio/prompts", { cache: "no-store" }),
        fetch("/api/studio/sources", { cache: "no-store" }),
        listTraces(),
      ]);
      const promptData = await promptResponse.json() as PromptManifest & { error?: string };
      const sourceData = await sourceResponse.json() as { sources?: SourceCatalogEntry[]; error?: string };
      if (!promptResponse.ok) throw new Error(promptData.error ?? "无法读取提示词注册表");
      if (!sourceResponse.ok) throw new Error(sourceData.error ?? "无法读取底层文件目录");
      setManifest(promptData);
      setSources(sourceData.sources ?? []);
      setTraces(traceValues);
      setStorageError(readTraceStorageError());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "开发者资料读取失败");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selectedPromptId) return;
    setActivePromptId(selectedPromptId);
    setView("center");
  }, [selectedPromptId]);
  useEffect(() => {
    const listener = (event: Event) => setStorageError((event as CustomEvent<string>).detail);
    window.addEventListener(TRACE_STORAGE_ERROR_EVENT, listener);
    return () => window.removeEventListener(TRACE_STORAGE_ERROR_EVENT, listener);
  }, []);

  const definitions = manifest?.definitions ?? [];
  const snapshots = useMemo(() => traces.flatMap((trace) => trace.spans.flatMap((span) => span.promptSnapshots ?? [])), [traces]);
  const modules = [...new Set(definitions.map((item) => item.module))];
  const providers = [...new Set(snapshots.map((item) => item.provider))];
  const activeDefinition = definitions.find((item) => item.id === activePromptId) ?? definitions[0];
  const filteredDefinitions = definitions.filter((item) => {
    const text = `${item.name} ${item.id} ${item.description} ${item.module}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (moduleFilter === "all" || item.module === moduleFilter) &&
      (kindFilter === "all" || item.sourceRefs.some((source) => source.kind === kindFilter));
  });
  const filteredSources = sources.filter((item) => {
    const text = `${item.path} ${item.promptIds.join(" ")}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (kindFilter === "all" || item.kind === kindFilter) && (gitFilter === "all" || item.gitStatus === gitFilter);
  });
  const filteredSnapshots = snapshots.filter((item) => {
    const text = `${item.promptId} ${item.model} ${item.schemaName}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (providerFilter === "all" || item.provider === providerFilter);
  });

  const choosePrompt = (id: string) => { setActivePromptId(id); onSelectedPrompt?.(id); };
  const openSource = async (sourcePath: string) => {
    setView("sources"); setError(null);
    try {
      const response = await fetch(`/api/studio/sources/content?path=${encodeURIComponent(sourcePath)}`, { cache: "no-store" });
      const body = await response.json() as SourceCatalogContent & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "无法读取文件");
      setSourceContent(body);
    } catch (sourceError) { setError(sourceError instanceof Error ? sourceError.message : "无法读取文件"); }
  };

  return <section className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-semibold">提示词与设定</h2><p className="mt-1 text-sm text-neutral-500">查看模型真正收到的内容、输出约束和底层来源。本版本严格只读。</p></div>
      <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="h-4 w-4" />刷新目录</Button>
    </div>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="提示词透明化视图">
      {([['center','提示词中心',Braces],['sources','底层文件',FileCode2],['snapshots','运行快照',Database],['versions','版本与测评',BookOpen]] as const).map(([id,label,Icon]) =>
        <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${view === id ? "border-neutral-900 bg-neutral-900 text-white" : "bg-white text-neutral-600"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
    </div>
    {(error || storageError) && <div role="alert" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><span>{error ?? `运行快照未能保存：${storageError}`}</span></div>}
    <Filters query={query} onQuery={setQuery} modules={view === "center" ? modules : []} moduleFilter={moduleFilter} onModule={setModuleFilter} kindFilter={kindFilter} onKind={setKindFilter} providers={view === "snapshots" ? providers : []} providerFilter={providerFilter} onProvider={setProviderFilter} gitFilter={view === "sources" ? gitFilter : undefined} onGit={setGitFilter}/>

    {view === "center" && <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <div className="max-h-[720px] space-y-2 overflow-auto rounded-lg border bg-white p-2">{filteredDefinitions.map((item) => <button key={item.id} onClick={() => choosePrompt(item.id)} className={`w-full rounded-md border p-3 text-left ${activeDefinition?.id === item.id ? "border-neutral-900 bg-neutral-50" : "border-transparent hover:bg-neutral-50"}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{item.name}</span><span className="text-[10px] text-neutral-400">{item.version}</span></div><p className="mt-1 font-mono text-[10px] text-neutral-500">{item.id}</p><p className="mt-2 line-clamp-2 text-[11px] leading-5 text-neutral-500">{item.description}</p></button>)}</div>
      {activeDefinition ? <PromptDetail definition={activeDefinition} latestSnapshot={snapshots.find((item) => item.promptId === activeDefinition.id)} onOpenSource={openSource}/> : <Empty label="没有匹配的提示词"/>}
    </div>}

    {view === "sources" && <div className="grid gap-4 lg:grid-cols-[330px_1fr]">
      <div className="max-h-[720px] space-y-1 overflow-auto rounded-lg border bg-white p-2">{filteredSources.map((item) => <button key={item.path} onClick={() => void openSource(item.path)} className={`w-full rounded-md px-3 py-2 text-left hover:bg-neutral-50 ${sourceContent?.entry.path === item.path ? "bg-neutral-100" : ""}`}><div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 shrink-0"/><span className="truncate text-xs font-medium">{item.path}</span></div><p className="mt-1 text-[10px] text-neutral-400">{item.kind} · {item.gitStatus} · {(item.size / 1024).toFixed(1)} KB</p></button>)}</div>
      {sourceContent ? <div className="min-w-0 rounded-lg border bg-white p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3"><div><h3 className="text-sm font-semibold">{sourceContent.entry.path}</h3><p className="mt-1 font-mono text-[10px] text-neutral-400">SHA-256 {sourceContent.entry.hash}</p></div>{sourceContent.entry.kind === "markdown" && <Button variant="outline" size="sm" onClick={() => setRawMarkdown((value) => !value)}>{rawMarkdown ? "渲染预览" : "查看原文"}</Button>}</div>{sourceContent.entry.kind === "markdown" && !rawMarkdown ? <MarkdownPreview content={sourceContent.content}/> : <pre className="max-h-[650px] overflow-auto whitespace-pre-wrap rounded bg-neutral-950 p-4 text-[11px] leading-5 text-neutral-100">{sourceContent.content}</pre>}</div> : <Empty label="选择一个文件查看完整内容"/>}
    </div>}

    {view === "snapshots" && <div className="space-y-3"><div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">运行快照完整保存在本机，包含简历、JD、面试转写等敏感正文；Trace 导出同样包含完整内容。</div>{filteredSnapshots.length ? filteredSnapshots.map((snapshot) => <SnapshotCard key={snapshot.id} snapshot={snapshot} onOpenPrompt={() => { choosePrompt(snapshot.promptId); setView("center"); }}/>) : <Empty label="尚无提示词运行快照；开启工作台后运行一次真实模型调用即可生成"/>}</div>}

    {view === "versions" && <div className="space-y-3"><div className="rounded-lg border bg-white p-4"><p className="text-xs text-neutral-500">当前注册表指纹</p><p className="mt-2 break-all font-mono text-xs">{manifest?.manifestHash ?? "读取中…"}</p><p className="mt-2 text-[11px] text-neutral-400">批准基线：V{manifest?.baseline.version ?? "-"} · {manifest?.baseline.approvedAt ?? "-"}。提示词内容或元数据变化后，指纹会变化并立即标记为需要重测。</p></div><div className="overflow-auto rounded-lg border bg-white"><table className="w-full text-left text-xs"><thead className="bg-neutral-50 text-neutral-500"><tr><th className="p-3">提示词</th><th className="p-3">版本</th><th className="p-3">测评覆盖</th><th className="p-3">状态</th></tr></thead><tbody>{definitions.map((item) => { const baselineCurrent = Boolean(manifest && manifest.manifestHash === manifest.baseline.manifestHash); return <tr key={item.id} className="border-t"><td className="p-3"><button className="font-medium hover:underline" onClick={() => { choosePrompt(item.id); setView("center"); }}>{item.name}</button><p className="mt-1 font-mono text-[10px] text-neutral-400">{item.id}</p></td><td className="p-3">{item.version}</td><td className="p-3">{item.evaluation.suites.join(" · ") || "暂无"}</td><td className="p-3"><span className={`rounded px-2 py-1 text-[10px] ${baselineCurrent ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{baselineCurrent ? "基线有效" : "提示词已变化，需重测"}</span></td></tr>; })}</tbody></table></div></div>}
  </section>;
}

function PromptDetail({ definition, latestSnapshot, onOpenSource }: { definition: PromptDefinition; latestSnapshot?: PromptRuntimeSnapshot; onOpenSource: (path: string) => Promise<void> }) {
  return <div className="min-w-0 space-y-4 rounded-lg border bg-white p-5"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold">{definition.name}</h3><span className="rounded bg-neutral-100 px-2 py-1 text-[10px]">{definition.module}</span><span className="rounded bg-neutral-100 px-2 py-1 text-[10px]">{definition.callable ? "正式调用" : "运行时层"}</span></div><p className="mt-2 text-sm leading-6 text-neutral-600">{definition.description}</p></div><KeyValues values={[["Prompt ID",definition.id],["版本",definition.version],["工作流节点",definition.workflowNodeId ?? "全局运行时"],["输出 Schema",definition.schemaName ?? "由运行时决定"],["默认策略",`${definition.modelPolicy.provider} · ${definition.modelPolicy.maxTokens ?? "Provider 默认"} tokens · ${definition.modelPolicy.timeoutMs ? `${definition.modelPolicy.timeoutMs / 1000}s` : "运行时"}`]]}/><Block title="系统提示词模板" content={definition.systemTemplatePreview}/><Block title="用户提示词模板" content={definition.userTemplatePreview}/><div><h4 className="text-xs font-semibold">输入变量</h4><div className="mt-2 flex flex-wrap gap-1">{definition.variables.map((variable) => <code key={variable} className="rounded bg-neutral-100 px-2 py-1 text-[10px]">{variable}</code>)}</div></div><div><h4 className="text-xs font-semibold">底层来源</h4><div className="mt-2 space-y-1">{definition.sourceRefs.map((source, index) => <button key={`${source.path}-${index}`} onClick={() => void onOpenSource(source.path)} className="flex w-full items-center justify-between gap-3 rounded border px-3 py-2 text-left text-xs hover:bg-neutral-50"><span className="truncate">{source.path}{source.symbol ? ` · ${source.symbol}` : ""}</span><span className="shrink-0 text-[10px] text-neutral-400">{source.kind}</span></button>)}</div></div>{latestSnapshot && <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900"><p className="font-medium">最近运行：{latestSnapshot.provider} / {latestSnapshot.model}</p><p className="mt-1 font-mono text-[10px]">Prompt {latestSnapshot.promptHash.slice(0,16)}… · Schema {latestSnapshot.schemaHash.slice(0,16)}…</p></div>}</div>;
}

function SnapshotCard({ snapshot, onOpenPrompt }: { snapshot: PromptRuntimeSnapshot; onOpenPrompt: () => void }) {
  return <details className="rounded-lg border bg-white px-4 py-3"><summary className="cursor-pointer text-xs"><span className="font-semibold">{snapshot.promptId}</span> · {snapshot.attemptKind} · {snapshot.provider}/{snapshot.model} · {snapshot.status} · {new Date(snapshot.createdAt).toLocaleString("zh-CN")}</summary><div className="mt-4 space-y-4"><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={onOpenPrompt}>打开提示词定义</Button><span className="rounded bg-neutral-100 px-2 py-1 text-[10px]">Attempt {snapshot.attempt}</span><span className="rounded bg-neutral-100 px-2 py-1 text-[10px]">{snapshot.structuredOutputStrategy}</span></div><KeyValues values={[["Prompt Hash",snapshot.promptHash],["Schema Hash",snapshot.schemaHash],["Schema",snapshot.schemaName],["Response format",snapshot.responseFormat],["参数",`${snapshot.temperature ?? "省略 temperature"} · ${snapshot.maxTokens} tokens · ${snapshot.timeoutMs / 1000}s`]]}/><Block title="原始系统提示词" content={snapshot.baseSystemPrompt}/><Block title="运行时用户提示词（敏感）" content={snapshot.runtimeUserPrompt}/><Block title="模型实际收到的 System" content={snapshot.sentSystemPrompt}/><Block title="模型实际收到的 User（敏感）" content={snapshot.sentUserPrompt}/><Block title="完整输出 Schema" content={snapshot.schemaContract}/>{snapshot.validationIssues.length > 0 && <Block title="结构校验问题" content={snapshot.validationIssues.join("\n")}/>}</div></details>;
}

function Filters(props: { query: string; onQuery: (value: string) => void; modules: string[]; moduleFilter: string; onModule: (value: string) => void; kindFilter: string; onKind: (value: string) => void; providers: string[]; providerFilter: string; onProvider: (value: string) => void; gitFilter?: string; onGit: (value: string) => void }) {
  return <div className="flex flex-wrap gap-2 rounded-lg border bg-white p-3"><label className="flex min-w-56 flex-1 items-center gap-2 rounded border px-2"><Search className="h-3.5 w-3.5 text-neutral-400"/><span className="sr-only">搜索</span><input value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder="搜索模块、Prompt ID、文件或模型" className="h-8 w-full bg-transparent text-xs outline-none"/></label>{props.modules.length > 0 && <Select label="模块" value={props.moduleFilter} onChange={props.onModule} options={props.modules}/>}<Select label="类型" value={props.kindFilter} onChange={props.onKind} options={["system-prompt","user-prompt-template","schema-instruction","structure-repair","output-schema","model-policy","markdown","prompt-source","schema-source"]}/>{props.providers.length > 0 && <Select label="Provider" value={props.providerFilter} onChange={props.onProvider} options={props.providers}/>} {props.gitFilter !== undefined && <Select label="Git 状态" value={props.gitFilter} onChange={props.onGit} options={["tracked","modified","untracked","unknown"]}/>}</div>;
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <label className="text-[10px] text-neutral-500"><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded border bg-white px-2 text-xs text-neutral-700"><option value="all">全部{label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; }
function KeyValues({ values }: { values: Array<[string,string]> }) { return <dl className="grid gap-2 rounded-md bg-neutral-50 p-3 sm:grid-cols-2">{values.map(([label,value]) => <div key={label} className="min-w-0"><dt className="text-[10px] text-neutral-400">{label}</dt><dd className="mt-1 break-all font-mono text-[11px] text-neutral-700">{value}</dd></div>)}</dl>; }
function Block({ title, content }: { title: string; content: string }) { return <details className="rounded-md border" open={title === "系统提示词模板" || title === "用户提示词模板"}><summary className="cursor-pointer px-3 py-2 text-xs font-medium">{title}</summary><pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t bg-neutral-950 p-3 text-[11px] leading-5 text-neutral-100">{content}</pre></details>; }
function Empty({ label }: { label: string }) { return <div className="rounded-lg border border-dashed bg-white p-10 text-center text-xs text-neutral-500">{label}</div>; }
