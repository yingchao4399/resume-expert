"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Palette, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, SectionTitle } from "@/components/shared/ui-helpers";
import { ResumeDocumentView } from "@/components/resume/resume-document-view";
import { ResumeEditor } from "@/components/resume/resume-editor";
import { ResumeTemplateStudio } from "@/components/resume/resume-template-studio";
import { ResumeSourceTrace } from "@/components/resume/resume-source-trace";
import { useResumeStore } from "@/store/resume-store";
import type { FinalResume, ResumeBulletValue } from "@/types/resume";
import { getBulletText, normalizeResumeBullet } from "@/lib/evidence/resume-evidence";

function cloneResume(resume: FinalResume): FinalResume {
  return JSON.parse(JSON.stringify(resume)) as FinalResume;
}

function cleanList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function cleanBullets(values: ResumeBulletValue[]) {
  return values
    .map((value) => ({ ...normalizeResumeBullet(value), text: getBulletText(value).trim() }))
    .filter((value) => Boolean(value.text));
}

function cleanResume(resume: FinalResume): FinalResume {
  return {
    personalInfo: {
      name: resume.personalInfo.name.trim(),
      email: resume.personalInfo.email.trim(),
      phone: resume.personalInfo.phone.trim(),
      location: resume.personalInfo.location.trim(),
    },
    jobIntent: resume.jobIntent.trim(),
    summary: resume.summary.trim(),
    coreSkills: cleanList(resume.coreSkills),
    workExperience: resume.workExperience
      .map((work) => ({
        company: work.company.trim(),
        role: work.role.trim(),
        period: work.period.trim(),
        bullets: cleanBullets(work.bullets),
      }))
      .filter(
        (work) =>
          work.company || work.role || work.period || work.bullets.length > 0
      ),
    projectExperience: resume.projectExperience
      .map((project) => ({
        name: project.name.trim(),
        role: project.role.trim(),
        period: project.period.trim(),
        bullets: cleanBullets(project.bullets),
      }))
      .filter(
        (project) =>
          project.name ||
          project.role ||
          project.period ||
          project.bullets.length > 0
      ),
    skillsAndTools: cleanList(resume.skillsAndTools),
    education: {
      school: resume.education.school.trim(),
      degree: resume.education.degree.trim(),
      period: resume.education.period.trim(),
    },
  };
}

export function FinalResumeStep() {
  const {
    activeDocumentId,
    analysisResult,
    isFinalResumeStale,
    hasManualEdits,
    layoutConfig,
    careerEvidence,
    setFinalResume,
    setLayoutConfig,
    setCurrentStep,
  } = useResumeStore();
  const finalResume = analysisResult?.finalResume ?? null;
  const [editing, setEditing] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [draft, setDraft] = useState<FinalResume | null>(
    finalResume ? cloneResume(finalResume) : null
  );

  useEffect(() => {
    setEditing(false);
    setDraft(finalResume ? cloneResume(finalResume) : null);
  }, [activeDocumentId, finalResume]);

  if (!analysisResult || !finalResume) {
    return <EmptyState message="请先完成输入材料并开始分析" />;
  }

  const beginEditing = () => {
    setDraft(cloneResume(finalResume));
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraft(cloneResume(finalResume));
    setEditing(false);
  };

  const saveEditing = () => {
    if (!draft) return;
    setFinalResume(cleanResume(draft), { manual: true });
    setEditing(false);
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle
          title="最终简历"
          description="预览或直接编辑最终内容，修改会保存在当前岗位版本中"
        />
        {!editing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
              <Palette className="h-3.5 w-3.5" />
              模板与排版
            </Button>
    <Button variant="outline" size="sm" onClick={beginEditing}>
      <Pencil className="h-3.5 w-3.5" />
      编辑简历
    </Button>
          </div>
        )}
      </div>

      {isFinalResumeStale && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>这份简历尚未应用最新的补充经历或优化风格。</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentStep("optimize")}
          >
            返回更新
          </Button>
        </div>
      )}

      {hasManualEdits && !editing && (
        <div className="mb-4">
          <Badge variant="secondary" className="font-normal">
            已人工编辑并保存
          </Badge>
        </div>
      )}

      {editing && draft ? (
        <>
          <Card className="mb-6">
            <CardContent className="p-6">
              <ResumeEditor value={draft} onChange={setDraft} />
            </CardContent>
          </Card>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cancelEditing}>
              <X className="h-4 w-4" />
              取消
            </Button>
            <Button onClick={saveEditing}>
              <Save className="h-4 w-4" />
              保存修改
            </Button>
          </div>
        </>
      ) : (
        <>
          <Card className="mb-6">
            <CardContent className="p-6">
              <ResumeDocumentView resume={finalResume} layoutConfig={layoutConfig} />
              <ResumeSourceTrace resume={finalResume} evidence={careerEvidence} />
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep("interview")}
            >
              下一步：面试准备
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
      <ResumeTemplateStudio
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        resume={finalResume}
        value={layoutConfig}
        onSave={setLayoutConfig}
      />
    </div>
  );
}
