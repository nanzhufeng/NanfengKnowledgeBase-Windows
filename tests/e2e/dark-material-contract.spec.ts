import { expect, test } from "@playwright/test";

const entitySkins = [
  { id: "entity-mist", panel: "rgb(33, 58, 73)", input: "rgb(41, 70, 85)" },
  { id: "entity-sage", panel: "rgb(36, 63, 53)", input: "rgb(45, 75, 63)" },
  { id: "entity-terracotta", panel: "rgb(71, 47, 40)", input: "rgb(90, 58, 48)" },
] as const;

for (const skin of entitySkins) {
  test(`暗色 ${skin.id} 的共享控件消费本皮肤材质而非跨皮肤蓝灰`, async ({ page }) => {
    await page.addInitScript(({ skinId }) => {
      localStorage.setItem("nanfeng-knowledge-base:appearance-skin", skinId);
      localStorage.setItem("nanfeng-knowledge-base:appearance-color-mode", "dark");
    }, { skinId: skin.id });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /全部笔记/ }).click();

    const material = await page.evaluate(() => {
      const read = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return null;
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, border: style.borderColor, radius: style.borderRadius };
      };
      return {
        shell: read(".app-shell"),
        panel: read(".unified-note-list-panel"),
        searchRow: read(".search-row"),
        searchField: read(".search-field"),
      };
    });

    expect(material.panel).toMatchObject({ background: skin.panel });
    expect(material.searchField).toMatchObject({ background: skin.input, radius: "23px" });
    expect(material.searchRow).toMatchObject({ background: "rgba(0, 0, 0, 0)" });
    expect(material.shell?.background).not.toBe("rgb(16, 20, 21)");
  });
}

test("暗色空状态、搜索历史和消息卡不残留浅底", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("nanfeng-knowledge-base:appearance-skin", "entity-terracotta");
    localStorage.setItem("nanfeng-knowledge-base:appearance-color-mode", "dark");
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const surfaces = await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.innerHTML = `
      <p class="knowledge-final-empty">等待 AI 生成全库分类</p>
      <div class="recent-searches"><button>最近搜索</button></div>
      <article class="source-message assistant"><div class="source-message-header"><strong>助手</strong></div><div class="markdown-content">内容</div></article>
    `;
    document.body.append(fixture);
    const read = (selector: string) => {
      const element = fixture.querySelector<HTMLElement>(selector)!;
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color, border: style.borderColor };
    };
    const result = {
      empty: read(".knowledge-final-empty"),
      history: read(".recent-searches"),
      message: read(".source-message"),
    };
    fixture.remove();
    return result;
  });

  for (const surface of Object.values(surfaces)) {
    expect(surface.background).not.toMatch(/^rgb\((?:24[0-9]|25[0-5]),/);
    expect(surface.color).toMatch(/^rgb\((?:194, 208, 202|245, 251, 248)\)$/);
  }
});
