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
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";

type Page = "records" | "tracking" | "updates" | "import" | "trash" | "settings";
type ImportStep = "empty" | "preview" | "mapping";
type SaveState = "idle" | "saving" | "saved";
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
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <section
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

function Sidebar({
  page,
  onNavigate,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
}) {
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
              onClick={() => !item.disabled && onNavigate(item.id as Page)}
              aria-current={isActive ? "page" : undefined}
              title={item.disabled ? "首轮原型暂未开放" : item.label}
            >
              <Icon size={20} />
              <span className="nav-label">{item.label}</span>
              {item.count ? <span className="nav-count">{item.count}</span> : null}
            </button>
          );
        })}
        <div className="nav-separator" />
        <button className="nav-item tag-button">
          <Tags size={20} />
          <span className="nav-label">标签</span>
          <ChevronDown size={16} className="nav-tail" />
        </button>
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

function AppHeader({ saveState }: { saveState: SaveState }) {
  return (
    <div className="app-header">
      <div className={`save-indicator ${saveState}`}>
        {saveState === "saving" ? <span className="save-spinner" /> : <CheckCircle2 size={17} />}
        <span>{saveState === "saving" ? "正在保存" : "已保存"}</span>
      </div>
      <button className="icon-button" aria-label="更多操作"><MoreHorizontal size={20} /></button>
    </div>
  );
}

function RecordIcon({ record }: { record: IntelligenceRecord }) {
  const Icon = iconMap[record.icon];
  return <div className={`record-icon ${record.icon}`}><Icon size={23} /></div>;
}

function RecordList({
  selectedId,
  onSelect,
  search,
  setSearch,
  searchRef,
}: {
  selectedId: number;
  onSelect: (id: number) => void;
  search: string;
  setSearch: (value: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return records;
    return records.filter((record) =>
      [record.title, record.summary, ...record.tags].join(" ").toLowerCase().includes(keyword),
    );
  }, [search]);

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
        <button className="filter-button"><SlidersHorizontal size={17} /><span>筛选</span></button>
      </div>
      <div className="list-toolbar">
        <span>找到 {filtered.length ? 18 : 0} 条记录</span>
        <button>按更新时间 <ChevronDown size={15} /></button>
      </div>

      <div className="records-list">
        {filtered.length ? filtered.map((record) => {
          const selected = record.id === selectedId;
          return (
            <AppCard
              key={record.id}
              className={`record-card ${selected ? "selected" : ""}`}
              onClick={() => onSelect(record.id)}
            >
              <RecordIcon record={record} />
              <div className="record-copy">
                <strong>{record.title}</strong>
                <div className="tag-line">{record.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                <div className="record-source">{record.source}</div>
              </div>
              <div className="record-side">
                <span className="record-date">{record.date}</span>
                <div className="quick-actions">
                  <button aria-label="收藏"><Star size={17} /></button>
                  <button aria-label="分享"><Share2 size={17} /></button>
                  <button aria-label="更多"><MoreHorizontal size={17} /></button>
                </div>
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
  judgment,
  setJudgment,
  isEditing,
  setIsEditing,
  saveState,
  setSaveState,
}: {
  judgment: string;
  setJudgment: (value: string) => void;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  saveState: SaveState;
  setSaveState: (value: SaveState) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versionAdded, setVersionAdded] = useState(false);

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
    window.setTimeout(() => setVersionAdded(false), 2200);
  };

  return (
    <article className="detail-panel elevated-card">
      <div className="detail-title-row">
        <div>
          <h1>AI资本开支与自由现金流</h1>
          <div className="detail-meta">
            <span className="status-pill">持续跟踪</span>
            <span>07-25 10:32 更新</span>
            <span>财报与研究对话</span>
            {["资本开支", "自由现金流", "云计算"].map((tag) => <span className="detail-tag" key={tag}>{tag}</span>)}
          </div>
        </div>
        <button className="favorite-button" aria-label="收藏"><Star size={20} /></button>
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
            <textarea value={judgment} onChange={(event) => updateJudgment(event.target.value)} autoFocus />
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
          <button className="card-link">查看全部事实 <ArrowRight size={15} /></button>
        </SemanticCard>
        <SemanticCard id="evidence" title="关键证据" count={9} tone="blue" icon={Folder} collapsed={collapsed.has("evidence")} onToggle={toggle}>
          <div className="evidence-list">{evidence.map((item) => (
            <div key={item.title}><FileText size={16} /><span>{item.title}</span><em>{item.source}</em></div>
          ))}</div>
          <button className="card-link">查看全部证据 <ArrowRight size={15} /></button>
        </SemanticCard>
        <SemanticCard id="questions" title="待验证问题" count={4} tone="orange" icon={CircleHelp} collapsed={collapsed.has("questions")} onToggle={toggle}>
          <ul>{openQuestions.map((item) => <li key={item}>{item}</li>)}</ul>
          <button className="card-link">查看全部问题 <ArrowRight size={15} /></button>
        </SemanticCard>
        <SemanticCard id="actions" title="下一步行动" count={3} tone="indigo" icon={ArrowRight} collapsed={collapsed.has("actions")} onToggle={toggle}>
          <div className="check-list">{nextActions.map((item) => <label key={item}><input type="checkbox" /><span>{item}</span></label>)}</div>
          <button className="card-link">查看全部行动 <ArrowRight size={15} /></button>
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
              {item.current ? <em>当前版本</em> : <button>查看</button>}
            </div>
          ))}
        </div>
      </AppCard>
    </article>
  );
}

function RecordsWorkspace({
  judgment,
  setJudgment,
  isEditing,
  setIsEditing,
  saveState,
  setSaveState,
}: {
  judgment: string;
  setJudgment: (value: string) => void;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  saveState: SaveState;
  setSaveState: (value: SaveState) => void;
}) {
  const [search, setSearch] = useState("资本开支");
  const [selectedId, setSelectedId] = useState(3);
  const searchRef = useRef<HTMLInputElement>(null);

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
    <div className="records-workspace">
      <RecordList selectedId={selectedId} onSelect={setSelectedId} search={search} setSearch={setSearch} searchRef={searchRef} />
      <DetailPanel
        judgment={judgment}
        setJudgment={setJudgment}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        saveState={saveState}
        setSaveState={setSaveState}
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
            <button className="secondary-button" onClick={() => setRestored((items) => [...items, record.id])}>
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
              <button><span>{group.value}</span><ChevronRight size={18} /></button>
            </AppCard>
          );
        })}
      </div>
    </main>
  );
}

export function App() {
  const [page, setPage] = useState<Page>("records");
  const [judgment, setJudgment] = useState(defaultJudgment);
  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [importStep, setImportStep] = useState<ImportStep>("empty");

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

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={setPage} />
      <div className="main-region">
        <AppHeader saveState={saveState} />
        {showRecords ? (
          <RecordsWorkspace
            judgment={judgment}
            setJudgment={setJudgment}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            saveState={saveState}
            setSaveState={setSaveState}
          />
        ) : null}
        {page === "import" ? <ImportCenter step={importStep} setStep={setImportStep} /> : null}
        {page === "trash" ? <TrashPage /> : null}
        {page === "settings" ? <SettingsPage /> : null}
      </div>
    </div>
  );
}
