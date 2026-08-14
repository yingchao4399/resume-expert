"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ExternalLink, Eye, EyeOff, Loader2, RefreshCw, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PROVIDER_PRESETS, getProviderPreset } from "@/lib/ai/presets";
import { fetchAIConfig, refreshAIModels, saveAIConfig, testAIConfig } from "@/services/ai/resumeAgent";
import type { AIConnectionTestResult, AIModelCatalogResult } from "@/lib/ai/types";
import { isStudioEnabled, setStudioEnabled } from "@/lib/studio/settings";

interface AISettingsDialogProps { open: boolean; onOpenChange: (open: boolean) => void; onSaved?: () => void }

export function AISettingsDialog({ open, onOpenChange, onSaved }: AISettingsDialogProps) {
  const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false); const [refreshing, setRefreshing] = useState(false);
  const [testResult, setTestResult] = useState<AIConnectionTestResult | null>(null);
  const [catalog, setCatalog] = useState<AIModelCatalogResult | null>(null); const [error, setError] = useState<string | null>(null);
  const [useMock, setUseMock] = useState(false); const [provider, setProvider] = useState("zhipu");
  const [apiKey, setApiKey] = useState(""); const [baseUrl, setBaseUrl] = useState(""); const [model, setModel] = useState("");
  const [hasExistingKey, setHasExistingKey] = useState(false); const [invalidExistingKey, setInvalidExistingKey] = useState(false);
  const [keySource, setKeySource] = useState<"user" | "env" | "none">("none"); const [keyMasked, setKeyMasked] = useState("");
  const [showKey, setShowKey] = useState(false); const [studioEnabled, setStudioEnabledState] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const config = await fetchAIConfig();
      setUseMock(config.mode === "mock"); setProvider(getProviderPreset(config.provider) ? config.provider : "custom"); setBaseUrl(config.baseUrl); setModel(config.model);
      setHasExistingKey(config.hasApiKey); setInvalidExistingKey(config.invalidApiKey); setKeySource(config.apiKeySource); setKeyMasked(config.apiKeyMasked);
      setApiKey(""); setTestResult(null); setCatalog(null);
    } catch (next) { setError(next instanceof Error ? next.message : "加载配置失败"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) { void loadConfig(); setStudioEnabledState(isStudioEnabled()); } }, [open, loadConfig]);

  const currentPreset = getProviderPreset(provider);
  const officialModels = useMemo(() => currentPreset?.models ?? [], [currentPreset]);
  const accountModels = useMemo(() => catalog?.models.filter((item) => item.source === "account" && !officialModels.includes(item.id)).map((item) => item.id) ?? [], [catalog, officialModels]);
  const knownModel = officialModels.includes(model) || catalog?.models.some((item) => item.id === model);
  const oldModelWarning = !useMock && model && currentPreset && !knownModel;

  const handleProviderChange = (value: string) => {
    setProvider(value); setCatalog(null); setTestResult(null);
    const preset = getProviderPreset(value); setBaseUrl(preset?.baseUrl ?? ""); setModel(preset?.recommendedModel ?? "");
  };
  const payload = () => ({ provider, baseUrl, model, useMock: false, apiKey: apiKey || "__unchanged__" });
  const handleRefresh = async () => {
    setRefreshing(true); setError(null);
    try { setCatalog(await refreshAIModels(payload())); } catch (next) { setError(next instanceof Error ? next.message : "刷新模型清单失败"); } finally { setRefreshing(false); }
  };
  const handleTest = async () => {
    setTesting(true); setError(null); setTestResult(null);
    try { setTestResult(await testAIConfig(payload())); } catch (next) { setError(next instanceof Error ? next.message : "连接测试失败"); } finally { setTesting(false); }
  };
  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await saveAIConfig({ provider, baseUrl, model, useMock, apiKey: apiKey || "__unchanged__" });
      setStudioEnabled(studioEnabled); onSaved?.(); onOpenChange(false);
    } catch (next) { setError(next instanceof Error ? next.message : "保存失败"); } finally { setSaving(false); }
  };

  const apiKeyPlaceholder = invalidExistingKey ? "当前 Key 格式错误，请重新输入" : hasExistingKey ? `已配置（${keyMasked}），留空保留` : currentPreset?.keyPlaceholder || "请输入 API Key";

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg gap-0 p-0">
      <DialogHeader className="border-b border-neutral-200 px-5 py-4">
        <DialogTitle className="flex items-center gap-2 text-base"><Settings2 className="h-4 w-4" />AI 模型设置</DialogTitle>
        <DialogDescription className="text-xs">支持六家官方 Provider 与自定义 OpenAI 兼容接口。刷新模型不会自动保存或替换当前模型。</DialogDescription>
      </DialogHeader>
      {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div> : <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
        <div className="mb-4 flex items-center gap-2 rounded-md border bg-neutral-50 px-3 py-2 text-xs"><span className="text-neutral-500">当前状态：</span><Badge variant={useMock ? "secondary" : "success"}>{useMock ? "Mock 模式" : "AI 模式"}</Badge>{hasExistingKey && <span className="text-neutral-400">Key 来源：{keySource === "user" ? "本地配置" : keySource === "env" ? "环境变量" : "未配置"}</span>}</div>
        {invalidExistingKey && <Alert tone="amber">当前保存的 API Key 格式错误，请重新粘贴服务商控制台生成的完整 Key。</Alert>}
        <div className="mb-4"><Label id="ai-mode-label" className="mb-2 block text-xs">运行模式</Label><div className="grid grid-cols-2 gap-2">
          <ModeButton active={!useMock} onClick={() => setUseMock(false)} title="AI 模式" description="调用真实大模型" />
          <ModeButton active={useMock} onClick={() => setUseMock(true)} title="Mock 模式" description="只验证流程，不虚构事实" />
        </div></div>
        <fieldset disabled={useMock} className="space-y-4">
          <div><Label htmlFor="ai-provider" className="mb-1.5 block text-xs">模型提供商</Label><Select value={provider} onValueChange={handleProviderChange}><SelectTrigger id="ai-provider"><SelectValue /></SelectTrigger><SelectContent>{PROVIDER_PRESETS.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label htmlFor="ai-api-key" className="mb-1.5 block text-xs">API Key</Label><div className="relative"><Input id="ai-api-key" type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={apiKeyPlaceholder} className="pr-9 font-mono text-xs" /><button type="button" aria-label={showKey ? "隐藏 API Key" : "显示 API Key"} onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400">{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div><p className="mt-1 text-[11px] text-neutral-400">{currentPreset?.keyHint}</p></div>
          <div><Label htmlFor="ai-base-url" className="mb-1.5 block text-xs">Base URL（OpenAI 兼容接口）</Label><Input id="ai-base-url" value={baseUrl} onChange={(event) => { setBaseUrl(event.target.value); setCatalog(null); }} placeholder="https://.../v1" className="font-mono text-xs" /></div>
          <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="ai-model-choice" className="text-xs">可用模型</Label><Button type="button" variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing || !baseUrl || !model}><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />{refreshing ? "刷新中" : "刷新可用模型"}</Button></div>
            <Select value={knownModel ? model : "__manual__"} onValueChange={(value) => { if (value !== "__manual__") setModel(value); }}><SelectTrigger id="ai-model-choice" className="font-mono text-xs"><SelectValue /></SelectTrigger><SelectContent>
              {officialModels.length > 0 && <SelectGroup><SelectLabel>官方预设</SelectLabel>{officialModels.map((item) => <SelectItem key={`official-${item}`} value={item}>{item}{item === currentPreset?.recommendedModel ? "（推荐）" : ""}</SelectItem>)}</SelectGroup>}
              {accountModels.length > 0 && <SelectGroup><SelectLabel>账号实际返回</SelectLabel>{accountModels.map((item) => <SelectItem key={`account-${item}`} value={item}>{item}</SelectItem>)}</SelectGroup>}
              <SelectItem value="__manual__">手动模型 ID</SelectItem>
            </SelectContent></Select>
            <Label htmlFor="ai-model" className="block text-[11px] text-neutral-500">手动模型 ID</Label><Input id="ai-model" value={model} onChange={(event) => setModel(event.target.value)} placeholder="输入服务商官网或 /models 返回的模型 ID" className="font-mono text-xs" />
            {currentPreset && <div className="flex flex-wrap gap-3 text-[11px]"><span className="text-neutral-400">官方清单更新：{currentPreset.catalogUpdatedAt}</span>{currentPreset.modelDocsUrl && <a href={currentPreset.modelDocsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">查看官方模型文档<ExternalLink className="h-3 w-3" /></a>}</div>}
            {provider === "deepseek" && <p className="text-[11px] text-blue-700">结构抽取会关闭 DeepSeek V4 思考模式以缩短等待；当前模型不会被静默替换。更看重速度时建议使用 deepseek-v4-flash。</p>}
            {oldModelWarning && <Alert tone="amber">当前模型“{model}”不在最新官方预设或账号返回清单中，可能已下线；不会自动替换。建议改用“{currentPreset?.recommendedModel}”并先测试连接。</Alert>}
            {catalog && <div className="rounded-md border bg-neutral-50 px-3 py-2 text-[11px]" role="status" aria-live="polite">已于 {new Date(catalog.refreshedAt).toLocaleString("zh-CN")} 刷新，共 {catalog.models.filter((item) => item.source === "account").length} 个账号模型。{catalog.warning && <span className="block text-amber-700">{catalog.warning}</span>}</div>}
          </div>
          {currentPreset?.docsUrl && <a href={currentPreset.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline">获取 {currentPreset.label} API Key<ExternalLink className="h-3 w-3" /></a>}
        </fieldset>
        <div className="mt-5 border-t pt-4"><div className="flex items-start justify-between gap-4 rounded-md border bg-neutral-50 px-3 py-3"><div><Label htmlFor="studio-enabled" className="text-xs">高级功能：开发者工作台</Label><p className="mt-1 text-[11px] text-neutral-500">显示工作流、运行追踪、测评和开发记录入口，仅适合本机使用。</p></div><input id="studio-enabled" type="checkbox" checked={studioEnabled} onChange={(event) => setStudioEnabledState(event.target.checked)} /></div></div>
        {testResult && <div className={`mt-4 rounded-md border px-3 py-2 text-xs ${testResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`} role="status" aria-live="polite">{testResult.message} · {testResult.latencyMs} ms{testResult.category ? ` · ${testResult.category}` : ""}</div>}
        {error && <Alert tone="red">{error}</Alert>}
      </div>}
      <div className="flex justify-end gap-2 border-t px-5 py-3"><Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button><Button variant="outline" size="sm" onClick={() => void handleTest()} disabled={useMock || saving || testing || loading}>{testing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{testing ? "测试中" : "测试连接"}</Button><Button size="sm" onClick={() => void handleSave()} disabled={saving || loading}>{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{saving ? "保存中" : "保存配置"}</Button></div>
    </DialogContent>
  </Dialog>;
}

function ModeButton({ active, onClick, title, description }: { active: boolean; onClick: () => void; title: string; description: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-md border px-3 py-2 text-left text-xs ${active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-600"}`}><div className="font-medium">{title}</div><div className={`mt-0.5 text-[10px] ${active ? "text-neutral-300" : "text-neutral-400"}`}>{description}</div></button>;
}

function Alert({ tone, children }: { tone: "amber" | "red"; children: React.ReactNode }) {
  const colors = tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700";
  return <div className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${colors}`} role={tone === "red" ? "alert" : "status"} aria-live={tone === "red" ? "assertive" : "polite"}><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{children}</span></div>;
}
