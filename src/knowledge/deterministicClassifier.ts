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

export const CLASSIFIER_ALGORITHM_VERSION = "local-rules-v6";

type SignalEvaluation = {
  normalizedScore: number;
  reasons: string[];
};

type SourceEvaluationCache = {
  normalizedTitle: string;
  normalizedLeadBody: string;
  normalizedPrimaryLeadBody: string;
  compactTitle: string;
  compactLeadBody: string;
  compactPrimaryLeadBody: string;
  normalizedContent: string;
  titleTokens: Set<string>;
  leadBodyTokens: Set<string>;
  primaryLeadBodyTokens: Set<string>;
  sourceSetTokens: Set<string>;
  primarySourceSetTokens: Set<string>;
};

type RuleMatchLocation = "title" | "lead_body" | "metadata";
type ManagedRuleKind = "exact_alias" | "entity" | "keyword" | "user";

// 这些词能说明上下文，却不能单独说明笔记主体。它们只作为辅助证据，
// 避免长对话里偶然出现“软件 / 图片 / 银行卡 / iPhone”等词就抢走主题。
const broadContextPhrases = new Set([
  "agent",
  "codex",
  "mac",
  "siri",
  "ai",
  "代理",
  "代码",
  "插件",
  "软件",
  "开发",
  "图片",
  "摄影",
  "自拍",
  "苹果",
  "iphone",
  "银行卡",
  "信用卡",
  "手机卡",
  "流量卡",
  "账号",
  "账号风险",
  "会员",
  "订阅",
  "价格",
  "配置",
  "车型",
  "续航",
  "用车",
  "沟通",
  "婚姻",
  "历史",
  "新闻",
  "翻译",
  "体育",
  "政策解析",
]);

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

function sharesStableTitleBoundaries(left: string, right: string): boolean {
  const compactLeft = compactText(left);
  const compactRight = compactText(right);
  if (
    Array.from(compactLeft).length < 4
    || Array.from(compactRight).length < 4
  ) {
    return false;
  }
  const leftCharacters = Array.from(compactLeft);
  const rightCharacters = Array.from(compactRight);
  return leftCharacters.slice(0, 2).join("") === rightCharacters.slice(0, 2).join("")
    && leftCharacters.slice(-2).join("") === rightCharacters.slice(-2).join("");
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

function managedRuleKind(rule: ClassificationRule): ManagedRuleKind {
  if (rule.id.startsWith("exact_alias:catalog-rule-")) return "exact_alias";
  if (rule.id.startsWith("entity:catalog-rule-")) return "entity";
  if (rule.id.startsWith("keyword:catalog-rule-")) return "keyword";
  return "user";
}

function ruleEvidenceFactor(
  rule: ClassificationRule,
  location: RuleMatchLocation,
  cache: SourceEvaluationCache,
): number {
  if (location === "metadata") return 0.72;
  const kind = managedRuleKind(rule);
  const profile = rulePhraseProfile(rule.value);
  const broad = broadContextPhrases.has(profile.normalized);

  if (location === "title") {
    if (kind === "exact_alias") return 1;
    if (kind === "entity") return broad ? 0.48 : 0.86;
    if (kind === "keyword") return broad ? 0.3 : 1;
    return 0.95;
  }

  if (kind === "entity") return broad ? 0.12 : 0.28;
  // 无主题标题（如“设置方法”“这两个差别”）只能依赖正文。此时把正文开头
  // 命中的具体目录短语视为主体证据；宽泛词和实体仍维持低权重，避免长文误归。
  if (!hasMeaningfulTitle(cache) && !broad) {
    if (kind === "keyword") return 1;
    if (kind === "exact_alias" || kind === "user") return 0.9;
  }
  if (kind === "exact_alias") return 0.54;
  if (kind === "user") return 0.68;
  if (broad) return 0.12;
  if (profile.compactLength <= 3) return 0.22;
  return 0.62;
}

function coreTextLead(value: string, limit = 12_000): string {
  return value.slice(0, limit);
}

function createSourceEvaluationCache(source: KnowledgeSourceDraft): SourceEvaluationCache {
  const normalizedTitle = normalizeText(source.title);
  const leadBody = coreTextLead(source.text);
  const normalizedLeadBody = normalizeText(leadBody);
  const normalizedPrimaryLeadBody = normalizeText(coreTextLead(source.text, 600));
  return {
    normalizedTitle,
    normalizedLeadBody,
    normalizedPrimaryLeadBody,
    compactTitle: compactText(normalizedTitle),
    compactLeadBody: compactText(normalizedLeadBody),
    compactPrimaryLeadBody: compactText(normalizedPrimaryLeadBody),
    normalizedContent: `${normalizedTitle} ${normalizedLeadBody}`.trim(),
    titleTokens: tokenSet(source.title),
    leadBodyTokens: tokenSet(leadBody),
    primaryLeadBodyTokens: tokenSet(coreTextLead(source.text, 600)),
    sourceSetTokens: tokenSet(`${leadBody} ${(source.tags ?? []).join(" ")}`),
    primarySourceSetTokens: tokenSet(
      `${coreTextLead(source.text, 600)} ${(source.tags ?? []).join(" ")}`,
    ),
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
          value: hasMeaningfulTitle(cache)
            ? cache.normalizedLeadBody
            : cache.normalizedPrimaryLeadBody,
          compactValue: hasMeaningfulTitle(cache)
            ? cache.compactLeadBody
            : cache.compactPrimaryLeadBody,
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
    // 但必须同时保留短语首尾边界，避免“SKHY投资分析”误撞
    // “电力投资分析 / 苹果投资分析”等仅后缀相同的主题。
    return sharesStableTitleBoundaries(cache.normalizedTitle, expected)
      && diceSimilarity(cache.titleTokens, profile.tokens) >= 0.62;
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
  const includedByPhrase = new Map<string, {
    rule: ClassificationRule;
    location: RuleMatchLocation;
    weightedStrength: number;
  }>();
  for (const item of matched.filter(({ rule }) => rule.effect !== "exclude")) {
    const key = `${item.location}:${compactText(rulePhraseProfile(item.rule.value).normalized)}`;
    const weightedStrength = item.rule.strength
      * ruleEvidenceFactor(item.rule, item.location, cache);
    const existing = includedByPhrase.get(key);
    if (!existing || weightedStrength > existing.weightedStrength) {
      includedByPhrase.set(key, { ...item, weightedStrength });
    }
  }
  const includedCandidates = [...includedByPhrase.values()];
  const titleIncluded = includedCandidates.filter(({ location }) => location === "title");
  const included = hasMeaningfulTitle(cache) && titleIncluded.length
    ? titleIncluded
    : includedCandidates;
  const excluded = matched.filter(({ rule }) => rule.effect === "exclude");
  const includedStrengths = included.map(({ weightedStrength }) => weightedStrength);
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
  // 正文关键词只由显式规则负责，避免长文里的偶然词重复加分；标题中的
  // 非宽泛主题短语可以作为第二路主体证据，让清晰标题稳定越过候选线。
  const anchorCandidates = [...new Set(
    [topic.name, ...topic.aliases, ...topic.entities]
      .map((value) => normalizeText(value))
      .filter(Boolean),
  )];
  const titleKeywordCandidates = [...new Set(
    topic.keywords
      .map((value) => normalizeText(value))
      .filter((value) => value && !broadContextPhrases.has(value)),
  )];
  const titleCandidates = [...anchorCandidates, ...titleKeywordCandidates];
  const titleHits = titleCandidates.filter((candidate) =>
    semanticIncludes(cache.normalizedTitle, candidate, cache.compactTitle));
  const textHits = anchorCandidates.filter(
    (candidate) =>
      !semanticIncludes(cache.normalizedTitle, candidate, cache.compactTitle)
      && semanticIncludes(cache.normalizedLeadBody, candidate, cache.compactLeadBody),
  );
  const primaryBodyKeywordHits = hasMeaningfulTitle(cache)
    ? []
    : titleKeywordCandidates.filter((candidate) =>
      semanticIncludes(
        cache.normalizedPrimaryLeadBody,
        candidate,
        cache.compactPrimaryLeadBody,
      ));
  const primaryBodyKeywordScore = primaryBodyKeywordHits.length
    ? Math.min(0.9, 0.72 + Math.min(0.18, (primaryBodyKeywordHits.length - 1) * 0.09))
    : 0;
  const fuzzyTitleSimilarity = titleHits.length
    ? 0
    : Math.max(
        0,
        ...titleCandidates
          .map((candidate) => rulePhraseProfile(candidate))
          .filter((profile) =>
            profile.compactLength >= 4
            && sharesStableTitleBoundaries(cache.normalizedTitle, profile.normalized))
          .map((profile) => diceSimilarity(cache.titleTokens, profile.tokens)),
      );
  const fuzzyTitleScore = fuzzyTitleSimilarity >= 0.62 ? 0.58 : 0;
  const primaryTitleBoundary = evaluatePrimaryTitleBoundary(topic, cache);
  const normalizedScore = clamp01(
    titleHits.length * 0.76
      + fuzzyTitleScore
      + (hasMeaningfulTitle(cache) ? 0 : textHits.length * 0.1)
      + primaryBodyKeywordScore
      + (primaryTitleBoundary ? 1 : 0),
  );
  const reasons: string[] = [];
  if (primaryTitleBoundary) reasons.push(`标题主体边界：${primaryTitleBoundary}`);
  if (titleHits.length) reasons.push(`标题命中：${titleHits.slice(0, 3).join("、")}`);
  if (fuzzyTitleScore) {
    reasons.push(`标题与主题短语高度相似 ${Math.round(fuzzyTitleSimilarity * 100)}%`);
  }
  if (textHits.length) reasons.push(`正文实体命中：${textHits.slice(0, 4).join("、")}`);
  if (primaryBodyKeywordHits.length) {
    reasons.push(`正文开头主体短语：${primaryBodyKeywordHits.slice(0, 3).join("、")}`);
  }
  return { normalizedScore, reasons };
}

function evaluatePrimaryTitleBoundary(
  topic: KnowledgeTopicCandidate,
  cache: SourceEvaluationCache,
): string | null {
  const title = cache.normalizedTitle;
  if (!hasMeaningfulTitle(cache)) return null;
  if (topic.name === "公司与行业研究") {
    const companyResearchQualifier =
      /(?:估值(?:分析)?|商业模式(?:分析)?|财报(?:分析)?|财务分析|投资分析|股价分析|分红分析)/;
    const sectorOrInstrumentSubject =
      /(?:指数|纳指|标普|etf|基金|a股|美股|港股|大盘|产业链|行业|板块|赛道|航空航天|人形机器人|桑基图|信息图|图表|可视化)/;
    if (
      companyResearchQualifier.test(title)
      && !/(?:产业估值|行业估值|估值方法|估值框架)/.test(title)
      && !/(?:职业.*投资分析|投资分析.*职业)/.test(title)
      && (!sectorOrInstrumentSubject.test(title) || /投资分析/.test(title))
      && (!/^ai(?:产业|行业|商业模式)/.test(title) || /投资分析/.test(title))
    ) {
      return "公司主体与估值、财报或商业模式组合命中";
    }
  }
  if (topic.name === "航天、机器人与先进制造") {
    if (
      /(?:航空航天|商业航天|人形机器人|机器人产业链)/.test(title)
      && /投资分析/.test(title)
    ) {
      return "先进制造行业主体与投资分析组合命中";
    }
  }
  if (topic.name === "能源、电力与材料") {
    if (
      /(?:能源|电力|储能|光伏|石油|有色金属|关键材料)/.test(title)
      && /投资分析/.test(title)
    ) {
      return "能源材料行业主体与投资分析组合命中";
    }
  }
  if (topic.name === "半导体与算力产业") {
    if (
      /(?:芯片产业|半导体产业|算力产业|存储产业|gpu产业)/.test(title)
      && /投资分析/.test(title)
    ) {
      return "半导体行业主体与投资分析组合命中";
    }
  }
  if (topic.name === "账号风控与封禁") {
    const platformOrAccount = /(?:账号|账户|paypal|google|claude|apple id)/;
    const definiteRiskState = /(?:风控|封禁|停用|冻结|申诉|恢复访问)/;
    const accountRestriction = /(?:账号|账户|paypal).*(?:限制)/;
    const featureRestriction = /(?:绑定手机号|自动化限制|功能限制|使用限制)/;
    const riskState = definiteRiskState.test(title)
      || (accountRestriction.test(title) && !featureRestriction.test(title));
    if (platformOrAccount.test(title) && riskState) {
      return "账号或支付主体与风控状态组合命中";
    }
  }
  if (topic.name === "海外账号体系") {
    const platformOrAccount = /(?:账号|账户|google|claude|apple id)/;
    const identityPolicy = /(?:实名制|身份政策|年龄验证政策)/;
    if (platformOrAccount.test(title) && identityPolicy.test(title)) {
      return "账号主体与身份制度组合命中";
    }
    if (
      /claude/.test(title)
      && /注册/.test(title)
      && /(?:外国|海外|境外)手机号/.test(title)
    ) {
      return "平台注册与海外手机号要求组合命中";
    }
    if (/美国地址/.test(title) && /(?:填写|地址问题)/.test(title)) {
      return "海外服务地址填写任务命中";
    }
  }
  if (topic.name === "海外银行与支付") {
    if (/(?:银行卡|信用卡|借记卡)/.test(title) && /(?:更新|到期|绑定|换卡)/.test(title)) {
      return "银行卡主体与卡片维护任务组合命中";
    }
    if (
      /(?:apple id|苹果id)/.test(title)
      && /(?:chatgpt|claude|会员)/.test(title)
      && /(?:充值|订阅|支付|绑定)/.test(title)
    ) {
      return "应用商店账号与会员支付关系组合命中";
    }
  }
  if (topic.name === "Apple、Mac 与 iPhone") {
    if (/(?:mac|iphone|ios)/.test(title) && /(?:截图|通知|系统设置|系统功能)/.test(title)) {
      return "Apple 设备主体与系统功能组合命中";
    }
  }
  if (topic.name === "数据备份、迁移与恢复") {
    if (
      /(?:claude|chatgpt|对话|会话)/.test(title)
      && /(?:导出|归档|备份)/.test(title)
      && /(?:会话|记录|数据)/.test(title)
    ) {
      return "AI 会话数据与导出归档任务组合命中";
    }
  }
  if (topic.name === "投资方法与风险") {
    if (/(?:每周订阅内容|投资周报|市场周报)/.test(title)) {
      return "周期性投资材料与复盘任务组合命中";
    }
  }
  if (topic.name === "软件工具与效率工作流") {
    if (/(?:产品分类|产品线梳理|软件产品)/.test(title)) {
      return "软件产品与产品线整理任务组合命中";
    }
  }
  if (topic.name === "语言、翻译与内容整理") {
    const contentObject = /(?:内容|文档|pdf|周报|资料|文章)/;
    const summaryTask = /(?:总结|概述|摘要|梳理)/;
    if (
      contentObject.test(title)
      && summaryTask.test(title)
      && !/(?:每周订阅内容|投资周报|市场周报)/.test(title)
    ) {
      return "内容对象与总结整理任务组合命中";
    }
  }
  return null;
}

function evaluateFullText(
  topic: KnowledgeTopicCandidate,
  cache: SourceEvaluationCache,
  externalScore?: number,
  externalReason?: string,
  hasTitleSemanticEvidence = false,
): SignalEvaluation {
  if (externalScore !== undefined && hasMeaningfulTitle(cache)) {
    const normalizedScore = hasTitleSemanticEvidence
      ? clamp01(externalScore)
      : Math.min(0.5, clamp01(externalScore));
    return {
      // 清晰标题已指向当前主题时，全文检索可以完整佐证；否则只允许有限加分，
      // 避免长正文中的偶然行业词反过来推翻标题主体。
      normalizedScore,
      reasons: [
        `${externalReason ?? "来自本地 FTS5/BM25 的归一化相关度"}`
          + (!hasTitleSemanticEvidence && externalScore > 0.5
            ? "；缺少标题主体证据，封顶 50%"
            : ""),
      ],
    };
  }
  const topicTitleTokens = tokenSet([topic.name, ...topic.aliases, ...topic.keywords].join(" "));
  const topicDocumentTokens = tokenSet(`${topic.searchDocument} ${topic.entities.join(" ")}`);
  const titleScore = diceSimilarity(cache.titleTokens, topicTitleTokens);
  const bodyTokens = hasMeaningfulTitle(cache)
    ? cache.leadBodyTokens
    : cache.primaryLeadBodyTokens;
  const documentScore = diceSimilarity(bodyTokens, topicDocumentTokens);
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
  const sourceTokens = hasMeaningfulTitle(cache)
    ? cache.sourceSetTokens
    : cache.primarySourceSetTokens;
  const bodyScore = jaccardSimilarity(sourceTokens, topicTokens);
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
  let explicitEvaluation = evaluateExplicitRules(context.source, topicRules, sourceCache);
  const aliasesEvaluation = evaluateAliasesAndEntities(topic, sourceCache);
  const primaryBoundaryReason = aliasesEvaluation.reasons.find((reason) =>
    reason.startsWith("标题主体边界"));
  if (primaryBoundaryReason) {
    explicitEvaluation = {
      normalizedScore: Math.max(0.9, explicitEvaluation.normalizedScore),
      reasons: explicitEvaluation.reasons.includes(primaryBoundaryReason)
        ? explicitEvaluation.reasons
        : [primaryBoundaryReason, ...explicitEvaluation.reasons],
    };
  }
  const hasTitleSemanticEvidence = [
    ...explicitEvaluation.reasons,
    ...aliasesEvaluation.reasons,
  ].some((reason) =>
    reason.startsWith("标题主题短语")
    || reason.startsWith("标题命中")
    || reason.startsWith("标题与主题短语"));
  const signalScores = [
    toSignalScore(
      "explicit_rules",
      explicitEvaluation,
    ),
    toSignalScore(
      "aliases_entities",
      aliasesEvaluation,
    ),
    toSignalScore(
      "full_text",
      evaluateFullText(
        topic,
        sourceCache,
        externalSearch?.normalizedScore,
        externalSearch?.reason,
        hasTitleSemanticEvidence,
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
    || (scores.aliases_entities ?? 0) >= 0.55
    || (
      (scores.full_text ?? 0) >= 0.78
      && (scores.set_similarity ?? 0) >= 0.2
      && (scores.explicit_rules ?? 0) >= 0.25
    );
}

function hasMeaningfulTitle(cache: SourceEvaluationCache): boolean {
  const title = cache.normalizedTitle;
  if (Array.from(cache.compactTitle).length < 4) return false;
  return title !== "---"
    && !/^未命名(?:导入)?记录/.test(title)
    && !/^untitled$/.test(title)
    && !/^conversation overview\b/.test(title)
    && !/^(先给结果|设置方法|情况询问|询问内容用途|这两个差别|三个选项区别|没有反应的原因|为什么这种便宜|登录方法|便宜平台风险分析)$/.test(title)
    && !/^(?:订阅)?内容(?:分析)?(?:总结|概述)$/.test(title)
    // “某人吃饭画面 / 某张图片”只说明内容载体，不说明是在生成、分析还是编辑；
    // 这类标题必须回到正文开头判断真实任务主体。
    && !/^(?!.*(?:生成|分析|解析|设计|编辑|处理|调色)).+(?:画面|图片|图像|照片)$/.test(title)
    && !/^南烛枫[，,、\s]*(先|请|帮我)?$/.test(title);
}

function hasTitleTopicEvidence(suggestion: ClassificationSuggestion): boolean {
  return suggestion.reasons.some((reason) =>
    reason.startsWith("标题主题短语")
    || reason.startsWith("标题命中")
    || reason.startsWith("标题与主题短语")
    || reason.startsWith("标题主体边界"));
}

function hasPrimaryTitleBoundary(suggestion: ClassificationSuggestion): boolean {
  return suggestion.reasons.some((reason) => reason.startsWith("标题主体边界"));
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
  const evidencedSuggestions = context.topics
    .filter((topic) => topic.status !== "archived")
    .map((topic) =>
      scoreTopic(context, topic, rulesByTopic.get(topic.id) ?? [], sourceCache))
    .filter(hasSufficientTopicEvidence);
  const titleAlignedSuggestions = evidencedSuggestions.filter(hasTitleTopicEvidence);
  const suggestions = hasMeaningfulTitle(sourceCache) && titleAlignedSuggestions.length
    ? titleAlignedSuggestions
    : evidencedSuggestions;

  return {
    algorithmVersion: CLASSIFIER_ALGORITHM_VERSION,
    sourceId: context.source.id,
    generatedAt,
    suggestions: suggestions
      .sort((left, right) => {
        const leftPrimaryBoundary = hasPrimaryTitleBoundary(left);
        const rightPrimaryBoundary = hasPrimaryTitleBoundary(right);
        if (leftPrimaryBoundary !== rightPrimaryBoundary) {
          return rightPrimaryBoundary ? 1 : -1;
        }
        if (right.confidence !== left.confidence) return right.confidence - left.confidence;
        return left.topicId.localeCompare(right.topicId);
      }),
  };
}
