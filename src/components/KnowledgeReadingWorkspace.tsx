import {
  ArrowRight,
  BookOpenText,
  CircleAlert,
  CircleDot,
  Clock3,
  ExternalLink,
  FileText,
  GitBranch,
  ListTodo,
  Maximize2,
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
  KnowledgeTopicDetail,
  TopicDecisionRow,
  TopicPropositionRow,
} from "../services/knowledgeRepository";
import {
  buildKnowledgeTimeline,
  deriveKnowledgeExpiryIssues,
  type KnowledgeEventKind,
} from "../knowledge/knowledgeReadingModel";
import MarkdownContent from "./MarkdownContent";
import type { AiTaxonomyRevision, AiTopicInsight } from "../services/aiRepository";
import { splitAiSummaryMarkdown } from "../aiInsightPresentation";
import {
  findAppliedAiTaxonomyTopic,
  type AppliedAiTaxonomyHierarchy,
} from "../aiTaxonomyPresentation";
import type { AiTopicBatchProgress, AiTopicBatchResult } from "../aiTopicBatch";

export type ReadingMode = "hypotheses" | "evolution" | "sources" | "decisions";


export type KnowledgeReadingTarget = {
  requestId: number;
  viewMode?: ReadingMode;
  sourceItemId?: number;
};

export type KnowledgeSourceReturnTarget = {
  topicId: number;
  viewMode: ReadingMode;
  sourceItemId: number;
};

export type KnowledgeSourceTarget = {
  sourceItemId: number;
  locatorJson: string | null;
  locatorLabel: string | null;
  returnTarget?: KnowledgeSourceReturnTarget;
};

export type AiSingleInsightResult = {
  status: "success" | "failed";
  topicName: string;
  message: string;
  generatedAt: string | null;
};

type KnowledgeReadingWorkspaceProps = {
  taxonomyHierarchy: AppliedAiTaxonomyHierarchy;
  topicDetail: KnowledgeTopicDetail | null;
  relatedTopicDetails: KnowledgeTopicDetail[];
  selectedTopicId: number | null;
  onSelectTopic: (topicId: number) => void;
  onOpenSource: (target: KnowledgeSourceTarget) => void;
  navigationTarget: KnowledgeReadingTarget | null;
  aiInsight: AiTopicInsight | null;
  appliedAiRevision: AiTaxonomyRevision | null;
  aiRunning: boolean;
  aiRunningTopicName: string | null;
  aiSingleResult: AiSingleInsightResult | null;
  aiBatchProgress: AiTopicBatchProgress | null;
  aiBatchResult: AiTopicBatchResult | null;
  onRunAiInsight: () => void;
  onCloseAiSingleResult: () => void;
  onRunAllAiInsights: () => void;
  onRunPendingAiInsights: () => void;
  onRetryFailedAiInsights: () => void;
  onCloseAiBatchResult: () => void;
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
    <section className="knowledge-final-evidence-column" data-card-interaction="surface-lift">
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
              data-knowledge-source-id={item.sourceItemId}
              onClick={() => onOpenSource({
                sourceItemId: item.sourceItemId,
                locatorJson: item.locatorJson,
                locatorLabel: item.locatorLabel,
              })}
            >
              {item.sourceTitle} · {item.locatorLabel}<ExternalLink size={12} data-card-cue="forward" />
            </button>
          </div>
        </article>
      ))}
      {!items.length ? <p className="knowledge-final-empty compact">暂无</p> : null}
    </section>
  );
}

function DecisionChain({
  decision,
}: {
  decision: TopicDecisionRow | null;
}) {
  if (!decision) {
    return <p className="knowledge-final-empty">暂无决策版本</p>;
  }
  const stages = [
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
            <article
              className={`knowledge-final-decision-card ${stage.tone}`}
              data-card-interaction="surface-lift"
            >
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
  integrationMarkdown,
  integrationSourceItemIds,
  onOpenSource,
  focusSourceItemId,
}: {
  detail: KnowledgeTopicDetail;
  integrationMarkdown: string;
  integrationSourceItemIds: number[];
  onOpenSource: (target: KnowledgeSourceTarget) => void;
  focusSourceItemId?: number;
}) {
  const [localSourceSelection, setLocalSourceSelection] = useState<{
    topicId: number;
    sourceItemId: number | null;
  } | null>(null);
  const hasLocalSelection = localSourceSelection?.topicId === detail.topic.id;
  const selectedSourceItemId = hasLocalSelection ? localSourceSelection.sourceItemId : null;
  const activeSourceItemId = hasLocalSelection ? selectedSourceItemId : focusSourceItemId;
  const integrationSourceIdSet = useMemo(
    () => new Set(integrationSourceItemIds),
    [integrationSourceItemIds],
  );
  const integrationSources = useMemo(
    () => detail.sources.filter((source) => integrationSourceIdSet.has(source.id)),
    [detail.sources, integrationSourceIdSet],
  );
  const selectedSource = integrationSources.find((source) => source.id === selectedSourceItemId) ?? null;

  if (!detail.sources.length) {
    return (
      <p
        className="knowledge-final-empty knowledge-final-assets-empty"
        data-reading-section="notes-and-sources"
      >
        当前主题尚无可供 AI 归纳的笔记
      </p>
    );
  }

  return (
    <section
      className="knowledge-final-assets"
      data-reading-section="notes-and-sources"
      aria-label="AI 归纳材料与可回溯来源"
    >
      <div
        className={`knowledge-final-note-reader is-topic-integration ${integrationSources.length ? "" : "is-integration-only"}`}
        data-assets-layout={integrationSources.length ? "topic-integration" : "integration-only"}
      >
        <article className="knowledge-final-note-detail knowledge-final-reading-pane is-content">
          <header>
            <div>
              <span>
                {selectedSource
                  ? `来源笔记 · ${selectedSource.sourceType} · ${formatDate(selectedSource.originalAt || selectedSource.importedAt)}`
                  : "AI 归纳材料"}
              </span>
              <h3>{selectedSource?.title ?? detail.topic.name}</h3>
            </div>
            {selectedSource ? (
              <button
                type="button"
                className="knowledge-final-back-to-integration"
                onClick={() => setLocalSourceSelection({
                  topicId: detail.topic.id,
                  sourceItemId: null,
                })}
              >
                <BookOpenText size={14} aria-hidden="true" />
                返回材料列表
              </button>
            ) : null}
          </header>
          <div className="knowledge-final-note-body">
            <MarkdownContent
              value={selectedSource?.contentText?.trim() || (selectedSource
                ? "当前来源没有可显示正文。"
                : integrationMarkdown || "待主题管理 AI 生成全库分类并应用后显示主题整合。")}
              className="right-reading-copy right-reading-copy-13"
            />
          </div>
        </article>
        {integrationSources.length ? (
          <section className="knowledge-final-source-list knowledge-final-reading-pane is-support">
            <h4>AI 自动关联笔记来源 <span>{integrationSources.length}</span></h4>
            {integrationSources.map((source) => (
              <div
                key={source.id}
                className={`knowledge-final-source-item ${source.id === activeSourceItemId ? "active" : ""}`}
                data-card-interaction="lift"
              >
                <button
                  type="button"
                  className="knowledge-final-source-switch"
                  aria-pressed={source.id === selectedSourceItemId}
                  aria-label={`在当前主题内阅读 ${source.title}`}
                  onClick={() => setLocalSourceSelection({
                    topicId: detail.topic.id,
                    sourceItemId: source.id,
                  })}
                >
                  <FileText size={15} aria-hidden="true" />
                  <span>
                    <strong>{source.title}</strong>
                    <small>
                      {source.sourceType} · {formatDate(source.originalAt || source.importedAt)}
                      {source.confidence === null ? "" : ` · ${Math.round(source.confidence)}%`}
                    </small>
                  </span>
                </button>
                <button
                  type="button"
                  className="knowledge-final-source-open"
                  data-knowledge-source-id={source.id}
                  aria-label={`在全部笔记中打开 ${source.title}`}
                  title="进入全部笔记"
                  onClick={() => onOpenSource({
                    sourceItemId: source.id,
                    locatorJson: null,
                    locatorLabel: null,
                  })}
                >
                  <ExternalLink size={13} aria-hidden="true" data-card-cue="forward" />
                </button>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </section>
  );
}

function DecisionHistory({
  decisions,
}: {
  decisions: TopicDecisionRow[];
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
              <span>决策版本 {decisions.length - index}</span>
              <h3>{decision.title}</h3>
            </div>
            <div>
              <strong>{resultLabel(decision.resultStatus)}</strong>
              <small>{formatDate(decision.decidedAt)}</small>
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

function AiSourceReferences({
  sourceItemIds,
  detail,
  onOpenSource,
}: {
  sourceItemIds: number[];
  detail: KnowledgeTopicDetail;
  onOpenSource: (target: KnowledgeSourceTarget) => void;
}) {
  const sources = sourceItemIds
    .map((sourceId) => detail.sources.find((source) => source.id === sourceId))
    .filter((source): source is KnowledgeTopicDetail["sources"][number] => Boolean(source));
  if (!sources.length) return null;
  return (
    <footer className="knowledge-ai-source-references" aria-label="AI 结论来源">
      {sources.map((source) => (
        <button
          type="button"
          key={source.id}
          onClick={() => onOpenSource({
            sourceItemId: source.id,
            locatorJson: null,
            locatorLabel: null,
          })}
        >
          <FileText size={12} /><span>{source.title}</span>
        </button>
      ))}
    </footer>
  );
}

function AiHypothesisCards({
  insight,
  detail,
  onOpenSource,
}: {
  insight: AiTopicInsight;
  detail: KnowledgeTopicDetail;
  onOpenSource: (target: KnowledgeSourceTarget) => void;
}) {
  return (
    <section className="knowledge-ai-mode-list" aria-label="AI 生成的竞争假设">
      {insight.payload.hypotheses.map((item, index) => (
        <article
          className={`knowledge-final-hypothesis ${index % 2 ? "oppose" : "support"}`}
          key={`${item.title}-${item.statement}`}
        >
          <header className="knowledge-ai-hypothesis-header">
            <span><Sparkles size={12} />AI {String(index + 1).padStart(2, "0")}</span>
            <strong>{Math.round(item.confidence)}%</strong>
          </header>
          <div className="knowledge-final-hypothesis-thesis" data-card-interaction="surface-lift">
            <small>核心解释</small>
            <h3>{item.title}</h3>
            <p>{item.statement}</p>
          </div>
          <footer aria-label="假设有效性条件">
            <div><small>证伪条件</small><strong>{item.invalidationCondition || "未形成可靠条件"}</strong></div>
          </footer>
          <AiSourceReferences sourceItemIds={item.sourceItemIds} detail={detail} onOpenSource={onOpenSource} />
        </article>
      ))}
    </section>
  );
}

function AiJudgmentEvolution({
  insight,
  detail,
  onOpenSource,
}: {
  insight: AiTopicInsight;
  detail: KnowledgeTopicDetail;
  onOpenSource: (target: KnowledgeSourceTarget) => void;
}) {
  return (
    <section className="knowledge-ai-evolution" aria-label="AI 生成的判断演变">
      {insight.payload.judgmentEvolution.map((item, index) => (
        <article data-card-interaction="surface-lift" key={`${item.occurredAt}-${item.title}`}>
          <header><span>{item.occurredAt ? formatDate(item.occurredAt) : `节点 ${index + 1}`}</span><strong>{item.title}</strong></header>
          {item.fromStatement ? <p><small>此前</small>{item.fromStatement}</p> : null}
          <p><small>转变为</small>{item.toStatement}</p>
          <p><small>变化原因</small>{item.reason}</p>
          <AiSourceReferences sourceItemIds={item.sourceItemIds} detail={detail} onOpenSource={onOpenSource} />
        </article>
      ))}
    </section>
  );
}

function AiDecisionCards({
  insight,
  detail,
  onOpenSource,
}: {
  insight: AiTopicInsight;
  detail: KnowledgeTopicDetail;
  onOpenSource: (target: KnowledgeSourceTarget) => void;
}) {
  return (
    <section className="knowledge-ai-decisions" aria-label="AI 生成的决策版本">
      {insight.payload.decisions.map((item, index) => (
        <article className="knowledge-final-decision-version" key={`${item.title}-${item.action}`}>
          <header>
            <div><span>AI 决策版本 {insight.payload.decisions.length - index}</span><h3>{item.title}</h3></div>
            <strong>{item.status === "completed" ? "已完成" : item.status === "in_progress" ? "进行中" : "待确认"}</strong>
          </header>
          <div className="knowledge-final-decision-chain">
            {[
              { label: "形成依据", body: item.basis, tone: "basis" },
              { label: "行动", body: item.action, tone: "action" },
              { label: "结果/复盘", body: item.result || "尚未产生结果", tone: "result" },
            ].map((stage) => (
              <article className={`knowledge-final-decision-card ${stage.tone}`} data-card-interaction="surface-lift" key={stage.label}>
                <header><strong>{stage.label}</strong></header>
                <p>{stage.body}</p>
              </article>
            ))}
          </div>
          <AiSourceReferences sourceItemIds={item.sourceItemIds} detail={detail} onOpenSource={onOpenSource} />
        </article>
      ))}
    </section>
  );
}

function AiInsightBundleContent({
  insight,
  detail,
  onOpenSource,
}: {
  insight: AiTopicInsight;
  detail: KnowledgeTopicDetail;
  onOpenSource: (target: KnowledgeSourceTarget) => void;
}) {
  const summary = splitAiSummaryMarkdown(insight.payload.summaryMarkdown);
  return (
    <div className="knowledge-ai-insight-content">
      <MarkdownContent value={summary.overviewMarkdown} />

      {insight.payload.keyInsights.length ? (
        <section className="knowledge-ai-insight-section">
          <h3>关键洞察 <span>{insight.payload.keyInsights.length}</span></h3>
          <div className="knowledge-ai-insight-grid">
            {insight.payload.keyInsights.map((item) => (
              <article data-card-interaction="surface-lift" key={`${item.title}-${item.detail}`}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <AiSourceReferences
                  sourceItemIds={item.sourceItemIds}
                  detail={detail}
                  onOpenSource={onOpenSource}
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {insight.payload.hypotheses.length ? (
        <section className="knowledge-ai-insight-section">
          <h3>竞争假设 <span>{insight.payload.hypotheses.length}</span></h3>
          <div className="knowledge-ai-insight-grid">
            {insight.payload.hypotheses.map((item) => (
              <article data-card-interaction="surface-lift" key={`${item.title}-${item.statement}`}>
                <strong>{item.title} · {Math.round(item.confidence)}%</strong>
                <p>{item.statement}</p>
                {item.invalidationCondition ? <small>证伪条件：{item.invalidationCondition}</small> : null}
                <AiSourceReferences
                  sourceItemIds={item.sourceItemIds}
                  detail={detail}
                  onOpenSource={onOpenSource}
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {insight.payload.judgmentEvolution.length ? (
        <section className="knowledge-ai-insight-section">
          <h3>判断演变 <span>{insight.payload.judgmentEvolution.length}</span></h3>
          <div className="knowledge-ai-insight-list">
            {insight.payload.judgmentEvolution.map((item, index) => (
              <article data-card-interaction="surface-lift" key={`${item.occurredAt}-${item.title}`}>
                <strong>{item.title}</strong>
                <small>{item.occurredAt ? formatDate(item.occurredAt) : `节点 ${index + 1}`}</small>
                <p>{item.toStatement}</p>
                <span>{item.reason}</span>
                <AiSourceReferences
                  sourceItemIds={item.sourceItemIds}
                  detail={detail}
                  onOpenSource={onOpenSource}
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {insight.payload.decisions.length ? (
        <section className="knowledge-ai-insight-section">
          <h3>决策与行动 <span>{insight.payload.decisions.length}</span></h3>
          <div className="knowledge-ai-insight-grid">
            {insight.payload.decisions.map((item) => (
              <article data-card-interaction="surface-lift" key={`${item.title}-${item.action}`}>
                <strong>{item.title}</strong>
                <p>{item.basis}</p>
                <span>行动：{item.action}</span>
                {item.result ? <small>结果：{item.result}</small> : null}
                <AiSourceReferences
                  sourceItemIds={item.sourceItemIds}
                  detail={detail}
                  onOpenSource={onOpenSource}
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {insight.payload.openQuestions.length ? (
        <section className="knowledge-ai-insight-section">
          <h3>待验证问题 <span>{insight.payload.openQuestions.length}</span></h3>
          <ul className="knowledge-ai-insight-list compact">
            {insight.payload.openQuestions.map((item) => (
              <li data-card-interaction="surface-lift" key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {insight.payload.topicManagementSuggestions.length ? (
        <section className="knowledge-ai-insight-section">
          <h3>主题管理建议 <span>{insight.payload.topicManagementSuggestions.length}</span></h3>
          <ul className="knowledge-ai-insight-list compact">
            {insight.payload.topicManagementSuggestions.map((item) => (
              <li data-card-interaction="surface-lift" key={`${item.action}-${item.title}`}>
                <strong>{item.title}</strong><span>{item.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary.boundaryMarkdown ? (
        <section className="knowledge-ai-insight-section knowledge-ai-boundary-section">
          <h3>来源范围{summary.sourceCount ? <span>{summary.sourceCount}</span> : null}</h3>
          <div className="knowledge-ai-boundary-content">
            <MarkdownContent value={summary.boundaryMarkdown} />
          </div>
        </section>
      ) : null}
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
              <article
                className={event.topicId === topicId ? "current" : "related"}
                data-card-interaction="surface-lift"
              >
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
                  <button
                    data-knowledge-source-id={event.sourceItemId}
                    onClick={() => onOpenSource({
                    sourceItemId: event.sourceItemId!,
                    locatorJson: event.locatorJson,
                    locatorLabel: event.locatorLabel,
                  })}>
                    查看来源<ExternalLink size={12} data-card-cue="forward" />
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

export function KnowledgeReadingWorkspace({
  taxonomyHierarchy,
  topicDetail,
  relatedTopicDetails,
  selectedTopicId,
  onSelectTopic,
  onOpenSource,
  navigationTarget,
  aiInsight,
  appliedAiRevision,
  aiRunning,
  aiRunningTopicName,
  aiSingleResult,
  aiBatchProgress,
  aiBatchResult,
  onRunAiInsight,
  onCloseAiSingleResult,
  onRunAllAiInsights,
  onRunPendingAiInsights,
  onRetryFailedAiInsights,
  onCloseAiBatchResult,
}: KnowledgeReadingWorkspaceProps) {
  const [mode, setMode] = useState<ReadingMode>("hypotheses");
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] =
    useState<"all" | "sources" | "evidence" | "judgments" | "decisions">("all");
  const [aiInsightDialogOpen, setAiInsightDialogOpen] = useState(false);
  const [connector, setConnector] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const shellRef = useRef<HTMLElement>(null);
  const activeTopicRef = useRef<HTMLButtonElement>(null);
  const readerRef = useRef<HTMLElement>(null);
  const readerScrollRef = useRef<HTMLDivElement>(null);
  const aiInsightOpenButtonRef = useRef<HTMLButtonElement>(null);
  const aiInsightDialogCloseRef = useRef<HTMLButtonElement>(null);
  const aiBatchConfirmRef = useRef<HTMLButtonElement>(null);
  const aiBatchCurrentRef = useRef<HTMLLIElement>(null);
  const pendingModeScrollTopRef = useRef<number | null>(null);
  const deferredSearch = useDeferredValue(search);
  const { domains, topics, hasAppliedRevision } = taxonomyHierarchy;

  const visibleTopics = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase("zh-CN");
    return topics.filter((topic) => (
      topic.status !== "merged" && topic.status !== "archived"
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
    setAiInsightDialogOpen(false);
  }, [selectedTopicId]);

  useEffect(() => {
    if (!aiInsightDialogOpen) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => aiInsightDialogCloseRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setAiInsightDialogOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      aiInsightOpenButtonRef.current?.focus();
    };
  }, [aiInsightDialogOpen]);


  useEffect(() => {
    if (!aiBatchResult) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    aiBatchConfirmRef.current?.focus();
    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [aiBatchResult]);

  useEffect(() => {
    if (!aiBatchProgress) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [aiBatchProgress]);

  useEffect(() => {
    aiBatchCurrentRef.current?.scrollIntoView({ block: "nearest" });
  }, [aiBatchProgress?.topicId, aiBatchProgress?.items]);

  const switchMode = (nextMode: ReadingMode) => {
    if (nextMode === mode) return;
    const container = readerScrollRef.current;
    if (container) pendingModeScrollTopRef.current = container.scrollTop;
    setMode(nextMode);
  };

  useLayoutEffect(() => {
    const pendingScrollTop = pendingModeScrollTopRef.current;
    if (pendingScrollTop === null || !readerScrollRef.current) return;
    readerScrollRef.current.scrollTop = pendingScrollTop;
    pendingModeScrollTopRef.current = null;
  }, [mode]);

  useEffect(() => {
    if (!navigationTarget?.viewMode) return;
    switchMode(navigationTarget.viewMode);
  }, [navigationTarget?.requestId]);

  const openSourceFromCurrentPanel = (target: KnowledgeSourceTarget) => {
    onOpenSource({
      ...target,
      returnTarget: selectedTopicId === null
        ? undefined
        : {
            topicId: selectedTopicId,
            viewMode: mode,
            sourceItemId: target.sourceItemId,
          },
    });
  };

  useEffect(() => {
    if (
      !navigationTarget?.sourceItemId
      || !navigationTarget.viewMode
      || navigationTarget.viewMode !== mode
      || topicDetail?.topic.id !== selectedTopicId
    ) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      const container = readerScrollRef.current;
      const target = container?.querySelector<HTMLElement>(
        `[data-knowledge-source-id="${navigationTarget.sourceItemId}"]`,
      );
      if (!container) return;
      if (!target) {
        container.scrollTo({ top: 0, behavior: "auto" });
        return;
      }
      target.focus({ preventScroll: true });
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (targetRect.top < containerRect.top + 18 || targetRect.bottom > containerRect.bottom - 18) {
        container.scrollTo({
          top: Math.max(0, container.scrollTop + targetRect.top - containerRect.top - 24),
          behavior: "smooth",
        });
      }
      const horizontalScroller = target.closest<HTMLElement>(".knowledge-final-timeline-scroll");
      if (horizontalScroller) {
        const scrollerRect = horizontalScroller.getBoundingClientRect();
        horizontalScroller.scrollTo({
          left: Math.max(
            0,
            horizontalScroller.scrollLeft
              + targetRect.left
              - scrollerRect.left
              - (scrollerRect.width - targetRect.width) / 2,
          ),
          behavior: "smooth",
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, navigationTarget, selectedTopicId, topicDetail?.topic.id]);

  const displayDetail = hasAppliedRevision
    && topicDetail
    && taxonomyHierarchy.topicIds.has(topicDetail.topic.id)
    ? topicDetail
    : null;
  const appliedRevisionTopic = useMemo(
    () => findAppliedAiTaxonomyTopic(
      appliedAiRevision,
      displayDetail?.topic.name ?? "",
      (displayDetail?.sources ?? []).map((source) => source.id),
    ),
    [appliedAiRevision, displayDetail?.sources, displayDetail?.topic.name],
  );
  const topicIntegrationMarkdown = appliedRevisionTopic?.integrationMarkdown.trim() ?? "";
  const readingModel = useMemo(() => {
    const judgments = displayDetail?.judgments ?? [];
    const persistedHypotheses = displayDetail?.propositions.filter(
      (item) => item.propositionKind === "hypothesis" && item.status !== "superseded",
    ) ?? [];
    const hypotheses = persistedHypotheses;
    const pendingQuestions = displayDetail?.questions.filter(
      (item) => item.status !== "resolved",
    ) ?? [];
    const synthesizedQuestions: typeof pendingQuestions = [];
    const expiryIssues = displayDetail
      ? deriveKnowledgeExpiryIssues(displayDetail, new Date())
      : [];
    const timeline = topicDetail
      ? buildKnowledgeTimeline(topicDetail, relatedTopicDetails)
      : [];
    const decisions = displayDetail?.decisions ?? [];

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
  }, [displayDetail, domains, relatedTopicDetails, topicDetail]);
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
  const aiHypothesisCount = aiInsight?.payload.hypotheses.length ?? 0;
  const aiEvolutionCount = aiInsight?.payload.judgmentEvolution.length ?? 0;
  const aiDecisionCount = aiInsight?.payload.decisions.length ?? 0;
  const aiPendingQuestions = aiInsight?.payload.openQuestions ?? [];
  const aiValidityItems = (aiInsight?.payload.hypotheses ?? [])
    .filter((item) => item.invalidationCondition.trim())
    .map((item, index) => ({
      id: `ai-validity-${index}`,
      title: item.title,
      condition: item.invalidationCondition,
      sourceItemIds: item.sourceItemIds,
    }));

  const shellStyle = connector === null
    ? undefined
    : ({
        "--knowledge-connector-y": `${connector.top}px`,
        "--knowledge-connector-x": `${connector.left}px`,
        "--knowledge-connector-width": `${connector.width}px`,
      } as CSSProperties);

  return (
    <section
      className="knowledge-final-shell core-workspace-grid"
      data-reading-mode={mode}
      ref={shellRef}
      style={shellStyle}
    >
      <aside className="knowledge-final-browser knowledge-card core-workspace-card-two" aria-label="领域与主题">
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
          emptyMessage={hasAppliedRevision ? "没有匹配的正式主题。" : "待 AI 生成全库分类"}
        />
      </aside>

      {connector && connector.width > 0 ? (
        <span className="knowledge-final-connector" aria-hidden="true"><i /><b /></span>
      ) : null}

      <article
        className="knowledge-final-reader knowledge-card association-link-target core-workspace-card-three"
        ref={readerRef}
        data-hover-wheel-panel=""
      >
        {topicDetail && displayDetail ? (
          <>
            <header className="knowledge-final-heading">
              <div>
                <span>{activeDomain?.name ?? "知识领域"}</span>
                <h1>{topicDetail.topic.name}</h1>
                {topicDetail.topic.description ? <p>{topicDetail.topic.description}</p> : null}
              </div>
              <div className="knowledge-final-heading-actions">
                <button type="button" disabled={aiRunning || Boolean(aiBatchProgress)} onClick={onRunAiInsight}>
                  <Sparkles size={15} />{aiRunning ? "AI 整理中…" : aiInsight ? "AI 重新整理" : "用 AI 整理"}
                </button>
                <button
                  type="button"
                  disabled={aiRunning || Boolean(aiBatchProgress) || !topics.length}
                  title="只补当前模型尚未生成、或笔记内容已变化的主题；相同输入直接复用已有结果。"
                  onClick={onRunPendingAiInsights}
                >
                  <ListTodo size={15} />AI 补充未生成主题
                </button>
                <button
                  type="button"
                  disabled={aiRunning || Boolean(aiBatchProgress) || !topics.length}
                  onClick={onRunAllAiInsights}
                >
                  <ListTodo size={15} />
                  {aiBatchProgress
                    ? `全部整理中 ${aiBatchProgress.current}/${aiBatchProgress.total}`
                    : "AI 全量重新整理"}
                </button>
              </div>
            </header>

            <div className="knowledge-final-stage">
              <div className="knowledge-ai-insight-pane">
                {aiInsight ? (
                  <section className="knowledge-ai-insight" aria-label="AI 主题洞察">
                    <header>
                      <span><Sparkles size={15} /></span>
                      <strong>AI 主题洞察</strong>
                      <small>{aiInsight.modelId}</small>
                      <time>{formatDate(aiInsight.generatedAt)}</time>
                      <button
                        aria-label="查看全部 AI 主题洞察"
                        className="knowledge-ai-insight-open"
                        onClick={() => setAiInsightDialogOpen(true)}
                        ref={aiInsightOpenButtonRef}
                        type="button"
                      >
                        <Maximize2 size={13} />查看全部
                      </button>
                    </header>
                    <div className="knowledge-ai-insight-preview">
                      <AiInsightBundleContent
                        insight={aiInsight}
                        detail={topicDetail}
                        onOpenSource={openSourceFromCurrentPanel}
                      />
                    </div>
                  </section>
                ) : (
                  <section className="knowledge-ai-insight" aria-label="等待 AI 主题洞察">
                    <header><span><Sparkles size={15} /></span><strong>等待 AI 生成主题洞察</strong></header>
                    <div className="knowledge-ai-insight-preview">
                      <p>当前只保留原始笔记和已确认记录，不再用本地规则生成摘要、假设、判断演变或决策草案。</p>
                    </div>
                  </section>
                )}
              </div>

            <nav
              aria-label="主题洞察模块"
              className="knowledge-final-tabs"
            >
              <button
                aria-selected={mode === "hypotheses"}
                className={mode === "hypotheses" ? "active" : ""}
                onClick={() => switchMode("hypotheses")}
                role="tab"
              >
                <GitBranch size={17} />竞争假设 <span>{aiHypothesisCount + hypotheses.length}</span>
              </button>
              <button
                aria-selected={mode === "evolution"}
                className={mode === "evolution" ? "active" : ""}
                onClick={() => switchMode("evolution")}
                role="tab"
              >
                <Clock3 size={17} />判断演变 <span>{aiEvolutionCount + judgments.length}</span>
              </button>
              <button
                aria-selected={mode === "sources"}
                className={mode === "sources" ? "active" : ""}
                onClick={() => switchMode("sources")}
                role="tab"
              >
                <FileText size={17} />主题整合 <span>{displayDetail?.sources.length ?? 0}</span>
              </button>
              <button
                aria-selected={mode === "decisions"}
                className={mode === "decisions" ? "active" : ""}
                onClick={() => switchMode("decisions")}
                role="tab"
              >
                <BookOpenText size={17} />决策版本 <span>{aiDecisionCount + decisions.length}</span>
              </button>
            </nav>

            <div
              className="knowledge-final-scroll"
              ref={readerScrollRef}
              data-hover-wheel-scroll=""
            >
              <div className="knowledge-final-mode-content">
              {mode === "hypotheses" ? (
                <div className="knowledge-final-content-grid">
                  <main>
                    {aiInsight && aiHypothesisCount ? (
                      <AiHypothesisCards
                        insight={aiInsight}
                        detail={topicDetail}
                        onOpenSource={openSourceFromCurrentPanel}
                      />
                    ) : null}
                    <div className="knowledge-final-hypothesis-grid">
                      {hypotheses.map((hypothesis, index) => {
                        const related = (displayDetail?.evidence ?? []).filter(
                          (item) => item.propositionId === hypothesis.id,
                        );
                        return (
                          <article
                            className={`knowledge-final-hypothesis ${index % 2 ? "oppose" : "support"}`}
                            key={hypothesis.id}
                          >
                            <header>
                              <span>{String.fromCharCode(65 + index)}</span>
                              <div>
                                <strong>{statusLabel(hypothesis.status)}</strong>
                                {hypothesis.hypothesisGroup ? <small>{hypothesis.hypothesisGroup}</small> : null}
                              </div>
                              <em>{Math.round(hypothesis.confidence)}%</em>
                            </header>
                            <section
                              className="knowledge-final-hypothesis-thesis"
                              data-card-interaction="surface-lift"
                            >
                              <span>核心解释</span>
                              <MarkdownContent
                                value={hypothesis.statementMarkdown}
                                className="right-reading-copy right-reading-copy-13"
                              />
                            </section>
                            <div className="knowledge-final-evidence-grid">
                              <EvidenceList
                                title="支持证据"
                                items={related.filter((item) => item.stance === "support")}
                                onOpenSource={openSourceFromCurrentPanel}
                              />
                              <EvidenceList
                                title="反对证据"
                                items={related.filter((item) => item.stance === "oppose")}
                                onOpenSource={openSourceFromCurrentPanel}
                              />
                            </div>
                            <footer aria-label="假设有效性条件">
                              <div><small>有效期至</small><strong>{formatDate(hypothesis.validUntil)}</strong></div>
                              <div><small>证伪条件</small><strong>{hypothesis.invalidationCondition || "未设置"}</strong></div>
                            </footer>
                          </article>
                        );
                      })}
                      {!hypotheses.length && !aiHypothesisCount ? (
                        <section className="knowledge-final-no-proposition">
                          <CircleAlert size={22} />
                          <div>
                            <h3>{aiInsight ? "AI 未形成可靠的竞争假设" : "等待 AI 生成竞争假设"}</h3>
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
                                  data-knowledge-source-id={source.id}
                                  onClick={() => openSourceFromCurrentPanel({
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
                    <section
                      className="knowledge-final-insight-card"
                      data-card-interaction="surface-lift"
                    >
                      <h3>待验证问题 <span>{pendingQuestions.length + synthesizedQuestions.length + aiPendingQuestions.length}</span></h3>
                      <ol>
                        {aiPendingQuestions.slice(0, 4).map((item) => (
                          <li className="is-ai-generated" key={`ai-question-${item}`}><small>AI</small>{item}</li>
                        ))}
                        {[...pendingQuestions, ...synthesizedQuestions].slice(0, 4).map((item) => (
                          <li key={item.id}>{item.question}</li>
                        ))}
                      </ol>
                      {!pendingQuestions.length && !synthesizedQuestions.length && !aiPendingQuestions.length
                        ? <small>暂无</small>
                        : null}
                    </section>
                    <section
                      className="knowledge-final-insight-card expiring"
                      data-card-interaction="surface-lift"
                    >
                      <h3>知识有效性 <span>{expiryIssues.length + aiValidityItems.length}</span></h3>
                      {aiValidityItems.slice(0, 4).map((item) => (
                        <article className="knowledge-ai-validity-item" key={item.id}>
                          <strong><small>AI</small>{item.title}</strong>
                          <p>{item.condition}</p>
                          <AiSourceReferences
                            sourceItemIds={item.sourceItemIds}
                            detail={topicDetail}
                            onOpenSource={openSourceFromCurrentPanel}
                          />
                        </article>
                      ))}
                      {expiryIssues.slice(0, 4).map((item) => (
                        <button
                          key={item.id}
                          data-knowledge-source-id={item.sourceItemId ?? undefined}
                          onClick={() => item.sourceItemId && openSourceFromCurrentPanel({
                            sourceItemId: item.sourceItemId,
                            locatorJson: item.locatorJson,
                            locatorLabel: item.locatorLabel,
                          })}
                        >
                          <strong>{item.title}</strong>
                          <small>{item.status} · {formatDate(item.dueAt)}</small>
                        </button>
                      ))}
                      {!expiryIssues.length && !aiValidityItems.length ? <small>暂无</small> : null}
                    </section>
                  </aside>
                </div>
              ) : mode === "evolution" ? (
                <div className="knowledge-final-evolution">
                  {aiInsight && aiEvolutionCount ? (
                    <AiJudgmentEvolution
                      insight={aiInsight}
                      detail={topicDetail}
                      onOpenSource={openSourceFromCurrentPanel}
                    />
                  ) : null}
                  {judgments.length ? (
                    <>
                      <KnowledgeTimeline
                        topicId={topicDetail.topic.id}
                        events={visibleTimeline}
                        eventFilter={eventFilter}
                        onFilterChange={setEventFilter}
                        onOpenSource={openSourceFromCurrentPanel}
                      />
                      <section
                        className="knowledge-final-version-diff"
                        data-reading-section="version-difference"
                        aria-label="已确认的版本差异与变化原因"
                      >
                        <div>
                          <article>
                            <strong>上版判断 <small>{formatDate(previousJudgment?.effectiveAt)}</small></strong>
                            <MarkdownContent value={previousJudgment?.statementMarkdown || "暂无上版"} className="right-reading-copy right-reading-copy-11" />
                          </article>
                          <article>
                            <strong>当前判断 <small>{formatDate(currentJudgment?.effectiveAt)}</small></strong>
                            <MarkdownContent value={currentJudgment?.statementMarkdown || "暂无当前判断"} className="right-reading-copy right-reading-copy-11" />
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
                    </>
                  ) : null}
                  {!aiEvolutionCount && !judgments.length ? (
                    <p className="knowledge-final-empty">{aiInsight ? "AI 未识别出可证实的判断变化" : "等待 AI 生成判断演变"}</p>
                  ) : null}
                </div>
              ) : mode === "sources" ? (
                displayDetail ? (
                  <div className="knowledge-final-source-mode">
                      <KnowledgeAssets
                        detail={displayDetail}
                        integrationMarkdown={topicIntegrationMarkdown}
                        integrationSourceItemIds={appliedRevisionTopic?.sourceItemIds ?? []}
                        onOpenSource={openSourceFromCurrentPanel}
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
                  {aiInsight && aiDecisionCount ? (
                    <AiDecisionCards insight={aiInsight} detail={topicDetail} onOpenSource={openSourceFromCurrentPanel} />
                  ) : null}
                  {decisions.length ? <DecisionHistory decisions={decisions} /> : null}
                  {!aiDecisionCount && !decisions.length ? (
                    <p className="knowledge-final-empty">{aiInsight ? "AI 未识别出明确的决策或行动记录" : "等待 AI 生成决策版本"}</p>
                  ) : null}
                </div>
              )}
              </div>
            </div>
            </div>
          </>
        ) : (
          <div className="knowledge-final-no-topic">
            <CircleAlert size={30} />
            <h1>{hasAppliedRevision ? "选择主题阅读" : "待 AI 生成全库分类"}</h1>
          </div>
        )}
      </article>
      {aiInsightDialogOpen && aiInsight && topicDetail ? createPortal(
        <div
          className="knowledge-overview-dialog-backdrop knowledge-ai-insight-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAiInsightDialogOpen(false);
          }}
        >
          <section
            aria-labelledby="knowledge-ai-insight-dialog-title"
            aria-modal="true"
            className="knowledge-overview-dialog knowledge-ai-insight-dialog"
            role="dialog"
          >
            <header>
              <span><Sparkles size={18} /></span>
              <div>
                <h2 id="knowledge-ai-insight-dialog-title">AI 主题洞察 · {topicDetail.topic.name}</h2>
                <small>{aiInsight.modelId} · {formatDate(aiInsight.generatedAt)}</small>
              </div>
              <button
                aria-label="关闭 AI 主题洞察"
                onClick={() => setAiInsightDialogOpen(false)}
                ref={aiInsightDialogCloseRef}
                type="button"
              >
                <X size={16} />
              </button>
            </header>
            <div className="knowledge-ai-insight-dialog-body" data-hover-wheel-scroll="">
              <AiInsightBundleContent
                insight={aiInsight}
                detail={topicDetail}
                onOpenSource={openSourceFromCurrentPanel}
              />
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
      {aiRunning && aiRunningTopicName && !aiSingleResult ? createPortal(
        <div className="knowledge-overview-dialog-backdrop ai-single-progress-backdrop">
          <section
            aria-labelledby="ai-single-progress-title"
            aria-modal="true"
            className="knowledge-overview-dialog ai-single-progress-dialog"
            role="dialog"
          >
            <header>
              <span><Sparkles size={18} /></span>
              <h2 id="ai-single-progress-title">AI 正在整理主题</h2>
              <span className="save-spinner" aria-hidden="true" />
            </header>
            <div className="ai-single-dialog-body" aria-live="polite">
              <strong>{aiRunningTopicName}</strong>
              <p>正在读取归纳笔记、生成主题综述和四个知识模块，请保持软件开启。</p>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
      {aiSingleResult ? createPortal(
        <div className="knowledge-overview-dialog-backdrop ai-single-result-backdrop">
          <section
            aria-labelledby="ai-single-result-title"
            aria-modal="true"
            className={`knowledge-overview-dialog ai-single-result-dialog ${aiSingleResult.status}`}
            role="dialog"
          >
            <header>
              <span>{aiSingleResult.status === "success" ? <ShieldCheck size={18} /> : <CircleAlert size={18} />}</span>
              <h2 id="ai-single-result-title">
                {aiSingleResult.status === "success" ? "AI 主题整理完成" : "AI 主题整理失败"}
              </h2>
            </header>
            <div className="ai-single-dialog-body">
              <strong>{aiSingleResult.topicName}</strong>
              <p>{aiSingleResult.message}</p>
              {aiSingleResult.generatedAt ? <small>{formatDate(aiSingleResult.generatedAt)}</small> : null}
            </div>
            <footer>
              <button className="primary" type="button" onClick={onCloseAiSingleResult}>我知道了</button>
            </footer>
          </section>
        </div>,
        document.body,
      ) : null}
      {aiBatchProgress ? createPortal(
        <div className="knowledge-overview-dialog-backdrop ai-batch-progress-backdrop">
          <section
            aria-labelledby="ai-batch-progress-title"
            aria-modal="true"
            className="knowledge-overview-dialog ai-batch-progress-dialog"
            role="dialog"
          >
            <header>
              <span><Sparkles size={18} /></span>
              <h2 id="ai-batch-progress-title">AI 正在整理全部主题</h2>
              <em>{aiBatchProgress.completed}/{aiBatchProgress.total}</em>
            </header>
            <div className="ai-batch-progress-body" aria-live="polite">
              <div className="ai-batch-progress-summary">
                <div>
                  <strong>正在处理 {aiBatchProgress.current}/{aiBatchProgress.total}</strong>
                  <span>{aiBatchProgress.topicName}</span>
                </div>
                <small>成功 {aiBatchProgress.succeeded} · 失败 {aiBatchProgress.failed}</small>
                <progress max={Math.max(aiBatchProgress.total, 1)} value={aiBatchProgress.completed} />
              </div>
              <ol className="knowledge-overview-dialog-list ai-batch-progress-list">
                {aiBatchProgress.items.map((item, index) => {
                  const active = item.id === aiBatchProgress.topicId
                    && (item.status === "running" || item.status === "retrying");
                  return (
                    <li
                      aria-current={active ? "step" : undefined}
                      className={item.status}
                      key={item.id}
                      ref={active ? aiBatchCurrentRef : undefined}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{item.name}</strong>
                        <p>
                          {item.status === "pending" ? "等待整理" : null}
                          {item.status === "running" ? `正在请求（第 ${item.attempt}/${item.maxAttempts} 次）` : null}
                          {item.status === "retrying" ? `请求失败，正在重试（第 ${item.attempt}/${item.maxAttempts} 次）` : null}
                          {item.status === "succeeded" ? "整理成功" : null}
                          {item.status === "failed" ? "整理失败" : null}
                        </p>
                        {item.error ? <small title={item.error}>{item.error}</small> : null}
                      </div>
                      <i aria-hidden="true">
                        {item.status === "succeeded" ? <ShieldCheck size={16} /> : null}
                        {item.status === "failed" ? <CircleAlert size={16} /> : null}
                        {item.status === "pending" ? <CircleDot size={16} /> : null}
                        {item.status === "running" || item.status === "retrying"
                          ? <span className="save-spinner" />
                          : null}
                      </i>
                    </li>
                  );
                })}
              </ol>
            </div>
            <footer className="ai-batch-progress-footer">
              <span>整理过程中请保持软件开启；瞬时网络错误会自动重试一次。</span>
            </footer>
          </section>
        </div>,
        document.body,
      ) : null}
      {aiBatchResult ? createPortal(
        <div className="knowledge-overview-dialog-backdrop ai-batch-result-backdrop">
          <section
            aria-labelledby="ai-batch-result-title"
            aria-modal="true"
            className={`knowledge-overview-dialog ai-batch-result-dialog ${aiBatchResult.failed ? "failed" : "success"}`}
            role="alertdialog"
          >
            <header>
              <span>{aiBatchResult.failed ? <CircleAlert size={18} /> : <ShieldCheck size={18} />}</span>
              <h2 id="ai-batch-result-title">
                {aiBatchResult.failed ? "部分主题整理失败" : "全部主题整理成功"}
              </h2>
              <em>{aiBatchResult.failed ? `${aiBatchResult.failed} 失败` : `${aiBatchResult.succeeded} 成功`}</em>
            </header>
            <div className="ai-batch-result-body">
              <p className="ai-batch-result-summary">
                本次处理 {aiBatchResult.total} 个主题：成功 {aiBatchResult.succeeded} 个，失败 {aiBatchResult.failed} 个
                {aiBatchResult.skipped ? `，跳过已合并主题 ${aiBatchResult.skipped} 个` : ""}。
              </p>
              {aiBatchResult.failedTopics.length ? (
                <ol className="knowledge-overview-dialog-list ai-batch-failure-list">
                  {aiBatchResult.failedTopics.map((topic, index) => (
                    <li key={topic.id}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{topic.name}</strong>
                        <p>{topic.error}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="ai-batch-success-state">
                  <ShieldCheck size={22} />
                  <p>所有可整理主题均已生成 AI 主题洞察。</p>
                </div>
              )}
            </div>
            <footer>
              {aiBatchResult.failedTopics.length ? (
                <button type="button" onClick={onRetryFailedAiInsights}>重试失败主题</button>
              ) : null}
              <button
                className="primary"
                onClick={onCloseAiBatchResult}
                ref={aiBatchConfirmRef}
                type="button"
              >
                确认
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      ) : null}
    </section>
  );
}
