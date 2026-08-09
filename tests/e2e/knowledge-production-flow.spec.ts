import { expect, test } from "@playwright/test";

test("主题洞察通过 Tauri 读取知识对象且不恢复首屏 CRUD 表单", async ({ page }) => {
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
          propositionId: null,
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
          propositionId: null,
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
      decisions: [],
      relations: [],
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
  await page.getByRole("button", { name: /主题洞察/ }).click();
  await page.getByRole("button", { name: /VFX 交付/ }).click();
  await expect(page.getByRole("heading", { name: "VFX 交付", exact: true })).toBeVisible();
  await expect(page.getByText("当前采用离线渲染", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("维护与录入", { exact: true })).toBeHidden();
  await page.getByRole("tab", { name: /主题整合/ }).click();
  await expect(page.getByText("交付复盘视频", { exact: true }).first()).toBeVisible();

  const bridgeCalls = await page.evaluate(() => {
    const calls = (window as any).__knowledgeBridgeCalls as Array<{
      command: string;
      args: Record<string, any>;
    }>;
    return calls.map((call) => call.command);
  });

  expect(bridgeCalls).toContain("get_knowledge_topic_detail");
  expect(bridgeCalls).not.toContain("create_knowledge_note");
  expect(bridgeCalls).not.toContain("create_knowledge_proposition");
});
