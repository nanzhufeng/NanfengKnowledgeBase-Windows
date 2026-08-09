import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

export const aiProviderChannelSchema = z.enum(["openrouter", "deepseek_direct"]);
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
    totalTokens: z.number().int(),
    knownCostUsd: z.number(),
  }),
});

const aiTopicInsightSchema = z.object({
  topicId: z.number().int(),
  taskPublicId: z.string(),
  providerChannel: aiProviderChannelSchema,
  modelId: z.string(),
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
  }),
  generatedAt: z.string(),
});

export type AiSettings = z.infer<typeof aiSettingsSchema>;
export type AiTopicInsight = z.infer<typeof aiTopicInsightSchema>;

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

  async getTopicInsight(topicId: number): Promise<AiTopicInsight | null> {
    const value = await invokeAi("get_ai_topic_insight", { topicId });
    return value === null ? null : aiTopicInsightSchema.parse(value);
  }

  async runTopicInsight(topicId: number): Promise<AiTopicInsight> {
    return aiTopicInsightSchema.parse(await invokeAi("run_ai_topic_insight", { topicId }));
  }
}
