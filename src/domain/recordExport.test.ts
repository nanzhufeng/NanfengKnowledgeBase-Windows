import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import type { IntelligenceRecord } from "./models";
import { composeRecordMarkdown, createRecordDocx } from "./recordExport";

function makeRecord(): IntelligenceRecord {
  return {
    id: 9,
    title: "完整笔记导出验收",
    summary: "This English overview must not replace the actual conversation content.",
    status: "normal",
    tags: ["导出"],
    currentJudgment: "保留实际记录内容。",
    confirmedFacts: ["事实一"],
    keyEvidence: [{ content: "证据一", source: "本地对话" }],
    openQuestions: ["问题一"],
    nextActions: ["行动一"],
    notes: "备注",
    sourceText: JSON.stringify({
      chat_messages: [
        { sender: "human", text: "用户的真实问题" },
        {
          sender: "assistant",
          text: "助手的真实回答",
          files: [{
            file_uuid: "image-1",
            file_name: "证据图.png",
            file_type: "image/png",
          }],
          content: [
            { type: "text", text: "助手的真实回答" },
            { type: "image", file_uuid: "image-1" },
          ],
        },
      ],
    }),
    sources: [],
    isFavorite: false,
    isDeleted: false,
    originalAt: "2026-07-25T10:00:00Z",
    createdAt: "2026-07-25T10:00:00Z",
    updatedAt: "2026-07-25T10:00:00Z",
    deletedAt: null,
    versionCount: 1,
  };
}

describe("record export", () => {
  it("uses complete source messages instead of an English summary", () => {
    const markdown = composeRecordMarkdown(makeRecord());
    expect(markdown).toContain("### 用户");
    expect(markdown).toContain("用户的真实问题");
    expect(markdown).toContain("助手的真实回答");
    expect(markdown).toContain("![证据图.png]");
    expect(markdown).not.toContain("This English overview");
  });

  it("creates a DOCX zip payload from the same Markdown", async () => {
    const bytes = await createRecordDocx(composeRecordMarkdown(makeRecord()));
    expect(String.fromCharCode(...bytes.slice(0, 2))).toBe("PK");
    expect(bytes.byteLength).toBeGreaterThan(1_000);
  });

  it("does not turn Markdown spacer lines into empty DOCX paragraphs", async () => {
    const bytes = await createRecordDocx("# 标题\n\n\n第一段\n\n\n\n第二段");
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(documentXml).toBeTruthy();
    expect(documentXml).not.toMatch(/<w:p(?:\s[^>]*)?>\s*<\/w:p>/);
    expect(documentXml).not.toMatch(/<w:t(?:\s[^>]*)?><\/w:t>/);
  });
});
