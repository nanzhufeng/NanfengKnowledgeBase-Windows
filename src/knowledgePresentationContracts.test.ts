/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const reader = readFileSync(
  new URL("./components/KnowledgeReadingWorkspace.tsx", import.meta.url),
  "utf8",
);
const topicManager = readFileSync(
  new URL("./components/TopicStructureReadingWorkspace.tsx", import.meta.url),
  "utf8",
);
const topicHierarchy = readFileSync(
  new URL("./components/KnowledgeTopicHierarchy.tsx", import.meta.url),
  "utf8",
);
const workspace = readFileSync(
  new URL("./components/KnowledgeWorkspace.tsx", import.meta.url),
  "utf8",
);

describe("全局反馈与知识阅读层级合同", () => {
  it("导出提示固定在画面中心并提供高对比原路径操作", () => {
    expect(app).toContain('className="prototype-notice"');
    expect(app).toContain('className="notice-action"');
    expect(app).toContain('actionLabel: "打开原路径"');
    expect(styles).toMatch(
      /\.prototype-notice\s*\{[\s\S]*?z-index:\s*240;[\s\S]*?top:\s*50%;[\s\S]*?left:\s*50%;[\s\S]*?transform:\s*translate\(-50%,\s*-50%\);/,
    );
    expect(styles).toMatch(
      /\.prototype-notice \.notice-action\s*\{[\s\S]*?color:\s*#fff;[\s\S]*?background:\s*linear-gradient/,
    );
    expect(styles).toContain("border: 2px solid rgba(232, 101, 43, .76)");
  });

  it("竞争假设把核心解释、提取依据、证据和有效性条件分区呈现", () => {
    expect(reader).toContain('className="knowledge-final-hypothesis-thesis"');
    expect(reader).toContain(">核心解释<");
    expect(reader).toContain('className="knowledge-final-auto-rationale"');
    expect(reader).toContain(">提取依据<");
    expect(reader).toContain('aria-label="假设有效性条件"');
    expect(styles).toContain(".knowledge-final-hypothesis-thesis");
    expect(styles).toContain(".knowledge-final-evidence-grid");
    expect(reader).not.toContain('className="knowledge-final-section-heading"');
    expect(reader).not.toContain("命题选择");
  });

  it("知识摘要在四个长阅读状态之前统一展示并保持紧凑首屏", () => {
    expect(reader).toContain('aria-label="自动知识摘要"');
    expect(reader).toContain('className="knowledge-overview-judgment"');
    expect(reader).toContain('className="knowledge-overview-grid"');
    expect(reader).toContain('title="事实与线索"');
    expect(reader).toContain('title="关键证据"');
    expect(reader).toContain('title="待验证问题"');
    expect(reader).toContain('title="建议下一步"');
    expect(reader.indexOf('aria-label="自动知识摘要"'))
      .toBeLessThan(reader.indexOf('className="knowledge-final-tabs"'));
    expect(styles).toMatch(
      /\.knowledge-overview-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/,
    );
    expect(styles).toMatch(
      /\.knowledge-overview-card\s*\{[\s\S]*?min-height:\s*102px;/,
    );
  });

  it("四张知识摘要卡统一通过弹窗完整阅读且保留后续深读入口", () => {
    expect(reader).toContain('type KnowledgeOverviewDialogState = {');
    expect(reader).toContain('className="knowledge-overview-dialog-backdrop"');
    expect(reader).toContain('role="dialog"');
    expect(reader).toContain('aria-modal="true"');
    expect(reader).toContain('overviewDialog.items.map((item, index) =>');
    expect(reader.match(/actionLabel="查看全部"/g)).toHaveLength(4);
    expect(reader.match(/onOpen=\{\(trigger\) => openOverviewDialog\(\{/g)).toHaveLength(4);
    expect(reader).toContain('if (event.key === "Escape") setOverviewDialog(null);');
    expect(reader).toContain('if (event.target === event.currentTarget) setOverviewDialog(null);');
    expect(reader).toContain('document.body.style.overflow = "hidden";');
    expect(reader).toContain("document.body.style.overflow = previousBodyOverflow;");
    expect(styles).toMatch(
      /\.knowledge-overview-dialog\s*\{[\s\S]*?max-height:\s*min\(760px,\s*calc\(100dvh - 48px\)\);[\s\S]*?overflow:\s*hidden;/,
    );
    expect(styles).toMatch(
      /\.knowledge-overview-dialog-list\s*\{[\s\S]*?overflow-y:\s*auto;/,
    );
  });

  it("判断演变把跨时期证据放在首位并移除重复轨迹概览", () => {
    expect(reader).toContain('data-reading-section="version-difference"');
    expect(reader).toContain('data-reading-section="cross-time-evidence"');
    expect(reader).toContain("跨时期知识事件");
    expect(reader).not.toContain('data-reading-section="judgment-trajectory"');
    expect(reader).not.toContain("判断轨迹与本次变化");
    expect(reader.indexOf('data-reading-section="cross-time-evidence"'))
      .toBeLessThan(reader.indexOf('data-reading-section="version-difference"'));
    expect(reader).not.toContain("支撑材料");
    expect(reader).not.toContain("对照阅读");
  });

  it("笔记与来源明确区分笔记索引、正文主体和回溯来源", () => {
    expect(reader).toContain('data-reading-section="notes-and-sources"');
    expect(reader).not.toContain("先读笔记，再回溯原始来源");
    expect(reader).not.toContain("阅读主体");
    expect(reader).toContain("knowledge-final-reading-pane is-index");
    expect(reader).toContain("knowledge-final-reading-pane is-content");
    expect(reader).toContain("knowledge-final-reading-pane is-support");
    expect(reader).toContain('"is-empty"');
    expect(styles).toContain(".knowledge-final-note-list.is-empty");
  });

  it("决策账本直接进入完整决策链并把来源收进卡片元信息区", () => {
    expect(reader).toContain("判断、决策、行动与复盘");
    expect(reader).toContain('data-reading-section="decision-chain"');
    expect(reader).not.toContain('data-reading-section="decision-overview"');
    expect(reader).not.toContain("决策版本概览");
    expect(reader).not.toContain("完整链路");
    expect(reader).toContain('className="knowledge-final-decision-source"');
    expect(reader).not.toContain('className="knowledge-final-reading-section-heading"');
    expect(styles).toContain(
      ".knowledge-final-decision-version > header .knowledge-final-decision-source",
    );
    expect(styles).not.toContain(".knowledge-final-reading-section-heading");
  });

  it("四个知识状态统一直接进入主要内容并复用紧凑内边距", () => {
    expect(reader).not.toContain("ReadingSectionHeading");
    expect(reader).not.toContain('className="knowledge-final-mode-heading"');
    expect(styles).toMatch(
      /\.knowledge-final-scroll\s*\{[\s\S]*?padding:\s*14px;/,
    );
    expect(styles).toMatch(
      /\.knowledge-final-source-mode > \.knowledge-final-assets\s*\{[\s\S]*?padding:\s*0;[\s\S]*?border:\s*0;/,
    );
    expect(styles).toMatch(
      /\.knowledge-final-note-reader\s*\{[\s\S]*?calc\(100dvh - 282px\)/,
    );
  });

  it("知识视图小字只保留判断、定位或操作价值", () => {
    expect(reader).not.toContain("当前主题 + 已确认相关主题");
    expect(reader).not.toContain("围绕命题、证据与判断演变阅读知识成果");
    expect(reader).not.toContain("当前只展示正式 Repository 返回的内容");
    expect(reader).not.toContain("已进入知识结构");
    expect(reader).not.toContain("暂无可可靠提炼的内容");
    expect(reader).not.toContain("从笔记正文提炼的竞争解释");
    expect(reader).not.toContain("自动提炼的决策草案");
    expect(reader).not.toContain("正文中暂未识别出开放问题");
    expect(reader).not.toContain("暂无到期或复核风险");
    expect(reader).not.toContain('className="knowledge-final-topic-facts"');
    expect(reader).not.toContain('className="knowledge-final-decision-detail-grid"');
    expect(reader).toContain('className="knowledge-final-decision-risks"');
    expect(reader).toContain("当前筛选无事件");
    expect(styles).not.toContain(".knowledge-final-topic-facts");
    expect(styles).not.toContain(".knowledge-final-decision-detail-grid");
  });

  it("来源档案删除重复页面标题、入口职责说明和加载总数", () => {
    expect(workspace).not.toContain("原始来源与自动整理结果");
    expect(workspace).not.toMatch(/已加载 \{inbox\.length\} 条有效来源/);
    expect(workspace).not.toContain("<h1>来源档案</h1>");
    expect(workspace).toContain('className="knowledge-page-header source-page-actions-only"');
  });

  it("知识视图与主题管理共用一套领域主题列表和折叠状态", () => {
    expect(reader).toContain("<KnowledgeTopicHierarchy");
    expect(topicManager).toContain("<KnowledgeTopicHierarchy");
    expect(reader).not.toContain("collapsedDomainIds");
    expect(topicManager).not.toContain("collapsedDomainIds");
    expect(topicHierarchy).toContain("collapsedDomainIds");
    expect(topicHierarchy).toContain('className="knowledge-final-domain-heading"');
    expect(topicHierarchy).toContain("aria-expanded={!collapsed}");
    expect(topicHierarchy).toContain('className={collapsed ? "collapsed" : ""}');
    expect(topicHierarchy).toContain("selectedTopicDomainId");
    expect(styles).toContain(".knowledge-final-domain > .knowledge-final-domain-heading");
  });

  it("主题管理标题区不重复提供编辑主题动作", () => {
    expect(topicManager).not.toContain(">编辑主题</button>");
    expect(topicManager).toContain("进入主题管理");
    expect(topicManager).toContain('onOpenMaintenance("overview", topic.id)');
  });

  it("主题排除能力由系统持有，日常页不要求用户补写规则", () => {
    expect(topicManager).toContain('className={negativeRules.length ? "has-system-exclusions" : undefined}');
    expect(topicManager).toContain("<strong>自动排除</strong>");
    expect(topicManager).toContain("系统用于避免相似关键词误归类，不会删除来源");
    expect(topicManager).toContain("negativeRules.length ? (");
    expect(topicManager).toContain("由主题边界、别名与正文证据自动判断");
    expect(topicManager).not.toContain("尚未记录明确排除条件");
    expect(topicManager).not.toContain("补充排除规则");
    expect(topicManager).not.toContain("调整排除规则");
    expect(topicManager).not.toContain("补充分类依据");
    expect(topicManager).not.toContain('onOpenMaintenance("rules", topic.id)');
    expect(styles).toContain(".topic-boundary > div.has-system-exclusions");
  });

  it("收藏、跟踪与判断更新复用来源档案的双卡比例", () => {
    expect(app).toContain('className={`records-workspace ${scope === "records" ? "" : "record-subview-workspace"}`}');
    expect(app).toContain('data-record-scope={scope}');
    expect(app).toContain("record-subview-list-card");
    expect(styles).toMatch(
      /\.records-workspace\.record-subview-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(300px,\s*24%\)\s*minmax\(0,\s*1fr\);[\s\S]*?gap:\s*14px;/,
    );
    expect(styles).toMatch(
      /\.knowledge-inbox-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(300px,\s*24%\)\s*minmax\(0,\s*1fr\);[\s\S]*?gap:\s*14px;/,
    );
  });

  it("待验证问题使用有序阅读列表而不是正文中的手工圆点", () => {
    expect(reader).toContain("<ol>");
    expect(reader).toContain("<li key={item.id}>{item.question}</li>");
    expect(styles).toContain(".knowledge-final-insights li::marker");
  });
});
