import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { FinalResume } from "@/types/resume";
import { cn } from "@/lib/utils";

interface ResumeDocumentViewProps {
  resume: FinalResume;
  className?: string;
}

export function ResumeDocumentView({
  resume,
  className,
}: ResumeDocumentViewProps) {
  const { personalInfo } = resume;

  return (
    <article
      className={cn(
        "resume-document bg-white text-neutral-900",
        className
      )}
    >
      <header className="mb-4">
        <h2 className="text-2xl font-semibold">{personalInfo.name || "姓名"}</h2>
        <p className="mt-1 text-sm text-neutral-600">
          {[personalInfo.email, personalInfo.phone, personalInfo.location]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <Separator className="my-4" />

      <ResumeSection title="求职意向">
        <p className="text-sm">{resume.jobIntent}</p>
      </ResumeSection>

      <ResumeSection title="职业摘要">
        <p className="text-sm leading-relaxed text-neutral-700">
          {resume.summary}
        </p>
      </ResumeSection>

      <ResumeSection title="核心能力">
        <div className="flex flex-wrap gap-1.5">
          {resume.coreSkills.map((skill, index) => (
            <Badge
              key={`${skill}-${index}`}
              variant="secondary"
              className="font-normal"
            >
              {skill}
            </Badge>
          ))}
        </div>
      </ResumeSection>

      <ResumeSection title="工作经历">
        <div className="space-y-4">
          {resume.workExperience.map((work, index) => (
            <ExperienceBlock
              key={`${work.company}-${work.period}-${index}`}
              title={[work.company, work.role].filter(Boolean).join(" · ")}
              period={work.period}
              bullets={work.bullets}
            />
          ))}
        </div>
      </ResumeSection>

      <ResumeSection title="项目经历">
        <div className="space-y-4">
          {resume.projectExperience.map((project, index) => (
            <ExperienceBlock
              key={`${project.name}-${project.period}-${index}`}
              title={[project.name, project.role].filter(Boolean).join(" · ")}
              period={project.period}
              bullets={project.bullets}
            />
          ))}
        </div>
      </ResumeSection>

      <ResumeSection title="技能工具">
        <p className="text-sm text-neutral-700">
          {resume.skillsAndTools.join(" · ")}
        </p>
      </ResumeSection>

      <ResumeSection title="教育背景" className="mb-0">
        <p className="text-sm">
          {[
            resume.education.school,
            resume.education.degree,
            resume.education.period,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </ResumeSection>
    </article>
  );
}

function ResumeSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-5 break-inside-avoid", className)}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ExperienceBlock({
  title,
  period,
  bullets,
}: {
  title: string;
  period: string;
  bullets: string[];
}) {
  return (
    <div className="break-inside-avoid">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <span className="text-xs text-neutral-500">{period}</span>
      </div>
      <ul className="mt-2 space-y-1">
        {bullets.map((bullet, index) => (
          <li
            key={`${bullet}-${index}`}
            className="flex gap-2 text-sm leading-relaxed text-neutral-700"
          >
            <span aria-hidden="true">•</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
