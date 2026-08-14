import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const evidenceDirectory = resolve(".runtime-qa", "dark-popover-evidence");

test.beforeAll(async () => {
  await mkdir(evidenceDirectory, { recursive: true });
});

test("暗色搜索历史和组合筛选使用不透明皮肤底并覆盖后方内容", async ({ page }) => {
  await page.goto("/");
  await page.locator("#root").waitFor();
  await page.evaluate(() => {
    document.documentElement.dataset.knowledgeColorMode = "dark";
    document.documentElement.dataset.knowledgeSkin = "florist-studio";
    document.documentElement.dataset.knowledgeSkinMaterial = "scene";

    const fixture = document.createElement("div");
    fixture.id = "dark-popover-backing-fixture";
    fixture.style.cssText = "position:fixed;inset:20px;z-index:2147483647;background:#72886f;padding:24px;overflow:hidden";
    fixture.innerHTML = `
      <div style="position:absolute;left:30px;top:34px;width:620px;color:white;font-size:18px;line-height:42px">
        后方列表标题仍在继续 后方列表标题仍在继续 后方列表标题仍在继续<br />
        待确认 120　正文　图片　视频　音频　文件<br />
        这段文字不能穿透弹层成为可读内容
      </div>
      <label class="source-search-field" style="position:absolute;left:40px;top:40px;width:320px;height:45px">
        <div class="source-search-history" style="top:0;width:300px;min-height:230px">
          <header><strong>历史资料搜索</strong><button type="button">清空</button></header>
          <div class="history-search-types">全部　正文　图片　视频　音频　文件</div>
          <small class="source-search-history-label">最近使用</small>
          <button type="button"><span>没有提交成功</span></button>
          <button type="button"><span>搜索结果不完整</span></button>
        </div>
      </label>
      <div class="filter-wrap unified-note-list-filter-wrap" style="position:absolute;left:390px;top:40px">
        <div class="filter-popover unified-note-list-filter-popover" style="top:0;right:auto;left:0;width:280px">
          <strong>组合筛选</strong>
          <label><span>来源</span><select><option>全部来源</option></select></label>
          <label><span>状态</span><select><option>全部状态</option></select></label>
        </div>
      </div>
    `;
    document.body.append(fixture);
  });

  const contract = await page.evaluate(() => {
    const history = document.querySelector<HTMLElement>(".source-search-history");
    const filter = document.querySelector<HTMLElement>(".filter-popover");
    const historyOwner = document.querySelector<HTMLElement>(".source-search-field");
    const filterOwner = document.querySelector<HTMLElement>(".unified-note-list-filter-wrap");
    if (!history || !filter || !historyOwner || !filterOwner) return null;
    const historyStyle = getComputedStyle(history);
    const filterStyle = getComputedStyle(filter);
    return {
      historyBackgroundColor: historyStyle.backgroundColor,
      historyBackgroundImage: historyStyle.backgroundImage,
      filterBackgroundColor: filterStyle.backgroundColor,
      filterBackgroundImage: filterStyle.backgroundImage,
      historyOwnerZIndex: getComputedStyle(historyOwner).zIndex,
      filterOwnerZIndex: getComputedStyle(filterOwner).zIndex,
    };
  });

  expect(contract).toEqual({
    historyBackgroundColor: "rgb(27, 48, 44)",
    historyBackgroundImage: expect.stringContaining("linear-gradient"),
    filterBackgroundColor: "rgb(27, 48, 44)",
    filterBackgroundImage: expect.stringContaining("linear-gradient"),
    historyOwnerZIndex: "40",
    filterOwnerZIndex: "40",
  });
  await page.screenshot({
    path: resolve(evidenceDirectory, "dark-popover-solid-backing-1702x1066.png"),
    fullPage: false,
  });
});
