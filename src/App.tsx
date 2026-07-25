import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Braces,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cloud,
  Cpu,
  Database,
  FileCheck2,
  FileJson2,
  FileText,
  Files,
  Folder,
  FolderOpen,
  HardDrive,
  History,
  Inbox,
  Keyboard,
  LayoutGrid,
  Lock,
  MoreHorizontal,
  MoreVertical,
  Palette,
  Pencil,
  Plus,
  RadioTower,
  RotateCcw,
  Save,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Star,
  Tags,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  sampleJson,
} from "./mockData";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import {
  recordToUpdate,
  type IntelligenceRecord,
  type RecordStatus,
  type RecordVersion,
  type TagItem,
} from "./domain/models";
import {
  getRecordRepository,
  type RecordRepository,
} from "./services/recordRepository";

type Page = "records" | "tracking" | "updates" | "import" | "trash" | "settings";
type ImportStep = "empty" | "preview" | "mapping";
type SaveState = "idle" | "saving" | "saved";
type Notice = {
  id: number;
  message: string;
};
type ConnectionMetrics = {
  left: number;
  top: number;
  width: number;
};
type NavItem = {
  id: "inbox" | "records" | "tracking" | "updates" | "import";
  label: string;
  count?: number;
  icon: React.ComponentType<{ size?: number }>;
  disabled?: boolean;
  tone?: "danger";
};

type RecordIconKey = "cloud" | "chip" | "document" | "building" | "radio";

const iconMap: Record<RecordIconKey, React.ComponentType<{ size?: number }>> = {
  cloud: Cloud,
  chip: Cpu,
  document: FileText,
  building: Building2,
  radio: RadioTower,
};

const navItems: NavItem[] = [
  { id: "inbox", label: "收录箱", count: 0, icon: Inbox, disabled: true },
  { id: "records", label: "全部记录", icon: Files },
  { id: "tracking", label: "持续跟踪", icon: RadioTower },
  { id: "updates", label: "判断更新", icon: FileCheck2, tone: "danger" },
  { id: "import", label: "导入中心", icon: Upload },
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

function recordSourceLabel(record: IntelligenceRecord): string {
  return record.sources[0]?.title || record.summary || "本地记录";
}

function recordIconKey(record: IntelligenceRecord): RecordIconKey {
  const text = `${record.title} ${record.tags.join(" ")}`;
  if (/云|算力|AI/i.test(text)) return "cloud";
  if (/芯片|半导体|设备|GPU/i.test(text)) return "chip";
  if (/运营商|网络|通信/i.test(text)) return "radio";
  if (/公司|企业|产业链|厂商/i.test(text)) return "building";
  return "document";
}

function statusLabel(status: RecordStatus): string {
  return {
    normal: "普通记录",
    tracking: "持续跟踪",
    verification: "待验证",
    updated: "判断更新",
  }[status];
}

function AppCard({
  children,
  className = "",
  onClick,
  cardRef,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  cardRef?: React.Ref<HTMLElement>;
}) {
  return (
    <section
      ref={cardRef}
      className={`elevated-card ${className}`}
      onClick={onClick}
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
      <button onClick={onClose} aria-label="关闭提示"><X size={15} /></button>
    </div>
  );
}

function PrototypeDialog({
  eyebrow,
  title,
  onClose,
  children,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return createPortal(
    <div className="prototype-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="prototype-dialog elevated-card"
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
      </section>
    </div>,
    document.body,
  );
}

function Sidebar({
  page,
  recordCount,
  trackingCount,
  updateCount,
  trashCount,
  tags,
  onNavigate,
  onNotify,
  onSelectTag,
}: {
  page: Page;
  recordCount: number;
  trackingCount: number;
  updateCount: number;
  trashCount: number;
  tags: TagItem[];
  onNavigate: (page: Page) => void;
  onNotify: (message: string) => void;
  onSelectTag: (tag: string) => void;
}) {
  const [tagsOpen, setTagsOpen] = useState(false);
  const counts: Partial<Record<NavItem["id"], number>> = {
    records: recordCount,
    tracking: trackingCount,
    updates: updateCount,
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Sprout size={24} strokeWidth={2.2} /></div>
        <div>
          <strong>南枫情报台</strong>
          <span>本地研究档案与判断版本库</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="主导航">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === page;
          return (
            <button
              className={`nav-item ${isActive ? "active" : ""} ${item.tone ?? ""}`}
              key={item.id}
              onClick={() => item.disabled
                ? onNotify("收录箱将在真实文件入口接入后开放；当前不读取本机文件")
                : onNavigate(item.id as Page)}
              aria-current={isActive ? "page" : undefined}
              aria-disabled={item.disabled}
              title={item.disabled ? "首轮原型暂未开放" : item.label}
            >
              <Icon size={20} />
              <span className="nav-label">{item.label}</span>
              {(counts[item.id] ?? item.count) !== undefined
                ? <span className="nav-count">{counts[item.id] ?? item.count}</span>
                : null}
            </button>
          );
        })}
        <div className="nav-separator" />
        <button
          className={`nav-item tag-button ${tagsOpen ? "expanded" : ""}`}
          onClick={() => setTagsOpen((open) => !open)}
          aria-expanded={tagsOpen}
        >
          <Tags size={20} />
          <span className="nav-label">标签</span>
          <ChevronDown size={16} className="nav-tail" />
        </button>
        {tagsOpen ? (
          <div className="sidebar-tag-menu">
            {tags.slice(0, 8).map((tag) => (
              <button
                key={tag.id}
                onClick={() => {
                  onSelectTag(tag.name);
                  setTagsOpen(false);
                }}
              >
                <span>{tag.name}</span><em>{tag.recordCount}</em><ChevronRight size={14} />
              </button>
            ))}
            {!tags.length ? <span className="sidebar-empty">暂无标签</span> : null}
          </div>
        ) : null}
      </nav>

      <div className="sidebar-bottom">
        <button className={`nav-item ${page === "trash" ? "active" : ""}`} onClick={() => onNavigate("trash")}>
          <Trash2 size={20} />
          <span className="nav-label">回收站</span>
          <span className="nav-count">{trashCount}</span>
        </button>
        <button className={`nav-item ${page === "settings" ? "active" : ""}`} onClick={() => onNavigate("settings")}>
          <Settings size={20} />
          <span className="nav-label">设置</span>
        </button>
        <div className="storage">
          <div className="storage-title"><HardDrive size={16} /><span>本地存储</span></div>
          <div className="storage-copy">{recordCount} 条本地记录</div>
          <div className="storage-track"><span style={{ width: `${Math.min(100, Math.max(8, recordCount))}%` }} /></div>
        </div>
      </div>
    </aside>
  );
}

function AppHeader({
  saveState,
  onNotify,
  onCreateRecord,
  onExportCurrent,
}: {
  saveState: SaveState;
  onNotify: (message: string) => void;
  onCreateRecord: () => void;
  onExportCurrent: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const runAction = (message: string) => {
    onNotify(message);
    setMenuOpen(false);
  };

  return (
    <div className="app-header">
      <div className={`save-indicator ${saveState}`}>
        {saveState === "saving" ? <span className="save-spinner" /> : <CheckCircle2 size={17} />}
        <span>{saveState === "saving" ? "正在保存" : "已保存"}</span>
      </div>
      <div className="header-menu-wrap">
        <button
          className="icon-button"
          aria-label="更多操作"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreHorizontal size={20} />
        </button>
        {menuOpen ? (
          <div className="action-menu header-action-menu">
            <button onClick={() => { setMenuOpen(false); onCreateRecord(); }}><Plus size={16} />新建记录</button>
            <button onClick={() => { setMenuOpen(false); onExportCurrent(); }}><Save size={16} />导出当前记录</button>
            <button onClick={() => runAction("快捷键：Ctrl/⌘ K 搜索，Ctrl/⌘ E 编辑，Ctrl/⌘ Shift I 导入")}><Keyboard size={16} />快捷键说明</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RecordIcon({ record }: { record: IntelligenceRecord }) {
  const iconKey = recordIconKey(record);
  const Icon = iconMap[iconKey];
  return <div className={`record-icon ${iconKey}`}><Icon size={23} /></div>;
}

function RecordList({
  records,
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
  onNotify,
}: {
  records: IntelligenceRecord[];
  scope: "records" | "tracking" | "updates";
  selectedId: number | null;
  onSelect: (id: number) => void;
  search: string;
  setSearch: (value: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  onSelectedGeometryChange: (metrics: ConnectionMetrics | null) => void;
  onToggleFavorite: (id: number) => void;
  onUpdateStatus: (id: number, status: RecordStatus) => void;
  onMoveToTrash: (id: number) => void;
  onNotify: (message: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("全部来源");
  const [sortMode, setSortMode] = useState<"default" | "desc" | "asc">("default");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const scopedRecords = scope === "tracking"
      ? records.filter((record) => record.status === "tracking")
      : scope === "updates"
        ? records.filter((record) => record.status === "updated")
        : records;
    const matches = scopedRecords
      .filter((record) => !keyword || [
        record.title,
        record.summary,
        record.currentJudgment,
        ...record.tags,
      ].join(" ").toLowerCase().includes(keyword))
      .filter((record) => sourceFilter === "全部来源" || recordSourceLabel(record) === sourceFilter);
    if (sortMode === "default") return matches;
    return [...matches].sort((a, b) => sortMode === "asc"
      ? a.updatedAt.localeCompare(b.updatedAt)
      : b.updatedAt.localeCompare(a.updatedAt));
  }, [records, scope, search, sortMode, sourceFilter]);

  useEffect(() => {
    if (filtered.some((record) => record.id === selectedId)) return;
    if (filtered[0]) onSelect(filtered[0].id);
  }, [filtered, onSelect, selectedId]);

  const sourceOptions = useMemo(() => [
    "全部来源",
    ...new Set(records.map(recordSourceLabel).filter(Boolean)),
  ], [records]);

  const shareRecord = async (record: IntelligenceRecord) => {
    const shareText = `${record.title} · 南枫情报台本地记录`;
    try {
      await navigator.clipboard.writeText(shareText);
      onNotify("记录摘要已复制，可粘贴分享");
    } catch {
      onNotify("已生成记录分享摘要（浏览器未授予剪贴板权限）");
    }
  };

  const copyRecordTitle = async (record: IntelligenceRecord) => {
    try {
      await navigator.clipboard.writeText(record.title);
      onNotify("记录标题已复制");
    } catch {
      onNotify("已生成记录标题（浏览器未授予剪贴板权限）");
    }
    setOpenMenuId(null);
  };

  const scopeLabel = scope === "updates" ? "判断更新" : scope === "tracking" ? "持续跟踪" : "全部记录";

  useLayoutEffect(() => {
    const updateGeometry = () => {
      const card = selectedCardRef.current;
      const workspace = card?.closest<HTMLElement>(".records-workspace");
      const detailPanel = workspace?.querySelector<HTMLElement>(".detail-panel");
      if (!card || !workspace || !detailPanel) {
        onSelectedGeometryChange(null);
        return;
      }

      const cardRect = card.getBoundingClientRect();
      const workspaceRect = workspace.getBoundingClientRect();
      const detailRect = detailPanel.getBoundingClientRect();
      const left = cardRect.right - workspaceRect.left;
      const width = Math.max(0, detailRect.left - cardRect.right + 1);

      onSelectedGeometryChange({
        left,
        top: cardRect.top - workspaceRect.top + cardRect.height / 2,
        width,
      });
    };

    const frame = window.requestAnimationFrame(updateGeometry);
    const list = listRef.current;
    const resizeObserver = new ResizeObserver(updateGeometry);
    const card = selectedCardRef.current;
    const workspace = card?.closest<HTMLElement>(".records-workspace");
    const detailPanel = workspace?.querySelector<HTMLElement>(".detail-panel");

    if (card) resizeObserver.observe(card);
    if (workspace) resizeObserver.observe(workspace);
    if (detailPanel) resizeObserver.observe(detailPanel);
    list?.addEventListener("scroll", updateGeometry, { passive: true });
    window.addEventListener("resize", updateGeometry);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      list?.removeEventListener("scroll", updateGeometry);
      window.removeEventListener("resize", updateGeometry);
    };
  }, [filtered.length, onSelectedGeometryChange, selectedId]);

  return (
    <section className="record-pane">
      <div className="search-row">
        <label className="search-field">
          <Search size={19} />
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索记录"
            aria-label="搜索记录"
          />
          {search ? (
            <button onClick={() => setSearch("")} aria-label="清除搜索"><X size={15} /></button>
          ) : <kbd>⌘ K</kbd>}
        </label>
        <div className="filter-wrap">
          <button
            className={`filter-button ${filterOpen ? "active" : ""}`}
            onClick={() => setFilterOpen((open) => !open)}
            aria-expanded={filterOpen}
          >
            <SlidersHorizontal size={17} /><span>筛选</span>
          </button>
          {filterOpen ? (
            <div className="filter-popover elevated-card">
              <strong>来源</strong>
              {sourceOptions.map((source) => (
                <button
                  className={sourceFilter === source ? "selected" : ""}
                  key={source}
                  onClick={() => {
                    setSourceFilter(source);
                    setFilterOpen(false);
                  }}
                >
                  <span>{source}</span>{sourceFilter === source ? <Check size={15} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="list-toolbar">
        <span>{scopeLabel} · 找到 {filtered.length} 条记录</span>
        <button
          onClick={() => setSortMode((mode) => mode === "default" ? "desc" : mode === "desc" ? "asc" : "default")}
          aria-label={`当前${sortMode === "default" ? "默认顺序" : sortMode === "desc" ? "最新优先" : "最早优先"}，点击切换排序`}
        >
          {sortMode === "default" ? "按更新时间" : sortMode === "desc" ? "最新优先" : "最早优先"}
          <ChevronDown size={15} className={sortMode === "asc" ? "flipped" : ""} />
        </button>
      </div>

      <div className="records-list" ref={listRef}>
        {filtered.length ? filtered.map((record) => {
          const selected = record.id === selectedId;
          return (
            <AppCard
              key={record.id}
              className={`record-card ${selected ? "selected" : ""}`}
              onClick={() => onSelect(record.id)}
              cardRef={selected ? selectedCardRef : undefined}
            >
              <RecordIcon record={record} />
              <div className="record-copy">
                <strong>{record.title}</strong>
                <div className="tag-line">{record.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                <div className="record-source">{recordSourceLabel(record)}</div>
              </div>
              <div className="record-side">
                <span className="record-date">{formatRecordDate(record.updatedAt)}</span>
                <div className="quick-actions" onClick={(event) => event.stopPropagation()}>
                  <button
                    className={record.isFavorite ? "active" : ""}
                    aria-label={record.isFavorite ? "取消收藏" : "收藏"}
                    onClick={() => onToggleFavorite(record.id)}
                  >
                    <Star size={17} fill={record.isFavorite ? "currentColor" : "none"} />
                  </button>
                  <button aria-label="分享" onClick={() => void shareRecord(record)}><Share2 size={17} /></button>
                  <button
                    aria-label="更多"
                    aria-expanded={openMenuId === record.id}
                    onClick={() => setOpenMenuId((id) => id === record.id ? null : record.id)}
                  >
                    <MoreHorizontal size={17} />
                  </button>
                </div>
                {openMenuId === record.id ? (
                  <div className="action-menu record-action-menu" onClick={(event) => event.stopPropagation()}>
                    <button onClick={() => { onSelect(record.id); setOpenMenuId(null); }}>查看详情</button>
                    <button onClick={() => {
                      onUpdateStatus(record.id, record.status === "tracking" ? "normal" : "tracking");
                      setOpenMenuId(null);
                    }}>
                      {record.status === "tracking" ? "停止持续跟踪" : "加入持续跟踪"}
                    </button>
                    <button onClick={() => void copyRecordTitle(record)}>复制标题</button>
                    <button className="danger" onClick={() => {
                      onMoveToTrash(record.id);
                      setOpenMenuId(null);
                    }}>移至回收站</button>
                  </div>
                ) : null}
                <span className={`status-dot ${record.status}`}><i />{statusLabel(record.status)}</span>
              </div>
            </AppCard>
          );
        }) : (
          <div className="empty-state">
            <Search size={30} />
            <strong>没有找到相关记录</strong>
            <span>换一个关键词，或清除当前搜索。</span>
            <button className="text-button" onClick={() => setSearch("")}>清除搜索</button>
          </div>
        )}
        {filtered.length > 0 ? <div className="list-end"><span />没有更多了<span /></div> : null}
      </div>
    </section>
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

function DetailPanel({
  record,
  versions,
  onJudgmentChange,
  onAppendVersion,
  onRestoreVersion,
  isEditing,
  setIsEditing,
  saveState,
  onToggleFavorite,
  onNotify,
}: {
  record: IntelligenceRecord;
  versions: RecordVersion[];
  onJudgmentChange: (value: string) => void;
  onAppendVersion: () => Promise<void>;
  onRestoreVersion: (versionId: number) => Promise<void>;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  saveState: SaveState;
  onToggleFavorite: () => void;
  onNotify: (message: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versionAdded, setVersionAdded] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"facts" | "evidence" | "questions" | "actions" | null>(null);
  const [viewingVersion, setViewingVersion] = useState<RecordVersion | null>(null);

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
    <article className="detail-panel elevated-card">
      <div className="detail-title-row">
        <div>
          <h1>{record.title}</h1>
          <div className="detail-meta">
            <span className="status-pill">{statusLabel(record.status)}</span>
            <span>{formatRecordDateTime(record.updatedAt)} 更新</span>
            <span>{recordSourceLabel(record)}</span>
            {record.tags.map((tag) => <span className="detail-tag" key={tag}>{tag}</span>)}
          </div>
        </div>
        <button
          className={`favorite-button ${record.isFavorite ? "active" : ""}`}
          aria-label={record.isFavorite ? "取消收藏" : "收藏"}
          onClick={onToggleFavorite}
        >
          <Star size={20} fill={record.isFavorite ? "currentColor" : "none"} />
        </button>
      </div>

      <AppCard className={`judgment-card ${isEditing ? "editing" : ""}`}>
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
              <span className={saveState}>{saveState === "saving" ? "正在保存草稿…" : "本地草稿已保存"}</span>
            </div>
          </div>
        ) : <p className="judgment-text">{record.currentJudgment || "尚未填写当前判断。"}</p>}
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
          <div className="check-list">{record.nextActions.slice(0, 3).map((item) => <label key={item}><input type="checkbox" /><span>{item}</span></label>)}</div>
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
            <div className="version-row" key={item.id}>
              <span className="version-badge">v{item.versionNumber}</span>
              <div><strong>{item.versionTitle}</strong><span>{formatRecordDateTime(item.createdAt)}</span></div>
              <button onClick={() => setViewingVersion(item)}>查看</button>
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
            <button className="secondary-button" onClick={async () => {
              await onRestoreVersion(viewingVersion.id);
              setViewingVersion(null);
            }}><RotateCcw size={17} />恢复为新版本</button>
          </div>
        </PrototypeDialog>
      ) : null}
    </article>
  );
}

function RecordsWorkspace({
  records,
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
  onAppendVersion,
  onRestoreVersion,
  isEditing,
  setIsEditing,
  saveState,
  onNotify,
}: {
  records: IntelligenceRecord[];
  scope: "records" | "tracking" | "updates";
  selectedId: number | null;
  setSelectedId: (value: number | null) => void;
  search: string;
  setSearch: (value: string) => void;
  versions: RecordVersion[];
  onJudgmentChange: (value: string) => void;
  onToggleFavorite: (id: number) => void;
  onUpdateStatus: (id: number, status: RecordStatus) => void;
  onMoveToTrash: (id: number) => void;
  onAppendVersion: () => Promise<void>;
  onRestoreVersion: (versionId: number) => Promise<void>;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  saveState: SaveState;
  onNotify: (message: string) => void;
}) {
  const [connectionMetrics, setConnectionMetrics] = useState<ConnectionMetrics | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedRecord = records.find((record) => record.id === selectedId) ?? null;

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
      className="records-workspace"
      style={connectionMetrics ? {
        "--connection-left": `${connectionMetrics.left}px`,
        "--connection-top": `${connectionMetrics.top}px`,
        "--connection-width": `${connectionMetrics.width}px`,
      } as React.CSSProperties : undefined}
    >
      <RecordList
        records={records}
        scope={scope}
        selectedId={selectedId}
        onSelect={setSelectedId}
        search={search}
        setSearch={setSearch}
        searchRef={searchRef}
        onSelectedGeometryChange={setConnectionMetrics}
        onToggleFavorite={onToggleFavorite}
        onUpdateStatus={onUpdateStatus}
        onMoveToTrash={onMoveToTrash}
        onNotify={onNotify}
      />
      {connectionMetrics && connectionMetrics.width > 0 ? (
        <div className="record-detail-connector" aria-hidden="true">
          <span className="connector-dot start" />
          <span className="connector-dot end" />
        </div>
      ) : null}
      {selectedRecord ? (
        <DetailPanel
          record={selectedRecord}
          versions={versions}
          onJudgmentChange={onJudgmentChange}
          onAppendVersion={onAppendVersion}
          onRestoreVersion={onRestoreVersion}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          saveState={saveState}
          onToggleFavorite={() => onToggleFavorite(selectedRecord.id)}
          onNotify={onNotify}
        />
      ) : (
        <article className="detail-panel elevated-card empty-detail">
          <FileText size={36} />
          <strong>还没有可显示的记录</strong>
          <span>新建一条记录，或调整左侧的筛选条件。</span>
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

function ImportCenter({
  step,
  setStep,
}: {
  step: ImportStep;
  setStep: (step: ImportStep) => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const loadDemo = () => setStep("preview");
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    setStep("preview");
  };

  if (step === "mapping") return <JsonMapping onBack={() => setStep("preview")} />;

  return (
    <main className="page-shell">
      <PageTitle
        eyebrow="本地文件 · 安全预览"
        title="导入中心"
        description="先保留原始文件，再进行结构识别、字段映射和重复检查。当前原型不会写入真实数据。"
        action={<button className="secondary-button" onClick={loadDemo}><FileJson2 size={18} />载入 JSON 示例</button>}
      />
      <div className="import-layout">
        <div className="import-primary">
          <AppCard
            className={`drop-zone ${dragActive ? "drag-active" : ""} ${step === "preview" ? "has-file" : ""}`}
          >
            <div
              className="drop-target"
              onDragEnter={() => setDragActive(true)}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              {step === "empty" ? (
                <>
                  <div className="drop-icon"><Upload size={26} /></div>
                  <strong>拖入 JSON、Markdown、TXT 或 HTML 文件</strong>
                  <span>首轮演示优先使用标准 JSON；文件只在本机预览。</span>
                  <button className="primary-button" onClick={loadDemo}><FolderOpen size={18} />选择文件</button>
                </>
              ) : (
                <div className="file-row">
                  <div className="file-type"><Braces size={24} /></div>
                  <div><strong>ai-capex-research.json</strong><span>4.2 KB · UTF-8 · 标准 JSON</span></div>
                  <span className="recognized"><CheckCircle2 size={17} />识别完成</span>
                  <button className="icon-button" onClick={() => setStep("empty")}><X size={18} /></button>
                </div>
              )}
            </div>
          </AppCard>
          <AppCard className="import-notice">
            <ShieldCheck size={21} />
            <div><strong>原始文件保护</strong><span>正式版本将在解析前复制原始文件并计算 SHA-256；原型仅演示流程。</span></div>
          </AppCard>
        </div>

        <AppCard className="preview-card">
          <div className="preview-heading"><span><FileJson2 size={19} />原始内容预览</span><em>{step === "preview" ? "7 个可映射字段" : "等待文件"}</em></div>
          {step === "preview" ? <pre>{sampleJson}</pre> : (
            <div className="preview-empty"><FileText size={31} /><span>选择文件后在这里检查原始内容</span></div>
          )}
          <div className="import-summary">
            <div><span>预计生成</span><strong>{step === "preview" ? "1" : "—"} 条记录</strong></div>
            <div><span>重复风险</span><strong>{step === "preview" ? "低" : "—"}</strong></div>
          </div>
          <button className="primary-button full" disabled={step !== "preview"} onClick={() => setStep("mapping")}>
            继续字段映射 <ArrowRight size={18} />
          </button>
        </AppCard>
      </div>
    </main>
  );
}

function JsonMapping({ onBack }: { onBack: () => void }) {
  const mappings = [
    ["title", "标题", "AI资本开支与自由现金流"],
    ["summary", "摘要", "AI基础设施投入短期压制自由现金流"],
    ["status", "状态", "tracking → 持续跟踪"],
    ["tags", "标签", "资本开支 / 自由现金流 / 云计算"],
    ["current_judgment", "当前判断", "短期现金流承压，但长期回报…"],
    ["created_at", "创建时间", "2026-07-25 10:00"],
  ];
  const [completed, setCompleted] = useState(false);
  return (
    <main className="page-shell mapping-page">
      <button className="back-button" onClick={onBack}><ArrowLeft size={18} />返回导入预览</button>
      <PageTitle eyebrow="导入中心 · 第 2 步" title="JSON 字段映射" description="确认源字段与情报记录结构的对应关系，导入前仍可返回修改。" />
      <div className="mapping-layout">
        <AppCard className="mapping-card">
          <div className="mapping-header"><strong>源字段</strong><strong>映射到</strong><strong>预览值</strong></div>
          {mappings.map(([source, target, value]) => (
            <div className="mapping-row" key={source}>
              <code>{source}</code>
              <div className="mapping-select"><span>{target}</span><ChevronDown size={16} /></div>
              <span>{value}</span>
            </div>
          ))}
        </AppCard>
        <div className="mapping-side">
          <AppCard className="mapping-result">
            <div className="result-title"><LayoutGrid size={20} /><strong>导入结果预览</strong></div>
            <div className="result-metric"><strong>1</strong><span>预计新增记录</span></div>
            <div className="result-check"><CheckCircle2 size={17} /><span>标准 Schema 1.0</span></div>
            <div className="result-check"><CheckCircle2 size={17} /><span>未检测到文件哈希重复</span></div>
            <label><input type="checkbox" defaultChecked />保留原始 JSON 文件</label>
            <label><input type="checkbox" defaultChecked />创建结构化研究记录</label>
            <button className="primary-button full" onClick={() => setCompleted(true)}>
              <Check size={18} />确认导入演示
            </button>
          </AppCard>
          {completed ? <div className="success-banner"><CheckCircle2 size={19} /><span>演示完成：已生成 1 条预览记录，未写入数据库。</span></div> : null}
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
  const [tags, setTags] = useState("");
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
              tags: tags.split(/[,，/]/).map((item) => item.trim()).filter(Boolean),
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
        <div className="form-grid">
          <label>
            <span>状态</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as RecordStatus)}>
              <option value="normal">普通记录</option>
              <option value="tracking">持续跟踪</option>
              <option value="verification">待验证</option>
              <option value="updated">判断更新</option>
            </select>
          </label>
          <label>
            <span>标签</span>
            <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="用逗号分隔" />
          </label>
        </div>
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

function TrashPage({
  records,
  onRestore,
  onPermanentDelete,
}: {
  records: IntelligenceRecord[];
  onRestore: (id: number) => Promise<void>;
  onPermanentDelete: (id: number, title: string) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState<IntelligenceRecord | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  return (
    <main className="page-shell">
      <PageTitle eyebrow="可恢复删除" title="回收站" description="移入回收站的记录仍保留版本关系；永久删除必须输入完整标题确认。" />
      <div className="trash-grid">
        {records.map((record) => (
          <AppCard className="trash-card" key={record.id}>
            <RecordIcon record={record} />
            <div><strong>{record.title}</strong><span>删除于 {record.deletedAt ? formatRecordDateTime(record.deletedAt) : "未知时间"}</span></div>
            <button
              className="secondary-button"
              onClick={() => void onRestore(record.id)}
            >
              <RotateCcw size={17} />恢复
            </button>
            <button className="danger-button" onClick={() => {
              setDeleting(record);
              setConfirmation("");
              setError("");
            }}><Trash2 size={17} />永久删除</button>
          </AppCard>
        ))}
        {!records.length ? (
          <div className="empty-state wide"><Trash2 size={32} /><strong>回收站为空</strong><span>这里没有待恢复或永久删除的记录。</span></div>
        ) : null}
      </div>
      {deleting ? (
        <PrototypeDialog eyebrow="不可恢复操作" title="永久删除记录" onClose={() => setDeleting(null)}>
          <div className="delete-confirmation">
            <div className="danger-callout"><AlertCircle size={19} /><span>此操作会删除记录及其历史版本，无法撤销。</span></div>
            <p>请输入完整标题确认：<strong>{deleting.title}</strong></p>
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoFocus />
            {error ? <div className="form-error"><AlertCircle size={16} />{error}</div> : null}
            <div className="dialog-actions">
              <button className="secondary-button" onClick={() => setDeleting(null)}>取消</button>
              <button
                className="danger-button"
                disabled={confirmation !== deleting.title}
                onClick={async () => {
                  try {
                    await onPermanentDelete(deleting.id, confirmation);
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
    </main>
  );
}

function SettingsPage({
  repository,
  onNotify,
}: {
  repository: RecordRepository;
  onNotify: (message: string) => void;
}) {
  const [dataLocation, setDataLocation] = useState("正在读取…");
  const groups = [
    { icon: Database, title: "数据与存储", copy: "数据目录、完整性检查与索引维护", value: dataLocation },
    { icon: Palette, title: "外观", copy: "界面密度、字号与主题", value: "标准 · 浅色" },
    { icon: Bell, title: "提醒", copy: "跟踪记录与行动项提醒", value: "仅应用内" },
    { icon: Lock, title: "隐私与安全", copy: "离线策略与文件访问权限", value: "离线优先" },
    { icon: Keyboard, title: "快捷键", copy: "搜索、编辑和导入快捷方式", value: "查看全部" },
  ];
  const [selectedSetting, setSelectedSetting] = useState<string | null>(null);
  const activeSetting = groups.find((group) => group.title === selectedSetting);
  const ActiveSettingIcon = activeSetting?.icon;

  useEffect(() => {
    void repository.getDataLocation()
      .then((location) => setDataLocation(location.root))
      .catch((error) => setDataLocation(error instanceof Error ? error.message : "读取失败"));
  }, [repository]);

  return (
    <main className="page-shell settings-page">
      <PageTitle eyebrow="本地优先" title="设置" description="查看真实数据位置，并执行可恢复的数据库维护操作。" />
      <div className="settings-list">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <AppCard className="settings-row" key={group.title}>
              <div className="settings-icon"><Icon size={21} /></div>
              <div><strong>{group.title}</strong><span>{group.copy}</span></div>
              <button onClick={() => setSelectedSetting(group.title)}>
                <span>{group.value}</span><ChevronRight size={18} />
              </button>
            </AppCard>
          );
        })}
      </div>
      {activeSetting && ActiveSettingIcon ? (
        <PrototypeDialog eyebrow="设置预览" title={activeSetting.title} onClose={() => setSelectedSetting(null)}>
          <div className="setting-preview">
            <div className="settings-icon"><ActiveSettingIcon size={22} /></div>
            <div><strong>{activeSetting.value}</strong><p>{activeSetting.copy}</p></div>
          </div>
          {activeSetting.title === "数据与存储" ? (
            <div className="settings-actions">
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
            </div>
          ) : <div className="dialog-footnote">此设置项将在后续增量中继续完善。</div>}
        </PrototypeDialog>
      ) : null}
    </main>
  );
}

export function App() {
  const repository = useMemo(() => getRecordRepository(), []);
  const [page, setPage] = useState<Page>("records");
  const [allRecords, setAllRecords] = useState<IntelligenceRecord[]>([]);
  const [visibleRecords, setVisibleRecords] = useState<IntelligenceRecord[]>([]);
  const [trashRecords, setTrashRecords] = useState<IntelligenceRecord[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [recordVersions, setRecordVersions] = useState<RecordVersion[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [pendingSave, setPendingSave] = useState<{ id: number; value: string; sequence: number } | null>(null);
  const [importStep, setImportStep] = useState<ImportStep>("empty");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [recordSearch, setRecordSearch] = useState("");
  const [newRecordOpen, setNewRecordOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const notify = (message: string) => setNotice({ id: Date.now(), message });

  const replaceRecord = (record: IntelligenceRecord) => {
    setAllRecords((current) => current.map((item) => item.id === record.id ? record : item));
    setVisibleRecords((current) => current.map((item) => item.id === record.id ? record : item));
  };

  const reloadCollections = async (preferredId?: number) => {
    const [active, deleted, availableTags] = await Promise.all([
      repository.listRecords(),
      repository.listRecords({ deletedOnly: true }),
      repository.listTags(),
    ]);
    setAllRecords(active);
    setTrashRecords(deleted);
    setTags(availableTags);
    const searched = recordSearch.trim()
      ? await repository.listRecords({ search: recordSearch.trim() })
      : active;
    setVisibleRecords(searched);
    setSelectedId((current) => {
      const nextId = preferredId ?? current;
      return active.some((record) => record.id === nextId) ? nextId! : active[0]?.id ?? null;
    });
  };

  useEffect(() => {
    void reloadCollections()
      .catch((error) => notify(error instanceof Error ? error.message : "读取本地记录失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void repository.listRecords(recordSearch.trim() ? { search: recordSearch.trim() } : {})
        .then((result) => setVisibleRecords(result))
        .catch((error) => notify(error instanceof Error ? error.message : "搜索失败"));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [recordSearch, repository]);

  useEffect(() => {
    if (selectedId === null) {
      setRecordVersions([]);
      return;
    }
    void repository.listVersions(selectedId)
      .then(setRecordVersions)
      .catch((error) => notify(error instanceof Error ? error.message : "读取历史版本失败"));
  }, [repository, selectedId]);

  useEffect(() => {
    if (!pendingSave) return;
    const timer = window.setTimeout(async () => {
      try {
        const persisted = await repository.getRecord(pendingSave.id);
        const updated = await repository.updateRecord(pendingSave.id, recordToUpdate({
          ...persisted,
          currentJudgment: pendingSave.value,
        }));
        replaceRecord(updated);
        setSaveState("saved");
      } catch (error) {
        setSaveState("idle");
        notify(error instanceof Error ? error.message : "自动保存失败");
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [pendingSave, repository]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "i") {
        event.preventDefault();
        setPage("import");
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setNewRecordOpen(true);
      }
      if (event.key === "Escape") setIsEditing(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const showRecords = page === "records" || page === "tracking" || page === "updates";
  const recordScope = page === "tracking" ? "tracking" : page === "updates" ? "updates" : "records";

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selectedRecord = allRecords.find((record) => record.id === selectedId) ?? null;

  const createRecord = async (input: {
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
  };

  const toggleFavorite = async (recordId: number) => {
    try {
      const record = await repository.getRecord(recordId);
      const updated = await repository.setFavorite(recordId, !record.isFavorite);
      replaceRecord(updated);
      notify(updated.isFavorite ? "已加入收藏" : "已取消收藏");
    } catch (error) {
      notify(error instanceof Error ? error.message : "收藏操作失败");
    }
  };

  const updateStatus = async (recordId: number, status: RecordStatus) => {
    try {
      const record = await repository.getRecord(recordId);
      const updated = await repository.updateRecord(recordId, recordToUpdate({ ...record, status }));
      replaceRecord(updated);
      notify(`记录状态已更新为“${statusLabel(status)}”`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "状态更新失败");
    }
  };

  const moveToTrash = async (recordId: number) => {
    try {
      await repository.moveToTrash(recordId);
      await reloadCollections();
      notify("记录已移入回收站，可随时恢复");
    } catch (error) {
      notify(error instanceof Error ? error.message : "移入回收站失败");
    }
  };

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

  const exportCurrent = () => {
    if (!selectedRecord) {
      notify("请先选择要导出的记录");
      return;
    }
    const markdown = [
      `# ${selectedRecord.title}`,
      "",
      selectedRecord.summary,
      "",
      "## 当前判断",
      "",
      selectedRecord.currentJudgment,
      "",
      "## 已确认事实",
      "",
      ...selectedRecord.confirmedFacts.map((item) => `- ${item}`),
      "",
      "## 待验证问题",
      "",
      ...selectedRecord.openQuestions.map((item) => `- ${item}`),
      "",
      "## 下一步行动",
      "",
      ...selectedRecord.nextActions.map((item) => `- ${item}`),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedRecord.title.replace(/[\\/:*?"<>|]/g, "_")}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("当前记录已导出为 Markdown");
  };

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        recordCount={allRecords.length}
        trackingCount={allRecords.filter((record) => record.status === "tracking").length}
        updateCount={allRecords.filter((record) => record.status === "updated").length}
        trashCount={trashRecords.length}
        tags={tags}
        onNavigate={setPage}
        onNotify={notify}
        onSelectTag={(tag) => {
          setRecordSearch(tag);
          setPage("records");
          notify(`已按“${tag}”筛选记录`);
        }}
      />
      <div className="main-region">
        <AppHeader
          saveState={saveState}
          onNotify={notify}
          onCreateRecord={() => setNewRecordOpen(true)}
          onExportCurrent={exportCurrent}
        />
        {showRecords ? (
          loading ? <div className="page-loading"><span className="save-spinner" />正在读取本地记录…</div> : (
            <RecordsWorkspace
              records={visibleRecords}
              scope={recordScope}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              search={recordSearch}
              setSearch={setRecordSearch}
              versions={recordVersions}
              onJudgmentChange={(value) => {
                if (selectedId === null) return;
                setVisibleRecords((current) => current.map((record) =>
                  record.id === selectedId ? { ...record, currentJudgment: value } : record));
                setAllRecords((current) => current.map((record) =>
                  record.id === selectedId ? { ...record, currentJudgment: value } : record));
                setSaveState("saving");
                setPendingSave({ id: selectedId, value, sequence: Date.now() });
              }}
              onToggleFavorite={(id) => void toggleFavorite(id)}
              onUpdateStatus={(id, status) => void updateStatus(id, status)}
              onMoveToTrash={(id) => void moveToTrash(id)}
              onAppendVersion={appendVersion}
              onRestoreVersion={restoreVersion}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              saveState={saveState}
              onNotify={notify}
            />
          )
        ) : null}
        {page === "import" ? <ImportCenter step={importStep} setStep={setImportStep} /> : null}
        {page === "trash" ? (
          <TrashPage
            records={trashRecords}
            onRestore={async (id) => {
              await repository.restoreRecord(id);
              await reloadCollections(id);
              notify("记录已恢复");
            }}
            onPermanentDelete={async (id, title) => {
              await repository.permanentlyDeleteRecord(id, title);
              await reloadCollections();
              notify("记录及其历史版本已永久删除");
            }}
          />
        ) : null}
        {page === "settings" ? <SettingsPage repository={repository} onNotify={notify} /> : null}
      </div>
      <PrototypeNotice notice={notice} onClose={() => setNotice(null)} />
      {newRecordOpen ? <NewRecordDialog onClose={() => setNewRecordOpen(false)} onCreate={createRecord} /> : null}
    </div>
  );
}
