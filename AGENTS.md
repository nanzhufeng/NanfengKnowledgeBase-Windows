# 南枫知识库项目规则

- 默认使用简体中文，称呼用户“南烛枫”，结论在前。
- 项目根目录：`C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence`。
- 核心任务：把零散来源经过可解释、可确认、可撤销的分类，沉淀为有主题层级、关系、证据和判断时间线的长期知识结构。
- 通用架构遵循 `C:\Users\Administrator\Documents\软件开发\docs\app-development\architecture-baseline.md`，项目只记录自身事实和明确例外。
- 每轮开始先读 `docs/CURRENT_HANDOFF.md`；最高产品规格读 `docs/南枫知识库_产品定义与自动分类主规格.md`；产品边界读 `docs/product-brief.md`；概念所有权读 `docs/architecture-governance.md`。
- 涉及三个核心入口、页面布局或皮肤时，必须读取 `docs/core-workspace-design-baseline.md` 与 `docs/core-workspace-acceptance-matrix.md`。四张最终页面图锁定产品组织、功能布局和交互状态，五套皮肤锁定视觉层；两类基准相互独立，除非南烛枫明确提出新方向，不得遗漏、互换或重新设计。

## 当前阶段边界

- 当前阶段是正式知识生产链路接入。假数据原型不再作为应用入口；收录箱、主题、分类确认、撤销、判断、证据、问题和上下文必须通过 Rust/SQLite 正式仓库。
- 南烛枫已于 2026-07-27 分别授权并完成正式 `D:\南枫知识库` migration v3、可见 BAT 与本地 NSIS 安装生命周期验收；完整备份、复开幂等、完整性、外键和数据保留证据见 `docs/CURRENT_HANDOFF.md`。这些授权不延续为新的正式数据写入、重复 migration、后续安装或发布授权。
- `src-tauri/src/knowledge/legacy_preview.rs` 继续只负责只读 dry-run；生产写入统一由 `src-tauri/src/knowledge/repository.rs` 和 `database::apply_migrations` 负责。
- 桌面技术栈为 Tauri 2 + React/TypeScript + Rust + SQLite；来源档案经 `src/services/recordRepository.ts`，知识结构经 `src/services/knowledgeRepository.ts`，数据库规则由 `src-tauri/src/database.rs` 与 `src-tauri/src/knowledge/repository.rs` 共同持有。
- 允许修改：`src/`、`src-tauri/`、项目文档、测试、构建与安装配置。
- 不引入云同步、模型 API、遥测或未经确认的外部联网；导入先归档原文件再解析，恢复前必须先保护当前数据库。
- 浏览器仓库只用于视觉与组件契约验证，不代表桌面生产数据真相。
- 现有 `Record` 聚合保留为来源档案兼容层，不扩充为全部知识概念；新建和导入后由数据库唯一入口同步生成独立 `Source Item`。
- `.openai/hosting.json`、`worker/index.js`、`scripts/prepare-sites-build.mjs`、`tests/sites-worker.test.mjs` 是原型运行时文件，除非交付链路变化，否则保持完整。

## 已确认视觉契约

- 软件固定提供五套皮肤：`沙漠灯笼 / 花房 / 奔马 / 铜金发簪 / 原版浅色`；不得用其他背景替换或把冰棒等未确认方案混入正式列表。
- 四套场景皮肤保持背景原图清晰，仅在侧栏、搜索框、列表卡、详情主卡和内部信息卡覆盖区域使用冷白半透明磨砂；空白背景区域不得整体模糊或人为加深。
- 磨砂卡片使用冷珍珠白承托、闭合连续描边和分层透明度，保留不同语义卡的淡绿、淡红、淡橙层次；不得让背景综合色严重染入卡片，也不得出现边框破口。
- `原版浅色`保留单一全高深普鲁士蓝左栏、冷灰工作区和白色信息卡，不增加重复侧栏。
- 深蓝主文字；红/橙/绿只承担判断、问题、事实等语义。
- 所有卡片都有统一向下投影；悬停上移约 2 px 并增强投影，按下缩放约 0.985，选中状态使用稳定描边与更深底部阴影。
- 中栏选中记录和详情仅用 1 px 细线与小锚点表达关联，不使用抢眼曲线。
- 高频动效控制在 100–240 ms，并支持 `prefers-reduced-motion`。
- 布局与组件参考：`docs/screenshots/reference-final-direction.png`；皮肤与磨砂效果以设置页的五套固定皮肤和 `src/theme/knowledgeSkins.ts` 为准。
- 核心页面最终功能布局以 `docs/screenshots/final-core-workspace/` 四张图和 `docs/core-workspace-design-baseline.md` 为准；旧原型、旧实现截图和皮肤预览不得覆盖该功能布局。

## 常用验证

```powershell
npm run typecheck
npm test
npm run build
npm run test:sites
cargo test --manifest-path src-tauri/Cargo.toml
npx tauri build
```
