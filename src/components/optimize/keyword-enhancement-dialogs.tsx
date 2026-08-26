"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { normalizeKeyword, stableKeywordSource } from "@/lib/optimize/keyword-enhancement";
import type { CareerDomainSnapshot, CareerExperienceType, CapabilityCategory, EvidenceClaimKind } from "@/types/career-domain";
import type { OptimizedItem } from "@/types/resume";

export function KeywordVerificationDialog({ item, open, onOpenChange, onConfirm }: {
  item: OptimizedItem | null; open: boolean; onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const [verified, setVerified] = useState(false);
  useEffect(() => { if (open) setVerified(false); }, [open, item?.id]);
  const draft = item?.keywordEnhancement;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
    <DialogHeader><DialogTitle>核验关键词增强稿</DialogTitle><DialogDescription>补正证据不是强制步骤。请逐字核对后自行决定是否采用。</DialogDescription></DialogHeader>
    {draft && <div className="space-y-4 text-sm">
      <Compare label="当前修改后" text={draft.sourceAfter} />
      <Compare label="AI 增强稿" text={draft.enhancedText} emphasis />
      <div><p className="mb-2 font-medium">新增关键词</p><div className="flex flex-wrap gap-1">{draft.selectedKeywords.map((keyword) => <Badge key={keyword} className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">{keyword}</Badge>)}</div></div>
      <div className="grid gap-3 sm:grid-cols-2"><InfoList title="已找到的证据" values={draft.foundEvidence} empty="没有找到直接证据" /><InfoList title="仍缺少的证据" values={draft.missingEvidence} empty="没有明显证据缺口" warning /></div>
      {draft.riskWarnings.length > 0 && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900"><p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" />风险提醒</p><ul className="mt-2 list-disc space-y-1 pl-5">{draft.riskWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
      <label className="flex items-start gap-2 rounded-md border p-3"><input className="mt-1" type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} /><span>我已逐字核验，确认这段内容真实，并愿意将其用于当前岗位简历。此确认不会把 AI 文本自动写入经历证据库。</span></label>
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button disabled={!verified} onClick={onConfirm}><CheckCircle2 className="h-4 w-4" />确认采用</Button></div>
    </div>}
  </DialogContent></Dialog>;
}

export function KeywordEvidenceCorrectionDialog({ item, documentId, snapshot, open, onOpenChange, persist, onSaved }: {
  item: OptimizedItem | null; documentId: string; snapshot: CareerDomainSnapshot; open: boolean;
  onOpenChange: (open: boolean) => void; persist: (snapshot: CareerDomainSnapshot) => Promise<void>;
  onSaved: (claimId: string, sourceId: string, claimText: string) => Promise<void>;
}) {
  const draft = item?.keywordEnhancement;
  const [keyword, setKeyword] = useState("");
  const [experienceId, setExperienceId] = useState("new");
  const [experience, setExperience] = useState({ type: "project" as CareerExperienceType, title: "", organization: "", role: "" });
  const [fact, setFact] = useState({ text: "", kind: "action" as EvidenceClaimKind, contribution: "independent" as const, complexity: "routine" as const });
  const [metric, setMetric] = useState({ value: "", unit: "", baseline: "", method: "", period: "", sourceNote: "" });
  const [capabilityCategory, setCapabilityCategory] = useState<CapabilityCategory>("custom");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setKeyword(draft?.selectedKeywords[0] ?? "");
    setExperienceId(snapshot.experiences.find((value) => value.status === "confirmed")?.id ?? "new");
    setExperience({ type: "project", title: "", organization: "", role: "" });
    setFact({ text: "", kind: "action", contribution: "independent", complexity: "routine" });
    setMetric({ value: "", unit: "", baseline: "", method: "", period: "", sourceNote: "" });
    setConfirmed(false); setError("");
  }, [draft?.selectedKeywords, open, item?.id, snapshot.experiences]);

  const save = async () => {
    if (!item || !draft || !keyword || !fact.text.trim() || !confirmed) return;
    setSaving(true); setError("");
    try {
      const sourceId = stableKeywordSource(documentId, item.id, keyword);
      const timestamp = new Date().toISOString();
      const claimId = `claim-${stableHash(sourceId)}`;
      const resolvedExperienceId = experienceId === "new" ? `experience-${stableHash(sourceId)}` : experienceId;
      const experiences = experienceId === "new"
        ? upsert(snapshot.experiences, { id: resolvedExperienceId, type: experience.type, title: experience.title.trim() || `${keyword} 相关经历`, organization: experience.organization.trim(), role: experience.role.trim(), startDate: "", endDate: "", periodText: "", summary: "", order: snapshot.experiences.length, status: "confirmed" as const, createdAt: timestamp, updatedAt: timestamp })
        : snapshot.experiences;
      const claim = { id: claimId, experienceId: resolvedExperienceId, kind: fact.kind, text: fact.text.trim(), contribution: fact.contribution, complexity: fact.complexity, hasTradeoff: false, hasMethodReuse: false, status: "confirmed" as const, sourceReference: { kind: "manual" as const, referenceId: sourceId, runId: null, fingerprint: stableHash(fact.text.trim()) }, sourceQuote: fact.text.trim(), sourceRunId: null, sourceRound: null, createdAt: snapshot.claims.find((value) => value.id === claimId)?.createdAt ?? timestamp, updatedAt: timestamp };
      const capabilityExisting = snapshot.capabilities.find((value) => [value.name, ...value.aliases].some((name) => normalizeKeyword(name) === normalizeKeyword(keyword)));
      const capabilityId = capabilityExisting?.id ?? `capability-${stableHash(normalizeKeyword(keyword))}`;
      const capability = capabilityExisting ?? { id: capabilityId, name: keyword, category: capabilityCategory, aliases: [], selfLevel: 0 as const, createdAt: timestamp, updatedAt: timestamp };
      const linkId = `capability-link-${stableHash(`${capabilityId}:${claimId}`)}`;
      const metrics = metric.value.trim() ? upsert(snapshot.metrics, { id: `metric-${stableHash(sourceId)}`, claimId, ...metric, value: metric.value.trim(), status: metric.method.trim() && metric.sourceNote.trim() ? "confirmed" as const : "needs-review" as const, createdAt: timestamp, updatedAt: timestamp }) : snapshot.metrics;
      await persist({ ...snapshot, experiences, claims: upsert(snapshot.claims, claim), metrics, capabilities: upsert(snapshot.capabilities, capability), capabilityLinks: upsert(snapshot.capabilityLinks, { id: linkId, capabilityId, claimId, status: "confirmed", source: "manual", createdAt: timestamp, updatedAt: timestamp }) });
      await onSaved(claimId, sourceId, claim.text);
      onOpenChange(false);
    } catch (next) { setError(next instanceof Error ? next.message : "证据保存失败"); }
    finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}><DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
    <DialogHeader><DialogTitle>补正证据后采用</DialogTitle><DialogDescription>这里只保存你亲自填写并确认的事实。AI 增强稿本身不会进入经历证据库。</DialogDescription></DialogHeader>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="本次补正的关键词"><Select value={keyword} onValueChange={setKeyword}><SelectTrigger aria-label="本次补正的关键词"><SelectValue /></SelectTrigger><SelectContent>{draft?.selectedKeywords.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="所属经历"><Select value={experienceId} onValueChange={setExperienceId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">新建经历</SelectItem>{snapshot.experiences.map((value) => <SelectItem key={value.id} value={value.id}>{value.title}</SelectItem>)}</SelectContent></Select></Field>
      {experienceId === "new" && <><Field label="经历类型"><Select value={experience.type} onValueChange={(value) => setExperience({ ...experience, type: value as CareerExperienceType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="work">工作</SelectItem><SelectItem value="project">项目</SelectItem><SelectItem value="internship">实习</SelectItem></SelectContent></Select></Field><Field label="经历名称"><Input value={experience.title} onChange={(event) => setExperience({ ...experience, title: event.target.value })} placeholder="例如：智能知识库项目" /></Field><Field label="组织 / 公司"><Input value={experience.organization} onChange={(event) => setExperience({ ...experience, organization: event.target.value })} /></Field><Field label="角色"><Input value={experience.role} onChange={(event) => setExperience({ ...experience, role: event.target.value })} /></Field></>}
      <div className="sm:col-span-2"><Field label={`真实事实（用于核验关键词“${keyword}”）`}><Textarea value={fact.text} onChange={(event) => setFact({ ...fact, text: event.target.value })} placeholder="只填写你真实做过、可以解释或验证的内容" className="min-h-28" /></Field></div>
      <Field label="事实类型"><Select value={fact.kind} onValueChange={(value) => setFact({ ...fact, kind: value as EvidenceClaimKind })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="responsibility">职责</SelectItem><SelectItem value="action">行动</SelectItem><SelectItem value="decision">决策</SelectItem><SelectItem value="result">结果</SelectItem><SelectItem value="skill-practice">技能实践</SelectItem></SelectContent></Select></Field>
      <Field label="贡献方式"><Select value={fact.contribution} onValueChange={(value) => setFact({ ...fact, contribution: value as typeof fact.contribution })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="assisted">协助</SelectItem><SelectItem value="independent">独立完成</SelectItem><SelectItem value="led">主导</SelectItem></SelectContent></Select></Field>
      <Field label="复杂度"><Select value={fact.complexity} onValueChange={(value) => setFact({ ...fact, complexity: value as typeof fact.complexity })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="routine">常规</SelectItem><SelectItem value="complex">复杂</SelectItem></SelectContent></Select></Field>
      <Field label="能力分类"><Select value={capabilityCategory} onValueChange={(value) => setCapabilityCategory(value as CapabilityCategory)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="product">产品</SelectItem><SelectItem value="technology">技术</SelectItem><SelectItem value="data">数据</SelectItem><SelectItem value="industry">行业</SelectItem><SelectItem value="collaboration">协作</SelectItem><SelectItem value="custom">自定义</SelectItem></SelectContent></Select></Field>
      <div className="sm:col-span-2 rounded-md border bg-neutral-50 p-3"><p className="text-sm font-medium">可选量化证据</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><Input aria-label="指标值" placeholder="数值" value={metric.value} onChange={(e) => setMetric({ ...metric, value: e.target.value })} /><Input aria-label="指标单位" placeholder="单位" value={metric.unit} onChange={(e) => setMetric({ ...metric, unit: e.target.value })} /><Input aria-label="指标基线" placeholder="基线" value={metric.baseline} onChange={(e) => setMetric({ ...metric, baseline: e.target.value })} /><Input aria-label="统计方法" placeholder="统计口径 / 方法" value={metric.method} onChange={(e) => setMetric({ ...metric, method: e.target.value })} /><Input aria-label="统计周期" placeholder="周期" value={metric.period} onChange={(e) => setMetric({ ...metric, period: e.target.value })} /><Input aria-label="指标来源" placeholder="来源说明" value={metric.sourceNote} onChange={(e) => setMetric({ ...metric, sourceNote: e.target.value })} /></div></div>
      <label className="sm:col-span-2 flex items-start gap-2 rounded-md border p-3 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>我确认以上补正内容真实、可核验，并同意写入个人经历事实库。</span></label>
      {error && <p className="sm:col-span-2 text-sm text-red-700" role="alert">{error}</p>}
      <div className="sm:col-span-2 flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>取消</Button><Button disabled={saving || !confirmed || !fact.text.trim() || experienceId === "new" && !experience.title.trim()} onClick={() => void save()}>{saving ? "正在保存并重新增强…" : "保存真实证据并重新增强"}</Button></div>
    </div>
  </DialogContent></Dialog>;
}

function Compare({ label, text, emphasis = false }: { label: string; text: string; emphasis?: boolean }) { return <div><p className="mb-1 font-medium">{label}</p><div className={emphasis ? "rounded-md border border-blue-200 bg-blue-50 p-3 leading-6" : "rounded-md border bg-neutral-50 p-3 leading-6"}>{text}</div></div>; }
function InfoList({ title, values, empty, warning = false }: { title: string; values: string[]; empty: string; warning?: boolean }) { return <div className={warning ? "rounded-md border border-amber-200 bg-amber-50 p-3" : "rounded-md border p-3"}><p className="font-medium">{title}</p>{values.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{values.map((value) => <li key={value}>{value}</li>)}</ul> : <p className="mt-2 text-neutral-500">{empty}</p>}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function stableHash(value: string) { let hash = 2166136261; for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); return (hash >>> 0).toString(16); }
function upsert<T extends { id: string }>(items: T[], item: T): T[] { return [...items.filter((value) => value.id !== item.id), item]; }
