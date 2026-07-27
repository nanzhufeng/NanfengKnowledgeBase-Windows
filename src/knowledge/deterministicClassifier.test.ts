import { describe, expect, it } from "vitest";
import {
  classificationHistory,
  classificationRules,
  classificationSourceFixtures,
  classificationTopics,
} from "./classificationFixtures";
import { classifySource, CLASSIFIER_ALGORITHM_VERSION } from "./deterministicClassifier";
import { decideClassificationAction } from "./domain";

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
});
