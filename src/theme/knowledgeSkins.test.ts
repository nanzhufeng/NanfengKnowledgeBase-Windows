import { describe, expect, it } from "vitest";
import {
  DEFAULT_KNOWLEDGE_SKIN,
  getKnowledgeSkin,
  isKnowledgeSkinId,
  KNOWLEDGE_SKINS,
  persistKnowledgeSkin,
  readKnowledgeSkin,
} from "./knowledgeSkins";

describe("knowledge skins", () => {
  it("固定为用户确认的四套场景皮肤和一套原版皮肤", () => {
    expect(KNOWLEDGE_SKINS.map((skin) => skin.id)).toEqual([
      "desert-lantern",
      "florist-studio",
      "golden-horses",
      "bronze-botanical",
      "classic",
    ]);
  });

  it("拒绝未知或旧皮肤值并回退到默认皮肤", () => {
    expect(isKnowledgeSkinId("popsicle")).toBe(false);
    expect(readKnowledgeSkin({ getItem: () => "popsicle" })).toBe(DEFAULT_KNOWLEDGE_SKIN);
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
});
