import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("南枫知识库", { exact: true })).toBeVisible();
  // Record 兼容工具归属“持续跟踪”等辅助入口；来源档案由最终三入口用例单独验收。
  await page.getByRole("button", { name: /持续跟踪/ }).click();
  await expect(page.locator(".records-workspace")).toBeVisible();
});

test("搜索、选择、收藏和长详情按需展示保持可操作", async ({ page }) => {
  const search = page.getByLabel("搜索记录");
  await search.fill("资本开支");
  await expect(page.locator(".list-result-summary")).toHaveAttribute("aria-label", /条记录/);
  await expect(page.locator(".record-card").first()).toBeVisible();
  await page.locator(".record-card").first().click();
  await expect(page.locator(".detail-panel h1")).toContainText("资本开支");
  await page.getByRole("button", { name: /查看完整内容/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  const favorite = page.locator(".detail-title-actions").getByLabel("收藏");
  await favorite.click();
  await expect(page.getByText("已加入收藏")).toBeVisible();
  await page.getByRole("button", { name: /我的收藏/ }).click();
  await expect(page.locator(".record-card")).toHaveCount(1);
});

test("快捷键设置使用独立的紧凑比例和两列信息布局", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "nanfeng-knowledge-base:dialog-size:default",
      JSON.stringify({ width: 1_240, height: 860 }),
    );
  });
  await page.getByRole("button", { name: /设置/ }).click();
  await page.locator(".settings-row").filter({ hasText: "快捷键" }).click();

  const dialog = page.getByRole("dialog", { name: "快捷键" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveClass(/shortcut-settings-dialog/);
  await expect(dialog.getByText("6 项常用快捷操作", { exact: true })).toBeVisible();
  await expect(dialog.locator(".shortcut-list > div")).toHaveCount(6);
  await expect(dialog.locator(".shortcut-list")).toHaveCSS("grid-template-columns", /\d+px \d+px/);
  await dialog.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });

  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(720);
  expect(box!.width).toBeLessThanOrEqual(820);
  expect(box!.height).toBeGreaterThanOrEqual(380);
  expect(box!.height).toBeLessThanOrEqual(560);
  expect(Math.abs(box!.x - (1702 - box!.width) / 2)).toBeLessThan(3);
  expect(Math.abs(box!.y - (1066 - box!.height) / 2)).toBeLessThan(3);

  await page.screenshot({
    path: resolve(".runtime-qa", "settings-shortcuts-1702x1066.png"),
    fullPage: false,
  });

  await page.setViewportSize({ width: 1280, height: 720 });
  const compactBox = await dialog.boundingBox();
  expect(compactBox).not.toBeNull();
  expect(compactBox!.width).toBeGreaterThanOrEqual(720);
  expect(compactBox!.width).toBeLessThanOrEqual(820);
  expect(compactBox!.height).toBeLessThanOrEqual(656);
  expect(Math.abs(compactBox!.x - (1280 - compactBox!.width) / 2)).toBeLessThan(3);
  expect(Math.abs(compactBox!.y - (720 - compactBox!.height) / 2)).toBeLessThan(3);
  await page.screenshot({
    path: resolve(".runtime-qa", "settings-shortcuts-1280x720.png"),
    fullPage: false,
  });
});

test("当前判断自动保存并在刷新后恢复", async ({ page }) => {
  await page.locator(".record-card").first().click();
  await expect(page.locator(".detail-panel h1")).toBeVisible();
  await page.locator(".judgment-card").getByRole("button", { name: /编辑/ }).click();
  const textarea = page.locator(".judgment-card textarea");
  const value = `自动保存验收 ${Date.now()}`;
  await textarea.fill(value);
  await expect(page.getByText("正在保存草稿…")).toBeVisible();
  await expect(page.getByText("本地草稿已保存")).toBeVisible({ timeout: 5_000 });
  await page.reload();
  await page.getByRole("button", { name: /持续跟踪/ }).click();
  await expect(page.getByText(value)).toBeVisible();
});

test("异常刷新前的未提交判断从本机草稿恢复", async ({ page }) => {
  await page.locator(".record-card").first().click();
  await expect(page.locator(".detail-panel h1")).toBeVisible();
  await page.locator(".judgment-card").getByRole("button", { name: /编辑/ }).click();
  const value = `崩溃草稿恢复 ${Date.now()}`;
  await page.locator(".judgment-card textarea").fill(value);
  await expect(page.getByText("正在保存草稿…")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /持续跟踪/ }).click();
  await expect(page.getByText(value)).toBeVisible();
  await expect(page.getByText(/已恢复异常退出前的本地草稿/).first()).toBeVisible();
});

test("导入字段映射支持边界、模板和重复策略", async ({ page }) => {
  await page.getByRole("button", { name: /设置/ }).click();
  await page.getByText("数据与存储", { exact: true }).click();
  await page.getByRole("button", { name: /打开批量导入与导出/ }).click();
  await page.getByRole("button", { name: /载入浏览器示例/ }).click();
  await expect(page.getByText("批量导入队列")).toBeVisible();
  await expect(page.getByText(/1 个文件 · 预计 1 条记录/)).toBeVisible();
  await expect(page.getByText("识别完成")).toBeVisible();
  await page.getByRole("button", { name: /单独检查字段映射/ }).click();
  await expect(page.getByText("记录边界")).toBeVisible();
  await expect(page.getByText("相似候选处理", { exact: true })).toBeVisible();

  await page.getByPlaceholder("模板名称").fill("E2E 映射模板");
  await page.getByRole("button", { name: /保存模板/ }).click();
  await expect(page.getByText(/映射模板“E2E 映射模板”已保存在本机/)).toBeVisible();
  await page.getByRole("button", { name: /确认导入/ }).click();
  await expect(page.getByText(/浏览器映射演示完成/)).toBeVisible();
});

test("选中联动为纯橙色且快速定位不改变当前记录", async ({ page }) => {
  const first = page.locator(".record-card").first();
  await first.click();
  await expect(first).toHaveClass(/selected/);
  await expect(first).toHaveCSS("border-color", "rgb(255, 106, 46)");
  await expect(first).toHaveCSS("border-right-width", "1px");
  await expect(first).toHaveCSS("background-image", "none");
  expect(await first.evaluate((element) => getComputedStyle(element, "::after").display)).toBe("none");
  await expect(page.locator(".record-content-card")).not.toHaveCSS(
    "border-left-color",
    "rgb(255, 104, 31)",
  );
  expect(await page.locator(".detail-panel").evaluate(
    (element) => getComputedStyle(element).boxShadow,
  )).not.toContain("255, 106, 46");
  await expect(page.locator(".record-detail-connector")).toHaveCSS(
    "background-image",
    /linear-gradient/,
  );
  await expect(page.locator(".quick-locator")).toContainText("/");
  const selectedTitle = await page.locator(".detail-panel h1").textContent();
  const locator = page.getByLabel("拖动快速定位记录");
  await locator.fill(await locator.getAttribute("max") ?? "1");
  await expect(first).toHaveClass(/selected/);
  await expect(page.locator(".detail-panel h1")).toHaveText(selectedTitle ?? "");
});

test("列表查看详情会直接打开完整内容", async ({ page }) => {
  const first = page.locator(".record-card").first();
  await first.click();
  await first.getByLabel("更多").click();
  await page.getByRole("menuitem", { name: "查看详情", exact: true }).click();
  await expect(page.locator(".source-content-dialog")).toBeVisible();
});

test("完整内容使用稳定的大尺寸 Obsidian 阅读布局", async ({ page }) => {
  await page.locator(".record-card").first().click();
  await page.getByRole("button", { name: /查看完整内容/ }).click();
  const dialog = page.locator(".source-content-dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual((viewport?.width ?? 0) * 0.82);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual((viewport?.height ?? 0) * 0.82);
  const messageContent = dialog.locator(".source-message > .markdown-content").first();
  await expect(messageContent).toHaveCSS("display", "block");
});

test("导出完整笔记并支持点击遮罩关闭弹窗", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "nanfeng-knowledge-base:dialog-size:share-record-dialog-v2",
      JSON.stringify({ width: 980, height: 680 }),
    );
  });
  const recordCard = page.locator(".record-card").first();
  await recordCard.hover();
  const exportNoteButton = recordCard.getByLabel("导出完整笔记");
  await expect(exportNoteButton).toBeVisible();
  await exportNoteButton.click();
  const dialog = page.getByRole("dialog", { name: /AI资本开支/ });
  await expect(dialog).toBeVisible();
  await dialog.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual((viewport?.width ?? 0) * 0.84);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual((viewport?.height ?? 0) * 0.88);
  await expect(dialog.getByRole("heading", { name: "当前判断", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /导出 Markdown/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /导出 DOCX/ })).toBeVisible();
  const footnote = dialog.locator(":scope > .dialog-footnote");
  await expect(footnote).toBeVisible();
  const footnoteBox = await footnote.boundingBox();
  expect((footnoteBox?.y ?? Number.POSITIVE_INFINITY) + (footnoteBox?.height ?? 0))
    .toBeLessThanOrEqual((box?.y ?? 0) + (box?.height ?? 0) - 20);
  expect(await dialog.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: resolve(".runtime-qa", "share-record-dialog-1702x1066.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  const compactBox = await dialog.boundingBox();
  const compactFootnoteBox = await footnote.boundingBox();
  expect(compactBox?.width ?? 0).toBeGreaterThanOrEqual(1280 * 0.88);
  expect(compactBox?.height ?? 0).toBeGreaterThanOrEqual(720 * 0.88);
  expect((compactFootnoteBox?.y ?? Number.POSITIVE_INFINITY) + (compactFootnoteBox?.height ?? 0))
    .toBeLessThanOrEqual((compactBox?.y ?? 0) + (compactBox?.height ?? 0) - 20);
  expect(await dialog.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: resolve(".runtime-qa", "share-record-dialog-1280x720.png"),
    fullPage: false,
  });
  const markdownShadow = await dialog.getByRole("button", { name: /导出 Markdown/ }).evaluate(
    (element) => getComputedStyle(element).boxShadow,
  );
  const docxShadow = await dialog.getByRole("button", { name: /导出 DOCX/ }).evaluate(
    (element) => getComputedStyle(element).boxShadow,
  );
  expect(docxShadow).toBe(markdownShadow);
  const markdownDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: /导出 Markdown/ }).click();
  const markdownDownload = await markdownDownloadPromise;
  expect(markdownDownload.suggestedFilename()).toMatch(/\.md$/i);
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: /导出 DOCX/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.docx$/i);
  await page.locator(".prototype-dialog-backdrop").click({ position: { x: 8, y: 8 } });
  await expect(dialog).toBeHidden();
});

test("导出页支持范围、格式和 Vault 选项", async ({ page }) => {
  await page.getByRole("button", { name: /设置/ }).click();
  await page.getByText("数据与存储", { exact: true }).click();
  await page.getByRole("button", { name: /打开批量导入与导出/ }).click();
  await page.locator(".data-exchange-tabs").getByRole("button", { name: "导出", exact: true }).click();
  await expect(page.getByText("导出范围", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /手动多选/ }).click();
  await expect(page.locator(".export-record-picker input[type=checkbox]").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Obsidian Vault/ })).toBeVisible();
  await expect(page.getByText(/Codex \+ Obsidian 工作流/)).toBeVisible();
  await expect(page.getByRole("button", { name: /创建完整备份/ })).toHaveCount(0);
});

test("设置将完整备份和数据库高级维护分层", async ({ page }) => {
  await page.getByRole("button", { name: /设置/ }).click();
  await page.getByText("数据与存储", { exact: true }).click();

  await expect(page.getByText("备份与恢复", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /创建完整备份/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /恢复完整备份/ })).toBeVisible();

  const advanced = page.locator("details.settings-advanced-maintenance");
  await expect(advanced).not.toHaveAttribute("open", "");
  await expect(page.getByRole("button", { name: /创建数据库快照/ })).toBeHidden();
  await advanced.locator("summary").click();
  await expect(page.getByRole("button", { name: /创建数据库快照/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /从数据库快照恢复/ })).toBeVisible();
});

test("数据交换返回上一级并恢复大尺寸可调节存储窗口", async ({ page }) => {
  await page.setViewportSize({ width: 1702, height: 1066 });
  await page.getByRole("button", { name: /设置/ }).click();
  await page.getByText("数据与存储", { exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "数据与存储" });
  await expect(dialog).toBeVisible();
  const initialBox = await dialog.boundingBox();
  expect(initialBox?.width).toBeGreaterThanOrEqual(1000);
  expect(initialBox?.height).toBeGreaterThanOrEqual(720);
  await expect(dialog.locator(".prototype-dialog-resize-handle")).toBeVisible();

  await page.getByRole("button", { name: /打开批量导入与导出/ }).click();
  await expect(page.getByRole("button", { name: /返回上一级/ })).toBeVisible();
  await page.getByRole("button", { name: /返回上一级/ }).click();
  await expect(page.getByRole("dialog", { name: "数据与存储" })).toBeVisible();
});

test("完整编辑器保留并可管理多来源", async ({ page }) => {
  await page.locator(".record-card").first().click();
  await expect(page.locator(".detail-panel h1")).toBeVisible();
  await page.getByLabel("编辑记录").click();
  await expect(page.getByText("来源管理", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /添加来源/ }).click();
  await expect(page.locator(".source-editor-row")).toHaveCount(2);
  await page.locator(".source-editor-row").nth(1).getByText("标题").locator("..").getByRole("textbox").fill("补充来源");
  await expect(page.getByText("编辑已自动保存")).toBeVisible({ timeout: 5_000 });
});

test("1366x768 主工作区无页面级横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.reload();
  await page.getByRole("button", { name: /持续跟踪/ }).click();
  await expect(page.locator(".records-workspace")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.locator(".records-list")).toHaveCSS("overflow-y", "auto");
  await expect(page.locator(".detail-panel")).toHaveCSS("overflow-y", "auto");
});

test("100%、150%、200% DPI 与常见桌面尺寸保持布局边界", async ({ browser }) => {
  const cases = [
    { width: 1366, height: 768, scale: 1 },
    { width: 1440, height: 900, scale: 1.5 },
    { width: 1920, height: 1080, scale: 2 },
  ];
  for (const item of cases) {
    const context = await browser.newContext({
      viewport: { width: item.width, height: item.height },
      deviceScaleFactor: item.scale,
    });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByText("南枫知识库", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /持续跟踪/ }).click();
    await expect(page.locator(".records-workspace")).toBeVisible();
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      root: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(overflow.body).toBeLessThanOrEqual(1);
    expect(overflow.root).toBeLessThanOrEqual(1);
    await expect(page.locator(".records-list")).toHaveCSS("overflow-y", "auto");
    await expect(page.locator(".detail-panel")).toHaveCSS("overflow-y", "auto");
    await context.close();
  }
});
