# 当前交接

## 2026-07-27 正式知识生产 checkpoint（最终回归与文档固化）

- 本地代码 checkpoint：分支 `codex/nanfeng-knowledge-production-checkpoint-20260727`，提交 `bf7d97e`（`feat: checkpoint knowledge production integration`）；未推送远端。
- 当前代码基线保持：正式知识入口、migration v3、`KnowledgeRepository`、分类确认/撤销、主题判断/证据/问题、研究上下文、合并预览/提交/撤销、拆分只读预览和人工确认关系。
- 本轮没有重跑已经完成的 901 条隔离迁移，也没有读写 `D:\南枫知识库`；继续采用既有证据：901 个活动 Record、901 个 Source Item、901 个收录项、446 个附件登记、migration 1/2/3、完整性 `ok`、外键违规 0、第二次运行幂等。
- 最终全量回归：前端 46/46、Rust 53/53、Sites 4/4、Playwright 无界面 16/16、TypeScript 与 Vite 生产构建通过，`git diff --check` 通过。
- 文档已按当前代码事实增量固化：修正 `docs/architecture-governance.md` 与 `docs/test-plan.md` 的旧“仅原型/仓库待建”表述；新增 checkpoint 验收矩阵、经验审计和 `docs/next-codex-prompt.md`。
- 当前仍未完成：正式数据 migration v3、完整迁移备份真实恢复演练、隐藏 Tauri 命令桥与重启持久化验收、FTS5/BM25 生产分类信号、主题别名重定向、拆分提交、安装包和 GitHub 发布。
- 验收矩阵：`docs/audits/2026-07-27-knowledge-production-checkpoint/acceptance-matrix.md`。

## 2026-07-27 正式知识生产链路接入（代码与 901 条隔离副本已验证）

- 进度表述口径已调整：假数据原型、合同代码、构建通过、正式入口接入、隔离数据验证和正式数据验证分别报告，不再统称“阶段完成”。
- 假数据 `/?prototype=knowledge-evolution` 已退出 `src/main.tsx`；正式应用新增收录箱、主题浏览器和整理工作台入口。
- `database::apply_migrations` 已接入知识 migration v3。迁移前自动生成 SQLite 安全备份；旧 `Record` 保留为来源档案兼容层，并幂等生成独立 `Source Item` 进入收录箱。
- 正式 Rust 仓库已接入：领域/主题创建、任意深度主题、收录箱读取、本地确定性分类建议持久化、分类确认与撤销、判断追加快照、证据来源锚点、待验证问题和带来源边界的研究上下文编译。
- 整理工作台已接入真实仓库：主题合并先预览影响，再以事务提交并记录可撤销逆操作；拆分只按真实来源类型生成只读分组预览；关系建议只处理名称完全一致或明确包含的确定性候选，人工确认后才写入。
- 安全与稳定性已修改：远程 Markdown 图片默认阻止自动联网；附件打开和删除均核对 canonical 受控路径；完整迁移备份升级为逐文件 SHA-256 清单；旧版无哈希备份只允许预览；备份空间预检和备份/恢复后台线程已接入。
- 已把 `D:\南枫知识库\data\app.db`、WAL、SHM 只读复制到 `.runtime-qa/knowledge-v3-20260727-qa1/`，只在带隔离标记的副本执行 v3。结果：活动记录 901、Source Item 901、收录箱 901、附件登记 446、migration 1/2/3、`integrity_check=ok`、外键违规 0；第二次执行数量不变且未重复生成来源或迁移备份。
- 当前全量验证：前端 46/46、Rust 53/53、Sites 4/4、无界面 Playwright 16/16、TypeScript 与 Vite 生产构建通过。没有启动桌面窗口；CSP、Tauri 命令到 WebView 的真实桌面链路尚未验收。
- 正式 `D:\南枫知识库` 仍未执行知识 migration v3。本轮没有打包安装器或发布 GitHub。
- 尚未完成：生产分类规则管理与 FTS5/BM25 信号接入、主题合并的别名重定向、拆分提交（规格首版仍只预览）、完整迁移备份恢复演练、正式数据升级和真实桌面运行验收。
- 本轮脱敏验证摘要：`docs/audits/2026-07-27-knowledge-production-integration/summary.md`。

## 2026-07-27 新目录正式迁移与完整数据验证

- 本轮开发与测试的数据根已切换为 `D:\南枫知识库`。应用通过现有 `AppPaths::from_app` 启动迁移完成旧库复制；旧目录 `D:\南枫情报台` 保留为迁移来源，不再作为本轮写入目标。
- 迁移后先通过软件真实界面创建完整迁移备份：`D:\南枫知识库\backups\南枫知识库_完整迁移备份_20260727-040017-240`，共 9 个文件、326,866,501 字节，清单记录 384 条记录。备份完成后侧栏容量未立即刷新，已补充 `getStorageStats` 刷新。
- 随后使用正式 Rust 导入链路处理 `ChatGPT_20260726.zip`：源包 SHA-256 为 `A223D5D9AD25C20AAA871A1D7ABC5D6A6B326B3C1E3827D1261911E19B5630EF`，517 条会话全部导入，活动记录由 384 增至 901，跳过 0。
- 718 个附件实体全部恢复，合计 957,817,814 字节；全部实体逐个核对文件大小和 SHA-256。清单保留 451 条消息关联；数据库登记 446 个“记录 + 内容哈希”附件行，差异来自 5 个同一记录内内容完全相同的重复实体，不是附件丢失。
- 正式导入前数据库备份为 `D:\南枫知识库\backups\ChatGPT完整导入前备份_20260727-041333-810.db`；导入回执为 `D:\南枫知识库\logs\chatgpt-import-de093630-8e29-49b9-99c0-65d759b7d2cd.json`。导入后 `PRAGMA integrity_check=ok`。
- 关闭应用后的最终静态复核：新库 SHA-256 为 `3498C19BCF5B2C985B30115E42E6C9CA35DCD30CA688E3FA59BE6E5BA66A38A0`，活动记录 901、附件登记 446、导入任务状态 `completed`；旧库 SHA-256 仍为 `EA652C6CE813286206CDA9E961D4D62F4094445CF02B72DEBB1DA20D4858CFC7`。
- 桌面调试进程刷新后确认读取 901 条记录，并抽查真实导入记录的附件区可见恢复后的 JPEG。该调试进程不作为最新版交付物，已按用户要求关闭；后续验证只在后台执行，不再占用桌面。
- 备份步进策略已统一到 `database::copy_database`，由旧的 8/16 页 + 20 ms 调整为 512 页 + 1 ms，避免大型数据库迁移和备份产生人为分钟级等待。真实当前大库的完整迁移备份尚未再次创建，避免额外复制约 3 GB；代码合同与正式导入前数据库备份路径均已通过。
- 本轮后台验证：前端 45/45、Rust 48/48、Sites 4/4、Playwright 16/16、TypeScript 与 Vite 生产构建通过。完整脱敏证据见 `docs/audits/2026-07-27-new-data-root-validation/summary.md`。
- 最新后台 release 构建（未启动、未打包安装器）：`src-tauri/target/release/nanfeng-knowledge-base.exe`，14,344,704 字节，SHA-256 `0FE9566D67C0214EDB76446496A322B740E089DFD0B6F407F5EA3D0C56FB4F14`。此前打开的 debug 进程不是该文件，不能作为最新版验收证据。

## 2026-07-27 ChatGPT 完整导出 ZIP 与附件映射

- 用户补充 `conversations-000.json` 至 `conversations-005.json`，共 517 条会话；与旧库分类输入内 100 条 ChatGPT 会话无重叠。合并后分类输入为 901 条，报告位于 `.runtime-qa/knowledge-classification-preview-20260727-chatgpt-complete-v1/`。
- 新增 `src/knowledge/supplementalChatGptInput.ts` 和 `scripts/merge-chatgpt-classification-input.mjs`：按 `conversation_id` 跨文件去重，保留六个源文件 SHA-256 和来源证据，不写正式数据库。
- 新增 `src-tauri/src/chatgpt_export.rs`：完整 ZIP 的唯一解析所有者，负责安全条目校验、六个分片读取、`conversation → message → attachment → .dat` 映射、签名/MIME/文件名联合识别、流式落盘和附件清单。
- 导入器与文件选择器已接受 ChatGPT 完整导出 ZIP。普通文件仍上限 200 MB；完整导出 ZIP 单独上限 2 GB。预览只返回会话/附件汇总和最多 32 条记录样本，确认时从归档 ZIP 重新解析。
- 确认导入后，全部 `.dat` 保存到 `attachments/chatgpt-export-{jobId}/` 并恢复扩展名；`attachment-manifest.json` 保存原条目名、原文件名、SHA-256、MIME 和消息关联。消息直接关联实体会登记到对应记录的 `attachments`，相同物理文件被多条记录引用时删除一个关联不会误删共享文件。
- 附件解包或清单写入中途失败会清理本次新建的半成品目录，避免重试被“目标已存在”阻断。
- 真实 ZIP 只读审计：944,961,948 字节，SHA-256 `A223D5D9AD25C20AAA871A1D7ABC5D6A6B326B3C1E3827D1261911E19B5630EF`；517 条会话、718 个实体、450 个唯一消息附件 ID、451 条消息关联、0 个缺失实体、0 个未知格式。
- 完整脱敏摘要见 `docs/audits/2026-07-27-chatgpt-export-bundle/summary.md`。真实 ZIP 已于新目录完成确认导入和逐实体校验；安装包和 GitHub 发布仍未执行。

## 2026-07-27 隔离副本内容分类预演

- 新增 `src-tauri/src/knowledge/classification_input.rs` 和 `knowledge_classification_input` 示例：只读、流式导出 legacy Record 的分类标准输入，前后核对 `total_changes` 和副本 SHA-256，拒绝覆盖已有产物。
- 新增 `src/knowledge/legacyClassificationDryRun.ts`：内容标准化复用 `readImportedContent`，分类复用唯一入口 `classifySource`，没有在 Rust 或脚本中创建第二套评分规则。
- 新增 `scripts/run-knowledge-classification-dry-run.mjs` 与 `npm run audit:classification`，使用 Vite SSR 加载真实 TypeScript 模块并输出本地 JSON/Markdown 报告。
- 已在 `.runtime-qa/knowledge-migration-preview-20260727-authorized-v4/legacy-readonly-copy.db` 上真实运行。384 条记录中仅 7 条达到 45 分候选阈值，0 条达到确认或自动接受，377 条人工处理；临时目录覆盖率约 1.8%。
- 当前仅有 `prototype-seed-v1` 的 8 个原型 Topic 和 5 条规则，没有正式 Topic、用户确认历史或 FTS5/BM25 外部信号。该结果是目录覆盖审计，不是正式分类。
- 只读证据：副本 `integrity_check=ok`、`total_changes 0 → 0`、前后 SHA-256 均为 `21DEEB5A6292D43989CB2295215FBC0C5954AB2ECAF4C79F656959F7B98CF512`。
- 同一输入在独立目录重跑后 JSON/Markdown 均逐字节一致，证明实际 384 条预演结果可重复；JSON SHA-256 为 `64CE67234F6D05D1AB6C403C05E57DEE36EFAA19F7D1DC30993895925FD57FBA`。
- 脱敏摘要见 `docs/audits/2026-07-27-content-classification-preview/summary.md`；完整报告在 `.runtime-qa/knowledge-classification-preview-20260727-authorized-v1/`，不进入 Git。
- 下一件事不是放宽阈值或继续堆关键词，而是只在隔离材料上生成真实个人主题目录候选，提交用户确认后再重跑分类；正式写入仍需单独授权。

## 2026-07-27 正式旧库只读迁移预检

- 该条记录的是正式迁移前的预检现场：当时实际来源为 `D:\南枫情报台\data\app.db`，新品牌目录尚不存在。2026-07-27 后续已完成迁移，当前测试数据根以本文件顶部“新目录正式迁移与完整数据验证”为准。
- 新增 `src-tauri/src/knowledge/audit.rs` 与 `src-tauri/examples/knowledge_migration_preview.rs`：正式连接固定为 SQLite `READ_ONLY` + `query_only=ON`，在线备份后只对隔离副本运行完整映射预检，并输出 JSON/Markdown 审计报告。
- 最终报告位于 `.runtime-qa/knowledge-migration-preview-20260727-authorized-v4/`；完整真实标题只保留在 Git 忽略目录，仓库内摘要见 `docs/audits/2026-07-27-legacy-migration-preview/summary.md`。
- 结果：活动 Record 384、回收站 0、Source 候选 384、Note 候选 266、Topic 候选 0、未分类 384、坏字段 0；从正文恢复标题 12，仍为通用标题 22，7 组重名涉及 23 条记录。
- 旧库没有任何标签，因此不能按 legacy 标签完成主题迁移。下一步必须先在隔离副本上做内容驱动的确定性分类 dry-run，仍不得写正式库。
- 隔离副本 `integrity_check=ok`，SHA-256 为 `21DEEB5A6292D43989CB2295215FBC0C5954AB2ECAF4C79F656959F7B98CF512`。正式主库与 WAL 的大小和修改时间前后不变；`-shm` 仅因 WAL 只读连接刷新锁元数据时间，未发生业务数据或 schema 写入。

## 2026-07-26 主规格对齐更新

- 新增最高产品规格：`docs/南枫知识库_产品定义与自动分类主规格.md`，文件由用户提供版本原样归档。
- 产品核心已从“扁平研究记录管理”升级为“来源 → 可解释分类 → 主题结构 → 判断演化 → 研究上下文”的本地知识演化系统。
- 知识演化假数据 UI 仍从 `http://127.0.0.1:4173/?prototype=knowledge-evolution` 隔离访问；当前已继续到领域分类与持久化合同验证，但尚未接入正式数据。
- 原型代码位于 `src/prototypes/knowledge-evolution/`，由 `src/main.tsx` 查询参数隔离加载；没有调用 `RecordRepository`，没有写 SQLite，也没有改正式数据。
- 原型已覆盖：四类来源收录箱、五层分类解释、接受/撤销、高置信批处理、主题树、主题知识页、判断时间线、证据、问题、横向关系、研究上下文、合并预览/确认/撤销、拆分只读方案和操作日志。
- 产品与架构对齐见 `docs/spec-alignment-roadmap.md`；交互合同见 `docs/test-plan.md`；现状与原型对照见 `docs/audits/2026-07-26-spec-alignment/audit.md`。
- 当前不得把知识表接入启动 migration，也不得执行正式数据迁移；隔离 schema contract 和只读 dry-run 不改变该边界。

## 2026-07-26 知识领域合同与分类内核

- 新增 `src/knowledge/domain.ts`：Domain、Topic/Subtopic、Source Item、Note、Proposition、Judgment Snapshot、Evidence、Open Question、Turning Point、Decision、TopicRelation 和 OperationLog 的运行时 schema。该文件只定义领域合同，未连接 SQLite。
- 新增 `src/knowledge/deterministicClassifier.ts`：`classifySource` 是分类评分唯一公开入口，算法版本为 `local-rules-v1`。
- 分类内核固定组合显式规则 35、别名与实体 25、全文相关 20、集合相似 10、时间历史 10；阈值严格为 `≥90 auto_eligible`、`≥70 confirm`、`≥45 candidates`、其余 manual。
- 分类器不读系统当前时间、不联网、不调用模型、不写数据库；相同输入按 Topic ID 稳定排序并得到相同结果。
- FTS5/BM25 生产查询尚未接入。未来 SQLite 适配器只提供归一化全文信号，不能成为第二个分类规则所有者。
- 新增 `src/knowledge/classificationFixtures.ts` 固定验收数据；收录箱原型已改为消费真实分类结果，置信度、分数构成、原因和候选不再手工填写。
- 新增 `docs/domain-rules.md`，固化对象职责、主路径/关系边界、分类解释、合并快照和拆分只预览规则。
- 定向验证：知识领域与分类器 12 项测试通过；全量前端 42/42、TypeScript、Vite 生产构建、浏览器 E2E 16/16 通过。
- 本轮没有修改 `src-tauri`、数据库迁移或正式数据。下一件事是设计 Topic/Source/Note 等表和 legacy Record dry-run 映射报告，仍不得直接迁移正式库。

## 2026-07-26 知识持久化合同与旧库迁移预演

- 新增 `src-tauri/src/knowledge/schema.rs`：定义 Domain、Topic、Source Item、Note、Judgment Snapshot、Evidence、Question、分类建议、结构操作、操作日志及 Source/Note FTS5 的未来表合同。
- 表合同只在内存 SQLite 测试中创建；`lib.rs` 仅声明模块，`run()` 和 `database::apply_migrations` 没有调用它，因此不会在启动时修改正式库。
- 新增 `src-tauri/src/knowledge/legacy_preview.rs`：只读扫描旧 `records/record_tags/tags/sources`，输出来源/笔记候选、主题候选、歧义、未分类、回收站和坏字段报告。
- 映射规则固定为：标题不自动成为主题；旧标签仅作候选；单标签仍需确认；多标签标记歧义；回收站默认排除。
- 定向 Rust 测试 5/5 通过：核心表与幂等创建、层级/唯一主主题/分数约束、Source/Note FTS5、旧库映射、报告有界和 `total_changes` 零写入。
- 全量验证：Rust 38/38、前端 42/42、TypeScript、Vite 生产构建、Cargo check 和最终 Playwright 16/16 通过；`git diff --check` 无空白错误。首次并发 E2E 的一个 Escape 关闭断言超时，定向重跑及随后全套重跑均通过，未形成可复现缺陷。
- 该阶段的设计边界与知识结构迁移门槛见 `docs/knowledge-persistence-design.md`；当时没有打开 `D:\南枫知识库`，也没有将 Topic/Source/Note 表接入启动 migration。后续完成的是现有记录库迁移和 ChatGPT 数据导入，不代表知识结构 schema 已正式落库。
- 该授权只读报告已于 2026-07-27 完成。内容驱动分类仍只在隔离材料中验证；Topic/Source/Note 等知识结构在用户确认前不得写入正式库。

## 当前状态

- 产品：南枫知识库 `0.2.0`，本地优先 Windows 桌面；现有来源档案保持可用，知识演化结构已进入正式入口与正式仓库，但正式数据尚未升级到 migration v3。
- 技术：Tauri 2 + React/TypeScript + Rust rusqlite/FTS5。
- 数据所有权：来源档案经 `RecordRepository`、知识结构经 `KnowledgeRepository` 调用 Rust 命令；浏览器无 Tauri 桥接时只显示诚实空状态，不提供假业务数据。
- 当前数据根：`D:\南枫知识库`，活动记录 901；旧 `D:\南枫情报台` 只作为保留的迁移来源。
- 当前交付阶段：新目录迁移和真实完整导入是既有已验证事实；本轮完成知识 schema 的代码接入、正式 UI/仓库接入与 901 条隔离副本验证。正式库 v3、真实桌面验收、安装包和 GitHub 发布仍不属于已完成范围。
- 工作区保护：接手时先检查 Git 状态；不得清理、重置或覆盖未知改动。

## 已实现

- Windows 正式数据默认写入 `D:\南枫知识库`；目标为空时优先从旧版 `D:\南枫情报台`、其次从旧 AppData 使用 SQLite 在线备份一致性复制数据库与受控目录，旧目录保留；新目录不可用或迁移失败时回退旧目录。
- 用户可见品牌、导出文件名、备份选择提示、窗口标题、测试入口与应用图标已统一为“南枫知识库”；Tauri identifier、旧偏好键、旧备份协议和旧环境变量仅作为升级兼容入口保留。
- 品牌更名验证：TypeScript、30 条前端测试、33 条 Rust 测试、12 条 Playwright 核心交互和 Tauri `--no-bundle` release 构建通过；生成 `src-tauri/target/release/nanfeng-knowledge-base.exe`（产品版本 `0.2.0`，SHA-256 `518FF9153060DE92DF434B3854FC88D8C54635E6B7AAC36B850103B13AF20179`）。本轮未安装、未覆盖 GitHub Release，也未写入正式数据库。
- 列表统一使用轻量 `RecordSummary`，不再在启动、搜索或回收站加载完整正文；详情按选择加载并保留小型缓存，列表每次最多渲染 80 条。
- 当前判断、状态和完整编辑器使用局部补丁写入；650/800 ms 自动保存不会回传无关大正文，保存失败显示错误并保留本机判断草稿。
- SQLite 迁移、受控数据目录、记录 CRUD、组合筛选、最近搜索、紧凑列表、收藏、状态、标签、多来源管理与附件。
- 左侧新增“我的收藏”真实视图和计数；收藏命令只返回记录号、状态和更新时间，不再跨进程回传大正文，并阻止同一记录的并发重复点击。
- 正式版始终写入受控 `logs` 目录；Rust panic 额外写入 `panic.log`，便于下一次故障保留可诊断证据。
- 版本追加、完整字段差异对比、恢复为新版本、单个历史快照删除；回收站恢复；永久删除改为一次明确确认，不再要求重输完整标题。
- FTS5 trigram 与 1–2 字 LIKE 回退；标题/判断/摘要/正文分级排序、命中片段、高亮、来源/状态/标签/日期组合筛选。
- 数据库迁移 v2 增加 `original_at`：导入 JSON 优先识别原始创建/更新时间和秒/毫秒时间戳，列表、详情、日期筛选与排序均优先使用原始日期，不再把导入当天误作内容日期。
- JSON/Markdown/TXT/HTML 导入；原文件先归档，再做 SHA-256、编码识别、记录边界、任意字段映射、映射模板、文件哈希/来源 ID/标题日期/标题相似度候选和导入日志。
- 文件选择器和桌面拖拽支持一次加入多个文件；导入中心以最多 100 项的队列依次归档和识别，避免多个大文件并发占用资源。每项可单独检查字段映射，也可将所有已识别文件按自动边界和“跳过重复项”统一导入；单项解析、部分写入或失败有独立状态，不阻断后续文件。
- 导入预览最多跨 IPC 返回 32 条有界映射样本和真实边界计数；确认时 Rust 从已归档原文件重新解析全部内容，结果只返回数量和首条轻量引用。完整正文不会往返 WebView，也不会重复写入导入日志。
- 重复导入支持跳过、新副本、按同标题追加版本和逐条选择；“跳过”只跳过实际重复项，不误伤同批次新记录；预览任务可取消，最近 50 条导入日志可直接查看。
- 导入记录详情可直接读取现有 `summary` 与 `sourceText`：Claude `chat_messages` 和 ChatGPT `mapping/current_node` 两种会话 JSON 都由软件自身确定性整理为用户/助手对话。ChatGPT 只沿当前节点的父链还原实际分支，显示 `text/multimodal_text`，隐藏 thoughts、reasoning recap、工具和废弃分支，并保留消息日期及图片/文件引用。所有原始值仍保留，已有记录升级后直接生效，无需 Codex、模型 API或重新导入。
- 通用导入标题（如 `Conversation Overview`、`Untitled`、`未命名导入记录`）会优先回退到首条用户消息：现有记录仅优化显示、不批量改写数据库；后续导入会直接持久化该标题。
- “导入与导出”分为两个完整工作区；导出支持全部、当前、收藏、当前搜索筛选结果和手动选择，支持 JSON、Markdown 目录与 Obsidian Vault，并可选择附件、历史版本和原文件。
- Vault 导出生成稳定文件名、YAML frontmatter、`.obsidian` 配置和记录间受控附件链接；SQLite 仍是应用唯一数据所有者，Vault 是可审阅、可供 Codex 二次整理的交换层，不允许模型直接改应用数据库。
- 详情、完整内容与编辑预览统一复用同一个 GFM/Obsidian 安全渲染器，支持标题、强调、列表、表格、任务列表、代码块、callout、wikilink 与附件嵌入；callout 保留类型语义，成功/警告/危险/信息/提示/问题/引用分别使用绿/橙/红/蓝/青/紫/中性灰，不再全部套橙色。YAML frontmatter 在阅读视图隐藏，并用于标题回退；详情保留 Markdown 结构并显示约一页（最多 2400 字符），右上角和预览末尾均可进入完整内容，完整内容弹窗默认稳定占应用窗口约 85%。用户与助手在两个界面使用同一套角色卡片。内部英文过程内容默认折叠，英文原话题仍保留并可展开。
- 外部 `http/https/mailto/tel` 链接统一交给系统默认应用打开，不再替换应用主 WebView；软件内所有可滚动区域使用透明轨道的轻量滚动条。
- 整篇笔记只保留“导出 Markdown”和“导出 DOCX”两个可验证入口，内容统一取自完整记录原文并包含判断、事实、证据、问题、行动、备注和来源；桌面端写入受控导出目录，较长成功提示可直接打开原路径，不再伪装成微信、QQ、Telegram 或 ChatGPT 的直接分享。
- Markdown 标题解析按 frontmatter `title`、一级标题、可读 HTML 标题、源文件名依次回退；会跳过 `---`、原始 `<div style=…>`、装饰英文副标题等无效候选。既有错误标题不批量改库，也会在列表、详情和导出界面即时得到正确显示。
- DOCX 生成器会忽略 Markdown 中仅用于源码分段的连续空行，保留标题、列表、表格和段落层级，不再把每个空行转换成独立 Word 空段落。
- 导出页新增“完整迁移备份”：在线备份 SQLite，并归档附件、导入原件和本机界面偏好；设置页可预览并恢复。恢复前自动创建当前状态安全备份，数据库或文件替换失败时尝试自动回滚。
- 会话 JSON 中的图片和文件引用会保留在角色消息下；同名文件归档到当前记录的受控附件目录后自动显示图片或打开附件。附件选择支持多选并顺序归档，降低同时处理多个大文件的内存和卡顿风险。
- 详情附件在后台工作线程复制到受控目录并计算 SHA-256，支持文本、视频等大文件；相同记录的相同附件不会重复归档。此前 1 MB 栈数组导致的 `0xc00000fd` 栈溢出已改为 256 KB 堆缓冲、临时文件清理和原子提交。
- 设置与左栏显示真实数据库、导入归档、附件、备份占用和最近备份时间，不再用记录数伪造容量进度。
- 应用级单实例守卫覆盖 BAT 与直接 EXE；重复启动安全退出，不再并发打开同一 SQLite 写入口。
- 设置页只保留已落地的数据维护、标签管理和真实快捷键入口；已移除无行为的收录箱、外观、提醒与隐私占位项。

## 优先级处理结果

| 优先级 | 范围 | 结果 | 主要证据 |
|---|---|---|---|
| P0 | 收藏/长正文卡死、列表与保存 IPC、并发与异常草稿 | 已处理 | 轻量摘要、局部写入、单实例、panic 日志、草稿恢复、锁库与 1000 条性能合同 |
| P1 | JSON/附件崩溃、原始日期、字段映射、重复策略、版本与恢复 | 已处理 | 后台堆缓冲、原始日期迁移、有界导入样本、Rust 重读原件、完整迁移备份与 32 项 Rust 合同 |
| P2 | 搜索筛选、导入导出、分享、Markdown、滚动、弹层与交互 | 已处理 | Vault/JSON/Markdown/DOCX、整篇分享、统一滚动条、稳定快速定位、12 项 E2E |
| P3 | Codex/Obsidian 边界、话题图标、视觉和交接文档 | 已处理 | 安全交换层、确定性图标分类、纯橙色联动、`platform-release.md` 与本文件 |

当前没有保留为“以后再修”的已知 P0–P3 实现项。安装包不是遗留实现项，而是用户明确要求在 BAT 体验验收后才允许执行的下一阶段动作。

## 验证等级

- 定向契约：前端 Vitest 30/30；Rust 32/32；Sites 4/4；TypeScript 通过。
- 性能与异常合同：1000 条含长正文记录的摘要读取小于 3 秒且序列化小于 1 MB；大 JSON 预览有界、确认后仍从归档原件完整写入且返回结果小于 1 KB；锁库写入失败后完整性仍为 `ok`；无效备份和不可写目标不会返回伪成功。
- 文件合同：错误 JSON 会先归档但不会生成半条记录；UTF-8 BOM 和中文文件名可识别；记录级“跳过重复”只跳过命中项。
- 浏览器 E2E：Playwright 12/12，覆盖搜索/收藏、自动保存与异常草稿、导入映射、无渐变亮橙列表联动、快速定位不切换当前记录、列表菜单直接打开完整内容、85% 完整内容弹窗、完整 Markdown/DOCX 导出与遮罩关闭、导出范围/Vault/完整迁移备份入口、完整编辑器、1366×768、100/150/200% DPI 和常见桌面尺寸。
- 构建：Vite 生产构建、Rust 格式检查和独立目录 Tauri release `--no-bundle` 通过。
- 浏览器运行：收藏、侧栏计数、“我的收藏”单条视图、取消收藏后空视图和详情清空通过。
- 真实 Tauri 桌面：最终 release 在 `.runtime-qa/goal-final-20260725-210054` 的 282 条正式数据只读备份副本上约 377 ms 写出启动日志并保持运行；第二实例退出码为 0。
- 真实 Tauri 桌面：最终收口 release `.runtime-qa/goal-final2-target/release/nanfeng-intelligence.exe` 已再次在同一 282 条隔离副本启动；关闭后 `integrity_check=ok`、记录仍为 282 条。
- 真实 Tauri 桌面：关闭测试进程后副本仍为 282 条，`integrity_check=ok`。
- 浏览器运行：新增、中文搜索、自动保存、版本、回收站、恢复和永久删除路径通过；测试数据已清理。
- 真实 Tauri 桌面：隔离数据目录下完成新建、判断自动保存、重启持久化、单条 Markdown 导出、真实 JSON 文件选择、原文件归档、字段映射、SQLite 写入和数据库备份。
- 真实 Tauri 桌面：使用隔离的 282 条真实导入记录验证列表菜单完整显示、切换标题关闭旧菜单、摘要/原文预览和完整会话弹窗。
- 真实 Tauri 桌面：在 `.runtime-qa/title-fallback-data` 完成通用英文标题 JSON 的预览、字段映射、SQLite 写入和详情展示；再将隔离库标题改回旧值，确认无需重新导入即可显示首条用户问题。
- 视觉：关联线两端锚点圆心与 2 px 水平线同轴；深色侧栏、冷灰底、白卡、底部阴影和卡片动效保持。
- 视觉：原文弹窗遮罩已改为中性灰黑压暗，未改变左侧深蓝导航和内容卡的语义色。
- 视觉：左侧导航默认文字与图标统一白色；选中项恢复红色底层、红色文字和红色焦点反馈。记录列表的选中态、关联线与锚点独立使用更明亮的橙色。
- 视觉：选中记录使用纯色暖白底和亮橙边缘，不使用渐变；详情外框只保留克制的整体橙色边界，记录内容卡与详情面板不再叠加橙色左竖线。两端锚点与线中心对齐并仅在线条离开列表可视区前透明渐隐；左右内容区和所有弹窗使用同一套透明轨道现代滚动条。
- 桌面窗口：下一版默认尺寸为 1702×1066；用户手动调整窗口的行为仍由 Windows/Tauri 正常管理。
- 交互：快速定位滑块只更新列表滚动位置，不再在拖动过程中切换记录、加载详情或叠加平滑滚动；“顶部/当前”按钮执行离散定位。
- BAT 入口：Windows CRLF；最终代码的启动与 `--rebuild` 在 `.runtime-qa/bat-final-data` 隔离目录再次通过，退出码 0、数据库完整性 `ok`。`--rebuild` 会在编译前阻止覆盖仍运行的 EXE；启动器记录 `.runtime-qa/launcher/latest.log` 并以两秒后的真实进程状态判断成功。它只构建独立 release 测试程序，不生成安装包。
- 2026-07-26 BAT 收口：`启动南枫情报台-测试版.bat --rebuild` 生成 `.runtime-qa/test-build/release/nanfeng-intelligence.exe`，并在 `.runtime-qa/bat-final-20260726` 启动；关闭后 `integrity_check=ok`、迁移版本为 `1,2`，启动后 Windows 应用日志新增崩溃事件为 0。
- 真实 Tauri 桌面：使用 `D:\南枫情报台` 的 282 条正式记录打开“港版iPhone绑定汇丰香港Apple Pay可行性评估”，完整内容从实际可见回答开始，内部英文分析不再显示，正文中的 HSBC/Apple Pay 等英文话题词保持。
- 2026-07-26 Markdown/视觉收口：在 `.runtime-qa/real-markdown-20260726` 的正式库在线备份副本（283 条，含回收站）上打开“Mac Pro发热严重且风扇无反应”，详情和完整内容均呈现正常单列标题、段落、编号列表与项目符号；完整内容弹窗实测约 85% 窗口，无窄列挤压和旧尺寸回跳。随后通过 BAT `--rebuild` 启动最终测试 EXE，隔离库 `integrity_check=ok`，本轮 Windows Application Error 1000 新增为 0。
- 2026-07-26 本轮界面与导出收口：1702×1066 浏览器视觉复核确认侧栏红色、记录亮橙、顶部/末尾双入口、短内容自适应和用户/助手角色卡；精确代码已构建到 `.runtime-qa/next-ui-build/release/nanfeng-intelligence.exe`，BAT 已切换到该测试目标。由于检测到一份 14:22 启动的旧进程仍在运行，本轮没有擅自结束它，也没有在同一单实例端口再次启动新 EXE；关闭旧窗口后可直接双击 BAT 验收。
- 2026-07-26 ChatGPT 导入回归修复：只读检查正式库中的 `mapping/current_node` 会话后，软件解析器与 Rust 标题回退均新增该结构；前端回归覆盖当前分支、内部过程过滤、日期、图片引用和首条用户标题。未改写正式数据库。
- 2026-07-26 上一轮映射修复构建（已被下述批量版替代）：`.runtime-qa/mapping-import-build/release/nanfeng-intelligence.exe` 曾为 13,905,408 字节、SHA-256 `52B5A77D36FED68942AF428C3DFF9AF7620CDF8EAE130B5299B3A7AA49F459F2`。
- 2026-07-26 批量拖拽导入：新增顺序队列、路径去重、错误隔离、单独映射和自动批量确认；队列合同覆盖多路径去重、严格串行、单项失败继续和部分成功状态。更新后的 BAT 目标 EXE 为 13,907,456 字节，SHA-256 `00570E4D8F5B19F77A94509F0A9F37C407F62D2617A2F9E5D0CF7E3C6E1F00C2`。旧 `next-ui-build` 进程仍运行，因此未启动新 EXE 写入正式数据库。
- 2026-07-26 Markdown 语义分色：统一阅读器保留 Obsidian callout 类型并使用受控语义色，普通引用回归中性灰；新导入 Markdown 会读取 frontmatter 的 `title` 或首个正文标题，既有标题为 `---` 的记录也在显示层自动修复。更新后的 BAT 目标 EXE 为 13,895,680 字节，SHA-256 `DA2A91335FE149F3F76D51CC4D98A09E465C9F88035EB154AE16F3CA9BDC86BA`。旧 `next-ui-build` 进程仍运行，因此没有擅自启动新 EXE 或写入正式数据库。
- 2026-07-26 发布前功能收口：修复带内联样式 Markdown 的标题回退、移除选中卡片额外粗橙条、统一 Markdown/DOCX 导出按钮阴影、“查看详情”直接打开完整内容，并压缩 DOCX 多余空段落。新增完整迁移备份/预览/恢复/安全回滚闭环；前端 30/30、Rust 32/32、Sites 4/4、Playwright 12/12、TypeScript 与 Vite 生产构建通过。

## 边界与风险

- 早期桌面验收曾使用 `.runtime-qa/favorite-crash-data` 和 `D:\南枫情报台`；这些是历史证据。当前唯一开发测试数据根已变更为 `D:\南枫知识库`。
- 单独的 `conversations-*.json` 只包含图片 UUID、文件名和附件元数据，不能恢复二进制；完整 ChatGPT ZIP 则包含 `.dat` 实体。本轮完整 ZIP 已恢复 718 个实体，普通 JSON 路径仍不会伪造或联网补取原文件。
- 本轮明确写入 `D:\南枫知识库` 完成 517 条会话和 718 个附件实体导入；没有写回或删除 `D:\南枫情报台`，旧库哈希保持不变。
- Windows WER 明确记录过附件操作 `0xc00000fd` 栈溢出；根因是归档函数在线程栈上分配 1 MB 缓冲。当前改为后台线程的堆缓冲，并新增 384 KB 小栈线程处理 4 MB 视频文件的回归测试。仍需用户在正式 BAT 路径连续操作收藏、长记录、导入和不同附件作最终体验验收。
- 恢复预览、回滚和日志由 Rust 测试覆盖，但没有在用户正式数据上执行恢复。
- macOS 只有代码路径与发布边界文档，没有 macOS 构建机、签名、公证或真实设备验证，不能标记为已发布。
- 不把此前的预构建安装包作为当前交付物；必须等用户完成 BAT 试用并明确确认后，再重新生成和验证安装包。

## 继续提示词

使用 `docs/next-codex-prompt.md` 作为唯一冷启动入口。下一轮只先完成隔离完整恢复演练与隐藏 Tauri 命令桥/重启持久化验收；未通过前不得进入正式数据升级、安装包或发布。
