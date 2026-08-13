import { convertFileSrc } from "@tauri-apps/api/core";
import { ExternalLink, FileQuestion, Grip, Maximize2, Move, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import type { AttachmentItem } from "../domain/models";
import { attachmentPreviewKind } from "../attachments/attachmentPreview";
import {
  calculateMediaFitScale,
  DEFAULT_MEDIA_FIT_PADDING,
  DEFAULT_MEDIA_VIEWPORT,
  panMediaViewport,
  reconcileMediaViewportMode,
  zoomMediaViewport,
  type MediaPreviewViewportMode,
} from "../attachments/mediaPreviewViewport";
import { AttachmentTextPreview } from "./AttachmentTextPreview";
import { AttachmentLocateButton } from "./AttachmentLocateButton";

export function AttachmentPreview({
  attachment,
  onClose,
  onOpenOriginal,
  onRevealAttachment,
}: {
  attachment: AttachmentItem;
  onClose: () => void;
  onOpenOriginal: (attachment: AttachmentItem) => void;
  onRevealAttachment: (attachment: AttachmentItem) => void;
}) {
  const kind = attachmentPreviewKind(attachment);
  const isVisualMedia = kind === "image" || kind === "video";
  const source = useMemo(() => convertFileSrc(attachment.storedPath), [attachment.storedPath]);
  const [mediaViewport, setMediaViewport] = useState(DEFAULT_MEDIA_VIEWPORT);
  const [mediaIntrinsicSize, setMediaIntrinsicSize] = useState<{
    source: string;
    width: number;
    height: number;
  } | null>(null);
  const [mediaDragging, setMediaDragging] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [mediaMode, setMediaMode] = useState<MediaPreviewViewportMode>("fit");
  const mediaStageRef = useRef<HTMLDivElement | null>(null);
  const mediaElementRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const mediaFitScale = useRef(1);
  const mediaViewportMode = useRef<MediaPreviewViewportMode>("fit");
  const mediaDrag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    viewport: { scale: number; offsetX: number; offsetY: number };
  } | null>(null);

  useEffect(() => {
    setMediaViewport(DEFAULT_MEDIA_VIEWPORT);
    setMediaIntrinsicSize(null);
    mediaFitScale.current = 1;
    mediaViewportMode.current = "fit";
    setMediaMode("fit");
    setMediaDragging(false);
    setMediaFailed(false);
    mediaDrag.current = null;
  }, [attachment.id, attachment.storedPath]);

  const syncMediaFit = useCallback((forceFit: boolean) => {
    const mediaElement = mediaElementRef.current;
    const stageElement = mediaStageRef.current;
    if (!mediaElement || !stageElement) return;
    const naturalWidth = mediaElement instanceof HTMLImageElement
      ? mediaElement.naturalWidth
      : mediaElement.videoWidth;
    const naturalHeight = mediaElement instanceof HTMLImageElement
      ? mediaElement.naturalHeight
      : mediaElement.videoHeight;
    if (naturalWidth <= 0 || naturalHeight <= 0) return;
    const stage = stageElement.getBoundingClientRect();
    const nextFitScale = calculateMediaFitScale(
      naturalWidth,
      naturalHeight,
      stage.width,
      stage.height,
      {
        padding: DEFAULT_MEDIA_FIT_PADDING,
        allowUpscale: kind === "video",
      },
    );
    mediaFitScale.current = nextFitScale;
    if (forceFit) {
      mediaViewportMode.current = "fit";
      setMediaMode("fit");
    }
    setMediaViewport((viewport) => reconcileMediaViewportMode(
      viewport,
      mediaViewportMode.current,
      nextFitScale,
    ));
  }, [kind]);

  const captureMediaIntrinsicSize = () => {
    const mediaElement = mediaElementRef.current;
    if (!mediaElement) return;
    const width = mediaElement instanceof HTMLImageElement
      ? mediaElement.naturalWidth
      : mediaElement.videoWidth;
    const height = mediaElement instanceof HTMLImageElement
      ? mediaElement.naturalHeight
      : mediaElement.videoHeight;
    if (width <= 0 || height <= 0) return;
    setMediaIntrinsicSize({
      source,
      width,
      height,
    });
  };

  useLayoutEffect(() => {
    if (!isVisualMedia || mediaIntrinsicSize?.source !== source) return;
    syncMediaFit(true);
  }, [isVisualMedia, mediaIntrinsicSize, source, syncMediaFit]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    const stageElement = mediaStageRef.current;
    if (!isVisualMedia || !stageElement) return;
    let frame = 0;
    const scheduleFit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => syncMediaFit(false));
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleFit);
    observer?.observe(stageElement);
    window.addEventListener("resize", scheduleFit);
    window.visualViewport?.addEventListener("resize", scheduleFit);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleFit);
      window.visualViewport?.removeEventListener("resize", scheduleFit);
    };
  }, [isVisualMedia, source, syncMediaFit]);

  useEffect(() => {
    const stageElement = mediaStageRef.current;
    if (!isVisualMedia || !stageElement) return;
    const zoomMedia = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      const stage = stageElement.getBoundingClientRect();
      const cursorX = event.clientX - stage.left - stage.width / 2;
      const cursorY = event.clientY - stage.top - stage.height / 2;
      if (event.deltaY === 0) return;
      mediaViewportMode.current = "custom";
      setMediaMode("custom");
      setMediaViewport((viewport) => zoomMediaViewport(
        viewport,
        cursorX,
        cursorY,
        event.deltaY,
        mediaFitScale.current,
      ));
    };
    stageElement.addEventListener("wheel", zoomMedia, { passive: false, capture: true });
    return () => stageElement.removeEventListener("wheel", zoomMedia, { capture: true });
  }, [isVisualMedia]);

  const startMediaDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isVisualMedia || event.button !== 0) return;
    const fromVideoPanHandle = Boolean((event.target as Element).closest(".attachment-media-pan-handle"));
    if (kind === "video" && (!fromVideoPanHandle || mediaViewportMode.current === "fit")) return;
    if (kind === "image" && (event.target as Element).closest("button")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    mediaDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      viewport: mediaViewport,
    };
    setMediaDragging(true);
  };

  const moveMedia = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = mediaDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - drag.startX) > 0.5 || Math.abs(event.clientY - drag.startY) > 0.5) {
      mediaViewportMode.current = "custom";
      setMediaMode("custom");
    }
    setMediaViewport(panMediaViewport(
      drag.viewport,
      event.clientX - drag.startX,
      event.clientY - drag.startY,
    ));
  };

  const stopMediaDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = mediaDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    mediaDrag.current = null;
    setMediaDragging(false);
  };

  const resetMediaViewport = () => {
    mediaDrag.current = null;
    setMediaDragging(false);
    mediaViewportMode.current = "fit";
    setMediaMode("fit");
    requestAnimationFrame(() => syncMediaFit(true));
  };

  const resetMediaOnMiddleMouse = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isVisualMedia || event.button !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    resetMediaViewport();
  };

  return createPortal(
    <div className="attachment-preview-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`attachment-preview attachment-preview-${kind} ${isVisualMedia ? "attachment-preview-visual-media" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`预览 ${attachment.fileName}`}
        aria-describedby={isVisualMedia ? "attachment-media-gesture-help" : undefined}
        title="拖动右下角可调整预览窗口大小"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>软件内置预览</span>
            <strong>{attachment.fileName}</strong>
          </div>
          <div className="attachment-preview-actions">
            {isVisualMedia ? (
              <span id="attachment-media-gesture-help" className="attachment-media-gesture-hint">
                {Math.round(mediaViewport.scale * 100)}% · Ctrl + 滚轮缩放 · {kind === "video" ? "缩放后拖动手柄" : "左键拖动"} · 中键适配
              </span>
            ) : null}
            {isVisualMedia ? (
              <button type="button" onClick={resetMediaViewport} title="重新完整显示并居中">
                <Maximize2 size={16} />适合屏幕
              </button>
            ) : null}
            <button type="button" onClick={() => onOpenOriginal(attachment)}>
              <ExternalLink size={16} />打开原文件
            </button>
            <AttachmentLocateButton
              attachment={attachment}
              onRevealAttachment={onRevealAttachment}
              compact={isVisualMedia}
            />
            <button type="button" className="icon-button" onClick={onClose} aria-label="关闭预览" autoFocus>
              <X size={18} />
            </button>
          </div>
        </header>
        <div
          ref={mediaStageRef}
          className={`attachment-preview-stage ${isVisualMedia ? "is-visual-media" : ""} ${mediaDragging ? "is-dragging" : ""}`}
          aria-label={isVisualMedia ? "视觉媒体预览画布" : undefined}
          onMouseDown={resetMediaOnMiddleMouse}
          onAuxClick={resetMediaOnMiddleMouse}
          onPointerDown={kind === "image" ? startMediaDrag : undefined}
          onPointerMove={moveMedia}
          onPointerUp={stopMediaDrag}
          onPointerCancel={stopMediaDrag}
        >
          {isVisualMedia && !mediaFailed ? (
            <div
              className="attachment-media-viewport"
              style={{
                transform: `translate3d(${mediaViewport.offsetX}px, ${mediaViewport.offsetY}px, 0)`,
              }}
            >
              {kind === "image" ? (
                <img
                  key={source}
                  ref={(element) => { mediaElementRef.current = element; }}
                  src={source}
                  alt={attachment.fileName}
                  draggable={false}
                  onLoad={captureMediaIntrinsicSize}
                  onError={() => setMediaFailed(true)}
                  style={{
                    width: mediaIntrinsicSize?.source === source ? `${mediaIntrinsicSize.width}px` : undefined,
                    height: mediaIntrinsicSize?.source === source ? `${mediaIntrinsicSize.height}px` : undefined,
                    visibility: mediaIntrinsicSize?.source === source ? "visible" : "hidden",
                    transform: `translate(-50%, -50%) scale(${mediaViewport.scale})`,
                  }}
                />
              ) : null}
              {kind === "video" ? (
                <>
                  <video
                    key={source}
                    ref={(element) => { mediaElementRef.current = element; }}
                    src={source}
                    controls
                    autoPlay
                    preload="metadata"
                    onLoadedMetadata={captureMediaIntrinsicSize}
                    onError={() => setMediaFailed(true)}
                    style={{
                      width: mediaIntrinsicSize?.source === source ? `${mediaIntrinsicSize.width}px` : undefined,
                      height: mediaIntrinsicSize?.source === source ? `${mediaIntrinsicSize.height}px` : undefined,
                      visibility: mediaIntrinsicSize?.source === source ? "visible" : "hidden",
                      transform: `translate(-50%, -50%) scale(${mediaViewport.scale})`,
                    }}
                  />
                </>
              ) : null}
            </div>
          ) : null}
          {kind === "video" && mediaMode === "custom" && !mediaFailed ? (
            <div
              className="attachment-media-pan-handle"
              role="button"
              tabIndex={0}
              aria-label="拖动视频画面"
              title="拖动视频画面；播放控制条始终保持原生操作"
              onPointerDown={startMediaDrag}
              onPointerMove={moveMedia}
              onPointerUp={stopMediaDrag}
              onPointerCancel={stopMediaDrag}
            >
              <Move size={15} />拖动画面
            </div>
          ) : null}
          {kind === "pdf" ? (
            <iframe src={source} title={attachment.fileName} />
          ) : null}
          {kind === "text" ? <AttachmentTextPreview attachment={attachment} /> : null}
          {kind === "audio" && !mediaFailed ? <audio src={source} controls autoPlay onError={() => setMediaFailed(true)} /> : null}
          {kind === "archive" || kind === "unsupported" || mediaFailed ? (
            <div className="attachment-preview-unsupported">
              <FileQuestion size={44} />
              <strong>{kind === "archive" ? "归档文件已受控保存" : mediaFailed ? "当前 WebView 无法解码此媒体" : "该格式没有可靠的内置渲染器"}</strong>
              <span>{kind === "archive" ? "ZIP、7z、RAR 等文件已被统一识别并安全保留；当前版本不解压、不执行其中内容。" : "文件仍在受控目录中，可用原应用打开，不会改变或复制原文件。"}</span>
              <button type="button" onClick={() => onOpenOriginal(attachment)}>
                <Maximize2 size={16} />打开原文件
              </button>
            </div>
          ) : null}
        </div>
        <span
          className="attachment-preview-resize-handle"
          aria-hidden="true"
        >
          <Grip size={15} />
        </span>
      </section>
    </div>,
    document.body,
  );
}
