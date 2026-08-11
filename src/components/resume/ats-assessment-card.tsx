import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ATSAssessment } from "@/types/resume";

export function ATSAssessmentCard({
  assessment,
}: {
  assessment: ATSAssessment;
}) {
  const dimensions = [
    ["关键词覆盖", assessment.keywordScore],
    ["经历证据", assessment.evidenceScore],
    ["量化成果", assessment.measurableScore],
    ["内容完整", assessment.completenessScore],
  ] as const;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm">ATS 就绪度估算</CardTitle>
            <p className="mt-1 text-xs text-neutral-500">
              基于当前 JD 与最终简历本地计算，不代表招聘系统录用结论。
            </p>
          </div>
          <div className="text-right">
            <span data-testid="export-ats-score" className="text-3xl font-semibold tabular-nums">
              {assessment.overallScore}
            </span>
            <span className="text-sm text-neutral-400">/100</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-4">
          {dimensions.map(([label, score]) => (
            <div key={label} className="rounded-md border p-3">
              <p className="text-xs text-neutral-500">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{score}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <KeywordGroup
            title="已覆盖关键词"
            values={assessment.matchedKeywords}
            empty="尚未识别到已覆盖关键词"
            positive
          />
          <KeywordGroup
            title="缺失关键词"
            values={assessment.missingKeywords}
            empty="当前关键词已全部覆盖"
          />
        </div>

        {assessment.weakEvidence.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              薄弱证据
            </p>
            <ul className="space-y-1 text-sm text-neutral-600">
              {assessment.weakEvidence.map((item, index) => (
                <li key={`${item}-${index}`}>• {item}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-neutral-600">下一步建议</p>
          <ul className="space-y-1 text-sm text-neutral-600">
            {assessment.suggestions.map((suggestion, index) => (
              <li key={`${suggestion}-${index}`} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function KeywordGroup({
  title,
  values,
  empty,
  positive = false,
}: {
  title: string;
  values: string[];
  empty: string;
  positive?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-neutral-600">{title}</p>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <Badge
              key={value}
              variant={positive ? "success" : "warning"}
              className="font-normal"
            >
              {value}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-neutral-400">{empty}</p>
      )}
    </div>
  );
}
