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
  it("生产入口和用户反馈统一使用知识视图、来源档案、主题管理", () => {
    expect(app).toContain('label: "知识视图"');
    expect(app).toContain('label: "来源档案"');
    expect(app).toContain('label: "主题管理"');
    expect(app).not.toContain('label: "收录箱"');
    expect(app).not.toContain('label: "主题浏览器"');
    expect(app).not.toContain('label: "整理工作台"');
    expect(workspace).not.toContain("请先在“主题浏览器”");
    expect(workspace).not.toContain("来源已返回收录箱");
  });

  it("需求追踪把主题管理作为入口，主题结构只保留为领域概念", () => {
    expect(traceability).toContain(
      "`知识视图 / 来源档案 / 主题管理`核心分组",
    );
    expect(traceability).toContain("| 主题管理 | 主题边界");
    expect(traceability).not.toContain(
      "`知识视图 / 来源档案 / 主题结构`核心分组",
    );
  });

  it("时间切片不再是知识视图首屏控件，跨时期事件只归判断演变", () => {
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

  it("图片附件使用原始像素渲染和暗色画布，并支持全屏适配、缩放、拖动、中键复位和人工调节窗口", () => {
    expect(styles).toContain("width: calc(100vw - 16px);");
    expect(styles).toContain("height: calc(100vh - 16px);");
    expect(styles).toContain(".attachment-preview-resize-handle");
    expect(styles).toContain("cursor: nwse-resize;");
    expect(styles).toContain(".attachment-image-viewport > img");
    expect(styles).toContain("max-width: none;");
    expect(styles).toContain("image-rendering: auto;");
    expect(styles).toContain(".attachment-preview-image");
    expect(styles).toContain("background: #080c12;");
    expect(styles).toContain("color: #eef4fb;");
    expect(attachmentPreview).toContain("event.ctrlKey");
    expect(attachmentPreview).toContain('addEventListener("wheel", zoomImage, { passive: false })');
    expect(attachmentPreview).toContain("setPointerCapture");
    expect(attachmentPreview).toContain("event.button !== 1");
    expect(attachmentPreview).toContain("imageElement.naturalWidth");
    expect(attachmentPreview).toContain("createFittedImageViewport(imageFitScale.current)");
    expect(attachmentPreview).toContain("imageIntrinsicSize.width");
    expect(attachmentPreview).toContain("Ctrl + 滚轮缩放 · 左键拖动 · 中键复位");
  });

  it("来源档案删除重复页面大标题并保留唯一有效操作", () => {
    expect(workspace).toContain('className="knowledge-page-header source-page-actions-only"');
    expect(workspace).not.toContain("<h1>来源档案</h1>");
    expect(workspace).toContain("自动整理待归类来源");
    expect(styles).toContain(".knowledge-page-header.source-page-actions-only");
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
});
