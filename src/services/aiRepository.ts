import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

export const aiProviderChannelSchema = z.enum(["openrouter", "deepseek_direct", "qwen_direct"]);
export type AiProviderChannel = z.infer<typeof aiProviderChannelSchema>;

const aiModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  author: z.string(),
  canonicalSlug: z.string().nullable(),
  createdAt: z.number().int().nullable(),
  contextLength: z.number().int().nullable(),
  supportedParameters: z.array(z.string()),
  pricing: z.object({
    prompt: z.string().nullable(),
    completion: z.string().nullable(),
    request: z.string().nullable(),
    cacheHit: z.string().nullable(),
    cacheWrite: z.string().nullable().default(null),
    effectiveAt: z.string().nullable().default(null),
    rateLabel: z.string().nullable().default(null),
    source: z.string().nullable().default(null),
  }),
});

const aiSettingsSchema = z.object({
  activeChannel: aiProviderChannelSchema,
  providers: z.array(z.object({
    channel: aiProviderChannelSchema,
    configured: z.boolean(),
    selectedModelId: z.string().nullable(),
    models: z.array(aiModelSchema),
    catalogRefreshedAt: z.string().nullable(),
  })),
  usage: z.object({
    taskCount: z.number().int(),
    promptTokens: z.number().int(),
    completionTokens: z.number().int(),
    cachedTokens: z.number().int().default(0),
    cacheWriteTokens: z.number().int().default(0),
    totalTokens: z.number().int(),
    knownCostUsd: z.number(),
    knownCacheSavingsUsd: z.number().default(0),
    knownCostTaskCount: z.number().int().default(0),
    unknownCostTaskCount: z.number().int().default(0),
    knownCacheSavingsRecordCount: z.number().int().default(0),
    unknownCacheSavingsRecordCount: z.number().int().default(0),
  }),
});

const aiTopicInsightSchema = z.object({
  topicId: z.number().int(),
  taskPublicId: z.string(),
  providerChannel: aiProviderChannelSchema,
  modelId: z.string(),
  inputFingerprint: z.string(),
  payload: z.object({
    summaryMarkdown: z.string(),
    keyInsights: z.array(z.object({
      title: z.string(),
      detail: z.string(),
      sourceItemIds: z.array(z.number().int()),
    })),
    evidence: z.array(z.object({
      stance: z.enum(["support", "oppose", "context"]),
      content: z.string(),
      sourceItemId: z.number().int().nullable(),
      locatorLabel: z.string().nullable(),
    })),
    openQuestions: z.array(z.string()),
    topicManagementSuggestions: z.array(z.object({
      action: z.enum(["relate", "rename", "merge", "new_topic", "boundary"]),
      title: z.string(),
      reason: z.string(),
      targetTopicName: z.string().nullable(),
    })),
    hypotheses: z.array(z.object({
      title: z.string(),
      statement: z.string(),
      confidence: z.number().min(0).max(100),
      invalidationCondition: z.string(),
      sourceItemIds: z.array(z.number().int()),
    })).default([]),
    judgmentEvolution: z.array(z.object({
      occurredAt: z.string().nullable(),
      title: z.string(),
      fromStatement: z.string().nullable(),
      toStatement: z.string(),
      reason: z.string(),
      sourceItemIds: z.array(z.number().int()),
    })).default([]),
    decisions: z.array(z.object({
      title: z.string(),
      basis: z.string(),
      action: z.string(),
      result: z.string().nullable(),
      status: z.enum(["proposed", "in_progress", "completed", "unknown"]),
      sourceItemIds: z.array(z.number().int()),
    })).default([]),
  }),
  generatedAt: z.string(),
});

const aiTaxonomyDomainSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
});

const aiTaxonomyTopicSchema = z.object({
  key: z.string(),
  domainKey: z.string(),
  parentKey: z.string().nullable(),
  name: z.string(),
  description: z.string(),
  integrationMarkdown: z.string().default(""),
  sourceItemIds: z.array(z.number().int()).default([]),
});

const aiTaxonomyAssignmentSchema = z.object({
  sourceItemId: z.number().int(),
  topicKey: z.string(),
  confidence: z.number().min(0).max(100),
  reason: z.string(),
  uncertain: z.boolean(),
});

const aiTaxonomyRevisionSchema = z.object({
  publicId: z.string(),
  taskPublicId: z.string(),
  providerChannel: aiProviderChannelSchema,
  modelId: z.string(),
  status: z.enum(["draft", "applied", "superseded", "undone"]),
  domains: z.array(aiTaxonomyDomainSchema),
  topics: z.array(aiTaxonomyTopicSchema),
  assignments: z.array(aiTaxonomyAssignmentSchema),
  sourceCount: z.number().int().nonnegative(),
  assignedSourceCount: z.number().int().nonnegative(),
  uncertainSourceCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  appliedAt: z.string().nullable(),
  undoneAt: z.string().nullable(),
});

const aiTaxonomyApplyResultSchema = z.object({
  revisionPublicId: z.string(),
  createdDomains: z.number().int().nonnegative(),
  createdTopics: z.number().int().nonnegative(),
  assignedSources: z.number().int().nonnegative(),
  uncertainSources: z.number().int().nonnegative(),
});

const aiTaxonomyResumeSchema = z.object({
  taskPublicId: z.string(),
  providerChannel: aiProviderChannelSchema,
  modelId: z.string(),
  stage: z.string(),
  sourceCount: z.number().int().nonnegative(),
  profiledSourceCount: z.number().int().nonnegative(),
  assignedSourceCount: z.number().int().nonnegative(),
  integratedTopicCount: z.number().int().nonnegative(),
  totalTopicCount: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative().nullable(),
  updatedAt: z.string(),
  lastError: z.string().nullable(),
});

export type AiSettings = z.infer<typeof aiSettingsSchema>;
export type AiTopicInsight = z.infer<typeof aiTopicInsightSchema>;
export type AiModelSelection = {
  channel: AiProviderChannel;
  modelId: string;
};
export type AiTaxonomyRevision = z.infer<typeof aiTaxonomyRevisionSchema>;
export type AiTaxonomyApplyResult = z.infer<typeof aiTaxonomyApplyResultSchema>;
export type AiTaxonomyResume = z.infer<typeof aiTaxonomyResumeSchema>;

export function normalizeAiCommandError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "object" && error && "message" in error) {
    return new Error(String(error.message));
  }
  return new Error(String(error));
}

async function invokeAi(command: string, args?: Record<string, unknown>): Promise<unknown> {
  try {
    return await invoke(command, args);
  } catch (error) {
    throw normalizeAiCommandError(error);
  }
}

export class AiRepository {
  async getSettings(): Promise<AiSettings> {
    return aiSettingsSchema.parse(await invokeAi("get_ai_settings"));
  }

  async saveSettings(input: {
    activeChannel: AiProviderChannel;
    selectedModelId: string | null;
    apiKey?: string;
  }): Promise<AiSettings> {
    return aiSettingsSchema.parse(await invokeAi("save_ai_settings", { input }));
  }

  async revealApiKey(channel: AiProviderChannel): Promise<string> {
    return z.string().min(1).parse(await invokeAi("reveal_ai_api_key", { channel }));
  }

  async refreshModels(
    channel: AiProviderChannel,
    apiKey?: string,
  ): Promise<AiSettings> {
    return aiSettingsSchema.parse(await invokeAi("refresh_ai_models", {
      input: { channel, apiKey },
    }));
  }

  async getTopicInsight(
    topicId: number,
    modelSelection?: AiModelSelection,
  ): Promise<AiTopicInsight | null> {
    const value = await invokeAi("get_ai_topic_insight", {
      topicId,
      modelSelection: modelSelection ?? null,
    });
    return value === null ? null : aiTopicInsightSchema.parse(value);
  }

  async runTopicInsight(
    topicId: number,
    modelSelection?: AiModelSelection,
    force = false,
  ): Promise<AiTopicInsight> {
    return aiTopicInsightSchema.parse(await invokeAi("run_ai_topic_insight", {
      topicId,
      modelSelection: modelSelection ?? null,
      force,
    }));
  }

  async getLatestTaxonomyRevision(
    modelSelection?: AiModelSelection,
  ): Promise<AiTaxonomyRevision | null> {
    const value = await invokeAi("get_latest_ai_taxonomy_revision", {
      modelSelection: modelSelection ?? null,
    });
    return value === null ? null : aiTaxonomyRevisionSchema.parse(value);
  }

  async getAppliedTaxonomyRevision(): Promise<AiTaxonomyRevision | null> {
    const value = await invokeAi("get_applied_ai_taxonomy_revision");
    return value === null ? null : aiTaxonomyRevisionSchema.parse(value);
  }

  async getResumableTaxonomyRun(): Promise<AiTaxonomyResume | null> {
    const value = await invokeAi("get_resumable_ai_taxonomy_run");
    return value === null ? null : aiTaxonomyResumeSchema.parse(value);
  }

  async discardTaxonomyRun(taskPublicId: string): Promise<void> {
    await invokeAi("discard_ai_taxonomy_run", { taskPublicId });
  }

  async runTaxonomyRevision(
    resumeTaskPublicId?: string,
    modelSelection?: AiModelSelection,
  ): Promise<AiTaxonomyRevision> {
    return aiTaxonomyRevisionSchema.parse(await invokeAi("run_ai_taxonomy_revision", {
      resumeTaskPublicId: resumeTaskPublicId ?? null,
      modelSelection: modelSelection ?? null,
    }));
  }

  async runIncrementalTaxonomyRevision(
    modelSelection?: AiModelSelection,
  ): Promise<AiTaxonomyRevision> {
    return aiTaxonomyRevisionSchema.parse(await invokeAi("run_ai_incremental_taxonomy_revision", {
      modelSelection: modelSelection ?? null,
    }));
  }

  async applyTaxonomyRevision(revisionPublicId: string): Promise<AiTaxonomyApplyResult> {
    return aiTaxonomyApplyResultSchema.parse(await invokeAi("apply_ai_taxonomy_revision", {
      revisionPublicId,
    }));
  }

  async undoTaxonomyRevision(revisionPublicId: string): Promise<void> {
    await invokeAi("undo_ai_taxonomy_revision", { revisionPublicId });
  }
}
