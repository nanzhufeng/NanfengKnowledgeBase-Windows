import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { AiRepository } from "./aiRepository";

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

  it("runs a single topic insight task by topic id", async () => {
    invoke.mockResolvedValue({
      topicId: 9,
      taskPublicId: "ai-task-9",
      providerChannel: "openrouter",
      modelId: "anthropic/latest",
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
    expect(invoke).toHaveBeenCalledWith("run_ai_topic_insight", { topicId: 9 });
  });
});
