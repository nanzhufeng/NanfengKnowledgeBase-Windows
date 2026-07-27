import { describe, expect, it } from "vitest";
import {
  evidenceSchema,
  judgmentSnapshotSchema,
  operationLogSchema,
  sourceItemSchema,
  topicSchema,
} from "./domain";

describe("knowledge domain contracts", () => {
  it("models a subtopic as a topic with a parent instead of a parallel object", () => {
    const topic = topicSchema.parse({
      id: "topic-child",
      primaryDomainId: "domain-investment",
      parentTopicId: "topic-ai-capex",
      name: "周期与现金流",
      aliases: ["CapEx 周期"],
      summary: "跟踪资本开支与现金流变化",
      status: "watching",
      isTracking: true,
      importance: 4,
      currentJudgment: "高投入延续，但结构开始分化",
      reviewAt: "2026-08-15T09:00:00+08:00",
      topicType: "research_question",
      createdAt: "2026-07-01T09:00:00+08:00",
      updatedAt: "2026-07-23T22:14:00+08:00",
    });
    expect(topic.parentTopicId).toBe("topic-ai-capex");
    expect(topic.primaryDomainId).toBe("domain-investment");
  });

  it("keeps original source material separate from organization state", () => {
    const source = sourceItemSchema.parse({
      id: "source-1",
      title: "资本开支对话",
      platform: "ChatGPT",
      kind: "ai_conversation",
      originalFilePath: "imports/raw/hash/conversations.json",
      originalText: "用户与助手的可见对话",
      originalJson: "{\"mapping\":{}}",
      sha256: "a".repeat(64),
      originalUrl: null,
      author: null,
      publishedAt: "2026-07-23T22:14:00+08:00",
      importedAt: "2026-07-26T10:00:00+08:00",
      readState: "unread",
      organizationState: "inbox",
      duplicateState: "unknown",
      freshnessState: "current",
    });
    expect(source.originalJson).toBe("{\"mapping\":{}}");
    expect(source.organizationState).toBe("inbox");
  });

  it("requires evidence to preserve source identity and an explicit anchor shape", () => {
    expect(() =>
      evidenceSchema.parse({
        id: "evidence-1",
        topicId: "topic-1",
        stance: "support",
        content: "资本开支同比增长",
        anchor: {
          page: 3,
          timecode: null,
          messageId: null,
          textQuote: "资本开支同比 +41%",
        },
        credibility: 90,
        verificationState: "verified",
        validityState: "active",
        evidenceDate: "2026-07-20",
        notes: "",
      }),
    ).toThrow();
  });

  it("bounds judgment confidence and preserves undo snapshots in operation logs", () => {
    expect(() =>
      judgmentSnapshotSchema.parse({
        id: "judgment-1",
        topicId: "topic-1",
        propositionId: null,
        content: "当前判断",
        judgedAt: "2026-07-23",
        state: "current",
        confidence: 120,
        changeReason: "",
        previousDiff: "",
        unresolvedQuestions: [],
      }),
    ).toThrow();

    const operation = operationLogSchema.parse({
      id: "operation-1",
      operationType: "classification",
      actor: "classifier",
      targetType: "source_item",
      targetIds: ["source-1"],
      algorithmVersion: "local-rules-v1",
      beforeSnapshotJson: "{\"topicId\":null}",
      afterSnapshotJson: "{\"topicId\":\"topic-1\"}",
      reasonJson: "{\"confidence\":95}",
      undoState: "available",
      createdAt: "2026-07-26T10:00:00+08:00",
      undoneAt: null,
    });
    expect(operation.undoState).toBe("available");
  });
});
