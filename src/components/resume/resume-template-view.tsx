import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  getDefaultLayoutConfig,
  getFontStack,
  RESUME_SECTION_LABELS,
  sanitizeLayoutConfig,
} from "@/lib/templates/resume-templates";
import type { FinalResume, ResumeLayoutConfig, ResumeSectionId } from "@/types/resume";

interface ResumeTemplateViewProps {
  resume: FinalResume;
  layoutConfig?: ResumeLayoutConfig;
  className?: string;
}

export function ResumeTemplateView({ resume, layoutConfig, className }: ResumeTemplateViewProps) {
  const layout = sanitizeLayoutConfig(layoutConfig ?? getDefaultLayoutConfig());
  const modern = layout.templateId === "modern-clean";
  const compact = layout.templateId === "compact-professional";
  const style = {
    fontFamily: getFontStack(layout.fontFamily),
    fontSize: `${layout.baseFontSize}pt`,
    lineHeight: layout.lineHeight,
    "--resume-accent": layout.accentColor,
    "--resume-section-gap": `${layout.sectionSpacing}px`,
  } as CSSProperties;

  return (
    <article
      className={cn(
        "resume-document bg-white text-neutral-900",
        `resume-template-${layout.templateId}`,
        compact && "tracking-[-0.005em]",
        className
      )}
      style={style}
      data-template={layout.templateId}
    >
      <header className={cn("resume-header", modern ? "text-left" : "text-center")}>
        <h2
          className={cn("font-semibold", compact ? "text-[20pt]" : "text-[22pt]")}
          style={{ color: modern ? layout.accentColor : undefined }}
        >
          {resume.personalInfo.name || "姓名"}
        </h2>
        <p className="mt-1 text-[0.9em] text-neutral-600">
          {[resume.personalInfo.email, resume.personalInfo.phone, resume.personalInfo.location]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <div
        className={cn("resume-header-rule", modern ? "mt-3 h-[2px]" : "mt-4 h-px")}
        style={{ backgroundColor: layout.accentColor }}
      />

      <div className="resume-sections mt-4">
        {layout.sectionOrder.map((sectionId) =>
          layout.hiddenSections.includes(sectionId) ? null : (
            <ResumeSection key={sectionId} id={sectionId} layout={layout}>
              <SectionContent id={sectionId} resume={resume} layout={layout} />
            </ResumeSection>
          )
        )}
      </div>
    </article>
  );
}

function ResumeSection({
  id,
  layout,
  children,
}: {
  id: ResumeSectionId;
  layout: ResumeLayoutConfig;
  children: ReactNode;
}) {
  const modern = layout.templateId === "modern-clean";
  return (
    <section className="resume-section break-inside-avoid" data-section={id}>
      <h3
        className={cn(
          "mb-2 font-semibold",
          modern ? "border-l-[3px] pl-2 text-[1.05em]" : "border-b pb-1 text-[0.95em] tracking-wide"
        )}
        style={{ borderColor: layout.accentColor, color: layout.accentColor }}
      >
        {RESUME_SECTION_LABELS[id]}
      </h3>
      {children}
    </section>
  );
}

function SectionContent({ id, resume, layout }: { id: ResumeSectionId; resume: FinalResume; layout: ResumeLayoutConfig }) {
  switch (id) {
    case "jobIntent":
      return <p>{resume.jobIntent}</p>;
    case "summary":
      return <p className="text-neutral-700">{resume.summary}</p>;
    case "coreSkills":
      return <p className="text-neutral-700">{resume.coreSkills.join(" · ")}</p>;
    case "workExperience":
      return (
        <ExperienceList
          items={resume.workExperience.map((item) => ({
            title: [item.company, item.role].filter(Boolean).join(" · "),
            period: item.period,
            bullets: item.bullets,
          }))}
          layout={layout}
        />
      );
    case "projectExperience":
      return (
        <ExperienceList
          items={resume.projectExperience.map((item) => ({
            title: [item.name, item.role].filter(Boolean).join(" · "),
            period: item.period,
            bullets: item.bullets,
          }))}
          layout={layout}
        />
      );
    case "skillsAndTools":
      return <p className="text-neutral-700">{resume.skillsAndTools.join(" · ")}</p>;
    case "education":
      return (
        <p>
          {[resume.education.school, resume.education.degree, resume.education.period]
            .filter(Boolean)
            .join(" · ")}
        </p>
      );
  }
}

function ExperienceList({
  items,
  layout,
}: {
  items: Array<{ title: string; period: string; bullets: string[] }>;
  layout: ResumeLayoutConfig;
}) {
  const bullet = layout.bulletStyle === "dash" ? "–" : layout.bulletStyle === "square" ? "▪" : "•";
  return (
    <div className="space-y-[0.9em]">
      {items.map((item, itemIndex) => (
        <div key={`${item.title}-${item.period}-${itemIndex}`} className="break-inside-avoid">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 font-medium">
            <p>{item.title}</p>
            <span className="text-[0.88em] font-normal text-neutral-500">{item.period}</span>
          </div>
          <ul className="mt-[0.35em] space-y-[0.2em]">
            {item.bullets.map((line, index) => (
              <li key={`${line}-${index}`} className="flex gap-2 text-neutral-700">
                <span aria-hidden="true">{bullet}</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
