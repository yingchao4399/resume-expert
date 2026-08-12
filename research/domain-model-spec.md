# 职业资产领域模型建议

## 1. 模型边界

现有 `ResumeDocument` 继续表示某个岗位的一份工作文档和交付快照。项目、能力、原子事实、数字证据、面试回答和公司研究不再继续嵌套进该对象，而是进入独立领域库。

所有对象统一包含：

```ts
interface BaseEntity {
  id: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  revision: number;
}
```

任何下游产物保存依赖对象的 `id + revision`。依赖 revision 变化时，下游产物进入 `stale`，等待用户重新确认。

## 2. 项目与经历

```ts
interface CareerProject extends BaseEntity {
  kind: "work-project" | "personal-project" | "demo" | "school-project" | "volunteer";
  title: string;
  organization: string;
  period: { start: string | null; end: string | null; ongoing: boolean };
  status: "draft" | "in-review" | "confirmed";
  summary: string;
  context: string;
  problem: string;
  goal: string;
  role: string;
  roleBoundary: string;
  stakeholders: string[];
  constraints: string[];
  decisions: string[];
  actions: string[];
  outputs: string[];
  tradeoffs: string[];
  failuresAndLearning: string[];
  claimIds: string[];
  capabilityLinkIds: string[];
  artifactIds: string[];
}

interface CareerExperience extends BaseEntity {
  organization: string;
  role: string;
  employmentType: "full-time" | "part-time" | "internship" | "contract" | "freelance" | "other";
  period: { start: string | null; end: string | null; ongoing: boolean };
  responsibilities: string[];
  projectIds: string[];
  claimIds: string[];
  status: "draft" | "in-review" | "confirmed";
}
```

工作经历是组织与角色容器，项目是可以被岗位匹配、面试和作品集复用的主对象。一个项目可以属于某段工作经历，也可以独立存在。

## 3. 原子事实与来源

```ts
interface EvidenceClaim extends BaseEntity {
  subjectType: "project" | "experience" | "person" | "education" | "company";
  subjectId: string;
  claimType: "role" | "action" | "result" | "scope" | "decision" | "skill-use" | "other";
  statement: string;
  status: "candidate" | "confirmed" | "disputed" | "rejected";
  sourceIds: string[];
  metricIds: string[];
  confidence: number;
  confirmedBy: "user" | "import-rule" | null;
  confirmedAt: string | null;
  supersedesId: string | null;
}

interface EvidenceSource extends BaseEntity {
  sourceType: "user-statement" | "resume" | "attachment" | "link" | "system-record" | "public-source";
  title: string;
  uri: string | null;
  excerpt: string;
  capturedAt: string;
  validUntil: string | null;
  reliability: "primary" | "secondary" | "subjective" | "unknown";
  contentHash: string | null;
}
```

用户确认可以提高事实状态，但不把匿名网络材料提升为一手来源。公开公司信息需要独立的时效字段。

## 4. 数字证据

```ts
interface MetricEvidence extends BaseEntity {
  claimId: string;
  label: string;
  value: number | null;
  unit: string;
  baselineValue: number | null;
  targetValue: number | null;
  formula: string;
  sampleDescription: string;
  timeWindow: string;
  sourceIds: string[];
  contributionBoundary: string;
  status: "candidate" | "confirmed" | "estimated" | "rejected";
  realismRisk: "low" | "medium" | "high";
  riskNotes: string[];
}
```

“估算”不是禁止状态，但简历话术必须明确口径，不能把估算包装为精确测量。日期、版本号和序号不能被量化成果识别器计分。

## 5. 能力、标签与熟练度

```ts
interface Capability extends BaseEntity {
  canonicalName: string;
  aliases: string[];
  categoryId: string;
  description: string;
  externalMappings: Array<{ system: "ESCO" | "ONET" | "custom"; id: string }>;
}

interface TagTaxonomy extends BaseEntity {
  name: string;
  parentId: string | null;
  kind: "canonical" | "user" | "job";
  aliases: string[];
}

interface ProjectCapabilityLink extends BaseEntity {
  projectId: string;
  capabilityId: string;
  claimIds: string[];
  selfProficiency: 0 | 1 | 2 | 3 | 4;
  evidenceProficiency: 0 | 1 | 2 | 3 | 4 | null;
  evidenceReason: string;
  context: string;
  lastUsedAt: string | null;
  status: "candidate" | "confirmed" | "needs-review";
}
```

标签解决检索与分类；Capability 解决可复用能力概念；ProjectCapabilityLink 解决“在哪个情境、凭什么达到某级”的关系。三者不能合并成一个字符串数组。

## 6. 岗位与逐条要求

```ts
interface JobTarget extends BaseEntity {
  title: string;
  companyName: string;
  teamName: string;
  industry: string;
  companyType: string;
  companyTypeCustom: string;
  companyScale: string;
  companyStage: string;
  location: string;
  jdText: string;
  requirementIds: string[];
  companySnapshotId: string | null;
  userPreferredCapabilityIds: string[];
  systemRecommendedCapabilityIds: string[];
}

interface JDRequirement extends BaseEntity {
  jobTargetId: string;
  sourceQuote: string;
  sourceStart: number | null;
  sourceEnd: number | null;
  category: "responsibility" | "must" | "preferred" | "context" | "benefit";
  priority: "critical" | "high" | "medium" | "low";
  normalizedRequirement: string;
  capabilityIds: string[];
  expectedBehavior: string;
  expectedOutput: string;
  businessScenario: string;
  industryExperience: string;
  interviewValidation: string[];
  reverseQuestions: string[];
  inferenceIds: string[];
}

interface RequirementInference extends BaseEntity {
  requirementId: string;
  type: "hidden-expectation" | "team-pain" | "work-focus" | "reporting-line" | "business-line";
  conclusion: string;
  basis: string[];
  confidence: number;
  alternatives: string[];
}
```

推断对象必须与 JD 原文要求分离，避免用户把“可能”当成招聘方明确承诺。

## 7. 匹配、提问与话术

```ts
interface RequirementEvidenceMatch extends BaseEntity {
  requirementId: string;
  projectId: string | null;
  claimIds: string[];
  matchScore: number;
  evidenceStrength: "strong" | "medium" | "weak" | "none";
  scoreBreakdown: Record<string, number>;
  explanation: string;
  missingEvidence: string[];
  userDecision: "pending" | "accepted" | "rejected";
}

interface QuestionSession extends BaseEntity {
  jobTargetId: string | null;
  projectId: string | null;
  purpose: "project-structure" | "requirement-gap" | "metric-proof" | "interview-practice";
  status: "active" | "completed" | "paused";
  questionIds: string[];
  stopReason: string | null;
}

interface NarrativeAsset extends BaseEntity {
  kind: "resume-bullet" | "one-line-project" | "star-story" | "deep-dive" | "portfolio-section";
  content: string;
  projectIds: string[];
  requirementIds: string[];
  claimRevisions: Array<{ id: string; revision: number }>;
  generationMode: "manual" | "ai-assisted";
  status: "draft" | "confirmed" | "stale";
  supersedesId: string | null;
}
```

## 8. 公司公开情报

```ts
interface CompanyResearchSnapshot extends BaseEntity {
  companyName: string;
  legalEntityName: string;
  capturedAt: string;
  validUntil: string;
  sourceIds: string[];
  factIds: string[];
  signalIds: string[];
  subjectiveSampleIds: string[];
  conflicts: string[];
  coverage: Record<string, "covered" | "partial" | "unknown">;
}
```

工商、融资、司法、知识产权、招聘、薪酬、新闻和公开内容应按不同来源类别展示。自然人私人背景、人格、喜好和内部关系不建模为可推断事实。

## 9. 依赖和失效规则

必须实现以下确定性规则：

1. EvidenceClaim 修改/删除：所有引用它的 Metric、CapabilityLink、Match、NarrativeAsset 和 ResumeDocument 进入 `needs-review` 或 `stale`。
2. JDRequirement 修改：所有 Match、定向问题、岗位话术和岗位简历过期。
3. 用户人工修改 NarrativeAsset：重新校验实体、数字、时间和 claim 引用。
4. 合并备份：生成完整旧 ID→新 ID 映射，并重写所有外键后再提交事务。
5. 删除对象：先展示反向依赖；默认软删除，确认后解除或迁移引用。
6. AI/Flowise 输出：只能创建 candidate，重复运行通过来源运行 ID 和内容哈希幂等。

## 10. IndexedDB 表建议

```text
projects
experiences
claims
sources
metrics
capabilities
tags
projectCapabilityLinks
jobTargets
requirements
requirementInferences
matches
questionSessions
questions
answerRevisions
narrativeAssets
companySnapshots
researchSources
riskFindings
artifacts
dependencyIndex
```

业务库与 Studio Trace/Workflow 库继续分开，避免清理运行追踪时影响个人职业资产。
