# 下一轮可直接使用的提示词

```text
继续“南枫知识库”性能优化 BAT 的用户验收收口。

仓库：C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence
当前分支：codex/nanfeng-knowledge-production-checkpoint-20260727
代码 checkpoint：8f6559b

先完整读取项目根 AGENTS.md、docs/CURRENT_HANDOFF.md 和本文件，再运行：
git status --short
git log -5 --oneline --decorate

不要扫描全部历史审计、旧原型或整段聊天记录。先简短确认：
1. 正式 D:\南枫知识库 已完成 migration v3；
2. 可见 BAT 已通过启动、知识工作区、长正文、收藏恢复、PNG/WAV 附件打开入口和优雅退出；
3. 批量导入已在隔离数据根通过 2 个脱敏文件、3 条记录的预览与确认，正式根只验证选择器取消；
4. 本地 NSIS 全新安装、0.1.0 升级、运行中保护、正式数据保留和卸载均已通过；
5. GitHub 发布未执行，Inno Setup 7 保持暂缓。

本轮唯一任务：
等待南烛枫运行仓库根目录的 `启动南枫知识库-测试版.bat`，收集其对启动、收录箱切换和长正文滚动的主观流畅度反馈；若反馈仍卡顿，只复现具体动作并做定向性能定位。

边界：
- 不重复安装、升级或卸载；若确需再次改变系统状态，先取得新授权。
- 不删除、清空、覆盖 D:\南枫知识库。
- 不删除或覆盖 D:\南枫情报台。
- 不切回 main。
- 不安装 Inno Setup 7。
- 不发布 GitHub；只有南烛枫明确说“上传”才进入发布流程。
- 保护工作区，不 reset/clean/stash/覆盖未知改动。
```
