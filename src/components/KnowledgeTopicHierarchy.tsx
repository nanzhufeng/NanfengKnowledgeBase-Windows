import { ChevronDown, FileText, GitBranch } from "lucide-react";
import {
  useEffect,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import type {
  KnowledgeDomainRow,
  KnowledgeTopicRow,
} from "../services/knowledgeRepository";

type KnowledgeTopicHierarchyProps = {
  domains: KnowledgeDomainRow[];
  topics: KnowledgeTopicRow[];
  selectedTopicId: number | null;
  selectedTopicDomainId: number | null;
  searchActive: boolean;
  activeTopicRef: Ref<HTMLButtonElement>;
  onSelectTopic: (topicId: number) => void;
  onScroll?: () => void;
};

/**
 * 知识视图与主题管理共同使用的“领域 -> 主题”定位列表。
 * 行结构、层级缩进、数量列、选中态和折叠行为只允许在这里维护。
 */
export function KnowledgeTopicHierarchy({
  domains,
  topics,
  selectedTopicId,
  selectedTopicDomainId,
  searchActive,
  activeTopicRef,
  onSelectTopic,
  onScroll,
}: KnowledgeTopicHierarchyProps) {
  const [collapsedDomainIds, setCollapsedDomainIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (selectedTopicDomainId === null) return;
    setCollapsedDomainIds((current) => {
      if (!current.has(selectedTopicDomainId)) return current;
      const next = new Set(current);
      next.delete(selectedTopicDomainId);
      return next;
    });
  }, [selectedTopicDomainId]);

  return (
    <div className="knowledge-final-tree-card knowledge-card">
      <div className="knowledge-final-tree" onScroll={onScroll}>
        {domains.map((domain) => {
          const domainTopics = topics.filter((topic) => topic.domainId === domain.id);
          if (!domainTopics.length && searchActive) return null;
          const collapsed = collapsedDomainIds.has(domain.id) && !searchActive;
          return (
            <section className="knowledge-final-domain" key={domain.id}>
              <button
                type="button"
                className="knowledge-final-domain-heading"
                aria-expanded={!collapsed}
                onClick={() => setCollapsedDomainIds((current) => {
                  const next = new Set(current);
                  if (next.has(domain.id)) next.delete(domain.id);
                  else next.add(domain.id);
                  return next;
                })}
              >
                <GitBranch size={16} />
                <strong>{domain.name}</strong>
                <span>{domainTopics.length}</span>
                <ChevronDown size={14} className={collapsed ? "collapsed" : ""} />
              </button>
              {!collapsed ? domainTopics.map((topic) => (
                <button
                  type="button"
                  aria-current={selectedTopicId === topic.id ? "page" : undefined}
                  className={selectedTopicId === topic.id ? "active" : ""}
                  key={topic.id}
                  onClick={() => onSelectTopic(topic.id)}
                  ref={selectedTopicId === topic.id ? activeTopicRef : undefined}
                  style={{
                    "--topic-depth": Math.min(Math.max(topic.depth - 1, 0), 4),
                  } as CSSProperties}
                >
                  <FileText size={15} />
                  <span><strong>{topic.name}</strong><small>{topic.description || "暂无主题说明"}</small></span>
                  <em>{topic.sourceCount}</em>
                </button>
              )) : null}
            </section>
          );
        })}
        {!topics.length ? (
          <p className="knowledge-final-empty">没有匹配的正式主题。</p>
        ) : null}
      </div>
    </div>
  );
}
