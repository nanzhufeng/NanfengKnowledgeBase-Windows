import { expect, test } from "@playwright/test";

test("收录箱仅滚动左侧列表并使用统一正文卡片", async ({ page }) => {
  await page.addInitScript(() => {
    const now = "2026-07-27T16:00:00+08:00";
    const inbox = Array.from({ length: 40 }, (_, index) => ({
      id: index + 1,
      publicId: `source-${index + 1}`,
      legacyRecordId: index + 1,
      sourceType: "ai_conversation",
      title: `测试来源 ${String(index + 1).padStart(2, "0")}`,
      platform: "ChatGPT",
      originalAt: now,
      importedAt: now,
      readState: "unread",
      organizationState: "pending",
      duplicateState: "unique",
      freshnessState: "current",
      pendingSuggestionCount: 1,
    }));
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
        invoke: async (command: string, args: Record<string, any> = {}) => {
          if (command === "plugin:event|listen") return 1;
          if (command === "plugin:event|unlisten") return null;
          if (command === "list_record_summaries" || command === "list_tags") return [];
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
          if (command === "list_knowledge_inbox") return inbox.slice(0, args.limit ?? 120);
          if (command === "list_knowledge_domains") {
            return [{
              id: 1,
              publicId: "domain-ai",
              name: "AI 与软件",
              description: "AI 与软件开发",
              sortOrder: 0,
            }];
          }
          if (command === "list_knowledge_topics") {
            return [{
              id: 7,
              publicId: "topic-software",
              domainId: 1,
              parentTopicId: null,
              name: "软件开发",
              description: "软件开发与调试",
              topicKind: "subject",
              status: "active",
              depth: 1,
              sortOrder: 0,
              sourceCount: 0,
            }];
          }
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
          ].includes(command)) return [];
          if (command === "get_knowledge_source_original_text") {
            return JSON.stringify({
              chat_messages: [
                {
                  sender: "user",
                  created_at: now,
                  text: "请把导入内容按统一格式展示。\n第二行必须保留。",
                },
                {
                  sender: "assistant",
                  created_at: now,
                  text: "## 核心结论\n\n- 使用统一 Markdown 排版\n- 保留来源层级\n\n正文继续展示。".repeat(12),
                },
              ],
            });
          }
          if (command === "list_knowledge_classification_suggestions") {
            return [{
              id: 91,
              publicId: "suggestion-91",
              sourceItemId: args.sourceItemId,
              suggestedTopicId: 7,
              score: 82,
              decision: "confirm",
              reasons: ["标题和正文与软件开发高度相关"],
              signalScoresJson: "[]",
              classifierVersion: "local-rules-v1",
              status: "pending",
              createdAt: now,
            }];
          }
          throw new Error(`未模拟的 Tauri 命令：${command}`);
        },
      },
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "收录箱" })).toBeVisible();
  await expect(page.locator(".source-message.assistant")).toBeVisible();
  await expect(page.getByRole("heading", { name: "主题归属" })).toBeVisible();

  const layout = await page.evaluate(() => {
    const header = document.querySelector(".knowledge-page-header") as HTMLElement;
    const list = document.querySelector(".knowledge-inbox-list") as HTMLElement;
    const detail = document.querySelector(".knowledge-inbox-detail") as HTMLElement;
    const preview = document.querySelector(".knowledge-source-preview") as HTMLElement;
    const before = {
      headerY: header.getBoundingClientRect().y,
      detailY: detail.getBoundingClientRect().y,
    };
    list.scrollTop = 520;
    list.dispatchEvent(new Event("scroll"));
    return new Promise<{
      scrollTop: number;
      headerDelta: number;
      detailDelta: number;
      previewHeight: number;
    }>((resolve) => requestAnimationFrame(() => resolve({
      scrollTop: list.scrollTop,
      headerDelta: header.getBoundingClientRect().y - before.headerY,
      detailDelta: detail.getBoundingClientRect().y - before.detailY,
      previewHeight: preview.getBoundingClientRect().height,
    })));
  });

  expect(layout.scrollTop).toBeGreaterThan(0);
  expect(Math.abs(layout.headerDelta)).toBeLessThan(1);
  expect(Math.abs(layout.detailDelta)).toBeLessThan(1);
  expect(layout.previewHeight).toBeGreaterThan(300);
});
