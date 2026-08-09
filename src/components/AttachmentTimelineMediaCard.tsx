import { useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Image as ImageIcon, Play, Video } from "lucide-react";
import type { SourceAttachmentCatalogHit } from "../services/knowledgeRepository";

type MediaCategory = "image" | "video";

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
  category: MediaCategory;
  hit: SourceAttachmentCatalogHit;
  dateLabel: string;
  onOpen: () => void;
}) {
  const attachment = hit.attachment;
  const source = attachment ? convertFileSrc(attachment.storedPath) : null;
  const isRecoverable = hit.availability === "recoverable";

  return (
    <button
      type="button"
      className="attachment-timeline-media-card"
      data-card-interaction="lift"
      data-media-kind={category}
      onClick={onOpen}
      aria-label={`${category === "video" ? "播放" : "打开"}${hit.fileName}`}
    >
      <span className="attachment-timeline-media-visual">
        {source && category === "image" ? (
          <img src={source} alt="" loading="lazy" decoding="async" />
        ) : null}
        {source && category === "video" ? <VideoRepresentativeFrame source={source} /> : null}
        {!source ? (
          <span className="attachment-timeline-media-placeholder">
            {category === "image" ? <ImageIcon size={28} /> : <Video size={28} />}
            <small>{isRecoverable ? "正在生成预览" : "原始实体不可用"}</small>
          </span>
        ) : null}
        {category === "video" ? (
          <span className="attachment-timeline-play-cue" aria-hidden="true"><Play size={20} fill="currentColor" /></span>
        ) : null}
      </span>
      <span className="attachment-timeline-media-copy">
        <strong>{hit.fileName}</strong>
        <span>{hit.recordTitle}</span>
        <small><time>{dateLabel}</time><em>{source ? (category === "video" ? "点击播放" : "点击查看") : (isRecoverable ? "准备中" : "不可预览")}</em></small>
      </span>
    </button>
  );
}
