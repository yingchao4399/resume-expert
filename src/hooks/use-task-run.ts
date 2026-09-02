"use client";

import { useSyncExternalStore } from "react";
import {
  getTaskRunState,
  subscribeTaskRuns,
  type TaskOperationId,
  type TaskRunState,
} from "@/lib/tasks/task-runtime";

export function useTaskRun(documentId: string, operationId: TaskOperationId): TaskRunState {
  return useSyncExternalStore(
    subscribeTaskRuns,
    () => getTaskRunState(documentId, operationId),
    () => getTaskRunState(documentId, operationId),
  );
}
