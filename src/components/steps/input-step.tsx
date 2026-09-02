"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CircleStop, FileUp, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionTitle } from "@/components/shared/ui-helpers";
import { ResumeImportDialog } from "@/components/import/resume-import-dialog";
import { useResumeStore } from "@/store/resume-store";
import { ResumeAnalysisCancelledError, runResumeAnalysisStreaming, type DecisionStreamEvent } from "@/services/ai/resumeAgent";
import type { CompanyType, JobStage } from "@/types/resume";
import { buildCareerAnalysisClaims } from "@/lib/career/career-context";
import { useCareerDomain } from "@/hooks/use-career-domain";
import { isAnalysisFresh } from "@/lib/analysis-revision";
import { COMPANY_TYPES, isCompanyType, isJobStage, JOB_STAGES } from "@/config/job-options";
import { beginTask, cancelTask, completeTask, failTask, updateTask } from "@/lib/tasks/task-runtime";
import { taskErrorPayload } from "@/lib/errors/app-error";
import { useTaskRun } from "@/hooks/use-task-run";
const ANALYSIS_STAGES = ["拆分原子要求", "全局语义归并", "整理核心要求", "生成岗位画像"] as const;


export function InputStep() {
  const { snapshot: careerDomain } = useCareerDomain();
  const [importOpen, setImportOpen] = useState(false);
  const {
    optimizeStyle,
    userInput,
    jobTargetContext,
    setJobTargetContext,
    setUserInput,
    setImportedResume,
    loadExampleData,
    activeDocumentId,
    analysisError,
    setJDAnalysisDocument,
    setAnalysisError,
    setCurrentStep,
    materialRevision,
    analysisRevision,
    analysisResult,
    aiMode,
  } = useResumeStore();
  const analysisTask = useTaskRun(activeDocumentId, "jd-analysis");
  const isAnalyzing = analysisTask.status === "running";
  const [showValidation, setShowValidation] = useState(false);
  const [exampleLoaded, setExampleLoaded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState<DecisionStreamEvent | null>(null);
  const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const updateMaterial = <K extends keyof typeof userInput>(key: K, value: typeof userInput[K]) => {
    setUserInput({ [key]: value } as Pick<typeof userInput, K>);
  };

  const missingFields = useMemo(
    () => [
      !userInput.targetRole.trim() && { id: "targetRole", label: "目标岗位" },
      !userInput.jobDescription.trim() && { id: "jobDescription", label: "目标 JD" },
      !userInput.originalResume.trim() && { id: "originalResume", label: "原始简历" },
    ].filter(Boolean) as Array<{ id: string; label: string }>,
    [userInput]
  );

  useEffect(() => {
    if (!isAnalyzing) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [isAnalyzing]);

  useEffect(() => () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      cancelTask(activeDocumentId, "jd-analysis");
    }
  }, [activeDocumentId]);

  useEffect(() => {
    if (!isAnalyzing) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isAnalyzing]);

  const handleLoadExample = () => {
    const loaded = loadExampleData();
    setExampleLoaded(loaded);
    if (loaded) window.setTimeout(() => document.getElementById("targetRole")?.focus(), 0);
  };

  const handleAnalyze = async () => {
    if (missingFields.length > 0) {
      setShowValidation(true);
      document.getElementById(missingFields[0].id)?.focus();
      return;
    }
    setShowValidation(false);
    beginTask(activeDocumentId, "jd-analysis", "正在启动 JD 解析");
    setAnalysisError(null);
    setAnalysisNotice(null);
    setAnalysisProgress(null);
    const requestedRevision = materialRevision;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const document = await runResumeAnalysisStreaming(
        userInput,
        jobTargetContext,
        buildCareerAnalysisClaims(careerDomain),
        optimizeStyle,
        { signal: controller.signal, onProgress: event => {
          setAnalysisProgress(event);
          updateTask(activeDocumentId, "jd-analysis", { message: "message" in event ? event.message ?? null : null });
        }, materialRevision: requestedRevision },
      );
      if (setJDAnalysisDocument(document, requestedRevision)) {
        abortControllerRef.current = null;
        completeTask(activeDocumentId, "jd-analysis", "JD 需求地图已生成");
        setCurrentStep("jd-analysis");
      } else {
        cancelTask(activeDocumentId, "jd-analysis", "材料已变化，迟到结果未保存。");
      }
    } catch (error) {
      if (error instanceof ResumeAnalysisCancelledError) {
        setAnalysisNotice(error.message);
        cancelTask(activeDocumentId, "jd-analysis", error.message);
      } else {
        const payload = taskErrorPayload(error, "分析失败，请稍后重试");
        failTask(activeDocumentId, "jd-analysis", payload);
        setAnalysisError(payload.userMessage);
      }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  };

  const cancelAnalysis = () => {
    abortControllerRef.current?.abort();
  };

  return (
    <div>
      <SectionTitle
        title="输入材料"
        description="填写目标岗位信息与原始简历，Agent 将基于 JD 进行定制分析与优化"
      />

      <div className="mb-4 flex gap-2">
        <Button variant="outline" size="sm" onClick={handleLoadExample}>
          <Wand2 className="h-3.5 w-3.5" />
          使用示例数据
        </Button>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <FileUp className="h-3.5 w-3.5" />
          导入 PDF / DOCX
        </Button>
        <Button size="sm" onClick={handleAnalyze} disabled={isAnalyzing}>
          {isAnalyzing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              分析中 {elapsedSeconds}s
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              生成 JD 需求地图
            </>
          )}
        </Button>
        {isAnalyzing && (
          <Button size="sm" variant="outline" onClick={cancelAnalysis}>
            <CircleStop className="h-3.5 w-3.5" />
            取消分析
          </Button>
        )}
      </div>

      {exampleLoaded && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status" aria-live="polite">
          示例材料已载入，下一步点击“生成 JD 需求地图”。
        </div>
      )}

      {isAnalyzing && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900" role="status" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">
              {analysisProgress && "message" in analysisProgress ? analysisProgress.message : "正在启动深度分析"}
            </p>
            <span className="text-xs text-blue-700">
              已用 {elapsedSeconds}s · 最多剩余 {Math.max(0, 360 - elapsedSeconds)}s
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {ANALYSIS_STAGES.map((stage, index) => {
              const progressMessage = analysisProgress && "message" in analysisProgress ? analysisProgress.message ?? "" : "";
              const currentStage = /岗位画像/.test(progressMessage) ? 3 : /核心要求/.test(progressMessage) ? 2 : /语义归并/.test(progressMessage) ? 1 : 0;
              const completed = analysisProgress?.type === "stage-completed" || index < currentStage;
              const active = !completed && index === currentStage;
              return (
                <div key={stage} className={`flex items-center gap-2 rounded border px-3 py-2 text-xs ${completed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : active ? "border-blue-300 bg-white text-blue-900" : "border-blue-100 text-blue-500"}`}>
                  {completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-3.5 w-3.5 rounded-full border" />}
                  {stage}
                </div>
              );
            })}
          </div>
          {elapsedSeconds >= 30 && (
            <p className="mt-3 text-xs text-amber-700">
              当前模型响应较慢。正在分批解析并全局整理要求；任务最多 6 分钟，可随时取消，不会写入半成品。
            </p>
          )}
        </div>
      )}

      {analysisNotice && !isAnalyzing && (
        <div className="mb-4 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700" role="status" aria-live="polite">
          {analysisNotice}
        </div>
      )}

      {analysisResult && !isAnalysisFresh({ analysisResult, materialRevision, analysisRevision }) && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          材料已变化。旧分析仍可查看，但补证、制作和交付已锁定；请重新分析后继续。
        </div>
      )}

      {aiMode === "mock" && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
          Mock 仅用于验证流程，不会补造原始材料中不存在的人名、公司或业绩数据；正式求职请配置并测试真实模型。
        </div>
      )}

      {showValidation && missingFields.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert" aria-live="assertive">
          请先补齐：{missingFields.map((field) => field.label).join("、")}。
        </div>
      )}

      {analysisError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert" aria-live="assertive">
          <p>{analysisError}</p>
          <Button className="mt-2" variant="outline" size="sm" onClick={handleAnalyze}>重试分析</Button>
          <Button className="ml-2 mt-2" variant="ghost" size="sm" onClick={() => window.dispatchEvent(new Event("resume-expert-open-ai-settings"))}>打开 AI 设置</Button>
        </div>
      )}

      <div className="grid gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">目标岗位信息</CardTitle>
            <CardDescription>帮助 Agent 理解你的求职方向</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="targetRole">目标岗位</Label>
              <Input
                id="targetRole"
                aria-invalid={showValidation && !userInput.targetRole.trim()}
                placeholder="如：AI 产品经理"
                value={userInput.targetRole}
                onChange={(e) => updateMaterial("targetRole", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">行业</Label>
              <Input
                id="industry"
                placeholder="如：企业服务 / SaaS"
                value={userInput.industry}
                onChange={(e) => updateMaterial("industry", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="companyName">目标公司名称（可选）</Label>
              <Input id="companyName" placeholder="如：某科技公司；本版不会联网查询公司信息" value={jobTargetContext.companyName} onChange={(event) => setJobTargetContext({ companyName: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyType">公司类型</Label>
              <Select
                value={isCompanyType(userInput.companyType) ? userInput.companyType : undefined}
                onValueChange={(v) => updateMaterial("companyType", v as CompanyType)}
              >
                <SelectTrigger id="companyType">
                <SelectValue placeholder="请选择公司类型" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobStage">求职阶段</Label>
              <Select
                value={isJobStage(userInput.jobStage) ? userInput.jobStage : undefined}
                onValueChange={(v) => updateMaterial("jobStage", v as JobStage)}
              >
                <SelectTrigger id="jobStage">
                <SelectValue placeholder="请选择求职阶段" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_STAGES.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="highlightSkills">希望突出的能力</Label>
              <Input
                id="highlightSkills"
                placeholder="如：AI 产品规划、数据驱动、ToB 需求分析"
                value={userInput.highlightSkills}
                onChange={(e) => updateMaterial("highlightSkills", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="jobContextNotes">岗位背景补充（可选）</Label>
              <Textarea id="jobContextNotes" className="min-h-[96px] text-sm" placeholder="如：招聘沟通中获知的业务线、团队配置、岗位边界或当前痛点。请只填写已知信息。" value={jobTargetContext.notes} onChange={(event) => setJobTargetContext({ notes: event.target.value })} />
              <p className="text-xs text-neutral-500">修改这里会使旧分析过期；系统不会把推断当作公司真实事实。</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">目标 JD</CardTitle>
            <CardDescription>粘贴完整岗位描述，先生成并确认需求地图；真实经历匹配在下一页单独执行</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="jobDescription" className="sr-only">目标 JD</Label>
            <Textarea
              id="jobDescription"
              aria-invalid={showValidation && !userInput.jobDescription.trim()}
              className="min-h-[200px] font-mono text-xs leading-relaxed"
              placeholder="粘贴岗位 JD..."
              value={userInput.jobDescription}
              onChange={(e) => updateMaterial("jobDescription", e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">原始简历</CardTitle>
            <CardDescription>粘贴当前简历全文</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="originalResume" className="sr-only">原始简历</Label>
            <Textarea
              id="originalResume"
              aria-invalid={showValidation && !userInput.originalResume.trim()}
              className="min-h-[240px] font-mono text-xs leading-relaxed"
              placeholder="粘贴简历内容..."
              value={userInput.originalResume}
              onChange={(e) => updateMaterial("originalResume", e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">补充信息（可选）</CardTitle>
            <CardDescription>项目细节、转型动机、特殊说明等</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="additionalInfo" className="sr-only">补充信息</Label>
            <Textarea
              id="additionalInfo"
              className="min-h-[100px] text-sm"
              placeholder="补充 Agent 需要了解的信息..."
              value={userInput.additionalInfo}
              onChange={(e) => updateMaterial("additionalInfo", e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      <ResumeImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onConfirm={setImportedResume}
      />
    </div>
  );
}
