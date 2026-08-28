"use client";
import { useEffect } from "react";

/** Non-persisted local task guard, shared by the new library entry and version selector. */
export function useNavigationTaskGuard(busy: boolean, cancel?: () => void) {
  useEffect(() => {
    if (!busy) return;
    const navigate = (event: Event) => {
      if (cancel) {
        if (window.confirm("任务仍在进行，离开会取消本次任务。是否继续？")) cancel();
        else event.preventDefault();
      } else {
        event.preventDefault();
        window.alert("当前生成任务尚未结束，请等待完成后再打开简历库或切换版本。");
      }
    };
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("resume-expert-before-navigate", navigate);
    window.addEventListener("beforeunload", unload);
    return () => { window.removeEventListener("resume-expert-before-navigate", navigate); window.removeEventListener("beforeunload", unload); };
  }, [busy, cancel]);
}
