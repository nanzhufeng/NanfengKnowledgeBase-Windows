import { useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  AudioLines,
  Eye,
  FileArchive,
  FileText,
  FileType2,
  Image as ImageIcon,
  Music2,
  Play,
  Video,
} from "lucide-react";
import { attachmentPreviewKind } from "../attachments/attachmentPreview";
import type { SourceAttachmentCatalogHit } from "../services/knowledgeRepository";

type TimelineCategory = "all" | "image" | "video" | "audio" | "file";

function VideoRepresentativeFrame({ source }: { source: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);

  return (
    <video
      ref={videoRef}
      src={source}
      muted
      playsInline
      preload="metadata"
      aria-hidden="true"
      data-ready={ready ? "true" : "false"}
      onLoadedMetadata={() => {
        const video = videoRef.current;
        if (!video) return;
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        // 跳过可能为纯黑的第 0 帧；只在内存中生成代表帧，不改写原视频。
        video.currentTime = duration > 0.2 ? Math.min(1, duration * 0.1) : 0;
      }}
      onLoadedData={() => setReady(true)}
      onSeeked={() => setReady(true)}
    />
  );
}

export function AttachmentTimelineMediaCard({
  category,
  hit,
  dateLabel,
  onOpen,
}: {
  category: TimelineCategory;
  hit: SourceAttachmentCatalogHit;
  dateLabel: string;
  onOpen: () => void;
}) {
  const attachment = hit.attachment;
  const source = attachment ? convertFileSrc(attachment.storedPath) : null;
  const isRecoverable = hit.availability === "recoverable";
  const filePreviewKind = attachment ? attachmentPreviewKind(attachment) : "unsupported";
  const resolvedCategory: Exclude<TimelineCategory, "all"> = category === "all"
    ? (filePreviewKind === "image" || filePreviewKind === "video" || filePreviewKind === "audio"
      ? filePreviewKind
      : "file")
    : category;
  const isAudio = resolvedCategory === "audio";
  const isVisualMedia = resolvedCategory === "image" || resolvedCategory === "video";
  const fileVisual = filePreviewKind === "pdf"
    ? <FileText size={30} />
    : filePreviewKind === "text"
      ? <FileType2 size={30} />
      : filePreviewKind === "archive"
        ? <FileArchive size={30} />
        : <FileType2 size={30} />;
  const visualLabel = isAudio
    ? "音频播放"
    : resolvedCategory === "file"
      ? (filePreviewKind === "pdf" ? "PDF 预览" : filePreviewKind === "text" ? "文本预览" : "文件预览")
      : resolvedCategory === "video" ? "视频播放" : "图片查看";

  return (
    <article
      className="attachment-timeline-media-card"
      data-card-interaction="lift"
      data-media-kind={resolvedCategory}
    >
      <button
        type="button"
        className="attachment-timeline-media-visual"
        onClick={onOpen}
        aria-label={`${visualLabel}${hit.fileName}`}
      >
        {source && resolvedCategory === "image" ? (
          <img src={source} alt="" loading="lazy" decoding="async" />
        ) : null}
        {source && resolvedCategory === "video" ? <VideoRepresentativeFrame source={source} /> : null}
        {isAudio ? (
          <span className="attachment-timeline-audio-visual" aria-hidden="true">
            <Music2 size={34} />
            <span>音频</span>
          </span>
        ) : null}
        {resolvedCategory === "file" ? (
          <span className="attachment-timeline-file-visual" aria-hidden="true">
            {fileVisual}
            <span>{filePreviewKind === "unsupported" ? "文件" : filePreviewKind.toUpperCase()}</span>
          </span>
        ) : null}
        {!source && isVisualMedia ? (
          <span className="attachment-timeline-media-placeholder">
            {resolvedCategory === "image" ? <ImageIcon size={28} /> : <Video size={28} />}
            <small>{isRecoverable ? "正在生成预览" : "原始实体不可用"}</small>
          </span>
        ) : null}
        {resolvedCategory === "video" ? (
          <span className="attachment-timeline-play-cue" aria-hidden="true"><Play size={20} fill="currentColor" /></span>
        ) : null}
      </button>
      <div className="attachment-timeline-media-copy">
        <strong>{hit.fileName}</strong>
        <span>{hit.recordTitle}</span>
        {isAudio && source ? (
          <audio
            className="attachment-timeline-audio-player"
            controls
            preload="metadata"
            src={source}
            aria-label={`播放音频：${hit.fileName}`}
          />
        ) : null}
        <div className="attachment-timeline-media-footer">
          <time>{dateLabel}</time>
           <button type="button" onClick={onOpen}>
             {isAudio ? <AudioLines size={14} /> : <Eye size={14} />}
            {source ? (isAudio ? "展开播放" : resolvedCategory === "video" ? "点击播放" : "查看预览") : (isRecoverable ? "加载预览" : "不可预览")}
           </button>
        </div>
      </div>
    </article>
  );
}
