import { describe, expect, it, vi } from "vitest";
import type { ClassificationContext } from "../knowledge/domain";
import {
  autoOrganizeImportedSources,
  upgradeOutdatedInboxSuggestions,
} from "./knowledgeAutoOrganizer";

function context(sourceId: number, explicitStrength: number): ClassificationContext {
  return {
    source: {
      id: String(sourceId),
      title: "软件开发与调试",
      text: "代码 调试 测试 构建 桌面软件",
      kind: "markdown",
      importedAt: "2026-07-27T00:00:00Z",
    },
    topics: [{
      id: "7",
      primaryDomainId: "2",
      path: ["AI 与软件", "软件开发"],
      name: "软件开发",
      aliases: ["编程开发"],
      entities: ["Windows"],
      keywords: ["代码", "调试", "测试", "构建", "桌面软件"],
      searchDocument: "软件开发 代码 调试 测试 构建 桌面软件",
      status: "active",
      updatedAt: "2026-07-27T00:00:00Z",
    }],
    rules: explicitStrength > 0 ? [{
      id: "rule-1",
      topicId: "7",
      field: "title",
      operator: "contains",
      value: "软件开发",
      strength: explicitStrength,
      reason: "命中用户规则",
      enabled: true,
    }] : [],
    history: {
      confirmedTopicCounts: explicitStrength > 0 ? { "7": 5 } : {},
      recentTopicIds: explicitStrength > 0 ? ["7"] : [],
      batchTopicIds: {},
    },
    searchSignals: [{
      topicId: "7",
      normalizedScore: 1,
      reason: "全文高度相关",
    }],
  };
}

describe("autoOrganizeImportedSources", () => {
  it("bootstraps the editable catalog and saves deterministic suggestions", async () => {
    const repository = {
      listTopics: vi.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 7 }]),
      getPersonalCatalogProposal: vi.fn().mockResolvedValue({ version: "catalog-v1" }),
      applyPersonalCatalog: vi.fn().mockResolvedValue({}),
      prepareClassificationContext: vi.fn().mockResolvedValue(context(31, 0)),
      saveSuggestions: vi.fn().mockResolvedValue([{
        id: 91,
        suggestedTopicId: 7,
      }]),
      confirmClassification: vi.fn().mockResolvedValue({ operationId: 400 }),
    };

    const result = await autoOrganizeImportedSources([31], repository as never);

    expect(result.catalogBootstrapped).toBe(true);
    expect(result.analyzedCount).toBe(1);
    expect(result.autoClassifiedCount).toBe(0);
    expect(result.awaitingConfirmationCount).toBe(1);
    expect(repository.applyPersonalCatalog).toHaveBeenCalledWith("catalog-v1");
    expect(repository.saveSuggestions).toHaveBeenCalledTimes(1);
    expect(repository.confirmClassification).not.toHaveBeenCalled();
  });

  it("automatically accepts only a high-confidence eligible suggestion", async () => {
    const repository = {
      listTopics: vi.fn().mockResolvedValue([{ id: 7 }]),
      getPersonalCatalogProposal: vi.fn(),
      applyPersonalCatalog: vi.fn(),
      prepareClassificationContext: vi.fn().mockResolvedValue(context(32, 1)),
      saveSuggestions: vi.fn().mockResolvedValue([{
        id: 92,
        suggestedTopicId: 7,
      }]),
      confirmClassification: vi.fn().mockResolvedValue({ operationId: 401 }),
    };

    const result = await autoOrganizeImportedSources([32, 32], repository as never);

    expect(result.analyzedCount).toBe(1);
    expect(result.autoClassifiedCount).toBe(1);
    expect(result.operationIds).toEqual([401]);
    expect(repository.prepareClassificationContext).toHaveBeenCalledTimes(1);
    expect(repository.confirmClassification).toHaveBeenCalledWith({
      sourceItemId: 32,
      topicId: 7,
      suggestionId: 92,
      confidence: expect.any(Number),
    });
    expect(repository.confirmClassification.mock.calls[0][0].confidence).toBeGreaterThan(65);
  });

  it("refreshes the managed catalog and clears unsupported old suggestions", async () => {
    const unsupportedContext = context(33, 0);
    unsupportedContext.source.title = "未命名导入记录 205";
    unsupportedContext.source.text = "";
    unsupportedContext.searchSignals = [];
    const repository = {
      listTopics: vi.fn().mockResolvedValue([{ id: 7 }]),
      getPersonalCatalogProposal: vi.fn().mockResolvedValue({ version: "catalog-v2" }),
      applyPersonalCatalog: vi.fn().mockResolvedValue({}),
      prepareClassificationContext: vi.fn().mockResolvedValue(unsupportedContext),
      saveSuggestions: vi.fn().mockResolvedValue([]),
      confirmClassification: vi.fn().mockResolvedValue({ operationId: 402 }),
    };

    const result = await autoOrganizeImportedSources([33], repository as never);

    expect(repository.applyPersonalCatalog).toHaveBeenCalledWith("catalog-v2");
    expect(repository.saveSuggestions).toHaveBeenCalledWith(expect.objectContaining({
      sourceItemId: 33,
      suggestions: [expect.objectContaining({
        topicId: null,
        decision: "manual",
      })],
    }));
    expect(result.analyzedCount).toBe(1);
    expect(result.unmatchedCount).toBe(1);
    expect(result.awaitingConfirmationCount).toBe(0);
    expect(result.failures).toEqual([]);
  });

  it("upgrades every inbox source once and resumes from persisted current-version markers", async () => {
    const unsupportedContext = context(42, 0);
    unsupportedContext.source.title = "未命名导入记录";
    unsupportedContext.source.text = "";
    unsupportedContext.searchSignals = [];
    const repository = {
      listTopics: vi.fn().mockResolvedValue([{ id: 7 }]),
      getPersonalCatalogProposal: vi.fn().mockResolvedValue(null),
      applyPersonalCatalog: vi.fn(),
      listInbox: vi.fn().mockResolvedValue([{ id: 41 }, { id: 42 }, { id: 43 }]),
      listClassificationRunSourceIds: vi.fn().mockResolvedValue([41]),
      prepareClassificationContext: vi.fn()
        .mockResolvedValueOnce(unsupportedContext)
        .mockResolvedValueOnce(context(43, 0.9)),
      saveSuggestions: vi.fn().mockResolvedValue([]),
      confirmClassification: vi.fn(),
    };

    const yieldControl = vi.fn().mockResolvedValue(true);
    const result = await upgradeOutdatedInboxSuggestions(repository as never, { yieldControl });

    expect(result).toEqual({
      completed: 2,
      total: 2,
      matched: 1,
      unmatched: 1,
      failures: 0,
    });
    expect(repository.prepareClassificationContext).toHaveBeenCalledTimes(2);
    expect(repository.prepareClassificationContext).not.toHaveBeenCalledWith(41);
    expect(yieldControl).toHaveBeenCalledTimes(2);
    expect(repository.saveSuggestions).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sourceItemId: 42,
        suggestions: [expect.objectContaining({ topicId: null })],
      }),
    );
    expect(repository.confirmClassification).toHaveBeenCalledTimes(1);
    expect(repository.confirmClassification).toHaveBeenCalledWith(expect.objectContaining({
      sourceItemId: 43,
      topicId: 7,
    }));
  });

  it("stops historical upgrading as soon as the route is cancelled", async () => {
    const repository = {
      listTopics: vi.fn().mockResolvedValue([{ id: 7 }]),
      getPersonalCatalogProposal: vi.fn().mockResolvedValue(null),
      applyPersonalCatalog: vi.fn(),
      listInbox: vi.fn().mockResolvedValue([{ id: 51 }, { id: 52 }]),
      listClassificationRunSourceIds: vi.fn().mockResolvedValue([]),
      prepareClassificationContext: vi.fn().mockResolvedValue(context(51, 0.9)),
      saveSuggestions: vi.fn().mockResolvedValue([]),
      confirmClassification: vi.fn(),
    };
    const controller = new AbortController();
    const yieldControl = vi.fn().mockImplementation(async () => {
      controller.abort();
      return false;
    });

    const result = await upgradeOutdatedInboxSuggestions(repository as never, {
      signal: controller.signal,
      yieldControl,
    });

    expect(result.completed).toBe(0);
    expect(repository.prepareClassificationContext).not.toHaveBeenCalled();
    expect(repository.saveSuggestions).not.toHaveBeenCalled();
  });
});
