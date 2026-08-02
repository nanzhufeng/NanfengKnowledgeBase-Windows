import type {
  ClassificationHistory,
  ClassificationRule,
  ExternalSearchSignal,
  KnowledgeSourceDraft,
  KnowledgeTopicCandidate,
} from "./domain";

export const CLASSIFICATION_TOPIC_CATALOG_VERSION = "prototype-seed-v1";
export const CLASSIFICATION_TOPIC_CATALOG_STATUS = "provisional" as const;

export const classificationTopics: KnowledgeTopicCandidate[] = [
  {
    id: "ai-capex-cycle",
    primaryDomainId: "investment",
    path: ["投资研究", "AI 资本开支", "周期与现金流"],
    name: "周期与现金流",
    aliases: ["AI 资本开支", "资本开支周期", "CapEx"],
    entities: ["GPU", "云厂商", "自由现金流", "折旧"],
    keywords: ["资本开支", "算力", "训练集群", "推理基础设施", "现金流"],
    searchDocument: "云厂商 AI 资本开支 GPU 交付 折旧年限 自由现金流 训练集群 推理基础设施",
    status: "watching",
    updatedAt: "2026-07-23T22:14:00+08:00",
  },
  {
    id: "model-cost",
    primaryDomainId: "ai",
    path: ["AI 与软件", "模型与成本"],
    name: "模型与成本",
    aliases: ["模型价格", "token 成本"],
    entities: ["Claude", "GPT", "Gemini", "API"],
    keywords: ["模型", "推理", "价格", "额度", "token"],
    searchDocument: "大模型 API 定价 token 使用额度 推理成本 模型选择",
    status: "active",
    updatedAt: "2026-07-18T09:00:00+08:00",
  },
  {
    id: "open-file-workflow",
    primaryDomainId: "ai",
    path: ["AI 与软件", "知识库与检索", "开放文件工作流"],
    name: "开放文件工作流",
    aliases: ["知识库与检索", "Markdown 交换层", "Obsidian 工作流"],
    entities: ["Codex", "Obsidian", "Markdown", "SQLite"],
    keywords: ["本地优先", "知识库", "交换层", "数据库", "可审阅", "回滚"],
    searchDocument: "Codex Obsidian Markdown 本地知识库 SQLite 唯一数据所有者 开放文件 版本 回滚",
    status: "active",
    updatedAt: "2026-07-24T10:36:00+08:00",
  },
  {
    id: "agent-workflow",
    primaryDomainId: "ai",
    path: ["AI 与软件", "Agent 工作流"],
    name: "Agent 工作流",
    aliases: ["Codex 工作流", "Claude Agent"],
    entities: ["Codex", "Claude", "MCP"],
    keywords: ["代理", "工具", "工作流", "自动化", "上下文"],
    searchDocument: "Codex Claude Agent MCP 工具调用 自动化工作流 上下文",
    status: "active",
    updatedAt: "2026-07-22T09:00:00+08:00",
  },
  {
    id: "fusion-review",
    primaryDomainId: "vfx",
    path: ["影视与 VFX", "合成工作流", "Fusion 镜头复盘"],
    name: "Fusion 镜头复盘",
    aliases: ["Fusion 合成", "镜头复盘"],
    entities: ["Fusion", "ACES", "预乘", "运动模糊"],
    keywords: ["合成", "镜头", "边缘污染", "去边", "运动模糊", "颜色空间"],
    searchDocument: "Fusion 合成镜头 预乘 去边 边缘污染 运动模糊 ACES 颜色空间",
    status: "active",
    updatedAt: "2026-07-22T18:05:00+08:00",
  },
  {
    id: "video-transcript",
    primaryDomainId: "vfx",
    path: ["影视与 VFX", "音视频转写"],
    name: "音视频转写",
    aliases: ["字幕整理", "SRT", "VTT"],
    entities: ["Whisper", "SRT", "VTT"],
    keywords: ["字幕", "转写", "时间码", "音频", "视频"],
    searchDocument: "视频 音频 字幕 SRT VTT 转写 时间锚点 Whisper",
    status: "active",
    updatedAt: "2026-07-19T09:00:00+08:00",
  },
  {
    id: "nanjing-rent-options",
    primaryDomainId: "life",
    path: ["长期事务", "南京租房", "候选区域比较"],
    name: "候选区域比较",
    aliases: ["南京租房", "租房决策"],
    entities: ["南京", "河西", "江宁"],
    keywords: ["租金", "通勤", "噪音", "停车", "居住", "区域"],
    searchDocument: "南京 租房 候选区域 租金 通勤 噪音 停车 长期居住",
    status: "watching",
    updatedAt: "2026-07-20T09:42:00+08:00",
  },
  {
    id: "equipment-environment",
    primaryDomainId: "life",
    path: ["长期事务", "设备与环境"],
    name: "设备与环境",
    aliases: ["工作环境", "硬件设备"],
    entities: ["Mac", "Windows", "显示器"],
    keywords: ["设备", "噪音", "温度", "硬件", "环境"],
    searchDocument: "电脑 硬件 设备 工作环境 噪音 温度 显示器",
    status: "active",
    updatedAt: "2026-07-17T09:00:00+08:00",
  },
];

export const classificationRules: ClassificationRule[] = [
  {
    id: "rule-ai-capex-title",
    topicId: "ai-capex-cycle",
    field: "title",
    operator: "contains",
    value: "资本开支",
    strength: 1,
    reason: "标题命中用户规则「资本开支」",
    enabled: true,
  },
  {
    id: "rule-open-file-obsidian",
    topicId: "open-file-workflow",
    field: "title",
    operator: "contains",
    value: "Obsidian",
    strength: 0.75,
    reason: "标题命中开放文件工作流规则「Obsidian」",
    enabled: true,
  },
  {
    id: "rule-fusion-subtitle",
    topicId: "fusion-review",
    field: "text",
    operator: "contains",
    value: "预乘",
    strength: 0.55,
    reason: "正文命中合成复盘规则「预乘」",
    enabled: true,
  },
  {
    id: "rule-nanjing-rent",
    topicId: "nanjing-rent-options",
    field: "title",
    operator: "contains",
    value: "南京租房",
    strength: 0.35,
    reason: "标题命中生活主题规则「南京租房」",
    enabled: true,
  },
  {
    id: "rule-srt-transcript",
    topicId: "video-transcript",
    field: "source_kind",
    operator: "equals",
    value: "subtitle",
    strength: 0.35,
    reason: "来源类型为字幕文件",
    enabled: true,
  },
];

export const classificationHistory: ClassificationHistory = {
  confirmedTopicCounts: {
    "ai-capex-cycle": 5,
    "open-file-workflow": 3,
    "fusion-review": 2,
    "video-transcript": 2,
    "nanjing-rent-options": 1,
  },
  recentTopicIds: ["ai-capex-cycle", "open-file-workflow", "fusion-review", "nanjing-rent-options"],
  batchTopicIds: {
    "batch-research-0723": ["ai-capex-cycle"],
    "batch-vfx-0722": ["fusion-review", "video-transcript"],
  },
};

export const classificationSourceFixtures: Array<{
  source: KnowledgeSourceDraft;
  searchSignals: ExternalSearchSignal[];
  expectedTopicId: string;
  expectedAction: "auto_eligible" | "confirm" | "candidates" | "manual";
}> = [
  {
    source: {
      id: "src-1",
      title: "AI 资本开支周期是否接近拐点",
      text: "从云厂商现金流、GPU 交付周期和折旧口径看，资本开支仍在高位，但增速的判断需要区分训练集群与推理基础设施。",
      kind: "ai_conversation",
      platform: "ChatGPT",
      fileName: "conversations.json",
      importedAt: "2026-07-23T22:14:00+08:00",
      batchId: "batch-research-0723",
    },
    searchSignals: [
      {
        topicId: "ai-capex-cycle",
        normalizedScore: 0.92,
        reason: "FTS5/BM25 对标题、摘要和正文的加权相关度为 92%",
      },
    ],
    expectedTopicId: "ai-capex-cycle",
    expectedAction: "auto_eligible",
  },
  {
    source: {
      id: "src-2",
      title: "Codex 与 Obsidian 的知识整理边界",
      text: "应用数据库应保持唯一正式数据所有者，开放 Markdown 作为可审阅交换层；自动整理必须留下差异和回滚证据。",
      kind: "ai_conversation",
      platform: "Claude",
      fileName: "claude-export.json",
      importedAt: "2026-07-24T10:36:00+08:00",
    },
    searchSignals: [
      {
        topicId: "open-file-workflow",
        normalizedScore: 0.86,
        reason: "FTS5/BM25 对标题、摘要和正文的加权相关度为 86%",
      },
    ],
    expectedTopicId: "open-file-workflow",
    expectedAction: "auto_eligible",
  },
  {
    source: {
      id: "src-3",
      title: "Fusion 合成镜头复盘：边缘污染与运动模糊",
      text: "第 00:12:43 处的边缘污染来自预乘处理顺序，镜头在添加运动模糊前需要先完成去边和颜色空间确认。",
      kind: "subtitle",
      platform: "本地文件",
      fileName: "项目复盘_052.srt",
      folderPath: "影视/VFX/镜头复盘",
      importedAt: "2026-07-22T18:05:00+08:00",
      batchId: "batch-vfx-0722",
    },
    searchSignals: [
      {
        topicId: "fusion-review",
        normalizedScore: 0.78,
        reason: "FTS5/BM25 对标题、摘要和正文的加权相关度为 78%",
      },
      {
        topicId: "video-transcript",
        normalizedScore: 0.44,
        reason: "字幕来源与音视频转写主题相关",
      },
    ],
    expectedTopicId: "fusion-review",
    expectedAction: "auto_eligible",
  },
  {
    source: {
      id: "src-4",
      title: "南京租房观察：通勤与噪音权重",
      text: "候选区域的比较不应只看租金，需要把通勤稳定性、夜间噪音、停车和长期生活便利度放入同一权重框架。",
      kind: "markdown",
      platform: "本地文件",
      fileName: "南京租房候选.md",
      importedAt: "2026-07-20T09:42:00+08:00",
    },
    searchSignals: [
      {
        topicId: "nanjing-rent-options",
        normalizedScore: 0.64,
        reason: "FTS5/BM25 对标题、摘要和正文的加权相关度为 64%",
      },
    ],
    expectedTopicId: "nanjing-rent-options",
    expectedAction: "candidates",
  },
];
