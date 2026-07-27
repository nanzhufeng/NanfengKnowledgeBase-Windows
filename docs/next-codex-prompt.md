# 下一轮可直接使用的提示词

```text
继续“南枫知识库”分类 v2、详情弹窗与外部打开的 BAT 用户验收收口。

仓库：C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence
当前分支：codex/nanfeng-knowledge-production-checkpoint-20260727
代码 checkpoint：eccfd52

先完整读取项目根 AGENTS.md、docs/CURRENT_HANDOFF.md 和本文件，再运行：
git status --short
git log -5 --oneline --decorate

不要扫描全部历史审计、旧原型或整段聊天记录。先简短确认：
1. 南烛枫已确认性能优化后的流畅度明显改善；
2. 分类 v2 只消费当前分支的用户可见正文，不再让原始 JSON 中的 Claude、Google、SRT、ACES、GPU 等元数据参与分类；
3. 个人目录 v2 已覆盖 A股、海外账号体系/银行/通信、新能源车、血型输血、艺术升学和 AI 图像创作；应用时只停用旧版宽泛 `catalog-rule-*`，不改写正文、用户规则或既有归类；
4. 候选必须 ≥45 分且有直接主题证据；旧算法建议和 0 分候选默认隐藏；
5. 无正文空会话默认从收录箱隐藏但不删除；正文遮挡条已移除，“查看详情”使用来源档案同款大弹窗；
6. BAT 已指向 `.runtime-qa/knowledge-base-build-v2/release/nanfeng-knowledge-base.exe`；GitHub 发布未执行，Inno Setup 7 保持暂缓。

本轮唯一任务：
等待南烛枫先关闭仍运行的旧测试窗口，再运行仓库根目录的 `启动南枫知识库-测试版.bat`。抽查 A股、理想 i8、A 型血、艺术报考、giffgaff、美国银行卡等来源：旧建议应隐藏，点击“按新版重新计算”后只出现内容主体吻合的证据充分候选；同时确认空会话默认隐藏、正文无底部遮挡、“查看详情”打开大弹窗，以及图片/外部链接直接出现在前台。只处理南烛枫反馈的具体问题。

边界：
- 不重复安装、升级或卸载；若确需再次改变系统状态，先取得新授权。
- 不删除、清空、覆盖 D:\南枫知识库。
- 不删除或覆盖 D:\南枫情报台。
- 不切回 main。
- 不安装 Inno Setup 7。
- 不发布 GitHub；只有南烛枫明确说“上传”才进入发布流程。
- 保护工作区，不 reset/clean/stash/覆盖未知改动。
```
