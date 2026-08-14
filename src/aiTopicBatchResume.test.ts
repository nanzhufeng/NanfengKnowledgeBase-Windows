import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAiTopicBatchResume,
  mergeAiTopicBatchResults,
  readAiTopicBatchResume,
  saveAiTopicBatchResume,
} from "./aiTopicBatchResume";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("AI 主题批量整理暂停快照", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("只为相同分类修订恢复剩余主题和冻结模型", () => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    const snapshot = {
      version: 1 as const,
      taxonomyRevisionPublicId: "revision-a",
      topicIds: [2, 3],
      force: true,
      completedResult: {
        total: 1,
        succeeded: 1,
        failed: 0,
        skipped: 0,
        failedTopics: [],
      },
      modelSelection: { channel: "qwen_direct" as const, modelId: "qwen3.7-flash" },
      savedAt: "2026-08-14T00:00:00.000Z",
    };

    expect(saveAiTopicBatchResume(snapshot)).toBe(true);
    expect(readAiTopicBatchResume("revision-a")).toEqual(snapshot);
    expect(readAiTopicBatchResume("revision-b")).toBeNull();
    clearAiTopicBatchResume();
    expect(readAiTopicBatchResume("revision-a")).toBeNull();
  });

  it("续跑结果与暂停前完成量合并且不重复计算", () => {
    expect(mergeAiTopicBatchResults(
      { total: 2, succeeded: 1, failed: 1, skipped: 1, failedTopics: [{ id: 2, name: "B", error: "失败" }] },
      { total: 3, succeeded: 3, failed: 0, skipped: 0, failedTopics: [] },
    )).toEqual({
      total: 5,
      succeeded: 4,
      failed: 1,
      skipped: 1,
      failedTopics: [{ id: 2, name: "B", error: "失败" }],
    });
  });
});
