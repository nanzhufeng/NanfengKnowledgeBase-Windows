# 下一轮可直接使用的提示词

```text
继续“南枫知识库”可见桌面用户验收门槛。

仓库：C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence
当前分支：codex/nanfeng-knowledge-production-checkpoint-20260727
代码 checkpoint：6d0180f

先完整读取项目根 AGENTS.md、docs/CURRENT_HANDOFF.md 和本文件，再运行：
git status --short
git log -5 --oneline --decorate

不要扫描全部历史审计、旧原型或整段聊天记录。先简短确认：
1. 正式 D:\南枫知识库 已完成 migration v3；
2. 正式复核为 migration 1/2/3、901 Record、901 Source Item、901 收录箱、446 附件、integrity_check=ok、外键 0；
3. 完整备份、migration 自动数据库备份、前后 SHA-256、第二次打开幂等和正式回执均已记录；
4. 以上只证明正式数据库升级和无界面复核，不证明可见桌面用户路径、优雅退出、安装包或发布。

只有当南烛枫在当前对话中明确允许打开可见窗口并参与验收时，才执行唯一任务：
通过 启动南枫知识库-测试版.bat 连续验收收藏、长正文、批量导入、不同类型附件、知识工作区与优雅退出；记录每条真实用户路径的通过、失败或未验证状态。

边界：
- 本提示词本身不是打开可见窗口的授权。
- 未获明确授权时只报告门槛，不启动 BAT。
- 验收期间保护 D:\南枫知识库，不删除、清空、覆盖或执行破坏性测试。
- 不删除或覆盖 D:\南枫情报台。
- 不切回 main。
- 不生成安装包、不执行升级覆盖/卸载、不发布 GitHub。
- 保护工作区，不 reset/clean/stash/覆盖未知改动。
```
