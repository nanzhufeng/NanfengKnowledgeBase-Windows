# 知识持久化与 legacy Record 迁移设计

## 结论

知识结构已经接入应用 migration v3、正式 Rust 仓库和正式 UI。901 条活动记录的真实数据库副本已在隔离目录完成迁移与幂等复跑；`D:\南枫知识库` 正式库尚未执行 v3，真实桌面链路与完整恢复演练仍需单独验收。

## 代码所有权

| 职责 | 唯一位置 | 当前状态 |
|---|---|---|
| 领域对象与分类输入输出 | `src/knowledge/domain.ts` | 已实现 |
| 确定性分类建议 | `src/knowledge/deterministicClassifier.ts` | 已实现，零写入 |
| SQLite 表合同 | `src-tauri/src/knowledge/schema.rs` | 已接入 migration v3；正式库未执行 |
| 旧 Record 映射预演 | `src-tauri/src/knowledge/legacy_preview.rs` | 已实现，只读函数 |
| 正式库只读复制与审计报告 | `src-tauri/src/knowledge/audit.rs` | 已实现，只输出到正式数据目录外 |
| 隔离副本分类输入导出 | `src-tauri/src/knowledge/classification_input.rs` | 已实现，只读流式导出 |
| legacy 内容分类预演 | `src/knowledge/legacyClassificationDryRun.ts` | 已实现，复用唯一分类器且零数据库写入 |
| 正式知识仓库与用例 | `src-tauri/src/knowledge/repository.rs` | 已接入收录箱、主题、分类/反馈、个人目录、治理 CRUD、Note、Proposition、Turning Point、精确证据锚点、问题、上下文、合并/撤销、拆分预览与关系 |
| 正式 migration 与兼容读模型 | `src-tauri/src/database.rs` | 901 条隔离副本通过；正式库未执行 |
| 正式知识 UI | `src/components/KnowledgeWorkspace.tsx` | 已替代假数据入口；真实桌面链路待验收 |

## 目标表组

### 结构

- `domains`
- `topics`
- `topic_aliases`
- `topic_relations`

数据库允许任意深度；界面默认展示和展开前四层。每个主题只有一个主父级和一个主领域，横向联系放在关系表。主题合并后旧名称进入别名/重定向，不复制内容。

### 来源与笔记

- `source_items`
- `notes`
- `note_sources`
- `note_topics`
- `attachment_links`

Source Item 保存保真的来源正文、哈希、来源时间和元数据；Note 保存可编辑 Markdown。两者通过关系表连接，Note 只能有一个主要主题。

### 判断、证据和问题

- `judgment_snapshots`
- `evidence`
- `open_questions`
- `turning_points`
- `propositions`
- `decisions`

判断使用追加快照。Evidence 必须关联 Source Item；可信度、验证状态、有效状态分开存储。Turning Point 只连接真正发生判断变化的快照。

### 分类与治理

- `entity_dictionary`
- `classification_rules`
- `classification_suggestions`
- `topic_operations`
- `operation_logs`

分类建议记录五层信号、算法版本和处理状态，但不能自行写入主题归属。合并、移动、重命名和拆分预览保存 before/after 与逆操作载荷。

### 检索

- `source_items_fts`
- `notes_fts`

FTS5 使用与现有记录检索一致的本地 `trigram` 分词。触发器验证新增和修改后索引同步；未来 BM25 适配器只向分类器提供归一化分数。

## legacy Record 映射规则

| 旧数据 | 新对象候选 | 规则 |
|---|---|---|
| `source_text` 非空或存在 `sources` | Source Item | 一条活动 Record 最多形成一个主来源候选；原 `sources` 作为来源元数据/外部引用保留 |
| `summary/current_judgment/confirmed_facts/key_evidence/open_questions/next_actions/notes` 任一有内容 | Note | 保留为可编辑整理内容，不能覆盖 Source Item |
| 一个旧标签 | Topic 候选 | 默认选中但仍需用户确认 |
| 多个旧标签 | 多个 Topic 候选 | 标记歧义，不自动决定主主题 |
| 没有旧标签 | 未分类 | 进入收录箱人工处理 |
| Record 标题 | Source/Note 标题 | 不自动升格为 Topic |
| `is_deleted=1` | 暂不迁移 | 单独计数，正式迁移前再决定 |
| 无法解析的结构化 JSON | 阻塞项 | 报告数量，禁止静默丢弃 |

## dry-run 报告

`preview_legacy_record_migration(connection, max_items)` 输出：

- 活动 Record 与回收站数量；
- Source Item、Note 和 Note→Source 候选数量；
- 旧来源链接数量；
- 单标签候选、多标签歧义、未分类数量；
- 坏结构化字段数量；
- 聚合后的主题候选与引用 Record 数；
- 有界的逐记录映射样本和是否截断；
- 迁移警告。

函数只执行 `SELECT`。测试在调用前后比较 SQLite `total_changes`，确保预演没有写入。

## 2026-07-27 正式库只读预检结果

- 实际正式来源仍为旧品牌兼容目录 `D:\南枫情报台\data\app.db`；首选新目录当前没有数据库。
- 活动 Record 384、回收站 0、Source Item 候选 384、Note 候选 266、未分类 384、坏字段 0。
- 384 条记录均无标签，Topic 候选为 0。这证明正式迁移不能依赖 legacy 标签，必须新增内容驱动分类 dry-run。
- 标题解析使用导入器与数据库共享规则：从可见用户内容恢复 12 条，22 条仍为通用标题；`conversation(s)` 及纯数字批次文件名不会再被当作有效标题。
- 7 组重名涉及 23 条记录，正式迁移必须先区分真实重复、同主题不同来源和过短标题。
- 完整证据和边界见 `docs/audits/2026-07-27-legacy-migration-preview/summary.md`。

## 2026-07-27 内容分类覆盖结果

- `local-rules-v1` 已在 384 条隔离副本记录上真实运行，输入正文先经过现有会话可见内容解析，再与摘要、判断、事实、证据、问题、行动和备注组成标准文本。
- 当前 `prototype-seed-v1` 只有 8 个临时 Topic 和 5 条规则；未注入 FTS5/BM25 与用户确认历史。
- 只有 7 条达到 45 分候选阈值，377 条低于阈值；没有记录达到 70 分确认或 90 分自动接受。
- 结果表明算法入口可以复用，但主题目录覆盖不足。正式迁移前必须先形成由用户确认的个人主题目录，不能把原型 fixtures 当作生产 taxonomy。
- 14 条超长正文采用 24,000 字符首/中/尾确定性抽样，后续接入 FTS 索引时需用全量索引替代正文抽样。
- 完整证据见 `docs/audits/2026-07-27-content-classification-preview/summary.md`。

## ChatGPT 完整导出来源合同

- `ChatGPT_*.zip` 是保真原始来源；`conversations-*.json` 只提供会话树和附件引用，不能单独代表一次完整导入。
- 每条导入记录以 `conversation_id` 作为 Source 外部 ID；附件清单以 `conversation_id → message_id → attachment_id → dat_entry` 建立可审计连接。
- 原 ZIP 归档与恢复扩展名后的附件必须同时保留。恢复文件不得改写字节；保存 SHA-256、原 `.dat` 条目名、原文件名、检测格式、MIME 和受控路径。
- 格式识别顺序固定为：强文件签名、`library_files.json` MIME/扩展名、`conversation_asset_file_names.json` 原文件名、未知 `.bin`。页面不得另写格式猜测。
- 消息直接引用的实体登记到对应 Record 附件；同一物理文件允许多记录共享，删除单个关联时只有最后一个引用可以删除实体。未直接关联的文件库资产仍随该导出包保存并进入完整迁移备份。
- ZIP 解析必须流式执行，拒绝危险路径、加密条目、重复条目名和超限解压体积；不得把完整 ZIP、全部会话或附件字节跨 IPC 发送到 WebView。
- 2026-07-27 的完整集合预演为 901 条：旧库 384 条加补充 ChatGPT 会话 517 条。只有 10 条达到临时候选阈值，891 条仍需人工处理；新增数据没有改变“先确认正式 Topic 目录”的迁移门槛。

## 正式数据升级门槛

migration v3 已挂入 `database::apply_migrations`，但以下条件全部满足前，不运行最新版桌面程序指向 `D:\南枫知识库`：

1. 已完成：正式库三件套只读复制后，在隔离副本执行 v3；活动记录 901、Source Item 901、附件 446、外键违规 0、`integrity_check=ok`。
2. 已完成：隔离副本第二次执行保持 migration 1/2/3、901 个 Source Item 和单一迁移前备份，证明迁移幂等。
3. 已完成：旧 Record 继续作为来源档案兼容层，正式知识入口使用独立 `Source Item`。
4. 待完成：对完整迁移备份执行恢复演练，验证数据库、附件、导入原件和设置清单。
5. 待完成：在隔离数据根启动 Tauri 桌面程序，验证 CSP、命令桥、重启持久化及关键 UI 操作；不得占用用户当前屏幕时后台强行执行。
6. 待完成：单独报告风险和回滚路径并获得确认后，才允许正式数据升级。

本轮没有创建或修改 `D:\南枫知识库` 的知识表，也没有写回 `D:\南枫情报台`。
