import { describe, expect, it } from "vitest";
import {
  classificationHistory,
  classificationRules,
  classificationSourceFixtures,
  classificationTopics,
} from "./classificationFixtures";
import { classifySource, CLASSIFIER_ALGORITHM_VERSION } from "./deterministicClassifier";
import {
  decideClassificationAction,
  type ClassificationRule,
  type KnowledgeTopicCandidate,
} from "./domain";

describe("deterministicClassifier", () => {
  it("uses the product thresholds without gaps", () => {
    expect(decideClassificationAction(100)).toBe("auto_eligible");
    expect(decideClassificationAction(65.01)).toBe("auto_eligible");
    expect(decideClassificationAction(65)).toBe("candidates");
    expect(decideClassificationAction(45)).toBe("candidates");
    expect(decideClassificationAction(44.99)).toBe("manual");
    expect(decideClassificationAction(0)).toBe("manual");
  });

  it.each(classificationSourceFixtures)(
    "ranks $expectedTopicId first for $source.id with the expected action",
    ({ source, searchSignals, expectedTopicId, expectedAction }) => {
      const result = classifySource({
        source,
        topics: classificationTopics,
        rules: classificationRules,
        history: classificationHistory,
        searchSignals,
      });
      const top = result.suggestions[0];
      expect(result.algorithmVersion).toBe(CLASSIFIER_ALGORITHM_VERSION);
      expect(result.generatedAt).toBe(source.importedAt);
      expect(top.topicId).toBe(expectedTopicId);
      expect(top.action).toBe(expectedAction);
      expect(top.signalScores).toHaveLength(5);
      expect(top.signalScores.reduce((total, signal) => total + signal.weight, 0)).toBe(100);
      expect(
        top.signalScores.reduce((total, signal) => total + signal.contributedPoints, 0),
      ).toBeCloseTo(top.confidence, 8);
      expect(top.reasons.length).toBeGreaterThan(0);
    },
  );

  it("is deterministic and uses topic id as the stable tie breaker", () => {
    const source = {
      ...classificationSourceFixtures[0].source,
      id: "determinism-check",
    };
    const context = {
      source,
      topics: classificationTopics,
      rules: classificationRules,
      history: classificationHistory,
      searchSignals: classificationSourceFixtures[0].searchSignals,
    };
    const first = classifySource(context);
    const second = classifySource(context);
    expect(first).toEqual(second);
  });

  it("accepts normalized FTS5/BM25 signals from the future persistence adapter", () => {
    const fixture = classificationSourceFixtures[3];
    const result = classifySource({
      source: fixture.source,
      topics: classificationTopics,
      rules: classificationRules,
      history: classificationHistory,
      searchSignals: [
        {
          topicId: "nanjing-rent-options",
          normalizedScore: 0.92,
          reason: "FTS5/BM25 标题与正文加权命中",
        },
      ],
    });
    const top = result.suggestions[0];
    const fullText = top.signalScores.find((signal) => signal.key === "full_text");
    expect(top.topicId).toBe("nanjing-rent-options");
    expect(fullText?.normalizedScore).toBe(0.92);
    expect(fullText?.reasons).toContain("FTS5/BM25 标题与正文加权命中");
  });

  it("removes a candidate when a persisted exclusion leaves insufficient evidence", () => {
    const topic = classificationTopics[0];
    const result = classifySource({
      source: {
        ...classificationSourceFixtures[0].source,
        title: "招聘：AI 资本开支分析师",
      },
      topics: [topic],
      rules: [{
        id: "negative-job",
        topicId: topic.id,
        field: "title",
        operator: "contains",
        effect: "exclude",
        value: "招聘",
        strength: 1,
        reason: "招聘信息不进入投资研究",
        enabled: true,
      }],
      history: {
        confirmedTopicCounts: {},
        recentTopicIds: [],
        batchTopicIds: {},
      },
    });

    expect(result.suggestions).toEqual([]);
  });

  it("rejects rules that point to a missing topic", () => {
    const fixture = classificationSourceFixtures[0];
    expect(() =>
      classifySource({
        source: fixture.source,
        topics: classificationTopics,
        rules: [
          ...classificationRules,
          {
            ...classificationRules[0],
            id: "broken-rule",
            topicId: "missing-topic",
          },
        ],
        history: classificationHistory,
      }),
    ).toThrow("分类规则指向不存在的主题");
  });

  it.each([
    {
      title: "A股交易新规解析",
      text: "上交所盘后固定价格交易与创业板涨跌幅限制发生调整。",
      expectedTopicId: "a-share",
    },
    {
      title: "理想 i8 二手车选择",
      text: "比较新能源车的二手车选择、电池衰减、保值率和用车成本。",
      expectedTopicId: "new-energy-car",
    },
    {
      title: "A 型血输血问题",
      text: "A 型血患者的血型输血、红细胞输注和交叉配血原则。",
      expectedTopicId: "blood",
    },
    {
      title: "艺术专业报考建议",
      text: "艺术专业和视觉传达专业如何填报志愿、比较录取分数。",
      expectedTopicId: "art-education",
    },
    {
      title: "giffgaff Wi-Fi Calling 情况",
      text: "giffgaff 海外手机卡的 Wi-Fi Calling、VoLTE 与国际漫游限制。",
      expectedTopicId: "telecom",
    },
    {
      title: "选择最适合的美国银行卡方案",
      text: "比较美国银行卡、HSBC HK、Wise、IBKR 和跨境支付方案。",
      expectedTopicId: "overseas-banking",
    },
    {
      title: "赵贞吉吃饭画面",
      text: "根据参考图保留人物形象，重新生成一张现代场景图片。",
      expectedTopicId: "image-generation",
    },
    {
      title: "日本楼市跌幅与分化",
      text: "日本楼市经历长期下跌，不同城市房价、住房市场和房地产周期明显分化。",
      expectedTopicId: "real-estate",
    },
    {
      title: "南枫批量改名设计",
      text: "为批量改名工具设计品牌标识、应用图标、界面配色和扁平化图标。",
      expectedTopicId: "brand-design",
    },
    {
      title: "GitHub 分支保护建议",
      text: "为 GitHub 主分支设置分支保护规则，避免强推和误删。",
      expectedTopicId: "git",
    },
    {
      title: "账本恢复失败原因",
      text: "正式账本备份仍完整，但应用数据库恢复失败，需要核对备份恢复流程。",
      expectedTopicId: "data-recovery",
    },
  ])("classifies the reported sample by its content subject: $title", ({
    title,
    text,
    expectedTopicId,
  }) => {
    const topics: KnowledgeTopicCandidate[] = [
      regressionTopic("a-share", "A股与基金市场", ["A股", "盘后固定价格交易", "涨跌幅限制"]),
      regressionTopic("new-energy-car", "新能源车与二手车", ["新能源车", "二手车选择", "电池衰减"]),
      regressionTopic("blood", "血型与输血", ["血型输血", "红细胞输注", "交叉配血"]),
      regressionTopic("art-education", "艺术与设计升学", ["艺术专业", "视觉传达专业", "志愿填报"]),
      regressionTopic("telecom", "海外通信与号码", ["giffgaff", "Wi-Fi Calling", "国际漫游"]),
      regressionTopic("overseas-banking", "海外银行与支付", ["美国银行卡", "HSBC HK", "跨境支付"]),
      regressionTopic("image-generation", "AI 图像与视觉创作", ["人物形象", "参考图生成", "生成一张"]),
      regressionTopic("real-estate", "房地产与楼市研究", ["日本楼市", "住房市场", "房地产周期"]),
      regressionTopic("brand-design", "品牌、图标与界面设计", ["品牌标识", "应用图标", "界面配色"]),
      regressionTopic("git", "Git 与版本控制", ["GitHub 分支保护", "GitHub 主分支", "分支保护规则"]),
      regressionTopic("data-recovery", "数据备份、迁移与恢复", ["账本恢复", "应用数据库", "备份恢复"]),
      regressionTopic("model-cost", "模型与成本", ["大模型价格", "Token 成本", "API 计费"]),
      regressionTopic("transcription", "音视频转写", ["音频转写", "SRT 字幕", "字幕时间码"]),
      regressionTopic("agent", "Agent 与 Codex 工作流", ["Agent 工作流", "Codex 任务", "MCP 插件"]),
    ];
    const rules: ClassificationRule[] = topics.flatMap((topic) =>
      topic.keywords.map((keyword, index) => ({
        id: `${topic.id}-${index}`,
        topicId: topic.id,
        field: "text" as const,
        operator: "contains" as const,
        value: keyword,
        strength: 0.85,
        reason: `正文主题短语「${keyword}」`,
        enabled: true,
      })));
    const result = classifySource({
      source: {
        id: `reported-${expectedTopicId}`,
        title,
        text,
        kind: "ai_conversation",
        platform: "ChatGPT",
        importedAt: "2026-07-27T00:00:00Z",
      },
      topics,
      rules,
      history: {
        confirmedTopicCounts: {},
        recentTopicIds: [],
        batchTopicIds: {},
      },
      searchSignals: topics.map((topic) => ({
        topicId: topic.id,
        normalizedScore: topic.id === expectedTopicId ? 0.9 : 0,
        reason: "可读正文 FTS5/BM25",
      })),
    });

    expect(result.suggestions[0]?.topicId).toBe(expectedTopicId);
    expect(result.suggestions.map((suggestion) => suggestion.topicId)).not.toContain("model-cost");
    expect(result.suggestions.map((suggestion) => suggestion.topicId)).not.toContain("agent");
  });

  it("does not display zero-score or metadata-only topics as candidates", () => {
    const result = classifySource({
      source: {
        id: "empty",
        title: "未命名导入记录 205",
        text: "",
        kind: "ai_conversation",
        platform: "ChatGPT",
        importedAt: "2026-07-27T00:00:00Z",
      },
      topics: [
        regressionTopic("model-cost", "模型与成本", ["ChatGPT", "Claude", "价格"]),
        regressionTopic("transcription", "音视频转写", ["SRT", "视频"]),
      ],
      rules: [],
      history: {
        confirmedTopicCounts: {},
        recentTopicIds: ["model-cost"],
        batchTopicIds: {},
      },
    });

    expect(result.suggestions).toEqual([]);
  });

  it("treats a specific content rule in the title as direct topic evidence", () => {
    const topic = regressionTopic(
      "git",
      "Git 与版本控制",
      ["GitHub 分支保护", "GitHub 主分支", "分支保护规则"],
    );
    const result = classifySource({
      source: {
        id: "title-rule",
        title: "保护 GitHub 主分支",
        text: "避免误删和强制推送。",
        kind: "ai_conversation",
        importedAt: "2026-07-27T00:00:00Z",
      },
      topics: [topic],
      rules: [{
        id: "managed-keyword",
        topicId: topic.id,
        field: "text",
        operator: "contains",
        value: "保护 GitHub 主分支",
        strength: 0.9,
        reason: "目录主题短语命中",
        enabled: true,
      }],
      history: {
        confirmedTopicCounts: {},
        recentTopicIds: [],
        batchTopicIds: {},
      },
      searchSignals: [{
        topicId: topic.id,
        normalizedScore: 0.7,
        reason: "可见正文 FTS5/BM25",
      }],
    });

    expect(result.suggestions[0]?.topicId).toBe("git");
    expect(result.suggestions[0]?.confidence).toBeGreaterThanOrEqual(45);
  });

  it("does not let incidental broad words in a long body create a topic", () => {
    const result = classifySource({
      source: {
        id: "incidental-context",
        title: "艺术专业报考建议",
        text: "分析艺术专业、视觉传达和志愿填报。整理时使用 Claude、Google、"
          + "Codex 软件和 iPhone 图片作为辅助资料。",
        kind: "ai_conversation",
        importedAt: "2026-07-27T00:00:00Z",
      },
      topics: [
        regressionTopic("art", "艺术与设计升学", ["艺术专业", "视觉传达", "志愿填报"]),
        regressionTopic("agent", "Agent 与 Codex 工作流", ["Agent", "Codex", "软件"]),
        regressionTopic("apple", "Apple、Mac 与 iPhone", ["iPhone", "图片"]),
      ],
      rules: [
        managedKeywordRule("art", "艺术专业", 0),
        managedKeywordRule("art", "视觉传达", 1),
        managedKeywordRule("art", "志愿填报", 2),
        managedKeywordRule("agent", "Agent", 0),
        managedKeywordRule("agent", "Codex", 1),
        managedKeywordRule("agent", "软件", 2),
        managedKeywordRule("apple", "iPhone", 0),
        managedKeywordRule("apple", "图片", 1),
      ],
      history: {
        confirmedTopicCounts: {},
        recentTopicIds: [],
        batchTopicIds: {},
      },
    });

    expect(result.suggestions[0]?.topicId).toBe("art");
    expect(result.suggestions.map((suggestion) => suggestion.topicId)).not.toContain("agent");
    expect(result.suggestions.map((suggestion) => suggestion.topicId)).not.toContain("apple");
  });

  it("requires more than one body entity mention for a managed catalog topic", () => {
    const topic = {
      ...regressionTopic("accounts", "海外账号体系", []),
      entities: ["Google 账号"],
    };
    const result = classifySource({
      source: {
        id: "entity-only-body",
        title: "艺术院校志愿分析",
        text: "最后可以把结果保存在 Google 账号中。",
        kind: "ai_conversation",
        importedAt: "2026-07-27T00:00:00Z",
      },
      topics: [topic],
      rules: [{
        id: "entity:catalog-rule-accounts-entity-0",
        topicId: "accounts",
        field: "text",
        operator: "contains",
        effect: "include",
        value: "Google 账号",
        strength: 0.9,
        reason: "目录主题短语命中",
        enabled: true,
      }],
      history: {
        confirmedTopicCounts: {},
        recentTopicIds: [],
        batchTopicIds: {},
      },
    });

    expect(result.suggestions).toEqual([]);
  });

  it("keeps a concise catalog subject phrase in the title as sufficient evidence", () => {
    const topic = regressionTopic("54", "AI 模型、产品与能力", ["大模型"]);
    const result = classifySource({
      source: {
        id: "model-data",
        title: "大模型训练数据来源对比",
        text: "比较 Gemini、ChatGPT 和 Claude 的训练数据来源。",
        kind: "file",
        importedAt: "2026-07-27T00:00:00Z",
      },
      topics: [topic],
      rules: [{
        id: "keyword:catalog-rule-ai-model-products-keyword-17",
        topicId: "54",
        field: "text",
        operator: "contains",
        effect: "include",
        value: "大模型",
        strength: 0.9,
        reason: "目录主题短语命中「大模型」",
        enabled: true,
      }],
      history: {
        confirmedTopicCounts: {},
        recentTopicIds: [],
        batchTopicIds: {},
      },
    });

    expect(result.suggestions[0]?.topicId).toBe("54");
  });

  it("requires title-aligned topic evidence when the title is meaningful", () => {
    const topic = regressionTopic("telecom", "海外通信与号码", ["Wi-Fi Calling", "PayGo"]);
    const accountsTopic = regressionTopic(
      "brokerage",
      "券商账户与证券服务",
      ["投资账户", "账户迁移"],
    );
    const result = classifySource({
      source: {
        id: "unrelated-title",
        title: "迁移投资账户到美区体系的可行性评估",
        text: "旧对话附带提到 Wi-Fi Calling 和 PayGo。",
        kind: "file",
        importedAt: "2026-07-27T00:00:00Z",
      },
      topics: [topic, accountsTopic],
      rules: [
        managedKeywordRule("telecom", "Wi-Fi Calling", 0),
        managedKeywordRule("telecom", "PayGo", 1),
        managedKeywordRule("brokerage", "投资账户", 0),
      ],
      history: {
        confirmedTopicCounts: {},
        recentTopicIds: [],
        batchTopicIds: {},
      },
      searchSignals: [{
        topicId: "telecom",
        normalizedScore: 0.89,
        reason: "FTS5/BM25",
      }],
    });

    expect(result.suggestions[0]?.topicId).toBe("brokerage");
    expect(result.suggestions.map((suggestion) => suggestion.topicId)).not.toContain("telecom");
  });

  it("uses a specific lead-body phrase as primary evidence for an opaque title", () => {
    const networkTopic = regressionTopic(
      "network",
      "网络、代理与连接",
      ["Clash", "连接被重置"],
    );
    const result = classifySource({
      source: {
        id: "opaque-title",
        title: "情况询问",
        text: "连接被重置，排查后确认是 Clash 代理链路未命中。",
        kind: "ai_conversation",
        importedAt: "2026-07-27T00:00:00Z",
      },
      topics: [networkTopic],
      rules: [
        managedKeywordRule("network", "连接被重置", 0),
        managedKeywordRule("network", "Clash", 1),
      ],
      history: {
        confirmedTopicCounts: {},
        recentTopicIds: [],
        batchTopicIds: {},
      },
      searchSignals: [{
        topicId: "network",
        normalizedScore: 0.76,
        reason: "FTS5/BM25",
      }],
    });

    expect(result.suggestions[0]?.topicId).toBe("network");
    expect(result.suggestions[0]?.confidence).toBeGreaterThanOrEqual(45);
  });

  it("does not fuzzy-match an unrelated title that only shares a generic suffix", () => {
    const energyTopic = regressionTopic(
      "energy",
      "能源、电力与材料",
      ["电力投资分析"],
    );
    const result = classifySource({
      source: {
        id: "ticker-investment",
        title: "SKHY投资分析",
        text: "分析 SK 海力士 ADR 的估值、溢价和财报。",
        kind: "ai_conversation",
        importedAt: "2026-07-27T00:00:00Z",
      },
      topics: [energyTopic],
      rules: [managedKeywordRule("energy", "电力投资分析", 0)],
      history: {
        confirmedTopicCounts: {},
        recentTopicIds: [],
        batchTopicIds: {},
      },
    });

    expect(result.suggestions).toEqual([]);
  });

  it("prioritizes a company-research title boundary over a generic sector entity", () => {
    const companyTopic = regressionTopic(
      "company",
      "公司与行业研究",
      ["商业模式分析"],
    );
    const semiconductorTopic = regressionTopic(
      "semiconductor",
      "半导体与算力产业",
      ["台积电"],
    );
    const result = classifySource({
      source: {
        id: "company-boundary",
        title: "台积电商业模式分析",
        text: "分析公司盈利质量、客户关系和长期估值。",
        kind: "ai_conversation",
        importedAt: "2026-07-27T00:00:00Z",
      },
      topics: [semiconductorTopic, companyTopic],
      rules: [
        managedKeywordRule("semiconductor", "台积电", 0),
        managedKeywordRule("company", "商业模式分析", 0),
      ],
      history: {
        confirmedTopicCounts: {},
        recentTopicIds: [],
        batchTopicIds: {},
      },
      searchSignals: [
        {
          topicId: "semiconductor",
          normalizedScore: 0.95,
          reason: "半导体正文 FTS5/BM25",
        },
      ],
    });

    expect(result.suggestions[0]?.topicId).toBe("company");
    expect(result.suggestions[0]?.reasons).toContain(
      "标题主体边界：公司主体与估值、财报或商业模式组合命中",
    );
  });

  it("prioritizes an account-risk boundary over a platform-name topic", () => {
    const systemTopic = regressionTopic(
      "account-system",
      "海外账号体系",
      ["Claude账号"],
    );
    const riskTopic = regressionTopic(
      "account-risk",
      "账号风控与封禁",
      ["账号封禁"],
    );
    const result = classifySource({
      source: {
        id: "account-risk-boundary",
        title: "Claude账号封禁退款申请",
        text: "账号被封后需要申诉并申请订阅退款。",
        kind: "ai_conversation",
        importedAt: "2026-07-27T00:00:00Z",
      },
      topics: [systemTopic, riskTopic],
      rules: [
        managedKeywordRule("account-system", "Claude账号", 0),
        managedKeywordRule("account-risk", "账号封禁", 0),
      ],
      history: {
        confirmedTopicCounts: {},
        recentTopicIds: [],
        batchTopicIds: {},
      },
      searchSignals: [{
        topicId: "account-system",
        normalizedScore: 0.95,
        reason: "平台正文 FTS5/BM25",
      }],
    });

    expect(result.suggestions[0]?.topicId).toBe("account-risk");
    expect(result.suggestions[0]?.reasons).toContain(
      "标题主体边界：账号或支付主体与风控状态组合命中",
    );
  });
});

function managedKeywordRule(
  topicId: string,
  value: string,
  index: number,
): ClassificationRule {
  return {
    id: `keyword:catalog-rule-${topicId}-keyword-${index}`,
    topicId,
    field: "text",
    operator: "contains",
    effect: "include",
    value,
    strength: 0.9,
    reason: `目录主题短语命中「${value}」`,
    enabled: true,
  };
}

function regressionTopic(
  id: string,
  name: string,
  keywords: string[],
): KnowledgeTopicCandidate {
  return {
    id,
    primaryDomainId: "domain",
    path: ["领域", name],
    name,
    aliases: [],
    entities: [],
    keywords,
    searchDocument: `${name} ${keywords.join(" ")}`,
    status: "active",
    updatedAt: "2026-07-27T00:00:00Z",
  };
}
