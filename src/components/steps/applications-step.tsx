"use client";

import { useMemo, useState } from "react";
import { ExternalLink, FileText, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionTitle } from "@/components/shared/ui-helpers";
import { calculateApplicationStats, JOB_APPLICATION_STATUSES } from "@/lib/application-stats";
import { useResumeStore } from "@/store/resume-store";
import type { JobApplicationStatus } from "@/types/resume";

const EMPTY = { company: "", role: "", jdUrl: "", jdText: "", status: "准备中" as JobApplicationStatus, appliedAt: "", nextStepAt: "", notes: "", resumeDocumentId: "" };

export function ApplicationsStep() {
  const { documents, activeDocumentId, jobApplications, interviewReviews, addJobApplication, updateJobApplication, deleteJobApplication, selectDocument, setCurrentStep } = useResumeStore();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY, resumeDocumentId: activeDocumentId });
  const stats = useMemo(() => calculateApplicationStats(jobApplications), [jobApplications]);
  const documentMap = new Map(documents.map((item) => [item.id, item]));

  const add = () => {
    if (!draft.company.trim() || !draft.role.trim()) return;
    addJobApplication({ ...draft, company: draft.company.trim(), role: draft.role.trim(), resumeDocumentId: draft.resumeDocumentId || null });
    setDraft({ ...EMPTY, resumeDocumentId: activeDocumentId });
    setAdding(false);
  };

  return <div>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <SectionTitle title="投递与进展" description="本地记录岗位状态、下一步日期和实际使用的简历版本" />
      <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" />新增投递</Button>
    </div>

    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="全部记录" value={stats.total} suffix="份" />
      <Stat label="面试中" value={stats.counts["面试"]} suffix="份" />
      <Stat label="面试率" value={stats.interviewRate} suffix="%" />
      <Stat label="Offer 率" value={stats.offerRate} suffix="%" />
    </div>
    <p className="mb-4 text-xs text-neutral-500">统计仅描述本地记录的状态比例，不代表简历、面试或任何单一因素与结果存在因果关系。</p>

    {adding && <Card className="mb-4 border-blue-200"><CardHeader className="pb-3"><CardTitle className="text-sm">新增投递记录</CardTitle></CardHeader><CardContent>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="公司"><Input aria-label="公司" value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} /></Field>
        <Field label="岗位"><Input aria-label="岗位" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} /></Field>
        <Field label="JD 链接"><Input value={draft.jdUrl} onChange={(event) => setDraft({ ...draft, jdUrl: event.target.value })} /></Field>
        <Field label="关联简历"><ResumeSelect value={draft.resumeDocumentId} documents={documents} onChange={(resumeDocumentId) => setDraft({ ...draft, resumeDocumentId })} /></Field>
        <Field label="投递时间"><Input type="date" value={draft.appliedAt} onChange={(event) => setDraft({ ...draft, appliedAt: event.target.value })} /></Field>
        <Field label="下一步日期"><Input type="date" value={draft.nextStepAt} onChange={(event) => setDraft({ ...draft, nextStepAt: event.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="JD 文本"><Textarea value={draft.jdText} onChange={(event) => setDraft({ ...draft, jdText: event.target.value })} /></Field></div>
        <div className="sm:col-span-2"><Field label="备注"><Textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field></div>
      </div>
      <div className="mt-3 flex justify-end gap-2"><Button variant="outline" onClick={() => setAdding(false)}><X className="h-3.5 w-3.5" />取消</Button><Button disabled={!draft.company.trim() || !draft.role.trim()} onClick={add}>保存投递</Button></div>
    </CardContent></Card>}

    {jobApplications.length === 0 ? <Card><CardContent className="py-12 text-center text-sm text-neutral-500">还没有投递记录。完成岗位简历后，可以在这里建立本地跟进闭环。</CardContent></Card> : <div className="space-y-3">
      {[...jobApplications].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((item) => {
        const linked = item.resumeDocumentId ? documentMap.get(item.resumeDocumentId) : null;
        const reviewCount = interviewReviews.filter((review) => review.applicationId === item.id).length;
        return <Card key={item.id}><CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{item.company} · {item.role}</h3><Badge variant="secondary">{item.status}</Badge>{reviewCount > 0 && <Badge variant="outline">复盘 {reviewCount}</Badge>}</div>
              <p className="mt-1 text-xs text-neutral-500">投递：{item.appliedAt || "未填写"} · 下一步：{item.nextStepAt || "未填写"}</p>
            </div>
            <div className="flex gap-1">{item.jdUrl && <Button variant="ghost" size="sm" asChild><a href={item.jdUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />JD</a></Button>}
              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => { if (window.confirm("删除投递记录后，关联的面试复盘会保留但解除关联。是否继续？")) deleteJobApplication(item.id); }}><Trash2 className="h-3.5 w-3.5" /></Button></div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="状态"><select className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm" value={item.status} onChange={(event) => updateJobApplication(item.id, { status: event.target.value as JobApplicationStatus })}>{JOB_APPLICATION_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></Field>
            <Field label="下一步日期"><Input type="date" value={item.nextStepAt} onChange={(event) => updateJobApplication(item.id, { nextStepAt: event.target.value })} /></Field>
            <Field label="关联简历"><ResumeSelect value={item.resumeDocumentId ?? ""} documents={documents} onChange={(resumeDocumentId) => updateJobApplication(item.id, { resumeDocumentId: resumeDocumentId || null })} /></Field>
          </div>
          <Textarea className="mt-3 min-h-16" placeholder="跟进备注" value={item.notes} onChange={(event) => updateJobApplication(item.id, { notes: event.target.value })} />
          <div className="mt-2 flex justify-end">{linked ? <Button variant="outline" size="sm" onClick={() => { selectDocument(linked.id); setCurrentStep("final-resume"); }}><FileText className="h-3.5 w-3.5" />打开 {linked.title}</Button> : <span className="text-xs text-amber-700">未关联简历版本</span>}</div>
        </CardContent></Card>;
      })}
    </div>}
  </div>;
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix: string }) { return <Card><CardContent className="p-4"><p className="text-xs text-neutral-500">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}<span className="ml-1 text-xs font-normal text-neutral-400">{suffix}</span></p></CardContent></Card>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function ResumeSelect({ value, documents, onChange }: { value: string; documents: Array<{ id: string; title: string }>; onChange: (value: string) => void }) { return <select className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">不关联</option>{documents.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>; }
