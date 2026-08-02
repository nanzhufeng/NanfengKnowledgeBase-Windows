import {
  ArrowRight,
  BookOpenText,
  CircleAlert,
  CircleHelp,
  CircleDot,
  Clock3,
  ExternalLink,
  FileText,
  FolderSearch,
  GitBranch,
  ListTodo,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Search,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  connectorMetricsEqual,
  measureCardToCardConnector,
} from "../connectionGeometry";
import { useRafScheduledCallback } from "../performance/useRafScheduledCallback";
import { KnowledgeTopicHierarchy } from "./KnowledgeTopicHierarchy";
import type {
  KnowledgeDomainRow,
  KnowledgeTopicDetail,
  KnowledgeTopicRow,
  TopicDecisionRow,
  TopicPropositionRow,
} from "../services/knowledgeRepository";
import {
  buildKnowledgeTimeline,
  deriveKnowledgeExpiryIssues,
  type KnowledgeEventKind,
} from "../knowledge/knowledgeReadingModel";
import {
  buildKnowledgeOverview,
  buildKnowledgeSynthesis,
  type KnowledgeOverviewItem,
  type SynthesizedKnowledgeAnchor,
} from "../knowledge/knowledgeSynthesis";
import MarkdownContent from "./MarkdownContent";

export type ReadingMode = "hypotheses" | "evolution" | "sources" | "decisions";

type KnowledgeOverviewTone = "fact" | "evidence" | "question" | "action";

type KnowledgeOverviewDialogState = {
  title: string;
  items: KnowledgeOverviewItem[];
  icon: typeof ShieldCheck;
  tone: KnowledgeOverviewTone;
  targetMode: ReadingMode;
  targetLabel: string;
};

export type KnowledgeReadingTarget = {
  requestId: number;
  viewMode?: ReadingMode;
  sourceItemId?: number;
};

export type KnowledgeSourceTarget = {
  sourceItemId: number;
  locatorJson: string | null;
  locatorLabel: string | null;
};

type KnowledgeReadingWorkspaceProps = {
  domains: KnowledgeDomainRow[];
  topics: KnowledgeTopicRow[];
  topicDetail: KnowledgeTopicDetail | null;
  relatedTopicDetails: KnowledgeTopicDetail[];
  selectedTopicId: number | null;
  onSelectTopic: (topicId: number) => void;
  onOpenSource: (target: KnowledgeSourceTarget) => void;
  navigationTarget: KnowledgeReadingTarget | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "未设置";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function statusLabel(status: TopicPropositionRow["status"]): string {
  return {
    open: "待验证",
    supported: "已支持",
    rejected: "已反驳",
    superseded: "已替代",
  }[status];
}

function resultLabel(status: TopicDecisionRow["resultStatus"]): string {
  return {
    pending: "待更新",
    in_progress: "进行中",
    succeeded: "已达成",
    failed: "未达成",
    mixed: "部分达成",
    cancelled: "已取消",
  }[status];
}

function eventKindLabel(kind: KnowledgeEventKind): string {
  return {
    source: "来源",
    note: "笔记",
    proposition: "命题",
    evidence: "证据",
    evidence_expiry: "到期",
    judgment: "判断",
    turning_point: "转折",
    question: "问题",
    question_resolved: "问题解决",
    decision: "决策",
    decision_result: "结果",
    relation: "关联",
  }[kind];
}

function eventMatchesFilter(
  kind: KnowledgeEventKind,
  filter: "all" | "sources" | "evidence" | "judgments" | "decisions",
): boolean {
  if (filter === "all") return true;
  if (filter === "sources") return kind === "source" || kind === "note";
  if (filter === "evidence") {
    return kind === "proposition"
      || kind === "evidence"
      || kind === "evidence_expiry"
      || kind === "question"
      || kind === "question_resolved";
  }
  if (filter === "judgments") return kind === "judgment" || kind === "turning_point";
  return kind === "decision" || kind === "decision_result";
}

function EvidenceList({
  title,
  items,
  onOpenSource,
}: {
  title: string;
  items: KnowledgeTopicDetail["evidence"];
  onOpenSource: (target: KnowledgeSourceTarget) => void;
}) {
  return (
    <section className="knowledge-final-evidence-column">
      <h4>{title}<span>{items.length}</span></h4>
      {items.slice(0, 4).map((item) => (
        <article key={item.id}>
          <CircleDot size={13} />
          <div>
            <MarkdownContent
              value={item.contentMarkdown}
              className="right-reading-copy right-reading-copy-10"
            />
            <button
              className="knowledge-final-anchor-button"
              onClick={() => onOpenSource({
                sourceItemId: item.sourceItemId,
                locatorJson: item.locatorJson,
                locatorLabel: item.locatorLabel,
              })}
            >
              {item.sourceTitle} · {item.locatorLabel}<ExternalLink size={12} />
            </button>
          </div>
        </article>
      ))}
      {!items.length ? <p className="knowledge-final-empty compact">暂无</p> : null}
    </section>
  );
}

function AutomaticEvidenceList({
  title,
  items,
  onOpenSource,
}: {
  title: string;
  items: SynthesizedKnowledgeAnchor[];
  onOpenSource: (target: KnowledgeSourceTarget) => void;
}) {
  return (
    <section className="knowledge-final-evidence-column">
      <h4>{title}<span>{items.length}</span></h4>
      {items.slice(0, 4).map((item) => (
        <article key={item.id}>
          <CircleDot size={13} />
          <div>
            <MarkdownContent
              value={item.quote}
              className="right-reading-copy right-reading-copy-10"
            />
            <button
              className="knowledge-final-anchor-button"
              onClick={() => onOpenSource({
                sourceItemId: item.sourceItemId,
                locatorJson: JSON.stringify({ kind: "text_quote", value: item.quote, quote: item.quote }),
                locatorLabel: `正文片段：${item.quote.slice(0, 36)}`,
              })}
            >
              {item.sourceTitle}<ExternalLink size={12} />
            </button>
          </div>
        </article>
      ))}
      {!items.length ? (
        <p className="knowledge-final-empty compact">
          {title === "反对证据" ? "暂无反证" : "暂无支持片段"}
        </p>
      ) : null}
    </section>
  );
}

function DecisionChain({
  decision,
}: {
  decision: (TopicDecisionRow & { automatic?: boolean }) | null;
}) {
  if (!decision) {
    return <p className="knowledge-final-empty">暂无决策版本</p>;
  }
  const stages = decision.automatic ? [
    {
      label: "正文判断",
      body: decision.expectedResult || "待确认目标与约束",
      meta: formatDate(decision.decidedAt),
      tone: "judgment",
    },
    {
      label: "决策草案",
      body: decision.decisionMarkdown,
      meta: "等待确认",
      tone: "decision",
    },
    {
      label: "行动",
      body: "尚未执行",
      meta: "待执行",
      tone: "action",
    },
    {
      label: "结果 / 复盘",
      body: "待回写",
      meta: "待回写",
      tone: "result",
    },
  ] : [
    {
      label: "判断",
      body: decision.decisionMarkdown,
      meta: formatDate(decision.decidedAt),
      tone: "judgment",
    },
    {
      label: "决策",
      body: decision.expectedResult || decision.title,
      meta: decision.status === "active" ? "当前版本" : decision.status,
      tone: "decision",
    },
    {
      label: "行动",
      body: decision.actualActions.join("\n") || "未记录",
      meta: `${decision.actualActions.length} 项`,
      tone: "action",
    },
    {
      label: "结果 / 复盘",
      body: decision.finalResult || decision.retrospective || "待回写",
      meta: resultLabel(decision.resultStatus),
      tone: "result",
    },
  ];
  return (
    <div className="knowledge-final-decision-scroll">
      <div className="knowledge-final-decision-track">
        {stages.map((stage, index) => (
          <div className="knowledge-final-chain-fragment" key={stage.label}>
            <article className={`knowledge-final-decision-card ${stage.tone}`}>
              <header><strong>{stage.label}</strong><small>{stage.meta}</small></header>
              <MarkdownContent
                value={stage.body}
                className="right-reading-copy right-reading-copy-10"
              />
            </article>
            {index < stages.length - 1 ? <ArrowRight size={17} aria-hidden="true" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function KnowledgeAssets({
  detail,
  onOpenSource,
  focusSourceItemId,
}: {
  detail: KnowledgeTopicDetail;
  onOpenSource: (target: KnowledgeSourceTarget) => void;
  focusSourceItemId?: number;
}) {
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(
    detail.notes[0]?.id ?? null,
  );
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(
    focusSourceItemId ?? detail.sources[0]?.id ?? null,
  );
  useEffect(() => {
    setSelectedNoteId((current) => (
      detail.notes.some((note) => note.id === current) ? current : detail.notes[0]?.id ?? null
    ));
  }, [detail.notes]);
  useEffect(() => {
    if (!focusSourceItemId) return;
    setSelectedSourceId(focusSourceItemId);
    const note = detail.notes.find((item) => item.sourceItemIds.includes(focusSourceItemId));
    if (note) setSelectedNoteId(note.id);
  }, [detail.notes, focusSourceItemId]);
  const selectedNote = detail.notes.find((note) => note.id === selectedNoteId) ?? detail.notes[0] ?? null;
  const visibleSources = selectedNote
    ? detail.sources.filter((source) => selectedNote.sourceItemIds.includes(source.id))
    : detail.sources;
  const selectedSource = visibleSources.find((source) => source.id === selectedSourceId)
    ?? visibleSources[0]
    ?? null;

  return (
    <section
      className="knowledge-final-assets"
      data-reading-section="notes-and-sources"
      aria-label="主题笔记与可回溯来源"
    >
      <div className="knowledge-final-note-reader">
        <nav
          className={`knowledge-final-note-list knowledge-final-reading-pane is-index ${
            detail.notes.length ? "" : "is-empty"
          }`}
          aria-label="当前主题笔记"
        >
          <h4>主题笔记 <span>{detail.notes.length}</span></h4>
          {detail.notes.map((note) => (
            <button
              type="button"
              className={note.id === selectedNote?.id ? "active" : ""}
              key={note.id}
              onClick={() => setSelectedNoteId(note.id)}
            >
              <StickyNote size={14} />
              <span>
                <strong>{note.title}</strong>
                <small>{formatDate(note.updatedAt)} · {note.sourceItemIds.length} 个来源</small>
              </span>
              <ArrowRight size={13} />
            </button>
          ))}
          {!detail.notes.length ? <p className="knowledge-final-empty compact">暂无独立笔记</p> : null}
        </nav>
        <article className="knowledge-final-note-detail knowledge-final-reading-pane is-content">
          {selectedNote ? (
            <>
              <header>
                <div>
                  <span>{selectedNote.noteType} · {formatDate(selectedNote.updatedAt)}</span>
                  <h3>{selectedNote.title}</h3>
                </div>
              </header>
              {selectedNote.summary ? <p className="knowledge-final-note-summary">{selectedNote.summary}</p> : null}
              <div className="knowledge-final-note-body">
                <MarkdownContent
                  value={selectedNote.bodyMarkdown || "暂无正文"}
                  className="right-reading-copy right-reading-copy-13"
                />
              </div>
            </>
          ) : (
            selectedSource ? (
              <>
                <header>
                  <div>
                    <span>{selectedSource.sourceType} · {formatDate(selectedSource.originalAt || selectedSource.importedAt)}</span>
                    <h3>{selectedSource.title}</h3>
                  </div>
                  <button
                    className="knowledge-final-open-source"
                    onClick={() => onOpenSource({
                      sourceItemId: selectedSource.id,
                      locatorJson: null,
                      locatorLabel: null,
                    })}
                  >
                    查看完整来源<ExternalLink size={13} />
                  </button>
                </header>
                <div className="knowledge-final-note-body">
                  <MarkdownContent
                    value={selectedSource.contentText || "暂无正文"}
                    className="right-reading-copy right-reading-copy-13"
                  />
                </div>
              </>
            ) : <p className="knowledge-final-empty">暂无可读内容</p>
          )}
        </article>
        <section className="knowledge-final-source-list knowledge-final-reading-pane is-support">
          <h4>{selectedNote ? "笔记来源" : "主题来源"} <span>{visibleSources.length}</span></h4>
          {visibleSources.map((source) => (
            <button
              type="button"
              key={source.id}
              className={source.id === selectedSource?.id ? "active" : ""}
              onClick={() => {
                if (selectedNote) {
                  onOpenSource({
                    sourceItemId: source.id,
                    locatorJson: null,
                    locatorLabel: null,
                  });
                } else {
                  setSelectedSourceId(source.id);
                }
              }}
            >
              <FileText size={15} />
              <span>
                <strong>{source.title}</strong>
                <small>
                  {source.sourceType} · {formatDate(source.originalAt || source.importedAt)}
                  {source.confidence === null ? "" : ` · ${Math.round(source.confidence)}%`}
                </small>
              </span>
              {selectedNote ? <ExternalLink size={13} /> : <ArrowRight size={13} />}
            </button>
          ))}
          {!visibleSources.length ? (
            <p className="knowledge-final-empty compact">暂无来源</p>
          ) : null}
        </section>
      </div>
    </section>
  );
}

function DecisionHistory({
  decisions,
  onOpenSource,
}: {
  decisions: Array<TopicDecisionRow & {
    automatic?: boolean;
    sourceItemId?: number;
    sourceTitle?: string;
  }>;
  onOpenSource: (target: KnowledgeSourceTarget) => void;
}) {
  if (!decisions.length) {
    return <p className="knowledge-final-empty">暂无决策记录</p>;
  }
  return (
    <div className="knowledge-final-decision-history">
      {decisions.map((decision, index) => (
        <article className="knowledge-final-decision-version" key={decision.id}>
          <header>
            <div>
              <span>{decision.automatic ? "自动草案" : `决策版本 ${decisions.length - index}`}</span>
              <h3>{decision.title}</h3>
            </div>
            <div>
              <strong>{resultLabel(decision.resultStatus)}</strong>
              <small>{formatDate(decision.decidedAt)}</small>
              {decision.automatic && decision.sourceItemId ? (
                <button
                  className="knowledge-final-decision-source"
                  onClick={() => onOpenSource({
                    sourceItemId: decision.sourceItemId!,
                    locatorJson: null,
                    locatorLabel: null,
                  })}
                >
                  <span>来源：{decision.sourceTitle}</span><ExternalLink size={12} />
                </button>
              ) : null}
            </div>
          </header>
          <DecisionChain decision={decision} />
          {decision.knownRisks.length ? (
            <p className="knowledge-final-decision-risks">
              <strong>已知风险</strong>{decision.knownRisks.join("；")}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function KnowledgeTimeline({
  topicId,
  events,
  eventFilter,
  onFilterChange,
  onOpenSource,
}: {
  topicId: number;
  events: ReturnType<typeof buildKnowledgeTimeline>;
  eventFilter: "all" | "sources" | "evidence" | "judgments" | "decisions";
  onFilterChange: (value: "all" | "sources" | "evidence" | "judgments" | "decisions") => void;
  onOpenSource: (target: KnowledgeSourceTarget) => void;
}) {
  return (
    <section className="knowledge-final-timeline" data-reading-section="cross-time-evidence">
      <header className="knowledge-final-timeline-heading">
        <div>
          <h3>跨时期知识事件</h3>
        </div>
        <div role="group" aria-label="筛选知识事件">
          {([
            ["all", "全部"],
            ["sources", "来源/笔记"],
            ["evidence", "命题/证据"],
            ["judgments", "判断/转折"],
            ["decisions", "决策/结果"],
          ] as const).map(([value, label]) => (
            <button
              className={eventFilter === value ? "active" : ""}
              key={value}
              onClick={() => onFilterChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <div className="knowledge-final-timeline-scroll">
        <div className="knowledge-final-timeline-track">
          {events.map((event, index) => (
            <div className="knowledge-final-timeline-fragment" key={`${event.topicId}-${event.id}`}>
              <article className={event.topicId === topicId ? "current" : "related"}>
                <header>
                  <strong>{eventKindLabel(event.kind)}</strong>
                  <small>{formatDate(event.occurredAt)}</small>
                </header>
                <span className="knowledge-final-event-topic">{event.topicName}</span>
                <MarkdownContent
                  value={event.summary}
                  className="right-reading-copy right-reading-copy-10"
                />
                {event.sourceItemId ? (
                  <button onClick={() => onOpenSource({
                    sourceItemId: event.sourceItemId!,
                    locatorJson: event.locatorJson,
                    locatorLabel: event.locatorLabel,
                  })}>
                    查看来源<ExternalLink size={12} />
                  </button>
                ) : null}
              </article>
              {index < events.length - 1 ? <i /> : null}
            </div>
          ))}
          {!events.length ? <p className="knowledge-final-empty">当前筛选无事件</p> : null}
        </div>
      </div>
    </section>
  );
}

function KnowledgeOverviewCard({
  title,
  items,
  icon: Icon,
  tone,
  actionLabel,
  onOpen,
}: {
  title: string;
  items: KnowledgeOverviewItem[];
  icon: typeof ShieldCheck;
  tone: KnowledgeOverviewTone;
  actionLabel: string;
  onOpen: (trigger: HTMLButtonElement) => void;
}) {
  return (
    <article className={`knowledge-overview-card ${tone}`}>
      <header>
        <span><Icon size={15} /></span>
        <strong>{title}</strong>
        <em>{items.length}</em>
      </header>
      <ul>
        {items.slice(0, 2).map((item) => (
          <li key={item.id} title={item.text}>
            {item.text}
            {item.automatic ? <small>自动</small> : null}
          </li>
        ))}
      </ul>
      {!items.length ? <p>暂无内容</p> : null}
      {items.length ? (
        <button type="button" onClick={(event) => onOpen(event.currentTarget)}>
          {actionLabel}<ArrowRight size={12} />
        </button>
      ) : null}
    </article>
  );
}

export function KnowledgeReadingWorkspace({
  domains,
  topics,
  topicDetail,
  relatedTopicDetails,
  selectedTopicId,
  onSelectTopic,
  onOpenSource,
  navigationTarget,
}: KnowledgeReadingWorkspaceProps) {
  const [mode, setMode] = useState<ReadingMode>("hypotheses");
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] =
    useState<"all" | "sources" | "evidence" | "judgments" | "decisions">("all");
  const [overviewDialog, setOverviewDialog] = useState<KnowledgeOverviewDialogState | null>(null);
  const [connector, setConnector] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const shellRef = useRef<HTMLElement>(null);
  const activeTopicRef = useRef<HTMLButtonElement>(null);
  const readerRef = useRef<HTMLElement>(null);
  const readerScrollRef = useRef<HTMLDivElement>(null);
  const overviewDialogCloseRef = useRef<HTMLButtonElement>(null);
  const overviewDialogReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const scrollPositions = useRef<Record<ReadingMode, number>>({
    hypotheses: 0,
    evolution: 0,
    sources: 0,
    decisions: 0,
  });
  const deferredSearch = useDeferredValue(search);

  const visibleTopics = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase("zh-CN");
    return topics.filter((topic) => (
      topic.status !== "merged"
      && (!query || `${topic.name} ${topic.description}`.toLocaleLowerCase("zh-CN").includes(query))
    ));
  }, [deferredSearch, topics]);
  const selectedTopicDomainId = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId)?.domainId ?? null,
    [selectedTopicId, topics],
  );

  const updateConnector = () => {
    const shell = shellRef.current;
    const active = activeTopicRef.current;
    const reader = readerRef.current;
    if (!shell || !active || !reader) {
      setConnector((current) => connectorMetricsEqual(current, null) ? current : null);
      return;
    }
    const shellRect = shell.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const readerRect = reader.getBoundingClientRect();
    const next = measureCardToCardConnector(
      shellRect,
      activeRect,
      readerRect,
    );
    setConnector((current) => connectorMetricsEqual(current, next) ? current : next);
  };
  const scheduleConnectorUpdate = useRafScheduledCallback(updateConnector);

  useLayoutEffect(() => {
    scheduleConnectorUpdate();
    const resizeObserver = new ResizeObserver(scheduleConnectorUpdate);
    if (shellRef.current) resizeObserver.observe(shellRef.current);
    if (readerRef.current) resizeObserver.observe(readerRef.current);
    return () => resizeObserver.disconnect();
  }, [deferredSearch, scheduleConnectorUpdate, selectedTopicId, topics]);

  useEffect(() => {
    scheduleConnectorUpdate();
  }, [scheduleConnectorUpdate, topicDetail]);

  useEffect(() => {
    setEventFilter("all");
  }, [selectedTopicId]);

  useEffect(() => {
    if (!overviewDialog) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    overviewDialogCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOverviewDialog(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [overviewDialog]);

  useEffect(() => {
    if (overviewDialog) return;
    overviewDialogReturnFocusRef.current?.focus();
    overviewDialogReturnFocusRef.current = null;
  }, [overviewDialog]);

  const switchMode = (nextMode: ReadingMode) => {
    if (nextMode === mode) return;
    if (readerScrollRef.current) scrollPositions.current[mode] = readerScrollRef.current.scrollTop;
    setMode(nextMode);
    requestAnimationFrame(() => {
      if (readerScrollRef.current) {
        readerScrollRef.current.scrollTop = scrollPositions.current[nextMode];
      }
    });
  };

  useEffect(() => {
    if (!navigationTarget?.viewMode) return;
    switchMode(navigationTarget.viewMode);
  }, [navigationTarget?.requestId]);

  const displayDetail = topicDetail;
  const synthesis = useMemo(
    () => displayDetail ? buildKnowledgeSynthesis(displayDetail) : null,
    [displayDetail],
  );
  const overview = useMemo(
    () => displayDetail && synthesis ? buildKnowledgeOverview(displayDetail, synthesis) : null,
    [displayDetail, synthesis],
  );
  const readingModel = useMemo(() => {
    const automaticJudgmentsFromContent = [...(synthesis?.judgments ?? [])]
      .reverse()
      .map((judgment, index) => ({
        id: -(index + 1),
        publicId: judgment.id,
        propositionId: null,
        statementMarkdown: judgment.statement,
        state: "正文提炼",
        confidence: judgment.confidence,
        changeReason: judgment.changeReason,
        effectiveAt: judgment.effectiveAt,
        createdAt: judgment.effectiveAt,
      }));
    const judgments = (displayDetail?.judgments.length ?? 0) > 0
      ? displayDetail!.judgments
      : automaticJudgmentsFromContent;
    const persistedHypotheses = displayDetail?.propositions.filter(
      (item) => item.propositionKind === "hypothesis" && item.status !== "superseded",
    ) ?? [];
    const hypothesesFromContent = (synthesis?.hypotheses ?? []).map((hypothesis, index) => ({
      id: -(index + 1),
      publicId: hypothesis.id,
      topicId: displayDetail!.topic.id,
      statementMarkdown: hypothesis.statement,
      status: "open" as const,
      propositionKind: "hypothesis" as const,
      hypothesisGroup: null,
      confidence: hypothesis.confidence,
      invalidationCondition: hypothesis.invalidationCondition,
      validityStatus: "active" as const,
      confirmedAt: null,
      validFrom: hypothesis.anchors[0]?.occurredAt ?? null,
      validUntil: null,
      reviewAt: null,
      createdAt: hypothesis.anchors[0]?.occurredAt ?? "",
      updatedAt: hypothesis.anchors.at(-1)?.occurredAt ?? "",
      automatic: true,
      sourceItemIds: [...new Set(hypothesis.anchors.map((anchor) => anchor.sourceItemId))],
      automaticAnchors: hypothesis.anchors,
      automaticRationale: hypothesis.rationale,
      automaticIndex: index,
    }));
    const hypotheses = persistedHypotheses.length
      ? persistedHypotheses.map((item) => ({
          ...item,
          automatic: false,
          sourceItemIds: [] as number[],
          automaticAnchors: [] as SynthesizedKnowledgeAnchor[],
          automaticRationale: "",
        }))
      : hypothesesFromContent;
    const pendingQuestions = displayDetail?.questions.filter(
      (item) => item.status !== "resolved",
    ) ?? [];
    const synthesizedQuestions = pendingQuestions.length
      ? []
      : (synthesis?.openQuestions ?? []).map((question, index) => ({
          id: -(index + 1),
          publicId: `automatic-question-${index}`,
          question,
          importance: "medium",
          affectsCurrentJudgment: true,
          status: "automatic",
          resolutionNote: "",
          createdAt: "",
          updatedAt: "",
        }));
    const expiryIssues = displayDetail
      ? deriveKnowledgeExpiryIssues(displayDetail, new Date())
      : [];
    const timeline = topicDetail
      ? buildKnowledgeTimeline(topicDetail, relatedTopicDetails)
      : [];
    const automaticDecisions = (synthesis?.decisionDrafts ?? []).map((decision, index) => ({
      id: -(index + 1),
      publicId: decision.id,
      topicId: displayDetail!.topic.id,
      propositionId: null,
      judgmentSnapshotId: null,
      title: decision.title,
      decisionMarkdown: decision.decision,
      decidedAt: decision.decidedAt,
      status: "active" as const,
      knownRisks: decision.knownRisks,
      expectedResult: decision.expectedResult,
      actualActions: decision.actualActions,
      reviewAt: null,
      resultStatus: "pending" as const,
      finalResult: decision.finalResult,
      retrospective: decision.retrospective,
      createdAt: decision.decidedAt,
      updatedAt: decision.decidedAt,
      automatic: true,
      sourceItemId: decision.sourceItemId,
      sourceTitle: decision.sourceTitle,
    }));
    const decisions = (displayDetail?.decisions.length ?? 0) > 0
      ? displayDetail!.decisions
      : automaticDecisions;

    return {
      judgments,
      currentJudgment: judgments[0] ?? null,
      previousJudgment: judgments[1] ?? null,
      hypotheses,
      pendingQuestions,
      synthesizedQuestions,
      expiryIssues,
      timeline,
      decisions,
      activeDomain: topicDetail
        ? domains.find((domain) => domain.id === topicDetail.topic.domainId) ?? null
        : null,
    };
  }, [displayDetail, domains, relatedTopicDetails, synthesis, topicDetail]);
  const {
    judgments,
    currentJudgment,
    previousJudgment,
    hypotheses,
    pendingQuestions,
    synthesizedQuestions,
    expiryIssues,
    timeline,
    decisions,
    activeDomain,
  } = readingModel;
  const visibleTimeline = useMemo(
    () => timeline.filter((event) => eventMatchesFilter(event.kind, eventFilter)),
    [eventFilter, timeline],
  );

  const shellStyle = connector === null
    ? undefined
    : ({
        "--knowledge-connector-y": `${connector.top}px`,
        "--knowledge-connector-x": `${connector.left}px`,
        "--knowledge-connector-width": `${connector.width}px`,
      } as CSSProperties);

  const openOverviewSection = (nextMode: ReadingMode) => {
    if (nextMode !== mode) setMode(nextMode);
    requestAnimationFrame(() => {
      if (readerScrollRef.current) readerScrollRef.current.scrollTop = 0;
    });
  };

  const openOverviewDialog = (
    dialog: KnowledgeOverviewDialogState,
    trigger: HTMLButtonElement,
  ) => {
    overviewDialogReturnFocusRef.current = trigger;
    setOverviewDialog(dialog);
  };

  const openOverviewDialogTarget = () => {
    if (!overviewDialog) return;
    const targetMode = overviewDialog.targetMode;
    overviewDialogReturnFocusRef.current = null;
    setOverviewDialog(null);
    openOverviewSection(targetMode);
  };

  return (
    <section
      className="knowledge-final-shell"
      data-reading-mode={mode}
      ref={shellRef}
      style={shellStyle}
    >
      <aside className="knowledge-final-browser" aria-label="领域与主题">
        <label className="knowledge-final-search">
          <Search size={16} />
          <input
            aria-label="搜索领域或主题"
            placeholder="搜索领域或主题"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <KnowledgeTopicHierarchy
          domains={domains}
          topics={visibleTopics}
          selectedTopicId={selectedTopicId}
          selectedTopicDomainId={selectedTopicDomainId}
          searchActive={Boolean(deferredSearch.trim())}
          activeTopicRef={activeTopicRef}
          onSelectTopic={onSelectTopic}
          onScroll={scheduleConnectorUpdate}
        />
      </aside>

      {connector && connector.width > 0 ? (
        <span className="knowledge-final-connector" aria-hidden="true"><i /><b /></span>
      ) : null}

      <article className="knowledge-final-reader knowledge-card association-link-target" ref={readerRef}>
        {topicDetail ? (
          <>
            <header className="knowledge-final-heading">
              <div>
                <span>{activeDomain?.name ?? "知识领域"}</span>
                <h1>{topicDetail.topic.name}</h1>
                {topicDetail.topic.description ? <p>{topicDetail.topic.description}</p> : null}
              </div>
            </header>

            {overview ? (
              <section className="knowledge-overview" aria-label="自动知识摘要">
                <article className="knowledge-overview-judgment">
                  <header>
                    <span><Sparkles size={16} /></span>
                    <strong>当前判断</strong>
                    <em>{overview.currentJudgment.automatic ? "自动提炼" : "正式判断"}</em>
                    {overview.currentJudgment.confidence !== null
                      ? <b>{Math.round(overview.currentJudgment.confidence)}%</b>
                      : null}
                    {overview.currentJudgment.effectiveAt
                      ? <small>{formatDate(overview.currentJudgment.effectiveAt)}</small>
                      : null}
                  </header>
                  <p title={overview.currentJudgment.statement}>{overview.currentJudgment.statement}</p>
                </article>
                <div className="knowledge-overview-grid">
                  <KnowledgeOverviewCard
                    title="事实与线索"
                    items={overview.facts}
                    icon={ShieldCheck}
                    tone="fact"
                    actionLabel="查看全部"
                    onOpen={(trigger) => openOverviewDialog({
                      title: "事实与线索",
                      items: overview.facts,
                      icon: ShieldCheck,
                      tone: "fact",
                      targetMode: "hypotheses",
                      targetLabel: "进入竞争假设",
                    }, trigger)}
                  />
                  <KnowledgeOverviewCard
                    title="关键证据"
                    items={overview.evidence}
                    icon={FolderSearch}
                    tone="evidence"
                    actionLabel="查看全部"
                    onOpen={(trigger) => openOverviewDialog({
                      title: "关键证据",
                      items: overview.evidence,
                      icon: FolderSearch,
                      tone: "evidence",
                      targetMode: "hypotheses",
                      targetLabel: "进入竞争假设",
                    }, trigger)}
                  />
                  <KnowledgeOverviewCard
                    title="待验证问题"
                    items={overview.questions}
                    icon={CircleHelp}
                    tone="question"
                    actionLabel="查看全部"
                    onOpen={(trigger) => openOverviewDialog({
                      title: "待验证问题",
                      items: overview.questions,
                      icon: CircleHelp,
                      tone: "question",
                      targetMode: "hypotheses",
                      targetLabel: "进入竞争假设",
                    }, trigger)}
                  />
                  <KnowledgeOverviewCard
                    title="建议下一步"
                    items={overview.actions}
                    icon={ListTodo}
                    tone="action"
                    actionLabel="查看全部"
                    onOpen={(trigger) => openOverviewDialog({
                      title: "建议下一步",
                      items: overview.actions,
                      icon: ListTodo,
                      tone: "action",
                      targetMode: "decisions",
                      targetLabel: "进入决策版本",
                    }, trigger)}
                  />
                </div>
              </section>
            ) : null}

            <nav className="knowledge-final-tabs" aria-label="知识视图模块">
              <button
                aria-selected={mode === "hypotheses"}
                className={mode === "hypotheses" ? "active" : ""}
                onClick={() => switchMode("hypotheses")}
                role="tab"
              >
                <GitBranch size={17} />竞争假设 <span>{hypotheses.length}</span>
              </button>
              <button
                aria-selected={mode === "evolution"}
                className={mode === "evolution" ? "active" : ""}
                onClick={() => switchMode("evolution")}
                role="tab"
              >
                <Clock3 size={17} />判断演变 <span>{judgments.length}</span>
              </button>
              <button
                aria-selected={mode === "sources"}
                className={mode === "sources" ? "active" : ""}
                onClick={() => switchMode("sources")}
                role="tab"
              >
                <FileText size={17} />笔记与来源 <span>{(displayDetail?.notes.length ?? 0) + (displayDetail?.sources.length ?? 0)}</span>
              </button>
              <button
                aria-selected={mode === "decisions"}
                className={mode === "decisions" ? "active" : ""}
                onClick={() => switchMode("decisions")}
                role="tab"
              >
                <BookOpenText size={17} />决策版本 <span>{decisions.length}</span>
              </button>
            </nav>

            <div className="knowledge-final-scroll" ref={readerScrollRef}>
              {mode === "hypotheses" ? (
                <div className="knowledge-final-content-grid">
                  <main>
                    <div className="knowledge-final-hypothesis-grid">
                      {hypotheses.map((hypothesis, index) => {
                        const related = (displayDetail?.evidence ?? []).filter(
                          (item) => hypothesis.automatic
                            ? hypothesis.sourceItemIds.includes(item.sourceItemId)
                            : item.propositionId === hypothesis.id,
                        );
                        const automaticAnchors = hypothesis.automatic
                          ? hypothesis.automaticAnchors
                          : [];
                        return (
                          <article
                            className={`knowledge-final-hypothesis ${index % 2 ? "oppose" : "support"}`}
                            key={hypothesis.id}
                          >
                            <header>
                              <span>{String.fromCharCode(65 + index)}</span>
                              <div>
                                <strong>{hypothesis.automatic ? "自动提取" : statusLabel(hypothesis.status)}</strong>
                                {hypothesis.hypothesisGroup ? <small>{hypothesis.hypothesisGroup}</small> : null}
                              </div>
                              <em>{Math.round(hypothesis.confidence)}%</em>
                            </header>
                            <section className="knowledge-final-hypothesis-thesis">
                              <span>核心解释</span>
                              <MarkdownContent
                                value={hypothesis.statementMarkdown}
                                className="right-reading-copy right-reading-copy-13"
                              />
                            </section>
                            {hypothesis.automatic && hypothesis.automaticRationale ? (
                              <section className="knowledge-final-auto-rationale">
                                <span>提取依据</span>
                                <p>{hypothesis.automaticRationale}</p>
                              </section>
                            ) : null}
                            <div className="knowledge-final-evidence-grid">
                              {hypothesis.automatic ? (
                                <>
                                  <AutomaticEvidenceList
                                    title="支持证据"
                                    items={automaticAnchors.filter((item) => item.stance === "support")}
                                    onOpenSource={onOpenSource}
                                  />
                                  <AutomaticEvidenceList
                                    title="反对证据"
                                    items={automaticAnchors.filter((item) => item.stance === "oppose")}
                                    onOpenSource={onOpenSource}
                                  />
                                </>
                              ) : (
                                <>
                                  <EvidenceList
                                    title="支持证据"
                                    items={related.filter((item) => item.stance === "support")}
                                    onOpenSource={onOpenSource}
                                  />
                                  <EvidenceList
                                    title="反对证据"
                                    items={related.filter((item) => item.stance === "oppose")}
                                    onOpenSource={onOpenSource}
                                  />
                                </>
                              )}
                            </div>
                            <footer aria-label="假设有效性条件">
                              <div><small>有效期至</small><strong>{formatDate(hypothesis.validUntil)}</strong></div>
                              <div><small>证伪条件</small><strong>{hypothesis.invalidationCondition || "未设置"}</strong></div>
                            </footer>
                          </article>
                        );
                      })}
                      {!hypotheses.length ? (
                        <section className="knowledge-final-no-proposition">
                          <CircleAlert size={22} />
                          <div>
                            <h3>暂无竞争解释</h3>
                            <p>{displayDetail?.notes.length ?? 0} 篇笔记 · {displayDetail?.sources.length ?? 0} 个来源</p>
                            {(displayDetail?.notes ?? []).slice(0, 3).map((note) => (
                              <button type="button" key={note.id} onClick={() => switchMode("sources")}>
                                <StickyNote size={14} />{note.title}<ArrowRight size={13} />
                              </button>
                            ))}
                            {!(displayDetail?.notes.length ?? 0)
                              ? (displayDetail?.sources ?? []).slice(0, 3).map((source) => (
                                <button
                                  type="button"
                                  key={source.id}
                                  onClick={() => onOpenSource({
                                    sourceItemId: source.id,
                                    locatorJson: null,
                                    locatorLabel: null,
                                  })}
                                >
                                  <FileText size={14} />{source.title}<ExternalLink size={13} />
                                </button>
                              ))
                              : null}
                          </div>
                        </section>
                      ) : null}
                    </div>
                  </main>

                  <aside className="knowledge-final-insights">
                    <section>
                      <h3>待验证问题 <span>{pendingQuestions.length + synthesizedQuestions.length}</span></h3>
                      <ol>
                        {[...pendingQuestions, ...synthesizedQuestions].slice(0, 4).map((item) => (
                          <li key={item.id}>{item.question}</li>
                        ))}
                      </ol>
                      {!pendingQuestions.length && !synthesizedQuestions.length
                        ? <small>暂无</small>
                        : null}
                    </section>
                    <section className="expiring">
                      <h3>知识有效期 <span>{expiryIssues.length}</span></h3>
                      {expiryIssues.slice(0, 4).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => item.sourceItemId && onOpenSource({
                            sourceItemId: item.sourceItemId,
                            locatorJson: item.locatorJson,
                            locatorLabel: item.locatorLabel,
                          })}
                        >
                          <strong>{item.title}</strong>
                          <small>{item.status} · {formatDate(item.dueAt)}</small>
                        </button>
                      ))}
                      {!expiryIssues.length ? <small>暂无</small> : null}
                    </section>
                  </aside>
                </div>
              ) : mode === "evolution" ? (
                <div className="knowledge-final-evolution">
                  <KnowledgeTimeline
                    topicId={topicDetail.topic.id}
                    events={visibleTimeline}
                    eventFilter={eventFilter}
                    onFilterChange={setEventFilter}
                    onOpenSource={onOpenSource}
                  />

                  <section
                    className="knowledge-final-version-diff"
                    data-reading-section="version-difference"
                    aria-label="版本差异与变化原因"
                  >
                      <div>
                        <article>
                          <strong>上版判断 <small>{formatDate(previousJudgment?.effectiveAt)}</small></strong>
                          <MarkdownContent
                            value={previousJudgment?.statementMarkdown || "暂无上版"}
                            className="right-reading-copy right-reading-copy-11"
                          />
                        </article>
                        <article>
                          <strong>当前判断 <small>{formatDate(currentJudgment?.effectiveAt)}</small></strong>
                          <MarkdownContent
                            value={currentJudgment?.statementMarkdown || "暂无当前判断"}
                            className="right-reading-copy right-reading-copy-11"
                          />
                        </article>
                      </div>
                      <footer>
                        <strong>变化原因（关联证据）</strong>
                        <p>{currentJudgment?.changeReason || displayDetail?.turningPoints[0]?.explanation || "未记录"}</p>
                        {displayDetail?.turningPoints.slice(0, 3).map((point) => (
                          <small key={point.id}>• {point.title}：{point.explanation}</small>
                        ))}
                      </footer>
                  </section>
                </div>
              ) : mode === "sources" ? (
                displayDetail ? (
                  <div className="knowledge-final-source-mode">
                    <KnowledgeAssets
                      detail={displayDetail}
                      onOpenSource={onOpenSource}
                      focusSourceItemId={navigationTarget?.sourceItemId}
                    />
                  </div>
                ) : null
              ) : (
                <div
                  className="knowledge-final-decisions-mode"
                  data-reading-section="decision-chain"
                  aria-label="判断、决策、行动与复盘"
                >
                  <DecisionHistory decisions={decisions} onOpenSource={onOpenSource} />
                </div>
              )}

            </div>
          </>
        ) : (
          <div className="knowledge-final-no-topic">
            <CircleAlert size={30} />
            <h1>选择主题阅读</h1>
          </div>
        )}
      </article>
      {overviewDialog ? createPortal((() => {
        const DialogIcon = overviewDialog.icon;
        return (
          <div
            className="knowledge-overview-dialog-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOverviewDialog(null);
            }}
          >
            <section
              aria-labelledby="knowledge-overview-dialog-title"
              aria-modal="true"
              className={`knowledge-overview-dialog ${overviewDialog.tone}`}
              role="dialog"
            >
              <header>
                <span><DialogIcon size={18} /></span>
                <h2 id="knowledge-overview-dialog-title">{overviewDialog.title}</h2>
                <em>{overviewDialog.items.length}</em>
                <button
                  aria-label="关闭完整内容"
                  onClick={() => setOverviewDialog(null)}
                  ref={overviewDialogCloseRef}
                  type="button"
                >
                  <X size={18} />
                </button>
              </header>
              <ol className="knowledge-overview-dialog-list">
                {overviewDialog.items.map((item, index) => (
                  <li key={item.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{item.text}</p>
                    {item.automatic ? <small>自动提炼</small> : null}
                  </li>
                ))}
              </ol>
              <footer>
                <button type="button" onClick={() => setOverviewDialog(null)}>关闭</button>
                <button className="primary" type="button" onClick={openOverviewDialogTarget}>
                  {overviewDialog.targetLabel}<ArrowRight size={14} />
                </button>
              </footer>
            </section>
          </div>
        );
      })(), document.body) : null}
    </section>
  );
}
