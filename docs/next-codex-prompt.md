# 下一轮可直接使用的提示词

```text
继续“南枫知识库”安装包、升级覆盖与卸载验收门槛。

仓库：C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence
当前分支：codex/nanfeng-knowledge-production-checkpoint-20260727
代码 checkpoint：b962159

先完整读取项目根 AGENTS.md、docs/CURRENT_HANDOFF.md 和本文件，再运行：
git status --short
git log -5 --oneline --decorate

不要扫描全部历史审计、旧原型或整段聊天记录。先简短确认：
1. 正式 D:\南枫知识库 已完成 migration v3；
2. 可见 BAT 已通过启动、知识工作区、长正文、收藏恢复、PNG/WAV 附件打开入口和优雅退出；
3. 批量导入已在隔离数据根通过 2 个脱敏文件、3 条记录的预览与确认，正式根只验证选择器取消；
4. 安装包、升级覆盖、卸载和 GitHub 发布均未执行。

本提示词本身不是安装、卸载或系统状态变化的授权。先向南烛枫说明影响范围；只有在当前对话取得明确授权后，才执行唯一任务：
重新构建当前版本 Windows 安装包，依次验证全新安装、从现有版本升级覆盖、正式 D:\南枫知识库 数据保留、启动与卸载；记录每个层级的通过、失败或未验证状态。

边界：
- 未获明确授权时只报告门槛，不构建或运行安装器，不卸载。
- 操作前记录正式数据库 SHA-256、migration、计数、完整性和外键；每个会影响系统状态的阶段后复核。
- 不删除、清空、覆盖 D:\南枫知识库。
- 不删除或覆盖 D:\南枫情报台。
- 不切回 main。
- 不发布 GitHub；发布是后续独立授权。
- 保护工作区，不 reset/clean/stash/覆盖未知改动。
```
