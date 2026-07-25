# 南枫情报台

本地优先的研究档案与判断版本库。当前仓库处于“阶段 1：高保真假数据 UI 原型”，不连接数据库、API 或模型服务。

## 当前可演示流程

```text
搜索“资本开支”
→ 选中研究记录
→ 阅读结构化详情
→ 编辑当前判断并观察自动保存状态
→ 创建版本快照并展开历史版本
→ 进入导入中心
→ 载入标准 JSON 示例
→ 检查字段映射和导入结果预览
```

同时包含回收站、设置页、空搜索结果、折叠区块和交互状态骨架。

## 本地启动

```powershell
npm install
npm run dev -- --port 4173
```

## 验证

```powershell
npm run typecheck
npm run build
npm run test:sites
```

## 文档入口

- [产品边界](docs/product-brief.md)
- [架构所有权](docs/architecture-governance.md)
- [依赖说明](docs/DEPENDENCIES.md)
- [设计系统](docs/design-system.md)
- [当前交接](docs/CURRENT_HANDOFF.md)
- [视觉 QA](design-qa.md)

## 当前限制

- 所有数据都是本地假数据，刷新后恢复默认。
- 文件拖入只切换演示状态，不读取或保存真实文件。
- 尚未接入 Tauri、SQLite、FTS5、备份恢复和正式文件系统能力。
