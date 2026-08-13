import { describe, expect, it } from "vitest";
import {
  findAppliedAiTaxonomyTopic,
  getAppliedAiTaxonomyHierarchy,
  getAiTaxonomyIntegrationCoverage,
} from "./aiTaxonomyPresentation";
import type { AiTaxonomyRevision } from "./services/aiRepository";
import type {
  KnowledgeDomainRow,
  KnowledgeTopicRow,
} from "./services/knowledgeRepository";

const revision: AiTaxonomyRevision = {
  publicId: "revision-1",
  taskPublicId: "task-1",
  providerChannel: "openrouter",
  modelId: "test/model",
  status: "applied",
  domains: [{ key: "investment", name: "投资研究", description: "投资领域" }],
  topics: [{
    key: "fund-market",
    domainKey: "investment",
    parentKey: null,
    name: "A股与基金市场",
    description: "市场主题边界",
    integrationMarkdown: "AI 生成的主题整合。",
    sourceItemIds: [101, 102],
  }],
  assignments: [
    { sourceItemId: 101, topicKey: "fund-market", confidence: 91, reason: "属于该主题", uncertain: false },
    { sourceItemId: 102, topicKey: "fund-market", confidence: 86, reason: "属于该主题", uncertain: false },
  ],
  sourceCount: 2,
  assignedSourceCount: 2,
  uncertainSourceCount: 0,
  createdAt: "2026-08-10",
  appliedAt: "2026-08-10",
  undoneAt: null,
};

const domains: KnowledgeDomainRow[] = [
  { id: 1, publicId: "domain-investment", name: "投资研究", description: "投资领域", sortOrder: 0 },
  { id: 2, publicId: "domain-legacy", name: "旧领域", description: "遗留分类", sortOrder: 1 },
];

const topics: KnowledgeTopicRow[] = [
  {
    id: 11,
    publicId: "topic-fund-market",
    domainId: 1,
    parentTopicId: null,
    name: "A股与基金市场",
    description: "市场主题边界",
    topicKind: "subject",
    status: "active",
    depth: 1,
    sortOrder: 0,
    sourceCount: 2,
  },
  {
    id: 22,
    publicId: "topic-legacy",
    domainId: 2,
    parentTopicId: null,
    name: "旧主题",
    description: "不属于本次 AI 分类",
    topicKind: "subject",
    status: "active",
    depth: 1,
    sortOrder: 0,
    sourceCount: 99,
  },
];

describe("AI 分类主题成果定位", () => {
  it("优先通过已应用修订中的来源归属定位主题整合", () => {
    expect(findAppliedAiTaxonomyTopic(revision, "已改名主题", [102])?.integrationMarkdown)
      .toBe("AI 生成的主题整合。");
  });

  it("未应用修订不能成为正式主题整合", () => {
    expect(findAppliedAiTaxonomyTopic({ ...revision, status: "draft" }, "A股与基金市场", [101]))
      .toBeNull();
  });

  it("同时核对主题整合正文和自动关联来源", () => {
    expect(getAiTaxonomyIntegrationCoverage(revision)).toEqual({
      assignedTopicCount: 1,
      completeTopicCount: 1,
      incompleteTopicKeys: [],
    });
    expect(getAiTaxonomyIntegrationCoverage({
      ...revision,
      topics: [{ ...revision.topics[0], integrationMarkdown: "", sourceItemIds: [] }],
    })).toEqual({
      assignedTopicCount: 1,
      completeTopicCount: 0,
      incompleteTopicKeys: ["fund-market"],
    });
  });

  it("主题整合不能引用其他主题的笔记", () => {
    expect(getAiTaxonomyIntegrationCoverage({
      ...revision,
      topics: [{ ...revision.topics[0], sourceItemIds: [999] }],
    }).incompleteTopicKeys).toEqual(["fund-market"]);
  });

  it("两入口只消费已应用修订映射出的同一棵树，不回退旧主题", () => {
    expect(getAppliedAiTaxonomyHierarchy(null, domains, topics)).toMatchObject({
      hasAppliedRevision: false,
      domains: [],
      topics: [],
    });
    const hierarchy = getAppliedAiTaxonomyHierarchy(revision, domains, topics);
    expect(hierarchy.hasAppliedRevision).toBe(true);
    expect(hierarchy.domains.map((item) => item.id)).toEqual([1]);
    expect(hierarchy.topics.map((item) => item.id)).toEqual([11]);
    expect(hierarchy.topicIds.has(22)).toBe(false);
  });
});
