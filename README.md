# 南枫情报台

本地优先的 Windows 研究档案与判断版本库。桌面端使用 Tauri 2、React/TypeScript、Rust、SQLite/FTS5；核心记录、来源、原始文件、版本与备份均保存在本机。

## 已实现

- 记录全字段新建、编辑、复制、收藏、状态和标签管理。
- 当前判断自动保存；版本追加、只读预览和“恢复为新版本”。
- 回收站恢复；仅允许用完整标题确认永久删除。
- 中文搜索：FTS5 trigram，1–2 字关键词回退到 LIKE；筛选、排序和命中高亮。
- JSON、Markdown、TXT、HTML 文件选择/拖入，原文件先归档，再计算 SHA-256、预览、映射、查重和写入导入日志。
- 单条 Markdown/JSON、全量 JSON 导出。
- SQLite 一致性备份；恢复前自动安全备份并校验恢复结果。
- 深色单侧栏、冷灰工作区、白色卡片、底部阴影、克制动效和低调关联线。

浏览器运行使用本地演示适配器，便于 UI 调试；正式桌面数据只由 Rust/SQLite 链路持有。

## 本地开发

```powershell
npm install
npm run tauri:dev
```

只检查浏览器界面：

```powershell
npm run dev -- --port 4173
```

## 验证与打包

```powershell
npm run typecheck
npm test
npm run build
npm run test:sites
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

NSIS 安装包输出到 `src-tauri/target/release/bundle/nsis/`。

## 文档入口

- [产品边界](docs/product-brief.md)
- [架构所有权](docs/architecture-governance.md)
- [依赖说明](docs/DEPENDENCIES.md)
- [设计系统](docs/design-system.md)
- [当前交接](docs/CURRENT_HANDOFF.md)
- [视觉 QA](design-qa.md)

## 当前边界

- 不依赖云数据库、模型 API 或遥测服务。
- 浏览器适配器不读写真实文件；文件系统、导入、导出和备份能力仅在 Tauri 桌面端启用。
- 当前版本不实现行动项完成状态、系统通知或多端同步；界面不展示这些未落地入口。
