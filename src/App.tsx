import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Braces,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  Database,
  FileCheck2,
  FileJson2,
  FileText,
  Files,
  FileDown,
  Folder,
  FolderOpen,
  FolderTree,
  HardDrive,
  History,
  Image as ImageIcon,
  Inbox,
  Keyboard,
  LayoutGrid,
  MoreHorizontal,
  MoreVertical,
  Maximize2,
  Paperclip,
  Pencil,
  Plus,
  RadioTower,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  sampleJson,
} from "./mockData";
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { createPortal } from "react-dom";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { convertFileSrc } from "@tauri-apps/api/core";
import type {
  KnowledgeReadingTarget,
  KnowledgeSourceTarget,
} from "./components/KnowledgeReadingWorkspace";
import { NoteListActions } from "./components/NoteListActions";
import {
  NoteSemanticIcon,
  UnifiedNoteListCard,
  UnifiedNoteListDisplayToolbar,
  UnifiedNoteListFilter,
  UnifiedNoteListLocator,
  UnifiedNoteListPanel,
  UnifiedNoteListSearchRow,
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
} from "./components/UnifiedNoteListCard";
import { AttachmentPreview } from "./components/AttachmentPreview";
import {
  recordToUpdate,
  recordToSummary,
  type IntelligenceRecord,
  type BackupPreview,
  type PortableBackupPreview,
  type AttachmentItem,
  type ImportPreview,
  type ImportResult,
  type ImportJobSummary,
  type RecordStatus,
  type RecordQuery,
  type RecordSummary,
  type RecordSourceInput,
  type PatchRecordInput,
  type StorageStats,
  type RecordVersion,
  type UpdateRecordInput,
} from "./domain/models";
import {
  getRecordRepository,
  type ImportDuplicateStrategy,
  type RecordRepository,
} from "./services/recordRepository";
import { KnowledgeRepository } from "./services/knowledgeRepository";
import {
  autoOrganizeImportedSources,
  type KnowledgeAutoOrganizationResult,
  undoAutoOrganization,
} from "./services/knowledgeAutoOrganizer";
import {
  readImportedContent,
  resolveImportedTitle,
  shouldDisplaySummary,
  type ReadableSourceMessage,
} from "./domain/importedContent";
import { composeRecordMarkdown, createRecordDocx } from "./domain/recordExport";
import { mapImportedRecord, previewMappedValue } from "./domain/importMapping";
import brandIcon from "../src-tauri/icons/128x128.png";
import {
  createImportQueueItems,
  importReadyQueue,
  prepareImportQueue,
  type ImportQueueItem,
} from "./domain/importQueue";
import {
  analyzeScenePalette,
  getKnowledgeSkin,
  getSkinFallbackPalette,
  KNOWLEDGE_SKINS,
  persistKnowledgeSkin,
  readKnowledgeSkin,
  type AdaptiveScenePalette,
  type KnowledgeSkinId,
} from "./theme/knowledgeSkins";

const STORAGE_PREFIX = "nanfeng-knowledge-base";
const LEGACY_STORAGE_PREFIX = "nanfeng-intelligence";

function brandedStorageKey(suffix: string): string {
  return `${STORAGE_PREFIX}:${suffix}`;
}

function migrateLegacyPreferences(): void {
  if (typeof window === "undefined") return;
  try {
    const legacyEntries: Array<[string, string]> = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(LEGACY_STORAGE_PREFIX)) continue;
      const value = window.localStorage.getItem(key);
      if (value !== null) legacyEntries.push([key, value]);
    }
    legacyEntries.forEach(([legacyKey, value]) => {
      const nextKey = `${STORAGE_PREFIX}${legacyKey.slice(LEGACY_STORAGE_PREFIX.length)}`;
      if (window.localStorage.getItem(nextKey) === null) {
        window.localStorage.setItem(nextKey, value);
      }
    });
  } catch {
    // 浏览器存储不可用时继续启动，桌面端数据库仍是记录数据的唯一来源。
  }
}

migrateLegacyPreferences();
import { versionDifferences } from "./domain/versionDiff";
import {
  connectorMetricsEqual,
  connectionOpacity,
  measureCardToCardConnector,
} from "./connectionGeometry";
import { useRafScheduledCallback } from "./performance/useRafScheduledCallback";

type Page =
  | "sources"
  | "topics"
  | "knowledge"
  | "records"
  | "favorites"
  | "tracking"
  | "updates"
  | "import"
  | "trash"
  | "settings";
type ImportStep = "empty" | "preview" | "mapping";
type SaveState = "idle" | "saving" | "saved" | "draft" | "error";
type Notice = {
  id: number;
  message: string;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
};
type NotifyOptions = Omit<Notice, "id" | "message">;
type Notify = (message: string, options?: NotifyOptions) => void;
type ConnectionMetrics = {
  left: number;
  top: number;
  width: number;
  opacity: number;
};
type NavItem = {
  id: Exclude<Page, "trash" | "settings">;
  label: string;
  count?: number;
  icon: React.ComponentType<{ size?: number }>;
  tone?: "danger";
};

const coreNavItems: NavItem[] = [
  { id: "knowledge", label: "知识视图", icon: BookOpen },
  { id: "sources", label: "来源档案", icon: Files },
  { id: "topics", label: "主题管理", icon: FolderTree },
];

const supportingNavItems: NavItem[] = [
  { id: "favorites", label: "我的收藏", icon: Star },
  { id: "tracking", label: "持续跟踪", icon: RadioTower },
  { id: "updates", label: "判断更新", icon: FileCheck2, tone: "danger" },
];

function formatRecordDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(5, 10);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(date).replace("/", "-");
}

function formatRecordDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace("T", " ").slice(0, 16);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

function formatGigabytes(sizeBytes: number): string {
  return (sizeBytes / 1024 / 1024 / 1024).toFixed(1);
}

function formatImportJobStatus(status: ImportJobSummary["status"]): string {
  return {
    preview: "预览",
    importing: "导入中",
    completed: "已完成",
    partial: "部分完成",
    failed: "失败",
  }[status] ?? status;
}

function autoOrganizationNotice(result: KnowledgeAutoOrganizationResult): string {
  const parts = [
    `已分析 ${result.analyzedCount} 条`,
    `自动归类 ${result.autoClassifiedCount} 条`,
    `待确认 ${result.awaitingConfirmationCount} 条`,
  ];
  if (result.catalogBootstrapped) parts.push("已建立可编辑默认目录");
  if (result.failures.length) parts.push(`${result.failures.length} 条保留在来源档案待确认`);
  return `自动整理完成：${parts.join("，")}`;
}

type RecordListItem = IntelligenceRecord | RecordSummary;

function recordSourceLabel(record: RecordListItem): string {
  return ("sourceTitle" in record ? record.sourceTitle : record.sources[0]?.title)
    || record.summary
    || "本地记录";
}

function recordTopicLabel(record: RecordListItem): string {
  if ("primaryTopicName" in record && record.primaryTopicName) return record.primaryTopicName;
  return record.tags[0] || "等待自动归类";
}

const recordDisplayTitleCache = new WeakMap<object, string>();

function recordDisplayTitle(record: RecordListItem): string {
  const cached = recordDisplayTitleCache.get(record);
  if (cached !== undefined) return cached;
  const displayTitle = "displayTitle" in record
    ? record.displayTitle
    : resolveImportedTitle(record.title, record.sourceText);
  recordDisplayTitleCache.set(record, displayTitle);
  return displayTitle;
}

function summaryFromRecord(record: IntelligenceRecord): RecordSummary {
  return {
    ...recordToSummary(record),
    displayTitle: resolveImportedTitle(record.title, record.sourceText),
  };
}

function judgmentDraftKey(recordId: number): string {
  return brandedStorageKey(`judgment-draft:${recordId}`);
}

function readJudgmentDraft(recordId: number): string | null {
  try {
    return window.localStorage.getItem(judgmentDraftKey(recordId));
  } catch {
    return null;
  }
}

function writeJudgmentDraft(recordId: number, value: string): void {
  try {
    window.localStorage.setItem(judgmentDraftKey(recordId), value);
  } catch {
    // 数据库保存仍会继续；存储不可用时由保存失败状态向用户反馈。
  }
}

function clearJudgmentDraft(recordId: number): void {
  try {
    window.localStorage.removeItem(judgmentDraftKey(recordId));
  } catch {
    // 草稿清理由数据库保存结果兜底，不阻断主流程。
  }
}

function collectAppPreferences(): string {
  const preferences: Record<string, string> = {};
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      const value = window.localStorage.getItem(key);
      if (value !== null) preferences[key] = value;
    }
  } catch {
    // 本地偏好不可读时仍允许创建只含数据库和文件的迁移备份。
  }
  return JSON.stringify(preferences);
}

function restoreAppPreferences(preferencesJson: string): void {
  const preferences = JSON.parse(preferencesJson) as Record<string, unknown>;
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(STORAGE_PREFIX) || key?.startsWith(LEGACY_STORAGE_PREFIX)) {
      window.localStorage.removeItem(key);
    }
  }
  Object.entries(preferences).forEach(([key, value]) => {
    if (typeof value === "string") {
      const restoredKey = key.startsWith(LEGACY_STORAGE_PREFIX)
        ? `${STORAGE_PREFIX}${key.slice(LEGACY_STORAGE_PREFIX.length)}`
        : key;
      if (restoredKey.startsWith(STORAGE_PREFIX)) {
        window.localStorage.setItem(restoredKey, value);
      }
    }
  });
}

function statusLabel(status: RecordStatus): string {
  return {
    normal: "普通记录",
    tracking: "持续跟踪",
    verification: "待验证",
    updated: "判断更新",
  }[status];
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const keyword = query.trim();
  if (!keyword) return <>{text}</>;
  const lowerText = text.toLocaleLowerCase();
  const lowerKeyword = keyword.toLocaleLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let matchIndex = lowerText.indexOf(lowerKeyword);
  while (matchIndex >= 0) {
    if (matchIndex > cursor) parts.push(text.slice(cursor, matchIndex));
    parts.push(<mark key={`${matchIndex}-${keyword}`}>{text.slice(matchIndex, matchIndex + keyword.length)}</mark>);
    cursor = matchIndex + keyword.length;
    matchIndex = lowerText.indexOf(lowerKeyword, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

const LazyMarkdownContent = lazy(() => import("./components/MarkdownContent"));
const LazyReadableMessageContent = lazy(() =>
  import("./components/MarkdownContent").then((module) => ({ default: module.ReadableMessageContent })));
const LazyKnowledgeWorkspace = lazy(() =>
  import("./components/KnowledgeWorkspace").then((module) => ({ default: module.KnowledgeWorkspace })));

function MarkdownContent(props: { value: string; className?: string }) {
  return <Suspense fallback={<div className="markdown-loading">正在渲染内容…</div>}><LazyMarkdownContent {...props} /></Suspense>;
}

function ReadableMessageContent({
  message,
  compact,
  className,
  children,
}: {
  message: ReadableSourceMessage;
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="markdown-loading">正在渲染内容…</div>}>
      <LazyReadableMessageContent message={message} compact={compact} className={className}>{children}</LazyReadableMessageContent>
    </Suspense>
  );
}

function AppCard({
  children,
  className = "",
  onClick,
  onDoubleClick,
  cardRef,
  dataRecordId,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
  cardRef?: React.Ref<HTMLElement>;
  dataRecordId?: number;
}) {
  return (
    <section
      ref={cardRef}
      data-record-id={dataRecordId}
      className={`elevated-card ${className}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </section>
  );
}

function PrototypeNotice({
  notice,
  onClose,
}: {
  notice: Notice | null;
  onClose: () => void;
}) {
  if (!notice) return null;
  return (
    <div className="prototype-notice" role="status">
      <CheckCircle2 size={18} />
      <span>{notice.message}</span>
      {notice.actionLabel && notice.onAction ? (
        <button
          className="notice-action"
          onClick={() => {
            void Promise.resolve(notice.onAction?.()).then(onClose);
          }}
        >
          <FolderOpen size={15} />{notice.actionLabel}
        </button>
      ) : null}
      <button className="notice-close" onClick={onClose} aria-label="关闭提示"><X size={15} /></button>
    </div>
  );
}

function PrototypeDialog({
  eyebrow,
  title,
  onClose,
  children,
  className = "",
  resizable = false,
  sizePreferenceKey,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  resizable?: boolean;
  sizePreferenceKey?: string;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // 完整内容始终以稳定的大阅读面打开；不读取旧的小尺寸偏好，避免打开后跳变。
    if (
      className.split(/\s+/).includes("source-content-dialog")
      || className.split(/\s+/).includes("shortcut-settings-dialog")
    ) return;
    const resolvedSizePreferenceKey = sizePreferenceKey ?? (className.split(/\s+/).includes("share-record-dialog")
      ? "share-record-dialog-v3"
      : className || "default");
    const storageKey = brandedStorageKey(`dialog-size:${resolvedSizePreferenceKey}`);
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as {
        width?: number;
        height?: number;
      } | null;
      if (saved?.width) dialog.style.width = `${saved.width}px`;
      if (saved?.height) dialog.style.height = `${saved.height}px`;
    } catch {
      // 无法读取偏好时使用响应式默认尺寸。
    }
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      try {
        const bounds = dialog.getBoundingClientRect();
        window.localStorage.setItem(storageKey, JSON.stringify({
          width: Math.round(bounds.width),
          height: Math.round(bounds.height),
        }));
      } catch {
        // 尺寸偏好不是核心数据，写入失败不阻断弹窗。
      }
    });
    observer.observe(dialog);
    return () => observer.disconnect();
  }, [className, sizePreferenceKey]);

  return createPortal(
    <div className="prototype-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className={`prototype-dialog elevated-card ${resizable ? "is-resizable" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="prototype-dialog-heading">
          <div><span>{eyebrow}</span><h2>{title}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>
        {children}
        {resizable ? (
          <span className="prototype-dialog-resize-handle" aria-hidden="true">
            <Maximize2 size={14} />
          </span>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}

function ShareRecordDialog({
  record,
  repository,
  onClose,
  onNotify,
}: {
  record: IntelligenceRecord;
  repository: RecordRepository;
  onClose: () => void;
  onNotify: Notify;
}) {
  const content = useMemo(() => composeRecordMarkdown(record), [record]);
  const [busyFormat, setBusyFormat] = useState<"md" | "docx" | null>(null);
  const safeTitle = resolveImportedTitle(record.title, record.sourceText).replace(/[\\/:*?"<>|]/g, "_");
  const notifyExported = async (format: "Markdown" | "DOCX", filePath?: string) => {
    if (!filePath) {
      onNotify(`完整笔记已导出为 ${format}`, { durationMs: 6_500 });
      return;
    }
    let copied = false;
    try {
      await repository.copyExportedFile(filePath);
      copied = true;
    } catch {
      copied = false;
    }
    onNotify(
      copied
        ? `${format} 已导出并复制文件，可直接粘贴`
        : `${format} 已导出；当前平台未能复制文件对象`,
      {
      durationMs: 7_500,
      actionLabel: "打开原路径",
      onAction: () => repository.openExportDirectory()
        .catch((error) => onNotify(error instanceof Error ? error.message : "无法打开导出目录")),
      },
    );
  };
  return (
    <PrototypeDialog eyebrow="导出完整笔记" title={resolveImportedTitle(record.title, record.sourceText)} onClose={onClose} className="share-record-dialog">
      <div className="share-preview"><MarkdownContent value={content} /></div>
      <div className="share-platforms">
        <button
          className="secondary-button export-note-button"
          disabled={busyFormat !== null}
          onClick={async () => {
            setBusyFormat("md");
            try {
              if ("__TAURI_INTERNALS__" in window) {
                const result = await repository.writeMarkdownExport(`${safeTitle}.md`, content);
                await notifyExported("Markdown", result.filePath);
              } else {
                const url = URL.createObjectURL(new Blob([content], {
                  type: "text/markdown;charset=utf-8",
                }));
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `${safeTitle}.md`;
                anchor.click();
                URL.revokeObjectURL(url);
                await notifyExported("Markdown");
              }
            } catch (error) {
              onNotify(error instanceof Error ? error.message : "Markdown 导出失败");
            } finally {
              setBusyFormat(null);
            }
          }}
        >
          <FileDown size={17} />{busyFormat === "md" ? "正在导出 Markdown…" : "导出 Markdown"}
        </button>
        <button
          className="secondary-button export-note-button"
          disabled={busyFormat !== null}
          onClick={async () => {
            setBusyFormat("docx");
            try {
              const bytes = await createRecordDocx(content);
              if ("__TAURI_INTERNALS__" in window) {
                const result = await repository.writeDocxExport(
                  `${safeTitle}.docx`,
                  Array.from(bytes),
                );
                await notifyExported("DOCX", result.filePath);
              } else {
                const browserBuffer = new Uint8Array(bytes).buffer;
                const url = URL.createObjectURL(new Blob([browserBuffer], {
                  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                }));
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `${safeTitle}.docx`;
                anchor.click();
                URL.revokeObjectURL(url);
                await notifyExported("DOCX");
              }
            } catch (error) {
              onNotify(error instanceof Error ? error.message : "DOCX 生成失败");
            } finally {
              setBusyFormat(null);
            }
          }}
        >
          <FileDown size={17} />{busyFormat === "docx" ? "正在生成 DOCX…" : "导出 DOCX"}
        </button>
      </div>
      <p className="dialog-footnote">两种格式都直接导出当前记录完整原文；Markdown 适合 Obsidian 和 Codex，DOCX 保留标题、段落、列表、表格与强调格式。</p>
    </PrototypeDialog>
  );
}

function Sidebar({
  page,
  recordCount,
  favoriteCount,
  trackingCount,
  updateCount,
  trashCount,
  storageStats,
  storageRefreshing,
  onRefreshStorage,
  onNavigate,
}: {
  page: Page;
  recordCount: number;
  favoriteCount: number;
  trackingCount: number;
  updateCount: number;
  trashCount: number;
  storageStats: StorageStats | null;
  storageRefreshing: boolean;
  onRefreshStorage: () => void;
  onNavigate: (page: Page) => void;
}) {
  const counts: Partial<Record<NavItem["id"], number>> = {
    favorites: favoriteCount,
    tracking: trackingCount,
    updates: updateCount,
  };
  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = item.id === page;
    return (
      <button
        className={`nav-item ${isActive ? "active" : ""} ${item.tone ?? ""}`}
        key={item.id}
        onClick={() => onNavigate(item.id as Page)}
        aria-current={isActive ? "page" : undefined}
        title={item.label}
      >
        <Icon size={20} />
        <span className="nav-label">{item.label}</span>
        {(counts[item.id] ?? item.count) !== undefined
          ? <span className="nav-count">{counts[item.id] ?? item.count}</span>
          : null}
      </button>
    );
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <img src={brandIcon} alt="" aria-hidden="true" />
        </div>
        <div>
          <strong>南枫知识库</strong>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="主导航">
        <div className="nav-group nav-group-core">
          {coreNavItems.map(renderNavItem)}
        </div>
        <div className="nav-separator" />
        <div className="nav-group nav-group-supporting">
          {supportingNavItems.map(renderNavItem)}
        </div>
      </nav>

      <div className="sidebar-bottom">
        <button className={`nav-item ${page === "trash" ? "active" : ""}`} onClick={() => onNavigate("trash")}>
          <Trash2 size={20} />
          <span className="nav-label">回收站</span>
          <span className="nav-count">{trashCount}</span>
        </button>
        <button className={`nav-item ${page === "settings" || page === "import" ? "active" : ""}`} onClick={() => onNavigate("settings")}>
          <Settings size={20} />
          <span className="nav-label">设置</span>
        </button>
        <div className="storage">
          <div className="storage-stat-line">
            <span>知识库占用</span>
            <div className="storage-stat-value">
              <strong>{storageStats ? formatGigabytes(storageStats.totalBytes) : "—"} G</strong>
              <button
                type="button"
                className="storage-refresh-button"
                aria-label="刷新存储统计"
                title="重新扫描存储占用"
                disabled={storageRefreshing}
                onClick={onRefreshStorage}
              >
                <RefreshCw size={12} className={storageRefreshing ? "is-spinning" : ""} />
              </button>
            </div>
          </div>
          <div className="storage-stat-line">
            <span>磁盘可用</span>
            <strong>{storageStats ? formatGigabytes(storageStats.diskAvailableBytes) : "—"} G</strong>
          </div>
        </div>
      </div>
    </aside>
  );
}

function RecordList({
  records,
  topicValues,
  scope,
  selectedId,
  onSelect,
  search,
  setSearch,
  searchRef,
  onSelectedGeometryChange,
  onToggleFavorite,
  onUpdateStatus,
  onMoveToTrash,
  onShare,
  onViewDetails,
  onNotify,
}: {
  records: RecordSummary[];
  topicValues: string[];
  scope: "records" | "favorites" | "tracking" | "updates";
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  search: string;
  setSearch: (value: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  onSelectedGeometryChange: (metrics: ConnectionMetrics | null) => void;
  onToggleFavorite: (id: number) => void;
  onUpdateStatus: (id: number, status: RecordStatus) => void;
  onMoveToTrash: (id: number) => void;
  onShare: (id: number) => void;
  onViewDetails: (id: number) => void;
  onNotify: Notify;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState(UNIFIED_NOTE_FILTER_ALL);
  const [statusFilter, setStatusFilter] = useState<"all" | RecordStatus>("all");
  const [topicFilter, setTopicFilter] = useState(UNIFIED_NOTE_FILTER_ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortMode, setSortMode] = useState<UnifiedNoteListSortMode>("default");
  const [compactMode, setCompactMode] = useState(true);
  const [visibleLimit, setVisibleLimit] = useState(80);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const deferredScope = useDeferredValue(scope);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(brandedStorageKey("recent-searches")) ?? "[]");
    } catch {
      return [];
    }
  });
  const filtered = useMemo(() => {
    const scopedRecords = deferredScope === "favorites"
      ? records.filter((record) => record.isFavorite)
      : deferredScope === "tracking"
        ? records.filter((record) => record.status === "tracking")
        : deferredScope === "updates"
          ? records.filter((record) => record.status === "updated")
          : records;
    const matches = scopedRecords
      .filter((record) => matchesUnifiedNoteFilter(recordSourceLabel(record), sourceFilter))
      .filter((record) => matchesUnifiedNoteFilter(record.status, statusFilter))
      .filter((record) => matchesUnifiedNoteFilter(recordTopicLabel(record), topicFilter))
      .filter((record) => !dateFrom || (record.originalAt ?? record.updatedAt).slice(0, 10) >= dateFrom)
      .filter((record) => !dateTo || (record.originalAt ?? record.updatedAt).slice(0, 10) <= dateTo);
    return sortUnifiedNoteListItems(
      matches,
      sortMode,
      (record) => record.originalAt ?? record.updatedAt,
    );
  }, [dateFrom, dateTo, deferredScope, records, sortMode, sourceFilter, statusFilter, topicFilter]);
  const pagedRecords = filtered.slice(0, visibleLimit);

  useEffect(() => {
    setVisibleLimit(80);
  }, [dateFrom, dateTo, scope, search, sortMode, sourceFilter, statusFilter, topicFilter]);

  useEffect(() => {
    const keyword = search.trim();
    if (!keyword) return;
    const timer = window.setTimeout(() => {
      setRecentSearches((current) => {
        const next = [keyword, ...current.filter((item) => item !== keyword)].slice(0, 8);
        localStorage.setItem(brandedStorageKey("recent-searches"), JSON.stringify(next));
        return next;
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (filtered.some((record) => record.id === selectedId)) return;
    onSelect(filtered[0]?.id ?? null);
  }, [filtered, onSelect, selectedId]);

  useEffect(() => {
    setOpenMenuId(null);
  }, [dateFrom, dateTo, selectedId, scope, search, sourceFilter, sortMode, statusFilter, topicFilter]);

  useEffect(() => {
    const closeFloatingLayers = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".record-action-menu") && !target.closest(".quick-actions")) {
        setOpenMenuId(null);
      }
      if (!target.closest(".search-field") && !target.closest(".recent-searches")) {
        setSearchFocused(false);
      }
    };
    const closeFloatingLayersOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenMenuId(null);
      setSearchFocused(false);
    };
    window.addEventListener("mousedown", closeFloatingLayers);
    window.addEventListener("keydown", closeFloatingLayersOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeFloatingLayers);
      window.removeEventListener("keydown", closeFloatingLayersOnEscape);
    };
  }, []);

  const selectedIndex = useMemo(
    () => Math.max(0, filtered.findIndex((record) => record.id === selectedId)),
    [filtered, selectedId],
  );
  const [locatorIndex, setLocatorIndex] = useState(selectedIndex);

  useEffect(() => {
    setLocatorIndex(selectedIndex);
  }, [selectedIndex]);

  const scrollToRecord = (index: number) => {
    const clampedIndex = Math.min(Math.max(index, 0), Math.max(filtered.length - 1, 0));
    const next = filtered[clampedIndex];
    if (!next) return;
    setLocatorIndex(clampedIndex);
    if (clampedIndex >= visibleLimit) {
      setVisibleLimit(Math.min(filtered.length, clampedIndex + 20));
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const list = listRef.current;
        const target = list?.querySelector<HTMLElement>(`[data-record-id="${next.id}"]`);
        if (!list || !target) return;
        list.scrollTop = Math.max(
          0,
          target.offsetTop - list.clientHeight / 2 + target.offsetHeight / 2,
        );
      });
    });
  };

  const copyRecordTitle = async (record: RecordSummary) => {
    try {
      await navigator.clipboard.writeText(recordDisplayTitle(record));
      onNotify("记录标题已复制");
    } catch {
      onNotify("已生成记录标题（浏览器未授予剪贴板权限）");
    }
    setOpenMenuId(null);
  };

  const scopeLabel = scope === "favorites"
    ? "我的收藏"
    : scope === "updates"
      ? "判断更新"
      : scope === "tracking"
        ? "持续跟踪"
        : "全部记录";

  const scheduleGeometryUpdate = useRafScheduledCallback(() => {
    const card = selectedCardRef.current;
    const workspace = card?.closest<HTMLElement>(".records-workspace");
    const detailPanel = workspace?.querySelector<HTMLElement>(".detail-panel");
    const list = listRef.current;
    if (!card || !workspace || !detailPanel || !list) {
      onSelectedGeometryChange(null);
      return;
    }

    const cardRect = card.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    const detailRect = detailPanel.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const cardCenterY = cardRect.top + cardRect.height / 2;
    const opacity = connectionOpacity(
      cardCenterY,
      listRect.top,
      listRect.bottom,
    );
    const connector = measureCardToCardConnector(
      workspaceRect,
      cardRect,
      detailRect,
    );

    onSelectedGeometryChange({
      ...connector,
      opacity,
    });
  });

  useLayoutEffect(() => {
    scheduleGeometryUpdate();
    const list = listRef.current;
    const resizeObserver = new ResizeObserver(scheduleGeometryUpdate);
    const card = selectedCardRef.current;
    const workspace = card?.closest<HTMLElement>(".records-workspace");
    const detailPanel = workspace?.querySelector<HTMLElement>(".detail-panel");

    if (card) resizeObserver.observe(card);
    if (workspace) resizeObserver.observe(workspace);
    if (detailPanel) resizeObserver.observe(detailPanel);
    list?.addEventListener("scroll", scheduleGeometryUpdate, { passive: true });
    window.addEventListener("resize", scheduleGeometryUpdate);

    return () => {
      resizeObserver.disconnect();
      list?.removeEventListener("scroll", scheduleGeometryUpdate);
      window.removeEventListener("resize", scheduleGeometryUpdate);
    };
  }, [filtered.length, scheduleGeometryUpdate, selectedId]);

  return (
    <UnifiedNoteListPanel className={`record-pane ${scope === "records" ? "" : "knowledge-card record-subview-list-card"}`}>
      <UnifiedNoteListSearchRow>
        <label className="search-field">
          <Search size={19} />
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索记录"
            aria-label="搜索记录"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
          />
          {search ? (
            <button onClick={() => setSearch("")} aria-label="清除搜索"><X size={15} /></button>
          ) : <kbd>⌘ K</kbd>}
        </label>
        {searchFocused && recentSearches.length ? (
          <div className="recent-searches elevated-card">
            <div><strong>最近搜索</strong><button onMouseDown={(event) => event.preventDefault()} onClick={() => {
              setRecentSearches([]);
              localStorage.removeItem(brandedStorageKey("recent-searches"));
            }}>清空</button></div>
            {recentSearches.map((item) => (
              <button key={item} onMouseDown={(event) => event.preventDefault()} onClick={() => setSearch(item)}>
                <History size={14} />{item}
              </button>
            ))}
          </div>
        ) : null}
        <UnifiedNoteListFilter
          open={filterOpen}
          active={sourceFilter !== UNIFIED_NOTE_FILTER_ALL
            || statusFilter !== "all"
            || topicFilter !== UNIFIED_NOTE_FILTER_ALL
            || Boolean(dateFrom)
            || Boolean(dateTo)}
          onOpenChange={setFilterOpen}
          onReset={() => {
            setSourceFilter(UNIFIED_NOTE_FILTER_ALL);
            setStatusFilter("all");
            setTopicFilter(UNIFIED_NOTE_FILTER_ALL);
            setDateFrom("");
            setDateTo("");
          }}
          fields={[
            createUnifiedNoteSourceFilterField({
              value: sourceFilter,
              sourceValues: records.map(recordSourceLabel),
              onChange: setSourceFilter,
            }),
            createUnifiedNoteStatusFilterField({
              value: statusFilter,
              onChange: setStatusFilter,
            }),
            createUnifiedNoteTopicFilterField({
              value: topicFilter,
              topicValues,
              onChange: setTopicFilter,
            }),
            ...createUnifiedNoteDateFilterFields({
              dateFrom,
              dateTo,
              onDateFromChange: setDateFrom,
              onDateToChange: setDateTo,
            }),
          ]}
        />
      </UnifiedNoteListSearchRow>
      <UnifiedNoteListDisplayToolbar
        label={scopeLabel}
        count={filtered.length}
        countLabel="条记录"
        compactMode={compactMode}
        sortMode={sortMode}
        onToggleCompact={() => setCompactMode((value) => !value)}
        onCycleSort={() => setSortMode(cycleUnifiedNoteListSortMode)}
      />
      {filtered.length ? (
        <UnifiedNoteListLocator
          aria-label="快速定位记录"
          count={filtered.length}
          value={locatorIndex}
          currentIndex={selectedIndex}
          itemLabel="记录"
          onLocate={scrollToRecord}
        />
      ) : null}

      <div className="records-list" ref={listRef}>
        {filtered.length ? pagedRecords.map((record) => {
          const selected = record.id === selectedId;
          const displayTitle = recordDisplayTitle(record);
          return (
            <UnifiedNoteListCard
              key={record.id}
              className="record-card"
              compact={compactMode}
              selected={selected}
              menuOpen={openMenuId === record.id}
              onSelect={() => {
                onSelect(record.id);
                setOpenMenuId(null);
              }}
              cardRef={selected ? selectedCardRef : undefined}
              recordId={record.id}
              iconKey={resolveNoteIconKey(
                displayTitle,
                recordTopicLabel(record),
                record.tags.join(" "),
                record.summary,
                recordSourceLabel(record),
              )}
              title={<HighlightedText text={displayTitle} query={deferredSearch} />}
              theme={recordTopicLabel(record)}
              source={
                  <HighlightedText
                    text={deferredSearch
                      ? record.searchSnippet || recordSourceLabel(record)
                      : recordSourceLabel(record)}
                    query={deferredSearch}
                  />
              }
              date={record.originalAt ?? record.updatedAt}
              actions={
                <NoteListActions
                  isFavorite={record.isFavorite}
                  menuOpen={openMenuId === record.id}
                  onToggleFavorite={() => onToggleFavorite(record.id)}
                  onExport={() => onShare(record.id)}
                  onToggleMenu={() => setOpenMenuId((id) => id === record.id ? null : record.id)}
                >
                    <button type="button" role="menuitem" onClick={() => {
                      setOpenMenuId(null);
                      onViewDetails(record.id);
                    }}><Maximize2 size={15} />查看详情</button>
                    <button type="button" role="menuitem" onClick={() => {
                      onUpdateStatus(record.id, record.status === "tracking" ? "normal" : "tracking");
                      setOpenMenuId(null);
                    }}>
                      <RadioTower size={15} />
                      {record.status === "tracking" ? "停止持续跟踪" : "加入持续跟踪"}
                    </button>
                    <button type="button" role="menuitem" onClick={() => void copyRecordTitle(record)}>
                      <Copy size={15} />复制标题
                    </button>
                    <button type="button" role="menuitem" className="danger" onClick={() => {
                      onMoveToTrash(record.id);
                      setOpenMenuId(null);
                    }}><Trash2 size={15} />移至回收站</button>
                </NoteListActions>
              }
            />
          );
        }) : (
          <div className="empty-state">
            <Search size={30} />
            <strong>没有找到相关记录</strong>
            <span>换一个关键词，或清除当前搜索。</span>
            <button className="text-button" onClick={() => setSearch("")}>清除搜索</button>
          </div>
        )}
        {filtered.length > pagedRecords.length ? (
          <button className="load-more-records" onClick={() => setVisibleLimit((limit) => limit + 80)}>
            加载更多（剩余 {filtered.length - pagedRecords.length} 条）
          </button>
        ) : filtered.length > 0 ? <div className="list-end"><span />没有更多了<span /></div> : null}
      </div>
    </UnifiedNoteListPanel>
  );
}

function SemanticCard({
  id,
  title,
  count,
  tone,
  icon: Icon,
  collapsed,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  count: number;
  tone: string;
  icon: React.ComponentType<{ size?: number }>;
  collapsed: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <AppCard className={`semantic-card tone-${tone} ${collapsed ? "collapsed" : ""}`}>
      <button className="semantic-heading" onClick={() => onToggle(id)} aria-expanded={!collapsed}>
        <span className="semantic-title"><Icon size={20} /><strong>{title}</strong><em>{count}</em></span>
        <ChevronRight size={19} className="collapse-icon" />
      </button>
      <div className="semantic-content">{children}</div>
    </AppCard>
  );
}

function ConversationMessage({
  message,
  attachments,
  compact = false,
  onOpenAttachment,
  onAddAttachment,
}: {
  message: ReadableSourceMessage;
  attachments: AttachmentItem[];
  compact?: boolean;
  onOpenAttachment: (attachment: AttachmentItem) => void;
  onAddAttachment: () => void;
}) {
  const attachmentIndex = useMemo(() => {
    const index = new Map<string, AttachmentItem>();
    const add = (key: string | null | undefined, item: AttachmentItem) => {
      const normalized = key
        ?.trim()
        .replace(/^[a-z-]+:\/\//i, "")
        .replace(/\.dat$/i, "")
        .toLocaleLowerCase();
      if (normalized) index.set(normalized, item);
    };
    attachments.forEach((item) => {
      add(item.fileName, item);
      add(item.originalPath?.split("#").at(-1), item);
      add(item.storedPath.split(/[\\/]/).at(-1)?.split("__")[0], item);
    });
    return index;
  }, [attachments]);

  return (
    <ReadableMessageContent
      message={message}
      compact={compact}
      className={compact ? "right-reading-copy right-reading-copy-12" : undefined}
    >
      {message.assets.length ? (
        <div className="source-assets">
          {message.assets.map((asset, index) => {
            const attachment = (asset.fileUuid
              ? attachmentIndex.get(
                asset.fileUuid
                  .replace(/^[a-z-]+:\/\//i, "")
                  .replace(/\.dat$/i, "")
                  .toLocaleLowerCase(),
              )
              : undefined)
              ?? attachmentIndex.get(asset.fileName.trim().toLocaleLowerCase());
            const key = asset.fileUuid ?? `${asset.fileName}-${index}`;
            if (asset.kind === "image" && attachment) {
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
            if (asset.kind === "image") {
              return (
                <button
                  className="source-image-placeholder"
                  key={key}
                  onClick={onAddAttachment}
                  title="添加同名原图后会自动显示"
                >
                  <ImageIcon size={20} />
                  <span><strong>{asset.fileName}</strong><em>原图待关联 · 点击添加</em></span>
                </button>
              );
            }
            return attachment ? (
              <button
                className="source-file-chip"
                key={key}
                onClick={() => onOpenAttachment(attachment)}
                title={`软件内预览附件：${asset.fileName}`}
              >
                <Paperclip size={16} /><span>{asset.fileName}</span>
              </button>
            ) : (
              <button
                className="source-file-chip unresolved"
                key={key}
                onClick={onAddAttachment}
                title="添加同名文件后会自动关联"
              >
                <Paperclip size={16} /><span>{asset.fileName} · 待关联</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </ReadableMessageContent>
  );
}

function DetailPanel({
  record,
  attachments,
  versions,
  onJudgmentChange,
  onAppendVersion,
  onRestoreVersion,
  onDeleteVersion,
  onEditRecord,
  isEditing,
  setIsEditing,
  saveState,
  onToggleFavorite,
  onNotify,
  onAddAttachment,
  attachmentBusy,
  onOpenAttachment,
  onRemoveAttachment,
  sourceOpenRequest,
}: {
  record: IntelligenceRecord;
  attachments: AttachmentItem[];
  versions: RecordVersion[];
  onJudgmentChange: (value: string) => void;
  onAppendVersion: () => Promise<void>;
  onRestoreVersion: (versionId: number) => Promise<void>;
  onDeleteVersion: (versionId: number) => Promise<void>;
  onEditRecord: () => void;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  saveState: SaveState;
  onToggleFavorite: () => void;
  onNotify: Notify;
  onAddAttachment: () => void;
  attachmentBusy: boolean;
  onOpenAttachment: (attachment: AttachmentItem) => void;
  onRemoveAttachment: (attachmentId: number) => void;
  sourceOpenRequest: number;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versionAdded, setVersionAdded] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"facts" | "evidence" | "questions" | "actions" | null>(null);
  const [viewingVersion, setViewingVersion] = useState<RecordVersion | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const importedContent = useMemo(() => readImportedContent(record.sourceText), [record.sourceText]);
  const displayTitle = useMemo(
    () => resolveImportedTitle(record.title, record.sourceText),
    [record.sourceText, record.title],
  );
  const showSummary = useMemo(() => shouldDisplaySummary(record.summary), [record.summary]);
  const viewingVersionDifferences = useMemo(
    () => viewingVersion ? versionDifferences(record, viewingVersion.snapshot) : [],
    [record, viewingVersion],
  );

  useEffect(() => {
    setExpandedSection(null);
    setViewingVersion(null);
    setSourceOpen(false);
  }, [record.id]);

  useEffect(() => {
    if (sourceOpenRequest > 0) setSourceOpen(true);
  }, [sourceOpenRequest]);

  const toggle = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateJudgment = (value: string) => {
    onJudgmentChange(value);
  };

  const addVersion = async () => {
    try {
      await onAppendVersion();
      setVersionAdded(true);
      setHistoryOpen(true);
      onNotify("已创建新的正式版本快照");
      window.setTimeout(() => setVersionAdded(false), 2200);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "创建版本失败");
    }
  };

  const expandedContent = expandedSection ? {
    facts: { eyebrow: "结构化详情", title: "全部已确认事实", items: record.confirmedFacts },
    evidence: { eyebrow: "来源与证据", title: "全部关键证据", items: record.keyEvidence.map((item) => `${item.content} · ${item.source}`) },
    questions: { eyebrow: "后续验证", title: "全部待验证问题", items: record.openQuestions },
    actions: { eyebrow: "执行清单", title: "全部下一步行动", items: record.nextActions },
  }[expandedSection] : null;

  return (
    <article className="detail-panel elevated-card association-link-target" tabIndex={-1}>
      <div className="detail-title-row">
        <div>
          <h1>{displayTitle}</h1>
          <div className="detail-meta">
            <span className="status-pill">{statusLabel(record.status)}</span>
            {record.originalAt ? <span>{formatRecordDateTime(record.originalAt)} 原始日期</span> : null}
            <span>{formatRecordDateTime(record.updatedAt)} 更新</span>
            <span>{recordSourceLabel(record)}</span>
            {record.tags.map((tag) => <span className="detail-tag" key={tag}>{tag}</span>)}
          </div>
        </div>
        <div className="detail-title-actions">
          <button
            className={`favorite-button ${record.isFavorite ? "active" : ""}`}
            aria-label={record.isFavorite ? "取消收藏" : "收藏"}
            onClick={onToggleFavorite}
          >
            <Star size={20} fill={record.isFavorite ? "currentColor" : "none"} />
          </button>
          <button className="favorite-button" aria-label="编辑记录" onClick={onEditRecord}>
            <Pencil size={19} />
          </button>
        </div>
      </div>

      <AppCard className={`record-content-card ${importedContent.fullText.length > 700 ? "page-sized" : ""}`}>
        <div className="record-content-heading">
          <span><FileText size={19} /><strong>记录内容</strong></span>
          <div className="record-content-tools">
            <em>
              {importedContent.isConversation
                ? `${importedContent.messageCount} 条对话消息`
                : record.sourceText
                  ? "原始内容"
                  : showSummary
                    ? "摘要"
                    : "暂无内容"}
            </em>
            {importedContent.fullText ? (
              <button className="content-expand-button" onClick={() => setSourceOpen(true)}>
                <Maximize2 size={15} />查看完整内容
              </button>
            ) : null}
          </div>
        </div>
        {showSummary ? (
          <div className="record-summary-block">
            <strong>内容摘要</strong>
            <MarkdownContent value={record.summary} className="right-reading-copy right-reading-copy-12" />
          </div>
        ) : null}
        {importedContent.previewMessages.length ? (
          <div className="source-preview-block">
            <strong>对话原文</strong>
            <div className="conversation-preview-list">
              {importedContent.previewMessages.map((message, index) => (
                <ConversationMessage
                  key={`${message.role}-${message.createdAt ?? index}-${index}`}
                  message={message}
                  attachments={attachments}
                  compact
                  onOpenAttachment={onOpenAttachment}
                  onAddAttachment={onAddAttachment}
                />
              ))}
            </div>
          </div>
        ) : importedContent.preview ? (
          <div className="source-preview-block">
            <strong>原始内容</strong>
            <MarkdownContent
              value={importedContent.preview}
              className="source-preview-markdown right-reading-copy right-reading-copy-12"
            />
          </div>
        ) : null}
        {!showSummary && !importedContent.preview ? (
          <p className="record-content-empty">这条记录尚未填写摘要或原始内容。</p>
        ) : null}
        {importedContent.fullText ? (
          <div className="record-content-endcap">
            <span>当前显示一页预览</span>
            <button className="record-content-action" onClick={() => setSourceOpen(true)}>
              继续阅读完整内容 <ArrowRight size={15} />
            </button>
          </div>
        ) : null}
      </AppCard>

      <AppCard className="attachments-card">
        <div className="record-content-heading">
          <span><Paperclip size={19} /><strong>附件</strong></span>
          <button className="text-button" onClick={onAddAttachment} disabled={attachmentBusy}>
            {attachmentBusy ? <span className="save-spinner" /> : <Plus size={15} />}
            {attachmentBusy ? "后台归档中…" : "添加附件"}
          </button>
        </div>
        <div className="attachment-list">
          {attachments.map((attachment) => (
            <div className="attachment-row" key={attachment.id}>
              <FileText size={17} />
              <button onClick={() => onOpenAttachment(attachment)}>
                <strong>{attachment.fileName}</strong>
                <span>{formatFileSize(attachment.sizeBytes)} · {formatRecordDateTime(attachment.createdAt)}</span>
              </button>
              <button className="icon-button danger" aria-label={`删除附件 ${attachment.fileName}`} onClick={() => {
                if (window.confirm(`确认从受控附件目录删除“${attachment.fileName}”吗？`)) {
                  onRemoveAttachment(attachment.id);
                }
              }}><Trash2 size={16} /></button>
            </div>
          ))}
          {!attachments.length ? <p className="record-content-empty">尚未添加附件；原始导入文件仍保存在导入归档目录。</p> : null}
        </div>
      </AppCard>

      <AppCard className={`judgment-card ${isEditing ? "editing" : ""}`} onDoubleClick={() => setIsEditing(true)}>
        <div className="judgment-accent" />
        <div className="judgment-top">
          <div className="judgment-heading"><Sparkles size={21} /><strong>当前判断</strong></div>
          <div className="primary-actions">
            <button onClick={() => setIsEditing(!isEditing)}><Pencil size={18} />{isEditing ? "完成" : "编辑"}</button>
            <span />
            <button onClick={() => void addVersion()}><Plus size={18} />追加版本</button>
          </div>
        </div>
        {isEditing ? (
          <div className="edit-area">
            <textarea
              value={record.currentJudgment}
              onChange={(event) => updateJudgment(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  setIsEditing(false);
                  onNotify("当前判断已完成编辑");
                }
              }}
              autoFocus
            />
            <div className="edit-footer">
              <span><Keyboard size={14} /> Ctrl + Enter 完成编辑</span>
              <span className={saveState}>
                {saveState === "saving"
                  ? "正在保存草稿…"
                  : saveState === "error"
                    ? "保存失败，草稿仍保留在本机"
                    : saveState === "draft"
                      ? "已恢复异常退出前的本地草稿"
                      : "本地草稿已保存"}
              </span>
            </div>
          </div>
        ) : (
          <div className="judgment-text">
            <MarkdownContent value={record.currentJudgment || "尚未填写当前判断。"} />
          </div>
        )}
        <ul className="judgment-points">
          {(record.confirmedFacts.length ? record.confirmedFacts : ["暂无结构化事实，可在记录编辑中补充。"])
            .slice(0, 3)
            .map((item) => <li key={item}>{item}</li>)}
        </ul>
        <div className="judgment-footer"><span>本地版本：v{record.versionCount}</span><span>更新于 {formatRecordDateTime(record.updatedAt)}</span></div>
      </AppCard>

      <div className="semantic-grid">
        <SemanticCard id="facts" title="已确认事实" count={record.confirmedFacts.length} tone="green" icon={ShieldCheck} collapsed={collapsed.has("facts")} onToggle={toggle}>
          <ul>{record.confirmedFacts.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
          <button className="card-link" onClick={() => setExpandedSection("facts")}>查看全部事实 <ArrowRight size={15} /></button>
        </SemanticCard>
        <SemanticCard id="evidence" title="关键证据" count={record.keyEvidence.length} tone="blue" icon={Folder} collapsed={collapsed.has("evidence")} onToggle={toggle}>
          <div className="evidence-list">{record.keyEvidence.slice(0, 3).map((item) => (
            <div key={`${item.content}-${item.source}`}><FileText size={16} /><span>{item.content}</span><em>{item.source}</em></div>
          ))}</div>
          <button className="card-link" onClick={() => setExpandedSection("evidence")}>查看全部证据 <ArrowRight size={15} /></button>
        </SemanticCard>
        <SemanticCard id="questions" title="待验证问题" count={record.openQuestions.length} tone="orange" icon={CircleHelp} collapsed={collapsed.has("questions")} onToggle={toggle}>
          <ul>{record.openQuestions.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
          <button className="card-link" onClick={() => setExpandedSection("questions")}>查看全部问题 <ArrowRight size={15} /></button>
        </SemanticCard>
        <SemanticCard id="actions" title="下一步行动" count={record.nextActions.length} tone="indigo" icon={ArrowRight} collapsed={collapsed.has("actions")} onToggle={toggle}>
          <div className="check-list">{record.nextActions.slice(0, 3).map((item) => <div key={item}><span className="action-marker"><ArrowRight size={11} /></span><span>{item}</span></div>)}</div>
          <button className="card-link" onClick={() => setExpandedSection("actions")}>查看全部行动 <ArrowRight size={15} /></button>
        </SemanticCard>
      </div>

      <AppCard className={`history-card ${historyOpen ? "open" : ""}`}>
        <button className="history-heading" onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}>
          <span><History size={20} /><strong>历史版本</strong><em>{versions.length + (versionAdded ? 1 : 0)}</em></span>
          <ChevronRight size={19} />
        </button>
        <div className="history-content">
          {versionAdded ? <div className="version-success"><Check size={16} /> 已创建新的正式版本快照</div> : null}
          {versions.map((item) => (
            <div
              className="version-row"
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => setViewingVersion(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setViewingVersion(item);
              }}
            >
              <span className="version-badge">v{item.versionNumber}</span>
              <div><strong>{item.versionTitle}</strong><span>{formatRecordDateTime(item.createdAt)}</span></div>
              <button
                className="icon-button danger"
                title="删除这个历史快照"
                aria-label={`删除历史版本 v${item.versionNumber}`}
                onClick={(event) => {
                  event.stopPropagation();
                  if (window.confirm(`确认删除历史版本 v${item.versionNumber}？当前记录不会被删除。`)) {
                    void onDeleteVersion(item.id).catch((error) =>
                      onNotify(error instanceof Error ? error.message : "删除历史版本失败"));
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </AppCard>
      {expandedContent ? (
        <PrototypeDialog eyebrow={expandedContent.eyebrow} title={expandedContent.title} onClose={() => setExpandedSection(null)}>
          <ul className="dialog-list">
            {expandedContent.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <div className="dialog-footnote">内容来自当前本地记录，版本与修改均保存在本机数据库。</div>
        </PrototypeDialog>
      ) : null}
      {viewingVersion ? (
        <PrototypeDialog eyebrow={`历史快照 · v${viewingVersion.versionNumber}`} title={viewingVersion.versionTitle} onClose={() => setViewingVersion(null)}>
          <div className="version-preview">
            <span>{formatRecordDateTime(viewingVersion.createdAt)}</span>
            <p>{viewingVersion.snapshot.currentJudgment || "该版本没有当前判断。"}</p>
            <em>{viewingVersion.changeNote || "只读版本预览，不会自动覆盖当前判断。"}</em>
            <div className="version-diff">
              <strong>与当前记录的差异</strong>
              {viewingVersionDifferences.length ? viewingVersionDifferences.map((difference) => (
                <div className="version-diff-row" key={difference.label}>
                  <span>{difference.label}</span>
                  <div><em>历史</em><p>{difference.previous}</p></div>
                  <div><em>当前</em><p>{difference.current}</p></div>
                </div>
              )) : <p className="version-diff-empty">当前记录与该历史快照没有字段差异。</p>}
            </div>
            <button className="secondary-button" onClick={async () => {
              await onRestoreVersion(viewingVersion.id);
              setViewingVersion(null);
            }}><RotateCcw size={17} />恢复为新版本</button>
          </div>
        </PrototypeDialog>
      ) : null}
      {sourceOpen ? (
        <PrototypeDialog
          eyebrow={importedContent.isConversation ? "导入会话原文" : "记录原始内容"}
          title={displayTitle}
          onClose={() => setSourceOpen(false)}
          className="source-content-dialog"
        >
          <div className="source-content-body">
            {showSummary ? (
              <section className="source-summary">
                <strong>内容摘要</strong>
                <MarkdownContent value={record.summary} />
              </section>
            ) : null}
            {importedContent.messages.length ? importedContent.messages.map((message, index) => (
              <ConversationMessage
                key={`${message.role}-${message.createdAt ?? index}-${index}`}
                message={message}
                attachments={attachments}
                onOpenAttachment={onOpenAttachment}
                onAddAttachment={onAddAttachment}
              />
            )) : (
              <MarkdownContent value={importedContent.fullText} className="source-plain-text" />
            )}
          </div>
        </PrototypeDialog>
      ) : null}
    </article>
  );
}

const MemoDetailPanel = memo(DetailPanel);

function RecordsWorkspace({
  records,
  topicValues,
  detailRecord,
  attachments,
  scope,
  selectedId,
  setSelectedId,
  search,
  setSearch,
  versions,
  onJudgmentChange,
  onToggleFavorite,
  onUpdateStatus,
  onMoveToTrash,
  onShare,
  onAppendVersion,
  onRestoreVersion,
  onDeleteVersion,
  onEditRecord,
  isEditing,
  setIsEditing,
  saveState,
  onNotify,
  onAddAttachment,
  attachmentBusy,
  onOpenAttachment,
  onRemoveAttachment,
}: {
  records: RecordSummary[];
  topicValues: string[];
  detailRecord: IntelligenceRecord | null;
  attachments: AttachmentItem[];
  scope: "records" | "favorites" | "tracking" | "updates";
  selectedId: number | null;
  setSelectedId: (value: number | null) => void;
  search: string;
  setSearch: (value: string) => void;
  versions: RecordVersion[];
  onJudgmentChange: (value: string) => void;
  onToggleFavorite: (id: number) => void;
  onUpdateStatus: (id: number, status: RecordStatus) => void;
  onMoveToTrash: (id: number) => void;
  onShare: (id: number) => void;
  onAppendVersion: () => Promise<void>;
  onRestoreVersion: (versionId: number) => Promise<void>;
  onDeleteVersion: (versionId: number) => Promise<void>;
  onEditRecord: (record: IntelligenceRecord) => void;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  saveState: SaveState;
  onNotify: Notify;
  onAddAttachment: () => void;
  attachmentBusy: boolean;
  onOpenAttachment: (attachment: AttachmentItem) => void;
  onRemoveAttachment: (attachmentId: number) => void;
}) {
  const [connectionMetrics, setConnectionMetrics] = useState<ConnectionMetrics | null>(null);
  const [sourceOpenRequest, setSourceOpenRequest] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedSummary = records.find((record) => record.id === selectedId) ?? null;
  const handleConnectionMetricsChange = useCallback((next: ConnectionMetrics | null) => {
    setConnectionMetrics((current) => connectorMetricsEqual(current, next) ? current : next);
  }, []);
  const handleEditSelectedRecord = useCallback(() => {
    if (detailRecord) onEditRecord(detailRecord);
  }, [detailRecord, onEditRecord]);
  const handleToggleSelectedFavorite = useCallback(() => {
    if (detailRecord) onToggleFavorite(detailRecord.id);
  }, [detailRecord, onToggleFavorite]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        setIsEditing(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setIsEditing]);

  return (
    <div
      className={`records-workspace ${scope === "records" ? "" : "record-subview-workspace"}`}
      data-record-scope={scope}
      style={connectionMetrics ? {
        "--connection-left": `${connectionMetrics.left}px`,
        "--connection-top": `${connectionMetrics.top}px`,
        "--connection-width": `${connectionMetrics.width}px`,
        "--connection-opacity": connectionMetrics.opacity,
      } as React.CSSProperties : undefined}
    >
      <RecordList
        records={records}
        topicValues={topicValues}
        scope={scope}
        selectedId={selectedId}
        onSelect={setSelectedId}
        search={search}
        setSearch={setSearch}
        searchRef={searchRef}
        onSelectedGeometryChange={handleConnectionMetricsChange}
        onToggleFavorite={onToggleFavorite}
        onUpdateStatus={onUpdateStatus}
        onMoveToTrash={onMoveToTrash}
        onShare={onShare}
        onViewDetails={(id) => {
          setSelectedId(id);
          setSourceOpenRequest(Date.now());
        }}
        onNotify={onNotify}
      />
      {connectionMetrics && connectionMetrics.width > 0 ? (
        <div className="record-detail-connector" aria-hidden="true">
          <span className="connector-dot start" />
          <span className="connector-dot end" />
        </div>
      ) : null}
      {selectedSummary && detailRecord?.id === selectedSummary.id ? (
        <MemoDetailPanel
          record={detailRecord}
          attachments={attachments}
          versions={versions}
          onJudgmentChange={onJudgmentChange}
          onAppendVersion={onAppendVersion}
          onRestoreVersion={onRestoreVersion}
          onDeleteVersion={onDeleteVersion}
          onEditRecord={handleEditSelectedRecord}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          saveState={saveState}
          onToggleFavorite={handleToggleSelectedFavorite}
          onNotify={onNotify}
          onAddAttachment={onAddAttachment}
          attachmentBusy={attachmentBusy}
          onOpenAttachment={onOpenAttachment}
          onRemoveAttachment={onRemoveAttachment}
          sourceOpenRequest={sourceOpenRequest}
        />
      ) : (
        <article className={`detail-panel elevated-card empty-detail ${selectedSummary ? "association-link-target" : ""}`}>
          {selectedSummary ? <span className="save-spinner" /> : <FileText size={36} />}
          <strong>{selectedSummary ? "正在读取记录详情" : "还没有可显示的记录"}</strong>
          <span>{selectedSummary ? "列表保持可操作，长正文会按需加载。" : "新建一条记录，或调整左侧的筛选条件。"}</span>
        </article>
      )}
    </div>
  );
}

function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-title">
      <div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {action}
    </header>
  );
}

function ExportCenter({
  repository,
  selectedRecordId,
  currentSearch,
  onNotify,
}: {
  repository: RecordRepository;
  selectedRecordId: number | null;
  currentSearch: string;
  onNotify: Notify;
}) {
  const [scope, setScope] = useState<"all" | "current" | "favorites" | "filtered" | "manual">("all");
  const [format, setFormat] = useState<"json" | "md" | "vault">("vault");
  const [status, setStatus] = useState<"all" | RecordStatus>("all");
  const [tag, setTag] = useState("");
  const [source, setSource] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [includeVersions, setIncludeVersions] = useState(true);
  const [includeOriginalFiles, setIncludeOriginalFiles] = useState(false);
  const [exporting, setExporting] = useState(false);

  const query = useMemo<RecordQuery>(() => ({
    search: scope === "filtered" ? currentSearch || undefined : undefined,
    favoritesOnly: scope === "favorites",
    status: status === "all" ? undefined : status,
    tag: tag || undefined,
    source: source || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [currentSearch, dateFrom, dateTo, scope, source, status, tag]);

  useEffect(() => {
    void repository.listRecordSummaries(query)
      .then(setRecords)
      .catch((error) => onNotify(error instanceof Error ? error.message : "读取导出范围失败"));
  }, [query, repository]);

  const effectiveIds = scope === "current"
    ? selectedRecordId === null ? [] : [selectedRecordId]
    : scope === "manual"
      ? [...selectedIds]
      : [];
  const estimatedCount = effectiveIds.length || records.length;

  return (
    <div className="export-center">
      <div className="export-grid">
        <AppCard className="export-options-card">
          <div className="record-content-heading"><span><FolderOpen size={19} /><strong>导出范围</strong></span><em>{estimatedCount} 条</em></div>
          <div className="export-scope-grid">
            {([
              ["all", "全部记录"],
              ["current", "当前记录"],
              ["favorites", "我的收藏"],
              ["filtered", "当前搜索 / 筛选结果"],
              ["manual", "手动多选"],
            ] as const).map(([value, label]) => (
              <button key={value} className={scope === value ? "active" : ""} onClick={() => setScope(value)}>
                {label}
              </button>
            ))}
          </div>
          <div className="export-filter-grid">
            <label><span>状态</span><select value={status} onChange={(event) => setStatus(event.target.value as "all" | RecordStatus)}>
              <option value="all">全部状态</option>
              <option value="normal">普通记录</option><option value="tracking">持续跟踪</option>
              <option value="verification">待验证</option><option value="updated">判断更新</option>
            </select></label>
            <label><span>标签</span><input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="留空为全部" /></label>
            <label><span>来源</span><input value={source} onChange={(event) => setSource(event.target.value)} placeholder="来源名称或类型" /></label>
            <label><span>起始日期</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
            <label><span>结束日期</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
          </div>
          {scope === "manual" ? (
            <div className="export-record-picker">
              {records.map((record) => (
                <label key={record.id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(record.id)}
                    onChange={(event) => setSelectedIds((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(record.id);
                      else next.delete(record.id);
                      return next;
                    })}
                  />
                  <span>{record.displayTitle}</span><em>{formatRecordDate(record.originalAt ?? record.updatedAt)}</em>
                </label>
              ))}
            </div>
          ) : null}
        </AppCard>
        <AppCard className="export-options-card">
          <div className="record-content-heading"><span><FileText size={19} /><strong>格式与内容</strong></span></div>
          <div className="export-format-grid">
            <button className={format === "vault" ? "active" : ""} onClick={() => setFormat("vault")}><Database size={20} />Obsidian Vault<em>推荐用于 Codex 二次整理</em></button>
            <button className={format === "md" ? "active" : ""} onClick={() => setFormat("md")}><FileText size={20} />Markdown 文件夹</button>
            <button className={format === "json" ? "active" : ""} onClick={() => setFormat("json")}><FileJson2 size={20} />JSON 数据</button>
          </div>
          <div className="export-checkboxes">
            <label><input type="checkbox" checked={includeAttachments} onChange={(event) => setIncludeAttachments(event.target.checked)} />包含受控附件</label>
            <label><input type="checkbox" checked={includeVersions} onChange={(event) => setIncludeVersions(event.target.checked)} />包含历史版本</label>
            <label><input type="checkbox" checked={includeOriginalFiles} onChange={(event) => setIncludeOriginalFiles(event.target.checked)} />包含导入原文件</label>
          </div>
          <div className="export-preview">
            <span>预计导出</span><strong>{estimatedCount} 条记录</strong>
            <em>{format === "vault" ? "一条记录一个 Markdown，含 YAML、相对附件和 Obsidian 配置" : format === "md" ? "一条记录一个 Markdown" : "单个结构化 JSON 文件"}</em>
          </div>
          <button
            className="primary-button full"
            disabled={exporting || estimatedCount === 0}
            onClick={async () => {
              setExporting(true);
              try {
                const result = await repository.exportRecords({
                  recordIds: effectiveIds,
                  query,
                  format,
                  includeAttachments,
                  includeVersions,
                  includeOriginalFiles,
                });
                onNotify(`已导出 ${result.recordCount} 条记录：${result.filePath}`);
              } catch (error) {
                onNotify(error instanceof Error ? error.message : "导出失败");
              } finally {
                setExporting(false);
              }
            }}
          >
            <FolderOpen size={18} />{exporting ? "正在生成…" : "开始导出"}
          </button>
        </AppCard>
      </div>
      <AppCard className="codex-vault-note">
        <Sparkles size={21} />
        <div><strong>Codex + Obsidian 工作流</strong><span>Vault 使用稳定记录 ID、YAML 元数据和相对附件。建议先导出到独立目录，让 Codex 在副本或 Git 分支整理，再作为新版本导回；应用不会直接让模型覆盖数据库。</span></div>
      </AppCard>
    </div>
  );
}

function ImportCenter({
  step,
  setStep,
  repository,
  onImported,
  onNotify,
  selectedRecordId,
  currentSearch,
  onBackToSettings,
}: {
  step: ImportStep;
  setStep: (step: ImportStep) => void;
  repository: RecordRepository;
  onImported: (recordId?: number) => Promise<void>;
  onNotify: Notify;
  selectedRecordId: number | null;
  currentSearch: string;
  onBackToSettings: () => void;
}) {
  const [mode, setMode] = useState<"import" | "export">("import");
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [queue, setQueue] = useState<ImportQueueItem[]>([]);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [batchImporting, setBatchImporting] = useState(false);
  const [error, setError] = useState("");
  const [importJobs, setImportJobs] = useState<ImportJobSummary[]>([]);
  const preparingBatchRef = useRef(false);
  const knownPathsRef = useRef(new Set<string>());

  const refreshImportJobs = () => {
    void repository.listImportJobs()
      .then(setImportJobs)
      .catch((jobError) =>
        onNotify(jobError instanceof Error ? jobError.message : "读取导入日志失败"));
  };

  useEffect(refreshImportJobs, [repository]);

  const updateQueueItem = useCallback((nextItem: ImportQueueItem) => {
    setQueue((current) =>
      current.map((item) => item.id === nextItem.id ? nextItem : item));
  }, []);

  const enqueuePaths = useCallback(async (paths: string[]) => {
    if (preparingBatchRef.current) {
      onNotify("上一批文件仍在归档和识别，请稍后再添加");
      return;
    }
    const remainingCapacity = Math.max(0, 100 - knownPathsRef.current.size);
    const limitedPaths = paths.slice(0, remainingCapacity);
    const items = createImportQueueItems(limitedPaths, [...knownPathsRef.current]);
    if (!items.length) {
      onNotify(remainingCapacity ? "这些文件已在导入队列中" : "导入队列最多保留 100 个文件");
      return;
    }
    items.forEach((item) => knownPathsRef.current.add(
      item.sourcePath.replace(/\//g, "\\").toLocaleLowerCase(),
    ));
    setQueue((current) => [...current, ...items]);
    preparingBatchRef.current = true;
    setLoading(true);
    setError("");
    try {
      const results = await prepareImportQueue(
        items,
        (path) => repository.prepareImport(path),
        updateQueueItem,
      );
      const readyCount = results.filter((item) => item.status === "ready").length;
      const failedCount = results.filter((item) => item.status === "error").length;
      const firstReady = results.find((item) => item.status === "ready" && item.preview);
      if (firstReady?.preview && !preview) {
        setActiveQueueId(firstReady.id);
        setPreview(firstReady.preview);
        setStep("preview");
      }
      onNotify(
        failedCount
          ? `批量识别完成：${readyCount} 个可导入，${failedCount} 个失败`
          : `已归档并识别 ${readyCount} 个文件`,
        { durationMs: 5_500 },
      );
    } finally {
      setLoading(false);
      setDragActive(false);
      preparingBatchRef.current = false;
    }
  }, [onNotify, preview, repository, setStep, updateQueueItem]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let unlisten: (() => void) | undefined;
    void getCurrentWebview().onDragDropEvent((event) => {
      if (mode !== "import") return;
      if (event.payload.type === "enter" || event.payload.type === "over") {
        setDragActive(true);
      } else if (event.payload.type === "leave") {
        setDragActive(false);
      } else if (event.payload.type === "drop") {
        setDragActive(false);
        if (event.payload.paths.length) void enqueuePaths(event.payload.paths);
      }
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => unlisten?.();
  }, [enqueuePaths, mode]);

  const loadDemo = () => {
    const demoRecord = {
      title: "AI资本开支与自由现金流",
      summary: "AI基础设施投入短期压制自由现金流",
      status: "tracking" as const,
      tags: ["资本开支", "自由现金流", "云计算"],
      currentJudgment: "短期现金流承压，但长期回报取决于商业化效率。",
      confirmedFacts: [],
      keyEvidence: [],
      openQuestions: [],
      nextActions: [],
      notes: "",
      sourceText: sampleJson,
      sources: [],
      isFavorite: false,
    };
    const demoPreview: ImportPreview = {
      jobId: "browser-demo",
      sourceFileName: "ai-capex-research.json",
      storedFilePath: "浏览器演示不写入文件",
      sha256: "demo",
      fileKind: "json",
      sizeBytes: new Blob([sampleJson]).size,
      duplicate: false,
      rawPreview: sampleJson,
      recordCount: 1,
      records: [demoRecord],
      boundaryOptions: [],
      duplicateCandidates: [],
      warnings: ["浏览器模式仅演示映射；Tauri 桌面版会先归档原文件"],
    };
    const demoItem: ImportQueueItem = {
      id: "browser-demo",
      sourcePath: "browser-demo://ai-capex-research.json",
      fileName: demoPreview.sourceFileName,
      status: "ready",
      preview: demoPreview,
    };
    setQueue([demoItem]);
    setActiveQueueId(demoItem.id);
    setPreview(demoPreview);
    setStep("preview");
  };

  const chooseFile = async () => {
    if (!("__TAURI_INTERNALS__" in window)) {
      loadDemo();
      return;
    }
    const selected = await openFileDialog({
      multiple: true,
      directory: false,
      filters: [{
        name: "知识库资料与 ChatGPT 完整导出",
        extensions: ["zip", "json", "md", "markdown", "txt", "html", "htm"],
      }],
    });
    const paths = Array.isArray(selected) ? selected : typeof selected === "string" ? [selected] : [];
    if (paths.length) await enqueuePaths(paths);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (!("__TAURI_INTERNALS__" in window)) loadDemo();
  };

  const selectQueueItem = (item: ImportQueueItem) => {
    setActiveQueueId(item.id);
    setPreview(item.preview ?? null);
    setStep(item.preview ? "preview" : "empty");
  };

  const removeQueueItem = async (item: ImportQueueItem) => {
    if (item.status === "preparing" || item.status === "importing") return;
    if (item.preview && item.status === "ready" && item.preview.jobId !== "browser-demo") {
      try {
        await repository.cancelImport(item.preview.jobId);
        refreshImportJobs();
      } catch (cancelError) {
        onNotify(cancelError instanceof Error ? cancelError.message : "取消导入任务失败");
        return;
      }
    }
    knownPathsRef.current.delete(
      item.sourcePath.replace(/\//g, "\\").toLocaleLowerCase(),
    );
    const remaining = queue.filter((candidate) => candidate.id !== item.id);
    setQueue(remaining);
    if (activeQueueId === item.id) {
      const next = remaining.find((candidate) => candidate.status === "ready" && candidate.preview)
        ?? remaining.find((candidate) => candidate.preview);
      setActiveQueueId(next?.id ?? null);
      setPreview(next?.preview ?? null);
      setStep(next?.preview ? "preview" : "empty");
    }
  };

  const importAllReady = async () => {
    const readyItems = queue.filter((item) => item.status === "ready" && item.preview);
    if (!readyItems.length) return;
    setBatchImporting(true);
    setError("");
    try {
      const summary = await importReadyQueue(
        readyItems,
        (item) => repository.confirmImport(item.preview!.jobId, item.preview!.records, {
          duplicateStrategy: "skip",
          mapping: { __boundary: "auto" },
        }),
        updateQueueItem,
      );
      await onImported(summary.firstImportedRecordId);
      refreshImportJobs();
      onNotify(
        `批量导入完成：导入 ${summary.importedCount} 条，跳过 ${summary.skippedCount} 条${summary.failureCount ? `，${summary.failureCount} 个文件需检查` : ""}`,
        { durationMs: 7_000 },
      );
      if (summary.importedSourceItemIds.length) {
        onNotify(`已开始根据正文自动整理 ${summary.importedSourceItemIds.length} 条新来源`);
        void autoOrganizeImportedSources(summary.importedSourceItemIds)
          .then((result) => onNotify(autoOrganizationNotice(result), {
            durationMs: 12_000,
            actionLabel: result.operationIds.length ? "撤销自动归类" : undefined,
            onAction: result.operationIds.length
              ? async () => {
                await undoAutoOrganization(result.operationIds);
                onNotify("本批自动归类已撤销，来源已返回来源档案待确认");
              }
              : undefined,
          }))
          .catch((error) => onNotify(
            error instanceof Error ? error.message : "自动整理失败；来源仍保留在来源档案待确认",
            { durationMs: 9_000 },
          ));
      }
    } finally {
      setBatchImporting(false);
    }
  };

  const markQueueItemCompleted = (result: ImportResult) => {
    setQueue((current) => current.map((item) =>
      item.preview?.jobId === result.jobId
        ? {
          ...item,
          status: result.status === "failed"
            ? "error"
            : result.errors.length
              ? "partial"
              : "completed",
          error: result.errors.length ? result.errors.join("；") : undefined,
          importedCount: result.importedCount,
          skippedCount: result.skippedCount,
        }
        : item));
  };

  if (step === "mapping" && preview) {
    return (
      <JsonMapping
        preview={preview}
        repository={repository}
        onBack={() => setStep("preview")}
        onImported={onImported}
        onNotify={onNotify}
        onJobChanged={refreshImportJobs}
        onCompleted={markQueueItemCompleted}
      />
    );
  }

  const activeQueueItem = queue.find((item) => item.id === activeQueueId) ?? null;
  const readyFileCount = queue.filter((item) => item.status === "ready").length;
  const completedFileCount = queue.filter((item) =>
    item.status === "completed" || item.status === "partial").length;
  const expectedRecordCount = queue.reduce(
    (total, item) => total + (item.preview?.recordCount ?? 0),
    0,
  );

  return (
    <main className="page-shell settings-transfer-page">
      <PageTitle
        eyebrow="设置 / 数据与存储"
        title="批量导入与导出"
        description={mode === "import"
          ? "文件先归档并校验，再进行结构识别、字段映射和重复检查。"
          : "按当前记录、收藏、筛选结果、手动多选或全部记录导出。"}
        action={<div className="data-exchange-tabs">
          <button className="settings-back-button" onClick={onBackToSettings}><ArrowLeft size={17} />返回上一级</button>
          <button className={mode === "import" ? "active" : ""} onClick={() => setMode("import")}><Upload size={17} />导入</button>
          <button className={mode === "export" ? "active" : ""} onClick={() => setMode("export")}><FolderOpen size={17} />导出</button>
        </div>}
      />
      {mode === "export" ? (
        <ExportCenter
          repository={repository}
          selectedRecordId={selectedRecordId}
          currentSearch={currentSearch}
          onNotify={onNotify}
        />
      ) : <>
      {!("__TAURI_INTERNALS__" in window) ? (
        <div className="browser-demo-action">
          <button className="secondary-button" onClick={loadDemo}><FileJson2 size={18} />载入浏览器示例</button>
        </div>
      ) : null}
      <div className="import-layout">
        <div className="import-primary">
          <AppCard
            className={`drop-zone ${dragActive ? "drag-active" : ""} ${queue.length ? "has-file" : ""}`}
          >
            <div
              className="drop-target"
              onDragEnter={() => setDragActive(true)}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              {!queue.length ? (
                <>
                  <div className="drop-icon"><Upload size={26} /></div>
                  <strong>拖入 ChatGPT 完整导出 ZIP，或一个或多个 JSON、Markdown、TXT、HTML 文件</strong>
                  <span>普通文件上限 200 MB，ChatGPT 完整导出 ZIP 上限 2 GB；文件会依次归档和识别。</span>
                  <button className="primary-button" disabled={loading} onClick={() => void chooseFile()}>
                    <FolderOpen size={18} />{loading ? "正在归档与解析…" : "选择多个文件"}
                  </button>
                </>
              ) : (
                <div className="import-queue">
                  <div className="import-queue-toolbar">
                    <div>
                      <strong>批量导入队列</strong>
                      <span>{queue.length} 个文件 · 预计 {expectedRecordCount} 条记录{completedFileCount ? ` · 已完成 ${completedFileCount}` : ""}</span>
                    </div>
                    <div>
                      <button className="secondary-button" disabled={loading || batchImporting} onClick={() => void chooseFile()}>
                        <Plus size={16} />继续添加
                      </button>
                      <button className="primary-button" disabled={!readyFileCount || loading || batchImporting} onClick={() => void importAllReady()}>
                        <Upload size={16} />{batchImporting ? "正在批量导入…" : `全部自动导入 (${readyFileCount})`}
                      </button>
                    </div>
                  </div>
                  <div className="import-file-list">
                    {queue.map((item) => (
                      <div
                        className={`file-row queue-file-row ${item.id === activeQueueId ? "active" : ""} ${item.status}`}
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectQueueItem(item)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") selectQueueItem(item);
                        }}
                      >
                        <div className="file-type"><Braces size={22} /></div>
                        <div>
                          <strong>{item.fileName}</strong>
                          <span>
                            {item.preview
                              ? `${formatFileSize(item.preview.sizeBytes)} · ${item.preview.fileKind.toUpperCase()} · ${item.preview.recordCount} 条记录`
                              : item.error ?? "等待归档与识别"}
                          </span>
                        </div>
                        <span className={`queue-file-status ${item.status}`}>
                          {item.status === "queued" ? "等待识别" : null}
                          {item.status === "preparing" ? <><span className="save-spinner" />正在识别</> : null}
                          {item.status === "ready" ? <><CheckCircle2 size={16} />识别完成</> : null}
                          {item.status === "importing" ? <><span className="save-spinner" />正在导入</> : null}
                          {item.status === "completed" ? <><CheckCircle2 size={16} />已导入</> : null}
                          {item.status === "partial" ? <><AlertCircle size={16} />部分完成</> : null}
                          {item.status === "error" ? <><AlertCircle size={16} />处理失败</> : null}
                        </span>
                        <button
                          className="icon-button"
                          aria-label={`从队列移除 ${item.fileName}`}
                          disabled={item.status === "preparing" || item.status === "importing"}
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeQueueItem(item);
                          }}
                        >
                          <X size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {dragActive ? <div className="queue-drop-overlay"><Upload size={24} />释放以加入批量队列</div> : null}
                </div>
              )}
            </div>
          </AppCard>
          <AppCard className="import-notice">
            <ShieldCheck size={21} />
            <div>
              <strong>原始文件保护</strong>
              <span>{activeQueueItem?.preview
                ? `当前文件已归档到：${activeQueueItem.preview.storedFilePath}`
                : queue.length
                  ? "队列按顺序归档；单个文件失败不会中断其他文件。"
                  : "选择后先归档原文件，再解析内容；不会修改源文件。"}</span>
            </div>
          </AppCard>
          {error ? <div className="form-error import-error"><AlertCircle size={17} />{error}</div> : null}
          {activeQueueItem?.error ? <div className="form-error import-error"><AlertCircle size={17} />{activeQueueItem.error}</div> : null}
          {activeQueueItem?.preview?.warnings.map((warning) => <div className="import-warning" key={warning}><AlertCircle size={16} />{warning}</div>)}
        </div>

        <AppCard className="preview-card">
          <div className="preview-heading"><span><FileJson2 size={19} />原始内容预览</span><em>{preview ? `${preview.recordCount} 条可导入记录` : "等待文件"}</em></div>
          {preview ? <pre>{preview.rawPreview}</pre> : (
            <div className="preview-empty"><FileText size={31} /><span>选择文件后在这里检查原始内容</span></div>
          )}
          <div className="import-summary">
            <div><span>预计生成</span><strong>{preview ? preview.recordCount : "—"} 条记录</strong></div>
            <div><span>重复风险</span><strong>{preview ? (preview.duplicate ? "已检测到重复" : "未检测到") : "—"}</strong></div>
          </div>
          <button
            className="primary-button full"
            disabled={!preview || activeQueueItem?.status !== "ready"}
            onClick={() => setStep("mapping")}
          >
            {activeQueueItem?.status === "completed" ? "当前文件已导入" : "单独检查字段映射"} <ArrowRight size={18} />
          </button>
        </AppCard>
      </div>
      <AppCard className="import-log-card">
        <div className="preview-heading"><span><History size={19} />最近导入日志</span><em>最多显示 50 项</em></div>
        <div className="import-log-list">
          {importJobs.map((job) => (
            <div className="import-log-row" key={job.id}>
              <div><strong>{job.sourceFileName}</strong><span>{formatRecordDateTime(job.createdAt)}</span></div>
              <em>成功 {job.successCount} · 跳过 {job.skipCount} · 失败 {job.failureCount}</em>
              <span className={`import-job-status ${job.status}`}>{formatImportJobStatus(job.status)}</span>
            </div>
          ))}
          {!importJobs.length ? <div className="preview-empty"><History size={26} /><span>还没有导入任务</span></div> : null}
        </div>
      </AppCard>
      </>}
    </main>
  );
}

function JsonMapping({
  preview,
  repository,
  onBack,
  onImported,
  onNotify,
  onJobChanged,
  onCompleted,
}: {
  preview: ImportPreview;
  repository: RecordRepository;
  onBack: () => void;
  onImported: (recordId?: number) => Promise<void>;
  onNotify: Notify;
  onJobChanged: () => void;
  onCompleted?: (result: ImportResult) => void;
}) {
  const record = preview.records[0];
  const rawRoots = useMemo(() => preview.records.map((item) => {
    try {
      return JSON.parse(item.sourceText ?? "") as unknown;
    } catch {
      return null;
    }
  }), [preview.records]);
  const boundaryOptions = preview.boundaryOptions;
  const [boundary, setBoundary] = useState("auto");
  const expectedRecordCount = boundary === "auto"
    ? preview.recordCount
    : boundaryOptions.find((option) => option.field === boundary)?.recordCount ?? preview.recordCount;
  const rawObjects = useMemo(() => {
    if (boundary !== "auto") {
      const root = rawRoots[0];
      if (root && !Array.isArray(root) && typeof root === "object") {
        const items = (root as Record<string, unknown>)[boundary];
        if (Array.isArray(items)) {
          return items.filter((item): item is Record<string, unknown> =>
            Boolean(item) && !Array.isArray(item) && typeof item === "object");
        }
      }
    }
    return rawRoots.filter((item): item is Record<string, unknown> =>
      Boolean(item) && !Array.isArray(item) && typeof item === "object");
  }, [boundary, rawRoots]);
  const availableFields = useMemo(() =>
    [...new Set(rawObjects.flatMap((item) => Object.keys(item)))].sort(),
  [rawObjects]);
  const fieldDefinitions = [
    ["title", "标题", ["title", "name"]],
    ["summary", "摘要", ["summary", "description"]],
    ["status", "状态", ["status"]],
    ["tags", "标签", ["tags", "topics"]],
    ["currentJudgment", "当前判断", ["currentJudgment", "current_judgment", "judgment"]],
    ["confirmedFacts", "已确认事实", ["confirmedFacts", "confirmed_facts", "facts"]],
    ["openQuestions", "待验证问题", ["openQuestions", "open_questions", "questions"]],
    ["nextActions", "下一步行动", ["nextActions", "next_actions", "actions"]],
    ["notes", "备注", ["notes"]],
  ] as const;
  const initialMapping = useMemo(() => Object.fromEntries(fieldDefinitions.map(([target, , aliases]) => [
    target,
    aliases.find((alias) => availableFields.includes(alias)) ?? "",
  ])), [availableFields]);
  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping);
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState<Record<string, Record<string, string>>>(() => {
    try {
      return JSON.parse(localStorage.getItem(brandedStorageKey("import-mappings")) ?? "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    setMapping((current) => Object.keys(current).length ? current : initialMapping);
  }, [initialMapping]);
  const mappedRecords = useMemo(() => rawObjects.length
    ? rawObjects.map((raw, index) => mapImportedRecord(
      raw,
      preview.records[Math.min(index, preview.records.length - 1)] ?? record,
      mapping,
      index,
    ))
    : preview.records,
  [mapping, preview.records, rawObjects, record]);
  const [completed, setCompleted] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<ImportDuplicateStrategy>(
    preview.duplicate ? "skip" : "copy",
  );
  const [itemStrategies, setItemStrategies] = useState<Array<"skip" | "copy" | "version">>(
    () => preview.records.map(() => "copy"),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    if (preview.jobId === "browser-demo") {
      setCompleted(true);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await repository.confirmImport(preview.jobId, mappedRecords, {
        duplicateStrategy,
        itemStrategies,
        mapping: { ...mapping, __boundary: boundary },
      });
      setCompleted(true);
      await onImported(result.firstImportedRecord?.id);
      onJobChanged();
      onCompleted?.(result);
      onNotify(`已导入 ${result.importedCount} 条，跳过 ${result.skippedCount} 条`);
      if (result.importedSourceItemIds.length) {
        onNotify(`已开始根据正文自动整理 ${result.importedSourceItemIds.length} 条新来源`);
        void autoOrganizeImportedSources(result.importedSourceItemIds)
          .then((organization) => onNotify(
            autoOrganizationNotice(organization),
            {
              durationMs: 12_000,
              actionLabel: organization.operationIds.length ? "撤销自动归类" : undefined,
              onAction: organization.operationIds.length
                ? async () => {
                  await undoAutoOrganization(organization.operationIds);
                  onNotify("本批自动归类已撤销，来源已返回来源档案待确认");
                }
                : undefined,
            },
          ))
          .catch((error) => onNotify(
            error instanceof Error ? error.message : "自动整理失败；来源仍保留在来源档案待确认",
            { durationMs: 9_000 },
          ));
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "导入失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page-shell mapping-page">
      <button className="back-button" onClick={onBack}><ArrowLeft size={18} />返回导入预览</button>
      <PageTitle eyebrow="导入中心 · 第 2 步" title="字段映射与写入确认" description={`确认 ${preview.sourceFileName} 的解析结果；导入前仍可返回检查原文。`} />
      <div className="mapping-layout">
        <AppCard className="mapping-card">
          <div className="mapping-tools">
            <label>
              <span>记录边界</span>
              <select value={boundary} onChange={(event) => setBoundary(event.target.value)}>
                <option value="auto">自动识别（共 {preview.recordCount} 条）</option>
                {boundaryOptions.map((option) => <option value={option.field} key={option.field}>数组字段：{option.field}（{option.recordCount} 条）</option>)}
              </select>
            </label>
            <label>
              <span>套用映射模板</span>
              <select defaultValue="" onChange={(event) => {
                const selected = templates[event.target.value];
                if (selected) setMapping(selected);
              }}>
                <option value="">选择已有模板</option>
                {Object.keys(templates).map((name) => <option value={name} key={name}>{name}</option>)}
              </select>
            </label>
            <div className="mapping-template-save">
              <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="模板名称" />
              <button type="button" onClick={() => {
                const name = templateName.trim();
                if (!name) return;
                const next = { ...templates, [name]: mapping };
                setTemplates(next);
                localStorage.setItem(brandedStorageKey("import-mappings"), JSON.stringify(next));
                setTemplateName("");
                onNotify(`映射模板“${name}”已保存在本机`);
              }}><Save size={15} />保存模板</button>
            </div>
          </div>
          <div className="mapping-header"><strong>源字段</strong><strong>映射到</strong><strong>预览值</strong></div>
          {fieldDefinitions.map(([target, label]) => (
            <div className="mapping-row" key={target}>
              <select value={mapping[target] ?? ""} onChange={(event) =>
                setMapping((current) => ({ ...current, [target]: event.target.value }))}>
                <option value="">不映射</option>
                {availableFields.map((field) => <option value={field} key={field}>{field}</option>)}
              </select>
              <div className="mapping-select"><span>{label}</span><ChevronDown size={16} /></div>
              <span>{previewMappedValue(mappedRecords[0], target)}</span>
            </div>
          ))}
        </AppCard>
        <div className="mapping-side">
          <AppCard className="mapping-result">
            <div className="result-title"><LayoutGrid size={20} /><strong>导入结果预览</strong></div>
            <div className="result-metric"><strong>{expectedRecordCount}</strong><span>预计处理记录</span></div>
            {expectedRecordCount > rawObjects.length ? (
              <div className="result-check"><CheckCircle2 size={17} /><span>界面展示 {rawObjects.length} 条映射样本；确认后从归档原文件处理全部记录</span></div>
            ) : null}
            <div className="result-check"><CheckCircle2 size={17} /><span>原始文件已归档并计算 SHA-256</span></div>
            <div className={`result-check ${preview.duplicate ? "warning" : ""}`}>
              {preview.duplicate ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
              <span>{preview.duplicate
                ? "检测到精确重复；将复用已有笔记并追加来源证据"
                : "未检测到精确重复；相似标题不会自动去重"}</span>
            </div>
            {preview.duplicateCandidates.length ? (
              <div className="duplicate-candidates">
                {preview.duplicateCandidates.slice(0, 8).map((candidate) => (
                  <div key={`${candidate.itemIndex}-${candidate.recordId ?? candidate.duplicateOfItemIndex ?? "candidate"}`}>
                    <strong>
                      第 {candidate.itemIndex + 1} 条 ↔ {candidate.duplicateOfItemIndex !== null
                        ? `本次第 ${candidate.duplicateOfItemIndex + 1} 条`
                        : candidate.title}
                    </strong>
                    <span>{candidate.exact ? "精确重复" : "相似候选"} · {candidate.reason} · 匹配度 {Math.round(candidate.score * 100)}%</span>
                  </div>
                ))}
              </div>
            ) : null}
            <label><input type="checkbox" checked readOnly />保留原始文件与导入日志</label>
            <label><input type="checkbox" checked readOnly />创建结构化研究记录</label>
            <label className="mapping-strategy">
              <span>相似候选处理</span>
              <select value={duplicateStrategy} onChange={(event) =>
                setDuplicateStrategy(event.target.value as ImportDuplicateStrategy)}>
                <option value="skip">跳过相似项</option>
                <option value="copy">创建新副本</option>
                <option value="version">按同标题追加版本</option>
                <option value="manual" disabled={expectedRecordCount > rawObjects.length}>逐条选择</option>
              </select>
            </label>
            {duplicateStrategy === "manual" ? (
              <div className="mapping-item-strategies">
                {mappedRecords.map((item, index) => (
                  <label key={`${item.title}-${index}`}>
                    <span>{index + 1}. {item.title}</span>
                    <select value={itemStrategies[index] ?? "skip"} onChange={(event) => {
                      const next = [...itemStrategies];
                      next[index] = event.target.value as "skip" | "copy" | "version";
                      setItemStrategies(next);
                    }}>
                      <option value="skip">跳过</option>
                      <option value="copy">新副本</option>
                      <option value="version">追加版本</option>
                    </select>
                  </label>
                ))}
              </div>
            ) : null}
            {error ? <div className="form-error"><AlertCircle size={16} />{error}</div> : null}
            <button className="primary-button full" disabled={submitting || !mappedRecords.length} onClick={() => void confirm()}>
              <Check size={18} />{submitting ? "正在写入…" : "确认导入"}
            </button>
          </AppCard>
          {completed ? <div className="success-banner"><CheckCircle2 size={19} /><span>{preview.jobId === "browser-demo" ? "浏览器映射演示完成；桌面版会写入本机数据库。" : "导入完成：记录与原始文件、哈希和导入日志已关联。"}</span></div> : null}
        </div>
      </div>
    </main>
  );
}

function NewRecordDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: {
    title: string;
    summary: string;
    status: RecordStatus;
    tags: string[];
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<RecordStatus>("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  return (
    <PrototypeDialog eyebrow="本地记录" title="新建情报记录" onClose={onClose}>
      <form
        className="record-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!title.trim()) {
            setError("请填写记录标题");
            return;
          }
          setSubmitting(true);
          setError("");
          try {
            await onCreate({
              title: title.trim(),
              summary: summary.trim(),
              status,
              tags: [],
            });
            onClose();
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "新建记录失败");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <label>
          <span>标题</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus placeholder="例如：AI视频生成工具竞品跟踪" />
        </label>
        <label>
          <span>摘要</span>
          <textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="一句话说明这条记录关注什么" />
        </label>
        <label>
          <span>状态</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as RecordStatus)}>
            <option value="normal">普通记录</option>
            <option value="tracking">持续跟踪</option>
            <option value="verification">待验证</option>
            <option value="updated">判断更新</option>
          </select>
        </label>
        {error ? <div className="form-error"><AlertCircle size={16} />{error}</div> : null}
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
          <button type="submit" className="primary-button" disabled={submitting}>
            <Plus size={17} />{submitting ? "正在创建…" : "创建记录"}
          </button>
        </div>
      </form>
    </PrototypeDialog>
  );
}

function EditRecordDialog({
  record,
  onClose,
  onSave,
  onAutosave,
}: {
  record: IntelligenceRecord;
  onClose: () => void;
  onSave: (input: UpdateRecordInput) => Promise<void>;
  onAutosave: (input: PatchRecordInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => recordToUpdate(record));
  const [facts, setFacts] = useState(record.confirmedFacts.join("\n"));
  const [evidenceText, setEvidenceText] = useState(record.keyEvidence
    .map((item) => `${item.content} | ${item.source}`)
    .join("\n"));
  const [questions, setQuestions] = useState(record.openQuestions.join("\n"));
  const [actions, setActions] = useState(record.nextActions.join("\n"));
  const [sourceDrafts, setSourceDrafts] = useState<RecordSourceInput[]>(() => draft.sources);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [autosaveState, setAutosaveState] = useState<SaveState>("saved");
  const [sourceMode, setSourceMode] = useState<"source" | "preview">("source");

  const lines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const currentInput = (): UpdateRecordInput => ({
    ...draft,
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    tags: record.tags,
    confirmedFacts: lines(facts),
    keyEvidence: lines(evidenceText).map((line) => {
      const separator = line.lastIndexOf("|");
      return separator >= 0
        ? { content: line.slice(0, separator).trim(), source: line.slice(separator + 1).trim() }
        : { content: line, source: "" };
    }),
    openQuestions: lines(questions),
    nextActions: lines(actions),
    sources: sourceDrafts
      .map((source) => ({
        ...source,
        sourceType: source.sourceType.trim() || "manual",
        title: source.title.trim(),
        url: source.url?.trim() || null,
      }))
      .filter((source) => source.title || source.url || source.localPath),
  });

  useEffect(() => {
    const original = recordToUpdate(record);
    const current = currentInput();
    const patch = Object.fromEntries(
      (Object.keys(current) as Array<keyof UpdateRecordInput>)
        .filter((key) => JSON.stringify(current[key]) !== JSON.stringify(original[key]))
        .map((key) => [key, current[key]]),
    ) as PatchRecordInput;
    if (!Object.keys(patch).length || !current.title) {
      setAutosaveState("saved");
      return;
    }
    setAutosaveState("saving");
    const timer = window.setTimeout(() => {
      void onAutosave(patch)
        .then(() => setAutosaveState("saved"))
        .catch((autosaveError) => {
          setAutosaveState("error");
          setError(autosaveError instanceof Error ? autosaveError.message : "自动保存失败");
        });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    actions,
    draft,
    evidenceText,
    facts,
    questions,
    record,
    sourceDrafts,
  ]);

  return (
    <PrototypeDialog
      eyebrow={`记录 #${record.id}`}
      title="编辑完整记录"
      onClose={onClose}
      className="edit-record-dialog"
    >
      <form
        className="record-form edit-record-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!draft.title.trim()) {
            setError("记录标题不能为空");
            return;
          }
          setSubmitting(true);
          setError("");
          try {
            await onSave(currentInput());
            onClose();
          } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "保存记录失败");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="form-grid">
          <label><span>标题</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>
            <span>状态</span>
            <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as RecordStatus })}>
              <option value="normal">普通记录</option>
              <option value="tracking">持续跟踪</option>
              <option value="verification">待验证</option>
              <option value="updated">判断更新</option>
            </select>
          </label>
        </div>
        <label><span>摘要</span><textarea value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></label>
        <label><span>当前判断</span><textarea value={draft.currentJudgment} onChange={(event) => setDraft({ ...draft, currentJudgment: event.target.value })} /></label>
        <div className="form-grid">
          <label><span>已确认事实（每行一条）</span><textarea value={facts} onChange={(event) => setFacts(event.target.value)} /></label>
          <label><span>关键证据（内容 | 来源）</span><textarea value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} /></label>
          <label><span>待验证问题（每行一条）</span><textarea value={questions} onChange={(event) => setQuestions(event.target.value)} /></label>
          <label><span>下一步行动（每行一条）</span><textarea value={actions} onChange={(event) => setActions(event.target.value)} /></label>
        </div>
        <div className="source-editor">
          <div className="source-editor-heading">
            <strong>来源管理</strong>
            <button type="button" onClick={() => setSourceDrafts((current) => [...current, {
              sourceType: "manual",
              title: "",
              url: null,
              localPath: null,
              externalId: null,
            }])}><Plus size={15} />添加来源</button>
          </div>
          {sourceDrafts.map((source, index) => (
            <div className="source-editor-row" key={`${index}-${source.externalId ?? source.localPath ?? ""}`}>
              <label><span>类型</span><input value={source.sourceType} onChange={(event) => setSourceDrafts((current) =>
                current.map((item, itemIndex) => itemIndex === index ? { ...item, sourceType: event.target.value } : item))} /></label>
              <label><span>标题</span><input value={source.title} onChange={(event) => setSourceDrafts((current) =>
                current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} /></label>
              <label><span>链接</span><input value={source.url ?? ""} onChange={(event) => setSourceDrafts((current) =>
                current.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value || null } : item))} placeholder="https://…" /></label>
              <button type="button" className="icon-button danger" onClick={() =>
                setSourceDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {!sourceDrafts.length ? <div className="form-hint">暂无来源；保存时不会影响导入归档中的原始文件。</div> : null}
        </div>
        <label><span>备注</span><textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
        <div className="markdown-editor">
          <div className="markdown-editor-heading">
            <span>原始文本</span>
            <div className="segmented-control">
              <button
                type="button"
                className={sourceMode === "source" ? "active" : ""}
                onClick={() => setSourceMode("source")}
              >
                源码
              </button>
              <button
                type="button"
                className={sourceMode === "preview" ? "active" : ""}
                onClick={() => setSourceMode("preview")}
              >
                Markdown 预览
              </button>
            </div>
          </div>
          {sourceMode === "source" ? (
            <textarea
              className="markdown-source-input"
              value={draft.sourceText}
              onChange={(event) => setDraft({ ...draft, sourceText: event.target.value })}
            />
          ) : (
            <MarkdownContent value={draft.sourceText} className="markdown-editor-preview" />
          )}
        </div>
        {error ? <div className="form-error"><AlertCircle size={16} />{error}</div> : null}
        <div className="dialog-actions">
          <span className={`editor-autosave ${autosaveState}`}>
            {autosaveState === "saving" ? "正在自动保存…" : autosaveState === "error" ? "自动保存失败" : "编辑已自动保存"}
          </span>
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
          <button type="submit" className="primary-button" disabled={submitting}><Save size={17} />{submitting ? "保存中…" : "保存完整记录"}</button>
        </div>
      </form>
    </PrototypeDialog>
  );
}

function TrashPage({
  records,
  onRestore,
  onPermanentDelete,
  onPermanentDeleteAll,
}: {
  records: RecordSummary[];
  onRestore: (id: number) => Promise<void>;
  onPermanentDelete: (id: number) => Promise<void>;
  onPermanentDeleteAll: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState<RecordSummary | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [error, setError] = useState("");

  return (
    <main className="page-shell">
      <PageTitle
        eyebrow="可恢复删除"
        title="回收站"
        description="移入回收站的记录仍保留版本关系；永久删除使用一次明确确认。"
        action={records.length ? (
          <button className="danger-button" onClick={() => {
            setError("");
            setDeleteAllOpen(true);
          }}><Trash2 size={17} />全部删除</button>
        ) : null}
      />
      <div className="trash-grid">
        {records.map((record) => (
          <AppCard className="trash-card" key={record.id}>
            <NoteSemanticIcon iconKey={resolveNoteIconKey(
              recordDisplayTitle(record),
              record.tags.join(" "),
              record.summary,
              recordSourceLabel(record),
            )} />
            <div><strong>{recordDisplayTitle(record)}</strong><span>删除于 {record.deletedAt ? formatRecordDateTime(record.deletedAt) : "未知时间"}</span></div>
            <button
              className="secondary-button"
              onClick={() => void onRestore(record.id)}
            >
              <RotateCcw size={17} />恢复
            </button>
            <button className="danger-button" onClick={() => {
              setDeleting(record);
              setError("");
            }}><Trash2 size={17} />永久删除</button>
          </AppCard>
        ))}
        {!records.length ? (
          <div className="empty-state wide scene-surface-state"><Trash2 size={32} /><strong>回收站为空</strong><span>这里没有待恢复或永久删除的记录。</span></div>
        ) : null}
      </div>
      {deleting ? (
        <PrototypeDialog eyebrow="不可恢复操作" title="永久删除记录" onClose={() => setDeleting(null)}>
          <div className="delete-confirmation">
            <div className="danger-callout"><AlertCircle size={19} /><span>此操作会删除记录及其历史版本，无法撤销。</span></div>
            <p>即将永久删除：<strong>{deleting.title}</strong></p>
            {error ? <div className="form-error"><AlertCircle size={16} />{error}</div> : null}
            <div className="dialog-actions">
              <button className="secondary-button" onClick={() => setDeleting(null)}>取消</button>
              <button
                className="danger-button"
                onClick={async () => {
                  try {
                    await onPermanentDelete(deleting.id);
                    setDeleting(null);
                  } catch (deleteError) {
                    setError(deleteError instanceof Error ? deleteError.message : "永久删除失败");
                  }
                }}
              ><Trash2 size={17} />确认永久删除</button>
            </div>
          </div>
        </PrototypeDialog>
      ) : null}
      {deleteAllOpen ? (
        <PrototypeDialog eyebrow="不可恢复操作" title="清空回收站" onClose={() => {
          if (!deletingAll) setDeleteAllOpen(false);
        }}>
          <div className="delete-confirmation">
            <div className="danger-callout">
              <AlertCircle size={19} />
              <span>将永久删除回收站内 {records.length} 条记录及其历史版本，操作无法撤销。</span>
            </div>
            <p>此操作只会在你点击下方确认按钮后执行。</p>
            {error ? <div className="form-error"><AlertCircle size={16} />{error}</div> : null}
            <div className="dialog-actions">
              <button className="secondary-button" disabled={deletingAll} onClick={() => setDeleteAllOpen(false)}>取消</button>
              <button
                className="danger-button"
                disabled={deletingAll}
                onClick={async () => {
                  setDeletingAll(true);
                  setError("");
                  try {
                    await onPermanentDeleteAll();
                    setDeleteAllOpen(false);
                  } catch (deleteError) {
                    setError(deleteError instanceof Error ? deleteError.message : "清空回收站失败");
                  } finally {
                    setDeletingAll(false);
                  }
                }}
              ><Trash2 size={17} />{deletingAll ? "正在删除…" : "确认全部删除"}</button>
            </div>
          </div>
        </PrototypeDialog>
      ) : null}
    </main>
  );
}

function SettingsPage({
  repository,
  skinId,
  onSkinChange,
  onOpenTransfer,
  onDataRestored,
  onNotify,
  storageStats,
  storageRefreshing,
  onRefreshStorage,
  initialSetting = null,
  onSettingClosed,
}: {
  repository: RecordRepository;
  skinId: KnowledgeSkinId;
  onSkinChange: (skinId: KnowledgeSkinId) => void;
  onOpenTransfer: () => void;
  onDataRestored: () => Promise<void>;
  onNotify: Notify;
  storageStats: StorageStats | null;
  storageRefreshing: boolean;
  onRefreshStorage: () => Promise<StorageStats>;
  initialSetting?: string | null;
  onSettingClosed: () => void;
}) {
  const [dataLocation, setDataLocation] = useState("正在读取…");
  const [storageInfo, setStorageInfo] = useState<StorageStats | null>(null);
  const [restoreCandidate, setRestoreCandidate] = useState<string | null>(null);
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(null);
  const [restorePreviewError, setRestorePreviewError] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [portableRestoreCandidate, setPortableRestoreCandidate] = useState<string | null>(null);
  const [portableRestorePreview, setPortableRestorePreview] = useState<PortableBackupPreview | null>(null);
  const [portableRestoreError, setPortableRestoreError] = useState("");
  const [portableRestoring, setPortableRestoring] = useState(false);
  const [portableBackingUp, setPortableBackingUp] = useState(false);
  const groups = [
    {
      icon: Database,
      title: "数据与存储",
      copy: "数据交换、完整备份与高级维护",
      value: dataLocation,
      previewValue: dataLocation,
    },
    {
      icon: Keyboard,
      title: "快捷键",
      copy: "搜索、编辑和数据操作快捷方式",
      value: "查看全部",
      previewValue: "6 项常用快捷操作",
    },
  ];
  const [selectedSetting, setSelectedSetting] = useState<string | null>(initialSetting);
  const activeSetting = groups.find((group) => group.title === selectedSetting);
  const ActiveSettingIcon = activeSetting?.icon;

  const refreshStorageInfo = useCallback(async () => {
    const stats = await onRefreshStorage();
    setStorageInfo(stats);
    return stats;
  }, [onRefreshStorage]);

  useEffect(() => {
    void Promise.all([repository.getDataLocation(), refreshStorageInfo()])
      .then(([location]) => {
        setDataLocation(location.root);
      })
      .catch((error) => setDataLocation(error instanceof Error ? error.message : "读取失败"));
  }, [refreshStorageInfo, repository]);

  useEffect(() => {
    setStorageInfo(storageStats);
  }, [storageStats]);

  return (
    <main className="page-shell settings-page">
      <PageTitle eyebrow="本地优先" title="设置" description="查看真实数据位置，并执行可恢复的数据库维护操作。" />
      <section className="skin-settings-panel elevated-card" aria-labelledby="skin-settings-title">
        <div className="skin-settings-heading">
          <div className="settings-icon"><Sparkles size={21} /></div>
          <div>
            <h2 id="skin-settings-title">外观与皮肤</h2>
            <p>四套皮肤共用同一布局，切换时只改变颜色与材质。</p>
          </div>
        </div>
        <div className="skin-option-grid" role="radiogroup" aria-label="选择界面皮肤">
          {KNOWLEDGE_SKINS.map((skin) => (
            <button
              type="button"
              role="radio"
              aria-checked={skinId === skin.id}
              className={`skin-option ${skinId === skin.id ? "selected" : ""}`}
              key={skin.id}
              onClick={() => {
                onSkinChange(skin.id);
                onNotify(`已切换为“${skin.name}”皮肤`);
              }}
            >
              <span
                className={`skin-preview ${skin.id === "classic" ? "classic" : ""}`}
                style={skin.backgroundUrl
                  ? { backgroundImage: `url("${skin.backgroundUrl}")` }
                  : undefined}
                aria-hidden="true"
              >
                {skin.id === "classic" ? <i /> : null}
              </span>
              <span className="skin-option-copy">
                <strong>{skin.name}</strong>
                <small>{skin.description}</small>
              </span>
              <span className="skin-choice-indicator"><Check size={13} /></span>
            </button>
          ))}
        </div>
      </section>
      <div className="settings-list">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <AppCard
              className="settings-row settings-row-clickable"
              key={group.title}
              onClick={() => setSelectedSetting(group.title)}
            >
              <div className="settings-icon"><Icon size={21} /></div>
              <div><strong>{group.title}</strong><span>{group.copy}</span></div>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedSetting(group.title);
                }}
              >
                <span>{group.value}</span><ChevronRight size={18} />
              </button>
            </AppCard>
          );
        })}
      </div>
      {activeSetting && ActiveSettingIcon ? (
        <PrototypeDialog
          eyebrow="设置预览"
          title={activeSetting.title}
          className={activeSetting.title === "快捷键"
            ? "settings-preview-dialog shortcut-settings-dialog"
            : "settings-preview-dialog storage-settings-dialog"}
          resizable={activeSetting.title === "数据与存储"}
          sizePreferenceKey={activeSetting.title === "数据与存储"
            ? "storage-settings-dialog-v2"
            : undefined}
          onClose={() => {
            setSelectedSetting(null);
            onSettingClosed();
          }}
        >
          <div className="setting-preview">
            <div className="settings-icon"><ActiveSettingIcon size={22} /></div>
            <div><strong>{activeSetting.previewValue}</strong><p>{activeSetting.copy}</p></div>
          </div>
          {activeSetting.title === "数据与存储" ? (
            <div className="settings-actions">
              <div className="settings-storage-overview">
                <div className="settings-storage-overview-heading">
                  <strong>存储概览</strong>
                  <button
                    type="button"
                    className="storage-refresh-button"
                    aria-label="刷新存储统计"
                    title="重新扫描存储占用"
                    disabled={storageRefreshing}
                    onClick={() => {
                      void refreshStorageInfo()
                        .then(() => onNotify("存储统计已刷新"))
                        .catch((error) => onNotify(error instanceof Error ? error.message : "刷新存储统计失败"));
                    }}
                  >
                    <RefreshCw size={14} className={storageRefreshing ? "is-spinning" : ""} />
                  </button>
                </div>
                {storageInfo ? (
                  <div className="storage-breakdown">
                    <div><span>数据库</span><strong>{formatFileSize(storageInfo.databaseBytes)}</strong></div>
                    <div><span>导入归档</span><strong>{formatFileSize(storageInfo.importsBytes)}</strong></div>
                    <div><span>附件</span><strong>{formatFileSize(storageInfo.attachmentsBytes)}</strong></div>
                    <div><span>备份</span><strong>{formatFileSize(storageInfo.backupsBytes)}</strong></div>
                    <div><span>受控数据合计</span><strong>{formatFileSize(storageInfo.totalBytes)}</strong></div>
                    <div><span>磁盘可用</span><strong>{formatFileSize(storageInfo.diskAvailableBytes)} / {formatFileSize(storageInfo.diskTotalBytes)}</strong></div>
                    <div><span>最近备份</span><strong>{storageInfo.lastBackupAt ? formatRecordDateTime(storageInfo.lastBackupAt) : "尚无"}</strong></div>
                  </div>
                ) : null}
              </div>
              <div className="settings-storage-primary-actions">
                <section className="settings-action-section primary">
                  <div>
                    <strong>数据交换</strong>
                    <p>导入与导出统一在一个入口完成。</p>
                  </div>
                  <button className="primary-button settings-transfer-button" onClick={onOpenTransfer}>
                    <Upload size={16} />打开批量导入与导出
                  </button>
                </section>
                <section className="settings-action-section backup">
                  <div>
                    <strong>备份与恢复</strong>
                    <p>完整保存数据、附件与界面设置，用于换机或恢复。</p>
                  </div>
                  <div className="settings-backup-actions">
                    <button
                      className="primary-button"
                      disabled={portableBackingUp}
                      onClick={async () => {
                        if (!("__TAURI_INTERNALS__" in window)) {
                          onNotify("浏览器演示模式不能创建完整备份");
                          return;
                        }
                        setPortableBackingUp(true);
                        try {
                          const result = await repository.createPortableBackup(collectAppPreferences());
                          await refreshStorageInfo();
                          onNotify(
                            `完整备份已创建：${result.recordCount} 条记录，${formatFileSize(result.totalBytes)}；${result.folderPath}`,
                            {
                              durationMs: 9_000,
                              actionLabel: "打开数据目录",
                              onAction: () => repository.openDataDirectory(),
                            },
                          );
                        } catch (error) {
                          onNotify(error instanceof Error ? error.message : "完整备份失败");
                        } finally {
                          setPortableBackingUp(false);
                        }
                      }}
                    >
                      <Database size={17} />{portableBackingUp ? "正在创建完整备份…" : "创建完整备份"}
                    </button>
                    <button className="secondary-button" onClick={async () => {
                      if (!("__TAURI_INTERNALS__" in window)) {
                        onNotify("浏览器演示模式不能选择完整备份");
                        return;
                      }
                      const selected = await openFileDialog({
                        multiple: false,
                        directory: true,
                        title: "选择南枫知识库完整备份文件夹",
                      });
                      if (typeof selected === "string") {
                        setPortableRestoreCandidate(selected);
                        setPortableRestorePreview(null);
                        setPortableRestoreError("");
                        try {
                          setPortableRestorePreview(await repository.inspectPortableBackup(selected));
                        } catch (error) {
                          setPortableRestoreError(error instanceof Error ? error.message : "完整备份预览失败");
                        }
                      }
                    }}><RotateCcw size={17} />恢复完整备份</button>
                  </div>
                </section>
              </div>
              <details className="settings-advanced-maintenance">
                <summary>
                  <div><strong>高级维护</strong><span>仅在搜索异常、数据库检查或技术排障时使用。</span></div>
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <div className="settings-advanced-body">
                  <div className="settings-action-grid">
                    <button className="secondary-button" onClick={async () => {
                      try {
                        await repository.openDataDirectory();
                      } catch (error) {
                        onNotify(error instanceof Error ? error.message : "打开数据目录失败");
                      }
                    }}><FolderOpen size={17} />打开数据目录</button>
                    <button className="secondary-button" onClick={async () => {
                      try {
                        const result = await repository.runIntegrityCheck();
                        onNotify(`数据库完整性检查：${result}`);
                      } catch (error) {
                        onNotify(error instanceof Error ? error.message : "完整性检查失败");
                      }
                    }}><ShieldCheck size={17} />检查数据库</button>
                    <button className="secondary-button" onClick={async () => {
                      try {
                        await repository.rebuildSearchIndex();
                        onNotify("搜索索引已重建");
                      } catch (error) {
                        onNotify(error instanceof Error ? error.message : "索引重建失败");
                      }
                    }}><Search size={17} />重建搜索索引</button>
                    <button className="secondary-button" onClick={async () => {
                      try {
                        const path = await repository.createBackup();
                        await refreshStorageInfo();
                        onNotify(`数据库快照已创建（不含附件和导入原件）：${path}`);
                      } catch (error) {
                        onNotify(error instanceof Error ? error.message : "创建数据库快照失败");
                      }
                    }}><Database size={17} />创建数据库快照</button>
                    <button className="secondary-button" onClick={async () => {
                      if (!("__TAURI_INTERNALS__" in window)) {
                        onNotify("浏览器演示模式不能选择数据库快照");
                        return;
                      }
                      const selected = await openFileDialog({
                        multiple: false,
                        directory: false,
                        filters: [{ name: "南枫知识库数据库快照", extensions: ["db"] }],
                      });
                      if (typeof selected === "string") {
                        setRestoreCandidate(selected);
                        setRestorePreview(null);
                        setRestorePreviewError("");
                        try {
                          setRestorePreview(await repository.inspectBackup(selected));
                        } catch (error) {
                          setRestorePreviewError(error instanceof Error ? error.message : "数据库快照预览失败");
                        }
                      }
                    }}><RotateCcw size={17} />从数据库快照恢复</button>
                  </div>
                  <p className="settings-advanced-warning">数据库快照不包含附件、导入原件和界面设置；普通备份与换机请使用上方“完整备份”。</p>
                </div>
              </details>
            </div>
          ) : (
            <div className="shortcut-list">
              <div><span>聚焦记录搜索</span><kbd>Ctrl / ⌘ + K</kbd></div>
              <div><span>新建情报记录</span><kbd>Ctrl / ⌘ + N</kbd></div>
              <div><span>编辑当前记录</span><kbd>Ctrl / ⌘ + E</kbd></div>
              <div><span>立即保存当前判断</span><kbd>Ctrl / ⌘ + S</kbd></div>
              <div><span>将当前记录移入回收站</span><kbd>Delete</kbd></div>
              <div><span>打开设置中的批量导入与导出</span><kbd>Ctrl / ⌘ + Shift + I</kbd></div>
            </div>
          )}
        </PrototypeDialog>
      ) : null}
      {restoreCandidate ? (
        <PrototypeDialog eyebrow="高级维护" title="确认从数据库快照恢复" onClose={() => setRestoreCandidate(null)}>
          <div className="delete-confirmation">
            <div className="danger-callout">
              <AlertCircle size={19} />
              <span>恢复会替换当前数据库，但不会恢复附件、导入原件和界面设置。应用会先自动创建“恢复前安全快照”，并检查所选快照和恢复结果的完整性。</span>
            </div>
            <p>快照文件：<strong>{restoreCandidate}</strong></p>
            {restorePreview ? (
              <div className="restore-preview-grid">
                <div><span>记录</span><strong>{restorePreview.recordCount}</strong></div>
                <div><span>回收站</span><strong>{restorePreview.deletedCount}</strong></div>
                <div><span>历史版本</span><strong>{restorePreview.versionCount}</strong></div>
                <div><span>文件大小</span><strong>{formatFileSize(restorePreview.fileSizeBytes)}</strong></div>
                <div><span>完整性</span><strong>{restorePreview.integrityCheck}</strong></div>
                <div><span>修改时间</span><strong>{formatRecordDateTime(restorePreview.modifiedAt)}</strong></div>
              </div>
            ) : restorePreviewError ? (
              <div className="form-error"><AlertCircle size={16} />{restorePreviewError}</div>
            ) : (
              <div className="page-loading"><span className="save-spinner" />正在只读检查备份…</div>
            )}
            <div className="dialog-actions">
              <button className="secondary-button" onClick={() => setRestoreCandidate(null)}>取消</button>
              <button className="danger-button" disabled={restoring || !restorePreview} onClick={async () => {
                setRestoring(true);
                try {
                  const result = await repository.restoreBackup(restoreCandidate);
                  await onDataRestored();
                  setRestoreCandidate(null);
                  onNotify(`恢复完成；安全备份：${result.safetyBackup}；日志：${result.logPath}`);
                } catch (error) {
                  onNotify(error instanceof Error ? error.message : "数据库恢复失败");
                } finally {
                  setRestoring(false);
                }
              }}><RotateCcw size={17} />{restoring ? "正在校验与恢复…" : "确认恢复"}</button>
            </div>
          </div>
        </PrototypeDialog>
      ) : null}
      {portableRestoreCandidate ? (
        <PrototypeDialog
          eyebrow="换机与灾备"
          title="确认恢复完整备份"
          onClose={() => setPortableRestoreCandidate(null)}
          className="portable-restore-dialog"
        >
          <div className="delete-confirmation">
            <div className="danger-callout">
              <AlertCircle size={19} />
              <span>这会替换当前数据库、附件和导入原件，并恢复软件界面设置。执行前会自动创建一份当前状态的完整安全备份，失败时自动回滚。</span>
            </div>
            <p>完整备份文件夹：<strong>{portableRestoreCandidate}</strong></p>
            {portableRestorePreview ? (
              <div className="restore-preview-grid portable">
                <div><span>记录</span><strong>{portableRestorePreview.recordCount}</strong></div>
                <div><span>回收站</span><strong>{portableRestorePreview.deletedCount}</strong></div>
                <div><span>历史版本</span><strong>{portableRestorePreview.versionCount}</strong></div>
                <div><span>界面设置</span><strong>{portableRestorePreview.preferenceCount}</strong></div>
                <div><span>文件</span><strong>{portableRestorePreview.fileCount}</strong></div>
                <div><span>备份大小</span><strong>{formatFileSize(portableRestorePreview.totalBytes)}</strong></div>
                <div><span>应用版本</span><strong>{portableRestorePreview.appVersion}</strong></div>
                <div><span>完整性</span><strong>{portableRestorePreview.integrityCheck}</strong></div>
                <div>
                  <span>文件校验</span>
                  <strong>
                    {portableRestorePreview.contentIntegrity === "verified_sha256"
                      ? "SHA-256 全量通过"
                      : "旧版仅数据库"}
                  </strong>
                </div>
              </div>
            ) : portableRestoreError ? (
              <div className="form-error"><AlertCircle size={16} />{portableRestoreError}</div>
            ) : (
              <div className="page-loading"><span className="save-spinner" />正在校验完整备份…</div>
            )}
            <div className="dialog-actions">
              <button className="secondary-button" onClick={() => setPortableRestoreCandidate(null)}>取消</button>
              <button
                className="danger-button"
                disabled={portableRestoring || !portableRestorePreview?.restorable}
                onClick={async () => {
                  setPortableRestoring(true);
                  try {
                    const result = await repository.restorePortableBackup(
                      portableRestoreCandidate,
                      collectAppPreferences(),
                    );
                    restoreAppPreferences(result.preferencesJson);
                    await onDataRestored();
                    setPortableRestoreCandidate(null);
                    onNotify(`完整数据已恢复；恢复前完整安全备份：${result.safetyBackup}`, {
                      durationMs: 9_000,
                    });
                  } catch (error) {
                    onNotify(error instanceof Error ? error.message : "完整备份恢复失败");
                  } finally {
                    setPortableRestoring(false);
                  }
                }}
              >
                <RotateCcw size={17} />{portableRestoring ? "正在创建安全备份并恢复…" : "确认完整恢复"}
              </button>
            </div>
          </div>
        </PrototypeDialog>
      ) : null}
    </main>
  );
}

export function App() {
  const repository = useMemo(() => getRecordRepository(), []);
  const knowledgeRepository = useMemo(() => new KnowledgeRepository(), []);
  const [skinId, setSkinId] = useState<KnowledgeSkinId>(() => readKnowledgeSkin());
  const [page, setPage] = useState<Page>("knowledge");
  const [settingsReturnTarget, setSettingsReturnTarget] = useState<"data-storage" | null>(null);
  const [knowledgeSourceTarget, setKnowledgeSourceTarget] = useState<
    (KnowledgeSourceTarget & { requestId: number }) | null
  >(null);
  const [knowledgeTopicTarget, setKnowledgeTopicTarget] = useState<
    ({ topicId: number } & KnowledgeReadingTarget) | null
  >(null);
  const [allRecords, setAllRecords] = useState<RecordSummary[]>([]);
  const [catalogTopicValues, setCatalogTopicValues] = useState<string[]>([]);
  const [visibleRecords, setVisibleRecords] = useState<RecordSummary[]>([]);
  const [trashRecords, setTrashRecords] = useState<RecordSummary[]>([]);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [storageRefreshing, setStorageRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<IntelligenceRecord | null>(null);
  const [recordVersions, setRecordVersions] = useState<RecordVersion[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [pendingSave, setPendingSave] = useState<{ id: number; value: string; sequence: number } | null>(null);
  const [importStep, setImportStep] = useState<ImportStep>("empty");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [recordSearch, setRecordSearch] = useState("");
  const [newRecordOpen, setNewRecordOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<IntelligenceRecord | null>(null);
  const [sharingRecord, setSharingRecord] = useState<IntelligenceRecord | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const favoriteRequests = useRef(new Set<number>());
  const detailRequestSequence = useRef(0);
  const searchRequestSequence = useRef(0);
  const saveRequestSequence = useRef(0);
  const knowledgeSourceRequestSequence = useRef(0);
  const storageRefreshPromise = useRef<Promise<StorageStats> | null>(null);
  const unifiedNoteTopicValues = useMemo(() => Array.from(new Set([
    ...catalogTopicValues,
    ...allRecords.map(recordTopicLabel),
  ])).filter(Boolean).sort((left, right) => left.localeCompare(right, "zh-CN")), [
    allRecords,
    catalogTopicValues,
  ]);
  const navigationRecordCounts = useMemo(() => ({
    favorites: allRecords.reduce((count, record) => count + Number(record.isFavorite), 0),
    tracking: allRecords.reduce((count, record) => count + Number(record.status === "tracking"), 0),
    updates: allRecords.reduce((count, record) => count + Number(record.status === "updated"), 0),
  }), [allRecords]);

  useEffect(() => {
    let cancelled = false;
    void knowledgeRepository.listTopics()
      .then((items) => {
        if (!cancelled) setCatalogTopicValues(items.map((item) => item.name));
      })
      .catch((error) => {
        console.warn("读取统一主题筛选目录失败，将使用记录已关联主题。", error);
      });
    return () => {
      cancelled = true;
    };
  }, [knowledgeRepository]);
  const knowledgeTopicRequestSequence = useRef(0);
  const detailCache = useRef(new Map<number, IntelligenceRecord>());
  const lastVisibleQuery = useRef<string | null>(null);
  const handleSourceNavigationHandled = useCallback((requestId: number) => {
    setKnowledgeSourceTarget((current) => (
      current?.requestId === requestId ? null : current
    ));
  }, []);
  const activeSkin = getKnowledgeSkin(skinId);
  const [adaptiveScene, setAdaptiveScene] = useState<AdaptiveScenePalette>(
    () => getSkinFallbackPalette(activeSkin),
  );
  const skinStyle = {
    "--skin-background-image": activeSkin.backgroundUrl
      ? `url("${activeSkin.backgroundUrl}")`
      : "none",
    "--skin-background-position": activeSkin.backgroundPosition,
    "--skin-scene-text": adaptiveScene.text,
    "--skin-scene-muted": adaptiveScene.muted,
    "--skin-scene-accent": adaptiveScene.accent,
    "--skin-scene-text-shadow": adaptiveScene.textShadow,
    "--skin-scene-surface": adaptiveScene.surface,
    "--skin-surface-text": adaptiveScene.surfaceText,
    "--skin-surface-muted": adaptiveScene.surfaceMuted,
  } as CSSProperties;

  useEffect(() => {
    let cancelled = false;
    setAdaptiveScene(getSkinFallbackPalette(activeSkin));
    void analyzeScenePalette(activeSkin)
      .then((palette) => {
        if (!cancelled) {
          setAdaptiveScene(palette);
        }
      })
      .catch(() => {
        // 图片不可读时继续使用皮肤内置的安全对比色，不影响知识数据。
      });
    return () => {
      cancelled = true;
    };
  }, [activeSkin]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.knowledgeSkin = skinId;
    root.style.setProperty("--skin-scene-text", adaptiveScene.text);
    root.style.setProperty("--skin-scene-muted", adaptiveScene.muted);
    root.style.setProperty("--skin-scene-accent", adaptiveScene.accent);
    root.style.setProperty("--skin-scene-text-shadow", adaptiveScene.textShadow);
    root.style.setProperty("--skin-scene-surface", adaptiveScene.surface);
    root.style.setProperty("--skin-surface-text", adaptiveScene.surfaceText);
    root.style.setProperty("--skin-surface-muted", adaptiveScene.surfaceMuted);
    return () => {
      delete root.dataset.knowledgeSkin;
      root.style.removeProperty("--skin-scene-text");
      root.style.removeProperty("--skin-scene-muted");
      root.style.removeProperty("--skin-scene-accent");
      root.style.removeProperty("--skin-scene-text-shadow");
      root.style.removeProperty("--skin-scene-surface");
      root.style.removeProperty("--skin-surface-text");
      root.style.removeProperty("--skin-surface-muted");
    };
  }, [adaptiveScene, skinId]);

  const notify = useCallback<Notify>((message, options = {}) => {
    setNotice({ id: Date.now(), message, ...options });
  }, []);

  const refreshStorageStats = useCallback((): Promise<StorageStats> => {
    if (storageRefreshPromise.current) return storageRefreshPromise.current;
    setStorageRefreshing(true);
    const request = repository.getStorageStats()
      .then((stats) => {
        setStorageStats(stats);
        return stats;
      })
      .finally(() => {
        storageRefreshPromise.current = null;
        setStorageRefreshing(false);
      });
    storageRefreshPromise.current = request;
    return request;
  }, [repository]);

  useEffect(() => {
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") {
        void refreshStorageStats().catch(() => {
          // 自动同步失败时保留上一次统计；用户仍可点击刷新获得明确反馈。
        });
      }
    };
    window.addEventListener("focus", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);
    return () => {
      window.removeEventListener("focus", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [refreshStorageStats]);

  const replaceRecord = useCallback((record: IntelligenceRecord) => {
    const summary = summaryFromRecord(record);
    setSelectedRecord((current) => current?.id === record.id ? record : current);
    setAllRecords((current) => current.map((item) => item.id === record.id ? summary : item));
    setVisibleRecords((current) => current.map((item) => item.id === record.id ? summary : item));
    detailCache.current.set(record.id, record);
  }, []);

  const reloadCollections = useCallback(async (preferredId?: number) => {
    const [active, deleted, currentStorageStats] = await Promise.all([
      repository.listRecordSummaries(),
      repository.listRecordSummaries({ deletedOnly: true }),
      refreshStorageStats(),
    ]);
    setAllRecords(active);
    setTrashRecords(deleted);
    setStorageStats(currentStorageStats);
    const query = recordSearch.trim();
    const searched = query
      ? await repository.listRecordSummaries({ search: query })
      : active;
    lastVisibleQuery.current = query;
    setVisibleRecords(searched);
    setSelectedId((current) => {
      const nextId = preferredId ?? current;
      return active.some((record) => record.id === nextId) ? nextId! : active[0]?.id ?? null;
    });
  }, [recordSearch, refreshStorageStats, repository]);

  useEffect(() => {
    void reloadCollections()
      .catch((error) => notify(error instanceof Error ? error.message : "读取本地记录失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    const query = recordSearch.trim();
    if (lastVisibleQuery.current === query) return;
    const timer = window.setTimeout(() => {
      const sequence = ++searchRequestSequence.current;
      void repository.listRecordSummaries(query ? { search: query } : {})
        .then((result) => {
          if (sequence === searchRequestSequence.current) {
            lastVisibleQuery.current = query;
            setVisibleRecords(result);
          }
        })
        .catch((error) => notify(error instanceof Error ? error.message : "搜索失败"));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loading, notify, recordSearch, repository]);

  useEffect(() => {
    const sequence = ++detailRequestSequence.current;
    const recordPageActive = ["records", "favorites", "tracking", "updates"].includes(page);
    if (selectedId === null || !recordPageActive) {
      setSelectedRecord(null);
      return;
    }
    const cached = detailCache.current.get(selectedId);
    if (cached) setSelectedRecord(cached);
    else setSelectedRecord(null);
    void repository.getRecord(selectedId)
      .then((record) => {
        if (sequence !== detailRequestSequence.current) return;
        const draft = readJudgmentDraft(record.id);
        const resolved = draft !== null && draft !== record.currentJudgment
          ? { ...record, currentJudgment: draft }
          : record;
        detailCache.current.set(record.id, resolved);
        setSelectedRecord(resolved);
        const recoveredDraft = draft !== null && draft !== record.currentJudgment;
        setSaveState(recoveredDraft ? "draft" : "saved");
        if (recoveredDraft) notify("已恢复异常退出前的本地草稿；继续编辑后会自动保存");
      })
      .catch((error) => {
        if (sequence === detailRequestSequence.current) {
          setSelectedRecord(null);
          notify(error instanceof Error ? error.message : "读取记录详情失败");
        }
      });
  }, [page, repository, selectedId]);

  useEffect(() => {
    const recordPageActive = ["records", "favorites", "tracking", "updates"].includes(page);
    if (selectedId === null || !recordPageActive) {
      setRecordVersions([]);
      setAttachments([]);
      return;
    }
    void Promise.all([
      repository.listVersions(selectedId),
      repository.listAttachments(selectedId),
    ])
      .then(([versions, recordAttachments]) => {
        setRecordVersions(versions);
        setAttachments(recordAttachments);
      })
      .catch((error) => notify(error instanceof Error ? error.message : "读取历史版本或附件失败"));
  }, [page, repository, selectedId]);

  useEffect(() => {
    if (!pendingSave) return;
    const sequence = pendingSave.sequence;
    saveRequestSequence.current = sequence;
    const timer = window.setTimeout(async () => {
      try {
        const updated = await repository.updateCurrentJudgment(pendingSave.id, pendingSave.value);
        if (sequence !== saveRequestSequence.current) return;
        clearJudgmentDraft(pendingSave.id);
        setSelectedRecord((current) => current?.id === updated.recordId
          ? { ...current, updatedAt: updated.updatedAt }
          : current);
        const applyTimestamp = (current: RecordSummary[]) => current.map((item) =>
          item.id === updated.recordId ? { ...item, updatedAt: updated.updatedAt } : item);
        setAllRecords(applyTimestamp);
        setVisibleRecords(applyTimestamp);
        setSaveState("saved");
      } catch (error) {
        if (sequence === saveRequestSequence.current) {
          setSaveState("error");
          notify(error instanceof Error ? error.message : "自动保存失败，草稿已保留");
        }
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [pendingSave, repository]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, select, [contenteditable='true']") ?? false;
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "i") {
        event.preventDefault();
        setSettingsReturnTarget("data-storage");
        setPage("import");
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setNewRecordOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && selectedRecord) {
        event.preventDefault();
        setSaveState("saving");
        const recordId = selectedRecord.id;
        const judgment = selectedRecord.currentJudgment;
        void repository.updateCurrentJudgment(recordId, judgment)
          .then((mutation) => {
            clearJudgmentDraft(recordId);
            setSelectedRecord((current) => current?.id === recordId
              ? { ...current, updatedAt: mutation.updatedAt }
              : current);
            setSaveState("saved");
            notify("当前记录已立即保存");
          })
          .catch((error) => {
            setSaveState("error");
            notify(error instanceof Error ? error.message : "保存失败，草稿仍保留");
          });
      }
      if (event.key === "Delete" && !typing && selectedId !== null
        && ["records", "favorites", "tracking", "updates"].includes(page)) {
        event.preventDefault();
        if (window.confirm("确认将当前记录移入回收站吗？")) {
          void repository.moveToTrash(selectedId)
            .then(() => reloadCollections())
            .then(() => notify("记录已移入回收站"))
            .catch((error) => notify(error instanceof Error ? error.message : "移入回收站失败"));
        }
      }
      if (event.key === "Escape") setIsEditing(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [page, repository, selectedId, selectedRecord]);

  const showRecords = page === "records"
    || page === "favorites"
    || page === "tracking"
    || page === "updates";
  const recordScope = page === "favorites"
    ? "favorites"
    : page === "tracking"
      ? "tracking"
      : page === "updates"
        ? "updates"
        : "records";

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.durationMs ?? 4_200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const createRecord = useCallback(async (input: {
    title: string;
    summary: string;
    status: RecordStatus;
    tags: string[];
  }) => {
    const created = await repository.createRecord(input);
    setRecordSearch("");
    setPage("records");
    await reloadCollections(created.id);
    notify("记录已创建并保存到本地数据库");
  }, [notify, reloadCollections, repository]);

  const toggleFavorite = useCallback(async (recordId: number) => {
    if (favoriteRequests.current.has(recordId)) return;
    const record = allRecords.find((item) => item.id === recordId);
    if (!record) {
      notify("记录不存在或已移除");
      return;
    }
    favoriteRequests.current.add(recordId);
    try {
      const updated = await repository.setFavorite(recordId, !record.isFavorite);
      const applyUpdate = (current: RecordSummary[]) => current.map((item) =>
        item.id === updated.recordId
          ? { ...item, isFavorite: updated.isFavorite, updatedAt: updated.updatedAt }
          : item);
      setAllRecords(applyUpdate);
      setVisibleRecords(applyUpdate);
      setSelectedRecord((current) => current?.id === updated.recordId
        ? { ...current, isFavorite: updated.isFavorite, updatedAt: updated.updatedAt }
        : current);
      notify(updated.isFavorite ? "已加入收藏" : "已取消收藏");
    } catch (error) {
      notify(error instanceof Error ? error.message : "收藏操作失败");
    } finally {
      favoriteRequests.current.delete(recordId);
    }
  }, [allRecords, notify, repository]);

  const updateStatus = useCallback(async (recordId: number, status: RecordStatus) => {
    try {
      const updated = await repository.updateStatus(recordId, status);
      const applyUpdate = (current: RecordSummary[]) => current.map((item) =>
        item.id === updated.recordId ? { ...item, status, updatedAt: updated.updatedAt } : item);
      setAllRecords(applyUpdate);
      setVisibleRecords(applyUpdate);
      setSelectedRecord((current) => current?.id === updated.recordId
        ? { ...current, status, updatedAt: updated.updatedAt }
        : current);
      notify(`记录状态已更新为“${statusLabel(status)}”`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "状态更新失败");
    }
  }, [notify, repository]);

  const moveToTrash = useCallback(async (recordId: number) => {
    try {
      await repository.moveToTrash(recordId);
      await reloadCollections();
      notify("记录已移入回收站，可随时恢复");
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "移入回收站失败");
      return false;
    }
  }, [notify, reloadCollections, repository]);

  const appendVersion = async () => {
    if (selectedId === null) return;
    await repository.appendVersion(selectedId, `版本 v${recordVersions.length + 1}`, "手动创建版本快照");
    const [versions, record] = await Promise.all([
      repository.listVersions(selectedId),
      repository.getRecord(selectedId),
    ]);
    setRecordVersions(versions);
    replaceRecord(record);
  };

  const restoreVersion = async (versionId: number) => {
    if (selectedId === null) return;
    await repository.restoreVersion(selectedId, versionId);
    const [versions, record] = await Promise.all([
      repository.listVersions(selectedId),
      repository.getRecord(selectedId),
    ]);
    setRecordVersions(versions);
    replaceRecord(record);
    notify("旧版本已恢复为新的当前版本，历史记录未被覆盖");
  };

  const deleteVersion = async (versionId: number) => {
    if (selectedId === null) return;
    await repository.deleteVersion(selectedId, versionId);
    const [versions, record] = await Promise.all([
      repository.listVersions(selectedId),
      repository.getRecord(selectedId),
    ]);
    setRecordVersions(versions);
    replaceRecord(record);
    notify("历史快照已删除，当前记录未受影响");
  };

  const openShare = useCallback(async (recordId: number) => {
    try {
      setSharingRecord(await repository.getRecord(recordId));
    } catch (error) {
      notify(error instanceof Error ? error.message : "读取导出内容失败");
    }
  }, [notify, repository]);

  const exportCurrent = async (format: "md" | "json") => {
    if (!selectedRecord) {
      notify("请先选择要导出的记录");
      return;
    }
    const safeTitle = resolveImportedTitle(selectedRecord.title, selectedRecord.sourceText)
      .replace(/[\\/:*?"<>|]/g, "_");
    const markdown = composeRecordMarkdown(selectedRecord);
    if ("__TAURI_INTERNALS__" in window) {
      try {
        const result = format === "md"
          ? await repository.writeMarkdownExport(`${safeTitle}.md`, markdown)
          : await repository.exportRecord(selectedRecord.id, format);
        notify(`当前记录已导出：${result.filePath}`, {
          durationMs: 7_500,
          actionLabel: "打开原路径",
          onAction: () => repository.openExportDirectory()
            .catch((error) => notify(error instanceof Error ? error.message : "无法打开导出目录")),
        });
      } catch (error) {
        notify(error instanceof Error ? error.message : "导出失败");
      }
      return;
    }
    const content = format === "json" ? JSON.stringify(selectedRecord, null, 2) : markdown;
    const url = URL.createObjectURL(new Blob([content], {
      type: format === "json" ? "application/json;charset=utf-8" : "text/markdown;charset=utf-8",
    }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeTitle}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify(`当前记录已导出为 ${format === "json" ? "JSON" : "Markdown"}`);
  };

  const coreWorkspaceActive = page === "sources" || page === "topics" || page === "knowledge";
  const handleNavigateToSource = useCallback((target: KnowledgeSourceTarget) => {
    knowledgeSourceRequestSequence.current += 1;
    setKnowledgeSourceTarget({
      ...target,
      requestId: knowledgeSourceRequestSequence.current,
    });
    setPage("sources");
  }, []);
  const handleNavigateToKnowledgeTopic = useCallback((
    target: { topicId: number } & Omit<KnowledgeReadingTarget, "requestId">,
  ) => {
    knowledgeTopicRequestSequence.current += 1;
    setKnowledgeTopicTarget({
      ...target,
      requestId: knowledgeTopicRequestSequence.current,
    });
    setPage("knowledge");
  }, []);
  const handleOpenAttachment = useCallback((attachment: AttachmentItem) => {
    setPreviewAttachment(attachment);
  }, []);

  const handleOpenOriginalAttachment = useCallback((attachment: AttachmentItem) => {
    void repository.openAttachment(attachment.id)
      .catch((error) => notify(
        error instanceof Error ? error.message : "打开原文件失败",
      ));
  }, [notify, repository]);

  const handleSourceTitleUpdated = useCallback((
    recordId: number | null,
    title: string,
    updatedAt: string,
  ) => {
    if (recordId === null) return;
    const applyTitle = (records: RecordSummary[]) => records.map((record) => (
      record.id === recordId
        ? { ...record, title, displayTitle: title, updatedAt }
        : record
    ));
    setAllRecords(applyTitle);
    setVisibleRecords(applyTitle);
    setSelectedRecord((current) => current?.id === recordId
      ? { ...current, title, updatedAt }
      : current);
    detailCache.current.delete(recordId);
  }, []);

  const handleSourceActionRecordCreated = useCallback((
    record: IntelligenceRecord,
    primaryTopicName: string | null,
  ) => {
    const summary = {
      ...summaryFromRecord(record),
      primaryTopicName,
    };
    const upsert = (records: RecordSummary[]) => [
      summary,
      ...records.filter((item) => item.id !== summary.id),
    ];
    setAllRecords(upsert);
    if (!recordSearch.trim()) setVisibleRecords(upsert);
    detailCache.current.set(record.id, record);
  }, [recordSearch]);

  return (
    <div
      className={`app-shell ${coreWorkspaceActive ? "core-workspace-active" : ""}`}
      data-skin={skinId}
      style={skinStyle}
    >
      <Sidebar
        page={page}
        recordCount={allRecords.length}
        favoriteCount={navigationRecordCounts.favorites}
        trackingCount={navigationRecordCounts.tracking}
        updateCount={navigationRecordCounts.updates}
        trashCount={trashRecords.length}
        storageStats={storageStats}
        storageRefreshing={storageRefreshing}
        onRefreshStorage={() => {
          void refreshStorageStats()
            .then(() => notify("存储统计已刷新"))
            .catch((error) => notify(error instanceof Error ? error.message : "刷新存储统计失败"));
        }}
        onNavigate={(nextPage) => {
          setSettingsReturnTarget(null);
          setPage(nextPage);
        }}
      />
      <div className="main-region">
        {showRecords ? (
          loading ? <div className="page-loading"><span className="save-spinner" />正在读取本地记录…</div> : (
            <RecordsWorkspace
              records={visibleRecords}
              topicValues={unifiedNoteTopicValues}
              detailRecord={selectedRecord}
              attachments={attachments}
              scope={recordScope}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              search={recordSearch}
              setSearch={setRecordSearch}
              versions={recordVersions}
              onJudgmentChange={(value) => {
                if (selectedId === null) return;
                writeJudgmentDraft(selectedId, value);
                setSelectedRecord((current) => current?.id === selectedId
                  ? { ...current, currentJudgment: value }
                  : current);
                setSaveState("saving");
                setPendingSave({ id: selectedId, value, sequence: Date.now() });
              }}
              onToggleFavorite={(id) => void toggleFavorite(id)}
              onUpdateStatus={(id, status) => void updateStatus(id, status)}
              onMoveToTrash={(id) => void moveToTrash(id)}
              onShare={(id) => void openShare(id)}
              onAppendVersion={appendVersion}
              onRestoreVersion={restoreVersion}
              onDeleteVersion={deleteVersion}
              onEditRecord={setEditingRecord}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              saveState={saveState}
              onNotify={notify}
              attachmentBusy={attachmentBusy}
              onAddAttachment={() => {
                if (selectedId === null) return;
                if (!("__TAURI_INTERNALS__" in window)) {
                  notify("浏览器演示模式不能添加本机附件");
                  return;
                }
                void openFileDialog({ multiple: true, directory: false }).then(async (selected) => {
                  const paths = typeof selected === "string"
                    ? [selected]
                    : Array.isArray(selected)
                      ? selected
                      : [];
                  if (!paths.length) return;
                  setAttachmentBusy(true);
                  notify(`${paths.length} 个附件正在依次校验并归档，界面可以继续操作`);
                  try {
                    for (const path of paths) {
                      await repository.addAttachment(selectedId, path);
                    }
                    setAttachments(await repository.listAttachments(selectedId));
                    setStorageStats(await repository.getStorageStats());
                    notify(`${paths.length} 个附件已复制到受控目录；同名会话图片会自动显示`);
                  } finally {
                    setAttachmentBusy(false);
                  }
                }).catch((error) => {
                  setAttachmentBusy(false);
                  notify(error instanceof Error ? error.message : "添加附件失败");
                });
              }}
              onOpenAttachment={handleOpenAttachment}
              onRemoveAttachment={(attachmentId) => {
                void repository.removeAttachment(attachmentId)
                  .then(async () => {
                    if (selectedId !== null) setAttachments(await repository.listAttachments(selectedId));
                    setStorageStats(await repository.getStorageStats());
                    notify("附件已从受控目录删除");
                  })
                  .catch((error) => notify(error instanceof Error ? error.message : "删除附件失败"));
              }}
            />
          )
        ) : null}
        {page === "import" ? (
          <ImportCenter
            step={importStep}
            setStep={setImportStep}
            repository={repository}
            onImported={async (recordId) => {
              await reloadCollections(recordId);
            }}
            onNotify={notify}
            selectedRecordId={selectedId}
            currentSearch={recordSearch}
            onBackToSettings={() => {
              setSettingsReturnTarget("data-storage");
              setPage("settings");
            }}
          />
        ) : null}
        {page === "sources" || page === "topics" || page === "knowledge" ? (
          <Suspense fallback={<div className="page-loading"><span className="save-spinner" />正在加载知识工作台…</div>}>
            <LazyKnowledgeWorkspace
              repository={knowledgeRepository}
              mode={page}
              onNotify={notify}
              sourceNavigationTarget={knowledgeSourceTarget}
              onSourceNavigationHandled={handleSourceNavigationHandled}
              knowledgeNavigationTarget={knowledgeTopicTarget}
              onNavigateToSource={handleNavigateToSource}
              onNavigateToKnowledgeTopic={handleNavigateToKnowledgeTopic}
              records={allRecords}
              filterTopicValues={unifiedNoteTopicValues}
              onToggleRecordFavorite={toggleFavorite}
              onUpdateRecordStatus={updateStatus}
              onMoveRecordToTrash={moveToTrash}
              onExportRecord={openShare}
              onOpenAttachment={handleOpenAttachment}
              onSourceTitleUpdated={handleSourceTitleUpdated}
              onSourceActionRecordCreated={handleSourceActionRecordCreated}
              onSourceCollectionsChanged={() => reloadCollections()}
            />
          </Suspense>
        ) : null}
        {page === "trash" ? (
          <TrashPage
            records={trashRecords}
            onRestore={async (id) => {
              await repository.restoreRecord(id);
              await reloadCollections(id);
              notify("记录已恢复");
            }}
            onPermanentDelete={async (id) => {
              await repository.permanentlyDeleteRecord(id);
              await reloadCollections();
              notify("记录及其历史版本已永久删除");
            }}
            onPermanentDeleteAll={async () => {
              const ids = trashRecords.map((record) => record.id);
              for (const id of ids) {
                await repository.permanentlyDeleteRecord(id);
              }
              await reloadCollections();
              notify(`回收站已清空，共永久删除 ${ids.length} 条记录`);
            }}
          />
        ) : null}
        {page === "settings" ? (
          <SettingsPage
            repository={repository}
            skinId={skinId}
            onSkinChange={(nextSkinId) => {
              persistKnowledgeSkin(nextSkinId);
              setSkinId(nextSkinId);
            }}
            initialSetting={settingsReturnTarget === "data-storage" ? "数据与存储" : null}
            onSettingClosed={() => setSettingsReturnTarget(null)}
            onOpenTransfer={() => {
              setSettingsReturnTarget("data-storage");
              setPage("import");
            }}
            onDataRestored={async () => {
              setRecordSearch("");
              await reloadCollections();
            }}
            onNotify={notify}
            storageStats={storageStats}
            storageRefreshing={storageRefreshing}
            onRefreshStorage={refreshStorageStats}
          />
        ) : null}
      </div>
      <PrototypeNotice notice={notice} onClose={() => setNotice(null)} />
      {newRecordOpen ? <NewRecordDialog onClose={() => setNewRecordOpen(false)} onCreate={createRecord} /> : null}
      {editingRecord ? (
        <EditRecordDialog
          record={editingRecord}
          onClose={() => {
            const recordId = editingRecord.id;
            setEditingRecord(null);
            void repository.getRecord(recordId)
              .then(replaceRecord)
              .catch((error) => notify(error instanceof Error ? error.message : "刷新记录失败"));
          }}
          onAutosave={async (patch) => {
            const mutation = await repository.patchRecord(editingRecord.id, patch);
            const applyTimestamp = (current: RecordSummary[]) => current.map((item) =>
              item.id === mutation.recordId ? { ...item, updatedAt: mutation.updatedAt } : item);
            setAllRecords(applyTimestamp);
            setVisibleRecords(applyTimestamp);
          }}
          onSave={async (input) => {
            const updated = await repository.updateRecord(editingRecord.id, input);
            replaceRecord(updated);
            notify("完整记录已保存");
          }}
        />
      ) : null}
      {sharingRecord ? (
        <ShareRecordDialog
          record={sharingRecord}
          repository={repository}
          onClose={() => setSharingRecord(null)}
          onNotify={notify}
        />
      ) : null}
      {previewAttachment ? (
        <AttachmentPreview
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          onOpenOriginal={handleOpenOriginalAttachment}
        />
      ) : null}
    </div>
  );
}
