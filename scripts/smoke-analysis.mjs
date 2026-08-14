const model = process.argv[2];

if (!model) {
  throw new Error("Usage: npm run smoke:analysis -- <model-id>");
}

const jobDescription = [
  "负责 AI 产品需求分析与路线图规划",
  "基于用户研究定义产品需求",
  "推动算法与工程团队协作交付",
  "建立模型效果评估指标体系",
  "跟踪准确率与用户满意度",
  "设计企业客户解决方案",
  "负责产品上线与迭代复盘",
  "具备 3 年以上产品经验",
  "熟悉大模型应用场景",
  "能够使用 SQL 完成数据分析",
  "具备跨部门项目管理能力",
  "有企业服务产品经验优先",
  "具备良好沟通和文档能力",
].join("\n");

const body = {
  input: {
    targetRole: "AI 产品经理",
    industry: "企业服务",
    companyType: "中型公司",
    jobStage: "社招-中级",
    highlightSkills: "",
    jobDescription,
    originalResume:
      "候选人有三年产品工作经验，负责需求调研、原型设计和跨团队项目推进。曾使用 SQL 分析用户反馈，并参与 AI 功能上线复盘。",
    additionalInfo: "",
  },
  jobTargetContext: {
    companyName: "",
    notes: "",
    companySnapshotId: null,
  },
  careerClaims: [],
  optimizeStyle: "ai-product",
};

const startedAt = Date.now();
const response = await fetch("http://127.0.0.1:3000/api/analyze/stream", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Workflow-Model": model,
  },
  body: JSON.stringify(body),
});
const raw = await response.text();

if (!response.ok) {
  throw new Error(
    `Local analysis API returned ${response.status}: ${raw.slice(0, 300)}`,
  );
}

const events = raw
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const terminal = events.at(-1);
const summary = {
  model,
  wallMs: Date.now() - startedAt,
  terminal: terminal?.type,
  serverElapsedMs: terminal?.elapsedMs,
  stages: events.filter((event) => event.type === "stage-completed").length,
  heartbeats: events.filter((event) => event.type === "heartbeat").length,
  error: terminal?.error,
};

console.log(JSON.stringify(summary));
if (terminal?.type !== "completed") process.exitCode = 1;
