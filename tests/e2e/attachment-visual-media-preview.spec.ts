import { expect, test, type Locator } from "@playwright/test";

async function expectCentered(stage: Locator, media: Locator) {
  const stageBox = await stage.boundingBox();
  const mediaBox = await media.boundingBox();
  expect(stageBox).not.toBeNull();
  expect(mediaBox).not.toBeNull();
  expect(Math.abs((mediaBox!.x + mediaBox!.width / 2) - (stageBox!.x + stageBox!.width / 2))).toBeLessThan(2);
  expect(Math.abs((mediaBox!.y + mediaBox!.height / 2) - (stageBox!.y + stageBox!.height / 2))).toBeLessThan(2);
}

test("视频复用图片的暗色媒体舞台、居中适配和鼠标视口状态", async ({ page }) => {
  await page.goto("/tests/visual/attachment-preview.html?kind=video");

  const dialog = page.locator(".attachment-preview-visual-media");
  const stage = page.locator(".attachment-preview-stage.is-visual-media");
  const video = page.locator(".attachment-media-viewport > video");
  await expect(dialog).toBeVisible();
  await expect(video).toBeVisible();

  const dialogBox = await dialog.boundingBox();
  const stageBox = await stage.boundingBox();
  const videoBox = await video.boundingBox();
  expect(dialogBox?.width).toBeGreaterThan(1680);
  expect(dialogBox?.height).toBeGreaterThan(1040);
  await expectCentered(stage, video);
  expect(videoBox!.width).toBeGreaterThan(1500);

  await expect(stage).toHaveCSS("background-color", "rgb(8, 12, 18)");
  await expect(video).toHaveCSS("background-color", "rgb(0, 0, 0)");

  const initialTransform = await video.evaluate((element) => element.style.transform);
  await stage.evaluate((element, coordinates) => element.dispatchEvent(new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    deltaY: -120,
    clientX: coordinates.x,
    clientY: coordinates.y,
  })), {
    x: stageBox!.x + stageBox!.width * 0.7,
    y: stageBox!.y + stageBox!.height * 0.35,
  });
  await expect.poll(() => video.evaluate((element) => element.style.transform)).not.toBe(initialTransform);

  const panHandle = page.getByRole("button", { name: "拖动视频画面" });
  await expect(panHandle).toBeVisible();
  const viewport = page.locator(".attachment-media-viewport");
  const beforeNativeDrag = await viewport.evaluate((element) => element.style.transform);
  await page.mouse.move(videoBox!.x + videoBox!.width / 2, videoBox!.y + videoBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(videoBox!.x + videoBox!.width / 2 + 80, videoBox!.y + videoBox!.height / 2 + 40);
  await page.mouse.up();
  await expect.poll(() => viewport.evaluate((element) => element.style.transform)).toBe(beforeNativeDrag);

  const handleBox = await panHandle.boundingBox();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2 + 60, handleBox!.y + handleBox!.height / 2 + 35);
  await page.mouse.up();
  await expect.poll(() => viewport.evaluate((element) => element.style.transform)).not.toBe(beforeNativeDrag);

  await page.getByRole("button", { name: "适合屏幕" }).click();
  await expect.poll(() => video.evaluate((element) => element.style.transform)).toBe(initialTransform);
  await expect(panHandle).toBeHidden();
  await expectCentered(stage, video);
});

test("竖屏视频在150%与200%缩放下保持居中完整，并可明确适配", async ({ browser }) => {
  for (const deviceScaleFactor of [1.5, 2]) {
    const context = await browser.newContext({ viewport: { width: 1702, height: 1066 }, deviceScaleFactor });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4175/tests/visual/attachment-preview.html?kind=video&ratio=portrait");
    const stage = page.locator(".attachment-preview-stage.is-visual-media");
    const video = page.locator(".attachment-media-viewport > video");
    await expect(video).toBeVisible();
    const stageBox = await stage.boundingBox();
    const videoBox = await video.boundingBox();
    expect(videoBox!.height).toBeGreaterThan(videoBox!.width);
    expect(videoBox!.height).toBeLessThanOrEqual(stageBox!.height - 38);
    await expectCentered(stage, video);
    await page.keyboard.down("Control");
    await page.mouse.move(stageBox!.x + stageBox!.width / 2, stageBox!.y + stageBox!.height / 2);
    await page.mouse.wheel(0, -120);
    await page.keyboard.up("Control");
    await page.getByRole("button", { name: "适合屏幕" }).click();
    await expectCentered(stage, video);
    await context.close();
  }
});

test("多文档目录完整挂载，但只为可视范围创建预览资源", async ({ page }) => {
  await page.goto("/tests/visual/attachment-preview.html?kind=bounded");
  await expect(page.locator(".source-document-attachment")).toHaveCount(48);
  await expect.poll(() => page.locator(".source-document-attachment iframe").count()).toBeGreaterThan(0);
  const initialLoaded = await page.locator(".source-document-attachment iframe").count();
  expect(initialLoaded).toBeLessThan(48);
  await page.getByTestId("bounded-scroll").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => page.locator(".source-document-attachment iframe").count()).toBeGreaterThan(initialLoaded);
  expect(await page.locator(".source-document-attachment").count()).toBe(48);
});
