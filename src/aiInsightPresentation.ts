export type AiSummaryPresentation = {
  overviewMarkdown: string;
  boundaryMarkdown: string;
  sourceCount: number;
};

const BOUNDARY_LABELS = ["来源边界", "证据边界", "来源范围", "证据范围"] as const;
const FOLLOWING_SECTION_LABELS = new Set([
  "主题总览",
  "核心判断",
  "关键洞察",
  "矛盾",
  "待验证项",
  "待验证问题",
  "主题管理建议",
  "结论",
]);

function unwrapMarkdownLabel(line: string): string {
  let value = line.trim().replace(/^#{1,6}\s*/, "").trim();
  const bold = value.match(/^(?:\*\*|__)(.*?)(?:\*\*|__)$/);
  if (bold) value = bold[1].trim();
  return value;
}

function boundaryStart(line: string): { matched: boolean; remainder: string } {
  const value = unwrapMarkdownLabel(line);
  for (const label of BOUNDARY_LABELS) {
    if (value === label || value === `${label}：` || value === `${label}:`) {
      return { matched: true, remainder: "" };
    }
    for (const separator of ["：", ":"]) {
      const prefix = `${label}${separator}`;
      if (value.startsWith(prefix)) {
        return { matched: true, remainder: value.slice(prefix.length).trim() };
      }
    }
  }
  return { matched: false, remainder: "" };
}

function startsFollowingSection(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const value = unwrapMarkdownLabel(trimmed).replace(/[：:]$/, "").trim();
  return /^#{1,6}\s/.test(trimmed) || FOLLOWING_SECTION_LABELS.has(value);
}

function trimBlankLines(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;
  return lines.slice(start, end);
}

export function splitAiSummaryMarkdown(markdown: string): AiSummaryPresentation {
  const overviewLines: string[] = [];
  const boundaryLines: string[] = [];
  let collectingBoundary = false;

  for (const line of markdown.split(/\r?\n/)) {
    const start = boundaryStart(line);
    if (start.matched) {
      collectingBoundary = true;
      if (start.remainder) boundaryLines.push(start.remainder);
      continue;
    }
    if (collectingBoundary && startsFollowingSection(line)) {
      collectingBoundary = false;
    }
    (collectingBoundary ? boundaryLines : overviewLines).push(line);
  }

  const overviewMarkdown = trimBlankLines(overviewLines).join("\n").trim();
  const boundaryMarkdown = trimBlankLines(boundaryLines).join("\n").trim();
  const sourceReferences = boundaryMarkdown.match(/\b(?:legacy-record|source)-\d+\b/gi) ?? [];
  const uniqueReferences = new Set(sourceReferences.map((item) => item.toLocaleLowerCase()));
  const bulletCount = boundaryMarkdown
    .split(/\r?\n/)
    .filter((line) => /^\s*[-*+]\s+\S/.test(line))
    .length;

  return {
    overviewMarkdown: overviewMarkdown
      || (boundaryMarkdown ? "当前结果只完成了来源范围核对，尚未形成可展示的主题结论。" : ""),
    boundaryMarkdown,
    sourceCount: uniqueReferences.size || bulletCount,
  };
}
