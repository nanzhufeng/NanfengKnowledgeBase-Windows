import {
  Archive,
  ArrowRight,
  BookOpen,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Database,
  FileCode2,
  FileText,
  Film,
  FolderInput,
  GitBranch,
  History,
  Inbox,
  Layers3,
  Link2,
  ListFilter,
  Merge,
  PanelLeftClose,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Split,
  Tags,
  WandSparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  domains,
  evidenceItems,
  initialInboxItems,
  openQuestions,
  topicHistory,
  type InboxItem,
  type SourceKind,
  type TopicNode,
} from "./mockKnowledgeData";
import "./knowledgeEvolutionPrototype.css";

type ViewKey = "inbox" | "topics" | "organize";
type ModalKey = "merge" | "split" | "context" | null;

const sourceIcons: Record<SourceKind, typeof FileText> = {
  chatgpt: Sparkles,
  claude: WandSparkles,
  transcript: Film,
  markdown: FileCode2,
};

const sourceLabels: Record<SourceKind, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  transcript: "视频转写",
  markdown: "Markdown",
};

function TopicTree({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: TopicNode[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(() => new Set(nodes.slice(0, 3).map((node) => node.id)));

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="ke-tree">
      {nodes.map((node) => {
        const isExpanded = expanded.has(node.id);
        const hasChildren = Boolean(node.children?.length);
        return (
          <div key={node.id} className="ke-tree-group">
            <div className={`ke-tree-row ${selectedId === node.id ? "selected" : ""}`}>
              <button
                className="ke-tree-toggle"
                type="button"
                aria-label={`${isExpanded ? "折叠" : "展开"}${node.name}`}
                onClick={() => hasChildren && toggle(node.id)}
              >
                {hasChildren ? isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : <span />}
              </button>
              <button className="ke-tree-label" type="button" onClick={() => onSelect(node.id)}>
                <span>{node.name}</span>
                <em>{node.count}</em>
              </button>
            </div>
            {hasChildren && isExpanded ? (
              <div className="ke-tree-children">
                {node.children?.map((child) => (
                  <button
                    key={child.id}
                    className={`ke-tree-child ${selectedId === child.id ? "selected" : ""}`}
                    type="button"
                    onClick={() => onSelect(child.id)}
                  >
                    <span>{child.name}</span>
                    <em>{child.count}</em>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const level = value >= 90 ? "high" : value >= 70 ? "medium" : "low";
  return (
    <span className={`ke-confidence ${level}`}>
      <strong>{value}%</strong>
      {level === "high" ? "高置信" : level === "medium" ? "建议确认" : "需人工判断"}
    </span>
  );
}

function InboxCard({
  item,
  active,
  onSelect,
}: {
  item: InboxItem;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = sourceIcons[item.kind];
  return (
    <button className={`ke-inbox-card ${active ? "active" : ""}`} type="button" onClick={onSelect}>
      <span className={`ke-source-icon ${item.kind}`}>
        <Icon size={20} />
      </span>
      <span className="ke-inbox-body">
        <span className="ke-inbox-meta">
          <span>{sourceLabels[item.kind]}</span>
          <time>{item.sourceDate.slice(5, 10)}</time>
        </span>
        <strong>{item.title}</strong>
        <span className="ke-source-name">{item.sourceLabel}</span>
        <span className="ke-path-preview">
          {item.suggestedPath.join(" / ")}
          <em>{item.confidence}%</em>
        </span>
      </span>
      {item.status === "accepted" ? (
        <span className="ke-card-status accepted">
          <Check size={13} /> 已归类
        </span>
      ) : (
        <span className="ke-card-status">待确认</span>
      )}
    </button>
  );
}

function ClassificationInspector({
  item,
  onAccept,
  onUndo,
}: {
  item: InboxItem;
  onAccept: () => void;
  onUndo: () => void;
}) {
  return (
    <section className="ke-inspector">
      <header className="ke-panel-heading">
        <div>
          <span className="ke-eyebrow">分类建议</span>
          <h2>为什么放在这里？</h2>
        </div>
        <ConfidenceBadge value={item.confidence} />
      </header>

      <div className="ke-source-preview">
        <div className="ke-source-preview-meta">
          <span>{item.sourceLabel}</span>
          <time>{item.sourceDate}</time>
        </div>
        <h3>{item.title}</h3>
        <p>{item.excerpt}</p>
      </div>

      <div className="ke-proposed-path">
        <span>建议主路径</span>
        <div>
          {item.suggestedPath.map((part, index) => (
            <span key={part}>
              {index > 0 ? <ChevronRight size={14} /> : null}
              <strong>{part}</strong>
            </span>
          ))}
        </div>
      </div>

      <div className="ke-reason-grid">
        <section>
          <h3>
            <ShieldCheck size={17} /> 判断依据
          </h3>
          <ul className="ke-reason-list">
            {item.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>
            <ListFilter size={17} /> 分数构成
          </h3>
          <div className="ke-score-list">
            {item.scoreParts.map((part) => (
              <div key={part.label}>
                <span>{part.label}</span>
                <div>
                  <i style={{ width: `${Math.min(100, (part.score / part.max) * 100)}%` }} />
                </div>
                <strong>{part.score}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="ke-alternatives">
        <div className="ke-section-title">
          <h3>其他候选</h3>
          <span>选择后仅改变建议，不立即写入</span>
        </div>
        <div className="ke-alternative-list">
          {item.alternatives.map((alternative) => (
            <button key={alternative.path} type="button">
              <span>{alternative.path}</span>
              <strong>{alternative.confidence}%</strong>
            </button>
          ))}
          <button type="button">
            <span>新建主题或暂不归类</span>
            <strong>手动</strong>
          </button>
        </div>
      </section>

      <section className="ke-related">
        <div className="ke-section-title">
          <h3>相似来源</h3>
          <span>只作参考，不自动合并</span>
        </div>
        {item.related.map((related) => (
          <button key={related} type="button">
            <Link2 size={15} />
            <span>{related}</span>
            <ChevronRight size={15} />
          </button>
        ))}
      </section>

      <footer className="ke-inspector-actions">
        {item.status === "accepted" ? (
          <>
            <span className="ke-success-note">
              <Check size={16} /> 已加入主题，操作日志已记录
            </span>
            <button className="ke-button secondary" type="button" onClick={onUndo}>
              <RotateCcw size={16} /> 撤销归类
            </button>
          </>
        ) : (
          <>
            <button className="ke-button ghost" type="button">
              修改路径
            </button>
            <button className="ke-button primary" type="button" onClick={onAccept}>
              接受建议 <ArrowRight size={16} />
            </button>
          </>
        )}
      </footer>
    </section>
  );
}

function InboxView({
  items,
  selectedId,
  onSelect,
  onAccept,
  onUndo,
  onBulkAccept,
}: {
  items: InboxItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAccept: (id: string) => void;
  onUndo: (id: string) => void;
  onBulkAccept: () => void;
}) {
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const pendingCount = items.filter((item) => item.status === "pending").length;

  return (
    <div className="ke-inbox-view">
      <aside className="ke-topic-panel">
        <header>
          <div>
            <span className="ke-eyebrow">知识结构</span>
            <h2>主题浏览器</h2>
          </div>
          <button type="button" aria-label="收起主题浏览器">
            <PanelLeftClose size={18} />
          </button>
        </header>
        <div className="ke-tree-summary">
          <span>7 个领域</span>
          <span>31 个主题</span>
          <span>82 条来源</span>
        </div>
        <TopicTree nodes={domains} selectedId="ai-capex" onSelect={() => undefined} />
        <button className="ke-outline-action" type="button">
          <Boxes size={16} /> 管理主题与别名
        </button>
      </aside>

      <section className="ke-inbox-list">
        <header className="ke-list-heading">
          <div>
            <span className="ke-eyebrow">待处理来源</span>
            <h1>收录箱</h1>
            <p>先提取与标准化，再生成可解释的归类建议。</p>
          </div>
          <span className="ke-pending-count">{pendingCount} 待确认</span>
        </header>
        <div className="ke-list-toolbar">
          <button type="button">
            <ListFilter size={15} /> 全部来源 <ChevronDown size={14} />
          </button>
          <button type="button">按置信度</button>
          <button className="ke-bulk-action" type="button" onClick={onBulkAccept}>
            批量接受 ≥ 90%
          </button>
        </div>
        <div className="ke-inbox-scroll">
          {items.map((item) => (
            <InboxCard key={item.id} item={item} active={selected.id === item.id} onSelect={() => onSelect(item.id)} />
          ))}
        </div>
        <footer className="ke-ingestion-pipeline">
          <span>导入</span>
          <i />
          <span>提取</span>
          <i />
          <span>标准化</span>
          <i />
          <strong>生成建议</strong>
          <i />
          <span>人工确认</span>
        </footer>
      </section>

      <ClassificationInspector item={selected} onAccept={() => onAccept(selected.id)} onUndo={() => onUndo(selected.id)} />
    </div>
  );
}

function TopicBrowserView({ onOpenContext }: { onOpenContext: () => void }) {
  const [selectedTopic, setSelectedTopic] = useState("ai-capex");
  const [tab, setTab] = useState<"overview" | "timeline" | "sources">("overview");

  return (
    <div className="ke-topic-browser-view">
      <aside className="ke-topic-panel browser">
        <header>
          <div>
            <span className="ke-eyebrow">浏览与定位</span>
            <h2>主题结构</h2>
          </div>
          <button type="button" aria-label="添加主题">
            <Boxes size={18} />
          </button>
        </header>
        <label className="ke-tree-search">
          <Search size={15} />
          <input aria-label="搜索主题" placeholder="搜索主题、别名或实体" />
        </label>
        <TopicTree nodes={domains} selectedId={selectedTopic} onSelect={setSelectedTopic} />
      </aside>

      <main className="ke-topic-workspace">
        <header className="ke-topic-header">
          <div>
            <div className="ke-breadcrumb">
              投资研究 <ChevronRight size={14} /> AI 资本开支
            </div>
            <h1>AI 资本开支</h1>
            <p>跟踪云厂商、算力基础设施与自由现金流之间的长期变化。</p>
          </div>
          <div className="ke-topic-actions">
            <button type="button">
              <Tags size={16} /> 3 个别名
            </button>
            <button className="ke-button primary" type="button" onClick={onOpenContext}>
              <Sparkles size={16} /> 生成研究上下文
            </button>
          </div>
        </header>

        <div className="ke-topic-metrics">
          <article>
            <span>来源</span>
            <strong>6</strong>
            <em>来自 3 种渠道</em>
          </article>
          <article>
            <span>判断快照</span>
            <strong>3</strong>
            <em>最近更新 07-23</em>
          </article>
          <article>
            <span>证据</span>
            <strong>9</strong>
            <em>6 强 · 3 中</em>
          </article>
          <article>
            <span>待验证</span>
            <strong>3</strong>
            <em>1 项接近期限</em>
          </article>
        </div>

        <nav className="ke-topic-tabs">
          <button className={tab === "overview" ? "active" : ""} type="button" onClick={() => setTab("overview")}>
            主题概览
          </button>
          <button className={tab === "timeline" ? "active" : ""} type="button" onClick={() => setTab("timeline")}>
            判断时间线
          </button>
          <button className={tab === "sources" ? "active" : ""} type="button" onClick={() => setTab("sources")}>
            笔记与来源
          </button>
        </nav>

        {tab === "overview" ? (
          <div className="ke-topic-grid">
            <section className="ke-knowledge-card judgment">
              <header>
                <div>
                  <span className="ke-eyebrow">当前判断</span>
                  <h2>高投入延续，但结构正在分化</h2>
                </div>
                <span>置信度 中高</span>
              </header>
              <p>
                头部云厂商仍将维持高位资本开支，但训练集群、推理基础设施与网络设备的增速开始分化；自由现金流压力可控，不能仅凭 GPU
                交付周期回落判断周期结束。
              </p>
              <footer>
                <span>更新于 2026/07/23</span>
                <button type="button">
                  查看依据 <ArrowRight size={15} />
                </button>
              </footer>
            </section>

            <section className="ke-knowledge-card evidence">
              <header>
                <div>
                  <span className="ke-eyebrow">关键证据</span>
                  <h2>证据链</h2>
                </div>
                <span>9 项</span>
              </header>
              <div className="ke-evidence-list">
                {evidenceItems.map((evidence) => (
                  <article key={evidence.title}>
                    <span className={`ke-strength ${evidence.strength === "强" ? "strong" : ""}`}>{evidence.strength}</span>
                    <div>
                      <strong>{evidence.title}</strong>
                      <p>{evidence.claim}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="ke-knowledge-card questions">
              <header>
                <div>
                  <span className="ke-eyebrow">下一步研究</span>
                  <h2>待验证问题</h2>
                </div>
                <span>3 项</span>
              </header>
              <ol>
                {openQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ol>
            </section>

            <section className="ke-knowledge-card relations">
              <header>
                <div>
                  <span className="ke-eyebrow">横向关系</span>
                  <h2>相关主题</h2>
                </div>
                <span>非主路径</span>
              </header>
              <div>
                <button type="button">模型与成本</button>
                <button type="button">数据中心电力</button>
                <button type="button">云厂商现金流</button>
                <button type="button">GPU 供应链</button>
              </div>
              <p>关系不会复制主题；每条内容仍只有一个主路径。</p>
            </section>
          </div>
        ) : null}

        {tab === "timeline" ? (
          <section className="ke-timeline-card">
            <header>
              <div>
                <span className="ke-eyebrow">知识演化</span>
                <h2>判断时间线</h2>
              </div>
              <span>3 次关键变化</span>
            </header>
            <div className="ke-timeline">
              {topicHistory.map((item) => (
                <article key={item.date}>
                  <time>{item.date}</time>
                  <i className={item.tone} />
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.content}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "sources" ? (
          <section className="ke-source-library">
            <header>
              <div>
                <span className="ke-eyebrow">可追溯来源</span>
                <h2>笔记与原始来源</h2>
              </div>
              <button type="button">按时间排序</button>
            </header>
            {initialInboxItems.slice(0, 3).map((source) => (
              <article key={source.id}>
                <span className={`ke-source-icon ${source.kind}`}>{sourceIcons[source.kind]({ size: 18 })}</span>
                <div>
                  <strong>{source.title}</strong>
                  <p>{source.excerpt}</p>
                  <span>
                    {source.sourceLabel} · {source.sourceDate}
                  </span>
                </div>
                <button type="button">
                  打开来源 <ArrowRight size={15} />
                </button>
              </article>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function OrganizeView({ onOpenModal }: { onOpenModal: (modal: Exclude<ModalKey, null>) => void }) {
  return (
    <main className="ke-organize-view">
      <header className="ke-organize-header">
        <div>
          <span className="ke-eyebrow">结构治理</span>
          <h1>整理工作台</h1>
          <p>所有自动建议都先预览；合并可撤销，拆分首版只提供方案。</p>
        </div>
        <div className="ke-governance-note">
          <ShieldCheck size={18} />
          <span>
            <strong>安全模式</strong>
            原文保留 · 操作留痕 · 可回滚
          </span>
        </div>
      </header>

      <section className="ke-organize-summary">
        <article>
          <span className="merge">
            <Merge size={19} />
          </span>
          <div>
            <strong>2</strong>
            <p>主题合并建议</p>
          </div>
        </article>
        <article>
          <span className="split">
            <Split size={19} />
          </span>
          <div>
            <strong>1</strong>
            <p>主题拆分建议</p>
          </div>
        </article>
        <article>
          <span className="similar">
            <Link2 size={19} />
          </span>
          <div>
            <strong>4</strong>
            <p>相似内容候选</p>
          </div>
        </article>
        <article>
          <span className="history">
            <History size={19} />
          </span>
          <div>
            <strong>12</strong>
            <p>本周操作记录</p>
          </div>
        </article>
      </section>

      <div className="ke-organize-grid">
        <section className="ke-organize-card featured">
          <header>
            <div className="ke-organize-icon merge">
              <Merge size={20} />
            </div>
            <div>
              <span className="ke-eyebrow">高可信建议 · 91%</span>
              <h2>合并两个重复主题</h2>
            </div>
            <span className="ke-card-pill">待确认</span>
          </header>
          <div className="ke-merge-comparison">
            <article>
              <span>主题 A</span>
              <strong>AI 资本开支周期</strong>
              <p>4 条来源 · 2 条判断 · 更新 07-23</p>
            </article>
            <div>
              <Merge size={19} />
              <span>别名与来源高度重合</span>
            </div>
            <article>
              <span>主题 B</span>
              <strong>云厂商 CapEx</strong>
              <p>2 条来源 · 1 条判断 · 更新 07-18</p>
            </article>
          </div>
          <ul>
            <li>主实体重合：云厂商、GPU、资本开支</li>
            <li>合并后保留主题 B 为别名并建立旧路径重定向</li>
            <li>执行前生成两份主题快照，可从操作日志完整撤销</li>
          </ul>
          <footer>
            <button className="ke-button ghost" type="button">
              暂不处理
            </button>
            <button className="ke-button primary" type="button" onClick={() => onOpenModal("merge")}>
              查看合并预览 <ArrowRight size={16} />
            </button>
          </footer>
        </section>

        <section className="ke-organize-card">
          <header>
            <div className="ke-organize-icon split">
              <Split size={20} />
            </div>
            <div>
              <span className="ke-eyebrow">结构建议 · 78%</span>
              <h2>主题内容可能过宽</h2>
            </div>
          </header>
          <h3>“海外账号体系”可拆为两个稳定子主题</h3>
          <div className="ke-split-paths">
            <span>Apple ID 与地区</span>
            <span>银行 App 与身份</span>
          </div>
          <p>首版只生成拆分方案与内容归属预览，不提供一键执行。</p>
          <button className="ke-inline-action" type="button" onClick={() => onOpenModal("split")}>
            查看拆分方案 <ArrowRight size={15} />
          </button>
        </section>

        <section className="ke-organize-card">
          <header>
            <div className="ke-organize-icon similar">
              <Link2 size={20} />
            </div>
            <div>
              <span className="ke-eyebrow">相似内容</span>
              <h2>可能重复的来源</h2>
            </div>
          </header>
          <div className="ke-similar-pair">
            <article>
              <strong>GPU 交付周期跟踪</strong>
              <span>访谈记录 · 07-21</span>
            </article>
            <i>82%</i>
            <article>
              <strong>GPU 供应链周期更新</strong>
              <span>Claude 对话 · 07-22</span>
            </article>
          </div>
          <p>建议建立“补充证据”关系，不自动删除或合并原始来源。</p>
          <button className="ke-inline-action" type="button">
            查看差异 <ArrowRight size={15} />
          </button>
        </section>

        <section className="ke-operation-log">
          <header>
            <div>
              <span className="ke-eyebrow">审计与恢复</span>
              <h2>最近操作</h2>
            </div>
            <button type="button">查看全部</button>
          </header>
          <article>
            <span className="success">
              <Check size={15} />
            </span>
            <div>
              <strong>接受归类建议</strong>
              <p>“数据中心电力约束” → 投资研究 / AI 资本开支</p>
            </div>
            <time>10:42</time>
            <button type="button">撤销</button>
          </article>
          <article>
            <span>
              <Tags size={15} />
            </span>
            <div>
              <strong>新增主题别名</strong>
              <p>CapEx → 资本开支</p>
            </div>
            <time>昨天</time>
            <button type="button">查看</button>
          </article>
          <article>
            <span>
              <Archive size={15} />
            </span>
            <div>
              <strong>原始来源已归档</strong>
              <p>项目复盘_052.srt · SHA-256 已记录</p>
            </div>
            <time>昨天</time>
            <button type="button">查看</button>
          </article>
        </section>
      </div>
    </main>
  );
}

function PrototypeModal({ modal, onClose }: { modal: Exclude<ModalKey, null>; onClose: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const title = modal === "merge" ? "主题合并预览" : modal === "split" ? "主题拆分方案" : "生成研究上下文";
  return (
    <div className="ke-modal-layer" role="presentation" onMouseDown={onClose}>
      <section className={`ke-modal ${modal}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="ke-eyebrow">{modal === "context" ? "本地编译，不调用模型" : "执行前确认"}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" aria-label="关闭" onClick={onClose}>
            <X size={19} />
          </button>
        </header>

        {modal === "merge" ? (
          <div className="ke-modal-body">
            {confirmed ? (
              <div className="ke-confirmed-state">
                <span>
                  <Check size={23} />
                </span>
                <h3>合并已记录到原型操作日志</h3>
                <p>真实实现将先生成主题快照，再写入别名、重定向与来源关系。本原型没有写入数据库。</p>
                <button className="ke-button secondary" type="button" onClick={() => setConfirmed(false)}>
                  <RotateCcw size={16} /> 撤销本次演示
                </button>
              </div>
            ) : (
              <>
                <div className="ke-preview-banner">
                  <ShieldCheck size={18} />
                  <p>
                    <strong>没有内容会被删除。</strong>主题 B 将成为别名，旧链接重定向到主题 A；来源、判断和证据保留各自版本。
                  </p>
                </div>
                <div className="ke-merge-result">
                  <span>合并后主主题</span>
                  <h3>投资研究 / AI 资本开支</h3>
                  <div>
                    <article>
                      <strong>6</strong>
                      <span>来源</span>
                    </article>
                    <article>
                      <strong>3</strong>
                      <span>判断快照</span>
                    </article>
                    <article>
                      <strong>9</strong>
                      <span>证据</span>
                    </article>
                    <article>
                      <strong>2</strong>
                      <span>保留别名</span>
                    </article>
                  </div>
                </div>
                <div className="ke-change-list">
                  <h3>将执行的变更</h3>
                  <p><Check size={15} /> 保存主题 A、主题 B 的完整快照</p>
                  <p><Check size={15} /> 将“云厂商 CapEx”设为主题别名</p>
                  <p><Check size={15} /> 重新挂接 2 条来源和 1 条判断快照</p>
                  <p><Check size={15} /> 创建旧主题路径的永久重定向</p>
                </div>
              </>
            )}
          </div>
        ) : null}

        {modal === "split" ? (
          <div className="ke-modal-body">
            <div className="ke-preview-banner warning">
              <CircleHelp size={18} />
              <p>
                <strong>首版只提供方案。</strong>拆分涉及内容归属判断，不会在此处直接执行。
              </p>
            </div>
            <div className="ke-split-preview">
              <article>
                <span>候选子主题 A · 6 条</span>
                <h3>Apple ID 与地区</h3>
                <p>地区切换、App Store 下载、Apple Pay、设备隔离</p>
                <ul>
                  <li>港版 iPhone 绑定 Apple Pay</li>
                  <li>美区 Apple ID 与雪盈证券</li>
                  <li>不同地区账号的应用更新</li>
                </ul>
              </article>
              <article>
                <span>候选子主题 B · 5 条</span>
                <h3>银行 App 与身份</h3>
                <p>KYC、手机号、设备指纹、银行地区限制</p>
                <ul>
                  <li>汇丰香港 App 长期可用性</li>
                  <li>海外银行身份痕迹</li>
                  <li>账号验证与设备控制</li>
                </ul>
              </article>
            </div>
          </div>
        ) : null}

        {modal === "context" ? (
          <div className="ke-modal-body">
            <div className="ke-context-layout">
              <aside>
                <h3>包含内容</h3>
                {["主题定义与当前判断", "关键证据及来源锚点", "判断变化时间线", "待验证问题", "相关主题与边界", "来源目录"].map(
                  (label, index) => (
                    <label key={label}>
                      <input type="checkbox" defaultChecked={index < 5} />
                      <span>{label}</span>
                    </label>
                  ),
                )}
                <div>
                  <span>输出格式</span>
                  <button className="active" type="button">Markdown</button>
                  <button type="button">纯文本</button>
                </div>
              </aside>
              <section>
                <div className="ke-context-preview-heading">
                  <span>上下文预览</span>
                  <em>约 1,240 字</em>
                </div>
                <div className="ke-context-preview">
                  <h3># AI 资本开支：研究上下文</h3>
                  <h4>## 当前判断</h4>
                  <p>头部云厂商仍将维持高位资本开支，但训练集群、推理基础设施与网络设备的增速开始分化。</p>
                  <h4>## 已确认事实</h4>
                  <p>- 云厂商 A 2026Q2 资本开支同比 +41%。</p>
                  <p>- GPU 交付周期由 24 周回落至 17 周。</p>
                  <h4>## 待验证问题</h4>
                  <p>- 推理侧投入能否抵消训练集群增速放缓？</p>
                  <p>- 折旧年限变化有多少是口径因素？</p>
                  <h4>## 使用约束</h4>
                  <p>保留来源编号；新结论必须区分事实、推测与判断。</p>
                </div>
              </section>
            </div>
          </div>
        ) : null}

        <footer>
          <span>原型模式 · 不写入数据库</span>
          <div>
            <button className="ke-button ghost" type="button" onClick={onClose}>
              {modal === "split" ? "关闭方案" : "取消"}
            </button>
            {modal === "merge" && !confirmed ? (
              <button className="ke-button primary" type="button" onClick={() => setConfirmed(true)}>
                确认合并演示
              </button>
            ) : null}
            {modal === "context" ? (
              <button className="ke-button primary" type="button">
                <Copy size={16} /> 复制研究上下文
              </button>
            ) : null}
          </div>
        </footer>
      </section>
    </div>
  );
}

export function KnowledgeEvolutionPrototype() {
  const [view, setView] = useState<ViewKey>("inbox");
  const [items, setItems] = useState(initialInboxItems);
  const [selectedId, setSelectedId] = useState(initialInboxItems[0].id);
  const [modal, setModal] = useState<ModalKey>(null);
  const [toast, setToast] = useState("");
  const pendingCount = useMemo(() => items.filter((item) => item.status === "pending").length, [items]);

  const updateStatus = (id: string, status: InboxItem["status"]) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
    setToast(status === "accepted" ? "已接受分类建议，可在操作日志中撤销" : "已撤销归类，来源返回收录箱");
    window.setTimeout(() => setToast(""), 3200);
  };

  const bulkAccept = () => {
    setItems((current) => current.map((item) => (item.confidence >= 90 ? { ...item, status: "accepted" } : item)));
    setToast("已接受 1 条高置信建议，其余来源仍等待确认");
    window.setTimeout(() => setToast(""), 3200);
  };

  const navItems: Array<{ key: ViewKey | "disabled"; label: string; icon: typeof Inbox; count?: number }> = [
    { key: "inbox", label: "收录箱", icon: Inbox, count: pendingCount },
    { key: "topics", label: "主题浏览器", icon: BookOpen },
    { key: "organize", label: "整理工作台", icon: GitBranch, count: 3 },
    { key: "disabled", label: "全库搜索", icon: Search },
    { key: "disabled", label: "导入与导出", icon: FolderInput },
  ];

  return (
    <div className="ke-shell">
      <aside className="ke-sidebar">
        <div className="ke-brand">
          <img src="/src-tauri/icons/icon.png" alt="" />
          <div>
            <strong>南枫知识库</strong>
            <span>把零散资料沉淀为长期判断</span>
          </div>
        </div>
        <div className="ke-prototype-badge">
          <Sparkles size={14} />
          <span>
            结构验证原型
            <em>假数据 · 不写数据库</em>
          </span>
        </div>
        <nav className="ke-nav" aria-label="原型主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isDisabled = item.key === "disabled";
            return (
              <button
                key={item.label}
                className={!isDisabled && view === item.key ? "active" : ""}
                type="button"
                aria-disabled={isDisabled}
                onClick={() => {
                  if (item.key !== "disabled") setView(item.key);
                }}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.count !== undefined ? <em>{item.count}</em> : null}
              </button>
            );
          })}
        </nav>
        <div className="ke-sidebar-section">
          <span>工作区</span>
          <button type="button">
            <Layers3 size={17} />
            <span>全部领域</span>
            <em>7</em>
          </button>
          <button type="button">
            <Clock3 size={17} />
            <span>最近更新</span>
            <em>12</em>
          </button>
        </div>
        <div className="ke-sidebar-bottom">
          <button type="button">
            <Settings size={18} /> 设置
          </button>
          <div>
            <Database size={16} />
            <span>
              本地知识库
              <em>82 条来源 · 31 个主题</em>
            </span>
          </div>
        </div>
      </aside>

      <section className="ke-main">
        <header className="ke-topbar">
          <label>
            <Search size={17} />
            <input aria-label="搜索知识库" placeholder="搜索主题、判断、证据或原始来源" />
            <kbd>⌘ K</kbd>
          </label>
          <div className="ke-topbar-status">
            <ShieldCheck size={16} />
            <span>本地模式</span>
            <i />
            <span>上次整理 10:42</span>
          </div>
        </header>

        <div className="ke-content">
          {view === "inbox" ? (
            <InboxView
              items={items}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAccept={(id) => updateStatus(id, "accepted")}
              onUndo={(id) => updateStatus(id, "pending")}
              onBulkAccept={bulkAccept}
            />
          ) : null}
          {view === "topics" ? <TopicBrowserView onOpenContext={() => setModal("context")} /> : null}
          {view === "organize" ? <OrganizeView onOpenModal={setModal} /> : null}
        </div>
      </section>

      {toast ? (
        <div className="ke-toast">
          <Check size={16} />
          <span>{toast}</span>
        </div>
      ) : null}
      {modal ? <PrototypeModal key={modal} modal={modal} onClose={() => setModal(null)} /> : null}
    </div>
  );
}
