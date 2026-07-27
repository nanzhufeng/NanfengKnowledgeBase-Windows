import type { ImportPreview, ImportResult } from "./models";

export type ImportQueueStatus =
  | "queued"
  | "preparing"
  | "ready"
  | "importing"
  | "completed"
  | "partial"
  | "error";

export type ImportQueueItem = {
  id: string;
  sourcePath: string;
  fileName: string;
  status: ImportQueueStatus;
  preview?: ImportPreview;
  error?: string;
  importedCount?: number;
  skippedCount?: number;
};

export type ImportBatchSummary = {
  importedCount: number;
  skippedCount: number;
  failureCount: number;
  firstImportedRecordId?: number;
  importedSourceItemIds: number[];
};

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function normalizedPath(path: string): string {
  return path.trim().replace(/\//g, "\\").toLocaleLowerCase();
}

export function createImportQueueItems(
  paths: string[],
  existingPaths: string[] = [],
  createId: () => string = () => crypto.randomUUID(),
): ImportQueueItem[] {
  const seen = new Set(existingPaths.map(normalizedPath));
  return paths.flatMap((sourcePath) => {
    const path = sourcePath.trim();
    const key = normalizedPath(path);
    if (!path || seen.has(key)) return [];
    seen.add(key);
    return [{
      id: createId(),
      sourcePath: path,
      fileName: fileNameFromPath(path),
      status: "queued" as const,
    }];
  });
}

export async function prepareImportQueue(
  items: ImportQueueItem[],
  prepare: (sourcePath: string) => Promise<ImportPreview>,
  onUpdate: (item: ImportQueueItem) => void,
): Promise<ImportQueueItem[]> {
  const results: ImportQueueItem[] = [];
  for (const item of items) {
    const preparing = { ...item, status: "preparing" as const, error: undefined };
    onUpdate(preparing);
    try {
      const preview = await prepare(item.sourcePath);
      const ready = { ...preparing, status: "ready" as const, preview };
      results.push(ready);
      onUpdate(ready);
    } catch (error) {
      const failed = {
        ...preparing,
        status: "error" as const,
        error: error instanceof Error ? error.message : "读取导入文件失败",
      };
      results.push(failed);
      onUpdate(failed);
    }
  }
  return results;
}

export async function importReadyQueue(
  items: ImportQueueItem[],
  confirm: (item: ImportQueueItem) => Promise<ImportResult>,
  onUpdate: (item: ImportQueueItem) => void,
): Promise<ImportBatchSummary> {
  const summary: ImportBatchSummary = {
    importedCount: 0,
    skippedCount: 0,
    failureCount: 0,
    importedSourceItemIds: [],
  };
  for (const item of items.filter((candidate) => candidate.status === "ready" && candidate.preview)) {
    const importing = { ...item, status: "importing" as const, error: undefined };
    onUpdate(importing);
    try {
      const result = await confirm(importing);
      summary.importedCount += result.importedCount;
      summary.skippedCount += result.skippedCount;
      summary.firstImportedRecordId ??= result.firstImportedRecord?.id;
      summary.importedSourceItemIds.push(...result.importedSourceItemIds);
      if (result.errors.length) summary.failureCount += 1;
      onUpdate({
        ...importing,
        status: result.status === "failed"
          ? "error"
          : result.errors.length
            ? "partial"
            : "completed",
        error: result.errors.length ? result.errors.join("；") : undefined,
        importedCount: result.importedCount,
        skippedCount: result.skippedCount,
      });
    } catch (error) {
      summary.failureCount += 1;
      onUpdate({
        ...importing,
        status: "error",
        error: error instanceof Error ? error.message : "批量导入失败",
      });
    }
  }
  return summary;
}
