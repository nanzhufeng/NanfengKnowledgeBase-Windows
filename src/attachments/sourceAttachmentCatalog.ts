import type { SourceAttachmentCatalogHit } from "../services/knowledgeRepository";

export type SourceAttachmentMonthGroup = {
  key: string;
  label: string;
  hits: SourceAttachmentCatalogHit[];
};

export function sourceAttachmentMonthKey(value: string | null | undefined): string {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function groupSourceAttachmentsByMonth(
  hits: SourceAttachmentCatalogHit[],
): SourceAttachmentMonthGroup[] {
  const groups = new Map<string, SourceAttachmentCatalogHit[]>();
  hits.forEach((hit) => {
    const key = sourceAttachmentMonthKey(
      hit.recordOriginalAt ?? hit.attachment?.createdAt,
    );
    const current = groups.get(key) ?? [];
    current.push(hit);
    groups.set(key, current);
  });
  return [...groups.entries()].map(([key, items]) => ({
    key,
    label: key === "unknown"
      ? "日期未记录"
      : `${Number(key.slice(0, 4))}年${Number(key.slice(5, 7))}月`,
    hits: items,
  }));
}
