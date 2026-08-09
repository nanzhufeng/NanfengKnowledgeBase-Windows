import { describe, expect, it } from "vitest";
import {
  DEFAULT_KNOWLEDGE_SKIN,
  deriveAdaptiveScenePalette,
  getKnowledgeSkin,
  getSkinFallbackPalette,
  isKnowledgeSkinId,
  KNOWLEDGE_SKINS,
  persistKnowledgeSkin,
  readKnowledgeSkin,
  sceneContrastRatio,
} from "./knowledgeSkins";

describe("knowledge skins", () => {
  it("固定为用户确认的三套场景皮肤和一套原版皮肤", () => {
    expect(KNOWLEDGE_SKINS.map((skin) => skin.id)).toEqual([
      "desert-lantern",
      "florist-studio",
      "golden-horses",
      "classic",
    ]);
  });

  it("拒绝未知或旧皮肤值并回退到默认皮肤", () => {
    expect(isKnowledgeSkinId("popsicle")).toBe(false);
    expect(readKnowledgeSkin({ getItem: () => "popsicle" })).toBe(DEFAULT_KNOWLEDGE_SKIN);
    expect(isKnowledgeSkinId("bronze-botanical")).toBe(false);
    expect(readKnowledgeSkin({ getItem: () => "bronze-botanical" }))
      .toBe(DEFAULT_KNOWLEDGE_SKIN);
    expect(getKnowledgeSkin("classic").backgroundUrl).toBeNull();
  });

  it("只把皮肤偏好写入轻量浏览器存储", () => {
    let saved = "";
    persistKnowledgeSkin("florist-studio", {
      setItem: (_key, value) => {
        saved = value;
      },
    });
    expect(saved).toBe("florist-studio");
  });

  it("动态场景文字同时满足明暗反差与冷暖反向", () => {
    const cases = [
      { color: { red: 210, green: 170, blue: 100 }, temperature: "warm", coolText: true },
      { color: { red: 55, green: 32, blue: 18 }, temperature: "warm", coolText: true },
      { color: { red: 180, green: 215, blue: 235 }, temperature: "cool", coolText: false },
      { color: { red: 20, green: 38, blue: 60 }, temperature: "cool", coolText: false },
    ] as const;

    for (const testCase of cases) {
      const palette = deriveAdaptiveScenePalette(testCase.color);
      expect(palette.temperature).toBe(testCase.temperature);
      expect(sceneContrastRatio(palette.text, palette.background)).toBeGreaterThanOrEqual(5);
      expect(sceneContrastRatio(palette.muted, palette.background)).toBeGreaterThanOrEqual(4.5);
      expect(sceneContrastRatio(palette.accent, palette.background)).toBeGreaterThanOrEqual(4.5);
      const red = Number.parseInt(palette.text.slice(1, 3), 16);
      const blue = Number.parseInt(palette.text.slice(5, 7), 16);
      expect(testCase.coolText ? blue > red : red > blue).toBe(true);
    }
  });

  it("每套场景皮肤在图片完成采样前也使用高对比安全回退", () => {
    for (const skin of KNOWLEDGE_SKINS.filter((item) => item.id !== "classic")) {
      const palette = getSkinFallbackPalette(skin);
      expect(sceneContrastRatio(palette.text, palette.background)).toBeGreaterThanOrEqual(5);
      expect(sceneContrastRatio(palette.muted, palette.background)).toBeGreaterThanOrEqual(4.5);
      expect(palette.surfaceText).toBe("#17375f");
      expect(palette.surfaceMuted).toBe("#52647a");
    }
  });

});
