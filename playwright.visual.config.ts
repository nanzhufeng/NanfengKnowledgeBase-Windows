import { defineConfig } from "@playwright/test";

/** 视觉隔离页由 Vite 开发服务器直接提供，不把验收 harness 打进正式产物。 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "attachment-visual-media-preview.spec.ts",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4175",
    headless: true,
    viewport: { width: 1702, height: 1066 },
    launchOptions: {
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    },
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4175",
    url: "http://127.0.0.1:4175/tests/visual/attachment-preview.html",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
