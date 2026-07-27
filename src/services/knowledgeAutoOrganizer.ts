import {
  CLASSIFIER_ALGORITHM_VERSION,
  classifySource,
} from "../knowledge/deterministicClassifier";
import {
  KnowledgeRepository,
  type KnowledgeClassificationSuggestionRow,
} from "./knowledgeRepository";

type AutoOrganizationRepository = Pick<
  KnowledgeRepository,
  | "listTopics"
  | "getPersonalCatalogProposal"
  | "applyPersonalCatalog"
  | "prepareClassificationContext"
  | "saveSuggestions"
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
    result.failures.push("尚无可用主题，来源已保留在收录箱");
    return result;
  }

  for (const sourceItemId of uniqueSourceIds) {
    try {
      const context = await repository.prepareClassificationContext(sourceItemId);
      const classification = classifySource(context);
      const top = classification.suggestions[0];
      const persisted = await repository.saveSuggestions({
        sourceItemId,
        classifierVersion: CLASSIFIER_ALGORITHM_VERSION,
        suggestions: classification.suggestions.slice(0, 5).map((suggestion) => ({
          topicId: Number(suggestion.topicId),
          score: suggestion.confidence,
          decision: suggestion.action,
          reasons: suggestion.reasons,
          signalScoresJson: JSON.stringify(suggestion.signalScores),
        })),
      });
      result.analyzedCount += 1;
      if (!top) {
        result.unmatchedCount += 1;
        continue;
      }
      if (top.action === "auto_eligible") {
        const savedTop = persistedTopSuggestion(persisted, Number(top.topicId));
        const operation = await repository.confirmClassification({
          sourceItemId,
          topicId: Number(top.topicId),
          suggestionId: savedTop?.id ?? null,
          confidence: top.confidence,
        });
        result.operationIds.push(operation.operationId);
        result.autoClassifiedCount += 1;
      } else {
        result.awaitingConfirmationCount += 1;
      }
    } catch (error) {
      result.failures.push(
        error instanceof Error ? error.message : `来源 ${sourceItemId} 自动分类失败`,
      );
    }
  }
  return result;
}

export async function undoAutoOrganization(
  operationIds: number[],
  repository: Pick<KnowledgeRepository, "undoClassification"> = new KnowledgeRepository(),
) {
  for (const operationId of [...operationIds].reverse()) {
    await repository.undoClassification(operationId);
  }
}
