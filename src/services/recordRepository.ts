import { invoke } from "@tauri-apps/api/core";
import {
  confirmedFacts,
  defaultJudgment,
  evidence,
  nextActions,
  openQuestions,
  records as demoCards,
  versions as demoVersions,
} from "../mockData";
import {
  dataLocationSchema,
  favoriteUpdateSchema,
  importPreviewSchema,
  importResultSchema,
  exportResultSchema,
  restoreResultSchema,
  intelligenceRecordSchema,
  recordVersionSchema,
  tagItemSchema,
  type CommandError,
  type CreateRecordInput,
  type DataLocation,
  type FavoriteUpdate,
  type IntelligenceRecord,
  type ImportPreview,
  type ImportResult,
  type ExportResult,
  type RestoreResult,
  type RecordQuery,
  type RecordSourceInput,
  type RecordVersion,
  type TagItem,
  type UpdateRecordInput,
} from "../domain/models";

export interface RecordRepository {
  listRecords(query?: RecordQuery): Promise<IntelligenceRecord[]>;
  getRecord(recordId: number): Promise<IntelligenceRecord>;
  createRecord(input: CreateRecordInput): Promise<IntelligenceRecord>;
  updateRecord(recordId: number, input: UpdateRecordInput): Promise<IntelligenceRecord>;
  setFavorite(recordId: number, isFavorite: boolean): Promise<FavoriteUpdate>;
  moveToTrash(recordId: number): Promise<IntelligenceRecord>;
  restoreRecord(recordId: number): Promise<IntelligenceRecord>;
  permanentlyDeleteRecord(recordId: number, confirmationTitle: string): Promise<void>;
  appendVersion(recordId: number, versionTitle: string, changeNote: string): Promise<RecordVersion>;
  listVersions(recordId: number): Promise<RecordVersion[]>;
  restoreVersion(recordId: number, versionId: number): Promise<RecordVersion>;
  listTags(): Promise<TagItem[]>;
  createTag(name: string, colorKey?: string): Promise<TagItem>;
  renameTag(tagId: number, name: string): Promise<TagItem>;
  deleteTag(tagId: number): Promise<void>;
  getDataLocation(): Promise<DataLocation>;
  openDataDirectory(): Promise<void>;
  rebuildSearchIndex(): Promise<void>;
  runIntegrityCheck(): Promise<string>;
  prepareImport(sourcePath: string): Promise<ImportPreview>;
  confirmImport(jobId: string, records: CreateRecordInput[], allowDuplicate?: boolean): Promise<ImportResult>;
  exportRecord(recordId: number, format: "md" | "json"): Promise<ExportResult>;
  exportAllJson(): Promise<ExportResult>;
  createBackup(): Promise<string>;
  restoreBackup(sourcePath: string): Promise<RestoreResult>;
  openExportDirectory(): Promise<void>;
}

export class RepositoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
  }
}

class TauriRecordRepository implements RecordRepository {
  async listRecords(query: RecordQuery = {}): Promise<IntelligenceRecord[]> {
    return intelligenceRecordSchema.array().parse(await invoke("list_records", { query }));
  }

  async getRecord(recordId: number): Promise<IntelligenceRecord> {
    return intelligenceRecordSchema.parse(await invoke("get_record", { recordId }));
  }

  async createRecord(input: CreateRecordInput): Promise<IntelligenceRecord> {
    return intelligenceRecordSchema.parse(await invoke("create_record", { input }));
  }

  async updateRecord(recordId: number, input: UpdateRecordInput): Promise<IntelligenceRecord> {
    return intelligenceRecordSchema.parse(await invoke("update_record", { recordId, input }));
  }

  async setFavorite(recordId: number, isFavorite: boolean): Promise<FavoriteUpdate> {
    return favoriteUpdateSchema.parse(await invoke("set_favorite", { recordId, isFavorite }));
  }

  async moveToTrash(recordId: number): Promise<IntelligenceRecord> {
    return intelligenceRecordSchema.parse(await invoke("move_to_trash", { recordId }));
  }

  async restoreRecord(recordId: number): Promise<IntelligenceRecord> {
    return intelligenceRecordSchema.parse(await invoke("restore_record", { recordId }));
  }

  async permanentlyDeleteRecord(recordId: number, confirmationTitle: string): Promise<void> {
    await invoke("permanently_delete_record", {
      input: { recordId, confirmationTitle },
    });
  }

  async appendVersion(
    recordId: number,
    versionTitle: string,
    changeNote: string,
  ): Promise<RecordVersion> {
    return recordVersionSchema.parse(await invoke("append_version", {
      input: { recordId, versionTitle, changeNote },
    }));
  }

  async listVersions(recordId: number): Promise<RecordVersion[]> {
    return recordVersionSchema.array().parse(await invoke("list_versions", { recordId }));
  }

  async restoreVersion(recordId: number, versionId: number): Promise<RecordVersion> {
    return recordVersionSchema.parse(await invoke("restore_version", {
      input: { recordId, versionId },
    }));
  }

  async listTags(): Promise<TagItem[]> {
    return tagItemSchema.array().parse(await invoke("list_tags"));
  }

  async createTag(name: string, colorKey = "blue"): Promise<TagItem> {
    return tagItemSchema.parse(await invoke("create_tag", {
      input: { name, colorKey },
    }));
  }

  async renameTag(tagId: number, name: string): Promise<TagItem> {
    return tagItemSchema.parse(await invoke("rename_tag", {
      input: { tagId, name },
    }));
  }

  async deleteTag(tagId: number): Promise<void> {
    await invoke("delete_tag", { tagId });
  }

  async getDataLocation(): Promise<DataLocation> {
    return dataLocationSchema.parse(await invoke("get_data_location"));
  }

  async openDataDirectory(): Promise<void> {
    await invoke("open_data_directory");
  }

  async rebuildSearchIndex(): Promise<void> {
    await invoke("rebuild_search_index");
  }

  async runIntegrityCheck(): Promise<string> {
    return invoke<string>("run_integrity_check");
  }

  async prepareImport(sourcePath: string): Promise<ImportPreview> {
    return importPreviewSchema.parse(await invoke("prepare_import", { sourcePath }));
  }

  async confirmImport(
    jobId: string,
    records: CreateRecordInput[],
    allowDuplicate = false,
  ): Promise<ImportResult> {
    return importResultSchema.parse(await invoke("confirm_import", {
      input: { jobId, records, allowDuplicate },
    }));
  }

  async exportRecord(recordId: number, format: "md" | "json"): Promise<ExportResult> {
    return exportResultSchema.parse(await invoke("export_record", { recordId, format }));
  }

  async exportAllJson(): Promise<ExportResult> {
    return exportResultSchema.parse(await invoke("export_all_json"));
  }

  async createBackup(): Promise<string> {
    return invoke<string>("create_backup");
  }

  async restoreBackup(sourcePath: string): Promise<RestoreResult> {
    return restoreResultSchema.parse(await invoke("restore_backup", { sourcePath }));
  }

  async openExportDirectory(): Promise<void> {
    await invoke("open_export_directory");
  }
}

type DemoState = {
  records: IntelligenceRecord[];
  versions: RecordVersion[];
  nextRecordId: number;
  nextVersionId: number;
};

const DEMO_STORAGE_KEY = "nanfeng-intelligence-demo-v2";

export class BrowserRecordRepository implements RecordRepository {
  private state: DemoState;
  private readonly persist: boolean;

  constructor(options: { persist?: boolean; empty?: boolean } = {}) {
    this.persist = options.persist ?? true;
    this.state = options.empty ? emptyDemoState() : this.loadState();
  }

  async listRecords(query: RecordQuery = {}): Promise<IntelligenceRecord[]> {
    const search = query.search?.trim().toLocaleLowerCase();
    return this.state.records
      .filter((record) => query.deletedOnly ? record.isDeleted : query.includeDeleted || !record.isDeleted)
      .filter((record) => !query.status || record.status === query.status)
      .filter((record) => !query.tag || record.tags.includes(query.tag))
      .filter((record) => !query.source || record.sources.some((source) =>
        source.title.includes(query.source!) || source.sourceType === query.source))
      .filter((record) => !query.favoritesOnly || record.isFavorite)
      .filter((record) => !query.dateFrom || record.updatedAt >= query.dateFrom)
      .filter((record) => !query.dateTo || record.updatedAt <= query.dateTo)
      .filter((record) => {
        if (!search) return true;
        return searchableText(record).toLocaleLowerCase().includes(search);
      })
      .sort((a, b) => compareRecords(a, b, query.sort))
      .map(clone);
  }

  async getRecord(recordId: number): Promise<IntelligenceRecord> {
    return clone(this.requireRecord(recordId));
  }

  async createRecord(input: CreateRecordInput): Promise<IntelligenceRecord> {
    const title = input.title.trim();
    if (!title) throw new RepositoryError("validation_error", "记录标题不能为空");
    const timestamp = new Date().toISOString();
    const record: IntelligenceRecord = {
      id: this.state.nextRecordId++,
      title,
      summary: input.summary?.trim() ?? "",
      status: input.status ?? "normal",
      tags: normalizedTags(input.tags ?? []),
      currentJudgment: input.currentJudgment ?? "",
      confirmedFacts: input.confirmedFacts ?? [],
      keyEvidence: input.keyEvidence ?? [],
      openQuestions: input.openQuestions ?? [],
      nextActions: input.nextActions ?? [],
      notes: input.notes ?? "",
      sourceText: input.sourceText ?? "",
      sources: (input.sources ?? []).map((source, index) => ({
        ...source,
        id: Date.now() + index,
        recordId: this.state.nextRecordId - 1,
        createdAt: timestamp,
      })),
      isFavorite: input.isFavorite ?? false,
      isDeleted: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      versionCount: 1,
    };
    this.state.records.push(record);
    this.state.versions.push(this.createVersion(record, "初始版本", "创建记录", 1));
    this.save();
    return clone(record);
  }

  async updateRecord(recordId: number, input: UpdateRecordInput): Promise<IntelligenceRecord> {
    const record = this.requireRecord(recordId);
    if (!input.title.trim()) throw new RepositoryError("validation_error", "记录标题不能为空");
    const updatedAt = new Date().toISOString();
    Object.assign(record, {
      ...input,
      title: input.title.trim(),
      summary: input.summary.trim(),
      tags: normalizedTags(input.tags),
      sources: input.sources.map((source, index) => ({
        ...source,
        id: record.sources[index]?.id ?? Date.now() + index,
        recordId,
        createdAt: record.sources[index]?.createdAt ?? updatedAt,
      })),
      updatedAt,
    });
    this.save();
    return clone(record);
  }

  async setFavorite(recordId: number, isFavorite: boolean): Promise<FavoriteUpdate> {
    const record = this.requireRecord(recordId);
    record.isFavorite = isFavorite;
    record.updatedAt = new Date().toISOString();
    this.save();
    return {
      recordId,
      isFavorite,
      updatedAt: record.updatedAt,
    };
  }

  async moveToTrash(recordId: number): Promise<IntelligenceRecord> {
    const record = this.requireRecord(recordId);
    record.isDeleted = true;
    record.deletedAt = new Date().toISOString();
    record.updatedAt = record.deletedAt;
    this.save();
    return clone(record);
  }

  async restoreRecord(recordId: number): Promise<IntelligenceRecord> {
    const record = this.requireRecord(recordId);
    record.isDeleted = false;
    record.deletedAt = null;
    record.updatedAt = new Date().toISOString();
    this.save();
    return clone(record);
  }

  async permanentlyDeleteRecord(recordId: number, confirmationTitle: string): Promise<void> {
    const record = this.requireRecord(recordId);
    if (!record.isDeleted) {
      throw new RepositoryError("conflict", "记录必须先进入回收站，才能永久删除");
    }
    if (confirmationTitle !== record.title) {
      throw new RepositoryError("validation_error", "确认文字必须与记录标题完全一致");
    }
    this.state.records = this.state.records.filter((item) => item.id !== recordId);
    this.state.versions = this.state.versions.filter((item) => item.recordId !== recordId);
    this.save();
  }

  async appendVersion(
    recordId: number,
    versionTitle: string,
    changeNote: string,
  ): Promise<RecordVersion> {
    const record = this.requireRecord(recordId);
    const nextNumber = Math.max(
      0,
      ...this.state.versions.filter((item) => item.recordId === recordId).map((item) => item.versionNumber),
    ) + 1;
    const version = this.createVersion(record, versionTitle || `版本 v${nextNumber}`, changeNote, nextNumber);
    this.state.versions.push(version);
    record.versionCount = nextNumber;
    this.save();
    return clone(version);
  }

  async listVersions(recordId: number): Promise<RecordVersion[]> {
    this.requireRecord(recordId);
    return this.state.versions
      .filter((version) => version.recordId === recordId)
      .sort((a, b) => b.versionNumber - a.versionNumber)
      .map(clone);
  }

  async restoreVersion(recordId: number, versionId: number): Promise<RecordVersion> {
    const record = this.requireRecord(recordId);
    const version = this.state.versions.find((item) =>
      item.id === versionId && item.recordId === recordId);
    if (!version) throw new RepositoryError("not_found", "历史版本不存在");
    const preserved = {
      id: record.id,
      isDeleted: record.isDeleted,
      deletedAt: record.deletedAt,
      isFavorite: record.isFavorite,
      createdAt: record.createdAt,
    };
    Object.assign(record, clone(version.snapshot), preserved, {
      updatedAt: new Date().toISOString(),
    });
    return this.appendVersion(
      recordId,
      `恢复自 v${version.versionNumber}`,
      "恢复旧版本并生成新版本，未覆盖历史",
    );
  }

  async listTags(): Promise<TagItem[]> {
    const names = [...new Set(this.state.records.flatMap((record) => record.tags))];
    return names.map((name, index) => ({
      id: index + 1,
      name,
      colorKey: "blue",
      recordCount: this.state.records.filter((record) => !record.isDeleted && record.tags.includes(name)).length,
      createdAt: this.state.records[0]?.createdAt ?? new Date().toISOString(),
    })).sort((a, b) => b.recordCount - a.recordCount || a.name.localeCompare(b.name));
  }

  async createTag(name: string, colorKey = "blue"): Promise<TagItem> {
    const normalized = name.trim();
    if (!normalized) throw new RepositoryError("validation_error", "标签名称不能为空");
    const tags = await this.listTags();
    if (tags.some((tag) => tag.name === normalized)) {
      throw new RepositoryError("conflict", "标签名称已存在");
    }
    return {
      id: tags.length + 1,
      name: normalized,
      colorKey,
      recordCount: 0,
      createdAt: new Date().toISOString(),
    };
  }

  async renameTag(tagId: number, name: string): Promise<TagItem> {
    const tags = await this.listTags();
    const current = tags.find((tag) => tag.id === tagId);
    if (!current) throw new RepositoryError("not_found", "标签不存在");
    const normalized = name.trim();
    if (!normalized) throw new RepositoryError("validation_error", "标签名称不能为空");
    for (const record of this.state.records) {
      record.tags = record.tags.map((tag) => tag === current.name ? normalized : tag);
    }
    this.save();
    return { ...current, name: normalized };
  }

  async deleteTag(tagId: number): Promise<void> {
    const tags = await this.listTags();
    const current = tags.find((tag) => tag.id === tagId);
    if (!current) throw new RepositoryError("not_found", "标签不存在");
    for (const record of this.state.records) {
      record.tags = record.tags.filter((tag) => tag !== current.name);
    }
    this.save();
  }

  async getDataLocation(): Promise<DataLocation> {
    return {
      root: "浏览器演示数据",
      database: "浏览器内存",
      imports: "未启用",
      attachments: "未启用",
      exports: "未启用",
      backups: "未启用",
      logs: "浏览器控制台",
    };
  }

  async openDataDirectory(): Promise<void> {
    throw new RepositoryError("unsupported", "浏览器演示模式没有本地数据目录");
  }

  async rebuildSearchIndex(): Promise<void> {
    return Promise.resolve();
  }

  async runIntegrityCheck(): Promise<string> {
    return "ok";
  }

  async prepareImport(): Promise<ImportPreview> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能读取本机文件");
  }

  async confirmImport(): Promise<ImportResult> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能写入桌面导入任务");
  }

  async exportRecord(recordId: number, format: "md" | "json"): Promise<ExportResult> {
    const record = await this.getRecord(recordId);
    return {
      format,
      filePath: `浏览器下载：${record.title}.${format}`,
      recordCount: 1,
    };
  }

  async exportAllJson(): Promise<ExportResult> {
    return {
      format: "json",
      filePath: "浏览器演示不写入导出目录",
      recordCount: this.state.records.length,
    };
  }

  async createBackup(): Promise<string> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能创建数据库备份");
  }

  async restoreBackup(): Promise<RestoreResult> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能恢复数据库备份");
  }

  async openExportDirectory(): Promise<void> {
    throw new RepositoryError("unsupported", "浏览器演示模式没有导出目录");
  }

  private createVersion(
    record: IntelligenceRecord,
    versionTitle: string,
    changeNote: string,
    versionNumber: number,
  ): RecordVersion {
    return {
      id: this.state.nextVersionId++,
      recordId: record.id,
      versionNumber,
      versionTitle,
      changeNote,
      snapshot: clone(record),
      createdAt: new Date().toISOString(),
    };
  }

  private requireRecord(recordId: number): IntelligenceRecord {
    const record = this.state.records.find((item) => item.id === recordId);
    if (!record) throw new RepositoryError("not_found", "记录不存在");
    return record;
  }

  private loadState(): DemoState {
    if (this.persist && typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(DEMO_STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved) as DemoState;
        } catch {
          localStorage.removeItem(DEMO_STORAGE_KEY);
        }
      }
    }
    return seededDemoState();
  }

  private save(): void {
    if (this.persist && typeof localStorage !== "undefined") {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(this.state));
    }
  }
}

let repository: RecordRepository | undefined;

export function getRecordRepository(): RecordRepository {
  if (!repository) {
    repository = isTauriRuntime()
      ? new SafeTauriRepository(new TauriRecordRepository())
      : new BrowserRecordRepository();
  }
  return repository;
}

class SafeTauriRepository implements RecordRepository {
  constructor(private readonly inner: RecordRepository) {}

  private async run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw normalizeCommandError(error);
    }
  }

  listRecords = (query?: RecordQuery) => this.run(() => this.inner.listRecords(query));
  getRecord = (recordId: number) => this.run(() => this.inner.getRecord(recordId));
  createRecord = (input: CreateRecordInput) => this.run(() => this.inner.createRecord(input));
  updateRecord = (recordId: number, input: UpdateRecordInput) =>
    this.run(() => this.inner.updateRecord(recordId, input));
  setFavorite = (recordId: number, isFavorite: boolean) =>
    this.run(() => this.inner.setFavorite(recordId, isFavorite));
  moveToTrash = (recordId: number) => this.run(() => this.inner.moveToTrash(recordId));
  restoreRecord = (recordId: number) => this.run(() => this.inner.restoreRecord(recordId));
  permanentlyDeleteRecord = (recordId: number, confirmationTitle: string) =>
    this.run(() => this.inner.permanentlyDeleteRecord(recordId, confirmationTitle));
  appendVersion = (recordId: number, versionTitle: string, changeNote: string) =>
    this.run(() => this.inner.appendVersion(recordId, versionTitle, changeNote));
  listVersions = (recordId: number) => this.run(() => this.inner.listVersions(recordId));
  restoreVersion = (recordId: number, versionId: number) =>
    this.run(() => this.inner.restoreVersion(recordId, versionId));
  listTags = () => this.run(() => this.inner.listTags());
  createTag = (name: string, colorKey?: string) =>
    this.run(() => this.inner.createTag(name, colorKey));
  renameTag = (tagId: number, name: string) => this.run(() => this.inner.renameTag(tagId, name));
  deleteTag = (tagId: number) => this.run(() => this.inner.deleteTag(tagId));
  getDataLocation = () => this.run(() => this.inner.getDataLocation());
  openDataDirectory = () => this.run(() => this.inner.openDataDirectory());
  rebuildSearchIndex = () => this.run(() => this.inner.rebuildSearchIndex());
  runIntegrityCheck = () => this.run(() => this.inner.runIntegrityCheck());
  prepareImport = (sourcePath: string) => this.run(() => this.inner.prepareImport(sourcePath));
  confirmImport = (jobId: string, records: CreateRecordInput[], allowDuplicate?: boolean) =>
    this.run(() => this.inner.confirmImport(jobId, records, allowDuplicate));
  exportRecord = (recordId: number, format: "md" | "json") =>
    this.run(() => this.inner.exportRecord(recordId, format));
  exportAllJson = () => this.run(() => this.inner.exportAllJson());
  createBackup = () => this.run(() => this.inner.createBackup());
  restoreBackup = (sourcePath: string) => this.run(() => this.inner.restoreBackup(sourcePath));
  openExportDirectory = () => this.run(() => this.inner.openExportDirectory());
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function normalizeCommandError(error: unknown): RepositoryError {
  if (error instanceof RepositoryError) return error;
  if (typeof error === "object" && error && "message" in error) {
    const commandError = error as Partial<CommandError>;
    return new RepositoryError(commandError.code ?? "unknown_error", String(commandError.message));
  }
  return new RepositoryError("unknown_error", String(error));
}

function compareRecords(
  a: IntelligenceRecord,
  b: IntelligenceRecord,
  sort: RecordQuery["sort"],
): number {
  if (sort === "oldest") return a.updatedAt.localeCompare(b.updatedAt) || a.id - b.id;
  if (sort === "title") return a.title.localeCompare(b.title, "zh-CN") || a.id - b.id;
  if (sort === "created_desc") return b.createdAt.localeCompare(a.createdAt) || b.id - a.id;
  return b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id;
}

function searchableText(record: IntelligenceRecord): string {
  return [
    record.title,
    record.summary,
    record.currentJudgment,
    ...record.confirmedFacts,
    ...record.keyEvidence.flatMap((item) => [item.content, item.source]),
    ...record.openQuestions,
    ...record.nextActions,
    record.notes,
    record.sourceText,
    ...record.tags,
    ...record.sources.map((source) => source.title),
  ].join("\n");
}

function normalizedTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-CN"));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function emptyDemoState(): DemoState {
  return {
    records: [],
    versions: [],
    nextRecordId: 1,
    nextVersionId: 1,
  };
}

function seededDemoState(): DemoState {
  const timestampBase = "2026-07-25T10:32:00+08:00";
  const records = demoCards.map<IntelligenceRecord>((record) => {
    const sourceInput: RecordSourceInput = {
      sourceType: "research",
      title: record.source,
      url: null,
      localPath: null,
      externalId: null,
    };
    return {
      id: record.id,
      title: record.title,
      summary: record.summary,
      status: "tracking",
      tags: record.tags,
      currentJudgment: record.id === 3 ? defaultJudgment : record.summary,
      confirmedFacts: record.id === 3 ? confirmedFacts : [],
      keyEvidence: record.id === 3
        ? evidence.map((item) => ({ content: item.title, source: item.source }))
        : [],
      openQuestions: record.id === 3 ? openQuestions : [],
      nextActions: record.id === 3 ? nextActions : [],
      notes: "",
      sourceText: record.summary,
      sources: [{
        ...sourceInput,
        id: record.id,
        recordId: record.id,
        createdAt: timestampBase,
      }],
      isFavorite: false,
      isDeleted: false,
      createdAt: `2026-${record.date}T09:00:00+08:00`,
      updatedAt: record.id === 3 ? timestampBase : `2026-${record.date}T10:00:00+08:00`,
      deletedAt: null,
      versionCount: record.id === 3 ? demoVersions.length : 1,
    };
  });
  const selected = records.find((record) => record.id === 3)!;
  const versions = demoVersions.map<RecordVersion>((version, index) => ({
    id: index + 1,
    recordId: selected.id,
    versionNumber: Number(version.version.slice(1)),
    versionTitle: version.note,
    changeNote: version.note,
    snapshot: clone(selected),
    createdAt: version.date.replace(" ", "T") + "+08:00",
  }));
  return {
    records,
    versions,
    nextRecordId: Math.max(...records.map((record) => record.id)) + 1,
    nextVersionId: versions.length + 1,
  };
}
