"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionTitle } from "@/components/shared/ui-helpers";
import { useCareerDomain } from "@/hooks/use-career-domain";
import { calculateVerifiedCapabilityLevel, isMetricComplete } from "@/lib/career/capability-level";
import { postWorkflowJSON } from "@/services/ai/resumeAgent";
import { useResumeStore } from "@/store/resume-store";
import type { CapabilityCategory, CareerDomainSnapshot, CareerExperience, CareerInterviewAnswer, CareerInterviewSession, EvidenceClaim } from "@/types/career-domain";

type View = "experiences" | "claims" | "capabilities" | "interview";
const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export function CareerWorkspace() {
  const { snapshot, loading, error, save } = useCareerDomain();
  const { dirtyScope, setDirtyScope } = useResumeStore();
  const [view, setView] = useState<View>("experiences");
  const [message, setMessage] = useState("");
  const persist = async (next: CareerDomainSnapshot) => { await save(next); setDirtyScope(null); setMessage("已保存到本机经历事实库"); };
  const changeView = (next: View) => {
    if (dirtyScope === "career" && !window.confirm("经历资料还有未保存修改，确定离开吗？")) return;
    setDirtyScope(null); setView(next);
  };
  if (loading) return <div className="flex items-center gap-2 py-12 text-sm text-neutral-500"><Loader2 className="animate-spin" />正在加载经历事实库…</div>;
  return <div>
    <SectionTitle title="个人经历事实与能力库" description="先维护经历容器和可核验原子事实，再将已确认内容用于岗位分析、简历与面试。" />
    <div className="mb-5 flex flex-wrap gap-2" role="tablist">
      {(["experiences", "claims", "capabilities", "interview"] as View[]).map((item) => <Button key={item} role="tab" aria-selected={view === item} variant={view === item ? "default" : "outline"} size="sm" onClick={() => changeView(item)}>{({ experiences: "经历", claims: "事实", capabilities: "能力", interview: "项目梳理" } as const)[item]}</Button>)}
    </div>
    {(error || message) && <p className={`mb-4 rounded border px-3 py-2 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "bg-neutral-50"}`} aria-live="polite">{error || message}</p>}
    {view === "experiences" && <Experiences snapshot={snapshot} persist={persist} />}
    {view === "claims" && <Claims snapshot={snapshot} persist={persist} />}
    {view === "capabilities" && <Capabilities snapshot={snapshot} persist={persist} />}
    {view === "interview" && <Interview snapshot={snapshot} persist={persist} />}
  </div>;
}

function Experiences({ snapshot, persist }: PaneProps) {
  const deleteEvidence = useResumeStore((state) => state.deleteCareerEvidence);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ type: "project", title: "", organization: "", role: "", periodText: "", summary: "" });
  const add = async () => {
    const timestamp = now();
    const item: CareerExperience = { id: uid("experience"), type: draft.type as CareerExperience["type"], title: draft.title.trim(), organization: draft.organization.trim(), role: draft.role.trim(), startDate: "", endDate: "", periodText: draft.periodText.trim(), summary: draft.summary.trim(), order: snapshot.experiences.length, status: "confirmed", createdAt: timestamp, updatedAt: timestamp };
    await persist({ ...snapshot, experiences: [...snapshot.experiences, item] }); setAdding(false);
  };
  const confirm = (id: string) => persist({ ...snapshot, experiences: snapshot.experiences.map((item) => item.id === id ? { ...item, status: "confirmed", updatedAt: now() } : item) });
  const remove = async (id: string) => {
    if (!window.confirm("删除经历会同时删除其中的事实、指标和能力关联，是否继续？")) return;
    const claimIds = new Set(snapshot.claims.filter((item) => item.experienceId === id).map((item) => item.id));
    claimIds.forEach((claimId) => deleteEvidence(claimId));
    await persist({ ...snapshot, experiences: snapshot.experiences.filter((item) => item.id !== id), claims: snapshot.claims.filter((item) => item.experienceId !== id), metrics: snapshot.metrics.filter((item) => !claimIds.has(item.claimId)), capabilityLinks: snapshot.capabilityLinks.filter((item) => !claimIds.has(item.claimId)) });
  };
  return <div className="space-y-3">
    <div className="flex justify-end"><Button size="sm" onClick={() => setAdding(true)}><Plus />新增经历</Button></div>
    {adding && <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2">
      <Field label="类型"><Select value={draft.type} onValueChange={(type) => setDraft({ ...draft, type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="work">工作</SelectItem><SelectItem value="project">项目</SelectItem><SelectItem value="internship">实习</SelectItem></SelectContent></Select></Field>
      <Field label="名称"><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
      <Field label="组织/公司"><Input value={draft.organization} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} /></Field>
      <Field label="角色"><Input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} /></Field>
      <Field label="时间"><Input value={draft.periodText} onChange={(e) => setDraft({ ...draft, periodText: e.target.value })} /></Field>
      <Field label="摘要"><Input value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></Field>
      <div className="sm:col-span-2 flex justify-end gap-2"><Button variant="outline" onClick={() => setAdding(false)}>取消</Button><Button disabled={!draft.title.trim()} onClick={() => void add()}><Save />保存</Button></div>
    </CardContent></Card>}
    {[...snapshot.experiences].sort((a, b) => a.order - b.order).map((item, index) => <ExperienceCard key={item.id} item={item} index={index} snapshot={snapshot} persist={persist} confirm={() => void confirm(item.id)} remove={() => void remove(item.id)} />)}
  </div>;
}

function ExperienceCard({ item, index, snapshot, persist, confirm, remove }: { item: CareerExperience; index: number; snapshot: CareerDomainSnapshot; persist: PaneProps["persist"]; confirm: () => void; remove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ type: item.type, title: item.title, organization: item.organization, role: item.role, periodText: item.periodText, summary: item.summary });
  const { setDirtyScope, updateCareerEvidence } = useResumeStore();
  const saveEdit = async () => {
    const changed = JSON.stringify(draft) !== JSON.stringify({ type: item.type, title: item.title, organization: item.organization, role: item.role, periodText: item.periodText, summary: item.summary });
    if (changed) {
      snapshot.claims.filter((claim) => claim.experienceId === item.id).forEach((claim) => updateCareerEvidence(claim.id, { title: draft.title, organization: draft.organization, role: draft.role, period: draft.periodText, type: draft.type === "project" ? "project" : "work" }));
      await persist({ ...snapshot, experiences: snapshot.experiences.map((value) => value.id === item.id ? { ...value, ...draft, status: value.status === "confirmed" ? "needs-review" : value.status, updatedAt: now() } : value) });
    }
    setDirtyScope(null); setEditing(false);
  };
  const move = async (offset: number) => {
    const ordered = [...snapshot.experiences].sort((a, b) => a.order - b.order); const target = ordered[index + offset]; if (!target) return;
    await persist({ ...snapshot, experiences: snapshot.experiences.map((value) => value.id === item.id ? { ...value, order: target.order, updatedAt: now() } : value.id === target.id ? { ...value, order: item.order, updatedAt: now() } : value) });
  };
  return <Card className={item.type === "inbox" ? "border-amber-300" : ""}><CardContent className="p-4">{editing ? <div className="grid gap-3 sm:grid-cols-2">
    <Field label="类型"><Select value={draft.type} onValueChange={(value) => { setDraft({ ...draft, type: value as CareerExperience["type"] }); setDirtyScope("career"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="work">工作</SelectItem><SelectItem value="project">项目</SelectItem><SelectItem value="internship">实习</SelectItem><SelectItem value="inbox">待整理箱</SelectItem></SelectContent></Select></Field>
    <Field label="名称"><Input value={draft.title} onChange={(event) => { setDraft({ ...draft, title: event.target.value }); setDirtyScope("career"); }} /></Field>
    <Field label="组织/公司"><Input value={draft.organization} onChange={(event) => { setDraft({ ...draft, organization: event.target.value }); setDirtyScope("career"); }} /></Field>
    <Field label="角色"><Input value={draft.role} onChange={(event) => { setDraft({ ...draft, role: event.target.value }); setDirtyScope("career"); }} /></Field>
    <Field label="时间"><Input value={draft.periodText} onChange={(event) => { setDraft({ ...draft, periodText: event.target.value }); setDirtyScope("career"); }} /></Field>
    <Field label="摘要"><Input value={draft.summary} onChange={(event) => { setDraft({ ...draft, summary: event.target.value }); setDirtyScope("career"); }} /></Field>
    <div className="sm:col-span-2 flex justify-end gap-2"><Button variant="outline" onClick={() => { setEditing(false); setDirtyScope(null); }}>取消</Button><Button disabled={!draft.title.trim()} onClick={() => void saveEdit()}><Save />保存修改</Button></div>
  </div> : <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap gap-2"><h3 className="font-medium">{item.title}</h3><Badge variant="outline">{typeLabel(item.type)}</Badge><Badge variant={item.status === "confirmed" ? "success" : "secondary"}>{statusLabel(item.status)}</Badge></div><p className="mt-1 text-xs text-neutral-500">{[item.organization, item.role, item.periodText].filter(Boolean).join(" · ")}</p><p className="mt-2 text-sm">{item.summary}</p><p className="mt-2 text-xs text-neutral-500">{snapshot.claims.filter((claim) => claim.experienceId === item.id).length} 条原子事实</p></div><div className="flex flex-wrap gap-1"><Button aria-label="上移经历" variant="ghost" size="sm" disabled={index === 0} onClick={() => void move(-1)}><ChevronUp /></Button><Button aria-label="下移经历" variant="ghost" size="sm" disabled={index === snapshot.experiences.length - 1} onClick={() => void move(1)}><ChevronDown /></Button>{item.status !== "confirmed" && item.type !== "inbox" && <Button size="sm" onClick={confirm}><Check />确认分组</Button>}<Button aria-label={`编辑经历 ${item.title}`} variant="ghost" size="sm" onClick={() => setEditing(true)}><Pencil /></Button><Button aria-label={`删除经历 ${item.title}`} variant="ghost" size="sm" className="text-red-600" onClick={remove}><Trash2 /></Button></div></div>}</CardContent></Card>;
}

function Claims({ snapshot, persist }: PaneProps) {
  const [experienceId, setExperienceId] = useState(snapshot.experiences.find((item) => item.type !== "inbox")?.id ?? "");
  const [text, setText] = useState("");
  const [kind, setKind] = useState<EvidenceClaim["kind"]>("action");
  const deleteEvidence = useResumeStore((state) => state.deleteCareerEvidence);
  const add = async () => {
    const timestamp = now(); const item: EvidenceClaim = { id: uid("claim"), experienceId, kind, text: text.trim(), contribution: "independent", complexity: "routine", hasTradeoff: false, hasMethodReuse: false, status: "confirmed", sourceReference: null, sourceQuote: text.trim(), sourceRunId: null, sourceRound: null, createdAt: timestamp, updatedAt: timestamp };
    await persist({ ...snapshot, claims: [...snapshot.claims, item] }); setText("");
  };
  const confirm = (id: string) => persist({ ...snapshot, claims: snapshot.claims.map((item) => item.id === id ? { ...item, status: "confirmed", updatedAt: now() } : item) });
  const remove = async (id: string) => { deleteEvidence(id); await persist({ ...snapshot, claims: snapshot.claims.filter((item) => item.id !== id), metrics: snapshot.metrics.filter((item) => item.claimId !== id), capabilityLinks: snapshot.capabilityLinks.filter((item) => item.claimId !== id) }); };
  return <div className="space-y-4"><Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2"><Field label="所属经历"><Select value={experienceId} onValueChange={setExperienceId}><SelectTrigger><SelectValue placeholder="选择经历" /></SelectTrigger><SelectContent>{snapshot.experiences.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select></Field><Field label="事实类型"><Select value={kind} onValueChange={(value) => setKind(value as EvidenceClaim["kind"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["responsibility", "action", "decision", "result", "skill-practice"].map((value) => <SelectItem key={value} value={value}>{kindLabel(value as EvidenceClaim["kind"])}</SelectItem>)}</SelectContent></Select></Field><div className="sm:col-span-2"><Field label="最小可核验事实"><Textarea value={text} onChange={(e) => setText(e.target.value)} /></Field></div><div className="sm:col-span-2 flex justify-end"><Button disabled={!experienceId || !text.trim()} onClick={() => void add()}><Plus />添加已确认事实</Button></div></CardContent></Card>
    {snapshot.claims.map((item) => <ClaimCard key={item.id} item={item} snapshot={snapshot} confirm={() => void confirm(item.id)} remove={() => void remove(item.id)} persist={persist} />)}
  </div>;
}

function ClaimCard({ item, snapshot, confirm, remove, persist }: { item: EvidenceClaim; snapshot: CareerDomainSnapshot; confirm: () => void; remove: () => void; persist: PaneProps["persist"] }) {
  const metrics = snapshot.metrics.filter((metric) => metric.claimId === item.id);
  const [metric, setMetric] = useState({ value: "", unit: "", baseline: "", method: "", period: "", sourceNote: "" });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ text: item.text, experienceId: item.experienceId, kind: item.kind, contribution: item.contribution, complexity: item.complexity, hasTradeoff: item.hasTradeoff, hasMethodReuse: item.hasMethodReuse });
  const { setDirtyScope, updateCareerEvidence } = useResumeStore();
  const addMetric = async () => { const timestamp = now(); await persist({ ...snapshot, metrics: [...snapshot.metrics, { id: uid("metric"), claimId: item.id, ...metric, status: isMetricComplete(metric) ? "confirmed" : "needs-review", createdAt: timestamp, updatedAt: timestamp }] }); };
  const saveEdit = async () => {
    const factualChange = draft.text.trim() !== item.text || draft.experienceId !== item.experienceId || draft.kind !== item.kind || draft.contribution !== item.contribution || draft.complexity !== item.complexity || draft.hasTradeoff !== item.hasTradeoff || draft.hasMethodReuse !== item.hasMethodReuse;
    if (!factualChange) { setEditing(false); setDirtyScope(null); return; }
    updateCareerEvidence(item.id, { description: draft.text.trim(), type: snapshot.experiences.find((value) => value.id === draft.experienceId)?.type === "project" ? "project" : "work" });
    await persist({ ...snapshot,
      claims: snapshot.claims.map((value) => value.id === item.id ? { ...value, ...draft, text: draft.text.trim(), status: "needs-review", updatedAt: now() } : value),
      metrics: snapshot.metrics.map((value) => value.claimId === item.id ? { ...value, status: "needs-review", updatedAt: now() } : value),
      capabilityLinks: snapshot.capabilityLinks.map((value) => value.claimId === item.id ? { ...value, status: "needs-review", updatedAt: now() } : value),
    });
    setEditing(false);
  };
  return <Card className={item.status === "needs-review" ? "border-amber-300" : ""}><CardContent className="p-4">{editing ? <div className="grid gap-3 sm:grid-cols-2">
    <div className="sm:col-span-2"><Field label="事实内容"><Textarea value={draft.text} onChange={(event) => { setDraft({ ...draft, text: event.target.value }); setDirtyScope("career"); }} /></Field></div>
    <Field label="所属经历"><Select value={draft.experienceId} onValueChange={(value) => { setDraft({ ...draft, experienceId: value }); setDirtyScope("career"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{snapshot.experiences.map((value) => <SelectItem key={value.id} value={value.id}>{value.title}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="事实类型"><Select value={draft.kind} onValueChange={(value) => { setDraft({ ...draft, kind: value as EvidenceClaim["kind"] }); setDirtyScope("career"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["responsibility", "action", "decision", "result", "skill-practice"].map((value) => <SelectItem key={value} value={value}>{kindLabel(value as EvidenceClaim["kind"])}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="贡献方式"><Select value={draft.contribution} onValueChange={(value) => { setDraft({ ...draft, contribution: value as EvidenceClaim["contribution"] }); setDirtyScope("career"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="assisted">协助</SelectItem><SelectItem value="independent">独立完成</SelectItem><SelectItem value="led">主导</SelectItem></SelectContent></Select></Field>
    <Field label="场景复杂度"><Select value={draft.complexity} onValueChange={(value) => { setDraft({ ...draft, complexity: value as EvidenceClaim["complexity"] }); setDirtyScope("career"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="routine">常规</SelectItem><SelectItem value="complex">复杂</SelectItem></SelectContent></Select></Field>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.hasTradeoff} onChange={(event) => { setDraft({ ...draft, hasTradeoff: event.target.checked }); setDirtyScope("career"); }} />包含取舍说明</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.hasMethodReuse} onChange={(event) => { setDraft({ ...draft, hasMethodReuse: event.target.checked }); setDirtyScope("career"); }} />包含方法沉淀或指导</label>
    <div className="sm:col-span-2 flex justify-end gap-2"><Button variant="outline" onClick={() => { setDraft({ text: item.text, experienceId: item.experienceId, kind: item.kind, contribution: item.contribution, complexity: item.complexity, hasTradeoff: item.hasTradeoff, hasMethodReuse: item.hasMethodReuse }); setEditing(false); setDirtyScope(null); }}>取消</Button><Button disabled={!draft.text.trim()} onClick={() => void saveEdit()}><Save />保存修改</Button></div>
  </div> : <div className="flex justify-between gap-4"><div><div className="flex gap-2"><Badge variant="outline">{kindLabel(item.kind)}</Badge><Badge variant={item.status === "confirmed" ? "success" : "secondary"}>{statusLabel(item.status)}</Badge></div><p className="mt-2 text-sm leading-6">{item.text}</p>{item.sourceQuote && <p className="mt-2 text-xs text-neutral-500">原文：“{item.sourceQuote}” · 第 {item.sourceRound ?? "-"} 轮</p>}</div><div className="flex gap-1">{item.status !== "confirmed" && <Button size="sm" onClick={confirm}><Check />确认</Button>}<Button aria-label="编辑事实" variant="ghost" size="sm" onClick={() => setEditing(true)}><Pencil /></Button><Button aria-label="删除事实" variant="ghost" size="sm" className="text-red-600" onClick={remove}><Trash2 /></Button></div></div>}
    <div className="mt-3 border-t pt-3"><p className="text-xs font-medium">量化证据</p>{metrics.map((value) => <p key={value.id} className="mt-1 text-xs">{value.value}{value.unit} · {value.method || "缺统计方法"} · {value.sourceNote || "缺来源"} <Badge variant={value.status === "confirmed" ? "success" : "secondary"}>{statusLabel(value.status)}</Badge></p>)}<div className="mt-2 grid gap-2 sm:grid-cols-3"><Input aria-label="指标值" placeholder="数值" value={metric.value} onChange={(e) => setMetric({ ...metric, value: e.target.value })} /><Input aria-label="指标单位" placeholder="单位" value={metric.unit} onChange={(e) => setMetric({ ...metric, unit: e.target.value })} /><Input aria-label="指标基线" placeholder="基线" value={metric.baseline} onChange={(e) => setMetric({ ...metric, baseline: e.target.value })} /><Input aria-label="统计方法" placeholder="统计方法（必填）" value={metric.method} onChange={(e) => setMetric({ ...metric, method: e.target.value })} /><Input aria-label="统计周期" placeholder="周期" value={metric.period} onChange={(e) => setMetric({ ...metric, period: e.target.value })} /><Input aria-label="指标来源" placeholder="来源说明（必填）" value={metric.sourceNote} onChange={(e) => setMetric({ ...metric, sourceNote: e.target.value })} /></div><Button className="mt-2" variant="outline" size="sm" disabled={!metric.value.trim()} onClick={() => void addMetric()}>添加指标</Button></div></CardContent></Card>;
}

function Capabilities({ snapshot, persist }: PaneProps) {
  const [name, setName] = useState(""); const [category, setCategory] = useState<CapabilityCategory>("product"); const [claimId, setClaimId] = useState(""); const [capabilityId, setCapabilityId] = useState("");
  const add = async () => { const timestamp = now(); const id = uid("capability"); await persist({ ...snapshot, capabilities: [...snapshot.capabilities, { id, name: name.trim(), category, aliases: [], selfLevel: 0, createdAt: timestamp, updatedAt: timestamp }] }); setName(""); };
  const link = async () => { const timestamp = now(); await persist({ ...snapshot, capabilityLinks: [...snapshot.capabilityLinks.filter((item) => !(item.capabilityId === capabilityId && item.claimId === claimId)), { id: uid("capability-link"), capabilityId, claimId, status: "confirmed", source: "manual", createdAt: timestamp, updatedAt: timestamp }] }); };
  return <div className="space-y-4"><Card><CardContent className="grid gap-3 p-4 sm:grid-cols-3"><Field label="能力名称"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="分类"><Select value={category} onValueChange={(value) => setCategory(value as CapabilityCategory)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["product", "technology", "data", "industry", "collaboration", "custom"].map((value) => <SelectItem key={value} value={value}>{categoryLabel(value as CapabilityCategory)}</SelectItem>)}</SelectContent></Select></Field><div className="flex items-end"><Button disabled={!name.trim()} onClick={() => void add()}><Plus />新增能力</Button></div></CardContent></Card>
    <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-3"><Field label="能力"><Select value={capabilityId} onValueChange={setCapabilityId}><SelectTrigger><SelectValue placeholder="选择能力" /></SelectTrigger><SelectContent>{snapshot.capabilities.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field><Field label="已确认事实"><Select value={claimId} onValueChange={setClaimId}><SelectTrigger><SelectValue placeholder="选择事实" /></SelectTrigger><SelectContent>{snapshot.claims.filter((item) => item.status === "confirmed").map((item) => <SelectItem key={item.id} value={item.id}>{item.text.slice(0, 35)}</SelectItem>)}</SelectContent></Select></Field><div className="flex items-end"><Button disabled={!capabilityId || !claimId} onClick={() => void link()}>关联事实</Button></div></CardContent></Card>
    <div className="grid gap-3 md:grid-cols-2">{snapshot.capabilities.map((item) => { const verified = calculateVerifiedCapabilityLevel(item.id, snapshot.experiences, snapshot.claims, snapshot.metrics, snapshot.capabilityLinks); return <Card key={item.id}><CardHeader><CardTitle className="flex items-center justify-between text-sm"><span>{item.name}</span><Badge variant="outline">{categoryLabel(item.category)}</Badge></CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 gap-3 text-sm"><div>自评等级：<Select value={String(item.selfLevel)} onValueChange={(value) => void persist({ ...snapshot, capabilities: snapshot.capabilities.map((capability) => capability.id === item.id ? { ...capability, selfLevel: Number(value) as 0 | 1 | 2 | 3 | 4, updatedAt: now() } : capability) })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{[0,1,2,3,4].map((level) => <SelectItem key={level} value={String(level)}>{level}</SelectItem>)}</SelectContent></Select></div><div>证据校验：<p className="mt-2 text-xl font-semibold">{verified.level}</p></div></div><p className="mt-3 text-xs text-neutral-500">{verified.reasons.join("；")}</p></CardContent></Card>; })}</div>
  </div>;
}

function Interview({ snapshot, persist }: PaneProps) {
  const targetRole = useResumeStore((state) => state.userInput.targetRole);
  const [draft, setDraft] = useState({ targetRole, experienceTitle: "", background: "" });
  const [sessionId, setSessionId] = useState(snapshot.interviewSessions.find((item) => item.status === "active")?.id ?? "");
  const session = snapshot.interviewSessions.find((item) => item.id === sessionId) ?? null;
  const [answers, setAnswers] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const run = async (current: CareerInterviewSession | null, endRequested = false) => {
    setBusy(true); setError("");
    try {
      const id = current?.id ?? uid("interview"); const round = Math.min(5, (current?.round ?? 0) + 1);
      const currentRound = current?.round ?? 0;
      const nextAnswers: CareerInterviewAnswer[] = [...(current?.answers ?? []), ...(current?.latestTurn?.nextQuestions ?? []).map((question) => ({ questionId: question.id, question: question.question, answer: answers[question.id]?.trim() ?? "", round: currentRound })).filter((item) => item.answer)];
      const result = await postWorkflowJSON<{ turn: CareerInterviewSession["latestTurn"]; mode: "mock" | "llm" }>("/api/career/interview", { sessionId: id, targetRole: current?.targetRole ?? draft.targetRole, experienceTitle: current?.experienceTitle ?? draft.experienceTitle, background: current?.background ?? draft.background, round, answers: nextAnswers, endRequested });
      const timestamp = now(); const next: CareerInterviewSession = { id, experienceId: current?.experienceId ?? null, targetRole: current?.targetRole ?? draft.targetRole, experienceTitle: current?.experienceTitle ?? draft.experienceTitle, background: current?.background ?? draft.background, round, answers: nextAnswers, latestTurn: result.turn, status: result.turn?.shouldFinish ? "review" : "active", createdAt: current?.createdAt ?? timestamp, updatedAt: timestamp };
      await persist({ ...snapshot, interviewSessions: [...snapshot.interviewSessions.filter((item) => item.id !== id), next] }); setSessionId(id); setAnswers({});
    } catch (next) { setError(next instanceof Error ? next.message : "项目梳理失败"); } finally { setBusy(false); }
  };
  const acceptClaim = async (claimDraftId: string) => {
    if (!session?.latestTurn) return; const draftClaim = session.latestTurn.claimDrafts.find((item) => item.id === claimDraftId); if (!draftClaim) return;
    const timestamp = now(); let experienceId = session.experienceId; let experiences = snapshot.experiences;
    if (!experienceId) { experienceId = uid("experience"); experiences = [...experiences, { id: experienceId, type: "project", title: session.experienceTitle, organization: "", role: session.targetRole, startDate: "", endDate: "", periodText: "", summary: session.background.slice(0, 240), order: experiences.length, status: "confirmed", createdAt: timestamp, updatedAt: timestamp }]; }
    const claim: EvidenceClaim = { id: `claim-${draftClaim.id}`, experienceId, kind: draftClaim.kind, text: draftClaim.text, contribution: draftClaim.contribution, complexity: draftClaim.complexity, hasTradeoff: draftClaim.hasTradeoff, hasMethodReuse: draftClaim.hasMethodReuse, status: draftClaim.status === "candidate" ? "confirmed" : "needs-review", sourceReference: null, sourceQuote: draftClaim.sourceQuote, sourceRunId: session.latestTurn.runId, sourceRound: draftClaim.sourceRound, createdAt: timestamp, updatedAt: timestamp };
    await persist({ ...snapshot, experiences, claims: [...snapshot.claims.filter((item) => item.id !== claim.id), claim], interviewSessions: snapshot.interviewSessions.map((item) => item.id === session.id ? { ...item, experienceId, updatedAt: timestamp } : item) });
  };
  return <div className="space-y-4">{!session && <Card><CardContent className="space-y-3 p-4"><Field label="目标岗位"><Input value={draft.targetRole} onChange={(e) => setDraft({ ...draft, targetRole: e.target.value })} /></Field><Field label="经历/项目名称"><Input value={draft.experienceTitle} onChange={(e) => setDraft({ ...draft, experienceTitle: e.target.value })} /></Field><Field label="现有背景与已知事实"><Textarea className="min-h-32" value={draft.background} onChange={(e) => setDraft({ ...draft, background: e.target.value })} /></Field><Button disabled={busy || !draft.targetRole.trim() || !draft.experienceTitle.trim() || draft.background.trim().length < 10} onClick={() => void run(null)}>{busy && <Loader2 className="animate-spin" />}开始项目梳理</Button></CardContent></Card>}
    {session && <><Card><CardContent className="p-4"><div className="flex justify-between"><div><h3 className="font-medium">{session.experienceTitle}</h3><p className="text-xs text-neutral-500">第 {session.round}/5 轮 · {session.status === "review" ? "进入事实核对" : "访谈中"}</p></div><Button variant="outline" size="sm" onClick={() => setSessionId("")}>新建会话</Button></div>{session.latestTurn?.nextQuestions.map((question) => <div key={question.id} className="mt-4"><Label htmlFor={question.id}>{question.question}</Label><Textarea id={question.id} className="mt-1" value={answers[question.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })} /><p className="text-xs text-neutral-500">{question.purpose}</p></div>)}<div className="mt-4 flex gap-2">{!session.latestTurn?.shouldFinish && <Button disabled={busy} onClick={() => void run(session)}>{busy && <Loader2 className="animate-spin" />}继续下一轮</Button>}<Button variant="outline" disabled={busy || session.latestTurn?.shouldFinish} onClick={() => void run(session, true)}>结束并核对</Button></div></CardContent></Card>
    <div className="space-y-3">{session.latestTurn?.claimDrafts.map((claim) => <Card key={claim.id} className={claim.status === "needs-review" ? "border-amber-300" : ""}><CardContent className="flex justify-between gap-4 p-4"><div><div className="flex gap-2"><Badge variant="outline">{kindLabel(claim.kind)}</Badge><Badge variant={claim.status === "candidate" ? "secondary" : "danger"}>{claim.status === "candidate" ? "候选" : "待复核"}</Badge></div><p className="mt-2 text-sm">{claim.text}</p><p className="mt-2 text-xs text-neutral-500">原文：“{claim.sourceQuote || "无可验证引用"}”</p></div><Button size="sm" onClick={() => void acceptClaim(claim.id)}><Check />{claim.status === "candidate" ? "确认事实" : "保存待复核"}</Button></CardContent></Card>)}</div></>}{error && <p className="text-sm text-red-700">{error}</p>}</div>;
}

interface PaneProps { snapshot: CareerDomainSnapshot; persist: (value: CareerDomainSnapshot) => Promise<void> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function statusLabel(value: string) { return ({ candidate: "待确认", confirmed: "已确认", "needs-review": "待复核", superseded: "已替代" } as Record<string, string>)[value] ?? value; }
function typeLabel(value: CareerExperience["type"]) { return ({ work: "工作", project: "项目", internship: "实习", inbox: "待整理箱" } as const)[value]; }
function kindLabel(value: EvidenceClaim["kind"]) { return ({ responsibility: "职责", action: "行动", decision: "决策", result: "结果", "skill-practice": "技能实践" } as const)[value]; }
function categoryLabel(value: CapabilityCategory) { return ({ product: "产品", technology: "技术", data: "数据", industry: "行业", collaboration: "协作", custom: "自定义" } as const)[value]; }
