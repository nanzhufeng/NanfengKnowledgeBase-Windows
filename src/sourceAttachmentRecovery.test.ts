/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const assetView = readProjectFile("src/components/SourceAttachmentAsset.tsx");
const timelineMediaCard = readProjectFile("src/components/AttachmentTimelineMediaCard.tsx");
const textPreview = readProjectFile("src/components/AttachmentTextPreview.tsx");
const locateButton = readProjectFile("src/components/AttachmentLocateButton.tsx");
const attachmentPreview = readProjectFile("src/components/AttachmentPreview.tsx");
const workspace = readProjectFile("src/components/KnowledgeWorkspace.tsx");
const styles = readProjectFile("src/styles.css");
const repository = readProjectFile("src/services/knowledgeRepository.ts");
const recordRepository = readProjectFile("src/services/recordRepository.ts");
const commands = readProjectFile("src-tauri/src/commands.rs");
const backend = readProjectFile("src-tauri/src/attachments.rs");
const externalOpen = readProjectFile("src-tauri/src/external_open.rs");
const transfer = readProjectFile("src-tauri/src/transfer.rs");
const exportReader = readProjectFile("src-tauri/src/chatgpt_export.rs");

describe("历史来源附件默认加载合同", () => {
  it("当前笔记自动加载全部声明附件，不再要求逐个点击确认", () => {
    expect(assetView).not.toContain("点击恢复并");
    expect(assetView).toContain("LOADING_LABEL");
    expect(assetView).toContain("onOpenAttachment(attachment)");
    expect(workspace).toContain("hydrateSourceAttachments(sourceItemId, missingIds)");
    expect(workspace).not.toContain("确认从这篇笔记的原始 ChatGPT 导出包恢复");
    expect(assetView).toContain('preload="metadata"');
    expect(assetView).toContain("IntersectionObserver");
    expect(assetView).toContain('rootMargin: "360px 0px"');
    expect(assetView).toContain('loading="lazy"');
    expect(assetView).not.toContain('loading="eager"');
    expect(assetView).not.toContain('preload="auto"');
    expect(assetView).toContain("source-document-attachment");
  });

  it("完整目录来自正文声明与受控实体并集，自动恢复仍按来源和唯一 ID 执行", () => {
    expect(repository).toContain('invoke("search_knowledge_source_attachment_catalog"');
    expect(repository).toContain('invoke("hydrate_knowledge_source_attachments"');
    expect(commands).toContain("pub fn search_knowledge_source_attachment_catalog");
    expect(commands).toContain("pub async fn hydrate_knowledge_source_attachments");
    expect(backend).toContain("search_source_attachment_catalog");
    expect(backend).toContain("collect_declared_attachments");
    expect(backend).toContain("hydrate_source_attachments");
    expect(backend).toContain("pub fn recover_source_attachment");
    expect(backend).toContain("find_declared_attachment");
    expect(backend).toContain("materialize_inspected_chatgpt_asset");
    expect(exportReader).toContain("pub fn materialize_inspected_chatgpt_asset");
  });

  it("图片和视频分类使用真实缩略图卡，视频代表帧点击后进入统一播放器", () => {
    expect(workspace).toContain("AttachmentTimelineMediaCard");
    expect(workspace).toContain('attachmentTimelineCategory !== "image" && attachmentTimelineCategory !== "video"');
    expect(workspace).toContain("repository.hydrateSourceAttachments(sourceItemId, ids)");
    expect(workspace).toContain("if (attachment) onOpenAttachment(attachment)");
    expect(timelineMediaCard).toContain('loading="lazy"');
    expect(timelineMediaCard).toContain('preload="metadata"');
    expect(timelineMediaCard).toContain("video.currentTime");
    expect(timelineMediaCard).toContain("点击播放");
    expect(styles).toContain(".attachment-timeline-media-grid");
    expect(styles).toContain(".attachment-timeline-play-cue");
    expect(styles).toContain("object-fit: contain");
  });

  it("资料卡预览保持时间线弹窗与卡三定位，关闭预览后回到原分类、查询和滚动上下文", () => {
    expect(workspace).not.toContain("const openSourceAttachmentCatalogHit = useCallback(async (hit: SourceAttachmentCatalogHit) => {\n    setAttachmentTimelineCategory(null);");
    expect(workspace).toContain("setSelectedId(hit.sourceItemId)");
    expect(workspace).toContain("if (attachment) onOpenAttachment(attachment)");
    expect(workspace).toContain("coveredByPreview={attachmentPreviewOpen}");
    expect(workspace).toContain("if (coveredByPreview) return;");
    expect(workspace).toContain("aria-hidden={coveredByPreview || undefined}");
    expect(attachmentPreview).toContain('aria-label="关闭预览" autoFocus');
  });

  it("正文视频与可预览文档共用全屏预览动作，且不把文件名误写成按钮语义", () => {
    expect(assetView).toContain("MonitorPlay");
    expect(assetView).toContain("source-fullscreen-preview-action");
    expect(assetView).toContain('"全屏预览并播放视频"');
    expect(assetView.match(/<span>全屏预览<\/span>/g)).toHaveLength(2);
    expect(assetView).toContain("{isVideo ? <button");
    expect(assetView).toContain('title={`全屏预览文档：${asset.fileName}`}');
    expect(assetView).toContain('aria-label={`全屏预览文档：${asset.fileName}`}');
    expect(assetView).not.toContain('<FileText size={16} /><span>{asset.fileName}</span>');
    expect(assetView).not.toContain("打开音频预览");
    expect(assetView).not.toContain('<PlayCircle size={16} /><span>{asset.fileName}</span>');
    expect(styles).toContain(".source-asset-actions .source-file-chip.source-fullscreen-preview-action");
  });

  it("音频和文件与图片视频共用按月多列卡片，音频保留原生播放进度与文件预览入口", () => {
    expect(workspace).toContain('className="attachment-timeline-media-grid"');
    expect(workspace).toContain("category === \"audio\"");
    expect(timelineMediaCard).toContain('data-media-kind={resolvedCategory}');
    expect(timelineMediaCard).toContain("attachmentPreviewKind(attachment)");
    expect(timelineMediaCard).toContain("<audio");
    expect(timelineMediaCard).toContain("controls");
    expect(timelineMediaCard).toContain('preload="metadata"');
    expect(timelineMediaCard).toContain("展开播放");
    expect(timelineMediaCard).toContain("查看预览");
    expect(styles).toContain(".attachment-timeline-audio-player");
    expect(styles).toContain(".attachment-timeline-media-footer");
  });

  it("历史资料时间线默认占应用约八成，并将竖向尺寸交给弹窗而不是固定列表", () => {
    expect(styles).toContain("width: min(80vw, calc(100vw - 42px))");
    expect(styles).toContain("height: min(80dvh, calc(100dvh - 48px))");
    expect(styles).toContain("grid-template-rows: auto auto auto minmax(0, 1fr)");
    expect(styles).toContain(".prototype-dialog,\n.knowledge-overview-dialog,\n.attachment-preview");
    expect(styles).toContain("resize: both");
  });

  it("资料时间线首次只绘制可视批次，分类结果命中缓存后立即显示并后台刷新", () => {
    expect(workspace).toContain("ATTACHMENT_TIMELINE_INITIAL_VISIBLE_COUNT = 120");
    expect(workspace).toContain("attachmentTimelineCatalogCache");
    expect(workspace).toContain("继续显示");
    expect(styles).toContain(".attachment-timeline-load-more");
    expect(backend).toContain("list_catalog_source_attachments");
    expect(backend).toContain("避免资料窗口打开时按来源执行 N 次查询");
  });

  it("移入回收站会同步失效来源搜索与附件时间线缓存，旧请求不能把资料带回界面", () => {
    expect(workspace).toContain("removeTrashedSourceFromSession");
    expect(workspace).toContain("sourceAttachmentSearchRequestSequence.current += 1");
    expect(workspace).toContain("attachmentTimelineRequestSequence.current += 1");
    expect(workspace).toContain("sourceAttachmentSessionCache.current.delete(sourceItemId)");
    expect(workspace).toContain("attachmentTimelineCatalogCache.current.forEach");
    expect(workspace).toContain("setSourceAttachmentHits(withoutTrashedAttachment)");
    expect(workspace).toContain("setAttachmentTimelineHits(withoutTrashedAttachment)");
  });

  it("切换全部笔记时先同步复用近期正文和附件，并只在空闲期预取相邻笔记", () => {
    expect(repository).toContain("SOURCE_TEXT_CACHE_MAX_ENTRIES = 32");
    expect(repository).toContain("SOURCE_TEXT_CACHE_MAX_BYTES");
    expect(repository).toContain("peekSourceOriginalText(sourceItemId");
    expect(workspace).toContain("SOURCE_TEXT_PREFETCH_RADIUS = 2");
    expect(workspace).toContain("repository.peekSourceOriginalText(selectedId)");
    expect(workspace).toContain("repository.getSourceOriginalText(sourceId).catch(() => null)");
    expect(workspace).toContain("sourceAttachmentSessionCache");
    expect(workspace).toContain("LOADING_LABEL");
    expect(styles).toContain(".source-body-loading");
  });

  it("Markdown附件走受控解码与统一阅读视图，不再交给iframe猜系统代码页", () => {
    expect(commands).toContain("pub fn read_attachment_text");
    expect(backend).toContain("pub fn read_attachment_text");
    expect(backend).toContain("decode_attachment_text");
    expect(backend).toContain("GBK.decode(bytes)");
    expect(textPreview).toContain('invoke<string>("read_attachment_text"');
    expect(textPreview).toContain("<MarkdownContent value={content} />");
    expect(assetView).toContain("<AttachmentTextPreview attachment={attachment} embedded />");
    expect(attachmentPreview).toContain('<AttachmentTextPreview attachment={attachment} />');
    expect(styles).toContain(".attachment-text-reader");
    expect(styles).toContain("white-space: pre-wrap");
  });

  it("所有已受控附件和导出文件共用Windows Shell定位能力", () => {
    expect(commands).toContain("pub fn reveal_attachment");
    expect(backend).toContain("pub fn reveal_attachment");
    expect(backend).toContain("controlled_attachment_file(paths, &attachment.stored_path)");
    expect(externalOpen).toContain("pub fn reveal_path");
    expect(externalOpen).toContain("CoInitializeEx");
    expect(externalOpen).toContain("ILCreateFromPathW");
    expect(externalOpen).toContain("SHOpenFolderAndSelectItems");
    expect(externalOpen).toContain("VERBATIM_UNC_PREFIX");
    expect(externalOpen).toContain("canonicalize 在 Windows 会返回");
    expect(externalOpen).toContain("let parent_path = path");
    expect(externalOpen).toContain("let selected = [item.0 as *const _]");
    expect(externalOpen).toContain("SHOpenFolderAndSelectItems(parent.0, selected.len() as u32, selected.as_ptr(), 0)");
    expect(externalOpen).not.toContain("SHOpenFolderAndSelectItems(item.0, 0, ptr::null(), 0)");
    expect(externalOpen).not.toContain('Command::new("explorer.exe")');
    expect(externalOpen).not.toContain("/select,");
    expect(recordRepository).toContain('invoke("reveal_attachment", { attachmentId })');
    expect(transfer).toContain("pub fn reveal_exported_file");
    expect(transfer).toContain("crate::external_open::reveal_path(&selected)");
    expect(transfer).toContain("selected.starts_with(&export_root)");
    expect(recordRepository).toContain('invoke("reveal_exported_file", { filePath })');
    expect(locateButton).toContain("所在目录并选中此文件");
    expect(locateButton).toContain("定位文件");
    expect((assetView.match(/<AttachmentLocateButton/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(attachmentPreview).toContain("<AttachmentLocateButton");
    expect(styles).toContain(".attachment-locate-button");
  });
});
