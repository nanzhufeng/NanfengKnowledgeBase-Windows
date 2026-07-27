import {
  classificationSignalWeights,
  classificationThresholds,
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

export const CLASSIFIER_ALGORITHM_VERSION = "local-rules-v5";

type SignalEvaluation = {
  normalizedScore: number;
  reasons: string[];
};

type SourceEvaluationCache = {
  normalizedTitle: string;
  normalizedLeadBody: string;
  compactTitle: string;
  compactLeadBody: string;
  normalizedContent: string;
  titleTokens: Set<string>;
  leadBodyTokens: Set<string>;
  sourceSetTokens: Set<string>;
};

type RuleMatchLocation = "title" | "lead_body" | "metadata";

const rulePhraseCache = new Map<string, {
  normalized: string;
  compactLength: number;
  tokens: Set<string>;
}>();

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

function compactText(value: string): string {
  return value.replace(/\s+/g, "");
}

function semanticIncludes(value: string, expected: string, compactValue?: string): boolean {
  if (value.includes(expected)) return true;
  const compactExpected = compactText(expected);
  return compactExpected.length >= 3
    && (compactValue ?? compactText(value)).includes(compactExpected);
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

function rulePhraseProfile(value: string) {
  const cached = rulePhraseCache.get(value);
  if (cached) return cached;
  const normalized = normalizeText(value);
  const profile = {
    normalized,
    compactLength: Array.from(compactText(normalized)).length,
    tokens: tokenSet(normalized),
  };
  rulePhraseCache.set(value, profile);
  return profile;
}

function coreTextLead(value: string, limit = 12_000): string {
  return value.slice(0, limit);
}

function createSourceEvaluationCache(source: KnowledgeSourceDraft): SourceEvaluationCache {
  const normalizedTitle = normalizeText(source.title);
  const leadBody = coreTextLead(source.text);
  const normalizedLeadBody = normalizeText(leadBody);
  return {
    normalizedTitle,
    normalizedLeadBody,
    compactTitle: compactText(normalizedTitle),
    compactLeadBody: compactText(normalizedLeadBody),
    normalizedContent: `${normalizedTitle} ${normalizedLeadBody}`.trim(),
    titleTokens: tokenSet(source.title),
    leadBodyTokens: tokenSet(leadBody),
    sourceSetTokens: tokenSet(`${leadBody} ${(source.tags ?? []).join(" ")}`),
  };
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

function normalizedSourceFieldValues(
  source: KnowledgeSourceDraft,
  rule: ClassificationRule,
  cache: SourceEvaluationCache,
): Array<{ value: string; compactValue?: string; location: RuleMatchLocation }> {
  switch (rule.field) {
    case "title":
      return [{
        value: cache.normalizedTitle,
        compactValue: cache.compactTitle,
        location: "title",
      }];
    case "text":
      // 标题是最高密度的主题证据；正文只读取开头核心段，避免长对话后半段的
      // 偶然词汇反客为主。
      return [
        {
          value: cache.normalizedTitle,
          compactValue: cache.compactTitle,
          location: "title",
        },
        {
          value: cache.normalizedLeadBody,
          compactValue: cache.compactLeadBody,
          location: "lead_body",
        },
      ];
    case "platform":
      return [{ value: normalizeText(source.platform ?? ""), location: "metadata" }];
    case "source_kind":
      return [{ value: normalizeText(source.kind), location: "metadata" }];
    case "file_name":
      return [{ value: normalizeText(source.fileName ?? ""), location: "metadata" }];
    case "file_path":
      return [{ value: normalizeText(source.filePath ?? ""), location: "metadata" }];
    case "folder_path":
      return [{ value: normalizeText(source.folderPath ?? ""), location: "metadata" }];
    case "tag":
      return (source.tags ?? []).map((value) => ({
        value: normalizeText(value),
        location: "metadata" as const,
      }));
    case "json_field":
      return rule.jsonField
        ? [{
            value: normalizeText(source.jsonFields?.[rule.jsonField] ?? ""),
            location: "metadata",
          }]
        : [];
  }
}

function ruleMatchLocation(
  source: KnowledgeSourceDraft,
  rule: ClassificationRule,
  cache: SourceEvaluationCache,
): RuleMatchLocation | null {
  const profile = rulePhraseProfile(rule.value);
  const expected = profile.normalized;
  const expectedLength = profile.compactLength;
  const match = normalizedSourceFieldValues(source, rule, cache).find(({
    value,
    compactValue,
    location,
  }) => {
    if (rule.operator === "equals") return value === expected;
    if (semanticIncludes(value, expected, compactValue)) return true;
    if (location !== "title" || expectedLength < 4) return false;
    const titleLength = Array.from(cache.compactTitle).length;
    if (titleLength > expectedLength * 2.5) return false;
    // 允许“转成带中文的版本”匹配“转成中文版本”这类标题内插变体，
    // 但只在短标题和高双字重合时启用，不对长正文做模糊命中。
    return diceSimilarity(cache.titleTokens, profile.tokens) >= 0.62;
  });
  return match?.location ?? null;
}

function evaluateExplicitRules(
  source: KnowledgeSourceDraft,
  rules: ClassificationRule[],
  cache: SourceEvaluationCache,
): SignalEvaluation {
  const matched = rules
    .filter((rule) => rule.enabled)
    .map((rule) => ({ rule, location: ruleMatchLocation(source, rule, cache) }))
    .filter((item): item is { rule: ClassificationRule; location: RuleMatchLocation } =>
      item.location !== null);
  if (!matched.length) return { normalizedScore: 0, reasons: [] };
  const included = matched.filter(({ rule }) => rule.effect !== "exclude");
  const excluded = matched.filter(({ rule }) => rule.effect === "exclude");
  const includedStrengths = included.map(({ rule, location }) =>
    rule.strength * (location === "lead_body" ? 0.68 : 1));
  const includedStrength = includedStrengths.length
    ? Math.min(
        1,
        Math.max(...includedStrengths)
          + Math.min(0.24, Math.max(0, includedStrengths.length - 1) * 0.12),
      )
    : 0;
  const excludedStrength = excluded.length
    ? Math.max(...excluded.map(({ rule }) => rule.strength))
    : 0;
  return {
    normalizedScore: Math.max(-1, Math.min(1, includedStrength - excludedStrength)),
    reasons: [
      ...included.map(({ rule, location }) =>
        `${location === "title" ? "标题主题短语" : location === "lead_body" ? "正文核心段" : "来源元数据"}：${rule.reason}`),
      ...excluded.map(({ rule }) => `排除规则：${rule.reason}`),
    ],
  };
}

function evaluateAliasesAndEntities(
  topic: KnowledgeTopicCandidate,
  cache: SourceEvaluationCache,
): SignalEvaluation {
  const candidates = [topic.name, ...topic.aliases, ...topic.entities, ...topic.keywords]
    .map((value) => normalizeText(value))
    .filter(Boolean);
  const titleHits = candidates.filter((candidate) =>
    semanticIncludes(cache.normalizedTitle, candidate, cache.compactTitle));
  const textHits = candidates.filter(
    (candidate) =>
      !semanticIncludes(cache.normalizedTitle, candidate, cache.compactTitle)
      && semanticIncludes(cache.normalizedLeadBody, candidate, cache.compactLeadBody),
  );
  const fuzzyTitleSimilarity = titleHits.length
    ? 0
    : Math.max(
        0,
        ...candidates
          .map((candidate) => rulePhraseProfile(candidate))
          .filter((profile) => profile.compactLength >= 4)
          .map((profile) => diceSimilarity(cache.titleTokens, profile.tokens)),
      );
  const fuzzyTitleScore = fuzzyTitleSimilarity >= 0.62 ? 0.58 : 0;
  const normalizedScore = clamp01(
    titleHits.length * 0.76 + fuzzyTitleScore + textHits.length * 0.14,
  );
  const reasons: string[] = [];
  if (titleHits.length) reasons.push(`标题命中：${titleHits.slice(0, 3).join("、")}`);
  if (fuzzyTitleScore) {
    reasons.push(`标题与主题短语高度相似 ${Math.round(fuzzyTitleSimilarity * 100)}%`);
  }
  if (textHits.length) reasons.push(`正文实体命中：${textHits.slice(0, 4).join("、")}`);
  return { normalizedScore, reasons };
}

function evaluateFullText(
  topic: KnowledgeTopicCandidate,
  cache: SourceEvaluationCache,
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
  const titleScore = diceSimilarity(cache.titleTokens, topicTitleTokens);
  const documentScore = diceSimilarity(cache.leadBodyTokens, topicDocumentTokens);
  const normalizedScore = clamp01(titleScore * 0.72 + documentScore * 0.28);
  return {
    normalizedScore,
    reasons: normalizedScore > 0.12 ? [`本地全文相似度 ${Math.round(normalizedScore * 100)}%`] : [],
  };
}

function evaluateSetSimilarity(
  topic: KnowledgeTopicCandidate,
  cache: SourceEvaluationCache,
): SignalEvaluation {
  const topicTokens = tokenSet(`${topic.name} ${topic.aliases.join(" ")} ${topic.keywords.join(" ")}`);
  const titleScore = jaccardSimilarity(cache.titleTokens, topicTokens);
  const bodyScore = jaccardSimilarity(cache.sourceSetTokens, topicTokens);
  const score = Math.max(titleScore * 1.8, bodyScore);
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

function scoreTopic(
  context: ClassificationContext,
  topic: KnowledgeTopicCandidate,
  topicRules: ClassificationRule[],
  sourceCache: SourceEvaluationCache,
): ClassificationSuggestion {
  const externalSearch = context.searchSignals?.find((signal) => signal.topicId === topic.id);
  const signalScores = [
    toSignalScore(
      "explicit_rules",
      evaluateExplicitRules(context.source, topicRules, sourceCache),
    ),
    toSignalScore(
      "aliases_entities",
      evaluateAliasesAndEntities(topic, sourceCache),
    ),
    toSignalScore(
      "full_text",
      evaluateFullText(
        topic,
        sourceCache,
        externalSearch?.normalizedScore,
        externalSearch?.reason,
      ),
    ),
    toSignalScore(
      "set_similarity",
      evaluateSetSimilarity(topic, sourceCache),
    ),
    toSignalScore("history", evaluateHistory(context, topic)),
  ];
  const confidence = round(Math.max(
    0,
    Math.min(100, signalScores.reduce((total, signal) => total + signal.contributedPoints, 0)),
  ));
  return {
    topicId: topic.id,
    topicPath: topic.path,
    confidence,
    action: decideClassificationAction(confidence),
    signalScores,
    reasons: signalScores.flatMap((signal) => signal.reasons),
  };
}

function hasSufficientTopicEvidence(suggestion: ClassificationSuggestion): boolean {
  if (suggestion.confidence < classificationThresholds.candidates) return false;
  const scores = Object.fromEntries(
    suggestion.signalScores.map((signal) => [signal.key, signal.normalizedScore]),
  ) as Partial<Record<ClassificationSignalKey, number>>;

  // 历史活跃度和相对全文排名只能增强已有语义证据，不能单独制造主题候选。
  return (scores.explicit_rules ?? 0) >= 0.55
    || (scores.aliases_entities ?? 0) >= 0.44
    || (
      (scores.full_text ?? 0) >= 0.65
      && (scores.set_similarity ?? 0) >= 0.12
    );
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
  const sourceCache = createSourceEvaluationCache(context.source);
  const rulesByTopic = new Map<string, ClassificationRule[]>();
  for (const rule of context.rules) {
    const topicRules = rulesByTopic.get(rule.topicId) ?? [];
    topicRules.push(rule);
    rulesByTopic.set(rule.topicId, topicRules);
  }

  return {
    algorithmVersion: CLASSIFIER_ALGORITHM_VERSION,
    sourceId: context.source.id,
    generatedAt,
    suggestions: context.topics
      .filter((topic) => topic.status !== "archived")
      .map((topic) =>
        scoreTopic(context, topic, rulesByTopic.get(topic.id) ?? [], sourceCache))
      .filter(hasSufficientTopicEvidence)
      .sort((left, right) => {
        if (right.confidence !== left.confidence) return right.confidence - left.confidence;
        return left.topicId.localeCompare(right.topicId);
      }),
  };
}
