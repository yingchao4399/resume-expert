import type { ChangeEvent, RefObject } from "react";
import {
  AlertCircle,
  FileAudio,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { JobApplication } from "@/types/resume";

interface InterviewRecordingInputProps {
  applications: JobApplication[];
  applicationId: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  uploading: boolean;
  fileName: string | null;
  recordingId: string | null;
  transcriptText: string;
  error: string | null;
  analyzing: boolean;
  hasResult: boolean;
  onApplicationChange: (id: string) => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onDeleteRecording: () => void;
  onTranscriptChange: (text: string) => void;
  onUseSample: () => void;
  onAnalyze: () => void;
  onReset: () => void;
}

export function InterviewRecordingInput({
  applications,
  applicationId,
  fileInputRef,
  uploading,
  fileName,
  recordingId,
  transcriptText,
  error,
  analyzing,
  hasResult,
  onApplicationChange,
  onFileSelect,
  onDeleteRecording,
  onTranscriptChange,
  onUseSample,
  onAnalyze,
  onReset,
}: InterviewRecordingInputProps) {
  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">1. 录音上传与对话文本</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="mb-1.5 block text-xs text-neutral-500">
            关联投递记录（可选）
          </Label>
          <select
            className="h-9 w-full max-w-md rounded-md border border-neutral-200 bg-white px-3 text-sm"
            value={applicationId}
            onChange={(event) => onApplicationChange(event.target.value)}
          >
            <option value="">不关联投递</option>
            {applications.map((item) => (
              <option key={item.id} value={item.id}>
                {item.company} · {item.role} · {item.status}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label className="mb-1.5 block text-xs text-neutral-500">
            录音文件（音频，本地存储）
          </Label>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac"
              onChange={onFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  上传中
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  选择录音文件
                </>
              )}
            </Button>
            {fileName && (
              <span className="flex items-center gap-1.5 text-xs text-neutral-600">
                <FileAudio className="h-3.5 w-3.5 text-emerald-600" />
                {fileName}
                {recordingId && (
                  <Badge variant="secondary" className="font-normal">
                    已上传
                  </Badge>
                )}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-neutral-400">
            上传的录音仅用于本地回放与管理。因本地无 STT
            服务，转写需手动完成或在下方直接粘贴对话文本。
          </p>
          {recordingId && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <audio
                className="h-9 max-w-full"
                controls
                preload="metadata"
                src={`/api/interview-recording/${encodeURIComponent(recordingId)}`}
              >
                当前浏览器不支持音频播放。
              </audio>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-red-600"
                onClick={onDeleteRecording}
              >
                <Trash2 className="h-3.5 w-3.5" />删除录音
              </Button>
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="text-xs text-neutral-500">
              面试对话文本（区分“面试官：”和“求职者：”）
            </Label>
            <button
              type="button"
              onClick={onUseSample}
              className="text-[11px] text-blue-500 hover:underline"
            >
              使用示例对话
            </button>
          </div>
          <Textarea
            value={transcriptText}
            onChange={(event) => onTranscriptChange(event.target.value)}
            placeholder={`面试官：你好，请先自我介绍一下。\n求职者：好的，我是……\n面试官：你说说你做过哪些项目？\n求职者：……`}
            className="min-h-[200px] font-mono text-xs leading-relaxed"
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            字数：{transcriptText.length}（建议至少 200 字以获得有效分析）
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            onClick={onAnalyze}
            disabled={analyzing || !transcriptText.trim()}
          >
            {analyzing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                AI 分析中…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                开始 AI 诊断分析
              </>
            )}
          </Button>
          {hasResult && (
            <Button variant="outline" size="sm" onClick={onReset}>
              重置
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
