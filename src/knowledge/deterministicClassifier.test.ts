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
    expect(decideClassificationAction(90)).toBe("auto_eligible");
    expect(decideClassificationAction(89.99)).toBe("confirm");
    expect(decideClassificationAction(70)).toBe("confirm");
    expect(decideClassificationAction(69.99)).toBe("candidates");
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
});

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
