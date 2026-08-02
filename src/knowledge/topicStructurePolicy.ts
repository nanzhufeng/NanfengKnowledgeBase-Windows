export type TopicStructurePolicyTopic = {
  id: number;
  description: string;
  status: string;
  sourceCount: number;
};

type TopicAliasSignal = {
  topicId: number;
};

type TopicRelationSignal = {
  fromTopicId: number;
  toTopicId: number;
};

/**
 * “零来源”只表示当前没有资料命中，不等于结构错误。
 * 有意义的空主题继续作为未来资料的稳定落点展示；真正需要处理的
 * 只有边界、别名或明确的关系建议。分类规则由系统持有，缺少规则
 * 不是需要普通用户补充的结构问题。
 */
export function collectTopicStructuralAttentionIds(
  topics: TopicStructurePolicyTopic[],
  aliases: TopicAliasSignal[],
  relationSuggestions: TopicRelationSignal[],
): Set<number> {
  const aliasTopicIds = new Set(aliases.map((alias) => alias.topicId));
  const relationTopicIds = new Set(
    relationSuggestions.flatMap((suggestion) => [
      suggestion.fromTopicId,
      suggestion.toTopicId,
    ]),
  );

  return new Set(
    topics
      .filter((topic) => (
        topic.status !== "merged"
        && (
          !topic.description.trim()
          || !aliasTopicIds.has(topic.id)
          || relationTopicIds.has(topic.id)
        )
      ))
      .map((topic) => topic.id),
  );
}

/**
 * 顶层叶子主题没有层级差异，展示“直属主题 / 暂无子主题”只会制造噪音。
 * 只有真实父主题或至少一个子主题存在时，层级区才有阅读价值。
 */
export function topicHierarchyHasUsefulContent(
  hasParent: boolean,
  childCount: number,
): boolean {
  return hasParent || childCount > 0;
}
