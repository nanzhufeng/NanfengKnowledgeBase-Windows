/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const workspace = readFileSync(
  new URL("./components/KnowledgeWorkspace.tsx", import.meta.url),
  "utf8",
);
const readingWorkspace = readFileSync(
  new URL("./components/KnowledgeReadingWorkspace.tsx", import.meta.url),
  "utf8",
);
const unifiedNoteListCard = readFileSync(
  new URL("./components/UnifiedNoteListCard.tsx", import.meta.url),
  "utf8",
);
const topicHierarchy = readFileSync(
  new URL("./components/KnowledgeTopicHierarchy.tsx", import.meta.url),
  "utf8",
);
const topicWorkspace = readFileSync(
  new URL("./components/TopicStructureReadingWorkspace.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const attachmentPreview = readFileSync(
  new URL("./components/AttachmentPreview.tsx", import.meta.url),
  "utf8",
);
const traceability = readFileSync(
  new URL("../docs/core-workspace-requirements-traceability.md", import.meta.url),
  "utf8",
);
const completionPlan = readFileSync(
  new URL("../docs/knowledge-product-completion-plan.md", import.meta.url),
  "utf8",
);
const exportCenterSource = app.slice(
  app.indexOf("function ExportCenter"),
  app.indexOf("function ImportCenter"),
);
const settingsPageSource = app.slice(
  app.indexOf("function SettingsPage"),
  app.indexOf("export function App()"),
);

describe("最终产品方向收敛合同", () => {
  it("生产入口和用户反馈统一使用主题洞察、全部笔记、主题管理", () => {
    expect(app).toContain('label: "主题洞察"');
    expect(app).toContain('label: "全部笔记"');
    expect(app).toContain('label: "主题管理"');
    expect(app).not.toContain('label: "收录箱"');
    expect(app).not.toContain('label: "主题浏览器"');
    expect(app).not.toContain('label: "整理工作台"');
    expect(app).not.toContain('{ id: "updates", label: "判断更新"');
    expect(workspace).not.toContain("请先在“主题浏览器”");
    expect(workspace).not.toContain("来源已返回收录箱");
  });

  it("新导入笔记由App唯一编排自动整理并在中断后续接主题洞察", () => {
    expect(app).toContain("const organizeImportedKnowledge = useCallback");
    expect(app.match(/autoOrganizeImportedSources\(/g)).toHaveLength(1);
    expect(app).toContain("onOrganizeImportedSources={organizeImportedKnowledge}");
    expect(app).toContain("upgradeOutdatedInboxSuggestions(");
    expect(app).toContain("knowledgeOrganizationQueue");
    expect(app).toContain("knowledgeOrganizationRevision={knowledgeOrganizationRevision}");
    expect(workspace).toContain("knowledgeOrganizationRevision: number");
    expect(workspace).toContain("observedKnowledgeOrganizationRevision");
    expect(workspace).not.toContain("upgradeOutdatedInboxSuggestions");
  });

  it("需求追踪把主题管理作为入口，主题结构只保留为领域概念", () => {
    expect(traceability).toContain(
      "`主题洞察 / 全部笔记 / 主题管理`核心分组",
    );
    expect(traceability).toContain("| 主题管理 | 主题边界");
    expect(traceability).not.toContain(
      "`知识视图 / 来源档案 / 主题结构`核心分组",
    );
  });

  it("全部笔记返回由 App 保存真实来源面板，直接进入时回到竞争假设", () => {
    expect(app).toContain("knowledgeSourceReturnTarget");
    expect(app).toContain("setKnowledgeSourceReturnTarget(target.returnTarget ?? null)");
    expect(app).toContain('viewMode: "hypotheses"');
    expect(readingWorkspace).toContain("returnTarget:");
    expect(readingWorkspace).toContain("viewMode: mode");
    expect(readingWorkspace).toContain('data-knowledge-source-id={item.sourceItemId}');
    expect(workspace).toContain("返回上一级");
    expect(workspace).not.toContain("返回主题来源");
  });

  it("时间切片不再是主题洞察首屏控件，跨时期事件只归判断演变", () => {
    expect(readingWorkspace).not.toContain("时间切片");
    expect(traceability).toContain("跨时期事件只在判断演变中保留");
    expect(completionPlan).toContain("日期切片仅保留为底层读取能力");
    expect(completionPlan).toContain("不恢复独立“时间切片”控件");
  });

  it("旧收录箱和旧知识演化 E2E 不再参与当前验收", () => {
    expect(
      existsSync(new URL("../tests/e2e/knowledge-evolution-prototype.spec.ts", import.meta.url)),
    ).toBe(false);
    expect(
      existsSync(new URL("../tests/e2e/knowledge-inbox-layout.spec.ts", import.meta.url)),
    ).toBe(false);
  });

  it("来源正文不重复显示无状态价值的正文预览标签", () => {
    expect(workspace).not.toContain("正文预览");
    expect(workspace).toContain('<h3>来源正文</h3>');
    expect(workspace).toContain('aria-label="搜索来源正文"');
  });

  it("完整笔记导出弹窗使用大尺寸并固定展示底部说明", () => {
    expect(app).toContain('"share-record-dialog-v3"');
    expect(styles).toContain("grid-template-rows: auto minmax(0, 1fr) auto auto;");
    expect(styles).toContain("width: min(90vw, 1460px);");
    expect(styles).toContain("height: min(90vh, 980px);");
    expect(styles).toContain(".share-record-dialog > .dialog-footnote");
  });

  it("图片与视频共用暗色视觉媒体视口，并支持全屏适配、缩放、拖动、中键复位和人工调节窗口", () => {
    expect(styles).toContain("width: calc(100vw - 16px);");
    expect(styles).toContain("height: calc(100vh - 16px);");
    expect(styles).toContain(".attachment-preview-resize-handle");
    expect(styles).toContain("cursor: nwse-resize;");
    expect(styles).toContain(".attachment-media-viewport > img");
    expect(styles).toContain(".attachment-media-viewport > video");
    expect(styles).toContain("max-width: none;");
    expect(styles).toContain("image-rendering: auto;");
    expect(styles).toContain(".attachment-preview-visual-media");
    expect(styles).toContain("background: #080c12;");
    expect(styles).toContain("color: #eef4fb;");
    expect(attachmentPreview).toContain("event.ctrlKey");
    expect(attachmentPreview).toContain('addEventListener("wheel", zoomMedia, { passive: false, capture: true })');
    expect(attachmentPreview).toContain("setPointerCapture");
    expect(attachmentPreview).toContain("event.button !== 1");
    expect(attachmentPreview).toContain("mediaElement.naturalWidth");
    expect(attachmentPreview).toContain('mediaViewportMode.current = "fit"');
    expect(attachmentPreview).toContain("useLayoutEffect(() =>");
    expect(attachmentPreview).toContain("DEFAULT_MEDIA_FIT_PADDING");
    expect(attachmentPreview).toContain('window.visualViewport?.addEventListener("resize", scheduleFit)');
    expect(attachmentPreview).toContain("translate(-50%, -50%) scale(${mediaViewport.scale})");
    expect(attachmentPreview).toContain("mediaIntrinsicSize.width");
    expect(attachmentPreview).toContain('allowUpscale: kind === "video"');
    expect(attachmentPreview).toContain('onLoadedMetadata={captureMediaIntrinsicSize}');
    expect(styles).toContain("top: 50%;");
    expect(styles).toContain("left: 50%;");
    expect(attachmentPreview).not.toContain("dialogResize");
    expect(attachmentPreview).not.toContain("setDialogSize");
    expect(attachmentPreview).toContain("requestAnimationFrame(() => syncMediaFit(true))");
    expect(attachmentPreview).toContain("适合屏幕");
    expect(attachmentPreview).toContain("缩放后拖动手柄");
    expect(attachmentPreview).toContain("attachment-media-pan-handle");
    expect(attachmentPreview).not.toContain("bounds.bottom - 64");
  });

  it("全部笔记删除重复页面标题与独立动作栏，把唯一整理动作收进详情标题组", () => {
    expect(workspace).not.toContain("source-page-actions-only");
    expect(workspace).not.toContain("<h1>全部笔记</h1>");
    expect(workspace).toContain("自动整理待归类来源");
    expect(workspace).toContain('className="source-auto-organize-action"');
    expect(workspace.indexOf('className="source-auto-organize-action"'))
      .toBeGreaterThan(workspace.indexOf('className="knowledge-detail-actions"'));
    expect(styles).not.toContain(".knowledge-page-header.source-page-actions-only");
  });

  it("场景皮肤的卡片一全部入口共用明确点亮态，空状态卡保留场景渐变层次", () => {
    expect(styles).toContain('.app-shell:not([data-skin="classic"]) .sidebar .nav-item.active {');
    expect(styles).toContain("inset 0 0 0 1px rgba(241, 104, 59, .32)");
    expect(styles).toContain("linear-gradient(105deg, rgba(255, 249, 245, .95), rgba(255, 248, 244, .945) 52%, rgba(255, 247, 243, .94))");
    expect(styles).not.toContain(".nav-group-supporting .nav-item.active");
    expect(styles).not.toContain(".sidebar-bottom .nav-item.active");
    expect(styles).toContain("--knowledge-material-state-surface:");
    expect(styles).toContain("radial-gradient(ellipse at 18% 0%");
    expect(styles).toContain("background: var(--knowledge-material-state-surface");
  });

  it("主题结构编辑采用行内入口和唯一弹窗，不在顶部堆叠新增按钮", () => {
    expect(workspace).toContain('{topicStructureEditorOpen ? "完成编辑" : "编辑"}');
    expect(workspace).toContain("knowledge-domain-actions");
    expect(workspace).toContain("knowledge-topic-row-actions");
    expect(workspace).toContain("openCreateTopicDialog(domain.id, topic.id)");
    expect(workspace).toContain('data-topic-structure-dialog={topicStructureDialog.kind}');
    expect(workspace).not.toContain("topicCreateMode");
    expect(workspace).not.toContain("knowledge-inline-create-form");
    expect(workspace).not.toContain("knowledge-inline-structure-editor");
    expect(styles).toContain(".topic-structure-dialog-form");
    expect(styles).toContain(".knowledge-add-domain-row");
  });

  it("设置将数据交换、完整备份与高级维护分成唯一入口", () => {
    expect(exportCenterSource).not.toContain("createPortableBackup");
    expect(exportCenterSource).not.toContain("创建完整备份");
    expect(settingsPageSource).toContain("打开批量导入与导出");
    expect(settingsPageSource).toContain("备份与恢复");
    expect(settingsPageSource).toContain("创建完整备份");
    expect(settingsPageSource).toContain("恢复完整备份");
    expect(settingsPageSource).toContain('className="settings-advanced-maintenance"');
    expect(settingsPageSource).toContain("创建数据库快照");
    expect(settingsPageSource).toContain("从数据库快照恢复");
    expect(settingsPageSource).not.toContain("创建数据库备份");
    expect(settingsPageSource).not.toContain("从备份恢复");
    expect(settingsPageSource).toContain("当前程序");
    expect(settingsPageSource).toContain("EXE SHA-256");
    expect(settingsPageSource).toContain("repository.getRuntimeBuildInfo()");
    expect(styles).toContain(".settings-advanced-maintenance[open]");
  });

  it("数据交换返回上一级并重新打开可调节的大尺寸存储窗口", () => {
    expect(app).toContain('<ArrowLeft size={17} />返回上一级');
    expect(app).not.toContain('<ArrowLeft size={17} />返回设置');
    expect(app).toContain('setSettingsReturnTarget("data-storage")');
    expect(settingsPageSource).toContain('sizePreferenceKey={activeSetting.title === "数据与存储"');
    expect(settingsPageSource).toContain('resizable={activeSetting.title === "数据与存储"}');
    expect(settingsPageSource).toContain('className="settings-storage-primary-actions"');
    expect(settingsPageSource).toContain('className="primary-button settings-transfer-button"');
    expect(styles).toContain(".prototype-dialog.storage-settings-dialog");
    expect(styles).toContain("width: min(1040px, calc(100vw - 64px));");
    expect(styles).toContain("height: min(760px, calc(100vh - 64px));");
    expect(styles).toContain(".prototype-dialog-resize-handle");
  });

  it("数据交换与备份恢复卡片使用统一信息层级和等分布局", () => {
    expect(settingsPageSource).toContain("<strong>数据交换</strong>");
    expect(settingsPageSource).toContain("<strong>备份与恢复</strong>");
    expect(settingsPageSource).not.toContain("<strong>批量导入与导出</strong>");
    expect(settingsPageSource).not.toContain("完整备份适合换机与灾难恢复");
    expect(settingsPageSource).not.toContain('className="settings-section-kicker"');
    expect(settingsPageSource).not.toContain('className="settings-backup-scope"');
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(styles).toContain(".settings-action-section.primary,\n.settings-action-section.backup");
  });

  it("存储统计支持前台自动同步并由主界面和设置共用刷新入口", () => {
    expect(app).toContain("const storageRefreshPromise = useRef<Promise<StorageStats> | null>(null)");
    expect(app).toContain('window.addEventListener("focus", refreshWhenActive)');
    expect(app).toContain('document.addEventListener("visibilitychange", refreshWhenActive)');
    expect(app).toContain('aria-label="刷新存储统计"');
    expect(app).toContain("onRefreshStorage={refreshStorageStats}");
    expect(settingsPageSource).toContain("<strong>存储概览</strong>");
    expect(settingsPageSource).toContain("setStorageInfo(storageStats)");
    expect(styles).toContain(".storage-refresh-button");
    expect(styles).toContain(".settings-storage-overview-heading");
  });

  it("全软件小卡片逐卡消费轻抬升角色，纯阅读卡不伪装按压，大面板不移动", () => {
    expect(styles).toContain("--micro-card-lift: -2px;");
    expect(styles).toContain('[data-card-interaction="lift"]');
    expect(styles).toContain('[data-card-interaction="surface-lift"]');
    expect(styles).toContain("translate var(--micro-card-motion-duration) var(--ease-out)");
    expect(styles).toContain("@media (hover: hover) and (pointer: fine)");
    expect(styles).toMatch(/\[data-card-interaction="surface-lift"\][\s\S]{0,80}\):hover/);
    expect(styles).toContain("box-shadow: var(--micro-card-hover-shadow-local);");
    expect(styles).toContain('.app-shell:not([data-skin="classic"]) :is(');
    expect(styles).toContain("padding: 10px 2px 28px;");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain('[data-card-interaction="lift"] [data-card-cue="forward"]');
    expect(styles).not.toMatch(/\[data-card-interaction="surface-lift"\]:active/);
    expect(styles).not.toContain("transition: all");
    expect(styles).not.toMatch(/\.unified-note-card:hover\s*\{[^}]*transform:/s);
    expect(styles).not.toMatch(/\.unified-note-card:hover\s*\{[^}]*box-shadow:/s);
    expect(styles).not.toMatch(/\.knowledge-source-list-item:hover\s*\{[^}]*transform:/s);
    expect(styles).not.toMatch(/\.record-card:hover\s*\{[^}]*box-shadow:/s);
    expect(styles).not.toContain("will-change: transform, box-shadow, border-color, background-color");
    expect(readingWorkspace).toContain('className="knowledge-overview-judgment" data-card-interaction="surface-lift"');
    expect(readingWorkspace).toMatch(/className="knowledge-final-hypothesis-thesis"\s+data-card-interaction="surface-lift"/);
    expect(readingWorkspace).toMatch(/className="knowledge-final-auto-rationale"\s+data-card-interaction="surface-lift"/);
    expect(readingWorkspace).toMatch(/className="knowledge-final-evidence-column"\s+data-card-interaction="surface-lift"/);
    expect(readingWorkspace).toMatch(/<article\s+className=\{event\.topicId === topicId \? "current" : "related"\}\s+data-card-interaction="surface-lift"/);
    expect(readingWorkspace).toMatch(/className={`knowledge-final-decision-card \$\{stage\.tone\}`}\s+data-card-interaction="surface-lift"/);
    expect(readingWorkspace.match(/className="knowledge-final-insight-card[^"]*"\s+data-card-interaction="surface-lift"/g)).toHaveLength(2);
    expect(readingWorkspace).not.toMatch(/className={`knowledge-final-hypothesis[^`]*`}\s+data-card-interaction/);
    expect(readingWorkspace).not.toMatch(/className="knowledge-final-decision-version"\s+data-card-interaction/);
    expect(readingWorkspace).not.toMatch(/className="knowledge-final-reader[^\"]*"[^>]*data-card-interaction/);
    expect(readingWorkspace.match(/data-card-cue="forward"/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(topicWorkspace.match(/className="topic-final-section[^\"]*"\s+data-card-interaction="surface-lift"/g)).toHaveLength(4);
    expect(topicWorkspace).toContain('data-card-interaction={maintenanceTasks.length + topicSuggestions.length ? undefined : "surface-lift"}');
    expect(topicWorkspace.match(/<article[^>]*data-card-interaction="surface-lift"/g)).toHaveLength(2);
    expect(topicWorkspace).not.toMatch(/className="topic-final-reader[^\"]*"[^>]*data-card-interaction/);
    expect(topicWorkspace).not.toMatch(/className="topic-final-content"[^>]*data-card-interaction/);
    expect(unifiedNoteListCard).toContain('data-card-interaction="lift"');
    expect(unifiedNoteListCard).toContain('data-card-rendering="repeated-list"');
    expect(styles).toContain('[data-card-rendering="repeated-list"]');
    expect(styles).toMatch(/\[data-card-rendering="repeated-list"\][\s\S]{0,240}transition:[\s\S]{0,100}top/);
    expect(styles).not.toMatch(/\[data-card-rendering="repeated-list"\][^{]*\{[^}]*(?:translate|scale|box-shadow)\s+\d+ms/);
    expect(topicHierarchy).toContain('data-card-interaction="lift"');
    expect(app).toContain('data-card-interaction={interactive ? "lift" : undefined}');
    expect(app).toContain('<AppCard className="trash-card" key={record.id} interactive>');
    expect(app).toContain('className="settings-row settings-row-clickable"');
    expect(app).toContain("interactive\n              onClick");
    expect(app).toContain('className="setting-preview" data-card-interaction="surface-lift"');
    expect(app.match(/<div data-card-interaction="surface-lift"><span>(?:数据库|导入归档|附件|备份|受控数据合计|磁盘可用|最近备份)<\/span>/g)).toHaveLength(7);
    expect(app.match(/className="settings-action-section (?:primary|backup|optimization)" data-card-interaction="surface-lift"/g)).toHaveLength(3);
    expect(app.match(/className="secondary-button" data-card-interaction="lift" onClick=\{async \(\) =>/g)).toHaveLength(5);
    expect(styles).not.toContain(".app-shell:not([data-skin=\"classic\"]) .knowledge-overview-card:hover");
  });

  it("搜索、定位与知识状态标签共用橙色悬浮反馈，历史项保持小圆角矩形", () => {
    expect(styles).toContain(".source-body-search-wrap");
    expect(styles).toContain(".unified-note-list-locator > button");
    expect(styles).toContain(".knowledge-final-tabs button:not(.deferred):hover");
    expect(styles).toMatch(/\.source-search-history > button\s*\{[^}]*border-radius:\s*8px/s);
    expect(styles).not.toMatch(/\.source-search-history > button\s*\{[^}]*border-radius:\s*999px/s);
  });

  it("数据优化必须先扫描、创建安全快照并保护业务记录", () => {
    expect(app).toContain("扫描可优化项");
    expect(app).toContain("创建安全快照并优化");
    expect(app).toContain("不会删除笔记、知识对象、历史版本、附件或导入原件");
    expect(app).toContain("完全重复备份");
    expect(app).toContain("超过 24 小时");
    expect(app).toContain("repository.inspectDataOptimization()");
    expect(app).toContain("repository.optimizeData()");
  });
});
