# 旧库只读迁移预检摘要

## 结论

已在用户授权后对当前正式库执行 SQLite 在线只读备份，并且只在项目内隔离副本上运行迁移预检。正式库没有新增知识表、没有执行 migration、没有改写旧 `Record`。

旧库 384 条活动记录全部没有标签，无法沿用“旧标签 → Topic 候选”的迁移路径。下一阶段必须先对隔离副本做基于实际内容的确定性分类预演，再讨论正式迁移；标题不得自动升格为 Topic。

## 审计范围

- 正式来源：`D:\南枫情报台\data\app.db`
- 新品牌首选目录：`D:\南枫知识库\data\app.db` 当前不存在，因此本次只读审计使用仍在承载正式数据的兼容目录。
- 本地完整报告：`.runtime-qa/knowledge-migration-preview-20260727-authorized-v4/migration-preview.md`
- 本地机器可读报告：`.runtime-qa/knowledge-migration-preview-20260727-authorized-v4/migration-preview.json`
- 隔离副本：`.runtime-qa/knowledge-migration-preview-20260727-authorized-v4/legacy-readonly-copy.db`
- `.runtime-qa` 已被 Git 忽略，包含标题等真实资料的完整报告不会进入仓库。

## 数据结果

| 项目 | 数量 |
|---|---:|
| 活动 Record | 384 |
| 回收站 Record | 0 |
| Source Item 候选 | 384 |
| Note 候选 | 266 |
| 仅形成 Source、暂不形成 Note | 118 |
| Note → Source 候选 | 266 |
| 旧来源链接 | 384 |
| Topic 候选 | 0 |
| 未分类 | 384 |
| 坏结构化字段 | 0 |
| 从正文恢复可用标题 | 12 |
| 仍为通用标题 | 22 |
| 重名标题组 / 涉及记录 | 7 / 23 |

状态分布为普通记录 383、持续跟踪 1；来源类型均为导入。

## 只读与完整性证据

- 正式连接使用 SQLite `READ_ONLY`、`query_only=ON`；连接 `total_changes` 前后均为 0。
- 隔离副本预检前后 `total_changes` 均为 0。
- 隔离副本 `PRAGMA integrity_check` 为 `ok`。
- 隔离副本 SHA-256：`21DEEB5A6292D43989CB2295215FBC0C5954AB2ECAF4C79F656959F7B98CF512`，PowerShell 独立复算一致。
- 正式主库与 WAL 的大小、修改时间在备份前后完全一致。
- `app.db-shm` 大小保持 32,768 字节，但修改时间因 SQLite WAL 只读连接的锁/共享内存协商而刷新。该变化不包含业务数据或 schema 写入，但意味着不能把本次操作描述成“正式数据目录零文件元数据变化”。

## 阻塞项与下一步

1. 384 条记录无标签，必须使用来源正文、标题、摘要和已有结构化字段做内容分类 dry-run。
2. 22 条记录仍只有通用标题，正式迁移前需要进入标题修复队列；不得用文件名冒充知识标题。
3. 7 组重名标题需要区分“真实重复”“同主题不同来源”和“标题过短”。
4. 118 条记录只有来源候选、没有可整理 Note 内容，应保留为 Source Item，不能生成空 Note。
5. 下一步仅允许在该隔离副本上运行确定性分类，不得把知识表接入启动流程，也不得写回正式库。
