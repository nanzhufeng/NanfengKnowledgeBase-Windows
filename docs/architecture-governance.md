# 架构所有权

项目遵循根级 `docs/app-development/architecture-baseline.md`。阶段 1 UI 契约已冻结，以下所有者同时约束浏览器适配器与 Tauri/SQLite 生产链路。

| 概念 | 产品含义 | 唯一所有者 | 公开入口 | 当前消费者 | 禁止的平行规则 | 最小验证 | 状态 |
|---|---|---|---|---|---|---|---|
| 研究记录 | 判断、事实、证据、问题、行动、标签与来源的聚合根 | `src-tauri/src/database.rs` | `RecordRepository` | 列表、详情、搜索、版本、导入导出 | 页面直接 SQL；各页面复制记录状态 | Rust CRUD 测试 + 仓库契约 + 运行路径 | 已实现 |
| 当前判断编辑状态 | 阅读、编辑、自动保存和版本中的同一段判断 | `App` 选中记录与 `RecordRepository.updateRecord` | `DetailPanel` props | 判断卡、顶部保存状态、版本快照 | 页面局部另存草稿且不落库 | 自动保存后重读一致 | 已实现 |
| 页面导航状态 | 全部记录、导入、回收站和设置的当前位置 | `App` 的 `page` | `Sidebar.onNavigate` | 主区域页面选择 | 各页面自行修改侧栏状态 | 导航与可见页面一致 | 已实现 |
| 文件导入 | 原文件归档、哈希、解析预览、映射、去重和写入 | `src-tauri/src/importer.rs` | `RecordRepository.prepareImport/confirmImport` | 导入中心、导入日志 | UI 直接读取后无归档写库 | 原文件存在 + 哈希/日志/记录一致 | 已实现 |
| 交互反馈 | 收藏、复制、菜单、设置等按钮操作的统一可见结果 | `App` 的 `notice` | `onNotify` | 顶部菜单、记录操作、标签和详情 | 各按钮自行生成风格不一的临时提示 | 受影响按钮点击后产生一致反馈且自动消退 | 已实现 |
| 记录视图交互状态 | 搜索/标签预设、当前范围、来源筛选、排序、收藏与选中记录的联动 | `App` / `RecordRepository.listRecords` | 组件 props 与仓库查询 | 全部记录、持续跟踪、判断更新、标签菜单、详情标题 | 侧栏和列表各存一份业务状态 | 查询结果、计数、详情与收藏同步 | 已实现 |
| 数据目录与迁移 | 数据库、原文件、附件、导出、备份和日志的受控位置 | `src-tauri/src/paths.rs` / `database.rs` | Tauri commands | 设置、导入、备份恢复 | UI 拼接系统路径；启动时绕过迁移 | 重启后持久化 + integrity_check | 已实现 |
| 视觉与动效 Token | 颜色、阴影、时长、缓动与卡片层级 | `src/styles.css :root` 与 `.elevated-card` | 共享 CSS 类 | 全部卡片和控件 | 页面私建同类阴影与动效 | 对照稿和交互状态检查 | 已实现 |

## 入口矩阵

| 入口/消费者 | 是否存在 | 当前影响 | 唯一入口 | 最小验证 |
|---|---|---|---|---|
| 新建、复制、永久删除 | 是 | 受影响 | `RecordRepository` | CRUD、回收站与完整标题确认 |
| 编辑当前判断 | 是 | 受影响 | `DetailPanel` | 自动保存提示 |
| JSON/Markdown/TXT/HTML 文件导入 | 是 | 保真通道 | `src-tauri/src/importer.rs` | 原文件/哈希/日志/记录闭环 |
| 列表、详情、搜索 | 是 | 受影响 | `RecordRepository` | 搜索与选中、重启后一致 |
| 筛选、排序、收藏、分享、菜单 | 是 | 受影响 | `RecordList` / `RecordsWorkspace` / `App.onNotify` | 按钮逐项操作与状态同步 |
| 历史版本 | 是 | 受影响 | `RecordRepository` | 追加、预览、恢复为新版本 |
| 回收站 | 是 | 受影响 | `RecordRepository` | 删除、恢复、确认永久删除 |
| 导出、备份、恢复 | 是 | 受影响 | `src-tauri/src/transfer.rs` | 文件结果、完整性与恢复前安全备份 |
| 不同窗口与 DPI | 浏览器与桌面已验 | 受影响 | CSS 响应式规则 / Tauri 窗口 | 浏览器尺寸 + Windows 桌面壳 |
