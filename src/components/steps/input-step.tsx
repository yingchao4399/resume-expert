"use client";

import { useEffect, useMemo, useState } from "react";
import { FileUp, Loader2, Sparkles, Wand2 } from "lucide-react";
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
import { runResumeAnalysis } from "@/services/ai/resumeAgent";
import type { CompanyType, JobStage } from "@/types/resume";
import { buildCareerAnalysisClaims } from "@/lib/career/career-context";
import { useCareerDomain } from "@/hooks/use-career-domain";
import { isAnalysisFresh } from "@/lib/analysis-revision";
import { COMPANY_TYPES, isCompanyType, isJobStage, JOB_STAGES } from "@/config/job-options";


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
    isAnalyzing,
    analysisError,
    setAnalyzing,
    setAnalysisResult,
    setAnalysisError,
    setCurrentStep,
    materialRevision,
    analysisRevision,
    analysisResult,
    aiMode,
  } = useResumeStore();
  const [showValidation, setShowValidation] = useState(false);
  const [exampleLoaded, setExampleLoaded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
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
    setAnalyzing(true);
    setAnalysisError(null);
    const requestedRevision = materialRevision;
    try {
      const result = await runResumeAnalysis(userInput, jobTargetContext, buildCareerAnalysisClaims(careerDomain), optimizeStyle);
      if (setAnalysisResult(result, requestedRevision)) setCurrentStep("jd-analysis");
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "分析失败，请稍后重试");
    } finally {
      setAnalyzing(false);
    }
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
              开始分析
            </>
          )}
        </Button>
      </div>

      {exampleLoaded && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status" aria-live="polite">
          示例材料已载入，下一步点击“开始分析”。
        </div>
      )}

      {isAnalyzing && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800" role="status" aria-live="polite">
          正在依次解析 JD、匹配经历并准备面试策略。深度分析可能需要数分钟，请勿关闭页面或修改材料。
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
            <CardDescription>粘贴完整岗位描述，Agent 将解析职责与要求</CardDescription>
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
