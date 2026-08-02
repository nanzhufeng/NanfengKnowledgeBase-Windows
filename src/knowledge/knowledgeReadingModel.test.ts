import { describe, expect, it } from "vitest";
import type { KnowledgeTopicDetail } from "../services/knowledgeRepository";
import {
  buildKnowledgeDateSlice,
  buildKnowledgeTimeline,
  deriveKnowledgeExpiryIssues,
  summarizeDecisionHistory,
} from "./knowledgeReadingModel";

function detail(topicId = 1, topicName = "AI 资本开支"): KnowledgeTopicDetail {
  return {
    topic: {
      id: topicId,
      publicId: `topic-${topicId}`,
      domainId: 1,
      parentTopicId: null,
      name: topicName,
      description: "现金流与商业回报",
      topicKind: "topic",
      status: "active",
      depth: 1,
      sortOrder: 0,
      sourceCount: 1,
    },
    relations: [],
    sources: [{
      id: topicId * 100,
      publicId: `source-${topicId}`,
      title: `${topicName}来源`,
      sourceType: "markdown",
      originalAt: "2026-06-01T00:00:00Z",
      importedAt: "2026-06-02T00:00:00Z",
      confidence: 80,
    }],
    notes: [{
      id: topicId * 10,
      publicId: `note-${topicId}`,
      title: `${topicName}研究笔记`,
      bodyMarkdown: "正文",
      summary: "摘要",
      noteType: "research",
      status: "active",
      organizationState: "organized",
      primaryTopicId: topicId,
      relatedTopicIds: [],
      sourceItemIds: [topicId * 100],
      createdAt: "2026-06-10T00:00:00Z",
      updatedAt: "2026-06-10T00:00:00Z",
    }],
    propositions: [{
      id: topicId * 20,
      publicId: `proposition-${topicId}`,
      topicId,
      statementMarkdown: "资本开支会形成商业回报",
      status: "supported",
      propositionKind: "hypothesis",
      hypothesisGroup: "商业回报",
      confidence: 72,
      invalidationCondition: "利用率不增长",
      validityStatus: "active",
      confirmedAt: "2026-06-12T00:00:00Z",
      validFrom: "2026-06-12",
      validUntil: "2026-07-20",
      reviewAt: "2026-07-15",
      createdAt: "2026-06-12T00:00:00Z",
      updatedAt: "2026-06-12T00:00:00Z",
    }],
    evidence: [{
      id: topicId * 30,
      publicId: `evidence-${topicId}`,
      sourceItemId: topicId * 100,
      propositionId: topicId * 20,
      sourceTitle: `${topicName}来源`,
      contentMarkdown: "利用率继续增长",
      stance: "support",
      credibility: 80,
      verificationStatus: "verified",
      validityStatus: "active",
      locatorJson: "{\"kind\":\"markdown_heading\",\"value\":\"关键数据\"}",
      locatorLabel: "Markdown 标题：关键数据",
      confirmedAt: "2026-06-15T00:00:00Z",
      validFrom: "2026-06-15",
      validUntil: "2026-07-20",
      reviewAt: "2026-07-15",
      createdAt: "2026-06-15T00:00:00Z",
    }],
    judgments: [{
      id: topicId * 40,
      publicId: `judgment-${topicId}`,
      propositionId: topicId * 20,
      statementMarkdown: "当前谨慎乐观",
      state: "current",
      confidence: 68,
      changeReason: "新证据进入",
      effectiveAt: "2026-07-01T00:00:00Z",
      createdAt: "2026-07-01T00:00:00Z",
    }],
    questions: [{
      id: topicId * 50,
      publicId: `question-${topicId}`,
      question: "利润率能否恢复？",
      importance: "high",
      affectsCurrentJudgment: true,
      status: "resolved",
      resolutionNote: "仍需两个季度验证",
      createdAt: "2026-06-20T00:00:00Z",
      updatedAt: "2026-07-05T00:00:00Z",
    }],
    turningPoints: [{
      id: topicId * 60,
      publicId: `turning-${topicId}`,
      topicId,
      fromJudgmentId: null,
      fromStatementMarkdown: null,
      toJudgmentId: topicId * 40,
      toStatementMarkdown: "当前谨慎乐观",
      title: "利用率拐点",
      explanation: "调用量改善",
      occurredAt: "2026-07-01T00:00:00Z",
      createdAt: "2026-07-01T00:00:00Z",
    }],
    decisions: [{
      id: topicId * 70,
      publicId: `decision-${topicId}`,
      topicId,
      propositionId: topicId * 20,
      judgmentSnapshotId: topicId * 40,
      title: "继续观察",
      decisionMarkdown: "暂不行动",
      decidedAt: "2026-07-10T00:00:00Z",
      status: "active",
      knownRisks: ["现金流恶化"],
      expectedResult: "等待利用率确认",
      actualActions: ["跟踪财报"],
      reviewAt: "2026-07-25",
      resultStatus: "in_progress",
      finalResult: "",
      retrospective: "",
      createdAt: "2026-07-10T00:00:00Z",
      updatedAt: "2026-07-10T00:00:00Z",
    }],
  };
}

describe("knowledgeReadingModel", () => {
  it("combines selected and related topics into one chronological event stream", () => {
    const primary = detail();
    const related = detail(2, "数据中心电力");
    const events = buildKnowledgeTimeline(primary, [related]);

    expect(events.some((item) => item.topicId === 2 && item.kind === "source")).toBe(true);
    expect(events.some((item) => item.kind === "evidence_expiry")).toBe(true);
    expect(events.some((item) => item.kind === "turning_point")).toBe(true);
    expect(events.map((item) => new Date(item.occurredAt).getTime())).toEqual(
      [...events]
        .map((item) => new Date(item.occurredAt).getTime())
        .sort((left, right) => left - right),
    );
  });

  it("builds an as-of slice without future knowledge objects", () => {
    const slice = buildKnowledgeDateSlice(detail(), "2026-06-18");

    expect(slice.sources).toHaveLength(1);
    expect(slice.notes).toHaveLength(1);
    expect(slice.propositions).toHaveLength(1);
    expect(slice.evidence).toHaveLength(1);
    expect(slice.judgments).toHaveLength(0);
    expect(slice.decisions).toHaveLength(0);
  });

  it("does not expose a backfilled source before it was imported", () => {
    const current = detail();
    current.sources[0] = {
      ...current.sources[0]!,
      originalAt: "2025-01-01T00:00:00Z",
      importedAt: "2026-06-20T00:00:00Z",
    };
    current.propositions[0] = {
      ...current.propositions[0]!,
      confirmedAt: "2026-06-12T00:00:00Z",
      createdAt: "2026-07-01T00:00:00Z",
    };

    const slice = buildKnowledgeDateSlice(current, "2026-06-18");

    expect(slice.sources).toHaveLength(0);
    expect(slice.propositions).toHaveLength(1);
  });

  it("derives expiry and dependency risks from dates without mutating stored status", () => {
    const issues = deriveKnowledgeExpiryIssues(detail(), "2026-07-29T00:00:00Z");

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "evidence-30", status: "expired" }),
      expect.objectContaining({ id: "proposition-20", status: "expired" }),
      expect.objectContaining({ id: "decision-70", status: "review_due" }),
      expect.objectContaining({
        id: "judgment-dependency-40",
        status: "possibly_outdated",
      }),
    ]));
  });

  it("summarizes decision outcomes and overdue reviews", () => {
    const current = detail().decisions[0]!;
    const summary = summarizeDecisionHistory([
      current,
      { ...current, id: 71, resultStatus: "succeeded", reviewAt: null },
      { ...current, id: 72, resultStatus: "failed", reviewAt: null },
      { ...current, id: 73, resultStatus: "mixed", reviewAt: null },
    ], "2026-07-29T00:00:00Z");

    expect(summary).toEqual({
      total: 4,
      completed: 3,
      succeeded: 1,
      failed: 1,
      mixed: 1,
      pendingReview: 1,
    });
  });
});
