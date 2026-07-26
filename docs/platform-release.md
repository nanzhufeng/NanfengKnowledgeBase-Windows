# 平台与发布边界

## 当前正式目标

- 正式验收平台：Windows 10/11 x64。
- 当前交付顺序：源码与自动化验证 → BAT 测试版 → 用户明确确认 → Windows 安装包。
- 默认数据目录为 `D:\南枫情报台`；可通过 `NANFENG_INTELLIGENCE_DATA_DIR` 指向隔离目录。
- 安装、升级和重装不得清空受控数据目录。

## 跨平台状态

- React、Rust、SQLite、导入导出和备份协议不依赖 Windows 业务语义。
- 非 Windows 平台使用 Tauri 系统应用数据目录，不硬编码 D 盘。
- 项目已保留 `.icns` 图标和 Tauri 跨平台配置，但当前没有 macOS 构建机、签名证书或真实设备验证，因此不把 macOS 标记为已发布。
- Windows 单实例使用本机回环监听守卫；不产生外部网络请求。macOS/Linux 复用同一守卫，发布前仍需分别验证端口占用和生命周期行为。

## Windows 安装包发布门槛

1. TypeScript、Vitest、Rust、Sites、Vite、Playwright 全部通过。
2. Tauri release `--no-bundle` 通过，并在隔离的 282 条数据副本上启动。
3. 第二实例安全退出；退出后隔离数据库 `integrity_check=ok`。
4. BAT 测试版由用户完成真实使用确认。
5. 只有第 4 项确认后才生成、安装和验证安装包。

## 当前安装器实现

- 当前仓库使用 Tauri 2 官方 NSIS x64 目标，配置位于 `src-tauri/tauri.conf.json`。
- 发布资产统一使用 `Nanfeng-Intelligence-Windows-v<版本>-Setup.exe`，GitHub Release 只保留这一份公开安装资产。
- 构建机未安装 Inno Setup 7；本版沿用已经过项目配置和 Tauri 构建验证的 NSIS 链路，不创建伪 PyInstaller spec，也不临时安装额外系统级打包工具。
- 安装程序只部署应用文件；正式数据库、附件、导入原件和完整迁移备份均在独立受控数据目录，升级与卸载不应清空 `D:\南枫情报台`。

## macOS 后续发布门槛

1. 在 Apple Silicon 和目标最低系统版本上构建 `.app`。
2. 配置开发者签名、公证和升级保留数据测试。
3. 验证文件选择、附件打开、数据目录、单实例、备份恢复和中文路径。
4. 完成真实设备验证前，只能标记为“代码路径兼容”，不能标记为“已发布”。
