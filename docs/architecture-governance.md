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
| AI Taxonomy Revision | 一次生成完整领域、主题、全部有效笔记的唯一主归属，以及每个主题的唯一 AI 主题整合和自动关联笔记来源；长任务可从已持久化批次继续 | `src-tauri/src/ai/client.rs`生成语义内容并唯一持有不完整批次恢复，但整合来源由最终归属确定性绑定；`src-tauri/src/ai/repository.rs`保存migration v8检查点并在持久化与应用两阶段校验整合；migration v7保存正式草稿/归属/整合/快照；`src/aiTaxonomyPresentation.ts`唯一投影已应用修订为跨入口分类读模型 | `getLatest/getApplied/getResumable/run/discard/apply/undoAiTaxonomyRevision` | 主题管理卡二/卡三、全部笔记、主题洞察“主题整合” | 本地分类；主题洞察或主题管理直接消费原始`domains/topics`；topic insight二次生成整合；模型自由决定来源ID；任一后段失败丢弃全部前段结果；模型漏一项就丢弃整批并让用户反复手动续跑；无来源快照校验直接续跑；待审核草稿覆盖正式内容 | 每批成功后落盘；批内保留唯一合法项并只补发缺失/重复/无效子集，整批无进展时二分且单条重试有上限；每次有效usage进入任务账本；中断后询问继续/放弃；续跑只处理剩余批次且来源快照一致；每篇笔记恰好一个主题；整合正文非空且来源集合等于最终归属；两个卡二与后续主题选择共同消费同一已应用投影，未应用或遗留未映射项共同为空；应用/撤销为事务；原始笔记不改写 |
| 新笔记 AI 待分类 | 新导入只进入全部笔记并标记等待 AI 分类，不在后台启动本地语义任务 | `App.tsx`只发出待分类刷新；下一次 AI Taxonomy Revision 统一覆盖 | `runAiTaxonomyRevision` | 导入、全部笔记、主题管理 | 导入入口私自分类；启动恢复本地评分队列；伪造本地候选 | 新笔记原文立即可读；是否调用 AI 由用户在主题管理发起；失败不改变现有正式结构 |
| Structural Operation | 合并、拆分、关系和撤销 | `knowledge/repository.rs` | `preview/merge/undoTopicMerge`、`previewTopicSplit`、`suggest/createTopicRelation` | 主题管理高级维护、操作日志 | 无预览直接批量改外键 | 合并、redirect 和撤销已实现；拆分按首版边界仍只预览；界面默认折叠 |
| Research Context | 本地可审阅的研究上下文 | `knowledge/repository.rs` | `compileTopicContext` | 主题页、导出/后续 Codex 交换 | 调模型生成不透明摘要 | 本地确定性编译已接入 |
| AI Topic Insight | 按已应用主题及其归纳笔记生成来源约束的主题综述、竞争假设、判断演变和决策与行动；不拥有主题整合 | `src-tauri/src/ai/*`、migration v7、`src/services/aiRepository.ts`、`KnowledgeReadingWorkspace.tsx` | `get/runAiTopicInsight` | 主题洞察综述及竞争假设/判断演变/决策版本 | 本地摘要回退；自动制造条件面板；重复生成主题整合；模型结果覆盖人工对象；只传标题不传正文 | 未生成时只显示等待 AI；条件数组可诚实为空；主题整合读取当前已应用 taxonomy revision；正式人工对象独立并列；结果、来源边界与逐任务 Token/费用独立保存 |
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
| 五套视觉皮肤 | `src/theme/knowledgeSkins.ts` 与项目视觉契约 | 实体工作台雾蓝/鼠尾草/暖陶与场景玻璃花房/奔马；共同使用同一产品结构和工作区几何 | 恢复已退出皮肤或增加替代皮肤；让背景综合色重染纯白前景卡；借皮肤改变页面结构 | 五套逐套切换、重开保持、几何一致、实体/玻璃职责正确且无破边 |
| 五入口双卡工作区几何 | `src/styles.css`的`NF-CORE-WORKSPACE-GEOMETRY-01`与`core-workspace-grid / card-two / card-three`角色 | 主题洞察、全部笔记、主题管理、我的收藏、持续跟踪共用全部笔记24%卡二、14px间距、卡三剩余宽度、等高四边和45px搜索框 | 页面私建列宽、外边距、搜索高度或顶部悬浮工具区；用皮肤选择器改变卡片位置；主题洞察/管理把控制区放在卡二外 | 五入口同视口逐页读取卡二/卡三/搜索矩形并逐值相等 + TypeScript/Vite + 正式WebView2切换复核 |
| 动态场景文字可读性 | `src/theme/knowledgeSkins.ts`的`deriveAdaptiveScenePalette`与`App`注入的场景/表面语义 Token | 场景标题、说明、加载态按背景明暗和冷暖动态反向；冷白磨砂内使用独立深色表面文字 | 页面写死某套背景颜色；把图片前景色复用到冷白卡片；用单页选择器修同一规则 | 四组明暗/冷暖对比合同 + 页面消费者静态合同 + 四套皮肤同视口可见检查 |
| AI 通道、模型路由与密钥 | `src-tauri/src/ai/models.rs`、`ai/repository.rs`、`ai/client.rs`与根级`docs/app-development/ai-task-routing-standard.md` | 设置中的唯一“任务路由基准”决定自动或人工模型；API Key 只决定相应通道是否可用。自动优先已配置的千问直连（Flash→Plus），其次 DeepSeek 直连（Flash→Pro），最后 OpenRouter（仅保留 Terra/Sonnet 的人工兜底）；人工模式把`通道 + 模型`一起保存。受治理目录仅保留千问 Flash/Plus/Max、DeepSeek Flash/Pro、OpenRouter Terra/Sonnet；失效历史选择安全回退自动。UI必须明确显示`千问直连 / DeepSeek直连 / OpenRouter`来源；保存Key默认只显示视觉掩码，眼睛显式点击才读取；创建任务即冻结阶段模型 | 页面自行拼接模型 ID；把 API Key 写入 SQLite/日志或前端状态；将直连与 OpenRouter 混写成同一来源；自动使用 Max/高难档；跳过优先级而任意跨通道；目录刷新后改写在途任务；隐藏已失效模型却继续调用；只记录一个模型名掩盖多模型任务 | Rust路由/迁移/续跑与执行契约 + 前端统一选择器、来源标签与 Key掩码 + 隔离构建；三通道缓存金丝雀和千问2来源Flash→Plus完整链路已真实验证，长期全库规模、v156真实WebView2与在线目录刷新另验 |
| AI Prompt Cache、执行契约、推理策略与成本证据 | `src-tauri/src/ai/prompt_cache.rs`唯一构造稳定前缀、缓存键、执行契约和供应商缓存参数；`ai/client.rs`唯一决定阶段推理策略、解析usage并冻结请求时价格；`ai/repository.rs`保存逐阶段证据、按执行契约隔离复用并恢复遗留任务；`maintenance.rs`持有正式迁移/验收的数据保护门 | 本地结果/断点优先；固定指令、Schema、taxonomy在前，动态批次在后；DeepSeek自动、千问显式或隐式、OpenRouter粘性路由；千问显式稳定块独占一条消息；千问高频档案/归属关闭思考，跨文档阶段保持默认；Prompt/Schema/推理策略升级必须换执行契约；legacy只读不复用；只保存哈希和usage，不保存Prompt正文 | 页面拼Prompt或控制思考；为凑Token填充废话；把动态时间/随机ID放到前缀；只按模型复用不同执行语义；把千问稳定块与动态内容塞进同一消息；用整响应缓存替代可审阅派生结果；缓存键包含原文或身份；把价格未知或节省未知显示成零美元；用正式验收结果覆盖主题或来源 | Prompt/执行契约、三家usage映射、缓存读写成本、遗留任务恢复、migration v14/v15与Rust/前端合同；三通道缓存金丝雀、正式缓存/思考A/B和2来源Flash→Plus完整链路通过；长期全库质量、账单与Windows显示另验 |
| 场景材质基线 | `src/styles.css`的共享材质 Token；`src/theme/knowledgeSkins.ts`只拥有场景文字可读性 | 外层承托、浮层与专用模态保持固定玻璃与单次模糊；所有普通最前景内容/列表/判断/嵌套/主要阅读白卡统一消费`#fff`不透明实体面。已明确业务或状态语义的淡绿、淡红、淡橙、淡紫卡保留各自不透明实体色 | 运行时重算普通白卡RGB/透明度；以近白渐变或透明玻璃替代白卡；提高大承托层整体白色覆盖率；用蓝绿补色；恢复内部第二次`backdrop-filter`；使用闭环白描边或2px双向mask；为某入口另建材质；把非语义白卡排除；让历史版本号取得规则所有权 | 共享 Token 静态合同 + 全入口前景消费者合同 + 语义色例外合同 + 外层承托/浮层/模态保真合同 + 无动态材质Token/无mask/无内部二次滤镜合同 + 四皮肤同视口检查 |
| 设计确认状态 | `core-workspace-acceptance-matrix.md` | 设计确认、UI 集成、自动契约、构建、BAT 分层记录 | 把预览确认、后端对象存在或构建通过说成最终页面已落地 | 每个页面每个验证层级有可定位证据 |
| 跨项目开发设计引用 | `design-system.md` | 只负责把现行产品体验、材质、交互、平台适配、自然语言反馈和验收规则路由给其他项目；精确项目事实继续由设计基线、验收矩阵和本所有权表持有 | 复制第二套项目基线；把知识库业务、固定尺寸、背景图、数据结构或旧证据默认带入其他项目；只取色板和透明度却遗漏交互 | 本地链接检查 + 引用合同覆盖六层锁定、继承/不继承项、平台转换与证据分层 |

### AI 调用记录（2026-08-14）

- **唯一所有者：** `ai_task_runs` 与 `ai_task_model_steps`；Rust `ai::repository::list_call_history` 是唯一只读聚合，`list_ai_call_history` 为前端公开入口。
- **展示边界：** 最近50条按调用时间倒序展示模型、任务阶段、运行状态、输入/输出/缓存/推理 token 与失败摘要；逐阶段账本优先，缺少阶段账本的历史任务仅回退一条汇总，避免重复。不得保存或显示 Prompt、知识正文、API Key、稳定前缀原文、缓存键或价格快照。
- **受影响入口：** 设置 → AI 自动整理 → 调用记录；主题洞察、主题管理、正式 AI 生成、账本写入、模型路由与缓存规则均不受本功能改写。

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
| AI 主题综述首屏 | 当前主题的完整AI成果包；固定上方1/3只承担可视预览，完整内容由同源弹窗读取 | `ai_topic_insights`与`KnowledgeReadingWorkspace.tsx`；`.knowledge-final-stage`唯一持有`1fr / tabs / 2fr`分屏 | `get/runAiTopicInsight`、`AiInsightBundleContent` | 主题洞察上方预览、80%可调查看全部弹窗与四状态导航 | UI拼装本地摘要；用`details`折叠主内容；上方滚动带动四Tab；复制两套成果组件；自动建议写回正式对象 | 上下内容区1:2；上方和Tab固定；只允许下方滚动；完整弹窗复用同一内容组件并可调宽高；单主题进度/结果持久显示；正式对象不被覆盖 | 已实现，真实内容质量与WebView2观感待验证 |
| AI 模型轨道与增量分类 | 每个供应商/模型独立保留主题洞察、来源档案和分类修订；正式分类始终只有一条可应用轨道 | `ai_topic_insight_versions`、`ai_source_profile_versions`、`ai_taxonomy_revisions`与`ai_taxonomy_run_checkpoints`；设置页唯一保存全库分类配置，`KnowledgeWorkspace`唯一编排任务 | `get/runAiTopicInsight`、`get/runAiTaxonomyRevision`、`runAiIncrementalTaxonomyRevision` | 主题洞察、主题管理、设置用量 | 主题管理私有模型入口或把主题洞察临时选择传给全库分类；不同模型覆盖彼此结果；用其他模型档案做增量分类；把全量重新生成伪装成补充；草稿自动替换正式分类 | 主题管理全量/增量/重启只使用设置页已保存配置，断点续跑使用任务实际模型；主题洞察会话选择只影响洞察轨道；同模型同输入复用；全量只新增版本；增量仅覆盖新增/变更笔记与受影响主题整合；新模型先全量；任一轨道中断均可续跑 | 已实现，真实API/正式库待验证 |
| 知识摘要完整阅读 | 四张摘要卡共用一个完整内容弹窗，卡片只承担两条预览，弹窗逐条展示当前类别全部文本并提供对应状态深读入口 | `components/KnowledgeReadingWorkspace.tsx`与`styles.css` | `KnowledgeOverviewDialogState / openOverviewDialog` | 事实与线索、关键证据、待验证问题、建议下一步 | 四张卡各自复制弹窗；查看按钮直接跳页却无法读取完整文本；弹窗继续使用单行省略；把弹窗作为第五个知识状态 | 四消费者静态合同 + 完整列表无切片 + Escape/遮罩/焦点恢复 + TypeScript/Vite + 中文BAT桌面复核 | 已实现，待正式桌面确认 |
| 知识四态正文层级与小字密度 | Tab只负责状态身份，状态内对象组件负责对象标题、筛选和空态；辅助小字只服务判断、定位或操作 | `components/KnowledgeReadingWorkspace.tsx`与`styles.css` | `data-reading-mode / data-reading-section` | 竞争假设、判断演变、主题整合、决策版本 | 复制眉题、编号步骤卡、阅读方法或职责说明；重复Tab计数；显示技术实现说明、无价值占位或四格空字段；删除说明时连同有效日期/来源/状态一起删除 | 四态静态合同 + 小字禁用清单 + 直接内容起始几何 + TypeScript/Vite + 中文BAT桌面复核 | 已实现，待正式桌面确认 |
| 主题整合阅读模型 | 主题管理 AI 在最终归属后生成唯一整合及其自动关联笔记来源；主题管理卡三与主题洞察只读共享当前已应用结果；没有已应用revision时主题管理卡二/卡三为空 | `ai_taxonomy_revisions.topics_json`持有整合与来源ID；`aiTaxonomyPresentation.ts`映射正式主题；两个工作区组件消费；`styles.css`持有来源列与横排合同 | `getAppliedAiTaxonomyRevision`、`.topic-final-integration`、`.topic-final-integration-sources`、`.knowledge-final-source-list` | 主题管理卡二/卡三、主题洞察主题整合态、来源反向定位 | 旧主题或旧归属冒充AI成果；`已归入当前主题`兜底；topic insight 再生成整合；草稿遮蔽正式整合；根据标题猜来源 | 空态只显示待AI生成 + 持久生成/结果弹窗 + 草稿/正式分离 + 来源ID约束 + 卡三自动来源清单 + 横排实算 + E2E | 已实现，真实 AI 内容质量待验证 |
| AI 条件知识面板 | 竞争假设、判断演变、决策与行动、待验证问题和知识有效性由同一成果包按来源条件生成，允许为空 | `ai_topic_insights`与`KnowledgeReadingWorkspace.tsx` | `get/runAiTopicInsight` | 主题洞察三个主条件面板及竞争假设侧栏两卡 | 从正文做本地草案；用占位链凑齐面板；证伪条件不进入有效性；时间信号存在仍一律返回空；AI覆盖人工记录 | 结构化字段逐面板消费 + `openQuestions`/`invalidationCondition`映射 + 时间/更新信号节点 + `sourceItemIds`回溯 + 正式人工对象独立并列 | 已实现，真实 AI 内容质量待验证 |
| 卡片关联线几何 | 所有关联线都表达左侧选中卡片到右侧阅读卡片的明确关系 | `src/connectionGeometry.ts`负责端点与线宽；`styles.css`的统一关联目标样式负责右卡闭合橙框 | `measureCardToCardConnector` / `association-link-target` | 全部记录、全部笔记、主题洞察、主题管理 | 各页面自行使用`-2/+4`像素补偿；线段伸入卡片；右侧卡片只有圆点没有完整橙色边框 | 纯函数端点合同 + 四类消费者 TypeScript/Vite + 同视口可见核对 | 已实现，待桌面确认 |
| 页面导航状态 | 全部笔记、主题管理、主题洞察及兼容记录工具的当前位置 | `App` 的 `page` | `Sidebar.onNavigate` | 主区域页面选择 | 各页面自行修改侧栏状态；恢复重复的收录箱/整理工作台入口 | 导航与可见页面一致 | 已实现 |
| 全部笔记打开位置与返回上下文 | 跨页请求只负责打开目标笔记；每次普通打开、跨页打开或切换笔记都从正文顶部开始，只有用户在正文搜索框提交本次关键词后才允许定位 | 一次性打开请求由`App.knowledgeSourceTarget`持有并在选中目标后立即消费；返回上下文由`App.knowledgeSourceReturnTarget`唯一持有；正文查询、历史、高亮和滚动由`KnowledgeWorkspace`持有 | `onNavigateToSource / onReturnFromSource / onSourceNavigationHandled / searchSourceText` | 四个主题洞察面板→全部笔记→原面板原来源；直接进入全部笔记→竞争假设对应来源；正文搜索历史只回填输入 | 把旧证据锚点当成自动滚动指令；页面重放历史查询；用`scrollIntoView`带动祖先卡片；点击历史词立即定位 | 四面板从哪里进入就回哪里；所有笔记默认正文顶部且无旧高亮；只有手动提交正文搜索才滚动；历史与卡二历史分键保存 | 已实现，待正式桌面确认 |
| 全部笔记全库搜索与标题 | 全库搜索必须覆盖未加载来源的标题、主题元数据与完整原文；用户显式标题修改同步来源对象和兼容 Record | `knowledge/repository.rs` | `count/searchSourceArchive`、`updateSourceTitle` | 全部笔记搜索、搜索历史、全部加载、标题编辑 | 只过滤当前120条摘要；把全部正文先传前端；标题只改界面状态 | FTS/短词回退 Rust 合同 + Repository schema + E2E 正文命中/历史回显 + 标题往返 | 已实现，待正式数据桌面确认 |
| 文件导入 | 单个或批量文件的原件归档、标题恢复、哈希、限量预览、可编辑映射、精确内容去重和完整写入 | `src-tauri/src/importer.rs` / `knowledge/readable_text.rs` / `knowledge/source_identity.rs` / `domain/importMapping.ts` / `domain/importQueue.ts` | `RecordRepository.prepareImport/confirmImport/cancelImport` | 批量拖拽队列、文件选择、单文件映射、自动批量确认、导入日志、历史通用标题回填 | 把正文首个日期当标题；按文件名或相似标题自动删除；重复包生成重复笔记；一个失败中止整批 | 标题优先级与历史回填 + 提供方ID/可见正文身份 + 跨容器一笔记多origin + 队列/错误隔离 | 已实现，正式数据待验证 |
| ChatGPT 完整导出附件 | ZIP 原件、会话分片、消息附件引用、`.dat` 实体、原文件名、格式和受控落盘路径 | `src-tauri/src/chatgpt_export.rs` | `importer::prepare_import/confirm_import` | ZIP 导入预览、记录来源、角色消息附件、附件卡、完整备份 | 只导入 conversations JSON；按扩展名猜 `.dat`；整包读入内存；页面解析 ZIP；丢弃未关联文件库资产 | 真实 ZIP 只读审计 + 合成 ZIP 端到端 + 路径穿越/大小上限 + 字节哈希 | 已实现 |
| 导入会话展示 | 从保真的 Claude `chat_messages` 或 ChatGPT `mapping/current_node` 中提取当前分支的用户可见文本，隐藏 thinking、reasoning recap、工具调用与废弃分支 | `src/domain/importedContent.ts` / `src-tauri/src/importer.rs` | `readImportedContent` / 导入标题回退 | 详情预览、完整内容弹窗、完整导出、通用标题回退 | 依赖 Codex 临时改正文；按语言删除正文；改写原始 JSON；页面各自解析会话 | 两类结构契约 + 分支/日期/资源回归 + 真实会话弹窗 | 已实现 |
| 会话资源展示 | 保留消息中的图片/文件引用；已受控实体直接显示，缺失实体由当前来源自动加载；图片、音视频、PDF与TXT在正文原位呈现 | `src/domain/importedContent.ts` / `src-tauri/src/attachments.rs` / `components/SourceAttachmentAsset.tsx` | `ReadableSourceMessage.assets` / `KnowledgeRepository` / Tauri Asset scope | 详情角色卡、完整内容弹窗、附件时间线 | 从任意本机路径直接渲染；递归授予整个附件目录；把 UUID 当作已有图片；要求逐项点击恢复；图片使用懒加载造成默认空卡；PDF/TXT只显示文件名 | 引用解析 + 数据库登记且受控路径校验后的逐文件 asset scope + 自动加载状态 + 各格式原位预览合同 | 已实现，真实WebView2解码待确认 |
| 交互反馈 | 收藏、复制、菜单、设置等按钮操作的统一可见结果 | `App` 的 `notice` | `onNotify` | 顶部菜单、记录操作、标签和详情 | 各按钮自行生成风格不一的临时提示 | 受影响按钮点击后产生一致反馈且自动消退 | 已实现 |
| 记录视图交互状态 | 搜索/标签预设、当前范围、来源筛选、排序、收藏、选中记录与快速定位 | `App` / `RecordRepository.listRecords` | 组件 props 与仓库查询 | 全部笔记、我的收藏、持续跟踪、标签菜单、详情标题；`updated`历史范围只兼容保留 | 侧栏和列表各存一份业务状态；拖动定位滑块时连续切换记录；为兼容状态恢复人工判断更新入口 | 查询结果、计数、详情与收藏同步；定位只滚动且不改变当前详情 | 已实现 |
| 数据目录与迁移 | 数据库、原文件、附件、导出、备份和日志的受控位置 | `src-tauri/src/paths.rs` / `database.rs` | Tauri commands | 设置、导入、备份恢复 | UI 拼接系统路径；启动时绕过迁移 | 重启后持久化 + integrity_check | 已实现 |
| 原始导入归档与存储统计 | `imports/raw`保留导入保真原件；日常正文、搜索和 AI 只读 SQLite，存储数据仅展示已缓存结果 | `importer.rs` / `transfer.rs` / `paths.rs` / `App.tsx` | `refreshStorageStats` / `getStorageStats` | 导入、附件变更、备份恢复、数据优化和用户明确刷新 | 启动、焦点恢复、切页或普通列表刷新递归枚举原始归档；以原始文件作为正文读取回退 | 来源正文 SQLite 读取合同 + 前端缓存/显式刷新合同 + Tauri 隔离构建 | 已实现，真实桌面待确认 |
| 原始内容日期 | 导入资料原有的创建/更新时间，独立于导入和本机修改时间 | `database::derive_original_at` / `records.original_at` | `RecordSummary.originalAt` | 列表、详情、排序、日期筛选、导出 | 用导入当天覆盖原始日期；前端各自猜测格式 | ISO/秒/毫秒契约 + 迁移重开 | 已实现 |
| 附件 | 记录关联的本地证据文件，后台复制到受控目录；软件内优先预览，外部应用仅为后备 | `src-tauri/src/attachments.rs`负责受控文件；`components/AttachmentPreview.tsx`负责统一预览层 | `RecordRepository.list/add/open/removeAttachment` / `attachmentPreviewKind` | 来源正文资源、记录详情附件卡、完整内容弹窗 | 点击即弹到不可控外部窗口；各页面分别判断格式；删除受控目录外文件 | 小栈大文件/归档/哈希/路径边界 Rust 合同 + 图片/PDF/文本/音视频格式合同 + Tauri CSP/生产构建 | 已实现，待真实WebView2解码确认 |
| 视觉媒体附件预览视口 | 所有入口的图片与视频共用暗底画布、真实尺寸渲染面、完整适配、缩放、平移、中键与明确按钮复位；图片不强制放大小图，视频允许等比放大 | `components/AttachmentPreview.tsx` / `attachments/mediaPreviewViewport.ts` / `src/styles.css`；窗口尺寸只由CSS原生resize持有 | `AttachmentPreview`的唯一视觉媒体分支 | 来源正文资源、记录详情附件卡、完整内容弹窗 | 页面私建视口；视频浅底；固定64px猜控制区；视频元素同时承担播放和平移；组件状态与CSS双重resize；暗底误作用于PDF和文本 | 图片/视频适配纯函数 + 明确复位按钮 + 原生视频命中 + 横竖屏/150%/200%DPI E2E + Tauri隔离构建 + 真实WebView2对比 | 已实现，待真实MP4声音、进度、音量、全屏和物理鼠标确认 |
| Markdown 展示 | 保真保存源文本，同时以安全 GFM/Obsidian 子集、类型化 callout 和统一角色卡展示 | `components/MarkdownContent.tsx` | `MarkdownContent` / `AssistantMessageContent` / `ReadableMessageContent` | 当前判断、TXT/Markdown、平台会话、详情、完整内容、历史快照 | 页面各写一套正文格式；把全部 callout 套为同一颜色；父级 flex 误作用于 Markdown 根节点；把英文话题当内部过程删除 | 语义契约 + 生产构建 + 统一会话卡 E2E + 源文不改写 | 已实现 |
| 外部链接与附件打开 | 正文网址仍由安全外部链接命令打开；受控附件默认软件内预览，只有不支持格式或用户明确选择时才打开系统应用 | `components/MarkdownContent.tsx` / `components/AttachmentPreview.tsx` / `src-tauri/src/external_open.rs` | `open_external_url` / `open_attachment` | 全部 Markdown 阅读界面、附件预览后备动作 | 让外站替换主 WebView；所有附件无条件弹外部窗口；页面直接打开任意本机路径 | 安全协议白名单 + canonical附件边界 + 格式路由合同 + Rust/生产构建；真实默认应用前台行为待BAT确认 | 已实现，待用户环境确认 |
| 单篇完整导出 | 一份完整原文先组成统一 Markdown，再由同一内容生成 Markdown 文件或 DOCX | `domain/recordExport.ts` / `transfer::write_markdown_export/write_docx_export` | `composeRecordMarkdown/createRecordDocx` | 记录快捷操作弹窗、顶部当前记录导出 | 用英文摘要替代原文；复制按钮伪装导出；页面和 DOCX 各拼一套内容；伪装平台分享 | 两种文件落盘合同 + DOCX zip + E2E | 已实现 |
| Codex/Obsidian 交换 | 供人和 Codex 二次整理的可审阅文件层，不取得应用数据所有权 | `transfer::export_records` | `RecordRepository.exportRecords` | 导出中心、Vault、Markdown、JSON | Codex/Obsidian 直接写 SQLite；页面拼装不完整导出 | Vault 结构/附件链接合同 + 再导入走版本路径 | 已实现 |
| 备份恢复 | 数据库快照与完整备份两层合同；完整备份包含 SQLite、附件、导入原件和界面偏好，并在恢复前创建安全备份 | `src-tauri/src/transfer.rs` | `inspectBackup/restoreBackup`、`create/inspect/restorePortableBackup` | `设置 → 数据与存储 → 备份与恢复 / 高级维护` | 在数据交换页重复创建完整备份；未预览直接覆盖；把数据库快照宣称为完整备份；失败后只提示备份位置 | 唯一入口静态合同 + 预览计数 + SQLite 完整性 + 文件/偏好恢复 + 自动回滚测试 | 已实现，真实桌面待确认 |
| 数据空间优化 | 只读盘点后，只清理无数据库/导入清单引用的受控附件、完全重复或超时失败备份，并受控合并 WAL；完整备份、导入原件、业务对象与语义相似候选默认保留 | `src-tauri/src/data_optimization.rs`与`commands::AppState` | `inspect_data_optimization / optimize_data` | `设置 → 数据与存储 → 优化数据占用` | 只按 SQLite 空闲页判断；直接删除 WAL；让模型裁决二进制文件；前端布尔值伪造确认；候选路径未经删除前重验；优化前另写永久大快照抵消回收量；从文件名或来源数猜“无用” | 引用图扫描 + 执行前后二次完整性检查 + WAL checkpoint + 后端一次性5分钟扫描令牌 + 清单变化拒绝执行 + 删除前受控根/身份/重解析点重验 + 重复/失败备份合同 + 受控附件孤儿文件合同 | 已实现，正式库执行须用户在界面二次确认 |
| 单实例生命周期 | 同一用户会话只允许一个生产进程持有 SQLite 写入口 | `src-tauri/src/lib.rs` 的本机监听守卫 | Tauri 启动流程 | BAT、直接 EXE、未来安装包 | 只由 BAT 检查进程 | 隔离运行第二实例安全退出 | 已实现 |
| 右侧主体阅读字号 | 知识成果、来源正文和记录正文使用同一阅读比例；当前倍率为旧`1.3×`版本的`0.9`，即原始字号`1.17×`，链接继续保持较小的导航层级 | `src/styles.css`的`NF-RIGHT-READING-TYPE-02` Token 与定向选择器 | `.knowledge-final-reader / .source-final-body / .detail-panel` | 主题洞察四状态、全部笔记正文、记录详情 | 页面单独缩放整棵 DOM；连同链接、按钮、元数据和左侧列表一起缩放；用浏览器全局 zoom 代替语义字号 | 派生值与真实消费者合同 + TypeScript/Vite/Tauri构建 + 1702×1066同状态可见检查 | 已实现，待桌面确认 |
| 视觉与动效 Token | 颜色、阴影、时长、缓动与卡片层级 | `src/styles.css :root` 与 `.elevated-card` | 共享 CSS 类 | 全部卡片和控件 | 页面私建同类阴影与动效 | 对照稿和交互状态检查 | 已实现 |
| 紧凑小卡逐卡微交互 | 操作卡与纯阅读卡共享悬浮抬升、底部投影、焦点和方向提示；只有操作卡拥有按压 | `src/styles.css`的`NF-MICRO-CARD-LIFT-01`；消费者只声明最深层语义角色 | `data-card-interaction="lift|surface-lift" / data-card-cue="forward"` | 知识摘要与当前判断、假设内部小卡、判断演变来源卡、决策阶段、主题内部卡/待处理子项、统一笔记列表、主题行、关联来源、设置、回收站 | 角色挂给整组/网格/链路/父容器；嵌套消费；纯阅读卡伪装按压；页面私写位移/阴影；动效改材质；触屏模拟悬停 | 角色/排除静态合同 + 无嵌套 + 单卡悬浮时兄弟/父层静止 + 操作卡按下/纯阅读卡无按压 + focus/reduced-motion + 四皮肤/Windows BAT | 已实现；210/210、TypeScript、Vite、1702×1066 Chrome逐卡实算及v74隔离构建通过，待正式WebView2确认 |
| 搜索框焦点连续性 | 默认投影、内高光和焦点环由共享Token组合；聚焦只叠加焦点环 | `src/styles.css :root`与统一搜索选择器 | `--search-control-elevation / inner-highlight / focus-ring` | 记录入口、全部笔记、主题洞察、主题管理及后续搜索框 | 页面为`:focus-within`重写完整`box-shadow`；点击后默认阴影消失；不同入口使用不同焦点投影 | 四消费者静态合同 + 默认/聚焦实算阴影 + 四皮肤知识搜索 + 1702×1066截图 + TypeScript/Vite/BAT | 已实现，待正式WebView2确认 |

### Windows 文件定位平台合同（2026-08-11）

- 唯一平台所有者仍为 `external_open::reveal_path`。Windows 实现必须使用 `CoInitializeEx → ILCreateFromPathW → SHOpenFolderAndSelectItems`：原始路径先完成受控目录校验，再仅在传入 Shell 前把 `\\?\`/`\\?\UNC\` 长路径转换为显示路径；首 PIDL 必须为父目录，目标文件通过一项 `apidl` 选择列表传入。禁止恢复 `explorer.exe /select`、PowerShell、`cmd`、空选择列表或页面私有路径拼接。
- 附件入口只允许提交附件 ID，由 Rust 从数据库重新读取并以 `controlled_attachment_file` 校验受控归档路径；导出入口只允许提交当前 `exports` 目录内、规范化后仍在该目录下的现存文件。
- 生产消费者覆盖正文资源、最高层预览、全部/图片/视频/音频/文件时间线，以及两处单篇导出成功提示；这些入口只调用 `reveal_attachment` 或 `reveal_exported_file`，不各自判断扩展名或启动 Explorer。
- 最小验证为：Unicode/空格/井号路径宽字符合同、附件与导出目录越界拒绝、前端入口静态合同、真实 MP4 原生 Shell HRESULT 成功、TypeScript/Vite/Tauri 构建和当前中文 BAT。Shell 成功不替代南烛枫对真实界面“确实高亮选中文件”的最终确认。

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
