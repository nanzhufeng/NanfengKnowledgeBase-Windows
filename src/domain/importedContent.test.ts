import { describe, expect, it } from "vitest";
import { readImportedContent } from "./importedContent";

describe("readImportedContent", () => {
  it("converts archived conversation JSON into readable messages", () => {
    const source = JSON.stringify({
      name: "测试会话",
      chat_messages: [
        {
          sender: "human",
          text: "用户问题",
          content: [{ text: "不应重复的用户问题" }],
          created_at: "2026-07-25T10:00:00Z",
        },
        {
          sender: "assistant",
          text: "助手回答",
          content: [{ text: "不应重复的助手回答" }],
        },
      ],
    });

    const result = readImportedContent(source);

    expect(result.isConversation).toBe(true);
    expect(result.messageCount).toBe(2);
    expect(result.messages).toEqual([
      { role: "用户", text: "用户问题", createdAt: "2026-07-25T10:00:00Z" },
      { role: "助手", text: "助手回答", createdAt: null },
    ]);
    expect(result.fullText).not.toContain("不应重复");
  });

  it("uses content blocks when a message has no top-level text", () => {
    const source = JSON.stringify({
      chat_messages: [{
        sender: "assistant",
        content: [{ text: "第一段" }, { text: "第二段" }],
      }],
    });

    expect(readImportedContent(source).messages[0]?.text).toBe("第一段\n\n第二段");
  });

  it("keeps plain text readable", () => {
    const result = readImportedContent("普通导入正文");

    expect(result.isConversation).toBe(false);
    expect(result.fullText).toBe("普通导入正文");
    expect(result.preview).toBe("普通导入正文");
  });
});
