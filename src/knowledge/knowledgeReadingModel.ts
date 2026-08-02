import type {
  KnowledgeTopicDetail,
  TopicDecisionRow,
} from "../services/knowledgeRepository";

export type KnowledgeEventKind =
  | "source"
  | "note"
  | "proposition"
  | "evidence"
  | "evidence_expiry"
  | "judgment"
  | "turning_point"
  | "question"
  | "question_resolved"
  | "decision"
  | "decision_result"
  | "relation";

export type KnowledgeTimelineEvent = {
  id: string;
  kind: KnowledgeEventKind;
  occurredAt: string;
  topicId: number;
  topicName: string;
  title: string;
  summary: string;
  sourceItemId: number | null;
  locatorJson: string | null;
  locatorLabel: string | null;
};

export type KnowledgeExpiryIssue = {
  id: string;
  kind: "evidence" | "proposition" | "decision" | "judgment_dependency";
  status: "expired" | "possibly_outdated" | "review_due" | "upcoming";
  title: string;
  detail: string;
  dueAt: string | null;
  sourceItemId: number | null;
  locatorJson: string | null;
  locatorLabel: string | null;
};

export type KnowledgeDateSlice = {
  asOf: string;
  sources: KnowledgeTopicDetail["sources"];
  notes: KnowledgeTopicDetail["notes"];
  propositions: KnowledgeTopicDetail["propositions"];
  evidence: KnowledgeTopicDetail["evidence"];
  judgments: KnowledgeTopicDetail["judgments"];
  questions: KnowledgeTopicDetail["questions"];
  decisions: KnowledgeTopicDetail["decisions"];
  turningPoints: KnowledgeTopicDetail["turningPoints"];
};

export type DecisionReviewSummary = {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  mixed: number;
  pendingReview: number;
};

function timestamp(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const parsed = new Date(value);
  return parsed.getTime();
}

function asOfTimestamp(value: string): number {
  const parsed = new Date(`${value.slice(0, 10)}T23:59:59.999`);
  return parsed.getTime();
}

function occurredBefore(value: string | null | undefined, limit: number): boolean {
  const parsed = timestamp(value);
  return Number.isFinite(parsed) && parsed <= limit;
}

function timelineForTopic(detail: KnowledgeTopicDetail): KnowledgeTimelineEvent[] {
  const topicId = detail.topic.id;
  const topicName = detail.topic.name;
  const events: KnowledgeTimelineEvent[] = [];
  for (const source of detail.sources) {
    events.push({
      id: `source-${source.id}`,
      kind: "source",
      occurredAt: source.importedAt || source.originalAt || "",
      topicId,
      topicName,
      title: "来源进入主题",
      summary: source.title,
      sourceItemId: source.id,
      locatorJson: null,
      locatorLabel: null,
    });
  }
  for (const note of detail.notes) {
    events.push({
      id: `note-${note.id}`,
      kind: "note",
      occurredAt: note.createdAt,
      topicId,
      topicName,
      title: "笔记创建",
      summary: note.title,
      sourceItemId: note.sourceItemIds[0] ?? null,
      locatorJson: null,
      locatorLabel: null,
    });
  }
  for (const proposition of detail.propositions) {
    events.push({
      id: `proposition-${proposition.id}`,
      kind: "proposition",
      occurredAt: proposition.confirmedAt || proposition.createdAt,
      topicId,
      topicName,
      title: proposition.propositionKind === "hypothesis" ? "竞争假设形成" : "命题形成",
      summary: proposition.statementMarkdown,
      sourceItemId: null,
      locatorJson: null,
      locatorLabel: null,
    });
  }
  for (const evidence of detail.evidence) {
    events.push({
      id: `evidence-${evidence.id}`,
      kind: "evidence",
      occurredAt: evidence.confirmedAt || evidence.createdAt,
      topicId,
      topicName,
      title: evidence.stance === "support"
        ? "支持证据新增"
        : evidence.stance === "oppose"
          ? "反对证据新增"
          : "背景证据新增",
      summary: evidence.contentMarkdown,
      sourceItemId: evidence.sourceItemId,
      locatorJson: evidence.locatorJson,
      locatorLabel: evidence.locatorLabel,
    });
    if (evidence.validUntil) {
      events.push({
        id: `evidence-expiry-${evidence.id}`,
        kind: "evidence_expiry",
        occurredAt: evidence.validUntil,
        topicId,
        topicName,
        title: "证据有效期结束",
        summary: evidence.contentMarkdown,
        sourceItemId: evidence.sourceItemId,
        locatorJson: evidence.locatorJson,
        locatorLabel: evidence.locatorLabel,
      });
    }
  }
  for (const judgment of detail.judgments) {
    events.push({
      id: `judgment-${judgment.id}`,
      kind: "judgment",
      occurredAt: judgment.effectiveAt,
      topicId,
      topicName,
      title: "判断更新",
      summary: judgment.statementMarkdown,
      sourceItemId: null,
      locatorJson: null,
      locatorLabel: null,
    });
  }
  for (const point of detail.turningPoints) {
    events.push({
      id: `turning-point-${point.id}`,
      kind: "turning_point",
      occurredAt: point.occurredAt,
      topicId,
      topicName,
      title: `关键转折：${point.title}`,
      summary: point.explanation,
      sourceItemId: null,
      locatorJson: null,
      locatorLabel: null,
    });
  }
  for (const question of detail.questions) {
    events.push({
      id: `question-${question.id}`,
      kind: "question",
      occurredAt: question.createdAt,
      topicId,
      topicName,
      title: "待验证问题提出",
      summary: question.question,
      sourceItemId: null,
      locatorJson: null,
      locatorLabel: null,
    });
    if (question.status === "resolved") {
      events.push({
        id: `question-resolved-${question.id}`,
        kind: "question_resolved",
        occurredAt: question.updatedAt,
        topicId,
        topicName,
        title: "待验证问题解决",
        summary: question.resolutionNote || question.question,
        sourceItemId: null,
        locatorJson: null,
        locatorLabel: null,
      });
    }
  }
  for (const decision of detail.decisions) {
    events.push({
      id: `decision-${decision.id}`,
      kind: "decision",
      occurredAt: decision.decidedAt,
      topicId,
      topicName,
      title: `决策：${decision.title}`,
      summary: decision.decisionMarkdown,
      sourceItemId: null,
      locatorJson: null,
      locatorLabel: null,
    });
    if (!["pending", "in_progress"].includes(decision.resultStatus)) {
      events.push({
        id: `decision-result-${decision.id}`,
        kind: "decision_result",
        occurredAt: decision.updatedAt,
        topicId,
        topicName,
        title: `决策结果：${decision.title}`,
        summary: decision.finalResult || decision.retrospective || decision.resultStatus,
        sourceItemId: null,
        locatorJson: null,
        locatorLabel: null,
      });
    }
  }
  for (const relation of detail.relations) {
    events.push({
      id: `relation-${relation.id}`,
      kind: "relation",
      occurredAt: relation.createdAt,
      topicId,
      topicName,
      title: "主题关系建立",
      summary: relation.note || relation.relationType,
      sourceItemId: null,
      locatorJson: null,
      locatorLabel: null,
    });
  }
  return events.filter((event) => Number.isFinite(timestamp(event.occurredAt)));
}

export function buildKnowledgeTimeline(
  detail: KnowledgeTopicDetail,
  relatedDetails: KnowledgeTopicDetail[] = [],
): KnowledgeTimelineEvent[] {
  return [detail, ...relatedDetails]
    .flatMap(timelineForTopic)
    .sort((left, right) => {
      const timeDifference = timestamp(left.occurredAt) - timestamp(right.occurredAt);
      return timeDifference || left.id.localeCompare(right.id);
    });
}

export function buildKnowledgeDateSlice(
  detail: KnowledgeTopicDetail,
  asOf: string,
): KnowledgeDateSlice {
  const limit = asOfTimestamp(asOf);
  const sourceDate = (source: KnowledgeTopicDetail["sources"][number]) =>
    source.importedAt || source.originalAt;
  return {
    asOf: asOf.slice(0, 10),
    sources: detail.sources.filter((item) => occurredBefore(sourceDate(item), limit)),
    notes: detail.notes.filter((item) => occurredBefore(item.createdAt, limit)),
    propositions: detail.propositions.filter(
      (item) => occurredBefore(item.confirmedAt || item.createdAt, limit),
    ),
    evidence: detail.evidence.filter(
      (item) => occurredBefore(item.confirmedAt || item.createdAt, limit),
    ),
    judgments: detail.judgments.filter((item) => occurredBefore(item.effectiveAt, limit)),
    questions: detail.questions.filter((item) => occurredBefore(item.createdAt, limit)),
    decisions: detail.decisions.filter((item) => occurredBefore(item.decidedAt, limit)),
    turningPoints: detail.turningPoints.filter((item) => occurredBefore(item.occurredAt, limit)),
  };
}

function expiryStatus(
  validityStatus: string,
  validUntil: string | null,
  reviewAt: string | null,
  now: number,
): Pick<KnowledgeExpiryIssue, "status" | "dueAt"> | null {
  if (validityStatus === "expired") return { status: "expired", dueAt: validUntil };
  if (validityStatus === "possibly_outdated") {
    return { status: "possibly_outdated", dueAt: reviewAt || validUntil };
  }
  const validUntilTime = timestamp(validUntil);
  if (Number.isFinite(validUntilTime) && validUntilTime < now) {
    return { status: "expired", dueAt: validUntil };
  }
  const reviewTime = timestamp(reviewAt);
  if (Number.isFinite(reviewTime) && reviewTime <= now) {
    return { status: "review_due", dueAt: reviewAt };
  }
  const upcomingLimit = now + 30 * 24 * 60 * 60 * 1000;
  const futureDates = [
    { value: reviewAt, time: reviewTime },
    { value: validUntil, time: validUntilTime },
  ].filter((item) => Number.isFinite(item.time) && item.time > now && item.time <= upcomingLimit);
  if (futureDates.length) {
    futureDates.sort((left, right) => left.time - right.time);
    return { status: "upcoming", dueAt: futureDates[0]?.value ?? null };
  }
  return null;
}

export function deriveKnowledgeExpiryIssues(
  detail: KnowledgeTopicDetail,
  nowInput: string | Date = new Date(),
): KnowledgeExpiryIssue[] {
  const now = nowInput instanceof Date ? nowInput.getTime() : timestamp(nowInput);
  if (!Number.isFinite(now)) throw new Error("知识有效期计算需要有效的当前日期");
  const issues: KnowledgeExpiryIssue[] = [];
  for (const evidence of detail.evidence) {
    const derived = expiryStatus(
      evidence.validityStatus,
      evidence.validUntil,
      evidence.reviewAt,
      now,
    );
    if (!derived) continue;
    issues.push({
      id: `evidence-${evidence.id}`,
      kind: "evidence",
      ...derived,
      title: evidence.sourceTitle,
      detail: evidence.contentMarkdown,
      sourceItemId: evidence.sourceItemId,
      locatorJson: evidence.locatorJson,
      locatorLabel: evidence.locatorLabel,
    });
  }
  for (const proposition of detail.propositions) {
    const derived = expiryStatus(
      proposition.validityStatus,
      proposition.validUntil,
      proposition.reviewAt,
      now,
    );
    if (!derived) continue;
    issues.push({
      id: `proposition-${proposition.id}`,
      kind: "proposition",
      ...derived,
      title: proposition.propositionKind === "hypothesis" ? "竞争假设" : "命题",
      detail: proposition.statementMarkdown,
      sourceItemId: null,
      locatorJson: null,
      locatorLabel: null,
    });
  }
  for (const decision of detail.decisions) {
    const reviewTime = timestamp(decision.reviewAt);
    if (
      !Number.isFinite(reviewTime)
      || !["pending", "in_progress"].includes(decision.resultStatus)
    ) continue;
    issues.push({
      id: `decision-${decision.id}`,
      kind: "decision",
      status: reviewTime <= now ? "review_due" : "upcoming",
      title: decision.title,
      detail: decision.expectedResult || decision.decisionMarkdown,
      dueAt: decision.reviewAt,
      sourceItemId: null,
      locatorJson: null,
      locatorLabel: null,
    });
  }
  const currentJudgment = detail.judgments[0] ?? null;
  if (currentJudgment?.propositionId) {
    const expiredEvidence = issues.filter(
      (issue) => issue.kind === "evidence"
        && issue.status !== "upcoming"
        && detail.evidence.some(
          (evidence) =>
            evidence.id === Number(issue.id.replace("evidence-", ""))
            && evidence.propositionId === currentJudgment.propositionId,
        ),
    );
    if (expiredEvidence.length) {
      issues.push({
        id: `judgment-dependency-${currentJudgment.id}`,
        kind: "judgment_dependency",
        status: "possibly_outdated",
        title: "当前判断依赖待复核或失效证据",
        detail: `${expiredEvidence.length} 条关联证据需要复核`,
        dueAt: expiredEvidence[0]?.dueAt ?? null,
        sourceItemId: null,
        locatorJson: null,
        locatorLabel: null,
      });
    }
  }
  const priority = {
    expired: 0,
    possibly_outdated: 1,
    review_due: 2,
    upcoming: 3,
  } as const;
  return issues.sort((left, right) => {
    const statusDifference = priority[left.status] - priority[right.status];
    if (statusDifference) return statusDifference;
    return timestamp(left.dueAt) - timestamp(right.dueAt);
  });
}

export function summarizeDecisionHistory(
  decisions: TopicDecisionRow[],
  nowInput: string | Date = new Date(),
): DecisionReviewSummary {
  const now = nowInput instanceof Date ? nowInput.getTime() : timestamp(nowInput);
  return decisions.reduce<DecisionReviewSummary>((summary, decision) => {
    summary.total += 1;
    if (!["pending", "in_progress"].includes(decision.resultStatus)) summary.completed += 1;
    if (decision.resultStatus === "succeeded") summary.succeeded += 1;
    if (decision.resultStatus === "failed") summary.failed += 1;
    if (decision.resultStatus === "mixed") summary.mixed += 1;
    const reviewAt = timestamp(decision.reviewAt);
    if (
      Number.isFinite(reviewAt)
      && reviewAt <= now
      && ["pending", "in_progress"].includes(decision.resultStatus)
    ) {
      summary.pendingReview += 1;
    }
    return summary;
  }, {
    total: 0,
    completed: 0,
    succeeded: 0,
    failed: 0,
    mixed: 0,
    pendingReview: 0,
  });
}
