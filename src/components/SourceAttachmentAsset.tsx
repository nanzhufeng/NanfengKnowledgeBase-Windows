import { convertFileSrc } from "@tauri-apps/api/core";
import { Archive, FileQuestion, FileText, Image as ImageIcon, Paperclip, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { attachmentPreviewKind } from "../attachments/attachmentPreview";
import type { AttachmentItem } from "../domain/models";
import type { ReadableSourceAsset } from "../domain/importedContent";
import { AttachmentTextPreview } from "./AttachmentTextPreview";
import { AttachmentLocateButton } from "./AttachmentLocateButton";

function useNearViewport(key: string) {
  const [boundary, setBoundary] = useState<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!boundary) return;
    if (typeof IntersectionObserver === "undefined") {
      setReady(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setReady(true);
      observer.disconnect();
    }, { rootMargin: "360px 0px" });
    observer.observe(boundary);
    return () => observer.disconnect();
  }, [boundary, key]);

  return { setBoundary, ready };
}

function DeferredAttachmentPreview({ label }: { label: string }) {
  return <span className="source-asset-deferred" aria-label={`${label}将在滚动到附近时加载`}>
    <FileText size={18} />
    <span>滚动到附近后加载预览</span>
  </span>;
}

/** 正文来源附件的唯一展示入口，避免各个工作区各自猜测文件类型。 */
export function SourceAttachmentAsset({
  asset,
  attachment,
  onOpenAttachment,
  onRevealAttachment,
  onAddAttachment,
  recoveryState = "failed",
  recoveryMessage,
}: {
  asset: ReadableSourceAsset;
  attachment: AttachmentItem | null;
  onOpenAttachment: (attachment: AttachmentItem) => void;
  onRevealAttachment: (attachment: AttachmentItem) => void;
  onAddAttachment?: () => void;
  recoveryState?: "pending" | "loading" | "failed";
  recoveryMessage?: string;
}) {
  const [failed, setFailed] = useState(false);
  const { setBoundary, ready } = useNearViewport(String(attachment?.id ?? asset.fileUuid ?? asset.fileName));
  useEffect(() => setFailed(false), [attachment?.id]);
  if (!attachment) {
    const canAdd = Boolean(onAddAttachment);
    const kindLabel = asset.kind === "image" ? "图片" : asset.kind === "video" ? "视频" : asset.kind === "audio" ? "音频" : "文件";
    const status = recoveryState === "loading"
      ? `正在自动加载${kindLabel}…`
      : recoveryState === "failed"
        ? recoveryMessage ?? `原始导出包未携带可加载的${kindLabel}实体`
        : asset.fileUuid
          ? `等待自动加载${kindLabel}…`
          : `${kindLabel}缺少唯一 ID，无法自动加载`;
    const missing = <>{asset.kind === "image" ? <ImageIcon size={19} /> : <Paperclip size={16} />}<span><strong>{asset.fileName}</strong><em>{status}</em></span></>;
    return canAdd ? <button className="source-image-placeholder" type="button" onClick={onAddAttachment} title="添加同名原文件后会自动关联">{missing}</button> : <span className="source-image-placeholder">{missing}</span>;
  }

  const kind = attachmentPreviewKind(attachment);
  const source = convertFileSrc(attachment.storedPath);
  if (kind === "image") {
    return <section ref={setBoundary} className="source-asset-shell source-image-attachment">
      <button className="source-image" type="button" onClick={() => onOpenAttachment(attachment)} title={`软件内预览图片：${asset.fileName}`}>
        {ready && !failed ? <img src={source} alt={asset.fileName} loading="lazy" decoding="async" onError={() => setFailed(true)} /> : null}
        {!ready ? <DeferredAttachmentPreview label={asset.fileName} /> : null}
        {failed ? <span className="source-asset-failed"><FileQuestion size={18} />图片无法由当前解码器显示，点击用原应用打开</span> : <span>{asset.fileName}</span>}
      </button>
      <div className="source-asset-actions"><AttachmentLocateButton attachment={attachment} onRevealAttachment={onRevealAttachment} /></div>
    </section>;
  }
  if (kind === "audio" || kind === "video") {
    const Media = kind === "audio" ? "audio" : "video";
    return <section ref={setBoundary} className={`source-media-attachment source-media-${kind}`}>
      {ready && !failed ? <Media src={source} controls preload="metadata" onError={() => setFailed(true)} /> : null}
      {!ready ? <DeferredAttachmentPreview label={asset.fileName} /> : null}
      <div className="source-asset-actions">
        <button className="source-file-chip" type="button" onClick={() => onOpenAttachment(attachment)} title={`打开${kind === "audio" ? "音频" : "视频"}预览`}><PlayCircle size={16} /><span>{asset.fileName}</span></button>
        <AttachmentLocateButton attachment={attachment} onRevealAttachment={onRevealAttachment} />
      </div>
      {failed ? <span className="source-asset-failed"><FileQuestion size={16} />当前 WebView 无法解码，文件仍可安全打开</span> : null}
    </section>;
  }
  if (kind === "pdf" || kind === "text") {
    return <section ref={setBoundary} className={`source-document-attachment source-document-${kind}`}>
      {ready ? (kind === "pdf"
        ? <iframe src={source} title={`${asset.fileName} 文档预览`} loading="lazy" />
        : <AttachmentTextPreview attachment={attachment} embedded />) : <DeferredAttachmentPreview label={asset.fileName} />}
      <div className="source-asset-actions">
        <button className="source-file-chip" type="button" onClick={() => onOpenAttachment(attachment)} title={`放大预览${asset.fileName}`}>
          <FileText size={16} /><span>{asset.fileName}</span>
        </button>
        <AttachmentLocateButton attachment={attachment} onRevealAttachment={onRevealAttachment} />
      </div>
    </section>;
  }
  const Icon = kind === "archive" ? Archive : Paperclip;
  return <div className="source-asset-actions source-file-actions">
    <button className="source-file-chip" type="button" onClick={() => onOpenAttachment(attachment)} title={`软件内预览附件：${asset.fileName}`}><Icon size={16} /><span>{asset.fileName}{kind === "archive" ? " · 归档文件" : ""}</span></button>
    <AttachmentLocateButton attachment={attachment} onRevealAttachment={onRevealAttachment} />
  </div>;
}
