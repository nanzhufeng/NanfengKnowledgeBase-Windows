# 架构所有权

项目遵循根级 `docs/app-development/architecture-baseline.md`。当前最高产品规格已把核心从“记录管理”升级为“知识演化”。下表描述当前代码事实；migration v3 与 migration v4 的正式数据验证必须分层报告，不能由“代码已接入”推断。

## 知识生产模型（正式代码已接入，正式数据已升级）

| 概念 | 唯一产品含义 | 规则与持久化所有者 | 公开入口 | 主要消费者 | 禁止的平行规则 | 当前证据 |
|---|---|---|---|---|---|---|
| Domain | 稳定顶层领域 | `src/knowledge/domain.ts`、`src-tauri/src/knowledge/schema.rs`、`knowledge/repository.rs` | `create/update/listDomains` | 主题管理、知识视图 | 页面用标签临时模拟领域；重建对象实现改名 | 创建与编辑命令已接入；改名保留 ID |
| Topic / Subtopic | 长期主题、唯一主路径和横向关系 | `knowledge/repository.rs` | `create/update/listTopics/getTopicDetail` | 主题管理、知识视图 | 用 Record 标题自动生成主题；改名时新建平行主题 | 正式仓库与 UI 已接入；改名保留 ID；合并旧名称和旧路径写入 redirect 别名且撤销可逆 |
| Topic Structural Attention | 哪些主题存在需要用户操作的真实结构缺口 | `src/knowledge/topicStructurePolicy.ts` | `collectTopicStructuralAttentionIds` | 主题管理的待处理筛选、首屏待处理事项和高级维护统计 | 各页面自行把`sourceCount === 0`或缺少技术规则解释成用户任务；让用户逐个判断保留、合并、删除或补规则 | 零来源是中性状态，分类规则由系统持有；只由边界、别名或明确关系建议进入待处理 |
| Topic Hierarchy Presentation | 主题详情中何时存在值得展示的父子层级 | `src/knowledge/topicStructurePolicy.ts` | `topicHierarchyHasUsefulContent` | 主题管理详情的`主题层级`区 | 固定展示“直属 / 暂无 / 0个”占位；在多个区块重复关系建议和知识对象统计 | 顶层叶子主题隐藏整块；有真实父主题或子主题时只显示实际层级，重复信息回到各自唯一展示区 |
| Source Item | 保真的导入来源和分类对象 | `importer.rs`、`knowledge/repository.rs` | `listSourceArchive/listInbox`、migration v3 legacy backfill | 来源档案、主题来源、证据 | 覆盖原件；把来源等同于笔记 | 来源档案同时读取已归类和待确认来源；无正文空会话默认隐藏但不删除 |
| Source Collection | 四入口统一显示和筛选的来源目录；一篇笔记可保留多个导入原件 | `knowledge/source_identity.rs`、`knowledge/repository.rs` | `listSourceCollections/renameSourceCollection`、migration v5 backfill | 来源档案、收藏、跟踪、判断更新、组合筛选 | 用文件名、类型或页面私有映射生成来源；重命名覆盖原件；重复导入新增第二篇笔记 | 统一目录+多 origin；重命名只改显示；提供方 ID/可见正文精确去重；145项前端+82项Rust合同 | 已实现，正式v5待授权 |
| Note | 人工整理与补充说明 | `knowledge/repository.rs` | `create/update/archive/list/getNote` | 主题知识页、研究上下文 | 与原始来源共用可覆盖正文 | 独立 CRUD、软归档、主题/来源关联和 FTS 同步已验证 |
| Judgment Snapshot | 某时点判断、置信度和变化原因 | `knowledge/repository.rs` | `addTopicJudgment/getTopicDetail` | 主题页、时间线、上下文 | 覆盖旧判断冒充时间线 | 追加写入和读取已接入 |
| Evidence | 命题的支持/反驳关系、来源锚点和事实有效期 | `knowledge/repository.rs` | `addTopicEvidence/getTopicDetail` | 知识视图、上下文 | 无来源证据；页面各自标强弱或保存任意 JSON；默认永久有效 | 立场/可信度/验证/有效状态分离；可关联命题；锚点按来源类型校验并规范化 |
| Open Question | 待验证问题及状态 | `knowledge/repository.rs` | `addTopicQuestion/getTopicDetail` | 主题页、上下文 | 与普通待办混用 | 正式命令已接入 |
| Classification Suggestion | 来源到主题的候选、分数、理由和状态 | 可读正文投影：`knowledge/readable_text.rs`；评分：`deterministicClassifier.ts`；编排：`knowledgeAutoOrganizer.ts`；持久化输入/确认：`knowledge/repository.rs` | `prepare/save/list/confirm/undoClassification` | 导入完成、历史待整理升级、来源档案例外队列 | 用原始 JSON 元数据分类；分类器直接写库；页面复制评分规则；用 0 分候选填充界面 | 自动分类优先；BM25 必须有可见短语；无直接证据或低于 45 分不展示；最高候选严格 >65 时自动确认并可撤销，45–65 只保存候选 |
| Classification Exclusion Presentation | 主题级排除信号用于降低误归类，不删除来源，也不构成普通用户待补资料 | 默认规则由`personal_catalog.rs`持有；评分语义由`deterministicClassifier.ts`持有；主题页只读投影由`TopicStructureReadingWorkspace.tsx`持有；完整编辑仅在高级结构维护 | 目录升级下发保守排除信号；有有效项时显示`自动排除`摘要 | 主题管理详情、分类解释 | 空规则显示占位卡；在日常页要求用户补充、调整或维护技术规则；把排除误解为删除 | v7为非职业主题托管`招聘启事/岗位职责/简历投递`0.55排除信号，职业主题不排除；无规则时整块隐藏；36条knowledge Rust合同 + 前端呈现/E2E通过 |
| Structural Operation | 合并、拆分、关系和撤销 | `knowledge/repository.rs` | `preview/merge/undoTopicMerge`、`previewTopicSplit`、`suggest/createTopicRelation` | 主题管理高级维护、操作日志 | 无预览直接批量改外键 | 合并、redirect 和撤销已实现；拆分按首版边界仍只预览；界面默认折叠 |
| Research Context | 本地可审阅的研究上下文 | `knowledge/repository.rs` | `compileTopicContext` | 主题页、导出/后续 Codex 交换 | 调模型生成不透明摘要 | 本地确定性编译已接入 |
| Proposition / Competing Hypothesis | 可复用命题；同一假设组允许并列竞争，不强制唯一结论 | `knowledge/repository.rs` | `create/update/supersedeProposition/getTopicDetail` | 知识视图、判断、证据、决策账本、研究上下文 | 从展示文本临时推断身份；用新结论覆盖旧假设 | 独立生命周期、假设组、置信度、推翻条件和有效期已接入 |
| Turning Point | 用户明确确认的判断转折 | `knowledge/repository.rs` | `createTurningPoint/getTopicDetail` | 知识视图、研究上下文 | 填写变化原因自动制造转折 | 必须显式选择前后判断并确认 |
| Decision Ledger | 当时决策、依据、风险、行动、结果与复盘 | `knowledge/repository.rs` | `create/updateDecision/getTopicDetail` | 知识视图、研究上下文 | 用普通笔记模拟决策；结果覆盖当时依据 | 可关联命题和判断；结果状态、复核日期与复盘独立保存 |

### 运行与数据边界

- `database::apply_migrations` 已接入 migration v3、v4 和 v5：每个尚未应用的知识迁移在正式文件库打开前先生成 SQLite online backup；v4 只追加推理字段和索引，v5追加统一来源目录、内容身份和多原件关系，不改写来源正文。
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
| 三入口产品组织 | `product-brief.md` 与最高产品规格 | `来源档案 / 主题管理 / 知识视图`，自动化优先、人工仅处理例外 | 恢复收录箱/整理工作台为并列主入口；用 CRUD 表单替代成果阅读 | 三入口真实可导航，默认路径不要求逐条人工分类 |
| 核心页面功能布局 | `core-workspace-design-baseline.md` | 四张最终页面图中的模块、主次、默认状态、切换和滚动 | 以旧原型、临时中间 UI 或皮肤预览覆盖最终布局 | 同视口逐页结构对照 + 关键交互路径 |
| 四套视觉皮肤 | `src/theme/knowledgeSkins.ts` 与项目视觉契约 | 沙漠灯笼、花房、奔马、原版浅色；共同使用同一外框几何 | 恢复铜金发簪或增加替代皮肤；让背景综合色重染冷白卡；借皮肤改变页面结构 | 四套逐套切换、重开保持、几何一致、无破边和空白区误模糊 |
| 动态场景文字可读性 | `src/theme/knowledgeSkins.ts`的`deriveAdaptiveScenePalette`与`App`注入的场景/表面语义 Token | 场景标题、说明、加载态按背景明暗和冷暖动态反向；冷白磨砂内使用独立深色表面文字 | 页面写死某套背景颜色；把图片前景色复用到冷白卡片；用单页选择器修同一规则 | 四组明暗/冷暖对比合同 + 页面消费者静态合同 + 四套皮肤同视口可见检查 |
| 设计确认状态 | `core-workspace-acceptance-matrix.md` | 设计确认、UI 集成、自动契约、构建、BAT 分层记录 | 把预览确认、后端对象存在或构建通过说成最终页面已落地 | 每个页面每个验证层级有可定位证据 |

## 记录型生产模型（兼容基础设施）

以下所有者描述当前已运行的记录型生产链路。它们仍要维护，但不是知识模型；不得继续用新增字段扩大 `Record` 聚合职责。

| 概念 | 产品含义 | 唯一所有者 | 公开入口 | 当前消费者 | 禁止的平行规则 | 最小验证 | 状态 |
|---|---|---|---|---|---|---|---|
| 研究记录 | 判断、事实、证据、问题、行动、标签与来源的聚合根 | `src-tauri/src/database.rs` | `RecordRepository` | 列表、详情、搜索、版本、导入导出 | 页面直接 SQL；各页面复制记录状态 | Rust CRUD 测试 + 仓库契约 + 运行路径 | 已实现 |
| 当前判断编辑状态 | 阅读、编辑、自动保存和版本中的同一段判断 | `database::update_current_judgment` 与本机草稿键 | `RecordRepository.updateCurrentJudgment` | 判断卡、顶部保存状态、版本快照 | 用完整记录往返保存短字段；失败仍显示已保存 | 自动保存、失败草稿和重启恢复 | 已实现 |
| 记录列表读取模型 | 搜索、筛选和列表只消费轻量摘要，详情正文按选择加载 | `database::list_record_summaries` | `RecordRepository.listRecordSummaries` | 全部记录、收藏、跟踪、更新、回收站 | 列表加载完整正文；前端二次删除后端搜索命中 | 1000 条性能合同 + 正文命中搜索 + E2E | 已实现 |
| 交互性能调度 | 点击、搜索、滚动和页面切换不得被数据库、目录维护、历史分类、重复 IPC、重复解析或高频几何测量阻塞 | `knowledgeWorkspaceData.ts`、`classificationWorker.ts`、`classification.worker.ts`、`interactionScheduler.ts`、`KnowledgeRepository`、`useRafScheduledCallback.ts`、`connectionGeometry.ts` | 入口首屏/补充/维护分层、Worker 分类、可取消空闲任务、合并读取、延后输入、帧调度 | 三个核心入口、四个统一笔记列表、长正文与关联线 | 在来源点击链应用目录并读取全部维护对象；WebView 主线程批量分类；只靠减少列表数量；页面重复读取；scroll/ResizeObserver 直接高频更新 | 177 项前端合同 + 入口所有权/取消合同 + 独立 Worker 产物 + Vite/v45 Tauri 构建 + Playwright 16/17；剩余 1 条既有阅读区横溢出单列 | 已实现，待正式数据桌面流畅度确认 |
| 单篇笔记列表操作 | 四个统一列表入口提供收藏、完整导出和更多操作；鼠标悬停显示，选中或卡片自身焦点不常驻，操作按钮键盘焦点与菜单展开时保持显示 | `components/NoteListActions.tsx`负责呈现；`UnifiedNoteListCard + styles.css`唯一持有可见性；`App`记录操作回调负责行为 | `NoteListActions` | 来源档案、我的收藏、持续跟踪、判断更新 | 每个页面复制图标、菜单或可见性规则；用选中态或卡片`:focus-within`触发常驻显示；在详情头重复同组动作 | 共享组件静态合同 + 选中隐藏/悬停选择器/操作焦点/菜单展开状态 + TypeScript/Vite + 可见桌面交互 | 已实现，待桌面悬停确认 |
| 四入口列表呈现 | 来源档案、我的收藏、持续跟踪、判断更新共用日期、紧凑度、图标、标题/元数据空间、筛选和显示工具栏规则 | `components/UnifiedNoteListCard.tsx`与`styles.css`；共享筛选字段工厂唯一持有来源/记录状态/主题/日期定义和匹配 | `UnifiedNoteListPanel / Card / Filter / DisplayToolbar / Locator` | 来源档案、我的收藏、持续跟踪、判断更新 | 只统一浮层外壳却允许页面把来源类型冒充来源、把整理状态冒充记录状态、把标签冒充主题；页面复制选项或匹配规则；为了右贴压缩左摘要 | 四入口字段矩阵 + 真实来源匹配 + 四记录状态 + 同一正式主题目录 + 120/999计数DOM几何 + 1702×1066桌面复核 | 已实现；v25标准桌面待复核 |
| 领域主题层级列表 | 知识视图与主题管理共用领域卡、主题行、折叠、层级缩进、数量列、选中态和滚动 | `components/KnowledgeTopicHierarchy.tsx` | `KnowledgeTopicHierarchy` | 知识视图、主题管理 | 两页复制相似 JSX/CSS；各自解释领域数量、空态或折叠；只靠共享 CSS 假装统一 | 两个消费者静态合同 + 共享组件状态/结构合同 + TypeScript/Vite + 1702×1066可见核对 | 已实现，待正式桌面确认 |
| 知识首屏摘要 | 当前判断、事实与线索、关键证据、待验证问题和建议下一步的统一只读模型 | `src/knowledge/knowledgeSynthesis.ts` | `buildKnowledgeOverview` | 知识视图标题区与四状态导航 | UI分别拼装空卡；来源标题/数量冒充结论；自动建议写回正式对象；事实与证据重复同一文本 | 正式对象优先 + 真实正文确定性回退 + 来源锚点 + 纯函数测试 + 1702×1066首屏几何E2E | 已实现，待正式桌面确认 |
| 知识摘要完整阅读 | 四张摘要卡共用一个完整内容弹窗，卡片只承担两条预览，弹窗逐条展示当前类别全部文本并提供对应状态深读入口 | `components/KnowledgeReadingWorkspace.tsx`与`styles.css` | `KnowledgeOverviewDialogState / openOverviewDialog` | 事实与线索、关键证据、待验证问题、建议下一步 | 四张卡各自复制弹窗；查看按钮直接跳页却无法读取完整文本；弹窗继续使用单行省略；把弹窗作为第五个知识状态 | 四消费者静态合同 + 完整列表无切片 + Escape/遮罩/焦点恢复 + TypeScript/Vite + 中文BAT桌面复核 | 已实现，待正式桌面确认 |
| 知识四态正文层级与小字密度 | Tab只负责状态身份，状态内对象组件负责对象标题、筛选和空态；辅助小字只服务判断、定位或操作 | `components/KnowledgeReadingWorkspace.tsx`与`styles.css` | `data-reading-mode / data-reading-section` | 竞争假设、判断演变、笔记与来源、决策版本 | 复制眉题、编号步骤卡、阅读方法或职责说明；重复Tab计数；显示技术实现说明、无价值占位或四格空字段；删除说明时连同有效日期/来源/状态一起删除 | 四态静态合同 + 小字禁用清单 + 直接内容起始几何 + TypeScript/Vite + 中文BAT桌面复核 | 已实现，待正式桌面确认 |
| 卡片关联线几何 | 所有关联线都表达左侧选中卡片到右侧阅读卡片的明确关系 | `src/connectionGeometry.ts`负责端点与线宽；`styles.css`的统一关联目标样式负责右卡闭合橙框 | `measureCardToCardConnector` / `association-link-target` | 全部记录、来源档案、知识视图、主题管理 | 各页面自行使用`-2/+4`像素补偿；线段伸入卡片；右侧卡片只有圆点没有完整橙色边框 | 纯函数端点合同 + 四类消费者 TypeScript/Vite + 同视口可见核对 | 已实现，待桌面确认 |
| 页面导航状态 | 来源档案、主题管理、知识视图及兼容记录工具的当前位置 | `App` 的 `page` | `Sidebar.onNavigate` | 主区域页面选择 | 各页面自行修改侧栏状态；恢复重复的收录箱/整理工作台入口 | 导航与可见页面一致 | 已实现 |
| 来源档案定位状态 | 跨页面正文锚点是一次性导航事件；来源列表位置、正文搜索和正文滚动是来源档案局部状态 | 跨页面请求由 `App.knowledgeSourceTarget` 持有并在消费后清除；局部状态由 `KnowledgeWorkspace` 持有 | `onNavigateToSource` / `onSourceNavigationHandled` | 知识证据→来源正文、来源列表快速定位、正文搜索 | 把已完成的正文锚点长期保存在页面导航状态；用 `scrollIntoView` 滚动全部祖先容器；重进来源档案后重放旧搜索 | 直接进入来源档案回到首项/顶部；显式锚点仅执行一次；正文搜索只滚动正文容器 | 已实现 |
| 来源档案全库搜索与标题 | 全库搜索必须覆盖未加载来源的标题、主题元数据与完整原文；用户显式标题修改同步来源对象和兼容 Record | `knowledge/repository.rs` | `count/searchSourceArchive`、`updateSourceTitle` | 来源档案搜索、搜索历史、全部加载、标题编辑 | 只过滤当前120条摘要；把全部正文先传前端；标题只改界面状态 | FTS/短词回退 Rust 合同 + Repository schema + E2E 正文命中/历史回显 + 标题往返 | 已实现，待正式数据桌面确认 |
| 文件导入 | 单个或批量文件的原件归档、标题恢复、哈希、限量预览、可编辑映射、精确内容去重和完整写入 | `src-tauri/src/importer.rs` / `knowledge/readable_text.rs` / `knowledge/source_identity.rs` / `domain/importMapping.ts` / `domain/importQueue.ts` | `RecordRepository.prepareImport/confirmImport/cancelImport` | 批量拖拽队列、文件选择、单文件映射、自动批量确认、导入日志、历史通用标题回填 | 把正文首个日期当标题；按文件名或相似标题自动删除；重复包生成重复笔记；一个失败中止整批 | 标题优先级与历史回填 + 提供方ID/可见正文身份 + 跨容器一笔记多origin + 队列/错误隔离 | 已实现，正式数据待验证 |
| ChatGPT 完整导出附件 | ZIP 原件、会话分片、消息附件引用、`.dat` 实体、原文件名、格式和受控落盘路径 | `src-tauri/src/chatgpt_export.rs` | `importer::prepare_import/confirm_import` | ZIP 导入预览、记录来源、角色消息附件、附件卡、完整备份 | 只导入 conversations JSON；按扩展名猜 `.dat`；整包读入内存；页面解析 ZIP；丢弃未关联文件库资产 | 真实 ZIP 只读审计 + 合成 ZIP 端到端 + 路径穿越/大小上限 + 字节哈希 | 已实现 |
| 导入会话展示 | 从保真的 Claude `chat_messages` 或 ChatGPT `mapping/current_node` 中提取当前分支的用户可见文本，隐藏 thinking、reasoning recap、工具调用与废弃分支 | `src/domain/importedContent.ts` / `src-tauri/src/importer.rs` | `readImportedContent` / 导入标题回退 | 详情预览、完整内容弹窗、完整导出、通用标题回退 | 依赖 Codex 临时改正文；按语言删除正文；改写原始 JSON；页面各自解析会话 | 两类结构契约 + 分支/日期/资源回归 + 真实会话弹窗 | 已实现 |
| 会话资源展示 | 保留消息中的图片/文件引用，并只从当前记录受控附件目录解析真实二进制 | `src/domain/importedContent.ts` / `src-tauri/src/attachments.rs` | `ReadableSourceMessage.assets` / `RecordRepository` | 详情角色卡、完整内容弹窗、附件卡 | 从任意本机路径直接渲染；把 UUID 当作已有图片；并发复制全部大附件 | 引用解析契约 + 受控 asset scope + 同名关联 | 已实现 |
| 交互反馈 | 收藏、复制、菜单、设置等按钮操作的统一可见结果 | `App` 的 `notice` | `onNotify` | 顶部菜单、记录操作、标签和详情 | 各按钮自行生成风格不一的临时提示 | 受影响按钮点击后产生一致反馈且自动消退 | 已实现 |
| 记录视图交互状态 | 搜索/标签预设、当前范围、来源筛选、排序、收藏、选中记录与快速定位 | `App` / `RecordRepository.listRecords` | 组件 props 与仓库查询 | 全部记录、我的收藏、持续跟踪、判断更新、标签菜单、详情标题 | 侧栏和列表各存一份业务状态；拖动定位滑块时连续切换记录 | 查询结果、计数、详情与收藏同步；定位只滚动且不改变当前详情 | 已实现 |
| 数据目录与迁移 | 数据库、原文件、附件、导出、备份和日志的受控位置 | `src-tauri/src/paths.rs` / `database.rs` | Tauri commands | 设置、导入、备份恢复 | UI 拼接系统路径；启动时绕过迁移 | 重启后持久化 + integrity_check | 已实现 |
| 原始内容日期 | 导入资料原有的创建/更新时间，独立于导入和本机修改时间 | `database::derive_original_at` / `records.original_at` | `RecordSummary.originalAt` | 列表、详情、排序、日期筛选、导出 | 用导入当天覆盖原始日期；前端各自猜测格式 | ISO/秒/毫秒契约 + 迁移重开 | 已实现 |
| 附件 | 记录关联的本地证据文件，后台复制到受控目录；软件内优先预览，外部应用仅为后备 | `src-tauri/src/attachments.rs`负责受控文件；`components/AttachmentPreview.tsx`负责统一预览层 | `RecordRepository.list/add/open/removeAttachment` / `attachmentPreviewKind` | 来源正文资源、记录详情附件卡、完整内容弹窗 | 点击即弹到不可控外部窗口；各页面分别判断格式；删除受控目录外文件 | 小栈大文件/归档/哈希/路径边界 Rust 合同 + 图片/PDF/文本/音视频格式合同 + Tauri CSP/生产构建 | 已实现，待真实WebView2解码确认 |
| 图片附件预览视口 | 所有入口共用暗底图片画布、原始像素渲染面、完整适配、实际像素缩放、平移与中键复位状态 | `components/AttachmentPreview.tsx` / `attachments/imagePreviewViewport.ts` / `src/styles.css` | `AttachmentPreview`的唯一图片分支 | 来源正文资源、记录详情附件卡、完整内容弹窗 | 页面私建图片预览器；先把图片缩成画布再放大；把适配倍率冒充原图像素倍率；中键触发浏览器自动滚动；暗底误作用于PDF、文本或媒体预览 | 原图字节复制合同 + 自然尺寸/适配/缩放纯函数合同 + 组件结构合同 + Tauri隔离构建 + 真实WebView2原文件对比 | 已实现，待真实原图对比与物理中键确认 |
| Markdown 展示 | 保真保存源文本，同时以安全 GFM/Obsidian 子集、类型化 callout 和统一角色卡展示 | `components/MarkdownContent.tsx` | `MarkdownContent` / `AssistantMessageContent` / `ReadableMessageContent` | 当前判断、TXT/Markdown、平台会话、详情、完整内容、历史快照 | 页面各写一套正文格式；把全部 callout 套为同一颜色；父级 flex 误作用于 Markdown 根节点；把英文话题当内部过程删除 | 语义契约 + 生产构建 + 统一会话卡 E2E + 源文不改写 | 已实现 |
| 外部链接与附件打开 | 正文网址仍由安全外部链接命令打开；受控附件默认软件内预览，只有不支持格式或用户明确选择时才打开系统应用 | `components/MarkdownContent.tsx` / `components/AttachmentPreview.tsx` / `src-tauri/src/external_open.rs` | `open_external_url` / `open_attachment` | 全部 Markdown 阅读界面、附件预览后备动作 | 让外站替换主 WebView；所有附件无条件弹外部窗口；页面直接打开任意本机路径 | 安全协议白名单 + canonical附件边界 + 格式路由合同 + Rust/生产构建；真实默认应用前台行为待BAT确认 | 已实现，待用户环境确认 |
| 单篇完整导出 | 一份完整原文先组成统一 Markdown，再由同一内容生成 Markdown 文件或 DOCX | `domain/recordExport.ts` / `transfer::write_markdown_export/write_docx_export` | `composeRecordMarkdown/createRecordDocx` | 记录快捷操作弹窗、顶部当前记录导出 | 用英文摘要替代原文；复制按钮伪装导出；页面和 DOCX 各拼一套内容；伪装平台分享 | 两种文件落盘合同 + DOCX zip + E2E | 已实现 |
| Codex/Obsidian 交换 | 供人和 Codex 二次整理的可审阅文件层，不取得应用数据所有权 | `transfer::export_records` | `RecordRepository.exportRecords` | 导出中心、Vault、Markdown、JSON | Codex/Obsidian 直接写 SQLite；页面拼装不完整导出 | Vault 结构/附件链接合同 + 再导入走版本路径 | 已实现 |
| 备份恢复 | 数据库快照与完整备份两层合同；完整备份包含 SQLite、附件、导入原件和界面偏好，并在恢复前创建安全备份 | `src-tauri/src/transfer.rs` | `inspectBackup/restoreBackup`、`create/inspect/restorePortableBackup` | `设置 → 数据与存储 → 备份与恢复 / 高级维护` | 在数据交换页重复创建完整备份；未预览直接覆盖；把数据库快照宣称为完整备份；失败后只提示备份位置 | 唯一入口静态合同 + 预览计数 + SQLite 完整性 + 文件/偏好恢复 + 自动回滚测试 | 已实现，真实桌面待确认 |
| 单实例生命周期 | 同一用户会话只允许一个生产进程持有 SQLite 写入口 | `src-tauri/src/lib.rs` 的本机监听守卫 | Tauri 启动流程 | BAT、直接 EXE、未来安装包 | 只由 BAT 检查进程 | 隔离运行第二实例安全退出 | 已实现 |
| 右侧主体阅读字号 | 知识成果、来源正文和记录正文使用同一阅读比例；当前倍率为旧`1.3×`版本的`0.9`，即原始字号`1.17×`，链接继续保持较小的导航层级 | `src/styles.css`的`NF-RIGHT-READING-TYPE-02` Token 与定向选择器 | `.knowledge-final-reader / .source-final-body / .detail-panel` | 知识四状态、来源档案正文、记录详情 | 页面单独缩放整棵 DOM；连同链接、按钮、元数据和左侧列表一起缩放；用浏览器全局 zoom 代替语义字号 | 派生值与真实消费者合同 + TypeScript/Vite/Tauri构建 + 1702×1066同状态可见检查 | 已实现，待桌面确认 |
| 视觉与动效 Token | 颜色、阴影、时长、缓动与卡片层级 | `src/styles.css :root` 与 `.elevated-card` | 共享 CSS 类 | 全部卡片和控件 | 页面私建同类阴影与动效 | 对照稿和交互状态检查 | 已实现 |

## 入口矩阵

| 入口/消费者 | 是否存在 | 当前影响 | 唯一入口 | 最小验证 |
|---|---|---|---|---|
| 来源档案（含待确认例外） | 是 | 受影响 | `KnowledgeWorkspace(mode="sources")` → `KnowledgeRepository.listSourceArchive` | 已归类与待确认可筛选；正文按选择加载；只有待确认来源显示分类操作 |
| 主题管理（含低频维护） | 是 | 受影响 | `KnowledgeWorkspace(mode="topics")` → Domain/Topic/Structural Operation 命令 | 领域主题树可读；编辑和高级维护默认折叠；合并仍可撤销 |
| 知识视图 | 是 | 受影响 | `KnowledgeWorkspace(mode="knowledge")` → `getTopicDetail` | 领域→主题→命题阅读；竞争假设、有效期、决策账本真实读写 |
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
