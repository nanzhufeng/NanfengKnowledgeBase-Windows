# 南枫知识库当前交接

更新时间：2026-07-29

仓库：`C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence`

分支：`codex/nanfeng-knowledge-production-checkpoint-20260727`

本交接描述的代码基线：`b6cf5a6`

设计治理 checkpoint：`c8161e9`

最近功能 checkpoint：`b1d030a`

> 这是下一轮开发者的动态事实入口，不是历史复盘。稳定规则看 `AGENTS.md`，锁定设计看 `docs/core-workspace-design-baseline.md`，唯一下一步看 `docs/next-codex-prompt.md`。

## 1. 接手结论

1. 产品方向已经锁定为三个核心入口：`来源档案 / 主题结构 / 知识视图`。自动整理是默认前提，人工只处理低置信、冲突或无合适主题的例外。
2. migration v4 的命题、竞争假设、事实有效期、判断快照和决策账本对象已经实现；不要重新设计数据库或退回假数据原型。
3. 南烛枫确认的四张最终页面布局已固化，但最终 UI 尚未完成。当前代码仍是中间态，不能把“对象已实现、测试通过或皮肤完成”表述成核心工作区已落地。
4. 五套皮肤已经实现并锁定：`沙漠灯笼 / 花房 / 奔马 / 铜金发簪 / 原版浅色`。它们是视觉合同，不得改变产品对象、默认状态或页面模块。
5. 下一轮唯一任务是知识视图第一小步：默认 `竞争假设`，可切换 `判断演变`。另外两个入口暂不修改。

## 2. 冷启动读取顺序

下一轮只需先读：

1. `AGENTS.md`
2. `docs/CURRENT_HANDOFF.md`
3. `docs/next-codex-prompt.md`
4. `docs/core-workspace-design-baseline.md`
5. `docs/core-workspace-acceptance-matrix.md`

然后检查 `git status` 和最近提交。不要先扫描全部聊天、旧审计或历史原型。

## 3. 已锁定的产品与设计事实

### 3.1 三个核心入口

- `来源档案`：合并旧收录箱；统一展示已归类与待确认来源，只在例外项显示人工分类操作。
- `主题结构`：合并旧主题浏览器和整理工作台；领域/主题树为主体，高级结构维护默认折叠。
- `知识视图`：按 `领域 → 主题 → 命题/竞争假设` 阅读知识成果，笔记与来源作为证据关联。

旧 `全部记录 / 我的收藏 / 持续跟踪 / 判断更新 / 导入与导出` 仍是辅助入口，不得替代三个核心入口。

### 3.2 四张最终页面合同

仓库内锁定图：

- `docs/screenshots/final-core-workspace/knowledge-view-competing-hypotheses.png`
- `docs/screenshots/final-core-workspace/knowledge-view-judgment-evolution.png`
- `docs/screenshots/final-core-workspace/source-archive-final-layout.png`
- `docs/screenshots/final-core-workspace/topic-structure-final-layout.png`

锁定类别：

- A 产品/信息架构：已锁定；
- B 页面功能布局：已锁定；
- C 交互与状态：已锁定；
- D 五套皮肤：独立锁定；
- E 示例文字和示例数据：未锁定，仅用于表达布局；
- F 设计确认不等于 UI、BAT 或真实用户路径通过。

### 3.3 五套皮肤合同

- 四套场景皮肤使用清晰背景和局部冷珍珠白磨砂卡片；只模糊卡片下方背景，不模糊页面空白区。
- 卡片保持冷白承托，并保留淡绿、淡红、淡橙等语义层次，不随背景过度染色。
- 描边必须由卡片本体闭合绘制，不出现搜索框等组件的破边。
- `原版浅色`保留深蓝侧栏、冷灰工作区和白卡体系。
- 皮肤只能改视觉，不得改变模块、对象层级、默认状态或交互结果。

## 4. 当前真实实现

### 4.1 已实现

- 导航已包含 `来源档案 / 主题结构 / 知识视图`。
- Rust/SQLite 已提供来源档案轻量查询及知识对象读写。
- migration v4 已实现：
  - 普通命题与竞争假设；
  - 竞争假设组；
  - 命题置信度和推翻条件；
  - 命题/证据的确认日、有效截止日、复核日和有效状态；
  - Evidence、Judgment Snapshot 到 Proposition 的直接关联；
  - Decision Ledger 到 Proposition / Judgment Snapshot 的关联；
  - 风险、预期、行动、复核、结果和复盘字段。
- `KnowledgeWorkspace` 已能创建命题、绑定判断和证据、创建/编辑决策账本。
- 五套皮肤、设置页选择器和本地外观持久化已经实现。

### 4.2 当前 UI 与锁定设计的明确冲突

`src/components/KnowledgeWorkspace.tsx` 的知识视图当前仍以“建立领域与主题”的新增/编辑表单开场，并将较多维护表单直接铺在阅读路径中。锁定设计要求：

- 阅读成果优先，不以 CRUD 表单作为首屏主体；
- 默认进入 `竞争假设`；
- `判断演变`作为同一右侧主阅读区的切换状态；
- 保留窄中栏、细橙关联线、独立纵向滚动和底部横向时间线。

因此下一轮应重构知识视图的页面组织和状态，不应重写仓储层、迁移或分类架构。

来源档案和主题结构也仍是中间态，尚未达到各自最终布局图；它们排在知识视图之后，不属于下一轮小步。

## 5. 代码地图

| 位置 | 当前职责 | 下一轮边界 |
|---|---|---|
| `src/App.tsx` | 三入口导航、页面懒加载、五套皮肤状态与设置入口 | 只在知识视图切换需要时做最小接线 |
| `src/components/KnowledgeWorkspace.tsx` | 三个核心入口的主要 UI；当前为大型单文件组件 | 下一轮主要修改点；优先拆小型只读展示组件，避免继续堆叠 |
| `src/styles.css` | 核心工作区布局、滚动、关联线和皮肤覆盖 | 保留五套皮肤合同，只补最终知识视图布局 |
| `src/theme/knowledgeSkins.ts` | 五套皮肤唯一列表、默认值和 localStorage 持久化 | 保护，不改名单和语义 |
| `src/services/knowledgeRepository.ts` | 前端 Repository 门面；来源、命题、判断、证据、决策读写 | 复用现有接口，缺少真正必要的组合读取时才最小扩展 |
| `src-tauri/src/commands.rs` | Tauri 知识命令 | 非必要不改 |
| `src-tauri/src/knowledge/repository.rs` | Rust/SQLite 知识仓储与 migration v4 对象 | 保护现有模型，不重新架构 |
| `src-tauri/src/database.rs` | 数据库打开与迁移入口 | 不碰正式数据路径 |
| `tests/e2e/knowledge-evolution-prototype.spec.ts` | 旧原型测试 | 只能参考历史行为，不能作为最终 UI 基线 |
| `docs/core-workspace-design-baseline.md` | 四张页面与五套皮肤的锁定设计正文 | 实现必须逐项对照 |
| `docs/core-workspace-acceptance-matrix.md` | 设计、实现、测试、构建、BAT 和真实验收分层状态 | 每完成一层如实更新 |

## 6. 验证真相

以下是既有 checkpoint 留下的证据，本轮交接整理没有重新跑代码测试或构建：

| 层级 | 当前证据 |
|---|---|
| TypeScript | 既有 checkpoint 通过 |
| 前端单元/领域合同 | 82/82 |
| Rust/SQLite | 71/71 |
| migration v4 自动备份、完整性与幂等 | 临时文件库通过；尚未正式应用 |
| Vite 生产构建 | 既有 checkpoint 通过 |
| Windows Tauri `--no-bundle` | 既有 checkpoint 通过 |
| 五套皮肤浏览器切换 | 1584×1000 隔离浏览器通过 |
| 四张最终页面设计 | 已确认并固化 |
| 四张最终页面 UI 集成 | 未完成 |
| 最新最终布局 BAT | 不存在 |
| 最新最终布局真实桌面用户路径 | 未执行 |
| 安装包 / GitHub Release | 未执行，按南烛枫要求暂缓 |

自动测试、临时库验证、构建和浏览器截图均不能替代南烛枫的可见桌面 BAT 验收。

## 7. 正式数据与 BAT 边界

- 正式根：`D:\南枫知识库`
- 旧兼容根：`D:\南枫情报台`
- 已确认正式 migration：1、2、3
- migration v4 只在临时文件库验证，未声明正式应用。
- 首次正式应用 v4 前应由应用使用 SQLite online backup 创建迁移前备份；不得由 Codex 后台提前打开正式库触发。
- 当前 `启动南枫知识库-测试版.bat` 指向旧的五套皮肤构建 `.runtime-qa\knowledge-skins-v1-build\release\nanfeng-knowledge-base.exe`。
- 该 BAT 不包含四张最终页面布局，不能作为新布局验收证据，也不能冒充下一轮输出。
- 不安装 Inno Setup 7，不制作安装包，不上传 GitHub；只有南烛枫明确说“上传”时才处理正式 Release。

## 8. 未完成项与顺序

### P0：下一轮唯一任务

完成知识视图两个状态的第一段可验收闭环：

1. 默认 `竞争假设`；
2. 可切换 `判断演变`；
3. 复用现有 Repository 和 migration v4 对象；
4. 对照两张知识视图锁定图；
5. 保留窄中栏、细橙关联线、独立纵向滚动和底部横向时间线；
6. 保留五套皮肤；
7. 更新验收矩阵；
8. 通过最小充分验证后生成新的隔离 BAT，等待南烛枫可见验收。

达到上述边界后停止，不顺手修改另外两个入口。

### P1：后续任务，不在下一轮扩展

- 来源档案最终布局：自动整理结果、正文、关联命题和关键依据的阅读优先界面。
- 主题结构最终布局：主题边界、自动归类依据、层级关联、别名术语和结构建议。

### P2：在三页 UI 后处理

- 决策账本横向版本链与结果/复盘闭环的最终布局。
- 四张页面跨皮肤、滚动、关联线和窗口尺寸回归。
- 新 BAT 的正式数据首次 v4 迁移与真实桌面验收；必须由南烛枫明确发起。

## 9. 下一轮停止条件

知识视图两个状态完成代码集成、定向合同、必要 TypeScript/Rust 测试、`--no-bundle` 构建和新隔离 BAT 后停止，并分层报告：

- 设计已锁定；
- 代码已实现；
- 自动测试/构建通过；
- BAT 已生成但未验收；
- 南烛枫真实桌面已确认；
- 尚未验证或仍有风险。

## 10. Git 安全边界

- 不切回 `main`。
- 不 `reset --hard`、`clean`、`stash` 或覆盖未知改动。
- 开始修改前先确认工作区；遇到无关改动或无法安全拆分的耦合改动就停止说明。
- 本地 checkpoint 不等于 GitHub 已更新。
- 不推送远端；只有南烛枫明确说“上传”时才同步正式 Release。
