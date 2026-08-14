import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const evidenceDirectory = resolve(".runtime-qa", "dark-glass-frontmost-evidence");

function alphaFromComputedColor(color: string): number {
  const slashAlpha = color.match(/\/\s*([\d.]+)\s*\)?$/);
  if (slashAlpha) return Number(slashAlpha[1]);
  const rgbaAlpha = color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/);
  return rgbaAlpha ? Number(rgbaAlpha[1]) : 1;
}

test.beforeAll(async () => {
  await mkdir(evidenceDirectory, { recursive: true });
});

test("暗色场景玻璃前景卡统一为 50% 而实体、浅色与弹层仍不透明", async ({ page }) => {
  await page.goto("/");
  await page.locator("#root").waitFor();
  await page.evaluate(() => {
    document.documentElement.dataset.knowledgeColorMode = "dark";
    document.documentElement.dataset.knowledgeSkin = "florist-studio";
    document.documentElement.dataset.knowledgeSkinMaterial = "scene";

    const fixture = document.createElement("div");
    fixture.id = "dark-scene-frontmost-fixture";
    fixture.className = "app-shell";
    fixture.dataset.colorMode = "dark";
    fixture.dataset.skinMaterial = "scene";
    fixture.style.cssText = [
      "position:fixed",
      "inset:20px",
      "z-index:2147483647",
      "display:grid",
      "grid-template-columns:repeat(2,minmax(0,1fr))",
      "gap:18px",
      "padding:40px",
      "background:linear-gradient(135deg,#765a39,#31745e 45%,#a16d78)",
      "overflow:hidden",
    ].join(";");
    fixture.innerHTML = `
      <section class="unified-note-list-panel" style="padding:24px;border:1px solid">
        <h2>共享卡二承托</h2>
        <article class="unified-note-card" style="display:block;padding:20px;border:1px solid">
          <strong>全部笔记 / 收藏 / 持续跟踪共享前景卡</strong>
          <p>暗色场景下背景可透入一半。</p>
        </article>
      </section>
      <section class="source-message assistant" style="padding:24px;border:1px solid">
        <strong>共享卡三正文消息</strong>
        <p>正文、详情和消息消费同一最前景材质总线。</p>
      </section>
      <div class="source-search-history" style="position:relative;inset:auto;width:auto;padding:20px;border:1px solid">
        <header><strong>搜索历史弹层</strong></header>
        <p>弹层保持实体，不跟随卡片透明。</p>
      </div>
    `;
    document.body.append(fixture);
  });

  const computedContract = async () => page.evaluate(() => {
    const selectors = [".unified-note-list-panel", ".unified-note-card", ".source-message.assistant", ".source-search-history"];
    return Object.fromEntries(selectors.map((selector) => {
      const element = document.querySelector<HTMLElement>(`#dark-scene-frontmost-fixture ${selector}`);
      return [selector, element ? getComputedStyle(element).backgroundColor : "missing"];
    }));
  });

  const scene = await computedContract();
  expect(alphaFromComputedColor(scene[".unified-note-list-panel"])).toBeCloseTo(0.5, 5);
  expect(alphaFromComputedColor(scene[".unified-note-card"])).toBeCloseTo(0.5, 5);
  expect(alphaFromComputedColor(scene[".source-message.assistant"])).toBeCloseTo(0.5, 5);
  expect(alphaFromComputedColor(scene[".source-search-history"])).toBe(1);
  await page.screenshot({
    path: resolve(evidenceDirectory, "dark-scene-frontmost-50-percent-1702x1066.png"),
    fullPage: false,
  });

  await page.evaluate(() => {
    document.documentElement.dataset.knowledgeSkin = "entity-sage";
    document.documentElement.dataset.knowledgeSkinMaterial = "entity";
    const fixture = document.querySelector<HTMLElement>("#dark-scene-frontmost-fixture");
    if (fixture) fixture.dataset.skinMaterial = "entity";
  });
  await page.waitForTimeout(300);
  const entity = await computedContract();
  expect(alphaFromComputedColor(entity[".unified-note-list-panel"])).toBe(1);
  expect(alphaFromComputedColor(entity[".unified-note-card"])).toBe(1);
  expect(alphaFromComputedColor(entity[".source-message.assistant"])).toBe(1);

  await page.evaluate(() => {
    delete document.documentElement.dataset.knowledgeColorMode;
    document.documentElement.dataset.knowledgeSkin = "florist-studio";
    document.documentElement.dataset.knowledgeSkinMaterial = "scene";
    const fixture = document.querySelector<HTMLElement>("#dark-scene-frontmost-fixture");
    if (fixture) {
      fixture.dataset.colorMode = "light";
      fixture.dataset.skinMaterial = "scene";
    }
  });
  await page.waitForTimeout(300);
  const light = await computedContract();
  // 卡二外壳在亮色场景中仍是既有一级玻璃承托，不属于最前景业务卡。
  expect(alphaFromComputedColor(light[".unified-note-card"])).toBe(1);
  expect(alphaFromComputedColor(light[".source-message.assistant"])).toBe(1);
});
