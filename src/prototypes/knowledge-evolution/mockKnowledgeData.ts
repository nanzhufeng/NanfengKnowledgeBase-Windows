import {
  classificationHistory,
  classificationRules,
  classificationSourceFixtures,
  classificationTopics,
} from "../../knowledge/classificationFixtures";
import { classifySource } from "../../knowledge/deterministicClassifier";

export type SourceKind = "chatgpt" | "claude" | "transcript" | "markdown";

export type InboxItem = {
  id: string;
  kind: SourceKind;
  title: string;
  sourceLabel: string;
  sourceDate: string;
  excerpt: string;
  suggestedPath: string[];
  confidence: number;
  status: "pending" | "accepted";
  reasons: string[];
  scoreParts: Array<{ label: string; score: number; max: number }>;
  alternatives: Array<{ path: string; confidence: number }>;
  related: string[];
};

export type TopicNode = {
  id: string;
  name: string;
  count: number;
  children?: TopicNode[];
};

export const domains: TopicNode[] = [
  {
    id: "investment",
    name: "投资研究",
    count: 18,
    children: [
      { id: "ai-capex", name: "AI 资本开支", count: 6 },
      { id: "banking", name: "银行与支付", count: 5 },
      { id: "execution", name: "交易系统与执行", count: 7 },
    ],
  },
  {
    id: "ai",
    name: "AI 与软件",
    count: 24,
    children: [
      { id: "agents", name: "Agent 工作流", count: 9 },
      { id: "models", name: "模型与成本", count: 8 },
      { id: "knowledge", name: "知识库与检索", count: 7 },
    ],
  },
  {
    id: "vfx",
    name: "影视与 VFX",
    count: 16,
    children: [
      { id: "compositing", name: "合成工作流", count: 7 },
      { id: "transcript", name: "音视频转写", count: 5 },
      { id: "color", name: "色彩与交付", count: 4 },
    ],
  },
  {
    id: "accounts",
    name: "海外账号体系",
    count: 11,
    children: [
      { id: "apple-id", name: "Apple ID 与地区", count: 6 },
      { id: "bank-apps", name: "银行 App 与身份", count: 5 },
    ],
  },
  {
    id: "life",
    name: "长期事务",
    count: 13,
    children: [
      { id: "car", name: "车辆维护", count: 5 },
      { id: "nanjing-rent", name: "南京租房", count: 4 },
      { id: "equipment", name: "设备与环境", count: 4 },
    ],
  },
];

const inboxItemSeeds: Array<
  Omit<InboxItem, "suggestedPath" | "confidence" | "reasons" | "scoreParts" | "alternatives">
> = [
  {
    id: "src-1",
    kind: "chatgpt",
    title: "AI 资本开支周期是否接近拐点",
    sourceLabel: "ChatGPT conversations.json",
    sourceDate: "2026/07/23 22:14",
    excerpt:
      "从云厂商现金流、GPU 交付周期和折旧口径看，资本开支仍在高位，但增速的判断需要区分训练集群与推理基础设施。",
    status: "pending",
    related: ["云厂商资本开支周报", "GPU 交付周期跟踪", "折旧年限变化的现金流影响"],
  },
  {
    id: "src-2",
    kind: "claude",
    title: "Codex 与 Obsidian 的知识整理边界",
    sourceLabel: "Claude export.json",
    sourceDate: "2026/07/24 10:36",
    excerpt:
      "应用数据库应保持唯一正式数据所有者，开放 Markdown 作为可审阅交换层；自动整理必须留下差异和回滚证据。",
    status: "pending",
    related: ["本地优先知识库架构", "Markdown 交换层约束"],
  },
  {
    id: "src-3",
    kind: "transcript",
    title: "Fusion 合成镜头复盘：边缘污染与运动模糊",
    sourceLabel: "项目复盘_052.srt",
    sourceDate: "2026/07/22 18:05",
    excerpt:
      "第 00:12:43 处的边缘污染来自预乘处理顺序，镜头在添加运动模糊前需要先完成去边和颜色空间确认。",
    status: "pending",
    related: ["ACES 色彩空间检查表", "Fusion 去边节点实验"],
  },
  {
    id: "src-4",
    kind: "markdown",
    title: "南京租房观察：通勤与噪音权重",
    sourceLabel: "南京租房候选.md",
    sourceDate: "2026/07/20 09:42",
    excerpt:
      "候选区域的比较不应只看租金，需要把通勤稳定性、夜间噪音、停车和长期生活便利度放入同一权重框架。",
    status: "pending",
    related: ["河西通勤实测", "租房决策权重草案"],
  },
];

export const initialInboxItems: InboxItem[] = inboxItemSeeds.map((seed) => {
  const fixture = classificationSourceFixtures.find((candidate) => candidate.source.id === seed.id);
  if (!fixture) throw new Error(`缺少分类固定数据：${seed.id}`);
  const result = classifySource({
    source: fixture.source,
    topics: classificationTopics,
    rules: classificationRules,
    history: classificationHistory,
    searchSignals: fixture.searchSignals,
  });
  const [top, ...alternatives] = result.suggestions;
  return {
    ...seed,
    suggestedPath: top.topicPath,
    confidence: Math.round(top.confidence),
    reasons: top.reasons.slice(0, 4),
    scoreParts: top.signalScores.map((signal) => ({
      label: signal.label,
      score: signal.contributedPoints,
      max: signal.weight,
    })),
    alternatives: alternatives.slice(0, 2).map((suggestion) => ({
      path: suggestion.topicPath.join(" / "),
      confidence: Math.round(suggestion.confidence),
    })),
  };
});

export const topicHistory = [
  {
    date: "2026/06/18",
    label: "初始判断",
    content: "头部云厂商仍会维持高资本开支，主要由训练集群扩张驱动。",
    tone: "neutral",
  },
  {
    date: "2026/07/02",
    label: "证据增强",
    content: "新增三家厂商财报证据，推理基础设施开始成为独立投入项。",
    tone: "positive",
  },
  {
    date: "2026/07/23",
    label: "待确认转折",
    content: "资本开支总量仍高，但增速和自由现金流压力出现分化。",
    tone: "warning",
  },
];

export const evidenceItems = [
  { title: "云厂商 A 2026Q2 财报", claim: "资本开支同比 +41%，其中 AI 基础设施占主要增量", strength: "强" },
  { title: "GPU 交付周期访谈", claim: "交付周期由 24 周回落到 17 周", strength: "中" },
  { title: "数据中心电力接入报告", claim: "部分地区的电力约束将扩建周期推迟 2–3 个季度", strength: "强" },
];

export const openQuestions = [
  "推理侧资本开支能否抵消训练集群增速放缓？",
  "折旧年限变化对自由现金流的改善有多少是口径因素？",
  "电力与网络设备是否会成为下一阶段主要约束？",
];
