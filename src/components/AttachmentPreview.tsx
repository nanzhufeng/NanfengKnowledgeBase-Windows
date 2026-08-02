import { convertFileSrc } from "@tauri-apps/api/core";
import { ExternalLink, FileQuestion, Grip, Maximize2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
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
  calculateImageFitScale,
  createFittedImageViewport,
  DEFAULT_IMAGE_VIEWPORT,
  panImageViewport,
  reconcileImageViewportFit,
  zoomImageViewport,
} from "../attachments/imagePreviewViewport";

export function AttachmentPreview({
  attachment,
  onClose,
  onOpenOriginal,
}: {
  attachment: AttachmentItem;
  onClose: () => void;
  onOpenOriginal: (attachment: AttachmentItem) => void;
}) {
  const kind = attachmentPreviewKind(attachment);
  const source = useMemo(() => convertFileSrc(attachment.storedPath), [attachment.storedPath]);
  const [imageViewport, setImageViewport] = useState(DEFAULT_IMAGE_VIEWPORT);
  const [imageIntrinsicSize, setImageIntrinsicSize] = useState<{
    source: string;
    width: number;
    height: number;
  } | null>(null);
  const [imageDragging, setImageDragging] = useState(false);
  const [dialogSize, setDialogSize] = useState<{ width: number; height: number } | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const imageStageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const imageFitScale = useRef(1);
  const imageDrag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    viewport: { scale: number; offsetX: number; offsetY: number };
  } | null>(null);
  const dialogResize = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    setImageViewport(DEFAULT_IMAGE_VIEWPORT);
    setImageIntrinsicSize(null);
    imageFitScale.current = 1;
    setImageDragging(false);
    imageDrag.current = null;
    setDialogSize(null);
    dialogResize.current = null;
  }, [attachment.id, attachment.storedPath]);

  const syncImageFit = useCallback((forceFit: boolean) => {
    const imageElement = imageRef.current;
    const stageElement = imageStageRef.current;
    if (!imageElement || !stageElement || imageElement.naturalWidth <= 0 || imageElement.naturalHeight <= 0) return;
    const stage = stageElement.getBoundingClientRect();
    const nextFitScale = calculateImageFitScale(
      imageElement.naturalWidth,
      imageElement.naturalHeight,
      stage.width,
      stage.height,
    );
    const previousFitScale = imageFitScale.current;
    imageFitScale.current = nextFitScale;
    setImageViewport((viewport) => forceFit
      ? createFittedImageViewport(nextFitScale)
      : reconcileImageViewportFit(viewport, previousFitScale, nextFitScale));
  }, []);

  const handleImageLoad = () => {
    const imageElement = imageRef.current;
    if (!imageElement) return;
    setImageIntrinsicSize({
      source,
      width: imageElement.naturalWidth,
      height: imageElement.naturalHeight,
    });
    syncImageFit(true);
  };

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
    const stageElement = imageStageRef.current;
    if (kind !== "image" || !stageElement || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncImageFit(false));
    observer.observe(stageElement);
    return () => observer.disconnect();
  }, [kind, source, syncImageFit]);

  useEffect(() => {
    const stageElement = imageStageRef.current;
    if (kind !== "image" || !stageElement) return;
    const zoomImage = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      const stage = stageElement.getBoundingClientRect();
      const cursorX = event.clientX - stage.left - stage.width / 2;
      const cursorY = event.clientY - stage.top - stage.height / 2;
      setImageViewport((viewport) => zoomImageViewport(
        viewport,
        cursorX,
        cursorY,
        event.deltaY,
        imageFitScale.current,
      ));
    };
    stageElement.addEventListener("wheel", zoomImage, { passive: false });
    return () => stageElement.removeEventListener("wheel", zoomImage);
  }, [kind]);

  const startImageDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (kind !== "image" || event.button !== 0) return;
    const dialog = dialogRef.current?.getBoundingClientRect();
    if (dialog && event.clientX >= dialog.right - 32 && event.clientY >= dialog.bottom - 32) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    imageDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      viewport: imageViewport,
    };
    setImageDragging(true);
  };

  const moveImage = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = imageDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setImageViewport(panImageViewport(
      drag.viewport,
      event.clientX - drag.startX,
      event.clientY - drag.startY,
    ));
  };

  const stopImageDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = imageDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    imageDrag.current = null;
    setImageDragging(false);
  };

  const resetImageViewport = () => {
    imageDrag.current = null;
    setImageDragging(false);
    setImageViewport(createFittedImageViewport(imageFitScale.current));
  };

  const resetImageOnMiddleMouse = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (kind !== "image" || event.button !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    resetImageViewport();
  };

  const startDialogResize = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !dialogRef.current) return;
    const dialog = dialogRef.current.getBoundingClientRect();
    if (event.clientX < dialog.right - 32 || event.clientY < dialog.bottom - 32) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dialogResize.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: dialog.width,
      height: dialog.height,
    };
  };

  const resizeDialog = (event: ReactPointerEvent<HTMLElement>) => {
    const resize = dialogResize.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const availableWidth = Math.max(0, window.innerWidth - 16);
    const availableHeight = Math.max(0, window.innerHeight - 16);
    setDialogSize({
      width: Math.min(
        availableWidth,
        Math.max(Math.min(720, availableWidth), resize.width + event.clientX - resize.startX),
      ),
      height: Math.min(
        availableHeight,
        Math.max(Math.min(480, availableHeight), resize.height + event.clientY - resize.startY),
      ),
    });
  };

  const stopDialogResize = (event: ReactPointerEvent<HTMLElement>) => {
    const resize = dialogResize.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dialogResize.current = null;
  };

  return createPortal(
    <div className="attachment-preview-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className={`attachment-preview attachment-preview-${kind}`}
        role="dialog"
        aria-modal="true"
        aria-label={`预览 ${attachment.fileName}`}
        aria-describedby={kind === "image" ? "attachment-image-gesture-help" : undefined}
        title="拖动右下角可调整预览窗口大小"
        style={dialogSize ?? undefined}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={startDialogResize}
        onPointerMove={resizeDialog}
        onPointerUp={stopDialogResize}
        onPointerCancel={stopDialogResize}
      >
        <header>
          <div>
            <span>软件内置预览</span>
            <strong>{attachment.fileName}</strong>
          </div>
          <div className="attachment-preview-actions">
            {kind === "image" ? (
              <span id="attachment-image-gesture-help" className="attachment-image-gesture-hint">
                {Math.round(imageViewport.scale * 100)}% · Ctrl + 滚轮缩放 · 左键拖动 · 中键复位
              </span>
            ) : null}
            <button type="button" onClick={() => onOpenOriginal(attachment)}>
              <ExternalLink size={16} />打开原文件
            </button>
            <button type="button" className="icon-button" onClick={onClose} aria-label="关闭预览">
              <X size={18} />
            </button>
          </div>
        </header>
        <div
          ref={imageStageRef}
          className={`attachment-preview-stage ${kind === "image" ? "is-image" : ""} ${imageDragging ? "is-dragging" : ""}`}
          aria-label={kind === "image" ? "图片预览画布" : undefined}
          onMouseDown={resetImageOnMiddleMouse}
          onAuxClick={resetImageOnMiddleMouse}
          onPointerDown={startImageDrag}
          onPointerMove={moveImage}
          onPointerUp={stopImageDrag}
          onPointerCancel={stopImageDrag}
        >
          {kind === "image" ? (
            <div
              className="attachment-image-viewport"
              style={{
                transform: `translate3d(${imageViewport.offsetX}px, ${imageViewport.offsetY}px, 0)`,
              }}
            >
              <img
                key={source}
                ref={imageRef}
                src={source}
                alt={attachment.fileName}
                draggable={false}
                onLoad={handleImageLoad}
                style={{
                  width: imageIntrinsicSize?.source === source ? `${imageIntrinsicSize.width}px` : undefined,
                  height: imageIntrinsicSize?.source === source ? `${imageIntrinsicSize.height}px` : undefined,
                  visibility: imageIntrinsicSize?.source === source ? "visible" : "hidden",
                  transform: `scale(${imageViewport.scale})`,
                }}
              />
            </div>
          ) : null}
          {kind === "pdf" || kind === "text" ? (
            <iframe src={source} title={attachment.fileName} />
          ) : null}
          {kind === "audio" ? <audio src={source} controls autoPlay /> : null}
          {kind === "video" ? <video src={source} controls autoPlay /> : null}
          {kind === "unsupported" ? (
            <div className="attachment-preview-unsupported">
              <FileQuestion size={44} />
              <strong>该格式没有可靠的内置渲染器</strong>
              <span>文件仍在受控目录中，可用原应用打开，不会改变或复制原文件。</span>
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
