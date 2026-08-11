import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobApplication } from "@/types/resume";
import type { InterviewReviewRecord } from "@/types/interview";

interface InterviewReviewHistoryProps {
  reviews: InterviewReviewRecord[];
  applications: JobApplication[];
  onSelect: (review: InterviewReviewRecord) => void;
  onDelete: (id: string) => void;
}

export function InterviewReviewHistory({
  reviews,
  applications,
  onSelect,
  onDelete,
}: InterviewReviewHistoryProps) {
  if (reviews.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">已保存复盘记录</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {[...reviews]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((record) => {
            const application = applications.find(
              (item) => item.id === record.applicationId
            );
            return (
              <div
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onSelect(record)}
                >
                  <span className="font-medium">
                    {application
                      ? `${application.company} · ${application.role}`
                      : "未关联投递"}
                  </span>
                  <span className="ml-2 text-neutral-500">
                    {new Date(record.createdAt).toLocaleString("zh-CN")} ·{" "}
                    {record.result.performance.overallScore} 分
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => onDelete(record.id)}
                >
                  删除
                </Button>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
