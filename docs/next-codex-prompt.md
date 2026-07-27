# 下一轮继续提示

继续 `南枫知识库` 时先读 `AGENTS.md`、`docs/CURRENT_HANDOFF.md`、`docs/architecture-governance.md` 和 `docs/test-plan.md`，再运行 `git status --short`。

当前只做一件事：在新的 `.runtime-qa` 隔离根完成“完整迁移备份创建 → 清空隔离目标 → 恢复 → 数据/附件/偏好哈希核对 → 失败回滚”演练，并以隐藏后台 Tauri 进程验证 migration v3 命令桥和重启持久化。不得打开可见窗口，不得读写 `D:\南枫知识库` 或 `D:\南枫情报台`，不得打包或发布。

交付时分别报告：代码合同、自动回归、隔离恢复实测、隐藏桌面壳实测、仍未验证项。若任一层失败，停在隔离环境并保留日志，不进入正式数据升级。
