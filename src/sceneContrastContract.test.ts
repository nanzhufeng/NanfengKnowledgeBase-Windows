/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("场景背景动态文字对比度合同", () => {
  it("场景前景和冷白磨砂表面使用彼此独立的语义 Token", () => {
    expect(app).toContain('"--skin-scene-text": adaptiveScene.text');
    expect(app).toContain('"--skin-scene-muted": adaptiveScene.muted');
    expect(app).toContain('"--skin-scene-accent": adaptiveScene.accent');
    expect(app).toContain('"--skin-scene-text-shadow": adaptiveScene.textShadow');
    expect(app).toContain('"--skin-surface-text": adaptiveScene.surfaceText');
    expect(app).toContain('"--skin-surface-muted": adaptiveScene.surfaceMuted');
  });

  it("页面标题使用场景前景色，嵌套空状态明确使用磨砂表面色", () => {
    expect(styles).toContain(
      '.app-shell:not([data-skin="classic"]) .page-shell > .page-title h1',
    );
    expect(styles).toContain(
      '.app-shell:not([data-skin="classic"]) .page-shell > .page-title p',
    );
    expect(styles).toContain(
      '.app-shell:not([data-skin="classic"]) .scene-surface-state',
    );
    expect(app).toContain('empty-state wide scene-surface-state');
    expect(styles).not.toContain(
      '.app-shell:not([data-skin="classic"]) .page-shell > .empty-state {',
    );
  });
});
