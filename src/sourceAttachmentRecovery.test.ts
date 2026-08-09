/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

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
const exportReader = readProjectFile("src-tauri/src/chatgpt_export.rs");

describe("历史来源附件默认加载合同", () => {
  it("当前笔记自动加载全部声明附件，不再要求逐个点击确认", () => {
    expect(assetView).not.toContain("点击恢复并");
    expect(assetView).toContain("正在自动加载");
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

  it("所有已受控附件共用资源管理器定位能力，前端只提交附件ID", () => {
    expect(commands).toContain("pub fn reveal_attachment");
    expect(backend).toContain("pub fn reveal_attachment");
    expect(backend).toContain("controlled_attachment_file(paths, &attachment.stored_path)");
    expect(externalOpen).toContain("pub fn reveal_path");
    expect(externalOpen).toContain('Command::new("explorer.exe")');
    expect(externalOpen).toContain('format!("/select,{}"');
    expect(recordRepository).toContain('invoke("reveal_attachment", { attachmentId })');
    expect(locateButton).toContain("打开文件所在目录并选中此文件");
    expect(locateButton).toContain("定位文件");
    expect((assetView.match(/<AttachmentLocateButton/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(attachmentPreview).toContain("<AttachmentLocateButton");
    expect(styles).toContain(".attachment-locate-button");
  });
});
