import { expect, test } from "@playwright/test";

test("知识生产界面把 Note、命题、转折和证据锚点交给 Tauri 命令", async ({ page }) => {
  await page.addInitScript(() => {
    const now = "2026-07-27T10:00:00+08:00";
    const topic = {
      id: 3,
      publicId: "topic-vfx-delivery",
      domainId: 1,
      parentTopicId: null,
      name: "VFX 交付",
      description: "镜头交付与渲染策略",
      topicKind: "subject",
      status: "active",
      depth: 1,
      sortOrder: 0,
      sourceCount: 1,
    };
    const relatedTopic = {
      ...topic,
      id: 4,
      publicId: "topic-pipeline",
      name: "流程自动化",
      description: "工具与流程",
      sourceCount: 0,
    };
    const detail = {
      topic,
      sources: [{
        id: 12,
        publicId: "source-video-12",
        title: "交付复盘视频",
        sourceType: "video",
        originalAt: now,
        confidence: 92,
      }],
      judgments: [
        {
          id: 11,
          publicId: "judgment-11",
          statementMarkdown: "当前采用离线渲染",
          state: "current",
          confidence: 88,
          changeReason: "稳定性证据增加",
          effectiveAt: now,
          createdAt: now,
        },
        {
          id: 10,
          publicId: "judgment-10",
          statementMarkdown: "此前采用实时渲染",
          state: "tentative",
          confidence: 62,
          changeReason: "",
          effectiveAt: "2026-07-26T10:00:00+08:00",
          createdAt: "2026-07-26T10:00:00+08:00",
        },
      ],
      evidence: [],
      questions: [],
      notes: [],
      propositions: [],
      turningPoints: [],
    };
    const calls: Array<{ command: string; args: Record<string, unknown> }> = [];
    let nextId = 100;
    let callbackId = 0;

    Object.assign(window, {
      __knowledgeBridgeCalls: calls,
      __TAURI_INTERNALS__: {
        metadata: {
          currentWindow: { label: "main" },
          currentWebview: { label: "main" },
        },
        transformCallback: () => ++callbackId,
        unregisterCallback: () => undefined,
        convertFileSrc: (path: string) => path,
        invoke: async (command: string, args: Record<string, any> = {}) => {
          calls.push({ command, args: structuredClone(args) });
          if (command === "plugin:event|listen") return 1;
          if (command === "plugin:event|unlisten") return null;
          if (command === "list_record_summaries") return [];
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
            };
          }
          if (command === "list_knowledge_inbox") return [];
          if (command === "list_knowledge_domains") {
            return [{
              id: 1,
              publicId: "domain-production",
              name: "影视制作",
              description: "影视、动画与 VFX",
              sortOrder: 0,
            }];
          }
          if (command === "list_knowledge_topics") return [topic, relatedTopic];
          if (command === "get_personal_topic_catalog_proposal") {
            return {
              version: "nanzhufeng-personal-catalog-v1",
              status: "proposal",
              title: "个人主题目录提案",
              note: "仅预览",
              domains: [],
              topics: [],
            };
          }
          if ([
            "list_knowledge_topic_aliases",
            "list_knowledge_entities",
            "list_knowledge_classification_rules",
            "suggest_knowledge_topic_relations",
          ].includes(command)) return [];
          if (command === "get_knowledge_topic_detail") return structuredClone(detail);

          if (command === "create_knowledge_note") {
            const input = args.input;
            const note = {
              id: ++nextId,
              publicId: `note-${nextId}`,
              ...input,
              createdAt: now,
              updatedAt: now,
            };
            detail.notes.unshift(note);
            return structuredClone(note);
          }
          if (command === "create_knowledge_proposition") {
            const input = args.input;
            const proposition = {
              id: ++nextId,
              publicId: `proposition-${nextId}`,
              ...input,
              createdAt: now,
              updatedAt: now,
            };
            detail.propositions.unshift(proposition);
            return structuredClone(proposition);
          }
          if (command === "add_knowledge_topic_evidence") {
            const input = args.input;
            const locator = JSON.parse(input.locatorJson);
            const evidence = {
              id: ++nextId,
              publicId: `evidence-${nextId}`,
              sourceItemId: input.sourceItemId,
              sourceTitle: "交付复盘视频",
              contentMarkdown: input.contentMarkdown,
              stance: input.stance,
              credibility: input.credibility,
              verificationStatus: input.verificationStatus,
              validityStatus: input.validityStatus,
              locatorJson: input.locatorJson,
              locatorLabel: `时间码：${locator.value}`,
              createdAt: now,
            };
            detail.evidence.unshift(evidence);
            return structuredClone(evidence);
          }
          if (command === "create_knowledge_turning_point") {
            const input = args.input;
            const point = {
              id: ++nextId,
              publicId: `turning-point-${nextId}`,
              topicId: input.topicId,
              fromJudgmentId: input.fromJudgmentId,
              fromStatementMarkdown: "此前采用实时渲染",
              toJudgmentId: input.toJudgmentId,
              toStatementMarkdown: "当前采用离线渲染",
              title: input.title,
              explanation: input.explanation,
              occurredAt: now,
              createdAt: now,
            };
            detail.turningPoints.unshift(point);
            return structuredClone(point);
          }
          throw new Error(`未模拟的 Tauri 命令：${command}`);
        },
      },
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "收录箱" })).toBeVisible();
  await page.getByRole("button", { name: /主题浏览器/ }).click();
  await page.getByRole("button", { name: /VFX 交付/ }).click();
  await expect(page.getByRole("heading", { name: "VFX 交付" })).toBeVisible();

  await page.getByLabel("标题", { exact: true }).fill("镜头交付复盘");
  await page.getByRole("textbox", { name: "摘要", exact: true }).fill("离线渲染更稳定");
  await page.getByLabel("正文（Markdown）", { exact: true }).fill("## 结论\n\n保留独立 Note。");
  await page.getByLabel("笔记类型").selectOption("review");
  await page.getByLabel("笔记状态").selectOption("active");
  await page.getByLabel("笔记相关主题").selectOption(["4"]);
  await page.getByLabel("交付复盘视频", { exact: true }).check();
  await page.getByRole("button", { name: "创建笔记" }).click();
  await expect(page.getByText("镜头交付复盘", { exact: true })).toBeVisible();

  await page.getByPlaceholder("写下一条可验证、可被证据支持或反驳的具体陈述")
    .fill("离线渲染能降低最终交付波动");
  await page.getByLabel("命题状态").selectOption("supported");
  await page.getByRole("button", { name: "创建命题" }).click();
  await expect(page.getByText("离线渲染能降低最终交付波动", { exact: true })).toBeVisible();

  await page.getByPlaceholder("证据内容或原文摘录").fill("12 分 30 秒展示了失败率对比");
  await page.getByLabel("证据立场").selectOption("support");
  await page.getByLabel("证据验证状态").selectOption("verified");
  await page.getByLabel("证据锚点类型").selectOption("timecode");
  await page.getByLabel("证据锚点值").fill("00:12:30");
  await page.getByLabel("证据短引用").fill("失败率明显下降");
  await page.getByRole("button", { name: "添加证据" }).click();
  await expect(page.getByText(/时间码：00:12:30/)).toBeVisible();

  await page.getByPlaceholder("转折标题").fill("切换为离线渲染");
  await page.getByPlaceholder("为什么这次变化足以构成关键转折？")
    .fill("失败率证据改变了交付策略");
  await page.getByRole("button", { name: "明确确认为关键转折" }).click();
  await expect(page.getByText("切换为离线渲染", { exact: true })).toBeVisible();

  const mutationCalls = await page.evaluate(() => {
    const calls = (window as any).__knowledgeBridgeCalls as Array<{
      command: string;
      args: Record<string, any>;
    }>;
    return calls.filter((call) => [
      "create_knowledge_note",
      "create_knowledge_proposition",
      "add_knowledge_topic_evidence",
      "create_knowledge_turning_point",
    ].includes(call.command));
  });

  expect(mutationCalls.map((call) => call.command)).toEqual([
    "create_knowledge_note",
    "create_knowledge_proposition",
    "add_knowledge_topic_evidence",
    "create_knowledge_turning_point",
  ]);
  expect(mutationCalls[0].args.input).toMatchObject({
    primaryTopicId: 3,
    relatedTopicIds: [4],
    sourceItemIds: [12],
  });
  expect(JSON.parse(mutationCalls[2].args.input.locatorJson)).toEqual({
    kind: "timecode",
    value: "00:12:30",
    quote: "失败率明显下降",
  });
  expect(mutationCalls[3].args.input).toMatchObject({
    fromJudgmentId: 10,
    toJudgmentId: 11,
  });
});
