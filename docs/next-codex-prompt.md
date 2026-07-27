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
3. 哪些只有自动/隔离证据；
4. 本轮唯一任务和禁止范围。

随后直接执行唯一任务：
在新的 .runtime-qa 隔离根完成“完整迁移备份创建 → 备份检查 → 隔离目标受控变更 → 恢复 → 数据库/附件/界面偏好/逐文件 SHA-256 核对 → 注入失败后的自动回滚验证”，并以隐藏后台 Tauri 进程验证 migration v3 命令桥和重启持久化。

边界：
- 不打开可见窗口，不占用用户屏幕。
- 不读写 D:\南枫知识库 或 D:\南枫情报台。
- 只能使用已存在的隔离副本或新建的合成隔离数据；若隔离输入不存在且继续需要读取正式数据，立即停止并报告。
- 不生成安装包、不发布 GitHub、不切回 main。
- 不修改产品规则，不顺带实现 FTS5/BM25、别名重定向、拆分提交或其他 P1/P2 项。
- 保护现有工作区，不 reset/clean/stash/覆盖未知改动。

最小交付：
- 隔离根、输入来源和测试前后哈希；
- 备份 manifest/文件数量/字节数/校验结果；
- 恢复后的记录、Source Item、附件、migration、integrity_check 和外键结果；
- 故障注入与自动回滚结果；
- 隐藏 Tauri 命令桥和重启持久化证据；
- 修改文件、定向测试、未验证风险；
- 更新 docs/CURRENT_HANDOFF.md 和必要的脱敏审计摘要。

达到上述证据即停止，不进入正式数据升级。
```
