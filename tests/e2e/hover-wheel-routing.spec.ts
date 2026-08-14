import { expect, test } from "@playwright/test";

test("滚轮事务锁定旧目标时立即切换到鼠标当前悬浮卡片", async ({ page }) => {
  await page.goto("/");
  await page.locator("#root").waitFor();
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.id = "hover-wheel-routing-fixture";
    fixture.style.cssText = "position:fixed;inset:20px;z-index:2147483647;display:grid;grid-template-columns:240px 240px;gap:24px;pointer-events:auto";
    fixture.innerHTML = ["two", "three"].map((id) => `
      <section data-hover-wheel-panel="" data-panel="${id}" style="height:360px;background:white;padding:12px">
        <header data-panel-title="${id}" style="height:48px">卡片${id}</header>
        <div data-hover-wheel-scroll="" data-panel-scroll="${id}" style="height:280px;overflow-y:auto">
          <div style="height:1200px">${id}</div>
        </div>
      </section>
    `).join("");
    document.body.append(fixture);
  });

  const cardTwoScroll = page.locator('[data-panel-scroll="two"]');
  const cardThreeScroll = page.locator('[data-panel-scroll="three"]');
  const cardTwoTitle = page.locator('[data-panel-title="two"]');
  const cardThreeTitle = page.locator('[data-panel-title="three"]');
  const cardThreeScrollBox = await cardThreeScroll.boundingBox();
  expect(cardThreeScrollBox).not.toBeNull();

  // Chromium/WebView2 仍把事件派给卡二，但当前鼠标坐标已经处于卡三真实滚动层。
  await page.evaluate(({ x, y }) => {
    const staleTarget = document.querySelector<HTMLElement>('[data-panel-scroll="two"]');
    staleTarget?.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      deltaY: 240,
    }));
  }, {
    x: cardThreeScrollBox!.x + cardThreeScrollBox!.width / 2,
    y: cardThreeScrollBox!.y + 100,
  });
  await expect.poll(() => cardThreeScroll.evaluate((element) => element.scrollTop)).toBe(240);
  expect(await cardTwoScroll.evaluate((element) => element.scrollTop)).toBe(0);

  await cardTwoScroll.evaluate((element) => { element.scrollTop = 0; });
  await cardThreeScroll.evaluate((element) => { element.scrollTop = 0; });
  const cardTwoTitleBox = await cardTwoTitle.boundingBox();
  const cardThreeTitleBox = await cardThreeTitle.boundingBox();
  expect(cardTwoTitleBox).not.toBeNull();
  expect(cardThreeTitleBox).not.toBeNull();

  // 同一帧先给卡二排队，再切到卡三；卡二尾帧必须被取消。
  await page.evaluate(({ two, three }) => {
    const staleTarget = document.querySelector<HTMLElement>('[data-panel-title="two"]');
    staleTarget?.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: two.x,
      clientY: two.y,
      deltaY: 160,
    }));
    staleTarget?.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: three.x,
      clientY: three.y,
      deltaY: 160,
    }));
  }, {
    two: {
      x: cardTwoTitleBox!.x + cardTwoTitleBox!.width / 2,
      y: cardTwoTitleBox!.y + cardTwoTitleBox!.height / 2,
    },
    three: {
      x: cardThreeTitleBox!.x + cardThreeTitleBox!.width / 2,
      y: cardThreeTitleBox!.y + cardThreeTitleBox!.height / 2,
    },
  });
  await expect.poll(() => cardThreeScroll.evaluate((element) => element.scrollTop)).toBe(160);
  expect(await cardTwoScroll.evaluate((element) => element.scrollTop)).toBe(0);
});
