import type {
  KnowledgeClassificationRuleRow,
  KnowledgeDomainRow,
  KnowledgeEntityRow,
  KnowledgeInboxItem,
  KnowledgeRepository,
  KnowledgeTopicAliasRow,
  KnowledgeTopicRow,
  PersonalCatalogProposal,
  SourceCollection,
} from "./knowledgeRepository";

type WorkspaceDataRepository = Pick<
  KnowledgeRepository,
  | "listSourceArchive"
  | "listSourceCollections"
  | "listDomains"
  | "listTopics"
  | "getPersonalCatalogProposal"
  | "listTopicAliases"
  | "listEntities"
  | "listClassificationRules"
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
  catalog: PersonalCatalogProposal | null;
  aliases: KnowledgeTopicAliasRow[];
  entities: KnowledgeEntityRow[];
  rules: KnowledgeClassificationRuleRow[];
};

/** 来源档案的点击关键路径只读取轻量列表，不能夹带主题维护或目录写入。 */
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

/** 知识视图只拥有阅读目录，不读取主题维护对象。 */
export async function loadKnowledgeEntryData(
  repository: WorkspaceDataRepository,
): Promise<KnowledgeCatalogData> {
  const [domains, topics] = await Promise.all([
    repository.listDomains(),
    repository.listTopics(),
  ]);
  return { domains, topics };
}

/** 别名、实体和规则只属于主题管理入口。 */
export async function loadTopicMaintenanceData(
  repository: WorkspaceDataRepository,
): Promise<TopicMaintenanceData> {
  const [domains, topics, catalog, aliases, entities, rules] = await Promise.all([
    repository.listDomains(),
    repository.listTopics(),
    repository.getPersonalCatalogProposal(),
    repository.listTopicAliases(),
    repository.listEntities(),
    repository.listClassificationRules(),
  ]);
  return { domains, topics, catalog, aliases, entities, rules };
}
