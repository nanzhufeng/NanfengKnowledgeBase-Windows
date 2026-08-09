import { describe, expect, it } from "vitest";
import {
  calculateImageFitScale,
  createFittedImageViewport,
  DEFAULT_IMAGE_FIT_PADDING,
  DEFAULT_IMAGE_VIEWPORT,
  panImageViewport,
  reconcileImageViewportMode,
  zoomImageViewport,
} from "./imagePreviewViewport";

describe("图片附件预览视口", () => {
  it("按原始像素尺寸计算完整适配比例，小图不放大", () => {
    expect(calculateImageFitScale(4000, 3000, 1600, 900)).toBeCloseTo(0.3);
    expect(calculateImageFitScale(800, 600, 1600, 900)).toBe(1);
    expect(calculateImageFitScale(0, 600, 1600, 900)).toBe(1);
    expect(calculateImageFitScale(4000, 3000, 1600, 900, DEFAULT_IMAGE_FIT_PADDING))
      .toBeCloseTo(860 / 3000);
  });

  it("围绕鼠标位置按真实像素比例缩放", () => {
    const fitted = createFittedImageViewport(0.3);
    const zoomed = zoomImageViewport(fitted, 100, 50, -120, 0.3);
    expect(zoomed.scale).toBeCloseTo(0.33);
    expect(zoomed.offsetX).toBeCloseTo(-10);
    expect(zoomed.offsetY).toBeCloseTo(-5);

    const restored = zoomImageViewport(zoomed, 100, 50, 120, 0.3);
    expect(restored.scale).toBeCloseTo(0.3);
    expect(restored.offsetX).toBeCloseTo(0);
    expect(restored.offsetY).toBeCloseTo(0);
  });

  it("调窗时由明确模式决定重新适配，不从浮点缩放值猜测用户意图", () => {
    const fitted = createFittedImageViewport(0.3);
    expect(reconcileImageViewportMode(fitted, "fit", 0.2)).toEqual({
      scale: 0.2,
      offsetX: 0,
      offsetY: 0,
    });

    const inspected = panImageViewport({ ...fitted, scale: 1 }, 36, -24);
    expect(reconcileImageViewportMode(inspected, "custom", 0.2)).toEqual(inspected);
    expect(reconcileImageViewportMode({ ...fitted, scale: 0.30001 }, "fit", 0.2)).toEqual({
      scale: 0.2,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("纵向长图随当前窗口大小重新完整适配并保持中心，手动查看态不被调窗覆盖", () => {
    const largeWindowFit = calculateImageFitScale(1080, 2400, 1660, 960, DEFAULT_IMAGE_FIT_PADDING);
    const compactWindowFit = calculateImageFitScale(1080, 2400, 900, 600, DEFAULT_IMAGE_FIT_PADDING);
    expect(largeWindowFit).toBeCloseTo(920 / 2400);
    expect(compactWindowFit).toBeCloseTo(560 / 2400);

    const centered = reconcileImageViewportMode(
      createFittedImageViewport(largeWindowFit),
      "fit",
      compactWindowFit,
    );
    expect(centered).toEqual({ scale: compactWindowFit, offsetX: 0, offsetY: 0 });

    const inspected = { scale: 1, offsetX: 140, offsetY: -90 };
    expect(reconcileImageViewportMode(inspected, "custom", compactWindowFit)).toEqual(inspected);
  });

  it("限制极端缩放并允许左键拖动产生平移", () => {
    let viewport = DEFAULT_IMAGE_VIEWPORT;
    for (let index = 0; index < 80; index += 1) {
      viewport = zoomImageViewport(viewport, 0, 0, -120, 0.1);
    }
    expect(viewport.scale).toBe(8);

    viewport = panImageViewport(viewport, 36, -24);
    expect(viewport.offsetX).toBe(36);
    expect(viewport.offsetY).toBe(-24);
  });
});
