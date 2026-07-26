import type {
  CreateRecordInput,
  RecordStatus,
} from "./models";

function mappedString(raw: Record<string, unknown>, field: string | undefined): string | undefined {
  if (!field) return undefined;
  const value = raw[field];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function mappedStringArray(
  raw: Record<string, unknown>,
  field: string | undefined,
): string[] | undefined {
  if (!field) return undefined;
  const value = raw[field];
  if (Array.isArray(value)) {
    return value
      .map((item) => typeof item === "string" || typeof item === "number" ? String(item) : "")
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/[,，;\n]/).map((item) => item.trim()).filter(Boolean);
  }
  return undefined;
}

export function mapImportedRecord(
  raw: Record<string, unknown>,
  base: CreateRecordInput | undefined,
  mapping: Record<string, string>,
  index: number,
): CreateRecordInput {
  const statusValue = mappedString(raw, mapping.status);
  const status = statusValue && ["normal", "tracking", "verification", "updated"].includes(statusValue)
    ? statusValue as RecordStatus
    : base?.status ?? "normal";
  const title = mappedString(raw, mapping.title)?.trim()
    || base?.title
    || `未命名导入记录 ${index + 1}`;
  return {
    title,
    summary: mappedString(raw, mapping.summary) ?? base?.summary ?? "",
    status,
    tags: mappedStringArray(raw, mapping.tags) ?? base?.tags ?? [],
    currentJudgment: mappedString(raw, mapping.currentJudgment) ?? base?.currentJudgment ?? "",
    confirmedFacts: mappedStringArray(raw, mapping.confirmedFacts) ?? base?.confirmedFacts ?? [],
    keyEvidence: base?.keyEvidence ?? [],
    openQuestions: mappedStringArray(raw, mapping.openQuestions) ?? base?.openQuestions ?? [],
    nextActions: mappedStringArray(raw, mapping.nextActions) ?? base?.nextActions ?? [],
    notes: mappedString(raw, mapping.notes) ?? base?.notes ?? "",
    sourceText: JSON.stringify(raw),
    sources: base?.sources ?? [],
    isFavorite: base?.isFavorite ?? false,
  };
}

export function previewMappedValue(
  record: CreateRecordInput | undefined,
  target: string,
): string {
  if (!record) return "—";
  const value = record[target as keyof CreateRecordInput];
  if (Array.isArray(value)) return value.length ? `${value.length} 项` : "—";
  if (typeof value === "string") {
    if (!value.trim()) return "—";
    return value.length > 42 ? `${value.slice(0, 42)}…` : value;
  }
  return value === undefined ? "—" : String(value);
}
