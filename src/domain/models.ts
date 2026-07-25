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
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  versionCount: z.number().int(),
});
export type IntelligenceRecord = z.infer<typeof intelligenceRecordSchema>;

export const favoriteUpdateSchema = z.object({
  recordId: z.number().int(),
  isFavorite: z.boolean(),
  updatedAt: z.string(),
});
export type FavoriteUpdate = z.infer<typeof favoriteUpdateSchema>;

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

export type CreateRecordInput = {
  title: string;
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
  records: z.array(createRecordInputSchema),
  warnings: z.array(z.string()),
});
export type ImportPreview = z.infer<typeof importPreviewSchema>;

export const importResultSchema = z.object({
  jobId: z.string(),
  status: z.string(),
  importedRecords: z.array(intelligenceRecordSchema),
  skippedCount: z.number().int(),
  errors: z.array(z.string()),
});
export type ImportResult = z.infer<typeof importResultSchema>;

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
});
export type RestoreResult = z.infer<typeof restoreResultSchema>;

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
