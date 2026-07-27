import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

const inboxItemSchema = z.object({
  id: z.number().int(),
  publicId: z.string(),
  legacyRecordId: z.number().int().nullable(),
  sourceType: z.string(),
  title: z.string(),
  platform: z.string(),
  originalText: z.string(),
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

const topicDetailSchema = z.object({
  topic: topicRowSchema,
  sources: z.array(topicSourceRowSchema),
  judgments: z.array(topicJudgmentRowSchema),
  evidence: z.array(topicEvidenceRowSchema),
  questions: z.array(topicQuestionRowSchema),
});

export type KnowledgeInboxItem = z.infer<typeof inboxItemSchema>;
export type KnowledgeDomainRow = z.infer<typeof domainRowSchema>;
export type KnowledgeTopicRow = z.infer<typeof topicRowSchema>;
export type KnowledgeClassificationSuggestionRow = z.infer<typeof suggestionRowSchema>;
export type KnowledgeOperationResult = z.infer<typeof operationResultSchema>;
export type KnowledgeTopicDetail = z.infer<typeof topicDetailSchema>;
export type TopicMergePreview = z.infer<typeof topicMergePreviewSchema>;
export type TopicMergeResult = z.infer<typeof topicMergeResultSchema>;
export type TopicSplitPreview = z.infer<typeof topicSplitPreviewSchema>;
export type TopicRelationSuggestion = z.infer<typeof topicRelationSuggestionSchema>;

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

  async listInbox(limit = 500): Promise<KnowledgeInboxItem[]> {
    if (!this.desktopAvailable) return [];
    return z.array(inboxItemSchema).parse(await invoke("list_knowledge_inbox", { limit }));
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
    locatorJson?: string;
  }) {
    return topicEvidenceRowSchema.parse(await invoke("add_knowledge_topic_evidence", {
      input: {
        ...input,
        stance: input.stance ?? "context",
        credibility: input.credibility ?? 0,
        locatorJson: input.locatorJson ?? "{}",
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
