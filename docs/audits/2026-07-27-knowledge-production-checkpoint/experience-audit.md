# 正式知识生产链路增量沉淀

## 本次固化的最终基线

- 产品入口：正式应用直接进入收录箱、主题浏览器和整理工作台。
- 数据所有者：来源档案由 `RecordRepository` 管理；知识结构由 `KnowledgeRepository` 调用 Rust/SQLite 命令管理。
- 迁移策略：migration v3 先备份，再建知识表并幂等回填 Source Item；旧 Record 保留为兼容来源档案。
- 自动分类：只输出可解释建议；确认、撤销和日志由持久化用例负责。
- 结构治理：合并必须预览、事务提交和撤销；拆分首版只预览；关系建议必须人工确认。
- 安全边界：正式数据与隔离验证分离，远程 Markdown 图片默认阻止，附件和恢复限制在受控 canonical 路径。

## 反馈与根因

此前进度表述把“原型存在、合同代码存在、测试通过、正式入口接入、隔离数据验证”混成了“阶段完成”，导致用户看到规格中仍有大量未完成项时产生合理质疑。根因不是单一功能遗漏，而是验证层级和文档状态没有同步：

- `CURRENT_HANDOFF` 顶部已经反映正式接入，`test-plan.md` 仍声明“仅验证原型、正式 migration 未接入”。
- `architecture-governance.md` 仍把 `KnowledgeRepository` 和结构治理服务写成待建。
- 历史阶段记录没有明确标为历史快照，容易被当作当前事实。

## 本次修正

- 把架构所有权更新为当前正式代码入口，并单列“正式数据尚未升级”的边界。
- 重写测试计划为 checkpoint 后的自动回归、migration、数据安全和正式升级门槛。
- 新增验收矩阵，逐项区分代码状态、自动证据、隔离/真实证据和当前判定。
- 新增 `docs/next-codex-prompt.md`，下一轮只做隔离恢复演练与隐藏 Tauri 命令桥验收。
- 保留历史审计，不重写旧阶段结论；当前事实只以前述最新文档和本 checkpoint 为准。

## 可复用规则归属

本轮没有产生新的独立跨项目职责，不新增共享 skill。以下规则继续由既有治理体系拥有：

- 先区分合同、构建、模拟/隔离和真实运行证据，再汇报完成度。
- 持久化模型变更必须经过预览、备份、隔离迁移、完整性校验和明确授权。
- 长周期项目必须留下冷启动交接、验收矩阵和可复制的唯一下一步。

项目内新增的是南枫知识库特有事实：migration v3、901/901/446 基线、知识命令入口及正式数据升级门槛。

## 无效方案与停止条件

- 不再以假数据原型截图或浏览器空状态证明正式数据库功能。
- 不再把编译/单测通过表述为正式数据已迁移。
- 不在正式数据上用“顺便验证”完成恢复或结构写入。
- 完整恢复演练或隐藏 Tauri 验证失败时，保留隔离日志并停止；不得继续正式升级、打包或发布。

## 证据索引

- 当前交接：`docs/CURRENT_HANDOFF.md`
- 架构所有权：`docs/architecture-governance.md`
- 验收计划：`docs/test-plan.md`
- 隔离 migration 摘要：`docs/audits/2026-07-27-knowledge-production-integration/summary.md`
- 本次验收矩阵：`docs/audits/2026-07-27-knowledge-production-checkpoint/acceptance-matrix.md`
- 下一轮入口：`docs/next-codex-prompt.md`
