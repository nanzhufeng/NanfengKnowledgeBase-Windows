import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Check,
  ChevronRight,
  FolderTree,
  Inbox,
  Link2,
  Layers3,
  Maximize2,
  Merge,
  Plus,
  Scissors,
  Sparkles,
  X,
} from "lucide-react";
import { CLASSIFIER_ALGORITHM_VERSION, classifySource } from "../knowledge/deterministicClassifier";
import {
  readImportedContent,
  type ReadableSourceMessage,
} from "../domain/importedContent";
import {
  autoOrganizeImportedSources,
  undoAutoOrganization,
} from "../services/knowledgeAutoOrganizer";
import {
  KnowledgeRepository,
  type EvidenceLocator,
  type KnowledgeClassificationSuggestionRow,
  type KnowledgeClassificationRuleRow,
  type KnowledgeDomainRow,
  type KnowledgeEntityRow,
  type KnowledgeInboxItem,
  type KnowledgeNoteRow,
  type KnowledgeTopicAliasRow,
  type KnowledgeTopicDetail,
  type KnowledgeTopicRow,
  type PersonalCatalogProposal,
  type TopicMergePreview,
  type TopicPropositionRow,
  type TopicRelationSuggestion,
  type TopicSplitPreview,
} from "../services/knowledgeRepository";
import MarkdownContent, { ReadableMessageContent } from "./MarkdownContent";

type Mode = "inbox" | "topics" | "organize";
const INITIAL_INBOX_LIMIT = 120;
const SOURCE_PREVIEW_LIMIT = 20_000;

function limitReadableMessages(
  messages: ReadableSourceMessage[],
  characterLimit: number,
): ReadableSourceMessage[] {
  let remaining = characterLimit;
  const visible: ReadableSourceMessage[] = [];
  for (const message of messages) {
    if (remaining <= 0 && visible.length) break;
    const characters = Array.from(message.text);
    const allowance = Math.max(remaining, 0);
    const truncated = characters.length > allowance;
    visible.push({
      ...message,
      text: truncated
        ? `${characters.slice(0, allowance).join("").trimEnd()}\n\n……`
        : message.text,
    });
    remaining -= Math.min(characters.length, allowance);
    if (truncated) break;
  }
  return visible;
}

function KnowledgeSourceDialog({
  title,
  messages,
  fullText,
  onClose,
}: {
  title: string;
  messages: ReadableSourceMessage[];
  fullText: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div className="prototype-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="prototype-dialog elevated-card source-content-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="prototype-dialog-heading">
          <div><span>来源详情</span><h2>{title}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>
        <div className="source-content-body">
          {messages.length ? (
            messages.map((message, index) => (
              <ReadableMessageContent
                key={`${message.role}-${message.createdAt ?? index}-${index}`}
                message={message}
              />
            ))
          ) : (
            <MarkdownContent value={fullText || "来源正文为空"} className="source-plain-text" />
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function topicPath(topic: KnowledgeTopicRow, topics: KnowledgeTopicRow[]): string[] {
  const result = [topic.name];
  let parentId = topic.parentTopicId;
  const seen = new Set<number>([topic.id]);
  while (parentId !== null && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = topics.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    result.unshift(parent.name);
    parentId = parent.parentTopicId;
  }
  return result;
}

const locatorLabels: Record<EvidenceLocator["kind"], string> = {
  none: "无精确锚点",
  message: "AI 对话消息 ID",
  timecode: "音视频时间码",
  subtitle_line: "字幕行",
  page: "PDF 页码",
  html_paragraph: "HTML 段落",
  markdown_heading: "Markdown 标题",
  json_path: "JSON 路径",
  file_fragment: "本地文件片段",
  text_quote: "短文本引用",
};

function locatorKindsForSource(sourceType?: string): EvidenceLocator["kind"][] {
  const shared: EvidenceLocator["kind"][] = ["none", "text_quote", "file_fragment"];
  if (sourceType === "ai_conversation") return ["none", "message", "json_path", "text_quote"];
  if (sourceType === "json") return ["none", "json_path", "message", "text_quote"];
  if (["audio", "video"].includes(sourceType ?? "")) return ["none", "timecode", "text_quote"];
  if (["subtitle", "transcript"].includes(sourceType ?? "")) {
    return ["none", "timecode", "subtitle_line", "text_quote"];
  }
  if (sourceType === "pdf") return ["none", "page", "text_quote"];
  if (["html", "web"].includes(sourceType ?? "")) return ["none", "html_paragraph", "text_quote"];
  if (sourceType === "markdown") return ["none", "markdown_heading", "text_quote"];
  return shared;
}

function catalogRuleVersion(configJson: string): string | null {
  try {
    const parsed = JSON.parse(configJson) as { managedBy?: unknown };
    return typeof parsed.managedBy === "string" ? parsed.managedBy : null;
  } catch {
    return null;
  }
}

export function KnowledgeWorkspace({
  mode,
  onNotify,
}: {
  mode: Mode;
  onNotify: (message: string, options?: {
    durationMs?: number;
    actionLabel?: string;
    onAction?: () => void | Promise<void>;
  }) => void;
}) {
  const repository = useMemo(() => new KnowledgeRepository(), []);
  const [inbox, setInbox] = useState<KnowledgeInboxItem[]>([]);
  const [inboxLimit, setInboxLimit] = useState(INITIAL_INBOX_LIMIT);
  const [loadedSourceText, setLoadedSourceText] = useState<{
    sourceItemId: number;
    text: string;
  } | null>(null);
  const [sourceDetailOpen, setSourceDetailOpen] = useState(false);
  const sourceTextRequestSequence = useRef(0);
  const preparedCatalogVersion = useRef<string | null>(null);
  const catalogPreparation = useRef<Promise<void> | null>(null);
  const [domains, setDomains] = useState<KnowledgeDomainRow[]>([]);
  const [topics, setTopics] = useState<KnowledgeTopicRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<KnowledgeClassificationSuggestionRow[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [domainName, setDomainName] = useState("");
  const [domainDescription, setDomainDescription] = useState("");
  const [topicName, setTopicName] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [topicDomainId, setTopicDomainId] = useState<number | null>(null);
  const [topicParentId, setTopicParentId] = useState<number | null>(null);
  const [editDomainId, setEditDomainId] = useState<number | null>(null);
  const [editDomainName, setEditDomainName] = useState("");
  const [editDomainDescription, setEditDomainDescription] = useState("");
  const [editTopicId, setEditTopicId] = useState<number | null>(null);
  const [editTopicName, setEditTopicName] = useState("");
  const [editTopicDescription, setEditTopicDescription] = useState("");
  const [autoSuggestingSourceId, setAutoSuggestingSourceId] = useState<number | null>(null);
  const [browserTopicId, setBrowserTopicId] = useState<number | null>(null);
  const [topicDetail, setTopicDetail] = useState<KnowledgeTopicDetail | null>(null);
  const [judgmentText, setJudgmentText] = useState("");
  const [judgmentReason, setJudgmentReason] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [evidenceSourceId, setEvidenceSourceId] = useState<number | null>(null);
  const [evidenceStance, setEvidenceStance] = useState<"support" | "oppose" | "context">("context");
  const [evidenceCredibility, setEvidenceCredibility] = useState(60);
  const [evidenceVerificationStatus, setEvidenceVerificationStatus] = useState("unverified");
  const [evidenceValidityStatus, setEvidenceValidityStatus] = useState("active");
  const [evidenceLocatorKind, setEvidenceLocatorKind] = useState<EvidenceLocator["kind"]>("none");
  const [evidenceLocatorValue, setEvidenceLocatorValue] = useState("");
  const [evidenceQuote, setEvidenceQuote] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [propositionEditId, setPropositionEditId] = useState<number | null>(null);
  const [propositionText, setPropositionText] = useState("");
  const [propositionStatus, setPropositionStatus] = useState<TopicPropositionRow["status"]>("open");
  const [turningFromJudgmentId, setTurningFromJudgmentId] = useState<number | null>(null);
  const [turningToJudgmentId, setTurningToJudgmentId] = useState<number | null>(null);
  const [turningTitle, setTurningTitle] = useState("");
  const [turningExplanation, setTurningExplanation] = useState("");
  const [noteEditId, setNoteEditId] = useState<number | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteSummary, setNoteSummary] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteType, setNoteType] = useState<KnowledgeNoteRow["noteType"]>("normal");
  const [noteStatus, setNoteStatus] = useState<KnowledgeNoteRow["status"]>("draft");
  const [noteRelatedTopicIds, setNoteRelatedTopicIds] = useState<number[]>([]);
  const [noteSourceItemIds, setNoteSourceItemIds] = useState<number[]>([]);
  const [mergeSourceId, setMergeSourceId] = useState<number | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [mergePreview, setMergePreview] = useState<TopicMergePreview | null>(null);
  const [splitTopicId, setSplitTopicId] = useState<number | null>(null);
  const [splitPreview, setSplitPreview] = useState<TopicSplitPreview | null>(null);
  const [relationSuggestions, setRelationSuggestions] = useState<TopicRelationSuggestion[]>([]);
  const [catalogProposal, setCatalogProposal] = useState<PersonalCatalogProposal | null>(null);
  const [catalogReviewed, setCatalogReviewed] = useState(false);
  const [topicAliases, setTopicAliases] = useState<KnowledgeTopicAliasRow[]>([]);
  const [entities, setEntities] = useState<KnowledgeEntityRow[]>([]);
  const [classificationRules, setClassificationRules] = useState<KnowledgeClassificationRuleRow[]>([]);
  const [aliasEditId, setAliasEditId] = useState<number | null>(null);
  const [aliasTopicId, setAliasTopicId] = useState<number | null>(null);
  const [aliasValue, setAliasValue] = useState("");
  const [aliasType, setAliasType] = useState<KnowledgeTopicAliasRow["aliasType"]>("name");
  const [entityEditId, setEntityEditId] = useState<number | null>(null);
  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState<KnowledgeEntityRow["entityType"]>("other");
  const [entityAliasesText, setEntityAliasesText] = useState("");
  const [ruleEditId, setRuleEditId] = useState<number | null>(null);
  const [ruleTopicId, setRuleTopicId] = useState<number | null>(null);
  const [ruleType, setRuleType] = useState<KnowledgeClassificationRuleRow["ruleType"]>("keyword");
  const [rulePattern, setRulePattern] = useState("");
  const [ruleWeight, setRuleWeight] = useState(0.8);
  const [ruleEnabled, setRuleEnabled] = useState(true);

  const selected = inbox.find((item) => item.id === selectedId) ?? null;
  const selectedOriginalText = loadedSourceText?.sourceItemId === selectedId
    ? loadedSourceText.text
    : null;
  const sourcePreviewIsTruncated = selectedOriginalText !== null
    && selectedOriginalText.length > SOURCE_PREVIEW_LIMIT;
  const sourcePreviewText = sourcePreviewIsTruncated
    ? selectedOriginalText.slice(0, SOURCE_PREVIEW_LIMIT)
    : selectedOriginalText;
  const selectedReadableContent = useMemo(
    () => selectedOriginalText === null ? null : readImportedContent(selectedOriginalText),
    [selectedOriginalText],
  );
  const visibleSourceMessages = useMemo(() => {
    if (!selectedReadableContent?.messages.length) return [];
    return sourcePreviewIsTruncated
      ? limitReadableMessages(selectedReadableContent.messages, SOURCE_PREVIEW_LIMIT)
      : selectedReadableContent.messages;
  }, [selectedReadableContent, sourcePreviewIsTruncated]);
  const readableSourceText = selectedReadableContent
    ? sourcePreviewIsTruncated
      ? selectedReadableContent.fullText.slice(0, SOURCE_PREVIEW_LIMIT)
      : selectedReadableContent.fullText
    : sourcePreviewText;
  const currentPendingSuggestions = suggestions.filter(
    (item) => item.status === "pending"
      && item.classifierVersion === CLASSIFIER_ALGORITHM_VERSION,
  );
  const hasStalePendingSuggestions = suggestions.some(
    (item) => item.status === "pending"
      && item.classifierVersion !== CLASSIFIER_ALGORITHM_VERSION,
  );

  const reload = async () => {
    let catalogBootstrapped = false;
    let catalogUpgraded = false;
    let [
      nextInbox,
      nextDomains,
      nextTopics,
      nextCatalog,
      nextAliases,
      nextEntities,
      nextRules,
    ] = await Promise.all([
      repository.listInbox(inboxLimit),
      repository.listDomains(),
      repository.listTopics(),
      repository.getPersonalCatalogProposal(),
      repository.listTopicAliases(),
      repository.listEntities(),
      repository.listClassificationRules(),
    ]);
    const catalogIsCurrent = nextCatalog
      ? nextRules.some((rule) => catalogRuleVersion(rule.configJson) === nextCatalog.version)
      : false;
    const catalogPreparedForSession = nextCatalog
      ? catalogIsCurrent || preparedCatalogVersion.current === nextCatalog.version
      : false;
    if (catalogPreparedForSession && nextCatalog) {
      preparedCatalogVersion.current = nextCatalog.version;
    }
    if (
      nextInbox.length
      && nextCatalog
      && !catalogPreparedForSession
    ) {
      const hadTopics = nextTopics.length > 0;
      await repository.applyPersonalCatalog(nextCatalog.version);
      preparedCatalogVersion.current = nextCatalog.version;
      catalogBootstrapped = !hadTopics;
      catalogUpgraded = hadTopics;
      [nextDomains, nextTopics, nextAliases, nextEntities, nextRules] = await Promise.all([
        repository.listDomains(),
        repository.listTopics(),
        repository.listTopicAliases(),
        repository.listEntities(),
        repository.listClassificationRules(),
      ]);
    }
    setInbox(nextInbox);
    setDomains(nextDomains);
    setTopics(nextTopics);
    setCatalogProposal(nextCatalog);
    setTopicAliases(nextAliases);
    setEntities(nextEntities);
    setClassificationRules(nextRules);
    setSelectedId((current) =>
      current && nextInbox.some((item) => item.id === current)
        ? current
        : nextInbox[0]?.id ?? null);
    setTopicDomainId((current) => current ?? nextDomains[0]?.id ?? null);
    setEditDomainId((current) =>
      current && nextDomains.some((domain) => domain.id === current)
        ? current
        : nextDomains[0]?.id ?? null);
    setEditTopicId((current) =>
      current && nextTopics.some((topic) => topic.id === current)
        ? current
        : nextTopics[0]?.id ?? null);
    setAliasTopicId((current) => current ?? nextTopics[0]?.id ?? null);
    setRuleTopicId((current) => current ?? nextTopics[0]?.id ?? null);
    setBrowserTopicId((current) =>
      current && nextTopics.some((topic) => topic.id === current)
        ? current
        : nextTopics[0]?.id ?? null);
    if (catalogBootstrapped) {
      onNotify("已根据现有笔记启用可编辑默认领域与主题；不会覆盖原文");
    } else if (catalogUpgraded) {
      onNotify("已升级可编辑主题目录；只补充缺失主题和托管规则，不改原文或既有归类");
    }
  };

  const ensureCurrentCatalog = async () => {
    const proposal = catalogProposal ?? await repository.getPersonalCatalogProposal();
    if (!proposal || preparedCatalogVersion.current === proposal.version) return;
    if (!catalogPreparation.current) {
      catalogPreparation.current = repository.applyPersonalCatalog(proposal.version)
        .then(() => {
          preparedCatalogVersion.current = proposal.version;
        })
        .finally(() => {
          catalogPreparation.current = null;
        });
    }
    await catalogPreparation.current;
  };

  const computeAndSaveSuggestions = async (sourceItemId: number) => {
    // 新版目录必须先进入同一持久化入口，否则已有 Topic 的库会一直沿用旧目录，
    // 自动计算与用户点击“重新计算”将产生不同结果。
    await ensureCurrentCatalog();
    const context = await repository.prepareClassificationContext(sourceItemId);
    const result = classifySource(context);
    return repository.saveSuggestions({
      sourceItemId,
      classifierVersion: CLASSIFIER_ALGORITHM_VERSION,
      suggestions: result.suggestions.slice(0, 5).map((suggestion) => ({
        topicId: Number(suggestion.topicId),
        score: suggestion.confidence,
        decision: suggestion.action,
        reasons: suggestion.reasons,
        signalScoresJson: JSON.stringify(suggestion.signalScores),
      })),
    });
  };

  useEffect(() => {
    setLoading(true);
    void reload()
      .catch((error) => onNotify(error instanceof Error ? error.message : "知识库读取失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId || mode !== "inbox") {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setAutoSuggestingSourceId(selectedId);
    void repository.listSuggestions(selectedId)
      .then(async (items) => {
        if (items.length || !topics.length) return items;
        return computeAndSaveSuggestions(selectedId);
      })
      .then((items) => {
        if (cancelled) return;
        setSuggestions(items);
        setSelectedTopicId(items.find(
          (item) => item.status === "pending"
            && item.classifierVersion === CLASSIFIER_ALGORITHM_VERSION,
        )?.suggestedTopicId ?? null);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setAutoSuggestingSourceId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, repository, selectedId, topics.length]);

  useEffect(() => {
    const domain = domains.find((candidate) => candidate.id === editDomainId);
    setEditDomainName(domain?.name ?? "");
    setEditDomainDescription(domain?.description ?? "");
  }, [domains, editDomainId]);

  useEffect(() => {
    const topic = topics.find((candidate) => candidate.id === editTopicId);
    setEditTopicName(topic?.name ?? "");
    setEditTopicDescription(topic?.description ?? "");
  }, [editTopicId, topics]);

  useEffect(() => {
    const sequence = ++sourceTextRequestSequence.current;
    setSourceDetailOpen(false);
    if (!selectedId || mode !== "inbox") {
      setLoadedSourceText(null);
      return;
    }
    void repository.getSourceOriginalText(selectedId)
      .then((originalText) => {
        if (sequence === sourceTextRequestSequence.current) {
          setLoadedSourceText({ sourceItemId: selectedId, text: originalText });
        }
      })
      .catch((error) => {
        if (sequence === sourceTextRequestSequence.current) {
          setLoadedSourceText({ sourceItemId: selectedId, text: "" });
          onNotify(error instanceof Error ? error.message : "来源正文读取失败");
        }
      });
  }, [mode, repository, selectedId]);

  useEffect(() => {
    if (!browserTopicId || mode !== "topics") {
      setTopicDetail(null);
      return;
    }
    void repository.getTopicDetail(browserTopicId)
      .then((detail) => {
        setTopicDetail(detail);
        setEvidenceSourceId(detail.sources[0]?.id ?? null);
        setTurningToJudgmentId(detail.judgments[0]?.id ?? null);
        setTurningFromJudgmentId(detail.judgments[1]?.id ?? null);
      })
      .catch((error) => onNotify(error instanceof Error ? error.message : "主题详情读取失败"));
  }, [browserTopicId, mode, repository]);

  useEffect(() => {
    if (mode !== "organize") return;
    void repository.suggestTopicRelations()
      .then(setRelationSuggestions)
      .catch((error) => onNotify(error instanceof Error ? error.message : "关系建议读取失败"));
  }, [mode, repository]);

  const reloadTopicDetail = async () => {
    if (!browserTopicId) return;
    const detail = await repository.getTopicDetail(browserTopicId);
    setTopicDetail(detail);
    setTurningToJudgmentId((current) =>
      current && detail.judgments.some((item) => item.id === current)
        ? current
        : detail.judgments[0]?.id ?? null);
    setTurningFromJudgmentId((current) =>
      current && detail.judgments.some((item) => item.id === current)
        ? current
        : detail.judgments[1]?.id ?? null);
    setTopics(await repository.listTopics());
  };

  const buildMergePreview = async () => {
    if (!mergeSourceId || !mergeTargetId) return;
    setBusy(true);
    try {
      setMergePreview(await repository.previewTopicMerge(mergeSourceId, mergeTargetId));
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "合并预览失败");
    } finally {
      setBusy(false);
    }
  };

  const commitMerge = async () => {
    if (!mergePreview || mergePreview.blockers.length) return;
    setBusy(true);
    try {
      const result = await repository.mergeTopics(
        mergePreview.sourceTopic.id,
        mergePreview.targetTopic.id,
      );
      setMergePreview(null);
      await reload();
      setRelationSuggestions(await repository.suggestTopicRelations());
      onNotify(`已合并 ${result.movedSourceCount} 条来源，可撤销`, {
        durationMs: 12_000,
        actionLabel: "撤销合并",
        onAction: async () => {
          await repository.undoTopicMerge(result.operationId);
          await reload();
          setRelationSuggestions(await repository.suggestTopicRelations());
          onNotify("主题合并已撤销");
        },
      });
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "主题合并失败");
    } finally {
      setBusy(false);
    }
  };

  const buildSplitPreview = async () => {
    if (!splitTopicId) return;
    setBusy(true);
    try {
      setSplitPreview(await repository.previewTopicSplit(splitTopicId));
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "拆分预览失败");
    } finally {
      setBusy(false);
    }
  };

  const acceptRelation = async (suggestion: TopicRelationSuggestion) => {
    setBusy(true);
    try {
      await repository.createTopicRelation({
        fromTopicId: suggestion.fromTopicId,
        toTopicId: suggestion.toTopicId,
        relationType: suggestion.relationType,
        confidence: suggestion.confidence,
        note: suggestion.reason,
      });
      setRelationSuggestions((current) => current.filter((item) => item !== suggestion));
      onNotify("主题关系已写入");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "主题关系写入失败");
    } finally {
      setBusy(false);
    }
  };

  const applyCatalog = async () => {
    if (!catalogProposal || !catalogReviewed) return;
    setBusy(true);
    try {
      const result = await repository.applyPersonalCatalog(catalogProposal.version);
      preparedCatalogVersion.current = catalogProposal.version;
      await reload();
      setCatalogReviewed(false);
      onNotify(
        `个人目录已确认：新增 ${result.createdDomains} 个领域、${result.createdTopics} 个主题，已有内容未覆盖`,
      );
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "个人目录写入失败");
    } finally {
      setBusy(false);
    }
  };

  const saveAlias = async () => {
    if (!aliasTopicId || !aliasValue.trim()) return;
    setBusy(true);
    try {
      if (aliasEditId) {
        await repository.updateTopicAlias({
          id: aliasEditId,
          alias: aliasValue.trim(),
          aliasType,
        });
      } else {
        await repository.createTopicAlias({
          topicId: aliasTopicId,
          alias: aliasValue.trim(),
          aliasType,
        });
      }
      setAliasEditId(null);
      setAliasValue("");
      setTopicAliases(await repository.listTopicAliases());
      onNotify(aliasEditId ? "主题别名已更新" : "主题别名已创建");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "主题别名保存失败");
    } finally {
      setBusy(false);
    }
  };

  const saveEntity = async () => {
    if (!entityName.trim()) return;
    const aliases = entityAliasesText
      .split(/[,，、\n]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    setBusy(true);
    try {
      if (entityEditId) {
        await repository.updateEntity({
          id: entityEditId,
          canonicalName: entityName.trim(),
          entityType,
          aliases,
        });
      } else {
        await repository.createEntity({
          canonicalName: entityName.trim(),
          entityType,
          aliases,
        });
      }
      setEntityEditId(null);
      setEntityName("");
      setEntityAliasesText("");
      setEntities(await repository.listEntities());
      onNotify(entityEditId ? "实体词典已更新" : "实体词典已创建");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "实体词典保存失败");
    } finally {
      setBusy(false);
    }
  };

  const saveRule = async () => {
    if (!ruleTopicId || !rulePattern.trim()) return;
    const target = topics.find((topic) => topic.id === ruleTopicId);
    if (!target) return;
    setBusy(true);
    try {
      const input = {
        ruleType,
        pattern: rulePattern.trim(),
        targetDomainId: target.domainId,
        targetTopicId: target.id,
        weight: ruleWeight,
        priority: 0,
        enabled: ruleEnabled,
      };
      if (ruleEditId) {
        await repository.updateClassificationRule({ id: ruleEditId, ...input });
      } else {
        await repository.createClassificationRule(input);
      }
      setRuleEditId(null);
      setRulePattern("");
      setClassificationRules(await repository.listClassificationRules());
      onNotify(ruleEditId ? "分类规则已更新" : "分类规则已创建");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "分类规则保存失败");
    } finally {
      setBusy(false);
    }
  };

  const deleteAlias = async (id: number) => {
    if (!window.confirm("删除这个主题别名？主题和来源不会被删除。")) return;
    setBusy(true);
    try {
      const result = await repository.deleteTopicAlias(id);
      if (!result.deleted) throw new Error("主题别名已经不存在");
      setTopicAliases(await repository.listTopicAliases());
      onNotify("主题别名已删除");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "主题别名删除失败");
    } finally {
      setBusy(false);
    }
  };

  const deleteEntity = async (id: number) => {
    if (!window.confirm("删除这个实体词典条目？已有来源不会被修改。")) return;
    setBusy(true);
    try {
      const result = await repository.deleteEntity(id);
      if (!result.deleted) throw new Error("实体词典条目已经不存在");
      setEntities(await repository.listEntities());
      onNotify("实体词典条目已删除");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "实体词典删除失败");
    } finally {
      setBusy(false);
    }
  };

  const deleteRule = async (id: number) => {
    if (!window.confirm("删除这条分类规则？历史分类结果不会被重写。")) return;
    setBusy(true);
    try {
      const result = await repository.deleteClassificationRule(id);
      if (!result.deleted) throw new Error("分类规则已经不存在");
      setClassificationRules(await repository.listClassificationRules());
      onNotify("分类规则已删除");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "分类规则删除失败");
    } finally {
      setBusy(false);
    }
  };

  const resetNoteEditor = () => {
    setNoteEditId(null);
    setNoteTitle("");
    setNoteSummary("");
    setNoteBody("");
    setNoteType("normal");
    setNoteStatus("draft");
    setNoteRelatedTopicIds([]);
    setNoteSourceItemIds([]);
  };

  const beginEditNote = (note: KnowledgeNoteRow) => {
    setNoteEditId(note.id);
    setNoteTitle(note.title);
    setNoteSummary(note.summary);
    setNoteBody(note.bodyMarkdown);
    setNoteType(note.noteType);
    setNoteStatus(note.status);
    setNoteRelatedTopicIds(note.relatedTopicIds);
    setNoteSourceItemIds(note.sourceItemIds);
  };

  const saveNote = async () => {
    if (!topicDetail || !noteTitle.trim()) return;
    setBusy(true);
    try {
      const input = {
        title: noteTitle.trim(),
        summary: noteSummary.trim(),
        bodyMarkdown: noteBody,
        noteType,
        status: noteStatus,
        organizationState: "organized" as const,
        primaryTopicId: topicDetail.topic.id,
        relatedTopicIds: noteRelatedTopicIds,
        sourceItemIds: noteSourceItemIds,
      };
      if (noteEditId) {
        await repository.updateNote({ id: noteEditId, ...input });
      } else {
        await repository.createNote(input);
      }
      resetNoteEditor();
      await reloadTopicDetail();
      onNotify(noteEditId ? "笔记已更新，原始来源未被改写" : "独立笔记已创建");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "笔记保存失败");
    } finally {
      setBusy(false);
    }
  };

  const archiveNote = async (noteId: number) => {
    if (!window.confirm("归档这篇笔记？原始来源、主题和笔记正文都会保留。")) return;
    setBusy(true);
    try {
      await repository.archiveNote(noteId);
      if (noteEditId === noteId) resetNoteEditor();
      await reloadTopicDetail();
      onNotify("笔记已归档，可通过编辑重新启用");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "笔记归档失败");
    } finally {
      setBusy(false);
    }
  };

  const resetPropositionEditor = () => {
    setPropositionEditId(null);
    setPropositionText("");
    setPropositionStatus("open");
  };

  const saveProposition = async () => {
    if (!topicDetail || !propositionText.trim()) return;
    setBusy(true);
    try {
      if (propositionEditId) {
        await repository.updateProposition({
          id: propositionEditId,
          statementMarkdown: propositionText.trim(),
          status: propositionStatus,
        });
      } else {
        await repository.createProposition({
          topicId: topicDetail.topic.id,
          statementMarkdown: propositionText.trim(),
          status: propositionStatus,
        });
      }
      const wasEditing = propositionEditId !== null;
      resetPropositionEditor();
      await reloadTopicDetail();
      onNotify(wasEditing ? "命题已更新" : "命题已创建");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "命题保存失败");
    } finally {
      setBusy(false);
    }
  };

  const supersedeProposition = async (propositionId: number) => {
    if (!window.confirm("将这条命题标记为已被替代？命题历史会保留。")) return;
    setBusy(true);
    try {
      await repository.supersedeProposition(propositionId);
      if (propositionEditId === propositionId) resetPropositionEditor();
      await reloadTopicDetail();
      onNotify("命题已标记为被替代，历史未删除");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "命题状态更新失败");
    } finally {
      setBusy(false);
    }
  };

  const saveTurningPoint = async () => {
    if (!topicDetail || !turningToJudgmentId || !turningTitle.trim() || !turningExplanation.trim()) {
      return;
    }
    setBusy(true);
    try {
      await repository.createTurningPoint({
        topicId: topicDetail.topic.id,
        fromJudgmentId: turningFromJudgmentId,
        toJudgmentId: turningToJudgmentId,
        title: turningTitle.trim(),
        explanation: turningExplanation.trim(),
      });
      setTurningTitle("");
      setTurningExplanation("");
      await reloadTopicDetail();
      onNotify("关键转折已由用户明确确认");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "关键转折保存失败");
    } finally {
      setBusy(false);
    }
  };

  const generateSuggestions = async () => {
    if (!selected || !topics.length) {
      onNotify("请先在“主题浏览器”建立至少一个真实主题");
      return;
    }
    setBusy(true);
    try {
      const persisted = await computeAndSaveSuggestions(selected.id);
      await reload();
      setSuggestions(persisted);
      setSelectedTopicId(persisted[0]?.suggestedTopicId ?? null);
      onNotify(
        persisted.length
          ? "已按可读正文重新计算并保存证据充分的分类建议"
          : "没有找到证据充分的主题，已清除旧的不可靠建议；可手动选择或新建主题",
        { durationMs: persisted.length ? 6_000 : 10_000 },
      );
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "分类失败，来源仍保留在收录箱");
    } finally {
      setBusy(false);
    }
  };

  const autoOrganizeLoadedInbox = async () => {
    if (!inbox.length) return;
    setBusy(true);
    onNotify(`正在自动整理已加载的 ${inbox.length} 条来源；原文不会被改写`);
    try {
      const result = await autoOrganizeImportedSources(
        inbox.map((item) => item.id),
        repository,
      );
      await reload();
      onNotify(
        `自动整理完成：分析 ${result.analyzedCount} 条，自动归类 ${result.autoClassifiedCount} 条，待确认 ${result.awaitingConfirmationCount} 条，无充分证据 ${result.unmatchedCount} 条${result.failures.length ? `，${result.failures.length} 条处理失败并保留` : ""}`,
        {
          durationMs: 12_000,
          actionLabel: result.operationIds.length ? "撤销自动归类" : undefined,
          onAction: result.operationIds.length
            ? async () => {
              await undoAutoOrganization(result.operationIds, repository);
              await reload();
              onNotify("本批自动归类已撤销");
            }
            : undefined,
        },
      );
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "自动整理失败；来源仍保留在收录箱");
    } finally {
      setBusy(false);
    }
  };

  const acceptClassification = async () => {
    if (!selected || selectedTopicId === null) {
      onNotify("请选择一个主题");
      return;
    }
    const suggestion = suggestions.find((item) => item.suggestedTopicId === selectedTopicId);
    setBusy(true);
    try {
      const result = await repository.confirmClassification({
        sourceItemId: selected.id,
        topicId: selectedTopicId,
        suggestionId: suggestion?.id ?? null,
        confidence: suggestion?.score ?? 100,
      });
      await reload();
      onNotify("来源已进入主题，操作可撤销", {
        durationMs: 10_000,
        actionLabel: "撤销归类",
        onAction: async () => {
          await repository.undoClassification(result.operationId);
          await reload();
          onNotify("分类已撤销，来源已返回收录箱");
        },
      });
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "分类确认失败");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="page-loading"><span className="save-spinner" />正在读取正式知识结构…</div>;
  }

  if (mode === "topics") {
    return (
      <main className="knowledge-page">
        <header className="knowledge-page-header">
          <div><span>长期结构</span><h1>主题浏览器</h1><p>数据库保存任意深度；界面默认展开前四层。</p></div>
          <FolderTree size={28} />
        </header>
        {catalogProposal ? (
          <section className="knowledge-card knowledge-catalog-proposal">
            <div className="knowledge-panel-title">
              <Layers3 size={20} />
              <div>
                <h2>{catalogProposal.title}</h2>
                <p>{catalogProposal.note}</p>
              </div>
            </div>
            <details>
              <summary>
                审阅 {catalogProposal.domains.length} 个领域、{catalogProposal.topics.length} 个主题
              </summary>
              <div className="knowledge-catalog-grid">
                {catalogProposal.domains.map((domain) => (
                  <article key={domain.key}>
                    <strong>{domain.name}</strong>
                    <small>{domain.description}</small>
                    <span>
                      {catalogProposal.topics
                        .filter((topic) => topic.domainKey === domain.key)
                        .map((topic) => topic.name)
                        .join("、")}
                    </span>
                  </article>
                ))}
              </div>
            </details>
            <label className="knowledge-confirm-check">
              <input
                type="checkbox"
                checked={catalogReviewed}
                onChange={(event) => setCatalogReviewed(event.target.checked)}
              />
              我已审阅；确认后只补齐缺失项，不覆盖现有主题
            </label>
            <button
              className="knowledge-primary-action"
              disabled={busy || !catalogReviewed}
              onClick={() => void applyCatalog()}
            >
              <Check size={16} />确认并补齐个人目录
            </button>
          </section>
        ) : null}
        <section className="knowledge-topic-layout">
          <div className="knowledge-card knowledge-create-card">
            <h2>建立领域与主题</h2>
            <label>新领域<input value={domainName} onChange={(event) => setDomainName(event.target.value)} placeholder="例如：影视制作" /></label>
            <label>领域说明<input value={domainDescription} onChange={(event) => setDomainDescription(event.target.value)} placeholder="这个领域长期管理什么" /></label>
            <button disabled={!domainName.trim()} onClick={async () => {
              setBusy(true);
              try {
                const created = await repository.createDomain(domainName.trim(), domainDescription.trim());
                setDomainName("");
                setDomainDescription("");
                await reload();
                setTopicDomainId(created.id);
                onNotify("领域已创建");
              } catch (error) {
                onNotify(error instanceof Error ? error.message : "领域创建失败");
              } finally {
                setBusy(false);
              }
            }}><Plus size={16} />创建领域</button>
            <label>所属领域<select value={topicDomainId ?? ""} onChange={(event) => setTopicDomainId(Number(event.target.value))}>
              <option value="">请选择</option>
              {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}
            </select></label>
            <label>父主题<select value={topicParentId ?? ""} onChange={(event) => setTopicParentId(event.target.value ? Number(event.target.value) : null)}>
              <option value="">顶层主题</option>
              {topics.filter((topic) => topic.domainId === topicDomainId).map((topic) => (
                <option key={topic.id} value={topic.id}>{"—".repeat(Math.min(topic.depth - 1, 4))} {topic.name}</option>
              ))}
            </select></label>
            <label>主题名称<input value={topicName} onChange={(event) => setTopicName(event.target.value)} placeholder="长期可复用的主题" /></label>
            <label>主题说明<input value={topicDescription} onChange={(event) => setTopicDescription(event.target.value)} placeholder="主题范围、关键词或判断边界" /></label>
            <button disabled={!topicDomainId || !topicName.trim()} onClick={async () => {
              setBusy(true);
              try {
                await repository.createTopic({
                  domainId: topicDomainId!,
                  parentTopicId: topicParentId,
                  name: topicName.trim(),
                  description: topicDescription.trim(),
                });
                setTopicName("");
                setTopicDescription("");
                setTopicParentId(null);
                await reload();
                onNotify("主题已创建");
              } catch (error) {
                onNotify(error instanceof Error ? error.message : "主题创建失败");
              } finally {
                setBusy(false);
              }
            }}><Plus size={16} />创建主题</button>
            <div className="knowledge-editor-divider" />
            <h2>编辑已有目录</h2>
            <label>选择领域<select value={editDomainId ?? ""} onChange={(event) => setEditDomainId(event.target.value ? Number(event.target.value) : null)}>
              <option value="">请选择</option>
              {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}
            </select></label>
            <label>领域名称<input value={editDomainName} onChange={(event) => setEditDomainName(event.target.value)} disabled={!editDomainId} /></label>
            <label>领域说明<input value={editDomainDescription} onChange={(event) => setEditDomainDescription(event.target.value)} disabled={!editDomainId} /></label>
            <button disabled={busy || !editDomainId || !editDomainName.trim()} onClick={async () => {
              setBusy(true);
              try {
                await repository.updateDomain({
                  id: editDomainId!,
                  name: editDomainName.trim(),
                  description: editDomainDescription.trim(),
                });
                await reload();
                onNotify("领域信息已更新，现有主题和来源关系保持不变");
              } catch (error) {
                onNotify(error instanceof Error ? error.message : "领域更新失败");
              } finally {
                setBusy(false);
              }
            }}>保存领域修改</button>
            <label>选择主题<select value={editTopicId ?? ""} onChange={(event) => setEditTopicId(event.target.value ? Number(event.target.value) : null)}>
              <option value="">请选择</option>
              {topics.map((topic) => <option key={topic.id} value={topic.id}>{topicPath(topic, topics).join(" / ")}</option>)}
            </select></label>
            <label>主题名称<input value={editTopicName} onChange={(event) => setEditTopicName(event.target.value)} disabled={!editTopicId} /></label>
            <label>主题说明<input value={editTopicDescription} onChange={(event) => setEditTopicDescription(event.target.value)} disabled={!editTopicId} /></label>
            <button disabled={busy || !editTopicId || !editTopicName.trim()} onClick={async () => {
              setBusy(true);
              try {
                await repository.updateTopic({
                  id: editTopicId!,
                  name: editTopicName.trim(),
                  description: editTopicDescription.trim(),
                });
                await reload();
                onNotify("主题信息已更新，分类关系和历史保持不变");
              } catch (error) {
                onNotify(error instanceof Error ? error.message : "主题更新失败");
              } finally {
                setBusy(false);
              }
            }}>保存主题修改</button>
          </div>
          <div className="knowledge-card knowledge-tree-card">
            <h2>当前主题树 <span>{topics.length} 个主题</span></h2>
            {!domains.length ? <p className="knowledge-empty">尚未建立正式领域。先创建一个领域，再添加主题。</p> : domains.map((domain) => (
              <div className="knowledge-domain" key={domain.id}>
                <strong><Layers3 size={17} />{domain.name}</strong>
                {topics.filter((topic) => topic.domainId === domain.id).map((topic) => (
                  <button
                    className={`knowledge-topic-row ${browserTopicId === topic.id ? "active" : ""}`}
                    key={topic.id}
                    style={{ paddingLeft: `${Math.min(topic.depth - 1, 4) * 22 + 12}px` }}
                    onClick={() => {
                      setBrowserTopicId(topic.id);
                      resetNoteEditor();
                      resetPropositionEditor();
                      setEvidenceText("");
                      setEvidenceLocatorKind("none");
                      setEvidenceLocatorValue("");
                      setEvidenceQuote("");
                    }}
                  >
                    <ChevronRight size={14} /><span>{topic.name}</span><em>{topic.sourceCount} 条来源</em>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>
        {topicDetail ? (
          <section className="knowledge-card knowledge-topic-detail">
            <div className="knowledge-topic-detail-header">
              <div>
                <span>主题知识页</span>
                <h2>{topicDetail.topic.name}</h2>
              </div>
              <button onClick={async () => {
                const context = await repository.compileTopicContext(topicDetail.topic.id);
                await navigator.clipboard.writeText(context);
                onNotify("已复制带来源边界的研究上下文");
              }}>复制研究上下文</button>
            </div>
            <div className="knowledge-detail-columns">
              <div>
                <h3>判断时间线</h3>
                {topicDetail.judgments.map((judgment) => (
                  <article className="knowledge-timeline-item" key={judgment.id}>
                    <strong>{Math.round(judgment.confidence)}% · {judgment.state}</strong>
                    <MarkdownContent value={judgment.statementMarkdown} />
                    <small>{judgment.effectiveAt}{judgment.changeReason ? ` · ${judgment.changeReason}` : ""}</small>
                  </article>
                ))}
                {!topicDetail.judgments.length ? <p className="knowledge-empty">尚无判断快照。</p> : null}
                <textarea value={judgmentText} onChange={(event) => setJudgmentText(event.target.value)} placeholder="新增当前判断（Markdown）" />
                <input value={judgmentReason} onChange={(event) => setJudgmentReason(event.target.value)} placeholder="变化原因（有变化时填写）" />
                <button disabled={!judgmentText.trim()} onClick={async () => {
                  await repository.addTopicJudgment({
                    topicId: topicDetail.topic.id,
                    statementMarkdown: judgmentText,
                    confidence: 70,
                    changeReason: judgmentReason,
                  });
                  setJudgmentText("");
                  setJudgmentReason("");
                  await reloadTopicDetail();
                  onNotify("判断快照已追加，历史未被覆盖");
                }}><Plus size={15} />追加判断</button>
              </div>
              <div>
                <h3>证据与来源锚点</h3>
                {topicDetail.evidence.map((item) => (
                  <article className={`knowledge-evidence-item ${item.stance}`} key={item.id}>
                    <MarkdownContent value={item.contentMarkdown} />
                    <small>
                      {item.sourceTitle} · 可信度 {Math.round(item.credibility)}% · {item.locatorLabel}
                      {" · "}{item.verificationStatus}/{item.validityStatus}
                    </small>
                  </article>
                ))}
                <select aria-label="证据来源" value={evidenceSourceId ?? ""} onChange={(event) => {
                  const sourceId = event.target.value ? Number(event.target.value) : null;
                  setEvidenceSourceId(sourceId);
                  setEvidenceLocatorKind("none");
                  setEvidenceLocatorValue("");
                }}>
                  <option value="">选择已归类来源</option>
                  {topicDetail.sources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
                </select>
                <textarea value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} placeholder="证据内容或原文摘录" />
                <div className="knowledge-evidence-fields">
                  <select
                    aria-label="证据立场"
                    value={evidenceStance}
                    onChange={(event) => setEvidenceStance(event.target.value as typeof evidenceStance)}
                  >
                    <option value="support">支持</option>
                    <option value="oppose">反对</option>
                    <option value="context">背景</option>
                  </select>
                  <label>
                    可信度 {evidenceCredibility}%
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={evidenceCredibility}
                      onChange={(event) => setEvidenceCredibility(Number(event.target.value))}
                    />
                  </label>
                  <select
                    aria-label="证据验证状态"
                    value={evidenceVerificationStatus}
                    onChange={(event) => setEvidenceVerificationStatus(event.target.value)}
                  >
                    <option value="unverified">未验证</option>
                    <option value="verified">已验证</option>
                    <option value="disputed">有争议</option>
                  </select>
                  <select
                    aria-label="证据有效状态"
                    value={evidenceValidityStatus}
                    onChange={(event) => setEvidenceValidityStatus(event.target.value)}
                  >
                    <option value="active">当前有效</option>
                    <option value="possibly_outdated">可能过时</option>
                    <option value="expired">已失效</option>
                  </select>
                </div>
                <select
                  aria-label="证据锚点类型"
                  value={evidenceLocatorKind}
                  onChange={(event) => {
                    setEvidenceLocatorKind(event.target.value as EvidenceLocator["kind"]);
                    setEvidenceLocatorValue("");
                  }}
                >
                  {locatorKindsForSource(
                    topicDetail.sources.find((source) => source.id === evidenceSourceId)?.sourceType,
                  ).map((kind) => <option key={kind} value={kind}>{locatorLabels[kind]}</option>)}
                </select>
                {evidenceLocatorKind !== "none" ? (
                  <>
                    <input
                      aria-label="证据锚点值"
                      value={evidenceLocatorValue}
                      onChange={(event) => setEvidenceLocatorValue(event.target.value)}
                      placeholder={`填写${locatorLabels[evidenceLocatorKind]}的精确值`}
                    />
                    <input
                      aria-label="证据短引用"
                      value={evidenceQuote}
                      onChange={(event) => setEvidenceQuote(event.target.value)}
                      placeholder="可选：保存一段短引用帮助核对"
                    />
                  </>
                ) : null}
                <button
                  disabled={
                    !evidenceText.trim()
                    || !evidenceSourceId
                    || (evidenceLocatorKind !== "none" && !evidenceLocatorValue.trim())
                  }
                  onClick={async () => {
                  await repository.addTopicEvidence({
                    topicId: topicDetail.topic.id,
                    sourceItemId: evidenceSourceId!,
                    contentMarkdown: evidenceText,
                    stance: evidenceStance,
                    credibility: evidenceCredibility,
                    verificationStatus: evidenceVerificationStatus,
                    validityStatus: evidenceValidityStatus,
                    locator: {
                      kind: evidenceLocatorKind,
                      value: evidenceLocatorValue,
                      quote: evidenceQuote,
                    },
                  });
                  setEvidenceText("");
                  setEvidenceLocatorKind("none");
                  setEvidenceLocatorValue("");
                  setEvidenceQuote("");
                  await reloadTopicDetail();
                  onNotify("证据及来源锚点已保存");
                  }}
                ><Plus size={15} />添加证据</button>
              </div>
              <div>
                <h3>待验证问题</h3>
                {topicDetail.questions.map((item) => (
                  <article className="knowledge-question-item" key={item.id}>
                    <strong>{item.importance}</strong><span>{item.question}</span><small>{item.status}</small>
                  </article>
                ))}
                <textarea value={questionText} onChange={(event) => setQuestionText(event.target.value)} placeholder="新增待验证问题" />
                <button disabled={!questionText.trim()} onClick={async () => {
                  await repository.addTopicQuestion({
                    topicId: topicDetail.topic.id,
                    question: questionText,
                  });
                  setQuestionText("");
                  await reloadTopicDetail();
                  onNotify("待验证问题已添加");
                }}><Plus size={15} />添加问题</button>
              </div>
            </div>
            <div className="knowledge-evolution-columns">
              <section>
                <div className="knowledge-note-section-title">
                  <div>
                    <span>可验证的具体陈述</span>
                    <h3>命题</h3>
                  </div>
                  <em>{topicDetail.propositions.length} 条</em>
                </div>
                <div className="knowledge-proposition-list">
                  {topicDetail.propositions.map((proposition) => (
                    <article
                      className={proposition.status === "superseded" ? "superseded" : ""}
                      key={proposition.id}
                    >
                      <div>
                        <span>{proposition.status}</span>
                        <MarkdownContent value={proposition.statementMarkdown} />
                      </div>
                      <footer>
                        <button disabled={busy} onClick={() => {
                          setPropositionEditId(proposition.id);
                          setPropositionText(proposition.statementMarkdown);
                          setPropositionStatus(proposition.status);
                        }}>编辑</button>
                        {proposition.status !== "superseded" ? (
                          <button
                            className="danger"
                            disabled={busy}
                            onClick={() => void supersedeProposition(proposition.id)}
                          >
                            标记为被替代
                          </button>
                        ) : null}
                      </footer>
                    </article>
                  ))}
                  {!topicDetail.propositions.length ? (
                    <p className="knowledge-empty">尚无可独立复用和验证的命题。</p>
                  ) : null}
                </div>
                <div className="knowledge-inline-editor">
                  <textarea
                    value={propositionText}
                    onChange={(event) => setPropositionText(event.target.value)}
                    placeholder="写下一条可验证、可被证据支持或反驳的具体陈述"
                  />
                  <select
                    aria-label="命题状态"
                    value={propositionStatus}
                    onChange={(event) => setPropositionStatus(event.target.value as TopicPropositionRow["status"])}
                  >
                    <option value="open">待判断</option>
                    <option value="supported">暂时成立</option>
                    <option value="rejected">已推翻</option>
                    <option value="superseded">已被替代</option>
                  </select>
                  <div>
                    <button disabled={busy || !propositionText.trim()} onClick={() => void saveProposition()}>
                      {propositionEditId ? "保存命题" : "创建命题"}
                    </button>
                    {propositionEditId ? (
                      <button className="secondary" disabled={busy} onClick={resetPropositionEditor}>
                        取消
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>
              <section>
                <div className="knowledge-note-section-title">
                  <div>
                    <span>仅由用户明确确认</span>
                    <h3>关键转折</h3>
                  </div>
                  <em>{topicDetail.turningPoints.length} 个</em>
                </div>
                <div className="knowledge-turning-list">
                  {topicDetail.turningPoints.map((point) => (
                    <article key={point.id}>
                      <strong>{point.title}</strong>
                      <p>{point.explanation}</p>
                      <div className="knowledge-turning-change">
                        <span>{point.fromStatementMarkdown ?? "此前无判断"}</span>
                        <ArrowRight size={15} />
                        <span>{point.toStatementMarkdown}</span>
                      </div>
                      <small>{point.occurredAt}</small>
                    </article>
                  ))}
                  {!topicDetail.turningPoints.length ? (
                    <p className="knowledge-empty">变化原因不会自动升格；请在下方明确选择前后判断。</p>
                  ) : null}
                </div>
                <div className="knowledge-inline-editor">
                  <div className="knowledge-turning-selects">
                    <label>
                      改变前
                      <select
                        value={turningFromJudgmentId ?? ""}
                        onChange={(event) => setTurningFromJudgmentId(
                          event.target.value ? Number(event.target.value) : null,
                        )}
                      >
                        <option value="">此前无判断</option>
                        {topicDetail.judgments.map((judgment) => (
                          <option key={judgment.id} value={judgment.id}>{judgment.statementMarkdown}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      改变后
                      <select
                        value={turningToJudgmentId ?? ""}
                        onChange={(event) => setTurningToJudgmentId(
                          event.target.value ? Number(event.target.value) : null,
                        )}
                      >
                        <option value="">请选择判断快照</option>
                        {topicDetail.judgments.map((judgment) => (
                          <option key={judgment.id} value={judgment.id}>{judgment.statementMarkdown}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <input
                    value={turningTitle}
                    onChange={(event) => setTurningTitle(event.target.value)}
                    placeholder="转折标题"
                  />
                  <textarea
                    value={turningExplanation}
                    onChange={(event) => setTurningExplanation(event.target.value)}
                    placeholder="为什么这次变化足以构成关键转折？"
                  />
                  <button
                    disabled={
                      busy
                      || !turningToJudgmentId
                      || turningFromJudgmentId === turningToJudgmentId
                      || !turningTitle.trim()
                      || !turningExplanation.trim()
                    }
                    onClick={() => void saveTurningPoint()}
                  >
                    明确确认为关键转折
                  </button>
                </div>
              </section>
            </div>
            <div className="knowledge-note-workspace">
              <div className="knowledge-note-list">
                <div className="knowledge-note-section-title">
                  <div>
                    <span>独立知识对象</span>
                    <h3>笔记</h3>
                  </div>
                  <em>{topicDetail.notes.length} 篇</em>
                </div>
                {topicDetail.notes.map((note) => (
                  <article
                    className={`knowledge-note-item ${note.status === "archived" ? "archived" : ""}`}
                    key={note.id}
                  >
                    <div className="knowledge-note-item-header">
                      <div>
                        <strong>{note.title}</strong>
                        <small>{note.noteType} · {note.status}</small>
                      </div>
                      <div>
                        <button disabled={busy} onClick={() => beginEditNote(note)}>编辑</button>
                        {note.status !== "archived" ? (
                          <button className="danger" disabled={busy} onClick={() => void archiveNote(note.id)}>
                            归档
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {note.summary ? <p>{note.summary}</p> : null}
                    {note.bodyMarkdown ? <MarkdownContent value={note.bodyMarkdown} /> : null}
                    <footer>
                      <span>{note.sourceItemIds.length} 条来源</span>
                      <span>{note.relatedTopicIds.length} 个相关主题</span>
                      <time>{note.updatedAt}</time>
                    </footer>
                  </article>
                ))}
                {!topicDetail.notes.length ? (
                  <p className="knowledge-empty">这个主题尚无独立笔记。右侧新建后，来源正文不会被改写。</p>
                ) : null}
              </div>
              <div className="knowledge-note-editor">
                <div className="knowledge-note-section-title">
                  <div>
                    <span>{noteEditId ? "保留关联后更新" : "从主题沉淀知识"}</span>
                    <h3>{noteEditId ? "编辑笔记" : "新建笔记"}</h3>
                  </div>
                </div>
                <label>
                  标题
                  <input
                    value={noteTitle}
                    onChange={(event) => setNoteTitle(event.target.value)}
                    placeholder="清晰、可复用的笔记标题"
                  />
                </label>
                <label>
                  摘要
                  <input
                    value={noteSummary}
                    onChange={(event) => setNoteSummary(event.target.value)}
                    placeholder="可选，一句话说明结论或用途"
                  />
                </label>
                <div className="knowledge-note-editor-row">
                  <label>
                    类型
                    <select
                      aria-label="笔记类型"
                      value={noteType}
                      onChange={(event) => setNoteType(event.target.value as KnowledgeNoteRow["noteType"])}
                    >
                      <option value="normal">普通笔记</option>
                      <option value="research">研究笔记</option>
                      <option value="conclusion">结论</option>
                      <option value="review">复盘</option>
                      <option value="decision">决策</option>
                      <option value="project">项目</option>
                      <option value="summary">摘要</option>
                    </select>
                  </label>
                  <label>
                    状态
                    <select
                      aria-label="笔记状态"
                      value={noteStatus}
                      onChange={(event) => setNoteStatus(event.target.value as KnowledgeNoteRow["status"])}
                    >
                      <option value="draft">草稿</option>
                      <option value="active">生效</option>
                      <option value="archived">归档</option>
                    </select>
                  </label>
                </div>
                <label>
                  正文（Markdown）
                  <textarea
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    placeholder="记录分析、结论和后续行动"
                  />
                </label>
                <label>
                  相关主题
                  <select
                    aria-label="笔记相关主题"
                    multiple
                    value={noteRelatedTopicIds.map(String)}
                    onChange={(event) => {
                      setNoteRelatedTopicIds(
                        Array.from(event.currentTarget.selectedOptions, (option) => Number(option.value)),
                      );
                    }}
                  >
                    {topics
                      .filter((topic) => topic.id !== topicDetail.topic.id && topic.status !== "merged")
                      .map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {topicPath(topic, topics).join(" / ")}
                        </option>
                      ))}
                  </select>
                  <small>按住 Ctrl 可多选；主要主题固定为当前知识页。</small>
                </label>
                <fieldset>
                  <legend>关联来源</legend>
                  <div className="knowledge-note-source-list">
                    {topicDetail.sources.map((source) => (
                      <label key={source.id}>
                        <input
                          type="checkbox"
                          checked={noteSourceItemIds.includes(source.id)}
                          onChange={(event) => {
                            setNoteSourceItemIds((current) => event.target.checked
                              ? Array.from(new Set([...current, source.id]))
                              : current.filter((id) => id !== source.id));
                          }}
                        />
                        <span>{source.title}</span>
                      </label>
                    ))}
                    {!topicDetail.sources.length ? <small>当前主题尚无可关联来源。</small> : null}
                  </div>
                </fieldset>
                <div className="knowledge-note-editor-actions">
                  <button disabled={busy || !noteTitle.trim()} onClick={() => void saveNote()}>
                    {noteEditId ? "保存笔记" : "创建笔记"}
                  </button>
                  {noteEditId ? (
                    <button className="secondary" disabled={busy} onClick={resetNoteEditor}>取消编辑</button>
                  ) : null}
                </div>
                <p className="knowledge-note-safety">笔记是独立对象；保存只更新笔记及关联表，不覆盖任何原始来源正文。</p>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    );
  }

  if (mode === "organize") {
    const duplicateNames = topics.filter((topic, index) =>
      topics.findIndex((other) => other.name.trim().toLowerCase() === topic.name.trim().toLowerCase()) !== index);
    const activeTopics = topics.filter((topic) => topic.status !== "merged");
    return (
      <main className="knowledge-page">
        <header className="knowledge-page-header">
          <div><span>结构治理</span><h1>整理工作台</h1><p>预览在前、提交可撤销；所有结果来自正式知识表。</p></div>
          <Sparkles size={28} />
        </header>
        <section className="knowledge-metrics">
          <div className="knowledge-card"><strong>{inbox.length}</strong><span>待归类来源</span></div>
          <div className="knowledge-card"><strong>{topics.filter((topic) => topic.sourceCount === 0).length}</strong><span>空主题</span></div>
          <div className="knowledge-card"><strong>{duplicateNames.length}</strong><span>同名候选</span></div>
        </section>
        <section className="knowledge-classification-management">
          <article className="knowledge-card knowledge-governance-panel">
            <div className="knowledge-panel-title"><Link2 size={19} /><div><h2>主题别名</h2><p>名称、缩写与旧路径都参与分类和搜索。</p></div></div>
            <div className="knowledge-governance-controls">
              <label>目标主题<select value={aliasTopicId ?? ""} onChange={(event) => setAliasTopicId(event.target.value ? Number(event.target.value) : null)}>
                <option value="">请选择</option>
                {activeTopics.map((topic) => <option key={topic.id} value={topic.id}>{topicPath(topic, topics).join(" / ")}</option>)}
              </select></label>
              <label>别名<input value={aliasValue} onChange={(event) => setAliasValue(event.target.value)} placeholder="例如：Google 风控" /></label>
              <label>类型<select value={aliasType} onChange={(event) => setAliasType(event.target.value as KnowledgeTopicAliasRow["aliasType"])}>
                <option value="name">常用名称</option>
                <option value="abbreviation">缩写</option>
                <option value="redirect">旧路径重定向</option>
                <option value="legacy_tag">旧标签</option>
              </select></label>
              <button disabled={busy || !aliasTopicId || !aliasValue.trim()} onClick={() => void saveAlias()}>
                {aliasEditId ? "保存修改" : "添加别名"}
              </button>
            </div>
            <div className="knowledge-management-list">
              {topicAliases.slice(0, 12).map((alias) => (
                <div key={alias.id}>
                  <span><strong>{alias.alias}</strong><small>{topics.find((topic) => topic.id === alias.topicId)?.name ?? "未知主题"} · {alias.aliasType}</small></span>
                  <button onClick={() => {
                    setAliasEditId(alias.id);
                    setAliasTopicId(alias.topicId);
                    setAliasValue(alias.alias);
                    setAliasType(alias.aliasType);
                  }}>编辑</button>
                  <button disabled={busy} onClick={() => void deleteAlias(alias.id)}>删除</button>
                </div>
              ))}
              {!topicAliases.length ? <p className="knowledge-empty">尚无正式主题别名。</p> : null}
            </div>
          </article>

          <article className="knowledge-card knowledge-governance-panel">
            <div className="knowledge-panel-title"><Sparkles size={19} /><div><h2>实体词典</h2><p>统一公司、产品、模型、地点和项目名称。</p></div></div>
            <div className="knowledge-governance-controls">
              <label>标准名称<input value={entityName} onChange={(event) => setEntityName(event.target.value)} placeholder="例如：Microsoft" /></label>
              <label>类型<select value={entityType} onChange={(event) => setEntityType(event.target.value as KnowledgeEntityRow["entityType"])}>
                <option value="company">公司</option>
                <option value="person">人物</option>
                <option value="product">产品</option>
                <option value="model">模型</option>
                <option value="industry">行业</option>
                <option value="place">地点</option>
                <option value="project">项目</option>
                <option value="custom">自定义</option>
                <option value="other">其他</option>
              </select></label>
              <label>同义名称<input value={entityAliasesText} onChange={(event) => setEntityAliasesText(event.target.value)} placeholder="用逗号分隔，例如：微软、MSFT" /></label>
              <button disabled={busy || !entityName.trim()} onClick={() => void saveEntity()}>
                {entityEditId ? "保存修改" : "添加实体"}
              </button>
            </div>
            <div className="knowledge-management-list">
              {entities.slice(0, 12).map((entity) => (
                <div key={entity.id}>
                  <span><strong>{entity.canonicalName}</strong><small>{entity.entityType}{entity.aliases.length ? ` · ${entity.aliases.join("、")}` : ""}</small></span>
                  <button onClick={() => {
                    setEntityEditId(entity.id);
                    setEntityName(entity.canonicalName);
                    setEntityType(entity.entityType);
                    setEntityAliasesText(entity.aliases.join("、"));
                  }}>编辑</button>
                  <button disabled={busy} onClick={() => void deleteEntity(entity.id)}>删除</button>
                </div>
              ))}
              {!entities.length ? <p className="knowledge-empty">尚无正式实体词典。</p> : null}
            </div>
          </article>

          <article className="knowledge-card knowledge-governance-panel">
            <div className="knowledge-panel-title"><Sparkles size={19} /><div><h2>分类规则</h2><p>显式规则可启用、停用和修正，不覆盖原始资料。</p></div></div>
            <div className="knowledge-governance-controls">
              <label>目标主题<select value={ruleTopicId ?? ""} onChange={(event) => setRuleTopicId(event.target.value ? Number(event.target.value) : null)}>
                <option value="">请选择</option>
                {activeTopics.map((topic) => <option key={topic.id} value={topic.id}>{topicPath(topic, topics).join(" / ")}</option>)}
              </select></label>
              <label>规则类型<select value={ruleType} onChange={(event) => setRuleType(event.target.value as KnowledgeClassificationRuleRow["ruleType"])}>
                <option value="keyword">关键词</option>
                <option value="exact_alias">别名</option>
                <option value="negative_keyword">排除关键词</option>
                <option value="file_path">文件路径</option>
                <option value="entity">实体</option>
                <option value="source">来源平台</option>
                <option value="legacy_tag">旧标签</option>
                <option value="domain_hint">领域提示</option>
              </select></label>
              <label>匹配内容<input value={rulePattern} onChange={(event) => setRulePattern(event.target.value)} placeholder="例如：资本开支" /></label>
              <label>强度<input type="number" min="0" max="1" step="0.05" value={ruleWeight} onChange={(event) => setRuleWeight(Number(event.target.value))} /></label>
              <label className="knowledge-confirm-check"><input type="checkbox" checked={ruleEnabled} onChange={(event) => setRuleEnabled(event.target.checked)} />启用规则</label>
              <button disabled={busy || !ruleTopicId || !rulePattern.trim()} onClick={() => void saveRule()}>
                {ruleEditId ? "保存修改" : "添加规则"}
              </button>
            </div>
            <div className="knowledge-management-list">
              {classificationRules.slice(0, 12).map((rule) => (
                <div key={rule.id}>
                  <span><strong>{rule.pattern}</strong><small>{rule.ruleType} · {rule.enabled ? "启用" : "停用"} · {Math.round(rule.weight * 100)}%</small></span>
                  <button onClick={() => {
                    setRuleEditId(rule.id);
                    setRuleTopicId(rule.targetTopicId);
                    setRuleType(rule.ruleType);
                    setRulePattern(rule.pattern);
                    setRuleWeight(rule.weight);
                    setRuleEnabled(rule.enabled);
                  }}>编辑</button>
                  <button disabled={busy} onClick={() => void deleteRule(rule.id)}>删除</button>
                </div>
              ))}
              {!classificationRules.length ? <p className="knowledge-empty">尚无正式分类规则。</p> : null}
            </div>
          </article>
        </section>
        <section className="knowledge-governance-grid">
          <article className="knowledge-card knowledge-governance-panel">
            <div className="knowledge-panel-title"><Merge size={19} /><div><h2>合并主题</h2><p>先检查影响范围，再执行可撤销事务。</p></div></div>
            <div className="knowledge-governance-controls">
              <label>待合并主题<select value={mergeSourceId ?? ""} onChange={(event) => {
                setMergeSourceId(event.target.value ? Number(event.target.value) : null);
                setMergePreview(null);
              }}><option value="">请选择</option>{activeTopics.map((topic) => <option key={topic.id} value={topic.id}>{topicPath(topic, topics).join(" / ")}</option>)}</select></label>
              <label>保留的目标主题<select value={mergeTargetId ?? ""} onChange={(event) => {
                setMergeTargetId(event.target.value ? Number(event.target.value) : null);
                setMergePreview(null);
              }}><option value="">请选择</option>{activeTopics.filter((topic) => topic.id !== mergeSourceId).map((topic) => <option key={topic.id} value={topic.id}>{topicPath(topic, topics).join(" / ")}</option>)}</select></label>
              <button disabled={busy || !mergeSourceId || !mergeTargetId} onClick={() => void buildMergePreview()}>生成影响预览</button>
            </div>
            {mergePreview ? (
              <div className="knowledge-operation-preview">
                <strong>{mergePreview.sourceTopic.name} → {mergePreview.targetTopic.name}</strong>
                <div className="knowledge-preview-counts">
                  <span>{mergePreview.sourceLinksToMove} 条来源</span>
                  <span>{mergePreview.judgmentsToMove} 条判断</span>
                  <span>{mergePreview.evidenceToMove} 条证据</span>
                  <span>{mergePreview.questionsToMove} 个问题</span>
                  <span>{mergePreview.relationsToRewrite} 条关系</span>
                  <span>{mergePreview.redirectAliases.length} 个旧名称/路径重定向</span>
                </div>
                {mergePreview.duplicateSourceLinks ? <p>其中 {mergePreview.duplicateSourceLinks} 条来源已在目标主题，将去重保留。</p> : null}
                {mergePreview.blockers.map((blocker) => <p className="knowledge-blocker" key={blocker}>{blocker}</p>)}
                <button className="knowledge-primary-action" disabled={busy || mergePreview.blockers.length > 0} onClick={() => void commitMerge()}><Merge size={16} />确认合并</button>
              </div>
            ) : null}
          </article>
          <article className="knowledge-card knowledge-governance-panel">
            <div className="knowledge-panel-title"><Scissors size={19} /><div><h2>拆分预览</h2><p>按真实来源类型形成候选组，不自动移动资料。</p></div></div>
            <div className="knowledge-governance-controls">
              <label>选择主题<select value={splitTopicId ?? ""} onChange={(event) => {
                setSplitTopicId(event.target.value ? Number(event.target.value) : null);
                setSplitPreview(null);
              }}><option value="">请选择</option>{activeTopics.filter((topic) => topic.sourceCount > 0).map((topic) => <option key={topic.id} value={topic.id}>{topicPath(topic, topics).join(" / ")}</option>)}</select></label>
              <button disabled={busy || !splitTopicId} onClick={() => void buildSplitPreview()}>分析拆分边界</button>
            </div>
            {splitPreview ? (
              <div className="knowledge-operation-preview">
                {splitPreview.groups.map((group) => (
                  <div className="knowledge-split-group" key={group.key}>
                    <strong>{group.label}</strong>
                    <span>{group.sourceItemIds.length} 条来源</span>
                    <small>{group.sourceTitles.slice(0, 3).join("、")}{group.sourceTitles.length > 3 ? "…" : ""}</small>
                  </div>
                ))}
                {!splitPreview.groups.length ? <p>当前主题还没有可分析的来源。</p> : null}
                <p>{splitPreview.note}</p>
              </div>
            ) : null}
          </article>
        </section>
        <section className="knowledge-card knowledge-governance-panel knowledge-relation-panel">
          <div className="knowledge-panel-title"><Link2 size={19} /><div><h2>关系建议</h2><p>仅展示名称完全一致或明确包含的确定性候选，写入前仍需确认。</p></div></div>
          <div className="knowledge-relation-list">
            {relationSuggestions.map((suggestion) => (
              <div key={`${suggestion.fromTopicId}-${suggestion.toTopicId}-${suggestion.relationType}`}>
                <span><strong>{suggestion.fromTopicName}</strong><ArrowRight size={14} /><strong>{suggestion.toTopicName}</strong></span>
                <p>{suggestion.reason}</p>
                <em>{Math.round(suggestion.confidence)}%</em>
                <button disabled={busy} onClick={() => void acceptRelation(suggestion)}>确认关系</button>
              </div>
            ))}
            {!relationSuggestions.length ? <p className="knowledge-empty">当前没有满足确定性门槛的关系候选。</p> : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
    <main className="knowledge-page knowledge-inbox-page">
      <header className="knowledge-page-header">
        <div><span>来源先归档，再分类</span><h1>收录箱</h1><p>已加载 {inbox.length} 条待确认来源；分类失败不会丢失来源。</p></div>
        <div className="knowledge-header-actions">
          <button disabled={busy || !inbox.length} onClick={() => void autoOrganizeLoadedInbox()}>
            <Sparkles size={16} />自动整理已加载来源
          </button>
          <Inbox size={28} />
        </div>
      </header>
      <section className="knowledge-inbox-layout">
        <div className="knowledge-card knowledge-inbox-list">
          {inbox.map((item) => (
            <button key={item.id} className={item.id === selectedId ? "active" : ""} onClick={() => setSelectedId(item.id)}>
              <span className="knowledge-source-kind">{item.sourceType}</span>
              <strong>{item.title}</strong>
              <small>{item.originalAt ?? item.importedAt}</small>
              <ChevronRight size={16} />
            </button>
          ))}
          {inbox.length >= inboxLimit ? (
            <button
              className="knowledge-inbox-load-more"
              disabled={busy}
              onClick={async () => {
                const nextLimit = inboxLimit + INITIAL_INBOX_LIMIT;
                setBusy(true);
                try {
                  setInbox(await repository.listInbox(nextLimit));
                  setInboxLimit(nextLimit);
                } catch (error) {
                  onNotify(error instanceof Error ? error.message : "加载更多来源失败");
                } finally {
                  setBusy(false);
                }
              }}
            >
              加载更多来源
            </button>
          ) : null}
          {!inbox.length ? <p className="knowledge-empty">收录箱已清空。新导入资料会自动进入这里。</p> : null}
        </div>
        <div className="knowledge-card knowledge-inbox-detail">
          {selected ? (
            <>
              <div className="knowledge-detail-heading">
                <div><span>{selected.sourceType}</span><h2>{selected.title}</h2></div>
                <div className="knowledge-detail-actions">
                  {selectedOriginalText ? (
                    <button onClick={() => setSourceDetailOpen(true)}>
                      <Maximize2 size={16} />查看详情
                    </button>
                  ) : null}
                  <button onClick={() => void generateSuggestions()} disabled={busy || autoSuggestingSourceId === selected.id || !topics.length}>
                    <Sparkles size={16} />
                    {autoSuggestingSourceId === selected.id
                      ? "自动整理中…"
                      : currentPendingSuggestions.length
                        ? "重新计算建议"
                        : hasStalePendingSuggestions
                          ? "按新版重新计算"
                          : "生成分类建议"}
                  </button>
                </div>
              </div>
              <div className="knowledge-source-preview">
                {selectedReadableContent === null
                  ? <div className="page-loading"><span className="save-spinner" />正在读取当前来源正文…</div>
                  : <>
                    {visibleSourceMessages.length ? (
                      <div className="knowledge-conversation-reader">
                        {visibleSourceMessages.map((message, index) => (
                          <ReadableMessageContent
                            key={`${message.role}-${message.createdAt ?? index}-${index}`}
                            message={message}
                            compact
                          />
                        ))}
                      </div>
                    ) : (
                      <MarkdownContent
                        value={readableSourceText || "来源正文为空"}
                        className="source-plain-text"
                      />
                    )}
                  </>}
              </div>
              <div className="knowledge-suggestion-panel">
                <h3>主题归属</h3>
                {currentPendingSuggestions.map((suggestion) => {
                  const topic = topics.find((candidate) => candidate.id === suggestion.suggestedTopicId);
                  if (!topic) return null;
                  return (
                    <label className={selectedTopicId === topic.id ? "active" : ""} key={suggestion.id}>
                      <input type="radio" checked={selectedTopicId === topic.id} onChange={() => setSelectedTopicId(topic.id)} />
                      <span><strong>{topicPath(topic, topics).join(" / ")}</strong><small>{suggestion.reasons[0] ?? "本地确定性评分"}</small></span>
                      <em>{Math.round(suggestion.score)}%</em>
                    </label>
                  );
                })}
                {!currentPendingSuggestions.length ? (
                  <p className="knowledge-suggestion-empty">
                    {hasStalePendingSuggestions
                      ? "旧版建议已隐藏，请按新版重新计算；不会自动采用旧结果。"
                      : "当前没有证据充分的自动建议。可手动选择，或到主题浏览器新建更准确的主题。"}
                  </p>
                ) : null}
                <label className="knowledge-manual-topic">
                  <span>手动选择主题</span>
                  <select value={selectedTopicId ?? ""} onChange={(event) => setSelectedTopicId(event.target.value ? Number(event.target.value) : null)}>
                    <option value="">请选择</option>
                    {topics.map((topic) => <option key={topic.id} value={topic.id}>{topicPath(topic, topics).join(" / ")}</option>)}
                  </select>
                </label>
                <button className="knowledge-primary-action" onClick={() => void acceptClassification()} disabled={busy || selectedTopicId === null}>
                  <Check size={17} />确认归类<ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : <p className="knowledge-empty">选择一条来源查看正文和分类解释。</p>}
        </div>
      </section>
    </main>
    {sourceDetailOpen && selected && selectedReadableContent ? (
      <KnowledgeSourceDialog
        title={selected.title}
        messages={selectedReadableContent.messages}
        fullText={selectedReadableContent.fullText}
        onClose={() => setSourceDetailOpen(false)}
      />
    ) : null}
    </>
  );
}
