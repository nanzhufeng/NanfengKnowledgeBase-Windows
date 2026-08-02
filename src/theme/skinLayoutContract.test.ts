import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

describe("skin layout contract", () => {
  it("原版浅色与场景皮肤共用同一外框几何", () => {
    const sceneShellBlock = styles.match(
      /\.app-shell:not\(\[data-skin="classic"\]\)\s*\{([^}]*)\}/,
    )?.[1] ?? "";
    expect(styles).toMatch(/\.app-shell\s*\{[\s\S]*?grid-template-columns:\s*214px minmax\(0, 1fr\);[\s\S]*?gap:\s*14px;[\s\S]*?padding:\s*12px;/);
    expect(styles).toMatch(/\.sidebar\s*\{[\s\S]*?padding:\s*20px 12px 18px;[\s\S]*?border-radius:\s*18px;/);
    expect(styles).toMatch(/\.main-region\s*\{[\s\S]*?border-radius:\s*20px;/);
    expect(sceneShellBlock).not.toContain("grid-template-columns");
    expect(sceneShellBlock).not.toContain("padding:");
  });

  it("四张皮肤选择卡使用一致列宽", () => {
    expect(styles).toMatch(/\.skin-option-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/);
  });
});
