import type { AiTopicBatchResult } from "./aiTopicBatch";
import type { AiModelSelection } from "./services/aiRepository";

const STORAGE_KEY = "nanfeng.ai-topic-batch-resume.v1";

export type AiTopicBatchResumeSnapshot = {
  version: 1;
  taxonomyRevisionPublicId: string;
  topicIds: number[];
  force: boolean;
  completedResult: AiTopicBatchResult;
  modelSelection: AiModelSelection;
  savedAt: string;
};

function isBatchResult(value: unknown): value is AiTopicBatchResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<AiTopicBatchResult>;
  return Number.isInteger(result.total)
    && Number.isInteger(result.succeeded)
    && Number.isInteger(result.failed)
    && Number.isInteger(result.skipped)
    && Array.isArray(result.failedTopics);
}

export function mergeAiTopicBatchResults(
  previous: AiTopicBatchResult | null,
  current: AiTopicBatchResult,
): AiTopicBatchResult {
  if (!previous) return current;
  return {
    total: previous.total + current.total,
    succeeded: previous.succeeded + current.succeeded,
    failed: previous.failed + current.failed,
    skipped: previous.skipped + current.skipped,
    failedTopics: [...previous.failedTopics, ...current.failedTopics],
  };
}

export function readAiTopicBatchResume(
  taxonomyRevisionPublicId: string,
): AiTopicBatchResumeSnapshot | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<AiTopicBatchResumeSnapshot>;
    if (
      value.version !== 1
      || value.taxonomyRevisionPublicId !== taxonomyRevisionPublicId
      || !Array.isArray(value.topicIds)
      || !value.topicIds.every((id) => Number.isInteger(id) && id > 0)
      || typeof value.force !== "boolean"
      || !isBatchResult(value.completedResult)
      || !value.modelSelection
      || typeof value.modelSelection.channel !== "string"
      || typeof value.modelSelection.modelId !== "string"
      || !value.modelSelection.modelId.trim()
      || typeof value.savedAt !== "string"
    ) return null;
    return value as AiTopicBatchResumeSnapshot;
  } catch {
    return null;
  }
}

export function saveAiTopicBatchResume(snapshot: AiTopicBatchResumeSnapshot): boolean {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return globalThis.localStorage?.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearAiTopicBatchResume(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // 存储不可用不影响已经写入数据库的主题洞察结果。
  }
}
