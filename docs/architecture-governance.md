# 架构所有权

项目遵循根级 `docs/app-development/architecture-baseline.md`。当前最高产品规格已把核心从“记录管理”升级为“知识演化”。下表描述当前代码事实；正式 `D:\南枫知识库` 是否完成 migration v3 必须单独报告，不能由“代码已接入”推断。

## 知识生产模型（正式代码已接入，正式数据已升级）

| 概念 | 唯一产品含义 | 规则与持久化所有者 | 公开入口 | 主要消费者 | 禁止的平行规则 | 当前证据 |
|---|---|---|---|---|---|---|
| Domain | 稳定顶层领域 | `src/knowledge/domain.ts`、`src-tauri/src/knowledge/schema.rs`、`knowledge/repository.rs` | `create/update/listDomains` | 主题浏览器、主题创建和目录编辑 | 页面用标签临时模拟领域；重建对象实现改名 | 创建与编辑命令已接入；改名保留 ID |
| Topic / Subtopic | 长期主题、唯一主路径和横向关系 | `knowledge/repository.rs` | `create/update/listTopics/getTopicDetail` | 主题浏览器、整理工作台 | 用 Record 标题自动生成主题；改名时新建平行主题 | 正式仓库与 UI 已接入；改名保留 ID；合并旧名称和旧路径写入 redirect 别名且撤销可逆 |
| Source Item | 保真的导入来源和分类对象 | `importer.rs`、`knowledge/repository.rs` | `listInbox`、migration v3 legacy backfill | 收录箱、主题来源、证据 | 覆盖原件；把来源等同于笔记 | 901 条隔离副本幂等回填已验证；收录箱默认隐藏无正文的空会话但不删除来源 |
| Note | 人工整理与补充说明 | `knowledge/repository.rs` | `create/update/archive/list/getNote` | 主题知识页、研究上下文 | 与原始来源共用可覆盖正文 | 独立 CRUD、软归档、主题/来源关联和 FTS 同步已验证 |
| Judgment Snapshot | 某时点判断、置信度和变化原因 | `knowledge/repository.rs` | `addTopicJudgment/getTopicDetail` | 主题页、时间线、上下文 | 覆盖旧判断冒充时间线 | 追加写入和读取已接入 |
| Evidence | 支持/反驳关系和来源锚点 | `knowledge/repository.rs` | `addTopicEvidence/getTopicDetail` | 主题页、上下文 | 无来源证据；页面各自标强弱或保存任意 JSON | 立场/可信度/验证/有效状态分离；锚点按来源类型校验并规范化 |
| Open Question | 待验证问题及状态 | `knowledge/repository.rs` | `addTopicQuestion/getTopicDetail` | 主题页、上下文 | 与普通待办混用 | 正式命令已接入 |
| Classification Suggestion | 来源到主题的候选、分数、理由和状态 | 可读正文投影：`knowledge/readable_text.rs`；评分：`deterministicClassifier.ts`；编排：`knowledgeAutoOrganizer.ts`；持久化输入/确认：`knowledge/repository.rs` | `prepare/save/list/confirm/undoClassification` | 导入完成、收录箱 | 用原始 JSON 元数据分类；分类器直接写库；页面复制评分规则；用 0 分候选填充界面 | v2 只消费有界用户可见正文；无直接证据或低于 45 分不展示；仅 ≥90 自动确认并可撤销 |
| Structural Operation | 合并、拆分、关系和撤销 | `knowledge/repository.rs` | `preview/merge/undoTopicMerge`、`previewTopicSplit`、`suggest/createTopicRelation` | 整理工作台、操作日志 | 无预览直接批量改外键 | 合并、redirect 和撤销已实现；拆分按首版边界仍只预览 |
| Research Context | 本地可审阅的研究上下文 | `knowledge/repository.rs` | `compileTopicContext` | 主题页、导出/后续 Codex 交换 | 调模型生成不透明摘要 | 本地确定性编译已接入 |
| Proposition / Turning Point | 可复用命题与人工确认的判断转折 | `knowledge/repository.rs` | `create/update/supersedeProposition`、`createTurningPoint/getTopicDetail` | 主题页、判断演化、研究上下文 | 从展示文本临时推断身份；填写变化原因自动制造转折 | 命题独立生命周期和用户显式确认的前后判断转折已验证 |

### 运行与数据边界

- `database::apply_migrations` 已接入 migration v3：先创建迁移前 SQLite 安全备份，再创建知识表并幂等回填 legacy Record。
- `src/services/knowledgeRepository.ts` 是 WebView 到 Rust 知识命令的唯一前端适配器；浏览器无 Tauri 桥接时只显示诚实空状态。
- `legacy_preview.rs`、`audit.rs` 和 `classification_input.rs` 继续承担只读审计与隔离预演，不是第二套生产写入口。
- `.runtime-qa/knowledge-v3-20260727-qa1/` 已验证 901 条隔离 migration v3；`.runtime-qa/portable-recovery-20260727-qa4/` 已验证完整恢复和失败自动回滚；`.runtime-qa/hidden-tauri-bridge-20260727-qa1/` 已验证隐藏 Tauri/WebView2 正式命令桥和强制进程重启后的持久化。
- `.runtime-qa/hidden-knowledge-production-20260727-qa4/` 进一步验证 Note、Proposition、Evidence、Judgment 和 Turning Point 经真实隐藏 IPC 写入并在强制重启后按 ID 读回，外键违规为 0。
- 正式 `D:\南枫知识库` 已执行 v3，并完成升级前完整备份、第二次打开幂等和独立只读复核。后续真实数据写入与发布仍需按任务单独授权，不得由隔离证据替代。

目标数据链路固定为：

```text
原件归档
→ 内容提取与标准化
→ 来源读取模型
→ 确定性分类建议
→ 人工确认或高置信接受
→ 主题/关系写入
→ Note、命题、判断、证据、问题和关键转折读模型
→ 研究上下文编译
```

任何真实实现都不得把分类提前到内容提取之前。

## 记录型生产模型（兼容基础设施）

以下所有者描述当前已运行的记录型生产链路。它们仍要维护，但不是知识模型；不得继续用新增字段扩大 `Record` 聚合职责。

| 概念 | 产品含义 | 唯一所有者 | 公开入口 | 当前消费者 | 禁止的平行规则 | 最小验证 | 状态 |
|---|---|---|---|---|---|---|---|
| 研究记录 | 判断、事实、证据、问题、行动、标签与来源的聚合根 | `src-tauri/src/database.rs` | `RecordRepository` | 列表、详情、搜索、版本、导入导出 | 页面直接 SQL；各页面复制记录状态 | Rust CRUD 测试 + 仓库契约 + 运行路径 | 已实现 |
| 当前判断编辑状态 | 阅读、编辑、自动保存和版本中的同一段判断 | `database::update_current_judgment` 与本机草稿键 | `RecordRepository.updateCurrentJudgment` | 判断卡、顶部保存状态、版本快照 | 用完整记录往返保存短字段；失败仍显示已保存 | 自动保存、失败草稿和重启恢复 | 已实现 |
| 记录列表读取模型 | 搜索、筛选和列表只消费轻量摘要，详情正文按选择加载 | `database::list_record_summaries` | `RecordRepository.listRecordSummaries` | 全部记录、收藏、跟踪、更新、回收站 | 列表加载完整正文；前端二次删除后端搜索命中 | 1000 条性能合同 + 正文命中搜索 + E2E | 已实现 |
| 页面导航状态 | 全部记录、我的收藏、导入、回收站和设置的当前位置 | `App` 的 `page` | `Sidebar.onNavigate` | 主区域页面选择 | 各页面自行修改侧栏状态 | 导航与可见页面一致 | 已实现 |
| 文件导入 | 单个或批量文件的原件归档、哈希、限量预览、可编辑映射、去重策略和完整写入 | `src-tauri/src/importer.rs` / `domain/importMapping.ts` / `domain/importQueue.ts` | `RecordRepository.prepareImport/confirmImport/cancelImport` | 批量拖拽队列、文件选择、单文件映射、自动批量确认、导入日志 | 并发解析全部大文件；一个失败中止整批；完整正文跨 IPC；前端样本充当最终数据 | 队列顺序/去重/错误隔离合同 + 32 条有界样本 + 后端重读原件 | 已实现 |
| ChatGPT 完整导出附件 | ZIP 原件、会话分片、消息附件引用、`.dat` 实体、原文件名、格式和受控落盘路径 | `src-tauri/src/chatgpt_export.rs` | `importer::prepare_import/confirm_import` | ZIP 导入预览、记录来源、角色消息附件、附件卡、完整备份 | 只导入 conversations JSON；按扩展名猜 `.dat`；整包读入内存；页面解析 ZIP；丢弃未关联文件库资产 | 真实 ZIP 只读审计 + 合成 ZIP 端到端 + 路径穿越/大小上限 + 字节哈希 | 已实现 |
| 导入会话展示 | 从保真的 Claude `chat_messages` 或 ChatGPT `mapping/current_node` 中提取当前分支的用户可见文本，隐藏 thinking、reasoning recap、工具调用与废弃分支 | `src/domain/importedContent.ts` / `src-tauri/src/importer.rs` | `readImportedContent` / 导入标题回退 | 详情预览、完整内容弹窗、完整导出、通用标题回退 | 依赖 Codex 临时改正文；按语言删除正文；改写原始 JSON；页面各自解析会话 | 两类结构契约 + 分支/日期/资源回归 + 真实会话弹窗 | 已实现 |
| 会话资源展示 | 保留消息中的图片/文件引用，并只从当前记录受控附件目录解析真实二进制 | `src/domain/importedContent.ts` / `src-tauri/src/attachments.rs` | `ReadableSourceMessage.assets` / `RecordRepository` | 详情角色卡、完整内容弹窗、附件卡 | 从任意本机路径直接渲染；把 UUID 当作已有图片；并发复制全部大附件 | 引用解析契约 + 受控 asset scope + 同名关联 | 已实现 |
| 交互反馈 | 收藏、复制、菜单、设置等按钮操作的统一可见结果 | `App` 的 `notice` | `onNotify` | 顶部菜单、记录操作、标签和详情 | 各按钮自行生成风格不一的临时提示 | 受影响按钮点击后产生一致反馈且自动消退 | 已实现 |
| 记录视图交互状态 | 搜索/标签预设、当前范围、来源筛选、排序、收藏、选中记录与快速定位 | `App` / `RecordRepository.listRecords` | 组件 props 与仓库查询 | 全部记录、我的收藏、持续跟踪、判断更新、标签菜单、详情标题 | 侧栏和列表各存一份业务状态；拖动定位滑块时连续切换记录 | 查询结果、计数、详情与收藏同步；定位只滚动且不改变当前详情 | 已实现 |
| 数据目录与迁移 | 数据库、原文件、附件、导出、备份和日志的受控位置 | `src-tauri/src/paths.rs` / `database.rs` | Tauri commands | 设置、导入、备份恢复 | UI 拼接系统路径；启动时绕过迁移 | 重启后持久化 + integrity_check | 已实现 |
| 原始内容日期 | 导入资料原有的创建/更新时间，独立于导入和本机修改时间 | `database::derive_original_at` / `records.original_at` | `RecordSummary.originalAt` | 列表、详情、排序、日期筛选、导出 | 用导入当天覆盖原始日期；前端各自猜测格式 | ISO/秒/毫秒契约 + 迁移重开 | 已实现 |
| 附件 | 记录关联的本地证据文件，后台复制到受控目录后读取和删除 | `src-tauri/src/attachments.rs` | `RecordRepository.list/add/open/removeAttachment` | 详情附件卡、设置存储统计 | 在线程栈分配大缓冲；页面直接打开原路径；删除受控目录外文件 | 小栈大文件、归档、哈希、关联、打开和删除边界 | 已实现 |
| Markdown 展示 | 保真保存源文本，同时以安全 GFM/Obsidian 子集、类型化 callout 和统一角色卡展示 | `components/MarkdownContent.tsx` | `MarkdownContent` / `AssistantMessageContent` / `ReadableMessageContent` | 当前判断、TXT/Markdown、平台会话、详情、完整内容、历史快照 | 页面各写一套正文格式；把全部 callout 套为同一颜色；父级 flex 误作用于 Markdown 根节点；把英文话题当内部过程删除 | 语义契约 + 生产构建 + 统一会话卡 E2E + 源文不改写 | 已实现 |
| 外部链接与附件打开 | 软件正文地址和受控附件由系统默认应用打开，并在用户点击后申请前台激活 | `components/MarkdownContent.tsx` / `src-tauri/src/external_open.rs` | `open_external_url` / `open_attachment` | 全部 Markdown 阅读界面、附件卡 | 让外站替换主 WebView；经 PowerShell 中转生成后台窗口；页面直接打开任意本机路径 | 安全协议白名单 + canonical 附件边界 + Rust/生产构建；真实默认应用前台行为待最新 BAT 用户确认 | 已实现，待用户环境确认 |
| 单篇完整导出 | 一份完整原文先组成统一 Markdown，再由同一内容生成 Markdown 文件或 DOCX | `domain/recordExport.ts` / `transfer::write_markdown_export/write_docx_export` | `composeRecordMarkdown/createRecordDocx` | 记录快捷操作弹窗、顶部当前记录导出 | 用英文摘要替代原文；复制按钮伪装导出；页面和 DOCX 各拼一套内容；伪装平台分享 | 两种文件落盘合同 + DOCX zip + E2E | 已实现 |
| Codex/Obsidian 交换 | 供人和 Codex 二次整理的可审阅文件层，不取得应用数据所有权 | `transfer::export_records` | `RecordRepository.exportRecords` | 导出中心、Vault、Markdown、JSON | Codex/Obsidian 直接写 SQLite；页面拼装不完整导出 | Vault 结构/附件链接合同 + 再导入走版本路径 | 已实现 |
| 备份恢复 | 数据库备份与完整迁移备份两层合同；完整迁移包含 SQLite、附件、导入原件和界面偏好，并在恢复前创建安全备份 | `src-tauri/src/transfer.rs` | `inspectBackup/restoreBackup`、`create/inspect/restorePortableBackup` | 导出中心、设置恢复弹窗 | 未预览直接覆盖；只复制数据库却宣称可换机；失败后只提示备份位置 | 预览计数 + SQLite 完整性 + 文件/偏好恢复 + 自动回滚测试 | 已实现 |
| 单实例生命周期 | 同一用户会话只允许一个生产进程持有 SQLite 写入口 | `src-tauri/src/lib.rs` 的本机监听守卫 | Tauri 启动流程 | BAT、直接 EXE、未来安装包 | 只由 BAT 检查进程 | 隔离运行第二实例安全退出 | 已实现 |
| 视觉与动效 Token | 颜色、阴影、时长、缓动与卡片层级 | `src/styles.css :root` 与 `.elevated-card` | 共享 CSS 类 | 全部卡片和控件 | 页面私建同类阴影与动效 | 对照稿和交互状态检查 | 已实现 |

## 入口矩阵

| 入口/消费者 | 是否存在 | 当前影响 | 唯一入口 | 最小验证 |
|---|---|---|---|---|
| 新建、复制、永久删除 | 是 | 受影响 | `RecordRepository` | CRUD、回收站与一次明确确认 |
| 编辑当前判断与完整记录 | 是 | 受影响 | 局部补丁命令 / `DetailPanel` / `EditRecordDialog` | 650/800 ms 自动保存、失败草稿、重启重读 |
| ChatGPT ZIP/JSON/Markdown/TXT/HTML 文件批量拖拽与选择导入 | 是 | 受影响且原件保真 | `domain/importQueue.ts` → `RecordRepository` → `src-tauri/src/importer.rs`；ZIP 附件由 `chatgpt_export.rs` | 多路径接收、队列去重、顺序归档、ZIP 分片/附件映射、单项错误隔离、单独映射/自动批量确认 |
| 列表、详情、搜索 | 是 | 受影响 | `RecordRepository` | 搜索与选中、重启后一致 |
| 筛选、排序、收藏、复制导出、菜单 | 是 | 受影响 | `RecordList` / `RecordsWorkspace` / `App.onNotify` | 按钮逐项操作与状态同步 |
| 历史版本 | 是 | 受影响 | `RecordRepository` | 追加、整行打开、删除单个快照、恢复为新版本 |
| 回收站 | 是 | 受影响 | `RecordRepository` | 删除、恢复、确认永久删除 |
| 导出、备份、恢复 | 是 | 受影响 | `src-tauri/src/transfer.rs` | 范围/格式/附件/版本选择、Vault 结构、完整性与安全备份 |
| 附件 | 是 | 受影响 | `src-tauri/src/attachments.rs` | 复制、列表、打开、删除和路径边界 |
| 不同窗口与 DPI | 浏览器与桌面已验 | 受影响 | CSS 响应式规则 / Tauri 窗口 | 浏览器尺寸 + Windows 桌面壳 |
