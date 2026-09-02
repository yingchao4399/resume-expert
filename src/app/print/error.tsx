"use client";
import { RouteErrorView } from "@/components/shared/route-error-view";
export default function PrintError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { return <RouteErrorView error={error} reset={reset} scope="print" />; }
