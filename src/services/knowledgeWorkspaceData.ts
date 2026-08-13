import type {
  KnowledgeDomainRow,
  KnowledgeEntityRow,
  KnowledgeInboxItem,
  KnowledgeRepository,
  KnowledgeTopicAliasRow,
  KnowledgeTopicRow,
  SourceCollection,
} from "./knowledgeRepository";

type WorkspaceDataRepository = Pick<
  KnowledgeRepository,
  | "listSourceArchive"
  | "listSourceCollections"
  | "listDomains"
  | "listTopics"
  | "listTopicAliases"
  | "listEntities"
>;

export type KnowledgeCatalogData = {
  domains: KnowledgeDomainRow[];
  topics: KnowledgeTopicRow[];
};

export type SourceEntryData = {
  inbox: KnowledgeInboxItem[];
};

export type SourceSupportingData = KnowledgeCatalogData & {
  sourceCollections: SourceCollection[];
};

export type TopicMaintenanceData = KnowledgeCatalogData & {
  aliases: KnowledgeTopicAliasRow[];
  entities: KnowledgeEntityRow[];
};

/** 全部笔记的点击关键路径只读取轻量列表，不能夹带主题维护或目录写入。 */
export async function loadSourceEntryData(
  repository: WorkspaceDataRepository,
  limit: number,
): Promise<SourceEntryData> {
  return { inbox: await repository.listSourceArchive(limit) };
}

/** 来源筛选与主题名称属于首屏后的补充数据，不阻塞来源列表出现。 */
export async function loadSourceSupportingData(
  repository: WorkspaceDataRepository,
): Promise<SourceSupportingData> {
  const [domains, topics, sourceCollections] = await Promise.all([
    repository.listDomains(),
    repository.listTopics(),
    repository.listSourceCollections(),
  ]);
  return { domains, topics, sourceCollections };
}

/** 主题洞察只拥有阅读目录，不读取主题维护对象。 */
export async function loadKnowledgeEntryData(
  repository: WorkspaceDataRepository,
): Promise<KnowledgeCatalogData> {
  const [domains, topics] = await Promise.all([
    repository.listDomains(),
    repository.listTopics(),
  ]);
  return { domains, topics };
}

/** 别名和实体只属于主题管理入口；分类结构与笔记归属统一由 AI 修订提供。 */
export async function loadTopicMaintenanceData(
  repository: WorkspaceDataRepository,
): Promise<TopicMaintenanceData> {
  const [domains, topics, aliases, entities] = await Promise.all([
    repository.listDomains(),
    repository.listTopics(),
    repository.listTopicAliases(),
    repository.listEntities(),
  ]);
  return { domains, topics, aliases, entities };
}
