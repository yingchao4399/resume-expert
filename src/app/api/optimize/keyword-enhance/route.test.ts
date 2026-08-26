import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/optimize/keyword-enhance/route";
import { EXAMPLE_USER_INPUT } from "@/store/resume-store-example";

function request(keyword = "TypeScript") {
  return new Request("http://localhost/api/optimize/keyword-enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Workflow-Provider": "mock" },
    body: JSON.stringify({
      input: EXAMPLE_USER_INPUT,
      allowedKeywords: ["TypeScript"],
      items: [{ itemId: "opt-1", section: "技能", currentText: "负责产品需求分析", selectedKeywords: [keyword], evidence: [{ id: "claim-1", text: "在项目中使用 TypeScript 开发原型" }] }],
      customInstruction: "语气稳健",
    }),
  });
}

describe("keyword enhancement route", () => {
  it("一次请求返回待核验候选稿且保留合法事实引用", async () => {
    const response = await POST(request());
    const data = await response.json() as { enhancements: Array<{ itemId: string; adoptionStatus: string; evidenceStatus: string; evidenceClaimIds: string[]; foundEvidence: string[] }> };
    expect(response.status).toBe(200);
    expect(data.enhancements).toHaveLength(1);
    expect(data.enhancements[0]).toMatchObject({ itemId: "opt-1", adoptionStatus: "unverified", evidenceStatus: "supported", evidenceClaimIds: ["claim-1"] });
    expect(data.enhancements[0].foundEvidence).toEqual(["在项目中使用 TypeScript 开发原型"]);
  });

  it("拒绝当前已确认 JD 中不存在的关键词", async () => {
    const response = await POST(request("模型虚构关键词"));
    expect(response.status).toBe(400);
    expect((await response.json() as { error: string }).error).toContain("不在当前已确认 JD");
  });
});
