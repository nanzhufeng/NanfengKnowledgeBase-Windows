import { readImportedContent } from "../domain/importedContent";
import {
  CLASSIFICATION_TOPIC_CATALOG_STATUS,
  CLASSIFICATION_TOPIC_CATALOG_VERSION,
  classificationRules,
  classificationTopics,
} from "./classificationFixtures";
import { classifySource, CLASSIFIER_ALGORITHM_VERSION } from "./deterministicClassifier";
import type {
  ClassificationAction,
  ClassificationHistory,
  ClassificationSuggestion,
  KnowledgeSourceDraft,
  SourceKind,
} from "./domain";

const CLASSIFICATION_TEXT_LIMIT = 24_000;

type LegacySourceInput = {
  sourceType: string;
  title: string;
  url: string | null;
  localPath: string | null;
  externalId: string | null;
};

export type LegacyClassificationInputRecord = {
  recordId: number;
  recordOrigin?: "legacy_database" | "supplemental_chatgpt";
  title: string;
  legacyTitle: string;
  titleResolutionStatus: string;
  status: string;
  summary: string;
  currentJudgment: string;
  confirmedFacts: string[];
  keyEvidence: string[];
  openQuestions: string[];
  nextActions: string[];
  notes: string;
  sourceText: string;
  tags: string[];
  sources: LegacySourceInput[];
  originalAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupplementalSourceEvidence = {
  filePath: string;
  fileName: string;
  sha256: string;
  rowCount: number;
  uniqueConversationIds: number;
  missingConversationIdCount: number;
};

export type SupplementalMergeEvidence = {
  baseRecordCount: number;
  existingChatGptConversationCount: number;
  suppliedConversationCount: number;
  suppliedUniqueConversationCount: number;
  overlapSkippedCount: number;
  crossFileDuplicateCount: number;
  addedConversationCount: number;
};

export type LegacyClassificationInput = {
  reportVersion: number;
  generatedAt: string;
  sourceDatabase: string;
  sourceDatabaseSha256Before: string;
  sourceConnectionQueryOnly: boolean;
  sourceIntegrityCheck: string;
  sourceTotalChangesBefore: number;
  recordCount: number;
  records: LegacyClassificationInputRecord[];
  sourceTotalChangesAfter: number;
  sourceDatabaseSha256After: string;
  supplementalSources?: SupplementalSourceEvidence[];
  supplementalMerge?: SupplementalMergeEvidence;
};

type DryRunRecord = {
  recordId: number;
  recordOrigin: "legacy_database" | "supplemental_chatgpt";
  title: string;
  titleResolutionStatus: string;
  sourceKind: SourceKind;
  platform: string;
  visibleCharacterCount: number;
  sampledCharacterCount: number;
  contentTruncated: boolean;
  topSuggestion: ClassificationSuggestion;
  runnerUpSuggestion: ClassificationSuggestion | null;
  confidenceMargin: number;
  suggestions: ClassificationSuggestion[];
};

export type LegacyClassificationDryRunReport = {
  reportVersion: number;
  generatedAt: string;
  source: {
    database: string;
    sha256: string;
    integrityCheck: string;
    queryOnly: boolean;
    totalChangesBefore: number;
    totalChangesAfter: number;
    recordCount: number;
    baseRecordCount: number;
    supplementalAddedCount: number;
    supplementalSources: SupplementalSourceEvidence[];
  };
  classifier: {
    algorithmVersion: string;
    catalogVersion: string;
    catalogStatus: "provisional";
    topicCount: number;
    ruleCount: number;
    externalSearchSignalsAvailable: false;
    confirmedHistoryAvailable: false;
    textLimitPerRecord: number;
  };
  summary: {
    actionCounts: Record<ClassificationAction, number>;
    candidateCoverageCount: number;
    ambiguousCandidateCount: number;
    truncatedContentCount: number;
    unresolvedGenericTitleCount: number;
    sourceKindCounts: Record<string, number>;
    candidateTopicCounts: Record<string, number>;
  };
  records: DryRunRecord[];
  warnings: string[];
};

const emptyHistory: ClassificationHistory = {
  confirmedTopicCounts: {},
  recentTopicIds: [],
  batchTopicIds: {},
};

function extensionFromSource(record: LegacyClassificationInputRecord): string {
  const source = record.sources[0];
  const path = source?.localPath || source?.title || "";
  return path.match(/\.([a-z0-9]+)$/i)?.[1]?.toLocaleLowerCase() ?? "";
}

function inferSourceKind(
  record: LegacyClassificationInputRecord,
  isConversation: boolean,
): SourceKind {
  if (isConversation) return "ai_conversation";
  const extension = extensionFromSource(record);
  const kinds: Record<string, SourceKind> = {
    json: "json",
    md: "markdown",
    markdown: "markdown",
    txt: "text",
    html: "html",
    htm: "html",
    pdf: "pdf",
    mp3: "audio",
    wav: "audio",
    m4a: "audio",
    mp4: "video",
    mov: "video",
    mkv: "video",
    srt: "subtitle",
    vtt: "subtitle",
    png: "image",
    jpg: "image",
    jpeg: "image",
    webp: "image",
  };
  return kinds[extension] ?? "manual";
}

function inferPlatform(record: LegacyClassificationInputRecord, isConversation: boolean): string {
  if (isConversation) {
    try {
      const root = JSON.parse(record.sourceText) as Record<string, unknown>;
      if (Array.isArray(root.chat_messages)) return "Claude";
      if (root.mapping && typeof root.mapping === "object") return "ChatGPT";
    } catch {
      // 非 JSON 正文继续使用来源元数据。
    }
  }
  return record.sources[0]?.sourceType || "本地资料";
}

function deterministicTextSample(value: string): {
  text: string;
  originalLength: number;
  truncated: boolean;
} {
  const originalLength = value.length;
  if (originalLength <= CLASSIFICATION_TEXT_LIMIT) {
    return { text: value, originalLength, truncated: false };
  }
  const windowSize = Math.floor(CLASSIFICATION_TEXT_LIMIT / 3);
  const middleStart = Math.max(0, Math.floor(originalLength / 2) - Math.floor(windowSize / 2));
  return {
    text: [
      value.slice(0, windowSize),
      value.slice(middleStart, middleStart + windowSize),
      value.slice(-windowSize),
    ].join("\n\n[…确定性抽样分隔…]\n\n"),
    originalLength,
    truncated: true,
  };
}

function sourceDraft(record: LegacyClassificationInputRecord): {
  source: KnowledgeSourceDraft;
  originalLength: number;
  truncated: boolean;
  platform: string;
} {
  const importedContent = readImportedContent(record.sourceText);
  const structured = [
    record.summary,
    record.currentJudgment,
    ...record.confirmedFacts,
    ...record.keyEvidence,
    ...record.openQuestions,
    ...record.nextActions,
    record.notes,
  ].filter((value) => value.trim());
  const visibleSource = importedContent.fullText || record.sourceText;
  const combined = [visibleSource, ...structured].filter(Boolean).join("\n\n");
  const sample = deterministicTextSample(combined);
  const primarySource = record.sources[0];
  const platform = inferPlatform(record, importedContent.isConversation);
  return {
    source: {
      id: `legacy-record-${record.recordId}`,
      title: record.title,
      text: sample.text,
      kind: inferSourceKind(record, importedContent.isConversation),
      platform,
      fileName: primarySource?.title || undefined,
      filePath: primarySource?.localPath || undefined,
      tags: record.tags,
      importedAt: record.originalAt || record.createdAt,
    },
    originalLength: sample.originalLength,
    truncated: sample.truncated,
    platform,
  };
}

export function buildLegacyClassificationDryRun(
  input: LegacyClassificationInput,
): LegacyClassificationDryRunReport {
  if (!input.sourceConnectionQueryOnly
    || input.sourceTotalChangesBefore !== input.sourceTotalChangesAfter
    || input.sourceDatabaseSha256Before !== input.sourceDatabaseSha256After) {
    throw new Error("分类输入缺少完整的只读证据，拒绝生成预演报告");
  }
  if (input.recordCount !== input.records.length) {
    throw new Error(`分类输入数量不一致：声明 ${input.recordCount}，实际 ${input.records.length}`);
  }

  const actionCounts: Record<ClassificationAction, number> = {
    auto_eligible: 0,
    confirm: 0,
    candidates: 0,
    manual: 0,
  };
  const sourceKindCounts: Record<string, number> = {};
  const candidateTopicCounts: Record<string, number> = {};
  let candidateCoverageCount = 0;
  let ambiguousCandidateCount = 0;
  let truncatedContentCount = 0;
  let unresolvedGenericTitleCount = 0;

  const records = input.records.map((record): DryRunRecord => {
    const draft = sourceDraft(record);
    const result = classifySource({
      source: draft.source,
      topics: classificationTopics,
      rules: classificationRules,
      history: emptyHistory,
    }, input.generatedAt);
    const suggestions = result.suggestions.slice(0, 3);
    const topSuggestion = suggestions[0];
    if (!topSuggestion) throw new Error("临时主题目录为空，无法运行分类预演");
    const runnerUpSuggestion = suggestions[1] ?? null;
    const confidenceMargin = topSuggestion.confidence - (runnerUpSuggestion?.confidence ?? 0);

    actionCounts[topSuggestion.action] += 1;
    sourceKindCounts[draft.source.kind] = (sourceKindCounts[draft.source.kind] ?? 0) + 1;
    if (draft.truncated) truncatedContentCount += 1;
    if (record.titleResolutionStatus === "unresolved_generic") {
      unresolvedGenericTitleCount += 1;
    }
    if (topSuggestion.action !== "manual") {
      candidateCoverageCount += 1;
      candidateTopicCounts[topSuggestion.topicId] =
        (candidateTopicCounts[topSuggestion.topicId] ?? 0) + 1;
      if (runnerUpSuggestion && confidenceMargin < 10) ambiguousCandidateCount += 1;
    }

    return {
      recordId: record.recordId,
      recordOrigin: record.recordOrigin ?? "legacy_database",
      title: record.title,
      titleResolutionStatus: record.titleResolutionStatus,
      sourceKind: draft.source.kind,
      platform: draft.platform,
      visibleCharacterCount: draft.originalLength,
      sampledCharacterCount: draft.source.text.length,
      contentTruncated: draft.truncated,
      topSuggestion,
      runnerUpSuggestion,
      confidenceMargin,
      suggestions,
    };
  });

  return {
    reportVersion: 1,
    generatedAt: input.generatedAt,
    source: {
      database: input.sourceDatabase,
      sha256: input.sourceDatabaseSha256After,
      integrityCheck: input.sourceIntegrityCheck,
      queryOnly: input.sourceConnectionQueryOnly,
      totalChangesBefore: input.sourceTotalChangesBefore,
      totalChangesAfter: input.sourceTotalChangesAfter,
      recordCount: input.recordCount,
      baseRecordCount: input.supplementalMerge?.baseRecordCount ?? input.recordCount,
      supplementalAddedCount: input.supplementalMerge?.addedConversationCount ?? 0,
      supplementalSources: input.supplementalSources ?? [],
    },
    classifier: {
      algorithmVersion: CLASSIFIER_ALGORITHM_VERSION,
      catalogVersion: CLASSIFICATION_TOPIC_CATALOG_VERSION,
      catalogStatus: CLASSIFICATION_TOPIC_CATALOG_STATUS,
      topicCount: classificationTopics.length,
      ruleCount: classificationRules.length,
      externalSearchSignalsAvailable: false,
      confirmedHistoryAvailable: false,
      textLimitPerRecord: CLASSIFICATION_TEXT_LIMIT,
    },
    summary: {
      actionCounts,
      candidateCoverageCount,
      ambiguousCandidateCount,
      truncatedContentCount,
      unresolvedGenericTitleCount,
      sourceKindCounts,
      candidateTopicCounts,
    },
    records,
    warnings: [
      "本报告使用原型阶段临时主题目录，不代表已确认的个人主题树。",
      "本次没有正式 Topic 数据、用户确认历史和 FTS5/BM25 外部信号，得分只用于评估目录覆盖率。",
      "分类结果只保存在报告中；没有创建知识表，也没有写回隔离副本或正式数据库。",
      `每条来源正文最多取 ${CLASSIFICATION_TEXT_LIMIT} 个字符的首段、中段和尾段确定性样本，超长记录需在正式迁移前复核。`,
      ...(input.supplementalSources?.length
        ? ["补充 ChatGPT JSON 仅加入本次只读分类输入；附件实体仍以完整 ZIP 导出包为准。"]
        : []),
    ],
  };
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ").replace(/`/g, "\\`");
}

function actionLabel(action: ClassificationAction): string {
  return {
    auto_eligible: "可自动接受",
    confirm: "建议确认",
    candidates: "仅候选",
    manual: "人工处理",
  }[action];
}

export function renderLegacyClassificationDryRunMarkdown(
  report: LegacyClassificationDryRunReport,
): string {
  const topicNames = new Map(classificationTopics.map((topic) => [topic.id, topic.path.join(" / ")]));
  const lines = [
    "# 南枫知识库内容分类预演",
    "",
    "> 本报告只评估当前临时主题目录的覆盖率，不代表正式归类，也没有写入任何数据库。",
    "",
    "## 只读证据",
    "",
    "| 项目 | 结果 |",
    "|---|---|",
    `| 隔离副本 | \`${escapeCell(report.source.database)}\` |`,
    `| SHA-256 | \`${report.source.sha256}\` |`,
    `| 完整性 | \`${report.source.integrityCheck}\` |`,
    `| query_only | \`${report.source.queryOnly}\` |`,
    `| 变更计数 | \`${report.source.totalChangesBefore} → ${report.source.totalChangesAfter}\` |`,
    `| 基础记录 | ${report.source.baseRecordCount} |`,
    `| 补充 ChatGPT 记录 | ${report.source.supplementalAddedCount} |`,
    ...(report.source.supplementalSources.length
      ? report.source.supplementalSources.map((source) =>
        `| 补充来源 | \`${escapeCell(source.fileName)}\` · ${source.rowCount} 条 · \`${source.sha256}\` |`)
      : []),
    "",
    "## 分类条件",
    "",
    "| 项目 | 结果 |",
    "|---|---|",
    `| 算法 | \`${report.classifier.algorithmVersion}\` |`,
    `| 临时目录版本 | \`${report.classifier.catalogVersion}\`（${report.classifier.catalogStatus}） |`,
    `| Topic / 规则 | ${report.classifier.topicCount} / ${report.classifier.ruleCount} |`,
    "| FTS5/BM25 | 未提供 |",
    "| 已确认历史 | 未提供 |",
    `| 单条正文上限 | ${report.classifier.textLimitPerRecord} 字符，超出时首/中/尾抽样 |`,
    "",
    "## 汇总",
    "",
    "| 指标 | 数量 |",
    "|---|---:|",
    `| 活动记录 | ${report.source.recordCount} |`,
    `| 可自动接受 | ${report.summary.actionCounts.auto_eligible} |`,
    `| 建议确认 | ${report.summary.actionCounts.confirm} |`,
    `| 仅候选 | ${report.summary.actionCounts.candidates} |`,
    `| 人工处理 | ${report.summary.actionCounts.manual} |`,
    `| 达到候选阈值 | ${report.summary.candidateCoverageCount} |`,
    `| 候选分差小于 10 | ${report.summary.ambiguousCandidateCount} |`,
    `| 正文被抽样 | ${report.summary.truncatedContentCount} |`,
    `| 仍为通用标题 | ${report.summary.unresolvedGenericTitleCount} |`,
    "",
    "### 候选主题覆盖",
    "",
    "| 临时主题 | 达到候选阈值的记录 |",
    "|---|---:|",
    ...Object.entries(report.summary.candidateTopicCounts)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([topicId, count]) => `| ${escapeCell(topicNames.get(topicId) ?? topicId)} | ${count} |`),
    "",
    "## 逐记录结果",
    "",
    "| Record | 来源 | 标题 | 首选临时主题 | 分数 | 动作 | 与次选分差 | 抽样 |",
    "|---:|---|---|---|---:|---|---:|:---:|",
    ...report.records.map((record) =>
      `| ${record.recordId} | ${record.recordOrigin === "supplemental_chatgpt" ? "补充 ChatGPT" : "旧库"} | ${escapeCell(record.title)} | ${escapeCell(topicNames.get(record.topSuggestion.topicId) ?? record.topSuggestion.topicId)} | ${record.topSuggestion.confidence} | ${actionLabel(record.topSuggestion.action)} | ${record.confidenceMargin} | ${record.contentTruncated ? "是" : "否"} |`),
    "",
    "## 限制",
    "",
    ...report.warnings.map((warning) => `- ${warning}`),
    "",
  ];
  return lines.join("\n");
}
