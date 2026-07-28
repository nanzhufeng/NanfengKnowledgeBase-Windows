# 下一轮 Codex 唯一任务

继续开发“南枫知识库”。

仓库：`C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence`

分支：`codex/nanfeng-knowledge-production-checkpoint-20260727`

设计治理 checkpoint：`c8161e9`

最近功能 checkpoint：`b1d030a`

先完整读取：

1. `AGENTS.md`
2. `docs/CURRENT_HANDOFF.md`
3. `docs/next-codex-prompt.md`
4. `docs/core-workspace-design-baseline.md`
5. `docs/core-workspace-acceptance-matrix.md`

再检查 `git status` 与最近提交。不要先扫描全部历史审计或聊天记录。

先简短汇报：

- 当前实现层级；
- 当前验证层级；
- 四张最终页面中尚未完成的部分；
- 本轮修改类别与必须保护的已锁定类别。

## 唯一任务

实现四张最终核心页面中的第一个可验收小步：知识视图的两个状态。

- 默认状态：`竞争假设`。
- 可切换状态：`判断演变`。
- 数据必须复用现有正式 Repository 和 migration v4 对象，不能回退到假数据原型。
- 布局必须继承已锁定合同：左侧全高主导航、窄中栏、右侧主阅读区、细橙关联线、独立纵向滚动、底部横向时间线。
- 五套皮肤完整保留，皮肤只改变视觉层，不改变模块、默认状态或对象层级。
- 同视口对照：
  - `docs/screenshots/final-core-workspace/knowledge-view-competing-hypotheses.png`
  - `docs/screenshots/final-core-workspace/knowledge-view-judgment-evolution.png`
- 更新 `docs/core-workspace-acceptance-matrix.md` 的实际状态。
- 完成最小充分验证后，生成新的隔离 BAT 供南烛枫测试。

## 禁止项

- 不切回 `main`；
- 不扫描或改写全部历史审计；
- 不直接写、删除、覆盖、清空或重建正式 SQLite/来源；
- 不恢复旧宽泛系统规则；
- 不用旧原型、旧记录页或皮肤预览代替最终功能布局；
- 不遗漏“竞争假设”或“判断演变”任一状态；
- 不改变五套皮肤名单、背景、冷白磨砂和破边合同；
- 不扩大到来源档案、主题结构、模型 API、云同步、Inno Setup、安装包或发布；
- 不上传 GitHub；只有南烛枫明确说“上传”才操作正式 Release。

## 停止条件

知识视图两个状态完成代码集成、定向合同、TypeScript/Rust 必要测试、`--no-bundle` 构建和隔离 BAT 后停止。明确区分：

- 设计已锁定；
- 已实现；
- 自动测试/构建通过；
- 南烛枫真实桌面已确认；
- 尚未验证。
