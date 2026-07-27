# 下一轮可直接使用的提示词

```text
继续开发“南枫知识库”。

仓库：C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence
当前分支：codex/nanfeng-knowledge-production-checkpoint-20260727
代码 checkpoint：482397e

先完整读取项目根 AGENTS.md 和 docs/CURRENT_HANDOFF.md，再运行：
git status --short
git log -3 --oneline --decorate

不要先扫描全部历史审计、旧原型或整段聊天记录。先用简短状态报告确认：
1. 当前分支、HEAD 和工作区；
2. SQLite 主题、别名/实体规则、用户规则、历史确认和 FTS5/BM25 已经通过统一命令进入 `classifySource`；
3. 分类规则/别名/实体管理和个人主题目录仍未形成生产闭环；
4. 正式数据 migration v3 仍未执行。

随后执行唯一任务：
实现“可审阅的个人主题目录提案 → 用户明确确认后一次性写入 → 分类规则、主题别名和实体词典 CRUD → 分类纠正保存反馈”的正式闭环。所有写入继续由 Rust/SQLite 仓库统一持有，页面不得直接复制规则。

最小验证：
- 内存或新建 `.runtime-qa` 隔离数据库证明提案预览不写库、确认幂等且不会覆盖已有主题；
- CRUD 的校验、重复、禁用和读取合同通过；
- 分类纠正生成明确反馈，并继续可撤销；
- 前端入口、TypeScript、Rust、Vite、Sites 和无界面 Playwright 回归通过。

边界：
- 不打开可见窗口，不占用用户屏幕。
- 不读写 D:\南枫知识库 或 D:\南枫情报台。
- 不生成安装包、不发布 GitHub、不切回 main。
- 不实现拆分提交、Note、Proposition、Turning Point 或其他后续项。
- 保护现有工作区，不 reset/clean/stash/覆盖未知改动。

达到上述闭环后更新 CURRENT_HANDOFF，再进入下一项。正式 migration v3 仍需南烛枫专项授权；不得把本提示词本身视为正式数据写入授权。
```
