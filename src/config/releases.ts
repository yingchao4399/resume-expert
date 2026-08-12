export const RELEASE_RECORDS = [
  { version: "1.7.2", goal: "受约束的可视化工作流调整", modules: ["React Flow 编辑器", "结构护栏", "测试发布", "版本比较与回滚"], tests: "63 Vitest / 21 Playwright / local success", status: "developing" },
  { version: "1.7.1", goal: "Flowise 本机实验服务与项目证据草稿", modules: ["安全状态", "新手项目梳理", "DirectLLM 对比", "证据确认门禁"], tests: "54 Vitest / 20 Playwright / CI success", commit: "302ee57", status: "released" },
  { version: "1.7.0", goal: "透明化开发者工作台与本地运行追踪", modules: ["工作流地图", "运行追踪", "测评中心", "开发记录"], tests: "49 Vitest / 19 Playwright / CI success", commit: "2503bae", status: "released" },
  { version: "1.6.2", goal: "建立 AI 质量测评基线", modules: ["24 个合成案例", "确定性评分器", "CI Mock 回归"], tests: "48 Vitest / 18 Playwright / CI success", commit: "cbc431d", status: "released" },
  { version: "1.6.1", goal: "运行环境与结构维护", modules: ["Node 24", "CI", "Store 拆分"], tests: "46 Vitest / 18 Playwright", commit: "57697d8", status: "released" },
] as const;
