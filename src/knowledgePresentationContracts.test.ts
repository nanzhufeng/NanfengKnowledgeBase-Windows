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
const hoverWheelRouting = readFileSync(
  new URL("./interactions/hoverWheelRouting.ts", import.meta.url),
  "utf8",
);
const fixedVirtualList = readFileSync(
  new URL("./performance/fixedVirtualList.ts", import.meta.url),
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

  it("当前知识视图为三套场景皮肤提供单一苹果式材质配方与实体回退", () => {
    for (const role of ["navigation", "workspace", "content", "control", "popover", "modal"]) {
      expect(styles).toContain(`--knowledge-material-${role}-surface:`);
    }
    expect(styles).toContain(':root[data-knowledge-skin]:not([data-knowledge-skin="classic"])');
    for (const skin of ["desert-lantern", "florist-studio", "golden-horses"]) {
      expect(styles).toContain(`:root[data-knowledge-skin="${skin}"]`);
    }
    expect(styles).toContain('.app-shell:not([data-skin="classic"]) .knowledge-reading-page');
    expect(styles).toContain("backdrop-filter: none;");
    expect(styles).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(styles).toContain("@media (prefers-contrast: more)");
    expect(styles).toContain("@supports not ((backdrop-filter: blur(1px))");
    expect(reader).toContain('data-scroll-edge={readerHasScrolled ? "visible" : "hidden"}');
    expect(reader).toContain("event.currentTarget.scrollTop > 4");
    expect(styles).toContain('--knowledge-material-dither: url("./assets/skins/material-dither.svg")');
    for (const role of ["navigation", "workspace", "content", "control", "modal"]) {
      expect(styles).toMatch(new RegExp(
        `--knowledge-material-${role}-surface:\\s*var\\(--knowledge-material-dither\\),`,
      ));
    }
  });

  it("以 v54 固定材质配方为基线做低白度层次细化且不注入被否决的动态明度角色", () => {
    expect(styles).toContain("rgba(250, 247, 244, .88) 0%");
    expect(styles).toContain("rgba(218, 226, 236, .82) 100%");
    expect(styles).toContain("rgba(252, 252, 251, .62), rgba(229, 238, 247, .46)");
    expect(styles).toContain("rgba(250, 249, 247, .76), rgba(var(--knowledge-material-cool-rgb), .5)");
    expect(styles).toContain("--knowledge-material-edge-vignette:");
    expect(app).not.toContain("--skin-material-");
    expect(styles).not.toContain("--skin-material-");
  });

  it("所有入口统一提亮前景卡并保护主题整合主要来源卡", () => {
    for (const role of [
      "browser-group",
      "browser-item",
      "browser-active",
      "reading-card",
      "reading-card-nested",
      "reading-support",
    ]) {
      expect(styles).toContain(`--knowledge-material-${role}-surface:`);
    }
    expect(styles).toContain("前景卡只通过低色度 RGB 明度与直接承托层拉开");
    expect(styles).toContain("--knowledge-material-foreground-card-color: rgba(255, 255, 255, .92)");
    expect(styles).toContain("rgba(253, 254, 255, .8)");
    expect(styles).toContain("rgba(253, 254, 255, .9)");
    expect(styles).toContain("rgba(254, 255, 255, .94)");
    expect(styles).toMatch(
      /\.knowledge-final-domain > button:not\(\.knowledge-final-domain-heading\):not\(\.active\)[\s\S]*?background:\s*var\(--knowledge-material-browser-item-surface\);/,
    );
    expect(styles).toMatch(
      /\.knowledge-final-insights > section,[\s\S]*?\.knowledge-final-version-diff,[\s\S]*?\.knowledge-final-timeline,[\s\S]*?\.knowledge-final-decision-version[\s\S]*?background:\s*var\(--knowledge-material-reading-card-surface\);/,
    );
    expect(styles).toMatch(
      /\.knowledge-final-hypothesis-thesis,[\s\S]*?\.knowledge-final-evidence-column[\s\S]*?background:\s*var\(--knowledge-material-reading-card-nested-surface\);/,
    );
    const sharedExposureRule = styles.match(
      /卡片二、知识四状态与其他入口消费同一组“明亮前景卡”角色([\s\S]*?)\.app-shell:not\(\[data-skin="classic"\]\) \.knowledge-final-auto-rationale/,
    )?.[1] ?? "";
    expect(sharedExposureRule).toContain(".knowledge-final-reading-pane.is-support");
    expect(sharedExposureRule).not.toContain(".knowledge-final-reading-pane.is-content {");
    expect(styles).toMatch(
      /\.knowledge-final-reading-pane\.is-content\s*\{[\s\S]*?background:\s*rgba\(255, 255, 255, \.84\);/,
    );
    expect(styles).toMatch(
      /\.record-card,[\s\S]*?\.unified-note-card:not\(\.selected\),[\s\S]*?\.settings-row,[\s\S]*?background-color:\s*var\(--knowledge-material-foreground-card-color\);/,
    );
  });

  it("来源记录详情统一移除旧判断分类与历史版本展示", () => {
    const detailPanel = app.match(/function DetailPanel\([\s\S]*?const MemoDetailPanel/)?.[0] ?? "";
    const editor = app.match(/function EditRecordDialog\([\s\S]*?function TrashPage/)?.[0] ?? "";
    for (const obsoleteLabel of ["当前判断", "已确认事实", "关键证据", "待验证问题", "下一步行动", "历史版本"]) {
      expect(detailPanel).not.toContain(obsoleteLabel);
      expect(editor).not.toContain(obsoleteLabel);
    }
    expect(detailPanel).toContain('className={`record-content-card');
    expect(detailPanel).toContain('className="attachments-card"');
    expect(detailPanel).toContain('className="source-content-dialog"');
    expect(detailPanel).toContain("source-archive-detail");
    expect(app).toContain('scope: "records" | "favorites" | "tracking" | "updates"');
  });

  it("全部笔记复用收藏的非滚动筛选外壳，列表只在其下方独立滚动", () => {
    expect(workspace).toMatch(
      /<UnifiedNoteListPanel[\s\S]*?<UnifiedNoteListSearchRow[\s\S]*?<UnifiedNoteListDisplayToolbar[\s\S]*?<UnifiedNoteListToolbar className="knowledge-source-filter-control-row"[\s\S]*?<UnifiedNoteListLocator[\s\S]*?className="knowledge-source-list-viewport"[\s\S]*?className="knowledge-source-list-scroll"/,
    );
    expect(workspace).not.toContain('className="knowledge-source-filters"');
    expect(workspace).not.toContain("sourceFiltersRef");
    expect(styles).toMatch(
      /\.knowledge-source-list-viewport\s*\{[\s\S]*?flex:\s*1;[\s\S]*?overflow:\s*hidden;/,
    );
    expect(styles).toMatch(
      /\.knowledge-source-list-scroll\s*\{[\s\S]*?height:\s*100%;[\s\S]*?overflow-y:\s*auto;/,
    );
    expect(styles).not.toContain(".knowledge-source-filters::after");
    expect(styles).not.toMatch(/\.knowledge-source-filters[\s\S]*?position:\s*sticky;/);
    expect(styles).not.toMatch(/\.knowledge-source-filters[\s\S]*?margin-right:\s*-12px;/);
  });

  it("场景皮肤由材质渐退消除闭环白边且不向所有内容卡片新增描边", () => {
    expect(app).not.toContain("--skin-scene-edge-gradient");
    expect(styles).not.toContain("--knowledge-material-edge-gradient");
    expect(styles).not.toContain("mask-composite: exclude");
    expect(styles).toMatch(
      /\.knowledge-reading-page\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*var\(--knowledge-material-workspace-surface\);/,
    );
    expect(styles).not.toMatch(/--knowledge-material-(?:navigation|workspace|content|modal)-shadow:[^;]*inset/);
    expect(styles).toContain("旧 2px 双向 mask 在 WebView2 裁切抗锯齿中会重新显成连续细白线");
    expect(styles).not.toContain("mask-composite: intersect;");
    expect(styles).toContain("禁止给所有场景卡片统一补一圈等亮白线");
    expect(styles).not.toContain("outline: 1px solid rgba(255, 255, 255, 0.22)");
    const outerEdgeRule = styles.match(
      /旧 2px 双向 mask[\s\S]*?\.app-shell:not\(\[data-skin="classic"\]\) :is\(([\s\S]*?)\)\s*\{[\s\S]*?mask-image:\s*none;/,
    )?.[1] ?? "";
    expect(outerEdgeRule).toContain(".records-workspace");
    expect(outerEdgeRule).toContain(".knowledge-page");
    for (const internalSurface of [
      ".record-pane",
      ".detail-panel",
      ".knowledge-inbox-list",
      ".knowledge-inbox-detail",
      ".knowledge-final-tree-card",
      ".knowledge-final-reader",
      ".topic-final-reader",
      ".search-field",
    ]) {
      expect(outerEdgeRule).not.toContain(internalSurface);
    }
  });

  it("持久内部卡片不在磨砂工作区内再次创建实时背景滤镜合成层", () => {
    const navigationSurfaceRule = styles.match(
      /将主题洞察已确认的材质层级同步到其余页面[\s\S]*?\.app-shell:not\(\[data-skin="classic"\]\) :is\(\s*\.record-pane,\s*\.knowledge-inbox-list,\s*\.knowledge-final-tree-card\s*\)\s*\{([\s\S]*?)\}/,
    )?.[1] ?? "";

    expect(navigationSurfaceRule).toContain("background: var(--knowledge-material-navigation-surface);");
    expect(navigationSurfaceRule).toContain("backdrop-filter: none;");
    expect(navigationSurfaceRule).toContain("-webkit-backdrop-filter: none;");
    expect(navigationSurfaceRule).not.toContain("var(--knowledge-material-navigation-filter)");
    const persistentControlRule = styles.match(
      /\.app-shell:not\(\[data-skin="classic"\]\) :is\(\s*\.search-field,\s*\.topic-final-search,\s*\.data-exchange-tabs\s*\)\s*\{([\s\S]*?)\}/,
    )?.[1] ?? "";
    expect(persistentControlRule).toContain("background: var(--knowledge-material-control-surface);");
    expect(persistentControlRule).toContain("backdrop-filter: none;");
    expect(persistentControlRule).toContain("-webkit-backdrop-filter: none;");
    expect(persistentControlRule).not.toContain("var(--knowledge-material-control-filter)");
    expect(workspace).not.toContain('className="knowledge-source-filters"');
    expect(styles).toContain("WebView2 的 GPU 分块重绘会把内部滤镜边界暴露成纵向亮块");
  });

  it("场景皮肤左侧导航独立使用高可读分层材质而不复用主题树透明度", () => {
    expect(styles).toContain("--knowledge-material-sidebar-surface:");
    expect(styles).toContain("--knowledge-material-navigation-surface:");
    expect(styles).toMatch(
      /\.sidebar\s*\{[\s\S]*?background:\s*var\(--knowledge-material-sidebar-surface\);/,
    );
    expect(styles).toContain('.sidebar .nav-group-supporting');
    expect(styles).toContain('.sidebar .sidebar-bottom');
    expect(styles).toContain('.sidebar .storage strong');
    expect(styles).toContain("--knowledge-material-sidebar-filter:");
    expect(styles).toContain("--knowledge-material-popover-shadow:");
    expect(styles).toMatch(
      /\.action-menu,[\s\S]*?background:\s*var\(--knowledge-material-popover-surface\);/,
    );
    expect(styles.match(/--knowledge-material-sidebar-surface:\s*#eef3f8;/g)).toHaveLength(2);
  });

  it("来源档案和主题管理消费知识视图的共享材质层级", () => {
    expect(styles).toMatch(
      /\.records-workspace,[\s\S]*?\.knowledge-page[\s\S]*?background:\s*var\(--knowledge-material-workspace-surface\);/,
    );
    expect(styles).toMatch(
      /\.record-pane,[\s\S]*?\.knowledge-inbox-list,[\s\S]*?\.knowledge-final-tree-card[\s\S]*?background:\s*var\(--knowledge-material-navigation-surface\);/,
    );
    expect(styles).toMatch(
      /\.detail-panel,[\s\S]*?\.knowledge-inbox-detail,[\s\S]*?\.topic-final-reader[\s\S]*?background:\s*var\(--knowledge-material-content-surface\);/,
    );
    expect(styles).toMatch(
      /\.search-field,[\s\S]*?\.topic-final-search[\s\S]*?background:\s*var\(--knowledge-material-control-surface\);/,
    );
    expect(styles).toContain(".topic-final-section,");
    expect(styles).toContain(".settings-row,");
    expect(styles).toContain("搜索框本体必须从控制层承托面上亮出来");
    expect(workspace).toContain('className="search-field source-search-field"');
    expect(styles).toMatch(
      /\.unified-note-list-panel \.filter-button\s*\{[\s\S]*?height:\s*42px;[\s\S]*?border-radius:\s*21px;[\s\S]*?font-size:\s*12px;/,
    );
    expect(styles).toMatch(
      /\.unified-note-list-panel \.filter-button > svg\s*\{[\s\S]*?width:\s*15px;[\s\S]*?height:\s*15px;/,
    );
  });

  it("全软件搜索框聚焦时保留默认投影并只叠加统一焦点环", () => {
    expect(styles).toContain("--search-control-elevation:");
    expect(styles).toContain("--search-control-focus-ring:");
    expect(styles).toContain("聚焦只叠加焦点环，不替换默认投影");
    expect(styles).toMatch(
      /\.unified-note-list-panel \.search-field,[\s\S]*?\.knowledge-final-search,[\s\S]*?\.topic-final-search[\s\S]*?\):focus-within\s*\{[\s\S]*?var\(--search-control-focus-ring\),[\s\S]*?var\(--search-control-elevation\),[\s\S]*?var\(--search-control-inner-highlight\);/,
    );
    expect(styles).not.toContain(".knowledge-source-filters");
    expect(styles).not.toContain(".app-shell:not([data-skin=\"classic\"]) .knowledge-final-search:focus-within");
  });

  it("全软件独立滚动卡片优先原生悬浮滚动，仅在工具栏兜底时按帧转交正文", () => {
    expect(app).toContain("installHoverWheelRouting(document)");
    expect(app).toMatch(/className="records-list"[\s\S]*?data-hover-wheel-scroll=""/);
    expect(app).toMatch(/className="detail-panel source-archive-detail elevated-card association-link-target"[\s\S]*?data-hover-wheel-panel=""[\s\S]*?data-hover-wheel-scroll=""/);
    expect(workspace).toMatch(/className="knowledge-card knowledge-inbox-list"[\s\S]*?data-hover-wheel-panel=""/);
    expect(workspace).toMatch(/className="knowledge-source-list-scroll"[\s\S]*?data-hover-wheel-scroll=""/);
    expect(workspace).toMatch(/className="knowledge-card knowledge-inbox-detail association-link-target"[\s\S]*?data-hover-wheel-panel=""/);
    expect(workspace).toContain('className="knowledge-source-preview" ref={sourceBodyRef} data-hover-wheel-scroll=""');
    expect(topicHierarchy).toContain('className="knowledge-final-tree-card knowledge-card" data-hover-wheel-panel=""');
    expect(topicHierarchy).toContain('className="knowledge-final-tree" onScroll={onScroll} data-hover-wheel-scroll=""');
    expect(reader).toMatch(/className="knowledge-final-reader knowledge-card association-link-target"[\s\S]*?data-hover-wheel-panel=""/);
    expect(reader).toMatch(/className="knowledge-final-scroll"[\s\S]*?data-hover-wheel-scroll=""/);
    expect(topicManager).toMatch(/className="topic-final-reader knowledge-card association-link-target"[\s\S]*?data-hover-wheel-panel=""/);
    expect(topicManager).toContain('className="topic-final-scroll" data-hover-wheel-scroll=""');
    expect(styles).toMatch(/\.knowledge-inbox-list\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?overflow:\s*hidden;/);
    expect(styles).toMatch(/\.knowledge-source-list-scroll\s*\{[\s\S]*?overflow-y:\s*auto;/);
    expect(workspace).not.toContain('className="knowledge-source-filters"');
    expect(workspace).toContain("sourceVirtualList.onScroll()");
    expect(app).toContain("recordVirtualList.onScroll()");
    expect(hoverWheelRouting).toContain("hasNativeScrollAncestor(origin, panel)");
    expect(hoverWheelRouting).toContain("window.requestAnimationFrame");
    expect(hoverWheelRouting).not.toContain("candidate.scrollTop");
  });

  it("卡二条件挂载后重新测量真实视口，不停留在零高度的七行保底窗口", () => {
    expect(workspace).toMatch(/useFixedVirtualList\(\{[\s\S]*?enabled:\s*mode === "sources"/);
    expect(fixedVirtualList).toContain("enabled = true");
    expect(fixedVirtualList).toMatch(/useLayoutEffect\(\(\) => \{[\s\S]*?if \(!enabled\) return undefined;[\s\S]*?updateMetrics\(\);/);
    expect(fixedVirtualList).toContain("[enabled, scheduleMetricsUpdate, scrollElementRef, updateMetrics]");
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

  it("主题整合把多篇笔记收口为一个成果，来源只承担回溯", () => {
    expect(reader).toContain('data-reading-section="notes-and-sources"');
    expect(reader).toContain("buildKnowledgeTopicIntegration(detail)");
    expect(reader).not.toContain("knowledge-final-reading-pane is-index");
    expect(reader).toContain("knowledge-final-reading-pane is-content");
    expect(reader).toContain("knowledge-final-reading-pane is-support");
    expect(reader).toContain('data-assets-layout={detail.sources.length ? "topic-integration" : "integration-only"}');
    expect(reader).toContain("关联笔记与来源");
    expect(reader).toContain('className="knowledge-final-source-switch"');
    expect(reader).toContain('aria-label={`在当前主题内阅读 ${source.title}`}');
    expect(reader).toContain('onClick={() => setLocalSourceSelection({');
    expect(reader).toContain('className="knowledge-final-source-open"');
    expect(reader).toContain('aria-label={`在全部笔记中打开 ${source.title}`}');
    expect(reader).toMatch(/className="knowledge-final-source-open"[\s\S]*?onClick=\{\(\) => onOpenSource\(/);
    expect(reader).not.toMatch(/className=\{`knowledge-final-source-item[\s\S]{0,180}?onClick=/);
    expect(reader).toContain("selectedSource?.contentText?.trim()");
    expect(reader).toContain("返回主题整合");
    expect(reader).not.toContain("主题笔记 <span>");
    expect(reader).not.toContain("暂无独立笔记");
    expect(styles).toContain(".knowledge-final-note-reader.is-topic-integration");
    expect(styles).toContain(".knowledge-final-source-item");
    expect(styles).toContain(".knowledge-final-source-open");
    expect(styles).not.toContain(".knowledge-final-note-list.is-empty");
    expect(styles).toMatch(
      /\.knowledge-final-source-list\s*\{[\s\S]*?grid-template-rows:\s*max-content;[\s\S]*?grid-auto-rows:\s*max-content;[\s\S]*?scrollbar-gutter:\s*stable;/,
    );
    expect(styles).toMatch(
      /\.knowledge-final-source-switch\s*\{[\s\S]*?min-height:\s*52px;/,
    );
  });

  it("决策账本直接进入完整决策链并把来源收进卡片元信息区", () => {
    expect(reader).toContain("判断、决策、行动与复盘");
    expect(reader).toContain('data-reading-section="decision-chain"');
    expect(reader).not.toContain('data-reading-section="decision-overview"');
    expect(reader).not.toContain("决策版本概览");
    expect(reader).not.toContain("完整链路");
    expect(reader).toContain('className="knowledge-final-decision-source"');
    expect(reader).toContain('decision.automatic ? "自动决策草案"');
    expect(reader).toContain('label: "形成依据"');
    expect(reader).toContain('label: "待确认建议"');
    expect(reader).toContain('label: "预期 / 结果"');
    expect(reader).toContain("实际结果尚未产生。");
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

  it("主题洞察小字只保留判断、定位或操作价值", () => {
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

  it("全部笔记删除重复页面标题、入口职责说明和加载总数", () => {
    expect(workspace).not.toContain("原始来源与自动整理结果");
    expect(workspace).not.toMatch(/已加载 \{inbox\.length\} 条有效来源/);
    expect(workspace).not.toContain("<h1>全部笔记</h1>");
    expect(workspace).not.toContain("source-page-actions-only");
    expect(workspace).toContain('className="source-auto-organize-action"');
    expect(workspace).toContain('aria-label="自动整理待归类来源"');
  });

  it("全部笔记标题动作由首帧同步数据决定且查看详情始终占位", () => {
    expect(workspace).toContain(
      "const sourceReturnTopicId = sourceKnowledgeTopic?.id ?? selected?.primaryTopicId ?? null;",
    );
    expect(workspace).toContain("{sourceReturnTopicId !== null || canReturnFromSource ? (");
    expect(workspace).toContain("topicId: sourceReturnTopicId,");
    expect(workspace).not.toMatch(
      /\{selectedOriginalText \? \([\s\S]*?<Maximize2 size=\{16\} \/>查看详情[\s\S]*?\) : null\}/,
    );
    expect(workspace).toMatch(
      /<button[\s\S]*?onClick=\{\(\) => setSourceDetailOpen\(true\)\}[\s\S]*?<Maximize2 size=\{16\} \/>查看详情[\s\S]*?<\/button>/,
    );
  });

  it("主题洞察与主题管理共用一套领域主题列表和折叠状态", () => {
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

  it("收藏、跟踪与判断更新复用全部笔记的双卡比例", () => {
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

  it("全部笔记默认从正文顶部打开且只有手动正文搜索可以定位", () => {
    expect(workspace).toContain('container.scrollTo({ top: 0, behavior: "auto" })');
    expect(workspace).toContain("onSourceNavigationHandled(sourceNavigationTarget.requestId)");
    expect(workspace).not.toContain("readLocator(sourceNavigationTarget.locatorJson)");
    expect(workspace).toContain('scrollSourceElementWithinContainer(container, target, "smooth")');
    expect(workspace).toContain("rememberSourceBodySearch(needle)");
  });

  it("正文搜索历史只回填输入框，不自动执行定位", () => {
    expect(workspace).toContain('aria-label="正文最近搜索"');
    expect(workspace).toContain("setSourceBodySearch(term)");
    expect(workspace).toContain("clearSourceBodySearchHistory()");
    expect(workspace).not.toMatch(
      /setSourceBodySearch\(term\);[\s\S]{0,180}searchSourceText\(\)/,
    );
  });
});
