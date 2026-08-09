export interface MediaPreviewViewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export type MediaPreviewViewportMode = "fit" | "custom";

export interface MediaFitOptions {
  padding?: number;
  allowUpscale?: boolean;
}

export const DEFAULT_MEDIA_FIT_PADDING = 20;

export const DEFAULT_MEDIA_VIEWPORT: Readonly<MediaPreviewViewport> = Object.freeze({
  scale: 1,
  offsetX: 0,
  offsetY: 0,
});

const MIN_MEDIA_SCALE = 0.25;
const MAX_MEDIA_SCALE = 8;
const MEDIA_ZOOM_STEP = 1.1;

function clampMediaScale(scale: number, fitScale = MIN_MEDIA_SCALE) {
  const minimumScale = Math.min(MIN_MEDIA_SCALE, fitScale);
  const maximumScale = Math.max(MAX_MEDIA_SCALE, fitScale);
  return Math.min(maximumScale, Math.max(minimumScale, scale));
}

/** 图片与视频共用的完整适配算法；视频可放大小尺寸源，图片保留原始像素上限。 */
export function calculateMediaFitScale(
  naturalWidth: number,
  naturalHeight: number,
  stageWidth: number,
  stageHeight: number,
  options: MediaFitOptions = {},
): number {
  if (
    naturalWidth <= 0
    || naturalHeight <= 0
    || stageWidth <= 0
    || stageHeight <= 0
  ) return 1;
  const padding = options.padding ?? 0;
  const availableWidth = Math.max(0, stageWidth - padding * 2);
  const availableHeight = Math.max(0, stageHeight - padding * 2);
  if (availableWidth <= 0 || availableHeight <= 0) return 1;
  const containScale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight);
  return options.allowUpscale ? containScale : Math.min(1, containScale);
}

export function createFittedMediaViewport(fitScale: number): MediaPreviewViewport {
  return {
    scale: fitScale,
    offsetX: 0,
    offsetY: 0,
  };
}

export function reconcileMediaViewportMode(
  viewport: Readonly<MediaPreviewViewport>,
  mode: MediaPreviewViewportMode,
  nextFitScale: number,
): MediaPreviewViewport {
  return mode === "fit" ? createFittedMediaViewport(nextFitScale) : { ...viewport };
}

export function zoomMediaViewport(
  viewport: Readonly<MediaPreviewViewport>,
  cursorX: number,
  cursorY: number,
  wheelDeltaY: number,
  fitScale = MIN_MEDIA_SCALE,
): MediaPreviewViewport {
  if (wheelDeltaY === 0) return viewport;
  const factor = wheelDeltaY < 0 ? MEDIA_ZOOM_STEP : 1 / MEDIA_ZOOM_STEP;
  const scale = clampMediaScale(viewport.scale * factor, fitScale);
  if (scale === viewport.scale) return viewport;
  const ratio = scale / viewport.scale;
  return {
    scale,
    offsetX: cursorX - (cursorX - viewport.offsetX) * ratio,
    offsetY: cursorY - (cursorY - viewport.offsetY) * ratio,
  };
}

export function panMediaViewport(
  viewport: Readonly<MediaPreviewViewport>,
  deltaX: number,
  deltaY: number,
): MediaPreviewViewport {
  return {
    ...viewport,
    offsetX: viewport.offsetX + deltaX,
    offsetY: viewport.offsetY + deltaY,
  };
}
