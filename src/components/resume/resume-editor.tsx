"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  FinalResume,
  ProjectExperience,
  ResumeBulletValue,
  WorkExperience,
} from "@/types/resume";
import { createResumeBullet, getBulletText, updateResumeBulletText } from "@/lib/evidence/resume-evidence";

interface ResumeEditorProps {
  value: FinalResume;
  onChange: (resume: FinalResume) => void;
}

const emptyWork = (): WorkExperience => ({
  company: "",
  role: "",
  period: "",
  bullets: [""],
});

const emptyProject = (): ProjectExperience => ({
  name: "",
  role: "",
  period: "",
  bullets: [""],
});

export function ResumeEditor({ value, onChange }: ResumeEditorProps) {
  const update = (patch: Partial<FinalResume>) =>
    onChange({ ...value, ...patch });

  return (
    <div className="space-y-5">
      <EditorSection title="个人信息">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["name", "姓名"],
              ["email", "邮箱"],
              ["phone", "电话"],
              ["location", "所在地"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <Input
                value={value.personalInfo[key]}
                onChange={(event) =>
                  update({
                    personalInfo: {
                      ...value.personalInfo,
                      [key]: event.target.value,
                    },
                  })
                }
              />
            </Field>
          ))}
        </div>
      </EditorSection>

      <EditorSection title="求职意向与职业摘要">
        <div className="space-y-3">
          <Field label="求职意向">
            <Input
              value={value.jobIntent}
              onChange={(event) => update({ jobIntent: event.target.value })}
            />
          </Field>
          <Field label="职业摘要">
            <Textarea
              className="min-h-28"
              value={value.summary}
              onChange={(event) => update({ summary: event.target.value })}
            />
          </Field>
        </div>
      </EditorSection>

      <EditorSection title="技能">
        <div className="space-y-3">
          <ListTextField
            label="核心能力（每行一项）"
            values={value.coreSkills}
            onChange={(coreSkills) => update({ coreSkills })}
          />
          <ListTextField
            label="技能工具（每行一项）"
            values={value.skillsAndTools}
            onChange={(skillsAndTools) => update({ skillsAndTools })}
          />
        </div>
      </EditorSection>

      <ExperienceEditor
        title="工作经历"
        items={value.workExperience}
        labels={["公司", "职位"]}
        getPrimary={(item) => item.company}
        getSecondary={(item) => item.role}
        onChange={(workExperience) => update({ workExperience })}
        createItem={emptyWork}
        setPrimary={(item, company) => ({ ...item, company })}
        setSecondary={(item, role) => ({ ...item, role })}
      />

      <ExperienceEditor
        title="项目经历"
        items={value.projectExperience}
        labels={["项目名称", "角色"]}
        getPrimary={(item) => item.name}
        getSecondary={(item) => item.role}
        onChange={(projectExperience) => update({ projectExperience })}
        createItem={emptyProject}
        setPrimary={(item, name) => ({ ...item, name })}
        setSecondary={(item, role) => ({ ...item, role })}
      />

      <EditorSection title="教育背景">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="学校">
            <Input
              value={value.education.school}
              onChange={(event) =>
                update({
                  education: {
                    ...value.education,
                    school: event.target.value,
                  },
                })
              }
            />
          </Field>
          <Field label="学历 / 专业">
            <Input
              value={value.education.degree}
              onChange={(event) =>
                update({
                  education: {
                    ...value.education,
                    degree: event.target.value,
                  },
                })
              }
            />
          </Field>
          <Field label="时间">
            <Input
              value={value.education.period}
              onChange={(event) =>
                update({
                  education: {
                    ...value.education,
                    period: event.target.value,
                  },
                })
              }
            />
          </Field>
        </div>
      </EditorSection>
    </div>
  );
}

function ExperienceEditor<T extends { period: string; bullets: ResumeBulletValue[] }>({
  title,
  items,
  labels,
  getPrimary,
  getSecondary,
  setPrimary,
  setSecondary,
  createItem,
  onChange,
}: {
  title: string;
  items: T[];
  labels: [string, string];
  getPrimary: (item: T) => string;
  getSecondary: (item: T) => string;
  setPrimary: (item: T, value: string) => T;
  setSecondary: (item: T, value: string) => T;
  createItem: () => T;
  onChange: (items: T[]) => void;
}) {
  const updateItem = (index: number, item: T) =>
    onChange(items.map((current, itemIndex) => (itemIndex === index ? item : current)));

  return (
    <EditorSection title={title}>
      <div className="space-y-4">
        {items.map((item, index) => (
          <Card key={index} className="border-neutral-200">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm">
                {title.replace("经历", "")} {index + 1}
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-red-600"
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={labels[0]}>
                  <Input
                    value={getPrimary(item)}
                    onChange={(event) =>
                      updateItem(index, setPrimary(item, event.target.value))
                    }
                  />
                </Field>
                <Field label={labels[1]}>
                  <Input
                    value={getSecondary(item)}
                    onChange={(event) =>
                      updateItem(index, setSecondary(item, event.target.value))
                    }
                  />
                </Field>
                <Field label="时间">
                  <Input
                    value={item.period}
                    onChange={(event) =>
                      updateItem(index, { ...item, period: event.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="space-y-2">
                <Label>成果描述</Label>
                {item.bullets.map((bullet, bulletIndex) => (
                  <div key={bulletIndex} className="flex items-start gap-2">
                    <Textarea
                      className="min-h-20"
                      value={getBulletText(bullet)}
                      onChange={(event) =>
                        updateItem(index, {
                          ...item,
                          bullets: item.bullets.map((current, currentIndex) =>
                            currentIndex === bulletIndex
                              ? updateResumeBulletText(current, event.target.value)
                              : current
                          ),
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-8 w-8 shrink-0 p-0 text-red-600"
                      aria-label="删除该成果描述"
                      onClick={() =>
                        updateItem(index, {
                          ...item,
                          bullets: item.bullets.filter(
                            (_, currentIndex) => currentIndex !== bulletIndex
                          ),
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateItem(index, {
                      ...item,
                      bullets: [...item.bullets, createResumeBullet("", "manual")],
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加成果描述
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...items, createItem()])}
        >
          <Plus className="h-4 w-4" />
          添加{title}
        </Button>
      </div>
    </EditorSection>
  );
}

function ListTextField({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <Field label={label}>
      <Textarea
        className="min-h-24"
        value={values.join("\n")}
        onChange={(event) => onChange(event.target.value.split("\n"))}
      />
    </Field>
  );
}

function EditorSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
