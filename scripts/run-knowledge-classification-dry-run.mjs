import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { createServer } from "vite";

const [, , inputArgument, outputArgument] = process.argv;
if (!inputArgument || !outputArgument || process.argv.length !== 4) {
  console.error("用法：node scripts/run-knowledge-classification-dry-run.mjs <classification-input.json> <输出目录>");
  process.exit(1);
}

const inputPath = path.resolve(inputArgument);
const outputDirectory = path.resolve(outputArgument);
const jsonReportPath = path.join(outputDirectory, "classification-preview.json");
const markdownReportPath = path.join(outputDirectory, "classification-preview.md");
await mkdir(outputDirectory, { recursive: true });

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const {
    buildLegacyClassificationDryRun,
    renderLegacyClassificationDryRunMarkdown,
  } = await server.ssrLoadModule("/src/knowledge/legacyClassificationDryRun.ts");
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const report = buildLegacyClassificationDryRun(input);
  await writeFile(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  await writeFile(markdownReportPath, renderLegacyClassificationDryRunMarkdown(report), {
    encoding: "utf8",
    flag: "wx",
  });

  console.log("内容分类预演完成");
  console.log(`活动记录：${report.source.recordCount}`);
  console.log(`达到候选阈值：${report.summary.candidateCoverageCount}`);
  console.log(`可自动接受：${report.summary.actionCounts.auto_eligible}`);
  console.log(`建议确认：${report.summary.actionCounts.confirm}`);
  console.log(`仅候选：${report.summary.actionCounts.candidates}`);
  console.log(`人工处理：${report.summary.actionCounts.manual}`);
  console.log(`JSON 报告：${jsonReportPath}`);
  console.log(`Markdown 报告：${markdownReportPath}`);
} finally {
  await server.close();
}
