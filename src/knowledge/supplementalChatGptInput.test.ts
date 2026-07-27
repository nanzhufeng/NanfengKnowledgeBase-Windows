import { describe, expect, it } from "vitest";

import type { LegacyClassificationInput } from "./legacyClassificationDryRun";
import { mergeSupplementalChatGptConversations } from "./supplementalChatGptInput";

function conversation(id: string, title: string) {
  return {
    conversation_id: id,
    title,
    create_time: 1_700_000_000,
    current_node: "answer",
    mapping: {
      user: {
        parent: null,
        message: {
          author: { role: "user" },
          content: { content_type: "text", parts: ["真实用户问题"] },
        },
      },
      answer: {
        parent: "user",
        message: {
          author: { role: "assistant" },
          content: { content_type: "text", parts: ["回答"] },
        },
      },
    },
  };
}

function baseInput(): LegacyClassificationInput {
  const existing = conversation("existing-id", "已存在");
  return {
    reportVersion: 1,
    generatedAt: "2026-07-27T01:00:00+08:00",
    sourceDatabase: "C:\\audit\\copy.db",
    sourceDatabaseSha256Before: "ABC",
    sourceConnectionQueryOnly: true,
    sourceIntegrityCheck: "ok",
    sourceTotalChangesBefore: 0,
    recordCount: 1,
    records: [{
      recordId: 1,
      recordOrigin: "legacy_database",
      title: "已存在",
      legacyTitle: "已存在",
      titleResolutionStatus: "unchanged",
      status: "normal",
      summary: "",
      currentJudgment: "",
      confirmedFacts: [],
      keyEvidence: [],
      openQuestions: [],
      nextActions: [],
      notes: "",
      sourceText: JSON.stringify(existing),
      tags: [],
      sources: [],
      originalAt: null,
      createdAt: "2026-07-27",
      updatedAt: "2026-07-27",
    }],
    sourceTotalChangesAfter: 0,
    sourceDatabaseSha256After: "ABC",
  };
}

describe("supplemental ChatGPT classification input", () => {
  it("按 conversation_id 去重并恢复通用标题", () => {
    const merged = mergeSupplementalChatGptConversations(baseInput(), [{
      filePath: "C:\\exports\\conversations-000.json",
      fileName: "conversations-000.json",
      sha256: "HASH",
      conversations: [
        conversation("existing-id", "重复"),
        conversation("new-id", "Untitled"),
      ],
    }]);

    expect(merged.recordCount).toBe(2);
    expect(merged.supplementalMerge).toMatchObject({
      overlapSkippedCount: 1,
      addedConversationCount: 1,
    });
    expect(merged.records[1]).toMatchObject({
      recordOrigin: "supplemental_chatgpt",
      title: "真实用户问题",
      titleResolutionStatus: "recovered",
    });
    expect(merged.records[1].sources[0].externalId).toBe("new-id");
  });
});
