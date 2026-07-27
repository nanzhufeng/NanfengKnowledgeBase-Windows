# 下一轮可直接使用的提示词

```text
继续“南枫知识库”分类 v5 的 BAT 用户验收。

仓库：C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence
当前分支：codex/nanfeng-knowledge-production-checkpoint-20260727
代码 checkpoint：c5f6468

先完整读取项目根 AGENTS.md、docs/CURRENT_HANDOFF.md 和本文件，再运行：
git status --short
git log -5 --oneline --decorate

不要扫描全部历史审计、旧原型或完整聊天记录。先简短确认：
1. local-rules-v5 和个人目录 v5 已完成，目录为 10 个领域、68 个可编辑主题；
2. 标题与开头 12,000 字用户可见正文共同分类，正文证据低于标题，原始 JSON 隐藏元数据不参与；
3. 首次加载会自动处理整个收录箱，并按当前版本完成标记断点续算，不再要求用户逐条点击；
4. fresh 隔离全量审计覆盖 901/901：885 条有候选，16 条为空/极短/无业务主体，清晰正文不再静默遗漏；
5. 全量升级只保存建议和无候选完成标记，不改写正文、不覆盖人工确认、不自动确认候选；
6. BAT 已指向 .runtime-qa\knowledge-base-build-v5\release\nanfeng-knowledge-base.exe；
7. GitHub 发布未执行，Inno Setup 7 保持暂缓。

本轮唯一任务：
等待南烛枫关闭当前旧测试窗口后，运行仓库根 启动南枫知识库-测试版.bat。等待后台全收录箱整理完成，确认无需逐条点击即可看到新版主题建议；只抽查整体代表性内容，不再让用户承担寻找遗漏。同步确认图片/外部链接前台显示、空内容过滤、详情弹窗和左侧独立滚动。发现问题时先读取当前版本完成统计和失败项，再定向修复。

边界：
- 不删除、清空或覆盖 D:\南枫知识库。
- 不删除或覆盖 D:\南枫情报台。
- 不切回 main。
- 不安装 Inno Setup 7。
- 不制作安装包，不发布 GitHub；只有南烛枫明确说“上传”才进入发布流程。
- 保护工作区，不 reset/clean/stash/覆盖未知改动。
```
