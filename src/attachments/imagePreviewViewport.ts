import {
  calculateMediaFitScale,
  createFittedMediaViewport,
  DEFAULT_MEDIA_FIT_PADDING,
  DEFAULT_MEDIA_VIEWPORT,
  panMediaViewport,
  reconcileMediaViewportMode,
  zoomMediaViewport,
  type MediaPreviewViewport,
  type MediaPreviewViewportMode,
} from "./mediaPreviewViewport";

/** 兼容旧图片调用；算法的唯一实现已提升为图片/视频共用视觉媒体视口。 */
export type ImagePreviewViewport = MediaPreviewViewport;
export type ImagePreviewViewportMode = MediaPreviewViewportMode;
export const DEFAULT_IMAGE_FIT_PADDING = DEFAULT_MEDIA_FIT_PADDING;
export const DEFAULT_IMAGE_VIEWPORT = DEFAULT_MEDIA_VIEWPORT;
export const createFittedImageViewport = createFittedMediaViewport;
export const reconcileImageViewportMode = reconcileMediaViewportMode;
export const zoomImageViewport = zoomMediaViewport;
export const panImageViewport = panMediaViewport;

export function calculateImageFitScale(
  naturalWidth: number,
  naturalHeight: number,
  stageWidth: number,
  stageHeight: number,
  padding = 0,
): number {
  return calculateMediaFitScale(naturalWidth, naturalHeight, stageWidth, stageHeight, { padding });
}
