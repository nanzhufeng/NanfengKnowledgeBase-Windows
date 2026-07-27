import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { KnowledgeRepository } from "./knowledgeRepository";

describe("KnowledgeRepository classification context", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("reads the complete persisted classifier input through one Tauri command", async () => {
    invoke.mockResolvedValue({
      source: {
        id: "source-1",
        title: "Claude token 成本",
        text: "Anthropic 调整 API 价格",
        kind: "ai_conversation",
        platform: "ChatGPT",
        fileName: null,
        filePath: null,
        folderPath: null,
        tags: ["模型"],
        jsonFields: {},
        importedAt: "2026-07-27T10:00:00+08:00",
        batchId: null,
      },
      topics: [{
        id: "7",
        primaryDomainId: "2",
        path: ["AI 与软件", "模型与成本"],
        name: "模型与成本",
        aliases: ["模型价格"],
        entities: ["Claude", "Anthropic"],
        keywords: ["token"],
        searchDocument: "Claude API token 推理价格",
        status: "active",
        updatedAt: "2026-07-27T10:00:00+08:00",
      }],
      rules: [{
        id: "keyword:rule-token",
        topicId: "7",
        field: "text",
        operator: "contains",
        effect: "include",
        value: "token",
        jsonField: null,
        strength: 0.8,
        reason: "用户规则命中「token」",
        enabled: true,
      }],
      history: {
        confirmedTopicCounts: { "7": 3 },
        recentTopicIds: ["7"],
        batchTopicIds: {},
      },
      searchSignals: [{
        topicId: "7",
        normalizedScore: 0.92,
        reason: "SQLite FTS5/BM25 命中 3 个主题词，归一化相关度 92%",
      }],
    });

    const context = await new KnowledgeRepository().prepareClassificationContext(42);

    expect(invoke).toHaveBeenCalledWith(
      "prepare_knowledge_classification_context",
      { sourceItemId: 42 },
    );
    expect(context.source.fileName).toBeUndefined();
    expect(context.topics[0].aliases).toEqual(["模型价格"]);
    expect(context.rules[0].strength).toBe(0.8);
    expect(context.searchSignals?.[0].normalizedScore).toBe(0.92);
  });

  it("rejects an out-of-range normalized BM25 score", async () => {
    invoke.mockResolvedValue({
      source: {
        id: "source-1",
        title: "来源",
        text: "",
        kind: "text",
        platform: null,
        fileName: null,
        filePath: null,
        folderPath: null,
        tags: [],
        jsonFields: {},
        importedAt: "2026-07-27T10:00:00+08:00",
        batchId: null,
      },
      topics: [],
      rules: [],
      history: {
        confirmedTopicCounts: {},
        recentTopicIds: [],
        batchTopicIds: {},
      },
      searchSignals: [{
        topicId: "7",
        normalizedScore: 1.2,
        reason: "invalid",
      }],
    });

    await expect(
      new KnowledgeRepository().prepareClassificationContext(42),
    ).rejects.toThrow();
  });
});
