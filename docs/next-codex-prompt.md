# 下一轮可直接使用的提示词

```text
继续“南枫知识库”阅读体验与自动分类 BAT 的用户验收收口。

仓库：C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence
当前分支：codex/nanfeng-knowledge-production-checkpoint-20260727
代码 checkpoint：9965ad5

先完整读取项目根 AGENTS.md、docs/CURRENT_HANDOFF.md 和本文件，再运行：
git status --short
git log -5 --oneline --decorate

不要扫描全部历史审计、旧原型或整段聊天记录。先简短确认：
1. 南烛枫已确认性能优化后的流畅度明显改善；
2. 收录箱已改为左侧列表独立滚动，页头和右侧阅读/分类卡保持固定，正文区自适应占用剩余高度；
3. 当前判断、TXT、Markdown 和平台会话统一使用 Markdown/角色卡阅读组件；
4. 领域与主题可创建、重命名和编辑描述；新导入来源会自动启用可编辑默认目录、生成建议，仅 ≥90 分自动确认，其余等待人工确认并可撤销；
5. 外部链接与附件已统一走 Windows 原生 ShellExecuteExW 前台唤起路径；
6. BAT 测试 EXE 已重建；GitHub 发布未执行，Inno Setup 7 保持暂缓。

本轮唯一任务：
等待南烛枫运行仓库根目录的 `启动南枫知识库-测试版.bat`，确认图片和外部链接是否直接出现在前台，并复核收录箱独立滚动、右侧正文高度、统一文字格式和导入自动分类体验。只处理南烛枫反馈的具体问题。

边界：
- 不重复安装、升级或卸载；若确需再次改变系统状态，先取得新授权。
- 不删除、清空、覆盖 D:\南枫知识库。
- 不删除或覆盖 D:\南枫情报台。
- 不切回 main。
- 不安装 Inno Setup 7。
- 不发布 GitHub；只有南烛枫明确说“上传”才进入发布流程。
- 保护工作区，不 reset/clean/stash/覆盖未知改动。
```
