import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const evidenceDirectory = resolve(".runtime-qa", "knowledge-final-layout-evidence");

test.beforeAll(async () => {
  await mkdir(evidenceDirectory, { recursive: true });
});

test("主题洞察默认竞争假设，可稳定切换判断演变并保持五套皮肤结构一致", async ({ page }) => {
  test.setTimeout(180_000);
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
      // 已应用修订会在应用时同步正式领域名称；夹具也必须反映这一原子结果，
      // 不能以遗留领域名伪造“已应用”的状态。
      name: "投资研究",
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
      ...Array.from({ length: 12 }, (_, index) => ({
        ...sourceArchiveItem,
        id: 104 + index,
        publicId: `source-${104 + index}`,
        legacyRecordId: 904 + index,
        title: `来源滚动定位样本 ${index + 1}`,
        originalAt: `2026-07-${String(8 + index).padStart(2, "0")}T10:00:00+08:00`,
        importedAt: `2026-07-${String(9 + index).padStart(2, "0")}T10:00:00+08:00`,
      })),
    ];
    const aiTestWindow = window as typeof window & {
      __aiRunTopicIds?: number[];
      __aiFailTopicId?: number | null;
      __aiDelayMs?: number;
      __aiTaxonomyMode?: "applied" | "empty" | "draft";
      __aiTaxonomyResume?: boolean;
      __aiTaxonomyResumeUsed?: string | null;
    };
    aiTestWindow.__aiRunTopicIds = [];
    aiTestWindow.__aiFailTopicId = null;
    aiTestWindow.__aiDelayMs = 120;
    aiTestWindow.__aiTaxonomyMode = "applied";
    aiTestWindow.__aiTaxonomyResume = false;
    aiTestWindow.__aiTaxonomyResumeUsed = null;
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
      isFavorite: index === 0,
    }));
    const recordDetails = recordSummaries.map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      status: item.status,
      tags: item.tags,
      currentJudgment: "仅作旧数据兼容，不再在来源记录详情展示。",
      confirmedFacts: [],
      keyEvidence: [],
      openQuestions: [],
      nextActions: [],
      notes: "",
      sourceText: `# ${item.title}\n\n${item.summary}\n\n这是用于验证全部笔记阅读格式的正文。`,
      sources: [{
        id: item.id * 10,
        recordId: item.id,
        sourceType: "markdown",
        title: item.sourceTitle,
        url: null,
        localPath: null,
        externalId: null,
        createdAt: item.createdAt,
      }],
      isFavorite: item.isFavorite,
      isDeleted: item.isDeleted,
      originalAt: item.originalAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      deletedAt: item.deletedAt,
      versionCount: item.versionCount,
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
    const relatedSourceTitles = [
      "GPU 供给与云业务数据",
      "账户批量导入金关系",
      "雪盈账号身份更新",
      "盈透银行身份更新问题",
      "订阅内容分析总结",
      "查看盈透报表路径",
      "盈透账户税务处理",
      "跨境券商整治下的账户策略调整",
      "境内券商监管分析",
      "不注资影响分析",
      "关闭 uSMART 结单邮件推送",
      "香港开户风险分析",
      "西九龙站开户流程与长桥人才流失",
      "跨境券商监管风险与账户迁移决策",
      "券商价格管理算法设置指南",
      "盈透雪盈账户安全建议",
      "美股税务与持仓结构复盘",
      "长期账户风险监测记录",
      "跨市场交易成本比较",
      "年度投资账户整理计划",
    ];
    const relatedSources = relatedSourceTitles.map((title, index) => ({
      id: 101 + index,
      publicId: `source-${101 + index}`,
      title,
      sourceType: index === 0 ? "pdf" : "file",
      originalAt: now,
      importedAt: now,
      confidence: 92 - (index % 7) * 4,
      contentText: index === 0
        ? "# GPU 供给与云业务数据\n\n头部厂商推理调用量持续增长。"
        : `# ${title}\n\n这是用于验证关联笔记完整卡片与独立滚动的来源正文。`,
    }));
    const detail = {
      topic,
      sources: relatedSources,
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
    (window as typeof window & { __knowledgeSourceActionDataDelayMs?: number })
      .__knowledgeSourceActionDataDelayMs = 0;
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
          if (command === "get_resumable_ai_taxonomy_run") {
            return aiTestWindow.__aiTaxonomyResume ? {
              taskPublicId: "taxonomy-task-interrupted",
              providerChannel: "openrouter",
              modelId: "deepseek/deepseek-v4-pro",
              inputFingerprint: "fixture-input-v1",
              stage: "integrations",
              sourceCount: 20,
              profiledSourceCount: 20,
              assignedSourceCount: 20,
              integratedTopicCount: 8,
              totalTopicCount: 13,
              totalTokens: 2361546,
              costUsd: 1.4603,
              updatedAt: now,
              lastError: "连接意外中断",
            } : null;
          }
          if (command === "discard_ai_taxonomy_run") {
            aiTestWindow.__aiTaxonomyResume = false;
            return null;
          }
          if (command === "get_ai_settings") {
            return {
              activeChannel: "openrouter",
              routingMode: "manual",
              manualSelection: { channel: "openrouter", modelId: "deepseek/deepseek-v4-pro" },
              routePreview: {
                providerChannel: "openrouter",
                profileModelId: "deepseek/deepseek-v4-pro",
                synthesisModelId: "deepseek/deepseek-v4-pro",
                topicInsightModelId: "deepseek/deepseek-v4-pro",
              },
              providers: [{
                channel: "openrouter",
                configured: true,
                selectedModelId: "deepseek/deepseek-v4-pro",
                models: [{
                  id: "deepseek/deepseek-v4-pro",
                  name: "DeepSeek V4 Pro",
                  author: "DeepSeek",
                  canonicalSlug: null,
                  createdAt: null,
                  contextLength: null,
                  supportedParameters: [],
                  pricing: { prompt: null, completion: null, request: null, cacheHit: null },
                }, {
                  id: "openai/gpt-5.6-sol",
                  name: "GPT-5.6 Sol",
                  author: "OpenAI",
                  canonicalSlug: null,
                  createdAt: null,
                  contextLength: null,
                  supportedParameters: [],
                  pricing: { prompt: null, completion: null, request: null, cacheHit: null },
                }, {
                  id: "anthropic/claude-opus-5",
                  name: "Claude Opus 5",
                  author: "Anthropic",
                  canonicalSlug: null,
                  createdAt: null,
                  contextLength: null,
                  supportedParameters: [],
                  pricing: { prompt: null, completion: null, request: null, cacheHit: null },
                }, {
                  id: "qwen/qwen-3.8-max",
                  name: "Qwen 3.8 Max",
                  author: "Qwen",
                  canonicalSlug: null,
                  createdAt: null,
                  contextLength: null,
                  supportedParameters: [],
                  pricing: { prompt: null, completion: null, request: null, cacheHit: null },
                }],
                catalogRefreshedAt: now,
              }],
              usage: { taskCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, knownCostUsd: 0 },
            };
          }
          if (
            command === "get_latest_ai_taxonomy_revision"
            || command === "get_applied_ai_taxonomy_revision"
          ) {
            const taxonomyMode = aiTestWindow.__aiTaxonomyMode ?? "applied";
            if (
              taxonomyMode === "empty"
              || (command === "get_applied_ai_taxonomy_revision" && taxonomyMode !== "applied")
            ) return null;
            return {
              publicId: "taxonomy-revision-layout",
              taskPublicId: "taxonomy-task-layout",
              providerChannel: "openrouter",
              modelId: "deepseek/deepseek-v4-pro",
              status: taxonomyMode === "draft" ? "draft" : "applied",
              domains: [{ key: "investment", name: "投资研究", description: "投资研究领域" }],
              topics: [
                {
                  key: "ai-capex",
                  domainKey: "investment",
                  parentKey: null,
                  name: "AI 资本开支",
                  description: "AI 基础设施投入、供给约束与商业回报。",
                  integrationMarkdown: "主题管理 AI 将现有材料整合为一条清晰主线：基础设施需求继续增长，但供给与回报周期仍是主要约束。现有笔记同时显示扩张机会与现金流压力，需要结合后续收入兑现持续复核。",
                  sourceItemIds: Array.from({ length: 20 }, (_, index) => 101 + index),
                },
                {
                  key: "cloud-service",
                  domainKey: "investment",
                  parentKey: null,
                  name: "云服务",
                  description: "云厂商投入与服务演进。",
                  integrationMarkdown: "主题管理 AI 将云服务笔记整合为需求、投入与交付能力三条相互关联的线索。当前资料支持需求扩张，但仍需继续核对资本开支转化效率。",
                  sourceItemIds: [101],
                },
              ],
              assignments: Array.from({ length: 20 }, (_, index) => ({
                sourceItemId: 101 + index,
                topicKey: "ai-capex",
                confidence: 91 - (index % 7) * 4,
                reason: index === 0
                  ? "正文主要讨论 AI 基础设施投资与回报。"
                  : index === 1
                    ? "正文讨论云厂商资本开支与现金流压力。"
                    : "正文属于 AI 资本开支主题边界。",
                uncertain: false,
              })),
              sourceCount: 20,
              assignedSourceCount: 20,
              uncertainSourceCount: 0,
              createdAt: now,
              appliedAt: taxonomyMode === "draft" ? null : now,
              undoneAt: null,
            };
          }
          if (command === "run_ai_taxonomy_revision") {
            await new Promise((resolveDelay) => window.setTimeout(resolveDelay, aiTestWindow.__aiDelayMs ?? 0));
            aiTestWindow.__aiTaxonomyResumeUsed = String(args?.resumeTaskPublicId ?? "");
            aiTestWindow.__aiTaxonomyResume = false;
            aiTestWindow.__aiTaxonomyMode = "draft";
            return await (window as typeof window & {
              __TAURI_INTERNALS__: { invoke: (commandName: string) => Promise<unknown> };
            }).__TAURI_INTERNALS__.invoke("get_latest_ai_taxonomy_revision");
          }
          if (command === "get_ai_topic_insight") return null;
          if (command === "run_ai_topic_insight") {
            aiTestWindow.__aiRunTopicIds?.push(Number(args?.topicId));
            await new Promise((resolveDelay) => window.setTimeout(
              resolveDelay,
              aiTestWindow.__aiDelayMs ?? 0,
            ));
            if (aiTestWindow.__aiFailTopicId === Number(args?.topicId)) {
              throw new Error("HTTP 429：请求过多，请稍后重试");
            }
            return {
              topicId: Number(args?.topicId),
              taskPublicId: "ai-task-layout",
              providerChannel: "openrouter",
              modelId: "deepseek/deepseek-v4-pro",
              inputFingerprint: "fixture-topic-input-v1",
              payload: {
                summaryMarkdown: "主题围绕 AI 基础设施投资、供给约束与商业回报展开。现有资料支持需求增长，但回报周期和现金流压力仍需持续核对。短期判断应保留条件，不直接替代人工结论。\n\n## 证据边界\n基于 2 条研究记录：\n- legacy-record-101：AI 基础设施投资\n- legacy-record-102：云厂商资本开支",
                keyInsights: [
                  { title: "需求仍在增长", detail: "云厂商投入与推理调用量继续上升。", sourceItemIds: [101] },
                  { title: "回报存在滞后", detail: "资本开支先于收入兑现，现金流承压。", sourceItemIds: [102] },
                  { title: "供给仍受约束", detail: "GPU、电力与数据中心交付共同限制扩张。", sourceItemIds: [103] },
                ],
                evidence: [],
                openQuestions: ["实际回报周期有多长？"],
                topicManagementSuggestions: [
                  { action: "relate", title: "关联云计算主题", reason: "多份来源同时涉及云厂商资本开支。", targetTopicName: "云服务" },
                  { action: "boundary", title: "保持主题边界", reason: "当前资料不足以拆分独立子主题。", targetTopicName: null },
                ],
                hypotheses: [
                  { title: "需求兑现", statement: "持续投入最终转化为稳定收入增长。", confidence: 72, invalidationCondition: "收入增速持续低于资本开支增速。", sourceItemIds: [101] },
                ],
                judgmentEvolution: [
                  { occurredAt: "2026-07-25", title: "从扩张转向回报审视", fromStatement: "投入规模是主要判断依据。", toStatement: "回报周期与现金流成为同等重要的判断依据。", reason: "新增材料显示资本开支先于收入兑现。", sourceItemIds: [102] },
                ],
                decisions: [
                  { title: "继续跟踪投入回报", basis: "需求增长与回报滞后同时存在。", action: "按季度核对资本开支、收入与现金流。", result: null, status: "proposed", sourceItemIds: [101, 102] },
                ],
              },
              generatedAt: now,
            };
          }
          if (["get_knowledge_source_original_text", "get_knowledge_topic_detail"].includes(command)) {
            const delayMs = (window as typeof window & { __knowledgeSourceActionDataDelayMs?: number })
              .__knowledgeSourceActionDataDelayMs ?? 0;
            if (delayMs > 0) {
              await new Promise((resolveDelay) => window.setTimeout(resolveDelay, delayMs));
            }
          }
          if (command === "list_record_summaries") {
            const query = args?.query as { deletedOnly?: boolean; favoritesOnly?: boolean } | undefined;
            return recordSummaries
              .filter((item) => query?.deletedOnly
                ? trashedRecordIds.has(item.id)
                : !trashedRecordIds.has(item.id))
              .filter((item) => !query?.favoritesOnly || item.id === 901)
              .map((item) => ({
                ...item,
                isFavorite: query?.favoritesOnly ? item.id === 901 : item.isFavorite,
                isDeleted: trashedRecordIds.has(item.id),
                deletedAt: trashedRecordIds.has(item.id) ? now : null,
              }));
          }
          if (command === "get_record") {
            const recordId = Number(args?.recordId);
            const record = recordDetails.find((item) => item.id === recordId);
            if (!record) throw new Error("记录不存在");
            return structuredClone(record);
          }
          if (command === "list_attachments") return [];
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
            return [
              "# GPU 供给与云业务数据",
              "## 关键数据",
              "头部厂商推理调用量持续增长。",
              ...Array.from(
                { length: 36 },
                (_, index) => `## 持续观察 ${index + 1}\n\n用于验证鼠标悬浮后，当前卡片能够立即接管滚轮。`,
              ),
            ].join("\n\n");
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
          if (command === "get_knowledge_topic_detail") {
            const topicId = Number(args?.topicId);
            return structuredClone(topicId === relatedTopic.id
              ? { ...detail, topic: relatedTopic, notes: [], sources: [relatedSources[0]] }
              : detail);
          }
          throw new Error(`未模拟的 Tauri 命令：${command}`);
        },
      },
    });
  });

  const openKnowledgeView = async () => {
    await page.getByRole("button", { name: /主题洞察/ }).click();
    await expect(page.getByRole("heading", { name: "AI 资本开支", exact: true })).toBeVisible();
  };

  await page.addInitScript(() => {
    if (!localStorage.getItem("nanfeng-knowledge-base:appearance-skin")) {
      localStorage.setItem("nanfeng-knowledge-base:appearance-skin", "florist-studio");
    }
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const readActiveNavigationMaterial = async () => {
    const activeItem = page.locator(".sidebar .nav-item.active");
    await expect(activeItem).toHaveCSS("color", "rgb(237, 78, 40)");
    return activeItem.evaluate((item) => {
      const style = getComputedStyle(item);
      return {
        backgroundImage: style.backgroundImage,
        boxShadow: style.boxShadow,
        color: style.color,
        borderRadius: style.borderRadius,
      };
    });
  };
  const assertSearchShadowContinuity = async (
    selector: string,
    screenshotName?: string,
  ) => {
    const search = page.locator(selector).first();
    const input = search.locator("input");
    await expect(search).toBeVisible();
    const restingShadow = await search.evaluate((element) => getComputedStyle(element).boxShadow);
    expect(restingShadow).toContain("10px 22px -16px");
    await input.focus();
    const focusedShadow = await search.evaluate((element) => getComputedStyle(element).boxShadow);
    expect(focusedShadow).toContain("0px 0px 0px 2px");
    expect(focusedShadow).toContain("10px 22px -16px");
    if (screenshotName) {
      await page.screenshot({
        path: resolve(evidenceDirectory, screenshotName),
        fullPage: false,
      });
    }
    await input.evaluate((element) => element.blur());
  };
  const readCardMaterial = async (selector: string) => {
    const card = page.locator(selector).first();
    await expect(card).toBeVisible();
    return card.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundImage: style.backgroundImage,
        backgroundColor: style.backgroundColor,
        backdropFilter: style.backdropFilter,
      };
    });
  };
  await page.evaluate(() => {
    (window as typeof window & { __knowledgeSourceActionDataDelayMs?: number })
      .__knowledgeSourceActionDataDelayMs = 1_200;
  });
  await page.getByRole("button", { name: /全部笔记/ }).click();
  await expect(page.locator(".knowledge-detail-heading h2")).toHaveText("GPU 供给与云业务数据");
  const ordinarySourceCard = page.locator(".knowledge-source-list-item:not(.active)").first();
  await expect(ordinarySourceCard).toBeVisible();
  await expect(ordinarySourceCard).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".knowledge-source-preview")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  const sourceActionSnapshot = async () => page.locator(".knowledge-detail-actions").evaluate((actions) => ({
    labels: Array.from(actions.querySelectorAll("button")).map((button) => button.textContent?.trim()),
    box: (() => {
      const rect = actions.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    })(),
  }));
  const sourceActionsBeforeSupportingData = await sourceActionSnapshot();
  expect(sourceActionsBeforeSupportingData.labels.slice(0, 2)).toEqual([
    "返回上一级",
    "查看详情",
  ]);
  await page.waitForTimeout(1_300);
  const sourceActionsAfterSupportingData = await sourceActionSnapshot();
  expect(sourceActionsAfterSupportingData).toEqual(sourceActionsBeforeSupportingData);
  await page.evaluate(() => {
    (window as typeof window & { __knowledgeSourceActionDataDelayMs?: number })
      .__knowledgeSourceActionDataDelayMs = 0;
  });
  await page.getByRole("button", { name: /回收站/ }).click();
  await expect(page.getByText("回收站为空", { exact: true })).toBeVisible();
  const bottomNavigationMaterial = await readActiveNavigationMaterial();
  expect(bottomNavigationMaterial.backgroundImage).toContain("105deg");
  expect(bottomNavigationMaterial.backgroundImage).toContain("rgb(255, 249, 246)");
  const emptyStateMaterial = await page.locator(".scene-surface-state").evaluate((state) => {
    const style = getComputedStyle(state);
    return {
      backgroundImage: style.backgroundImage,
      borderWidth: style.borderTopWidth,
      boxShadow: style.boxShadow,
    };
  });
  expect(emptyStateMaterial.backgroundImage).toContain("radial-gradient");
  expect(emptyStateMaterial.backgroundImage).toContain("linear-gradient");
  expect(emptyStateMaterial.borderWidth).toBe("0px");
  expect(emptyStateMaterial.boxShadow).toContain("inset");
  await page.screenshot({
    path: resolve(evidenceDirectory, "sidebar-active-and-empty-state-material-1702x1066.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: /我的收藏/ }).click();
  await expect(page.locator('.sidebar .nav-item[aria-current="page"]')).toContainText("我的收藏");
  const sourceArchiveDetail = page.locator(".source-archive-detail");
  await expect(sourceArchiveDetail).toBeVisible();
  await expect(sourceArchiveDetail.getByText("记录内容", { exact: true })).toBeVisible();
  await expect(sourceArchiveDetail.getByText("附件", { exact: true })).toBeVisible();
  for (const obsoleteLabel of ["当前判断", "已确认事实", "关键证据", "待验证问题", "下一步行动", "历史版本"]) {
    await expect(sourceArchiveDetail.getByText(obsoleteLabel, { exact: true })).toHaveCount(0);
  }
  await page.screenshot({
    path: resolve(evidenceDirectory, "record-source-detail-clean-1702x1066.png"),
    fullPage: false,
  });
  const supportingNavigationMaterial = await readActiveNavigationMaterial();
  expect(supportingNavigationMaterial).toEqual(bottomNavigationMaterial);
  const recordWorkspaceMaterial = await page.evaluate(() => {
    const workspace = document.querySelector(".records-workspace");
    const navigation = document.querySelector(".records-workspace .record-pane");
    const search = document.querySelector(".records-workspace .search-field");
    if (!workspace || !navigation || !search) return null;
    return {
      workspaceFilter: getComputedStyle(workspace).backdropFilter,
      navigationFilter: getComputedStyle(navigation).backdropFilter,
      searchFilter: getComputedStyle(search).backdropFilter,
    };
  });
  expect(recordWorkspaceMaterial).toEqual({
    workspaceFilter: expect.stringContaining("blur"),
    navigationFilter: "none",
    searchFilter: "none",
  });
  await assertSearchShadowContinuity(".records-workspace .search-field");
  await openKnowledgeView();
  await assertSearchShadowContinuity(
    ".knowledge-final-search",
    "search-focus-shadow-continuity-1702x1066.png",
  );
  const coreNavigationMaterial = await readActiveNavigationMaterial();
  expect(coreNavigationMaterial).toEqual(bottomNavigationMaterial);

  await expect(page.locator(".knowledge-overview")).toHaveCount(0);
  const waitingAiInsight = page.getByRole("region", { name: "等待 AI 主题洞察" });
  await expect(waitingAiInsight).toBeVisible();
  await expect(waitingAiInsight.getByText("等待 AI 生成主题洞察", { exact: true })).toBeVisible();
  await expect(waitingAiInsight.getByText(/当前只保留原始笔记和已确认记录/)).toBeVisible();
  const materialSample = await page.evaluate(() => {
    const sidebar = document.querySelector(".sidebar");
    const supportingNavigation = document.querySelector(".nav-group-supporting");
    const workspace = document.querySelector(".knowledge-reading-page");
    const navigation = document.querySelector(".knowledge-final-browser.core-workspace-card-two");
    const reader = document.querySelector(".knowledge-final-reader");
    if (!sidebar || !supportingNavigation || !workspace || !navigation || !reader) return null;
    return {
      sidebarBackground: getComputedStyle(sidebar).backgroundImage,
      sidebarColor: getComputedStyle(sidebar).color,
      sidebarFilter: getComputedStyle(sidebar).backdropFilter,
      supportingSurface: getComputedStyle(supportingNavigation).backgroundImage,
      workspaceBorderWidth: getComputedStyle(workspace).borderTopWidth,
      navigationBorderWidth: getComputedStyle(navigation).borderTopWidth,
      readerBorderWidth: getComputedStyle(reader).borderTopWidth,
      workspaceFilter: getComputedStyle(workspace).backdropFilter,
      navigationFilter: getComputedStyle(navigation).backdropFilter,
      navigationBackground: getComputedStyle(navigation).backgroundImage,
      readerFilter: getComputedStyle(reader).backdropFilter,
      readerBackground: getComputedStyle(reader).backgroundImage,
    };
  });
  expect(materialSample).not.toBeNull();
  expect(materialSample!.sidebarBackground).toContain("radial-gradient");
  expect(materialSample!.sidebarBackground).toContain("linear-gradient");
  expect(materialSample!.sidebarColor).toBe("rgb(23, 59, 99)");
  expect(materialSample!.sidebarFilter).toContain("blur");
  expect(materialSample!.supportingSurface).toContain("linear-gradient");
  expect(materialSample!.workspaceBorderWidth).toBe("0px");
  expect(materialSample!.navigationBorderWidth).toBe("0px");
  expect(materialSample!.readerBorderWidth).toBe("0px");
  expect(materialSample!.workspaceFilter).toContain("blur");
  expect(materialSample!.navigationFilter).toBe("none");
  expect(materialSample!.navigationBackground).toContain("linear-gradient");
  expect(materialSample!.navigationBackground).toContain("fractalNoise");
  expect(materialSample!.readerFilter).toBe("none");
  expect(materialSample!.readerBackground).toContain("linear-gradient");
  expect(materialSample!.readerBackground).toContain("fractalNoise");
  const readerScroller = page.locator(".knowledge-final-scroll");
  const readerTabs = page.locator(".knowledge-final-tabs");
  const hypothesesTab = page.getByRole("tab", { name: /竞争假设/ });
  const evolutionTab = page.getByRole("tab", { name: /判断演变/ });
  const sourcesTab = page.getByRole("tab", { name: /主题整合/ });
  const decisionsTab = page.getByRole("tab", { name: /决策版本/ });
  const splitStageLayout = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".knowledge-final-stage");
    const upper = document.querySelector<HTMLElement>(".knowledge-ai-insight-pane");
    const tabs = document.querySelector<HTMLElement>(".knowledge-final-tabs");
    const lower = document.querySelector<HTMLElement>(".knowledge-final-scroll");
    const preview = document.querySelector<HTMLElement>(".knowledge-ai-insight-preview");
    if (!stage || !upper || !tabs || !lower || !preview) return null;
    return {
      stageHeight: Math.round(stage.getBoundingClientRect().height),
      upperHeight: Math.round(upper.getBoundingClientRect().height),
      lowerHeight: Math.round(lower.getBoundingClientRect().height),
      tabsHeight: Math.round(tabs.getBoundingClientRect().height),
      tabsPosition: getComputedStyle(tabs).position,
      lowerOverflowY: getComputedStyle(lower).overflowY,
      previewOverflow: getComputedStyle(preview).overflow,
    };
  });
  expect(splitStageLayout).not.toBeNull();
  expect(Math.abs(splitStageLayout!.lowerHeight - splitStageLayout!.upperHeight * 2)).toBeLessThanOrEqual(2);
  expect(splitStageLayout!.stageHeight).toBe(
    splitStageLayout!.upperHeight + splitStageLayout!.tabsHeight + splitStageLayout!.lowerHeight,
  );
  expect(splitStageLayout!.tabsPosition).toBe("relative");
  expect(splitStageLayout!.lowerOverflowY).toBe("auto");
  expect(splitStageLayout!.previewOverflow).toBe("hidden");

  await readerScroller.evaluate((element) => {
    element.scrollTop = Math.min(48, Math.max(0, element.scrollHeight - element.clientHeight));
  });
  const stableModeAnchor = await page.evaluate(() => {
    const upper = document.querySelector<HTMLElement>(".knowledge-ai-insight-pane");
    const tabs = document.querySelector<HTMLElement>(".knowledge-final-tabs");
    const scroller = document.querySelector<HTMLElement>(".knowledge-final-scroll");
    if (!upper || !scroller || !tabs) return null;
    return {
      upperTop: upper.getBoundingClientRect().top,
      scrollerTop: scroller.getBoundingClientRect().top,
      tabsTop: tabs.getBoundingClientRect().top,
      windowScrollY: window.scrollY,
    };
  });
  expect(stableModeAnchor).not.toBeNull();
  for (const tab of [evolutionTab, sourcesTab, decisionsTab, hypothesesTab]) {
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    const switchedAnchor = await page.evaluate(() => {
      const upper = document.querySelector<HTMLElement>(".knowledge-ai-insight-pane");
      const tabs = document.querySelector<HTMLElement>(".knowledge-final-tabs");
      const scroller = document.querySelector<HTMLElement>(".knowledge-final-scroll");
      if (!upper || !scroller || !tabs) return null;
      return {
        upperTop: upper.getBoundingClientRect().top,
        scrollerTop: scroller.getBoundingClientRect().top,
        tabsTop: tabs.getBoundingClientRect().top,
        windowScrollY: window.scrollY,
      };
    });
    expect(switchedAnchor).not.toBeNull();
    expect(Math.abs(switchedAnchor!.upperTop - stableModeAnchor!.upperTop)).toBeLessThanOrEqual(1);
    expect(Math.abs(switchedAnchor!.tabsTop - stableModeAnchor!.tabsTop)).toBeLessThanOrEqual(1);
    expect(Math.abs(switchedAnchor!.scrollerTop - stableModeAnchor!.scrollerTop)).toBeLessThanOrEqual(1);
    expect(switchedAnchor!.windowScrollY).toBe(stableModeAnchor!.windowScrollY);
  }
  await readerScroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({
    path: resolve(evidenceDirectory, "knowledge-ai-waiting-above-fold-v103-1702x1066.png"),
    fullPage: false,
  });

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
  const hypothesisGroup = page.locator(".knowledge-final-hypothesis").first();
  const hypothesisThesis = hypothesisGroup.locator(".knowledge-final-hypothesis-thesis");
  const hypothesisEvidence = hypothesisGroup.locator(".knowledge-final-evidence-column").first();
  await expect(hypothesisGroup).not.toHaveAttribute("data-card-interaction", /.+/);
  await expect(hypothesisThesis).toHaveAttribute("data-card-interaction", "surface-lift");
  await expect(hypothesisEvidence).toHaveAttribute("data-card-interaction", "surface-lift");
  await hypothesisThesis.hover();
  await expect.poll(() => hypothesisThesis.evaluate(
    (element) => getComputedStyle(element).translate,
  )).toContain("-2px");
  expect(await hypothesisEvidence.evaluate((element) => getComputedStyle(element).translate)).toBe("none");
  expect(await hypothesisGroup.evaluate((element) => getComputedStyle(element).translate)).toBe("none");
  expect(await page.locator(".knowledge-final-insight-card").evaluateAll(
    (elements) => elements.length === 2
      && elements.every((element) => element.getAttribute("data-card-interaction") === "surface-lift"),
  )).toBe(true);
  const browserItemMaterial = await readCardMaterial(
    ".knowledge-final-domain > button:not(.knowledge-final-domain-heading):not(.active)",
  );
  const hypothesisMaterial = await readCardMaterial(".knowledge-final-hypothesis:not(.oppose)");
  const nestedHypothesisMaterial = await readCardMaterial(".knowledge-final-hypothesis-thesis");
  expect(browserItemMaterial.backgroundImage).toBe("none");
  expect(browserItemMaterial.backgroundColor).toBe("rgb(255, 255, 255)");
  expect(hypothesisMaterial.backgroundImage).toContain("247, 253, 251");
  expect(nestedHypothesisMaterial.backgroundImage).toBe("none");
  expect(nestedHypothesisMaterial.backgroundColor).toBe("rgb(255, 255, 255)");
  expect(hypothesisMaterial.backgroundImage).not.toContain("rgba(");
  expect(browserItemMaterial.backdropFilter).toBe("none");
  expect(nestedHypothesisMaterial.backdropFilter).toBe("none");
  await expect(page.getByRole("button", { name: /主题洞察/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "判断更新", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /主题洞察/ }).locator(".lucide-book-open"))
    .toBeVisible();
  await expect(page.getByText("建立领域与主题", { exact: true })).toBeHidden();

  // 在统一的 1702×1066 视口先核对两入口实际消费同一中栏结构。
  await page.getByRole("button", { name: /主题管理/ }).click();
  const sharedTopicHierarchy = page.locator(".topic-final-browser > .knowledge-final-tree-card");
  await expect(sharedTopicHierarchy).toBeVisible();
  await assertSearchShadowContinuity(".topic-final-search");
  await expect(page.locator(".topic-final-browser .knowledge-final-domain-heading").first()).toBeVisible();
  await expect(page.locator(".topic-final-browser .topic-final-tree")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "AI 主题整合", exact: true })).toBeVisible();
  await expect(page.locator(".topic-final-filter-controls .ai-model-picker-trigger")).toHaveCount(0);
  await expect(page.locator(".topic-final-filter-controls .knowledge-ai-model-select")).toHaveCount(0);
  const topicManagerFilterButtons = page.locator(".topic-final-filter-controls > button");
  await expect(topicManagerFilterButtons).toHaveCount(2);
  const topicManagerFilterBoxes = await topicManagerFilterButtons.evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { width: Math.round(box.width), height: Math.round(box.height) };
  }));
  expect(topicManagerFilterBoxes.every(({ width, height }) => width > 120 && height >= 34 && height <= 38)).toBe(true);
  const topicManagerSearchBox = await page.locator(".topic-final-search").boundingBox();
  expect(topicManagerSearchBox).not.toBeNull();
  expect(topicManagerSearchBox!.height).toBe(45);
  await page.screenshot({
    path: resolve(evidenceDirectory, "topic-management-compact-toolbar-1702x1066.png"),
    fullPage: false,
  });
  const readCoreWorkspaceGeometry = async () => page.evaluate(() => {
    const cardTwo = document.querySelector<HTMLElement>(".core-workspace-card-two");
    const cardThree = document.querySelector<HTMLElement>(".core-workspace-card-three");
    const search = cardTwo?.querySelector<HTMLElement>(
      ".search-field, .knowledge-final-search, .topic-final-search",
    );
    if (!cardTwo || !cardThree || !search) return null;
    const two = cardTwo.getBoundingClientRect();
    const three = cardThree.getBoundingClientRect();
    const searchBox = search.getBoundingClientRect();
    return {
      cardTwo: {
        left: Math.round(two.left),
        top: Math.round(two.top),
        right: Math.round(two.right),
        bottom: Math.round(two.bottom),
        width: Math.round(two.width),
        height: Math.round(two.height),
      },
      cardThree: {
        left: Math.round(three.left),
        top: Math.round(three.top),
        right: Math.round(three.right),
        bottom: Math.round(three.bottom),
        width: Math.round(three.width),
        height: Math.round(three.height),
      },
      search: {
        top: Math.round(searchBox.top),
        height: Math.round(searchBox.height),
      },
    };
  });
  const topicManagementGeometry = await readCoreWorkspaceGeometry();
  expect(topicManagementGeometry).not.toBeNull();
  const fiveEntranceGeometry = [topicManagementGeometry!];
  for (const navigationName of [/主题洞察/, /全部笔记/, /我的收藏/, /持续跟踪/]) {
    await page.getByRole("button", { name: navigationName }).click();
    await expect(page.locator(".core-workspace-card-two")).toBeVisible();
    fiveEntranceGeometry.push((await readCoreWorkspaceGeometry())!);
  }
  for (const geometry of fiveEntranceGeometry) {
    expect(geometry.cardTwo).toEqual(fiveEntranceGeometry[0].cardTwo);
    expect(geometry.cardThree).toEqual(fiveEntranceGeometry[0].cardThree);
    expect(geometry.search).toEqual(fiveEntranceGeometry[0].search);
    expect(geometry.search.height).toBe(45);
  }
  await page.getByRole("button", { name: /主题管理/ }).click();
  await expect(page.locator(".topic-final-reader")).toBeVisible();
  await expect(page.locator(".topic-final-integration")).toContainText("主题管理 AI 将现有材料整合为一条清晰主线");
  const assignmentReason = page.locator(".topic-final-basis > article p").first();
  await expect(assignmentReason).toContainText("正文主要讨论 AI 基础设施投资与回报");
  const assignmentReasonLayout = await assignmentReason.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      writingMode: getComputedStyle(element).writingMode,
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  });
  expect(assignmentReasonLayout.writingMode).toBe("horizontal-tb");
  expect(assignmentReasonLayout.width).toBeGreaterThan(180);
  expect(assignmentReasonLayout.height).toBeLessThan(80);
  await page.screenshot({
    path: resolve(evidenceDirectory, "topic-management-ai-integration-horizontal-v105-1702x1066.png"),
    fullPage: false,
  });
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
  const topicMaterial = await page.evaluate(() => {
    const workspace = document.querySelector(".topic-reading-page");
    const navigation = document.querySelector(".topic-final-browser > .knowledge-final-tree-card");
    const reader = document.querySelector(".topic-final-reader");
    const search = document.querySelector(".topic-final-search");
    if (!workspace || !navigation || !reader || !search) return null;
    return {
      workspaceBorder: getComputedStyle(workspace).borderTopWidth,
      workspaceFilter: getComputedStyle(workspace).backdropFilter,
      navigationBorder: getComputedStyle(navigation).borderTopWidth,
      navigationFilter: getComputedStyle(navigation).backdropFilter,
      readerBorderColor: getComputedStyle(reader).borderTopColor,
      readerFilter: getComputedStyle(reader).backdropFilter,
      searchBorderColor: getComputedStyle(search).borderTopColor,
      searchFilter: getComputedStyle(search).backdropFilter,
    };
  });
  expect(topicMaterial).toEqual({
    workspaceBorder: "0px",
    workspaceFilter: expect.stringContaining("blur"),
    navigationBorder: "0px",
    navigationFilter: "none",
    readerBorderColor: "rgba(0, 0, 0, 0)",
    readerFilter: "none",
    searchBorderColor: "rgba(92, 117, 146, 0.18)",
    searchFilter: "none",
  });
  await page.screenshot({
    path: resolve(evidenceDirectory, "topic-shared-knowledge-hierarchy-1702x1066.png"),
    fullPage: false,
  });
  await openKnowledgeView();

  await page.getByRole("tab", { name: /主题整合/ }).click();
  await expect(page.locator(".knowledge-final-source-mode")).toBeVisible();
  await expect(page.locator(".knowledge-final-source-mode").getByText(
    "AI 归纳材料",
    { exact: true },
  )).toBeVisible();
  await expect(page.locator(".knowledge-final-source-mode").getByText(
    /主题管理 AI 将现有材料整合为一条清晰主线/,
  )).toBeVisible();
  const relatedSourceList = page.locator(".knowledge-final-source-list");
  const relatedSourceCards = relatedSourceList.locator(":scope > .knowledge-final-source-item");
  await expect(relatedSourceCards).toHaveCount(20);
  const relatedSourceLayout = await relatedSourceList.evaluate((list) => {
    const cards = Array.from(list.querySelectorAll<HTMLElement>(":scope > .knowledge-final-source-item"));
    const metadataRows = cards.map((card) => card.querySelector<HTMLElement>("small"));
    return {
      clientHeight: list.clientHeight,
      scrollHeight: list.scrollHeight,
      cardHeights: cards.map((card) => Math.round(card.getBoundingClientRect().height)),
      metadataHeights: metadataRows.map((row) => Math.round(row?.getBoundingClientRect().height ?? 0)),
    };
  });
  expect(relatedSourceLayout.scrollHeight).toBeGreaterThan(relatedSourceLayout.clientHeight);
  expect(Math.min(...relatedSourceLayout.cardHeights)).toBeGreaterThanOrEqual(52);
  expect(Math.min(...relatedSourceLayout.metadataHeights)).toBeGreaterThan(0);
  await relatedSourceList.evaluate((list) => list.scrollTo({ top: list.scrollHeight, behavior: "auto" }));
  await expect(relatedSourceCards.last()).toBeVisible();
  await relatedSourceList.evaluate((list) => list.scrollTo({ top: 0, behavior: "auto" }));
  await page.screenshot({
    path: resolve(evidenceDirectory, "knowledge-related-sources-full-cards-v88-1702x1066.png"),
    fullPage: false,
  });
  const relatedSourceItem = page.locator(".knowledge-final-source-item").filter({
    hasText: "GPU 供给与云业务数据",
  });
  await relatedSourceItem.getByRole("button", { name: /在当前主题内阅读/ }).click();
  await expect(page.locator(".knowledge-final-source-mode")).toBeVisible();
  await expect(page.locator(".knowledge-final-note-detail > header h3"))
    .toHaveText("GPU 供给与云业务数据");
  await expect(page.locator(".knowledge-final-note-detail")).toContainText("头部厂商推理调用量持续增长。");
  await expect(relatedSourceItem).toHaveClass(/active/);
  await page.getByRole("button", { name: "返回材料列表", exact: true }).click();
  await expect(page.locator(".knowledge-final-note-detail > header h3"))
    .toHaveText("AI 资本开支");
  await relatedSourceItem.getByRole("button", { name: /在全部笔记中打开/ }).click();
  await expect(page.locator(".knowledge-detail-heading").getByRole(
    "heading",
    { name: "GPU 供给与云业务数据", exact: true },
  )).toBeVisible();
  await page.getByRole("button", { name: /返回上一级/ }).click();
  await expect(page.getByRole("tab", { name: /主题整合/ })).toHaveAttribute("aria-selected", "true");
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
  await expect(page.getByRole("heading", { name: "全部笔记", exact: true })).toHaveCount(0);
  await expect(page.locator(".source-page-actions-only")).toHaveCount(0);
  await expect(page.locator(".knowledge-detail-actions .source-auto-organize-action")).toHaveCount(0);
  await expect(page.locator(".knowledge-detail-actions").getByRole(
    "button",
    { name: /返回上一级/ },
  )).toBeVisible();
  await expect(page.getByText("原始来源与自动整理结果", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/已加载 \d+ 条有效来源/)).toHaveCount(0);
  await expect(page.locator(".knowledge-detail-heading").getByRole(
    "heading",
    { name: "GPU 供给与云业务数据", exact: true },
  )).toBeVisible();
  const initialSourceListPanel = page.locator(".knowledge-source-list-scroll");
  await expect.poll(() => initialSourceListPanel.evaluate((scroller) => {
    const rows = [...scroller.querySelectorAll<HTMLElement>(".fixed-virtual-list-row")];
    const lastRow = rows.at(-1);
    if (!lastRow) return false;
    return lastRow.getBoundingClientRect().bottom >= scroller.getBoundingClientRect().bottom;
  })).toBe(true);
  if (process.env.PLAYWRIGHT_CARD_TWO_VIEWPORT_ONLY === "1") {
    expect(browserErrors).toEqual([]);
    expect(failedResources).toEqual([]);
    return;
  }
  const bodySearchInput = page.getByLabel("搜索来源正文");
  const sourceBodyPreview = page.locator(".knowledge-source-preview");
  await expect(bodySearchInput).toHaveValue("");
  await expect(page.locator(".source-anchor-highlight")).toHaveCount(0);
  await expect.poll(() => sourceBodyPreview.evaluate((element) => element.scrollTop)).toBe(0);

  await bodySearchInput.fill("关键数据");
  await page.getByRole("button", { name: "执行正文搜索", exact: true }).click();
  await expect(page.locator(".source-anchor-highlight")).toContainText("关键数据");

  const alternateSourceCard = page.locator(".knowledge-source-list-item")
    .filter({ hasNotText: "GPU 供给与云业务数据" })
    .first();
  const alternateSourceTitle = (await alternateSourceCard.locator("strong").first().textContent())?.trim();
  expect(alternateSourceTitle).toBeTruthy();
  await alternateSourceCard.click();
  await expect(page.locator(".knowledge-detail-heading").getByRole(
    "heading",
    { name: alternateSourceTitle!, exact: true },
  )).toBeVisible();
  await expect(bodySearchInput).toHaveValue("");
  await expect(page.locator(".source-anchor-highlight")).toHaveCount(0);
  await expect.poll(() => sourceBodyPreview.evaluate((element) => element.scrollTop)).toBe(0);

  await bodySearchInput.focus();
  const bodySearchHistory = page.getByRole("listbox", { name: "正文最近搜索" });
  await expect(bodySearchHistory).toBeVisible();
  await bodySearchHistory.getByRole("option", { name: "关键数据", exact: true }).click();
  await expect(bodySearchInput).toHaveValue("关键数据");
  await expect(page.locator(".source-anchor-highlight")).toHaveCount(0);
  await expect.poll(() => sourceBodyPreview.evaluate((element) => element.scrollTop)).toBe(0);

  await page.locator(".knowledge-source-list-item").filter({
    hasText: "GPU 供给与云业务数据",
  }).click();
  await expect(page.locator(".knowledge-detail-heading").getByRole(
    "heading",
    { name: "GPU 供给与云业务数据", exact: true },
  )).toBeVisible();
  await expect(bodySearchInput).toHaveValue("");
  await expect(page.locator(".source-anchor-highlight")).toHaveCount(0);
  await expect.poll(() => sourceBodyPreview.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(page.getByRole("button", { name: /返回上一级/ })).toBeVisible();
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
    const panel = document.querySelector(".knowledge-inbox-list");
    const searchRow = document.querySelector(".source-search-field > input");
    const tabs = document.querySelector(".source-filter-tabs");
    if (!panel || !searchRow || !tabs) return null;
    const panelRect = panel.getBoundingClientRect();
    const searchRect = searchRow.getBoundingClientRect();
    const tabsRect = tabs.getBoundingClientRect();
    return {
      widthRatio: searchRect.width / panelRect.width,
      searchAboveTabs: searchRect.bottom <= tabsRect.top + 1,
    };
  });
  // 搜索框与筛选、显示工具栏共用左栏，只防止其被挤压消失，不再锁死旧版 65% 比例。
  expect(sourceSearchLayout?.widthRatio).toBeGreaterThan(0.25);
  expect(sourceSearchLayout?.searchAboveTabs).toBe(true);
  const archiveSearch = page.getByLabel("搜索全部笔记、正文和附件");
  await archiveSearch.fill("调用量");
  await archiveSearch.press("Enter");
  await expect(page.locator(".knowledge-inbox-list").getByText(
    "GPU 供给与云业务数据",
    { exact: true },
  )).toBeVisible();
  await archiveSearch.fill("");
  await archiveSearch.focus();
  await expect(page.getByRole("dialog", { name: "历史资料搜索" })).toBeVisible();
  await expect(page.getByRole("group", { name: "历史搜索范围" }).getByRole("button"))
    .toHaveCount(6);
  await page.getByRole("group", { name: "历史搜索范围" }).getByRole("button", { name: "图片" }).click();
  const imageTimeline = page.getByRole("dialog", { name: "图片资料" });
  await expect(imageTimeline).toBeVisible();
  await imageTimeline.getByRole("button", { name: "关闭" }).click();
  await expect(imageTimeline).toBeHidden();
  await expect(page.getByRole("button", { name: /已全部加载|全部加载/ })).toBeVisible();
  await expect(page.locator(".knowledge-source-list-item.active")).toBeVisible();
  await page.locator(".knowledge-inbox-detail").click({ button: "right", position: { x: 320, y: 260 } });
  await expect(page.getByRole("menu", { name: "南枫知识库操作菜单" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "复制当前笔记标题" })).toBeEnabled();
  await expect(page.getByRole("menuitem", { name: "搜索当前笔记标题" })).toBeEnabled();
  await expect(page.getByRole("menuitem", { name: "导出当前笔记" })).toBeEnabled();
  await page.keyboard.press("Escape");
  const sourceControlOwnership = await page.evaluate(() => {
    const panel = document.querySelector(".knowledge-inbox-list");
    const scroller = document.querySelector(".knowledge-source-list-scroll");
    const search = document.querySelector(".knowledge-source-search-row");
    const display = document.querySelector(".knowledge-source-display-toolbar");
    const states = document.querySelector(".knowledge-source-filter-control-row");
    const locator = document.querySelector(".source-list-locator");
    if (!panel || !scroller || !search || !display || !states || !locator) return null;
    return {
      allControlsOwnedByPanel: [search, display, states, locator]
        .every((element) => element.parentElement === panel),
      noControlInsideScroller: [search, display, states, locator]
        .every((element) => !scroller.contains(element)),
      controlsEndBeforeList: locator.getBoundingClientRect().bottom
        <= scroller.getBoundingClientRect().top + 1,
    };
  });
  expect(sourceControlOwnership).toEqual({
    allControlsOwnedByPanel: true,
    noControlInsideScroller: true,
    controlsEndBeforeList: true,
  });

  const sourceLocator = page.getByLabel("拖动快速定位来源");
  await expect(sourceLocator).toBeVisible();
  await sourceLocator.fill("2");
  await expect(page.locator(".knowledge-detail-heading").getByRole(
    "heading",
    { name: "GPU 供给与云业务数据", exact: true },
  )).toBeVisible();

  const activeSourceCard = page.locator(".knowledge-source-list-item.active");
  await activeSourceCard.hover();
  await expect(activeSourceCard.getByRole("button", { name: /收藏/ })).toBeVisible();
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
  await page.locator(".knowledge-detail-heading").click({ position: { x: 12, y: 12 } });
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
  await expect(page.getByRole("button", { name: "执行正文搜索", exact: true })).toBeVisible();
  await expect(page.getByText("正文预览", { exact: true })).toHaveCount(0);
  const sourceListPanel = page.locator(".knowledge-source-list-scroll");
  const sourceDetailPanel = page.locator(".knowledge-inbox-detail");
  const sourcePreview = page.locator(".knowledge-source-preview");
  const sourceSearchControls = page.locator(".knowledge-source-search-row");
  await expect.poll(() => sourceListPanel.evaluate((element) => (
    element.scrollHeight > element.clientHeight
  ))).toBe(true);
  await expect.poll(() => sourcePreview.evaluate((element) => (
    element.scrollHeight > element.clientHeight
  ))).toBe(true);
  await sourceListPanel.evaluate((element) => { element.scrollTop = 0; });
  await sourcePreview.evaluate((element) => { element.scrollTop = 0; });

  const sourceControlLayout = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".knowledge-inbox-list");
    const searchRow = panel?.querySelector<HTMLElement>(".knowledge-source-search-row");
    const display = panel?.querySelector<HTMLElement>(".knowledge-source-display-toolbar");
    const states = panel?.querySelector<HTMLElement>(".knowledge-source-filter-control-row");
    const locator = panel?.querySelector<HTMLElement>(".source-list-locator");
    const viewport = panel?.querySelector<HTMLElement>(".knowledge-source-list-viewport");
    const scroller = panel?.querySelector<HTMLElement>(".knowledge-source-list-scroll");
    if (!panel || !searchRow || !display || !states || !locator || !viewport || !scroller) return null;
    const panelStyle = getComputedStyle(panel);
    const viewportStyle = getComputedStyle(viewport);
    const scrollerStyle = getComputedStyle(scroller);
    const panelRect = panel.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const locatorRect = locator.getBoundingClientRect();
    return {
      panelDisplay: panelStyle.display,
      panelRadius: panelStyle.borderRadius,
      panelOverflow: panelStyle.overflow,
      viewportFlex: viewportStyle.flexGrow,
      viewportOverflow: viewportStyle.overflow,
      viewportRadius: viewportStyle.borderRadius,
      scrollerOverflowY: scrollerStyle.overflowY,
      controlsOutsideScroller: [searchRow, display, states, locator]
        .every((element) => element.parentElement === panel && !scroller.contains(element)),
      listStartsAfterControls: scrollerRect.top >= locatorRect.bottom - 1,
      listInsidePanel: scrollerRect.left >= panelRect.left
        && scrollerRect.right <= panelRect.right + 0.5,
      searchAfterContent: getComputedStyle(searchRow, "::after").content,
    };
  });
  expect(sourceControlLayout).toEqual({
    panelDisplay: "flex",
    panelRadius: "14px",
    panelOverflow: "hidden",
    viewportFlex: "1",
    viewportOverflow: "hidden",
    viewportRadius: "0px 0px 10px 10px",
    scrollerOverflowY: "auto",
    controlsOutsideScroller: true,
    listStartsAfterControls: true,
    listInsidePanel: true,
    searchAfterContent: "none",
  });

  const listBox = await sourceListPanel.boundingBox();
  const detailBox = await sourceDetailPanel.boundingBox();
  const searchControlsTop = await sourceSearchControls.evaluate((element) => (
    element.getBoundingClientRect().top
  ));
  expect(listBox).not.toBeNull();
  expect(detailBox).not.toBeNull();
  await page.mouse.move(listBox!.x + listBox!.width / 2, listBox!.y + 120);
  await page.mouse.wheel(0, 320);
  await expect.poll(() => sourceListPanel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect.poll(() => sourceSearchControls.evaluate((element) => (
    element.getBoundingClientRect().top
  ))).toBe(searchControlsTop);
  await page.screenshot({
    path: resolve(evidenceDirectory, "source-controls-match-favorites-1702x1066.png"),
    fullPage: false,
  });
  const firstListScrollTop = await sourceListPanel.evaluate((element) => element.scrollTop);

  await page.setViewportSize({ width: 1280, height: 720 });
  const compactSourcePanel = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".knowledge-inbox-list");
    const scroller = document.querySelector<HTMLElement>(".knowledge-source-list-scroll");
    const search = document.querySelector<HTMLElement>(".source-search-field");
    const filter = document.querySelector<HTMLElement>(".knowledge-inbox-list .filter-button");
    if (!panel || !scroller || !search || !filter) return null;
    const panelRect = panel.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const searchRect = search.getBoundingClientRect();
    const filterRect = filter.getBoundingClientRect();
    return {
      noViewportOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      panelRadius: getComputedStyle(panel).borderRadius,
      panelOverflow: getComputedStyle(panel).overflow,
      searchInsidePanel: searchRect.left >= panelRect.left
        && filterRect.right <= panelRect.right + 0.5,
      listInsidePanel: scrollerRect.left >= panelRect.left
        && scrollerRect.right <= panelRect.right + 0.5,
    };
  });
  expect(compactSourcePanel).toEqual({
    noViewportOverflow: true,
    panelRadius: "14px",
    panelOverflow: "hidden",
    searchInsidePanel: true,
    listInsidePanel: true,
  });
  await page.setViewportSize({ width: 1702, height: 1066 });

  // 不点击，直接移到卡片三标题区；标题区也应把滚轮交给内部正文。
  await page.mouse.move(detailBox!.x + detailBox!.width / 2, detailBox!.y + 72);
  await page.mouse.wheel(0, 320);
  await expect.poll(() => sourcePreview.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  // Chromium 会把连续 wheel 事务锁定到旧 event.target；即使事件仍从卡二发出，
  // 当前坐标已经进入卡三时也必须只滚动卡三，并取消卡二尚未落地的尾帧。
  await sourceListPanel.evaluate((element) => { element.scrollTop = 0; });
  await sourcePreview.evaluate((element) => { element.scrollTop = 0; });
  const sourcePreviewBox = await sourcePreview.boundingBox();
  expect(sourcePreviewBox).not.toBeNull();
  await page.evaluate(({ x, y }) => {
    const staleTarget = document.querySelector<HTMLElement>(".knowledge-source-list-scroll");
    staleTarget?.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      deltaY: 320,
    }));
  }, {
    x: sourcePreviewBox!.x + sourcePreviewBox!.width / 2,
    y: sourcePreviewBox!.y + Math.min(120, sourcePreviewBox!.height / 2),
  });
  await expect.poll(() => sourcePreview.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await sourceListPanel.evaluate((element) => element.scrollTop)).toBe(0);
  await sourceListPanel.evaluate((element, scrollTop) => { element.scrollTop = scrollTop; }, firstListScrollTop);

  // 再次不点击切回卡片二，验证滚轮归属会随悬浮立即切回。
  await page.mouse.move(listBox!.x + listBox!.width / 2, listBox!.y + 120);
  await page.mouse.wheel(0, 320);
  await expect.poll(() => sourceListPanel.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(firstListScrollTop);
  await sourceListPanel.evaluate((element) => { element.scrollTop = 0; });
  await sourcePreview.evaluate((element) => { element.scrollTop = 0; });

  const sourceListScrollBox = await sourceListPanel.boundingBox();
  expect(sourceListScrollBox).not.toBeNull();
  await page.evaluate(({ x, y }) => {
    const staleTarget = document.querySelector<HTMLElement>(".knowledge-source-preview");
    staleTarget?.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      deltaY: 320,
    }));
  }, {
    x: sourceListScrollBox!.x + sourceListScrollBox!.width / 2,
    y: sourceListScrollBox!.y + Math.min(120, sourceListScrollBox!.height / 2),
  });
  await expect.poll(() => sourceListPanel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await sourcePreview.evaluate((element) => element.scrollTop)).toBe(0);
  await sourceListPanel.evaluate((element) => { element.scrollTop = 0; });

  const sourceMaterial = await page.evaluate(() => {
    const workspace = document.querySelector(".knowledge-inbox-page");
    const navigation = document.querySelector(".knowledge-inbox-page .knowledge-inbox-list");
    const detail = document.querySelector(".knowledge-inbox-page .knowledge-inbox-detail");
    const controls = document.querySelector(".knowledge-inbox-page .knowledge-source-search-row");
    const search = document.querySelector(".knowledge-inbox-page .search-field");
    const filter = document.querySelector(".knowledge-inbox-page .filter-button");
    if (!workspace || !navigation || !detail || !controls || !search || !filter) return null;
    return {
      workspaceBorder: getComputedStyle(workspace).borderTopWidth,
      workspaceMask: getComputedStyle(workspace).maskImage,
      workspaceBackground: getComputedStyle(workspace).backgroundImage,
      workspaceFilter: getComputedStyle(workspace).backdropFilter,
      navigationFilter: getComputedStyle(navigation).backdropFilter,
      detailBorderColor: getComputedStyle(detail).borderTopColor,
      detailFilter: getComputedStyle(detail).backdropFilter,
      controlsFilter: getComputedStyle(controls).backdropFilter,
      searchBorderColor: getComputedStyle(search).borderTopColor,
      searchFilter: getComputedStyle(search).backdropFilter,
      searchBackground: getComputedStyle(search).backgroundImage,
      filterBorderRadius: getComputedStyle(filter).borderRadius,
      filterFontSize: getComputedStyle(filter).fontSize,
      filterBackground: getComputedStyle(filter).backgroundImage,
    };
  });
  expect(sourceMaterial).toEqual({
    workspaceBorder: "0px",
    workspaceMask: "none",
    workspaceBackground: expect.stringContaining("radial-gradient"),
    workspaceFilter: expect.stringContaining("blur"),
    navigationFilter: "none",
    detailBorderColor: "rgba(0, 0, 0, 0)",
    detailFilter: "none",
    controlsFilter: "none",
    searchBorderColor: "rgba(92, 117, 146, 0.18)",
    searchFilter: "none",
    searchBackground: expect.stringContaining("linear-gradient"),
    filterBorderRadius: "21px",
    filterFontSize: "12px",
    filterBackground: expect.stringContaining("linear-gradient"),
  });
  await expect(page.locator(".knowledge-detail-actions .source-auto-organize-action")).toHaveCount(0);
  await expect(page.getByText("笔记标题已更新", { exact: true })).toBeHidden({ timeout: 5_000 });
  await page.screenshot({
    path: resolve(evidenceDirectory, "desert-lantern-source-archive.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: /返回上一级/ }).click();
  await expect(page.getByRole("heading", { name: "AI 资本开支", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: /竞争假设/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('.knowledge-final-anchor-button[data-knowledge-source-id="101"]').first())
    .toBeFocused();

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
  await expect(page.getByText("自动排除", { exact: true })).toHaveCount(0);
  await expect(page.locator(".topic-boundary .exclude")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "AI 主题边界", exact: true })).toBeVisible();
  await expect(page.getByText(/领域、主题和归属由 AI 生成/)).toBeVisible();
  await expect(page.getByText("排除范围", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /补充排除规则|调整排除规则|维护/ })).toHaveCount(0);
  await expect(page.getByText("补充分类依据", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: resolve(evidenceDirectory, "topic-ai-classification-boundary-v103-1702x1066.png"),
    fullPage: false,
  });
  await expect(page.getByText("建议关联：云服务", { exact: true })).toBeVisible();
  expect(await page.locator(".topic-final-section").evaluateAll(
    (elements) => elements.length === 3
      && elements.every((element) => element.getAttribute("data-card-interaction") === "surface-lift"),
  )).toBe(true);
  await expect(page.locator(".topic-final-content"))
    .not.toHaveAttribute("data-card-interaction", /.+/);
  await expect(page.locator(".topic-final-suggestions > section"))
    .not.toHaveAttribute("data-card-interaction", /.+/);
  expect(await page.locator(".topic-final-suggestions article").evaluateAll(
    (elements) => elements.length > 0
      && elements.every((element) => element.getAttribute("data-card-interaction") === "surface-lift"),
  )).toBe(true);
  await page.getByText("建议关联：云服务", { exact: true }).locator("..")
    .getByRole("button", { name: "应用", exact: true })
    .click();
  await expect(page.getByText("建议关联：云服务", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "进入主题管理", exact: true }).click();
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
  await page.getByText("高级结构维护：别名、实体、合并、拆分与关系", { exact: true }).click();
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
  const evolutionCardMaterial = await readCardMaterial(".knowledge-final-evolution > .knowledge-final-timeline");
  expect(evolutionCardMaterial.backgroundImage).toBe("none");
  expect(evolutionCardMaterial.backgroundColor).toBe("rgb(255, 255, 255)");
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
      const tabs = document.querySelector<HTMLElement>(".knowledge-final-tabs");
      const content = document.querySelector<HTMLElement>(contentSelector);
      if (!scroll || !tabs || !content) return null;
      const tabsBox = tabs.getBoundingClientRect();
      const contentBox = content.getBoundingClientRect();
      return {
        topGap: Math.round(contentBox.top - tabsBox.bottom),
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
  expect(await page.locator(".knowledge-final-timeline-fragment article").evaluateAll(
    (elements) => elements.length > 0
      && elements.every((element) => element.getAttribute("data-card-interaction") === "surface-lift"),
  )).toBe(true);
  await page.screenshot({
    path: resolve(evidenceDirectory, "knowledge-direct-evolution-1702x1066.png"),
    fullPage: false,
  });

  await sourcesTab.click();
  await expect(page.getByText("先读笔记，再回溯原始来源", { exact: true })).toHaveCount(0);
  await expect(page.getByText("阅读主体", { exact: true })).toHaveCount(0);
  await expect(page.locator(".knowledge-final-note-reader")).toBeVisible();
  await expect(page.locator(".knowledge-final-note-reader"))
    .toHaveAttribute("data-assets-layout", "topic-integration");
  await expect(page.locator(".knowledge-final-note-list")).toHaveCount(0);
  await expect(page.getByText("AI 自动关联笔记来源", { exact: false })).toBeVisible();
  const mainSourceMaterial = await readCardMaterial(".knowledge-final-reading-pane.is-content");
  const sourceSupportMaterial = await readCardMaterial(".knowledge-final-reading-pane.is-support");
  expect(mainSourceMaterial.backgroundImage).toBe("none");
  expect(mainSourceMaterial.backgroundColor).toBe("rgb(255, 255, 255)");
  expect(sourceSupportMaterial.backgroundImage).toBe("none");
  expect(sourceSupportMaterial.backgroundColor).toBe("rgb(255, 255, 255)");
  await assertDirectModeContent(".knowledge-final-source-mode");

  await page.locator(".knowledge-final-tree").getByRole("button", { name: /云服务/ }).click();
  await expect(page.getByRole("heading", { name: "云服务", exact: true, level: 1 })).toBeVisible();
  const pendingIntegration = page.locator('.knowledge-final-note-reader[data-assets-layout="topic-integration"]');
  await expect(pendingIntegration).toBeVisible();
  await expect(pendingIntegration.locator(".knowledge-final-note-list")).toHaveCount(0);
  await expect(pendingIntegration.locator(".knowledge-final-source-list")).toContainText("GPU 供给与云业务数据");
  await expect(pendingIntegration.locator(".knowledge-final-note-detail").getByRole(
    "heading",
    { name: "云服务", exact: true, level: 3 },
  )).toBeVisible();
  await expect(pendingIntegration.locator(".knowledge-final-note-detail"))
    .toContainText("主题管理 AI 将云服务笔记整合为需求、投入与交付能力");
  await expect(page.getByText("暂无独立笔记", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: resolve(evidenceDirectory, "knowledge-ai-source-integration-v103-1702x1066.png"),
    fullPage: false,
  });
  await page.locator(".knowledge-final-tree").getByRole("button", { name: /AI 资本开支/ }).click();
  await expect(page.getByRole("heading", { name: "AI 资本开支", exact: true, level: 1 })).toBeVisible();

  await decisionsTab.click();
  await expect(page.getByText("完整链路", { exact: true })).toHaveCount(0);
  await expect(page.locator(".knowledge-final-decision-version").first()).toBeVisible();
  expect(await page.locator(".knowledge-final-decision-card").evaluateAll(
    (elements) => elements.length === 4
      && elements.every((element) => element.getAttribute("data-card-interaction") === "surface-lift"),
  )).toBe(true);
  await expect(page.locator(".knowledge-final-decision-version").first())
    .not.toHaveAttribute("data-card-interaction", /.+/);
  const decisionCardMaterial = await readCardMaterial(".knowledge-final-decision-version");
  expect(decisionCardMaterial.backgroundImage).toBe("none");
  expect(decisionCardMaterial.backgroundColor).toBe("rgb(255, 255, 255)");
  await assertDirectModeContent(".knowledge-final-decisions-mode");
  await page.screenshot({
    path: resolve(evidenceDirectory, "knowledge-direct-decisions-1702x1066.png"),
    fullPage: false,
  });

  const skins = [
    "entity-mist",
    "entity-sage",
    "entity-terracotta",
    "florist-studio",
    "golden-horses",
  ];
  for (const skin of skins) {
    await page.evaluate((nextSkin) => {
      localStorage.setItem("nanfeng-knowledge-base:appearance-skin", nextSkin);
    }, skin);
    await page.reload();
    await openKnowledgeView();
    await expect(page.locator(".app-shell")).toHaveAttribute("data-skin", skin);
    await expect(page.locator(".app-shell")).toHaveAttribute(
      "data-skin-material",
      skin.startsWith("entity-") ? "entity" : "scene",
    );
    await expect(page.locator(".knowledge-ai-model-select")).toHaveCount(0);
    await assertSearchShadowContinuity(".knowledge-final-search");
    await expect(page.getByRole("tab", { name: /竞争假设/ }))
      .toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".knowledge-final-hypothesis").getByText(
      "规模效应兑现，利润率回升",
      { exact: true },
    )).toBeVisible();
    const sharedMaterial = await page.evaluate(() => {
      const workspace = document.querySelector(".knowledge-reading-page");
      const navigation = document.querySelector(".knowledge-final-browser.core-workspace-card-two");
      const reader = document.querySelector(".knowledge-final-reader");
      if (!workspace || !navigation || !reader) return null;
      return {
        skin: document.querySelector(".app-shell")?.getAttribute("data-skin"),
        workspaceBackground: getComputedStyle(workspace).backgroundImage,
        workspaceBorder: getComputedStyle(workspace).borderTopWidth,
        workspaceFilter: getComputedStyle(workspace).backdropFilter,
        navigationBackground: getComputedStyle(navigation).backgroundImage,
        navigationBorder: getComputedStyle(navigation).borderTopWidth,
        readerBackground: getComputedStyle(reader).backgroundImage,
        readerBorder: getComputedStyle(reader).borderTopWidth,
      };
    });
    expect(sharedMaterial).not.toBeNull();
    if (skin === "florist-studio" || skin === "golden-horses") {
      expect(sharedMaterial!.workspaceBackground).toContain("linear-gradient");
      expect(sharedMaterial!.workspaceBorder).toBe("0px");
      expect(sharedMaterial!.workspaceFilter).toContain("blur");
      expect(sharedMaterial!.navigationBackground).toContain("linear-gradient");
      expect(sharedMaterial!.readerBackground).toContain("linear-gradient");
      expect(sharedMaterial!.navigationBorder).toBe("0px");
      expect(sharedMaterial!.readerBorder).toBe("0px");
      const skinBrowserItemMaterial = await readCardMaterial(
        ".knowledge-final-domain > button:not(.knowledge-final-domain-heading):not(.active)",
      );
      const skinNestedMaterial = await readCardMaterial(".knowledge-final-hypothesis-thesis");
      const skinHypothesisMaterial = await readCardMaterial(".knowledge-final-hypothesis:not(.oppose)");
      const skinAiInsightMaterial = await readCardMaterial(".knowledge-ai-insight");
      expect(skinBrowserItemMaterial.backgroundImage).toBe("none");
      expect(skinBrowserItemMaterial.backgroundColor).toBe("rgb(255, 255, 255)");
      expect(skinNestedMaterial.backgroundImage).toBe("none");
      expect(skinNestedMaterial.backgroundColor).toBe("rgb(255, 255, 255)");
      expect(skinHypothesisMaterial.backgroundImage).toContain("rgb(");
      expect(skinAiInsightMaterial.backgroundImage).toContain("rgb(255, 255, 255)");
      for (const foregroundMaterial of [
        skinHypothesisMaterial,
        skinAiInsightMaterial,
      ]) {
        expect(foregroundMaterial.backgroundImage).not.toContain("rgba(");
      }
    } else {
      expect(sharedMaterial!.workspaceFilter).toBe("none");
      expect(sharedMaterial!.readerBackground).toBe("none");
      const entityCanvasMaterial = await page.evaluate(() => {
        const shell = document.querySelector(".app-shell");
        const main = document.querySelector(".main-region");
        if (!shell || !main) return null;
        const readBackground = (element: Element) => ({
          color: getComputedStyle(element).backgroundColor,
          image: getComputedStyle(element).backgroundImage,
        });
        return { shell: readBackground(shell), main: readBackground(main) };
      });
      expect(entityCanvasMaterial).not.toBeNull();
      expect(entityCanvasMaterial!.shell).toEqual(entityCanvasMaterial!.main);
      expect(entityCanvasMaterial!.main.image).toBe("none");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    await page.screenshot({
      path: resolve(evidenceDirectory, `${skin}-hypotheses.png`),
      fullPage: false,
    });
    if (skin.startsWith("entity-")) {
      await page.getByRole("button", { name: /全部笔记/ }).click();
      await expect(page.locator(".knowledge-detail-heading h2")).toHaveText("GPU 供给与云业务数据");
      await page.screenshot({
        path: resolve(evidenceDirectory, `${skin}-all-notes.png`),
        fullPage: false,
      });
      await page.getByRole("button", { name: /主题管理/ }).click();
      await expect(page.getByRole("heading", { name: "AI 主题整合", exact: true })).toBeVisible();
      await page.screenshot({
        path: resolve(evidenceDirectory, `${skin}-topic-management.png`),
        fullPage: false,
      });
      await page.getByRole("button", { name: "设置", exact: true }).click();
      const settingsMaterial = await page.evaluate(() => {
        const shell = document.querySelector(".app-shell");
        const main = document.querySelector(".main-region");
        const aiEntry = document.querySelector(".ai-automation-entry");
        const settingsRow = document.querySelector(".settings-row");
        const settingsRowAction = document.querySelector(".settings-row > button");
        const storageLabel = document.querySelector(".storage-stat-line span");
        const storageValue = document.querySelector(".storage-stat-line strong");
        if (!shell || !main || !aiEntry || !settingsRow || !settingsRowAction || !storageLabel || !storageValue) return null;
        const readBackground = (element: Element) => ({
          color: getComputedStyle(element).backgroundColor,
          image: getComputedStyle(element).backgroundImage,
        });
        return {
          shell: readBackground(shell),
          main: readBackground(main),
          aiEntry: readBackground(aiEntry),
          settingsRow: readBackground(settingsRow),
          settingsRowAction: readBackground(settingsRowAction),
          storageLabelColor: getComputedStyle(storageLabel).color,
          storageValueColor: getComputedStyle(storageValue).color,
        };
      });
      expect(settingsMaterial).not.toBeNull();
      expect(settingsMaterial!.shell).toEqual(settingsMaterial!.main);
      expect(settingsMaterial!.main.image).toBe("none");
      expect(settingsMaterial!.aiEntry).toEqual({ color: "rgb(255, 255, 255)", image: "none" });
      expect(settingsMaterial!.settingsRow).toEqual({ color: "rgb(255, 255, 255)", image: "none" });
      expect(settingsMaterial!.settingsRowAction).toEqual({ color: "rgba(0, 0, 0, 0)", image: "none" });
      expect(settingsMaterial!.storageLabelColor).toBe("rgba(255, 255, 255, 0.82)");
      expect(settingsMaterial!.storageValueColor).toBe("rgb(255, 255, 255)");
      await page.screenshot({
        path: resolve(evidenceDirectory, `${skin}-settings.png`),
        fullPage: false,
      });
    }
    if (skin === "florist-studio") {
      await page.screenshot({
        path: resolve(evidenceDirectory, "foreground-card-opaque-ai-only-v103-1702x1066.png"),
        fullPage: false,
      });
    }
  }

  const lightGeometry = await page.evaluate(() => {
    const readBox = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top,
      };
    };
    return {
      shell: readBox(".app-shell"),
      sidebar: readBox(".sidebar"),
      main: readBox(".main-region"),
      browser: readBox(".knowledge-final-browser"),
      reader: readBox(".knowledge-final-reader"),
    };
  });

  await page.evaluate(() => {
    localStorage.setItem("nanfeng-knowledge-base:appearance-skin", "florist-studio");
    localStorage.setItem("nanfeng-knowledge-base:appearance-color-mode", "light");
  });
  await page.reload();
  await openKnowledgeView();
  const lightControlContract = await page.evaluate(() => {
    const read = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color, border: style.borderColor };
    };
    return {
      domainHeading: read(".knowledge-final-domain-heading"),
      headingAction: read(".knowledge-final-heading-actions > button"),
      tabCount: read(".knowledge-final-tabs button:not(.active) span"),
      noteCard: read(".unified-note-card"),
    };
  });

  await page.evaluate(() => {
    localStorage.setItem("nanfeng-knowledge-base:appearance-skin", "florist-studio");
    localStorage.setItem("nanfeng-knowledge-base:appearance-color-mode", "dark");
  });
  await page.reload();
  await openKnowledgeView();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-skin", "florist-studio");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-color-mode", "dark");
  await page.waitForTimeout(250);
  const darkModeContract = await page.evaluate(() => {
    const readBox = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top,
      };
    };
    const regularNavigation = document.querySelector<HTMLElement>(".sidebar .nav-item:not(.active)");
    const activeNavigation = document.querySelector<HTMLElement>(".sidebar .nav-item.active");
    const sidebar = document.querySelector<HTMLElement>(".sidebar");
    const domainHeading = document.querySelector<HTMLElement>(".knowledge-final-domain-heading");
    const headingAction = document.querySelector<HTMLElement>(".knowledge-final-heading-actions > button");
    const tabCount = document.querySelector<HTMLElement>(".knowledge-final-tabs button:not(.active) span");
    const activeTabCount = document.querySelector<HTMLElement>(".knowledge-final-tabs button.active span");
    const supportingNavigation = document.querySelector<HTMLElement>(".sidebar .nav-group-supporting");
    const sidebarBottom = document.querySelector<HTMLElement>(".sidebar .sidebar-bottom");
    return {
      rootMode: document.documentElement.dataset.knowledgeColorMode,
      geometry: {
        shell: readBox(".app-shell"),
        sidebar: readBox(".sidebar"),
        main: readBox(".main-region"),
        browser: readBox(".knowledge-final-browser"),
        reader: readBox(".knowledge-final-reader"),
      },
      backgroundImage: sidebar ? getComputedStyle(sidebar).backgroundImage : null,
      regularNavigationColor: regularNavigation ? getComputedStyle(regularNavigation).color : null,
      activeNavigationColor: activeNavigation ? getComputedStyle(activeNavigation).color : null,
      domainHeadingBackground: domainHeading ? getComputedStyle(domainHeading).backgroundColor : null,
      domainHeadingColor: domainHeading ? getComputedStyle(domainHeading).color : null,
      headingActionBackground: headingAction ? getComputedStyle(headingAction).backgroundColor : null,
      headingActionColor: headingAction ? getComputedStyle(headingAction).color : null,
      tabCountBackground: tabCount ? getComputedStyle(tabCount).backgroundColor : null,
      tabCountColor: tabCount ? getComputedStyle(tabCount).color : null,
      activeTabCountBackground: activeTabCount ? getComputedStyle(activeTabCount).backgroundColor : null,
      activeTabCountColor: activeTabCount ? getComputedStyle(activeTabCount).color : null,
      supportingNavigationBackground: supportingNavigation ? getComputedStyle(supportingNavigation).backgroundColor : null,
      sidebarBottomBackground: sidebarBottom ? getComputedStyle(sidebarBottom).backgroundColor : null,
    };
  });
  expect(darkModeContract.rootMode).toBe("dark");
  expect(darkModeContract.geometry).toEqual(lightGeometry);
  expect(darkModeContract.backgroundImage).toContain("linear-gradient");
  expect(darkModeContract.regularNavigationColor).toBe("rgb(194, 208, 202)");
  expect(darkModeContract.activeNavigationColor).toBe("rgb(255, 180, 125)");
  expect(darkModeContract.domainHeadingBackground).toBe("rgb(12, 16, 17)");
  expect(darkModeContract.domainHeadingColor).toBe("rgb(245, 251, 248)");
  expect(darkModeContract.headingActionBackground).toBe("rgb(12, 16, 17)");
  expect(darkModeContract.headingActionColor).toBe("rgb(245, 251, 248)");
  expect(darkModeContract.tabCountBackground).toBe("rgb(23, 29, 30)");
  expect(darkModeContract.tabCountColor).toBe("rgb(245, 251, 248)");
  expect(darkModeContract.activeTabCountBackground).toBe("color(srgb 0.226667 0.202549 0.173529)");
  expect(darkModeContract.activeTabCountColor).toBe("rgb(245, 251, 248)");
  expect(darkModeContract.supportingNavigationBackground).toBe("rgba(0, 0, 0, 0)");
  expect(darkModeContract.sidebarBottomBackground).toBe("rgba(0, 0, 0, 0)");

  const expectedDarkSkinTokens = {
    "entity-mist": { panel: "#101415", raised: "#171d1e", selected: "#252e2f", accent: "#95d0ff" },
    "entity-sage": { panel: "#101415", raised: "#171d1e", selected: "#252e2f", accent: "#b4e4a5" },
    "entity-terracotta": { panel: "#101415", raised: "#171d1e", selected: "#252e2f", accent: "#ffc092" },
    "florist-studio": { panel: "#101415", raised: "#171d1e", selected: "#252e2f", accent: "#ffb47d" },
    "golden-horses": { panel: "#101415", raised: "#171d1e", selected: "#252e2f", accent: "#ffd08a" },
  } as const;
  for (const [skin, expectedTokens] of Object.entries(expectedDarkSkinTokens)) {
    await page.evaluate(({ nextSkin }) => {
      localStorage.setItem("nanfeng-knowledge-base:appearance-skin", nextSkin);
      localStorage.setItem("nanfeng-knowledge-base:appearance-color-mode", "dark");
    }, { nextSkin: skin });
    await page.reload();
    await openKnowledgeView();
    await expect(page.locator(".app-shell")).toHaveAttribute("data-skin", skin);
    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        panel: root.getPropertyValue("--dark-skin-panel").trim(),
        raised: root.getPropertyValue("--dark-skin-raised").trim(),
        selected: root.getPropertyValue("--dark-skin-selected").trim(),
        accent: root.getPropertyValue("--dark-skin-accent").trim(),
      };
    });
    expect(tokens).toEqual(expectedTokens);
  }
  await page.evaluate(() => {
    localStorage.setItem("nanfeng-knowledge-base:appearance-skin", "entity-terracotta");
    localStorage.setItem("nanfeng-knowledge-base:appearance-color-mode", "dark");
  });
  await page.reload();
  await openKnowledgeView();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const terracottaSelection = page.locator(".skin-option.selected");
  await expect(terracottaSelection).toHaveCSS("background-color", "rgb(12, 16, 17)");
  const terracottaPreview = await terracottaSelection.locator(".skin-preview").evaluate((preview) => {
    const style = getComputedStyle(preview, "::after");
    return { background: style.backgroundColor, border: style.borderColor };
  });
  expect(terracottaPreview.background).not.toBe("rgb(255, 255, 255)");
  expect(terracottaPreview.border).toBe("rgb(5, 7, 7)");
  await page.screenshot({
    path: resolve(evidenceDirectory, "dark-terracotta-settings-token-contract-1702x1066.png"),
    fullPage: false,
  });

  await page.evaluate(() => {
    localStorage.setItem("nanfeng-knowledge-base:appearance-skin", "florist-studio");
    localStorage.setItem("nanfeng-knowledge-base:appearance-color-mode", "dark");
  });
  await page.reload();
  await openKnowledgeView();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: resolve(evidenceDirectory, "dark-florist-navigation-contrast-1702x1066.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const darkModeSwitch = page.getByRole("switch", { name: "暗色皮肤" });
  await expect(darkModeSwitch).toHaveAttribute("aria-checked", "true");
  await darkModeSwitch.click();
  await expect(darkModeSwitch).toHaveAttribute("aria-checked", "false");
  await darkModeSwitch.click();
  await expect(darkModeSwitch).toHaveAttribute("aria-checked", "true");
  const darkModeNotice = page.locator(".prototype-notice");
  await expect(darkModeNotice).toContainText("已开启暗色皮肤");
  const darkPopupContract = await darkModeNotice.evaluate((notice) => {
    const close = notice.querySelector<HTMLElement>(".notice-close");
    return {
      background: getComputedStyle(notice).backgroundColor,
      color: getComputedStyle(notice).color,
      closeBackground: close ? getComputedStyle(close).backgroundColor : null,
    };
  });
  expect(darkPopupContract).toEqual({
    background: "rgb(23, 29, 30)",
    color: "rgb(245, 251, 248)",
    closeBackground: "rgb(12, 16, 17)",
  });
  await page.screenshot({
    path: resolve(evidenceDirectory, "dark-florist-settings-notice-1702x1066.png"),
    fullPage: false,
  });
  await darkModeNotice.getByRole("button", { name: "关闭提示" }).click();

  await page.getByRole("button", { name: /全部笔记/ }).click();
  const darkNoteCard = page.locator(".unified-note-card").first();
  await expect(darkNoteCard).toBeVisible();
  await darkNoteCard.hover();
  const darkNoteListContract = await darkNoteCard.evaluate((card) => {
    const title = card.querySelector<HTMLElement>(".unified-note-copy > strong");
    const meta = card.querySelector<HTMLElement>(".unified-note-meta");
    const date = card.querySelector<HTMLElement>(".unified-note-date");
    const actions = card.querySelector<HTMLElement>(".note-list-quick-actions");
    return {
      background: getComputedStyle(card).backgroundColor,
      title: title ? getComputedStyle(title).color : null,
      meta: meta ? getComputedStyle(meta).color : null,
      date: date ? getComputedStyle(date).color : null,
      actionsBackground: actions ? getComputedStyle(actions).backgroundColor : null,
    };
  });
  expect(darkNoteListContract).toEqual({
    background: "color(srgb 0.226667 0.202549 0.173529)",
    title: "rgb(245, 251, 248)",
    meta: "rgb(194, 208, 202)",
    date: "rgb(194, 208, 202)",
    actionsBackground: "rgb(23, 29, 30)",
  });
  await page.screenshot({
    path: resolve(evidenceDirectory, "dark-florist-notes-contrast-1702x1066.png"),
    fullPage: false,
  });

  await page.evaluate(() => {
    localStorage.setItem("nanfeng-knowledge-base:appearance-color-mode", "light");
    localStorage.setItem("nanfeng-knowledge-base:appearance-skin", "florist-studio");
  });
  await page.reload();
  await openKnowledgeView();
  const restoredLightControlContract = await page.evaluate(() => {
    const read = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color, border: style.borderColor };
    };
    return {
      domainHeading: read(".knowledge-final-domain-heading"),
      headingAction: read(".knowledge-final-heading-actions > button"),
      tabCount: read(".knowledge-final-tabs button:not(.active) span"),
      noteCard: read(".unified-note-card"),
    };
  });
  expect(restoredLightControlContract).toEqual(lightControlContract);

  await page.evaluate(() => {
    localStorage.setItem("nanfeng-knowledge-base:appearance-skin", "florist-studio");
  });
  await page.reload();
  await openKnowledgeView();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-skin", "florist-studio");
  await page.getByRole("button", { name: "用 AI 整理", exact: true }).click();
  const singleProgressDialog = page.getByRole("dialog", { name: "AI 正在整理主题" });
  await expect(singleProgressDialog).toBeVisible();
  await expect(singleProgressDialog).toContainText("生成主题综述和四个知识模块");
  await expect(singleProgressDialog.locator(".save-spinner")).toHaveCSS("border-radius", "50%");
  await page.screenshot({
    path: resolve(evidenceDirectory, "ai-progress-round-spinner-v108-1702x1066.png"),
    fullPage: false,
  });
  const singleResultDialog = page.getByRole("dialog", { name: "AI 主题整理完成" });
  await expect(singleResultDialog).toBeVisible();
  await expect(singleResultDialog).toContainText("AI 资本开支");
  await page.waitForTimeout(300);
  await expect(singleResultDialog).toBeVisible();
  await page.screenshot({
    path: resolve(evidenceDirectory, "ai-single-result-persistent-v107-1702x1066.png"),
    fullPage: false,
  });
  await singleResultDialog.getByRole("button", { name: "我知道了" }).click();
  await expect(singleResultDialog).toBeHidden();
  await expect(page.getByRole("region", { name: "AI 主题洞察" })).toBeVisible();
  await expect(page.getByRole("region", { name: "AI 生成的竞争假设" })).toContainText("需求兑现");
  await expect(page.locator(".knowledge-final-insight-card").filter({ hasText: "待验证问题" }))
    .toContainText("实际回报周期有多长？");
  await expect(page.locator(".knowledge-final-insight-card").filter({ hasText: "知识有效性" }))
    .toContainText("收入增速持续低于资本开支增速");
  const compactHypothesisLayout = await page.locator(".knowledge-ai-mode-list .knowledge-final-hypothesis").first()
    .evaluate((card) => {
      const header = card.querySelector<HTMLElement>(".knowledge-ai-hypothesis-header");
      const title = card.querySelector<HTMLElement>(".knowledge-final-hypothesis-thesis h3");
      const body = card.querySelector<HTMLElement>(".knowledge-final-hypothesis-thesis p");
      const link = card.querySelector<HTMLElement>(".knowledge-ai-source-references button");
      const cardBox = card.getBoundingClientRect();
      const linkBox = link?.getBoundingClientRect();
      return {
        headerWritingMode: header ? getComputedStyle(header).writingMode : "",
        headerWhiteSpace: header ? getComputedStyle(header).whiteSpace : "",
        titleFontSize: title ? Number.parseFloat(getComputedStyle(title).fontSize) : 0,
        bodyFontSize: body ? Number.parseFloat(getComputedStyle(body).fontSize) : 0,
        linkFontSize: link ? Number.parseFloat(getComputedStyle(link).fontSize) : 0,
        linkInsideCard: linkBox ? linkBox.right <= cardBox.right + 1 : false,
      };
    });
  expect(compactHypothesisLayout.headerWritingMode).toBe("horizontal-tb");
  expect(compactHypothesisLayout.headerWhiteSpace).toBe("nowrap");
  expect(compactHypothesisLayout.titleFontSize).toBeLessThanOrEqual(14);
  expect(compactHypothesisLayout.linkFontSize).toBeLessThanOrEqual(compactHypothesisLayout.bodyFontSize);
  expect(compactHypothesisLayout.linkInsideCard).toBe(true);
  await page.getByRole("tab", { name: /判断演变/ }).click();
  await expect(page.getByRole("region", { name: "AI 生成的判断演变" })).toContainText("从扩张转向回报审视");
  await page.getByRole("tab", { name: /决策版本/ }).click();
  await expect(page.getByRole("region", { name: "AI 生成的决策版本" })).toContainText("继续跟踪投入回报");
  await page.getByRole("tab", { name: /竞争假设/ }).click();
  const aiInsightMaterial = await readCardMaterial(".knowledge-ai-insight");
  expect(aiInsightMaterial.backgroundImage).toContain("rgb(255, 255, 255)");
  expect(aiInsightMaterial.backgroundImage).not.toContain("rgba(");
  await page.screenshot({
    path: resolve(evidenceDirectory, "foreground-card-opaque-ai-result-v103-1702x1066.png"),
    fullPage: false,
  });
  await expect(page.locator(".knowledge-ai-insight details")).toHaveCount(0);
  const aiPreviewCard = page.locator(
    '.knowledge-ai-insight-preview [data-card-interaction="surface-lift"]',
  ).first();
  await expect(aiPreviewCard).toBeVisible();
  const aiPreviewSibling = aiPreviewCard.locator("xpath=following-sibling::*[1]");
  const aiPreviewCardBefore = await aiPreviewCard.evaluate((element) => getComputedStyle(element).translate);
  const aiPreviewSiblingBefore = await aiPreviewSibling.count()
    ? await aiPreviewSibling.evaluate((element) => getComputedStyle(element).translate)
    : "none";
  await aiPreviewCard.hover();
  await expect.poll(() => aiPreviewCard.evaluate((element) => getComputedStyle(element).translate))
    .not.toBe(aiPreviewCardBefore);
  if (await aiPreviewSibling.count()) {
    expect(await aiPreviewSibling.evaluate((element) => getComputedStyle(element).translate))
      .toBe(aiPreviewSiblingBefore);
  }

  await page.getByRole("button", { name: "查看全部 AI 主题洞察", exact: true }).click();
  const fullAiInsightDialog = page.getByRole("dialog", { name: /AI 主题洞察 · AI 资本开支/ });
  await expect(fullAiInsightDialog).toBeVisible();
  await expect(fullAiInsightDialog.getByText(/legacy-record-101/)).toBeVisible();
  const fullDialogLayout = await fullAiInsightDialog.evaluate((dialog) => {
    const box = dialog.getBoundingClientRect();
    return {
      widthRatio: box.width / window.innerWidth,
      heightRatio: box.height / window.innerHeight,
      resize: getComputedStyle(dialog).resize,
      overflowX: getComputedStyle(dialog).overflowX,
    };
  });
  expect(fullDialogLayout.widthRatio).toBeGreaterThanOrEqual(0.78);
  expect(fullDialogLayout.widthRatio).toBeLessThanOrEqual(0.81);
  expect(fullDialogLayout.heightRatio).toBeGreaterThanOrEqual(0.78);
  expect(fullDialogLayout.heightRatio).toBeLessThanOrEqual(0.81);
  expect(fullDialogLayout.resize).toBe("both");
  expect(fullDialogLayout.overflowX).toBe("hidden");
  const resizedDialogBox = await fullAiInsightDialog.evaluate((dialog) => {
    const element = dialog as HTMLElement;
    element.style.width = "70vw";
    element.style.height = "70dvh";
    const box = element.getBoundingClientRect();
    return { width: Math.round(box.width), height: Math.round(box.height) };
  });
  expect(Math.abs(resizedDialogBox.width - Math.round(1702 * 0.7))).toBeLessThanOrEqual(24);
  expect(Math.abs(resizedDialogBox.height - Math.round(1066 * 0.7))).toBeLessThanOrEqual(24);
  await fullAiInsightDialog.evaluate((dialog) => {
    const element = dialog as HTMLElement;
    element.style.width = "";
    element.style.height = "";
  });
  const fullInsightHeadings = ["关键洞察", "竞争假设", "决策与行动"];
  for (const headingName of fullInsightHeadings) {
    const heading = fullAiInsightDialog.getByRole("heading", { name: new RegExp(headingName) });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
  }
  await page.screenshot({
    path: resolve(evidenceDirectory, "ai-insight-full-dialog-v107-1702x1066.png"),
    fullPage: false,
  });
  await fullAiInsightDialog.getByRole("button", { name: "关闭 AI 主题洞察" }).click();
  await expect(fullAiInsightDialog).toBeHidden();
  await expect(page.locator(".knowledge-local-overview")).toHaveCount(0);
  await expect(page.getByText("本地分析", { exact: true })).toHaveCount(0);
  const aiScrollContract = await page.locator(".knowledge-final-scroll").evaluate(async (scroller) => {
    scroller.scrollTop = scroller.scrollHeight;
    await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
    const modeContent = scroller.querySelector<HTMLElement>(".knowledge-final-mode-content");
    const scrollerBox = scroller.getBoundingClientRect();
    const contentBox = modeContent?.getBoundingClientRect();
    return {
      maxScrollTop: scroller.scrollHeight - scroller.clientHeight,
      scrollTop: scroller.scrollTop,
      scrollerClientHeight: scroller.clientHeight,
      contentBottomVisible: contentBox ? contentBox.bottom <= scrollerBox.bottom + 1 : false,
    };
  });
  if (aiScrollContract.maxScrollTop > 0) {
    expect(aiScrollContract.scrollTop).toBeGreaterThan(0);
  } else {
    expect(aiScrollContract.scrollTop).toBe(0);
  }
  expect(aiScrollContract.contentBottomVisible).toBe(true);
  await page.screenshot({
    path: resolve(evidenceDirectory, "ai-insight-fixed-split-v107-1702x1066.png"),
    fullPage: false,
  });

  await page.evaluate(() => {
    const testWindow = window as typeof window & { __aiRunTopicIds?: number[] };
    if (testWindow.__aiRunTopicIds) testWindow.__aiRunTopicIds.length = 0;
  });
  await page.getByRole("button", { name: "AI 全量重新整理", exact: true }).click();
  const progressDialog = page.getByRole("dialog", { name: "AI 正在整理全部主题" });
  await expect(progressDialog).toBeVisible();
  await expect(progressDialog.getByText(/正在处理 1\/2/)).toBeVisible();
  await expect(progressDialog.locator(".ai-batch-progress-list strong")
    .filter({ hasText: "AI 资本开支" })).toBeVisible();
  await expect(progressDialog.locator(".ai-batch-progress-list strong")
    .filter({ hasText: "云服务" })).toBeVisible();
  await page.screenshot({
    path: resolve(evidenceDirectory, "ai-batch-live-progress-v101-1702x1066.png"),
    fullPage: false,
  });
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __aiRunTopicIds?: number[] }).__aiRunTopicIds ?? []
  ))).toEqual([3, 4]);
  const successDialog = page.getByRole("alertdialog", { name: "全部主题整理成功" });
  await expect(successDialog).toBeVisible();
  await page.waitForTimeout(4500);
  await expect(successDialog).toBeVisible();
  await successDialog.getByRole("button", { name: "确认", exact: true }).click();
  await expect(successDialog).toBeHidden();

  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __aiRunTopicIds?: number[];
      __aiFailTopicId?: number | null;
    };
    if (testWindow.__aiRunTopicIds) testWindow.__aiRunTopicIds.length = 0;
    testWindow.__aiFailTopicId = 4;
  });
  await page.getByRole("button", { name: "AI 全量重新整理", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "AI 正在整理全部主题" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __aiRunTopicIds?: number[] }).__aiRunTopicIds ?? []
  ))).toEqual([3, 4]);
  await expect(page.getByRole("dialog", { name: "AI 正在整理全部主题" })
    .getByText("请求失败，正在重试（第 1/2 次）", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "AI 正在整理全部主题" })
    .getByText("HTTP 429：请求过多，请稍后重试", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __aiRunTopicIds?: number[] }).__aiRunTopicIds ?? []
  ))).toEqual([3, 4, 4]);
  const failureDialog = page.getByRole("alertdialog", { name: "部分主题整理失败" });
  await expect(failureDialog).toBeVisible();
  await expect(failureDialog.getByText("云服务", { exact: true })).toBeVisible();
  await expect(failureDialog.getByText("HTTP 429：请求过多，请稍后重试", { exact: true })).toBeVisible();
  await page.waitForTimeout(4500);
  await expect(failureDialog).toBeVisible();
  await page.screenshot({
    path: resolve(evidenceDirectory, "ai-batch-failure-result-v100-1702x1066.png"),
    fullPage: false,
  });
  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __aiRunTopicIds?: number[];
      __aiFailTopicId?: number | null;
    };
    if (testWindow.__aiRunTopicIds) testWindow.__aiRunTopicIds.length = 0;
    testWindow.__aiFailTopicId = null;
  });
  await failureDialog.getByRole("button", { name: "重试失败主题", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __aiRunTopicIds?: number[] }).__aiRunTopicIds ?? []
  ))).toEqual([4]);
  const retrySuccessDialog = page.getByRole("alertdialog", { name: "全部主题整理成功" });
  await expect(retrySuccessDialog).toBeVisible();
  await retrySuccessDialog.getByRole("button", { name: "确认", exact: true }).click();

  await page.getByRole("button", { name: /全部笔记/ }).click();
  await expect(page.locator(".knowledge-detail-heading").getByRole(
    "heading",
    { name: "GPU 供给与云业务数据", exact: true },
  )).toBeVisible();
  await page.getByRole("button", { name: /返回上一级/ }).click();
  await expect(page.getByRole("tab", { name: /竞争假设/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('.knowledge-final-anchor-button[data-knowledge-source-id="101"]').first())
    .toBeFocused();
  await page.getByRole("button", { name: /全部笔记/ }).click();
  await assertSearchShadowContinuity(".source-search-field");
  await page.keyboard.press("Escape");
  const repeatedListRendering = await page.locator(".knowledge-source-list-item").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      renderingRole: element.getAttribute("data-card-rendering"),
      transitionProperty: style.transitionProperty,
      translate: style.translate,
      scale: style.scale,
    };
  });
  expect(repeatedListRendering.renderingRole).toBe("repeated-list");
  expect(repeatedListRendering.transitionProperty).not.toContain("translate");
  expect(repeatedListRendering.transitionProperty).not.toContain("scale");
  expect(repeatedListRendering.transitionProperty).not.toContain("box-shadow");
  expect(repeatedListRendering.translate).toBe("none");
  expect(repeatedListRendering.scale).toBe("1");
  const scrollStressResult = await page.locator(".knowledge-source-list-scroll").evaluate(async (scroller) => {
    const positions = [0, .2, .45, .7, 1, .55, .1, .85, 0];
    for (const ratio of positions) {
      scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) * ratio;
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      await new Promise<void>((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())));
    }
    const visibleCards = [...scroller.querySelectorAll<HTMLElement>(".knowledge-source-list-item")]
      .filter((card) => {
        const cardRect = card.getBoundingClientRect();
        const scrollRect = scroller.getBoundingClientRect();
        return cardRect.bottom > scrollRect.top && cardRect.top < scrollRect.bottom;
      });
    return {
      visibleCount: visibleCards.length,
      everyCardIntact: visibleCards.every((card) => {
        const style = getComputedStyle(card);
        const title = card.querySelector<HTMLElement>(".unified-note-copy > strong");
        const icon = card.querySelector<HTMLElement>(".record-icon");
        return Boolean(title?.textContent?.trim())
          && Boolean(icon)
          && style.display !== "none"
          && style.visibility !== "hidden"
          && Number(style.opacity) > .9;
      }),
    };
  });
  expect(scrollStressResult.visibleCount).toBeGreaterThan(0);
  expect(scrollStressResult.everyCardIntact).toBe(true);
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

  await page.getByRole("button", { name: /回收站/ }).click();
  const closeNotice = page.getByRole("button", { name: "关闭提示" });
  if (await closeNotice.count()) await closeNotice.click();
  const trashGlassMaterial = await page.locator(".trash-card").first().evaluate((element) => ({
    backgroundColor: getComputedStyle(element).backgroundColor,
    backdropFilter: getComputedStyle(element).backdropFilter,
  }));
  expect(trashGlassMaterial.backgroundColor).toContain("rgba(");
  expect(trashGlassMaterial.backdropFilter).toContain("blur");
  await page.screenshot({
    path: resolve(evidenceDirectory, "trash-glass-cards-v107-1702x1066.png"),
    fullPage: false,
  });

  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __aiTaxonomyMode?: "applied" | "empty" | "draft";
      __aiTaxonomyResume?: boolean;
    };
    testWindow.__aiTaxonomyMode = "empty";
    testWindow.__aiTaxonomyResume = true;
  });
  await page.getByRole("button", { name: /主题管理/ }).click();
  const resumeDialog = page.getByRole("alertdialog", { name: "发现未完成的 AI 全库分类" });
  await expect(resumeDialog).toBeVisible();
  await expect(resumeDialog).toContainText("语义档案 20/20 条");
  await expect(resumeDialog).toContainText("主题整合 8/13 份");
  await expect(resumeDialog).toContainText("2,361,546 tokens");
  await expect(page.locator(".topic-final-browser .knowledge-final-tree-card"))
    .toContainText("待 AI 生成全库分类");
  await expect(page.locator(".topic-final-reader")).toContainText("待 AI 生成全库分类");
  await expect(page.getByRole("heading", { name: "AI 主题边界", exact: true })).toHaveCount(0);
  await expect(page.getByText("已归入当前主题", { exact: true })).toHaveCount(0);
  await resumeDialog.getByRole("button", { name: "稍后处理", exact: true }).click();
  await page.getByRole("button", { name: /主题洞察/ }).click();
  await expect(page.locator(".knowledge-final-tree .knowledge-final-domain")).toHaveCount(0);
  await expect(page.locator(".knowledge-final-no-topic")).toContainText("待 AI 生成全库分类");
  await page.getByRole("button", { name: /主题管理/ }).click();
  await expect(resumeDialog).toBeVisible();
  await page.getByLabel("搜索领域或主题").focus();
  await page.screenshot({
    path: resolve(evidenceDirectory, "topic-management-awaiting-ai-v107-1702x1066.png"),
    fullPage: false,
  });
  await resumeDialog.getByRole("button", { name: "继续上次生成", exact: true }).click();
  const taxonomyProgressDialog = page.getByRole("dialog", { name: "AI 正在生成全库分类" });
  await expect(taxonomyProgressDialog).toBeVisible();
  await expect(taxonomyProgressDialog).toContainText("正在从已保存断点继续");
  await expect(taxonomyProgressDialog.locator(".save-spinner")).toHaveCSS("border-radius", "50%");
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __aiTaxonomyResumeUsed?: string | null }
  ).__aiTaxonomyResumeUsed)).toBe("taxonomy-task-interrupted");
  const taxonomyResultDialog = page.getByRole("alertdialog", { name: "AI 全库分类已生成" });
  await expect(taxonomyResultDialog).toBeVisible();
  await expect(taxonomyResultDialog).toContainText("完成 1 份主题整合及其自动关联来源");
  await page.waitForTimeout(300);
  await expect(taxonomyResultDialog).toBeVisible();
  await page.screenshot({
    path: resolve(evidenceDirectory, "ai-taxonomy-result-persistent-v107-1702x1066.png"),
    fullPage: false,
  });
  await taxonomyResultDialog.getByRole("button", { name: "查看分类草稿" }).click();
  await expect(taxonomyResultDialog).toBeHidden();
  await expect(page.locator(".topic-final-toolbar")).toContainText("主题整合 1/1");
  await expect(page.getByRole("button", { name: "应用修订", exact: true })).toBeEnabled();
  await expect(page.getByLabel("AI 资本开支，AI 分类草稿")).toBeVisible();

  expect(failedResources).toEqual([]);
  expect(browserErrors).toEqual([]);
});
