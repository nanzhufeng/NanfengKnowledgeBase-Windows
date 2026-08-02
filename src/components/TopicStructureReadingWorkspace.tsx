import {
  ArrowRight,
  CircleAlert,
  FolderTree,
  Network,
  Plus,
  Search,
  Sparkles,
  Tag,
  Target,
} from "lucide-react";
import {
  useDeferredValue,
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
import { KnowledgeTopicHierarchy } from "./KnowledgeTopicHierarchy";
import type {
  KnowledgeClassificationRuleRow,
  KnowledgeDomainRow,
  KnowledgeTopicAliasRow,
  KnowledgeTopicDetail,
  KnowledgeTopicRow,
  TopicRelationSuggestion,
} from "../services/knowledgeRepository";

export type TopicMaintenanceTask =
  | "overview"
  | "new-topic"
  | "boundary"
  | "aliases"
  | "rules"
  | "relations";

type TopicStructureReadingWorkspaceProps = {
  domains: KnowledgeDomainRow[];
  topics: KnowledgeTopicRow[];
  topicDetail: KnowledgeTopicDetail | null;
  selectedTopicId: number | null;
  aliases: KnowledgeTopicAliasRow[];
  rules: KnowledgeClassificationRuleRow[];
  relationSuggestions: TopicRelationSuggestion[];
  onSelectTopic: (topicId: number) => void;
  onOpenMaintenance: (task: TopicMaintenanceTask, topicId?: number) => void;
  onApplyRelation: (suggestion: TopicRelationSuggestion) => Promise<void>;
  onIgnoreRelation: (suggestion: TopicRelationSuggestion) => void;
  busy: boolean;
};

export function TopicStructureReadingWorkspace({
  domains,
  topics,
  topicDetail,
  selectedTopicId,
  aliases,
  rules,
  relationSuggestions,
  onSelectTopic,
  onOpenMaintenance,
  onApplyRelation,
  onIgnoreRelation,
  busy,
}: TopicStructureReadingWorkspaceProps) {
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState<"all" | "needs-attention">("all");
  const [connector, setConnector] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const shellRef = useRef<HTMLElement>(null);
  const activeTopicRef = useRef<HTMLButtonElement>(null);
  const readerRef = useRef<HTMLElement>(null);
  const deferredSearch = useDeferredValue(search);

  const attentionTopicIds = useMemo(
    () => collectTopicStructuralAttentionIds(topics, aliases, relationSuggestions),
    [aliases, relationSuggestions, topics],
  );

  const visibleTopics = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase("zh-CN");
    return topics.filter((topic) => {
      if (topic.status === "merged") return false;
      if (query && !`${topic.name} ${topic.description}`.toLocaleLowerCase("zh-CN").includes(query)) {
        return false;
      }
      if (topicFilter === "needs-attention") {
        return attentionTopicIds.has(topic.id);
      }
      return true;
    });
  }, [attentionTopicIds, deferredSearch, topicFilter, topics]);

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

  const topic = topicDetail?.topic ?? topics.find((item) => item.id === selectedTopicId) ?? null;
  const selectedTopicDomainId = topics.find((item) => item.id === selectedTopicId)?.domainId ?? null;
  const domain = topic ? domains.find((item) => item.id === topic.domainId) ?? null : null;
  const parent = topic?.parentTopicId
    ? topics.find((item) => item.id === topic.parentTopicId) ?? null
    : null;
  const children = topic ? topics.filter((item) => item.parentTopicId === topic.id) : [];
  const topicAliases = topic ? aliases.filter((item) => item.topicId === topic.id) : [];
  const topicRules = topic ? rules.filter((item) => item.targetTopicId === topic.id && item.enabled) : [];
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
          copy: "缺少明确的包含范围，自动归类难以稳定解释。",
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
  const negativeRules = topicRules.filter((item) =>
    item.ruleType === "negative_keyword" || item.ruleType === "stopword");
  const positiveRules = topicRules.filter((item) =>
    item.ruleType !== "negative_keyword" && item.ruleType !== "stopword");

  const shellStyle = connector === null
    ? undefined
    : ({
        "--topic-connector-y": `${connector.top}px`,
        "--topic-connector-x": `${connector.left}px`,
        "--topic-connector-width": `${connector.width}px`,
      } as CSSProperties);

  return (
    <section className="topic-final-shell" ref={shellRef} style={shellStyle}>
      <aside className="topic-final-browser" aria-label="领域与主题管理">
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
            <button
              className={topicFilter === "all" ? "active" : ""}
              onClick={() => setTopicFilter("all")}
            >
              全部 {topics.filter((item) => item.status !== "merged").length}
            </button>
            <button
              className={topicFilter === "needs-attention" ? "active" : ""}
              onClick={() => setTopicFilter("needs-attention")}
            >
              待处理 {attentionTopicIds.size}
            </button>
            <button
              className="topic-final-new"
              onClick={() => onOpenMaintenance("new-topic", selectedTopicId ?? undefined)}
            >
              <Plus size={14} />新建主题
            </button>
          </div>
        </div>
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
        <span className="topic-final-connector" aria-hidden="true"><i /><b /></span>
      ) : null}

      <article className="topic-final-reader knowledge-card association-link-target" ref={readerRef}>
        {topic ? (
          <>
            <header className="topic-final-heading">
              <div>
                <span>{domain?.name ?? "知识领域"}{parent ? ` / ${parent.name}` : ""}</span>
                <h1>{topic.name}<em>{topic.status === "active" ? "已启用" : topic.status}</em></h1>
                <p>{topic.description || "尚未记录主题范围和判断边界。"}</p>
              </div>
            </header>

            <div className="topic-final-scroll">
              <div className="topic-final-content">
                <main>
                  <section className="topic-final-section topic-boundary">
                    <h2>主题边界</h2>
                    <div className={negativeRules.length ? "has-system-exclusions" : undefined}>
                      <article>
                        <strong>包含范围</strong>
                        <p>{topic.description || "尚未记录明确的包含范围。"}</p>
                        {positiveRules.length ? (
                          <ul>{positiveRules.slice(0, 5).map((item) => <li key={item.id}>{item.pattern}</li>)}</ul>
                        ) : null}
                        <small>当前有 {topic.sourceCount} 条来源进入这个主题。</small>
                      </article>
                      {negativeRules.length ? (
                        <article className="exclude">
                          <strong>自动排除</strong>
                          <ul>{negativeRules.slice(0, 5).map((item) => <li key={item.id}>{item.pattern}</li>)}</ul>
                          <small>
                            系统用于避免相似关键词误归类，不会删除来源
                            {negativeRules.length > 5 ? ` · 另有 ${negativeRules.length - 5} 项` : ""}
                          </small>
                        </article>
                      ) : null}
                    </div>
                  </section>

                  <section className="topic-final-section">
                    <h2>自动归类依据</h2>
                    <div className="topic-final-basis">
                      <p><Sparkles size={15} /><strong>归类信号</strong>{positiveRules.length ? positiveRules.slice(0, 5).map((item) => item.pattern).join("、") : "由主题边界、别名与正文证据自动判断"}</p>
                      <p><Tag size={15} /><strong>别名命中</strong>{topicAliases.length ? topicAliases.map((item) => item.alias).join("、") : "暂无别名"}</p>
                      <p><Target size={15} /><strong>正式对象</strong>{topicDetail ? `${topicDetail.propositions.length} 条命题、${topicDetail.evidence.length} 条证据、${topicDetail.sources.length} 条来源` : "正在读取主题详情"}</p>
                    </div>
                  </section>

                  {showTopicHierarchy ? (
                    <section className="topic-final-section">
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

                  <section className="topic-final-section">
                    <h2>别名与术语</h2>
                    <div className="topic-final-aliases">
                      {topicAliases.map((item) => <span key={item.id}>{item.alias}</span>)}
                      {!topicAliases.length ? <small>当前主题还没有正式别名。</small> : null}
                      <button type="button" onClick={() => onOpenMaintenance("aliases", topic.id)}>
                        <Plus size={13} />添加别名
                      </button>
                    </div>
                  </section>

                  <div className="topic-final-auto-note">
                    <CircleAlert size={16} />
                    最高候选超过 65% 时由本地规则自动进入现有主题；其余候选和冲突结果保留人工复核。
                  </div>
                </main>

                <aside className="topic-final-suggestions">
                  <button
                    className="topic-final-open-management"
                    onClick={() => onOpenMaintenance("overview", topic.id)}
                  >
                    <Network size={15} />进入主题管理
                  </button>
                  <section>
                    <h3>待处理事项 <span>{maintenanceTasks.length + topicSuggestions.length}</span></h3>
                    {maintenanceTasks.map((item) => (
                      <article key={item.key}>
                        <strong>{item.title}</strong>
                        <p>{item.copy}</p>
                        <footer>
                          <button type="button" onClick={() => onOpenMaintenance(item.task, topic.id)}>处理</button>
                          <ArrowRight size={14} />
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
                        <article key={`${suggestion.fromTopicId}-${suggestion.toTopicId}-${suggestion.relationType}`}>
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
            <h1>选择一个主题查看结构</h1>
            <p>这里只读取正式领域、主题、规则和关系建议。</p>
          </div>
        )}
      </article>
    </section>
  );
}
