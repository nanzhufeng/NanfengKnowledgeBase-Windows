import type { AiTaxonomyRevision } from "./services/aiRepository";
import type {
  KnowledgeDomainRow,
  KnowledgeTopicRow,
} from "./services/knowledgeRepository";

function normalizeTopicName(value: string): string {
  return value.trim().toLocaleLowerCase("zh-CN");
}

/**
 * 两个核心入口唯一消费的正式 AI 分类树。
 * 原始 domains/topics 只提供已应用修订对应的持久化行，绝不作为旧分类回退。
 */
export type AppliedAiTaxonomyHierarchy = {
  domains: KnowledgeDomainRow[];
  topics: KnowledgeTopicRow[];
  topicIds: ReadonlySet<number>;
  hasAppliedRevision: boolean;
};

const EMPTY_APPLIED_AI_TAXONOMY_HIERARCHY: AppliedAiTaxonomyHierarchy = {
  domains: [],
  topics: [],
  topicIds: new Set<number>(),
  hasAppliedRevision: false,
};

export function getAppliedAiTaxonomyHierarchy(
  revision: AiTaxonomyRevision | null,
  domains: KnowledgeDomainRow[],
  topics: KnowledgeTopicRow[],
): AppliedAiTaxonomyHierarchy {
  if (revision?.status !== "applied") return EMPTY_APPLIED_AI_TAXONOMY_HIERARCHY;

  const domainByRevisionKey = new Map<string, KnowledgeDomainRow>();
  for (const revisionDomain of revision.domains) {
    const domain = domains.find((item) => normalizeTopicName(item.name) === normalizeTopicName(revisionDomain.name));
    if (domain) domainByRevisionKey.set(revisionDomain.key, domain);
  }

  const topicByRevisionKey = new Map<string, KnowledgeTopicRow>();
  const unresolved = new Map(revision.topics.map((topic) => [topic.key, topic]));
  while (unresolved.size) {
    let resolvedThisPass = false;
    for (const [key, revisionTopic] of unresolved) {
      const domain = domainByRevisionKey.get(revisionTopic.domainKey);
      if (!domain) {
        unresolved.delete(key);
        continue;
      }
      const parentId = revisionTopic.parentKey
        ? topicByRevisionKey.get(revisionTopic.parentKey)?.id
        : null;
      if (revisionTopic.parentKey && parentId === undefined) continue;
      const topic = topics.find((item) => (
        item.status === "active"
        && item.domainId === domain.id
        && item.parentTopicId === parentId
        && normalizeTopicName(item.name) === normalizeTopicName(revisionTopic.name)
      ));
      if (topic) topicByRevisionKey.set(key, topic);
      unresolved.delete(key);
      resolvedThisPass = true;
    }
    if (!resolvedThisPass) break;
  }

  const visibleTopics = revision.topics.flatMap((topic) => {
    const resolved = topicByRevisionKey.get(topic.key);
    return resolved ? [resolved] : [];
  });
  const visibleDomainIds = new Set(visibleTopics.map((topic) => topic.domainId));
  const visibleDomains = revision.domains.flatMap((revisionDomain) => {
    const resolved = domainByRevisionKey.get(revisionDomain.key);
    return resolved && visibleDomainIds.has(resolved.id) ? [resolved] : [];
  });

  return {
    domains: visibleDomains,
    topics: visibleTopics,
    topicIds: new Set(visibleTopics.map((topic) => topic.id)),
    hasAppliedRevision: true,
  };
}

export type AiTaxonomyIntegrationCoverage = {
  assignedTopicCount: number;
  completeTopicCount: number;
  incompleteTopicKeys: string[];
};

export function getAiTaxonomyIntegrationCoverage(
  revision: AiTaxonomyRevision | null,
): AiTaxonomyIntegrationCoverage {
  if (!revision) {
    return { assignedTopicCount: 0, completeTopicCount: 0, incompleteTopicKeys: [] };
  }

  const assignedSourcesByTopic = new Map<string, Set<number>>();
  for (const assignment of revision.assignments) {
    const sourceIds = assignedSourcesByTopic.get(assignment.topicKey) ?? new Set<number>();
    sourceIds.add(assignment.sourceItemId);
    assignedSourcesByTopic.set(assignment.topicKey, sourceIds);
  }

  const incompleteTopicKeys: string[] = [];
  let completeTopicCount = 0;
  for (const [topicKey, assignedSourceIds] of assignedSourcesByTopic) {
    const topic = revision.topics.find((item) => item.key === topicKey);
    const integrationSourceIds = new Set(topic?.sourceItemIds ?? []);
    const hasValidSources = integrationSourceIds.size === assignedSourceIds.size
      && [...integrationSourceIds].every((sourceId) => assignedSourceIds.has(sourceId));
    if (topic?.integrationMarkdown.trim() && hasValidSources) {
      completeTopicCount += 1;
    } else {
      incompleteTopicKeys.push(topicKey);
    }
  }

  return {
    assignedTopicCount: assignedSourcesByTopic.size,
    completeTopicCount,
    incompleteTopicKeys,
  };
}

export function findAppliedAiTaxonomyTopic(
  revision: AiTaxonomyRevision | null,
  topicName: string,
  sourceItemIds: number[],
): AiTaxonomyRevision["topics"][number] | null {
  if (!revision || revision.status !== "applied") return null;

  const normalizedName = normalizeTopicName(topicName);
  const exactNameMatch = revision.topics.find(
    (topic) => normalizeTopicName(topic.name) === normalizedName,
  );
  if (exactNameMatch) return exactNameMatch;

  const selectedSourceIds = new Set(sourceItemIds);
  const matchedTopicCounts = new Map<string, number>();
  for (const assignment of revision.assignments) {
    if (!selectedSourceIds.has(assignment.sourceItemId)) continue;
    matchedTopicCounts.set(
      assignment.topicKey,
      (matchedTopicCounts.get(assignment.topicKey) ?? 0) + 1,
    );
  }
  const matchedTopicKey = [...matchedTopicCounts.entries()]
    .sort((left, right) => right[1] - left[1])[0]?.[0];
  if (matchedTopicKey) {
    const matched = revision.topics.find((topic) => topic.key === matchedTopicKey);
    if (matched) return matched;
  }

  return null;
}
