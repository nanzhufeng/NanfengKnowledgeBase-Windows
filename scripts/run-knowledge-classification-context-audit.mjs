import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { createServer } from "vite";

const [, , inputArgument, outputArgument] = process.argv;
if (!inputArgument || !outputArgument || process.argv.length !== 4) {
  console.error(
    "用法：node scripts/run-knowledge-classification-context-audit.mjs <分类上下文.json> <输出目录>",
  );
  process.exit(1);
}

const inputPath = path.resolve(inputArgument);
const outputDirectory = path.resolve(outputArgument);
const jsonReportPath = path.join(outputDirectory, "classification-coverage-report.json");
const minimumSubstantiveCharacters = 80;
await mkdir(outputDirectory, { recursive: true });

const input = JSON.parse(await readFile(inputPath, "utf8"));
if (
  input.sourceConnectionQueryOnly !== true
  || input.sourceTotalChangesBefore !== input.sourceTotalChangesAfter
  || input.sourceDatabaseSha256Before !== input.sourceDatabaseSha256After
  || input.sourceCount !== input.records.length
) {
  throw new Error("分类上下文缺少完整只读证据或数量不一致");
}

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

function isSubstantiveTitle(title) {
  const normalized = title.trim();
  return normalized.length >= 4
    && normalized !== "---"
    && !/^未命名(?:导入)?记录/i.test(normalized)
    && !/^untitled$/i.test(normalized);
}

try {
  const {
    classifySource,
    CLASSIFIER_ALGORITHM_VERSION,
  } = await server.ssrLoadModule("/src/knowledge/deterministicClassifier.ts");
  const topicCounts = new Map();
  const confidenceBands = {
    autoEligible: 0,
    confirm: 0,
    candidates: 0,
    unmatched: 0,
  };
  const records = input.records.map((record) => {
    const result = classifySource({
      source: record.source,
      topics: input.topics,
      rules: input.rules,
      history: record.history,
      searchSignals: record.searchSignals,
    }, input.generatedAt);
    const top = result.suggestions[0] ?? null;
    const second = result.suggestions[1] ?? null;
    if (!top) {
      confidenceBands.unmatched += 1;
    } else {
      if (top.action === "auto_eligible") confidenceBands.autoEligible += 1;
      else if (top.action === "confirm") confidenceBands.confirm += 1;
      else confidenceBands.candidates += 1;
      const topicPath = top.topicPath.join(" / ");
      topicCounts.set(topicPath, (topicCounts.get(topicPath) ?? 0) + 1);
    }
    return {
      sourceItemId: record.sourceItemId,
      title: record.source.title,
      visibleCharacterCount: record.source.text.length,
      substantiveTitle: isSubstantiveTitle(record.source.title),
      topSuggestion: top
        ? {
          topicId: Number(top.topicId),
          topicPath: top.topicPath,
          confidence: top.confidence,
          marginToSecond: second ? Number((top.confidence - second.confidence).toFixed(2)) : null,
          action: top.action,
          reasons: top.reasons,
          signalScores: top.signalScores,
        }
        : null,
      suggestions: result.suggestions.slice(0, 3).map((suggestion) => ({
        topicId: Number(suggestion.topicId),
        topicPath: suggestion.topicPath,
        confidence: suggestion.confidence,
        action: suggestion.action,
        reasons: suggestion.reasons,
        signalScores: suggestion.signalScores,
      })),
    };
  });
  const unmatched = records.filter((record) => !record.topSuggestion);
  const report = {
    reportVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      database: input.sourceDatabase,
      sha256: input.sourceDatabaseSha256After,
      queryOnly: input.sourceConnectionQueryOnly,
      integrityCheck: input.sourceIntegrityCheck,
      totalChangesBefore: input.sourceTotalChangesBefore,
      totalChangesAfter: input.sourceTotalChangesAfter,
    },
    classifierVersion: CLASSIFIER_ALGORITHM_VERSION,
    sourceCount: records.length,
    topicCount: input.topics.length,
    ruleCount: input.rules.length,
    matchedCount: records.length - unmatched.length,
    unmatchedCount: unmatched.length,
    substantiveUnmatchedCount: unmatched.filter((record) =>
      record.substantiveTitle
      && record.visibleCharacterCount >= minimumSubstantiveCharacters).length,
    confidenceBands,
    topicCounts: Object.fromEntries(
      [...topicCounts.entries()].sort((left, right) =>
        right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN")),
    ),
    unmatched,
    records,
  };
  await writeFile(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  console.log("分类覆盖审计完成");
  console.log(`来源：${report.sourceCount}`);
  console.log(`有候选：${report.matchedCount}`);
  console.log(`无候选：${report.unmatchedCount}`);
  console.log(`清晰内容无候选：${report.substantiveUnmatchedCount}`);
  console.log(`报告：${jsonReportPath}`);
} finally {
  await server.close();
}
