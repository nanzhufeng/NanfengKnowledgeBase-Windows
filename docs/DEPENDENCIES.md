# 依赖说明

| 依赖 | 用途 | 替代方案 | 风险与移除成本 |
|---|---|---|---|
| React 19 | UI 状态与组件 | 原生 DOM、Vue | 后续页面与状态都依赖，移除成本高 |
| TypeScript | 类型约束 | JavaScript | 便于后续接入领域模型，移除价值低 |
| Vite 6 | 本地开发和静态构建 | Rsbuild、Webpack | 仅构建层，替换成本中等 |
| Lucide React | 与视觉稿一致的线性界面图标 | Phosphor、Fluent Icons | 组件引用集中，替换成本低 |
| @vitejs/plugin-react | React 编译与热更新 | 其他 Vite React 插件 | 与 Vite 绑定，风险低 |

当前没有 Radix、Tailwind、Tauri、SQLite 或 Zod。进入真实桌面与数据阶段前，再按实际需求引入，避免阶段 1 过度依赖。
