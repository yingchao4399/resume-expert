import { cn } from "@/lib/utils";
import type { ResumeRenderBlock, ResumeRenderModel } from "@/lib/export/resume-render-model";
import type { ResumeLayoutConfig } from "@/types/resume";

export function ResumeRenderHeader({ model }: { model: ResumeRenderModel }) {
  return <>
    <header className={model.layout.templateId === "modern-clean" ? "resume-header text-left" : "resume-header text-center"}>
      <h2 className="text-[22pt] font-semibold" style={{ color: model.layout.templateId === "modern-clean" ? model.layout.accentColor : undefined }}>{model.name}</h2>
      {model.contactLine && <p className="mt-1 text-[0.9em] text-neutral-600">{model.contactLine}</p>}
    </header>
    <div className={cn("resume-header-rule h-px", model.layout.templateId === "modern-clean" ? "mt-3" : "mt-4")} style={{ backgroundColor: model.layout.accentColor }} />
  </>;
}

export function ResumeRenderBlocks({ blocks, layout, withTopSpacing = true }: {
  blocks: ResumeRenderBlock[];
  layout: ResumeLayoutConfig;
  withTopSpacing?: boolean;
}) {
  const groups = blocks.reduce<Array<{ sectionId: ResumeRenderBlock["sectionId"]; blocks: ResumeRenderBlock[] }>>((result, block) => {
    const current = result.at(-1);
    if (current?.sectionId === block.sectionId) current.blocks.push(block);
    else result.push({ sectionId: block.sectionId, blocks: [block] });
    return result;
  }, []);
  return <div className={cn("resume-sections", withTopSpacing && "mt-4")}>{groups.map((group, groupIndex) => <section className="resume-section" data-section={group.sectionId} key={`${group.sectionId}-${groupIndex}`}>
    {group.blocks.map((block) => <ResumeRenderBlockView key={block.id} block={block} layout={layout} />)}
  </section>)}</div>;
}

function ResumeRenderBlockView({ block, layout }: { block: ResumeRenderBlock; layout: ResumeLayoutConfig }) {
  if (block.kind === "section-heading") return <h3
    className={cn("mb-2 font-semibold", layout.templateId === "modern-clean" ? "mt-3 border-l-[3px] pl-2 text-[1.05em]" : "mt-3 border-b pb-1 text-[0.95em] tracking-wide")}
    style={{ borderColor: layout.accentColor, color: layout.accentColor }}
  >{block.text}</h3>;
  if (block.kind === "experience-heading") return <div className="mb-[0.25em] mt-[0.65em] flex items-baseline justify-between gap-3 font-medium">
    <p>{block.text}</p><span className="text-[0.88em] font-normal text-neutral-500">{block.secondaryText}</span>
  </div>;
  if (block.kind === "bullet") {
    const bullet = layout.bulletStyle === "dash" ? "-" : layout.bulletStyle === "square" ? "▪" : "•";
    return <p className="mb-[0.2em] flex gap-2 text-neutral-700"><span aria-hidden="true">{bullet}</span><span>{block.text}</span></p>;
  }
  return <p className="mb-[0.35em] text-neutral-700">{block.text}</p>;
}
