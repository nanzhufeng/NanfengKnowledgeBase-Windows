# 依赖说明

| 依赖 | 用途 | 替代方案 | 风险与移除成本 |
|---|---|---|---|
| React 19 | UI 状态与组件 | 原生 DOM、Vue | 后续页面与状态都依赖，移除成本高 |
| TypeScript | 类型约束 | JavaScript | 便于后续接入领域模型，移除价值低 |
| Vite 6 | 本地开发和静态构建 | Rsbuild、Webpack | 仅构建层，替换成本中等 |
| Lucide React | 与视觉稿一致的线性界面图标 | Phosphor、Fluent Icons | 组件引用集中，替换成本低 |
| @vitejs/plugin-react | React 编译与热更新 | 其他 Vite React 插件 | 与 Vite 绑定，风险低 |
| Tauri 2 / Tauri CLI | Windows 桌面壳、命令桥接与安装包 | Electron、原生 WinUI | 桌面入口与构建依赖，替换成本高 |
| Rust / rusqlite（bundled SQLite） | 本地数据、迁移、FTS5、备份恢复 | SQLx、Tauri SQL 插件 | 数据规则集中在 Rust，替换需迁移验证 |
| Zod | 校验 Rust 命令返回的前端领域对象 | 手写类型守卫 | 仅仓库边界使用，替换成本低 |
| Vitest | 前端仓库契约测试 | Node test、Jest | 测试范围小，替换成本低 |
| chrono / uuid / sha2 / encoding_rs | 时间、标识、文件哈希与编码识别 | 标准库和其他小型 crate | 导入链路使用，移除需改写 |
| ammonia | HTML 导入净化 | scraper + 自定义白名单 | 防止原始 HTML 进入可显示内容 |
| @tauri-apps/plugin-dialog / plugin-opener | 本地文件选择与打开路径 | 自定义 Rust 命令 | 导入和数据目录入口使用 |
| reqwest 0.11 | OpenRouter / DeepSeek HTTPS API 与动态模型目录 | 手写 HTTP、模型 SDK | 只在 Rust 后端使用；移除会失去 AI 接入 |
| keyring 3.6（Windows native） | 把 API Key 保存到 Windows 凭据库 | 明文配置文件、系统 DPAPI 自封装 | 避免密钥进入 SQLite 和前端；当前产品平台为 Windows |

当前不使用 Radix、Tailwind、云数据库、供应商模型 SDK 或遥测 SDK。模型接入通过轻量 HTTP 边界完成。
