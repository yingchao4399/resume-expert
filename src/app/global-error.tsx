"use client";
import { RouteErrorView } from "@/components/shared/route-error-view";
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { return <html lang="zh-CN"><body><RouteErrorView error={error} reset={reset} scope="global" /></body></html>; }
