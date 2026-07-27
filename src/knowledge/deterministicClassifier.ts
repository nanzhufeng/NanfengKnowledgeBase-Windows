import {
  classificationSignalWeights,
  decideClassificationAction,
  type ClassificationContext,
  type ClassificationResult,
  type ClassificationRule,
  type ClassificationSignalKey,
  type ClassificationSignalScore,
  type ClassificationSuggestion,
  type KnowledgeSourceDraft,
  type KnowledgeTopicCandidate,
} from "./domain";

export const CLASSIFIER_ALGORITHM_VERSION = "local-rules-v1";

type SignalEvaluation = {
  normalizedScore: number;
  reasons: string[];
};

const signalLabels: Record<ClassificationSignalKey, string> = {
  explicit_rules: "显式规则",
  aliases_entities: "别名与实体",
  full_text: "全文相关",
  set_similarity: "集合相似",
  history: "时间历史",
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u3000\s]+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  const normalized = normalizeText(value);
  const tokens = new Set<string>();
  for (const word of normalized.match(/[a-z0-9][a-z0-9+._-]*/g) ?? []) {
    tokens.add(word);
  }
  const chineseRuns = normalized.match(/[\u3400-\u9fff]+/g) ?? [];
  for (const run of chineseRuns) {
    if (run.length === 1) tokens.add(run);
    for (let index = 0; index < run.length - 1; index += 1) {
      tokens.add(run.slice(index, index + 2));
    }
  }
  return tokens;
}

function diceSimilarity(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return (2 * overlap) / (left.size + right.size);
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap / (left.size + right.size - overlap);
}

function sourceFieldValues(source: KnowledgeSourceDraft, rule: ClassificationRule): string[] {
  switch (rule.field) {
    case "title":
      return [source.title];
    case "text":
      return [source.text];
    case "platform":
      return [source.platform ?? ""];
    case "source_kind":
      return [source.kind];
    case "file_name":
      return [source.fileName ?? ""];
    case "file_path":
      return [source.filePath ?? ""];
    case "folder_path":
      return [source.folderPath ?? ""];
    case "tag":
      return source.tags ?? [];
    case "json_field":
      return rule.jsonField ? [source.jsonFields?.[rule.jsonField] ?? ""] : [];
  }
}

function ruleMatches(source: KnowledgeSourceDraft, rule: ClassificationRule): boolean {
  const expected = normalizeText(rule.value);
  return sourceFieldValues(source, rule).some((rawValue) => {
    const value = normalizeText(rawValue);
    return rule.operator === "equals" ? value === expected : value.includes(expected);
  });
}

function evaluateExplicitRules(
  source: KnowledgeSourceDraft,
  topic: KnowledgeTopicCandidate,
  rules: ClassificationRule[],
): SignalEvaluation {
  const matched = rules.filter(
    (rule) => rule.enabled && rule.topicId === topic.id && ruleMatches(source, rule),
  );
  if (!matched.length) return { normalizedScore: 0, reasons: [] };
  return {
    normalizedScore: clamp01(Math.max(...matched.map((rule) => rule.strength))),
    reasons: matched.map((rule) => rule.reason),
  };
}

function evaluateAliasesAndEntities(
  source: KnowledgeSourceDraft,
  topic: KnowledgeTopicCandidate,
): SignalEvaluation {
  const title = normalizeText(source.title);
  const text = normalizeText(`${source.title} ${source.text}`);
  const candidates = [topic.name, ...topic.aliases, ...topic.entities]
    .map((value) => normalizeText(value))
    .filter(Boolean);
  const titleHits = candidates.filter((candidate) => title.includes(candidate));
  const textHits = candidates.filter((candidate) => !title.includes(candidate) && text.includes(candidate));
  const normalizedScore = clamp01(titleHits.length * 0.72 + textHits.length * 0.22);
  const reasons: string[] = [];
  if (titleHits.length) reasons.push(`标题命中：${titleHits.slice(0, 3).join("、")}`);
  if (textHits.length) reasons.push(`正文实体命中：${textHits.slice(0, 4).join("、")}`);
  return { normalizedScore, reasons };
}

function evaluateFullText(
  source: KnowledgeSourceDraft,
  topic: KnowledgeTopicCandidate,
  externalScore?: number,
  externalReason?: string,
): SignalEvaluation {
  if (externalScore !== undefined) {
    return {
      normalizedScore: clamp01(externalScore),
      reasons: [externalReason ?? "来自本地 FTS5/BM25 的归一化相关度"],
    };
  }
  const topicTitleTokens = tokenSet([topic.name, ...topic.aliases, ...topic.keywords].join(" "));
  const topicDocumentTokens = tokenSet(`${topic.searchDocument} ${topic.entities.join(" ")}`);
  const titleScore = diceSimilarity(tokenSet(source.title), topicTitleTokens);
  const documentScore = diceSimilarity(tokenSet(source.text), topicDocumentTokens);
  const normalizedScore = clamp01(titleScore * 0.62 + documentScore * 0.38);
  return {
    normalizedScore,
    reasons: normalizedScore > 0.12 ? [`本地全文相似度 ${Math.round(normalizedScore * 100)}%`] : [],
  };
}

function evaluateSetSimilarity(
  source: KnowledgeSourceDraft,
  topic: KnowledgeTopicCandidate,
): SignalEvaluation {
  const sourceTokens = tokenSet(`${source.title} ${source.text} ${(source.tags ?? []).join(" ")}`);
  const topicTokens = tokenSet(`${topic.name} ${topic.aliases.join(" ")} ${topic.keywords.join(" ")}`);
  const score = jaccardSimilarity(sourceTokens, topicTokens);
  return {
    normalizedScore: clamp01(score * 2.4),
    reasons: score > 0.08 ? [`关键词集合重合率 ${Math.round(score * 100)}%`] : [],
  };
}

function evaluateHistory(
  context: ClassificationContext,
  topic: KnowledgeTopicCandidate,
): SignalEvaluation {
  let score = 0;
  const reasons: string[] = [];
  const confirmedCount = context.history.confirmedTopicCounts[topic.id] ?? 0;
  if (confirmedCount > 0) {
    score += Math.min(0.5, confirmedCount * 0.1);
    reasons.push(`历史上已确认归入该主题 ${confirmedCount} 次`);
  }
  if (context.history.recentTopicIds.includes(topic.id)) {
    score += 0.3;
    reasons.push("该主题近期处于活跃研究状态");
  }
  if (
    context.source.batchId &&
    context.history.batchTopicIds[context.source.batchId]?.includes(topic.id)
  ) {
    score += 0.35;
    reasons.push("同批资料已有内容归入该主题");
  }
  return { normalizedScore: clamp01(score), reasons };
}

function toSignalScore(
  key: ClassificationSignalKey,
  evaluation: SignalEvaluation,
): ClassificationSignalScore {
  const weight = classificationSignalWeights[key];
  return {
    key,
    label: signalLabels[key],
    normalizedScore: round(evaluation.normalizedScore, 4),
    weight,
    contributedPoints: round(evaluation.normalizedScore * weight),
    reasons: evaluation.reasons,
  };
}

function scoreTopic(context: ClassificationContext, topic: KnowledgeTopicCandidate): ClassificationSuggestion {
  const externalSearch = context.searchSignals?.find((signal) => signal.topicId === topic.id);
  const signalScores = [
    toSignalScore(
      "explicit_rules",
      evaluateExplicitRules(context.source, topic, context.rules),
    ),
    toSignalScore(
      "aliases_entities",
      evaluateAliasesAndEntities(context.source, topic),
    ),
    toSignalScore(
      "full_text",
      evaluateFullText(
        context.source,
        topic,
        externalSearch?.normalizedScore,
        externalSearch?.reason,
      ),
    ),
    toSignalScore(
      "set_similarity",
      evaluateSetSimilarity(context.source, topic),
    ),
    toSignalScore("history", evaluateHistory(context, topic)),
  ];
  const confidence = round(
    signalScores.reduce((total, signal) => total + signal.contributedPoints, 0),
  );
  return {
    topicId: topic.id,
    topicPath: topic.path,
    confidence,
    action: decideClassificationAction(confidence),
    signalScores,
    reasons: signalScores.flatMap((signal) => signal.reasons),
  };
}

export function classifySource(
  context: ClassificationContext,
  generatedAt = context.source.importedAt,
): ClassificationResult {
  const totalWeight = Object.values(classificationSignalWeights).reduce(
    (total, weight) => total + weight,
    0,
  );
  if (totalWeight !== 100) {
    throw new Error(`分类权重总和必须为 100，当前为 ${totalWeight}`);
  }
  const topicIds = new Set<string>();
  for (const topic of context.topics) {
    if (topicIds.has(topic.id)) throw new Error(`主题 ID 重复：${topic.id}`);
    topicIds.add(topic.id);
  }
  for (const rule of context.rules) {
    if (!topicIds.has(rule.topicId)) throw new Error(`分类规则指向不存在的主题：${rule.topicId}`);
    if (rule.strength < 0 || rule.strength > 1) {
      throw new Error(`分类规则强度必须位于 0 到 1：${rule.id}`);
    }
  }

  return {
    algorithmVersion: CLASSIFIER_ALGORITHM_VERSION,
    sourceId: context.source.id,
    generatedAt,
    suggestions: context.topics
      .filter((topic) => topic.status !== "archived")
      .map((topic) => scoreTopic(context, topic))
      .sort((left, right) => {
        if (right.confidence !== left.confidence) return right.confidence - left.confidence;
        return left.topicId.localeCompare(right.topicId);
      }),
  };
}
