import type { IntelligenceRecord } from "./models";

export type VersionDifference = {
  label: string;
  previous: string;
  current: string;
};

export function versionDifferences(
  current: IntelligenceRecord,
  previous: IntelligenceRecord,
): VersionDifference[] {
  const fields: Array<[string, keyof IntelligenceRecord]> = [
    ["标题", "title"],
    ["摘要", "summary"],
    ["状态", "status"],
    ["标签", "tags"],
    ["当前判断", "currentJudgment"],
    ["已确认事实", "confirmedFacts"],
    ["关键证据", "keyEvidence"],
    ["待验证问题", "openQuestions"],
    ["下一步行动", "nextActions"],
    ["备注", "notes"],
    ["原始文本", "sourceText"],
    ["来源", "sources"],
  ];
  const describe = (value: unknown) => {
    if (Array.isArray(value)) return value.length ? `${value.length} 项` : "空";
    const text = String(value ?? "").trim();
    if (!text) return "空";
    return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  };
  return fields.flatMap(([label, key]) => {
    const currentValue = current[key];
    const previousValue = previous[key];
    if (JSON.stringify(currentValue) === JSON.stringify(previousValue)) return [];
    return [{
      label,
      previous: describe(previousValue),
      current: describe(currentValue),
    }];
  });
}
