import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import {
  sourceKindSchema,
  topicStatusSchema,
  type ClassificationContext,
} from "../knowledge/domain";

const inboxItemSchema = z.object({
  id: z.number().int(),
  publicId: z.string(),
  legacyRecordId: z.number().int().nullable(),
  sourceType: z.string(),
  title: z.string(),
  platform: z.string(),
  originalAt: z.string().nullable(),
  importedAt: z.string(),
  readState: z.string(),
  organizationState: z.string(),
  duplicateState: z.string(),
  freshnessState: z.string(),
  pendingSuggestionCount: z.number().int(),
});

const domainRowSchema = z.object({
  id: z.number().int(),
  publicId: z.string(),
  name: z.string(),
  description: z.string(),
  sortOrder: z.number().int(),
});

const topicRowSchema = z.object({
  id: z.number().int(),
  publicId: z.string(),
  domainId: z.number().int(),
  parentTopicId: z.number().int().nullable(),
  name: z.string(),
  description: z.string(),
  topicKind: z.string(),
  status: z.string(),
  depth: z.number().int(),
  sortOrder: z.number().int(),
  sourceCount: z.number().int(),
});

const suggestionRowSchema = z.object({
  id: z.number().int(),
  publicId: z.string(),
  sourceItemId: z.number().int(),
  suggestedTopicId: z.number().int().nullable(),
  score: z.number(),
  decision: z.string(),
  reasons: z.array(z.string()),
  signalScoresJson: z.string(),
  classifierVersion: z.string(),
  status: z.string(),
  createdAt: z.string(),
});

const nullableOptionalStringSchema = z.string().nullable().transform((value) => value ?? undefined);

const classificationContextSchema = z.object({
  source: z.object({
    id: z.string(),
    title: z.string(),
    text: z.string(),
    kind: sourceKindSchema,
    platform: nullableOptionalStringSchema,
    fileName: nullableOptionalStringSchema,
    filePath: nullableOptionalStringSchema,
    folderPath: nullableOptionalStringSchema,
    tags: z.array(z.string()),
    jsonFields: z.record(z.string(), z.string()),
    importedAt: z.string(),
    batchId: nullableOptionalStringSchema,
  }),
  topics: z.array(z.object({
    id: z.string(),
    primaryDomainId: z.string(),
    path: z.array(z.string()),
    name: z.string(),
    aliases: z.array(z.string()),
    entities: z.array(z.string()),
    keywords: z.array(z.string()),
    searchDocument: z.string(),
    status: topicStatusSchema,
    updatedAt: z.string(),
  })),
  rules: z.array(z.object({
    id: z.string(),
    topicId: z.string(),
    field: z.enum([
      "title",
      "text",
      "platform",
      "source_kind",
      "file_name",
      "file_path",
      "folder_path",
      "tag",
      "json_field",
    ]),
    operator: z.enum(["contains", "equals"]),
    effect: z.enum(["include", "exclude"]),
    value: z.string(),
    jsonField: nullableOptionalStringSchema,
    strength: z.number().min(0).max(1),
    reason: z.string(),
    enabled: z.boolean(),
  })),
  history: z.object({
    confirmedTopicCounts: z.record(z.string(), z.number().int().nonnegative()),
    recentTopicIds: z.array(z.string()),
    batchTopicIds: z.record(z.string(), z.array(z.string())),
  }),
  searchSignals: z.array(z.object({
    topicId: z.string(),
    normalizedScore: z.number().min(0).max(1),
    reason: z.string(),
  })),
});

const personalCatalogProposalSchema = z.object({
  version: z.string(),
  status: z.literal("proposal"),
  title: z.string(),
  note: z.string(),
  domains: z.array(z.object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
  })),
  topics: z.array(z.object({
    key: z.string(),
    domainKey: z.string(),
    parentKey: z.string().nullable(),
    name: z.string(),
    description: z.string(),
    topicKind: z.string(),
    aliases: z.array(z.string()),
    entities: z.array(z.string()),
    keywords: z.array(z.string()),
  })),
});

const personalCatalogApplyResultSchema = z.object({
  version: z.string(),
  createdDomains: z.number().int().nonnegative(),
  existingDomains: z.number().int().nonnegative(),
  createdTopics: z.number().int().nonnegative(),
  existingTopics: z.number().int().nonnegative(),
  createdAliases: z.number().int().nonnegative(),
  createdEntities: z.number().int().nonnegative(),
  createdRules: z.number().int().nonnegative(),
});

const topicAliasRowSchema = z.object({
  id: z.number().int(),
  topicId: z.number().int(),
  alias: z.string(),
  aliasType: z.enum(["name", "abbreviation", "redirect", "legacy_tag"]),
  createdAt: z.string(),
});

const entityDictionaryRowSchema = z.object({
  id: z.number().int(),
  canonicalName: z.string(),
  entityType: z.enum([
    "company",
    "person",
    "product",
    "model",
    "industry",
    "place",
    "project",
    "custom",
    "other",
  ]),
  aliases: z.array(z.string()),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const classificationRuleRowSchema = z.object({
  id: z.number().int(),
  publicId: z.string(),
  ruleType: z.enum([
    "keyword",
    "exact_alias",
    "negative_keyword",
    "file_path",
    "entity",
    "source",
    "legacy_tag",
    "stopword",
    "domain_hint",
  ]),
  pattern: z.string(),
  targetDomainId: z.number().int().nullable(),
  targetTopicId: z.number().int().nullable(),
  weight: z.number().min(0).max(1),
  priority: z.number().int(),
  enabled: z.boolean(),
  configJson: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const deleteResultSchema = z.object({
  id: z.number().int(),
  deleted: z.boolean(),
});

const operationResultSchema = z.object({
  operationId: z.number().int(),
  sourceItemId: z.number().int(),
  topicId: z.number().int().nullable(),
  organizationState: z.string(),
});

const topicMergePreviewSchema = z.object({
  sourceTopic: topicRowSchema,
  targetTopic: topicRowSchema,
  sourceLinksToMove: z.number().int(),
  duplicateSourceLinks: z.number().int(),
  judgmentsToMove: z.number().int(),
  evidenceToMove: z.number().int(),
  questionsToMove: z.number().int(),
  relationsToRewrite: z.number().int(),
  redirectAliases: z.array(z.string()),
  blockers: z.array(z.string()),
});

const topicMergeResultSchema = z.object({
  operationId: z.number().int(),
  sourceTopicId: z.number().int(),
  targetTopicId: z.number().int(),
  movedSourceCount: z.number().int(),
  sourceTopicStatus: z.string(),
});

const topicSplitPreviewSchema = z.object({
  topic: topicRowSchema,
  groups: z.array(z.object({
    key: z.string(),
    label: z.string(),
    sourceItemIds: z.array(z.number().int()),
    sourceTitles: z.array(z.string()),
  })),
  ungroupedSourceIds: z.array(z.number().int()),
  note: z.string(),
});

const topicRelationSuggestionSchema = z.object({
  fromTopicId: z.number().int(),
  fromTopicName: z.string(),
  toTopicId: z.number().int(),
  toTopicName: z.string(),
  relationType: z.string(),
  confidence: z.number(),
  reason: z.string(),
});

const topicRelationRowSchema = z.object({
  id: z.number().int(),
  fromTopicId: z.number().int(),
  toTopicId: z.number().int(),
  relationType: z.string(),
  confidence: z.number(),
  createdBy: z.string(),
  note: z.string(),
  createdAt: z.string(),
});

const topicSourceRowSchema = z.object({
  id: z.number().int(),
  publicId: z.string(),
  title: z.string(),
  sourceType: z.string(),
  originalAt: z.string().nullable(),
  confidence: z.number().nullable(),
});

const topicJudgmentRowSchema = z.object({
  id: z.number().int(),
  publicId: z.string(),
  statementMarkdown: z.string(),
  state: z.string(),
  confidence: z.number(),
  changeReason: z.string(),
  effectiveAt: z.string(),
  createdAt: z.string(),
});

const topicEvidenceRowSchema = z.object({
  id: z.number().int(),
  publicId: z.string(),
  sourceItemId: z.number().int(),
  sourceTitle: z.string(),
  contentMarkdown: z.string(),
  stance: z.string(),
  credibility: z.number(),
  verificationStatus: z.string(),
  validityStatus: z.string(),
  locatorJson: z.string(),
  locatorLabel: z.string(),
  createdAt: z.string(),
});

const topicQuestionRowSchema = z.object({
  id: z.number().int(),
  publicId: z.string(),
  question: z.string(),
  importance: z.string(),
  affectsCurrentJudgment: z.boolean(),
  status: z.string(),
  resolutionNote: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const knowledgeNoteRowSchema = z.object({
  id: z.number().int(),
  publicId: z.string(),
  title: z.string(),
  bodyMarkdown: z.string(),
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
  status: z.enum(["draft", "active", "archived"]),
  organizationState: z.enum(["inbox", "organized"]),
  primaryTopicId: z.number().int(),
  relatedTopicIds: z.array(z.number().int()),
  sourceItemIds: z.array(z.number().int()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const topicPropositionRowSchema = z.object({
  id: z.number().int(),
  publicId: z.string(),
  topicId: z.number().int(),
  statementMarkdown: z.string(),
  status: z.enum(["open", "supported", "rejected", "superseded"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const topicTurningPointRowSchema = z.object({
  id: z.number().int(),
  publicId: z.string(),
  topicId: z.number().int(),
  fromJudgmentId: z.number().int().nullable(),
  fromStatementMarkdown: z.string().nullable(),
  toJudgmentId: z.number().int(),
  toStatementMarkdown: z.string(),
  title: z.string(),
  explanation: z.string(),
  occurredAt: z.string(),
  createdAt: z.string(),
});

const topicDetailSchema = z.object({
  topic: topicRowSchema,
  sources: z.array(topicSourceRowSchema),
  judgments: z.array(topicJudgmentRowSchema),
  evidence: z.array(topicEvidenceRowSchema),
  questions: z.array(topicQuestionRowSchema),
  notes: z.array(knowledgeNoteRowSchema),
  propositions: z.array(topicPropositionRowSchema),
  turningPoints: z.array(topicTurningPointRowSchema),
});

export type KnowledgeInboxItem = z.infer<typeof inboxItemSchema>;
export type KnowledgeDomainRow = z.infer<typeof domainRowSchema>;
export type KnowledgeTopicRow = z.infer<typeof topicRowSchema>;
export type KnowledgeClassificationSuggestionRow = z.infer<typeof suggestionRowSchema>;
export type KnowledgeOperationResult = z.infer<typeof operationResultSchema>;
export type KnowledgeTopicDetail = z.infer<typeof topicDetailSchema>;
export type KnowledgeNoteRow = z.infer<typeof knowledgeNoteRowSchema>;
export type TopicPropositionRow = z.infer<typeof topicPropositionRowSchema>;
export type TopicTurningPointRow = z.infer<typeof topicTurningPointRowSchema>;
export type TopicMergePreview = z.infer<typeof topicMergePreviewSchema>;
export type TopicMergeResult = z.infer<typeof topicMergeResultSchema>;
export type TopicSplitPreview = z.infer<typeof topicSplitPreviewSchema>;
export type TopicRelationSuggestion = z.infer<typeof topicRelationSuggestionSchema>;
export type PersonalCatalogProposal = z.infer<typeof personalCatalogProposalSchema>;
export type PersonalCatalogApplyResult = z.infer<typeof personalCatalogApplyResultSchema>;
export type KnowledgeTopicAliasRow = z.infer<typeof topicAliasRowSchema>;
export type KnowledgeEntityRow = z.infer<typeof entityDictionaryRowSchema>;
export type KnowledgeClassificationRuleRow = z.infer<typeof classificationRuleRowSchema>;

export type EvidenceLocator = {
  kind:
    | "none"
    | "message"
    | "timecode"
    | "subtitle_line"
    | "page"
    | "html_paragraph"
    | "markdown_heading"
    | "json_path"
    | "file_fragment"
    | "text_quote";
  value: string;
  quote?: string;
};

export type ClassificationRuleMutationInput = {
  ruleType: KnowledgeClassificationRuleRow["ruleType"];
  pattern: string;
  targetDomainId: number | null;
  targetTopicId: number | null;
  weight: number;
  priority: number;
  enabled: boolean;
  configJson?: string;
};

export type SaveKnowledgeSuggestionsInput = {
  sourceItemId: number;
  classifierVersion: string;
  suggestions: Array<{
    topicId: number | null;
    score: number;
    decision: string;
    reasons: string[];
    signalScoresJson: string;
  }>;
};

export class KnowledgeRepository {
  private get desktopAvailable() {
    return "__TAURI_INTERNALS__" in window;
  }

  async listInbox(limit = 120): Promise<KnowledgeInboxItem[]> {
    if (!this.desktopAvailable) return [];
    return z.array(inboxItemSchema).parse(await invoke("list_knowledge_inbox", { limit }));
  }

  async getSourceOriginalText(sourceItemId: number): Promise<string> {
    if (!this.desktopAvailable) return "";
    return z.string().parse(
      await invoke("get_knowledge_source_original_text", { sourceItemId }),
    );
  }

  async listDomains(): Promise<KnowledgeDomainRow[]> {
    if (!this.desktopAvailable) return [];
    return z.array(domainRowSchema).parse(await invoke("list_knowledge_domains"));
  }

  async listTopics(): Promise<KnowledgeTopicRow[]> {
    if (!this.desktopAvailable) return [];
    return z.array(topicRowSchema).parse(await invoke("list_knowledge_topics"));
  }

  async createDomain(name: string, description = ""): Promise<KnowledgeDomainRow> {
    return domainRowSchema.parse(await invoke("create_knowledge_domain", {
      input: { name, description },
    }));
  }

  async updateDomain(input: {
    id: number;
    name: string;
    description?: string;
  }): Promise<KnowledgeDomainRow> {
    return domainRowSchema.parse(await invoke("update_knowledge_domain", {
      input: { ...input, description: input.description ?? "" },
    }));
  }

  async prepareClassificationContext(sourceItemId: number): Promise<ClassificationContext> {
    return classificationContextSchema.parse(
      await invoke("prepare_knowledge_classification_context", { sourceItemId }),
    );
  }

  async getPersonalCatalogProposal(): Promise<PersonalCatalogProposal | null> {
    if (!this.desktopAvailable) return null;
    return personalCatalogProposalSchema.parse(
      await invoke("get_personal_topic_catalog_proposal"),
    );
  }

  async applyPersonalCatalog(version: string): Promise<PersonalCatalogApplyResult> {
    return personalCatalogApplyResultSchema.parse(
      await invoke("apply_personal_topic_catalog", { input: { version } }),
    );
  }

  async listTopicAliases(topicId: number | null = null): Promise<KnowledgeTopicAliasRow[]> {
    if (!this.desktopAvailable) return [];
    return z.array(topicAliasRowSchema).parse(
      await invoke("list_knowledge_topic_aliases", { topicId }),
    );
  }

  async createTopicAlias(input: {
    topicId: number;
    alias: string;
    aliasType: KnowledgeTopicAliasRow["aliasType"];
  }): Promise<KnowledgeTopicAliasRow> {
    return topicAliasRowSchema.parse(
      await invoke("create_knowledge_topic_alias", { input }),
    );
  }

  async updateTopicAlias(input: {
    id: number;
    alias: string;
    aliasType: KnowledgeTopicAliasRow["aliasType"];
  }): Promise<KnowledgeTopicAliasRow> {
    return topicAliasRowSchema.parse(
      await invoke("update_knowledge_topic_alias", { input }),
    );
  }

  async deleteTopicAlias(id: number) {
    return deleteResultSchema.parse(await invoke("delete_knowledge_topic_alias", { id }));
  }

  async listEntities(): Promise<KnowledgeEntityRow[]> {
    if (!this.desktopAvailable) return [];
    return z.array(entityDictionaryRowSchema).parse(await invoke("list_knowledge_entities"));
  }

  async createEntity(input: {
    canonicalName: string;
    entityType: KnowledgeEntityRow["entityType"];
    aliases: string[];
    description?: string;
  }): Promise<KnowledgeEntityRow> {
    return entityDictionaryRowSchema.parse(
      await invoke("create_knowledge_entity", {
        input: { ...input, description: input.description ?? "" },
      }),
    );
  }

  async updateEntity(input: {
    id: number;
    canonicalName: string;
    entityType: KnowledgeEntityRow["entityType"];
    aliases: string[];
    description?: string;
  }): Promise<KnowledgeEntityRow> {
    return entityDictionaryRowSchema.parse(
      await invoke("update_knowledge_entity", {
        input: { ...input, description: input.description ?? "" },
      }),
    );
  }

  async deleteEntity(id: number) {
    return deleteResultSchema.parse(await invoke("delete_knowledge_entity", { id }));
  }

  async listClassificationRules(): Promise<KnowledgeClassificationRuleRow[]> {
    if (!this.desktopAvailable) return [];
    return z.array(classificationRuleRowSchema).parse(
      await invoke("list_knowledge_classification_rules"),
    );
  }

  async createClassificationRule(
    input: ClassificationRuleMutationInput,
  ): Promise<KnowledgeClassificationRuleRow> {
    return classificationRuleRowSchema.parse(
      await invoke("create_knowledge_classification_rule", {
        input: { ...input, configJson: input.configJson ?? "{}" },
      }),
    );
  }

  async updateClassificationRule(
    input: ClassificationRuleMutationInput & { id: number },
  ): Promise<KnowledgeClassificationRuleRow> {
    return classificationRuleRowSchema.parse(
      await invoke("update_knowledge_classification_rule", {
        input: { ...input, configJson: input.configJson ?? "{}" },
      }),
    );
  }

  async deleteClassificationRule(id: number) {
    return deleteResultSchema.parse(
      await invoke("delete_knowledge_classification_rule", { id }),
    );
  }

  async createTopic(input: {
    domainId: number;
    parentTopicId: number | null;
    name: string;
    description?: string;
    topicKind?: string;
  }): Promise<KnowledgeTopicRow> {
    return topicRowSchema.parse(await invoke("create_knowledge_topic", {
      input: {
        ...input,
        description: input.description ?? "",
        topicKind: input.topicKind ?? "subject",
      },
    }));
  }

  async updateTopic(input: {
    id: number;
    name: string;
    description?: string;
  }): Promise<KnowledgeTopicRow> {
    return topicRowSchema.parse(await invoke("update_knowledge_topic", {
      input: { ...input, description: input.description ?? "" },
    }));
  }

  async saveSuggestions(
    input: SaveKnowledgeSuggestionsInput,
  ): Promise<KnowledgeClassificationSuggestionRow[]> {
    return z.array(suggestionRowSchema).parse(
      await invoke("save_knowledge_classification_suggestions", { input }),
    );
  }

  async listSuggestions(sourceItemId: number): Promise<KnowledgeClassificationSuggestionRow[]> {
    if (!this.desktopAvailable) return [];
    return z.array(suggestionRowSchema).parse(
      await invoke("list_knowledge_classification_suggestions", { sourceItemId }),
    );
  }

  async listClassificationRunSourceIds(classifierVersion: string): Promise<number[]> {
    if (!this.desktopAvailable) return [];
    return z.array(z.number().int().positive()).parse(
      await invoke("list_knowledge_classification_run_source_ids", { classifierVersion }),
    );
  }

  async confirmClassification(input: {
    sourceItemId: number;
    topicId: number;
    suggestionId: number | null;
    confidence: number;
  }): Promise<KnowledgeOperationResult> {
    return operationResultSchema.parse(
      await invoke("confirm_knowledge_classification", { input }),
    );
  }

  async undoClassification(operationId: number): Promise<KnowledgeOperationResult> {
    return operationResultSchema.parse(
      await invoke("undo_knowledge_classification", { operationId }),
    );
  }

  async getTopicDetail(topicId: number): Promise<KnowledgeTopicDetail> {
    return topicDetailSchema.parse(await invoke("get_knowledge_topic_detail", { topicId }));
  }

  async listNotes(
    topicId: number | null = null,
    includeArchived = false,
  ): Promise<KnowledgeNoteRow[]> {
    if (!this.desktopAvailable) return [];
    return z.array(knowledgeNoteRowSchema).parse(
      await invoke("list_knowledge_notes", { topicId, includeArchived }),
    );
  }

  async getNote(noteId: number): Promise<KnowledgeNoteRow> {
    return knowledgeNoteRowSchema.parse(await invoke("get_knowledge_note", { noteId }));
  }

  async createNote(input: {
    title: string;
    bodyMarkdown: string;
    summary?: string;
    noteType: KnowledgeNoteRow["noteType"];
    status: KnowledgeNoteRow["status"];
    organizationState: KnowledgeNoteRow["organizationState"];
    primaryTopicId: number;
    relatedTopicIds: number[];
    sourceItemIds: number[];
  }): Promise<KnowledgeNoteRow> {
    return knowledgeNoteRowSchema.parse(
      await invoke("create_knowledge_note", {
        input: { ...input, summary: input.summary ?? "" },
      }),
    );
  }

  async updateNote(input: {
    id: number;
    title: string;
    bodyMarkdown: string;
    summary?: string;
    noteType: KnowledgeNoteRow["noteType"];
    status: KnowledgeNoteRow["status"];
    organizationState: KnowledgeNoteRow["organizationState"];
    primaryTopicId: number;
    relatedTopicIds: number[];
    sourceItemIds: number[];
  }): Promise<KnowledgeNoteRow> {
    return knowledgeNoteRowSchema.parse(
      await invoke("update_knowledge_note", {
        input: { ...input, summary: input.summary ?? "" },
      }),
    );
  }

  async archiveNote(noteId: number): Promise<KnowledgeNoteRow> {
    return knowledgeNoteRowSchema.parse(
      await invoke("archive_knowledge_note", { noteId }),
    );
  }

  async createProposition(input: {
    topicId: number;
    statementMarkdown: string;
    status: TopicPropositionRow["status"];
  }): Promise<TopicPropositionRow> {
    return topicPropositionRowSchema.parse(
      await invoke("create_knowledge_proposition", { input }),
    );
  }

  async updateProposition(input: {
    id: number;
    statementMarkdown: string;
    status: TopicPropositionRow["status"];
  }): Promise<TopicPropositionRow> {
    return topicPropositionRowSchema.parse(
      await invoke("update_knowledge_proposition", { input }),
    );
  }

  async supersedeProposition(propositionId: number): Promise<TopicPropositionRow> {
    return topicPropositionRowSchema.parse(
      await invoke("supersede_knowledge_proposition", { propositionId }),
    );
  }

  async createTurningPoint(input: {
    topicId: number;
    fromJudgmentId: number | null;
    toJudgmentId: number;
    title: string;
    explanation: string;
    occurredAt?: string;
  }): Promise<TopicTurningPointRow> {
    return topicTurningPointRowSchema.parse(
      await invoke("create_knowledge_turning_point", {
        input: { ...input, occurredAt: input.occurredAt ?? "" },
      }),
    );
  }

  async addTopicJudgment(input: {
    topicId: number;
    statementMarkdown: string;
    confidence: number;
    state?: string;
    changeReason?: string;
  }) {
    return topicJudgmentRowSchema.parse(await invoke("add_knowledge_topic_judgment", {
      input: {
        ...input,
        state: input.state ?? "current",
        changeReason: input.changeReason ?? "",
      },
    }));
  }

  async addTopicEvidence(input: {
    topicId: number;
    sourceItemId: number;
    contentMarkdown: string;
    stance?: string;
    credibility?: number;
    verificationStatus?: string;
    validityStatus?: string;
    locator?: EvidenceLocator;
  }) {
    const { locator, ...rest } = input;
    return topicEvidenceRowSchema.parse(await invoke("add_knowledge_topic_evidence", {
      input: {
        ...rest,
        stance: input.stance ?? "context",
        credibility: input.credibility ?? 0,
        verificationStatus: input.verificationStatus ?? "unverified",
        validityStatus: input.validityStatus ?? "active",
        locatorJson: locator?.kind && locator.kind !== "none"
          ? JSON.stringify({
            kind: locator.kind,
            value: locator.value.trim(),
            quote: locator.quote?.trim() ?? "",
          })
          : "{}",
      },
    }));
  }

  async addTopicQuestion(input: {
    topicId: number;
    question: string;
    importance?: string;
    affectsCurrentJudgment?: boolean;
  }) {
    return topicQuestionRowSchema.parse(await invoke("add_knowledge_topic_question", {
      input: {
        ...input,
        importance: input.importance ?? "medium",
        affectsCurrentJudgment: input.affectsCurrentJudgment ?? false,
      },
    }));
  }

  async compileTopicContext(topicId: number): Promise<string> {
    return invoke<string>("compile_knowledge_topic_context", { topicId });
  }

  async previewTopicMerge(sourceTopicId: number, targetTopicId: number): Promise<TopicMergePreview> {
    return topicMergePreviewSchema.parse(await invoke("preview_knowledge_topic_merge", {
      sourceTopicId,
      targetTopicId,
    }));
  }

  async mergeTopics(sourceTopicId: number, targetTopicId: number): Promise<TopicMergeResult> {
    return topicMergeResultSchema.parse(await invoke("merge_knowledge_topics", {
      input: { sourceTopicId, targetTopicId },
    }));
  }

  async undoTopicMerge(operationId: number): Promise<TopicMergeResult> {
    return topicMergeResultSchema.parse(await invoke("undo_knowledge_topic_merge", {
      operationId,
    }));
  }

  async previewTopicSplit(topicId: number): Promise<TopicSplitPreview> {
    return topicSplitPreviewSchema.parse(await invoke("preview_knowledge_topic_split", {
      topicId,
    }));
  }

  async suggestTopicRelations(): Promise<TopicRelationSuggestion[]> {
    if (!this.desktopAvailable) return [];
    return z.array(topicRelationSuggestionSchema).parse(
      await invoke("suggest_knowledge_topic_relations"),
    );
  }

  async createTopicRelation(input: {
    fromTopicId: number;
    toTopicId: number;
    relationType: string;
    confidence: number;
    note?: string;
  }) {
    return topicRelationRowSchema.parse(await invoke("create_knowledge_topic_relation", {
      input: { ...input, note: input.note ?? "" },
    }));
  }
}
