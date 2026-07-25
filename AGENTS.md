# 南枫情报台项目规则

- 默认使用简体中文，称呼用户“南烛枫”，结论在前。
- 项目根目录：`C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence`。
- 核心任务：把研究判断、证据、待验证问题、行动和版本放入同一条本地可追溯记录。
- 通用架构遵循 `C:\Users\Administrator\Documents\软件开发\docs\app-development\architecture-baseline.md`，项目只记录自身事实和明确例外。
- 每轮开始先读 `docs/CURRENT_HANDOFF.md`；产品边界读 `docs/product-brief.md`；概念所有权读 `docs/architecture-governance.md`。

## 当前阶段边界

- 当前是阶段 1：React + TypeScript 假数据 UI 原型。
- 允许修改：`src/`、项目文档、测试与截图。
- 禁止：真实数据库、API、云同步、模型调用、真实文件写入和过度领域架构。
- `.openai/hosting.json`、`worker/index.js`、`scripts/prepare-sites-build.mjs`、`tests/sites-worker.test.mjs` 是原型运行时文件，除非交付链路变化，否则保持完整。

## 已确认视觉契约

- 单一全高深普鲁士蓝左栏，不增加重复侧栏。
- 冷灰工作区、白色信息卡、深蓝主文字；红/橙/绿只承担判断、问题、事实等语义。
- 所有卡片都有统一向下投影；悬停上移约 2 px 并增强投影，按下缩放约 0.985，选中状态使用稳定描边与更深底部阴影。
- 中栏选中记录和详情仅用 1 px 细线与小锚点表达关联，不使用抢眼曲线。
- 高频动效控制在 100–240 ms，并支持 `prefers-reduced-motion`。
- 唯一视觉参考：`docs/screenshots/reference-final-direction.png`。

## 常用验证

```powershell
npm run typecheck
npm run build
npm run test:sites
```
