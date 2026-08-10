export type AiBatchTopic = {
  id: number;
  name: string;
  status: string;
};

export type AiTopicBatchProgress = {
  current: number;
  completed: number;
  total: number;
  succeeded: number;
  failed: number;
  topicId: number;
  topicName: string;
  items: AiTopicBatchItemProgress[];
};

export type AiTopicBatchItemStatus = "pending" | "running" | "retrying" | "succeeded" | "failed";

export type AiTopicBatchItemProgress = {
  id: number;
  name: string;
  status: AiTopicBatchItemStatus;
  attempt: number;
  maxAttempts: number;
  error: string | null;
};

export type AiTopicBatchResult = {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  failedTopics: Array<{ id: number; name: string; error: string }>;
};

function batchErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  return "未知错误";
}

export function shouldRetryAiTopicError(error: unknown): boolean {
  const message = batchErrorMessage(error).toLocaleLowerCase("zh-CN");
  if (/http\s*(401|403)|user not found|无权|未授权|api key/.test(message)) return false;
  return /http\s*(408|409|425|429|5\d\d)|timeout|timed out|超时|unexpected eof|connection|connect|handshake|request or response body|error sending request|error reading a body|无法解析的数据|不符合主题洞察结构|缺少正文|主题总结为空/.test(message);
}

function wait(delayMs: number): Promise<void> {
  if (delayMs <= 0) return Promise.resolve();
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
}

type AiTopicBatchOptions = {
  maxAttempts?: number;
  retryDelayMs?: number;
  betweenTopicsDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
};

export async function runAiTopicBatch<T extends AiBatchTopic>(
  topics: T[],
  runTopic: (topic: T) => Promise<void>,
  onProgress: (progress: AiTopicBatchProgress) => void,
  options: AiTopicBatchOptions = {},
): Promise<AiTopicBatchResult> {
  const candidates = topics.filter((topic) => topic.status !== "merged");
  const maxAttempts = Math.max(1, options.maxAttempts ?? 1);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 0);
  const betweenTopicsDelayMs = Math.max(0, options.betweenTopicsDelayMs ?? 0);
  const shouldRetry = options.shouldRetry ?? shouldRetryAiTopicError;
  let succeeded = 0;
  let failed = 0;
  const failedTopics: Array<{ id: number; name: string; error: string }> = [];
  let items: AiTopicBatchItemProgress[] = candidates.map((topic) => ({
    id: topic.id,
    name: topic.name,
    status: "pending",
    attempt: 0,
    maxAttempts,
    error: null,
  }));

  const report = (index: number, completed: number) => {
    const topic = candidates[index];
    onProgress({
      current: candidates.length ? index + 1 : 0,
      completed,
      total: candidates.length,
      succeeded,
      failed,
      topicId: topic?.id ?? 0,
      topicName: topic?.name ?? "准备开始",
      items,
    });
  };

  report(0, 0);

  for (const [index, topic] of candidates.entries()) {
    let completed = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      items = items.map((item) => item.id === topic.id ? {
        ...item,
        status: attempt === 1 ? "running" : "retrying",
        attempt,
      } : item);
      report(index, index);
      try {
        await runTopic(topic);
        succeeded += 1;
        items = items.map((item) => item.id === topic.id ? {
          ...item,
          status: "succeeded",
          error: null,
        } : item);
        completed = true;
        break;
      } catch (error) {
        const errorMessage = batchErrorMessage(error);
        if (attempt < maxAttempts && shouldRetry(error)) {
          items = items.map((item) => item.id === topic.id ? {
            ...item,
            status: "retrying",
            error: errorMessage,
          } : item);
          report(index, index);
          await wait(retryDelayMs * attempt);
          continue;
        }
        failed += 1;
        failedTopics.push({ id: topic.id, name: topic.name, error: errorMessage });
        items = items.map((item) => item.id === topic.id ? {
          ...item,
          status: "failed",
          error: errorMessage,
        } : item);
        completed = true;
        break;
      }
    }
    if (completed) report(index, index + 1);
    if (index < candidates.length - 1) await wait(betweenTopicsDelayMs);
  }

  return {
    total: candidates.length,
    succeeded,
    failed,
    skipped: topics.length - candidates.length,
    failedTopics,
  };
}
