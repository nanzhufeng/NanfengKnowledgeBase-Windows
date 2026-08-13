import {
  ArrowRight,
  CircleAlert,
  FileText,
  FolderTree,
  Network,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
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
import {
  collectTopicStructuralAttentionIds,
  topicHierarchyHasUsefulContent,
} from "../knowledge/topicStructurePolicy";
import {
  findAppliedAiTaxonomyTopic,
  getAiTaxonomyIntegrationCoverage,
  type AppliedAiTaxonomyHierarchy,
} from "../aiTaxonomyPresentation";
import { KnowledgeTopicHierarchy } from "./KnowledgeTopicHierarchy";
import MarkdownContent from "./MarkdownContent";
import type {
  KnowledgeTopicAliasRow,
  KnowledgeTopicDetail,
  TopicRelationSuggestion,
} from "../services/knowledgeRepository";
import type {
  AiTaxonomyResume,
  AiTaxonomyRevision,
} from "../services/aiRepository";

export type TopicMaintenanceTask =
  | "overview"
  | "new-topic"
  | "boundary"
  | "aliases"
  | "relations";

export type AiTaxonomyRunResult = {
  status: "success" | "failed";
  message: string;
};

type TopicStructureReadingWorkspaceProps = {
  taxonomyHierarchy: AppliedAiTaxonomyHierarchy;
  topicDetail: KnowledgeTopicDetail | null;
  selectedTopicId: number | null;
  aliases: KnowledgeTopicAliasRow[];
  relationSuggestions: TopicRelationSuggestion[];
  aiRevision: AiTaxonomyRevision | null;
  appliedAiRevision: AiTaxonomyRevision | null;
  aiResume: AiTaxonomyResume | null;
  aiContinuing: boolean;
  aiRunning: boolean;
  aiResult: AiTaxonomyRunResult | null;
  onGenerateAiRevision: () => void;
  onGenerateIncrementalAiRevision: () => void;
  onContinueAiRevision: (taskPublicId: string) => void;
  onDiscardAndGenerateAiRevision: () => void;
  onCloseAiResult: () => void;
  onApplyAiRevision: () => void;
  onSelectTopic: (topicId: number) => void;
  onOpenMaintenance: (task: TopicMaintenanceTask, topicId?: number) => void;
  onApplyRelation: (suggestion: TopicRelationSuggestion) => Promise<void>;
  onIgnoreRelation: (suggestion: TopicRelationSuggestion) => void;
  busy: boolean;
};

export function TopicStructureReadingWorkspace({
  taxonomyHierarchy,
  topicDetail,
  selectedTopicId,
  aliases,
  relationSuggestions,
  aiRevision,
  appliedAiRevision,
  aiResume,
  aiContinuing,
  aiRunning,
  aiResult,
  onGenerateAiRevision,
  onGenerateIncrementalAiRevision,
  onContinueAiRevision,
  onDiscardAndGenerateAiRevision,
  onCloseAiResult,
  onApplyAiRevision,
  onSelectTopic,
  onOpenMaintenance,
  onApplyRelation,
  onIgnoreRelation,
  busy,
}: TopicStructureReadingWorkspaceProps) {
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState<"all" | "needs-attention">("all");
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [connector, setConnector] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const shellRef = useRef<HTMLElement>(null);
  const activeTopicRef = useRef<HTMLButtonElement>(null);
  const readerRef = useRef<HTMLElement>(null);
  const deferredSearch = useDeferredValue(search);
  const { domains, topics, hasAppliedRevision: hasAppliedAiClassification } = taxonomyHierarchy;
  const aiIntegrationCoverage = useMemo(
    () => getAiTaxonomyIntegrationCoverage(aiRevision),
    [aiRevision],
  );
  const aiRevisionHasCompleteIntegrations = aiIntegrationCoverage.assignedTopicCount > 0
    && aiIntegrationCoverage.incompleteTopicKeys.length === 0;
  // 全库分类始终按设置页保存的通道和模型继续；断点本身已保存实际模型，不能由页面临时选择改写。
  const selectedResume = Boolean(aiResume);

  useEffect(() => {
    if (aiResume && !aiRunning && !aiResult) setResumePromptOpen(true);
  }, [aiResult, aiResume, aiRunning]);

  const attentionTopicIds = useMemo(
    () => collectTopicStructuralAttentionIds(topics, aliases, relationSuggestions),
    [aliases, relationSuggestions, topics],
  );

  const visibleTopics = useMemo(() => {
    if (!hasAppliedAiClassification) return [];
    const query = deferredSearch.trim().toLocaleLowerCase("zh-CN");
    return topics.filter((topic) => {
      if (topic.status === "merged" || topic.status === "archived") return false;
      if (query && !`${topic.name} ${topic.description}`.toLocaleLowerCase("zh-CN").includes(query)) {
        return false;
      }
      if (topicFilter === "needs-attention") {
        return attentionTopicIds.has(topic.id);
      }
      return true;
    });
  }, [attentionTopicIds, deferredSearch, hasAppliedAiClassification, topicFilter, topics]);

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
    const observer = new ResizeObserver(scheduleConnectorUpdate);
    if (shellRef.current) observer.observe(shellRef.current);
    if (readerRef.current) observer.observe(readerRef.current);
    return () => observer.disconnect();
  }, [deferredSearch, scheduleConnectorUpdate, selectedTopicId, topics]);

  const topic = hasAppliedAiClassification
    ? topicDetail?.topic && taxonomyHierarchy.topicIds.has(topicDetail.topic.id)
      ? topicDetail.topic
      : topics.find((item) => item.id === selectedTopicId) ?? null
    : null;
  const selectedTopicDomainId = hasAppliedAiClassification
    ? topics.find((item) => item.id === selectedTopicId)?.domainId ?? null
    : null;
  const domain = topic ? domains.find((item) => item.id === topic.domainId) ?? null : null;
  const parent = topic?.parentTopicId
    ? topics.find((item) => item.id === topic.parentTopicId) ?? null
    : null;
  const children = topic ? topics.filter((item) => item.parentTopicId === topic.id) : [];
  const topicAliases = topic ? aliases.filter((item) => item.topicId === topic.id) : [];
  const topicSuggestions = topic
    ? relationSuggestions.filter((item) => item.fromTopicId === topic.id || item.toTopicId === topic.id)
    : [];
  const showTopicHierarchy = topicHierarchyHasUsefulContent(Boolean(parent), children.length);
  const maintenanceTasks: Array<{
    key: string;
    task: TopicMaintenanceTask;
    title: string;
    copy: string;
  }> = topic ? ([
    !topic.description.trim()
      ? {
          key: "boundary",
          task: "boundary" as const,
          title: "补充主题边界",
          copy: "缺少明确的包含范围，AI 分类难以稳定解释。",
        }
      : null,
    !topicAliases.length
      ? {
          key: "aliases",
          task: "aliases" as const,
          title: "补充别名",
          copy: "当前没有可用于标题与实体命中的别名。",
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    task: TopicMaintenanceTask;
    title: string;
    copy: string;
  }>) : [];
  const assignmentBySourceId = useMemo(
    () => new Map(appliedAiRevision?.assignments.map((item) => [item.sourceItemId, item]) ?? []),
    [appliedAiRevision],
  );
  const appliedRevisionTopic = useMemo(
    () => findAppliedAiTaxonomyTopic(
      appliedAiRevision,
      topic?.name ?? "",
      (topicDetail?.sources ?? []).map((source) => source.id),
    ),
    [appliedAiRevision, topic?.name, topicDetail?.sources],
  );
  const integrationSources = useMemo(() => {
    const sourceIds = new Set(appliedRevisionTopic?.sourceItemIds ?? []);
    return (topicDetail?.sources ?? []).filter((source) => sourceIds.has(source.id));
  }, [appliedRevisionTopic?.sourceItemIds, topicDetail?.sources]);
  const activeTopicCount = hasAppliedAiClassification
    ? topics.filter((item) => item.status !== "merged" && item.status !== "archived").length
    : 0;
  const attentionCount = hasAppliedAiClassification ? attentionTopicIds.size : 0;

  const shellStyle = connector === null
    ? undefined
    : ({
        "--topic-connector-y": `${connector.top}px`,
        "--topic-connector-x": `${connector.left}px`,
        "--topic-connector-width": `${connector.width}px`,
      } as CSSProperties);

  return (
    <section className="topic-final-shell core-workspace-grid" ref={shellRef} style={shellStyle}>
      <aside className="topic-final-browser knowledge-card core-workspace-card-two" aria-label="领域与主题管理">
        <div className="topic-final-toolbar">
          <label className="topic-final-search">
            <Search size={16} />
            <input
              aria-label="搜索领域或主题"
              placeholder="搜索领域或主题"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="topic-final-filter-row">
            <div className="topic-final-filter-controls">
              <button
                className={topicFilter === "all" ? "active" : ""}
                onClick={() => setTopicFilter("all")}
              >
                全部 {activeTopicCount}
              </button>
              <button
                className={topicFilter === "needs-attention" ? "active" : ""}
                onClick={() => setTopicFilter("needs-attention")}
              >
                待处理 {attentionCount}
              </button>
            </div>
            <div className="topic-final-ai-actions">
              <button
                className="topic-final-new"
                disabled={aiRunning}
                onClick={() => selectedResume ? setResumePromptOpen(true) : onGenerateAiRevision()}
              >
                <Sparkles size={14} />{aiRunning ? "AI 生成中…" : selectedResume ? "继续上次生成" : "AI 全量重新整理"}
              </button>
              <button
                className="topic-final-new topic-final-incremental"
                disabled={aiRunning || !aiRevision}
                title={aiRevision
                  ? "只处理当前模型新增或正文已变化的笔记，沿用既有领域、主题及未受影响的整合内容。"
                  : "当前模型需要先完成一次全量生成，才能增量补充新笔记。"}
                onClick={onGenerateIncrementalAiRevision}
              >
                <Plus size={14} />AI 补充新增笔记
              </button>
              {aiRevision?.status === "draft" ? (
              <button
                className="topic-final-new"
                disabled={aiRunning || !aiRevisionHasCompleteIntegrations}
                title={aiRevisionHasCompleteIntegrations
                  ? "应用领域、主题、笔记归属和主题整合"
                  : "主题整合或自动关联来源不完整，不能应用"}
                onClick={onApplyAiRevision}
              >
                应用修订
              </button>
              ) : null}
            </div>
          </div>
          {aiRevision ? (
            <small>
              AI 修订：{aiRevision.domains.length} 个领域 · {aiRevision.topics.length} 个主题 ·
              {aiRevision.assignedSourceCount}/{aiRevision.sourceCount} 条笔记
              {` · 主题整合 ${aiIntegrationCoverage.completeTopicCount}/${aiIntegrationCoverage.assignedTopicCount}`}
              {aiRevision.uncertainSourceCount ? ` · ${aiRevision.uncertainSourceCount} 条待核对` : ""}
              · {aiRevision.status === "draft" ? "待应用" : aiRevision.status === "applied" ? "已应用" : "历史版本"}
            </small>
          ) : <small>当前模型尚未生成分类；请先全量生成，之后可只补充新增笔记。</small>}
          {aiRevision && appliedAiRevision?.publicId !== aiRevision.publicId ? (
            <small>当前查看的是模型对比草稿，不会改变正式分类；点击“应用修订”后才会切换正式分类。</small>
          ) : null}
          {aiRevision?.status === "draft" && !aiRevisionHasCompleteIntegrations ? (
            <small>当前草稿缺少 AI 主题整合或自动关联笔记来源，请重新生成后再应用。</small>
          ) : null}
        </div>
        {aiRevision?.status === "draft" ? (
          <div className="knowledge-final-tree-card knowledge-card" data-hover-wheel-panel="">
            <div className="knowledge-final-tree" data-hover-wheel-scroll="">
              {aiRevision.domains.map((draftDomain) => {
                const query = deferredSearch.trim().toLocaleLowerCase("zh-CN");
                const draftTopics = aiRevision.topics.filter((draftTopic) => (
                  draftTopic.domainKey === draftDomain.key
                  && (!query || `${draftDomain.name} ${draftTopic.name} ${draftTopic.description}`
                    .toLocaleLowerCase("zh-CN").includes(query))
                ));
                if (!draftTopics.length && query) return null;
                return (
                  <section className="knowledge-final-domain" key={draftDomain.key}>
                    <header>
                      <strong>{draftDomain.name}</strong>
                      <span>{draftTopics.length}</span>
                    </header>
                    {draftTopics.map((draftTopic) => (
                      <button
                        type="button"
                        key={draftTopic.key}
                        aria-label={`${draftTopic.name}，AI 分类草稿`}
                        disabled
                      >
                        <Sparkles size={15} />
                        <span>
                          <strong>{draftTopic.name}</strong>
                          <small>{draftTopic.description || "AI 主题边界待应用"}</small>
                        </span>
                        <em>{aiRevision.assignments.filter((item) => item.topicKey === draftTopic.key).length}</em>
                      </button>
                    ))}
                  </section>
                );
              })}
              {!aiRevision.topics.length ? <p className="knowledge-final-empty">AI 草稿没有生成主题。</p> : null}
            </div>
          </div>
        ) : (
          <KnowledgeTopicHierarchy
            domains={domains}
            topics={visibleTopics}
            selectedTopicId={selectedTopicId}
            selectedTopicDomainId={selectedTopicDomainId}
            searchActive={Boolean(deferredSearch.trim())}
            activeTopicRef={activeTopicRef}
            onSelectTopic={onSelectTopic}
            onScroll={scheduleConnectorUpdate}
            emptyMessage={hasAppliedAiClassification ? "没有匹配的正式主题。" : "待 AI 生成全库分类"}
          />
        )}
      </aside>

      {connector && connector.width > 0 ? (
        <span className="topic-final-connector" aria-hidden="true"><i /><b /></span>
      ) : null}

      <article
        className="topic-final-reader knowledge-card association-link-target core-workspace-card-three"
        ref={readerRef}
        data-hover-wheel-panel=""
      >
        {topic ? (
          <>
            <header className="topic-final-heading">
              <div>
                <span>{domain?.name ?? "知识领域"}{parent ? ` / ${parent.name}` : ""}</span>
                <h1>{topic.name}<em>{topic.status === "active" ? "已启用" : topic.status}</em></h1>
                <p>{appliedRevisionTopic?.description || "待 AI 生成主题边界"}</p>
              </div>
            </header>

            <div className="topic-final-scroll" data-hover-wheel-scroll="">
              <div className="topic-final-content">
                <main>
                  <section
                    className="topic-final-section topic-boundary"
                    data-card-interaction="surface-lift"
                  >
                    <h2>AI 主题边界</h2>
                    <article>
                      <strong>包含范围</strong>
                      <p>{appliedRevisionTopic?.description || "待 AI 生成主题边界"}</p>
                      <small>AI 已归纳 {integrationSources.length} 条笔记。</small>
                    </article>
                  </section>

                  <section className="topic-final-section topic-final-integration" data-card-interaction="surface-lift">
                    <h2>AI 主题整合</h2>
                    {appliedRevisionTopic?.integrationMarkdown.trim() ? (
                      <>
                        <MarkdownContent
                          value={appliedRevisionTopic.integrationMarkdown}
                          className="right-reading-copy right-reading-copy-11"
                        />
                        <div className="topic-final-integration-sources">
                          <strong><FileText size={14} />自动关联笔记来源 {integrationSources.length} 条</strong>
                          <div>
                            {integrationSources.map((source) => <span key={source.id}>{source.title}</span>)}
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="topic-final-empty">待主题管理 AI 生成全库分类并应用</p>
                    )}
                  </section>

                  <section className="topic-final-section" data-card-interaction="surface-lift">
                    <h2>归纳笔记</h2>
                    <div className="topic-final-basis">
                      {integrationSources.map((source) => {
                        const assignment = assignmentBySourceId.get(source.id);
                        return (
                          <article key={source.id}>
                            <strong>{source.title}</strong>
                            {assignment?.reason ? <p>{assignment.reason}</p> : null}
                            {assignment ? (
                              <small>
                                AI 置信度 {Math.round(assignment.confidence)}%
                                {assignment.uncertain ? " · 待核对" : ""}
                              </small>
                            ) : null}
                          </article>
                        );
                      })}
                      {!integrationSources.length ? <p>待 AI 生成归纳笔记</p> : null}
                    </div>
                  </section>

                  {showTopicHierarchy ? (
                    <section className="topic-final-section" data-card-interaction="surface-lift">
                      <h2>主题层级</h2>
                      <div className="topic-final-relations">
                        {parent ? <p><span>父主题</span><button onClick={() => onSelectTopic(parent.id)}>{parent.name}</button></p> : null}
                        {children.length ? (
                          <p>
                            <span>子主题</span>
                            {children.map((item) => (
                              <button key={item.id} onClick={() => onSelectTopic(item.id)}>{item.name}</button>
                            ))}
                          </p>
                        ) : null}
                      </div>
                    </section>
                  ) : null}

                  <div className="topic-final-auto-note">
                    <CircleAlert size={16} />
                    领域、主题和归属由 AI 生成；低置信度项目标为待核对。原始笔记不会被改写，应用修订后仍可撤销。
                  </div>
                </main>

                <aside className="topic-final-suggestions">
                  <button
                    className="topic-final-open-management"
                    onClick={() => onOpenMaintenance("overview", topic.id)}
                  >
                    <Network size={15} />进入主题管理
                  </button>
                  <section
                    data-card-interaction={maintenanceTasks.length + topicSuggestions.length ? undefined : "surface-lift"}
                  >
                    <h3>待处理事项 <span>{maintenanceTasks.length + topicSuggestions.length}</span></h3>
                    {maintenanceTasks.map((item) => (
                      <article key={item.key} data-card-interaction="surface-lift">
                        <strong>{item.title}</strong>
                        <p>{item.copy}</p>
                        <footer>
                          <button type="button" onClick={() => onOpenMaintenance(item.task, topic.id)}>处理</button>
                          <ArrowRight size={14} data-card-cue="forward" />
                        </footer>
                      </article>
                    ))}
                    {topicSuggestions.slice(0, 3).map((suggestion) => {
                      const relatedId = suggestion.fromTopicId === topic.id
                        ? suggestion.toTopicId
                        : suggestion.fromTopicId;
                      const relatedName = suggestion.fromTopicId === topic.id
                        ? suggestion.toTopicName
                        : suggestion.fromTopicName;
                      return (
                        <article
                          key={`${suggestion.fromTopicId}-${suggestion.toTopicId}-${suggestion.relationType}`}
                          data-card-interaction="surface-lift"
                        >
                          <strong>建议关联：{relatedName}</strong>
                          <p>{suggestion.reason}</p>
                          <footer className="topic-final-suggestion-actions">
                            <button type="button" onClick={() => onSelectTopic(relatedId)}>查看</button>
                            <button type="button" onClick={() => onIgnoreRelation(suggestion)}>忽略</button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void onApplyRelation(suggestion)}
                            >
                              应用
                            </button>
                          </footer>
                        </article>
                      );
                    })}
                    {!maintenanceTasks.length && !topicSuggestions.length
                      ? <p className="topic-final-empty">当前主题没有待处理的结构问题。</p>
                      : null}
                  </section>
                </aside>
              </div>
            </div>
          </>
        ) : (
          <div className="topic-final-no-selection">
            <FolderTree size={30} />
            <small>{aiRevision?.status === "draft" ? "AI 分类草稿已生成；应用修订后显示正式内容" : "待 AI 生成全库分类"}</small>
          </div>
        )}
      </article>
      {aiRunning && !aiResult ? createPortal(
        <div className="knowledge-overview-dialog-backdrop ai-taxonomy-progress-backdrop">
          <section
            aria-labelledby="ai-taxonomy-progress-title"
            aria-modal="true"
            className="knowledge-overview-dialog ai-taxonomy-progress-dialog"
            role="dialog"
          >
            <header>
              <span><Sparkles size={18} /></span>
              <h2 id="ai-taxonomy-progress-title">AI 正在生成全库分类</h2>
              <span className="save-spinner" aria-hidden="true" />
            </header>
            <div className="ai-single-dialog-body" aria-live="polite">
              <strong>
                {aiContinuing
                  ? "正在从已保存断点继续"
                  : aiResume ? "正在生成并保存当前进度" : "正在理解全部笔记"}
              </strong>
              <p>
                {aiResume
                  ? `已保留语义档案 ${aiResume.profiledSourceCount}/${aiResume.sourceCount} 条、笔记归属 ${aiResume.assignedSourceCount}/${aiResume.sourceCount} 条、主题整合 ${aiResume.integratedTopicCount}/${aiResume.totalTopicCount} 份；只继续未完成批次。`
                  : "正在生成领域、主题、全部笔记归属和每个主题的整合内容；完成前不会修改正式分类。"}
              </p>
              <div className="ai-taxonomy-progress-track" aria-label="AI 全库分类生成中"><i /></div>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
      {resumePromptOpen && aiResume && !aiRunning && !aiResult ? createPortal(
        <div className="knowledge-overview-dialog-backdrop ai-taxonomy-resume-backdrop">
          <section
            aria-labelledby="ai-taxonomy-resume-title"
            aria-modal="true"
            className="knowledge-overview-dialog ai-taxonomy-resume-dialog"
            role="alertdialog"
          >
            <header>
              <span><CircleAlert size={18} /></span>
              <h2 id="ai-taxonomy-resume-title">发现未完成的 AI 全库分类</h2>
            </header>
            <div className="ai-single-dialog-body">
              <strong>已完成结果可以继续使用</strong>
              <p>
                语义档案 {aiResume.profiledSourceCount}/{aiResume.sourceCount} 条 ·
                笔记归属 {aiResume.assignedSourceCount}/{aiResume.sourceCount} 条 ·
                主题整合 {aiResume.integratedTopicCount}/{aiResume.totalTopicCount} 份
              </p>
              <small>
                已记录 {aiResume.totalTokens.toLocaleString("zh-CN")} tokens
                {aiResume.costUsd !== null ? ` · $${aiResume.costUsd.toFixed(4)}` : ""}
                {aiResume.lastError ? ` · 上次中断：${aiResume.lastError}` : ""}
              </small>
            </div>
            <footer>
              <button type="button" onClick={() => setResumePromptOpen(false)}>稍后处理</button>
              <button
                type="button"
                onClick={() => {
                  setResumePromptOpen(false);
                  onDiscardAndGenerateAiRevision();
                }}
              >
                放弃上次并重新生成
              </button>
              <button
                className="primary"
                type="button"
                onClick={() => {
                  setResumePromptOpen(false);
                  onContinueAiRevision(aiResume.taskPublicId);
                }}
              >
                继续上次生成
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      ) : null}
      {aiResult ? createPortal(
        <div className="knowledge-overview-dialog-backdrop ai-taxonomy-result-backdrop">
          <section
            aria-labelledby="ai-taxonomy-result-title"
            aria-modal="true"
            className={`knowledge-overview-dialog ai-taxonomy-result-dialog ${aiResult.status}`}
            role="alertdialog"
          >
            <header>
              <span>{aiResult.status === "success" ? <ShieldCheck size={18} /> : <CircleAlert size={18} />}</span>
              <h2 id="ai-taxonomy-result-title">
                {aiResult.status === "success" ? "AI 全库分类已生成" : "AI 全库分类生成失败"}
              </h2>
            </header>
            <div className="ai-single-dialog-body"><p>{aiResult.message}</p></div>
            <footer>
              <button className="primary" type="button" onClick={onCloseAiResult}>
                {aiResult.status === "success" ? "查看分类草稿" : "我知道了"}
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      ) : null}
    </section>
  );
}
