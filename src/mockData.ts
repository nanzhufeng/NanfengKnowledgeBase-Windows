export type RecordStatus = "tracking" | "updated" | "archived";

export type IntelligenceRecord = {
  id: number;
  title: string;
  summary: string;
  date: string;
  source: string;
  status: RecordStatus;
  tags: string[];
  icon: "cloud" | "chip" | "document" | "building" | "radio";
};

export const records: IntelligenceRecord[] = [
  {
    id: 1,
    title: "云厂商资本开支周期与信号追踪",
    summary: "财报与研究对话",
    date: "07-24",
    source: "财报与研究对话",
    status: "tracking",
    tags: ["资本开支", "云计算", "周期"],
    icon: "cloud",
  },
  {
    id: 2,
    title: "半导体设备厂资本开支意愿分析",
    summary: "行业访谈记录",
    date: "07-23",
    source: "行业访谈记录",
    status: "tracking",
    tags: ["资本开支", "半导体", "设备"],
    icon: "chip",
  },
  {
    id: 3,
    title: "AI资本开支与自由现金流",
    summary: "财报与研究对话",
    date: "07-25",
    source: "财报与研究对话",
    status: "tracking",
    tags: ["资本开支", "自由现金流", "云计算"],
    icon: "document",
  },
  {
    id: 4,
    title: "软件企业资本化率变化观察",
    summary: "内部研究笔记",
    date: "07-22",
    source: "内部研究笔记",
    status: "tracking",
    tags: ["资本开支", "资本化", "软件"],
    icon: "building",
  },
  {
    id: 5,
    title: "运营商资本开支结构拆解",
    summary: "财报与研究对话",
    date: "07-20",
    source: "财报与研究对话",
    status: "tracking",
    tags: ["资本开支", "运营商", "网络"],
    icon: "radio",
  },
  {
    id: 6,
    title: "产业链扩产节奏对比",
    summary: "行业访谈记录",
    date: "07-18",
    source: "行业访谈记录",
    status: "tracking",
    tags: ["资本开支", "产业链", "扩产"],
    icon: "building",
  },
];

export const defaultJudgment =
  "头部云厂商在AI驱动下维持高资本开支投入，但自由现金流压力仍在可控区间，2026年或出现结构性分化。";

export const confirmedFacts = [
  "超大规模云厂商2025Q1资本开支同比增长约63%，主要用于GPU集群与数据中心扩建。",
  "AI相关资本开支占总资本开支比例已提升至约70%–75%。",
  "部分厂商通过长期采购协议锁定供应，平滑设备交付周期。",
];

export const openQuestions = [
  "AI需求增速能否在2026年维持当前水平？",
  "资本开支效率（单位算力成本）下降趋势能否延续？",
  "海外供应链与交付节奏是否存在不确定性？",
];

export const nextActions = [
  "跟踪云厂商2025Q2资本开支指引更新",
  "跟踪GPU/网络设备价格与交付周期",
  "与行业专家访谈，验证需求与订单能见度",
];

export const evidence = [
  { title: "公司A 2025Q1业绩会纪要", source: "财报与研究对话" },
  { title: "公司B 2025Q1投资者信", source: "财报与研究对话" },
  { title: "公司C 资本开支拆分表", source: "财报与研究对话" },
];

export const versions = [
  {
    version: "v3",
    date: "2026-07-25 10:32",
    note: "补充自由现金流判断与供应链风险",
    current: true,
  },
  {
    version: "v2",
    date: "2026-07-18 16:20",
    note: "加入二季度资本开支指引",
    current: false,
  },
  {
    version: "v1",
    date: "2026-07-05 09:18",
    note: "首次建立研究记录",
    current: false,
  },
];

export const sampleJson = `{
  "schema_version": "1.0",
  "title": "AI资本开支与自由现金流",
  "summary": "AI基础设施投入短期压制自由现金流",
  "status": "tracking",
  "topics": ["AI", "投资"],
  "tags": ["资本开支", "自由现金流", "云计算"],
  "current_judgment": "短期现金流承压，但长期回报取决于商业化效率。",
  "created_at": "2026-07-25T10:00:00+08:00"
}`;
