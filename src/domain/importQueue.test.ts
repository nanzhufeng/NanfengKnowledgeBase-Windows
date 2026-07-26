import { describe, expect, it, vi } from "vitest";
import {
  createImportQueueItems,
  importReadyQueue,
  prepareImportQueue,
  type ImportQueueItem,
} from "./importQueue";
import type { ImportPreview } from "./models";

function preview(fileName: string): ImportPreview {
  return {
    jobId: `job-${fileName}`,
    sourceFileName: fileName,
    storedFilePath: `D:\\南枫情报台\\imports\\raw\\${fileName}`,
    sha256: "a".repeat(64),
    fileKind: "md",
    sizeBytes: 128,
    duplicate: false,
    rawPreview: "# 内容",
    recordCount: 1,
    records: [],
    boundaryOptions: [],
    duplicateCandidates: [],
    warnings: [],
  };
}

describe("import queue", () => {
  it("deduplicates paths while retaining selection order", () => {
    let index = 0;
    const items = createImportQueueItems(
      ["D:/资料/A.md", "D:\\资料\\a.md", "D:\\资料\\B.json"],
      ["D:\\资料\\existing.txt"],
      () => `item-${++index}`,
    );

    expect(items.map((item) => item.fileName)).toEqual(["A.md", "B.json"]);
    expect(items.map((item) => item.id)).toEqual(["item-1", "item-2"]);
  });

  it("prepares files sequentially and isolates an invalid file", async () => {
    const items = createImportQueueItems(
      ["D:\\资料\\A.md", "D:\\资料\\bad.exe", "D:\\资料\\B.json"],
      [],
      (() => {
        let index = 0;
        return () => `item-${++index}`;
      })(),
    );
    let inFlight = 0;
    let maxInFlight = 0;
    const updates: ImportQueueItem[] = [];
    const results = await prepareImportQueue(items, async (path) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      if (path.endsWith(".exe")) throw new Error("不支持的文件类型");
      return preview(path.endsWith("A.md") ? "A.md" : "B.json");
    }, (item) => updates.push(item));

    expect(maxInFlight).toBe(1);
    expect(results.map((item) => item.status)).toEqual(["ready", "error", "ready"]);
    expect(results[1]?.error).toBe("不支持的文件类型");
    expect(updates.filter((item) => item.status === "preparing")).toHaveLength(3);
  });

  it("imports every ready file and keeps later files running after one failure", async () => {
    const items: ImportQueueItem[] = [
      { id: "1", sourcePath: "A.md", fileName: "A.md", status: "ready", preview: preview("A.md") },
      { id: "2", sourcePath: "B.md", fileName: "B.md", status: "ready", preview: preview("B.md") },
      { id: "3", sourcePath: "C.md", fileName: "C.md", status: "error", error: "解析失败" },
    ];
    const confirm = vi.fn(async (item: ImportQueueItem) => {
      if (item.id === "1") throw new Error("写入失败");
      return {
        jobId: `job-${item.id}`,
        status: "completed",
        importedCount: 2,
        skippedCount: 1,
        errors: [],
        firstImportedRecord: null,
      };
    });
    const updates: ImportQueueItem[] = [];

    const result = await importReadyQueue(items, confirm, (item) => updates.push(item));

    expect(confirm).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      importedCount: 2,
      skippedCount: 1,
      failureCount: 1,
    });
    expect(updates.at(-1)?.status).toBe("completed");
  });

  it("marks a partially imported file for review without stopping the queue", async () => {
    const item: ImportQueueItem = {
      id: "1",
      sourcePath: "mixed.json",
      fileName: "mixed.json",
      status: "ready",
      preview: preview("mixed.json"),
    };
    const updates: ImportQueueItem[] = [];
    const result = await importReadyQueue([item], async () => ({
      jobId: "job-mixed",
      status: "partial",
      importedCount: 3,
      skippedCount: 0,
      errors: ["第 4 条写入失败"],
      firstImportedRecord: { id: 9, title: "第一条" },
    }), (update) => updates.push(update));

    expect(result.failureCount).toBe(1);
    expect(updates.at(-1)).toMatchObject({
      status: "partial",
      importedCount: 3,
      error: "第 4 条写入失败",
    });
  });
});
