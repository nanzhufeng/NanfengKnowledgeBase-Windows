# 南枫知识库核心工作区设计基线

状态：`LOCKED`

确认日期：2026-07-29

本文件把南烛枫在会话中确认的四张最终页面图转成可执行合同。它锁定的是核心产品组织、页面功能布局和交互状态；四套皮肤是另一个独立视觉合同。除非南烛枫明确提出新方向，后续开发必须同时继承二者。

## 0. 需求来源与推导顺序

四张页面图不是脱离产品逻辑的视觉稿，也不能只按像素或旧页面局部复刻。实现必须按以下顺序理解：

1. `docs/南枫知识库_产品定义与自动分类主规格.md` 是最高产品定义，规定本地优先、自动分类、主题框架、跨时期整合、证据、判断演化和上下文复用。
2. 南烛枫于 2026-07-29 重新明确：旧收录箱与来源档案合并，旧主题浏览器与整理工作台合并；人工分类不能成为主要使用路径；核心必须增加命题层、竞争假设、知识有效期和决策账本，并以良好层次直接展示长期知识成果。
3. 本轮重新提供的 `新建 文本文档.txt` 强化核心链路：`来源资料 → 主题 → 命题 → 竞争假设 → 支持/反对证据 → 当前判断 → 逻辑失效条件 → 决策和行动 → 结果 → 复盘`。其中命题层、证据锚点和决策结果记录是界面组织必须能够承载的对象，不是装饰性卡片文案。
4. 本文件的四张图负责把上述产品要求落为桌面工作区的页面组织、模块主次和交互状态；图片不能反向把软件简化成静态看板，也不能被旧 CRUD 页面结构包裹。
5. `src/theme/knowledgeSkins.ts` 和既有四套皮肤合同只负责同一组织框架的视觉呈现，不得产生另一套导航、栏位宽度、模块层级或交互结果。

### 0.1 从需求到三个入口

| 入口 | 日常用户任务 | 自动化优先结果 | 人工操作边界 | 核心对象 |
|---|---|---|---|---|
| 来源档案 | 阅读已导入来源及其整理结果 | 自动归入领域/主题、关联命题、给出置信度和依据 | 仅低置信、冲突、无合适主题时调整归属 | Source Item、Classification Suggestion、Evidence Anchor |
| 主题管理 | 查看和维护长期分类框架 | 自动归类依据、相似主题、结构建议和明确待处理事项 | 新建、编辑、合并、拆分预览与关系调整均为次级维护 | Domain、Topic、Alias、Relation、Structural Operation |
| 知识视图 | 直接阅读跨时期形成的知识与判断 | 汇总命题、竞争假设、证据、有效期、判断演变和决策结果 | 新证据、判断和决策的维护从成果阅读进入，不以大表单开场 | Proposition、Evidence、Judgment Snapshot、Open Question、Decision |

### 0.2 统一工作区框架

- 所有页面入口、所有四套皮肤使用同一个主导航组件、入口分组和交互结果，不能出现重复导航或另一套入口体系。
- 三个核心入口切换时，左侧主导航的分组、顺序、选中反馈和底部状态区保持稳定；同一皮肤内的宽度与位置不得随页面变化。
- 四张图中的左侧深蓝配色只属于`原版浅色`视觉，不是另外三套场景皮肤的皮肤来源。四张图约束左侧入口组织和层级；场景皮肤继续沿用已确认版本的背景、四周留白、圆角冷白磨砂侧栏和圆角主面板。
- 场景皮肤的外层留白、圆角和玻璃材质属于视觉外框，不得被误判为新的产品结构；其内部三入口、对象层级、默认状态和交互结果必须与`原版浅色`一致。
- 场景皮肤的核心工作区必须先铺一层完整、半透明、冷白磨砂底，再在其上放置树、列表、正文和语义卡；不能只给局部卡片磨砂而让场景背景直接进入大面积内容区。
- 中栏和右侧详情是核心工作区的共享组织方式：中栏负责定位对象，右侧负责阅读成果；不是在旧页面容器里再嵌套一套新页面。
- 辅助入口不得与三个核心入口同级争夺首屏，也不得恢复旧收录箱、旧主题浏览器或旧整理工作台。
- 手工标签不再作为独立导航或人工维护中心；批量导入导出统一进入`设置 → 数据与存储`。
- `设置 → 数据与存储`固定分为三层：`数据交换`只负责批量导入与内容导出；`备份与恢复`在同一区域成对提供完整备份创建与恢复；`高级维护`默认折叠，只承载打开数据目录、数据库完整性检查、搜索索引重建和明确标注“不含附件/导入原件/界面设置”的数据库快照。完整备份不得再在数据交换导出页重复出现。
- 批量导入导出页返回动作统一称为`返回上一级`，并直接回到已打开的`设置 → 数据与存储`弹窗，不得只回设置首页。数据与存储弹窗在1702×1066标准视口默认约1040×760，使用独立尺寸身份并支持右下角人工调节；数据交换为较小的次级操作区，备份创建/恢复在独立大区内成对排列，备份范围使用单行说明，高级维护继续默认折叠。问题参考为`data-exchange-return-parent-reference.png`（SHA-256=`16427445A2AA7B7E7917EA8CD6C40B204EC539B88B1A7248644FF8DAEEF4A1B5`）与`settings-data-storage-small-crowded-reference.png`（SHA-256=`539216D0D3394DD4A3420E64A51EE0BCFE4278B571B1D1F9BF6EC26D34BB23A9`）；它们锁定B页面功能布局和C交互问题，不锁定旧尺寸、拥挤排版或示例容量数据。
- 2026-08-01后续反馈替代上一条中“数据交换较小、备份区较大、备份范围单行说明”的局部布局：`数据交换 / 备份与恢复`固定为等宽等高双卡，每张卡只保留一个标题、一句提示和贴底操作区；不得再显示`批量导入与导出 / 完整备份适合换机与灾难恢复 / 备份范围`等重复说明。存储统计由App唯一刷新入口持有，窗口重新获得焦点时自动扫描，主界面容量区与设置概览共用刷新图标并同步结果；外部删除文件后不得继续依赖启动时旧缓存。

## 1. 确认对象分类

| 类别 | 本次状态 | 锁定内容 |
|---|---|---|
| A 产品与信息架构 | 已锁定 | 三个主入口；领域→主题→命题/竞争假设；来源、证据、判断、决策围绕命题组织 |
| B 页面功能布局 | 已锁定 | 四张最终页面图的栏位比例、模块组合、信息主次和默认模块 |
| C 交互与状态 | 已锁定 | 竞争假设默认、判断演变切换、独立滚动、时间线横向滚动、详情与选中项关联 |
| D 视觉皮肤 | 由既有四套皮肤合同独立锁定 | 页面布局不能替代或重写四套皮肤；皮肤也不能改变本文件的功能布局 |
| E 示例内容与数据语义 | 未锁定 | 图中的主题名称、数量、日期、百分比和示例文案仅用于表达结构，不是固定生产数据 |
| F 验收证据 | 代码与隔离自动验证已通过，真实桌面未验收 | 预览确认、代码集成、构建、隔离浏览器、BAT 路径和南烛枫真实桌面仍必须分层报告 |

## 2. 最终参考资产

统一规则：图片原件必须保留，不用聊天临时路径作为长期引用。

| 基准 ID | 文件 | SHA-256 | 锁定用途 |
|---|---|---|---|
| NF-CORE-KNOWLEDGE-HYP-01 | `screenshots/final-core-workspace/knowledge-view-competing-hypotheses.png` | `DD4232FB80D8261B62241ECB46C1D423FA11C2CC1C57696E0D08B949BC77F04E` | 知识视图默认“竞争假设”状态 |
| NF-CORE-KNOWLEDGE-EVO-01 | `screenshots/final-core-workspace/knowledge-view-judgment-evolution.png` | `906B6F6AACEB2668B3F6B87690AFEC31078E399CB09ED9824BBCB8379771E594` | 知识视图“判断演变”状态 |
| NF-CORE-KNOWLEDGE-OVERVIEW-02 | `screenshots/final-core-workspace/knowledge-auto-overview-above-fold-reference.png` | `2866E3D809995724C3B5C464E95783CB23E1E4F348936D6C51DA190D7AB555D1` | A/B/C/F：正式对象为空时仍自动生成当前判断、事实与线索、关键证据、待验证问题和建议下一步；首屏改为紧凑摘要，不照搬参考图的大卡高度，不锁定示例内容或编辑按钮 |
| NF-KNOWLEDGE-DIRECT-HYP-03A | `screenshots/final-core-workspace/knowledge-four-mode-redundant-hypothesis-heading-reference.png` | `CBACF895B5370B0C3F5D217E217F52BB36066883165F2B5EA76102C69E13767F` | B/F失败证据：`竞争假设`Tab下不得再重复“命题选择 / 从笔记正文提炼的竞争解释”说明条，直接进入假设卡 |
| NF-KNOWLEDGE-DIRECT-EVO-03B | `screenshots/final-core-workspace/knowledge-four-mode-redundant-evolution-heading-reference.png` | `56AC782C86B9E890A4FB861EF331086BE95B027AFBC5BF530847086E44CFC55A` | B/F失败证据：`判断演变`不保留编号步骤卡或“支撑材料”方法说明，直接进入跨时期事件与版本差异 |
| NF-KNOWLEDGE-DIRECT-SRC-03C | `screenshots/final-core-workspace/knowledge-four-mode-redundant-sources-heading-reference.png` | `5CC418617CAF2DFF69BBE5CC3B15B0716992325C3F00028B0DBD407856FD0350` | B/F失败证据：`笔记与来源`不重复状态标题、阅读方法和“阅读主体”步骤卡，直接进入笔记索引、正文和来源三栏 |
| NF-KNOWLEDGE-DIRECT-DEC-03D | `screenshots/final-core-workspace/knowledge-four-mode-redundant-decisions-heading-reference.png` | `92D302B1443B3F073337117DF40E4C43065398A39656B8F73B17A994AF356F00` | B/F失败证据：`决策版本`不使用“完整链路”说明卡复述卡片内容，直接进入判断、决策、行动、结果/复盘版本卡 |
| NF-CORE-SOURCE-01 | `screenshots/final-core-workspace/source-archive-final-layout.png` | `5CB176569518CBB06D05F5109C9D16F6B50CAD4984E35F36AAE22B85B004D158` | 来源档案最终功能布局 |
| NF-CORE-TOPIC-01 | `screenshots/final-core-workspace/topic-structure-final-layout.png` | `9D7AC64C97009BD2CD514CA57CE728D1CD7B6FD6F7B15ED983C971A15C6F8EAD` | 主题管理最终功能布局（资产文件名保留历史命名） |
| NF-SKIN-SCENE-01 | `screenshots/final-core-workspace/scene-skin-visual-baseline.png` | `D61D31AE2A998D456BD8A06879621F4CBF4EBA44EB850FFAC18E229F5DEA3081` | 三套现存场景皮肤的视觉外框：背景、留白、圆角冷白磨砂侧栏与主面板；原图中的已移除皮肤只作历史记录，不再锁定 |
| NF-SKIN-LAYOUT-02 | `screenshots/final-core-workspace/classic-skin-shared-layout-reference.png` | `30A4C41F1B2B93FAB3A327813D8F947FA88EB9B7B9CFFBF62460F84A7A6271EB` | D：原版浅色保留深蓝侧栏、冷灰工作区和白卡效果；外层留白、圆角、栏位起点和内部间距改为与场景皮肤完全共用 |
| NF-SKIN-REMOVE-03 | `screenshots/final-core-workspace/bronze-skin-removal-reference.png` | `2E142233A33D483F105EE5EC92B9D1885504A11E37CE5787FB48B4A08260D000` | D：铜金发簪从皮肤目录、选择界面和资源中删除；旧偏好回退默认皮肤，不新增替代项 |
| NF-SCENE-TEXT-CONTRAST-01 | `screenshots/final-core-workspace/dynamic-scene-text-contrast-reference.png` | `8EDF75A9C83DCC19E64E1FD7C86AAE3D5573F12B1F14E9E5B576A9C31F963A39` | 动态背景上的页面标题、说明和空状态必须保持可读；锁定明暗反差、冷暖反向与复杂图片保护，不替换皮肤背景或页面布局 |
| NF-NOTE-LIST-ACTIONS-01 | `screenshots/final-core-workspace/single-note-list-actions-reference.png` | `ED1E72F2ED0EF6432A16BC58B36019393A29475E34D023B8912497DDCD3510AE` | 单篇笔记列表选中项的统一快捷操作：收藏、导出、更多；只锁定 B 页面功能布局与 C 交互，不替换四套皮肤 |
| NF-NOTE-ACTIONS-HOVER-02 | `screenshots/final-core-workspace/note-actions-hover-only-reference.png` | `17EEB18E859BE05676E047085C85499B7E75A71DB4C04D36E089B070980323EE` | 三个快捷操作以鼠标悬停卡片时显示为标准；选中卡片或卡片自身获得焦点不得让操作常驻。键盘实际聚焦操作按钮及菜单已展开时继续显示，以保证可访问性和操作稳定性；此条替代旧资产中“选中即显示”的交互解释，只锁定 C 交互 |
| NF-SOURCE-LIST-ACTIONS-02 | `screenshots/final-core-workspace/source-list-actions-gap-reference.png` | `AEF012CA15AA9F0762E24127D2F135330C78461DE42F772B9DC44E44B36A7803` | 来源档案每一条来源都必须具备同一套悬停快捷操作，不得因尚无 legacy Record 而缺失；只锁定 B/C，不改变正式来源对象 |
| NF-SOURCE-LIST-META-01 | `screenshots/final-core-workspace/source-list-metadata-reference.png` | `E033849FE0D4F4023E9D7017AEB17216B078EBC1511C3F55B826C41F744C5DEA` | 来源列表删除没有实际意义的重复“0篇笔记”，统一展示真实主题、来源和右上角日期 |
| NF-NOTE-SEMANTIC-ICON-01 | `screenshots/final-core-workspace/note-semantic-icons-reference.png` | `A92BC75927034D623FC8605C3021CE7539EFA6AA8281A3EC09A8AF03BBC66080` | 单篇笔记卡按内容语义使用不同 Lucide 图标，不再重复无意义的 file 徽标；不改变皮肤色彩合同 |
| NF-RECORD-LIST-PANEL-02 | `screenshots/final-core-workspace/record-list-panel-reference.png` | `2DE90964664F5C312E2041E2C9B8F4F64F0CF3592622E5FFA3F747B918CA102A` | 来源档案、我的收藏、持续跟踪、判断更新共用同一列表卡和列表面板语言；来源档案独有状态/全部加载控件单独保留 |
| NF-RECORD-LIST-DATE-03 | `screenshots/final-core-workspace/record-list-date-format-reference.png` | `CCE8F3AA271F357B4896C5C861FA4828491E53C0723B9A751FB50828AB91BF3F` | 四入口列表卡右上日期统一显示完整年月日，不再只显示月日 |
| NF-RECORD-LIST-DENSITY-03 | `screenshots/final-core-workspace/record-list-compact-density-reference.png` | `C261122BB8B0792BDDCF8A40AE07D4EFA4007FF091E512A3A80CC6D934DE7B15` | 小窗口下优先保留标题和第二行真实内容：默认紧凑、缩小语义图标、标题最多两行、隐藏可见“主题/来源”标签但保留实际值 |
| NF-RECORD-LIST-TOOLBAR-03 | `screenshots/final-core-workspace/record-list-toolbar-overlap-reference.png` | `93D2E680D35A658B3E7F4EEB4A88EE935B187A74DDBB9049C92ECC4D26DDAB5D` | 四入口共享显示工具栏在窄列表栏中不得出现摘要、卡片模式和排序控件重叠 |
| NF-RECORD-LIST-TOOLBAR-04 | `screenshots/final-core-workspace/record-list-toolbar-right-alignment-stress-reference.png` | `A9932BD12296F4DC6EC77C131D03CCFF8353499218B29F4306C4E7EDD94497EB` | 卡片模式和排序必须作为一个操作组贴齐工具栏右侧；验收不得只使用0或个位数，至少覆盖三位数计数压力状态 |
| NF-RECORD-LIST-TOOLBAR-05 | `screenshots/final-core-workspace/record-list-toolbar-far-right-reference.png` | `2321E867DF98D5E18EB197A3027E7FFAE4D6BB1E4E771A7F96767CC9A16CE094` | “贴齐右侧”按按钮组右边缘与工具栏内容右边缘重合验收，不接受按钮仅排在摘要右边但右侧仍留大块空白 |
| NF-RECORD-LIST-FILTER-06 | `screenshots/final-core-workspace/record-list-filter-private-branch-reference.png` | `EFB5F042C0F101B80F39FCBEE833EC87CDC3CE953D01472B030BB8469F24A801` | 来源档案不得保留页面私有筛选浮层；四入口的筛选按钮、组合筛选容器、字段渲染、重置/应用及外部点击/Escape关闭由同一共享组件持有，入口只提供字段和业务状态 |
| NF-RECORD-LIST-FILTER-07A | `screenshots/final-core-workspace/unified-filter-source-reference.png` | `1417525BD2CD88EB21A2729530903F0D5A36FD8D39921C4E96B48AED63204166` | 四入口“来源”统一指列表卡第二行显示的真实来源名称或文件名；禁止用`file/json/ai_conversation`等来源类型冒充来源 |
| NF-RECORD-LIST-FILTER-07B | `screenshots/final-core-workspace/unified-filter-status-reference.png` | `63173FE4BDFE586562C16A72E31AC9FE2D4CD5411E96DA20AA7A73E16965A2A1` | 四入口“状态”统一为记录状态：全部状态、普通记录、持续跟踪、待验证、判断更新；来源整理状态`全部/待确认/已归类`只保留下方专属状态行，不得混入组合筛选 |
| NF-RECORD-LIST-FILTER-07C | `screenshots/final-core-workspace/unified-filter-topic-reference.png` | `4C7F7DFB2ED9CA51AC42B6F848F5F3BDA7DED5F416C25DEB936443AAF2769235` | 四入口第三个组合筛选字段统一为“主题”，共同消费正式主题目录；我的收藏、持续跟踪、判断更新不得再使用“标签”替代 |
| NF-RECORD-LIST-SUMMARY-07 | `screenshots/final-core-workspace/record-list-summary-preservation-reference.png` | `9F4A74768F331BA0D70CF04B9B21F2648D993FE2CF2718365D150799A8738B2D` | 右侧操作贴边不能以吞掉左侧摘要为代价；入口名、计数与“条”必须完整保留，左右区域独立定位且不重叠 |
| NF-STANDALONE-TITLE-08 | `screenshots/final-core-workspace/standalone-file-title-date-fallback-reference.png` | `3B268B9628BD0136F5A174975B4C535125830DBB9D6EB48A877CCC452D2E5C92` | E类标题语义与F类失败证据：单篇文件已有“052 个人八字丙午年壬辰月”等有效标题时，正文中的“2026年4月5日”只能作为日期，不能充当标题；不锁定截图排版或皮肤 |
| NF-SOURCE-HEADER-ACTION-09A | `screenshots/final-core-workspace/source-header-orphan-inbox-reference.png` | `F9F451D9B128C36AB478F7FBEE6FF8F1A9A1AE5C355BC20D3D1888F230CFD5A4` | B/C/F失败证据：来源档案顶栏的托盘图标没有点击、状态或说明，不得作为孤立装饰动作保留；不锁定截图皮肤 |
| NF-SOURCE-HEADER-ACTION-09B | `screenshots/final-core-workspace/source-header-actions-value-reference.png` | `C43088050A3164AA457F425F5FC3D472B243F066F20DBE13B9EE7B6D233B8975` | B/C/F：来源档案顶栏只保留有实际结果的`自动整理待归类来源`按钮；无标签图标不得重复页面身份或下方筛选能力。其他顶栏孤立图标同样必须具备明确动作、状态或可访问说明，否则删除 |
| NF-SOURCE-BODY-LABEL-10A | `screenshots/final-core-workspace/source-preview-redundant-label-reference.png` | `04A843CC1604A23D4B2FD8B0E617FBDE820BCF8E769BA1A32DEF6CAB1FA45AB7` | B/F失败证据：来源正文工具区的`正文预览`只是重复说明当前区域，没有状态或操作价值，必须删除；不锁定截图皮肤 |
| NF-SOURCE-BODY-LABEL-10B | `screenshots/final-core-workspace/source-body-clean-heading-reference.png` | `E8A02326A515335CA6A1228BD77838D3625516C6FFCA4B1BD59C8F8FDFCC207A` | B/C/F：正文区域保留唯一`来源正文`标题、搜索与查看详情入口；长正文仍可内部截断以保证性能，但不得额外显示无意义的`正文预览`标签 |
| NF-SOURCE-PAGE-HEADING-10C | `screenshots/final-core-workspace/source-page-duplicate-heading-reference.png` | `49BF19395EA6B0C965EB0B7BBF66FECDF7A166552480365DD16623A13F593E87` | B/F失败证据：侧栏已明确当前入口时，来源页顶部再显示`来源档案`大标题只重复页面身份并挤占列表空间；删除该标题，保留右上唯一有效整理动作，不锁定截图皮肤或数据 |
| NF-SHARE-DIALOG-LAYOUT-11A | `screenshots/final-core-workspace/share-dialog-small-footnote-hidden-reference.png` | `DF9D4C0F968EDBBB10D974EF119CDE75F926DFCD6CAFF9A062C29FDBCF7FAD4F` | B/C/F失败证据：完整笔记导出弹窗默认尺寸偏小，正文与弹窗外层共同滚动，导致底部格式说明不能默认展示；不锁定截图中的具体笔记内容 |
| NF-SHARE-DIALOG-LAYOUT-11B | `screenshots/final-core-workspace/share-dialog-large-footnote-visible-reference.png` | `52C7EDFFB320F297F9ACBA086615A4CE125955654F6C05778B44A057AFBBCABD` | B/C/F：完整笔记导出弹窗默认占视口约90%，上限1460×980；标题、导出按钮和底部格式说明固定可见，只有中间正文独立滚动。1702×1066为标准对比证据，1280×720为额外响应式检查 |
| NF-SOURCE-DETAIL-ACTIONS-12A | `screenshots/final-core-workspace/source-detail-actions-oversized-reference.png` | `2C6F2C75F07E745C9770BBAB68CCD1001B999ED52E8B8669A41C353DB419954B` | B/D/F失败证据：来源详情标题区的`返回主题来源 / 查看详情`比例偏大且贴近顶部，破坏标题、元数据和正文之间的视觉节奏；只锁定局部按钮比例与位置问题，不改变动作语义 |
| NF-SOURCE-DETAIL-ACTIONS-12B | `screenshots/final-core-workspace/source-detail-actions-compact-aligned-reference.png` | `F45E517F278D8428204E5ED5D6DEC71B160FD91AC424767B8FBEBE5D25BA2994` | B/D/F：来源详情标题动作组统一为30px高、12px文字、13px图标和6px间距，并下移到与标题行顶边对齐；保持右对齐、原有功能和四套皮肤，不锁定示例来源内容 |
| NF-ATTACHMENT-IMAGE-PREVIEW-13A | `screenshots/final-core-workspace/attachment-image-preview-window-reference.png` | `E28AA1A84BEB57E82429FD393560851B42C2BEC0B22F63DB6DE4A57636BF47F7` | B/C/F失败证据：图片附件预览默认窗口偏小且只依赖滚动，不满足默认全屏、完整适配和直接查看细节的要求；只锁定预览器问题，不改变附件存储或打开原文件语义 |
| NF-ATTACHMENT-IMAGE-PREVIEW-13B | `screenshots/final-core-workspace/attachment-image-preview-fullscreen-implemented.png` | `91B0D57FCF6FA3D41ACEF7413F9686D1CA8FC3E02B97FA8F82AF5A05722D3297` | B/C/F：图片附件预览默认占满可用视口，标题和打开原文件动作保持可见，图片按 contain 完整显示；1702×1066、100%、1×作为标准实现证据 |
| NF-ATTACHMENT-IMAGE-PREVIEW-13C | `screenshots/final-core-workspace/attachment-image-preview-resize-pan-implemented.png` | `B62AAE7B5696B034B21B1840A6CC3A64D46B728C870847B1E4F7994B28385B41` | C/F：右下角拖动可人工调整预览器大小，图片左键拖动平移；Ctrl+滚轮以光标位置为中心缩放，缩放范围25%–800%，普通滚轮不改变图片比例 |
| NF-ATTACHMENT-IMAGE-PREVIEW-13D | `screenshots/final-core-workspace/attachment-image-preview-light-surround-reference.png` | `8434B93FD44E47E0C12DE60B479408125ED8E6ED21267878E7D563E76640C962` | B/C/F失败证据：图片外围、标题栏和画布使用浅色会削弱图片主体；只锁定图片预览环境应统一暗底及中键恢复完整适配，不锁定截图中的图片内容 |
| NF-ATTACHMENT-IMAGE-PREVIEW-13E | `screenshots/qa/attachment-image-preview-dark-middle-reset-1702x1066.png` | `F6E3D31F8F97852A3711407FAAC407AF5EF93CA1715AC21F7E8EA2C0FA975A5C` | B/C/F：图片预览外壳、标题栏和画布统一为低干扰暗底；中键点击画布把缩放恢复为100%、位移恢复为0，并重新完整适配当前预览窗口。1702×1066、100%、1×作为实现证据 |
| NF-ATTACHMENT-IMAGE-PREVIEW-13F | `screenshots/final-core-workspace/attachment-image-preview-quality-loss-reference.png` | `E5BB1954187E7EB3C84F47DCD36D4BCE54A46D244F0E9D404B0AE37181BC84D7` | C/F失败证据：旧实现先把图片强制缩成画布尺寸，再对该适配结果做CSS放大，顶部505%并不等于原图像素比例，细节明显弱于原文件。锁定图片必须以`naturalWidth × naturalHeight`原始像素建立渲染面，适合窗口只作为基础比例；百分比显示实际像素比例，达到100%时为原图1:1。只锁定渲染链与缩放语义，不锁定截图中的图片内容 |
| NF-HIERARCHY-GRID-01 | `screenshots/final-core-workspace/hierarchy-grid-alignment-reference.png` | `5F36DB52BD60275C6ACBA5D88B51A83656261322FD5ADC524BC8F3683227FEA0` | 层级缩进只作用于图标和标题；领域、主题及子项的右侧数量共用固定列，避免两列布局错位 |
| NF-TOPIC-HIERARCHY-SHARED-02 | `screenshots/final-core-workspace/topic-hierarchy-shared-code-reference.png` | `C3A71BEF045B859EA58A9DDCCCE413474FF6FA0DA533705A809CA90590DC9ECD` | B/C/F：主题管理中栏的领域→主题卡片列表必须直接复用知识视图同一底层组件；截图用于指出平行实现失败，不锁定示例主题、数量或皮肤 |
| NF-TOPIC-ACTION-OWNER-03 | `screenshots/final-core-workspace/topic-heading-duplicate-edit-action-reference.png` | `493B38DEDD708339357BB8E5E9ACCD73234DD836AE01770AD86677E2C7D1C3EE` | B/C/F：主题详情标题区的“编辑主题”与下方“进入主题管理”职责重复，标题区按钮删除；主题维护只保留下方唯一入口，不锁定皮肤 |
| NF-TOPIC-EMPTY-DISPOSITION-04 | `screenshots/final-core-workspace/topic-empty-user-review-reference.png` | `70D4741436B171DC0CEFB6C582FEBBD198BD1E0EEE46FA1A53BE9BEADCB7E7D2` | A/B/C/F：零来源不等于空壳。已有明确名称、边界、别名或规则的主题作为未来资料落点保留在列表，不再生成“全局检查 / 检查空主题 / 逐个查看”任务；是否合并或清理由独立结构证据决定，不能把判断再次交给用户 |
| NF-TOPIC-HIERARCHY-VALUE-05 | `screenshots/final-core-workspace/topic-hierarchy-no-value-reference.png` | `63F31E355D3DDD2335AD807AC02401DC34022E8C238636B82D7E5373A2F9B656` | B/E/F：主题详情不得用“领域直属 / 暂无子主题 / 暂无关系 / 0个知识对象”等相同占位拼出伪信息区。只有真实父主题或子主题存在时展示`主题层级`，且只列实际内容；关系建议由右侧待处理事项唯一展示，知识对象数量由自动归类依据唯一展示 |
| NF-TOPIC-EXCLUSION-OWNER-06 | `screenshots/final-core-workspace/topic-exclusion-system-owned-reference.png` | `CD75A548AC1D6017E5FA0AEE5FD5B2CB6D7CA6ED309605A6522154F7638A5A07` | A/B/C/F：排除规则是系统自动分类的防误归类能力，不是普通用户待补资料。没有有效排除项时隐藏整块；存在时只读显示`自动排除`摘要和“不删除来源”说明。日常主题页不得提供补充、调整或维护规则入口，技术编辑只保留在高级维护区 |
| NF-TOPIC-EXCLUSION-OWNER-06B | `screenshots/final-core-workspace/topic-exclusion-system-owned-implemented.png` | `19836EC8A8C9030ED3523776EE5C236479CE7258187DA1FA79F58C419762F6B9` | B/C/F：1702×1066隔离实现证据；主题边界只读显示系统排除摘要，自动归类依据不再包含维护按钮，右侧待处理事项不再要求补规则。示例`招聘启事`只验证呈现与系统所有权，不是正式库规则承诺 |
| NF-TOPIC-MAINTENANCE-SCROLL-06A | `screenshots/final-core-workspace/topic-maintenance-return-overlap-reference.png` | `C17C57C1DD990EEE14290A321FB3DD5286A0F16116427024FFEC3A66A8CAAF31` | B/C/F失败证据：`返回上一级`不得紧贴右边缘，也不得与向上滚动的主题维护内容共享裁切区域或发生视觉穿插；不锁定截图皮肤与示例内容 |
| NF-TOPIC-MAINTENANCE-SCROLL-06B | `screenshots/final-core-workspace/topic-maintenance-fixed-return-reference.png` | `40834336DC3452C876E4EE05E12E867EEE05883775E3A0FA30D69C49E9507C79` | B/C/F：次级维护层统一拆为固定控制区与独立正文滚动区；返回按钮向左保留至少38px外侧间距，正文裁切边界位于按钮下方至少8px，滚动时按钮不得位移或被内容穿透 |
| NF-SETTINGS-SHORTCUT-LAYOUT-01 | `screenshots/final-core-workspace/settings-shortcut-layout-reference.png` | `A71632C578940F430C7DBF879BED49B40D62E92053CD95E830171D977C948B5A` | B/C/D/F：快捷键弹窗不得继承其他通用弹窗的放大尺寸；使用独立的内容自适应居中尺寸、清晰标题摘要和两列六项快捷键卡片。1280×720与1702×1066均保持均衡留白，小于760px时转为单列；不改变快捷键语义或关闭行为 |
| NF-SETTINGS-STORAGE-CARDS-02A | `screenshots/final-core-workspace/settings-storage-card-duplication-reference.png` | `B3BBFA32D47232A2FE3B751709A6EE7F1CDDEC6DE7CC47B13BA5DAA91D4B67FD` | B/D/F失败证据：数据交换与备份恢复不得使用重复标题、额外范围说明或不等比例双卡；锁定等宽等高、单标题、单提示和底部操作区，不锁定示例数值 |
| NF-SETTINGS-STORAGE-STATS-02B | `screenshots/final-core-workspace/settings-storage-stale-stats-refresh-reference.png` | `B6D1FB7C50DAF60C99EE596D60AFF33CB6BEF01AE9F821D510F5D0FD1775B28C` | C/F失败证据：用户在外部删除备份后，设置与主界面容量不得继续显示旧统计；两个显示入口共用实时扫描与刷新状态，应用重新获得焦点自动同步，并保留可见的手动刷新图标 |
| NF-CARD-CONNECTOR-01 | `screenshots/final-core-workspace/card-to-card-connector-reference.png` | `DEC71617FF1BC4E455D2D04B71CC84E9039BDFD7024937BB97B7694A3264A91B` | 所有关联线的统一几何与强调：端点圆心压在左右卡片边缘、线段只跨卡片间隙、右侧关联卡使用完整橙色线框；只锁定 C 交互与局部视觉，不替换皮肤 |
| NF-RECORD-SUBVIEW-SIZE-01 | `screenshots/final-core-workspace/record-subviews-size-reference.png` | `E7402698D4D65EFC8D63CB7A1E78B5F482D74954D65D1DD89212484EA8EB9071` | `我的收藏 / 持续跟踪 / 判断更新`三个记录入口；双主卡尺寸和阅读空间参照来源档案，只锁定 B 页面布局，不替换皮肤或业务对象 |
| NF-RIGHT-READING-TYPE-01A | `screenshots/final-core-workspace/right-reading-hypotheses-font-reference.png` | `AE4613DAE6D68BB8944946C236EFB2AE000F4A320DFDE28A62351C0A5E360D26` | 右侧竞争假设的主体阅读字号范围；链接字号不变 |
| NF-RIGHT-READING-TYPE-01B | `screenshots/final-core-workspace/right-reading-source-body-font-reference.png` | `711D35B9F41CA2AFCCA97F9CCCEEA9992982B189BD5D62B845DE5EC24BBBF745` | 来源档案右侧正文的主体阅读字号范围；链接字号不变 |
| NF-RIGHT-READING-TYPE-01C | `screenshots/final-core-workspace/right-reading-evolution-font-reference.png` | `019EA4244E19EE3C8BAE2C769A49EB57A29C5F50DE5E878F83C558CC35CAA3BD` | 判断演变版本差异的主体阅读字号范围；链接字号不变 |
| NF-RIGHT-READING-TYPE-01D | `screenshots/final-core-workspace/right-reading-decisions-font-reference.png` | `7D5A06E81CEEEBD1B9E668D99C0872EFD537F485F2E29B444A6512F4718DAF2E` | 决策版本卡的主体阅读字号范围；链接字号不变 |
| NF-RIGHT-READING-TYPE-01E | `screenshots/final-core-workspace/right-reading-record-content-long-font-reference.png` | `D9A7BEA4642E84D05512EBA286DC78886EE6CA637664E97001C9AC9DA6E6B6A0` | 记录详情长正文的主体阅读字号范围；链接字号不变 |
| NF-RIGHT-READING-TYPE-01F | `screenshots/final-core-workspace/right-reading-record-content-short-font-reference.png` | `36E86ED0B5E756B8A1DB31F25A30B9F09DF5720D8F34F050E87B927864641079` | 记录详情短正文的主体阅读字号范围；链接字号不变 |
| NF-RIGHT-READING-TYPE-02A | `screenshots/final-core-workspace/right-reading-scale-090-plain-text-reference.png` | `CCF2D971B0A971142BED4511D8DFDC44B17513B05A80030F2483B5A87C79380B` | D/F：普通长正文当前字号略大，主体正文按当前尺寸统一缩小到`0.9`；不改变内容、布局或滚动 |
| NF-RIGHT-READING-TYPE-02B | `screenshots/final-core-workspace/right-reading-scale-090-knowledge-reference.png` | `E8E31C788290E0C104B4FA05174C1C6BDEBBFF94724D5062972E1366AD16A6B1` | D/F：知识卡的核心解释与提取依据消费同一`0.9`阅读倍率；不改变语义色、卡片结构或证据关系 |
| NF-RIGHT-READING-TYPE-02C | `screenshots/final-core-workspace/right-reading-scale-090-conversation-reference.png` | `19245A1AAB6B0A4A80561B782DC69BF7C0E21594CE024C0118FA02ED38DD7501` | D/F：角色会话正文与Markdown标题按同一`0.9`阅读倍率缩小；链接、角色/时间元数据和操作不缩放 |

### 知识视图：竞争假设

![知识视图竞争假设](screenshots/final-core-workspace/knowledge-view-competing-hypotheses.png)

### 知识视图：判断演变

![知识视图判断演变](screenshots/final-core-workspace/knowledge-view-judgment-evolution.png)

### 来源档案

![来源档案最终布局](screenshots/final-core-workspace/source-archive-final-layout.png)

### 主题管理

![主题管理最终布局](screenshots/final-core-workspace/topic-structure-final-layout.png)

### 场景皮肤视觉外框

![场景皮肤视觉基线](screenshots/final-core-workspace/scene-skin-visual-baseline.png)

此图只锁定皮肤视觉，不锁定图中的入口名称、入口顺序、`全部记录`、示例主题或空状态内容。

### 动态场景文字可读性

![动态场景文字对比度问题基准](screenshots/final-core-workspace/dynamic-scene-text-contrast-reference.png)

此图锁定的是背景变化时的可读性问题和动态配色原则，不锁定截图中的具体文字颜色。实现必须由共享算法根据背景明暗与冷暖计算，不能为奔马皮肤单独写死颜色。

### 卡片到卡片的关联线

![卡片到卡片关联线基准](screenshots/final-core-workspace/card-to-card-connector-reference.png)

此图只锁定关联线端点、卡片边缘和橙色强调关系，不锁定背景、卡片尺寸或皮肤材质。

## 3. 跨页面不可丢失合同

1. 左侧全高主导航承担入口和状态，不被底部时间线或右侧详情侵占。
2. 中间栏保持较窄，只承担领域/主题树或来源列表；把主要阅读空间让给右侧详情。
3. 中栏选中项与右侧详情使用细橙色关联线和双锚点；左端点圆心必须压在左侧选中卡片右边缘，右端点圆心必须压在右侧关联卡片左边缘，线段只跨越两张卡片之间的空隙。左右关联卡片均使用有层次的完整橙色线框，右侧目标卡不得只显示连接点而缺少闭合边框。位置随卡片真实几何对齐，不允许在页面内使用负像素或额外宽度补偿。
4. 中栏和右侧详情各自独立滚动；页面标题、模块导航和右侧卡片不能因左侧列表滚动而整体漂移。
5. 纵向内容不够时使用各自滚动条；判断/决策时间线不够时使用底部横向滚动条，不压缩成不可读卡片。
6. 自动整理结果优先呈现，人工修正是次级入口；不能把用户重新拖回逐条分类的主流程。
7. 四套皮肤只改变背景、玻璃、颜色和材质，不改变入口、对象层级、模块位置、默认状态和滚动合同；四套共用同一外层留白、圆角、栏位起点和内部间距。
8. 右侧阅读页的正文、核心观点、证据、版本差异和决策内容统一使用共享阅读字号 Token。南烛枫于2026-08-01要求把此前`1.3×`版本整体缩小到`0.9`，最终相对各自原始字号为`1.17×`；Markdown标题同步等比缩小。来源链接、正文超链接、跳转入口、按钮、角色/时间元数据和左侧列表字号保持不变。知识四状态、来源档案正文和记录详情不得各自解释倍率；`NF-RIGHT-READING-TYPE-02A/B/C`替代`01A-F`的字号大小解释，旧资产只保留消费者覆盖历史。
9. 三套场景皮肤中直接覆盖在背景图上的文字必须由共享场景前景 Token 动态生成：亮背景使用足够深的文字、暗背景使用足够亮的文字；暖背景使用偏冷文字、冷背景使用偏暖文字。主文字相对代表背景至少达到`5:1`，次要文字和强调文字至少达到`4.5:1`，复杂图片使用与明暗方向一致的光晕保护。冷白磨砂卡片内的文字使用独立表面 Token，禁止把图片前景色直接复用到浅色卡片；`原版浅色`不受场景采样影响。
10. `我的收藏 / 持续跟踪 / 判断更新`共用来源档案的双卡阅读比例、14px 卡片间距和等高主卡；左卡承担检索与列表，右卡承担正文与知识详情。三个入口不得各自发展不同的卡片宽度或高度算法。
11. `来源档案 / 我的收藏 / 持续跟踪 / 判断更新`必须复用同一列表面板外壳和单篇列表卡组件，并统一语义图标、主题/来源元数据、右上角日期、默认紧凑状态和悬停操作布局；右上日期使用`YYYY-MM-DD`完整年月日，图标采用小尺寸，标题允许两行，第二行只显示真实主题与来源值，不重复可见字段标签。共享问题默认同时修复四个入口，四个入口只保留各自真实业务差异，不得复制四套面板或卡片实现。
12. 来源对象尚无兼容 Record 时，读取列表不得批量制造假记录；收藏、完整导出、持续跟踪或回收站动作发生时，才按需建立一个可复用的操作侧车。正式来源正文、主题归属和 migration v4 对象始终是知识真相。
13. 知识视图与主题管理的领域→主题中栏必须直接复用同一`KnowledgeTopicHierarchy`组件。领域标题、折叠/自动展开、主题行、父子缩进、固定数量列、选中态、空状态和列表滚动只有一个实现所有者；两个入口只能传入各自的搜索/筛选结果、当前主题和选择回调，不得复制 JSX 或维护页面私有折叠状态。
14. 完整笔记导出弹窗默认使用约`90vw × 90vh`的大尺寸（最大`1460 × 980`），并使用独立尺寸身份，旧的小尺寸偏好不得覆盖新默认值。弹窗外层不得滚动；标题、导出按钮和底部格式说明固定展示，只允许中间完整正文独立滚动。标准1702×1066与响应式1280×720都必须完整露出底部说明。
15. 来源详情标题区的动作组保持右对齐，但不得贴着标题区最上沿或使用与正文主按钮相同的大比例。`返回主题来源 / 查看详情`及同组条件动作统一使用30px高度、12px文字、13px图标和6px间距，动作组顶边与来源标题行顶边对齐；按钮功能、可访问名称和导航结果不变。
16. 软件内置图片附件预览默认占满当前应用可用视口，并提供稳定的右下角缩放把手供人工调整窗口大小。图片元素必须按`naturalWidth × naturalHeight`原始像素建立渲染面，不能先铺满画布再放大；首次打开只计算不放大小图的完整适配基础比例，顶部百分比显示相对原始像素的实际比例，100%表示原图1:1。`Ctrl + 鼠标滚轮`以光标为中心在适配下限至800%范围缩放，鼠标左键拖动图片位置；鼠标中键点击图片画布必须把缩放和平移恢复为当前窗口的完整适配状态。调窗时只有仍处于适配状态的图片自动重算，已经放大或平移的检查位置必须保持。图片预览的外壳、标题栏和画布统一使用低干扰暗底突出图片，且不随四套应用皮肤切换为浅色；窗口调整、图片缩放和平移互不抢占指针，关闭、Escape和打开原文件语义保持不变。

## 4. 页面合同

### 4.1 来源档案

- 左：紧凑搜索、筛选、状态和来源列表；来源专属的`全部 / 待确认 / 已归类 / 全部加载`独占一行，其余卡片视觉和记录入口一致。
- 右上：来源标题、文件/平台元数据、返回主题来源与查看完整正文；单篇笔记操作由左侧选中列表项统一承担。
- 右侧首屏以统一格式的来源正文为绝对主体；自动整理结果压缩为标题附近必要元数据，不单独占用大卡片。
- 右侧窄栏只在确有知识关联或人工异常时显示，并可收起；不得与正文或知识视图重复堆叠信息。
- 来源列表保留独立快速定位控件（顶部 / 滑块 / 当前），只滚动列表、不切换当前选中来源；正文里的文字查找只称“搜索”，不能混称列表定位。
- 侧栏已承担`来源档案`入口身份，来源页正文顶部不得再显示重复大标题，也不显示“原始来源与自动整理结果”或已加载总数说明；右上只保留有实际结果的`自动整理待归类来源`。选中来源一旦进入顶部粘性筛选区或离开列表可读边界，选中卡与关联线必须立即退出可见关联态，不能穿透筛选区或残留在旧位置。
- 来源详情必须支持反向进入对应主题的知识视图；知识证据进入来源时仍保留正文锚点。
- 所有单篇来源或笔记列表统一复用共享卡片与`NoteListActions`：鼠标悬停卡片时在右侧中部显示收藏、导出和更多三个图标，选中状态和卡片自身焦点不得触发常驻显示；键盘实际聚焦到任一操作按钮或更多菜单已展开时保持显示。显示/隐藏不能改变卡片高度或宽度；更多菜单放`查看详情 / 持续跟踪 / 复制标题 / 移入回收站`。来源详情不再重复收藏/导出/删除，只保留`返回主题来源 / 查看详情`等详情级动作。
- 每张列表卡只展示一个标题、一组真实`主题 + 来源`元数据和右上角完整年月日；没有可靠语义的`0篇笔记`不得占位。四入口默认使用紧凑卡片；图标按内容语义区分并使用小尺寸，标题最多展示两行，第二行隐藏可见`主题 / 来源`字段名以把空间留给真实值。共享显示工具栏中，左侧`入口名 + 计数 + 条`与右侧卡片模式/排序操作组必须独立定位：左侧完整保留，右侧绝对贴齐工具栏内容右边缘，二者不可相互压缩、遮挡或重叠，并覆盖120与999等三位数状态。
- 四入口筛选统一消费`UnifiedNoteListFilter`及共享字段工厂；字段顺序和语义固定为`来源 / 状态 / 主题 / 起始日期 / 结束日期`。来源按卡片显示的真实来源名称匹配，状态统一为四种记录状态，主题共同消费正式主题目录；来源档案的`全部 / 待确认 / 已归类`只属于下方来源整理状态行。按钮、浮层、字段选项生成、匹配、重置/应用、外部点击与`Escape`关闭不得出现页面私有实现。
- 来源字段和卡片第二行必须共同读取统一 Source Collection；ZIP/JSON分片不得直接显示为多个来源，零散单篇文件共同显示为`零散文件导入`。来源档案的共享筛选提供`管理来源名称`，重命名后四入口同时刷新；原文件名不作为目录名称继续暴露，但必须在数据层保真。
- 单篇MD/TXT/HTML及未来可提取正文的文档若存在显式标题、显著标题或有效文件名，来源详情、四入口卡片和兼容Record必须显示同一个标题；日期属于内容时间，不得因出现在正文首个Markdown日期标题中而抢占文件标题。历史通用占位标题使用同一规则恢复，用户改名保持最高优先级。
- `source-catalog-divergence-filter-20260801.png`与`source-catalog-divergence-card-20260801.png`锁定的是E类示例语义与F类反例证据：筛选和卡片来源不一致属于失败状态，不是可继承布局参考。对应 SHA-256 分别为`1E9508513918D97A2FFFA289094144323864B0E8AC9F419E4F206FF9295F0245`和`614B54D2179E2012036BF813B7E88FE8B949172AEF86612528268AC5D9EC2E58`。
- 所有三点/溢出菜单点击空白区域或按 `Escape` 必须关闭；该规则适用于全软件，不得只在某个页面特判。
- 软删除后对应来源必须立即从来源档案消失；恢复记录后来源重新出现，不能只增加回收站计数而保留原列表项。
- 自动分类是默认成果；只有低置信、冲突或缺少主题时突出人工修正。
- 默认不显示无正文空会话，但不删除原始来源。

### 4.2 主题管理

- 左：领域→主题树，支持搜索和筛选；树本体直接复用知识视图的共享层级组件，编辑、新建与高级维护是次级操作。
- 右：主题标题、描述和保存状态。
- 主体固定覆盖：主题边界、自动归类依据、层级与关联、别名与术语。
- 右侧窄栏显示结构建议，可查看、忽略或应用；建议不能自动改写结构。
- 页面目标是维护分类结构，不与知识视图争夺判断、证据和决策阅读职责。
- 主题详情标题区只展示主题身份、状态和说明，不重复放置“编辑主题”；维护入口统一由右侧下方`进入主题管理`承担。
- 首屏只把缺少边界、别名或明确关系建议转为可直接处理的事项；缺少排除规则不是用户待处理问题。主题暂时没有正式来源不是结构缺口：语义完整的主题保留为空并继续展示，不生成“全局检查”“检查空主题”或逐个查看任务，也不进入待处理筛选。
- 合并或清理必须由独立的重复身份、结构归属和可撤销操作证据触发；不得仅凭来源数为零推断，也不得把同一判断再次交给用户。
- `主题层级`只在存在真实父主题或子主题时显示，并只展示实际关系；顶层叶子主题整块隐藏。未确认关系建议留在右侧待处理事项，知识对象数量留在自动归类依据，不得在层级区重复陈列。
- 排除规则由自动分类系统持有：没有有效排除项时不显示空卡片；存在时只读展示最多五项`自动排除`摘要，并说明不会删除来源。普通主题页不得提示用户补写或调整规则；完整规则编辑只留在`进入主题管理 → 高级结构维护`。
- 默认目录使用保守、按主题生效的系统排除信号：非`职业发展与岗位选择`主题遇到`招聘启事 / 岗位职责 / 简历投递`时只降低候选分数，职业主题不应用这组排除；不得扩展为全局删除、来源隐藏或未经证据的宽泛广告词屏蔽。
- “新建主题 / 编辑主题 / 补边界 / 添加别名 / 维护规则 / 应用关系”必须进入对应真实编辑或 Repository 动作，不能用统一的“打开维护”按钮假装完成。
- 主题结构次级维护页顶部只保留一个`编辑 / 完成编辑`状态入口，不集中堆叠`添加领域 / 添加主题`。进入编辑态后，领域行显示`添加主题 / 编辑领域`，主题行显示`添加子主题 / 编辑主题`，新领域入口位于领域列表末尾；所有新增与编辑详情由同一个结构编辑弹窗承载，不再展开行内表单。弹窗必须支持`Escape`和点击遮罩关闭，提交继续调用既有 Repository，不改变领域/主题 ID、归属和历史关系语义。
- `topic-structure-contextual-edit-dialog-reference.png`锁定的是顶部按钮堆叠与行内表单过多的失败证据，以及“操作下沉到对应行、详情统一弹窗”的 B/C 类改动方向；不锁定其中示例数据、旧按钮尺寸或旧行内编辑布局。SHA-256=`DAF669FDC044B37EE50E6A7BE8313A5490834EDB76F3BE9133A5B59F09759C96`。

### 4.3 知识视图

- 默认进入“竞争假设”，同时提供“判断演变 / 笔记与来源 / 决策版本”切换。
- 主题标题下方必须先显示统一知识摘要：`当前判断 + 事实与线索 + 关键证据 + 待验证问题 + 建议下一步`。正式判断、命题、证据、问题和决策优先；缺失时由`knowledgeSynthesis`从真实笔记/来源正文确定性提炼，并标记自动结果。四张卡只做首屏两条紧凑预览；每张卡的底部操作必须打开同一个完整内容弹窗，逐条展示该类别全部摘要文本且不截断，并保留进入对应既有阅读状态的深读入口，不新增第五个平行状态。弹窗支持关闭按钮、`Escape`和点击遮罩关闭，长内容只在弹窗正文内滚动。
- 自动摘要不得用来源标题、文件数量或占位文案冒充知识内容；事实线索与关键证据必须分工，后者保留来源锚点。建议下一步只能是待验证或未执行建议，不得自动写回正式对象、伪造已执行行动或结果。
- 在1702×1066标准窗口，当前判断与四类摘要必须无需滚动完整可见、位于四状态Tab之前且不产生横向溢出；缩小窗口时允许摘要响应式重排，但不能把核心摘要重新压到长正文之后。
- 左中栏按领域→主题浏览；领域可折叠，切换或外部定位到主题时自动展开其所在领域。该列表是知识视图与主题管理的唯一共享实现源，右侧仍以命题为中心阅读成果。
- 中栏不得重复增加笔记层；具体笔记在“笔记与来源”状态内阅读和定位。
- “竞争假设”并列展示多个假设，每个假设维护支持证据、反对证据、来源锚点、置信度、有效期和证伪条件。
- 没有正式假设、判断或决策对象时，默认从已有笔记与来源正文确定性提炼并标明自动结果；来源标题和数量不得冒充知识内容。派生项必须保留正文引文与来源回溯；决策只生成未执行草案，不得伪造行动、结果或复盘。
- “判断演变”首先展示跨时期证据与知识事件，再展示版本差异和变化原因；不再单独重复一块置信度轨迹概览。
- 四个Tab已经承担状态身份，正文区不得再用眉题、编号步骤卡、阅读方法或对象职责说明重复同一语义。切换后必须直接进入主要内容：`竞争假设`进入假设卡，`判断演变`进入跨时期事件，`笔记与来源`进入三栏阅读器，`决策版本`进入版本卡。
- 主要对象内部仍保留有区分价值的标题、筛选和状态：时间线标题与筛选、笔记/正文/来源栏名、上版/当前判断、决策链阶段均不得因删除说明层而一起删除。空结果条件继续由对应内容容器自身表达，不恢复第三层说明卡。
- 知识视图所有小字遵循全局信息密度规则：只保留能帮助判断、定位或操作的状态、日期、来源、置信度、有效期和证伪条件。主题头数量若已由Tab表达则不重复；通用介绍、技术实现说明、教程式阅读提示和重复的空字段网格删除；空态使用最短明确表达。
- 跨时间知识事件只归“判断演变”所有，空间不足时使用底部横向滚动；其他三个状态不重复时间线。
- “笔记与来源”只显示笔记正文、来源链接和快速定位，不重复假设、判断、有效期或决策信息。
- 当前主题没有独立笔记时，空态文字在笔记索引卡的完整可用区域内居中，不挤在卡片顶部。
- 决策账本按“判断→决策→行动→结果/复盘”维护，历史版本不可被当前结论覆盖。
- 四个状态必须保持单一职责：已有对应位置的信息不得在其他状态混合重复展示。
- `knowledge-overview-truncated-detail-dialog-reference.png`锁定的是四张摘要卡文本被截断且底部查看操作不可用的失败状态，以及“紧凑预览 + 统一完整内容弹窗”的交互修正方向；不锁定截图示例文本、数量或裁切宽度。SHA-256=`1E9AFF9A047781CDA9BCA4D411BB8235FBA3739C36F967C7B4614CBB7FF3441E`。

## 5. 明确排除

- 旧收录箱、旧整理工作台和旧主题浏览器作为并列主入口。
- 以大段新建/编辑表单作为知识视图首屏。
- 以现有 CRUD 存在、migration 通过或皮肤完成代替四张页面的 UI 集成。
- 只实现截图里的几个示例主题，或把示例数字写死进生产代码。
- 因换皮肤而移动模块、改变默认 Tab、删除竞争假设/判断演变之一。
- 以旧原型或 `docs/screenshots/reference-final-direction.png` 覆盖本文件的四张最终功能布局图。

## 6. 变更协议

南烛枫提出新方向时，必须记录：

1. 新方向属于 A–F 哪一类；
2. 替代哪个基准 ID 或哪条合同；
3. 哪些既有类别继续有效；
4. 新参考资产、视口、状态和验收条件。

没有明确替代关系时，本文件继续有效。
