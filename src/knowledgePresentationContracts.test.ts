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
const aiClient = readFileSync(
  new URL("../src-tauri/src/ai/client.rs", import.meta.url),
  "utf8",
);
const aiRepository = readFileSync(
  new URL("./services/aiRepository.ts", import.meta.url),
  "utf8",
);
describe("全局反馈与知识阅读层级合同", () => {
  it("导出提示固定在画面中心并提供高对比原路径操作", () => {
    expect(app).toContain('className="prototype-notice"');
    expect(app).toContain('className="notice-action"');
    expect((app.match(/actionLabel: "定位导出文件"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(app).toContain("repository.revealExportedFile(result.filePath)");
    expect(styles).toMatch(
      /\.prototype-notice\s*\{[\s\S]*?z-index:\s*240;[\s\S]*?top:\s*50%;[\s\S]*?left:\s*50%;[\s\S]*?transform:\s*translate\(-50%,\s*-50%\);/,
    );
    expect(styles).toMatch(
      /\.prototype-notice \.notice-action\s*\{[\s\S]*?color:\s*#fff;[\s\S]*?background:\s*linear-gradient/,
    );
    expect(styles).toContain("border: 2px solid rgba(232, 101, 43, .76)");
  });

  it("已确认竞争假设只展示正式解释、证据和有效性条件", () => {
    expect(reader).toContain('className="knowledge-final-hypothesis-thesis"');
    expect(reader).toContain(">核心解释<");
    expect(reader).not.toContain('className="knowledge-final-auto-rationale"');
    expect(reader).not.toContain(">提取依据<");
    expect(reader).toContain('aria-label="假设有效性条件"');
    expect(styles).toContain(".knowledge-final-hypothesis-thesis");
    expect(styles).toContain(".knowledge-final-evidence-grid");
    expect(reader).not.toContain('className="knowledge-final-section-heading"');
    expect(reader).not.toContain("命题选择");
  });

  it("AI 完整洞察固定在上半区，三个条件成果仍分别进入对应知识窗口", () => {
    expect(reader).toContain('aria-label="AI 主题洞察"');
    expect(reader).toContain('aria-label="AI 生成的竞争假设"');
    expect(reader).toContain('aria-label="AI 生成的判断演变"');
    expect(reader).toContain('aria-label="AI 生成的决策版本"');
    expect(reader).toContain("AiInsightBundleContent");
    expect(reader).toContain('className="knowledge-ai-insight-pane"');
    expect(reader).toContain('aria-label="查看全部 AI 主题洞察"');
    expect(reader).toContain('className="knowledge-overview-dialog knowledge-ai-insight-dialog"');
    expect(reader.indexOf('aria-label="AI 主题洞察"'))
      .toBeLessThan(reader.indexOf('className="knowledge-final-tabs"'));
    expect(reader).not.toContain('aria-label="自动知识摘要"');
    expect(reader).not.toContain("本地分析");
  });

  it("弹窗头部加载环保持正圆且不继承左侧图标方盒几何", () => {
    expect(styles).toMatch(
      /\.save-spinner\s*\{[\s\S]*?width:\s*14px;[\s\S]*?height:\s*14px;[\s\S]*?border-radius:\s*50%;/,
    );
    expect(styles).toContain(".knowledge-overview-dialog > header > span:first-child");
    expect(styles).not.toContain(".knowledge-overview-dialog > header > span {");
    expect(reader).toContain('<span className="save-spinner" aria-hidden="true" />');
    expect(topicManager).toContain('<span className="save-spinner" aria-hidden="true" />');
  });

  it("AI洞察占上方三分之一、知识面板占下方三分之二，且只有下方内容纵向滚动", () => {
    const stage = reader.indexOf('className="knowledge-final-stage"');
    const aiInsightPane = reader.indexOf('className="knowledge-ai-insight-pane"');
    const tabs = reader.indexOf('className="knowledge-final-tabs"');
    const scrollStart = reader.indexOf('className="knowledge-final-scroll"');
    const modeContent = reader.indexOf('className="knowledge-final-mode-content"');

    expect(stage).toBeGreaterThan(-1);
    expect(aiInsightPane).toBeGreaterThan(stage);
    expect(tabs).toBeGreaterThan(aiInsightPane);
    expect(scrollStart).toBeGreaterThan(tabs);
    expect(modeContent).toBeGreaterThan(scrollStart);
    expect(reader).not.toContain('className="knowledge-local-overview"');
    expect(reader).toContain('aria-label="等待 AI 主题洞察"');
    expect(reader).not.toContain('<details className="knowledge-ai-insight-details"');
    expect(reader).toContain("splitAiSummaryMarkdown");
    expect(reader).toContain("summary.boundaryMarkdown");
    expect(styles).toMatch(
      /\.knowledge-final-stage\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\) auto minmax\(0, 2fr\);/,
    );
    expect(styles).toMatch(/\.knowledge-ai-insight-preview\s*\{[\s\S]*?overflow:\s*hidden;/);
    expect(styles).toMatch(
      /\.knowledge-final-scroll\s*\{[\s\S]*?overflow-y:\s*auto;/,
    );
    expect(styles).toMatch(
      /\.knowledge-final-tabs\s*\{[\s\S]*?position:\s*relative;/,
    );
    expect(reader).toContain("AI 补充未生成主题");
    expect(reader).toContain("AI 全量重新整理");
    expect(reader).toContain("全部整理中 ${aiBatchProgress.current}/${aiBatchProgress.total}");
    expect(workspace).toContain("runAiTopicBatch");
    expect(workspace).toContain("mergeAiTopicBatchResults(previousResult, result)");
    expect(reader).toContain('role="alertdialog"');
    expect(reader).toContain("部分主题整理失败");
    expect(reader).toContain("全部主题整理成功");
    expect(reader).toContain("topic.error");
    expect(reader).toContain("重试失败主题");
    expect(reader).toContain("onCloseAiBatchResult");
    expect(reader).toContain("AI 正在整理全部主题");
    expect(reader).toContain("aiBatchProgress.items.map");
    expect(reader).toContain("请求失败，正在重试");
    expect(reader).toContain("整理过程中请保持软件开启");
    expect(reader).toContain("暂停，稍后继续");
    expect(reader).toContain("继续剩余 {aiBatchResumeCount} 个主题");
    expect(workspace).toContain("shouldPause: () => aiBatchPauseRequestedRef.current");
    expect(workspace).toContain("saveAiTopicBatchResume");
    expect(styles).toMatch(/\.ai-batch-failure-list\s*\{[\s\S]*?padding-top:\s*6px;/);
    expect(styles).toMatch(/\.ai-batch-progress-dialog\s*\{[\s\S]*?width:\s*min\(760px/);
    expect(reader).toContain("AI 正在整理主题");
    expect(reader).toContain("AI 主题整理完成");
    expect(reader).toContain("AI 主题整理失败");
    expect(reader).toContain("我知道了");
    expect(reader).toContain("!aiSingleResult");
    expect(workspace).toContain("setAiSingleResult");
    expect(reader).toContain("aiInsight?.payload.openQuestions");
    expect(reader).toContain("invalidationCondition");
    expect(reader).toContain('className="is-ai-generated"');
    expect(reader).toContain('className="knowledge-ai-validity-item"');
    expect(reader).toContain('className="knowledge-ai-hypothesis-header"');
    expect(styles).toMatch(/\.knowledge-overview-dialog\.knowledge-ai-insight-dialog\s*\{[\s\S]*?width:\s*min\(80vw,[\s\S]*?height:\s*min\(80dvh,/);
    expect(styles).toMatch(/\.knowledge-overview-dialog\s*\{[\s\S]*?resize:\s*both;/);
    expect(styles).toMatch(/\.prototype-dialog\s*\{[\s\S]*?resize:\s*both;/);
    expect(app).toContain("resizable = true");
    expect(app).toContain("AiAutomationSettingsEntry");
    expect(app).toContain('className="ai-automation-dialog"');
    expect(styles).toMatch(/\.settings-action-section\.ai-automation-entry\s*\{[\s\S]*?background:\s*var\(--settings-item-surface\);/);
    expect(app.indexOf('<div className="settings-list">'))
      .toBeLessThan(app.indexOf('<section className="runtime-build-card elevated-card"'));
    expect(styles).toMatch(/\.runtime-build-card\s*\{[\s\S]*?margin:\s*16px auto 12px;/);
  });

  it("旧四摘要弹窗退出生产路径，AI 条件成果进入对应知识窗口", () => {
    expect(reader).not.toContain('type KnowledgeOverviewDialogState = {');
    expect(reader).not.toContain("overviewDialog.items.map");
    expect(reader).not.toContain("openOverviewDialog");
    expect(reader).toContain('aria-label="AI 生成的竞争假设"');
    expect(reader).toContain('aria-label="AI 生成的判断演变"');
    expect(reader).toContain('aria-label="AI 生成的决策版本"');
    expect(reader).toContain('aria-label="AI 结论来源"');
  });

  it("当前知识视图为两套场景皮肤提供单一苹果式材质配方与实体回退", () => {
    for (const role of ["navigation", "workspace", "content", "control", "popover", "modal"]) {
      expect(styles).toContain(`--knowledge-material-${role}-surface:`);
    }
    expect(styles).toContain(':root[data-knowledge-skin-material="scene"]');
    for (const skin of ["florist-studio", "golden-horses"]) {
      expect(styles).toContain(`:root[data-knowledge-skin="${skin}"]`);
    }
    expect(styles).toContain('.app-shell[data-skin-material="scene"] .knowledge-reading-page');
    expect(styles).toContain("backdrop-filter: none;");
    expect(styles).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(styles).toContain("@media (prefers-contrast: more)");
    expect(styles).toContain("@supports not ((backdrop-filter: blur(1px))");
    expect(reader).toContain('className="knowledge-final-stage"');
    expect(reader).toContain('className="knowledge-ai-insight-dialog-body"');
    expect(reader).not.toContain("readerHasScrolled");
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

  it("亮色与暗色实体入口的最前景卡保持不透明并保护主题整合主要来源卡", () => {
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
    expect(styles).toContain("最前景卡必须完全不透明");
    expect(styles).toContain("--knowledge-material-foreground-card-color: rgb(255, 255, 255)");
    expect(styles).toContain("--knowledge-material-browser-group-surface: rgb(255, 255, 255)");
    expect(styles).toContain("--knowledge-material-reading-card-surface: rgb(255, 255, 255)");
    expect(styles).toContain("--knowledge-material-ai-nested-surface: rgb(255, 255, 255)");
    const foregroundTokenBlock = styles.match(
      /--knowledge-material-foreground-card-color:[\s\S]*?--knowledge-material-state-surface:/,
    )?.[0] ?? "";
    expect(foregroundTokenBlock).not.toMatch(/rgba\(/);
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
      /卡片二、知识四状态与其他入口消费同一组纯白前景卡；外层底板不动。([\s\S]*?)\.app-shell\[data-skin-material="scene"\] \.knowledge-final-auto-rationale/,
    )?.[1] ?? "";
    expect(sharedExposureRule).toContain(".knowledge-final-reading-pane.is-support");
    expect(styles).toMatch(
      /\.knowledge-final-reading-pane\.is-content\s*\{[\s\S]*?background:\s*rgb\(255, 255, 255\);/,
    );
    expect(styles).toMatch(
      /\.record-card:not\(\.selected\),[\s\S]*?\.unified-note-card:not\(\.selected\),[\s\S]*?background:\s*var\(--knowledge-material-foreground-card-color\);/,
    );
    const opaqueForegroundRule = styles.match(
      /\.app-shell :is\(\s*\.record-card:not\(\.selected\),[\s\S]*?\.knowledge-source-list-item:not\(\.active\),[\s\S]*?\)\s*\{[^}]*background:\s*var\(--knowledge-material-foreground-card-color\);[^}]*\}/,
    )?.[0] ?? "";
    expect(opaqueForegroundRule).not.toBe("");
    expect(opaqueForegroundRule).not.toContain(".trash-card");
    expect(opaqueForegroundRule).not.toContain(".settings-row");
    expect(styles).toMatch(/\.settings-page > \.elevated-card,[\s\S]*?\.settings-page \.settings-row,[\s\S]*?\.trash-grid \.trash-card[\s\S]*?background:\s*var\(--glass-card\);[\s\S]*?backdrop-filter:\s*blur\(28px\)/);
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
      /旧 2px 双向 mask[\s\S]*?\.app-shell\[data-skin-material="scene"\] :is\(([\s\S]*?)\)\s*\{[\s\S]*?mask-image:\s*none;/,
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
      /将主题洞察已确认的材质层级同步到其余页面[\s\S]*?\.app-shell\[data-skin-material="scene"\] :is\(\s*\.record-pane,\s*\.knowledge-inbox-list,\s*\.knowledge-final-tree-card\s*\)\s*\{([\s\S]*?)\}/,
    )?.[1] ?? "";

    expect(navigationSurfaceRule).toContain("background: var(--knowledge-material-navigation-surface);");
    expect(navigationSurfaceRule).toContain("backdrop-filter: none;");
    expect(navigationSurfaceRule).toContain("-webkit-backdrop-filter: none;");
    expect(navigationSurfaceRule).not.toContain("var(--knowledge-material-navigation-filter)");
    const persistentControlRule = styles.match(
      /\.app-shell\[data-skin-material="scene"\] :is\(\s*\.search-field,\s*\.topic-final-search,\s*\.data-exchange-tabs\s*\)\s*\{([\s\S]*?)\}/,
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

  it("暗色五套皮肤由共同语义面派生，红棕皮肤不回退到蓝灰或统一纯黑", () => {
    expect(styles).toContain("实体皮肤的每一层都由当前皮肤的暗色令牌派生");
    expect(styles).toMatch(
      /data-knowledge-skin-material="entity"\]\s*\{[\s\S]*?--classic-content-surface:\s*var\(--dark-skin-panel\);[\s\S]*?--classic-nested-surface:\s*var\(--dark-skin-raised\);[\s\S]*?--classic-control-surface:\s*linear-gradient\(145deg, var\(--dark-skin-input-focus\), var\(--dark-skin-input\)\);/,
    );
    expect(styles).toContain('--dark-skin-panel: #352521;');
    expect(styles).not.toMatch(/data-knowledge-skin-material="entity"\]\s*\{[\s\S]*?--classic-nested-surface:\s*#20343a;/);
    expect(styles).toContain("搜索行只是布局容器");
    expect(styles).toMatch(
      /:is\(\.search-row, \.knowledge-source-search-row, \.unified-note-list-search-row\)\s*\{[\s\S]*?background:\s*transparent !important;/,
    );
    expect(styles).toContain("空状态是说明文字，不是禁用按钮");
    expect(styles).toContain("搜索历史与组合筛选是弹层");
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
    expect(app).toMatch(/className="detail-panel source-archive-detail elevated-card association-link-target core-workspace-card-three"[\s\S]*?data-hover-wheel-panel=""[\s\S]*?data-hover-wheel-scroll=""/);
    expect(workspace).toMatch(/className="knowledge-card knowledge-inbox-list core-workspace-card-two"[\s\S]*?data-hover-wheel-panel=""/);
    expect(workspace).toMatch(/className="knowledge-source-list-scroll"[\s\S]*?data-hover-wheel-scroll=""/);
    expect(workspace).toMatch(/className="knowledge-card knowledge-inbox-detail association-link-target core-workspace-card-three"[\s\S]*?data-hover-wheel-panel=""/);
    expect(workspace).toContain('className="knowledge-source-preview" ref={sourceBodyRef} data-hover-wheel-scroll=""');
    expect(topicHierarchy).toContain('className="knowledge-final-tree-card knowledge-card" data-hover-wheel-panel=""');
    expect(topicHierarchy).toContain('className="knowledge-final-tree" onScroll={onScroll} data-hover-wheel-scroll=""');
    expect(reader).toMatch(/className="knowledge-final-reader knowledge-card association-link-target core-workspace-card-three"[\s\S]*?data-hover-wheel-panel=""/);
    expect(reader).toMatch(/className="knowledge-final-scroll"[\s\S]*?data-hover-wheel-scroll=""/);
    expect(topicManager).toMatch(/className="topic-final-reader knowledge-card association-link-target core-workspace-card-three"[\s\S]*?data-hover-wheel-panel=""/);
    expect(topicManager).toContain('className="topic-final-scroll" data-hover-wheel-scroll=""');
    expect(styles).toMatch(/\.knowledge-inbox-list\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?overflow:\s*hidden;/);
    expect(styles).toMatch(/\.knowledge-source-list-scroll\s*\{[\s\S]*?overflow-y:\s*auto;/);
    expect(workspace).not.toContain('className="knowledge-source-filters"');
    expect(workspace).toContain("sourceVirtualList.onScroll()");
    expect(app).toContain("recordVirtualList.onScroll()");
    expect(hoverWheelRouting).toContain("findNativeScrollAncestor(origin, panel)");
    expect(hoverWheelRouting).toContain("documentRoot.elementFromPoint(event.clientX, event.clientY)");
    expect(hoverWheelRouting).toContain("cancelPendingExcept(target)");
    expect(hoverWheelRouting).toContain('documentRoot.addEventListener("pointerover", handlePointerOver');
    expect(hoverWheelRouting).toContain("window.requestAnimationFrame");
    expect(hoverWheelRouting).not.toContain("candidate.scrollTop");
  });

  it("暗色搜索历史与组合筛选使用实体弹层底并高于后续列表内容", () => {
    expect(styles).toMatch(
      /:root\[data-knowledge-color-mode="dark"\] :is\([\s\S]*?\.source-search-history,[\s\S]*?\.filter-popover,[\s\S]*?\.app-context-menu[\s\S]*?\)\s*\{[\s\S]*?background-color:\s*var\(--dark-skin-panel\) !important;[\s\S]*?background-image:\s*linear-gradient/,
    );
    expect(styles).toMatch(
      /\.source-search-field:has\(\.source-search-history\),[\s\S]*?\.unified-note-list-filter-wrap:has\(\.filter-popover\)[\s\S]*?\)\s*\{[\s\S]*?z-index:\s*40;/,
    );
  });

  it("只有暗色场景玻璃把共享最前景卡总线改为 50% 且弹层不跟随透明", () => {
    expect(styles).toMatch(
      /默认（实体皮肤）前景卡完全不透明；只有下方暗色场景玻璃合同可以改写。[\s\S]*?--dark-frontmost-card-surface:\s*var\(--dark-skin-panel\);[\s\S]*?--dark-frontmost-raised-surface:\s*var\(--dark-skin-raised\);/,
    );
    const sceneContract = styles.match(
      /:root\[data-knowledge-color-mode="dark"\]\[data-knowledge-skin-material="scene"\]\s*\{[\s\S]*?--dark-frontmost-card-surface:[\s\S]*?\}/g,
    )?.at(-1) ?? "";
    expect(sceneContract).toContain("--dark-frontmost-card-surface: color-mix(in srgb, var(--dark-skin-panel) 50%, transparent);");
    expect(sceneContract).toContain("--dark-frontmost-raised-surface: color-mix(in srgb, var(--dark-skin-raised) 50%, transparent);");
    expect(sceneContract).toContain("--dark-frontmost-selected-surface:");
    expect(styles).toContain("--knowledge-material-browser-group-surface: var(--dark-frontmost-card-surface);");
    expect(styles).toContain("--knowledge-material-browser-active-surface: var(--dark-frontmost-selected-surface);");
    expect(styles).toContain("--knowledge-material-reading-surface: var(--dark-frontmost-card-surface);");
    expect(styles).toMatch(
      /\.unified-note-list-panel\s*\{[\s\S]*?background:\s*var\(--dark-frontmost-card-surface\) !important;/,
    );
    expect(styles).toMatch(
      /:root\[data-knowledge-color-mode="dark"\] :is\([\s\S]*?\.record-card,[\s\S]*?\.unified-note-card,[\s\S]*?\.attachment-text-state[\s\S]*?\)\s*\{[\s\S]*?background:\s*var\(--dark-frontmost-raised-surface\) !important;/,
    );
    const popoverContract = styles.match(
      /搜索历史与组合筛选是弹层；[\s\S]*?:root\[data-knowledge-color-mode="dark"\] :is\([\s\S]*?\.app-context-menu[\s\S]*?\)\s*\{[\s\S]*?\}/,
    )?.[0] ?? "";
    expect(popoverContract).toContain("background-color: var(--dark-skin-panel) !important;");
    expect(popoverContract).not.toContain("--dark-frontmost");
    expect(styles).toContain("--knowledge-material-popover-surface: var(--dark-skin-raised);");
    expect(styles).toContain("--knowledge-material-modal-surface: var(--dark-skin-panel);");
    expect(sceneContract).toContain("--dark-surface-panel: var(--dark-skin-panel);");
    expect(sceneContract).toContain("--dark-surface-raised: var(--dark-skin-raised);");
  });

  it("卡二条件挂载后重新测量真实视口，不停留在零高度的七行保底窗口", () => {
    expect(workspace).toMatch(/useFixedVirtualList\(\{[\s\S]*?enabled:\s*mode === "sources"/);
    expect(fixedVirtualList).toContain("enabled = true");
    expect(fixedVirtualList).toMatch(/useLayoutEffect\(\(\) => \{[\s\S]*?if \(!enabled\) return undefined;[\s\S]*?updateMetrics\(\);/);
    expect(fixedVirtualList).toContain("[0, 80, 240, 500, 900]");
    expect(fixedVirtualList).toContain("settleTimers");
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

  it("主题成果由 AI 生成，卡三的原始笔记只承担阅读与回溯", () => {
    expect(reader).toContain('data-reading-section="notes-and-sources"');
    expect(reader).not.toContain("buildKnowledgeTopicIntegration(detail)");
    expect(reader).not.toContain("buildKnowledgeSynthesis(");
    expect(reader).not.toContain("knowledge-final-reading-pane is-index");
    expect(reader).toContain("knowledge-final-reading-pane is-content");
    expect(reader).toContain("knowledge-final-reading-pane is-support");
    expect(reader).toContain('data-assets-layout={integrationSources.length ? "topic-integration" : "integration-only"}');
    expect(reader).toContain("AI 自动关联笔记来源");
    expect(reader).toContain("integrationSourceItemIds={appliedRevisionTopic?.sourceItemIds ?? []}");
    expect(reader).toContain('className="knowledge-final-source-switch"');
    expect(reader).toContain('aria-label={`在当前主题内阅读 ${source.title}`}');
    expect(reader).toContain('onClick={() => setLocalSourceSelection({');
    expect(reader).toContain('className="knowledge-final-source-open"');
    expect(reader).toContain('aria-label={`在全部笔记中打开 ${source.title}`}');
    expect(reader).toMatch(/className="knowledge-final-source-open"[\s\S]*?onClick=\{\(\) => onOpenSource\(/);
    expect(reader).not.toMatch(/className=\{`knowledge-final-source-item[\s\S]{0,180}?onClick=/);
    expect(reader).toContain("selectedSource?.contentText?.trim()");
    expect(reader).toContain('integrationMarkdown || "待主题管理 AI 生成全库分类并应用后显示主题整合。"');
    expect(reader).toContain("findAppliedAiTaxonomyTopic");
    expect(reader).toContain("返回材料列表");
    expect(topicManager).toContain("自动关联笔记来源 {integrationSources.length} 条");
    expect(topicManager).toContain("appliedRevisionTopic?.sourceItemIds");
    expect(reader).not.toContain("上方 AI 主题洞察负责跨笔记归纳");
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

  it("已确认决策账本只展示正式决策链，不生成本地草案", () => {
    expect(reader).toContain("判断、决策、行动与复盘");
    expect(reader).toContain('data-reading-section="decision-chain"');
    expect(reader).not.toContain('data-reading-section="decision-overview"');
    expect(reader).not.toContain("决策版本概览");
    expect(reader).not.toContain("完整链路");
    expect(reader).not.toContain('decision.automatic');
    expect(reader).not.toContain("自动决策草案");
    expect(reader).toContain('label: "判断"');
    expect(reader).toContain('label: "决策"');
    expect(reader).toContain('label: "结果 / 复盘"');
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
    expect(workspace).not.toContain('className="source-auto-organize-action"');
    expect(workspace).not.toContain('aria-label="自动整理待归类来源"');
    expect(workspace).toContain("等待 AI 全库分类");
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

  it("主题洞察与主题管理共用同一已应用 AI 分类树、列表和折叠状态", () => {
    expect(reader).toContain("<KnowledgeTopicHierarchy");
    expect(topicManager).toContain("<KnowledgeTopicHierarchy");
    expect(reader).toContain("taxonomyHierarchy: AppliedAiTaxonomyHierarchy");
    expect(topicManager).toContain("taxonomyHierarchy: AppliedAiTaxonomyHierarchy");
    expect(reader).toContain("hasAppliedRevision");
    expect(workspace).toContain("getAppliedAiTaxonomyHierarchy(appliedAiTaxonomyRevision, domains, topics)");
    expect(workspace).toContain("taxonomyHierarchy={appliedAiTaxonomyHierarchy}");
    expect(workspace).toContain("!appliedAiTaxonomyHierarchy.topicIds.has(browserTopicId)");
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

  it("主题管理不再暴露本地关键词排除和评分规则", () => {
    expect(topicManager).not.toContain("negativeRules");
    expect(topicManager).not.toContain("<strong>自动排除</strong>");
    expect(topicManager).not.toContain("本地规则");
    expect(topicManager).toContain("领域、主题和归属由 AI 生成");
    expect(topicManager).toContain("低置信度项目标为待核对");
    expect(topicManager).toContain("AI 主题边界");
    expect(topicManager).toContain("AI 主题整合");
    expect(topicManager).toContain("归纳笔记");
    expect(topicManager).not.toContain("当前正式归属；等待下一次 AI 修订补充解释。");
    expect(topicManager).not.toContain("已归入当前主题");
    expect(topicManager).toContain("待 AI 生成全库分类");
    expect(topicManager).toContain("hasAppliedAiClassification");
    expect(topicManager).toContain("integrationSources.map");
    expect(topicManager).toContain("AI 正在生成全库分类");
    expect(topicManager).toContain("AI 全库分类已生成");
    expect(topicManager).toContain("主题整合 ${aiIntegrationCoverage.completeTopicCount}/${aiIntegrationCoverage.assignedTopicCount}");
    expect(topicManager).toContain("主题整合或自动关联来源不完整，不能应用");
    expect(topicManager).toContain("AI 全库分类生成失败");
    expect(topicManager).toContain("发现未完成的 AI 全库分类");
    expect(topicManager).toContain("继续上次生成");
    expect(topicManager).toContain("正在从已保存断点继续");
    expect(topicManager).toContain("正在生成并保存当前进度");
    expect(topicManager).toContain("正在保存当前批次并暂停");
    expect(topicManager).toContain("暂停，稍后继续");
    expect(workspace).toContain("window.setInterval(refreshCheckpoint, 1_200)");
    expect(workspace).toContain("已完成批次已保存，下次可从断点继续");
    expect(aiRepository).toContain('invokeAi("get_resumable_ai_taxonomy_run")');
    expect(aiRepository).toContain('invokeAi("discard_ai_taxonomy_run"');
    expect(aiRepository).toContain('invokeAi("pause_ai_taxonomy_revision")');
    expect(aiClient).toContain("canonical_taxonomy_topic_source_ids");
    expect(aiClient).toContain("来源清单由已经确认的主题归属唯一决定");
    expect(topicManager).toContain("查看分类草稿");
    expect(workspace).toContain("setAiTaxonomyResult");
    expect(styles).toMatch(/\.topic-final-basis > article p\s*\{[\s\S]*?display:\s*block;[\s\S]*?writing-mode:\s*horizontal-tb;/);
    expect(styles).toMatch(/\.topic-final-basis > article strong\s*\{[\s\S]*?font-size:\s*12px;/);
    expect(topicManager).not.toContain("尚未记录明确排除条件");
    expect(topicManager).not.toContain("补充排除规则");
    expect(topicManager).not.toContain("调整排除规则");
    expect(topicManager).not.toContain("补充分类依据");
    expect(topicManager).not.toContain('onOpenMaintenance("rules", topic.id)');
  });

  it("AI 分类草稿在应用前展示完整领域主题列表和每主题笔记数", () => {
    expect(topicManager).toContain('aiRevision?.status === "draft"');
    expect(topicManager).toContain("aiRevision.domains.map");
    expect(topicManager).toContain("aiRevision.topics.filter");
    expect(topicManager).toContain("aiRevision.assignments.filter");
    expect(topicManager).toContain("AI 分类草稿");
    expect(topicManager).toContain("应用修订");
  });

  it("五个主要入口复用全部笔记的卡二卡三几何", () => {
    expect(app).toContain('className={`records-workspace core-workspace-grid ${scope === "records" ? "" : "record-subview-workspace"}`}');
    expect(app).toContain('data-record-scope={scope}');
    expect(app).toContain("record-subview-list-card");
    expect(workspace).toContain('className="knowledge-inbox-layout core-workspace-grid"');
    expect(reader).toContain('className="knowledge-final-shell core-workspace-grid"');
    expect(topicManager).toContain('className="topic-final-shell core-workspace-grid"');
    expect(styles).toContain("NF-CORE-WORKSPACE-GEOMETRY-01");
    expect(styles).toMatch(
      /\.knowledge-inbox-layout\.core-workspace-grid,[\s\S]*?\.records-workspace\.core-workspace-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(300px,\s*24%\)\s*minmax\(0,\s*1fr\);[\s\S]*?gap:\s*14px;/,
    );
    expect(styles).toMatch(
      /\.knowledge-final-shell,\s*\.topic-final-shell\)\.core-workspace-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(300px,\s*24%\)\s*14px\s*minmax\(0,\s*1fr\);/,
    );
    expect(styles).toMatch(/\.core-workspace-card-two,[\s\S]*?\.core-workspace-card-three\s*\{[\s\S]*?height:\s*100%;[\s\S]*?border-radius:\s*14px;/);
    expect(styles).toMatch(/\.knowledge-final-search,[\s\S]*?\.topic-final-search[\s\S]*?height:\s*45px;[\s\S]*?min-height:\s*45px;/);
  });

  it("暗色模式使用唯一语义材质总线，输入与内容不再继承浅底、白边或跨皮肤色相", () => {
    expect(styles).toContain("暗色黑色材质总线");
    expect(styles).toContain(':root[data-knowledge-color-mode="dark"][data-knowledge-skin]');
    for (const token of [
      "--dark-surface-panel: var(--dark-skin-panel)",
      "--dark-surface-raised: var(--dark-skin-raised)",
      "--dark-surface-input: var(--dark-skin-input)",
      "--dark-border: var(--dark-skin-border)",
      "--dark-text-primary: #f5fbf8",
      "--dark-text-secondary: #c2d0ca",
    ]) {
      expect(styles).toContain(token);
    }
    for (const selector of [
      ".search-field input",
      ".knowledge-final-search input",
      ".topic-final-search input",
      ".source-body-search-wrap input",
      ".trash-card",
      ".attachment-row",
      ".source-message.assistant",
      ".markdown-content :is(table, thead, tbody, tr, th, td",
      ".sidebar :is(.nav-item, .support-nav-item) svg",
    ]) {
      expect(styles).toContain(selector);
    }
    expect(styles).toContain("background: transparent !important;");
    expect(styles).toContain("border-color: var(--dark-border) !important;");
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
