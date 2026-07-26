import { describe, expect, it } from "vitest";
import {
  readImportedContent,
  resolveImportedTitle,
  shouldDisplaySummary,
} from "./importedContent";

describe("readImportedContent", () => {
  it("converts archived conversation JSON into readable messages", () => {
    const source = JSON.stringify({
      name: "测试会话",
      chat_messages: [
        {
          sender: "human",
          text: "用户问题",
          content: [{ type: "text", text: "用户问题" }],
          created_at: "2026-07-25T10:00:00Z",
        },
        {
          sender: "assistant",
          text: "内部分析与助手回答的扁平文本",
          content: [
            { type: "thinking", thinking: "内部分析" },
            { type: "tool_use", name: "search" },
            { type: "text", text: "助手回答" },
          ],
        },
      ],
    });

    const result = readImportedContent(source);

    expect(result.isConversation).toBe(true);
    expect(result.messageCount).toBe(2);
    expect(result.messages).toEqual([
      { role: "用户", text: "用户问题", createdAt: "2026-07-25T10:00:00Z", assets: [] },
      { role: "助手", text: "助手回答", createdAt: null, assets: [] },
    ]);
    expect(result.previewMessages).toHaveLength(2);
    expect(result.preview).toContain("### 用户");
    expect(result.preview).toContain("### 助手");
    expect(result.fullText).not.toContain("内部分析");
  });

  it("keeps Markdown structure and a page-sized preview instead of flattening it", () => {
    const longAnswer = `## 标题\n\n${"- 列表项\n".repeat(180)}`;
    const source = JSON.stringify({
      chat_messages: [{ sender: "assistant", text: longAnswer }],
    });

    const preview = readImportedContent(source).preview;
    expect(preview).toContain("## 标题");
    expect(preview).toContain("- 列表项");
    expect(preview.length).toBeGreaterThan(1_000);
    expect(preview.length).toBeLessThanOrEqual(2_420);
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

  it("keeps visible English topic content while hiding flattened internal reasoning", () => {
    const source = JSON.stringify({
      chat_messages: [{
        sender: "assistant",
        text: "The user is asking for internal planning. The visible answer follows.",
        content: [
          { type: "thinking", thinking: "Internal planning" },
          { type: "text", text: "This English answer is the actual topic content." },
        ],
      }],
    });

    const message = readImportedContent(source).messages[0];
    expect(message?.text).toBe("This English answer is the actual topic content.");
    expect(message?.text).not.toContain("internal planning");
  });

  it("retains conversation image and file references without inventing missing binaries", () => {
    const source = JSON.stringify({
      chat_messages: [{
        sender: "human",
        content: [
          { type: "text", text: "请查看这张截图" },
          { type: "image", file_uuid: "image-uuid-1" },
        ],
        files: [
          {
            file_uuid: "image-uuid-1",
            file_name: "界面截图.png",
            file_type: "image/png",
            file_size: 1024,
          },
          {
            file_uuid: "file-uuid-1",
            file_name: "补充资料.pdf",
            file_type: "application/pdf",
          },
        ],
      }],
    });

    const message = readImportedContent(source).messages[0];
    expect(message?.assets).toEqual([
      {
        fileUuid: "image-uuid-1",
        fileName: "界面截图.png",
        kind: "image",
        mimeType: "image/png",
        sizeBytes: 1024,
      },
      {
        fileUuid: "file-uuid-1",
        fileName: "补充资料.pdf",
        kind: "file",
        mimeType: "application/pdf",
        sizeBytes: null,
      },
    ]);
  });

  it("converts a ChatGPT mapping tree into the current visible conversation branch", () => {
    const source = JSON.stringify({
      title: "NotebookLM 里多余邮箱无法删除问题",
      current_node: "answer-2",
      mapping: {
        root: { id: "root", parent: null, children: ["user-1"], message: null },
        "user-1": {
          id: "user-1",
          parent: "root",
          children: ["thought-1", "stale-answer"],
          message: {
            author: { role: "user" },
            create_time: 1_700_000_000,
            content: {
              content_type: "multimodal_text",
              parts: [
                {
                  content_type: "image_asset_pointer",
                  asset_pointer: "sediment://file_000000000001",
                  size_bytes: 4096,
                },
                "设置里只有一个账号，应该怎么删除？",
              ],
            },
          },
        },
        "thought-1": {
          id: "thought-1",
          parent: "user-1",
          children: ["answer-1"],
          message: {
            author: { role: "assistant" },
            create_time: 1_700_000_001,
            content: {
              content_type: "thoughts",
              thoughts: [{ content: "Internal English reasoning must stay hidden." }],
            },
          },
        },
        "answer-1": {
          id: "answer-1",
          parent: "thought-1",
          children: ["answer-2"],
          message: {
            author: { role: "assistant" },
            create_time: 1_700_000_002,
            content: {
              content_type: "text",
              parts: ["这是用户实际看到的回答。\uE200cite\uE202turn1search0\uE201"],
            },
          },
        },
        "answer-2": {
          id: "answer-2",
          parent: "answer-1",
          children: [],
          message: {
            author: { role: "assistant" },
            create_time: 1_700_000_003,
            content: { content_type: "text", parts: ["补充回答。"] },
          },
        },
        "stale-answer": {
          id: "stale-answer",
          parent: "user-1",
          children: [],
          message: {
            author: { role: "assistant" },
            create_time: 1_700_000_004,
            content: { content_type: "text", parts: ["旧分支不应显示。"] },
          },
        },
      },
    });

    const result = readImportedContent(source);

    expect(result.isConversation).toBe(true);
    expect(result.messages.map((message) => message.role)).toEqual(["用户", "助手", "助手"]);
    expect(result.fullText).toContain("设置里只有一个账号");
    expect(result.fullText).toContain("这是用户实际看到的回答");
    expect(result.fullText).toContain("补充回答");
    expect(result.fullText).not.toContain("Internal English reasoning");
    expect(result.fullText).not.toContain("旧分支");
    expect(result.fullText).not.toContain("turn1search0");
    expect(result.messages[0]?.createdAt).toBe("2023-11-14T22:13:20.000Z");
    expect(result.messages[0]?.assets[0]).toMatchObject({
      fileUuid: "file_000000000001",
      kind: "image",
      sizeBytes: 4096,
    });
  });

  it("uses the first ChatGPT user message when an imported title is generic", () => {
    const source = JSON.stringify({
      current_node: "answer",
      mapping: {
        user: {
          parent: null,
          message: {
            author: { role: "user" },
            content: { content_type: "text", parts: ["这是 ChatGPT mapping 里的真实问题"] },
          },
        },
        answer: {
          parent: "user",
          message: {
            author: { role: "assistant" },
            content: { content_type: "text", parts: ["真实回答"] },
          },
        },
      },
    });

    expect(resolveImportedTitle("Untitled", source)).toBe("这是 ChatGPT mapping 里的真实问题");
  });

  it("falls back to top-level text when no visible content block exists", () => {
    const source = JSON.stringify({
      chat_messages: [{
        sender: "assistant",
        text: "只有顶层文本的旧格式回答",
        content: [{ type: "thinking", thinking: "隐藏过程" }],
      }],
    });

    expect(readImportedContent(source).messages[0]?.text).toBe("只有顶层文本的旧格式回答");
  });

  it("keeps plain text readable", () => {
    const result = readImportedContent("普通导入正文");

    expect(result.isConversation).toBe(false);
    expect(result.fullText).toBe("普通导入正文");
    expect(result.preview).toBe("普通导入正文");
  });

  it("hides English-dominant summaries without hiding Chinese summaries", () => {
    expect(shouldDisplaySummary(
      "**Conversation Overview** The person asked for a structured comparison of several models.",
    )).toBe(false);
    expect(shouldDisplaySummary(
      "这是一条中文摘要，其中包含 AI agent 和 ChatGPT 等必要英文术语。",
    )).toBe(true);
    expect(shouldDisplaySummary("")).toBe(false);
  });

  it("replaces a generic import title with the first user message", () => {
    const source = JSON.stringify({
      summary: "**Conversation Overview**",
      chat_messages: [
        { sender: "assistant", text: "先出现的助手内容不应成为标题" },
        {
          sender: "human",
          text: "我的 MAC Air 是 8G 内存，Mac Pro 是 32G 内存，为什么占用差这么多？",
        },
      ],
    });

    expect(resolveImportedTitle("**Conversation Overview**", source)).toBe(
      "我的 MAC Air 是 8G 内存，Mac Pro 是 32G 内存，为什么占用差这么多？",
    );
  });

  it("keeps a meaningful original title unchanged", () => {
    const source = JSON.stringify({
      chat_messages: [{ sender: "human", text: "另一段正文" }],
    });

    expect(resolveImportedTitle("Mac 内存占用机制", source)).toBe("Mac 内存占用机制");
  });

  it("recovers Markdown titles from frontmatter or the first body heading", () => {
    expect(resolveImportedTitle(
      "---",
      "---\ntitle: \"清明家族记录\"\ntags: [家族]\n---\n# 正文标题\n正文",
    )).toBe("清明家族记录");
    expect(resolveImportedTitle(
      "---",
      "---\ntags: [家族]\n---\n# 清明祭祖\n家族线索",
    )).toBe("清明祭祖");
  });

  it("extracts the readable Chinese title from styled HTML instead of exposing markup", () => {
    const source = [
      "---",
      "tags: [领域, 个人, 八字]",
      "---",
      "",
      '<div style="border:1px solid #e5e7eb;">',
      '<div style="font-size:13px;">Bazi Monthly Journal · Restored Visual Edition</div>',
      '<div style="font-size:30px;font-weight:900;">052 个人八字丙午年壬辰月</div>',
      '<div style="margin-top:10px;">本版基于备份原文逐条重排。</div>',
      "</div>",
      "",
      "## 2026年4月5日",
    ].join("\n");

    expect(resolveImportedTitle("---", source)).toBe("052 个人八字丙午年壬辰月");
    expect(shouldDisplaySummary("tags: [领域, 个人, 八字]")).toBe(false);
  });
});
