import { describe, expect, it, vi } from "vitest";
import {
  AiTopicBatchPaused,
  runAiTopicBatch,
  shouldRetryAiTopicError,
} from "./aiTopicBatch";

describe("一键 AI 整理全部主题", () => {
  it("按顺序逐个执行并让单主题失败保持隔离", async () => {
    const calls: number[] = [];
    const progress = vi.fn();
    const result = await runAiTopicBatch(
      [
        { id: 1, name: "主题一", status: "active" },
        { id: 2, name: "主题二", status: "active" },
        { id: 3, name: "已合并主题", status: "merged" },
        { id: 4, name: "主题四", status: "active" },
      ],
      async (topic) => {
        calls.push(topic.id);
        if (topic.id === 2) throw new Error("单主题失败");
      },
      progress,
    );

    expect(calls).toEqual([1, 2, 4]);
    expect(result).toEqual({
      total: 3,
      succeeded: 2,
      failed: 1,
      skipped: 1,
      failedTopics: [{ id: 2, name: "主题二", error: "单主题失败" }],
    });
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({
      completed: 3,
      succeeded: 2,
      failed: 1,
    }));
  });

  it("空主题集合直接完成且不发起请求", async () => {
    const runTopic = vi.fn(async () => undefined);
    const result = await runAiTopicBatch([], runTopic, vi.fn());

    expect(runTopic).not.toHaveBeenCalled();
    expect(result.total).toBe(0);
  });

  it("瞬时网络错误自动重试一次并保留逐项过程", async () => {
    const runTopic = vi.fn()
      .mockRejectedValueOnce(new Error("unexpected EOF during handshake"))
      .mockResolvedValueOnce(undefined);
    const progress = vi.fn();

    const result = await runAiTopicBatch(
      [{ id: 1, name: "网络重试主题", status: "active" }],
      runTopic,
      progress,
      { maxAttempts: 2, retryDelayMs: 0 },
    );

    expect(runTopic).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ succeeded: 1, failed: 0 });
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ status: "retrying", attempt: 1 })],
    }));
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ status: "succeeded", attempt: 2 })],
    }));
  });

  it("明确认证错误不盲目重试", async () => {
    const runTopic = vi.fn(async () => {
      throw new Error("AI 服务请求失败（HTTP 401）：User not found");
    });
    const result = await runAiTopicBatch(
      [{ id: 1, name: "认证失败主题", status: "active" }],
      runTopic,
      vi.fn(),
      { maxAttempts: 2, retryDelayMs: 0 },
    );

    expect(runTopic).toHaveBeenCalledTimes(1);
    expect(result.failedTopics[0]?.error).toContain("HTTP 401");
    expect(shouldRetryAiTopicError(new Error("operation timed out"))).toBe(true);
    expect(shouldRetryAiTopicError(new Error("HTTP 403"))).toBe(false);
  });

  it("当前主题保存后协作式暂停且只保留剩余队列", async () => {
    const calls: number[] = [];
    let pauseRequested = false;
    const run = runAiTopicBatch(
      [
        { id: 1, name: "主题一", status: "active" },
        { id: 2, name: "主题二", status: "active" },
        { id: 3, name: "主题三", status: "active" },
      ],
      async (topic) => {
        calls.push(topic.id);
        pauseRequested = true;
      },
      vi.fn(),
      { shouldPause: () => pauseRequested },
    );

    await expect(run).rejects.toBeInstanceOf(AiTopicBatchPaused);
    try {
      await run;
    } catch (error) {
      const paused = error as AiTopicBatchPaused<{ id: number; name: string; status: string }>;
      expect(paused.remainingTopics.map((topic) => topic.id)).toEqual([2, 3]);
      expect(paused.completedResult).toMatchObject({ total: 1, succeeded: 1, failed: 0 });
    }
    expect(calls).toEqual([1]);
  });

  it("重试等待前收到暂停时不再发起第二次请求", async () => {
    let pauseRequested = false;
    const runTopic = vi.fn(async () => {
      pauseRequested = true;
      throw new Error("operation timed out");
    });
    const run = runAiTopicBatch(
      [{ id: 7, name: "待重试主题", status: "active" }],
      runTopic,
      vi.fn(),
      { maxAttempts: 2, shouldPause: () => pauseRequested },
    );

    await expect(run).rejects.toMatchObject({
      remainingTopics: [{ id: 7, name: "待重试主题", status: "active" }],
    });
    expect(runTopic).toHaveBeenCalledTimes(1);
  });
});
