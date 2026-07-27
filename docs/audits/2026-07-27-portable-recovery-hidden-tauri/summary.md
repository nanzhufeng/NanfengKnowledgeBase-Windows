# 完整恢复与隐藏 Tauri 验收摘要

> 日期：2026-07-27
> 分支：`codex/nanfeng-knowledge-production-checkpoint-20260727`
> 起始 HEAD：`c60120d`
> 数据边界：仅 `.runtime-qa` 隔离副本和脱敏合成文件；未读写 `D:\南枫知识库` 或 `D:\南枫情报台`

## 任务合同

唯一目标是关闭正式 migration v3 前的两个 P0 验证缺口：

1. 完整迁移备份创建、检查、受控变更、恢复、逐文件 SHA-256、失败自动回滚和数据库重开；
2. 不显示窗口的真实 Tauri/WebView2 命令桥、migration v3 和重启持久化。

未进入正式数据升级、安装包、发布、FTS5/BM25、别名重定向或其他 P1/P2 项。

## 完整迁移备份与恢复

- 隔离输入：`.runtime-qa/knowledge-v3-20260727-qa1`
- 成功演练根：`.runtime-qa/portable-recovery-20260727-qa4`
- 输入数据库 SHA-256：`3a3ca69930541416e8beef670cb0b1beb2fcdf695f3c24bdf44ffc82e2cb133a`
- 备份目录：`backups/隔离完整迁移备份演练_20260727-054558-290`
- manifest SHA-256：`bfa63754c4ff88cdb5396fe190538a32d6bd31637facd3c819b0274a18f10465`
- manifest 受校验文件：6 个，合计 653,213,880 字节
- 目录总文件：7 个，合计 653,215,176 字节
- 内容校验：`verified_sha256`

恢复前后逻辑结果一致：

| 项目 | 基线 | 恢复后 | 故障回滚后 | 重开后 |
|---|---:|---:|---:|---:|
| 活动 Record | 901 | 901 | 901 | 901 |
| Source Item | 901 | 901 | 901 | 901 |
| 收录箱 | 901 | 901 | 901 | 901 |
| 附件登记 | 446 | 446 | 446 | 446 |
| migration | 1、2、3 | 1、2、3 | 1、2、3 | 1、2、3 |
| `integrity_check` | `ok` | `ok` | `ok` | `ok` |
| 外键违规 | 0 | 0 | 0 | 0 |

脱敏合成导入原件、附件和界面偏好在成功恢复后 SHA-256 与基线一致。SQLite Online Backup 恢复会重写数据库页，因此数据库文件哈希不要求与基线逐字节相等；本轮以表计数、迁移版本、完整性、外键和重启读回作为数据库验收。

故障注入点位于“数据库和导入原件已替换、附件替换前”。恢复返回预期错误后，自动回滚保留了受保护数据库标记、导入原件和附件；两个合成文件哈希精确一致，回滚安全备份的 manifest 与界面偏好也通过校验。

完整机器可读回执：

- `.runtime-qa/portable-recovery-20260727-qa4/logs/portable-recovery-qa-report.json`
- `.runtime-qa/portable-recovery-20260727-qa4/logs/portable-restore-20260727-054743-762.json`

## Windows 大型备份目录缺陷与修复

653 MB 隔离数据库能完成 SQLite 备份、完整性检查、manifest 和文件复制，但当前进程内对构建目录执行 Rust `fs::rename` 持续 30 秒返回 `PermissionDenied`。WAL 与 DELETE journal 两种探针均复现；进程仍存活时，外部 PowerShell 对同一目录可立即改名，排除了内容损坏、中文路径、目标冲突和普通 ACL。

修复后备份直接在最终唯一目录内构建，并以 `.building` 标记未完成状态：

- `manifest.json` 仍最后写入；
- `.building` 不进入逐文件 manifest；
- 检查器发现 `.building` 时拒绝恢复；
- 全部内容完成后删除 `.building`，不再依赖大型目录原子改名。

生产 `restore_portable_backup` 参数和备份格式版本没有改变。故障注入入口只对 Rust 隔离维护工具可见，正常 Tauri 恢复命令固定使用无故障路径。

## 隐藏 Tauri 命令桥与重启

- 隔离输入：migration v3 前自动备份，418,779,136 字节
- 输入 SHA-256：`c4e957f08430eddd381336c2b3494491beb58ee4f9d6395e9884b616e1d371cc`
- 隔离运行根：`.runtime-qa/hidden-tauri-bridge-20260727-qa1`
- 窗口配置：`visible:false`
- 实际链路：Tauri debug 进程 + WebView2 + 正式 `window.__TAURI_INTERNALS__.invoke`

第一次隐藏启动完成 migration v3，经正式命令桥读取隔离根和收录箱，并创建一个脱敏 Domain/Topic；进程内读回成功，`integrity_check=ok`。第二次隐藏启动读取同一 Domain ID 1、Topic ID 1，确认：

- 活动 Record：901
- Source Item / 收录箱：901
- 附件登记：446
- migration：1、2、3
- `integrity_check=ok`
- 外键违规：0
- 重启后数据库 SHA-256：`f47e45ddb3fb79a5160d727bc5e7651825c46a2122fc47ea3d55660eb8185a01`

当前 capability 不允许 WebView 调用 `window.close`，隐藏窗口的系统关闭信号也未结束进程。本轮只终止了路径核验后的 QA debug 进程；第二次启动后的完整性和持久化通过，但不能表述为“优雅退出已验证”。两次运行结束后单实例、CDP 和 Vite 端口均已释放。

## 自动回归

- 前端：46/46
- Rust：55/55
- Sites：4/4
- TypeScript：通过
- Vite 生产构建：通过
- Playwright 无界面交互：16/16

未生成 Tauri 安装包，未运行安装、升级覆盖或发布。

## 保留边界与待验证项

- 正式 `D:\南枫知识库` 未执行 migration v3。
- 完整恢复与隐藏 Tauri 的 P0 隔离证据已关闭；正式升级仍需南烛枫单独明确授权。
- `.runtime-qa/portable-recovery-20260727-qa1`、`qa2`、`qa3` 和 `backup-rename-probe-*` 是失败定位资产；本轮未获清理授权，保持原状，不作为通过证据。
- 真实附件实体未从正式目录复制；文件级恢复用脱敏合成附件和导入原件验证，446 是隔离数据库中的登记行数。
- 安装包、正式升级、优雅退出和真实用户路径仍未验证。
