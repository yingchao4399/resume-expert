import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBulletText, normalizeResumeBullet } from "@/lib/evidence/resume-evidence";
import type { CareerEvidence, FinalResume, ResumeBulletValue } from "@/types/resume";

export function ResumeSourceTrace({ resume, evidence }: { resume: FinalResume; evidence: CareerEvidence[] }) {
  const bullets = [
    ...resume.workExperience.flatMap((item) => item.bullets.map((bullet) => ({ section: `${item.company} · ${item.role}`, bullet }))),
    ...resume.projectExperience.flatMap((item) => item.bullets.map((bullet) => ({ section: `${item.name} · ${item.role}`, bullet }))),
  ];
  const evidenceMap = new Map(evidence.map((item) => [item.id, item]));

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">表述来源记录</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {bullets.map(({ section, bullet }, index) => (
          <TraceItem key={typeof bullet === "string" ? `${section}-${index}` : bullet.id} section={section} bullet={bullet} evidenceMap={evidenceMap} />
        ))}
      </CardContent>
    </Card>
  );
}

function TraceItem({ section, bullet, evidenceMap }: { section: string; bullet: ResumeBulletValue; evidenceMap: Map<string, CareerEvidence> }) {
  const item = normalizeResumeBullet(bullet);
  const linked = item.evidenceIds.map((id) => evidenceMap.get(id)).filter((value): value is CareerEvidence => Boolean(value));
  return (
    <div className="rounded-md border border-neutral-200 p-3 text-xs">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-medium text-neutral-700">{section}</span>
        <Badge variant={item.sourceType === "manual" ? "secondary" : item.sourceType === "ai-generated" ? "outline" : "success"}>
          {item.sourceType === "manual" ? "人工修改" : item.sourceType === "ai-generated" ? "AI 改写" : "原始导入"}
        </Badge>
        <span className="font-mono text-[10px] text-neutral-400">{item.id}</span>
      </div>
      <p className="text-sm text-neutral-800">{getBulletText(item)}</p>
      {(item.originalText || item.aiText || item.manualText) && (
        <div className="mt-2 grid gap-1 text-neutral-500">
          {item.originalText && <p><span className="font-medium">原始：</span>{item.originalText}</p>}
          {item.aiText && <p><span className="font-medium">AI：</span>{item.aiText}</p>}
          {item.manualText && <p><span className="font-medium">人工：</span>{item.manualText}</p>}
        </div>
      )}
      <p className="mt-2 text-neutral-500">
        关联证据：{linked.length ? linked.map((entry) => entry.title).join("、") : "暂无；建议回到证据库核对或补充"}
      </p>
    </div>
  );
}
