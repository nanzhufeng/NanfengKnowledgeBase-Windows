import { z } from "zod";

export const recordStatusSchema = z.enum(["normal", "tracking", "verification", "updated"]);
export type RecordStatus = z.infer<typeof recordStatusSchema>;

export const evidenceItemSchema = z.object({
  content: z.string(),
  source: z.string(),
});
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;

export const recordSourceInputSchema = z.object({
  sourceType: z.string(),
  title: z.string(),
  url: z.string().nullable(),
  localPath: z.string().nullable(),
  externalId: z.string().nullable(),
});
export type RecordSourceInput = z.infer<typeof recordSourceInputSchema>;

export const recordSourceSchema = recordSourceInputSchema.extend({
  id: z.number().int(),
  recordId: z.number().int(),
  createdAt: z.string(),
});
export type RecordSource = z.infer<typeof recordSourceSchema>;

export const attachmentItemSchema = z.object({
  id: z.number().int(),
  recordId: z.number().int(),
  fileName: z.string(),
  storedPath: z.string(),
  originalPath: z.string().nullable(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int(),
  sha256: z.string(),
  createdAt: z.string(),
});
export type AttachmentItem = z.infer<typeof attachmentItemSchema>;

export const intelligenceRecordSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  summary: z.string(),
  status: recordStatusSchema,
  tags: z.array(z.string()),
  currentJudgment: z.string(),
  confirmedFacts: z.array(z.string()),
  keyEvidence: z.array(evidenceItemSchema),
  openQuestions: z.array(z.string()),
  nextActions: z.array(z.string()),
  notes: z.string(),
  sourceText: z.string(),
  sources: z.array(recordSourceSchema),
  isFavorite: z.boolean(),
  isDeleted: z.boolean(),
  originalAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  versionCount: z.number().int(),
});
export type IntelligenceRecord = z.infer<typeof intelligenceRecordSchema>;

export const recordSummarySchema = z.object({
  id: z.number().int(),
  title: z.string(),
  displayTitle: z.string(),
  summary: z.string(),
  status: recordStatusSchema,
  tags: z.array(z.string()),
  sourceTitle: z.string(),
  searchSnippet: z.string(),
  isFavorite: z.boolean(),
  isDeleted: z.boolean(),
  originalAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  versionCount: z.number().int(),
});
export type RecordSummary = z.infer<typeof recordSummarySchema>;

export const favoriteUpdateSchema = z.object({
  recordId: z.number().int(),
  isFavorite: z.boolean(),
  updatedAt: z.string(),
});
export type FavoriteUpdate = z.infer<typeof favoriteUpdateSchema>;

export const recordMutationSchema = z.object({
  recordId: z.number().int(),
  updatedAt: z.string(),
});
export type RecordMutation = z.infer<typeof recordMutationSchema>;

export const recordVersionSchema = z.object({
  id: z.number().int(),
  recordId: z.number().int(),
  versionNumber: z.number().int(),
  versionTitle: z.string(),
  changeNote: z.string(),
  snapshot: intelligenceRecordSchema,
  createdAt: z.string(),
});
export type RecordVersion = z.infer<typeof recordVersionSchema>;

export const tagItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  colorKey: z.string(),
  recordCount: z.number().int(),
  createdAt: z.string(),
});
export type TagItem = z.infer<typeof tagItemSchema>;

export const dataLocationSchema = z.object({
  root: z.string(),
  database: z.string(),
  imports: z.string(),
  attachments: z.string(),
  exports: z.string(),
  backups: z.string(),
  logs: z.string(),
});
export type DataLocation = z.infer<typeof dataLocationSchema>;

export const storageStatsSchema = z.object({
  recordCount: z.number().int(),
  databaseBytes: z.number(),
  importsBytes: z.number(),
  attachmentsBytes: z.number(),
  backupsBytes: z.number(),
  totalBytes: z.number(),
  lastBackupAt: z.string().nullable(),
});
export type StorageStats = z.infer<typeof storageStatsSchema>;

export const portableBackupResultSchema = z.object({
  folderPath: z.string(),
  createdAt: z.string(),
  recordCount: z.number().int(),
  fileCount: z.number(),
  totalBytes: z.number(),
});
export type PortableBackupResult = z.infer<typeof portableBackupResultSchema>;

export const portableBackupPreviewSchema = z.object({
  folderPath: z.string(),
  createdAt: z.string(),
  appVersion: z.string(),
  integrityCheck: z.string(),
  recordCount: z.number().int(),
  deletedCount: z.number().int(),
  versionCount: z.number().int(),
  preferenceCount: z.number().int(),
  fileCount: z.number(),
  totalBytes: z.number(),
  contentIntegrity: z.enum(["verified_sha256", "legacy_database_only"]),
  restorable: z.boolean(),
});
export type PortableBackupPreview = z.infer<typeof portableBackupPreviewSchema>;

export const portableRestoreResultSchema = z.object({
  restoredFrom: z.string(),
  safetyBackup: z.string(),
  integrityCheck: z.string(),
  preferencesJson: z.string(),
  logPath: z.string(),
});
export type PortableRestoreResult = z.infer<typeof portableRestoreResultSchema>;

export type RecordQuery = {
  search?: string;
  status?: RecordStatus;
  tag?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  favoritesOnly?: boolean;
  includeDeleted?: boolean;
  deletedOnly?: boolean;
  sort?: "updated_desc" | "oldest" | "title" | "created_desc";
};

export type ExportRecordsInput = {
  recordIds?: number[];
  query?: RecordQuery;
  format: "json" | "md" | "vault";
  includeAttachments?: boolean;
  includeVersions?: boolean;
  includeOriginalFiles?: boolean;
};

export type CreateRecordInput = {
  title: string;
  originalAt?: string | null;
  summary?: string;
  status?: RecordStatus;
  tags?: string[];
  currentJudgment?: string;
  confirmedFacts?: string[];
  keyEvidence?: EvidenceItem[];
  openQuestions?: string[];
  nextActions?: string[];
  notes?: string;
  sourceText?: string;
  sources?: RecordSourceInput[];
  isFavorite?: boolean;
};

export const createRecordInputSchema = z.object({
  title: z.string(),
  originalAt: z.string().nullable().optional(),
  summary: z.string().optional(),
  status: recordStatusSchema.optional(),
  tags: z.array(z.string()).optional(),
  currentJudgment: z.string().optional(),
  confirmedFacts: z.array(z.string()).optional(),
  keyEvidence: z.array(evidenceItemSchema).optional(),
  openQuestions: z.array(z.string()).optional(),
  nextActions: z.array(z.string()).optional(),
  notes: z.string().optional(),
  sourceText: z.string().optional(),
  sources: z.array(recordSourceInputSchema).optional(),
  isFavorite: z.boolean().optional(),
});

export type UpdateRecordInput = {
  title: string;
  summary: string;
  status: RecordStatus;
  tags: string[];
  currentJudgment: string;
  confirmedFacts: string[];
  keyEvidence: EvidenceItem[];
  openQuestions: string[];
  nextActions: string[];
  notes: string;
  sourceText: string;
  sources: RecordSourceInput[];
};

export type PatchRecordInput = Partial<UpdateRecordInput>;

export type CommandError = {
  code: string;
  message: string;
};

export const importPreviewSchema = z.object({
  jobId: z.string(),
  sourceFileName: z.string(),
  storedFilePath: z.string(),
  sha256: z.string(),
  fileKind: z.string(),
  sizeBytes: z.number(),
  duplicate: z.boolean(),
  rawPreview: z.string(),
  recordCount: z.number().int(),
  records: z.array(createRecordInputSchema),
  boundaryOptions: z.array(z.object({
    field: z.string(),
    recordCount: z.number().int(),
  })),
  duplicateCandidates: z.array(z.object({
    itemIndex: z.number().int(),
    recordId: z.number().int(),
    title: z.string(),
    reason: z.string(),
    score: z.number(),
  })),
  warnings: z.array(z.string()),
});
export type ImportPreview = z.infer<typeof importPreviewSchema>;

export const importResultSchema = z.object({
  jobId: z.string(),
  status: z.string(),
  importedCount: z.number().int(),
  firstImportedRecord: z.object({
    id: z.number().int(),
    title: z.string(),
  }).nullable(),
  importedSourceItemIds: z.array(z.number().int()).optional().default([]),
  skippedCount: z.number().int(),
  errors: z.array(z.string()),
});
export type ImportResult = z.infer<typeof importResultSchema>;

export const importJobSummarySchema = z.object({
  id: z.string(),
  sourceFileName: z.string(),
  status: z.string(),
  successCount: z.number().int(),
  skipCount: z.number().int(),
  failureCount: z.number().int(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});
export type ImportJobSummary = z.infer<typeof importJobSummarySchema>;

export const exportResultSchema = z.object({
  format: z.string(),
  filePath: z.string(),
  recordCount: z.number().int(),
});
export type ExportResult = z.infer<typeof exportResultSchema>;

export const restoreResultSchema = z.object({
  restoredFrom: z.string(),
  safetyBackup: z.string(),
  integrityCheck: z.string(),
  logPath: z.string(),
});
export type RestoreResult = z.infer<typeof restoreResultSchema>;

export const backupPreviewSchema = z.object({
  filePath: z.string(),
  fileSizeBytes: z.number(),
  modifiedAt: z.string(),
  integrityCheck: z.string(),
  recordCount: z.number().int(),
  deletedCount: z.number().int(),
  versionCount: z.number().int(),
});
export type BackupPreview = z.infer<typeof backupPreviewSchema>;

export function sourceToInput(source: RecordSource): RecordSourceInput {
  return {
    sourceType: source.sourceType,
    title: source.title,
    url: source.url,
    localPath: source.localPath,
    externalId: source.externalId,
  };
}

export function recordToUpdate(record: IntelligenceRecord): UpdateRecordInput {
  return {
    title: record.title,
    summary: record.summary,
    status: record.status,
    tags: record.tags,
    currentJudgment: record.currentJudgment,
    confirmedFacts: record.confirmedFacts,
    keyEvidence: record.keyEvidence,
    openQuestions: record.openQuestions,
    nextActions: record.nextActions,
    notes: record.notes,
    sourceText: record.sourceText,
    sources: record.sources.map(sourceToInput),
  };
}

export function recordToSummary(record: IntelligenceRecord): RecordSummary {
  return {
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
    originalAt: record.originalAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
    versionCount: record.versionCount,
  };
}
