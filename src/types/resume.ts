import type { ReactNode } from "react";
import type { JDAnalysisDocument, JobReadinessAssessment } from "@/types/jd-analysis";

export type StepId =
  | "input"
  | "evidence"
  | "jd-analysis"
  | "diagnosis"
  | "match"
  | "follow-up"
  | "optimize"
  | "interview-recording"
  | "final-resume"
  | "interview"
  | "applications"
  | "export";

export type StepStatus = "pending" | "active" | "completed" | "disabled";

export type EvidenceStrength = "strong" | "medium" | "weak" | "none";

export type JobStage = "校招" | "社招-初级" | "社招-中级" | "社招-高级" | "转行";

export type CompanyType = "大厂" | "中型公司" | "创业公司" | "外企" | "国企";

export interface UserInput {
  targetRole: string;
  industry: string;
  companyType: CompanyType;
  jobStage: JobStage;
  highlightSkills: string;
  jobDescription: string;
  originalResume: string;
  additionalInfo: string;
}

export interface JobTargetContext {
  companyName: string;
  notes: string;
  companySnapshotId: null;
}

export type JDSourceClassification = "requirement" | "background" | "benefit" | "irrelevant";
export type JobRequirementCategory = "responsibility" | "experience" | "skill" | "education" | "industry" | "collaboration" | "result" | "other";
export type RequirementPriority = "must" | "preferred" | "context";
export type InferenceLevel = "explicit" | "inferred" | "unknown";

export interface JDSourceItem {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
  classification: JDSourceClassification;
}

export interface JobRequirement {
  id: string;
  sourceItemId: string;
  sourceQuote: string;
  requirement: string;
  category: JobRequirementCategory;
  priority: RequirementPriority;
  keywords: string[];
  interviewFocus: string;
  anchorStatus: "validated" | "needs-review";
}

export interface JobRoleInferenceItem {
  topic: "work-content" | "work-focus" | "business-line" | "team-state" | "business-scenario" | "team-pain" | "implicit-expectation" | "reporting-line" | "industry-experience";
  level: InferenceLevel;
  conclusion: string;
  evidence: string[];
  confidence: "high" | "medium" | "low";
  verificationQuestion: string;
}

export interface JobRoleInference {
  items: JobRoleInferenceItem[];
}

export interface JDClarificationNeed {
  id: string;
  topic: string;
  missingInformation: string;
  impact: string;
  suggestedInput: string;
  verificationQuestion: string;
}

export interface CoreCompetency {
  name: string;
  importance: "high" | "medium" | "low";
  description: string;
}

export interface JDAnalysis {
  responsibilities: string[];
  hardRequirements: string[];
  implicitRequirements: string[];
  keywords: string[];
  idealCandidate: string;
  coreCompetencies: CoreCompetency[];
  sourceItems?: JDSourceItem[];
  requirements?: JobRequirement[];
  roleInference?: JobRoleInference;
  clarificationNeeds?: JDClarificationNeed[];
}

export interface DimensionScore {
  dimension: string;
  score: number;
  comment: string;
}

export interface ResumeDiagnosis {
  overallScore: number;
  dimensionScores: DimensionScore[];
  mainIssues: string[];
  prioritySuggestions: string[];
}

export interface MatchItem {
  requirementId?: string;
  jdRequirement: string;
  evidenceClaimIds?: string[];
  resumeQuotes?: string[];
  resumeEvidence: string;
  matchRationale?: string;
  evidenceStrength: EvidenceStrength;
  missingEvidenceTypes?: string[];
  needsSupplement: boolean;
  optimizationSuggestion: string;
}

export interface FollowUpQuestion {
  id: string;
  question: string;
  purpose: string;
  requirementId?: string;
  thinkingPrompts?: string[];
  answerFramework?: string[];
  honestNoExperience?: string;
  placeholderExample?: string;
  userAnswer: string;
  generatedBullet: string;
}

export type OptimizeStyle =
  | "concise"
  | "reduce-exaggeration"
  | "ai-product"
  | "tob-saas"
  | "custom";

export type PdfExportMode = "ats-text" | "visual";

export type KeywordEnhancementEvidenceStatus =
  | "supported"
  | "partial"
  | "missing";

export type KeywordEnhancementAdoptionStatus =
  | "draft"
  | "unverified"
  | "user-confirmed"
  | "evidence-confirmed"
  | "rejected";

export interface KeywordEnhancementDraft {
  id: string;
  itemId: string;
  selectedKeywords: string[];
  enhancedText: string;
  sourceAfter: string;
  evidenceStatus: KeywordEnhancementEvidenceStatus;
  evidenceClaimIds: string[];
  evidenceCorrectionSourceIds: string[];
  foundEvidence: string[];
  missingEvidence: string[];
  riskWarnings: string[];
  adoptionStatus: KeywordEnhancementAdoptionStatus;
  generatedAt: string;
  verifiedAt: string | null;
}

export interface PdfGenerationProgress {
  mode: PdfExportMode;
  stage: "loading-font" | "paginating" | "rendering" | "downloading" | "completed";
  page: number;
  pageCount: number;
}

export interface OptimizedItem {
  id: string;
  section: string;
  before: string;
  after: string;
  reason: string;
  riskWarning: string;
  keywordEnhancement?: KeywordEnhancementDraft | null;
}

export interface WorkExperience {
  company: string;
  role: string;
  period: string;
  bullets: ResumeBulletValue[];
}

export interface ProjectExperience {
  name: string;
  role: string;
  period: string;
  bullets: ResumeBulletValue[];
}

export type ResumeBulletSource = "imported" | "ai-generated" | "manual";

export type ResumeEvidenceLinkStatus = "candidate" | "confirmed" | "needs-review";
export type ResumeEvidenceLinkMethod = "suggested" | "manual";

export interface EvidenceSourceReference {
  kind: "resume-import" | "manual" | "follow-up" | "flowise";
  referenceId: string;
  runId: string | null;
  fingerprint: string;
}

export interface ResumeEvidenceLink {
  evidenceId: string;
  status: ResumeEvidenceLinkStatus;
  method: ResumeEvidenceLinkMethod;
  sourceReference: EvidenceSourceReference | null;
}

export interface ResumeBullet {
  id: string;
  text: string;
  sourceType: ResumeBulletSource;
  /** @deprecated Kept for V1.7.2 backup compatibility. Use evidenceLinks. */
  evidenceIds: string[];
  evidenceLinks: ResumeEvidenceLink[];
  originalText: string;
  aiText: string;
  manualText: string;
}

/** String values are accepted only while migrating V1/V2 persisted and AI data. */
export type ResumeBulletValue = string | ResumeBullet;

export interface CareerEvidence {
  id: string;
  type: "work" | "project" | "achievement" | "skill";
  title: string;
  organization: string;
  role: string;
  period: string;
  description: string;
  metrics: string[];
  skills: string[];
  status: "candidate" | "confirmed";
  sourceType: "resume-import" | "manual" | "follow-up" | "flowise";
  sourceDocumentId: string | null;
  sourceReference: EvidenceSourceReference | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinalResume {
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    location: string;
  };
  jobIntent: string;
  summary: string;
  coreSkills: string[];
  workExperience: WorkExperience[];
  projectExperience: ProjectExperience[];
  skillsAndTools: string[];
  education: {
    school: string;
    degree: string;
    period: string;
  };
  educationHistory?: ImportedEducation[];
  certifications?: ImportedResumeItem[];
  languages?: ImportedResumeItem[];
  awards?: ImportedResumeItem[];
  links?: ImportedResumeItem[];
  otherSections?: ImportedResumeItem[];
}

export type ImportedResumeItemStatus = "candidate" | "confirmed" | "needs-review";
export type ImportedResumeConfidence = "high" | "medium" | "low";

export interface ImportedResumeItem {
  id: string;
  text: string;
  sourceQuote: string;
  status: ImportedResumeItemStatus;
  confidence: ImportedResumeConfidence;
}

export interface ImportedExperience {
  id: string;
  organization: string;
  name: string;
  role: string;
  period: string;
  summary: string;
  bullets: ImportedResumeItem[];
  sourceQuote: string;
  status: ImportedResumeItemStatus;
  confidence: ImportedResumeConfidence;
}

export interface ImportedEducation {
  id: string;
  school: string;
  degree: string;
  period: string;
  details: ImportedResumeItem[];
  sourceQuote: string;
  status: ImportedResumeItemStatus;
  confidence: ImportedResumeConfidence;
}

export interface ImportedResumeProfile {
  schemaVersion: 1;
  personalInfo: FinalResume["personalInfo"];
  jobIntent: string;
  summary: string;
  workExperience: ImportedExperience[];
  internshipExperience: ImportedExperience[];
  projectExperience: ImportedExperience[];
  educationHistory: ImportedEducation[];
  skillsAndTools: ImportedResumeItem[];
  certifications: ImportedResumeItem[];
  languages: ImportedResumeItem[];
  awards: ImportedResumeItem[];
  links: ImportedResumeItem[];
  otherSections: ImportedResumeItem[];
  unmappedSegments: ImportedResumeItem[];
}

export interface ResumeImportMetadata {
  sourceType: "text" | "pdf" | "docx";
  fileName: string;
  importedAt: string;
  warnings: string[];
}

export type ResumeTemplateId = "ats-classic" | "modern-clean" | "compact-professional";
export type ResumeSectionId =
  | "jobIntent"
  | "summary"
  | "coreSkills"
  | "workExperience"
  | "projectExperience"
  | "skillsAndTools"
  | "education"
  | "certifications"
  | "languages"
  | "awards"
  | "links"
  | "otherSections";

export interface ResumeLayoutConfig {
  templateId: ResumeTemplateId;
  fontFamily: "microsoft-yahei" | "songti" | "arial" | "calibri";
  baseFontSize: number;
  lineHeight: number;
  sectionSpacing: number;
  pageMargin: number;
  accentColor: string;
  bulletStyle: "disc" | "dash" | "square";
  sectionOrder: ResumeSectionId[];
  hiddenSections: ResumeSectionId[];
}

export type ResumePaginationStatus = "measuring" | "ready" | "error";

export interface ResumePaginationPage {
  index: number;
  includeHeader: boolean;
  blockIds: string[];
  usedHeight: number;
  availableHeight: number;
}

export interface ResumePaginationPlan {
  contentHash: string;
  pageCount: number;
  pages: ResumePaginationPage[];
  overflow: boolean;
  compatibilityRatio: number;
  measuredAt: string;
}

export interface ResumeFitResult {
  status: "idle" | "running" | "fitted" | "cannot-fit";
  layoutConfig: ResumeLayoutConfig;
  pageCount: number;
  changedFields: Array<keyof Pick<ResumeLayoutConfig, "sectionSpacing" | "pageMargin" | "lineHeight" | "baseFontSize">>;
  message: string;
}

export interface InterviewQuestion {
  requirementId?: string;
  question: string;
  suggestedAnswer: string;
  evidenceNeeded: string[];
}

export interface RequirementInterviewStrategy {
  requirementId: string;
  validationApproaches: string[];
  demonstrationPoints: string[];
  answerStructure: string[];
  evidenceNeeded: string[];
  metricsNeeded: string[];
  exaggerationRisks: string[];
}

export interface ReverseInterviewQuestion {
  id: string;
  requirementId: string | null;
  clarificationNeedId: string | null;
  topic: "role-boundary" | "business-goal" | "team-state" | "success-metric" | "collaboration" | "reporting-line";
  question: string;
  purpose: string;
}

export interface InterviewPrep {
  likelyQuestions: InterviewQuestion[];
  evidenceToPrepare: string[];
  possibleExaggerations: string[];
  dataToSupplement: string[];
  selfIntroduction: string;
  requirementStrategies?: RequirementInterviewStrategy[];
  reverseQuestions?: ReverseInterviewQuestion[];
}

export interface AnalysisResult {
  jdAnalysis: JDAnalysis;
  diagnosis: ResumeDiagnosis;
  matchItems: MatchItem[];
  followUpQuestions: FollowUpQuestion[];
  optimizedItems: OptimizedItem[];
  finalResume: FinalResume;
  interviewPrep: InterviewPrep;
  jobReadiness?: JobReadinessAssessment;
}

export interface StepConfig {
  id: StepId;
  label: string;
  icon?: ReactNode;
}
export type FinalResumeStatus = "draft" | "confirmed" | "stale";

export interface ResumeDocument {
  schemaVersion: 9 | 10 | 11 | 12;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  userInput: UserInput;
  jobTargetContext: JobTargetContext;
  currentStep: StepId;
  analysisResult: AnalysisResult | null;
  materialRevision: number;
  analysisRevision: number | null;
  jdAnalysisDocument: JDAnalysisDocument | null;
  analysisBasis: { materialRevision: number; jdAnalysisRevision: number } | null;
  sourceResume: FinalResume | null;
  importedResume?: ImportedResumeProfile | null;
  importMetadata: ResumeImportMetadata | null;
  layoutConfig: ResumeLayoutConfig;
  optimizeStyle: OptimizeStyle;
  customOptimizeInstruction?: string;
  finalResumeStatus: FinalResumeStatus;
  hasManualEdits: boolean;
}

export type JobApplicationStatus = "准备中" | "已投递" | "笔试" | "面试" | "Offer" | "结束";

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  jdUrl: string;
  jdText: string;
  status: JobApplicationStatus;
  appliedAt: string;
  nextStepAt: string;
  notes: string;
  resumeDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeLibraryState {
  schemaVersion: 10 | 11 | 12 | 13 | 14;
  documents: ResumeDocument[];
  archives: ResumeArchive[];
  activeDocumentId: string;
  careerEvidence: CareerEvidence[];
  jobApplications: JobApplication[];
  interviewReviews: import("@/types/interview").InterviewReviewRecord[];
}

/** A frozen deliverable, not a live analysis or a new source of trusted facts. */
export interface ResumeArchive {
  id: string;
  title: string;
  notes: string;
  archivedAt: string;
  sourceDocumentId: string | null;
  sourceFingerprint: string;
  contentFingerprint: string;
  targetRole: string;
  companyName: string;
  finalResume: FinalResume;
  layoutConfig: ResumeLayoutConfig;
}

export interface ATSAssessment {
  overallScore: number;
  keywordScore: number;
  evidenceScore: number;
  measurableScore: number;
  completenessScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  weakEvidence: string[];
  suggestions: string[];
}
