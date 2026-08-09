import { describe, expect, it } from "vitest";
import {
  calculateMediaFitScale,
  createFittedMediaViewport,
  DEFAULT_MEDIA_FIT_PADDING,
  panMediaViewport,
  reconcileMediaViewportMode,
  zoomMediaViewport,
} from "./mediaPreviewViewport";

describe("视觉媒体统一预览视口", () => {
  it("图片保持原始像素上限，视频可完整放大铺满可用画面", () => {
    expect(calculateMediaFitScale(800, 600, 1600, 900, {
      padding: DEFAULT_MEDIA_FIT_PADDING,
    })).toBe(1);
    expect(calculateMediaFitScale(800, 600, 1600, 900, {
      padding: DEFAULT_MEDIA_FIT_PADDING,
      allowUpscale: true,
    })).toBeCloseTo(860 / 600);
  });

  it("图片和视频共用适配、自定义、光标缩放与平移状态机", () => {
    const fitted = createFittedMediaViewport(1.4);
    const zoomed = zoomMediaViewport(fitted, 100, 50, -120, 1.4);
    expect(zoomed.scale).toBeCloseTo(1.54);
    expect(zoomed.offsetX).toBeCloseTo(-10);
    expect(zoomed.offsetY).toBeCloseTo(-5);

    const inspected = panMediaViewport(zoomed, 30, -20);
    expect(reconcileMediaViewportMode(inspected, "custom", 1.2)).toEqual(inspected);
    expect(reconcileMediaViewportMode(inspected, "fit", 1.2)).toEqual({
      scale: 1.2,
      offsetX: 0,
      offsetY: 0,
    });
  });
});
