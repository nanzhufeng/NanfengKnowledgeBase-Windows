import { describe, expect, it } from "vitest";
import {
  DEFAULT_KNOWLEDGE_COLOR_MODE,
  DEFAULT_KNOWLEDGE_SKIN,
  deriveAdaptiveScenePalette,
  getKnowledgeSkin,
  getSkinFallbackPalette,
  isKnowledgeSkinId,
  KNOWLEDGE_SKINS,
  persistKnowledgeColorMode,
  persistKnowledgeSkin,
  readKnowledgeColorMode,
  readKnowledgeSkin,
  sceneContrastRatio,
} from "./knowledgeSkins";

describe("knowledge skins", () => {
  it("固定为用户确认的三套实体工作台与两套场景玻璃皮肤", () => {
    expect(KNOWLEDGE_SKINS.map((skin) => skin.id)).toEqual([
      "entity-mist",
      "entity-sage",
      "entity-terracotta",
      "florist-studio",
      "golden-horses",
    ]);
    expect(KNOWLEDGE_SKINS.map((skin) => skin.name)).toEqual([
      "实体工作台 · 雾蓝",
      "实体工作台 · 鼠尾草",
      "实体工作台 · 暖陶",
      "场景玻璃 · 花房",
      "场景玻璃 · 奔马",
    ]);
  });

  it("拒绝未知或旧皮肤值并回退到默认皮肤", () => {
    expect(isKnowledgeSkinId("popsicle")).toBe(false);
    expect(readKnowledgeSkin({ getItem: () => "popsicle" })).toBe(DEFAULT_KNOWLEDGE_SKIN);
    expect(isKnowledgeSkinId("bronze-botanical")).toBe(false);
    expect(readKnowledgeSkin({ getItem: () => "bronze-botanical" }))
      .toBe(DEFAULT_KNOWLEDGE_SKIN);
    expect(readKnowledgeSkin({ getItem: () => "classic" })).toBe("entity-mist");
    expect(readKnowledgeSkin({ getItem: () => "desert-lantern" })).toBe("entity-mist");
    expect(getKnowledgeSkin("entity-mist").backgroundUrl).toBeNull();
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

  it("暗色模式是独立于五套皮肤的轻量外观偏好", () => {
    expect(readKnowledgeColorMode({ getItem: () => "dark" })).toBe("dark");
    expect(readKnowledgeColorMode({ getItem: () => "unknown" })).toBe(DEFAULT_KNOWLEDGE_COLOR_MODE);
    let saved = "";
    persistKnowledgeColorMode("dark", {
      setItem: (_key, value) => {
        saved = value;
      },
    });
    expect(saved).toBe("dark");
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
    for (const skin of KNOWLEDGE_SKINS.filter((item) => item.material === "scene")) {
      const palette = getSkinFallbackPalette(skin);
      expect(sceneContrastRatio(palette.text, palette.background)).toBeGreaterThanOrEqual(5);
      expect(sceneContrastRatio(palette.muted, palette.background)).toBeGreaterThanOrEqual(4.5);
      expect(palette.surfaceText).toBe("#17375f");
      expect(palette.surfaceMuted).toBe("#52647a");
    }
  });

});
