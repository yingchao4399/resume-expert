"use client";

import { cloneElement, useId, useMemo, useState, type ReactElement } from "react";
import { Check, Pencil, Plus, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionTitle } from "@/components/shared/ui-helpers";
import { useResumeStore } from "@/store/resume-store";
import type { CareerEvidence } from "@/types/resume";

const EMPTY_DRAFT = {
  title: "",
  organization: "",
  role: "",
  period: "",
  description: "",
  metrics: "",
  skills: "",
};

export function EvidenceLibraryStep() {
  const {
    careerEvidence,
    addCareerEvidence,
    confirmCareerEvidence,
    updateCareerEvidence,
    deleteCareerEvidence,
  } = useResumeStore();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const counts = useMemo(
    () => ({
      confirmed: careerEvidence.filter((item) => item.status === "confirmed").length,
      candidate: careerEvidence.filter((item) => item.status === "candidate").length,
    }),
    [careerEvidence]
  );

  const beginEdit = (item: CareerEvidence) => {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      organization: item.organization,
      role: item.role,
      period: item.period,
      description: item.description,
      metrics: item.metrics.join("、"),
      skills: item.skills.join("、"),
    });
  };

  const saveEdit = (id: string) => {
    updateCareerEvidence(id, {
      title: draft.title.trim() || "未命名经历",
      organization: draft.organization.trim(),
      role: draft.role.trim(),
      period: draft.period.trim(),
      description: draft.description.trim(),
      metrics: splitList(draft.metrics),
      skills: splitList(draft.skills),
    });
    setEditingId(null);
  };

  const addManual = () => {
    if (!draft.description.trim()) return;
    addCareerEvidence({
      type: "achievement",
      title: draft.title.trim() || "手工补充经历",
      organization: draft.organization.trim(),
      role: draft.role.trim(),
      period: draft.period.trim(),
      description: draft.description.trim(),
      metrics: splitList(draft.metrics),
      skills: splitList(draft.skills),
      status: "confirmed",
      sourceType: "manual",
      sourceDocumentId: null,
    });
    setDraft(EMPTY_DRAFT);
    setAdding(false);
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle
          title="个人经历证据库"
          description="先确认事实，再让 AI 改写；岗位版本只引用证据，不会反向覆盖这里的原始事实"
        />
        <Button size="sm" onClick={() => { setDraft(EMPTY_DRAFT); setAdding(true); }}>
          <Plus className="h-3.5 w-3.5" />手工添加
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Badge variant="success">已确认 {counts.confirmed}</Badge>
        <Badge variant="secondary">待确认 {counts.candidate}</Badge>
        <span className="self-center text-neutral-500">待确认内容不会作为已核验成果提供给 AI。</span>
      </div>

      {adding && (
        <Card className="mb-4 border-emerald-200">
          <CardHeader className="pb-3"><CardTitle className="text-sm">添加已核验事实</CardTitle></CardHeader>
          <CardContent><EvidenceForm draft={draft} setDraft={setDraft} />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAdding(false)}><X className="h-3.5 w-3.5" />取消</Button>
              <Button size="sm" disabled={!draft.description.trim()} onClick={addManual}><Save className="h-3.5 w-3.5" />确认并保存</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {careerEvidence.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-neutral-500">
          导入并完成 AI 结构化后，这里会出现待确认候选；也可以手工添加真实经历。
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {[...careerEvidence]
            .sort((a, b) => (a.status === b.status ? b.updatedAt.localeCompare(a.updatedAt) : a.status === "candidate" ? -1 : 1))
            .map((item) => (
              <Card key={item.id} className={item.status === "candidate" ? "border-amber-200" : "border-neutral-200"}>
                <CardContent className="p-4">
                  {editingId === item.id ? (
                    <>
                      <EvidenceForm draft={draft} setDraft={setDraft} />
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" />取消</Button>
                        <Button size="sm" onClick={() => saveEdit(item.id)}><Save className="h-3.5 w-3.5" />保存</Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="font-medium">{item.title}</h3>
                          <Badge variant={item.status === "confirmed" ? "success" : "secondary"}>
                            {item.status === "confirmed" ? "已确认" : "待确认"}
                          </Badge>
                          <Badge variant="outline">{sourceLabel(item.sourceType)}</Badge>
                        </div>
                        <p className="text-xs text-neutral-500">{[item.organization, item.role, item.period].filter(Boolean).join(" · ")}</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{item.description}</p>
                        {(item.metrics.length > 0 || item.skills.length > 0) && (
                          <p className="mt-2 text-xs text-neutral-500">
                            {item.metrics.length ? `量化：${item.metrics.join("、")}` : ""}
                            {item.metrics.length && item.skills.length ? " · " : ""}
                            {item.skills.length ? `技能：${item.skills.join("、")}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        {item.status === "candidate" && (
                          <Button size="sm" onClick={() => confirmCareerEvidence(item.id)}><Check className="h-3.5 w-3.5" />核对无误</Button>
                        )}
                        {item.status === "confirmed" && <ShieldCheck className="mt-2 h-4 w-4 text-emerald-600" aria-label="已核验" />}
                        <Button aria-label={`编辑证据 ${item.title}`} variant="ghost" size="sm" onClick={() => beginEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button aria-label={`删除证据 ${item.title}`} variant="ghost" size="sm" className="text-red-600" onClick={() => { if (window.confirm("确定删除这条证据？已生成的岗位简历不会被自动改写。")) deleteCareerEvidence(item.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}

function EvidenceForm({ draft, setDraft }: { draft: typeof EMPTY_DRAFT; setDraft: (value: typeof EMPTY_DRAFT) => void }) {
  const set = (key: keyof typeof EMPTY_DRAFT, value: string) => setDraft({ ...draft, [key]: value });
  return <div className="grid gap-3 sm:grid-cols-2">
    <Field label="标题"><Input value={draft.title} onChange={(event) => set("title", event.target.value)} placeholder="如：库存盘点流程重构" /></Field>
    <Field label="公司 / 项目"><Input value={draft.organization} onChange={(event) => set("organization", event.target.value)} /></Field>
    <Field label="角色"><Input value={draft.role} onChange={(event) => set("role", event.target.value)} /></Field>
    <Field label="时间"><Input value={draft.period} onChange={(event) => set("period", event.target.value)} /></Field>
    <div className="sm:col-span-2"><Field label="可核验事实"><Textarea className="min-h-24" value={draft.description} onChange={(event) => set("description", event.target.value)} placeholder="写清做了什么、范围和结果；不确定的数据先不要写" /></Field></div>
    <Field label="量化数据（顿号分隔）"><Input value={draft.metrics} onChange={(event) => set("metrics", event.target.value)} /></Field>
    <Field label="技能（顿号分隔）"><Input value={draft.skills} onChange={(event) => set("skills", event.target.value)} /></Field>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const generatedId = useId();
  const id = children.props.id ?? `evidence-field-${generatedId.replace(/:/g, "")}`;
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{cloneElement(children, { id })}</div>;
}

function splitList(value: string): string[] {
  return [...new Set(value.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean))];
}

function sourceLabel(source: CareerEvidence["sourceType"]): string {
  if (source === "resume-import") return "简历导入";
  if (source === "follow-up") return "经历补证";
  return "人工录入";
}
