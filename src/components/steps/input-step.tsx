"use client";

import { useMemo, useState } from "react";
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
import { confirmedEvidencePrompt } from "@/lib/evidence/resume-evidence";

export function InputStep() {
  const [importOpen, setImportOpen] = useState(false);
  const {
    optimizeStyle,
    userInput,
    careerEvidence,
    setUserInput,
    setImportedResume,
    loadExampleData,
    isAnalyzing,
    analysisError,
    setAnalyzing,
    setAnalysisResult,
    setAnalysisError,
    setCurrentStep,
  } = useResumeStore();
  const [showValidation, setShowValidation] = useState(false);

  const missingFields = useMemo(
    () => [
      !userInput.targetRole.trim() && { id: "targetRole", label: "目标岗位" },
      !userInput.jobDescription.trim() && { id: "jobDescription", label: "目标 JD" },
      !userInput.originalResume.trim() && { id: "originalResume", label: "原始简历" },
    ].filter(Boolean) as Array<{ id: string; label: string }>,
    [userInput]
  );

  const handleAnalyze = async () => {
    if (missingFields.length > 0) {
      setShowValidation(true);
      document.getElementById(missingFields[0].id)?.focus();
      return;
    }
    setShowValidation(false);
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await runResumeAnalysis({ ...userInput, additionalInfo: [userInput.additionalInfo, confirmedEvidencePrompt(careerEvidence)].filter(Boolean).join("\n\n") }, optimizeStyle);
      setAnalysisResult(result);
      setCurrentStep("jd-analysis");
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
        <Button variant="outline" size="sm" onClick={loadExampleData}>
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
              分析中...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              开始分析
            </>
          )}
        </Button>
      </div>

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
                onChange={(e) => setUserInput({ targetRole: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">行业</Label>
              <Input
                id="industry"
                placeholder="如：企业服务 / SaaS"
                value={userInput.industry}
                onChange={(e) => setUserInput({ industry: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyType">公司类型</Label>
              <Select
                value={userInput.companyType}
                onValueChange={(v) => setUserInput({ companyType: v as CompanyType })}
              >
                <SelectTrigger id="companyType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="大厂">大厂</SelectItem>
                  <SelectItem value="中型公司">中型公司</SelectItem>
                  <SelectItem value="创业公司">创业公司</SelectItem>
                  <SelectItem value="外企">外企</SelectItem>
                  <SelectItem value="国企">国企</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobStage">求职阶段</Label>
              <Select
                value={userInput.jobStage}
                onValueChange={(v) => setUserInput({ jobStage: v as JobStage })}
              >
                <SelectTrigger id="jobStage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="校招">校招</SelectItem>
                  <SelectItem value="社招-初级">社招-初级</SelectItem>
                  <SelectItem value="社招-中级">社招-中级</SelectItem>
                  <SelectItem value="社招-高级">社招-高级</SelectItem>
                  <SelectItem value="转行">转行</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="highlightSkills">希望突出的能力</Label>
              <Input
                id="highlightSkills"
                placeholder="如：AI 产品规划、数据驱动、ToB 需求分析"
                value={userInput.highlightSkills}
                onChange={(e) => setUserInput({ highlightSkills: e.target.value })}
              />
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
              onChange={(e) => setUserInput({ jobDescription: e.target.value })}
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
              onChange={(e) => setUserInput({ originalResume: e.target.value })}
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
              onChange={(e) => setUserInput({ additionalInfo: e.target.value })}
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
