import { describe, expect, it } from "vitest";
import { groupSourceAttachmentsByMonth } from "./sourceAttachmentCatalog";
import type { SourceAttachmentCatalogHit } from "../services/knowledgeRepository";

const hit = (key: string, date: string | null): SourceAttachmentCatalogHit => ({
  key,
  sourceItemId: 1,
  recordId: 1,
  fileUuid: key,
  fileName: `${key}.pdf`,
  mimeType: "application/pdf",
  sizeBytes: 10,
  availability: "recoverable",
  attachment: null,
  recordTitle: "笔记",
  recordSummary: "",
  recordOriginalAt: date,
});

describe("source attachment month catalog", () => {
  it("按年月分组并保留未加载声明，而不是把全部文件压成一个列表", () => {
    expect(groupSourceAttachmentsByMonth([
      hit("a", "2026-07-25T10:00:00Z"),
      hit("b", "2026-07-03T10:00:00Z"),
      hit("c", "2026-06-29T10:00:00Z"),
      hit("d", null),
    ]).map((group) => [group.label, group.hits.length])).toEqual([
      ["2026年7月", 2],
      ["2026年6月", 1],
      ["日期未记录", 1],
    ]);
  });
});
