# 下一轮可直接使用的提示词

```text
继续开发“南枫知识库”。

仓库：C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence
当前分支：codex/nanfeng-knowledge-production-checkpoint-20260727
代码 checkpoint：bf7d97e

先完整读取项目根 AGENTS.md 和 docs/CURRENT_HANDOFF.md，再运行：
git status --short
git log -3 --oneline --decorate

不要先扫描全部历史审计、旧原型或整段聊天记录。先用简短状态报告确认：
1. 当前分支、HEAD 和工作区；
2. 正式知识生产链路已经实现到哪一层；
3. 完整恢复、失败回滚和隐藏 Tauri 命令桥已达到的隔离验证等级；
4. 正式数据 migration v3 仍未执行。

本轮默认任务只是状态确认并等待南烛枫指令，不自动执行正式升级。

边界：
- 不打开可见窗口，不占用用户屏幕。
- 不读写 D:\南枫知识库 或 D:\南枫情报台。
- 不生成安装包、不发布 GitHub、不切回 main。
- 不修改产品规则，不顺带实现 FTS5/BM25、别名重定向、拆分提交或其他 P1/P2 项。
- 保护现有工作区，不 reset/clean/stash/覆盖未知改动。

只有南烛枫在新一轮明确授权正式 migration v3 后，才重新写正式升级任务合同、影响范围、备份/回滚和停止条件。不得把本提示词本身视为正式数据写入授权。
```
