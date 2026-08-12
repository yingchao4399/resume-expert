import { describe, expect, it } from "vitest";
import { createInitialWorkflowWorkspace, publishWorkflowDraft, rollbackWorkflow, testWorkflowDraft } from "@/lib/studio/workflow-release";

describe("workflow draft release lifecycle", () => {
  it("tests, publishes, retains ten versions and rolls back without overwriting history", () => {
    let workspace = createInitialWorkflowWorkspace("2026-08-01T00:00:00.000Z");
    workspace.draft = testWorkflowDraft(workspace.draft, "2026-08-02T00:00:00.000Z");
    const published = publishWorkflowDraft(workspace, null, "2026-08-02T00:01:00.000Z");
    expect(published.channel).toBe("production"); workspace = published.workspace;
    for (let index = 0; index < 11; index += 1) { workspace.draft = testWorkflowDraft({ ...workspace.draft, updatedAt: `2026-08-${String(index + 3).padStart(2, "0")}T00:00:00.000Z` }, `2026-08-${String(index + 3).padStart(2, "0")}T00:01:00.000Z`); workspace = publishWorkflowDraft(workspace, null, `2026-08-${String(index + 3).padStart(2, "0")}T00:02:00.000Z`).workspace; }
    expect(workspace.versions).toHaveLength(10);
    const previous = workspace.versions[0]; const rolled = rollbackWorkflow(workspace, previous.id, "2026-09-01T00:00:00.000Z");
    expect(rolled.versions.at(-1)?.definition).toEqual(previous.definition); expect(rolled.versions.at(-1)?.id).not.toBe(previous.id);
  });

  it("publishes provider changes as experiment without a recent real eval", () => {
    const workspace = createInitialWorkflowWorkspace("2026-08-01T00:00:00.000Z"); const analysis = workspace.draft.definition.nodes.find((node) => node.id === "analysis")!; analysis.provider = "flowise"; workspace.draft.updatedAt = "2026-08-02T00:00:00.000Z"; workspace.draft = testWorkflowDraft(workspace.draft, "2026-08-02T00:01:00.000Z");
    expect(publishWorkflowDraft(workspace, null, "2026-08-02T00:02:00.000Z").channel).toBe("experiment");
    expect(publishWorkflowDraft(workspace, "2026-08-01T00:00:00.000Z", "2026-08-02T00:02:00.000Z").channel).toBe("experiment");
  });

  it("allows a recent real eval to promote supported execution changes", () => {
    const workspace = createInitialWorkflowWorkspace("2026-08-01T00:00:00.000Z");
    workspace.draft.definition.nodes.find((node) => node.id === "analysis")!.model = "evaluated-model";
    workspace.draft.updatedAt = "2026-08-02T00:00:00.000Z";
    workspace.draft = testWorkflowDraft(workspace.draft, "2026-08-02T00:01:00.000Z");
    expect(publishWorkflowDraft(workspace, "2026-08-01T00:00:00.000Z", "2026-08-02T00:02:00.000Z").channel).toBe("production");
  });

  it("keeps the active production version and refuses rollback to experiments", () => {
    let workspace = createInitialWorkflowWorkspace("2026-08-01T00:00:00.000Z");
    for (let index = 0; index < 11; index += 1) {
      workspace.draft.definition.nodes.find((node) => node.id === "analysis")!.model = `experiment-${index}`;
      workspace.draft.updatedAt = `2026-08-${String(index + 2).padStart(2, "0")}T00:00:00.000Z`;
      workspace.draft = testWorkflowDraft(workspace.draft, `2026-08-${String(index + 2).padStart(2, "0")}T00:01:00.000Z`);
      workspace = publishWorkflowDraft(workspace, null, `2026-08-${String(index + 2).padStart(2, "0")}T00:02:00.000Z`).workspace;
    }
    expect(workspace.versions).toHaveLength(10);
    expect(workspace.versions.some((version) => version.id === workspace.publishedVersionId)).toBe(true);
    const experiment = workspace.versions.find((version) => version.channel === "experiment")!;
    expect(() => rollbackWorkflow(workspace, experiment.id)).toThrow("实验版本");
  });

  it("refuses publishing an untested changed draft", () => { const workspace = createInitialWorkflowWorkspace(); workspace.draft.updatedAt = new Date(Date.now() + 1000).toISOString(); expect(() => publishWorkflowDraft(workspace, null)).toThrow("重新通过"); });
});
