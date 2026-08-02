import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const evidenceDirectory = resolve(".runtime-qa", "knowledge-final-layout-evidence");

test.beforeAll(async () => {
  await mkdir(evidenceDirectory, { recursive: true });
});

test("知识视图默认竞争假设，可稳定切换判断演变并保持四套皮肤结构一致", async ({ page }) => {
  test.setTimeout(120_000);
  const browserErrors: string[] = [];
  const failedResources: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      browserErrors.push(`${message.text()} @ ${location.url}:${location.lineNumber}`);
    }
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResources.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.setViewportSize({ width: 1702, height: 1066 });
  await page.addInitScript(() => {
    const now = "2026-07-28T10:00:00+08:00";
    const domain = {
      id: 1,
      publicId: "domain-investment",
      name: "投资与市场",
      description: "投资判断与产业研究",
      sortOrder: 0,
    };
    const topic = {
      id: 3,
      publicId: "topic-ai-capex",
      domainId: 1,
      parentTopicId: null,
      name: "AI 资本开支",
      description: "商业回报、现金流与供给约束",
      topicKind: "subject",
      status: "active",
      depth: 1,
      sortOrder: 0,
      sourceCount: 14,
    };
    const relatedTopic = {
      ...topic,
      id: 4,
      publicId: "topic-cloud",
      name: "云服务",
      description: "云厂商与算力供给",
      sourceCount: 8,
    };
    const sourceArchiveItem = {
      id: 101,
      publicId: "source-101",
      legacyRecordId: 901,
      sourceType: "markdown",
      title: "GPU 供给与云业务数据",
      platform: "local",
      originalAt: "2026-07-20T10:00:00+08:00",
      importedAt: "2026-07-21T10:00:00+08:00",
      readState: "read",
      organizationState: "organized",
      duplicateState: "unique",
      freshnessState: "current",
      pendingSuggestionCount: 0,
      assignedTopicCount: 1,
      primaryTopicId: topic.id,
      primaryTopicName: topic.name,
      linkedNoteCount: 1,
    };
    const sourceArchiveItems = [
      sourceArchiveItem,
      {
        ...sourceArchiveItem,
        id: 102,
        publicId: "source-102",
        legacyRecordId: 902,
        title: "单位推理成本跟踪",
        originalAt: "2026-07-22T10:00:00+08:00",
        importedAt: "2026-07-23T10:00:00+08:00",
      },
      {
        ...sourceArchiveItem,
        id: 103,
        publicId: "source-103",
        legacyRecordId: 903,
        title: "自由现金流追踪报告",
        originalAt: "2026-07-23T10:00:00+08:00",
        importedAt: "2026-07-24T10:00:00+08:00",
      },
    ];
    const trashedRecordIds = new Set<number>();
    const recordSummary = {
      id: 901,
      title: sourceArchiveItem.title,
      displayTitle: sourceArchiveItem.title,
      summary: "头部厂商推理调用量持续增长",
      status: "normal",
      tags: [],
      sourceTitle: sourceArchiveItem.title,
      searchSnippet: "GPU 供给与云业务数据",
      isFavorite: false,
      isDeleted: false,
      originalAt: sourceArchiveItem.originalAt,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      versionCount: 1,
    };
    const recordSummaries = sourceArchiveItems.map((source, index) => ({
      ...recordSummary,
      id: source.legacyRecordId,
      title: source.title,
      displayTitle: source.title,
      sourceTitle: source.title,
      searchSnippet: `${source.title} 正文摘要`,
      originalAt: source.originalAt,
      summary: index === 0 ? recordSummary.summary : "用于列表快速定位与滚动合同验证",
    }));
    const hypotheses = [
      {
        id: 21,
        publicId: "proposition-21",
        topicId: topic.id,
        statementMarkdown: "规模效应兑现，利润率回升",
        status: "supported",
        propositionKind: "hypothesis",
        hypothesisGroup: "AI 资本开支能否带来可持续商业回报？",
        confidence: 72,
        invalidationCondition: "单位推理成本无法在两个季度内继续下降",
        validityStatus: "active",
        confirmedAt: "2026-07-10T10:00:00+08:00",
        validFrom: "2026-07-10T10:00:00+08:00",
        validUntil: "2026-08-27T10:00:00+08:00",
        reviewAt: "2026-08-20T10:00:00+08:00",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 22,
        publicId: "proposition-22",
        topicId: topic.id,
        statementMarkdown: "投入回收期过长，现金流承压",
        status: "open",
        propositionKind: "hypothesis",
        hypothesisGroup: "AI 资本开支能否带来可持续商业回报？",
        confidence: 61,
        invalidationCondition: "若连续两个季度自由现金流率企稳",
        validityStatus: "possibly_outdated",
        confirmedAt: "2026-07-10T10:00:00+08:00",
        validFrom: "2026-07-10T10:00:00+08:00",
        validUntil: "2026-08-27T10:00:00+08:00",
        reviewAt: "2026-08-18T10:00:00+08:00",
        createdAt: now,
        updatedAt: now,
      },
    ];
    const judgments = [
      {
        id: 33,
        publicId: "judgment-33",
        propositionId: 22,
        statementMarkdown: "短期现金流承压已确认；长期回报仍取决于利用率与单位推理成本",
        state: "current",
        confidence: 68,
        changeReason: "供给受限与客户扩节奏放缓，但单位推理成本下降趋势仍在",
        effectiveAt: "2026-07-28T10:00:00+08:00",
        createdAt: now,
      },
      {
        id: 32,
        publicId: "judgment-32",
        propositionId: 21,
        statementMarkdown: "中期来看，AI 资本开支可在规模效应下实现正回报",
        state: "证据冲突",
        confidence: 58,
        changeReason: "云业务增速回落",
        effectiveAt: "2026-07-10T10:00:00+08:00",
        createdAt: "2026-07-10T10:00:00+08:00",
      },
      {
        id: 31,
        publicId: "judgment-31",
        propositionId: 21,
        statementMarkdown: "尚未形成明确判断",
        state: "初始判断",
        confidence: 50,
        changeReason: "",
        effectiveAt: "2026-06-20T10:00:00+08:00",
        createdAt: "2026-06-20T10:00:00+08:00",
      },
    ];
    const evidence = [
      {
        id: 41,
        publicId: "evidence-41",
        sourceItemId: 101,
        propositionId: 21,
        sourceTitle: "GPU 供给与云业务数据",
        contentMarkdown: "头部厂商推理调用量持续增长",
        stance: "support",
        credibility: 86,
        verificationStatus: "verified",
        validityStatus: "active",
        locatorJson: "{\"kind\":\"markdown_heading\",\"value\":\"关键数据\"}",
        locatorLabel: "Markdown 标题：关键数据",
        confirmedAt: "2026-07-20T10:00:00+08:00",
        validFrom: "2026-07-20T10:00:00+08:00",
        validUntil: "2026-08-30T10:00:00+08:00",
        reviewAt: "2026-08-20T10:00:00+08:00",
        createdAt: now,
      },
      {
        id: 42,
        publicId: "evidence-42",
        sourceItemId: 102,
        propositionId: 21,
        sourceTitle: "单位推理成本跟踪",
        contentMarkdown: "单位推理成本季度环比下降",
        stance: "oppose",
        credibility: 74,
        verificationStatus: "verified",
        validityStatus: "active",
        locatorJson: "{\"kind\":\"page\",\"value\":\"8\"}",
        locatorLabel: "PDF 第 8 页",
        confirmedAt: "2026-07-22T10:00:00+08:00",
        validFrom: "2026-07-22T10:00:00+08:00",
        validUntil: null,
        reviewAt: null,
        createdAt: now,
      },
      {
        id: 43,
        publicId: "evidence-43",
        sourceItemId: 103,
        propositionId: 22,
        sourceTitle: "FCF 追踪报告",
        contentMarkdown: "自由现金流率转负",
        stance: "support",
        credibility: 92,
        verificationStatus: "verified",
        validityStatus: "possibly_outdated",
        locatorJson: "{\"kind\":\"page\",\"value\":\"3\"}",
        locatorLabel: "PDF 第 3 页",
        confirmedAt: "2026-07-23T10:00:00+08:00",
        validFrom: "2026-07-23T10:00:00+08:00",
        validUntil: "2026-08-05T10:00:00+08:00",
        reviewAt: "2026-08-05T10:00:00+08:00",
        createdAt: now,
      },
      {
        id: 44,
        publicId: "evidence-44",
        sourceItemId: 104,
        propositionId: 22,
        sourceTitle: "AI 产品定价纪要",
        contentMarkdown: "AI 产品定价逐步优化",
        stance: "oppose",
        credibility: 68,
        verificationStatus: "unverified",
        validityStatus: "active",
        locatorJson: "{\"kind\":\"message\",\"value\":\"m-12\"}",
        locatorLabel: "消息 m-12",
        confirmedAt: null,
        validFrom: null,
        validUntil: null,
        reviewAt: null,
        createdAt: now,
      },
    ];
    const decision = {
      id: 51,
      publicId: "decision-51",
      topicId: topic.id,
      propositionId: 22,
      judgmentSnapshotId: 33,
      title: "维持中性观望",
      decisionMarkdown: "现金流压力未缓解，关注利用率拐点与成本曲线变化。",
      decidedAt: "2026-07-28T10:00:00+08:00",
      status: "active",
      knownRisks: ["需求不及预期", "供给继续受限"],
      expectedResult: "观察两个季度的利用率与自由现金流改善",
      actualActions: ["跟踪 GPU 供给与交付节奏", "追踪云业务盈利数据", "验证单位推理成本下降曲线"],
      reviewAt: "2026-08-28T10:00:00+08:00",
      resultStatus: "in_progress",
      finalResult: "",
      retrospective: "",
      createdAt: now,
      updatedAt: now,
    };
    const detail = {
      topic,
      sources: [
        {
          id: 101,
          publicId: "source-101",
          title: "GPU 供给与云业务数据",
          sourceType: "pdf",
          originalAt: now,
          importedAt: now,
          confidence: 92,
        },
      ],
      judgments,
      evidence,
      questions: [
        {
          id: 61,
          publicId: "question-61",
          question: "推理成本下降能否抵消价格竞争？",
          importance: "high",
          affectsCurrentJudgment: true,
          status: "open",
          resolutionNote: "",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 62,
          publicId: "question-62",
          question: "AI 产品的 ARPU 上行空间有多大？",
          importance: "medium",
          affectsCurrentJudgment: true,
          status: "open",
          resolutionNote: "",
          createdAt: now,
          updatedAt: now,
        },
      ],
      notes: [
        {
          id: 71,
          publicId: "note-71",
          title: "管理层电话会备注",
          bodyMarkdown: "关注利用率与自由现金流。",
          summary: "关注利用率",
          noteType: "research",
          status: "active",
          organizationState: "organized",
          primaryTopicId: topic.id,
          relatedTopicIds: [relatedTopic.id],
          sourceItemIds: [101],
          createdAt: now,
          updatedAt: now,
        },
      ],
      propositions: hypotheses,
      decisions: [decision],
      turningPoints: [
        {
          id: 81,
          publicId: "turning-81",
          topicId: topic.id,
          fromJudgmentId: 32,
          fromStatementMarkdown: judgments[1].statementMarkdown,
          toJudgmentId: 33,
          toStatementMarkdown: judgments[0].statementMarkdown,
          title: "现金流证据改变判断",
          explanation: "自由现金流率转负，长期回报假设需要继续验证。",
          occurredAt: "2026-07-28T10:00:00+08:00",
          createdAt: now,
        },
      ],
      relations: [],
    };
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
        invoke: async (command: string, args?: Record<string, unknown>) => {
          if (command === "plugin:event|listen") return 1;
          if (command === "plugin:event|unlisten") return null;
          if (command === "list_record_summaries") {
            const query = args?.query as { deletedOnly?: boolean } | undefined;
            return recordSummaries
              .filter((item) => query?.deletedOnly
                ? trashedRecordIds.has(item.id)
                : !trashedRecordIds.has(item.id))
              .map((item) => ({
                ...item,
                isDeleted: trashedRecordIds.has(item.id),
                deletedAt: trashedRecordIds.has(item.id) ? now : null,
              }));
          }
          if (command === "list_tags") return [];
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
          if (command === "list_knowledge_source_archive") {
            return sourceArchiveItems.filter((item) => !trashedRecordIds.has(item.legacyRecordId));
          }
          if (command === "count_knowledge_source_archive") {
            return sourceArchiveItems.filter((item) => !trashedRecordIds.has(item.legacyRecordId)).length;
          }
          if (command === "list_knowledge_source_collections") return [];
          if (command === "search_knowledge_source_archive") {
            const query = String(args?.query ?? "").toLocaleLowerCase("zh-CN");
            return sourceArchiveItems.filter((item) => (
              !trashedRecordIds.has(item.legacyRecordId)
              && [
                item.title,
                item.platform,
                item.sourceType,
                item.primaryTopicName,
                item.legacyRecordId === 901 ? "头部厂商推理调用量持续增长" : "用于列表快速定位与滚动合同验证",
              ]
                .some((value) => String(value ?? "").toLocaleLowerCase("zh-CN").includes(query))
            ));
          }
          if (command === "update_knowledge_source_title") {
            const sourceItemId = Number(args?.input?.sourceItemId);
            const title = String(args?.input?.title ?? "").trim();
            const source = sourceArchiveItems.find((item) => item.id === sourceItemId);
            if (!source || !title) throw new Error("标题更新参数无效");
            source.title = title;
            const record = recordSummaries.find((item) => item.id === source.legacyRecordId);
            if (record) {
              record.title = title;
              record.displayTitle = title;
              record.sourceTitle = title;
            }
            return {
              sourceItemId,
              legacyRecordId: source.legacyRecordId,
              title,
              updatedAt: now,
            };
          }
          if (command === "list_knowledge_source_attachments") return [];
          if (command === "list_knowledge_inbox") return [];
          if (command === "list_knowledge_classification_run_source_ids") return [];
          if (command === "apply_personal_topic_catalog") {
            return {
              version: "knowledge-final-view-fixture-v1",
              createdDomains: 0,
              existingDomains: 1,
              createdTopics: 0,
              existingTopics: 2,
              createdAliases: 0,
              createdEntities: 0,
              createdRules: 0,
              deletedRules: 0,
            };
          }
          if (command === "get_knowledge_source_original_text") {
            return "# GPU 供给与云业务数据\n\n## 关键数据\n\n头部厂商推理调用量持续增长。\n";
          }
          if (command === "move_to_trash") {
            const recordId = Number(args?.recordId);
            trashedRecordIds.add(recordId);
            const summary = recordSummaries.find((item) => item.id === recordId) ?? recordSummary;
            return {
              id: summary.id,
              title: summary.title,
              summary: summary.summary,
              status: summary.status,
              tags: [],
              currentJudgment: "",
              confirmedFacts: [],
              keyEvidence: [],
              openQuestions: [],
              nextActions: [],
              notes: "",
              sourceText: "",
              sources: [],
              isFavorite: summary.isFavorite,
              isDeleted: true,
              originalAt: summary.originalAt,
              createdAt: summary.createdAt,
              updatedAt: now,
              deletedAt: now,
              versionCount: summary.versionCount,
            };
          }
          if (command === "list_knowledge_classification_suggestions") {
            return [{
              id: 201,
              publicId: "suggestion-201",
              sourceItemId: sourceArchiveItem.id,
              suggestedTopicId: topic.id,
              score: 92,
              decision: "auto_eligible",
              reasons: ["主题名称与来源标题直接匹配", "规则命中：GPU 与云业务"],
              signalScoresJson: "{\"title\":0.92}",
              classifierVersion: "local-rules-v7",
              status: "accepted",
              createdAt: now,
            }];
          }
          if (command === "list_knowledge_domains") return [domain];
          if (command === "list_knowledge_topics") return [topic, relatedTopic];
          if (command === "get_personal_topic_catalog_proposal") {
            return {
              version: "knowledge-final-view-fixture-v1",
              status: "proposal",
              title: "隔离视觉合同目录",
              note: "只用于浏览器布局验证",
              domains: [],
              topics: [],
            };
          }
          if (command === "list_knowledge_classification_rules") {
            return [{
              id: 301,
              publicId: "rule-301",
              ruleType: "keyword",
              pattern: "GPU",
              targetDomainId: domain.id,
              targetTopicId: topic.id,
              weight: 0.9,
              priority: 100,
              enabled: true,
              configJson: "{\"managedBy\":\"knowledge-final-view-fixture-v1\"}",
              createdAt: now,
              updatedAt: now,
            }, {
              id: 302,
              publicId: "catalog-rule-ai-capex-negative_keyword-0",
              ruleType: "negative_keyword",
              pattern: "招聘启事",
              targetDomainId: domain.id,
              targetTopicId: topic.id,
              weight: 0.55,
              priority: 0,
              enabled: true,
              configJson: "{\"managedBy\":\"knowledge-final-view-fixture-v1\"}",
              createdAt: now,
              updatedAt: now,
            }];
          }
          if ([
            "list_knowledge_topic_aliases",
            "list_knowledge_entities",
          ].includes(command)) return [];
          if (command === "suggest_knowledge_topic_relations") {
            return [{
              fromTopicId: topic.id,
              fromTopicName: topic.name,
              toTopicId: relatedTopic.id,
              toTopicName: relatedTopic.name,
              relationType: "related",
              confidence: 78,
              reason: "来源共同提及云厂商资本开支与算力供给",
            }];
          }
          if (command === "create_knowledge_topic_relation") {
            return {
              id: 401,
              fromTopicId: topic.id,
              toTopicId: relatedTopic.id,
              relationType: "related",
              confidence: 78,
              createdBy: "user",
              note: "来源共同提及云厂商资本开支与算力供给",
              createdAt: now,
            };
          }
          if (command === "get_knowledge_topic_detail") return structuredClone(detail);
          throw new Error(`未模拟的 Tauri 命令：${command}`);
        },
      },
    });
  });

  const openKnowledgeView = async () => {
    await page.getByRole("button", { name: /知识视图/ }).click();
    await expect(page.getByRole("heading", { name: "AI 资本开支", exact: true })).toBeVisible();
  };

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await openKnowledgeView();

  const overview = page.locator(".knowledge-overview");
  await expect(overview).toBeVisible();
  await expect(overview.getByText("短期现金流承压已确认；长期回报仍取决于利用率与单位推理成本", { exact: true }))
    .toBeVisible();
  await expect(overview.getByText("事实与线索", { exact: true })).toBeVisible();
  await expect(overview.getByText("关键证据", { exact: true })).toBeVisible();
  await expect(overview.getByText("待验证问题", { exact: true })).toBeVisible();
  await expect(overview.getByText("建议下一步", { exact: true })).toBeVisible();
  await overview.locator(".knowledge-overview-card.evidence").getByRole("button", { name: "查看全部" }).click();
  const overviewDialog = page.getByRole("dialog", { name: "关键证据" });
  await expect(overviewDialog).toBeVisible();
  await expect(overviewDialog.locator(".knowledge-overview-dialog-list li")).toHaveCount(3);
  const dialogReadingLayout = await overviewDialog.evaluate((dialog) => {
    const list = dialog.querySelector(".knowledge-overview-dialog-list");
    const text = dialog.querySelector(".knowledge-overview-dialog-list p");
    if (!list || !text) return null;
    const styles = window.getComputedStyle(text);
    return {
      scrollable: list.scrollHeight >= list.clientHeight,
      wraps: styles.whiteSpace !== "nowrap" && styles.textOverflow !== "ellipsis",
    };
  });
  expect(dialogReadingLayout).toEqual({ scrollable: true, wraps: true });
  await page.keyboard.press("Escape");
  await expect(overviewDialog).toBeHidden();
  const overviewLayout = await page.evaluate(() => {
    const summary = document.querySelector(".knowledge-overview");
    const tabs = document.querySelector(".knowledge-final-tabs");
    const reader = document.querySelector(".knowledge-final-reader");
    if (!summary || !tabs || !reader) return null;
    const summaryRect = summary.getBoundingClientRect();
    const tabsRect = tabs.getBoundingClientRect();
    return {
      viewport: [window.innerWidth, window.innerHeight],
      visibleWithoutScroll: summaryRect.top >= 0 && summaryRect.bottom <= window.innerHeight,
      beforeTabs: summaryRect.bottom <= tabsRect.top,
      noHorizontalOverflow: reader.scrollWidth <= reader.clientWidth,
    };
  });
  expect(overviewLayout).toEqual({
    viewport: [1702, 1066],
    visibleWithoutScroll: true,
    beforeTabs: true,
    noHorizontalOverflow: true,
  });
  await page.screenshot({
    path: resolve(evidenceDirectory, "knowledge-auto-overview-above-fold-1702x1066.png"),
    fullPage: false,
  });

  const hypothesesTab = page.getByRole("tab", { name: /竞争假设/ });
  const evolutionTab = page.getByRole("tab", { name: /判断演变/ });
  const sourcesTab = page.getByRole("tab", { name: /笔记与来源/ });
  const decisionsTab = page.getByRole("tab", { name: /决策版本/ });
  await expect(hypothesesTab).toHaveAttribute("aria-selected", "true");
  await expect(evolutionTab).toHaveAttribute("aria-selected", "false");
  await expect(page.locator(".knowledge-final-hypothesis").getByText(
    "规模效应兑现，利润率回升",
    { exact: true },
  )).toBeVisible();
  await expect(page.locator(".knowledge-final-hypothesis").getByText(
    "投入回收期过长，现金流承压",
    { exact: true },
  )).toBeVisible();
  await expect(page.getByRole("button", { name: /知识视图/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /知识视图/ }).locator(".lucide-book-open"))
    .toBeVisible();
  await expect(page.getByText("建立领域与主题", { exact: true })).toBeHidden();

  // 在统一的 1702×1066 视口先核对两入口实际消费同一中栏结构。
  await page.getByRole("button", { name: /主题管理/ }).click();
  const sharedTopicHierarchy = page.locator(".topic-final-browser > .knowledge-final-tree-card");
  await expect(sharedTopicHierarchy).toBeVisible();
  await expect(page.locator(".topic-final-browser .knowledge-final-domain-heading").first()).toBeVisible();
  await expect(page.locator(".topic-final-browser .topic-final-tree")).toHaveCount(0);
  const sharedHierarchyLayout = await page.evaluate(() => {
    const card = document.querySelector(".topic-final-browser > .knowledge-final-tree-card");
    const tree = card?.querySelector(".knowledge-final-tree");
    const selected = tree?.querySelector("button.active");
    if (!card || !tree || !selected) return null;
    const cardRect = card.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    return {
      viewport: [window.innerWidth, window.innerHeight],
      treeOverflowY: getComputedStyle(tree).overflowY,
      noHorizontalOverflow: tree.scrollWidth <= tree.clientWidth,
      selectedInsideCard: selectedRect.top >= cardRect.top && selectedRect.bottom <= cardRect.bottom,
    };
  });
  expect(sharedHierarchyLayout).toEqual({
    viewport: [1702, 1066],
    treeOverflowY: "auto",
    noHorizontalOverflow: true,
    selectedInsideCard: true,
  });
  await page.screenshot({
    path: resolve(evidenceDirectory, "topic-shared-knowledge-hierarchy-1702x1066.png"),
    fullPage: false,
  });
  await openKnowledgeView();

  await page.getByRole("tab", { name: /笔记与来源/ }).click();
  await expect(page.locator(".knowledge-final-source-mode")).toBeVisible();
  await expect(page.locator(".knowledge-final-source-mode").getByText(
    "管理层电话会备注",
    { exact: true },
  ).first()).toBeVisible();
  await expect(page.locator(".knowledge-final-source-mode").getByText(
    "关注利用率与自由现金流。",
    { exact: true },
  )).toBeVisible();
  await page.screenshot({
    path: resolve(evidenceDirectory, "desert-lantern-notes-and-sources.png"),
    fullPage: false,
  });

  await page.getByRole("tab", { name: /决策版本/ }).click();
  const decisionMode = page.locator(".knowledge-final-decisions-mode");
  await expect(decisionMode.getByText("决策版本概览", { exact: true })).toHaveCount(0);
  await expect(decisionMode.getByText("决策版本 1", { exact: true })).toBeVisible();
  await expect(decisionMode.getByText("已知风险", { exact: true })).toBeVisible();
  await expect(decisionMode.getByText(
    "观察两个季度的利用率与自由现金流改善",
    { exact: true },
  ).first()).toBeVisible();

  await hypothesesTab.click();
  await page.getByRole("button", {
    name: /GPU 供给与云业务数据 · Markdown 标题：关键数据/,
  }).click();
  await expect(page.getByRole("heading", { name: "来源档案", exact: true })).toHaveCount(0);
  await expect(page.locator(".source-page-actions-only")).toBeVisible();
  await expect(page.getByText("原始来源与自动整理结果", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/已加载 \d+ 条有效来源/)).toHaveCount(0);
  await expect(page.locator(".knowledge-detail-heading").getByRole(
    "heading",
    { name: "GPU 供给与云业务数据", exact: true },
  )).toBeVisible();
  await expect(page.locator(".source-anchor-highlight")).toContainText("关键数据");
  await expect(page.getByRole("button", { name: /返回主题来源/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /查看详情/ })).toBeVisible();
  const sourceDetailActionLayout = await page.evaluate(() => {
    const heading = document.querySelector(".knowledge-detail-heading");
    const title = heading?.querySelector("h2");
    const actions = heading?.querySelector(".knowledge-detail-actions");
    const buttons = actions ? [...actions.querySelectorAll("button")] : [];
    if (!heading || !title || !actions || buttons.length < 2) return null;
    const headingRect = heading.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    return {
      actionTopOffset: actionsRect.top - headingRect.top,
      titleAlignmentDelta: Math.abs(actionsRect.top - titleRect.top),
      gap: getComputedStyle(actions).columnGap,
      buttons: buttons.slice(0, 2).map((button) => {
        const rect = button.getBoundingClientRect();
        const icon = button.querySelector("svg");
        return {
          height: rect.height,
          fontSize: getComputedStyle(button).fontSize,
          iconWidth: icon?.getBoundingClientRect().width ?? 0,
        };
      }),
    };
  });
  expect(sourceDetailActionLayout).not.toBeNull();
  expect(sourceDetailActionLayout!.actionTopOffset).toBeGreaterThanOrEqual(22);
  expect(sourceDetailActionLayout!.titleAlignmentDelta).toBeLessThanOrEqual(3);
  expect(sourceDetailActionLayout!.gap).toBe("6px");
  for (const button of sourceDetailActionLayout!.buttons) {
    expect(button.height).toBeGreaterThanOrEqual(29);
    expect(button.height).toBeLessThanOrEqual(31);
    expect(button.fontSize).toBe("12px");
    expect(button.iconWidth).toBe(13);
  }
  await page.screenshot({
    path: resolve(evidenceDirectory, "source-detail-actions-compact-aligned-1702x1066.png"),
    fullPage: false,
  });

  const sourceSearchLayout = await page.evaluate(() => {
    const filters = document.querySelector(".knowledge-source-filters");
    const searchRow = document.querySelector(".knowledge-source-search-wrap > input");
    const tabs = document.querySelector(".source-filter-tabs");
    if (!filters || !searchRow || !tabs) return null;
    const filterRect = filters.getBoundingClientRect();
    const searchRect = searchRow.getBoundingClientRect();
    const tabsRect = tabs.getBoundingClientRect();
    return {
      widthRatio: searchRect.width / filterRect.width,
      searchAboveTabs: searchRect.bottom <= tabsRect.top + 1,
    };
  });
  // 搜索框与筛选、显示工具栏共用左栏，只防止其被挤压消失，不再锁死旧版 65% 比例。
  expect(sourceSearchLayout?.widthRatio).toBeGreaterThan(0.25);
  expect(sourceSearchLayout?.searchAboveTabs).toBe(true);
  const archiveSearch = page.getByLabel("搜索全部来源档案和正文");
  await archiveSearch.fill("调用量");
  await archiveSearch.press("Enter");
  await expect(page.locator(".knowledge-inbox-list").getByText(
    "GPU 供给与云业务数据",
    { exact: true },
  )).toBeVisible();
  await archiveSearch.fill("");
  await archiveSearch.focus();
  await expect(page.getByRole("option", { name: "调用量" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /已全部加载|全部加载/ })).toBeVisible();
  await expect(page.locator(".knowledge-source-list-item.active")).toBeVisible();
  const sourceOcclusionContract = await page.evaluate(() => {
    const filters = document.querySelector(".knowledge-source-filters");
    const active = document.querySelector(".knowledge-source-list-item.active");
    if (!filters || !active) return null;
    return {
      filterZIndex: Number(getComputedStyle(filters).zIndex),
      activeZIndex: Number(getComputedStyle(active).zIndex),
    };
  });
  expect(sourceOcclusionContract?.filterZIndex).toBeGreaterThan(
    sourceOcclusionContract?.activeZIndex ?? Number.POSITIVE_INFINITY,
  );

  const sourceLocator = page.getByLabel("拖动快速定位来源");
  await expect(sourceLocator).toBeVisible();
  await sourceLocator.fill("2");
  await expect(page.locator(".knowledge-detail-heading").getByRole(
    "heading",
    { name: "GPU 供给与云业务数据", exact: true },
  )).toBeVisible();

  const activeSourceCard = page.locator(".knowledge-source-list-item.active");
  await activeSourceCard.hover();
  await expect(activeSourceCard.getByRole("button", { name: "收藏", exact: true })).toBeVisible();
  await expect(activeSourceCard.getByRole("button", { name: "导出完整笔记", exact: true })).toBeVisible();
  await page.waitForTimeout(220);
  await page.screenshot({
    path: resolve(evidenceDirectory, "source-list-hover-actions.png"),
    fullPage: false,
  });
  const sourceActionGeometry = await page.evaluate(() => {
    const card = document.querySelector(".knowledge-source-list-item.active");
    const actions = card?.querySelector(".unified-note-actions");
    if (!card || !actions) return null;
    const cardRect = card.getBoundingClientRect();
    const actionRect = actions.getBoundingClientRect();
    return {
      centerDelta: Math.abs(
        (cardRect.top + cardRect.height / 2) - (actionRect.top + actionRect.height / 2),
      ),
      staysInsideRightEdge: actionRect.right <= cardRect.right + 1,
      cardHeight: cardRect.height,
    };
  });
  expect(sourceActionGeometry?.centerDelta).toBeLessThan(3);
  expect(sourceActionGeometry?.staysInsideRightEdge).toBe(true);
  expect(sourceActionGeometry?.cardHeight).toBeLessThan(110);
  await activeSourceCard.getByRole("button", { name: "更多", exact: true }).click();
  const sourceMenu = page.getByRole("menu");
  await expect(sourceMenu.getByRole("menuitem", { name: "查看详情" })).toBeVisible();
  await expect(sourceMenu.getByRole("menuitem", { name: /持续跟踪/ })).toBeVisible();
  await expect(sourceMenu.getByRole("menuitem", { name: "复制标题" })).toBeVisible();
  await expect(sourceMenu.getByRole("menuitem", { name: "移入回收站" })).toBeVisible();
  await page.screenshot({
    path: resolve(evidenceDirectory, "source-list-action-menu.png"),
    fullPage: false,
  });
  await page.locator(".source-page-actions-only").click({ position: { x: 4, y: 4 } });
  await expect(sourceMenu).toBeHidden();

  await page.getByRole("button", { name: "修改笔记标题", exact: true }).click();
  const titleEditor = page.getByLabel("修改笔记标题");
  await titleEditor.fill("GPU 供给与云业务数据（已校正）");
  await titleEditor.press("Enter");
  await expect(page.locator(".knowledge-detail-heading").getByRole(
    "heading",
    { name: "GPU 供给与云业务数据（已校正）", exact: true },
  )).toBeVisible();
  await page.getByRole("button", { name: "修改笔记标题", exact: true }).click();
  await page.getByLabel("修改笔记标题").fill("GPU 供给与云业务数据");
  await page.getByLabel("修改笔记标题").press("Enter");

  await expect(page.getByLabel("搜索来源正文")).toBeVisible();
  await expect(page.getByRole("button", { name: "搜索", exact: true })).toBeVisible();
  await expect(page.getByText("正文预览", { exact: true })).toHaveCount(0);
  const sourceHeaderActions = page.locator(".knowledge-header-actions");
  await expect(sourceHeaderActions.locator(":scope > button")).toHaveCount(1);
  await expect(sourceHeaderActions.locator(":scope > svg")).toHaveCount(0);
  await expect(page.getByText("笔记标题已更新", { exact: true })).toBeHidden({ timeout: 5_000 });
  await page.screenshot({
    path: resolve(evidenceDirectory, "desert-lantern-source-archive.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: /返回主题来源/ }).click();
  await expect(page.getByRole("heading", { name: "AI 资本开支", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: /笔记与来源/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".knowledge-final-source-list button.active")).toContainText("GPU 供给与云业务数据");

  await page.getByRole("button", { name: /主题管理/ }).click();
  await expect(page.getByRole("heading", { name: /AI 资本开支/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "编辑主题", exact: true })).toHaveCount(0);
  await expect(page.locator(".topic-final-browser > .knowledge-final-tree-card")).toBeVisible();
  await expect(page.locator(".topic-final-browser .knowledge-final-domain-heading").first()).toBeVisible();
  await expect(page.locator(".topic-final-browser .topic-final-tree")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /进入主题管理/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /全局检查/ })).toHaveCount(0);
  await expect(page.getByText("检查空主题", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/尚无正式来源，需要检查/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "层级与关联", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "主题层级", exact: true })).toHaveCount(0);
  await expect(page.getByText("自动排除", { exact: true })).toBeVisible();
  await expect(page.locator(".topic-boundary .exclude li")).toHaveText("招聘启事");
  await expect(page.getByText(/系统用于避免相似关键词误归类，不会删除来源/)).toBeVisible();
  await expect(page.getByText("排除范围", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /补充排除规则|调整排除规则|维护/ })).toHaveCount(0);
  await expect(page.getByText("补充分类依据", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: resolve(evidenceDirectory, "topic-empty-autonomous-disposition-1702x1066.png"),
    fullPage: false,
  });
  await expect(page.getByText("建议关联：云服务", { exact: true })).toBeVisible();
  await page.getByText("建议关联：云服务", { exact: true }).locator("..")
    .getByRole("button", { name: "应用", exact: true })
    .click();
  await expect(page.getByText("建议关联：云服务", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "添加别名", exact: true }).click();
  await expect(page.getByRole("heading", { name: "主题管理", exact: true })).toBeVisible();
  const structureCard = page.locator(".knowledge-tree-card");
  const structureHeaderActions = structureCard.locator(".knowledge-tree-card-actions");
  await expect(structureHeaderActions.locator(":scope > button")).toHaveCount(1);
  await expect(structureHeaderActions.getByRole("button", { name: "编辑", exact: true })).toBeVisible();
  await expect(structureCard.locator(".knowledge-domain-actions")).toHaveCount(0);
  await expect(structureCard.locator(".knowledge-topic-row-actions")).toHaveCount(0);

  await structureHeaderActions.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(structureHeaderActions.getByRole("button", { name: "完成编辑", exact: true })).toBeVisible();
  const firstMaintenanceDomain = structureCard.locator(".knowledge-domain").first();
  const firstDomainActions = firstMaintenanceDomain.locator(".knowledge-domain-actions");
  await expect(firstDomainActions.getByRole("button", { name: "添加主题", exact: true })).toBeVisible();
  await expect(firstDomainActions.getByRole("button", { name: "编辑领域", exact: true })).toBeVisible();
  const firstTopicActions = firstMaintenanceDomain.locator(".knowledge-topic-row-actions").first();
  await expect(firstTopicActions.getByRole("button", { name: "添加子主题", exact: true })).toBeVisible();
  await expect(firstTopicActions.getByRole("button", { name: "编辑主题", exact: true })).toBeVisible();
  await expect(structureCard.getByRole("button", { name: "添加领域", exact: true })).toBeVisible();

  await firstDomainActions.getByRole("button", { name: "编辑领域", exact: true }).click();
  const editDomainDialog = page.locator('[data-topic-structure-dialog="edit-domain"]');
  await expect(editDomainDialog).toBeVisible();
  await expect(editDomainDialog.getByLabel("领域名称")).toBeVisible();
  await expect(structureCard.locator(".knowledge-inline-structure-editor")).toHaveCount(0);
  await editDomainDialog.getByRole("button", { name: "关闭", exact: true }).click();

  await firstDomainActions.getByRole("button", { name: "添加主题", exact: true }).click();
  const createTopicDialog = page.locator('[data-topic-structure-dialog="create-topic"]');
  await expect(createTopicDialog).toBeVisible();
  await expect(createTopicDialog.getByText("领域顶层", { exact: true })).toBeVisible();
  await createTopicDialog.getByRole("button", { name: "关闭", exact: true }).click();

  await firstTopicActions.getByRole("button", { name: "添加子主题", exact: true }).click();
  await expect(page.locator('[data-topic-structure-dialog="create-topic"]')).toBeVisible();
  await expect(page.locator(".topic-structure-dialog-context").getByText("领域顶层", { exact: true })).toHaveCount(0);
  await page.locator('[data-topic-structure-dialog="create-topic"]').getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.getByRole("heading", { name: "主题别名", exact: true })).toBeVisible();

  const maintenanceOverlay = page.locator(".topic-reading-page > .knowledge-secondary-maintenance[open]");
  const maintenanceReturn = maintenanceOverlay.locator(":scope > summary");
  const maintenanceScrollBody = maintenanceOverlay.locator(".knowledge-secondary-maintenance-body");
  await expect(maintenanceOverlay).toHaveCSS("overflow", "hidden");
  const maintenanceGeometry = await page.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>(
      ".topic-reading-page > .knowledge-secondary-maintenance[open]",
    );
    const control = overlay?.querySelector<HTMLElement>(":scope > summary");
    const body = overlay?.querySelector<HTMLElement>(".knowledge-secondary-maintenance-body");
    if (!overlay || !control || !body) return null;
    const overlayBox = overlay.getBoundingClientRect();
    const controlBox = control.getBoundingClientRect();
    const bodyBox = body.getBoundingClientRect();
    return {
      overlayRight: overlayBox.right,
      controlRight: controlBox.right,
      controlBottom: controlBox.bottom,
      bodyTop: bodyBox.top,
      bodyScrollable: body.scrollHeight > body.clientHeight,
    };
  });
  expect(maintenanceGeometry).not.toBeNull();
  expect(maintenanceGeometry!.overlayRight - maintenanceGeometry!.controlRight).toBeGreaterThanOrEqual(38);
  expect(maintenanceGeometry!.bodyTop - maintenanceGeometry!.controlBottom).toBeGreaterThanOrEqual(8);
  expect(maintenanceGeometry!.bodyScrollable).toBe(true);

  const returnBoxBeforeScroll = await maintenanceReturn.boundingBox();
  const bodyBoxBeforeScroll = await maintenanceScrollBody.boundingBox();
  await maintenanceScrollBody.evaluate((element) => {
    element.scrollTop = Math.min(element.scrollHeight - element.clientHeight, 640);
    element.dispatchEvent(new Event("scroll"));
  });
  const returnBoxAfterScroll = await maintenanceReturn.boundingBox();
  const bodyBoxAfterScroll = await maintenanceScrollBody.boundingBox();
  expect(Math.abs((returnBoxAfterScroll?.x ?? 0) - (returnBoxBeforeScroll?.x ?? 0))).toBeLessThan(1);
  expect(Math.abs((returnBoxAfterScroll?.y ?? 0) - (returnBoxBeforeScroll?.y ?? 0))).toBeLessThan(1);
  expect(Math.abs((bodyBoxAfterScroll?.y ?? 0) - (bodyBoxBeforeScroll?.y ?? 0))).toBeLessThan(1);
  await expect(page.getByText("主题关系已写入", { exact: true })).toBeHidden({ timeout: 5_000 });
  await page.screenshot({
    path: resolve(evidenceDirectory, "topic-maintenance-fixed-return-1702x1066.png"),
    fullPage: false,
  });

  await openKnowledgeView();
  await evolutionTab.click();
  const layoutContract = await page.evaluate(() => {
    const root = document.documentElement;
    const tree = document.querySelector(".knowledge-final-tree");
    const reader = document.querySelector(".knowledge-final-scroll");
    const timeline = document.querySelector(".knowledge-final-timeline-scroll");
    const connector = document.querySelector(".knowledge-final-connector");
    return {
      noPageOverflow: root.scrollWidth <= root.clientWidth,
      treeOverflowY: tree ? getComputedStyle(tree).overflowY : "",
      readerOverflowY: reader ? getComputedStyle(reader).overflowY : "",
      timelineOverflowX: timeline ? getComputedStyle(timeline).overflowX : "",
      connectorWidth: connector?.getBoundingClientRect().width ?? 0,
      connectorColor: connector ? getComputedStyle(connector).backgroundColor : "",
    };
  });
  expect(layoutContract).toMatchObject({
    noPageOverflow: true,
    treeOverflowY: "auto",
    readerOverflowY: "auto",
    timelineOverflowX: "auto",
  });
  expect(layoutContract.connectorWidth).toBeGreaterThan(0);
  expect(layoutContract.connectorWidth).toBeLessThan(80);
  expect(layoutContract.connectorColor).toBe("rgb(255, 109, 37)");
  await page.screenshot({
    path: resolve(evidenceDirectory, "desert-lantern-evolution-layout.png"),
    fullPage: false,
  });

  await expect(evolutionTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("判断轨迹与本次变化", { exact: true })).toHaveCount(0);
  await expect(page.getByText("支撑材料", { exact: true })).toHaveCount(0);
  await expect(page.getByText("对照阅读", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "跨时期知识事件" })).toBeVisible();
  const evolutionSectionOrder = await page.locator(
    ".knowledge-final-evolution [data-reading-section]",
  ).evaluateAll((sections) => sections.map((section) => section.getAttribute("data-reading-section")));
  expect(evolutionSectionOrder).toEqual(["cross-time-evidence", "version-difference"]);
  await expect(page.getByRole("heading", { name: "决策版本（最新）" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
  await page.screenshot({
    path: resolve(evidenceDirectory, "desert-lantern-evolution.png"),
    fullPage: false,
  });

  const assertDirectModeContent = async (selector: string) => {
    const geometry = await page.evaluate((contentSelector) => {
      const scroll = document.querySelector<HTMLElement>(".knowledge-final-scroll");
      const content = document.querySelector<HTMLElement>(contentSelector);
      if (!scroll || !content) return null;
      const scrollBox = scroll.getBoundingClientRect();
      const contentBox = content.getBoundingClientRect();
      return {
        topGap: Math.round(contentBox.top - scrollBox.top),
        noHorizontalOverflow: scroll.scrollWidth <= scroll.clientWidth,
      };
    }, selector);
    expect(geometry).not.toBeNull();
    expect(geometry!.topGap).toBeGreaterThanOrEqual(12);
    expect(geometry!.topGap).toBeLessThanOrEqual(18);
    expect(geometry!.noHorizontalOverflow).toBe(true);
  };

  await hypothesesTab.click();
  await expect(page.getByText("命题选择", { exact: true })).toHaveCount(0);
  await expect(page.locator(".knowledge-final-hypothesis").first()).toBeVisible();
  await assertDirectModeContent(".knowledge-final-content-grid");
  await page.screenshot({
    path: resolve(evidenceDirectory, "knowledge-direct-hypotheses-1702x1066.png"),
    fullPage: false,
  });

  await evolutionTab.click();
  await assertDirectModeContent(".knowledge-final-evolution");
  await page.screenshot({
    path: resolve(evidenceDirectory, "knowledge-direct-evolution-1702x1066.png"),
    fullPage: false,
  });

  await sourcesTab.click();
  await expect(page.getByText("先读笔记，再回溯原始来源", { exact: true })).toHaveCount(0);
  await expect(page.getByText("阅读主体", { exact: true })).toHaveCount(0);
  await expect(page.locator(".knowledge-final-note-reader")).toBeVisible();
  await assertDirectModeContent(".knowledge-final-source-mode");
  await page.screenshot({
    path: resolve(evidenceDirectory, "knowledge-direct-sources-1702x1066.png"),
    fullPage: false,
  });

  await decisionsTab.click();
  await expect(page.getByText("完整链路", { exact: true })).toHaveCount(0);
  await expect(page.locator(".knowledge-final-decision-version").first()).toBeVisible();
  await assertDirectModeContent(".knowledge-final-decisions-mode");
  await page.screenshot({
    path: resolve(evidenceDirectory, "knowledge-direct-decisions-1702x1066.png"),
    fullPage: false,
  });

  const skins = [
    "desert-lantern",
    "florist-studio",
    "golden-horses",
    "classic",
  ];
  for (const skin of skins) {
    await page.evaluate((nextSkin) => {
      localStorage.setItem("nanfeng-knowledge-base:appearance-skin", nextSkin);
    }, skin);
    await page.reload();
    await openKnowledgeView();
    await expect(page.locator(".app-shell")).toHaveAttribute("data-skin", skin);
    await expect(page.getByRole("tab", { name: /竞争假设/ }))
      .toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".knowledge-final-hypothesis").getByText(
      "规模效应兑现，利润率回升",
      { exact: true },
    )).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    await page.screenshot({
      path: resolve(evidenceDirectory, `${skin}-hypotheses.png`),
      fullPage: false,
    });
  }

  await page.getByRole("button", { name: /来源档案/ }).click();
  await expect(page.locator(".knowledge-detail-heading").getByRole(
    "heading",
    { name: "GPU 供给与云业务数据", exact: true },
  )).toBeVisible();
  const trashTargetCard = page.locator(".knowledge-source-list-item.active");
  await trashTargetCard.hover();
  await trashTargetCard.getByRole("button", { name: "更多", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("menuitem", { name: "移入回收站", exact: true }).click();
  await expect(page.locator(".knowledge-inbox-list").getByText(
    "GPU 供给与云业务数据",
    { exact: true },
  )).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "单位推理成本跟踪", exact: true })).toBeVisible();

  expect(failedResources).toEqual([]);
  expect(browserErrors).toEqual([]);
});
