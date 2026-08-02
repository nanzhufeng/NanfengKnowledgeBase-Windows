export interface ImagePreviewViewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export const DEFAULT_IMAGE_VIEWPORT: Readonly<ImagePreviewViewport> = Object.freeze({
  scale: 1,
  offsetX: 0,
  offsetY: 0,
});

const MIN_IMAGE_SCALE = 0.25;
const MAX_IMAGE_SCALE = 8;
const IMAGE_ZOOM_STEP = 1.1;

function clampImageScale(scale: number, fitScale = MIN_IMAGE_SCALE) {
  const minimumScale = Math.min(MIN_IMAGE_SCALE, fitScale);
  return Math.min(MAX_IMAGE_SCALE, Math.max(minimumScale, scale));
}

export function calculateImageFitScale(
  naturalWidth: number,
  naturalHeight: number,
  stageWidth: number,
  stageHeight: number,
): number {
  if (
    naturalWidth <= 0
    || naturalHeight <= 0
    || stageWidth <= 0
    || stageHeight <= 0
  ) return 1;
  return Math.min(1, stageWidth / naturalWidth, stageHeight / naturalHeight);
}

export function createFittedImageViewport(fitScale: number): ImagePreviewViewport {
  return {
    scale: fitScale,
    offsetX: 0,
    offsetY: 0,
  };
}

export function reconcileImageViewportFit(
  viewport: Readonly<ImagePreviewViewport>,
  previousFitScale: number,
  nextFitScale: number,
): ImagePreviewViewport {
  const wasFitted = Math.abs(viewport.scale - previousFitScale) < 0.0001
    && Math.abs(viewport.offsetX) < 0.01
    && Math.abs(viewport.offsetY) < 0.01;
  return wasFitted ? createFittedImageViewport(nextFitScale) : { ...viewport };
}

export function zoomImageViewport(
  viewport: Readonly<ImagePreviewViewport>,
  cursorX: number,
  cursorY: number,
  wheelDeltaY: number,
  fitScale = MIN_IMAGE_SCALE,
): ImagePreviewViewport {
  if (wheelDeltaY === 0) return viewport;
  const factor = wheelDeltaY < 0 ? IMAGE_ZOOM_STEP : 1 / IMAGE_ZOOM_STEP;
  const scale = clampImageScale(viewport.scale * factor, fitScale);
  if (scale === viewport.scale) return viewport;
  const ratio = scale / viewport.scale;
  return {
    scale,
    offsetX: cursorX - (cursorX - viewport.offsetX) * ratio,
    offsetY: cursorY - (cursorY - viewport.offsetY) * ratio,
  };
}

export function panImageViewport(
  viewport: Readonly<ImagePreviewViewport>,
  deltaX: number,
  deltaY: number,
): ImagePreviewViewport {
  return {
    ...viewport,
    offsetX: viewport.offsetX + deltaX,
    offsetY: viewport.offsetY + deltaY,
  };
}
