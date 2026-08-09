import {
  CLASSIFIER_ALGORITHM_VERSION,
} from "../knowledge/deterministicClassifier";
import type { ClassificationResult } from "../knowledge/domain";
import {
  KnowledgeRepository,
  type KnowledgeClassificationSuggestionRow,
} from "./knowledgeRepository";
import { yieldToInteraction } from "../performance/interactionScheduler";
import { classifySourceAsync } from "./classificationWorker";

type AutoOrganizationRepository = Pick<
  KnowledgeRepository,
  | "listInbox"
  | "listTopics"
  | "getPersonalCatalogProposal"
  | "applyPersonalCatalog"
  | "prepareClassificationContext"
  | "saveSuggestions"
  | "listClassificationRunSourceIds"
  | "confirmClassification"
>;

export type KnowledgeAutoOrganizationResult = {
  analyzedCount: number;
  autoClassifiedCount: number;
  awaitingConfirmationCount: number;
  unmatchedCount: number;
  catalogBootstrapped: boolean;
  operationIds: number[];
  failures: string[];
};

async function ensureEditableTopicCatalog(
  repository: AutoOrganizationRepository,
): Promise<{ catalogBootstrapped: boolean; hasTopics: boolean }> {
  const existingTopics = await repository.listTopics();
  const proposal = await repository.getPersonalCatalogProposal();
  if (proposal) await repository.applyPersonalCatalog(proposal.version);
  const topics = proposal ? await repository.listTopics() : existingTopics;
  return {
    catalogBootstrapped: existingTopics.length === 0 && topics.length > 0,
    hasTopics: topics.length > 0,
  };
}

function persistedTopSuggestion(
  rows: KnowledgeClassificationSuggestionRow[],
  topicId: number,
) {
  return rows.find((row) => row.suggestedTopicId === topicId) ?? null;
}

export function suggestionsForPersistence(
  classification: ClassificationResult,
) {
  if (!classification.suggestions.length) {
    // 空结果也持久化为“本版本已完成”的哨兵行，避免每次打开同一来源都重复计算。
    return [{
      topicId: null,
      score: 0,
      decision: "manual",
      reasons: ["本版分类已完成，但当前目录没有证据充分的自动建议"],
      signalScoresJson: "{}",
    }];
  }
  return classification.suggestions.slice(0, 5).map((suggestion) => ({
    topicId: Number(suggestion.topicId),
    score: suggestion.confidence,
    decision: suggestion.action,
    reasons: suggestion.reasons,
    signalScoresJson: JSON.stringify(suggestion.signalScores),
  }));
}

export async function autoOrganizeImportedSources(
  sourceItemIds: number[],
  repository: AutoOrganizationRepository = new KnowledgeRepository(),
): Promise<KnowledgeAutoOrganizationResult> {
  const result: KnowledgeAutoOrganizationResult = {
    analyzedCount: 0,
    autoClassifiedCount: 0,
    awaitingConfirmationCount: 0,
    unmatchedCount: 0,
    catalogBootstrapped: false,
    operationIds: [],
    failures: [],
  };
  const uniqueSourceIds = [...new Set(sourceItemIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!uniqueSourceIds.length) return result;

  const catalog = await ensureEditableTopicCatalog(repository);
  result.catalogBootstrapped = catalog.catalogBootstrapped;
  if (!catalog.hasTopics) {
    result.failures.push("尚无可用主题，来源已保留在全部笔记中待确认");
    return result;
  }

  for (const sourceItemId of uniqueSourceIds) {
    try {
      const context = await repository.prepareClassificationContext(sourceItemId);
      const classification = await classifySourceAsync(context);
      const top = classification.suggestions[0];
      const persisted = await repository.saveSuggestions({
        sourceItemId,
        classifierVersion: CLASSIFIER_ALGORITHM_VERSION,
        suggestions: suggestionsForPersistence(classification),
      });
      result.analyzedCount += 1;
      if (!top) {
        result.unmatchedCount += 1;
        continue;
      }
      // 分类器只会返回达到直接证据门槛的候选。严格超过 65 分的最高候选
      // 才自动写入可撤销的主主题关联；其余候选只保存解释和核对入口。
      if (top.action !== "auto_eligible") {
        result.awaitingConfirmationCount += 1;
        continue;
      }
      const savedTop = persistedTopSuggestion(persisted, Number(top.topicId));
      const operation = await repository.confirmClassification({
        sourceItemId,
        topicId: Number(top.topicId),
        suggestionId: savedTop?.id ?? null,
        confidence: top.confidence,
      });
      result.operationIds.push(operation.operationId);
      result.autoClassifiedCount += 1;
    } catch (error) {
      result.failures.push(
        error instanceof Error ? error.message : `来源 ${sourceItemId} 自动分类失败`,
      );
    }
  }
  return result;
}

export type ClassificationUpgradeProgress = {
  completed: number;
  total: number;
  matched: number;
  unmatched: number;
  failures: number;
};

export type ClassificationUpgradeOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: ClassificationUpgradeProgress) => void;
  yieldControl?: (signal?: AbortSignal) => Promise<boolean>;
};

export async function upgradeOutdatedInboxSuggestions(
  repository: AutoOrganizationRepository = new KnowledgeRepository(),
  options: ClassificationUpgradeOptions = {},
): Promise<ClassificationUpgradeProgress> {
  const {
    signal,
    onProgress,
    yieldControl = yieldToInteraction,
  } = options;
  if (signal?.aborted) {
    return { completed: 0, total: 0, matched: 0, unmatched: 0, failures: 0 };
  }
  const catalog = await ensureEditableTopicCatalog(repository);
  if (!catalog.hasTopics) {
    return { completed: 0, total: 0, matched: 0, unmatched: 0, failures: 1 };
  }
  const [inbox, completedIds] = await Promise.all([
    repository.listInbox(2_000),
    repository.listClassificationRunSourceIds(CLASSIFIER_ALGORITHM_VERSION),
  ]);
  const completedSet = new Set(completedIds);
  const pendingIds = inbox
    .map((item) => item.id)
    .filter((sourceItemId) => !completedSet.has(sourceItemId));
  const progress: ClassificationUpgradeProgress = {
    completed: 0,
    total: pendingIds.length,
    matched: 0,
    unmatched: 0,
    failures: 0,
  };
  onProgress?.({ ...progress });

  for (const sourceItemId of pendingIds) {
    // 每条历史来源都是独立工作单元。先让出主线程，再开始下一条，避免批量分类
    // 在 WebView 上形成连续长任务并抢占点击、滚动和选择反馈。
    if (!await yieldControl(signal)) break;
    try {
      const context = await repository.prepareClassificationContext(sourceItemId);
      const classification = await classifySourceAsync(context);
      const persisted = await repository.saveSuggestions({
        sourceItemId,
        classifierVersion: CLASSIFIER_ALGORITHM_VERSION,
        suggestions: suggestionsForPersistence(classification),
      });
      const top = classification.suggestions[0];
      if (top) {
        progress.matched += 1;
        if (top.action === "auto_eligible") {
          const savedTop = persistedTopSuggestion(persisted, Number(top.topicId));
          await repository.confirmClassification({
            sourceItemId,
            topicId: Number(top.topicId),
            suggestionId: savedTop?.id ?? null,
            confidence: top.confidence,
          });
        }
      } else {
        progress.unmatched += 1;
      }
    } catch {
      progress.failures += 1;
    }
    progress.completed += 1;
    if (progress.completed % 25 === 0 || progress.completed === progress.total) {
      onProgress?.({ ...progress });
    }
  }
  return progress;
}

export async function undoAutoOrganization(
  operationIds: number[],
  repository: Pick<KnowledgeRepository, "undoClassification"> = new KnowledgeRepository(),
) {
  for (const operationId of [...operationIds].reverse()) {
    await repository.undoClassification(operationId);
  }
}
