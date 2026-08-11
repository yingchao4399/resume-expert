"use client";

import { useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionTitle } from "@/components/shared/ui-helpers";
import { useResumeStore } from "@/store/resume-store";
import { analyzeInterview, deleteInterviewRecording, uploadInterviewRecording } from "@/services/ai/resumeAgent";
import type {
  InterviewAnalysisResult,
  InterviewRecordingMetadata,
} from "@/types/interview";
import { InterviewAnalysisResultView } from "@/components/interview/interview-analysis-result-view";
import { InterviewRecordingInput } from "@/components/interview/interview-recording-input";
import { InterviewReviewHistory } from "@/components/interview/interview-review-history";

const SAMPLE_TRANSCRIPT = `面试官：你好，先简单自我介绍一下，重点说下你和 AI 相关的经历。
求职者：好的，我是张明，3.5 年 B 端产品经理经验，主导过 WMS 仓储系统和经营数据报表平台。最近自学了 Prompt Engineering 和 LangChain，做过一个内部文档问答 Demo。
面试官：你那个文档问答 Demo 用的是什么模型？怎么做的检索？
求职者：用的 GPT-3.5，检索就是先切片然后 embedding 相似度匹配。
面试官：为什么用 GPT-3.5 不用 4？切片策略怎么定的？遇到长文档怎么处理上下文？
求职者：嗯……3.5 便宜嘛，切片我就是按 500 字切。长文档……其实没特别处理。
面试官：好。那你说说，如果让你设计一个 ToB 的智能客服，你会怎么拆解这个产品？
求职者：我会先做用户调研，看客户现在的客服痛点是什么。然后定 MVP，比如先做意图识别，再做自动回复。
面试官：MVP 范围怎么定？怎么衡量效果？准确率和召回率你怎么平衡？
求职者：MVP 我可能先覆盖 top 10 高频问题。效果嘛……看客户满意度吧。准确率召回率这个，我可能需要再研究一下。`;

export function InterviewRecordingStep() {
  const { userInput, activeDocumentId, jobApplications, interviewReviews, saveInterviewReview, deleteInterviewReview, unlinkInterviewRecording, setCurrentStep } = useResumeStore();
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [recordingMeta, setRecordingMeta] = useState<InterviewRecordingMetadata | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InterviewAnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded = await uploadInterviewRecording(file);
      setRecordingId(uploaded.id);
      setFileName(uploaded.fileName);
      setRecordingMeta({ id: uploaded.id, fileName: uploaded.fileName, fileSize: uploaded.fileSize, uploadedAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!transcriptText.trim()) {
      setError("请粘贴面试对话文本（可点击「使用示例对话」快速填充）");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const res = await analyzeInterview({
        transcriptText,
        resumeText: userInput.originalResume,
        targetRole: userInput.targetRole,
      });
      setResult(res);
      saveInterviewReview({ applicationId: applicationId || null, resumeDocumentId: activeDocumentId || null, transcriptText: transcriptText.trim(), result: res, recording: recordingMeta });
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteRecording = async () => {
    if (!recordingId || !window.confirm("确定删除这份本地录音？相关面试复盘会保留，但录音关联将被解除。")) return;
    setError(null);
    try {
      await deleteInterviewRecording(recordingId);
      unlinkInterviewRecording(recordingId);
      setRecordingId(null);
      setRecordingMeta(null);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "录音删除失败");
    }
  };

  return (
    <div>
      <SectionTitle
        title="面试对话复盘"
        description="粘贴面试对话文本后进行 AI 分析；录音上传目前仅用于本地保存"
      />

      <InterviewReviewHistory
        reviews={interviewReviews}
        applications={jobApplications}
        onSelect={(record) => {
          setTranscriptText(record.transcriptText);
          setResult(record.result);
          setApplicationId(record.applicationId ?? "");
          setRecordingMeta(record.recording);
          setRecordingId(record.recording?.id ?? null);
          setFileName(record.recording?.fileName ?? null);
        }}
        onDelete={deleteInterviewReview}
      />

      <InterviewRecordingInput
        applications={jobApplications}
        applicationId={applicationId}
        fileInputRef={fileInputRef}
        uploading={uploading}
        fileName={fileName}
        recordingId={recordingId}
        transcriptText={transcriptText}
        error={error}
        analyzing={analyzing}
        hasResult={Boolean(result)}
        onApplicationChange={setApplicationId}
        onFileSelect={handleFileSelect}
        onDeleteRecording={handleDeleteRecording}
        onTranscriptChange={setTranscriptText}
        onUseSample={() => setTranscriptText(SAMPLE_TRANSCRIPT)}
        onAnalyze={handleAnalyze}
        onReset={() => setResult(null)}
      />

      {/* 分析结果 */}
      {result ? (
        <InterviewAnalysisResultView result={result} />
      ) : !analyzing ? (
        <EmptyState message="上传录音或粘贴对话文本后，点击「开始 AI 诊断分析」查看完整诊断结果" />
      ) : null}

      <div className="mt-6 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setCurrentStep("interview")}>
          查看面试准备
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
