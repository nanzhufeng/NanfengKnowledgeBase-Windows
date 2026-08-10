# 架构所有权

项目遵循根级 `docs/app-development/architecture-baseline.md`。当前最高产品规格已把核心从“记录管理”升级为“知识演化”。下表描述当前代码事实；migration v3–v6 的正式数据验证必须分层报告，不能由“代码已接入”推断。

## 当前合同判定顺序

1. 当前代码与最新真实证据决定“现在实际是什么”。
2. 产品主规格拥有产品目标、知识对象、自动分类和数据安全；`product-brief.md`拥有现行入口与产品边界；本文件拥有概念和实现所有者；设计基线拥有页面、材质和交互；验收矩阵与`CURRENT_HANDOFF.md`只记录当前验证状态。
3. 用户可见名称固定为`主题洞察 / 全部笔记 / 主题管理`。`knowledge / sources / Record / 来源档案 / 知识视图`只允许作为内部兼容标识或历史证据，不得反向定义界面。
4. 历史截图、旧 BAT、旧隔离包、旧版本号和编号历史项不拥有现行规则；若与当前所有者冲突，只保留证据意义并明确标为已替代。

## 知识生产模型（正式代码已接入，正式数据已升级）

| 概念 | 唯一产品含义 | 规则与持久化所有者 | 公开入口 | 主要消费者 | 禁止的平行规则 | 当前证据 |
|---|---|---|---|---|---|---|
| Domain | 稳定顶层领域 | `src/knowledge/domain.ts`、`src-tauri/src/knowledge/schema.rs`、`knowledge/repository.rs` | `create/update/listDomains` | 主题管理、主题洞察 | 页面用标签临时模拟领域；重建对象实现改名 | 创建与编辑命令已接入；改名保留 ID |
| Topic / Subtopic | 长期主题、唯一主路径和横向关系 | `knowledge/repository.rs` | `create/update/listTopics/getTopicDetail` | 主题管理、主题洞察 | 用 Record 标题自动生成主题；改名时新建平行主题 | 正式仓库与 UI 已接入；改名保留 ID；合并旧名称和旧路径写入 redirect 别名且撤销可逆 |
| Topic Structural Attention | 哪些主题存在需要用户操作的真实结构缺口 | `src/knowledge/topicStructurePolicy.ts` | `collectTopicStructuralAttentionIds` | 主题管理的待处理筛选、首屏待处理事项和高级维护统计 | 各页面自行把`sourceCount === 0`或缺少技术规则解释成用户任务；让用户逐个判断保留、合并、删除或补规则 | 零来源是中性状态，分类规则由系统持有；只由边界、别名或明确关系建议进入待处理 |
| Topic Hierarchy Presentation | 主题详情中何时存在值得展示的父子层级 | `src/knowledge/topicStructurePolicy.ts` | `topicHierarchyHasUsefulContent` | 主题管理详情的`主题层级`区 | 固定展示“直属 / 暂无 / 0个”占位；在多个区块重复关系建议和知识对象统计 | 顶层叶子主题隐藏整块；有真实父主题或子主题时只显示实际层级，重复信息回到各自唯一展示区 |
| Source Item | 保真的导入来源和分类对象 | `importer.rs`、`knowledge/repository.rs` | `listSourceArchive/listInbox`、migration v3 legacy backfill | 全部笔记、主题来源、证据 | 覆盖原件；把来源等同于笔记 | 全部笔记同时读取已归类和待确认来源；无正文空会话默认隐藏但不删除 |
| Source Collection | 三个可见列表统一显示和筛选的来源目录；一篇笔记可保留多个导入原件 | `knowledge/source_identity.rs`、`knowledge/repository.rs` | `listSourceCollections/renameSourceCollection`、migration v5 backfill | 全部笔记、收藏、跟踪、组合筛选；历史`updated`记录仅兼容消费 | 用文件名、类型或页面私有映射生成来源；重命名覆盖原件；重复导入新增第二篇笔记；恢复判断更新人工入口 | 统一目录+多 origin；重命名只改显示；提供方 ID/可见正文精确去重；前端与Rust合同 | 已实现，正式v5待授权 |
| Note | 人工整理与补充说明 | `knowledge/repository.rs` | `create/update/archive/list/getNote` | 主题知识页、研究上下文 | 与原始来源共用可覆盖正文 | 独立 CRUD、软归档、主题/来源关联和 FTS 同步已验证 |
| Judgment Snapshot | 某时点判断、置信度和变化原因 | `knowledge/repository.rs` | `addTopicJudgment/getTopicDetail` | 主题页、时间线、上下文 | 覆盖旧判断冒充时间线 | 追加写入和读取已接入 |
| Evidence | 命题的支持/反驳关系、来源锚点和事实有效期 | `knowledge/repository.rs` | `addTopicEvidence/getTopicDetail` | 主题洞察、上下文 | 无来源证据；页面各自标强弱或保存任意 JSON；默认永久有效 | 立场/可信度/验证/有效状态分离；可关联命题；锚点按来源类型校验并规范化 |
| Open Question | 待验证问题及状态 | `knowledge/repository.rs` | `addTopicQuestion/getTopicDetail` | 主题页、上下文 | 与普通待办混用 | 正式命令已接入 |
| Classification Suggestion | 来源到主题的候选、分数、理由和状态 | 可读正文投影：`knowledge/readable_text.rs`；评分：`deterministicClassifier.ts`；编排：`knowledgeAutoOrganizer.ts`；持久化输入/确认：`knowledge/repository.rs` | `prepare/save/list/confirm/undoClassification` | 导入完成、历史待整理升级、全部笔记例外队列 | 用原始 JSON 元数据分类；分类器直接写库；页面复制评分规则；用 0 分候选填充界面 | 自动分类优先；BM25 必须有可见短语；无直接证据或低于 45 分不展示；最高候选严格 >65 时自动确认并可撤销，45–65 只保存候选 |
| 新笔记自动整理编排 | 新导入与中断恢复必须经过同一串行队列，完成后刷新主题洞察读取模型 | `App.organizeImportedKnowledge`与`knowledgeOrganizationQueue`唯一持有任务编排；`knowledgeAutoOrganizer.ts`持有分类裁决 | `onOrganizeImportedSources / upgradeOutdatedInboxSuggestions` | 批量导入、字段映射导入、应用启动恢复、主题洞察、全部笔记 | 两个导入页各自异步分类；只有进入全部笔记才补偿；用判断更新入口要求用户处理 | 新ID即时自动整理；失败由持久化算法版本标记在下次启动续接；完成后递增revision刷新已打开读取模型 | 已实现，正式导入待验证 |
| Classification Exclusion Presentation | 主题级排除信号用于降低误归类，不删除来源，也不构成普通用户待补资料 | 默认规则由`personal_catalog.rs`持有；评分语义由`deterministicClassifier.ts`持有；主题页只读投影由`TopicStructureReadingWorkspace.tsx`持有；完整编辑仅在高级结构维护 | 目录升级下发保守排除信号；有有效项时显示`自动排除`摘要 | 主题管理详情、分类解释 | 空规则显示占位卡；在日常页要求用户补充、调整或维护技术规则；把排除误解为删除 | v7为非职业主题托管`招聘启事/岗位职责/简历投递`0.55排除信号，职业主题不排除；无规则时整块隐藏；36条knowledge Rust合同 + 前端呈现/E2E通过 |
| Structural Operation | 合并、拆分、关系和撤销 | `knowledge/repository.rs` | `preview/merge/undoTopicMerge`、`previewTopicSplit`、`suggest/createTopicRelation` | 主题管理高级维护、操作日志 | 无预览直接批量改外键 | 合并、redirect 和撤销已实现；拆分按首版边界仍只预览；界面默认折叠 |
| Research Context | 本地可审阅的研究上下文 | `knowledge/repository.rs` | `compileTopicContext` | 主题页、导出/后续 Codex 交换 | 调模型生成不透明摘要 | 本地确定性编译已接入 |
| AI Topic Insight | 对单主题上下文进行结构化总结、证据边界梳理和主题管理建议的可重建派生层；在主题洞察首屏拥有AI总览展示，本地规则摘要仅作默认折叠的离线核对底座 | `src-tauri/src/ai/*`、migration v6、`src/services/aiRepository.ts`；`knowledge::repository::compile_topic_context`唯一编译正式对象、来源边界和有界来源正文；`src/aiInsightPresentation.ts`唯一分离总览与来源范围；右侧滚动与分层展示由`KnowledgeReadingWorkspace.tsx`唯一持有 | `get/saveAiSettings`、`revealAiApiKey`、`refreshAiModels`、`get/runAiTopicInsight` | 设置、主题洞察 | 页面常态持有或自动返回明文API Key；模型结果覆盖人工对象；每页各自请求模型；OpenAI/Claude直连；AI与本地摘要同时固定展开形成两个首屏所有者；只把来源标题传给模型；来源ID清单在总览正文逐条铺开 | OpenRouter/DeepSeek两通道；凭据进Windows凭据库，普通设置只读配置状态，用户点击眼睛才通过独立命令临时读取；结果与逐任务Token/费用落独立表。AI上下文消费主题来源`content_text`，保留来源ID，并受20条/单条4000字符/正文区60000字符/整体72000字符边界约束；旧结果仅在显式重新整理后更新。展示层自动分离旧结果中的来源/证据边界，置于AI卡末端并默认折叠为`来源范围 N 条`；新提示禁止在总览中生成该清单。AI、本地分析和深读正文共用唯一滚动区。代码、102项Rust、230项前端、生产构建和1702×1066 E2E通过；真实API与正式WebView2待确认 |
| AI Topic Batch | 对所有未合并主题执行一键AI整理的轻量调度；每个主题仍是独立任务、独立账单和独立派生结果 | `src/aiTopicBatch.ts`唯一持有筛选、串行顺序、逐项状态、短间隔、瞬时错误一次重试、失败隔离与结果；`KnowledgeWorkspace.tsx`协调当前主题刷新和结果；`KnowledgeReadingWorkspace.tsx`显示持久过程/结果弹窗；`ai/client.rs`唯一复用HTTP连接与请求超时 | 逐个复用`AiRepository.runTopicInsight(topicId)`，不新增后端批量协议 | 主题洞察标题动作区 | 只改变按钮文字；每个主题重建HTTP客户端/TLS连接；并发轰炸；无限重试；失败即中断；自动消失或把部分成功说成全部完成 | 点击后立即显示完整队列和逐项状态；过滤`merged`后串行执行并间隔650ms；连接、超时、响应解析、结构或空总结失败自动重试一次，401/403不重试；全部成功才报告成功，最终失败保留原始错误并可定向重试。前端234项、Rust103项、真实组件进度/失败/重试E2E、生产构建和v101隔离程序通过；真实API长批次改善幅度待南烛枫确认 |
| Proposition / Competing Hypothesis | 可复用命题；同一假设组允许并列竞争，不强制唯一结论 | `knowledge/repository.rs` | `create/update/supersedeProposition/getTopicDetail` | 主题洞察、判断、证据、决策账本、研究上下文 | 从展示文本临时推断身份；用新结论覆盖旧假设 | 独立生命周期、假设组、置信度、推翻条件和有效期已接入 |
| Turning Point | 用户明确确认的判断转折 | `knowledge/repository.rs` | `createTurningPoint/getTopicDetail` | 主题洞察、研究上下文 | 填写变化原因自动制造转折 | 必须显式选择前后判断并确认 |
| Decision Ledger | 当时决策、依据、风险、行动、结果与复盘 | `knowledge/repository.rs` | `create/updateDecision/getTopicDetail` | 主题洞察、研究上下文 | 用普通笔记模拟决策；结果覆盖当时依据 | 可关联命题和判断；结果状态、复核日期与复盘独立保存 |

### 运行与数据边界

- `database::apply_migrations` 已接入 migration v3–v6：正式文件库存在旧迁移时，应用最新迁移前先生成 SQLite online backup；v6只追加 AI 设置、目录、任务账单和主题洞察派生表，不改写来源正文、人工判断或证据。
- `src/services/knowledgeRepository.ts` 是 WebView 到 Rust 知识命令的唯一前端适配器；浏览器无 Tauri 桥接时只显示诚实空状态。
- `legacy_preview.rs`、`audit.rs` 和 `classification_input.rs` 继续承担只读审计与隔离预演，不是第二套生产写入口。
- `.runtime-qa/knowledge-v3-20260727-qa1/` 已验证 901 条隔离 migration v3；`.runtime-qa/portable-recovery-20260727-qa4/` 已验证完整恢复和失败自动回滚；`.runtime-qa/hidden-tauri-bridge-20260727-qa1/` 已验证隐藏 Tauri/WebView2 正式命令桥和强制进程重启后的持久化。
- `.runtime-qa/hidden-knowledge-production-20260727-qa4/` 进一步验证 Note、Proposition、Evidence、Judgment 和 Turning Point 经真实隐藏 IPC 写入并在强制重启后按 ID 读回，外键违规为 0。
- 正式 `D:\南枫知识库` 已执行 v3，并完成升级前完整备份、第二次打开幂等和独立只读复核。v4 当前尚未声称正式执行；后续 BAT 用户验收与正式数据复核必须单独记录。

目标数据链路固定为：

```text
原件归档
→ 内容提取与标准化
→ 来源读取模型
→ 确定性分类建议
→ 高置信自动接受；冲突和低置信进入例外确认
→ 主题/关系写入
→ 领域/主题/命题成果读模型
→ 竞争假设、判断、证据有效期、决策账本和关键转折
→ 研究上下文编译
```

任何真实实现都不得把分类提前到内容提取之前。

## 核心工作区设计所有权

| 设计概念 | 唯一所有者 | 已锁定范围 | 禁止的平行解释 | 最小验证 |
|---|---|---|---|---|
| 三入口产品组织 | `product-brief.md` 与最高产品规格 | `全部笔记 / 主题管理 / 主题洞察`，自动化优先、人工仅处理例外 | 恢复收录箱/整理工作台为并列主入口；用 CRUD 表单替代成果阅读 | 三入口真实可导航，默认路径不要求逐条人工分类 |
| 核心页面功能布局 | `core-workspace-design-baseline.md` | 四张最终页面图中的模块、主次、默认状态、切换和滚动 | 以旧原型、临时中间 UI 或皮肤预览覆盖最终布局 | 同视口逐页结构对照 + 关键交互路径 |
| 四套视觉皮肤 | `src/theme/knowledgeSkins.ts` 与项目视觉契约 | 沙漠灯笼、花房、奔马、原版浅色；共同使用同一外框几何 | 恢复铜金发簪或增加替代皮肤；让背景综合色重染冷白卡；借皮肤改变页面结构 | 四套逐套切换、重开保持、几何一致、无破边和空白区误模糊 |
| 动态场景文字可读性 | `src/theme/knowledgeSkins.ts`的`deriveAdaptiveScenePalette`与`App`注入的场景/表面语义 Token | 场景标题、说明、加载态按背景明暗和冷暖动态反向；冷白磨砂内使用独立深色表面文字 | 页面写死某套背景颜色；把图片前景色复用到冷白卡片；用单页选择器修同一规则 | 四组明暗/冷暖对比合同 + 页面消费者静态合同 + 四套皮肤同视口可见检查 |
| 场景材质基线 | `src/styles.css`的当前固定共享材质配方、局部精细化及全入口前景卡明度角色；`src/theme/knowledgeSkins.ts`只拥有场景文字可读性 | 承托、卡片一/二/三、嵌套内容与控制面固定使用设计基线标为现行的渐变、透明度、中性抖动和外层单次模糊；2026-08-09真实WebView2反馈替代v61低曝光RGB幅度，三套场景皮肤的前景内容/列表/判断卡通过共享中性珍珠色值统一提亮，保持原透明度、边缘和几何；主题整合主要来源阅读卡、原版浅色及大承托层显式保真 | 运行时重算卡片RGB/透明度；提高大承托层整体白色覆盖率；用蓝绿补色；恢复内部第二次`backdrop-filter`；使用闭环白描边或2px双向mask；为某入口另建材质；把主要来源正文、浮层或弹窗纳入本轮提亮；让历史版本号取得规则所有权 | 固定材质精确静态合同 + 全入口前景消费者合同 + 主要来源/原版浅色/大承托保真合同 + 无动态材质Token/无mask/无内部二次滤镜合同 + 四皮肤同视口检查 |
| 设计确认状态 | `core-workspace-acceptance-matrix.md` | 设计确认、UI 集成、自动契约、构建、BAT 分层记录 | 把预览确认、后端对象存在或构建通过说成最终页面已落地 | 每个页面每个验证层级有可定位证据 |
| 跨项目开发设计引用 | `design-system.md` | 只负责把现行产品体验、材质、交互、平台适配、自然语言反馈和验收规则路由给其他项目；精确项目事实继续由设计基线、验收矩阵和本所有权表持有 | 复制第二套项目基线；把知识库业务、固定尺寸、背景图、数据结构或旧证据默认带入其他项目；只取色板和透明度却遗漏交互 | 本地链接检查 + 引用合同覆盖六层锁定、继承/不继承项、平台转换与证据分层 |

## 记录型生产模型（兼容基础设施）

以下所有者描述当前已运行的记录型生产链路。它们仍要维护，但不是知识模型；不得继续用新增字段扩大 `Record` 聚合职责。

| 概念 | 产品含义 | 唯一所有者 | 公开入口 | 当前消费者 | 禁止的平行规则 | 最小验证 | 状态 |
|---|---|---|---|---|---|---|---|
| 研究记录 | 判断、事实、证据、问题、行动、标签与来源的聚合根 | `src-tauri/src/database.rs` | `RecordRepository` | 列表、详情、搜索、版本、导入导出 | 页面直接 SQL；各页面复制记录状态 | Rust CRUD 测试 + 仓库契约 + 运行路径 | 已实现 |
| 当前判断编辑状态 | 阅读、编辑、自动保存和版本中的同一段判断 | `database::update_current_judgment` 与本机草稿键 | `RecordRepository.updateCurrentJudgment` | 判断卡、顶部保存状态、版本快照 | 用完整记录往返保存短字段；失败仍显示已保存 | 自动保存、失败草稿和重启恢复 | 已实现 |
| 记录列表读取模型 | 搜索、筛选和列表只消费轻量摘要，详情正文按选择加载 | `database::list_record_summaries` | `RecordRepository.listRecordSummaries` | 全部记录、收藏、跟踪、更新、回收站 | 列表加载完整正文；前端二次删除后端搜索命中 | 1000 条性能合同 + 正文命中搜索 + E2E | 已实现 |
| 来源附件完整目录、默认加载、媒体/文本预览与原文件定位 | 历史资料筛选读取“正文声明目录 + 已受控实体”的并集；当前笔记按来源与附件唯一ID顺序物化缺失实体，单项失败不阻断；目录、月份组和卡片壳立即完整呈现，实际媒体渲染器按接近可视范围有界挂载；所有受控格式按附件ID定位原文件 | `attachments::search_source_attachment_catalog / hydrate_source_attachments / recover_source_attachment`唯一持有目录与安全提取；`read_attachment_text`唯一持有受控文本读取；`reveal_attachment + external_open::reveal_path`唯一持有路径校验与系统文件管理器定位；`SourceAttachmentAsset`负责有界原位编排；`AttachmentTimelineMediaCard`、`AttachmentTextPreview`、`AttachmentLocateButton`和`AttachmentPreview`分别持有缩略图、文本、定位和最高层预览 | `KnowledgeRepository.searchSourceAttachmentCatalog / hydrateSourceAttachments`、`RecordRepository.revealAttachment`与Tauri`read_attachment_text / reveal_attachment` | 全部笔记来源正文、来源详情弹窗、最高层预览、全部/图片/视频/音频/文件时间线 | 只查询已物化表；逐个点击恢复；一个失败终止全批；把“默认存在”实现成全页eager解码；音视频preload auto；Markdown走原始iframe；页面传入任意本机路径 | 未物化声明分类Rust合同 + 批量容错/幂等合同 + Markdown双入口合同 + 可视范围有界挂载压力E2E + 目录外附件拒绝定位合同 + TypeScript/Vite + 中文BAT真实数据验收 | 已实现，真实WebView2多格式长笔记、声音与Explorer选中文件待验收 |
| 交互性能调度 | 点击、搜索、滚动和页面切换不得被数据库、目录维护、历史分类、重复 IPC、重复解析或高频几何测量阻塞 | `knowledgeWorkspaceData.ts`、`classificationWorker.ts`、`classification.worker.ts`、`interactionScheduler.ts`、`KnowledgeRepository`、`useRafScheduledCallback.ts`、`connectionGeometry.ts` | 入口首屏/补充/维护分层、Worker 分类、可取消空闲任务、合并读取、延后输入、帧调度 | 三个核心入口、四个统一笔记列表、长正文与关联线 | 在来源点击链应用目录并读取全部维护对象；WebView 主线程批量分类；只靠减少列表数量；页面重复读取；scroll/ResizeObserver 直接高频更新 | 177 项前端合同 + 入口所有权/取消合同 + 独立 Worker 产物 + Vite/v45 Tauri 构建 + Playwright 16/17；剩余 1 条既有阅读区横溢出单列 | 已实现，待正式数据桌面流畅度确认 |
| 固定行高虚拟列表生命周期 | 条件渲染的列表只有在真实滚动容器挂载后才能测量视口；入口切换必须重新绑定 ResizeObserver，零高度只能作为瞬时保底，不能成为稳定呈现 | `performance/fixedVirtualList.ts` | `useFixedVirtualList({ enabled })` | 卡二全部笔记，以及普通记录/收藏/跟踪的固定行高列表 | 只增加加载数量；用CSS伪造高度；在ref尚为空时测量一次后永不重试；长期停留在`1+6`个保底行 | 条件挂载静态合同 + 1702×1066定向E2E断言最后渲染行覆盖滚动视口底边 + TypeScript/Vite/v85隔离桌面构建 | 已实现，待正式WebView2确认 |
| 单篇笔记列表操作 | 三个可见列表入口提供收藏、完整导出和更多操作；鼠标悬停显示，选中或卡片自身焦点不常驻，操作按钮键盘焦点与菜单展开时保持显示 | `components/NoteListActions.tsx`负责呈现；`UnifiedNoteListCard + styles.css`唯一持有可见性；`App`记录操作回调负责行为 | `NoteListActions` | 全部笔记、我的收藏、持续跟踪 | 每个页面复制图标、菜单或可见性规则；用选中态或卡片`:focus-within`触发常驻显示；恢复判断更新人工入口 | 共享组件静态合同 + 选中隐藏/悬停选择器/操作焦点/菜单展开状态 + TypeScript/Vite + 可见桌面交互 | 已实现，待桌面悬停确认 |
| 三入口列表呈现 | 全部笔记、我的收藏、持续跟踪共用日期、紧凑度、图标、标题/元数据空间、筛选和显示工具栏规则；控制区均位于列表滚动层之外 | `components/UnifiedNoteListCard.tsx`与`styles.css`；共享筛选字段工厂唯一持有来源/记录状态/主题/日期定义和匹配；`UnifiedNoteListPanel`唯一持有外壳圆角与裁切 | `UnifiedNoteListPanel / SearchRow / Card / Filter / DisplayToolbar / Toolbar / Locator` | 全部笔记、我的收藏、持续跟踪 | 页面私建`sticky`筛选层、滚动遮罩伪元素或负边距覆盖滚动条；只统一浮层外壳却允许页面复制字段和匹配规则；为了右贴压缩左摘要；恢复判断更新人工入口 | 三入口字段矩阵 + 控制区在滚动层外的结构合同 + 真实来源匹配 + 兼容记录状态 + 同一正式主题目录 + 120/999计数DOM几何 + 1702×1066桌面复核 | 已实现；v73真实桌面待复核 |
| 领域主题层级列表 | 主题洞察与主题管理共用领域卡、主题行、折叠、层级缩进、数量列、选中态和滚动 | `components/KnowledgeTopicHierarchy.tsx` | `KnowledgeTopicHierarchy` | 主题洞察、主题管理 | 两页复制相似 JSX/CSS；各自解释领域数量、空态或折叠；只靠共享 CSS 假装统一 | 两个消费者静态合同 + 共享组件状态/结构合同 + TypeScript/Vite + 1702×1066可见核对 | 已实现，待正式桌面确认 |
| 知识首屏摘要 | 当前判断、事实与线索、关键证据、待验证问题和建议下一步的统一只读模型 | `src/knowledge/knowledgeSynthesis.ts` | `buildKnowledgeOverview` | 主题洞察标题区与四状态导航 | UI分别拼装空卡；来源标题/数量冒充结论；自动建议写回正式对象；事实与证据重复同一文本 | 正式对象优先 + 真实正文确定性回退 + 来源锚点 + 纯函数测试 + 1702×1066首屏几何E2E | 已实现，待正式桌面确认 |
| 知识摘要完整阅读 | 四张摘要卡共用一个完整内容弹窗，卡片只承担两条预览，弹窗逐条展示当前类别全部文本并提供对应状态深读入口 | `components/KnowledgeReadingWorkspace.tsx`与`styles.css` | `KnowledgeOverviewDialogState / openOverviewDialog` | 事实与线索、关键证据、待验证问题、建议下一步 | 四张卡各自复制弹窗；查看按钮直接跳页却无法读取完整文本；弹窗继续使用单行省略；把弹窗作为第五个知识状态 | 四消费者静态合同 + 完整列表无切片 + Escape/遮罩/焦点恢复 + TypeScript/Vite + 中文BAT桌面复核 | 已实现，待正式桌面确认 |
| 知识四态正文层级与小字密度 | Tab只负责状态身份，状态内对象组件负责对象标题、筛选和空态；辅助小字只服务判断、定位或操作 | `components/KnowledgeReadingWorkspace.tsx`与`styles.css` | `data-reading-mode / data-reading-section` | 竞争假设、判断演变、主题整合、决策版本 | 复制眉题、编号步骤卡、阅读方法或职责说明；重复Tab计数；显示技术实现说明、无价值占位或四格空字段；删除说明时连同有效日期/来源/状态一起删除 | 四态静态合同 + 小字禁用清单 + 直接内容起始几何 + TypeScript/Vite + 中文BAT桌面复核 | 已实现，待正式桌面确认 |
| 主题整合阅读模型 | 主题洞察只呈现一个主题成果；原始笔记与来源承担输入、当前页正文切换和回溯；右侧来源项保持完整信息并独立滚动 | `src/knowledge/knowledgeSynthesis.ts`负责整合模型；`components/KnowledgeReadingWorkspace.tsx`唯一持有来源项点击边界与局部选中态；`styles.css`唯一持有来源列行高与滚动 | `buildKnowledgeTopicIntegration`、`.knowledge-final-source-list`、`.knowledge-final-source-switch / .knowledge-final-source-open` | 主题洞察主题整合态、来源反向定位 | 把数据库`KnowledgeNote`直接暴露为独立笔记索引；整卡点击离开主题洞察；把单一来源伪装成成熟主题；无正式笔记时保留空白列；数量增加时压缩Grid行并裁切元数据 | 正式整理分段合并 + 多来源确定性整合 + 单来源待聚合 + 每卡完整标题/元数据 + 列表独立滚动 + 主体原位切换/图标独立跳转 + 不写库 + 纯函数/组件/E2E合同 | 已实现，待正式桌面确认 |
| 自动知识草案 | 正式对象缺失时，从真实正文生成可独立阅读、可追溯且不冒充人工确认的假设、判断、问题与决策建议 | `src/knowledge/knowledgeSynthesis.ts` | `splitSemanticUnits / buildKnowledgeSynthesis` | 主题洞察四状态与统一摘要 | 把聊天收尾或上下文残句当知识；用固定字符截断正文做标题；用无关正文冒充形成依据或预期结果；自动写回正式对象 | 对话服务话术/承接残句过滤 + 完整句回归样本 + 来源型标题 + `形成依据/待确认建议/未执行/待回写`状态合同 + 不写库 | 已实现，待真实内容桌面确认 |
| 卡片关联线几何 | 所有关联线都表达左侧选中卡片到右侧阅读卡片的明确关系 | `src/connectionGeometry.ts`负责端点与线宽；`styles.css`的统一关联目标样式负责右卡闭合橙框 | `measureCardToCardConnector` / `association-link-target` | 全部记录、全部笔记、主题洞察、主题管理 | 各页面自行使用`-2/+4`像素补偿；线段伸入卡片；右侧卡片只有圆点没有完整橙色边框 | 纯函数端点合同 + 四类消费者 TypeScript/Vite + 同视口可见核对 | 已实现，待桌面确认 |
| 页面导航状态 | 全部笔记、主题管理、主题洞察及兼容记录工具的当前位置 | `App` 的 `page` | `Sidebar.onNavigate` | 主区域页面选择 | 各页面自行修改侧栏状态；恢复重复的收录箱/整理工作台入口 | 导航与可见页面一致 | 已实现 |
| 全部笔记打开位置与返回上下文 | 跨页请求只负责打开目标笔记；每次普通打开、跨页打开或切换笔记都从正文顶部开始，只有用户在正文搜索框提交本次关键词后才允许定位 | 一次性打开请求由`App.knowledgeSourceTarget`持有并在选中目标后立即消费；返回上下文由`App.knowledgeSourceReturnTarget`唯一持有；正文查询、历史、高亮和滚动由`KnowledgeWorkspace`持有 | `onNavigateToSource / onReturnFromSource / onSourceNavigationHandled / searchSourceText` | 四个主题洞察面板→全部笔记→原面板原来源；直接进入全部笔记→竞争假设对应来源；正文搜索历史只回填输入 | 把旧证据锚点当成自动滚动指令；页面重放历史查询；用`scrollIntoView`带动祖先卡片；点击历史词立即定位 | 四面板从哪里进入就回哪里；所有笔记默认正文顶部且无旧高亮；只有手动提交正文搜索才滚动；历史与卡二历史分键保存 | 已实现，待正式桌面确认 |
| 全部笔记全库搜索与标题 | 全库搜索必须覆盖未加载来源的标题、主题元数据与完整原文；用户显式标题修改同步来源对象和兼容 Record | `knowledge/repository.rs` | `count/searchSourceArchive`、`updateSourceTitle` | 全部笔记搜索、搜索历史、全部加载、标题编辑 | 只过滤当前120条摘要；把全部正文先传前端；标题只改界面状态 | FTS/短词回退 Rust 合同 + Repository schema + E2E 正文命中/历史回显 + 标题往返 | 已实现，待正式数据桌面确认 |
| 文件导入 | 单个或批量文件的原件归档、标题恢复、哈希、限量预览、可编辑映射、精确内容去重和完整写入 | `src-tauri/src/importer.rs` / `knowledge/readable_text.rs` / `knowledge/source_identity.rs` / `domain/importMapping.ts` / `domain/importQueue.ts` | `RecordRepository.prepareImport/confirmImport/cancelImport` | 批量拖拽队列、文件选择、单文件映射、自动批量确认、导入日志、历史通用标题回填 | 把正文首个日期当标题；按文件名或相似标题自动删除；重复包生成重复笔记；一个失败中止整批 | 标题优先级与历史回填 + 提供方ID/可见正文身份 + 跨容器一笔记多origin + 队列/错误隔离 | 已实现，正式数据待验证 |
| ChatGPT 完整导出附件 | ZIP 原件、会话分片、消息附件引用、`.dat` 实体、原文件名、格式和受控落盘路径 | `src-tauri/src/chatgpt_export.rs` | `importer::prepare_import/confirm_import` | ZIP 导入预览、记录来源、角色消息附件、附件卡、完整备份 | 只导入 conversations JSON；按扩展名猜 `.dat`；整包读入内存；页面解析 ZIP；丢弃未关联文件库资产 | 真实 ZIP 只读审计 + 合成 ZIP 端到端 + 路径穿越/大小上限 + 字节哈希 | 已实现 |
| 导入会话展示 | 从保真的 Claude `chat_messages` 或 ChatGPT `mapping/current_node` 中提取当前分支的用户可见文本，隐藏 thinking、reasoning recap、工具调用与废弃分支 | `src/domain/importedContent.ts` / `src-tauri/src/importer.rs` | `readImportedContent` / 导入标题回退 | 详情预览、完整内容弹窗、完整导出、通用标题回退 | 依赖 Codex 临时改正文；按语言删除正文；改写原始 JSON；页面各自解析会话 | 两类结构契约 + 分支/日期/资源回归 + 真实会话弹窗 | 已实现 |
| 会话资源展示 | 保留消息中的图片/文件引用；已受控实体直接显示，缺失实体由当前来源自动加载；图片、音视频、PDF与TXT在正文原位呈现 | `src/domain/importedContent.ts` / `src-tauri/src/attachments.rs` / `components/SourceAttachmentAsset.tsx` | `ReadableSourceMessage.assets` / `KnowledgeRepository` | 详情角色卡、完整内容弹窗、附件时间线 | 从任意本机路径直接渲染；把 UUID 当作已有图片；要求逐项点击恢复；图片使用懒加载造成默认空卡；PDF/TXT只显示文件名 | 引用解析 + 受控asset scope + 自动加载状态 + 各格式原位预览合同 | 已实现，真实WebView2解码待确认 |
| 交互反馈 | 收藏、复制、菜单、设置等按钮操作的统一可见结果 | `App` 的 `notice` | `onNotify` | 顶部菜单、记录操作、标签和详情 | 各按钮自行生成风格不一的临时提示 | 受影响按钮点击后产生一致反馈且自动消退 | 已实现 |
| 记录视图交互状态 | 搜索/标签预设、当前范围、来源筛选、排序、收藏、选中记录与快速定位 | `App` / `RecordRepository.listRecords` | 组件 props 与仓库查询 | 全部笔记、我的收藏、持续跟踪、标签菜单、详情标题；`updated`历史范围只兼容保留 | 侧栏和列表各存一份业务状态；拖动定位滑块时连续切换记录；为兼容状态恢复人工判断更新入口 | 查询结果、计数、详情与收藏同步；定位只滚动且不改变当前详情 | 已实现 |
| 数据目录与迁移 | 数据库、原文件、附件、导出、备份和日志的受控位置 | `src-tauri/src/paths.rs` / `database.rs` | Tauri commands | 设置、导入、备份恢复 | UI 拼接系统路径；启动时绕过迁移 | 重启后持久化 + integrity_check | 已实现 |
| 原始内容日期 | 导入资料原有的创建/更新时间，独立于导入和本机修改时间 | `database::derive_original_at` / `records.original_at` | `RecordSummary.originalAt` | 列表、详情、排序、日期筛选、导出 | 用导入当天覆盖原始日期；前端各自猜测格式 | ISO/秒/毫秒契约 + 迁移重开 | 已实现 |
| 附件 | 记录关联的本地证据文件，后台复制到受控目录；软件内优先预览，外部应用仅为后备 | `src-tauri/src/attachments.rs`负责受控文件；`components/AttachmentPreview.tsx`负责统一预览层 | `RecordRepository.list/add/open/removeAttachment` / `attachmentPreviewKind` | 来源正文资源、记录详情附件卡、完整内容弹窗 | 点击即弹到不可控外部窗口；各页面分别判断格式；删除受控目录外文件 | 小栈大文件/归档/哈希/路径边界 Rust 合同 + 图片/PDF/文本/音视频格式合同 + Tauri CSP/生产构建 | 已实现，待真实WebView2解码确认 |
| 视觉媒体附件预览视口 | 所有入口的图片与视频共用暗底画布、真实尺寸渲染面、完整适配、缩放、平移、中键与明确按钮复位；图片不强制放大小图，视频允许等比放大 | `components/AttachmentPreview.tsx` / `attachments/mediaPreviewViewport.ts` / `src/styles.css`；窗口尺寸只由CSS原生resize持有 | `AttachmentPreview`的唯一视觉媒体分支 | 来源正文资源、记录详情附件卡、完整内容弹窗 | 页面私建视口；视频浅底；固定64px猜控制区；视频元素同时承担播放和平移；组件状态与CSS双重resize；暗底误作用于PDF和文本 | 图片/视频适配纯函数 + 明确复位按钮 + 原生视频命中 + 横竖屏/150%/200%DPI E2E + Tauri隔离构建 + 真实WebView2对比 | 已实现，待真实MP4声音、进度、音量、全屏和物理鼠标确认 |
| Markdown 展示 | 保真保存源文本，同时以安全 GFM/Obsidian 子集、类型化 callout 和统一角色卡展示 | `components/MarkdownContent.tsx` | `MarkdownContent` / `AssistantMessageContent` / `ReadableMessageContent` | 当前判断、TXT/Markdown、平台会话、详情、完整内容、历史快照 | 页面各写一套正文格式；把全部 callout 套为同一颜色；父级 flex 误作用于 Markdown 根节点；把英文话题当内部过程删除 | 语义契约 + 生产构建 + 统一会话卡 E2E + 源文不改写 | 已实现 |
| 外部链接与附件打开 | 正文网址仍由安全外部链接命令打开；受控附件默认软件内预览，只有不支持格式或用户明确选择时才打开系统应用 | `components/MarkdownContent.tsx` / `components/AttachmentPreview.tsx` / `src-tauri/src/external_open.rs` | `open_external_url` / `open_attachment` | 全部 Markdown 阅读界面、附件预览后备动作 | 让外站替换主 WebView；所有附件无条件弹外部窗口；页面直接打开任意本机路径 | 安全协议白名单 + canonical附件边界 + 格式路由合同 + Rust/生产构建；真实默认应用前台行为待BAT确认 | 已实现，待用户环境确认 |
| 单篇完整导出 | 一份完整原文先组成统一 Markdown，再由同一内容生成 Markdown 文件或 DOCX | `domain/recordExport.ts` / `transfer::write_markdown_export/write_docx_export` | `composeRecordMarkdown/createRecordDocx` | 记录快捷操作弹窗、顶部当前记录导出 | 用英文摘要替代原文；复制按钮伪装导出；页面和 DOCX 各拼一套内容；伪装平台分享 | 两种文件落盘合同 + DOCX zip + E2E | 已实现 |
| Codex/Obsidian 交换 | 供人和 Codex 二次整理的可审阅文件层，不取得应用数据所有权 | `transfer::export_records` | `RecordRepository.exportRecords` | 导出中心、Vault、Markdown、JSON | Codex/Obsidian 直接写 SQLite；页面拼装不完整导出 | Vault 结构/附件链接合同 + 再导入走版本路径 | 已实现 |
| 备份恢复 | 数据库快照与完整备份两层合同；完整备份包含 SQLite、附件、导入原件和界面偏好，并在恢复前创建安全备份 | `src-tauri/src/transfer.rs` | `inspectBackup/restoreBackup`、`create/inspect/restorePortableBackup` | `设置 → 数据与存储 → 备份与恢复 / 高级维护` | 在数据交换页重复创建完整备份；未预览直接覆盖；把数据库快照宣称为完整备份；失败后只提示备份位置 | 唯一入口静态合同 + 预览计数 + SQLite 完整性 + 文件/偏好恢复 + 自动回滚测试 | 已实现，真实桌面待确认 |
| 单实例生命周期 | 同一用户会话只允许一个生产进程持有 SQLite 写入口 | `src-tauri/src/lib.rs` 的本机监听守卫 | Tauri 启动流程 | BAT、直接 EXE、未来安装包 | 只由 BAT 检查进程 | 隔离运行第二实例安全退出 | 已实现 |
| 右侧主体阅读字号 | 知识成果、来源正文和记录正文使用同一阅读比例；当前倍率为旧`1.3×`版本的`0.9`，即原始字号`1.17×`，链接继续保持较小的导航层级 | `src/styles.css`的`NF-RIGHT-READING-TYPE-02` Token 与定向选择器 | `.knowledge-final-reader / .source-final-body / .detail-panel` | 主题洞察四状态、全部笔记正文、记录详情 | 页面单独缩放整棵 DOM；连同链接、按钮、元数据和左侧列表一起缩放；用浏览器全局 zoom 代替语义字号 | 派生值与真实消费者合同 + TypeScript/Vite/Tauri构建 + 1702×1066同状态可见检查 | 已实现，待桌面确认 |
| 视觉与动效 Token | 颜色、阴影、时长、缓动与卡片层级 | `src/styles.css :root` 与 `.elevated-card` | 共享 CSS 类 | 全部卡片和控件 | 页面私建同类阴影与动效 | 对照稿和交互状态检查 | 已实现 |
| 紧凑小卡逐卡微交互 | 操作卡与纯阅读卡共享悬浮抬升、底部投影、焦点和方向提示；只有操作卡拥有按压 | `src/styles.css`的`NF-MICRO-CARD-LIFT-01`；消费者只声明最深层语义角色 | `data-card-interaction="lift|surface-lift" / data-card-cue="forward"` | 知识摘要与当前判断、假设内部小卡、判断演变来源卡、决策阶段、主题内部卡/待处理子项、统一笔记列表、主题行、关联来源、设置、回收站 | 角色挂给整组/网格/链路/父容器；嵌套消费；纯阅读卡伪装按压；页面私写位移/阴影；动效改材质；触屏模拟悬停 | 角色/排除静态合同 + 无嵌套 + 单卡悬浮时兄弟/父层静止 + 操作卡按下/纯阅读卡无按压 + focus/reduced-motion + 四皮肤/Windows BAT | 已实现；210/210、TypeScript、Vite、1702×1066 Chrome逐卡实算及v74隔离构建通过，待正式WebView2确认 |
| 搜索框焦点连续性 | 默认投影、内高光和焦点环由共享Token组合；聚焦只叠加焦点环 | `src/styles.css :root`与统一搜索选择器 | `--search-control-elevation / inner-highlight / focus-ring` | 记录入口、全部笔记、主题洞察、主题管理及后续搜索框 | 页面为`:focus-within`重写完整`box-shadow`；点击后默认阴影消失；不同入口使用不同焦点投影 | 四消费者静态合同 + 默认/聚焦实算阴影 + 四皮肤知识搜索 + 1702×1066截图 + TypeScript/Vite/BAT | 已实现，待正式WebView2确认 |

## 入口矩阵

| 入口/消费者 | 是否存在 | 当前影响 | 唯一入口 | 最小验证 |
|---|---|---|---|---|
| 全部笔记（含待确认例外） | 是 | 受影响 | `KnowledgeWorkspace(mode="sources")` → `KnowledgeRepository.listSourceArchive` | 已归类与待确认可筛选；正文按选择加载；只有待确认来源显示分类操作 |
| 主题管理（含低频维护） | 是 | 受影响 | `KnowledgeWorkspace(mode="topics")` → Domain/Topic/Structural Operation 命令 | 领域主题树可读；编辑和高级维护默认折叠；合并仍可撤销 |
| 主题洞察 | 是 | 受影响 | `KnowledgeWorkspace(mode="knowledge")` → `getTopicDetail` | 领域→主题→命题阅读；竞争假设、有效期、决策账本真实读写 |
| 新建、复制、永久删除 | 是 | 受影响 | `RecordRepository`；来源侧删除由`database::permanently_delete_record`先归档关联 Source Item | CRUD、回收站与一次明确确认；来源软删除后隐藏、恢复后重现、永久删除后重载不反弹 |
| 编辑当前判断与完整记录 | 是 | 受影响 | 局部补丁命令 / `DetailPanel` / `EditRecordDialog` | 650/800 ms 自动保存、失败草稿、重启重读 |
| ChatGPT ZIP/JSON/Markdown/TXT/HTML 文件批量拖拽与选择导入 | 是 | 受影响且原件保真 | `domain/importQueue.ts` → `RecordRepository` → `src-tauri/src/importer.rs`；ZIP 附件由 `chatgpt_export.rs` | 多路径接收、队列去重、顺序归档、ZIP 分片/附件映射、单项错误隔离、单独映射/自动批量确认 |
| 列表、详情、搜索 | 是 | 受影响 | `RecordRepository` | 搜索与选中、重启后一致 |
| 筛选、排序、收藏、复制导出、菜单 | 是 | 受影响 | `NoteListActions` / `RecordList` / `KnowledgeWorkspace` / `App.onNotify` | 单篇笔记列表统一三图标；按钮逐项操作、菜单外部关闭与状态同步 |
| 历史版本 | 是 | 受影响 | `RecordRepository` | 追加、整行打开、删除单个快照、恢复为新版本 |
| 回收站 | 是 | 受影响 | `RecordRepository` | 删除、恢复、确认永久删除；关联来源永久删除后保持归档 |
| 导出、备份、恢复 | 是 | 受影响 | `src-tauri/src/transfer.rs` | 范围/格式/附件/版本选择、Vault 结构、完整性与安全备份 |
| 附件 | 是 | 受影响 | `src-tauri/src/attachments.rs` | 复制、列表、打开、删除和路径边界 |
| 不同窗口与 DPI | 浏览器与桌面已验 | 受影响 | CSS 响应式规则 / Tauri 窗口 | 浏览器尺寸 + Windows 桌面壳 |
