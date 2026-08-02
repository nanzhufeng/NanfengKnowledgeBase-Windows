import { createRoot } from "react-dom/client";
import { App } from "../../src/App";
import "../../src/styles.css";

const now = "2026-08-01T10:00:00+08:00";
const domains = [
  { id: 1, publicId: "domain-health", name: "医疗健康", description: "疾病、药物、器械与健康服务", sortOrder: 0 },
  { id: 2, publicId: "domain-investment", name: "投资研究", description: "公司、产业与资产配置", sortOrder: 1 },
];
let topics = [
  { id: 11, publicId: "topic-blood", domainId: 1, parentTopicId: null, name: "血型与输血", description: "血型系统与临床输血兼容", topicKind: "subject", status: "active", depth: 1, sortOrder: 0, sourceCount: 1 },
  { id: 12, publicId: "topic-growth", domainId: 1, parentTopicId: null, name: "心理、认知与成长", description: "认知、记忆、学习与心理机制", topicKind: "subject", status: "active", depth: 1, sortOrder: 1, sourceCount: 4 },
  { id: 13, publicId: "topic-health", domainId: 1, parentTopicId: null, name: "健康、疾病与就医", description: "症状、疾病、药物与就医决策", topicKind: "subject", status: "active", depth: 1, sortOrder: 2, sourceCount: 8 },
  { id: 21, publicId: "topic-ai", domainId: 2, parentTopicId: null, name: "AI 基础设施", description: "算力、数据中心、云厂商与产业链", topicKind: "subject", status: "active", depth: 1, sortOrder: 0, sourceCount: 6 },
  { id: 22, publicId: "topic-capex", domainId: 2, parentTopicId: 21, name: "A股与基金市场", description: "中国股票、基金、交易制度与市场规则", topicKind: "subject", status: "active", depth: 2, sortOrder: 0, sourceCount: 20 },
  { id: 23, publicId: "topic-company", domainId: 2, parentTopicId: null, name: "公司与行业研究", description: "公司基本面、商业模式、估值与行业格局", topicKind: "subject", status: "active", depth: 1, sortOrder: 1, sourceCount: 37 },
];

function emptyTopicDetail(topicId: number) {
  return {
    topic: topics.find((item) => item.id === topicId) ?? topics[0],
    sources: [],
    judgments: [],
    evidence: [],
    questions: [],
    notes: [],
    propositions: [],
    decisions: [],
    turningPoints: [],
    relations: [],
  };
}

let callbackId = 0;
Object.assign(window, {
  __TAURI_INTERNALS__: {
    metadata: {
      currentWindow: { label: "main" },
      currentWebview: { label: "main" },
    },
    transformCallback: () => ++callbackId,
    unregisterCallback: () => undefined,
    convertFileSrc: (path: string) => path,
    invoke: async (command: string, args?: Record<string, any>) => {
      if (command === "plugin:event|listen") return 1;
      if (command === "plugin:event|unlisten") return null;
      if (command === "list_record_summaries" || command === "list_tags") return [];
      if (command === "get_storage_stats") {
        return {
          recordCount: 0,
          databaseBytes: 0,
          importsBytes: 0,
          attachmentsBytes: 0,
          backupsBytes: 0,
          totalBytes: 0,
          lastBackupAt: null,
          diskAvailableBytes: 0,
          diskTotalBytes: 0,
        };
      }
      if (command === "list_knowledge_domains") return structuredClone(domains);
      if (command === "list_knowledge_topics") return structuredClone(topics);
      if (command === "get_personal_topic_catalog_proposal") {
        return {
          version: "topic-structure-visual-v1",
          status: "proposal",
          title: "主题结构编辑视觉目录",
          note: "只用于本地界面验收",
          domains: [],
          topics: [],
        };
      }
      if ([
        "list_knowledge_topic_aliases",
        "list_knowledge_entities",
        "suggest_knowledge_topic_relations",
      ].includes(command)) return [];
      if (command === "list_knowledge_classification_rules") {
        return [{
          id: 301,
          publicId: "rule-visual",
          ruleType: "keyword",
          pattern: "算力",
          targetDomainId: 2,
          targetTopicId: 21,
          weight: 0.9,
          priority: 100,
          enabled: true,
          configJson: "{\"managedBy\":\"topic-structure-visual-v1\"}",
          createdAt: now,
          updatedAt: now,
        }];
      }
      if (command === "get_knowledge_topic_detail") {
        return structuredClone(emptyTopicDetail(Number(args?.topicId ?? topics[0].id)));
      }
      if (command === "create_knowledge_domain") {
        return { ...domains[0], id: 99, publicId: "domain-created", name: args?.name, description: args?.description, sortOrder: domains.length };
      }
      if (command === "update_knowledge_domain") return null;
      if (command === "create_knowledge_topic") {
        const input = args?.input ?? {};
        const created = {
          ...topics[0],
          id: 99,
          publicId: "topic-created",
          domainId: input.domainId,
          parentTopicId: input.parentTopicId ?? null,
          name: input.name,
          description: input.description ?? "",
          depth: input.parentTopicId ? 2 : 1,
          sourceCount: 0,
        };
        topics = [...topics, created];
        return structuredClone(created);
      }
      if (command === "update_knowledge_topic") return null;
      if (command === "list_knowledge_inbox") return [];
      return [];
    },
  },
});

createRoot(document.getElementById("root")!).render(<App />);
