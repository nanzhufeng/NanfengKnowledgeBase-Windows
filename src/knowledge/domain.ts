import { z } from "zod";

export const sourceKindSchema = z.enum([
  "ai_conversation",
  "web",
  "json",
  "markdown",
  "text",
  "html",
  "pdf",
  "audio",
  "video",
  "subtitle",
  "transcript",
  "image",
  "manual",
  "file",
]);
export type SourceKind = z.infer<typeof sourceKindSchema>;

export const topicStatusSchema = z.enum(["active", "watching", "paused", "archived"]);
export type TopicStatus = z.infer<typeof topicStatusSchema>;

export const classificationActionSchema = z.enum([
  "auto_eligible",
  "confirm",
  "candidates",
  "manual",
]);
export type ClassificationAction = z.infer<typeof classificationActionSchema>;

export const classificationSignalKeySchema = z.enum([
  "explicit_rules",
  "aliases_entities",
  "full_text",
  "set_similarity",
  "history",
]);
export type ClassificationSignalKey = z.infer<typeof classificationSignalKeySchema>;

export const classificationSignalWeights = {
  explicit_rules: 35,
  aliases_entities: 25,
  full_text: 20,
  set_similarity: 10,
  history: 10,
} as const satisfies Record<ClassificationSignalKey, number>;

export const classificationThresholds = {
  // 南烛枫于 2026-07-29 确认：最高候选严格超过 65 分即可自动归类。
  autoEligibleExclusive: 65,
  candidates: 45,
} as const;

export type KnowledgeTopicCandidate = {
  id: string;
  primaryDomainId: string;
  path: string[];
  name: string;
  aliases: string[];
  entities: string[];
  keywords: string[];
  searchDocument: string;
  status: TopicStatus;
  updatedAt: string;
};

export type KnowledgeSourceDraft = {
  id: string;
  title: string;
  text: string;
  kind: SourceKind;
  platform?: string;
  fileName?: string;
  filePath?: string;
  folderPath?: string;
  tags?: string[];
  jsonFields?: Record<string, string>;
  importedAt: string;
  batchId?: string;
};

export type ClassificationRuleField =
  | "title"
  | "text"
  | "platform"
  | "source_kind"
  | "file_name"
  | "file_path"
  | "folder_path"
  | "tag"
  | "json_field";

export type ClassificationRule = {
  id: string;
  topicId: string;
  field: ClassificationRuleField;
  operator: "contains" | "equals";
  effect?: "include" | "exclude";
  value: string;
  jsonField?: string;
  strength: number;
  reason: string;
  enabled: boolean;
};

export type ClassificationHistory = {
  confirmedTopicCounts: Record<string, number>;
  recentTopicIds: string[];
  batchTopicIds: Record<string, string[]>;
};

export type ExternalSearchSignal = {
  topicId: string;
  normalizedScore: number;
  reason?: string;
};

export type ClassificationContext = {
  source: KnowledgeSourceDraft;
  topics: KnowledgeTopicCandidate[];
  rules: ClassificationRule[];
  history: ClassificationHistory;
  searchSignals?: ExternalSearchSignal[];
};

export type ClassificationSignalScore = {
  key: ClassificationSignalKey;
  label: string;
  normalizedScore: number;
  weight: number;
  contributedPoints: number;
  reasons: string[];
};

export type ClassificationSuggestion = {
  topicId: string;
  topicPath: string[];
  confidence: number;
  action: ClassificationAction;
  signalScores: ClassificationSignalScore[];
  reasons: string[];
};

export type ClassificationResult = {
  algorithmVersion: string;
  sourceId: string;
  generatedAt: string;
  suggestions: ClassificationSuggestion[];
};

export const domainSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  iconKey: z.string(),
  sortOrder: z.number().int(),
  aliases: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Domain = z.infer<typeof domainSchema>;

export const topicSchema = z.object({
  id: z.string().min(1),
  primaryDomainId: z.string().min(1),
  parentTopicId: z.string().nullable(),
  name: z.string().min(1),
  aliases: z.array(z.string()),
  summary: z.string(),
  status: topicStatusSchema,
  isTracking: z.boolean(),
  importance: z.number().int().min(0).max(5),
  currentJudgment: z.string(),
  reviewAt: z.string().nullable(),
  topicType: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Topic = z.infer<typeof topicSchema>;

export const sourceItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  platform: z.string(),
  kind: sourceKindSchema,
  originalFilePath: z.string().nullable(),
  originalText: z.string(),
  originalJson: z.string().nullable(),
  sha256: z.string(),
  originalUrl: z.string().nullable(),
  author: z.string().nullable(),
  publishedAt: z.string().nullable(),
  importedAt: z.string(),
  readState: z.enum(["unread", "read"]),
  organizationState: z.enum(["inbox", "organized"]),
  duplicateState: z.enum(["unknown", "unique", "duplicate"]),
  freshnessState: z.enum(["current", "possibly_outdated", "outdated"]),
});
export type SourceItem = z.infer<typeof sourceItemSchema>;

export const noteSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
  summary: z.string(),
  noteType: z.enum([
    "normal",
    "research",
    "conclusion",
    "review",
    "decision",
    "project",
    "summary",
  ]),
  primaryTopicId: z.string().min(1),
  relatedTopicIds: z.array(z.string()),
  sourceItemIds: z.array(z.string()),
  status: z.enum(["draft", "active", "archived"]),
  organizationState: z.enum(["inbox", "organized"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Note = z.infer<typeof noteSchema>;

export const propositionSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  content: z.string().min(1),
  state: z.enum([
    "pending",
    "tentative",
    "current",
    "doubtful",
    "partially_refuted",
    "refuted",
    "expired",
  ]),
  confidence: z.number().min(0).max(100),
  firstRaisedAt: z.string(),
  updatedAt: z.string(),
  invalidationCondition: z.string(),
  supportingEvidenceIds: z.array(z.string()),
  opposingEvidenceIds: z.array(z.string()),
});
export type Proposition = z.infer<typeof propositionSchema>;

export const judgmentSnapshotSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  propositionId: z.string().nullable(),
  content: z.string().min(1),
  judgedAt: z.string(),
  state: z.enum(["pending", "tentative", "current", "doubtful", "partially_refuted", "refuted", "expired"]),
  confidence: z.number().min(0).max(100),
  changeReason: z.string(),
  previousDiff: z.string(),
  unresolvedQuestions: z.array(z.string()),
});
export type JudgmentSnapshot = z.infer<typeof judgmentSnapshotSchema>;

export const evidenceSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  sourceItemId: z.string().min(1),
  stance: z.enum(["support", "oppose", "context"]),
  content: z.string().min(1),
  anchor: z.object({
    page: z.number().int().positive().nullable(),
    timecode: z.string().nullable(),
    messageId: z.string().nullable(),
    textQuote: z.string().nullable(),
  }),
  credibility: z.number().min(0).max(100),
  verificationState: z.enum(["unverified", "verified", "disputed"]),
  validityState: z.enum(["active", "possibly_outdated", "expired"]),
  evidenceDate: z.string().nullable(),
  notes: z.string(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const openQuestionSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  content: z.string().min(1),
  importance: z.number().int().min(0).max(5),
  affectsCurrentJudgment: z.boolean(),
  status: z.enum(["open", "investigating", "resolved", "dismissed"]),
  createdAt: z.string(),
  resolution: z.string(),
  resolvedAt: z.string().nullable(),
});
export type OpenQuestion = z.infer<typeof openQuestionSchema>;

export const turningPointSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  title: z.string().min(1),
  occurredAt: z.string(),
  beforeJudgmentSnapshotId: z.string().nullable(),
  afterJudgmentSnapshotId: z.string().min(1),
  changeReason: z.string(),
  evidenceIds: z.array(z.string()),
  impact: z.number().int().min(0).max(5),
});
export type TurningPoint = z.infer<typeof turningPointSchema>;

export const decisionSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  judgmentSnapshotId: z.string().min(1),
  content: z.string().min(1),
  decidedAt: z.string(),
  knownRisks: z.array(z.string()),
  expectedResult: z.string(),
  actualActions: z.array(z.string()),
  reviewAt: z.string().nullable(),
  finalResult: z.string(),
  retrospective: z.string(),
});
export type Decision = z.infer<typeof decisionSchema>;

export const topicRelationSchema = z.object({
  id: z.string().min(1),
  sourceTopicId: z.string().min(1),
  targetTopicId: z.string().min(1),
  relationType: z.enum([
    "same_topic",
    "upstream_downstream",
    "causal",
    "comparison",
    "supports",
    "opposes",
    "prerequisite",
    "follow_up",
    "same_company",
    "same_product",
    "same_event",
    "related",
  ]),
  confidence: z.number().min(0).max(100),
  createdBy: z.enum(["user", "rule", "classifier"]),
  createdAt: z.string(),
});
export type TopicRelation = z.infer<typeof topicRelationSchema>;

export const operationLogSchema = z.object({
  id: z.string().min(1),
  operationType: z.enum([
    "classification",
    "relation",
    "merge",
    "split",
    "move",
    "restore",
    "delete",
  ]),
  actor: z.enum(["user", "rule", "classifier", "migration"]),
  targetType: z.string().min(1),
  targetIds: z.array(z.string()).min(1),
  algorithmVersion: z.string().nullable(),
  beforeSnapshotJson: z.string(),
  afterSnapshotJson: z.string(),
  reasonJson: z.string(),
  undoState: z.enum(["available", "undone", "expired", "not_supported"]),
  createdAt: z.string(),
  undoneAt: z.string().nullable(),
});
export type OperationLog = z.infer<typeof operationLogSchema>;

export function decideClassificationAction(confidence: number): ClassificationAction {
  if (confidence > classificationThresholds.autoEligibleExclusive) return "auto_eligible";
  if (confidence >= classificationThresholds.candidates) return "candidates";
  return "manual";
}
