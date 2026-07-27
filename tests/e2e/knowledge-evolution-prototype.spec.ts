import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("南枫知识库").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "收录箱" })).toBeVisible();
});

test("正式知识入口替代假数据原型", async ({ page }) => {
  await expect(page.getByText("来源先归档，再分类")).toBeVisible();
  await expect(page.getByText("收录箱已清空。新导入资料会自动进入这里。")).toBeVisible();
  await expect(page.getByText("假数据 · 不写数据库")).toHaveCount(0);
  await expect(page.getByText("结构验证原型")).toHaveCount(0);
});

test("主题浏览器在无桌面桥接时诚实显示空状态", async ({ page }) => {
  await page.getByRole("button", { name: /主题浏览器/ }).click();
  await expect(page.getByRole("heading", { name: "主题浏览器" })).toBeVisible();
  await expect(page.getByText("尚未建立正式领域。先创建一个领域，再添加主题。")).toBeVisible();
  await expect(page.getByText("AI 资本开支", { exact: true })).toHaveCount(0);
});

test("整理工作台展示正式的预览与确认结构", async ({ page }) => {
  await page.getByRole("button", { name: /整理工作台/ }).click();
  await expect(page.getByRole("heading", { name: "整理工作台" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "合并主题" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "拆分预览" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "关系建议" })).toBeVisible();
  await expect(page.getByText("预览在前、提交可撤销；所有结果来自正式知识表。")).toBeVisible();
  await expect(page.getByText("当前没有满足确定性门槛的关系候选。")).toBeVisible();
});

test("常见桌面尺寸保持正式工作区边界", async ({ page }) => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1702, height: 1066 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "收录箱" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);

    await page.getByRole("button", { name: /整理工作台/ }).click();
    await expect(page.getByRole("heading", { name: "整理工作台" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);
  }
});
