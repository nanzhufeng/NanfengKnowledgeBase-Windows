import {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  FileText,
  FolderTree,
  Image as ImageIcon,
  Link2,
  Layers3,
  Maximize2,
  Merge,
  Paperclip,
  Pencil,
  Plus,
  RadioTower,
  Scissors,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { CLASSIFIER_ALGORITHM_VERSION } from "../knowledge/deterministicClassifier";
import {
  connectorMetricsEqual,
  measureCardToCardConnector,
} from "../connectionGeometry";
import { useRafScheduledCallback } from "../performance/useRafScheduledCallback";
import { scheduleIdleWork } from "../performance/interactionScheduler";
import {
  readImportedContent,
  type ReadableSourceMessage,
} from "../domain/importedContent";
import {
  autoOrganizeImportedSources,
  suggestionsForPersistence,
  undoAutoOrganization,
  upgradeOutdatedInboxSuggestions,
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
  type TopicDecisionRow,
  type TopicPropositionRow,
  type TopicRelationSuggestion,
  type TopicSplitPreview,
  type SourceCollection,
} from "../services/knowledgeRepository";
import {
  loadKnowledgeEntryData,
  loadSourceEntryData,
  loadSourceSupportingData,
  loadTopicMaintenanceData,
} from "../services/knowledgeWorkspaceData";
import { classifySourceAsync } from "../services/classificationWorker";
import MarkdownContent, { ReadableMessageContent } from "./MarkdownContent";
import type {
  AttachmentItem,
  IntelligenceRecord,
  RecordStatus,
  RecordSummary,
} from "../domain/models";
import {
  resolveSourceAssetAttachment,
  sourceAssetIsImage,
} from "../knowledge/sourceAttachmentMatching";
import {
  centeredSourceScrollTop,
  shouldResetSourceArchiveEntry,
  sourceCardIsFullyVisible,
} from "../knowledge/sourceViewport";
import {
  clearSourceSearchHistory,
  readSourceSearchHistory,
  rememberSourceSearch,
} from "../knowledge/sourceSearchHistory";
import { collectTopicStructuralAttentionIds } from "../knowledge/topicStructurePolicy";
import {
  KnowledgeReadingWorkspace,
  type KnowledgeReadingTarget,
  type KnowledgeSourceTarget,
} from "./KnowledgeReadingWorkspace";
import {
  TopicStructureReadingWorkspace,
  type TopicMaintenanceTask,
} from "./TopicStructureReadingWorkspace";
import { NoteListActions } from "./NoteListActions";
import {
  UnifiedNoteListCard,
  UnifiedNoteListDisplayToolbar,
  UnifiedNoteListFilter,
  UnifiedNoteListLocator,
  UnifiedNoteListPanel,
  UnifiedNoteListSearchRow,
  UnifiedNoteListToolbar,
  UNIFIED_NOTE_FILTER_ALL,
  createUnifiedNoteSourceFilterField,
  createUnifiedNoteStatusFilterField,
  createUnifiedNoteTopicFilterField,
  createUnifiedNoteDateFilterFields,
  matchesUnifiedNoteFilter,
  cycleUnifiedNoteListSortMode,
  resolveNoteIconKey,
  sortUnifiedNoteListItems,
  type UnifiedNoteListSortMode,
} from "./UnifiedNoteListCard";

type Mode = "sources" | "topics" | "knowledge";
type TopicStructureDialogState =
  | { kind: "create-domain" }
  | { kind: "edit-domain"; domainId: number }
  | { kind: "create-topic"; domainId: number; parentTopicId: number | null }
  | { kind: "edit-topic"; topicId: number }
  | null;
const INITIAL_INBOX_LIMIT = 120;
const SOURCE_PREVIEW_LIMIT = 20_000;

// 只保存当前应用会话的轻量读取快照。重新挂载时先恢复可见内容，再后台复核正式库；
// 不持久化、不覆盖正式数据，也不把快照当作事实来源。
const workspaceSession = {
  loadedModes: new Set<Mode>(),
  inbox: [] as KnowledgeInboxItem[],
  sourceCollections: [] as SourceCollection[],
  domains: [] as KnowledgeDomainRow[],
  topics: [] as KnowledgeTopicRow[],
};

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
  attachments,
  onOpenAttachment,
  onClose,
}: {
  title: string;
  messages: ReadableSourceMessage[];
  fullText: string;
  attachments: AttachmentItem[];
  onOpenAttachment: (attachment: AttachmentItem) => void;
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
              <KnowledgeSourceMessage
                key={`${message.role}-${message.createdAt ?? index}-${index}`}
                message={message}
                attachments={attachments}
                onOpenAttachment={onOpenAttachment}
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

function SourceCollectionManagerDialog({
  collections,
  busyCollectionId,
  onRename,
  onClose,
}: {
  collections: SourceCollection[];
  busyCollectionId: number | null;
  onRename: (sourceCollectionId: number, displayName: string) => Promise<void>;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<number, string>>(() => Object.fromEntries(
    collections.map((collection) => [collection.id, collection.displayName]),
  ));

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    setDrafts((current) => Object.fromEntries(collections.map((collection) => [
      collection.id,
      current[collection.id] ?? collection.displayName,
    ])));
  }, [collections]);

  return createPortal(
    <div className="prototype-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="prototype-dialog elevated-card source-collection-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="管理来源名称"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="prototype-dialog-heading">
          <div>
            <span>统一来源目录</span>
            <h2>管理来源名称</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>
        <p className="source-collection-explanation">
          重命名只改变四个列表入口统一显示的来源名称；原始文件名、归档路径和文件哈希继续保留。
        </p>
        <div className="source-collection-list">
          {collections.map((collection) => {
            const draft = drafts[collection.id] ?? collection.displayName;
            const unchanged = draft.trim() === collection.displayName;
            return (
              <form
                key={collection.id}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!unchanged && draft.trim()) {
                    void onRename(collection.id, draft.trim());
                  }
                }}
              >
                <div>
                  <strong>{collection.displayName}</strong>
                  <span>
                    {collection.sourceItemCount} 条笔记
                    {collection.originalFileCount > 0 ? ` · ${collection.originalFileCount} 个导入原件` : ""}
                  </span>
                </div>
                <input
                  value={draft}
                  maxLength={80}
                  aria-label={`重命名${collection.displayName}`}
                  onChange={(event) => setDrafts((current) => ({
                    ...current,
                    [collection.id]: event.target.value,
                  }))}
                />
                <button
                  type="submit"
                  disabled={busyCollectionId !== null || unchanged || !draft.trim()}
                >
                  {busyCollectionId === collection.id ? "保存中…" : "保存"}
                </button>
              </form>
            );
          })}
          {!collections.length ? <p className="knowledge-empty">当前没有可管理的来源。</p> : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function KnowledgeSourceMessage({
  message,
  attachments,
  compact = false,
  onOpenAttachment,
}: {
  message: ReadableSourceMessage;
  attachments: AttachmentItem[];
  compact?: boolean;
  onOpenAttachment: (attachment: AttachmentItem) => void;
}) {
  return (
    <ReadableMessageContent
      message={message}
      compact={compact}
      className={compact ? "right-reading-copy right-reading-copy-12" : undefined}
    >
      {message.assets.length ? (
        <div className="source-assets">
          {message.assets.map((asset, index) => {
            const attachment = resolveSourceAssetAttachment(asset, attachments);
            const key = asset.fileUuid ?? `${asset.fileName}-${index}`;
            if (attachment && sourceAssetIsImage(asset, attachment)) {
              return (
                <button
                  className="source-image"
                  key={key}
                  onClick={() => onOpenAttachment(attachment)}
                  title={`软件内预览图片：${asset.fileName}`}
                >
                  <img
                    src={convertFileSrc(attachment.storedPath)}
                    alt={asset.fileName}
                    loading="lazy"
                    decoding="async"
                  />
                  <span>{asset.fileName}</span>
                </button>
              );
            }
            if (attachment) {
              return (
                <button
                  className="source-file-chip"
                  key={key}
                  onClick={() => onOpenAttachment(attachment)}
                  title={`软件内预览附件：${asset.fileName}`}
                >
                  <Paperclip size={15} /><span>{asset.fileName}</span>
                </button>
              );
            }
            return (
              <span className="source-image-placeholder" key={key}>
                {asset.kind === "image" ? <ImageIcon size={19} /> : <Paperclip size={16} />}
                <span><strong>{asset.fileName}</strong><em>原附件尚未进入受控目录</em></span>
              </span>
            );
          })}
        </div>
      ) : null}
    </ReadableMessageContent>
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

function readLocator(locatorJson: string | null): EvidenceLocator | null {
  if (!locatorJson) return null;
  try {
    const parsed = JSON.parse(locatorJson) as Partial<EvidenceLocator>;
    if (typeof parsed.kind !== "string" || typeof parsed.value !== "string") return null;
    return parsed as EvidenceLocator;
  } catch {
    return null;
  }
}

function formatSourceDate(value: string | null | undefined): string {
  if (!value) return "日期未知";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function sourceOriginLabel(item: KnowledgeInboxItem): string {
  const platform = item.platform.trim();
  if (platform) return platform;
  return ({
    ai_conversation: "AI 对话",
    chatgpt: "ChatGPT",
    markdown: "Markdown 文件",
    json: "JSON 文件",
    text: "文本文件",
    file: "本地文件",
    pdf: "PDF 文件",
  } as Record<string, string>)[item.sourceType] ?? item.sourceType;
}

function locateSourceElement(
  container: HTMLElement,
  locator: EvidenceLocator | null,
): HTMLElement | null {
  if (!locator || locator.kind === "none") return null;
  const needle = (locator.quote || locator.value).trim().toLocaleLowerCase("zh-CN");
  if (!needle) return null;
  const selectors = locator.kind === "markdown_heading"
    ? "h1,h2,h3,h4,h5,h6"
    : locator.kind === "html_paragraph"
      ? "p"
      : "h1,h2,h3,h4,h5,h6,p,li,blockquote,pre";
  return Array.from(container.querySelectorAll<HTMLElement>(selectors)).find(
    (element) => element.innerText.trim().toLocaleLowerCase("zh-CN").includes(needle),
  ) ?? null;
}

function scrollSourceElementWithinContainer(
  container: HTMLElement,
  target: HTMLElement,
  behavior: ScrollBehavior,
) {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const targetOffsetTop = targetRect.top - containerRect.top + container.scrollTop;
  container.scrollTo({
    top: centeredSourceScrollTop({
      targetOffsetTop,
      targetHeight: targetRect.height,
      viewportHeight: container.clientHeight,
      scrollHeight: container.scrollHeight,
    }),
    behavior,
  });
}

function KnowledgeWorkspaceView({
  repository: providedRepository,
  mode,
  onNotify,
  sourceNavigationTarget,
  onSourceNavigationHandled,
  knowledgeNavigationTarget,
  onNavigateToSource,
  onNavigateToKnowledgeTopic,
  records,
  filterTopicValues,
  onToggleRecordFavorite,
  onUpdateRecordStatus,
  onMoveRecordToTrash,
  onExportRecord,
  onOpenAttachment,
  onSourceTitleUpdated,
  onSourceActionRecordCreated,
  onSourceCollectionsChanged,
}: {
  repository?: KnowledgeRepository;
  mode: Mode;
  onNotify: (message: string, options?: {
    durationMs?: number;
    actionLabel?: string;
    onAction?: () => void | Promise<void>;
  }) => void;
  sourceNavigationTarget: (KnowledgeSourceTarget & { requestId: number }) | null;
  onSourceNavigationHandled: (requestId: number) => void;
  knowledgeNavigationTarget: ({ topicId: number } & KnowledgeReadingTarget) | null;
  onNavigateToSource: (target: KnowledgeSourceTarget) => void;
  onNavigateToKnowledgeTopic: (target: {
    topicId: number;
    viewMode?: KnowledgeReadingTarget["viewMode"];
    sourceItemId?: number;
  }) => void;
  records: RecordSummary[];
  filterTopicValues: string[];
  onToggleRecordFavorite: (recordId: number) => Promise<void>;
  onUpdateRecordStatus: (recordId: number, status: RecordStatus) => Promise<void>;
  onMoveRecordToTrash: (recordId: number) => Promise<boolean>;
  onExportRecord: (recordId: number) => Promise<void>;
  onOpenAttachment: (attachment: AttachmentItem) => void;
  onSourceTitleUpdated: (recordId: number | null, title: string, updatedAt: string) => void;
  onSourceActionRecordCreated: (
    record: IntelligenceRecord,
    primaryTopicName: string | null,
  ) => void;
  onSourceCollectionsChanged: () => Promise<void>;
}) {
  const fallbackRepository = useMemo(() => new KnowledgeRepository(), []);
  const repository = providedRepository ?? fallbackRepository;
  const [inbox, setInbox] = useState<KnowledgeInboxItem[]>(() => workspaceSession.inbox);
  const [inboxLimit, setInboxLimit] = useState(INITIAL_INBOX_LIMIT);
  const [sourceFilter, setSourceFilter] = useState<"all" | "pending" | "organized">("all");
  const [sourceSearch, setSourceSearch] = useState("");
  const deferredSourceSearch = useDeferredValue(sourceSearch);
  const [sourceSearchResults, setSourceSearchResults] = useState<KnowledgeInboxItem[] | null>(null);
  const [sourceSearchBusy, setSourceSearchBusy] = useState(false);
  const [sourceArchiveTotal, setSourceArchiveTotal] = useState(0);
  const [sourceSearchHistory, setSourceSearchHistory] = useState(() => readSourceSearchHistory());
  const [sourceSearchHistoryOpen, setSourceSearchHistoryOpen] = useState(false);
  const [sourceFilterOpen, setSourceFilterOpen] = useState(false);
  const [sourceCollectionManagerOpen, setSourceCollectionManagerOpen] = useState(false);
  const [sourceCollections, setSourceCollections] = useState<SourceCollection[]>(
    () => workspaceSession.sourceCollections,
  );
  const [sourceCollectionBusyId, setSourceCollectionBusyId] = useState<number | null>(null);
  const [sourceDateFrom, setSourceDateFrom] = useState("");
  const [sourceDateTo, setSourceDateTo] = useState("");
  const [sourceOriginFilter, setSourceOriginFilter] = useState(UNIFIED_NOTE_FILTER_ALL);
  const [sourceRecordStatusFilter, setSourceRecordStatusFilter] = useState<
    typeof UNIFIED_NOTE_FILTER_ALL | RecordStatus
  >(UNIFIED_NOTE_FILTER_ALL);
  const [sourceTopicFilter, setSourceTopicFilter] = useState(UNIFIED_NOTE_FILTER_ALL);
  const [loadedSourceText, setLoadedSourceText] = useState<{
    sourceItemId: number;
    text: string;
  } | null>(null);
  const [sourceAttachments, setSourceAttachments] = useState<AttachmentItem[]>([]);
  const [sourceDetailOpen, setSourceDetailOpen] = useState(false);
  const [editingSourceTitle, setEditingSourceTitle] = useState(false);
  const [sourceTitleDraft, setSourceTitleDraft] = useState("");
  const [sourceListMenuRecordId, setSourceListMenuRecordId] = useState<number | null>(null);
  const [sourceLocatorIndex, setSourceLocatorIndex] = useState(0);
  const [sourceCompactMode, setSourceCompactMode] = useState(true);
  const [sourceSortMode, setSourceSortMode] = useState<UnifiedNoteListSortMode>("default");
  const sourceTextRequestSequence = useRef(0);
  const sourceSearchRequestSequence = useRef(0);
  const sourceActionRecordRequests = useRef(new Map<number, Promise<IntelligenceRecord>>());
  const loadedModes = useRef<Set<Mode>>(new Set());
  const cancelSourceSupportingLoad = useRef<(() => void) | null>(null);
  const preparedCatalogVersion = useRef<string | null>(null);
  const catalogPreparation = useRef<Promise<void> | null>(null);
  const classificationUpgradeStarted = useRef(false);
  const [domains, setDomains] = useState<KnowledgeDomainRow[]>(() => workspaceSession.domains);
  const [topics, setTopics] = useState<KnowledgeTopicRow[]>(() => workspaceSession.topics);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedIdRef = useRef<number | null>(selectedId);
  selectedIdRef.current = selectedId;
  const [sourceBodySearch, setSourceBodySearch] = useState("");
  const [knowledgeMaintenanceOpen, setKnowledgeMaintenanceOpen] = useState(false);
  const sourceBodyRef = useRef<HTMLDivElement | null>(null);
  const sourceSearchInputRef = useRef<HTMLInputElement | null>(null);
  const sourceListRef = useRef<HTMLDivElement | null>(null);
  const sourceLayoutRef = useRef<HTMLElement | null>(null);
  const sourceDetailRef = useRef<HTMLDivElement | null>(null);
  const previousModeRef = useRef<Mode>(mode);
  const [sourceConnector, setSourceConnector] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [suggestions, setSuggestions] = useState<KnowledgeClassificationSuggestionRow[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [loading, setLoading] = useState(() => !workspaceSession.loadedModes.has(mode));
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
  const [relatedTopicDetails, setRelatedTopicDetails] = useState<KnowledgeTopicDetail[]>([]);
  const [sourceTopicDetail, setSourceTopicDetail] = useState<KnowledgeTopicDetail | null>(null);
  const [topicMaintenanceOpen, setTopicMaintenanceOpen] = useState(false);
  const [topicStructureEditorOpen, setTopicStructureEditorOpen] = useState(false);
  const [topicStructureDialog, setTopicStructureDialog] =
    useState<TopicStructureDialogState>(null);
  const [topicAdvancedMaintenanceOpen, setTopicAdvancedMaintenanceOpen] = useState(false);
  const [expandedMaintenanceTopicIds, setExpandedMaintenanceTopicIds] =
    useState<Set<number>>(new Set());
  const [maintenanceTopicDetails, setMaintenanceTopicDetails] =
    useState<Record<number, KnowledgeTopicDetail>>({});
  const [judgmentText, setJudgmentText] = useState("");
  const [judgmentReason, setJudgmentReason] = useState("");
  const [judgmentPropositionId, setJudgmentPropositionId] = useState<number | null>(null);
  const [evidenceText, setEvidenceText] = useState("");
  const [evidenceSourceId, setEvidenceSourceId] = useState<number | null>(null);
  const [evidencePropositionId, setEvidencePropositionId] = useState<number | null>(null);
  const [evidenceStance, setEvidenceStance] = useState<"support" | "oppose" | "context">("context");
  const [evidenceCredibility, setEvidenceCredibility] = useState(60);
  const [evidenceVerificationStatus, setEvidenceVerificationStatus] = useState("unverified");
  const [evidenceValidityStatus, setEvidenceValidityStatus] = useState("active");
  const [evidenceLocatorKind, setEvidenceLocatorKind] = useState<EvidenceLocator["kind"]>("none");
  const [evidenceLocatorValue, setEvidenceLocatorValue] = useState("");
  const [evidenceQuote, setEvidenceQuote] = useState("");
  const [evidenceConfirmedAt, setEvidenceConfirmedAt] = useState("");
  const [evidenceValidUntil, setEvidenceValidUntil] = useState("");
  const [evidenceReviewAt, setEvidenceReviewAt] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [propositionEditId, setPropositionEditId] = useState<number | null>(null);
  const [propositionText, setPropositionText] = useState("");
  const [propositionStatus, setPropositionStatus] = useState<TopicPropositionRow["status"]>("open");
  const [propositionKind, setPropositionKind] = useState<TopicPropositionRow["propositionKind"]>("claim");
  const [propositionHypothesisGroup, setPropositionHypothesisGroup] = useState("");
  const [propositionConfidence, setPropositionConfidence] = useState(50);
  const [propositionInvalidation, setPropositionInvalidation] = useState("");
  const [propositionValidity, setPropositionValidity] =
    useState<TopicPropositionRow["validityStatus"]>("active");
  const [propositionConfirmedAt, setPropositionConfirmedAt] = useState("");
  const [propositionValidUntil, setPropositionValidUntil] = useState("");
  const [propositionReviewAt, setPropositionReviewAt] = useState("");
  const [decisionEditId, setDecisionEditId] = useState<number | null>(null);
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionText, setDecisionText] = useState("");
  const [decisionPropositionId, setDecisionPropositionId] = useState<number | null>(null);
  const [decisionJudgmentId, setDecisionJudgmentId] = useState<number | null>(null);
  const [decisionKnownRisks, setDecisionKnownRisks] = useState("");
  const [decisionExpectedResult, setDecisionExpectedResult] = useState("");
  const [decisionActions, setDecisionActions] = useState("");
  const [decisionReviewAt, setDecisionReviewAt] = useState("");
  const [decisionResultStatus, setDecisionResultStatus] =
    useState<TopicDecisionRow["resultStatus"]>("pending");
  const [decisionFinalResult, setDecisionFinalResult] = useState("");
  const [decisionRetrospective, setDecisionRetrospective] = useState("");
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

  const sourceSearchQuery = deferredSourceSearch.trim();
  const sourceCollection = sourceSearchQuery ? (sourceSearchResults ?? []) : inbox;
  const selected = sourceCollection.find((item) => item.id === selectedId)
    ?? inbox.find((item) => item.id === selectedId)
    ?? null;
  const selectedSourceItemId = selected?.id ?? null;

  useEffect(() => {
    if (mode !== "sources") return;
    let cancelled = false;
    void repository.countSourceArchive()
      .then((count) => {
        if (!cancelled) setSourceArchiveTotal(count);
      })
      .catch((error) => onNotify(
        error instanceof Error ? error.message : "来源总数读取失败",
      ));
    return () => {
      cancelled = true;
    };
  }, [mode, onNotify, repository]);

  useEffect(() => {
    const query = sourceSearchQuery;
    sourceSearchRequestSequence.current += 1;
    const requestId = sourceSearchRequestSequence.current;
    if (mode !== "sources" || !query) {
      setSourceSearchResults(null);
      setSourceSearchBusy(false);
      return;
    }
    setSourceSearchBusy(true);
    const timer = window.setTimeout(() => {
      void repository.searchSourceArchive(
        query,
        Math.max(sourceArchiveTotal, 2_000),
      ).then((items) => {
        if (sourceSearchRequestSequence.current !== requestId) return;
        setSourceSearchResults(items);
      }).catch((error) => {
        if (sourceSearchRequestSequence.current !== requestId) return;
        setSourceSearchResults([]);
        onNotify(error instanceof Error ? error.message : "全库正文搜索失败");
      }).finally(() => {
        if (sourceSearchRequestSequence.current === requestId) setSourceSearchBusy(false);
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [mode, onNotify, repository, sourceArchiveTotal, sourceSearchQuery]);

  useEffect(() => {
    if (!sourceSearchQuery || sourceSearchResults === null || sourceSearchBusy) return;
    const timer = window.setTimeout(() => {
      setSourceSearchHistory(rememberSourceSearch(sourceSearchQuery));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [sourceSearchBusy, sourceSearchQuery, sourceSearchResults]);

  useEffect(() => {
    let cancelled = false;
    if (selectedSourceItemId === null) {
      setSourceAttachments([]);
      return () => {
        cancelled = true;
      };
    }
    setSourceAttachments([]);
    void repository.listSourceAttachments(selectedSourceItemId)
      .then((items) => {
        if (!cancelled) setSourceAttachments(items);
      })
      .catch((error) => {
        if (!cancelled) setSourceAttachments([]);
        onNotify(error instanceof Error ? error.message : "来源附件读取失败");
      });
    return () => {
      cancelled = true;
    };
  }, [onNotify, repository, selectedSourceItemId]);

  useEffect(() => {
    setEditingSourceTitle(false);
    setSourceTitleDraft(selected?.title ?? "");
  }, [selected?.id, selected?.title]);

  const commitSourceSearch = (value = sourceSearch) => {
    const next = rememberSourceSearch(value);
    setSourceSearchHistory(next);
    setSourceSearchHistoryOpen(false);
  };

  const loadAllSources = async () => {
    const total = Math.max(sourceArchiveTotal, inbox.length);
    if (!total || inbox.length >= total) return;
    setBusy(true);
    try {
      const items = await repository.listSourceArchive(total);
      setInbox(items);
      setInboxLimit(total);
      setSourceArchiveTotal(Math.max(total, items.length));
      onNotify(`已加载全部 ${items.length} 条来源`);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "加载全部来源失败");
    } finally {
      setBusy(false);
    }
  };

  const openSourceCollectionManager = async () => {
    setSourceCollectionManagerOpen(true);
    try {
      setSourceCollections(await repository.listSourceCollections());
    } catch (error) {
      setSourceCollectionManagerOpen(false);
      onNotify(error instanceof Error ? error.message : "来源目录读取失败");
    }
  };

  const renameSourceCollection = async (sourceCollectionId: number, displayName: string) => {
    const previous = sourceCollections.find((item) => item.id === sourceCollectionId);
    setSourceCollectionBusyId(sourceCollectionId);
    try {
      const updated = await repository.renameSourceCollection(sourceCollectionId, displayName);
      setSourceCollections((current) => current.map((item) => (
        item.id === updated.id ? updated : item
      )));
      const applySourceName = (items: KnowledgeInboxItem[]) => items.map((item) => (
        item.sourceCollectionId === updated.id ? { ...item, platform: updated.displayName } : item
      ));
      setInbox(applySourceName);
      setSourceSearchResults((current) => current ? applySourceName(current) : current);
      if (previous && sourceOriginFilter === previous.displayName) {
        setSourceOriginFilter(updated.displayName);
      }
      await onSourceCollectionsChanged();
      onNotify(`来源已统一重命名为“${updated.displayName}”`);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "来源重命名失败");
    } finally {
      setSourceCollectionBusyId(null);
    }
  };

  const saveSourceTitle = async () => {
    if (!selected) return;
    const title = sourceTitleDraft.trim();
    if (!title || title === selected.title) {
      setSourceTitleDraft(selected.title);
      setEditingSourceTitle(false);
      return;
    }
    setBusy(true);
    try {
      const update = await repository.updateSourceTitle(selected.id, title);
      const applyTitle = (items: KnowledgeInboxItem[]) => items.map((item) => (
        item.id === update.sourceItemId ? { ...item, title: update.title } : item
      ));
      setInbox(applyTitle);
      setSourceSearchResults((current) => current ? applyTitle(current) : current);
      onSourceTitleUpdated(update.legacyRecordId, update.title, update.updatedAt);
      setSourceTitleDraft(update.title);
      setEditingSourceTitle(false);
      onNotify("笔记标题已更新");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "修改笔记标题失败");
    } finally {
      setBusy(false);
    }
  };
  const recordById = useMemo(
    () => new Map(records.map((record) => [record.id, record])),
    [records],
  );

  const ensureSourceActionTarget = useCallback(async (
    item: KnowledgeInboxItem,
  ): Promise<IntelligenceRecord | RecordSummary> => {
    const existing = item.legacyRecordId ? recordById.get(item.legacyRecordId) : null;
    if (existing) return existing;
    const inFlight = sourceActionRecordRequests.current.get(item.id);
    if (inFlight) return inFlight;

    const request = repository.ensureSourceActionRecord(item.id)
      .then((record) => {
        const linkRecord = (current: KnowledgeInboxItem[]) => current.map((candidate) => (
          candidate.id === item.id
            ? { ...candidate, legacyRecordId: record.id }
            : candidate
        ));
        setInbox(linkRecord);
        setSourceSearchResults((current) => current ? linkRecord(current) : current);
        onSourceActionRecordCreated(record, item.primaryTopicName);
        return record;
      })
      .finally(() => {
        sourceActionRecordRequests.current.delete(item.id);
      });
    sourceActionRecordRequests.current.set(item.id, request);
    return request;
  }, [onSourceActionRecordCreated, recordById, repository]);

  const runSourceRecordAction = useCallback((
    item: KnowledgeInboxItem,
    action: (record: IntelligenceRecord | RecordSummary) => void | Promise<unknown>,
  ) => {
    void ensureSourceActionTarget(item)
      .then(action)
      .catch((error) => onNotify(
        error instanceof Error ? error.message : "这篇笔记的操作入口建立失败",
      ));
  }, [ensureSourceActionTarget, onNotify]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest(".note-list-actions")) return;
      setSourceListMenuRecordId(null);
    };
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSourceListMenuRecordId(null);
    };
    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("keydown", closeMenuOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("keydown", closeMenuOnEscape);
    };
  }, []);
  const visibleSources = useMemo(() => {
    const matches = sourceCollection.filter((item) => {
      if (sourceFilter === "pending" && item.organizationState !== "inbox") return false;
      if (sourceFilter === "organized" && item.organizationState === "inbox") return false;
      if (!matchesUnifiedNoteFilter(sourceOriginLabel(item), sourceOriginFilter)) return false;
      const itemRecordStatus = item.legacyRecordId
        ? recordById.get(item.legacyRecordId)?.status ?? "normal"
        : "normal";
      if (!matchesUnifiedNoteFilter(itemRecordStatus, sourceRecordStatusFilter)) return false;
      if (!matchesUnifiedNoteFilter(item.primaryTopicName ?? "", sourceTopicFilter)) return false;
      const itemDate = (item.originalAt ?? item.importedAt).slice(0, 10);
      if (sourceDateFrom && itemDate < sourceDateFrom) return false;
      if (sourceDateTo && itemDate > sourceDateTo) return false;
      return true;
    });
    return sortUnifiedNoteListItems(
      matches,
      sourceSortMode,
      (item) => item.originalAt ?? item.importedAt,
    );
  }, [
    sourceCollection,
    sourceDateFrom,
    sourceDateTo,
    sourceFilter,
    sourceOriginFilter,
    sourceRecordStatusFilter,
    recordById,
    sourceSortMode,
    sourceTopicFilter,
  ]);
  const selectedSourceIndex = Math.max(
    0,
    visibleSources.findIndex((item) => item.id === selectedId),
  );

  useLayoutEffect(() => {
    const previousMode = previousModeRef.current;
    previousModeRef.current = mode;
    if (!shouldResetSourceArchiveEntry({
      previousMode,
      nextMode: mode,
      hasNavigationTarget: sourceNavigationTarget !== null,
    })) {
      return;
    }
    setSelectedId(visibleSources[0]?.id ?? null);
    setSourceLocatorIndex(0);
    sourceListRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [mode, sourceNavigationTarget, visibleSources]);

  useEffect(() => {
    setSourceLocatorIndex(selectedSourceIndex);
  }, [selectedSourceIndex]);

  useEffect(() => {
    if (!visibleSources.length) {
      setSelectedId(null);
      return;
    }
    if (!visibleSources.some((item) => item.id === selectedId)) {
      setSelectedId(visibleSources[0].id);
    }
  }, [selectedId, visibleSources]);

  const updateSourceConnector = () => {
    const layout = sourceLayoutRef.current;
    const list = sourceListRef.current;
    const detail = sourceDetailRef.current;
    const active = list?.querySelector<HTMLElement>("[data-source-id].active");
    const filters = list?.querySelector<HTMLElement>(".knowledge-source-filters");
    if (!layout || !list || !active || !detail) {
      setSourceConnector((current) => connectorMetricsEqual(current, null) ? current : null);
      return;
    }
    const layoutRect = layout.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const filtersRect = filters?.getBoundingClientRect();
    const detailRect = detail.getBoundingClientRect();
    if (!sourceCardIsFullyVisible({
      cardTop: activeRect.top,
      cardBottom: activeRect.bottom,
      viewportTop: listRect.top,
      viewportBottom: listRect.bottom,
      occlusionBottom: filtersRect?.bottom ?? listRect.top,
    })) {
      setSourceConnector((current) => connectorMetricsEqual(current, null) ? current : null);
      return;
    }
    const next = measureCardToCardConnector(
      layoutRect,
      activeRect,
      detailRect,
    );
    setSourceConnector((current) => connectorMetricsEqual(current, next) ? current : next);
  };
  const scheduleSourceConnectorUpdate = useRafScheduledCallback(updateSourceConnector);

  const handleSourceListScroll = () => {
    setSourceConnector((current) => connectorMetricsEqual(current, null) ? current : null);
    scheduleSourceConnectorUpdate();
  };

  useLayoutEffect(() => {
    if (mode !== "sources") return;
    setSourceConnector((current) => connectorMetricsEqual(current, null) ? current : null);
    scheduleSourceConnectorUpdate();
    const observer = new ResizeObserver(scheduleSourceConnectorUpdate);
    if (sourceLayoutRef.current) observer.observe(sourceLayoutRef.current);
    if (sourceDetailRef.current) observer.observe(sourceDetailRef.current);
    return () => observer.disconnect();
  }, [mode, scheduleSourceConnectorUpdate, selectedId, visibleSources.length]);

  useEffect(() => {
    setSourceListMenuRecordId(null);
  }, [selectedId]);

  useEffect(() => {
    if (mode !== "sources") return;
    const focusSourceSearch = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      sourceSearchInputRef.current?.focus();
    };
    window.addEventListener("keydown", focusSourceSearch);
    return () => window.removeEventListener("keydown", focusSourceSearch);
  }, [mode]);

  useEffect(() => {
    const closeSourceMenu = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element && target.closest(".knowledge-source-search-wrap"))) {
        setSourceSearchHistoryOpen(false);
      }
      if (target instanceof Element && target.closest(".note-list-actions")) return;
      setSourceListMenuRecordId(null);
    };
    const closeSourceMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSourceListMenuRecordId(null);
        setSourceSearchHistoryOpen(false);
      }
    };
    window.addEventListener("mousedown", closeSourceMenu);
    window.addEventListener("keydown", closeSourceMenuOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeSourceMenu);
      window.removeEventListener("keydown", closeSourceMenuOnEscape);
    };
  }, []);

  const scrollToSource = (index: number) => {
    const clampedIndex = Math.min(
      Math.max(index, 0),
      Math.max(visibleSources.length - 1, 0),
    );
    const next = visibleSources[clampedIndex];
    if (!next) return;
    setSourceLocatorIndex(clampedIndex);
    window.requestAnimationFrame(() => {
      const list = sourceListRef.current;
      const target = list?.querySelector<HTMLElement>(`[data-source-id="${next.id}"]`);
      if (!list || !target) return;
      list.scrollTop = Math.max(
        0,
        target.offsetTop - list.clientHeight / 2 + target.offsetHeight / 2,
      );
    });
  };
  const deferredLoadedSourceText = useDeferredValue(loadedSourceText);
  const selectedOriginalText = deferredLoadedSourceText?.sourceItemId === selectedId
    ? deferredLoadedSourceText.text
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

  useEffect(() => {
    if (mode !== "knowledge" || !knowledgeNavigationTarget) return;
    setBrowserTopicId(knowledgeNavigationTarget.topicId);
  }, [knowledgeNavigationTarget, mode]);

  useEffect(() => {
    if (mode !== "sources" || !sourceNavigationTarget) return;
    let cancelled = false;
    setSourceFilter("all");
    setSourceSearch("");
    setSourceBodySearch("");
    const openTarget = async () => {
      if (!inbox.some((item) => item.id === sourceNavigationTarget.sourceItemId)) {
        const expanded = await repository.listSourceArchive(Math.max(inboxLimit, 5_000));
        if (cancelled) return;
        setInbox(expanded);
        setInboxLimit(Math.max(inboxLimit, 5_000));
      }
      if (!cancelled) setSelectedId(sourceNavigationTarget.sourceItemId);
    };
    void openTarget().catch((error) => {
      if (!cancelled) {
        onNotify(error instanceof Error ? error.message : "目标来源读取失败");
        onSourceNavigationHandled(sourceNavigationTarget.requestId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    inbox,
    inboxLimit,
    mode,
    onNotify,
    onSourceNavigationHandled,
    repository,
    sourceNavigationTarget,
  ]);

  useLayoutEffect(() => {
    if (mode !== "sources") return;
    setSourceBodySearch("");
    const container = sourceBodyRef.current;
    if (!container) return;
    container.querySelectorAll(".source-anchor-highlight").forEach(
      (element) => element.classList.remove("source-anchor-highlight"),
    );
    container.scrollTo({ top: 0, behavior: "auto" });
  }, [mode, selectedId]);

  useEffect(() => {
    if (
      mode !== "sources"
      || !sourceNavigationTarget
      || selectedId !== sourceNavigationTarget.sourceItemId
      || selectedReadableContent === null
    ) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const container = sourceBodyRef.current;
      if (!container) return;
      const target = locateSourceElement(
        container,
        readLocator(sourceNavigationTarget.locatorJson),
      );
      container.querySelectorAll(".source-anchor-highlight").forEach(
        (element) => element.classList.remove("source-anchor-highlight"),
      );
      if (!target) {
        onSourceNavigationHandled(sourceNavigationTarget.requestId);
        return;
      }
      target.classList.add("source-anchor-highlight");
      scrollSourceElementWithinContainer(container, target, "smooth");
      onSourceNavigationHandled(sourceNavigationTarget.requestId);
    });
    return () => cancelAnimationFrame(frame);
  }, [
    mode,
    onSourceNavigationHandled,
    selectedId,
    selectedReadableContent,
    sourceNavigationTarget,
    visibleSourceMessages,
  ]);

  const currentPendingSuggestions = suggestions.filter(
    (item) => item.status === "pending"
      && item.classifierVersion === CLASSIFIER_ALGORITHM_VERSION
      && item.suggestedTopicId !== null,
  );
  const currentClassificationSuggestions = suggestions.filter(
    (item) => item.classifierVersion === CLASSIFIER_ALGORITHM_VERSION
      && item.suggestedTopicId !== null
      && item.status !== "rejected"
      && item.status !== "undone",
  );
  const displayableClassificationSuggestions = suggestions.filter(
    (item) => item.suggestedTopicId !== null
      && item.status !== "rejected"
      && item.status !== "undone",
  );
  const selectedSuggestion = currentClassificationSuggestions.find(
    (item) => item.suggestedTopicId === (selected?.primaryTopicId ?? selectedTopicId),
  ) ?? currentClassificationSuggestions[0]
    ?? displayableClassificationSuggestions.find(
      (item) => item.suggestedTopicId === (selected?.primaryTopicId ?? selectedTopicId),
    )
    ?? displayableClassificationSuggestions[0]
    ?? null;
  const sourceKnowledgeTopic = sourceTopicDetail?.topic ?? null;
  const sourceKnowledgeDomain = sourceKnowledgeTopic
    ? domains.find((item) => item.id === sourceKnowledgeTopic.domainId) ?? null
    : null;
  const sourceEvidenceAnchors = selected
    ? sourceTopicDetail?.evidence.filter((item) => item.sourceItemId === selected.id) ?? []
    : [];
  const sourceHasInsights = Boolean(
    sourceTopicDetail?.propositions.length
      || sourceEvidenceAnchors.length
      || selected?.organizationState === "inbox",
  );

  const searchSourceText = () => {
    const container = sourceBodyRef.current;
    const needle = sourceBodySearch.trim();
    if (!container || !needle) return;
    container.querySelectorAll(".source-anchor-highlight").forEach(
      (element) => element.classList.remove("source-anchor-highlight"),
    );
    const target = locateSourceElement(container, {
      kind: "text_quote",
      value: needle,
      quote: needle,
    });
    if (!target) {
      onNotify(`正文中没有找到“${needle}”`);
      return;
    }
    target.classList.add("source-anchor-highlight");
    scrollSourceElementWithinContainer(container, target, "smooth");
    onNotify("已找到正文匹配位置");
  };
  const hasCurrentClassificationRun = suggestions.some(
    (item) => item.status === "pending"
      && item.classifierVersion === CLASSIFIER_ALGORITHM_VERSION,
  );
  const hasStalePendingSuggestions = suggestions.some(
    (item) => item.status === "pending"
      && item.classifierVersion !== CLASSIFIER_ALGORITHM_VERSION,
  );

  const applyCatalogSelectionState = (
    nextDomains: KnowledgeDomainRow[],
    nextTopics: KnowledgeTopicRow[],
  ) => {
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
  };

  const applyReadingCatalog = (
    nextDomains: KnowledgeDomainRow[],
    nextTopics: KnowledgeTopicRow[],
  ) => {
    workspaceSession.domains = nextDomains;
    workspaceSession.topics = nextTopics;
    setDomains(nextDomains);
    setTopics(nextTopics);
    applyCatalogSelectionState(nextDomains, nextTopics);
  };

  const scheduleSourceSupportingData = () => {
    cancelSourceSupportingLoad.current?.();
    cancelSourceSupportingLoad.current = scheduleIdleWork(() => {
      void loadSourceSupportingData(repository)
        .then((data) => {
          workspaceSession.domains = data.domains;
          workspaceSession.topics = data.topics;
          workspaceSession.sourceCollections = data.sourceCollections;
          startTransition(() => {
            setDomains(data.domains);
            setTopics(data.topics);
            setSourceCollections(data.sourceCollections);
            applyCatalogSelectionState(data.domains, data.topics);
          });
        })
        .catch((error) => onNotify(
          error instanceof Error ? error.message : "来源筛选数据读取失败",
        ));
    }, { delayMs: 450, timeoutMs: 1_500 });
  };

  const reload = async (
    targetMode: Mode = mode,
    shouldLoadSupportingData: () => boolean = () => true,
  ) => {
    if (targetMode === "sources") {
      // 来源入口的关键路径只有轻量档案列表。主题目录、来源筛选和历史分类
      // 都不能延迟首屏，也不能在这里写入或升级目录。
      const { inbox: nextInbox } = await loadSourceEntryData(repository, inboxLimit);
      workspaceSession.inbox = nextInbox;
      workspaceSession.loadedModes.add(targetMode);
      setInbox(nextInbox);
      setSelectedId((current) =>
        current && nextInbox.some((item) => item.id === current)
          ? current
          : nextInbox[0]?.id ?? null);
      loadedModes.current.add(targetMode);
      if (shouldLoadSupportingData()) scheduleSourceSupportingData();
      return;
    }

    if (targetMode === "knowledge") {
      const data = await loadKnowledgeEntryData(repository);
      applyReadingCatalog(data.domains, data.topics);
      workspaceSession.loadedModes.add(targetMode);
      loadedModes.current.add(targetMode);
      return;
    }

    const data = await loadTopicMaintenanceData(repository);
    applyReadingCatalog(data.domains, data.topics);
    setCatalogProposal(data.catalog);
    setTopicAliases(data.aliases);
    setEntities(data.entities);
    setClassificationRules(data.rules);
    workspaceSession.loadedModes.add(targetMode);
    loadedModes.current.add(targetMode);
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
    const result = await classifySourceAsync(context);
    return repository.saveSuggestions({
      sourceItemId,
      classifierVersion: CLASSIFIER_ALGORITHM_VERSION,
      suggestions: suggestionsForPersistence(result),
    });
  };

  useEffect(() => {
    if (loadedModes.current.has(mode)) return;
    let active = true;
    setLoading(!workspaceSession.loadedModes.has(mode));
    void reload(mode, () => active)
      .catch((error) => {
        if (active) onNotify(error instanceof Error ? error.message : "知识库读取失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (mode === "sources") {
        cancelSourceSupportingLoad.current?.();
        cancelSourceSupportingLoad.current = null;
      }
    };
  }, [mode]);

  useEffect(() => {
    if (
      mode !== "sources"
      || !inbox.length
      || classificationUpgradeStarted.current
    ) return;
    classificationUpgradeStarted.current = true;
    const controller = new AbortController();
    let finished = false;
    const cancelScheduledUpgrade = scheduleIdleWork(() => {
      void upgradeOutdatedInboxSuggestions(repository, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (progress.total > 0 && progress.completed > 0 && progress.completed % 100 === 0) {
            onNotify(`主题建议后台整理：${progress.completed}/${progress.total}`);
          }
        },
      })
        .then(async (progress) => {
          if (controller.signal.aborted) return;
          const supporting = await loadSourceSupportingData(repository);
          if (controller.signal.aborted) return;
          workspaceSession.domains = supporting.domains;
          workspaceSession.topics = supporting.topics;
          workspaceSession.sourceCollections = supporting.sourceCollections;
          startTransition(() => {
            setDomains(supporting.domains);
            setTopics(supporting.topics);
            setSourceCollections(supporting.sourceCollections);
            applyCatalogSelectionState(supporting.domains, supporting.topics);
          });
          if (progress.total) {
            const refreshed = await loadSourceEntryData(repository, inboxLimit);
            if (controller.signal.aborted) return;
            workspaceSession.inbox = refreshed.inbox;
            startTransition(() => setInbox(refreshed.inbox));
            const currentSelectedId = selectedIdRef.current;
            if (currentSelectedId) {
              setSuggestions(await repository.listSuggestions(currentSelectedId));
            }
            onNotify(
              `主题建议整理完成：${progress.completed} 条${progress.failures ? `，失败 ${progress.failures} 条` : ""}`,
              { durationMs: 8_000 },
            );
          }
          finished = true;
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            onNotify(error instanceof Error ? error.message : "主题建议后台整理失败");
          }
        })
        .finally(() => {
          if (!finished) classificationUpgradeStarted.current = false;
        });
    }, { delayMs: 1_200, timeoutMs: 3_000 });

    return () => {
      cancelScheduledUpgrade();
      controller.abort();
      if (!finished) classificationUpgradeStarted.current = false;
    };
  }, [inbox.length, mode, onNotify, repository]);

  useEffect(() => {
    const current = inbox.find((item) => item.id === selectedId);
    if (!selectedId || mode !== "sources" || !current) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setAutoSuggestingSourceId(selectedId);
    void repository.listSuggestions(selectedId)
      .then(async (items) => {
        const hasCurrentRun = items.some(
          (item) => item.classifierVersion === CLASSIFIER_ALGORITHM_VERSION,
        );
        if (hasCurrentRun || !topics.length || current.organizationState !== "inbox") return items;
        return computeAndSaveSuggestions(selectedId);
      })
      .then((items) => {
        if (cancelled) return;
        setSuggestions(items);
        setSelectedTopicId(items.find(
          (item) => item.classifierVersion === CLASSIFIER_ALGORITHM_VERSION
            && item.status !== "rejected"
            && item.status !== "undone"
            && item.suggestedTopicId === current.primaryTopicId,
        )?.suggestedTopicId ?? items.find(
          (item) => item.status === "pending"
            && item.classifierVersion === CLASSIFIER_ALGORITHM_VERSION,
        )?.suggestedTopicId ?? current.primaryTopicId);
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
  }, [inbox, mode, repository, selectedId, topics.length]);

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
    if (!topicStructureDialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setTopicStructureDialog(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [topicStructureDialog]);

  useEffect(() => {
    if (mode !== "topics") setTopicStructureDialog(null);
  }, [mode]);

  useEffect(() => {
    const sequence = ++sourceTextRequestSequence.current;
    setSourceDetailOpen(false);
    setSourceBodySearch("");
    if (!selectedId || mode !== "sources") {
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
    const topicId = selected?.primaryTopicId ?? selectedTopicId;
    if (mode !== "sources" || !topicId) {
      setSourceTopicDetail(null);
      return;
    }
    let cancelled = false;
    void repository.getTopicDetail(topicId)
      .then((detail) => {
        if (!cancelled) setSourceTopicDetail(detail);
      })
      .catch((error) => {
        if (!cancelled) {
          setSourceTopicDetail(null);
          onNotify(error instanceof Error ? error.message : "来源关联知识读取失败");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode, onNotify, repository, selected?.primaryTopicId, selectedTopicId]);

  useEffect(() => {
    if (!browserTopicId || (mode !== "knowledge" && mode !== "topics")) {
      setTopicDetail(null);
      setRelatedTopicDetails([]);
      return;
    }
    let cancelled = false;
    void repository.getTopicDetail(browserTopicId)
      .then(async (detail) => {
        const relatedIds = [...new Set(detail.relations.map((relation) => (
          relation.fromTopicId === detail.topic.id
            ? relation.toTopicId
            : relation.fromTopicId
        )))].filter((topicId) => topicId !== detail.topic.id).slice(0, 4);
        const related = await Promise.all(
          relatedIds.map((topicId) => repository.getTopicDetail(topicId).catch(() => null)),
        );
        if (cancelled) return;
        setTopicDetail(detail);
        setRelatedTopicDetails(related.filter(
          (item): item is KnowledgeTopicDetail => item !== null,
        ));
        setEvidenceSourceId(detail.sources[0]?.id ?? null);
        setTurningToJudgmentId(detail.judgments[0]?.id ?? null);
        setTurningFromJudgmentId(detail.judgments[1]?.id ?? null);
      })
      .catch((error) => onNotify(error instanceof Error ? error.message : "主题详情读取失败"));
    return () => {
      cancelled = true;
    };
  }, [browserTopicId, mode, onNotify, repository]);

  useEffect(() => {
    if (mode !== "topics") return;
    void repository.suggestTopicRelations()
      .then(setRelationSuggestions)
      .catch((error) => onNotify(error instanceof Error ? error.message : "关系建议读取失败"));
  }, [mode, repository]);

  const reloadTopicDetail = async () => {
    if (!browserTopicId) return;
    const detail = await repository.getTopicDetail(browserTopicId);
    setTopicDetail(detail);
    const relatedIds = [...new Set(detail.relations.map((relation) => (
      relation.fromTopicId === detail.topic.id
        ? relation.toTopicId
        : relation.fromTopicId
    )))].filter((topicId) => topicId !== detail.topic.id).slice(0, 4);
    const related = await Promise.all(
      relatedIds.map((topicId) => repository.getTopicDetail(topicId).catch(() => null)),
    );
    setRelatedTopicDetails(related.filter(
      (item): item is KnowledgeTopicDetail => item !== null,
    ));
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

  const openCreateDomainDialog = () => {
    setDomainName("");
    setDomainDescription("");
    setTopicStructureEditorOpen(true);
    setTopicStructureDialog({ kind: "create-domain" });
  };

  const openEditDomainDialog = (domain: KnowledgeDomainRow) => {
    setEditDomainId(domain.id);
    setEditDomainName(domain.name);
    setEditDomainDescription(domain.description);
    setTopicStructureEditorOpen(true);
    setTopicStructureDialog({ kind: "edit-domain", domainId: domain.id });
  };

  const openCreateTopicDialog = (domainId: number, parentTopicId: number | null) => {
    setTopicDomainId(domainId);
    setTopicParentId(parentTopicId);
    setTopicName("");
    setTopicDescription("");
    setTopicStructureEditorOpen(true);
    setTopicStructureDialog({ kind: "create-topic", domainId, parentTopicId });
  };

  const openEditTopicDialog = (topic: KnowledgeTopicRow) => {
    setEditTopicId(topic.id);
    setEditTopicName(topic.name);
    setEditTopicDescription(topic.description);
    setTopicStructureEditorOpen(true);
    setTopicStructureDialog({ kind: "edit-topic", topicId: topic.id });
  };

  const submitTopicStructureDialog = async () => {
    if (!topicStructureDialog) return;
    setBusy(true);
    try {
      if (topicStructureDialog.kind === "create-domain") {
        const created = await repository.createDomain(domainName.trim(), domainDescription.trim());
        setTopicDomainId(created.id);
        onNotify("领域已创建");
      } else if (topicStructureDialog.kind === "edit-domain") {
        await repository.updateDomain({
          id: topicStructureDialog.domainId,
          name: editDomainName.trim(),
          description: editDomainDescription.trim(),
        });
        onNotify("领域已更新，现有关系保持不变");
      } else if (topicStructureDialog.kind === "create-topic") {
        const created = await repository.createTopic({
          domainId: topicStructureDialog.domainId,
          parentTopicId: topicStructureDialog.parentTopicId,
          name: topicName.trim(),
          description: topicDescription.trim(),
        });
        setEditTopicId(created.id);
        onNotify(topicStructureDialog.parentTopicId ? "子主题已创建" : "主题已创建");
      } else {
        await repository.updateTopic({
          id: topicStructureDialog.topicId,
          name: editTopicName.trim(),
          description: editTopicDescription.trim(),
        });
        onNotify("主题已更新，分类与历史关系保持不变");
      }
      await reload();
      setTopicStructureDialog(null);
    } catch (error) {
      const fallback = topicStructureDialog.kind === "create-domain"
        ? "领域创建失败"
        : topicStructureDialog.kind === "edit-domain"
          ? "领域更新失败"
          : topicStructureDialog.kind === "create-topic"
            ? "主题创建失败"
            : "主题更新失败";
      onNotify(error instanceof Error ? error.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const openTopicMaintenance = (
    task: TopicMaintenanceTask,
    topicId: number | undefined = browserTopicId ?? undefined,
  ) => {
    const targetTopic = topics.find((item) => item.id === topicId) ?? null;
    if (targetTopic) {
      setBrowserTopicId(targetTopic.id);
      setEditTopicId(targetTopic.id);
      if (task === "aliases") setAliasTopicId(targetTopic.id);
      if (task === "rules") setRuleTopicId(targetTopic.id);
      if (task === "new-topic") openCreateTopicDialog(targetTopic.domainId, null);
      if (task === "boundary") openEditTopicDialog(targetTopic);
    } else if (task === "new-topic" && domains[0]) {
      openCreateTopicDialog(domains[0].id, null);
    }
    setTopicStructureEditorOpen(["boundary", "new-topic"].includes(task));
    setTopicAdvancedMaintenanceOpen(["aliases", "rules", "relations"].includes(task));
    setTopicMaintenanceOpen(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(
          `[data-topic-maintenance="${task}"]`,
        ) ?? document.querySelector<HTMLElement>(
          ["boundary", "new-topic"].includes(task)
            ? ".knowledge-tree-card"
            : ".knowledge-secondary-maintenance-body",
        );
        target?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    });
  };

  const toggleMaintenanceTopic = async (topicId: number) => {
    const willOpen = !expandedMaintenanceTopicIds.has(topicId);
    setExpandedMaintenanceTopicIds((current) => {
      const next = new Set(current);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
    setEditTopicId(topicId);
    if (!willOpen || maintenanceTopicDetails[topicId]) return;
    try {
      const detail = await repository.getTopicDetail(topicId);
      setMaintenanceTopicDetails((current) => ({ ...current, [topicId]: detail }));
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "主题笔记读取失败");
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
    setPropositionKind("claim");
    setPropositionHypothesisGroup("");
    setPropositionConfidence(50);
    setPropositionInvalidation("");
    setPropositionValidity("active");
    setPropositionConfirmedAt("");
    setPropositionValidUntil("");
    setPropositionReviewAt("");
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
          propositionKind,
          hypothesisGroup: propositionHypothesisGroup,
          confidence: propositionConfidence,
          invalidationCondition: propositionInvalidation,
          validityStatus: propositionValidity,
          confirmedAt: propositionConfirmedAt || null,
          validUntil: propositionValidUntil || null,
          reviewAt: propositionReviewAt || null,
        });
      } else {
        await repository.createProposition({
          topicId: topicDetail.topic.id,
          statementMarkdown: propositionText.trim(),
          status: propositionStatus,
          propositionKind,
          hypothesisGroup: propositionHypothesisGroup,
          confidence: propositionConfidence,
          invalidationCondition: propositionInvalidation,
          validityStatus: propositionValidity,
          confirmedAt: propositionConfirmedAt || null,
          validUntil: propositionValidUntil || null,
          reviewAt: propositionReviewAt || null,
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

  const resetDecisionEditor = () => {
    setDecisionEditId(null);
    setDecisionTitle("");
    setDecisionText("");
    setDecisionPropositionId(null);
    setDecisionJudgmentId(null);
    setDecisionKnownRisks("");
    setDecisionExpectedResult("");
    setDecisionActions("");
    setDecisionReviewAt("");
    setDecisionResultStatus("pending");
    setDecisionFinalResult("");
    setDecisionRetrospective("");
  };

  const beginEditDecision = (decision: TopicDecisionRow) => {
    setDecisionEditId(decision.id);
    setDecisionTitle(decision.title);
    setDecisionText(decision.decisionMarkdown);
    setDecisionPropositionId(decision.propositionId);
    setDecisionJudgmentId(decision.judgmentSnapshotId);
    setDecisionKnownRisks(decision.knownRisks.join("\n"));
    setDecisionExpectedResult(decision.expectedResult);
    setDecisionActions(decision.actualActions.join("\n"));
    setDecisionReviewAt(decision.reviewAt ?? "");
    setDecisionResultStatus(decision.resultStatus);
    setDecisionFinalResult(decision.finalResult);
    setDecisionRetrospective(decision.retrospective);
  };

  const saveDecision = async () => {
    if (!topicDetail || !decisionTitle.trim() || !decisionText.trim()) return;
    setBusy(true);
    try {
      const shared = {
        propositionId: decisionPropositionId,
        judgmentSnapshotId: decisionJudgmentId,
        title: decisionTitle.trim(),
        decisionMarkdown: decisionText.trim(),
        knownRisks: decisionKnownRisks.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
        expectedResult: decisionExpectedResult.trim(),
        actualActions: decisionActions.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
        reviewAt: decisionReviewAt || null,
        resultStatus: decisionResultStatus,
        finalResult: decisionFinalResult.trim(),
        retrospective: decisionRetrospective.trim(),
      };
      if (decisionEditId) {
        const existing = topicDetail.decisions.find((item) => item.id === decisionEditId);
        if (!existing) throw new Error("决策记录不存在");
        await repository.updateDecision({
          id: decisionEditId,
          decidedAt: existing.decidedAt,
          status: existing.status,
          ...shared,
        });
      } else {
        await repository.createDecision({
          topicId: topicDetail.topic.id,
          ...shared,
        });
      }
      const wasEditing = decisionEditId !== null;
      resetDecisionEditor();
      await reloadTopicDetail();
      onNotify(wasEditing ? "决策账本已更新" : "决策已写入账本");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "决策账本保存失败");
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
      onNotify("请先在“主题管理”建立至少一个真实主题");
      return;
    }
    setBusy(true);
    try {
      const persisted = await computeAndSaveSuggestions(selected.id);
      await reload();
      setSuggestions(persisted);
      const persistedCandidates = persisted.filter((item) => item.suggestedTopicId !== null);
      setSelectedTopicId(persistedCandidates[0]?.suggestedTopicId ?? null);
      onNotify(
        persistedCandidates.length
          ? "已按可读正文重新计算并保存证据充分的分类建议"
          : "没有找到证据充分的主题，已清除旧的不可靠建议；可手动选择或新建主题",
        { durationMs: persistedCandidates.length ? 6_000 : 10_000 },
      );
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "分类失败，来源仍保留在来源档案待确认");
    } finally {
      setBusy(false);
    }
  };

  const autoOrganizeLoadedInbox = async () => {
    const pendingSourceIds = inbox
      .filter((item) => item.organizationState === "inbox")
      .map((item) => item.id);
    if (!pendingSourceIds.length) return;
    setBusy(true);
    onNotify(`正在自动整理 ${pendingSourceIds.length} 条待归类来源；原文不会被改写`);
    try {
      const result = await autoOrganizeImportedSources(
        pendingSourceIds,
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
      onNotify(error instanceof Error ? error.message : "自动整理失败；来源仍保留在来源档案待确认");
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
          onNotify("分类已撤销，来源已返回来源档案待确认");
        },
      });
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "分类确认失败");
    } finally {
      setBusy(false);
    }
  };

  const currentModeReady = loadedModes.current.has(mode)
    || workspaceSession.loadedModes.has(mode);
  if (loading || !currentModeReady) {
    return <div className="page-loading"><span className="save-spinner" />正在读取正式知识结构…</div>;
  }

  if (mode === "knowledge") {
    return (
      <main className="knowledge-page knowledge-reading-page">
        <KnowledgeReadingWorkspace
          domains={domains}
          topics={topics}
          topicDetail={topicDetail}
          relatedTopicDetails={relatedTopicDetails}
          selectedTopicId={browserTopicId}
          onOpenSource={onNavigateToSource}
          navigationTarget={knowledgeNavigationTarget}
          onSelectTopic={(topicId) => {
            setBrowserTopicId(topicId);
            resetNoteEditor();
            resetPropositionEditor();
            setEvidenceText("");
            setEvidenceLocatorKind("none");
            setEvidenceLocatorValue("");
            setEvidenceQuote("");
          }}
        />
        <details
          hidden
          className="knowledge-secondary-maintenance knowledge-card"
          open={knowledgeMaintenanceOpen}
          onToggle={(event) => setKnowledgeMaintenanceOpen(event.currentTarget.open)}
        >
          <summary>维护与录入</summary>
          <div className="knowledge-secondary-maintenance-body">
        <header className="knowledge-page-header">
          <div><span>次级操作</span><h1>知识维护与录入</h1><p>新增、编辑与关系维护不会替代首屏阅读成果。</p></div>
          <FolderTree size={28} />
        </header>
        <section className="knowledge-topic-layout knowledge-read-layout">
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
                    <small>
                      {judgment.effectiveAt}{judgment.changeReason ? ` · ${judgment.changeReason}` : ""}
                      {judgment.propositionId
                        ? ` · 命题：${topicDetail.propositions.find((item) => item.id === judgment.propositionId)?.statementMarkdown ?? "已关联"}`
                        : ""}
                    </small>
                  </article>
                ))}
                {!topicDetail.judgments.length ? <p className="knowledge-empty">尚无判断快照。</p> : null}
                <select
                  aria-label="判断关联命题"
                  value={judgmentPropositionId ?? ""}
                  onChange={(event) => setJudgmentPropositionId(event.target.value ? Number(event.target.value) : null)}
                >
                  <option value="">主题级判断，不关联单一命题</option>
                  {topicDetail.propositions.filter((item) => item.status !== "superseded").map((item) => (
                    <option key={item.id} value={item.id}>{item.statementMarkdown}</option>
                  ))}
                </select>
                <textarea value={judgmentText} onChange={(event) => setJudgmentText(event.target.value)} placeholder="新增当前判断（Markdown）" />
                <input value={judgmentReason} onChange={(event) => setJudgmentReason(event.target.value)} placeholder="变化原因（有变化时填写）" />
                <button disabled={!judgmentText.trim()} onClick={async () => {
                  await repository.addTopicJudgment({
                    topicId: topicDetail.topic.id,
                    propositionId: judgmentPropositionId,
                    statementMarkdown: judgmentText,
                    confidence: 70,
                    changeReason: judgmentReason,
                  });
                  setJudgmentText("");
                  setJudgmentReason("");
                  setJudgmentPropositionId(null);
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
                      {item.propositionId
                        ? ` · 命题：${topicDetail.propositions.find((proposition) => proposition.id === item.propositionId)?.statementMarkdown ?? "已关联"}`
                        : ""}
                    </small>
                  </article>
                ))}
                <select
                  aria-label="证据关联命题"
                  value={evidencePropositionId ?? ""}
                  onChange={(event) => setEvidencePropositionId(event.target.value ? Number(event.target.value) : null)}
                >
                  <option value="">背景证据，不关联单一命题</option>
                  {topicDetail.propositions.filter((item) => item.status !== "superseded").map((item) => (
                    <option key={item.id} value={item.id}>{item.statementMarkdown}</option>
                  ))}
                </select>
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
                <div className="knowledge-evidence-fields knowledge-validity-fields">
                  <label>
                    确认日期
                    <input type="date" value={evidenceConfirmedAt} onChange={(event) => setEvidenceConfirmedAt(event.target.value)} />
                  </label>
                  <label>
                    有效至
                    <input type="date" value={evidenceValidUntil} onChange={(event) => setEvidenceValidUntil(event.target.value)} />
                  </label>
                  <label>
                    下次复查
                    <input type="date" value={evidenceReviewAt} onChange={(event) => setEvidenceReviewAt(event.target.value)} />
                  </label>
                </div>
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
                    propositionId: evidencePropositionId,
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
                    confirmedAt: evidenceConfirmedAt || null,
                    validUntil: evidenceValidUntil || null,
                    reviewAt: evidenceReviewAt || null,
                  });
                  setEvidenceText("");
                  setEvidencePropositionId(null);
                  setEvidenceLocatorKind("none");
                  setEvidenceLocatorValue("");
                  setEvidenceQuote("");
                  setEvidenceConfirmedAt("");
                  setEvidenceValidUntil("");
                  setEvidenceReviewAt("");
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
                        <div className="knowledge-proposition-meta">
                          <span>{proposition.propositionKind === "hypothesis" ? "竞争假设" : "命题"}</span>
                          <span>{proposition.status}</span>
                          <span>置信度 {proposition.confidence}%</span>
                          <span>{proposition.validityStatus}</span>
                          {proposition.hypothesisGroup ? <span>假设组：{proposition.hypothesisGroup}</span> : null}
                        </div>
                        <MarkdownContent value={proposition.statementMarkdown} />
                        {proposition.invalidationCondition ? (
                          <p className="knowledge-invalidation">
                            <strong>推翻条件</strong>
                            {proposition.invalidationCondition}
                          </p>
                        ) : null}
                        <div className="knowledge-validity-summary">
                          {proposition.confirmedAt ? <small>确认：{proposition.confirmedAt}</small> : null}
                          {proposition.validUntil ? <small>有效至：{proposition.validUntil}</small> : null}
                          {proposition.reviewAt ? <small>复核：{proposition.reviewAt}</small> : null}
                        </div>
                      </div>
                      <footer>
                        <button disabled={busy} onClick={() => {
                          setPropositionEditId(proposition.id);
                          setPropositionText(proposition.statementMarkdown);
                          setPropositionStatus(proposition.status);
                          setPropositionKind(proposition.propositionKind);
                          setPropositionHypothesisGroup(proposition.hypothesisGroup);
                          setPropositionConfidence(proposition.confidence);
                          setPropositionInvalidation(proposition.invalidationCondition);
                          setPropositionValidity(proposition.validityStatus);
                          setPropositionConfirmedAt(proposition.confirmedAt ?? "");
                          setPropositionValidUntil(proposition.validUntil ?? "");
                          setPropositionReviewAt(proposition.reviewAt ?? "");
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
                  <div className="knowledge-compact-fields">
                    <label>
                      类型
                      <select
                        value={propositionKind}
                        onChange={(event) => setPropositionKind(
                          event.target.value as TopicPropositionRow["propositionKind"],
                        )}
                      >
                        <option value="claim">命题</option>
                        <option value="hypothesis">竞争假设</option>
                      </select>
                    </label>
                    <label>
                      置信度
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={propositionConfidence}
                        onChange={(event) => setPropositionConfidence(Number(event.target.value))}
                      />
                    </label>
                    <label>
                      有效性
                      <select
                        value={propositionValidity}
                        onChange={(event) => setPropositionValidity(
                          event.target.value as TopicPropositionRow["validityStatus"],
                        )}
                      >
                        <option value="active">有效</option>
                        <option value="possibly_outdated">可能过期</option>
                        <option value="expired">已过期</option>
                      </select>
                    </label>
                  </div>
                  {propositionKind === "hypothesis" ? (
                    <input
                      value={propositionHypothesisGroup}
                      onChange={(event) => setPropositionHypothesisGroup(event.target.value)}
                      placeholder="竞争假设组，例如：日本楼市复苏路径"
                    />
                  ) : null}
                  <textarea
                    value={propositionInvalidation}
                    onChange={(event) => setPropositionInvalidation(event.target.value)}
                    placeholder="什么新事实出现时，这条命题应被推翻或降级？"
                  />
                  <div className="knowledge-validity-fields">
                    <label>
                      事实确认日
                      <input
                        type="date"
                        value={propositionConfirmedAt}
                        onChange={(event) => setPropositionConfirmedAt(event.target.value)}
                      />
                    </label>
                    <label>
                      有效截止日
                      <input
                        type="date"
                        value={propositionValidUntil}
                        onChange={(event) => setPropositionValidUntil(event.target.value)}
                      />
                    </label>
                    <label>
                      下次复核日
                      <input
                        type="date"
                        value={propositionReviewAt}
                        onChange={(event) => setPropositionReviewAt(event.target.value)}
                      />
                    </label>
                  </div>
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
            <section className="knowledge-decision-workspace">
              <div className="knowledge-note-section-title">
                <div>
                  <span>记录当时依据、行动与结果</span>
                  <h3>决策账本</h3>
                </div>
                <em>{topicDetail.decisions.length} 条</em>
              </div>
              <div className="knowledge-decision-layout">
                <div className="knowledge-decision-list">
                  {topicDetail.decisions.map((decision) => {
                    const linkedProposition = topicDetail.propositions.find(
                      (item) => item.id === decision.propositionId,
                    );
                    const linkedJudgment = topicDetail.judgments.find(
                      (item) => item.id === decision.judgmentSnapshotId,
                    );
                    return (
                      <article key={decision.id}>
                        <header>
                          <div>
                            <strong>{decision.title}</strong>
                            <small>{decision.decidedAt} · {decision.resultStatus}</small>
                          </div>
                          <button disabled={busy} onClick={() => beginEditDecision(decision)}>编辑</button>
                        </header>
                        <MarkdownContent value={decision.decisionMarkdown} />
                        {linkedProposition ? (
                          <p className="knowledge-decision-link"><strong>关联命题</strong>{linkedProposition.statementMarkdown}</p>
                        ) : null}
                        {linkedJudgment ? (
                          <p className="knowledge-decision-link"><strong>关联判断</strong>{linkedJudgment.statementMarkdown}</p>
                        ) : null}
                        {decision.knownRisks.length ? (
                          <div><strong>已知风险</strong><ul>{decision.knownRisks.map((item) => <li key={item}>{item}</li>)}</ul></div>
                        ) : null}
                        {decision.expectedResult ? <p><strong>预期结果</strong>{decision.expectedResult}</p> : null}
                        {decision.actualActions.length ? (
                          <div><strong>实际行动</strong><ul>{decision.actualActions.map((item) => <li key={item}>{item}</li>)}</ul></div>
                        ) : null}
                        {decision.finalResult ? <p><strong>最终结果</strong>{decision.finalResult}</p> : null}
                        {decision.retrospective ? <p><strong>复盘</strong>{decision.retrospective}</p> : null}
                        {decision.reviewAt ? <small>复核日期：{decision.reviewAt}</small> : null}
                      </article>
                    );
                  })}
                  {!topicDetail.decisions.length ? (
                    <p className="knowledge-empty">尚无决策记录。这里保存“为什么这样做”，不会覆盖后来的复盘结果。</p>
                  ) : null}
                </div>
                <div className="knowledge-decision-editor">
                  <h4>{decisionEditId ? "编辑决策记录" : "记录一项决策"}</h4>
                  <input
                    value={decisionTitle}
                    onChange={(event) => setDecisionTitle(event.target.value)}
                    placeholder="决策标题"
                  />
                  <textarea
                    value={decisionText}
                    onChange={(event) => setDecisionText(event.target.value)}
                    placeholder="当时做了什么决定，依据是什么？"
                  />
                  <div className="knowledge-compact-fields">
                    <label>
                      关联命题
                      <select
                        value={decisionPropositionId ?? ""}
                        onChange={(event) => setDecisionPropositionId(
                          event.target.value ? Number(event.target.value) : null,
                        )}
                      >
                        <option value="">不关联</option>
                        {topicDetail.propositions.map((item) => (
                          <option key={item.id} value={item.id}>{item.statementMarkdown}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      关联判断
                      <select
                        value={decisionJudgmentId ?? ""}
                        onChange={(event) => setDecisionJudgmentId(
                          event.target.value ? Number(event.target.value) : null,
                        )}
                      >
                        <option value="">不关联</option>
                        {topicDetail.judgments.map((item) => (
                          <option key={item.id} value={item.id}>{item.statementMarkdown}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <textarea
                    value={decisionKnownRisks}
                    onChange={(event) => setDecisionKnownRisks(event.target.value)}
                    placeholder={"已知风险（每行一项）"}
                  />
                  <textarea
                    value={decisionExpectedResult}
                    onChange={(event) => setDecisionExpectedResult(event.target.value)}
                    placeholder="预期结果"
                  />
                  <textarea
                    value={decisionActions}
                    onChange={(event) => setDecisionActions(event.target.value)}
                    placeholder={"实际行动（每行一项）"}
                  />
                  <div className="knowledge-compact-fields">
                    <label>
                      结果状态
                      <select
                        value={decisionResultStatus}
                        onChange={(event) => setDecisionResultStatus(
                          event.target.value as TopicDecisionRow["resultStatus"],
                        )}
                      >
                        <option value="pending">待观察</option>
                        <option value="in_progress">进行中</option>
                        <option value="succeeded">达到预期</option>
                        <option value="failed">未达到预期</option>
                        <option value="mixed">结果混合</option>
                        <option value="cancelled">已取消</option>
                      </select>
                    </label>
                    <label>
                      复核日期
                      <input
                        type="date"
                        value={decisionReviewAt}
                        onChange={(event) => setDecisionReviewAt(event.target.value)}
                      />
                    </label>
                  </div>
                  <textarea
                    value={decisionFinalResult}
                    onChange={(event) => setDecisionFinalResult(event.target.value)}
                    placeholder="最终结果（可以稍后补充）"
                  />
                  <textarea
                    value={decisionRetrospective}
                    onChange={(event) => setDecisionRetrospective(event.target.value)}
                    placeholder="复盘：哪些判断正确，哪些条件发生了变化？"
                  />
                  <div>
                    <button
                      disabled={busy || !decisionTitle.trim() || !decisionText.trim()}
                      onClick={() => void saveDecision()}
                    >
                      {decisionEditId ? "保存决策记录" : "写入决策账本"}
                    </button>
                    {decisionEditId ? (
                      <button className="secondary" disabled={busy} onClick={resetDecisionEditor}>
                        取消
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
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
          </div>
        </details>
      </main>
    );
  }

  if (mode === "topics") {
    const duplicateNames = topics.filter((topic, index) =>
      topics.findIndex((other) => other.name.trim().toLowerCase() === topic.name.trim().toLowerCase()) !== index);
    const activeTopics = topics.filter((topic) => topic.status !== "merged");
    const structuralAttentionTopicIds = collectTopicStructuralAttentionIds(
      topics,
      topicAliases,
      relationSuggestions,
    );
    const dialogDomain = topicStructureDialog && "domainId" in topicStructureDialog
      ? domains.find((domain) => domain.id === topicStructureDialog.domainId) ?? null
      : null;
    const dialogTopic = topicStructureDialog && "topicId" in topicStructureDialog
      ? topics.find((topic) => topic.id === topicStructureDialog.topicId) ?? null
      : null;
    const dialogParentTopic = topicStructureDialog?.kind === "create-topic"
      && topicStructureDialog.parentTopicId
      ? topics.find((topic) => topic.id === topicStructureDialog.parentTopicId) ?? null
      : null;
    const topicStructureDialogTitle = topicStructureDialog?.kind === "create-domain"
      ? "添加领域"
      : topicStructureDialog?.kind === "edit-domain"
        ? `编辑领域 · ${dialogDomain?.name ?? ""}`
        : topicStructureDialog?.kind === "create-topic"
          ? dialogParentTopic
            ? `添加子主题 · ${dialogParentTopic.name}`
            : `添加主题 · ${dialogDomain?.name ?? ""}`
          : topicStructureDialog?.kind === "edit-topic"
            ? `编辑主题 · ${dialogTopic?.name ?? ""}`
            : "";
    const topicStructureSubmitDisabled = busy || !topicStructureDialog || (
      topicStructureDialog.kind === "create-domain"
        ? !domainName.trim()
        : topicStructureDialog.kind === "edit-domain"
          ? !editDomainName.trim()
          : topicStructureDialog.kind === "create-topic"
            ? !topicName.trim()
            : !editTopicName.trim()
    );
    return (
      <>
      <main className="knowledge-page topic-reading-page">
        <TopicStructureReadingWorkspace
          domains={domains}
          topics={topics}
          topicDetail={topicDetail}
          selectedTopicId={browserTopicId}
          aliases={topicAliases}
          rules={classificationRules}
          relationSuggestions={relationSuggestions}
          onSelectTopic={(topicId) => {
            setBrowserTopicId(topicId);
            setEditTopicId(topicId);
          }}
          onOpenMaintenance={openTopicMaintenance}
          onApplyRelation={acceptRelation}
          onIgnoreRelation={(suggestion) => {
            setRelationSuggestions((current) => current.filter((item) => item !== suggestion));
            onNotify("本次已忽略这条关系建议");
          }}
          busy={busy}
        />
        <details
          className="knowledge-secondary-maintenance knowledge-card"
          data-topic-maintenance="overview"
          open={topicMaintenanceOpen}
          onToggle={(event) => setTopicMaintenanceOpen(event.currentTarget.open)}
        >
          <summary><ChevronRight size={15} />返回上一级</summary>
          <div className="knowledge-secondary-maintenance-body">
        <header className="knowledge-page-header">
          <div><h1>主题管理</h1></div>
          <Sparkles size={28} />
        </header>
        <section className="knowledge-topic-layout knowledge-structure-layout">
          <div className="knowledge-card knowledge-tree-card">
            <div className="knowledge-tree-card-heading">
              <h2>领域与主题 <span>{domains.length} 个领域 · {topics.length} 个主题</span></h2>
              <div className="knowledge-tree-card-actions">
                <button
                  type="button"
                  onClick={() => {
                    setTopicStructureEditorOpen((open) => {
                      if (open) setTopicStructureDialog(null);
                      return !open;
                    });
                  }}
                >
                  <Pencil size={14} />{topicStructureEditorOpen ? "完成编辑" : "编辑"}
                </button>
              </div>
            </div>
            {!domains.length ? <p className="knowledge-empty">尚未建立领域。进入编辑后，可以直接在这里添加第一个领域。</p> : domains.map((domain) => (
              <div className="knowledge-domain" key={domain.id}>
                <div className="knowledge-domain-heading">
                  <strong><Layers3 size={17} />{domain.name}</strong>
                  {topicStructureEditorOpen ? (
                    <div className="knowledge-domain-actions">
                      <button type="button" onClick={() => openCreateTopicDialog(domain.id, null)}>
                        <Plus size={13} />添加主题
                      </button>
                      <button type="button" onClick={() => openEditDomainDialog(domain)}>
                        <Pencil size={13} />编辑领域
                      </button>
                    </div>
                  ) : null}
                </div>
                {topics.filter((topic) => topic.domainId === domain.id).map((topic) => {
                  const detail = maintenanceTopicDetails[topic.id];
                  const expanded = expandedMaintenanceTopicIds.has(topic.id);
                  return (
                    <div className={`knowledge-topic-branch ${expanded ? "expanded" : ""}`} key={topic.id}>
                      <div className="knowledge-topic-row-shell">
                        <button
                          type="button"
                          className={`knowledge-topic-row ${editTopicId === topic.id ? "active" : ""}`}
                          style={{ paddingLeft: `${Math.min(topic.depth - 1, 4) * 22 + 12}px` }}
                          onClick={() => void toggleMaintenanceTopic(topic.id)}
                          aria-expanded={expanded}
                        >
                          <ChevronRight size={14} />
                          <span>{topic.name}</span>
                          <em>{topic.sourceCount} 条来源</em>
                        </button>
                        {topicStructureEditorOpen ? (
                          <div className="knowledge-topic-row-actions">
                            <button type="button" onClick={() => openCreateTopicDialog(domain.id, topic.id)}>
                              <Plus size={12} />添加子主题
                            </button>
                            <button type="button" onClick={() => openEditTopicDialog(topic)}>
                              <Pencil size={12} />编辑主题
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {expanded ? (
                        <div className="knowledge-topic-note-list">
                          {detail?.notes.map((note) => {
                            const sourceItemId = note.sourceItemIds[0];
                            return (
                              <button
                                type="button"
                                key={note.id}
                                disabled={!sourceItemId}
                                onClick={() => sourceItemId && onNavigateToSource({
                                  sourceItemId,
                                  locatorJson: null,
                                  locatorLabel: null,
                                })}
                              >
                                <FileText size={13} />
                                <span>{note.title}</span>
                                <small>{note.sourceItemIds.length} 个来源</small>
                                <ArrowRight size={12} />
                              </button>
                            );
                          })}
                          {detail?.sources
                            .filter((source) => !detail.notes.some(
                              (note) => note.sourceItemIds.includes(source.id),
                            ))
                            .map((source) => (
                              <button
                                type="button"
                                key={`source-${source.id}`}
                                onClick={() => onNavigateToSource({
                                  sourceItemId: source.id,
                                  locatorJson: null,
                                  locatorLabel: null,
                                })}
                              >
                                <FileText size={13} />
                                <span>{source.title}</span>
                                <small>来源笔记 · {formatSourceDate(source.originalAt ?? source.importedAt)}</small>
                                <ArrowRight size={12} />
                              </button>
                            ))}
                          {detail && !detail.notes.length && !detail.sources.length ? (
                            <p>当前主题尚无笔记或来源。</p>
                          ) : null}
                          {!detail ? <p>正在读取主题笔记…</p> : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
            {topicStructureEditorOpen ? (
              <button type="button" className="knowledge-add-domain-row" onClick={openCreateDomainDialog}>
                <Plus size={14} />添加领域
              </button>
            ) : null}
          </div>
        </section>
        <details
          className="knowledge-advanced-maintenance"
          open={topicAdvancedMaintenanceOpen}
          onToggle={(event) => setTopicAdvancedMaintenanceOpen(event.currentTarget.open)}
        >
          <summary>高级结构维护：别名、实体、分类规则、合并、拆分与关系</summary>
          <div className="knowledge-advanced-maintenance-body">
        <section className="knowledge-metrics">
          <div className="knowledge-card"><strong>{inbox.length}</strong><span>待归类来源</span></div>
          <div className="knowledge-card"><strong>{structuralAttentionTopicIds.size}</strong><span>结构事项</span></div>
          <div className="knowledge-card"><strong>{duplicateNames.length}</strong><span>同名候选</span></div>
        </section>
        <section className="knowledge-classification-management">
          <article className="knowledge-card knowledge-governance-panel" data-topic-maintenance="aliases">
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

          <article className="knowledge-card knowledge-governance-panel" data-topic-maintenance="rules">
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
        <section
          className="knowledge-card knowledge-governance-panel knowledge-relation-panel"
          data-topic-maintenance="relations"
        >
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
          </div>
        </details>
          </div>
        </details>
      </main>
      {topicStructureDialog ? createPortal(
        <div
          className="prototype-dialog-backdrop"
          role="presentation"
          onMouseDown={() => setTopicStructureDialog(null)}
        >
          <section
            className="prototype-dialog elevated-card topic-structure-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={topicStructureDialogTitle}
            data-topic-structure-dialog={topicStructureDialog.kind}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="prototype-dialog-heading">
              <div><span>结构编辑</span><h2>{topicStructureDialogTitle}</h2></div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setTopicStructureDialog(null)}
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <form className="topic-structure-dialog-form" onSubmit={(event) => {
              event.preventDefault();
              void submitTopicStructureDialog();
            }}>
              {topicStructureDialog.kind === "create-topic" ? (
                <div className="topic-structure-dialog-context">
                  <span>所属领域<strong>{dialogDomain?.name ?? "未命名领域"}</strong></span>
                  <span>父级位置<strong>{dialogParentTopic?.name ?? "领域顶层"}</strong></span>
                </div>
              ) : null}
              {topicStructureDialog.kind === "create-domain" ? (
                <>
                  <label>领域名称<input autoFocus value={domainName} onChange={(event) => setDomainName(event.target.value)} placeholder="例如：影视制作" /></label>
                  <label>领域说明<textarea value={domainDescription} onChange={(event) => setDomainDescription(event.target.value)} placeholder="说明这个领域长期管理的内容和边界" /></label>
                </>
              ) : null}
              {topicStructureDialog.kind === "edit-domain" ? (
                <>
                  <label>领域名称<input autoFocus value={editDomainName} onChange={(event) => setEditDomainName(event.target.value)} /></label>
                  <label>领域说明<textarea value={editDomainDescription} onChange={(event) => setEditDomainDescription(event.target.value)} placeholder="说明这个领域长期管理的内容和边界" /></label>
                </>
              ) : null}
              {topicStructureDialog.kind === "create-topic" ? (
                <>
                  <label>主题名称<input autoFocus value={topicName} onChange={(event) => setTopicName(event.target.value)} placeholder="例如：实时合成" /></label>
                  <label>主题说明<textarea value={topicDescription} onChange={(event) => setTopicDescription(event.target.value)} placeholder="说明主题范围、关键词和判断边界" /></label>
                </>
              ) : null}
              {topicStructureDialog.kind === "edit-topic" ? (
                <>
                  <label>主题名称<input autoFocus value={editTopicName} onChange={(event) => setEditTopicName(event.target.value)} /></label>
                  <label>主题说明<textarea value={editTopicDescription} onChange={(event) => setEditTopicDescription(event.target.value)} placeholder="说明主题范围、关键词和判断边界" /></label>
                </>
              ) : null}
              <div className="topic-structure-dialog-actions">
                <button type="button" className="secondary" onClick={() => setTopicStructureDialog(null)}>取消</button>
                <button type="submit" disabled={topicStructureSubmitDisabled}>
                  {busy ? "正在保存…" : topicStructureDialog.kind.startsWith("create") ? "确认添加" : "保存修改"}
                </button>
              </div>
            </form>
          </section>
        </div>,
        document.body,
      ) : null}
      </>
    );
  }

  return (
    <>
    <main className="knowledge-page knowledge-inbox-page">
      <header className="knowledge-page-header source-page-actions-only">
        <div className="knowledge-header-actions">
          <button
            disabled={busy || !inbox.some((item) => item.organizationState === "inbox")}
            onClick={() => void autoOrganizeLoadedInbox()}
          >
            <Sparkles size={16} />自动整理待归类来源
          </button>
        </div>
      </header>
      <section
        className="knowledge-inbox-layout"
        ref={sourceLayoutRef}
        style={sourceConnector ? ({
          "--source-connector-y": `${sourceConnector.top}px`,
          "--source-connector-x": `${sourceConnector.left}px`,
          "--source-connector-width": `${sourceConnector.width}px`,
        } as CSSProperties) : undefined}
      >
        <UnifiedNoteListPanel
          className="knowledge-card knowledge-inbox-list"
          ref={sourceListRef}
          onScroll={handleSourceListScroll}
        >
          <div className="knowledge-source-filters">
            <UnifiedNoteListSearchRow className="knowledge-source-search-row">
              <label className="search-field knowledge-source-search-wrap">
                <Search size={19} />
                <input
                  ref={sourceSearchInputRef}
                  value={sourceSearch}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setSourceSearch(nextValue);
                    if (!nextValue.trim()) {
                      sourceSearchRequestSequence.current += 1;
                      setSourceSearchResults(null);
                      setSourceSearchBusy(false);
                    }
                    setSourceSearchHistoryOpen(!nextValue && sourceSearchHistory.length > 0);
                  }}
                  onFocus={() => setSourceSearchHistoryOpen(sourceSearchHistory.length > 0)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitSourceSearch();
                    }
                    if (event.key === "Escape") setSourceSearchHistoryOpen(false);
                  }}
                  placeholder="搜索来源"
                  aria-label="搜索全部来源档案和正文"
                />
                {sourceSearchBusy ? <span className="save-spinner" aria-label="正在搜索全库" /> : null}
                {sourceSearch ? (
                  <button
                    type="button"
                    aria-label="清除来源搜索"
                    onClick={() => {
                      setSourceSearch("");
                      sourceSearchRequestSequence.current += 1;
                      setSourceSearchResults(null);
                      setSourceSearchBusy(false);
                      sourceSearchInputRef.current?.focus();
                    }}
                  >
                    <X size={15} />
                  </button>
                ) : <kbd>⌘ K</kbd>}
                {sourceSearchHistoryOpen ? (
                  <div className="source-search-history" role="listbox" aria-label="最近搜索">
                    <header><strong>最近搜索</strong><button type="button" onClick={() => {
                      clearSourceSearchHistory();
                      setSourceSearchHistory([]);
                      setSourceSearchHistoryOpen(false);
                    }}>清空</button></header>
                    {sourceSearchHistory.map((term) => (
                      <button
                        type="button"
                        role="option"
                        key={term}
                        onClick={() => {
                          setSourceSearch(term);
                          setSourceSearchHistory(rememberSourceSearch(term));
                          setSourceSearchHistoryOpen(false);
                        }}
                      >
                        <Search size={13} /><span>{term}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </label>
              <UnifiedNoteListFilter
                open={sourceFilterOpen}
                active={sourceFilter !== "all"
                  || sourceOriginFilter !== UNIFIED_NOTE_FILTER_ALL
                  || sourceRecordStatusFilter !== UNIFIED_NOTE_FILTER_ALL
                  || sourceTopicFilter !== UNIFIED_NOTE_FILTER_ALL
                  || Boolean(sourceDateFrom)
                  || Boolean(sourceDateTo)}
                onOpenChange={setSourceFilterOpen}
                onReset={() => {
                  setSourceFilter("all");
                  setSourceOriginFilter(UNIFIED_NOTE_FILTER_ALL);
                  setSourceRecordStatusFilter(UNIFIED_NOTE_FILTER_ALL);
                  setSourceTopicFilter(UNIFIED_NOTE_FILTER_ALL);
                  setSourceDateFrom("");
                  setSourceDateTo("");
                }}
                auxiliaryAction={{
                  label: "管理来源名称",
                  onClick: () => void openSourceCollectionManager(),
                }}
                fields={[
                  createUnifiedNoteSourceFilterField({
                    value: sourceOriginFilter,
                    sourceValues: sourceCollections.length
                      ? sourceCollections.map((collection) => collection.displayName)
                      : inbox.map(sourceOriginLabel),
                    onChange: setSourceOriginFilter,
                  }),
                  createUnifiedNoteStatusFilterField({
                    value: sourceRecordStatusFilter,
                    onChange: setSourceRecordStatusFilter,
                  }),
                  createUnifiedNoteTopicFilterField({
                    value: sourceTopicFilter,
                    topicValues: filterTopicValues,
                    onChange: setSourceTopicFilter,
                  }),
                  ...createUnifiedNoteDateFilterFields({
                    dateFrom: sourceDateFrom,
                    dateTo: sourceDateTo,
                    onDateFromChange: setSourceDateFrom,
                    onDateToChange: setSourceDateTo,
                  }),
                ]}
              />
            </UnifiedNoteListSearchRow>
            <UnifiedNoteListDisplayToolbar
              className="knowledge-source-display-toolbar"
              label="来源档案"
              count={visibleSources.length}
              countLabel="条来源"
              compactMode={sourceCompactMode}
              sortMode={sourceSortMode}
              onToggleCompact={() => setSourceCompactMode((value) => !value)}
              onCycleSort={() => setSourceSortMode(cycleUnifiedNoteListSortMode)}
            />
            <UnifiedNoteListToolbar className="knowledge-source-filter-control-row">
              <div className="source-filter-tabs">
                {([
                  ["all", "全部", inbox.length],
                  ["pending", "待确认", inbox.filter((item) => item.organizationState === "inbox").length],
                  ["organized", "已归类", inbox.filter((item) => item.organizationState !== "inbox").length],
                ] as const).map(([value, label, count]) => (
                  <button
                    key={value}
                    className={sourceFilter === value ? "active" : ""}
                    onClick={() => {
                      setSourceFilter(value);
                      const next = inbox.find((item) => (
                        value === "all"
                        || (value === "pending" && item.organizationState === "inbox")
                        || (value === "organized" && item.organizationState !== "inbox")
                      ));
                      if (next) setSelectedId(next.id);
                    }}
                  >
                    {label}<span>{count}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="source-load-all-button"
                disabled={busy || sourceArchiveTotal === 0 || inbox.length >= sourceArchiveTotal}
                onClick={() => void loadAllSources()}
                title={inbox.length >= sourceArchiveTotal
                  ? "全部来源已加载"
                  : `一次加载全部 ${sourceArchiveTotal} 条来源`}
              >
                {inbox.length >= sourceArchiveTotal ? "已全部加载" : `全部加载 ${sourceArchiveTotal}`}
              </button>
            </UnifiedNoteListToolbar>
            {visibleSources.length ? (
              <UnifiedNoteListLocator
                className="source-list-locator"
                aria-label="快速定位来源列表"
                count={visibleSources.length}
                value={sourceLocatorIndex}
                currentIndex={selectedSourceIndex}
                itemLabel="来源"
                onLocate={scrollToSource}
              />
            ) : null}
          </div>
          {visibleSources.map((item) => {
            const itemRecord = item.legacyRecordId
              ? recordById.get(item.legacyRecordId) ?? null
              : null;
            const active = item.id === selectedId;
            return (
              <UnifiedNoteListCard
                key={item.id}
                sourceId={item.id}
                className={`knowledge-source-list-item ${active ? "active" : ""}`}
                compact={sourceCompactMode}
                selected={active}
                menuOpen={sourceListMenuRecordId === item.id}
                onSelect={() => {
                  setSelectedId(item.id);
                  setSourceListMenuRecordId(null);
                }}
                iconKey={resolveNoteIconKey(
                  item.title,
                  item.primaryTopicName,
                  item.platform,
                  item.sourceType,
                )}
                title={item.title}
                theme={item.primaryTopicName
                  ?? (item.organizationState === "inbox" ? "等待自动归类" : "已整理")}
                source={sourceOriginLabel(item)}
                date={item.originalAt ?? item.importedAt}
                actions={
                  <NoteListActions
                    isFavorite={itemRecord?.isFavorite ?? false}
                    menuOpen={sourceListMenuRecordId === item.id}
                    onToggleFavorite={() => {
                      runSourceRecordAction(item, (record) => onToggleRecordFavorite(record.id));
                    }}
                    onExport={() => {
                      runSourceRecordAction(item, (record) => onExportRecord(record.id));
                    }}
                    onToggleMenu={() => setSourceListMenuRecordId((current) => (
                      current === item.id ? null : item.id
                    ))}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSourceListMenuRecordId(null);
                        setSelectedId(item.id);
                        setSourceDetailOpen(true);
                      }}
                    >
                      <Maximize2 size={15} />查看详情
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSourceListMenuRecordId(null);
                        runSourceRecordAction(item, (record) => onUpdateRecordStatus(
                          record.id,
                          record.status === "tracking" ? "normal" : "tracking",
                        ));
                      }}
                    >
                      <RadioTower size={15} />
                      {itemRecord?.status === "tracking" ? "停止持续跟踪" : "加入持续跟踪"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSourceListMenuRecordId(null);
                        void navigator.clipboard.writeText(item.title)
                          .then(() => onNotify("笔记标题已复制"))
                          .catch(() => onNotify("浏览器未授予剪贴板权限"));
                      }}
                    >
                      <Copy size={15} />复制标题
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="danger"
                      onClick={() => {
                        if (!window.confirm("确认将这篇笔记移入回收站吗？")) return;
                        setSourceListMenuRecordId(null);
                        runSourceRecordAction(item, async (record) => {
                          const moved = await onMoveRecordToTrash(record.id);
                          if (moved) void reload();
                        });
                      }}
                    >
                      <Trash2 size={15} />移入回收站
                    </button>
                  </NoteListActions>
                }
              />
            );
          })}
          {inbox.length >= inboxLimit ? (
            <button
              className="knowledge-inbox-load-more"
              disabled={busy}
              onClick={async () => {
                const nextLimit = inboxLimit + INITIAL_INBOX_LIMIT;
                setBusy(true);
                try {
                  setInbox(await repository.listSourceArchive(nextLimit));
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
          {!visibleSources.length ? <p className="knowledge-empty">当前筛选下没有来源。</p> : null}
        </UnifiedNoteListPanel>
        {sourceConnector && sourceConnector.width > 0 ? (
          <span className="source-final-connector" aria-hidden="true"><i /><b /></span>
        ) : null}
        <div className="knowledge-card knowledge-inbox-detail association-link-target" ref={sourceDetailRef}>
          {selected ? (
            <>
              <div className="knowledge-detail-heading">
                <div>
                  <span>{selected.sourceType} · {formatSourceDate(selected.originalAt ?? selected.importedAt)}</span>
                  <div className="source-title-line">
                    {editingSourceTitle ? (
                      <input
                        autoFocus
                        value={sourceTitleDraft}
                        onChange={(event) => setSourceTitleDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void saveSourceTitle();
                          }
                          if (event.key === "Escape") {
                            setSourceTitleDraft(selected.title);
                            setEditingSourceTitle(false);
                          }
                        }}
                        aria-label="修改笔记标题"
                      />
                    ) : <h2>{selected.title}</h2>}
                    {editingSourceTitle ? (
                      <div className="source-title-edit-actions">
                        <button type="button" onClick={() => void saveSourceTitle()} disabled={busy}>保存</button>
                        <button type="button" onClick={() => {
                          setSourceTitleDraft(selected.title);
                          setEditingSourceTitle(false);
                        }}>取消</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="source-title-edit-button"
                        onClick={() => setEditingSourceTitle(true)}
                        aria-label="修改笔记标题"
                        title="修改笔记标题"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                  <div className="source-final-inline-meta">
                    <span>{sourceKnowledgeDomain?.name ?? "领域待定"}</span>
                    <span>{sourceKnowledgeTopic?.name ?? selected.primaryTopicName ?? "主题待定"}</span>
                    <span>来源：{sourceOriginLabel(selected)}</span>
                    <span>{selectedSuggestion ? `${Math.round(selectedSuggestion.score)}% 匹配` : "已按现有结构归档"}</span>
                  </div>
                </div>
                <div className="knowledge-detail-actions">
                  {sourceKnowledgeTopic ? (
                    <button onClick={() => onNavigateToKnowledgeTopic({
                      topicId: sourceKnowledgeTopic.id,
                      viewMode: "sources",
                      sourceItemId: selected.id,
                    })}>
                      <Link2 size={16} />返回主题来源
                    </button>
                  ) : null}
                  {selectedOriginalText ? (
                    <button
                      type="button"
                      onClick={() => setSourceDetailOpen(true)}
                    >
                      <Maximize2 size={16} />查看详情
                    </button>
                  ) : null}
                  {selected.organizationState === "inbox" ? (
                    <button onClick={() => void generateSuggestions()} disabled={busy || autoSuggestingSourceId === selected.id || !topics.length}>
                      <Sparkles size={16} />
                      {autoSuggestingSourceId === selected.id
                        ? "自动整理中…"
                        : hasCurrentClassificationRun
                          ? "重新计算建议"
                          : hasStalePendingSuggestions
                            ? "按新版重新计算"
                            : "生成分类建议"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className={`source-final-detail-grid ${sourceHasInsights ? "" : "body-only"}`}>
                <section className="source-final-body">
                  <div className="source-final-section-heading">
                    <div><span>原始资料</span><h3>来源正文</h3></div>
                    <div className="source-body-tools">
                      <label>
                        <Search size={14} />
                        <input
                          value={sourceBodySearch}
                          onChange={(event) => setSourceBodySearch(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              searchSourceText();
                            }
                          }}
                          placeholder="搜索正文文字"
                          aria-label="搜索来源正文"
                        />
                      </label>
                      <button type="button" onClick={searchSourceText}>搜索</button>
                    </div>
                  </div>
                  <div className="knowledge-source-preview" ref={sourceBodyRef}>
                    {selectedReadableContent === null
                      ? <div className="page-loading"><span className="save-spinner" />正在读取当前来源正文…</div>
                      : <>
                        {visibleSourceMessages.length ? (
                          <div className="knowledge-conversation-reader">
                            {visibleSourceMessages.map((message, index) => (
                              <KnowledgeSourceMessage
                                key={`${message.role}-${message.createdAt ?? index}-${index}`}
                                message={message}
                                compact
                                attachments={sourceAttachments}
                                onOpenAttachment={onOpenAttachment}
                              />
                            ))}
                          </div>
                        ) : (
                          <MarkdownContent
                            value={readableSourceText || "来源正文为空"}
                            className="source-plain-text right-reading-copy right-reading-copy-12"
                          />
                        )}
                      </>}
                  </div>
                </section>

                {sourceHasInsights ? <aside className="source-final-insights" aria-label="来源关联知识">
                  <section>
                    <div className="source-final-section-heading">
                      <div><span>知识落点</span><h3>所在主题命题</h3></div>
                      <em>{sourceTopicDetail?.propositions.length ?? 0}</em>
                    </div>
                    <div className="source-final-proposition-list">
                      {sourceTopicDetail?.propositions.slice(0, 4).map((proposition) => (
                        <article key={proposition.id}>
                          <strong>{proposition.statementMarkdown}</strong>
                          <span>{proposition.hypothesisGroup || "未分组命题"} · {Math.round(proposition.confidence)}%</span>
                        </article>
                      ))}
                      {!sourceTopicDetail?.propositions.length ? (
                        <p>当前主题尚未形成正式命题。</p>
                      ) : null}
                    </div>
                  </section>

                  <section>
                    <div className="source-final-section-heading">
                      <div><span>可追溯证据</span><h3>证据锚点</h3></div>
                      <em>{sourceEvidenceAnchors.length}</em>
                    </div>
                    <div className="source-final-anchor-list">
                      {sourceEvidenceAnchors.slice(0, 4).map((evidence) => (
                        <article key={evidence.id}>
                          <strong>{evidence.contentMarkdown}</strong>
                          <span>
                            {evidence.stance === "support" ? "支持" : evidence.stance === "oppose" ? "反对" : "背景"}
                            {" · "}{evidence.locatorLabel ?? "未设置定位"}
                          </span>
                        </article>
                      ))}
                      {!sourceEvidenceAnchors.length ? <p>这条来源尚未建立证据锚点。</p> : null}
                    </div>
                  </section>

                  {selected.organizationState === "inbox" ? (
                    <details className="source-final-exception">
                      <summary>异常时调整归属</summary>
                      <div>
                        {currentPendingSuggestions.map((suggestion) => {
                          const topic = topics.find((candidate) => candidate.id === suggestion.suggestedTopicId);
                          if (!topic) return null;
                          return (
                            <label className={selectedTopicId === topic.id ? "active" : ""} key={suggestion.id}>
                              <input type="radio" checked={selectedTopicId === topic.id} onChange={() => setSelectedTopicId(topic.id)} />
                              <span>
                                <strong>{topicPath(topic, topics).join(" / ")}</strong>
                                <small>{suggestion.reasons[0] ?? "本地确定性评分"}</small>
                              </span>
                              <em>{Math.round(suggestion.score)}%</em>
                            </label>
                          );
                        })}
                        <label className="knowledge-manual-topic">
                          <span>手动选择主题</span>
                          <select value={selectedTopicId ?? ""} onChange={(event) => setSelectedTopicId(event.target.value ? Number(event.target.value) : null)}>
                            <option value="">请选择</option>
                            {topics.map((topic) => <option key={topic.id} value={topic.id}>{topicPath(topic, topics).join(" / ")}</option>)}
                          </select>
                        </label>
                        <button className="knowledge-primary-action" onClick={() => void acceptClassification()} disabled={busy || selectedTopicId === null}>
                          <Check size={17} />确认例外归属<ArrowRight size={16} />
                        </button>
                      </div>
                    </details>
                  ) : null}
                </aside> : null}
              </div>
            </>
          ) : <p className="knowledge-empty">选择一条来源查看正文和分类解释。</p>}
        </div>
      </section>
    </main>
    {sourceCollectionManagerOpen ? (
      <SourceCollectionManagerDialog
        collections={sourceCollections}
        busyCollectionId={sourceCollectionBusyId}
        onRename={renameSourceCollection}
        onClose={() => setSourceCollectionManagerOpen(false)}
      />
    ) : null}
    {sourceDetailOpen && selected && selectedReadableContent ? (
      <KnowledgeSourceDialog
        title={selected.title}
        messages={selectedReadableContent.messages}
        fullText={selectedReadableContent.fullText}
        attachments={sourceAttachments}
        onOpenAttachment={onOpenAttachment}
        onClose={() => setSourceDetailOpen(false)}
      />
    ) : null}
    </>
  );
}

export const KnowledgeWorkspace = memo(KnowledgeWorkspaceView);
KnowledgeWorkspace.displayName = "KnowledgeWorkspace";
