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
  confirmedFacts,
  defaultJudgment,
  evidence,
  nextActions,
  openQuestions,
  records,
  sampleJson,
  versions,
  type IntelligenceRecord,
} from "./mockData";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";

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

const iconMap = {
  cloud: Cloud,
  chip: Cpu,
  document: FileText,
  building: Building2,
  radio: RadioTower,
};

const navItems: NavItem[] = [
  { id: "inbox", label: "收录箱", count: 12, icon: Inbox, disabled: true },
  { id: "records", label: "全部记录", count: 236, icon: Files },
  { id: "tracking", label: "持续跟踪", count: 28, icon: RadioTower },
  { id: "updates", label: "判断更新", count: 14, icon: FileCheck2, tone: "danger" },
  { id: "import", label: "导入中心", icon: Upload },
];

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
  onNavigate,
  onNotify,
  onSelectTag,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  onNotify: (message: string) => void;
  onSelectTag: (tag: string) => void;
}) {
  const [tagsOpen, setTagsOpen] = useState(false);

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
              {item.count ? <span className="nav-count">{item.count}</span> : null}
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
            {["资本开支", "云计算", "半导体"].map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  onSelectTag(tag);
                  setTagsOpen(false);
                }}
              >
                <span>{tag}</span><ChevronRight size={14} />
              </button>
            ))}
          </div>
        ) : null}
      </nav>

      <div className="sidebar-bottom">
        <button className={`nav-item ${page === "trash" ? "active" : ""}`} onClick={() => onNavigate("trash")}>
          <Trash2 size={20} />
          <span className="nav-label">回收站</span>
          <span className="nav-count">7</span>
        </button>
        <button className={`nav-item ${page === "settings" ? "active" : ""}`} onClick={() => onNavigate("settings")}>
          <Settings size={20} />
          <span className="nav-label">设置</span>
        </button>
        <div className="storage">
          <div className="storage-title"><HardDrive size={16} /><span>本地存储</span></div>
          <div className="storage-copy">已用 48.7 GB / 256 GB</div>
          <div className="storage-track"><span /></div>
        </div>
      </div>
    </aside>
  );
}

function AppHeader({
  saveState,
  onNotify,
}: {
  saveState: SaveState;
  onNotify: (message: string) => void;
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
            <button onClick={() => runAction("已创建一条空白记录草稿（演示）")}><Plus size={16} />新建记录</button>
            <button onClick={() => runAction("当前视图已准备导出（演示）")}><Save size={16} />导出当前视图</button>
            <button onClick={() => runAction("快捷键：Ctrl/⌘ K 搜索，Ctrl/⌘ E 编辑，Ctrl/⌘ Shift I 导入")}><Keyboard size={16} />快捷键说明</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RecordIcon({ record }: { record: IntelligenceRecord }) {
  const Icon = iconMap[record.icon];
  return <div className={`record-icon ${record.icon}`}><Icon size={23} /></div>;
}

function RecordList({
  scope,
  selectedId,
  onSelect,
  search,
  setSearch,
  searchRef,
  onSelectedGeometryChange,
  favoriteIds,
  onToggleFavorite,
  onNotify,
}: {
  scope: "records" | "tracking" | "updates";
  selectedId: number;
  onSelect: (id: number) => void;
  search: string;
  setSearch: (value: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  onSelectedGeometryChange: (metrics: ConnectionMetrics | null) => void;
  favoriteIds: Set<number>;
  onToggleFavorite: (id: number) => void;
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
    const scopedRecords = scope === "updates"
      ? records.filter((record) => Number(record.date.slice(3)) >= 23)
      : records;
    const matches = scopedRecords
      .filter((record) => !keyword || [record.title, record.summary, ...record.tags].join(" ").toLowerCase().includes(keyword))
      .filter((record) => sourceFilter === "全部来源" || record.source === sourceFilter);
    if (sortMode === "default") return matches;
    return [...matches].sort((a, b) => sortMode === "asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
  }, [scope, search, sortMode, sourceFilter]);

  useEffect(() => {
    if (filtered.some((record) => record.id === selectedId)) return;
    if (filtered[0]) onSelect(filtered[0].id);
  }, [filtered, onSelect, selectedId]);

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
              {["全部来源", "财报与研究对话", "行业访谈记录", "内部研究笔记"].map((source) => (
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
                <div className="record-source">{record.source}</div>
              </div>
              <div className="record-side">
                <span className="record-date">{record.date}</span>
                <div className="quick-actions" onClick={(event) => event.stopPropagation()}>
                  <button
                    className={favoriteIds.has(record.id) ? "active" : ""}
                    aria-label={favoriteIds.has(record.id) ? "取消收藏" : "收藏"}
                    onClick={() => onToggleFavorite(record.id)}
                  >
                    <Star size={17} fill={favoriteIds.has(record.id) ? "currentColor" : "none"} />
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
                    <button onClick={() => { onNotify("已加入持续跟踪（演示）"); setOpenMenuId(null); }}>加入持续跟踪</button>
                    <button onClick={() => void copyRecordTitle(record)}>复制标题</button>
                  </div>
                ) : null}
                <span className="status-dot"><i />持续跟踪</span>
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
  judgment,
  setJudgment,
  isEditing,
  setIsEditing,
  saveState,
  setSaveState,
  favorited,
  onToggleFavorite,
  onNotify,
}: {
  record: IntelligenceRecord;
  judgment: string;
  setJudgment: (value: string) => void;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  saveState: SaveState;
  setSaveState: (value: SaveState) => void;
  favorited: boolean;
  onToggleFavorite: () => void;
  onNotify: (message: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versionAdded, setVersionAdded] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"facts" | "evidence" | "questions" | "actions" | null>(null);
  const [viewingVersion, setViewingVersion] = useState<(typeof versions)[number] | null>(null);

  const toggle = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateJudgment = (value: string) => {
    setJudgment(value);
    setSaveState("saving");
  };

  const addVersion = () => {
    setVersionAdded(true);
    setHistoryOpen(true);
    onNotify("已创建 v4 正式版本快照（演示）");
    window.setTimeout(() => setVersionAdded(false), 2200);
  };

  const expandedContent = expandedSection ? {
    facts: { eyebrow: "结构化详情", title: "全部已确认事实", items: confirmedFacts },
    evidence: { eyebrow: "来源与证据", title: "全部关键证据", items: evidence.map((item) => `${item.title} · ${item.source}`) },
    questions: { eyebrow: "后续验证", title: "全部待验证问题", items: openQuestions },
    actions: { eyebrow: "执行清单", title: "全部下一步行动", items: nextActions },
  }[expandedSection] : null;

  return (
    <article className="detail-panel elevated-card">
      <div className="detail-title-row">
        <div>
          <h1>{record.title}</h1>
          <div className="detail-meta">
            <span className="status-pill">持续跟踪</span>
            <span>{record.date} 10:32 更新</span>
            <span>{record.source}</span>
            {record.tags.map((tag) => <span className="detail-tag" key={tag}>{tag}</span>)}
          </div>
        </div>
        <button
          className={`favorite-button ${favorited ? "active" : ""}`}
          aria-label={favorited ? "取消收藏" : "收藏"}
          onClick={onToggleFavorite}
        >
          <Star size={20} fill={favorited ? "currentColor" : "none"} />
        </button>
      </div>

      <AppCard className={`judgment-card ${isEditing ? "editing" : ""}`}>
        <div className="judgment-accent" />
        <div className="judgment-top">
          <div className="judgment-heading"><Sparkles size={21} /><strong>当前判断</strong></div>
          <div className="primary-actions">
            <button onClick={() => setIsEditing(!isEditing)}><Pencil size={18} />{isEditing ? "完成" : "编辑"}</button>
            <span />
            <button onClick={addVersion}><Plus size={18} />追加版本</button>
          </div>
        </div>
        {isEditing ? (
          <div className="edit-area">
            <textarea
              value={judgment}
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
        ) : <p className="judgment-text">{judgment}</p>}
        <ul className="judgment-points">
          <li>AI相关资本开支占比持续提升，主要投向算力基础设施与网络。</li>
          <li>规模效应与单位算力成本下降将逐步改善自由现金流质量。</li>
          <li>若需求增速放缓或资本开支效率下降，现金流拐点可能延后。</li>
        </ul>
        <div className="judgment-footer"><span>置信度：中高</span><span>更新于 2026-07-25 10:32</span></div>
      </AppCard>

      <div className="semantic-grid">
        <SemanticCard id="facts" title="已确认事实" count={7} tone="green" icon={ShieldCheck} collapsed={collapsed.has("facts")} onToggle={toggle}>
          <ul>{confirmedFacts.map((item) => <li key={item}>{item}</li>)}</ul>
          <button className="card-link" onClick={() => setExpandedSection("facts")}>查看全部事实 <ArrowRight size={15} /></button>
        </SemanticCard>
        <SemanticCard id="evidence" title="关键证据" count={9} tone="blue" icon={Folder} collapsed={collapsed.has("evidence")} onToggle={toggle}>
          <div className="evidence-list">{evidence.map((item) => (
            <div key={item.title}><FileText size={16} /><span>{item.title}</span><em>{item.source}</em></div>
          ))}</div>
          <button className="card-link" onClick={() => setExpandedSection("evidence")}>查看全部证据 <ArrowRight size={15} /></button>
        </SemanticCard>
        <SemanticCard id="questions" title="待验证问题" count={4} tone="orange" icon={CircleHelp} collapsed={collapsed.has("questions")} onToggle={toggle}>
          <ul>{openQuestions.map((item) => <li key={item}>{item}</li>)}</ul>
          <button className="card-link" onClick={() => setExpandedSection("questions")}>查看全部问题 <ArrowRight size={15} /></button>
        </SemanticCard>
        <SemanticCard id="actions" title="下一步行动" count={3} tone="indigo" icon={ArrowRight} collapsed={collapsed.has("actions")} onToggle={toggle}>
          <div className="check-list">{nextActions.map((item) => <label key={item}><input type="checkbox" /><span>{item}</span></label>)}</div>
          <button className="card-link" onClick={() => setExpandedSection("actions")}>查看全部行动 <ArrowRight size={15} /></button>
        </SemanticCard>
      </div>

      <AppCard className={`history-card ${historyOpen ? "open" : ""}`}>
        <button className="history-heading" onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}>
          <span><History size={20} /><strong>历史版本</strong><em>{versions.length + (versionAdded ? 1 : 0)}</em></span>
          <ChevronRight size={19} />
        </button>
        <div className="history-content">
          {versionAdded ? <div className="version-success"><Check size={16} /> 已创建 v4 正式版本快照</div> : null}
          {versions.map((item) => (
            <div className="version-row" key={item.version}>
              <span className="version-badge">{item.version}</span>
              <div><strong>{item.note}</strong><span>{item.date}</span></div>
              {item.current ? <em>当前版本</em> : <button onClick={() => setViewingVersion(item)}>查看</button>}
            </div>
          ))}
        </div>
      </AppCard>
      {expandedContent ? (
        <PrototypeDialog eyebrow={expandedContent.eyebrow} title={expandedContent.title} onClose={() => setExpandedSection(null)}>
          <ul className="dialog-list">
            {expandedContent.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <div className="dialog-footnote">当前为阶段 1 假数据交互，正式数据将在本地数据层接入后完整呈现。</div>
        </PrototypeDialog>
      ) : null}
      {viewingVersion ? (
        <PrototypeDialog eyebrow={`历史快照 · ${viewingVersion.version}`} title={viewingVersion.note} onClose={() => setViewingVersion(null)}>
          <div className="version-preview">
            <span>{viewingVersion.date}</span>
            <p>{judgment}</p>
            <em>只读版本预览，不会覆盖当前判断。</em>
          </div>
        </PrototypeDialog>
      ) : null}
    </article>
  );
}

function RecordsWorkspace({
  scope,
  search,
  setSearch,
  judgment,
  setJudgment,
  isEditing,
  setIsEditing,
  saveState,
  setSaveState,
  onNotify,
}: {
  scope: "records" | "tracking" | "updates";
  search: string;
  setSearch: (value: string) => void;
  judgment: string;
  setJudgment: (value: string) => void;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  saveState: SaveState;
  setSaveState: (value: SaveState) => void;
  onNotify: (message: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(3);
  const [connectionMetrics, setConnectionMetrics] = useState<ConnectionMetrics | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedRecord = records.find((record) => record.id === selectedId) ?? records[2];

  const toggleFavorite = (id: number) => {
    const willFavorite = !favoriteIds.has(id);
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (willFavorite) next.add(id);
      else next.delete(id);
      return next;
    });
    onNotify(willFavorite ? "已加入收藏" : "已取消收藏");
  };

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
        scope={scope}
        selectedId={selectedId}
        onSelect={setSelectedId}
        search={search}
        setSearch={setSearch}
        searchRef={searchRef}
        onSelectedGeometryChange={setConnectionMetrics}
        favoriteIds={favoriteIds}
        onToggleFavorite={toggleFavorite}
        onNotify={onNotify}
      />
      {connectionMetrics && connectionMetrics.width > 0 ? (
        <div className="record-detail-connector" aria-hidden="true">
          <span className="connector-dot start" />
          <span className="connector-dot end" />
        </div>
      ) : null}
      <DetailPanel
        record={selectedRecord}
        judgment={judgment}
        setJudgment={setJudgment}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        saveState={saveState}
        setSaveState={setSaveState}
        favorited={favoriteIds.has(selectedId)}
        onToggleFavorite={() => toggleFavorite(selectedId)}
        onNotify={onNotify}
      />
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

function TrashPage() {
  const [restored, setRestored] = useState<number[]>([]);
  const trashRecords = records.slice(0, 3);
  return (
    <main className="page-shell">
      <PageTitle eyebrow="保留 30 天" title="回收站" description="删除的记录仍保留版本和附件关系；永久删除在后续数据阶段实现。" />
      <div className="trash-grid">
        {trashRecords.map((record) => (
          <AppCard className={`trash-card ${restored.includes(record.id) ? "restored" : ""}`} key={record.id}>
            <RecordIcon record={record} />
            <div><strong>{record.title}</strong><span>删除于 2026-07-{18 + record.id}</span></div>
            <button
              className="secondary-button"
              disabled={restored.includes(record.id)}
              onClick={() => setRestored((items) => [...items, record.id])}
            >
              <RotateCcw size={17} />{restored.includes(record.id) ? "已恢复" : "恢复"}
            </button>
          </AppCard>
        ))}
      </div>
    </main>
  );
}

function SettingsPage() {
  const groups = [
    { icon: Database, title: "数据与存储", copy: "数据目录、备份与索引维护", value: "本地数据目录" },
    { icon: Palette, title: "外观", copy: "界面密度、字号与主题", value: "标准 · 浅色" },
    { icon: Bell, title: "提醒", copy: "跟踪记录与行动项提醒", value: "仅应用内" },
    { icon: Lock, title: "隐私与安全", copy: "离线策略与文件访问权限", value: "离线优先" },
    { icon: Keyboard, title: "快捷键", copy: "搜索、编辑和导入快捷方式", value: "查看全部" },
  ];
  const [selectedSetting, setSelectedSetting] = useState<string | null>(null);
  const activeSetting = groups.find((group) => group.title === selectedSetting);
  const ActiveSettingIcon = activeSetting?.icon;

  return (
    <main className="page-shell settings-page">
      <PageTitle eyebrow="本地优先" title="设置" description="首轮仅展示设置结构，不修改系统或真实数据目录。" />
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
          <div className="dialog-footnote">当前为 UI 原型，只展示设置结构，不会修改系统、文件权限或真实数据目录。</div>
        </PrototypeDialog>
      ) : null}
    </main>
  );
}

export function App() {
  const [page, setPage] = useState<Page>("records");
  const [judgment, setJudgment] = useState(defaultJudgment);
  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [importStep, setImportStep] = useState<ImportStep>("empty");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [recordSearch, setRecordSearch] = useState("资本开支");

  const notify = (message: string) => setNotice({ id: Date.now(), message });

  useEffect(() => {
    if (saveState !== "saving") return;
    const timer = window.setTimeout(() => setSaveState("saved"), 720);
    return () => window.clearTimeout(timer);
  }, [judgment, saveState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "i") {
        event.preventDefault();
        setPage("import");
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

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onNavigate={setPage}
        onNotify={notify}
        onSelectTag={(tag) => {
          setRecordSearch(tag);
          setPage("records");
          notify(`已按“${tag}”筛选记录`);
        }}
      />
      <div className="main-region">
        <AppHeader saveState={saveState} onNotify={notify} />
        {showRecords ? (
          <RecordsWorkspace
            scope={recordScope}
            search={recordSearch}
            setSearch={setRecordSearch}
            judgment={judgment}
            setJudgment={setJudgment}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            saveState={saveState}
            setSaveState={setSaveState}
            onNotify={notify}
          />
        ) : null}
        {page === "import" ? <ImportCenter step={importStep} setStep={setImportStep} /> : null}
        {page === "trash" ? <TrashPage /> : null}
        {page === "settings" ? <SettingsPage /> : null}
      </div>
      <PrototypeNotice notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
