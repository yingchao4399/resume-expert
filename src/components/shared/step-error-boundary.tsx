"use client";

import React from "react";
import { AlertTriangle, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAppErrorPayload, type AppErrorPayload } from "@/lib/errors/app-error";
import { saveIncident } from "@/lib/studio/incident-store";

interface State { error: Error | null; payload: AppErrorPayload | null }

export class StepErrorBoundary extends React.Component<{ children: React.ReactNode; resetKey: string }, State> {
  state: State = { error: null, payload: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, payload: createAppErrorPayload(error, { code: "STEP_RENDER_ERROR", category: "unexpected", userMessage: "当前步骤显示失败，其他模块仍可继续使用。", retryable: true }) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const payload = this.state.payload ?? createAppErrorPayload(error, { userMessage: "当前步骤显示失败。" });
    void saveIncident({ ...payload, scope: "workflow-step", occurredAt: new Date().toISOString(), diagnostic: { ...payload.diagnostic as object, componentStack: info.componentStack?.slice(0, 2000) } });
  }

  componentDidUpdate(previous: Readonly<{ children: React.ReactNode; resetKey: string }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null, payload: null });
  }

  render() {
    if (!this.state.error || !this.state.payload) return this.props.children;
    return <div className="rounded-xl border border-red-200 bg-red-50 p-6" role="alert">
      <AlertTriangle className="h-6 w-6 text-red-600" />
      <h2 className="mt-3 text-lg font-semibold">当前步骤发生错误</h2>
      <p className="mt-2 text-sm text-red-800">{this.state.payload.userMessage}</p>
      <p className="mt-1 text-xs text-red-600">诊断编号：{this.state.payload.requestId}</p>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => this.setState({ error: null, payload: null })}><RotateCcw className="h-4 w-4" />重试显示</Button>
        <Button variant="outline" onClick={() => void navigator.clipboard.writeText(JSON.stringify(this.state.payload, null, 2))}><Copy className="h-4 w-4" />复制诊断信息</Button>
      </div>
    </div>;
  }
}
