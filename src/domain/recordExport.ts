import type { IntelligenceRecord } from "./models";
import {
  readImportedContent,
  resolveImportedTitle,
  shouldDisplaySummary,
} from "./importedContent";

function pushSection(lines: string[], title: string, content: string[]) {
  const meaningful = content.map((item) => item.trim()).filter(Boolean);
  if (!meaningful.length) return;
  lines.push("", `## ${title}`, "", ...meaningful);
}

export function composeRecordMarkdown(record: IntelligenceRecord): string {
  const imported = readImportedContent(record.sourceText);
  const lines = [`# ${resolveImportedTitle(record.title, record.sourceText)}`];

  if (imported.isConversation) {
    const conversation = imported.messages.flatMap((message) => [
      `### ${message.role}`,
      "",
      message.text,
      ...message.assets.map((asset) =>
        asset.kind === "image"
          ? `![${asset.fileName}](attachment:${asset.fileUuid ?? asset.fileName})`
          : `- 附件：${asset.fileName}`),
      "",
    ]);
    pushSection(lines, "记录内容", conversation);
  } else {
    pushSection(lines, "记录内容", [imported.fullText]);
  }

  if (shouldDisplaySummary(record.summary)) {
    pushSection(lines, "内容摘要", [record.summary]);
  }
  pushSection(lines, "当前判断", [record.currentJudgment]);
  pushSection(lines, "已确认事实", record.confirmedFacts.map((item) => `- ${item}`));
  pushSection(
    lines,
    "关键证据",
    record.keyEvidence.map((item) =>
      `- ${item.content}${item.source ? `（来源：${item.source}）` : ""}`),
  );
  pushSection(lines, "待验证问题", record.openQuestions.map((item) => `- ${item}`));
  pushSection(lines, "下一步行动", record.nextActions.map((item) => `- ${item}`));
  pushSection(lines, "备注", [record.notes]);
  pushSection(
    lines,
    "来源",
    record.sources.map((source) =>
      `- ${source.title}${source.url ? `：${source.url}` : source.localPath ? `：${source.localPath}` : ""}`),
  );

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function tableCells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

export async function createRecordDocx(markdown: string): Promise<Uint8Array> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  const inlineRuns = (value: string) => {
    const runs = [];
    const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
    let cursor = 0;
    for (const match of value.matchAll(pattern)) {
      const index = match.index ?? 0;
      if (index > cursor) runs.push(new TextRun(value.slice(cursor, index)));
      const token = match[0];
      if (token.startsWith("**")) {
        runs.push(new TextRun({ text: token.slice(2, -2), bold: true }));
      } else if (token.startsWith("`")) {
        runs.push(new TextRun({
          text: token.slice(1, -1),
          font: "Cascadia Mono",
          shading: { type: ShadingType.CLEAR, fill: "E9EDF3" },
        }));
      } else {
        const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        runs.push(new TextRun({ text: link?.[1] ?? token, color: "2357AE", underline: {} }));
      }
      cursor = index + token.length;
    }
    if (cursor < value.length) runs.push(new TextRun(value.slice(cursor)));
    return runs.length ? runs : [new TextRun(value)];
  };

  const lines = markdown.split(/\r?\n/);
  const children: any[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.trim().startsWith("|")
      && index + 1 < lines.length
      && isTableSeparator(lines[index + 1])) {
      const rows = [tableCells(line)];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: rows.map((cells, rowIndex) => new TableRow({
          children: cells.map((cell) => new TableCell({
            shading: rowIndex === 0
              ? { type: ShadingType.CLEAR, fill: "EEF2F7" }
              : undefined,
            children: [new Paragraph({ children: inlineRuns(cell) })],
          })),
        })),
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "D8DFE9" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "D8DFE9" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "D8DFE9" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "D8DFE9" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D8DFE9" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D8DFE9" },
        },
      }));
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    const image = line.match(/^!\[([^\]]*)\]\([^)]+\)$/);
    if (heading) {
      const levels = [
        HeadingLevel.TITLE,
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
      ];
      children.push(new Paragraph({
        heading: levels[Math.min(heading[1].length - 1, levels.length - 1)],
        children: inlineRuns(heading[2]),
        spacing: { before: 220, after: 120 },
      }));
    } else if (bullet) {
      children.push(new Paragraph({
        bullet: { level: 0 },
        children: inlineRuns(bullet[1]),
        spacing: { after: 60 },
      }));
    } else if (numbered) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${numbered[1]}. `, bold: true }), ...inlineRuns(numbered[2])],
        spacing: { after: 60 },
      }));
    } else if (image) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `图片：${image[1] || "会话图片"}`, italics: true, color: "68758A" })],
        spacing: { before: 100, after: 100 },
      }));
    } else if (line.trim() === "---") {
      children.push(new Paragraph({ children: [new TextRun("────────────────────")] }));
    } else {
      children.push(new Paragraph({
        children: inlineRuns(line),
        spacing: { after: 90, line: 340 },
      }));
    }
    index += 1;
  }

  const document = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Microsoft YaHei", size: 22, color: "273A55" },
          paragraph: { spacing: { line: 340 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 900, right: 900, bottom: 900, left: 900 },
        },
      },
      children,
    }],
  });
  const blob = await Packer.toBlob(document);
  return new Uint8Array(await blob.arrayBuffer());
}
