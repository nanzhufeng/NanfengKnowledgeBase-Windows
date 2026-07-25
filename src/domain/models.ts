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
