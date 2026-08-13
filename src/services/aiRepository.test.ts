import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { AiRepository, normalizeAiCommandError } from "./aiRepository";

describe("AiRepository", () => {
  beforeEach(() => invoke.mockReset());

  it("keeps API keys inside the save command and never reads them back", async () => {
    invoke.mockResolvedValue({
      activeChannel: "openrouter",
      providers: [{
        channel: "openrouter",
        configured: true,
        selectedModelId: "openai/latest",
        models: [],
        catalogRefreshedAt: null,
      }],
      usage: {
        taskCount: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        knownCostUsd: 0,
      },
    });
    const repository = new AiRepository();
    const result = await repository.saveSettings({
      activeChannel: "openrouter",
      selectedModelId: "openai/latest",
      apiKey: "secret",
    });
    expect(invoke).toHaveBeenCalledWith("save_ai_settings", {
      input: {
        activeChannel: "openrouter",
        selectedModelId: "openai/latest",
        apiKey: "secret",
      },
    });
    expect(result.providers[0]).not.toHaveProperty("apiKey");
  });

  it("accepts the Qwen direct channel without exposing its API key", async () => {
    invoke.mockResolvedValue({
      activeChannel: "qwen_direct",
      providers: [{
        channel: "qwen_direct",
        configured: false,
        selectedModelId: "qwen3.7-flash",
        models: [],
        catalogRefreshedAt: null,
      }],
      usage: { taskCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, knownCostUsd: 0 },
    });
    await expect(new AiRepository().saveSettings({
      activeChannel: "qwen_direct",
      selectedModelId: "qwen3.7-flash",
    })).resolves.toMatchObject({ activeChannel: "qwen_direct" });
  });

  it("runs a single topic insight task by topic id", async () => {
    invoke.mockResolvedValue({
      topicId: 9,
      taskPublicId: "ai-task-9",
      providerChannel: "openrouter",
      modelId: "anthropic/latest",
      inputFingerprint: "fixture-input-v1",
      payload: {
        summaryMarkdown: "总结",
        keyInsights: [],
        evidence: [],
        openQuestions: [],
        topicManagementSuggestions: [],
      },
      generatedAt: "2026-08-10T00:00:00Z",
    });
    await expect(new AiRepository().runTopicInsight(9)).resolves.toMatchObject({ topicId: 9 });
    expect(invoke).toHaveBeenCalledWith("run_ai_topic_insight", {
      topicId: 9,
      modelSelection: null,
      force: false,
    });
  });

  it("passes the selected model to incremental taxonomy generation", async () => {
    invoke.mockResolvedValue({
      publicId: "taxonomy-revision-2", taskPublicId: "ai-task-2",
      providerChannel: "openrouter", modelId: "anthropic/latest", status: "draft",
      domains: [], topics: [], assignments: [], sourceCount: 0, assignedSourceCount: 0,
      uncertainSourceCount: 0, createdAt: "2026-08-10T00:00:00Z", appliedAt: null, undoneAt: null,
    });
    await new AiRepository().runIncrementalTaxonomyRevision({
      channel: "openrouter", modelId: "anthropic/latest",
    });
    expect(invoke).toHaveBeenCalledWith("run_ai_incremental_taxonomy_revision", {
      modelSelection: { channel: "openrouter", modelId: "anthropic/latest" },
    });
  });

  it("reads a saved API key only through an explicit reveal command", async () => {
    invoke.mockResolvedValue("saved-secret");
    await expect(new AiRepository().revealApiKey("openrouter")).resolves.toBe("saved-secret");
    expect(invoke).toHaveBeenCalledWith("reveal_ai_api_key", { channel: "openrouter" });
  });

  it("turns structured Tauri command errors into readable errors", () => {
    const normalized = normalizeAiCommandError({
      code: "conflict",
      message: "OpenRouter 模型目录刷新失败：连接超时",
    });
    expect(normalized).toBeInstanceOf(Error);
    expect(normalized.message).toBe("OpenRouter 模型目录刷新失败：连接超时");
  });
});
