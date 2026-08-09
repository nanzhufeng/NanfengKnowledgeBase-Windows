import { describe, expect, it } from "vitest";
import type { KnowledgeTopicDetail } from "../services/knowledgeRepository";
import {
  buildKnowledgeOverview,
  buildKnowledgeSynthesis,
  buildKnowledgeTopicIntegration,
} from "./knowledgeSynthesis";

function detail(): KnowledgeTopicDetail {
  return {
    topic: {
      id: 7,
      publicId: "topic-7",
      domainId: 1,
      parentTopicId: null,
      name: "个人知识管理",
      description: "自动分类与长期判断",
      topicKind: "subject",
      status: "active",
      depth: 1,
      sortOrder: 0,
      sourceCount: 2,
    },
    relations: [],
    notes: [],
    judgments: [],
    evidence: [],
    questions: [],
    propositions: [],
    decisions: [],
    turningPoints: [],
    sources: [
      {
        id: 10,
        publicId: "source-10",
        legacyRecordId: 20,
        title: "自动分类方案",
        sourceType: "ai_conversation",
        originalAt: "2026-07-01T00:00:00Z",
        importedAt: "2026-07-02T00:00:00Z",
        confidence: 78,
        contentText: [
          "核心判断是自动分类应当成为默认路径，人工核对只处理低置信度冲突。",
          "建议超过百分之六十五时直接采用最高分主题，其余进入待确认。",
          "风险是同名主题可能造成边界混淆，需要保留来源证据和回溯入口。",
        ].join("\n"),
      },
      {
        id: 11,
        publicId: "source-11",
        legacyRecordId: 21,
        title: "知识成果阅读",
        sourceType: "markdown",
        originalAt: "2026-07-15T00:00:00Z",
        importedAt: "2026-07-16T00:00:00Z",
        confidence: 84,
        contentText: [
          "来源数量本身不是知识成果，正文中的命题、证据和变化原因才具备阅读价值。",
          "需要把每次判断变化关联到新增来源，才能解释为什么结论发生改变。",
          "如何识别相互冲突的证据仍需要持续验证？",
        ].join("\n"),
      },
    ],
  };
}

describe("buildKnowledgeSynthesis", () => {
  it("combines multiple source notes into one traceable topic integration", () => {
    const integration = buildKnowledgeTopicIntegration(detail());

    expect(integration).toMatchObject({
      mode: "automatic",
      title: "个人知识管理 · 自动整合",
      sourceItemIds: [10, 11],
    });
    expect(integration?.bodyMarkdown).toContain("《自动分类方案》");
    expect(integration?.bodyMarkdown).toContain("《知识成果阅读》");
    expect(integration?.bodyMarkdown).not.toContain("暂无独立笔记");
  });

  it("treats persisted notes as sections of one topic result instead of independent entries", () => {
    const input = detail();
    input.notes = [
      {
        id: 31,
        publicId: "note-31",
        title: "分类判断",
        bodyMarkdown: "自动分类需要保留人工复核。",
        summary: "分类规则的阶段结论",
        noteType: "conclusion",
        status: "active",
        organizationState: "organized",
        primaryTopicId: 7,
        relatedTopicIds: [],
        sourceItemIds: [10],
        createdAt: "2026-07-20T00:00:00Z",
        updatedAt: "2026-07-20T00:00:00Z",
      },
      {
        id: 32,
        publicId: "note-32",
        title: "阅读判断",
        bodyMarkdown: "主题阅读要保留来源回溯。",
        summary: "知识阅读的阶段结论",
        noteType: "summary",
        status: "active",
        organizationState: "organized",
        primaryTopicId: 7,
        relatedTopicIds: [],
        sourceItemIds: [11],
        createdAt: "2026-07-21T00:00:00Z",
        updatedAt: "2026-07-21T00:00:00Z",
      },
    ];

    const integration = buildKnowledgeTopicIntegration(input);
    expect(integration?.mode).toBe("curated");
    expect(integration?.bodyMarkdown).toContain("## 分类判断");
    expect(integration?.bodyMarkdown).toContain("## 阅读判断");
    expect(integration?.statusLabel).toContain("2 项整理内容");
  });

  it("marks a lone source as pending aggregation instead of a mature topic note", () => {
    const input = detail();
    input.sources = input.sources.slice(0, 1);

    expect(buildKnowledgeTopicIntegration(input)).toMatchObject({
      mode: "pending",
      title: "个人知识管理 · 待聚合",
      statusLabel: "待聚合 · 当前仅 1 条来源",
    });
  });

  it("uses real body statements instead of source titles", () => {
    const synthesis = buildKnowledgeSynthesis(detail());
    expect(synthesis.hypotheses.length).toBeGreaterThan(0);
    expect(synthesis.hypotheses[0]?.statement).not.toBe("自动分类方案");
    expect(synthesis.hypotheses[0]?.anchors[0]?.sourceItemId).toBeGreaterThan(0);
    expect(synthesis.judgments).toHaveLength(2);
  });

  it("creates traceable decision drafts without inventing completed results", () => {
    const synthesis = buildKnowledgeSynthesis(detail());
    expect(synthesis.decisionDrafts.length).toBeGreaterThan(0);
    expect(synthesis.decisionDrafts[0]?.sourceTitle).toBeTruthy();
    expect(synthesis.decisionDrafts[0]?.actualActions).toEqual([]);
    expect(synthesis.decisionDrafts[0]?.finalResult).toBe("");
  });

  it("rejects conversational offers and context fragments from every automatic draft", () => {
    const input = detail();
    input.topic.name = "数据中心真实净回报率";
    input.topic.description = "核对利用率、能源成本与资本开支回收周期";
    input.sources = [{
      ...input.sources[0],
      title: "数据中心回报研究",
      contentText: [
        "的话，我可以单独就“数据中心真实净回报率”帮你拆解。",
        "判断数据中心真实净回报率时，应当同时核对利用率、能源成本和资本开支回收周期。",
        "能源成本上升可能压低项目回报，需要把电价波动纳入风险区间。",
        "如果你愿意，我可以继续整理成表格。",
      ].join("\n"),
    }];

    const synthesis = buildKnowledgeSynthesis(input);
    const automaticTexts = [
      ...synthesis.hypotheses.map((item) => item.statement),
      ...synthesis.judgments.map((item) => item.statement),
      ...synthesis.decisionDrafts.flatMap((item) => [
        item.title,
        item.decision,
        item.expectedResult,
        ...item.knownRisks,
      ]),
      ...synthesis.openQuestions,
    ];

    expect(automaticTexts.join("\n")).not.toMatch(/我可以|如果你愿意|^的话/m);
    expect(synthesis.decisionDrafts).toHaveLength(1);
    expect(synthesis.decisionDrafts[0]).toMatchObject({
      title: "《数据中心回报研究》中的待确认建议",
      decision: "判断数据中心真实净回报率时，应当同时核对利用率、能源成本和资本开支回收周期。",
      expectedResult: "待确认：补充可观测指标与复核时间后，再评估该建议是否达到预期。",
      actualActions: [],
      finalResult: "",
      retrospective: "",
    });
  });

  it("fills the unified overview from real source text when formal objects are empty", () => {
    const synthesis = buildKnowledgeSynthesis(detail());
    const overview = buildKnowledgeOverview(detail(), synthesis);

    expect(overview.currentJudgment.statement).toBeTruthy();
    expect(overview.currentJudgment.automatic).toBe(true);
    expect(overview.facts.length).toBeGreaterThan(0);
    expect(overview.evidence.length).toBeGreaterThan(0);
    expect(overview.questions.length).toBeGreaterThan(0);
    expect(overview.actions.length).toBeGreaterThan(0);
    expect(overview.evidence[0]?.sourceItemId).toBeGreaterThan(0);
    expect(overview.actions.every((item) => item.automatic)).toBe(true);
  });

  it("prefers formal judgment and verified evidence without writing synthetic completion", () => {
    const input = detail();
    input.judgments = [{
      id: 1,
      publicId: "judgment-current",
      propositionId: null,
      statementMarkdown: "正式判断优先于正文提炼。",
      state: "current",
      confidence: 91,
      changeReason: "人工确认",
      effectiveAt: "2026-07-20T00:00:00Z",
      createdAt: "2026-07-20T00:00:00Z",
    }];
    input.evidence = [{
      id: 2,
      publicId: "evidence-2",
      sourceItemId: 10,
      propositionId: null,
      sourceTitle: "自动分类方案",
      contentMarkdown: "人工已经核验阈值与低置信度分流规则。",
      stance: "support",
      credibility: 94,
      verificationStatus: "verified",
      validityStatus: "active",
      locatorJson: "{}",
      locatorLabel: "正文",
      confirmedAt: "2026-07-20T00:00:00Z",
      validFrom: null,
      validUntil: null,
      reviewAt: null,
      createdAt: "2026-07-20T00:00:00Z",
    }];

    const overview = buildKnowledgeOverview(input);
    expect(overview.currentJudgment).toMatchObject({
      statement: "正式判断优先于正文提炼。",
      confidence: 91,
      automatic: false,
    });
    expect(overview.facts[0]).toMatchObject({
      text: "人工已经核验阈值与低置信度分流规则。",
      automatic: false,
      sourceItemId: 10,
    });
  });
});
