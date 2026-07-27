import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  FolderTree,
  Inbox,
  Link2,
  Layers3,
  Merge,
  Plus,
  Scissors,
  Sparkles,
} from "lucide-react";
import { CLASSIFIER_ALGORITHM_VERSION, classifySource } from "../knowledge/deterministicClassifier";
import type { KnowledgeTopicCandidate } from "../knowledge/domain";
import {
  KnowledgeRepository,
  type KnowledgeClassificationSuggestionRow,
  type KnowledgeDomainRow,
  type KnowledgeInboxItem,
  type KnowledgeTopicDetail,
  type KnowledgeTopicRow,
  type TopicMergePreview,
  type TopicRelationSuggestion,
  type TopicSplitPreview,
} from "../services/knowledgeRepository";
import MarkdownContent from "./MarkdownContent";

type Mode = "inbox" | "topics" | "organize";

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

function classifierTopics(topics: KnowledgeTopicRow[]): KnowledgeTopicCandidate[] {
  return topics.map((topic) => ({
    id: String(topic.id),
    primaryDomainId: String(topic.domainId),
    path: topicPath(topic, topics),
    name: topic.name,
    aliases: [],
    entities: [],
    keywords: topic.description.split(/[\s,，、；;]+/).filter(Boolean),
    searchDocument: `${topic.name}\n${topic.description}`,
    status: topic.status === "archived" ? "archived" : "active",
    updatedAt: "1970-01-01T00:00:00.000Z",
  }));
}

export function KnowledgeWorkspace({
  mode,
  onNotify,
}: {
  mode: Mode;
  onNotify: (message: string, options?: {
    durationMs?: number;
    actionLabel?: string;
    onAction?: () => void | Promise<void>;
  }) => void;
}) {
  const repository = useMemo(() => new KnowledgeRepository(), []);
  const [inbox, setInbox] = useState<KnowledgeInboxItem[]>([]);
  const [domains, setDomains] = useState<KnowledgeDomainRow[]>([]);
  const [topics, setTopics] = useState<KnowledgeTopicRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<KnowledgeClassificationSuggestionRow[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [domainName, setDomainName] = useState("");
  const [topicName, setTopicName] = useState("");
  const [topicDomainId, setTopicDomainId] = useState<number | null>(null);
  const [topicParentId, setTopicParentId] = useState<number | null>(null);
  const [browserTopicId, setBrowserTopicId] = useState<number | null>(null);
  const [topicDetail, setTopicDetail] = useState<KnowledgeTopicDetail | null>(null);
  const [judgmentText, setJudgmentText] = useState("");
  const [judgmentReason, setJudgmentReason] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [evidenceSourceId, setEvidenceSourceId] = useState<number | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [mergeSourceId, setMergeSourceId] = useState<number | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [mergePreview, setMergePreview] = useState<TopicMergePreview | null>(null);
  const [splitTopicId, setSplitTopicId] = useState<number | null>(null);
  const [splitPreview, setSplitPreview] = useState<TopicSplitPreview | null>(null);
  const [relationSuggestions, setRelationSuggestions] = useState<TopicRelationSuggestion[]>([]);

  const selected = inbox.find((item) => item.id === selectedId) ?? null;

  const reload = async () => {
    const [nextInbox, nextDomains, nextTopics] = await Promise.all([
      repository.listInbox(),
      repository.listDomains(),
      repository.listTopics(),
    ]);
    setInbox(nextInbox);
    setDomains(nextDomains);
    setTopics(nextTopics);
    setSelectedId((current) =>
      current && nextInbox.some((item) => item.id === current)
        ? current
        : nextInbox[0]?.id ?? null);
    setTopicDomainId((current) => current ?? nextDomains[0]?.id ?? null);
    setBrowserTopicId((current) =>
      current && nextTopics.some((topic) => topic.id === current)
        ? current
        : nextTopics[0]?.id ?? null);
  };

  useEffect(() => {
    setLoading(true);
    void reload()
      .catch((error) => onNotify(error instanceof Error ? error.message : "知识库读取失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSuggestions([]);
      return;
    }
    void repository.listSuggestions(selectedId)
      .then((items) => {
        setSuggestions(items);
        setSelectedTopicId(items.find((item) => item.status === "pending")?.suggestedTopicId ?? null);
      })
      .catch(() => setSuggestions([]));
  }, [repository, selectedId]);

  useEffect(() => {
    if (!browserTopicId || mode !== "topics") {
      setTopicDetail(null);
      return;
    }
    void repository.getTopicDetail(browserTopicId)
      .then((detail) => {
        setTopicDetail(detail);
        setEvidenceSourceId(detail.sources[0]?.id ?? null);
      })
      .catch((error) => onNotify(error instanceof Error ? error.message : "主题详情读取失败"));
  }, [browserTopicId, mode, repository]);

  useEffect(() => {
    if (mode !== "organize") return;
    void repository.suggestTopicRelations()
      .then(setRelationSuggestions)
      .catch((error) => onNotify(error instanceof Error ? error.message : "关系建议读取失败"));
  }, [mode, repository]);

  const reloadTopicDetail = async () => {
    if (!browserTopicId) return;
    setTopicDetail(await repository.getTopicDetail(browserTopicId));
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

  const generateSuggestions = async () => {
    if (!selected || !topics.length) {
      onNotify("请先在“主题浏览器”建立至少一个真实主题");
      return;
    }
    setBusy(true);
    try {
      const result = classifySource({
        source: {
          id: selected.publicId,
          title: selected.title,
          text: selected.originalText,
          kind: selected.sourceType === "conversation" ? "ai_conversation" : selected.sourceType as never,
          platform: selected.platform,
          importedAt: selected.importedAt,
        },
        topics: classifierTopics(topics),
        rules: [],
        history: {
          confirmedTopicCounts: Object.fromEntries(
            topics.map((topic) => [String(topic.id), topic.sourceCount]),
          ),
          recentTopicIds: [],
          batchTopicIds: {},
        },
      });
      const persisted = await repository.saveSuggestions({
        sourceItemId: selected.id,
        classifierVersion: CLASSIFIER_ALGORITHM_VERSION,
        suggestions: result.suggestions.slice(0, 5).map((suggestion) => ({
          topicId: Number(suggestion.topicId),
          score: suggestion.confidence,
          decision: suggestion.action,
          reasons: suggestion.reasons,
          signalScoresJson: JSON.stringify(suggestion.signalScores),
        })),
      });
      setSuggestions(persisted);
      setSelectedTopicId(persisted[0]?.suggestedTopicId ?? null);
      onNotify("已生成并保存本地确定性分类建议");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "分类失败，来源仍保留在收录箱");
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
          onNotify("分类已撤销，来源已返回收录箱");
        },
      });
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "分类确认失败");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="page-loading"><span className="save-spinner" />正在读取正式知识结构…</div>;
  }

  if (mode === "topics") {
    return (
      <main className="knowledge-page">
        <header className="knowledge-page-header">
          <div><span>长期结构</span><h1>主题浏览器</h1><p>数据库保存任意深度；界面默认展开前四层。</p></div>
          <FolderTree size={28} />
        </header>
        <section className="knowledge-topic-layout">
          <div className="knowledge-card knowledge-create-card">
            <h2>建立领域与主题</h2>
            <label>新领域<input value={domainName} onChange={(event) => setDomainName(event.target.value)} placeholder="例如：影视制作" /></label>
            <button disabled={!domainName.trim()} onClick={async () => {
              const created = await repository.createDomain(domainName.trim());
              setDomainName("");
              await reload();
              setTopicDomainId(created.id);
              onNotify("领域已创建");
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
            <button disabled={!topicDomainId || !topicName.trim()} onClick={async () => {
              await repository.createTopic({
                domainId: topicDomainId!,
                parentTopicId: topicParentId,
                name: topicName.trim(),
              });
              setTopicName("");
              setTopicParentId(null);
              await reload();
              onNotify("主题已创建");
            }}><Plus size={16} />创建主题</button>
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
                    onClick={() => setBrowserTopicId(topic.id)}
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
                    <small>{judgment.effectiveAt}{judgment.changeReason ? ` · ${judgment.changeReason}` : ""}</small>
                  </article>
                ))}
                {!topicDetail.judgments.length ? <p className="knowledge-empty">尚无判断快照。</p> : null}
                <textarea value={judgmentText} onChange={(event) => setJudgmentText(event.target.value)} placeholder="新增当前判断（Markdown）" />
                <input value={judgmentReason} onChange={(event) => setJudgmentReason(event.target.value)} placeholder="变化原因（有变化时填写）" />
                <button disabled={!judgmentText.trim()} onClick={async () => {
                  await repository.addTopicJudgment({
                    topicId: topicDetail.topic.id,
                    statementMarkdown: judgmentText,
                    confidence: 70,
                    changeReason: judgmentReason,
                  });
                  setJudgmentText("");
                  setJudgmentReason("");
                  await reloadTopicDetail();
                  onNotify("判断快照已追加，历史未被覆盖");
                }}><Plus size={15} />追加判断</button>
              </div>
              <div>
                <h3>证据与来源锚点</h3>
                {topicDetail.evidence.map((item) => (
                  <article className={`knowledge-evidence-item ${item.stance}`} key={item.id}>
                    <MarkdownContent value={item.contentMarkdown} />
                    <small>{item.sourceTitle} · 可信度 {Math.round(item.credibility)}%</small>
                  </article>
                ))}
                <select value={evidenceSourceId ?? ""} onChange={(event) => setEvidenceSourceId(event.target.value ? Number(event.target.value) : null)}>
                  <option value="">选择已归类来源</option>
                  {topicDetail.sources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
                </select>
                <textarea value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} placeholder="证据内容或原文摘录" />
                <button disabled={!evidenceText.trim() || !evidenceSourceId} onClick={async () => {
                  await repository.addTopicEvidence({
                    topicId: topicDetail.topic.id,
                    sourceItemId: evidenceSourceId!,
                    contentMarkdown: evidenceText,
                    credibility: 60,
                  });
                  setEvidenceText("");
                  await reloadTopicDetail();
                  onNotify("证据已关联到原始来源");
                }}><Plus size={15} />添加证据</button>
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
          </section>
        ) : null}
      </main>
    );
  }

  if (mode === "organize") {
    const duplicateNames = topics.filter((topic, index) =>
      topics.findIndex((other) => other.name.trim().toLowerCase() === topic.name.trim().toLowerCase()) !== index);
    const activeTopics = topics.filter((topic) => topic.status !== "merged");
    return (
      <main className="knowledge-page">
        <header className="knowledge-page-header">
          <div><span>结构治理</span><h1>整理工作台</h1><p>预览在前、提交可撤销；所有结果来自正式知识表。</p></div>
          <Sparkles size={28} />
        </header>
        <section className="knowledge-metrics">
          <div className="knowledge-card"><strong>{inbox.length}</strong><span>待归类来源</span></div>
          <div className="knowledge-card"><strong>{topics.filter((topic) => topic.sourceCount === 0).length}</strong><span>空主题</span></div>
          <div className="knowledge-card"><strong>{duplicateNames.length}</strong><span>同名候选</span></div>
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
        <section className="knowledge-card knowledge-governance-panel knowledge-relation-panel">
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
      </main>
    );
  }

  return (
    <main className="knowledge-page knowledge-inbox-page">
      <header className="knowledge-page-header">
        <div><span>来源先归档，再分类</span><h1>收录箱</h1><p>{inbox.length} 条来源等待确认；分类失败不会丢失来源。</p></div>
        <Inbox size={28} />
      </header>
      <section className="knowledge-inbox-layout">
        <div className="knowledge-card knowledge-inbox-list">
          {inbox.map((item) => (
            <button key={item.id} className={item.id === selectedId ? "active" : ""} onClick={() => setSelectedId(item.id)}>
              <span className="knowledge-source-kind">{item.sourceType}</span>
              <strong>{item.title}</strong>
              <small>{item.originalAt ?? item.importedAt}</small>
              <ChevronRight size={16} />
            </button>
          ))}
          {!inbox.length ? <p className="knowledge-empty">收录箱已清空。新导入资料会自动进入这里。</p> : null}
        </div>
        <div className="knowledge-card knowledge-inbox-detail">
          {selected ? (
            <>
              <div className="knowledge-detail-heading">
                <div><span>{selected.sourceType}</span><h2>{selected.title}</h2></div>
                <button onClick={() => void generateSuggestions()} disabled={busy || !topics.length}><Sparkles size={16} />{busy ? "计算中…" : "生成分类建议"}</button>
              </div>
              <div className="knowledge-source-preview"><MarkdownContent value={selected.originalText || "来源正文为空"} /></div>
              <div className="knowledge-suggestion-panel">
                <h3>主题归属</h3>
                {suggestions.filter((item) => item.status === "pending").map((suggestion) => {
                  const topic = topics.find((candidate) => candidate.id === suggestion.suggestedTopicId);
                  if (!topic) return null;
                  return (
                    <label className={selectedTopicId === topic.id ? "active" : ""} key={suggestion.id}>
                      <input type="radio" checked={selectedTopicId === topic.id} onChange={() => setSelectedTopicId(topic.id)} />
                      <span><strong>{topicPath(topic, topics).join(" / ")}</strong><small>{suggestion.reasons[0] ?? "本地确定性评分"}</small></span>
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
                  <Check size={17} />确认归类<ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : <p className="knowledge-empty">选择一条来源查看正文和分类解释。</p>}
        </div>
      </section>
    </main>
  );
}
