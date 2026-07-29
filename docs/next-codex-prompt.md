# 下一轮 Codex 可直接使用的提示词

继续开发“南枫知识库”。

仓库：`C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence`

分支：`codex/nanfeng-knowledge-production-checkpoint-20260727`

当前交接描述的代码基线：`b6cf5a6`

冷启动交接 checkpoint：`f8ff4ab`

先完整读取：

1. `AGENTS.md`
2. `docs/CURRENT_HANDOFF.md`
3. `docs/next-codex-prompt.md`
4. `docs/core-workspace-design-baseline.md`
5. `docs/core-workspace-acceptance-matrix.md`

再检查 Git 根目录、当前分支、`git status` 和最近提交。不要先扫描全部聊天、旧审计或历史原型。

先简短汇报：

- 当前实现层级；
- 当前验证层级；
- 代码与锁定设计的明确差距；
- 本轮修改类别和必须保护的类别；
- 本轮唯一任务、停止条件和正式数据边界。

## 唯一任务

实现四张最终核心页面中的第一个可验收小步：`知识视图`的两个状态。

- 默认状态：`竞争假设`。
- 可切换状态：`判断演变`。
- 复用现有 `knowledgeRepository`、Rust Repository 和 migration v4 对象，不回退到假数据原型，不重写知识模型。
- 以阅读成果为首屏主体，移开当前开场的“建立领域与主题”维护表单；维护操作只能作为次级入口。
- 布局严格继承锁定合同：左侧全高主导航、窄中栏、右侧主阅读区、细橙关联线、独立纵向滚动、底部横向时间线。
- 两个状态必须在同一主阅读区稳定切换，不能挤占左侧主导航，不能造成窗口宽度或滚动位置异常。
- 五套皮肤全部保留；皮肤只改变视觉，不改变模块、对象层级、默认状态或交互结果。
- 同视口对照：
  - `docs/screenshots/final-core-workspace/knowledge-view-competing-hypotheses.png`
  - `docs/screenshots/final-core-workspace/knowledge-view-judgment-evolution.png`
- 更新 `docs/core-workspace-acceptance-matrix.md` 的真实状态。
- 达到最小充分验证后，生成一个新的隔离 BAT 供南烛枫可见测试；旧五套皮肤 BAT 不得冒充新布局。

主要代码入口：

- `src/components/KnowledgeWorkspace.tsx`
- `src/styles.css`
- `src/App.tsx`
- `src/services/knowledgeRepository.ts`
- `src/theme/knowledgeSkins.ts`
- `src-tauri/src/commands.rs`
- `src-tauri/src/knowledge/repository.rs`

当前已知冲突：`KnowledgeWorkspace.tsx` 的知识视图仍以“建立领域与主题”的 CRUD 表单开场，与锁定的阅读优先布局冲突。优先重构 UI 组织和切换状态，不重新设计数据库。

## 修改与保护类别

- 本轮修改：B 页面功能布局、C 交互与状态；仅在必要时做最小 Repository 组合读取。
- 必须保护：A 产品/信息架构、D 五套皮肤、正式来源正文、migration v4 已有语义。
- 示例文字和数量不是正式数据要求，可以使用真实仓库返回值替换。

## 禁止项

- 不切回 `main`；
- 不 `reset --hard`、`clean`、`stash` 或覆盖未知改动；
- 不直接写、删、覆盖、清空、重建或后台打开正式 SQLite/来源；
- 不恢复旧宽泛系统规则；
- 不用旧原型、旧记录页、皮肤预览或静态假数据代替最终功能布局；
- 不遗漏 `竞争假设`或`判断演变`任一状态；
- 不改变五套皮肤名单、背景、冷白局部磨砂、语义卡层次和破边合同；
- 不扩大到来源档案、主题结构、模型 API、云同步、Inno Setup、安装包或发布；
- 不上传 GitHub；只有南烛枫明确说“上传”才操作正式 Release。

## 最小验证与停止条件

按风险只做本任务所需的最小充分验证：

1. 定向组件/领域合同；
2. TypeScript；
3. 涉及 Rust 时才跑必要 Rust 测试；
4. Vite 与 Windows Tauri `--no-bundle`；
5. 同视口检查两个状态、独立滚动、细橙关联线、横向时间线和五套皮肤；
6. 生成新隔离 BAT，但不要替南烛枫后台打开正式数据。

完成后立即停止，并明确区分：

- 设计已锁定；
- 代码已实现；
- 自动测试/构建通过；
- BAT 已生成但未验收；
- 南烛枫真实桌面已确认；
- 尚未验证和遗留风险。
