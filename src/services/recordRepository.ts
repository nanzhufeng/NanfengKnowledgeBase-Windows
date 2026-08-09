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
  runtimeBuildInfoSchema,
  dataMigrationPreviewSchema,
  dataMigrationResultSchema,
  dataOptimizationPreviewSchema,
  dataOptimizationResultSchema,
  legacyAttachmentRecoveryPreviewSchema,
  legacyAttachmentRecoveryResultSchema,
  backupPreviewSchema,
  attachmentItemSchema,
  attachmentSearchHitSchema,
  favoriteUpdateSchema,
  importPreviewSchema,
  importResultSchema,
  importJobSummarySchema,
  exportResultSchema,
  portableBackupPreviewSchema,
  portableBackupResultSchema,
  portableRestoreResultSchema,
  restoreResultSchema,
  intelligenceRecordSchema,
  recordMutationSchema,
  recordSummarySchema,
  storageStatsSchema,
  recordVersionSchema,
  tagItemSchema,
  type CommandError,
  type BackupPreview,
  type AttachmentItem,
  type AttachmentSearchHit,
  type CreateRecordInput,
  type DataLocation,
  type RuntimeBuildInfo,
  type DataMigrationPreview,
  type DataMigrationResult,
  type FavoriteUpdate,
  type IntelligenceRecord,
  type ImportPreview,
  type ImportResult,
  type ImportJobSummary,
  type ExportResult,
  type ExportRecordsInput,
  type PortableBackupPreview,
  type PortableBackupResult,
  type PortableRestoreResult,
  type RestoreResult,
  type RecordQuery,
  type RecordMutation,
  type PatchRecordInput,
  type RecordSummary,
  type StorageStats,
  type DataOptimizationPreview,
  type DataOptimizationResult,
  type LegacyAttachmentRecoveryPreview,
  type LegacyAttachmentRecoveryResult,
  type RecordSourceInput,
  type RecordVersion,
  type TagItem,
  type UpdateRecordInput,
} from "../domain/models";

export interface RecordRepository {
  listRecords(query?: RecordQuery): Promise<IntelligenceRecord[]>;
  listRecordSummaries(query?: RecordQuery): Promise<RecordSummary[]>;
  getRecord(recordId: number): Promise<IntelligenceRecord>;
  createRecord(input: CreateRecordInput): Promise<IntelligenceRecord>;
  updateRecord(recordId: number, input: UpdateRecordInput): Promise<IntelligenceRecord>;
  patchRecord(recordId: number, input: PatchRecordInput): Promise<RecordMutation>;
  setFavorite(recordId: number, isFavorite: boolean): Promise<FavoriteUpdate>;
  updateCurrentJudgment(recordId: number, currentJudgment: string): Promise<RecordMutation>;
  updateStatus(recordId: number, status: IntelligenceRecord["status"]): Promise<RecordMutation>;
  moveToTrash(recordId: number): Promise<IntelligenceRecord>;
  restoreRecord(recordId: number): Promise<IntelligenceRecord>;
  permanentlyDeleteRecord(recordId: number): Promise<void>;
  appendVersion(recordId: number, versionTitle: string, changeNote: string): Promise<RecordVersion>;
  listVersions(recordId: number): Promise<RecordVersion[]>;
  deleteVersion(recordId: number, versionId: number): Promise<void>;
  restoreVersion(recordId: number, versionId: number): Promise<RecordVersion>;
  listTags(): Promise<TagItem[]>;
  createTag(name: string, colorKey?: string): Promise<TagItem>;
  renameTag(tagId: number, name: string): Promise<TagItem>;
  deleteTag(tagId: number): Promise<void>;
  getDataLocation(): Promise<DataLocation>;
  getRuntimeBuildInfo(): Promise<RuntimeBuildInfo>;
  inspectDataMigration(targetRoot: string): Promise<DataMigrationPreview>;
  migrateDataDirectory(targetRoot: string): Promise<DataMigrationResult>;
  rollbackDataDirectorySwitch(): Promise<string>;
  getStorageStats(): Promise<StorageStats>;
  inspectDataOptimization(): Promise<DataOptimizationPreview>;
  optimizeData(): Promise<DataOptimizationResult>;
  inspectLegacyAttachmentRecovery(sourceDirectory?: string): Promise<LegacyAttachmentRecoveryPreview>;
  recoverLegacyAttachmentRecovery(sourceDirectory?: string): Promise<LegacyAttachmentRecoveryResult>;
  openDataDirectory(): Promise<void>;
  rebuildSearchIndex(): Promise<void>;
  runIntegrityCheck(): Promise<string>;
  prepareImport(sourcePath: string): Promise<ImportPreview>;
  confirmImport(
    jobId: string,
    records: CreateRecordInput[],
    options?: ConfirmImportOptions,
  ): Promise<ImportResult>;
  cancelImport(jobId: string): Promise<void>;
  listImportJobs(): Promise<ImportJobSummary[]>;
  listAttachments(recordId: number): Promise<AttachmentItem[]>;
  searchAttachments(keyword: string, category: "all" | "image" | "video" | "audio" | "file", limit?: number): Promise<AttachmentSearchHit[]>;
  addAttachment(recordId: number, sourcePath: string): Promise<AttachmentItem>;
  openAttachment(attachmentId: number): Promise<void>;
  revealAttachment(attachmentId: number): Promise<void>;
  removeAttachment(attachmentId: number): Promise<void>;
  exportRecord(recordId: number, format: "md" | "json"): Promise<ExportResult>;
  writeDocxExport(fileName: string, bytes: number[]): Promise<ExportResult>;
  writeMarkdownExport(fileName: string, content: string): Promise<ExportResult>;
  copyExportedFile(filePath: string): Promise<void>;
  exportAllJson(): Promise<ExportResult>;
  exportRecords(input: ExportRecordsInput): Promise<ExportResult>;
  createBackup(): Promise<string>;
  restoreBackup(sourcePath: string): Promise<RestoreResult>;
  inspectBackup(sourcePath: string): Promise<BackupPreview>;
  createPortableBackup(preferencesJson: string): Promise<PortableBackupResult>;
  inspectPortableBackup(sourcePath: string): Promise<PortableBackupPreview>;
  restorePortableBackup(
    sourcePath: string,
    currentPreferencesJson: string,
  ): Promise<PortableRestoreResult>;
  openExportDirectory(): Promise<void>;
  revealExportedFile(filePath: string): Promise<void>;
}

export type ImportDuplicateStrategy = "skip" | "copy" | "version" | "manual";

export type ConfirmImportOptions = {
  duplicateStrategy?: ImportDuplicateStrategy;
  itemStrategies?: Array<Exclude<ImportDuplicateStrategy, "manual">>;
  mapping?: Record<string, string>;
};

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

  async listRecordSummaries(query: RecordQuery = {}): Promise<RecordSummary[]> {
    return recordSummarySchema.array().parse(await invoke("list_record_summaries", { query }));
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

  async patchRecord(recordId: number, input: PatchRecordInput): Promise<RecordMutation> {
    return recordMutationSchema.parse(await invoke("patch_record", { recordId, input }));
  }

  async setFavorite(recordId: number, isFavorite: boolean): Promise<FavoriteUpdate> {
    return favoriteUpdateSchema.parse(await invoke("set_favorite", { recordId, isFavorite }));
  }

  async updateCurrentJudgment(recordId: number, currentJudgment: string): Promise<RecordMutation> {
    return recordMutationSchema.parse(await invoke("update_current_judgment", {
      input: { recordId, currentJudgment },
    }));
  }

  async updateStatus(
    recordId: number,
    status: IntelligenceRecord["status"],
  ): Promise<RecordMutation> {
    return recordMutationSchema.parse(await invoke("update_status", {
      input: { recordId, status },
    }));
  }

  async moveToTrash(recordId: number): Promise<IntelligenceRecord> {
    return intelligenceRecordSchema.parse(await invoke("move_to_trash", { recordId }));
  }

  async restoreRecord(recordId: number): Promise<IntelligenceRecord> {
    return intelligenceRecordSchema.parse(await invoke("restore_record", { recordId }));
  }

  async permanentlyDeleteRecord(recordId: number): Promise<void> {
    await invoke("permanently_delete_record", {
      input: { recordId },
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

  async deleteVersion(recordId: number, versionId: number): Promise<void> {
    await invoke("delete_version", { input: { recordId, versionId } });
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

  async getRuntimeBuildInfo(): Promise<RuntimeBuildInfo> {
    return runtimeBuildInfoSchema.parse(await invoke("get_runtime_build_info"));
  }

  async inspectDataMigration(targetRoot: string): Promise<DataMigrationPreview> {
    return dataMigrationPreviewSchema.parse(await invoke("inspect_data_migration", { targetRoot }));
  }

  async migrateDataDirectory(targetRoot: string): Promise<DataMigrationResult> {
    return dataMigrationResultSchema.parse(await invoke("migrate_data_directory", { targetRoot, confirmed: true }));
  }

  async rollbackDataDirectorySwitch(): Promise<string> {
    return invoke<string>("rollback_data_directory_switch");
  }

  async getStorageStats(): Promise<StorageStats> {
    return storageStatsSchema.parse(await invoke("get_storage_stats"));
  }

  async inspectDataOptimization(): Promise<DataOptimizationPreview> {
    return dataOptimizationPreviewSchema.parse(await invoke("inspect_data_optimization"));
  }

  async optimizeData(): Promise<DataOptimizationResult> {
    return dataOptimizationResultSchema.parse(await invoke("optimize_data", { confirmed: true }));
  }

  async inspectLegacyAttachmentRecovery(sourceDirectory?: string): Promise<LegacyAttachmentRecoveryPreview> {
    return legacyAttachmentRecoveryPreviewSchema.parse(await invoke("inspect_legacy_attachment_recovery", { sourceDirectory }));
  }

  async recoverLegacyAttachmentRecovery(sourceDirectory?: string): Promise<LegacyAttachmentRecoveryResult> {
    return legacyAttachmentRecoveryResultSchema.parse(await invoke("recover_legacy_attachment_recovery", { confirmed: true, sourceDirectory }));
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
    _records: CreateRecordInput[],
    options: ConfirmImportOptions = {},
  ): Promise<ImportResult> {
    return importResultSchema.parse(await invoke("confirm_import", {
      input: {
        jobId,
        allowDuplicate: false,
        duplicateStrategy: options.duplicateStrategy ?? "skip",
        itemStrategies: options.itemStrategies ?? [],
        mapping: options.mapping ?? {},
      },
    }));
  }

  async cancelImport(jobId: string): Promise<void> {
    await invoke("cancel_import", { jobId });
  }

  async listImportJobs(): Promise<ImportJobSummary[]> {
    return importJobSummarySchema.array().parse(await invoke("list_import_jobs"));
  }

  async listAttachments(recordId: number): Promise<AttachmentItem[]> {
    return attachmentItemSchema.array().parse(await invoke("list_attachments", { recordId }));
  }

  async searchAttachments(
    keyword: string,
    category: "all" | "image" | "video" | "audio" | "file",
    limit?: number,
  ): Promise<AttachmentSearchHit[]> {
    return attachmentSearchHitSchema.array().parse(await invoke("search_attachments", { keyword, category, limit }));
  }

  async addAttachment(recordId: number, sourcePath: string): Promise<AttachmentItem> {
    return attachmentItemSchema.parse(await invoke("add_attachment", { recordId, sourcePath }));
  }

  async openAttachment(attachmentId: number): Promise<void> {
    await invoke("open_attachment", { attachmentId });
  }

  async revealAttachment(attachmentId: number): Promise<void> {
    await invoke("reveal_attachment", { attachmentId });
  }

  async removeAttachment(attachmentId: number): Promise<void> {
    await invoke("remove_attachment", { attachmentId });
  }

  async exportRecord(recordId: number, format: "md" | "json"): Promise<ExportResult> {
    return exportResultSchema.parse(await invoke("export_record", { recordId, format }));
  }

  async writeDocxExport(fileName: string, bytes: number[]): Promise<ExportResult> {
    return exportResultSchema.parse(await invoke("write_docx_export", { fileName, bytes }));
  }

  async writeMarkdownExport(fileName: string, content: string): Promise<ExportResult> {
    return exportResultSchema.parse(await invoke("write_markdown_export", { fileName, content }));
  }

  async copyExportedFile(filePath: string): Promise<void> {
    await invoke("copy_exported_file", { filePath });
  }

  async exportAllJson(): Promise<ExportResult> {
    return exportResultSchema.parse(await invoke("export_all_json"));
  }

  async exportRecords(input: ExportRecordsInput): Promise<ExportResult> {
    return exportResultSchema.parse(await invoke("export_records", { input }));
  }

  async createBackup(): Promise<string> {
    return invoke<string>("create_backup");
  }

  async restoreBackup(sourcePath: string): Promise<RestoreResult> {
    return restoreResultSchema.parse(await invoke("restore_backup", { sourcePath }));
  }

  async inspectBackup(sourcePath: string): Promise<BackupPreview> {
    return backupPreviewSchema.parse(await invoke("inspect_backup", { sourcePath }));
  }

  async createPortableBackup(preferencesJson: string): Promise<PortableBackupResult> {
    return portableBackupResultSchema.parse(await invoke("create_portable_backup", {
      preferencesJson,
    }));
  }

  async inspectPortableBackup(sourcePath: string): Promise<PortableBackupPreview> {
    return portableBackupPreviewSchema.parse(await invoke("inspect_portable_backup", {
      sourcePath,
    }));
  }

  async restorePortableBackup(
    sourcePath: string,
    currentPreferencesJson: string,
  ): Promise<PortableRestoreResult> {
    return portableRestoreResultSchema.parse(await invoke("restore_portable_backup", {
      sourcePath,
      currentPreferencesJson,
    }));
  }

  async openExportDirectory(): Promise<void> {
    await invoke("open_export_directory");
  }

  async revealExportedFile(filePath: string): Promise<void> {
    await invoke("reveal_exported_file", { filePath });
  }
}

type DemoState = {
  records: IntelligenceRecord[];
  versions: RecordVersion[];
  nextRecordId: number;
  nextVersionId: number;
};

const DEMO_STORAGE_KEY = "nanfeng-knowledge-base-demo-v2";
const LEGACY_DEMO_STORAGE_KEY = "nanfeng-intelligence-demo-v2";

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
      .filter((record) => !query.dateFrom || (record.originalAt ?? record.updatedAt) >= query.dateFrom)
      .filter((record) => !query.dateTo || (record.originalAt ?? record.updatedAt) <= query.dateTo)
      .filter((record) => {
        if (!search) return true;
        return searchableText(record).toLocaleLowerCase().includes(search);
      })
      .sort((a, b) => compareRecords(a, b, query.sort))
      .map(clone);
  }

  async listRecordSummaries(query: RecordQuery = {}): Promise<RecordSummary[]> {
    return (await this.listRecords(query)).map((record) => ({
      id: record.id,
      title: record.title,
      displayTitle: record.title,
      summary: record.summary,
      status: record.status,
      tags: record.tags,
      sourceTitle: record.sources[0]?.title ?? "",
      searchSnippet: record.summary,
      isFavorite: record.isFavorite,
      isDeleted: record.isDeleted,
      originalAt: record.originalAt ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
      versionCount: record.versionCount,
    }));
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
      originalAt: input.originalAt ?? null,
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

  async patchRecord(recordId: number, input: PatchRecordInput): Promise<RecordMutation> {
    const record = this.requireRecord(recordId);
    Object.assign(record, input, { updatedAt: new Date().toISOString() });
    if (input.tags) record.tags = normalizedTags(input.tags);
    if (input.sources) {
      record.sources = input.sources.map((source, index) => ({
        ...source,
        id: record.sources[index]?.id ?? Date.now() + index,
        recordId,
        createdAt: record.sources[index]?.createdAt ?? record.updatedAt,
      }));
    }
    this.save();
    return { recordId, updatedAt: record.updatedAt };
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

  async updateCurrentJudgment(
    recordId: number,
    currentJudgment: string,
  ): Promise<RecordMutation> {
    const record = this.requireRecord(recordId);
    record.currentJudgment = currentJudgment;
    record.updatedAt = new Date().toISOString();
    this.save();
    return { recordId, updatedAt: record.updatedAt };
  }

  async updateStatus(
    recordId: number,
    status: IntelligenceRecord["status"],
  ): Promise<RecordMutation> {
    const record = this.requireRecord(recordId);
    record.status = status;
    record.updatedAt = new Date().toISOString();
    this.save();
    return { recordId, updatedAt: record.updatedAt };
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

  async permanentlyDeleteRecord(recordId: number): Promise<void> {
    const record = this.requireRecord(recordId);
    if (!record.isDeleted) {
      throw new RepositoryError("conflict", "记录必须先进入回收站，才能永久删除");
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

  async deleteVersion(recordId: number, versionId: number): Promise<void> {
    const record = this.requireRecord(recordId);
    const versions = this.state.versions.filter((item) => item.recordId === recordId);
    if (versions.length <= 1) {
      throw new RepositoryError("conflict", "至少保留一个历史版本，不能删除最后一个版本");
    }
    const before = this.state.versions.length;
    this.state.versions = this.state.versions.filter(
      (item) => item.id !== versionId || item.recordId !== recordId,
    );
    if (before === this.state.versions.length) {
      throw new RepositoryError("not_found", "历史版本不存在");
    }
    record.versionCount = Math.max(1, record.versionCount - 1);
    this.save();
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

  async getRuntimeBuildInfo(): Promise<RuntimeBuildInfo> {
    return {
      version: "0.2.0",
      buildLabel: "浏览器演示",
      executableSizeBytes: 0,
      executableSha256: "浏览器演示不提供 EXE 校验",
    };
  }

  async inspectDataMigration(): Promise<DataMigrationPreview> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能预检数据目录迁移");
  }

  async migrateDataDirectory(): Promise<DataMigrationResult> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能迁移数据目录");
  }

  async rollbackDataDirectorySwitch(): Promise<string> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能撤销数据目录切换");
  }

  async getStorageStats(): Promise<StorageStats> {
    const records = this.state.records.filter((record) => !record.isDeleted);
    const totalBytes = new Blob([JSON.stringify(this.state)]).size;
    return {
      recordCount: records.length,
      databaseBytes: totalBytes,
      importsBytes: 0,
      attachmentsBytes: 0,
      backupsBytes: 0,
      totalBytes,
      diskAvailableBytes: 0,
      diskTotalBytes: 0,
      lastBackupAt: null,
    };
  }

  async inspectDataOptimization(): Promise<DataOptimizationPreview> {
    return {
      databaseReclaimableBytes: 0,
      duplicateBackupCount: 0,
      duplicateBackupBytes: 0,
      incompleteBackupCount: 0,
      incompleteBackupBytes: 0,
      estimatedReclaimableBytes: 0,
      protectedBusinessRecordCount: this.state.records.length,
    };
  }

  async optimizeData(): Promise<DataOptimizationResult> {
    throw new RepositoryError("unsupported", "浏览器演示模式不会清理本机数据");
  }

  async inspectLegacyAttachmentRecovery(_sourceDirectory?: string): Promise<LegacyAttachmentRecoveryPreview> {
    return {
      archiveCount: 0,
      recordCount: 0,
      recoverableAttachmentCount: 0,
      unresolvedAttachmentCount: 0,
    };
  }

  async recoverLegacyAttachmentRecovery(_sourceDirectory?: string): Promise<LegacyAttachmentRecoveryResult> {
    throw new RepositoryError("unsupported", "浏览器演示模式没有可恢复的本机附件");
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

  async cancelImport(): Promise<void> {}

  async listImportJobs(): Promise<ImportJobSummary[]> {
    return [];
  }

  async listAttachments(): Promise<AttachmentItem[]> {
    return [];
  }

  async searchAttachments(): Promise<AttachmentSearchHit[]> {
    return [];
  }

  async addAttachment(): Promise<AttachmentItem> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能添加附件");
  }

  async openAttachment(): Promise<void> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能打开附件");
  }

  async revealAttachment(): Promise<void> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能在资源管理器中定位附件");
  }

  async removeAttachment(): Promise<void> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能删除附件");
  }

  async exportRecord(recordId: number, format: "md" | "json"): Promise<ExportResult> {
    const record = await this.getRecord(recordId);
    return {
      format,
      filePath: `浏览器下载：${record.title}.${format}`,
      recordCount: 1,
    };
  }

  async writeDocxExport(fileName: string): Promise<ExportResult> {
    return {
      format: "docx",
      filePath: `浏览器下载：${fileName.replace(/\.docx$/i, "")}.docx`,
      recordCount: 1,
    };
  }

  async writeMarkdownExport(fileName: string): Promise<ExportResult> {
    return {
      format: "md",
      filePath: `浏览器下载/${fileName}`,
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

  async exportRecords(input: ExportRecordsInput): Promise<ExportResult> {
    const records = input.recordIds?.length
      ? this.state.records.filter((record) => input.recordIds?.includes(record.id))
      : await this.listRecords(input.query ?? {});
    if (!records.length) throw new RepositoryError("validation_error", "当前条件下没有可导出的记录");
    return {
      format: input.format,
      filePath: "浏览器演示模式不写入磁盘",
      recordCount: records.length,
    };
  }

  async createBackup(): Promise<string> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能创建数据库备份");
  }

  async restoreBackup(): Promise<RestoreResult> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能恢复数据库备份");
  }

  async inspectBackup(): Promise<BackupPreview> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能检查数据库备份");
  }

  async createPortableBackup(): Promise<PortableBackupResult> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能创建完整迁移备份");
  }

  async inspectPortableBackup(): Promise<PortableBackupPreview> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能检查完整迁移备份");
  }

  async restorePortableBackup(): Promise<PortableRestoreResult> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能恢复完整迁移备份");
  }

  async openExportDirectory(): Promise<void> {
    throw new RepositoryError("unsupported", "浏览器演示模式没有导出目录");
  }

  async revealExportedFile(): Promise<void> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能在资源管理器中定位文件");
  }

  async copyExportedFile(): Promise<void> {
    throw new RepositoryError("unsupported", "浏览器演示模式不能复制本机文件");
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
      const saved = localStorage.getItem(DEMO_STORAGE_KEY)
        ?? localStorage.getItem(LEGACY_DEMO_STORAGE_KEY);
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
  listRecordSummaries = (query?: RecordQuery) =>
    this.run(() => this.inner.listRecordSummaries(query));
  getRecord = (recordId: number) => this.run(() => this.inner.getRecord(recordId));
  createRecord = (input: CreateRecordInput) => this.run(() => this.inner.createRecord(input));
  updateRecord = (recordId: number, input: UpdateRecordInput) =>
    this.run(() => this.inner.updateRecord(recordId, input));
  patchRecord = (recordId: number, input: PatchRecordInput) =>
    this.run(() => this.inner.patchRecord(recordId, input));
  setFavorite = (recordId: number, isFavorite: boolean) =>
    this.run(() => this.inner.setFavorite(recordId, isFavorite));
  updateCurrentJudgment = (recordId: number, currentJudgment: string) =>
    this.run(() => this.inner.updateCurrentJudgment(recordId, currentJudgment));
  updateStatus = (recordId: number, status: IntelligenceRecord["status"]) =>
    this.run(() => this.inner.updateStatus(recordId, status));
  moveToTrash = (recordId: number) => this.run(() => this.inner.moveToTrash(recordId));
  restoreRecord = (recordId: number) => this.run(() => this.inner.restoreRecord(recordId));
  permanentlyDeleteRecord = (recordId: number) =>
    this.run(() => this.inner.permanentlyDeleteRecord(recordId));
  appendVersion = (recordId: number, versionTitle: string, changeNote: string) =>
    this.run(() => this.inner.appendVersion(recordId, versionTitle, changeNote));
  listVersions = (recordId: number) => this.run(() => this.inner.listVersions(recordId));
  deleteVersion = (recordId: number, versionId: number) =>
    this.run(() => this.inner.deleteVersion(recordId, versionId));
  restoreVersion = (recordId: number, versionId: number) =>
    this.run(() => this.inner.restoreVersion(recordId, versionId));
  listTags = () => this.run(() => this.inner.listTags());
  createTag = (name: string, colorKey?: string) =>
    this.run(() => this.inner.createTag(name, colorKey));
  renameTag = (tagId: number, name: string) => this.run(() => this.inner.renameTag(tagId, name));
  deleteTag = (tagId: number) => this.run(() => this.inner.deleteTag(tagId));
  getDataLocation = () => this.run(() => this.inner.getDataLocation());
  getRuntimeBuildInfo = () => this.run(() => this.inner.getRuntimeBuildInfo());
  inspectDataMigration = (targetRoot: string) => this.run(() => this.inner.inspectDataMigration(targetRoot));
  migrateDataDirectory = (targetRoot: string) => this.run(() => this.inner.migrateDataDirectory(targetRoot));
  rollbackDataDirectorySwitch = () => this.run(() => this.inner.rollbackDataDirectorySwitch());
  getStorageStats = () => this.run(() => this.inner.getStorageStats());
  inspectDataOptimization = () => this.run(() => this.inner.inspectDataOptimization());
  optimizeData = () => this.run(() => this.inner.optimizeData());
  inspectLegacyAttachmentRecovery = (sourceDirectory?: string) =>
    this.run(() => this.inner.inspectLegacyAttachmentRecovery(sourceDirectory));
  recoverLegacyAttachmentRecovery = (sourceDirectory?: string) =>
    this.run(() => this.inner.recoverLegacyAttachmentRecovery(sourceDirectory));
  openDataDirectory = () => this.run(() => this.inner.openDataDirectory());
  rebuildSearchIndex = () => this.run(() => this.inner.rebuildSearchIndex());
  runIntegrityCheck = () => this.run(() => this.inner.runIntegrityCheck());
  prepareImport = (sourcePath: string) => this.run(() => this.inner.prepareImport(sourcePath));
  confirmImport = (jobId: string, records: CreateRecordInput[], options?: ConfirmImportOptions) =>
    this.run(() => this.inner.confirmImport(jobId, records, options));
  cancelImport = (jobId: string) => this.run(() => this.inner.cancelImport(jobId));
  listImportJobs = () => this.run(() => this.inner.listImportJobs());
  listAttachments = (recordId: number) => this.run(() => this.inner.listAttachments(recordId));
  searchAttachments = (keyword: string, category: "all" | "image" | "video" | "audio" | "file", limit?: number) =>
    this.run(() => this.inner.searchAttachments(keyword, category, limit));
  addAttachment = (recordId: number, sourcePath: string) =>
    this.run(() => this.inner.addAttachment(recordId, sourcePath));
  openAttachment = (attachmentId: number) =>
    this.run(() => this.inner.openAttachment(attachmentId));
  revealAttachment = (attachmentId: number) =>
    this.run(() => this.inner.revealAttachment(attachmentId));
  removeAttachment = (attachmentId: number) =>
    this.run(() => this.inner.removeAttachment(attachmentId));
  exportRecord = (recordId: number, format: "md" | "json") =>
    this.run(() => this.inner.exportRecord(recordId, format));
  writeDocxExport = (fileName: string, bytes: number[]) =>
    this.run(() => this.inner.writeDocxExport(fileName, bytes));
  writeMarkdownExport = (fileName: string, content: string) =>
    this.run(() => this.inner.writeMarkdownExport(fileName, content));
  copyExportedFile = (filePath: string) =>
    this.run(() => this.inner.copyExportedFile(filePath));
  exportAllJson = () => this.run(() => this.inner.exportAllJson());
  exportRecords = (input: ExportRecordsInput) => this.run(() => this.inner.exportRecords(input));
  createBackup = () => this.run(() => this.inner.createBackup());
  restoreBackup = (sourcePath: string) => this.run(() => this.inner.restoreBackup(sourcePath));
  inspectBackup = (sourcePath: string) => this.run(() => this.inner.inspectBackup(sourcePath));
  createPortableBackup = (preferencesJson: string) =>
    this.run(() => this.inner.createPortableBackup(preferencesJson));
  inspectPortableBackup = (sourcePath: string) =>
    this.run(() => this.inner.inspectPortableBackup(sourcePath));
  restorePortableBackup = (sourcePath: string, currentPreferencesJson: string) =>
    this.run(() => this.inner.restorePortableBackup(sourcePath, currentPreferencesJson));
  openExportDirectory = () => this.run(() => this.inner.openExportDirectory());
  revealExportedFile = (filePath: string) => this.run(() => this.inner.revealExportedFile(filePath));
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
  if (sort === "oldest") {
    return (a.originalAt ?? a.updatedAt).localeCompare(b.originalAt ?? b.updatedAt) || a.id - b.id;
  }
  if (sort === "title") return a.title.localeCompare(b.title, "zh-CN") || a.id - b.id;
  if (sort === "created_desc") {
    return (b.originalAt ?? b.createdAt).localeCompare(a.originalAt ?? a.createdAt) || b.id - a.id;
  }
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
  const demoConversationSource = JSON.stringify({
    chat_messages: [
      {
        sender: "human",
        created_at: "2026-07-25T09:00:00+08:00",
        content: [{ type: "text", text: "请整理这份资本开支研究，并保留 Markdown 层级。" }],
      },
      {
        sender: "assistant",
        created_at: timestampBase,
        content: [{
          type: "text",
          text: [
            "## 核心结论",
            "",
            "头部云厂商仍在提高 AI 资本开支，但需要同时观察自由现金流。",
            "",
            "### 跟踪重点",
            "",
            "- GPU 与网络设备交付周期",
            "- 单位算力成本",
            "- 长期采购协议",
            "",
            "| 指标 | 当前判断 |",
            "| --- | --- |",
            "| 资本开支 | 高位运行 |",
            "| 自由现金流 | 压力可控 |",
          ].join("\n"),
        }],
      },
    ],
  });
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
      sourceText: record.id === 3 ? demoConversationSource : record.summary,
      sources: [{
        ...sourceInput,
        id: record.id,
        recordId: record.id,
        createdAt: timestampBase,
      }],
      isFavorite: false,
      isDeleted: false,
      originalAt: `2026-${record.date}T09:00:00+08:00`,
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
