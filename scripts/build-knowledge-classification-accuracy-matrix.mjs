import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const [, , reportArgument, outputArgument] = process.argv;
if (!reportArgument || !outputArgument || process.argv.length !== 4) {
  console.error(
    "用法：node scripts/build-knowledge-classification-accuracy-matrix.mjs <覆盖报告.json> <输出目录>",
  );
  process.exit(1);
}

const reportPath = path.resolve(reportArgument);
const outputDirectory = path.resolve(outputArgument);
const minimumSubstantiveCharacters = 80;
await mkdir(outputDirectory, { recursive: true });

const report = JSON.parse(await readFile(reportPath, "utf8"));
if (!Array.isArray(report.records) || report.records.length !== report.sourceCount) {
  throw new Error("覆盖报告记录数不完整");
}

function evidenceLocations(reasons = []) {
  const locations = [];
  if (reasons.some((reason) => reason.startsWith("标题"))) locations.push("title");
  if (reasons.some((reason) => reason.startsWith("正文"))) locations.push("body");
  if (reasons.some((reason) => reason.startsWith("来源元数据"))) locations.push("metadata");
  return locations;
}

function hasMeaningfulTitle(title) {
  const normalized = title.normalize("NFKC").toLocaleLowerCase().trim();
  const compact = normalized.replace(/\s+/g, "");
  return Array.from(compact).length >= 4
    && normalized !== "---"
    && !/^未命名(?:导入)?记录/.test(normalized)
    && !/^untitled$/.test(normalized)
    && !/^conversation overview\b/.test(normalized)
    && !/^(先给结果|设置方法|情况询问|询问内容用途|这两个差别|三个选项区别|没有反应的原因|为什么这种便宜|登录方法|便宜平台风险分析)$/.test(normalized)
    && !/^(?:订阅)?内容(?:分析)?(?:总结|概述)$/.test(normalized)
    && !/^(?!.*(?:生成|分析|解析|设计|编辑|处理|调色)).+(?:画面|图片|图像|照片)$/.test(normalized)
    && !/^南烛枫[，,、\s]*(先|请|帮我)?$/.test(normalized);
}

function addSubjectContractFlags(flags, title, topTopic) {
  if (!topTopic) return;
  const normalized = title.normalize("NFKC").toLocaleLowerCase();
  const isInvestmentAccount = /(?:投资账户|券商|证券账户)/.test(normalized);
  const definiteAccountRisk = /(?:风控|封禁|停用|冻结|申诉|恢复访问)/.test(normalized);
  const accountRestriction =
    /(?:账号|账户|paypal).*(?:限制)/.test(normalized)
    && !/(?:绑定手机号|自动化限制|功能限制|使用限制)/.test(normalized);
  if (
    /(?:账号|账户|paypal|google|claude|apple id)/.test(normalized)
    && (definiteAccountRisk || accountRestriction)
    && topTopic !== "海外账号 / 账号风控与封禁"
  ) {
    flags.push("SUBJECT_ACCOUNT_RISK_MISMATCH");
  }
  if (
    /(?:估值(?:分析)?|商业模式(?:分析)?|财报(?:分析)?|财务分析|公司投资分析|个股投资分析|股价分析|分红分析)/.test(normalized)
    && !/(?:产业估值|行业估值|估值方法|估值框架)/.test(normalized)
    && !/(?:指数|纳指|标普|etf|基金|a股|美股|港股|大盘|产业链|行业|板块|赛道|航空航天|人形机器人|桑基图|信息图|图表|可视化)/.test(normalized)
    && !/^ai(?:产业|行业|商业模式)/.test(normalized)
    && topTopic !== "投资研究 / 公司与行业研究"
  ) {
    flags.push("SUBJECT_COMPANY_RESEARCH_MISMATCH");
  }
  if (
    /(?:投资分析|估值分析|财报|股票|基金|a股|美股|港股)/.test(normalized)
    && !/(?:账号|账户).*(?:风控|封禁|限制|解锁|申诉)/.test(normalized)
    && !/(?:职业.*投资分析|投资分析.*职业)/.test(normalized)
    && !topTopic.startsWith("投资研究 / ")
  ) {
    flags.push("SUBJECT_INVESTMENT_DOMAIN_MISMATCH");
  }
  if (
    /(?:apple id|google账号|claude账号|银行卡|信用卡|paypal|手机卡|esim)/.test(normalized)
    && !isInvestmentAccount
    && !topTopic.startsWith("海外账号 / ")
  ) {
    flags.push("SUBJECT_ACCOUNT_DOMAIN_MISMATCH");
  }
  if (
    /(?:提示词|生成图片|生图|写实照片|生成人像)/.test(normalized)
    && !/(?:模型|开发|接口|api)/.test(normalized)
    && !/(?:桑基图|信息图|图表|可视化)/.test(normalized)
    && topTopic !== "影视、动画与 VFX / AI 图像与视觉创作"
  ) {
    flags.push("SUBJECT_IMAGE_GENERATION_MISMATCH");
  }
  if (
    /(?:购车|车型|驾驶|新能源车|二手车|汽车)/.test(normalized)
    && !/(?:投资|产业|股票|估值|财报)/.test(normalized)
    && !/(?:婉拒|话术|沟通|表达)/.test(normalized)
    && !topTopic.startsWith("汽车与出行 / ")
  ) {
    flags.push("SUBJECT_AUTOMOTIVE_DOMAIN_MISMATCH");
  }
}

const rows = report.records.map((record) => {
  const top = record.topSuggestion;
  const second = record.suggestions?.[1] ?? null;
  const confidenceMargin = top && second
    ? Number((top.confidence - second.confidence).toFixed(2))
    : null;
  const topHasPrimaryBoundary = top?.reasons?.some((reason) =>
    reason.startsWith("标题主体边界")) ?? false;
  const secondHasPrimaryBoundary = second?.reasons?.some((reason) =>
    reason.startsWith("标题主体边界")) ?? false;
  const margin = confidenceMargin === null
    ? null
    : Number((
        confidenceMargin
        + (topHasPrimaryBoundary ? 30 : 0)
        - (secondHasPrimaryBoundary ? 30 : 0)
      ).toFixed(2));
  const locations = evidenceLocations(top?.reasons);
  const flags = [];
  const substantiveContent = record.substantiveTitle
    && record.visibleCharacterCount >= minimumSubstantiveCharacters;
  if (!top && substantiveContent) {
    flags.push("SUBSTANTIVE_UNMATCHED");
  }
  const meaningfulTitle = hasMeaningfulTitle(record.title);
  if (top && !locations.includes("title")) flags.push("NO_TITLE_EVIDENCE");
  if (top && meaningfulTitle && !locations.includes("title")) {
    flags.push("MEANINGFUL_NO_TITLE_EVIDENCE");
  }
  if (top && margin !== null && margin < 5) flags.push("LOW_MARGIN_LT_5");
  else if (top && margin !== null && margin < 10) flags.push("LOW_MARGIN_LT_10");
  if (top && top.confidence < 60) flags.push("LOW_CONFIDENCE_LT_60");
  if (top && top.action === "candidates") flags.push("NEEDS_CONFIRMATION");
  addSubjectContractFlags(flags, record.title, top?.topicPath?.join(" / ") ?? "");
  return {
    sourceItemId: record.sourceItemId,
    title: record.title,
    visibleCharacterCount: record.visibleCharacterCount,
    substantiveContent,
    meaningfulTitle,
    topTopic: top?.topicPath?.join(" / ") ?? "",
    confidence: top?.confidence ?? null,
    action: top?.action ?? "unmatched",
    secondTopic: second?.topicPath?.join(" / ") ?? "",
    secondConfidence: second?.confidence ?? null,
    confidenceMargin,
    marginToSecond: margin,
    evidenceLocations: locations,
    riskFlags: flags,
    reasons: top?.reasons ?? [],
  };
});

const flagCounts = {};
for (const row of rows) {
  for (const flag of row.riskFlags) {
    flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;
  }
}
const topicRiskCounts = {};
for (const row of rows.filter((item) => item.riskFlags.length > 0)) {
  const topic = row.topTopic || "(unmatched)";
  topicRiskCounts[topic] = (topicRiskCounts[topic] ?? 0) + 1;
}

const matrix = {
  matrixVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceReport: reportPath,
  classifierVersion: report.classifierVersion,
  sourceCount: report.sourceCount,
  matchedCount: report.matchedCount,
  unmatchedCount: report.unmatchedCount,
  flagCounts,
  topicRiskCounts: Object.fromEntries(
    Object.entries(topicRiskCounts).sort((left, right) =>
      right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN")),
  ),
  rows,
};

const columns = [
  "sourceItemId",
  "title",
  "visibleCharacterCount",
  "substantiveContent",
  "meaningfulTitle",
  "topTopic",
  "confidence",
  "action",
  "secondTopic",
  "secondConfidence",
  "confidenceMargin",
  "marginToSecond",
  "evidenceLocations",
  "riskFlags",
  "reasons",
];
const escapeTsv = (value) => String(value ?? "")
  .replaceAll("\t", " ")
  .replaceAll("\r", " ")
  .replaceAll("\n", " ");
const tsv = [
  columns.join("\t"),
  ...rows.map((row) => columns.map((column) => {
    const value = row[column];
    return escapeTsv(Array.isArray(value) ? value.join(" | ") : value);
  }).join("\t")),
].join("\n");

await writeFile(
  path.join(outputDirectory, "classification-accuracy-matrix.json"),
  `${JSON.stringify(matrix, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" },
);
await writeFile(
  path.join(outputDirectory, "classification-accuracy-matrix.tsv"),
  `${tsv}\n`,
  { encoding: "utf8", flag: "wx" },
);

console.log(`准确性矩阵：${rows.length} 条`);
console.log(`风险标记：${JSON.stringify(flagCounts)}`);
console.log(`输出目录：${outputDirectory}`);
