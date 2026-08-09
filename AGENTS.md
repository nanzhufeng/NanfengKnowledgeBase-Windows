# 南枫知识库项目规则

- 默认使用简体中文，称呼用户“南烛枫”，结论在前。
- 项目根目录：`C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence`。
- 核心任务：把零散来源经过可解释、可确认、可撤销的分类，沉淀为有主题层级、关系、证据和判断时间线的长期知识结构。
- 通用架构遵循 `C:\Users\Administrator\Documents\软件开发\docs\app-development\architecture-baseline.md`，项目只记录自身事实和明确例外。
- 每轮开始先读 `docs/CURRENT_HANDOFF.md`；最高产品规格读 `docs/南枫知识库_产品定义与自动分类主规格.md`；产品边界读 `docs/product-brief.md`；概念所有权读 `docs/architecture-governance.md`。
- 涉及三个核心入口、页面布局或皮肤时，必须读取 `docs/core-workspace-design-baseline.md` 与 `docs/core-workspace-acceptance-matrix.md`。四张最终页面图锁定产品组织、功能布局和交互状态，四套皮肤锁定视觉层；两类基准相互独立，除非南烛枫明确提出新方向，不得遗漏、互换或重新设计。
- 本项目供其他软件复用的唯一开发设计入口是`docs/design-system.md`。南烛枫说“参考南枫知识库的开发文档”时，默认继承该文件规定的材质角色、布局、交互、平台适配、自然语言反馈和验收方法；项目业务、固定尺寸、背景图、数据模型、BAT和历史版本默认不外带。

## 当前阶段边界

- 当前阶段是正式知识生产链路接入。假数据原型不再作为应用入口；收录箱、主题、分类确认、撤销、判断、证据、问题和上下文必须通过 Rust/SQLite 正式仓库。
- 南烛枫已于 2026-07-27 分别授权并完成正式 `D:\南枫知识库` migration v3、可见 BAT 与本地 NSIS 安装生命周期验收；完整备份、复开幂等、完整性、外键和数据保留证据见 `docs/CURRENT_HANDOFF.md`。这些授权不延续为新的正式数据写入、重复 migration、后续安装或发布授权。
- `src-tauri/src/knowledge/legacy_preview.rs` 继续只负责只读 dry-run；生产写入统一由 `src-tauri/src/knowledge/repository.rs` 和 `database::apply_migrations` 负责。
- 桌面技术栈为 Tauri 2 + React/TypeScript + Rust + SQLite；用户入口统一称为`主题洞察 / 全部笔记 / 主题管理`。`sources / knowledge / Record`等旧称只允许作为代码兼容标识，经 `src/services/recordRepository.ts` 与 `src/services/knowledgeRepository.ts` 接入；不得反向恢复为用户可见名称。
- 允许修改：`src/`、`src-tauri/`、项目文档、测试、构建与安装配置。
- 不引入云同步、模型 API、遥测或未经确认的外部联网；导入先归档原文件再解析，恢复前必须先保护当前数据库。
- 浏览器仓库只用于视觉与组件契约验证，不代表桌面生产数据真相。
- 现有 `Record` 聚合保留为全部笔记的兼容层，不扩充为全部知识概念；新建和导入后由数据库唯一入口同步生成独立 `Source Item`。
- `.openai/hosting.json`、`worker/index.js`、`scripts/prepare-sites-build.mjs`、`tests/sites-worker.test.mjs` 是原型运行时文件，除非交付链路变化，否则保持完整。

## 已确认视觉契约

- 软件固定提供四套皮肤：`沙漠灯笼 / 花房 / 奔马 / 原版浅色`；`铜金发簪`已由南烛枫明确移除，不得恢复或用其他背景替补。
- 三套场景皮肤保持背景原图清晰，仅在侧栏、搜索框、列表卡、详情主卡和内部信息卡覆盖区域使用冷白半透明磨砂；空白背景区域不得整体模糊或人为加深。
- 磨砂卡片使用低色度冷珍珠白承托和分层透明度，保留不同语义卡的淡绿、淡红、淡橙层次。中性玻璃边缘必须随背景明暗低对比渐退，禁止连续等亮白线、闭环白描边和统一渐变描边；只有选中、焦点、警告等明确语义状态可以使用完整状态边界。不得让背景综合色严重染入卡片，也不得出现裁切破口。
- `原版浅色`保留深普鲁士蓝左栏、冷灰工作区和白色信息卡；外层留白、圆角、栏位起点和内部间距与三套场景皮肤共用同一几何，不增加重复侧栏。
- 深蓝主文字；红/橙/绿只承担判断、问题、事实等语义。
- 紧凑小卡统一消费`NF-MICRO-CARD-LIFT-01`：操作卡使用`data-card-interaction="lift"`并保留按压回落，纯阅读小卡使用`surface-lift`且不得伪装按压。角色只挂在每张最深层独立小卡，禁止挂给网格/链路/父容器或嵌套消费；悬浮一张时兄弟卡和外层必须静止。仅精细指针悬停上移约2px并增强底部投影，键盘焦点只增强投影/焦点环；大面板、连续正文、表单和纯承托层不抬升。选中态继续使用稳定描边与更深底部阴影，动效不得改写皮肤材质、透明度、渐变或既有横向定位。
- 中栏选中记录和详情仅用 1 px 细线与小锚点表达关联，不使用抢眼曲线。
- 高频动效控制在 100–240 ms，并支持 `prefers-reduced-motion`。
- 布局与组件参考：`docs/screenshots/reference-final-direction.png`；皮肤与磨砂效果以设置页的四套固定皮肤和 `src/theme/knowledgeSkins.ts` 为准。
- 核心页面最终功能布局以 `docs/screenshots/final-core-workspace/` 四张图和 `docs/core-workspace-design-baseline.md` 为准；旧原型、旧实现截图和皮肤预览不得覆盖该功能布局。
- 所有面向南烛枫的主预览窗口、前后对比和最终视觉验收统一使用 `1702×1066` CSS px、浏览器缩放 `100%`、device scale factor `1`；主题、数据、状态和裁切也必须一致。Codex 右侧/底部分栏与 `1280×720` 等临时视口只允许排查或专项响应式测试，必须明确标注“非对比证据”，不得作为完成截图或交付窗口；除非南烛枫明确要求分栏，预览必须打开在主浏览器表面。

## 常用验证

- 每次完成面向用户可见的功能或布局改动，默认同步新增或更新一个项目根目录下的中文双击验收 BAT，不再等待南烛枫另行提醒。BAT 必须调用唯一 PowerShell 启动器，支持`--prepare`隔离构建和`--verify`只读校验；Codex只执行这两个安全参数，默认双击启动正式数据的动作留给南烛枫本人。

```powershell
npm run typecheck
npm test
npm run build
npm run test:sites
cargo test --manifest-path src-tauri/Cargo.toml
npx tauri build
```
