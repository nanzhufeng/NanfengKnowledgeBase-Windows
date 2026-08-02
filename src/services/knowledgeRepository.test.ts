import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { KnowledgeRepository } from "./knowledgeRepository";

describe("KnowledgeRepository inbox performance contract", () => {
  beforeEach(() => {
    invoke.mockReset();
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads lightweight rows first and fetches only the selected source body", async () => {
    invoke.mockImplementation((command: string) => {
      if (command === "list_knowledge_inbox") {
        return Promise.resolve([{
          id: 42,
          publicId: "source-42",
          legacyRecordId: 9,
          sourceType: "ai_conversation",
          title: "大型来源",
          platform: "ChatGPT",
          originalAt: null,
          importedAt: "2026-07-27T10:00:00+08:00",
          readState: "unread",
          organizationState: "inbox",
          duplicateState: "unique",
          freshnessState: "current",
          pendingSuggestionCount: 0,
          assignedTopicCount: 0,
          primaryTopicId: null,
          primaryTopicName: null,
          linkedNoteCount: 0,
        }]);
      }
      if (command === "get_knowledge_source_original_text") {
        return Promise.resolve("完整正文");
      }
      return Promise.reject(new Error(`unexpected command: ${command}`));
    });
    const repository = new KnowledgeRepository();

    const inbox = await repository.listInbox();
    expect(invoke).toHaveBeenNthCalledWith(1, "list_knowledge_inbox", { limit: 120 });
    expect(inbox[0]).not.toHaveProperty("originalText");

    await expect(repository.getSourceOriginalText(42)).resolves.toBe("完整正文");
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "get_knowledge_source_original_text",
      { sourceItemId: 42 },
    );
  });

  it("loads organized and pending sources through the unified archive command", async () => {
    invoke.mockResolvedValue([{
      id: 43,
      publicId: "source-43",
      legacyRecordId: 10,
      sourceType: "markdown",
      title: "已归类来源",
      platform: "",
      originalAt: "2026-07-20",
      importedAt: "2026-07-27T10:00:00+08:00",
      readState: "read",
      organizationState: "organized",
      duplicateState: "unique",
      freshnessState: "current",
      pendingSuggestionCount: 0,
      assignedTopicCount: 1,
      primaryTopicId: 7,
      primaryTopicName: "知识系统设计",
      linkedNoteCount: 2,
    }]);

    const archive = await new KnowledgeRepository().listSourceArchive();

    expect(invoke).toHaveBeenCalledWith("list_knowledge_source_archive", { limit: 120 });
    expect(archive[0].primaryTopicName).toBe("知识系统设计");
    expect(archive[0].organizationState).toBe("organized");
  });

  it("searches the full archive and updates the shared source/record title", async () => {
    const row = {
      id: 43,
      publicId: "source-43",
      legacyRecordId: 10,
      sourceCollectionId: null,
      sourceType: "markdown",
      title: "数据中心利润分散",
      platform: "",
      originalAt: "2026-07-20",
      importedAt: "2026-07-27T10:00:00+08:00",
      readState: "read",
      organizationState: "organized",
      duplicateState: "unique",
      freshnessState: "current",
      pendingSuggestionCount: 0,
      assignedTopicCount: 1,
      primaryTopicId: 7,
      primaryTopicName: "AI 基础设施",
      linkedNoteCount: 0,
    };
    invoke.mockImplementation((command: string) => {
      if (command === "count_knowledge_source_archive") return Promise.resolve(892);
      if (command === "search_knowledge_source_archive") return Promise.resolve([row]);
      if (command === "update_knowledge_source_title") return Promise.resolve({
        sourceItemId: 43,
        legacyRecordId: 10,
        title: "数据中心产业利润重分配",
        updatedAt: "2026-07-31T10:00:00+08:00",
      });
      return Promise.reject(new Error(`unexpected command: ${command}`));
    });
    const repository = new KnowledgeRepository();

    await expect(repository.countSourceArchive()).resolves.toBe(892);
    await expect(repository.searchSourceArchive("利润分散", 892)).resolves.toEqual([row]);
    await expect(repository.updateSourceTitle(43, "数据中心产业利润重分配"))
      .resolves.toMatchObject({ legacyRecordId: 10, title: "数据中心产业利润重分配" });

    expect(invoke).toHaveBeenCalledWith("search_knowledge_source_archive", {
      query: "利润分散",
      limit: 892,
    });
    expect(invoke).toHaveBeenCalledWith("update_knowledge_source_title", {
      input: { sourceItemId: 43, title: "数据中心产业利润重分配" },
    });
  });

  it("lists and renames the shared source catalog", async () => {
    const original = {
      id: 5,
      canonicalKey: "standalone_files",
      displayName: "零散文件导入",
      collectionKind: "standalone_files",
      userRenamed: false,
      sourceItemCount: 12,
      originalFileCount: 12,
    };
    invoke.mockImplementation((command: string) => {
      if (command === "list_knowledge_source_collections") return Promise.resolve([original]);
      if (command === "rename_knowledge_source_collection") return Promise.resolve({
        ...original,
        displayName: "个人文档导入",
        userRenamed: true,
      });
      return Promise.reject(new Error(`unexpected command: ${command}`));
    });
    const repository = new KnowledgeRepository();

    await expect(repository.listSourceCollections()).resolves.toEqual([original]);
    await expect(repository.renameSourceCollection(5, "个人文档导入")).resolves.toMatchObject({
      id: 5,
      displayName: "个人文档导入",
      userRenamed: true,
    });

    expect(invoke).toHaveBeenCalledWith("list_knowledge_source_collections");
    expect(invoke).toHaveBeenCalledWith("rename_knowledge_source_collection", {
      input: { sourceCollectionId: 5, displayName: "个人文档导入" },
    });
  });

  it("coalesces duplicate reads and keeps only a small selected-body cache", async () => {
    let resolveDomains: ((value: unknown[]) => void) | undefined;
    invoke.mockImplementation((command: string, args?: { sourceItemId?: number }) => {
      if (command === "list_knowledge_domains") {
        return new Promise((resolve) => {
          resolveDomains = resolve;
        });
      }
      if (command === "get_knowledge_source_original_text") {
        return Promise.resolve(`正文-${args?.sourceItemId}`);
      }
      return Promise.reject(new Error(`unexpected command: ${command}`));
    });
    const repository = new KnowledgeRepository();

    const firstDomains = repository.listDomains();
    const secondDomains = repository.listDomains();
    expect(invoke).toHaveBeenCalledTimes(1);
    resolveDomains?.([]);
    await expect(Promise.all([firstDomains, secondDomains])).resolves.toEqual([[], []]);

    await repository.getSourceOriginalText(42);
    await repository.getSourceOriginalText(42);
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});

describe("KnowledgeRepository classification context", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("reads the complete persisted classifier input through one Tauri command", async () => {
    invoke.mockResolvedValue({
      source: {
        id: "source-1",
        title: "Claude token 成本",
        text: "Anthropic 调整 API 价格",
        kind: "ai_conversation",
        platform: "ChatGPT",
        fileName: null,
        filePath: null,
        folderPath: null,
        tags: ["模型"],
        jsonFields: {},
        importedAt: "2026-07-27T10:00:00+08:00",
        batchId: null,
      },
      topics: [{
        id: "7",
        primaryDomainId: "2",
        path: ["AI 与软件", "模型与成本"],
        name: "模型与成本",
        aliases: ["模型价格"],
        entities: ["Claude", "Anthropic"],
        keywords: ["token"],
        searchDocument: "Claude API token 推理价格",
        status: "active",
        updatedAt: "2026-07-27T10:00:00+08:00",
      }],
      rules: [{
        id: "keyword:rule-token",
        topicId: "7",
        field: "text",
        operator: "contains",
        effect: "include",
        value: "token",
        jsonField: null,
        strength: 0.8,
        reason: "用户规则命中「token」",
        enabled: true,
      }],
      history: {
        confirmedTopicCounts: { "7": 3 },
        recentTopicIds: ["7"],
        batchTopicIds: {},
      },
      searchSignals: [{
        topicId: "7",
        normalizedScore: 0.92,
        reason: "SQLite FTS5/BM25 命中 3 个主题词，归一化相关度 92%",
      }],
    });

    const context = await new KnowledgeRepository().prepareClassificationContext(42);

    expect(invoke).toHaveBeenCalledWith(
      "prepare_knowledge_classification_context",
      { sourceItemId: 42 },
    );
    expect(context.source.fileName).toBeUndefined();
    expect(context.topics[0].aliases).toEqual(["模型价格"]);
    expect(context.rules[0].strength).toBe(0.8);
    expect(context.searchSignals?.[0].normalizedScore).toBe(0.92);
  });

  it("rejects an out-of-range normalized BM25 score", async () => {
    invoke.mockResolvedValue({
      source: {
        id: "source-1",
        title: "来源",
        text: "",
        kind: "text",
        platform: null,
        fileName: null,
        filePath: null,
        folderPath: null,
        tags: [],
        jsonFields: {},
        importedAt: "2026-07-27T10:00:00+08:00",
        batchId: null,
      },
      topics: [],
      rules: [],
      history: {
        confirmedTopicCounts: {},
        recentTopicIds: [],
        batchTopicIds: {},
      },
      searchSignals: [{
        topicId: "7",
        normalizedScore: 1.2,
        reason: "invalid",
      }],
    });

    await expect(
      new KnowledgeRepository().prepareClassificationContext(42),
    ).rejects.toThrow();
  });
});

describe("KnowledgeRepository notes", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("creates an independent note with topic and source links", async () => {
    invoke.mockResolvedValue({
      id: 9,
      publicId: "note-9",
      title: "镜头复盘",
      bodyMarkdown: "保留的独立笔记正文",
      summary: "关键结论",
      noteType: "review",
      status: "active",
      organizationState: "organized",
      primaryTopicId: 3,
      relatedTopicIds: [4],
      sourceItemIds: [12, 15],
      createdAt: "2026-07-27T10:00:00+08:00",
      updatedAt: "2026-07-27T10:00:00+08:00",
    });

    const note = await new KnowledgeRepository().createNote({
      title: "镜头复盘",
      bodyMarkdown: "保留的独立笔记正文",
      summary: "关键结论",
      noteType: "review",
      status: "active",
      organizationState: "organized",
      primaryTopicId: 3,
      relatedTopicIds: [4],
      sourceItemIds: [12, 15],
    });

    expect(invoke).toHaveBeenCalledWith("create_knowledge_note", {
      input: {
        title: "镜头复盘",
        bodyMarkdown: "保留的独立笔记正文",
        summary: "关键结论",
        noteType: "review",
        status: "active",
        organizationState: "organized",
        primaryTopicId: 3,
        relatedTopicIds: [4],
        sourceItemIds: [12, 15],
      },
    });
    expect(note.publicId).toBe("note-9");
    expect(note.sourceItemIds).toEqual([12, 15]);
  });
});

describe("KnowledgeRepository knowledge evolution", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("serializes a typed evidence locator without leaking page-only fields", async () => {
    invoke.mockResolvedValue({
      id: 4,
      publicId: "evidence-4",
      sourceItemId: 12,
      sourceTitle: "访谈字幕",
      contentMarkdown: "关键表述",
      stance: "support",
      credibility: 85,
      verificationStatus: "verified",
      validityStatus: "active",
      propositionId: null,
      locatorJson: JSON.stringify({
        kind: "timecode",
        value: "00:12:30",
        quote: "关键表述",
      }),
      locatorLabel: "时间码：00:12:30",
      confirmedAt: null,
      validFrom: null,
      validUntil: null,
      reviewAt: null,
      createdAt: "2026-07-27T10:00:00+08:00",
    });

    const evidence = await new KnowledgeRepository().addTopicEvidence({
      topicId: 3,
      sourceItemId: 12,
      contentMarkdown: "关键表述",
      stance: "support",
      credibility: 85,
      verificationStatus: "verified",
      validityStatus: "active",
      locator: {
        kind: "timecode",
        value: " 00:12:30 ",
        quote: " 关键表述 ",
      },
    });

    expect(invoke).toHaveBeenCalledWith("add_knowledge_topic_evidence", {
      input: {
        topicId: 3,
        sourceItemId: 12,
        contentMarkdown: "关键表述",
        stance: "support",
        credibility: 85,
        verificationStatus: "verified",
        validityStatus: "active",
        propositionId: null,
        confirmedAt: null,
        validFrom: null,
        validUntil: null,
        reviewAt: null,
        locatorJson: JSON.stringify({
          kind: "timecode",
          value: "00:12:30",
          quote: "关键表述",
        }),
      },
    });
    expect(evidence.locatorLabel).toBe("时间码：00:12:30");
  });

  it("creates a turning point only through the explicit command", async () => {
    invoke.mockResolvedValue({
      id: 7,
      publicId: "turning-point-7",
      topicId: 3,
      fromJudgmentId: 10,
      fromStatementMarkdown: "旧判断",
      toJudgmentId: 11,
      toStatementMarkdown: "新判断",
      title: "交付策略改变",
      explanation: "新证据改变了风险评估",
      occurredAt: "2026-07-27T10:00:00+08:00",
      createdAt: "2026-07-27T10:00:00+08:00",
    });

    const point = await new KnowledgeRepository().createTurningPoint({
      topicId: 3,
      fromJudgmentId: 10,
      toJudgmentId: 11,
      title: "交付策略改变",
      explanation: "新证据改变了风险评估",
    });

    expect(invoke).toHaveBeenCalledWith("create_knowledge_turning_point", {
      input: {
        topicId: 3,
        fromJudgmentId: 10,
        toJudgmentId: 11,
        title: "交付策略改变",
        explanation: "新证据改变了风险评估",
        occurredAt: "",
      },
    });
    expect(point.toJudgmentId).toBe(11);
  });
});
