"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings2, Loader2, ExternalLink, Eye, EyeOff, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PROVIDER_PRESETS, getProviderPreset } from "@/lib/ai/presets";
import { fetchAIConfig, saveAIConfig, testAIConfig } from "@/services/ai/resumeAgent";
import type { AIConnectionTestResult } from "@/lib/ai/types";
import { isStudioEnabled, setStudioEnabled } from "@/lib/studio/settings";

interface AISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function AISettingsDialog({ open, onOpenChange, onSaved }: AISettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AIConnectionTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [useMock, setUseMock] = useState(false);
  const [provider, setProvider] = useState("zhipu");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [invalidExistingKey, setInvalidExistingKey] = useState(false);
  const [keySource, setKeySource] = useState<"user" | "env" | "none">("none");
  const [keyMasked, setKeyMasked] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [studioEnabled, setStudioEnabledState] = useState(false);

  // 拉取当前配置
  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await fetchAIConfig();
      setUseMock(config.mode === "mock");
      setProvider(config.provider || "zhipu");
      setBaseUrl(config.baseUrl);
      setModel(config.model);
      setHasExistingKey(config.hasApiKey);
      setInvalidExistingKey(config.invalidApiKey);
      setKeySource(config.apiKeySource);
      setKeyMasked(config.apiKeyMasked);
      setApiKey(""); // 输入框留空，表示保留原值
      setTestResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载配置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) { loadConfig(); setStudioEnabledState(isStudioEnabled()); }
  }, [open, loadConfig]);

  // 选择 provider 时自动填充 baseUrl 和 model
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const preset = getProviderPreset(newProvider);
    if (preset) {
      setBaseUrl(preset.baseUrl);
      setModel(preset.model);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // apiKey 为空表示保留原值
      const payload: Parameters<typeof saveAIConfig>[0] = {
        provider,
        baseUrl,
        model,
        useMock,
        apiKey: apiKey || "__unchanged__",
      };
      await saveAIConfig(payload);
      setStudioEnabled(studioEnabled);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      setTestResult(await testAIConfig({ provider, baseUrl, model, useMock: false, apiKey: apiKey || "__unchanged__" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接测试失败");
    } finally {
      setTesting(false);
    }
  };

  const currentPreset = getProviderPreset(provider);
  const apiKeyPlaceholder = invalidExistingKey
    ? "当前 Key 格式错误，请重新输入"
    : hasExistingKey
      ? `已配置 (${keyMasked})，留空保留`
      : currentPreset?.keyPlaceholder || "请输入 API Key";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b border-neutral-200 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" />
            AI 模型设置
          </DialogTitle>
          <DialogDescription className="text-xs">
            切换模型提供商、配置 API Key、在 Mock 与真实大模型间切换。配置保存在本地文件 .ai-user-config.json
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
            {/* 当前状态 */}
            <div className="mb-4 flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              <span className="text-xs text-neutral-500">当前状态：</span>
              <Badge variant={useMock ? "secondary" : "success"} className="font-normal">
                {useMock ? "Mock 模式" : "AI 模式"}
              </Badge>
              {hasExistingKey && (
                <span className="text-[11px] text-neutral-400">
                  Key 来源：{keySource === "user" ? "本地配置" : keySource === "env" ? "环境变量" : "未配置"}
                </span>
              )}
            </div>

            {invalidExistingKey && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  当前保存的 API Key 含中文、全角符号或空格，已自动回退 Mock。请重新粘贴服务商控制台生成的完整 Key。
                </span>
              </div>
            )}
            {/* 模式切换 */}
            <div className="mb-4">
              <Label id="ai-mode-label" className="mb-2 block text-xs font-medium">运行模式</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUseMock(false)}
                  aria-labelledby="ai-mode-label"
                  aria-pressed={!useMock}
                  className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                    !useMock
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  <div className="font-medium">AI 模式</div>
                  <div className={`mt-0.5 text-[10px] ${!useMock ? "text-neutral-300" : "text-neutral-400"}`}>
                    调用真实大模型
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setUseMock(true)}
                  aria-labelledby="ai-mode-label"
                  aria-pressed={useMock}
                  className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                    useMock
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  <div className="font-medium">Mock 模式</div>
                  <div className={`mt-0.5 text-[10px] ${useMock ? "text-neutral-300" : "text-neutral-400"}`}>
                    使用预设示例数据
                  </div>
                </button>
              </div>
            </div>

            {/* 模型配置（Mock 模式下禁用） */}
            <fieldset disabled={useMock} className="space-y-4">
              {/* Provider 选择 */}
              <div>
                <Label htmlFor="ai-provider" className="mb-1.5 block text-xs font-medium">模型提供商</Label>
                <Select value={provider} onValueChange={handleProviderChange}>
                  <SelectTrigger id="ai-provider" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentPreset && (
                  <a
                    href={currentPreset.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-500 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    获取 {currentPreset.label} API Key
                  </a>
                )}
              </div>

              {/* API Key */}
              <div>
                <Label htmlFor="ai-api-key" className="mb-1.5 block text-xs font-medium">API Key</Label>
                <div className="relative">
                  <Input
                    id="ai-api-key"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={apiKeyPlaceholder}
                    className="pr-9 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {currentPreset && (
                  <p className="mt-1 text-[11px] text-neutral-400">{currentPreset.keyHint}</p>
                )}
              </div>

              {/* Base URL */}
              <div>
                <Label htmlFor="ai-base-url" className="mb-1.5 block text-xs font-medium">Base URL（OpenAI 兼容接口）</Label>
                <Input
                  id="ai-base-url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://..."
                  className="font-mono text-xs"
                />
              </div>

              {/* Model */}
              <div>
                <Label htmlFor="ai-model" className="mb-1.5 block text-xs font-medium">模型名称</Label>
                {currentPreset && currentPreset.models.length > 0 ? (
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger id="ai-model" className="h-9 font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentPreset.models.map((m) => (
                        <SelectItem key={m} value={m} className="font-mono text-xs">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="ai-model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="font-mono text-xs"
                  />
                )}
              </div>
            </fieldset>

            <div className="mt-5 border-t border-neutral-200 pt-4">
              <div className="flex items-start justify-between gap-4 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
                <div>
                  <Label htmlFor="studio-enabled" className="text-xs font-medium">高级功能：开发者工作台</Label>
                  <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">开启后显示工作流、运行追踪、测评和开发记录入口。本开关不是身份认证，仅适合本机使用。</p>
                </div>
                <input id="studio-enabled" type="checkbox" className="mt-0.5 h-4 w-4" checked={studioEnabled} onChange={(event) => setStudioEnabledState(event.target.checked)} />
              </div>
            </div>

            {testResult && (
              <div className={`mt-4 rounded-md border px-3 py-2 text-xs ${testResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`} role="status" aria-live="polite">
                {testResult.message} · {testResult.latencyMs} ms{testResult.category ? ` · ${testResult.category}` : ""}
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600" role="alert" aria-live="assertive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button variant="outline" size="sm" onClick={handleTest} disabled={useMock || saving || testing || loading}>
            {testing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />测试中</> : "测试连接"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                保存中
              </>
            ) : (
              "保存配置"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
