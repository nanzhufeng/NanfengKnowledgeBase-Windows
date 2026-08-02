# Design QA

## 原版知识库界面对照证据

- source visual truth：`C:\Users\Administrator\.codex\generated_images\019f97f2-696b-7c40-90c3-b7211c57ce2d\call_tOlY06Hml4mopKbUTt91f9qd.png`
- source pixels：1488 × 1058；为同视口比较归一化到 1440 × 1024。
- implementation：`docs/screenshots/implementation-1440x1024.png`
- implementation pixels / CSS viewport：1440 × 1024；device scale factor 1。
- state：全部记录、搜索“资本开支”、第 3 条记录选中、详情阅读模式、历史版本收起。
- full-view evidence：`docs/screenshots/design-qa-comparison.png`
- focused evidence：`docs/screenshots/design-qa-focus-judgment.png`
- responsive evidence：`docs/screenshots/implementation-1440x900.png`、`docs/screenshots/implementation-1366x768.png`
- density inspection：`docs/screenshots/implementation-1440x900-density-2x-simulated.png` 仅用于 2× 像素密度检查，不等同真实 Windows 200% DPI。

### 原版 Findings

未发现仍需修复的 P0、P1 或 P2 问题。

- 字体与排版：系统中文字体、标题权重、正文行高和标签层级与参考稿一致；实现中的次级正文略克制，属于可接受的 P3 差异。
- 间距与布局：三栏比例、详情面板起点、标题、判断卡和语义卡节奏已对齐；1366 × 768 无页面级横向溢出。
- 颜色与 Token：深普鲁士蓝导航、冷灰工作区、白卡和红/橙/绿语义色与参考一致。
- 图像与图标：界面没有位图内容；所有可见功能图标来自 Lucide React，没有用字符、Emoji 或 CSS 图形替代。
- 文案与内容：标题、判断、事实、证据、问题、行动和版本内容与参考稿及产品草案一致。
- 交互状态：选中、编辑、保存、折叠、版本和导入映射已在浏览器验证；悬停投影与快捷操作由精细指针媒体查询控制。

### 原版 Comparison history

#### Iteration 1

- [P2] 详情区起点偏右、宽度不足，标题与判断卡整体偏高。
- evidence：初始实现 `implementation-1440x1024.png` 与源稿的完整对照。
- fix：记录列上限由 464 px 收紧到 424 px；详情面板下移 20 px；增加标题区和判断卡纵向空间；调整语义卡两行高度。

#### Iteration 2

- post-fix evidence：`docs/screenshots/design-qa-comparison.png`。
- result：三大区域比例、详情标题坐标和卡片纵向节奏已对齐，无剩余 P0/P1/P2。

#### Iteration 3

- [P2] 选中记录与详情面板的关联线被记录列表裁切，滚动条轨道形成一道硬切，冷灰底层没有连续贯穿两栏。
- evidence：用户反馈截图 `codex-clipboard-407ef71c-4db1-478b-95b1-1c8ba823b99a.png`。
- fix：关联线改为工作区层独立绘制，使用运行时几何跟随选中卡片；隐藏记录列表滚动条轨道；工作区与主区域统一使用冷灰最底层背景。
- post-fix evidence：`docs/screenshots/implementation-1440x900.png`。
- result：关联线宽 30 px、与选中卡片中心偏差 0 px；记录列表 `scrollWidth === clientWidth`，无横向溢出或滚动条硬切；左右两栏底层背景连续。

#### Iteration 4

- [P2] 关联线锚点使用负像素估算定位，圆心没有与 1 px 线段形成可直接验证的同轴合同；部分可见按钮仍是静态装饰。
- evidence：用户反馈截图 `codex-clipboard-69e43b1d-f436-47a9-aeb4-1c9798990b10.png`。
- fix：锚点改为独立 8 px 元素，以 `top: 50%` 和 `translateY(-50%)` 对齐线段中心；为筛选、排序、收藏、分享、菜单、详情展开、历史查看、设置和快捷键补齐阶段 1 本地交互。
- post-fix evidence：`docs/screenshots/design-qa-comparison.png`、`docs/screenshots/implementation-1440x900.png`。
- result：1440 × 900 下线段中心 y=438 px，左右锚点中心 y=438 px，偏差均为 0 px；页面横向溢出为 0；主流程按钮逐项浏览器验证通过。

### 原版 Primary interactions tested

- 搜索框与记录选中。
- 进入编辑、修改当前判断、720 ms 后出现“本地草稿已保存”。
- 完成编辑、追加版本、出现 v4 成功提示并展开历史版本。
- 进入导入中心、载入 JSON 示例、继续字段映射、完成导入预览。
- 浏览器控制台错误：0。
- 来源筛选、默认/最新/最早排序、列表与详情收藏同步、记录分享、记录/全局菜单、详情全集弹层、历史版本预览、设置预览、标签菜单、持续跟踪/判断更新视图与 Ctrl/⌘ + Enter 完成编辑。

### 原版 Follow-up polish

- P3：在真实 Windows 触控板与鼠标环境复核悬停阴影的主观力度。
- P3：进入 Tauri 阶段后补真实 150% / 200% 系统 DPI 截图。

---

## 2026-07-28 五套皮肤视觉 QA

更新时间：2026-07-28

## 验证目标

- 固定皮肤必须且只能是：沙漠灯笼、花房、奔马、铜金发簪、原版浅色。
- 四套场景皮肤使用冷白半透明磨砂卡片；背景只在卡片覆盖区域模糊，空白区域保持原图清晰。
- 卡片保留语义色层次、文字对比和闭合连续描边，不出现破边。
- 原版浅色保持深普鲁士蓝侧栏和冷灰工作区，不套场景磨砂。

## 参考图

- `C:\Users\ADMINI~1\AppData\Local\Temp\codex-clipboard-a61c21f8-d07a-4fb1-9dc6-a132b515d6f4.png`
- `C:\Users\ADMINI~1\AppData\Local\Temp\codex-clipboard-4803bb31-68b2-4b8a-9350-21655c050e88.png`
- `C:\Users\ADMINI~1\AppData\Local\Temp\codex-clipboard-69446f2d-a0ca-4ca1-8253-8f4231fc16f3.png`
- `C:\Users\ADMINI~1\AppData\Local\Temp\codex-clipboard-e2a3b801-97dc-4cdd-8e85-5836c8ad0e2c.png`
- `C:\Users\ADMINI~1\AppData\Local\Temp\codex-clipboard-6bf326bd-e8f3-4b4b-85a8-c12f6a329be4.png`

## 最终实现截图

统一视口：1584 × 1000，浏览器缩放 100%。

- `.runtime-qa/skin-preview/final-settings-desert-lantern.png`
- `.runtime-qa/skin-preview/final-settings-florist-studio.png`
- `.runtime-qa/skin-preview/final-settings-golden-horses.png`
- `.runtime-qa/skin-preview/final-settings-bronze-botanical.png`
- `.runtime-qa/skin-preview/final-settings-classic.png`
- `.runtime-qa/skin-preview/final-florist-original.png`

浏览器仓库为空数据模拟环境，因此截图用于验证外观设置、布局蒙版、背景和玻璃层，不代表正式数据内容。

## 参数与合同

- 场景侧栏：`rgba(248, 251, 255, 0.87)`，`backdrop-filter: blur(32px) saturate(1.08)`。
- 场景主面板：`rgba(248, 251, 255, 0.88)`，`backdrop-filter: blur(30px) saturate(1.08)`。
- 卡片透明度按主卡、普通卡、语义卡分层，不统一染成纯白。
- 描边直接落在卡片元素上，使用完整圆角边框；没有依赖会被裁切的伪元素外扩描边。
- 根背景不使用 `filter` 或 `backdrop-filter`，空白区域不模糊。
- `classic` 根背景为 `none`，侧栏为 `rgb(6, 43, 86)`，无玻璃滤镜。

## 迭代记录

1. 首轮卡片受背景染色过重，已提高冷白承托并降低背景综合色进入量。
2. 首轮灯笼、花房生成图与用户原图构图存在偏差，已改为直接使用用户提供的高清原始素材。
3. 未引用的临时生成图已移除，正式构建只打包四张场景背景。

## 最终结果

`passed`

- 五套皮肤枚举和持久化合同通过。
- 五套设置页逐套切换和背景 URL 复核通过。
- 场景玻璃区域与空白背景区域边界符合合同。
- 未发现 P0、P1 或 P2 视觉缺陷。

---

# 南枫知识库：核心框架与知识视图 Design QA

日期：2026-07-29

## 验收对象

- 实现：`src/App.tsx`、`src/components/KnowledgeWorkspace.tsx`、`src/components/KnowledgeReadingWorkspace.tsx`、`src/styles.css`
- 正式读取：现有 `knowledgeRepository` 与 migration v4 对象；生产组件未注入静态假数据。
- 隔离视觉数据：`.runtime-qa/core-workspace-redesign/knowledge-preview.html`，仅用于浏览器布局核对，不进入生产代码和正式数据库。

## 参考与同视口证据

| 状态 | 参考图 | 实现截图 | 同屏对照 | 视口 |
|---|---|---|---|---|
| 竞争假设 | `docs/screenshots/final-core-workspace/knowledge-view-competing-hypotheses.png` | `.runtime-qa/core-workspace-redesign/knowledge-hypotheses-current-1583x994.png` | `.runtime-qa/core-workspace-redesign/compare-knowledge-hypotheses-current.png` | 1583×994，1× |
| 判断演变 | `docs/screenshots/final-core-workspace/knowledge-view-judgment-evolution.png` | `.runtime-qa/core-workspace-redesign/knowledge-evolution-current-1565x1005.png` | `.runtime-qa/core-workspace-redesign/compare-knowledge-evolution-current.png` | 1565×1005，1× |
| 来源档案 | `docs/screenshots/final-core-workspace/source-archive-final-layout.png` | `.runtime-qa/core-workspace-redesign/source-archive-current-1583x994.png` | `.runtime-qa/core-workspace-redesign/compare-source-archive-current.png` | 1583×994，1× |
| 主题管理（参考图文件名沿用topic-structure） | `docs/screenshots/final-core-workspace/topic-structure-final-layout.png` | `.runtime-qa/core-workspace-redesign/topic-structure-current-1583x994.png` | `.runtime-qa/core-workspace-redesign/compare-topic-structure-current.png` | 1583×994，1× |
| 场景皮肤视觉外框 | `docs/screenshots/final-core-workspace/scene-skin-visual-baseline.png` | `.runtime-qa/core-workspace-redesign/desert-skin-1702x1066.png` | `.runtime-qa/core-workspace-redesign/compare-scene-skin-1702x1066.png` | 1702×1066，1× |

## 逐项结论

- 通过：主导航入口组织、窄中栏、右侧阅读区、细橙关联线和底部横向时间线的宏观组织一致。
- 通过：默认进入`竞争假设`；`判断演变`在同一阅读区切换，切换后左侧导航和栏宽不变化。
- 通过：中栏与主阅读区分别声明纵向滚动，时间线声明横向滚动；两个参考视口均无页面横向溢出。
- 通过：五套皮肤共享相同模块、入口层级、默认状态和交互结果；场景皮肤保留已确认版本的背景、外层留白、圆角浅色磨砂侧栏和圆角主面板，未复制参考图的深蓝视觉。
- 通过：旧“建立领域与主题”维护表单不再出现在知识视图首屏。
- 通过：来源档案把原始正文、自动整理结果、所在主题命题和证据锚点组织为阅读主路径；人工归属仅在异常折叠入口。
- 通过：主题管理首屏展示主题边界、自动归类依据、层级关系、别名和结构建议；旧维护工作台降为次级入口。
- 通过：场景皮肤的大工作区已恢复完整半透明冷白磨砂承托，背景不再直接进入大面积阅读内容。
- P3：正式仓库若仅返回少量命题、证据或判断，卡片密度会低于参考图示例；示例数量不属于锁定数据要求。
- P3：右上动作使用现有“生成研究上下文”能力，文案不同于参考图的“记录新证据”；动作槽位和阅读优先层级不变，证据归档的完整入口留给后续来源档案小步。

## 比较历史

1. 第一版仍以旧维护页为组织基础，判定失败。
2. 第二版建立阅读优先三栏结构，但错误把参考图深蓝视觉覆盖到五套皮肤，判定失败。
3. 隔离预览曾判断通过，但没有识别知识阅读页覆盖规则移除了工作区整体磨砂底。
4. 南烛枫真实桌面截图确认该缺陷，并指出三入口仍未按产品文档整体落实；旧通过结论撤销。
5. 依据产品主规格、升级思路文档和四张功能图重新建立需求追踪；来源档案、主题管理和知识视图按同一对象链重组，磨砂承托层恢复。
6. 四张页面同视口并排复核、五套皮肤逐套切换、页面宽度与滚动容器检查未发现新的 P0/P1/P2；真实桌面仍待南烛枫通过新 BAT 验收。

## 最终结果

`passed`（仅代码与隔离浏览器设计 QA；不代表南烛枫真实桌面已验收）

---

# 2026-07-29 产品职责收口 Design QA

## 对照证据

- source visual truth：
  - `docs/screenshots/final-core-workspace/knowledge-view-competing-hypotheses.png`
  - `docs/screenshots/final-core-workspace/knowledge-view-judgment-evolution.png`
  - `C:\Users\ADMINI~1\AppData\Local\Temp\codex-clipboard-c292d55a-f58b-4b73-a6a5-e623afcab014.png`
- implementation：
  - `.runtime-qa/knowledge-final-layout-evidence/desert-lantern-hypotheses.png`
  - `.runtime-qa/knowledge-final-layout-evidence/desert-lantern-evolution-layout.png`
  - `.runtime-qa/knowledge-final-layout-evidence/desert-lantern-notes-and-sources.png`
  - `.runtime-qa/knowledge-final-layout-evidence/desert-lantern-source-archive.png`
- full-view side-by-side：
  - `.runtime-qa/design-qa/hypotheses-side-by-side.png`
  - `.runtime-qa/design-qa/evolution-side-by-side.png`
  - `.runtime-qa/design-qa/source-archive-side-by-side.png`
- viewport / density：
  - 知识视图参考和实现均为 1584 × 1000 CSS px、device scale factor 1，像素尺寸 1584 × 1000。
  - 来源档案参考为 1702 × 1068；实现截图在同屏对照中等比归一化到 1702 × 1068。
- state：奔马同类场景皮肤的浅色磨砂层；竞争假设、判断演变、笔记与来源、来源档案正文及证据定位。
- focused comparison：没有另做裁切。三张同屏图均按原始大尺寸打开，标题、标签、边框、证据小字和正文定位状态清晰可读。

## Findings

未发现仍需修改的 P0、P1 或 P2。

- 字体与排版：中文系统字体、标题权重、正文行高和小字层级保持原皮肤语言；来源原始时间已改为人性化日期，未再显示 ISO 小字噪音。
- 间距与布局：左主导航、窄中栏、右阅读区、橙色关联线和独立滚动合同保持；来源正文占右侧主体，辅助栏在无内容时收起。
- 颜色与 Token：半透明冷白磨砂、深冷色正文、橙色动作与闭合选择边框一致；五套背景只改变场景视觉，门户弹窗也继承当前皮肤 Token。
- 图像与资产：四套场景背景继续使用原有受控位图；功能图标继续使用 Lucide，没有新增占位图、字符图标或 CSS 仿制资产。
- 文案与内容：四个知识状态按单一职责拆开；时间线只在判断演变出现；来源自动结果改为行内摘要，正文和操作成为主路径。
- 交互：默认竞争假设、四状态切换、知识→来源精确定位、来源→知识主题反向定位、正文内定位和五套皮肤结构一致性均通过隔离浏览器合同；控制台错误为 0。
- P3：隔离数据只有一个主题、一篇笔记和一条来源，所以正文下方留白多于正式数据场景；这是数据密度差异，不是布局空状态。

## Comparison history

1. 旧实现把命题、笔记、来源、决策摘要和时间线在多个状态重复展示，且来源正文被自动整理卡与说明卡挤压。
2. 本轮按对象所有权拆分四状态，删除重复摘要，把时间线移入判断演变；来源列表压缩到 24%，正文侧占主区域。
3. 初次实现截图确认双向定位、闭合橙框和正文主阅读区有效；未发现新的 P0/P1/P2，因此无需视觉修复迭代。

## Primary interactions tested

- 默认打开竞争假设并显示两组正式命题。
- 在同一主阅读区切换判断演变、笔记与来源、决策版本。
- 证据锚点打开来源档案并定位正文；来源档案“查看知识成果”返回原主题。
- 五套皮肤逐套重载，模块层级、默认状态、滚动和窗口宽度不变。
- 页面级横向溢出为 0；中栏和正文纵向滚动、时间线横向滚动保持独立。
- 浏览器 console error 与 page error：0。

## Follow-up polish

- P3：南烛枫使用新隔离 BAT 在真实 Windows WebView2 中确认字体渲染、触控板滚动和正式数据密度。

final result: passed

## 2026-08-01 数据与存储大窗口、返回上一级与备份布局

- source visual truth：`docs/screenshots/final-core-workspace/data-exchange-return-parent-reference.png`与`docs/screenshots/final-core-workspace/settings-data-storage-small-crowded-reference.png`，均为1702×1066 px。前者锁定批量导入导出应返回数据与存储上一级；后者作为窗口过小、操作拥挤和备份层级混乱的失败证据，不锁定旧尺寸或示例容量。
- implementation screenshot：`docs/screenshots/qa/settings-data-storage-resizable-1702x1066.png`，1702×1066 px。
- viewport / density：1702×1066 CSS px、浏览器缩放100%、device scale factor 1；源图和实现像素尺寸一致，无密度归一化缩放。
- state：设置页的`数据与存储`弹窗打开，高级维护默认折叠；实现为浏览器演示数据，不用其容量值判断正式数据。
- full-view comparison：`docs/screenshots/qa/settings-data-storage-before-after-comparison.png`，把问题参考与实现放在同一个1702×1066输入中。
- focused region comparison：`docs/screenshots/qa/settings-data-storage-focused-comparison.png`，两侧保持相同0.75缩放并中心裁切，用于读取按钮比例、备份说明和高级维护层级。

### Findings

- 无P0/P1/P2。弹窗从旧约660×540提升为默认1040×760，四周留白稳定，右下角明确显示调节把手；内容区实测976×524，`clientWidth=scrollWidth`且`clientHeight=scrollHeight`。
- 字体与层级：沿用现有微软雅黑/系统回退、深蓝正文和11–14px设置字号；数据交换、备份与恢复、高级维护的标题权重清楚，没有新增异常换行或截断。
- 间距与布局：存储概览改为四列；主操作区按0.82/1.45分栏，数据交换按钮缩为34px高，备份创建/恢复按钮成对排列，备份范围由三枚标签收口为单行说明；高级维护独占下一行并默认折叠。
- 色彩与Token：继续消费现有冷白磨砂、雾蓝表面、橙色主操作和青色备份区Token，没有改五套皮肤或引入页面私有深色主题。
- 图像质量：本轮没有新增产品图像资产；数据库、上传、恢复和尺寸提示均使用现有Lucide图标，不使用字符图形、手写SVG或占位资产。
- 文案与内容：`返回设置`改为`返回上一级`；点击后直接重新打开`数据与存储`而非停留设置首页。数据交换说明和完整备份范围各自只出现一次。
- 交互与可访问性：弹窗保留`role=dialog`、明确标题、遮罩关闭与Escape；尺寸使用独立v2偏好键，ResizeObserver按边框尺寸保存，避免每次重开因content-box计算持续缩小。应用内浏览器实际点击`打开批量导入与导出 → 返回上一级`通过；页面运行日志无error。

### Comparison history

- Iteration 1：同屏全视图与聚焦区对比未发现可执行P0/P1/P2，因此没有为制造迭代而继续改变已清晰的布局。参考与实现的容量值不同属于浏览器演示数据差异，不是视觉或数据合同失败。

### Implementation checklist

- [x] 返回动作改名并直达数据与存储上一级弹窗。
- [x] 弹窗默认放大、尺寸身份独立、右下角支持人工调节。
- [x] 数据交换按钮缩小，备份创建/恢复和范围说明重新分层。
- [x] 1702×1066布局、返回链路、运行日志、159项前端合同、TypeScript、Vite与v38 Windows隔离构建完成。

### Follow-up polish

- 无阻塞项。真实Windows WebView2中的物理鼠标调窗手感和正式容量值由南烛枫使用v38固定BAT确认；该边界不影响本次隔离视觉QA通过。

final result: passed

# 2026-07-29 来源与主题交互修复 Design QA

## 对照目标

- source visual truth：
  - `docs/screenshots/final-core-workspace/source-archive-final-layout.png`
  - `docs/screenshots/final-core-workspace/topic-structure-final-layout.png`
  - 南烛枫本轮反馈截图：删除未消失、操作按钮平铺、错误“定位”、搜索框过窄。
- implementation：当前工作区 `src/components/KnowledgeWorkspace.tsx`、`src/components/TopicStructureReadingWorkspace.tsx`、`src/styles.css`。
- intended viewport：1584 × 1000 CSS px、device scale factor 1。
- intended states：来源档案默认详情、三点菜单展开/关闭、列表滑块滚动、软删除后下一条选中；主题管理默认态、关系建议应用、别名定向维护。

## Findings

- [blocked] 当前实现尚未获得浏览器渲染与交互截图。
  - 位置：来源档案与主题管理。
  - 证据：TypeScript、Rust、Vite 和 Tauri 构建已通过，但不能代替实际渲染；新增 Playwright 断言尚未获准执行。
  - 影响：暂时无法对字体、间距、颜色、图像/背景质量、文案、菜单遮挡、滚动和 1584×1000 页面溢出作最终视觉判断。
  - 处理：获准后运行定向 Playwright，在相同视口捕获来源档案、主题管理和五套皮肤状态；与两张受控参考图放入同一比较图，修复所有 P0/P1/P2 后再改为通过。

## 已完成的非视觉证据

- 字体与排版：代码继续使用既有中文系统字体和五套皮肤 Token；待渲染确认。
- 间距与布局：来源搜索改为独占一行，动作收进三点菜单；待 1584×1000 截图确认。
- 颜色与 Token：未修改五套皮肤名单和背景；新控件沿用橙色动作与冷白表面；待截图确认对比度。
- 图像与资产：没有新增位图或自制 SVG；导航和操作图标继续使用 Lucide。
- 文案与内容：列表功能称“快速定位”，正文功能称“搜索”；主题维护入口按具体任务命名。
- 行为契约：Repository 删除/恢复测试通过；浏览器菜单、滚动、删除和主题操作断言已编写但未执行。

## Comparison history

1. 南烛枫真实桌面确认旧实现存在五个 P1：来源删除后仍显示、操作按钮平铺、列表定位被正文搜索替代、知识视图图标错误、主题管理未落实方案。
2. 当前代码已分别修复五项并生成新隔离构建，但尚无 post-fix 浏览器截图，不能结束视觉迭代。

## Implementation Checklist

- 获准运行 `tests/e2e/knowledge-final-view.spec.ts`。
- 保存来源档案与主题管理同视口截图。
- 生成参考图 + 当前实现同屏对照。
- 核对五个必查面：字体、间距、颜色、图像质量、文案，并检查交互、滚动与无横向溢出。
- 若无 P0/P1/P2，把本节最终结果更新为 `passed`；否则继续修复。

final result: blocked

# 2026-07-30 卡片到卡片关联线统一 Design QA

## 本轮锁定与实现

- source visual truth：南烛枫提供的关联线局部截图，已受控保存为`docs/screenshots/final-core-workspace/card-to-card-connector-reference.png`。
- 锁定层级：C 交互与局部视觉；不替换五套皮肤、页面模块或卡片材质。
- 几何合同：左端点圆心压在左侧选中卡片右边缘，右端点圆心压在右侧关联卡片左边缘，线段只跨两张卡片之间的空隙。
- 强调合同：左右关联卡片保持完整橙色边框和层次；右侧目标卡不能只有端点而缺少闭合橙框。
- 实现：普通记录、来源档案、知识视图和主题管理删除各自的负像素/额外宽度补偿，统一调用`measureCardToCardConnector`；右侧阅读卡统一使用`association-link-target`。

## 当前证据边界

- 纯函数新增端点合同，前端测试现为 102/102；TypeScript、Vite 和 Windows Tauri `--no-bundle`通过。
- 当前统一 BAT 已更新到 v9 独立目标并通过`--prepare / --verify`；Codex未启动程序、未打开正式数据。
- [blocked] 尚未获得四类关联线在真实 Windows WebView2、五套皮肤和滚动后的同视口可见截图。
- 结论边界：代码与自动合同通过不等于视觉验收通过。

final result: blocked

---

# 2026-07-30 单篇笔记列表快捷操作统一 Design QA

- source visual truth：南烛枫提供的既有记录卡快捷操作裁切图，受控资产为`docs/screenshots/final-core-workspace/single-note-list-actions-reference.png`，只锁定 B 页面功能布局与 C 交互。
- implementation：新增共享`NoteListActions`，记录列表和来源档案 Record-backed 选中项统一显示收藏、完整导出、更多三个图标；更多菜单包含持续跟踪、复制标题和移入回收站。
- ownership：来源详情头移除重复收藏/导出/删除，只保留返回主题来源、查看详情等详情级动作；不改变五套皮肤、来源正文、分类或正式数据。
- automated evidence：共享组件 2/2、全量前端 100/100、TypeScript、Vite、Windows Tauri `--no-bundle`通过。
- build boundary：因南烛枫正在运行 v7，Codex未结束该进程；本轮另建 v8 隔离目标并通过`--prepare`，未启动应用、未打开正式数据。
- [blocked] 来源列表选中项的真实桌面排版、三个动作的实际点击结果及菜单外部关闭尚未由南烛枫确认。

final result: blocked

---

# 2026-07-30 去重、附件直显与布局稳定性 Design QA

## 本轮代码事实

- 竞争假设卡删除重复的`关键来源锚点`区块，证据条目内的来源链接继续作为唯一入口。
- 来源附件改为按来源对象读取 legacy 与 migration v4 关联；JPG/PNG 等图片按 MIME、附件类型或扩展名直接渲染，不再只显示文件条目。
- 布局问题按 bug 处理：场景皮肤曾把主区确定高度覆盖为`auto`，依赖百分比高度的子工作区会随异步内容高度变化而缩短、跳动或偏移。现恢复确定的父子高度链，未调整原有正常上下留白数值。
- 竞争假设 A/B/C 卡片的核心观点字号由 12px 调整为 13px，证据与来源链接字号保持不变。

## 已完成的非视觉证据

- 前端单元/领域合同：92/92 通过。
- TypeScript：通过。
- Rust attachments 定向测试：5/5 通过。
- Vite 与 Windows Tauri `--no-bundle`：通过。
- 新隔离 BAT 已通过`--prepare / --verify`，未启动程序、未打开正式数据。

## 阻塞项

- [blocked] 本轮未获准运行 Playwright，尚无修复后的 1584×1000 同视口截图。
- [blocked] JPG/PNG 在真实 Windows WebView2 中的直显、异步加载后的卡片稳定性、五套皮肤下的上下留白和滚动位置仍需南烛枫通过新 BAT 可见确认。
- 结论边界：自动测试与构建通过不能代替真实桌面视觉和交互验收。

final result: blocked

---

# 2026-07-30 来源正文旧定位重放与卡片偏移 Design QA

## 真实反馈与修正结论

- 南烛枫在当前运行的 v6 中确认：曾搜索并定位`以前数据中心利润分散在：`后，重新进入来源档案仍会回到旧正文位置，外层卡片同时偏移。该证据证明此前“仅由场景皮肤高度分叉造成”的结论不充分。
- 代码根因一：`App`持有的跨页面`sourceNavigationTarget`完成定位后未清除，因此它不是一次性导航事件，而会在后续进入来源档案时重复执行。
- 代码根因二：来源锚点和正文搜索使用`scrollIntoView({ block: "center" })`，浏览器会滚动目标元素的可滚动祖先链，正文定位因此与外层工作区/卡片位置耦合。
- 修正：跨页面锚点消费后由`App`清除；正文锚点和搜索只在`.knowledge-source-preview`内部计算并设置`scrollTop`；直接进入来源档案会清除旧搜索、回到首项并将来源列表和正文复位到顶部。

## 当前证据边界

- 新增 6 条局部滚动、上下边界夹取、直接重入复位和显式导航保留合同；前端测试现为 98/98。
- TypeScript、Vite、Windows Tauri `--no-bundle`和 v7 BAT `--verify`通过。
- [blocked] Codex没有关闭南烛枫正在运行的 v6，也没有替南烛枫启动 v7；新行为尚未取得真实桌面同视口确认。

final result: blocked

---

# 2026-07-30 记录前景白卡透明度统一 Design QA

- source visual truth：南烛枫提供的收藏记录卡与持续跟踪记录卡截图。
- implementation：场景皮肤下`.record-card.selected`由单独的`rgba(255, 248, 242, 0.78)`改为共享`--glass-card-strong`，与其他前景白卡使用同一表面 Token。
- 保持项：橙色选中边框、关联线、阴影、图标、状态和全部交互未改。
- 自动证据：TypeScript、Vite 和独立 Windows Tauri `--no-bundle`构建通过；新 BAT `--prepare / --verify`通过。
- [blocked] 当前运行中的 v6 应用属于修改前构建，Codex未关闭用户进程，也未启动v7；修复后的真实桌面同视口截图尚未取得。

final result: blocked

---

# 2026-07-30 右侧主体阅读字号 Design QA

## 锁定范围

- source visual truth：南烛枫本轮提供的竞争假设、来源正文、判断演变、决策版本和两张记录正文截图；六张原图已归档到`docs/screenshots/final-core-workspace/right-reading-*-font-reference.png`。
- scope：只调整右侧阅读页的正文、核心观点、证据、版本差异和决策内容；不调整左侧列表、标题区、元数据、按钮、来源链接或正文超链接。
- typography contract：主体内容按各自既有字号精确放大`1.3×`，由`NF-RIGHT-READING-TYPE-01`共享 Token 管理；链接使用各自放大前的原始字号。

## 当前证据

- 2 条字号派生值和链接保护静态合同通过；前端总计 104/104。
- TypeScript、Vite 与 Windows Tauri `--no-bundle`通过。
- 新隔离 BAT `启动南枫知识库-右侧阅读字号验收.bat`的`--prepare / --verify`通过；EXE 位于`.runtime-qa/right-reading-typography-v10-build/release/nanfeng-knowledge-base.exe`。
- EXE size：`35,763,712` bytes；SHA-256：`69906F2F455658A2A2FB7876D3A3F53B27422FADE48007725EBE6D2E43FCE7E6`。

## 阻塞项

- [blocked] 本轮未获准运行 Playwright，未生成放大后的同视口对照截图。
- [blocked] 知识四状态、来源档案正文和记录详情在真实 Windows WebView2 中的换行密度、滚动长度及五套皮肤可读性仍需南烛枫通过 v10 BAT 可见确认。
- Codex未启动应用、未打开正式数据，自动测试和构建不能替代真实桌面验收。

final result: blocked

---

# 2026-07-30 动态场景文字对比度 Design QA

## 真实问题与设计合同

- source visual truth：南烛枫提供的奔马皮肤回收站空状态截图，已受控保存为`docs/screenshots/final-core-workspace/dynamic-scene-text-contrast-reference.png`。
- 可见问题：背景上的页面说明和空状态使用固定灰蓝色，在亮暗混合的金色背景上对比不足；回收站空状态未出现原本应有的冷白磨砂承托。
- 锁定原则：亮背景用深文字、暗背景用亮文字；暖背景用偏冷文字、冷背景用偏暖文字；颜色随背景采样变化，不能按单套皮肤写死。

## 已确认根因与实现

- 原动态算法只按平均 sRGB 亮度做二分，未用相对亮度/对比度约束；场景说明文字对奔马代表背景约为`2.21:1`。
- 页面标题/说明仍使用固定 CSS 色，没有消费动态变量。
- 同一组变量同时承担“图片上的文字”和“冷白卡片里的文字”，两个背景条件相反。
- 回收站 DOM 是`page-shell → trash-grid → empty-state`，旧选择器只匹配`page-shell`直接子元素，磨砂规则实际未命中。
- 当前实现将图片场景前景与冷白磨砂表面拆为两套语义 Token；运行时使用 WCAG 相对亮度选择明暗方向，用背景冷暖选择相反色相，并把主文字目标设为`≥5:1`、次要/强调文字目标设为`≥4.5:1`；复杂图片使用同方向光晕。
- 页面标题、说明和加载态消费场景 Token；回收站空状态以显式`scene-surface-state`消费冷白磨砂及独立深色表面文字。

## 当前证据边界

- 动态配色与消费者合同 5 条通过；前端总计 108/108。
- TypeScript、Vite 与 Windows Tauri `--no-bundle`通过。
- 新隔离 BAT `启动南枫知识库-动态文字对比度验收.bat`的`--prepare / --verify`通过；EXE 位于`.runtime-qa/dynamic-scene-contrast-v11-build/release/nanfeng-knowledge-base.exe`。
- EXE size：`35,766,272` bytes；SHA-256：`C4FB70F48BA5693CFF39D81642E8C3B442BEA2D53F2347B96AE87169059BF1E5`。
- [blocked] 本轮未获准运行 Playwright，尚未生成四套场景皮肤在相同视口下的修复后截图。
- [blocked] 背景不同裁切位置、真实 Windows WebView2 字体抗锯齿及奔马回收站空状态仍需南烛枫通过 v11 BAT 可见确认。
- Codex未启动应用、未打开正式数据；自动对比度合同和构建不能替代真实桌面视觉验收。

final result: blocked

---

# 2026-07-30 右侧主体阅读字号真实消费者补漏 Design QA

## 最新反馈与根因

- 南烛枫明确指出此前右侧主体`1.3×`问题没有处理完，因此 v10 只能视为未通过真实桌面验收。
- 旧合同只检查 CSS 中是否存在字号 Token 和选择器，没有验证知识四状态、来源正文、记录长短正文的真实 DOM 是否接入。
- 已确认漏项包括记录摘要、非对话正文，以及被 Markdown 子元素自身字号覆盖的段落、列表、表格和标题。

## 当前修正

- 新增`right-reading-copy-*`语义字号类，六类正文消费者必须显式接入，不再依赖页面层级偶然命中。
- 正文、列表、引用、表格和 Markdown 标题按既有字号放大`1.3×`；正文链接按放大前的上下文字号独立保护。
- 测试同时读取真实组件源码和 CSS，验证消费者接入、派生字号、Markdown 子元素及链接保护。

## 当前证据边界

- 4 条右侧字号/真实消费者/链接保护合同通过；前端总计 110/110。
- TypeScript、Vite 与 Windows Tauri `--no-bundle`通过。
- 新隔离 BAT `启动南枫知识库-右侧主体字号复验.bat`的`--prepare / --verify`通过；EXE 位于`.runtime-qa/right-reading-typography-v12-build/release/nanfeng-knowledge-base.exe`。
- EXE size：`35,766,272` bytes；SHA-256：`DEA59774F9E5E8264CB1CE84D49B40D2E0FF4AE746F9318A4C17D143BEECEDA3`。
- [blocked] Codex未获准运行 Playwright，也未启动应用或打开正式数据；v12 的六类页面仍需南烛枫真实桌面同视口确认。

final result: blocked

---

# 2026-07-30 知识阅读层级与居中导出提示 Design QA

## 本轮结果

- 导出提示从页面角落改为视口中心；1280×720内置浏览器实测边界为`left=380, top=329, width=520, height=62`，中心坐标精确为`(640,360)`。
- 提示框使用2px橙色闭合边框并提升到普通弹窗上层；导出预览弹窗打开时仍可完整显示。证据：`docs/screenshots/qa/export-toast-centered-v13.png`。
- 桌面端`打开原路径`使用橙色渐变高对比主按钮；浏览器导出没有文件系统原路径，因此该按钮的真实桌面可见性只能由v13 BAT确认。
- 竞争假设重排为`核心解释 → 提取依据 → 支持/反对证据 → 有效性条件`；待验证问题改为有序列表；判断演变和决策账本增加状态级阅读标题，来源链接继续保持原字号。

## 证据边界

- 4条知识呈现合同通过；前端总计118/118，TypeScript、Vite和Windows Tauri `--no-bundle`通过。
- v13隔离BAT的`--prepare / --verify`通过，Codex未启动应用、未打开正式数据。
- [blocked] 内置浏览器没有桌面知识仓库桥，只能显示诚实空状态；竞争假设A/B/C、判断演变和决策账本的正式数据阅读密度仍需南烛枫桌面验收。

final result: blocked

---

# 2026-07-31 来源列表快捷操作与全库搜索/内置预览 Design QA

## 输入与元数据

- source visual truth：`docs/screenshots/final-core-workspace/single-note-list-actions-reference.png`。
- implementation screenshots：`docs/screenshots/qa/source-list-hover-actions-v17.png`、`docs/screenshots/qa/source-list-action-menu-v17.png`。
- combined comparison：`docs/screenshots/qa/source-list-actions-comparison-v17.png`。
- viewport：1440 × 900，device scale factor 1，生产构建预览。
- state：来源档案选中来源；列表卡悬停显示收藏/完整导出/更多；更多菜单展开；右侧正文保持当前来源。

## 对照结果

- 快捷操作与受控参考使用同一组三图标；当前实现按南烛枫后续明确要求改为默认隐藏、悬停/键盘聚焦出现，并固定在卡片右侧垂直中心。
- 操作层覆盖原有标题/元数据，不扩宽列表、不增加选中卡高度；选中卡继续保留完整橙色边框、锚点和卡片到卡片关联线。
- 更多菜单包含`查看详情 / 加入持续跟踪 / 复制标题 / 移入回收站`，点击页面空白后关闭。
- 搜索状态在生产 E2E 中验证：查询词只出现在正文时仍能命中；清空输入后历史可回选；列表加载量与搜索范围分离；全量 Playwright 14/14通过。
- PDF、图片、文本、音频、视频共用最高层软件内预览；不支持格式显示诚实空态和外部打开后备。该部分已完成格式路由、CSP和构建核对，但真实 WebView2 PDF/媒体解码属于桌面验收边界。

## 问题等级

- P0：无。
- P1：无。
- P2：无。
- P3：不同平台 WebView2 对 PDF、MOV/M4A 编解码能力可能不同；不影响软件内预览架构，失败时保留明确外部打开后备。

final result: passed

---

# 2026-08-01 四入口统一单篇列表卡 Design QA

## 输入与锁定范围

- 受控参考：`source-list-actions-gap-reference.png`、`source-list-metadata-reference.png`、`note-semantic-icons-reference.png`、`record-list-panel-reference.png`、`hierarchy-grid-alignment-reference.png`。
- 修改类别：B 页面功能布局、C 交互与状态；只新增按需兼容 Record 的最小 Repository 组合能力。
- 保护类别：三个核心入口、正式来源正文、migration v4 对象语义、五套皮肤名单/背景/冷白磨砂/语义卡层级与闭合橙框。

## 已完成代码合同

- `来源档案 / 我的收藏 / 持续跟踪 / 判断更新`共用`UnifiedNoteListPanel + UnifiedNoteListCard + NoteListActions`，不再保留四套割裂面板或卡片。
- 所有来源行无条件渲染悬停快捷操作；没有 legacy Record 的来源仅在真正执行收藏、导出、跟踪或删除时建立一次兼容侧车。
- 列表只保留标题、真实主题、来源和右上日期，删除没有实际含义的`0篇笔记`。
- 图标按标题、主题、来源类型和平台的内容语义选择 Lucide 图标，不再统一显示`file`。
- 知识视图和主题管理只缩进图标/标题，数量使用固定右列。

## 当前证据边界

- 前端138/138、定向Rust 1/1、Rust格式、TypeScript、Vite、Windows Tauri`--no-bundle`通过。
- v18隔离BAT已完成`--prepare / --verify`，EXE位于`.runtime-qa/unified-note-list-v18-build/release/nanfeng-knowledge-base.exe`。
- 本轮没有重新执行Playwright，也没有启动Tauri、打开正式数据或生成五套皮肤同视口截图。
- 因而代码与构建可判定通过；卡片透明度、悬停位置、窄栏密度和五套皮肤真实WebView2效果仍待南烛枫桌面验收。

final result: blocked（仅阻塞真实桌面视觉验收，不阻塞代码与隔离构建）

---

# 2026-08-01 来源档案工具栏统一 Design QA

## 输入与状态

- source visual truth：`docs/screenshots/final-core-workspace/record-list-panel-reference.png`；南烛枫本轮确认的局部裁切已保存为`docs/screenshots/qa/source-toolbar-v19-reference-crop.png`。
- pre-fix evidence：`docs/screenshots/qa/source-toolbar-v19-before.png`。
- implementation：`docs/screenshots/qa/source-toolbar-v19-implementation-1702x1066.png`；工具栏局部为`docs/screenshots/qa/source-toolbar-v19-focused-1702x1066.png`。
- shared locator implementation：`docs/screenshots/qa/record-list-workspace-unified-20260801.png`，持续跟踪入口真实渲染同一`UnifiedNoteListLocator`。
- viewport：实现为1702×1066 CSS px、device scale factor 1；完整截图像素同为1702×1066。
- focused pixels：参考裁切354×167；实现裁切337×140。两者均为1×，按各自真实左栏宽度比较，没有拉伸归一化。
- state：沙漠灯笼皮肤、来源档案空库状态。来源搜索、筛选、全部/待确认/已归类/全部加载可见；有数据时才显示的定位条未在本次空库截图中出现。
- full-view comparison evidence：受控参考完整列表面板与实现完整页面截图在同一比较输入中检查。
- focused comparison evidence：`source-toolbar-v19-reference-crop.png`与`source-toolbar-v19-focused-1702x1066.png`在同一比较输入中检查。

## Findings

未发现仍需修复的P0、P1或P2。

- 字体与排版：来源搜索恢复为完整14px输入；筛选为清晰的次级入口；来源状态与全部加载使用同一轻量工具栏层级，不再出现10px大橙框动作。
- 间距与布局：搜索/筛选、状态/加载、快速定位分别复用`UnifiedNoteListSearchRow / UnifiedNoteListToolbar / UnifiedNoteListLocator`；顶部圆角搜索框、分隔线、42px工具栏节奏与参考一致。
- 颜色与Token：搜索框使用冷白表面、深蓝图标和橙色焦点反馈；加载动作不再使用持续橙色描边抢占主层级。
- 图像与资产：本轮没有新增图片或自制图标；搜索、筛选和清除继续使用现有Lucide图标。
- 文案与内容：参考中的记录业务文案按来源档案语义替换为`搜索来源 / 全部 / 待确认 / 已归类 / 全部加载`；来源专属功能没有被视觉统一误删。
- 交互：内置浏览器验证筛选打开、点击外部关闭、Ctrl/⌘K聚焦来源搜索、输入后清除并保持焦点；共享定位条拖至第6条显示`6 / 6`，点击`当前`和`顶部`均回到`1 / 6`；控制台error为0。

## Comparison history

### Iteration 1

- [P1] 来源档案只复用列表白卡外壳，内部另写一套两列工具栏；搜索被压窄，状态和全部加载变为同权大橙框，定位滑轨使用错误的深色轨道。
- evidence：`docs/screenshots/qa/source-toolbar-v19-before.png`。
- fix：抽出三个共享列表结构并让记录入口与来源档案共同消费；来源只保留状态和全部加载的业务差异；删除末尾强制橙框、小字号和错误网格的覆盖规则。

### Iteration 2

- post-fix evidence：`docs/screenshots/qa/source-toolbar-v19-implementation-1702x1066.png`与`docs/screenshots/qa/source-toolbar-v19-focused-1702x1066.png`。
- result：搜索和筛选恢复参考层级；四项来源操作在一行完整显示，没有截断或抢眼橙框；无页面横向溢出和控制台错误。

## 自动与构建证据

- 前端139/139通过，包含记录入口与来源档案必须共同消费三个工具栏结构的新合同。
- TypeScript通过。
- Vite生产构建通过；仅保留既有大chunk警告。
- 浏览器隔离环境没有来源数据，因此来源档案有数据状态和真实Windows WebView2字体抗锯齿仍属于后续可见验收边界；同一定位组件已在持续跟踪入口完成拖动、回当前、回顶部的真实浏览器交互验证。

final result: passed

---

# 2026-08-01 来源档案列表显示控制补漏 Design QA

## 输入与范围

- source visual truth：`docs/screenshots/final-core-workspace/record-list-panel-reference.png`。
- pre-fix evidence：`docs/screenshots/qa/source-display-toolbar-unified-20260801.png`；首次补入功能后，来源左栏仍被旧24%宽度压缩，按钮文字发生竖排。
- diagnostic implementation：`docs/screenshots/qa/source-display-toolbar-unified-20260801-v2.png`。该图为1280×720右侧窄预览，只保留为交互排查证据，不再作为与1702×1066桌面基准比较的正式实现截图。
- 本轮只补齐来源档案缺失的共享列表显示能力；来源专属`全部 / 待确认 / 已归类 / 全部加载`继续独占下一行。按南烛枫要求，空库状态下的快速定位滑条不作为本轮验收条件。

## 结果

- `来源档案 / 我的收藏 / 持续跟踪 / 判断更新`现在共同消费`UnifiedNoteListDisplayToolbar`，不再分别解释列表摘要、紧凑模式或更新时间排序。
- 紧凑/舒展切换、排序三态循环和日期排序分别由共享组件与共享函数持有；来源卡通过同一`compact`属性消费紧凑状态。
- 来源左栏从旧`minmax(240px, 24%)`恢复为与记录子入口一致的`minmax(300px, 24%)`；1280×720排查视口实测面板宽300px、工具栏高42px、两个按钮均32px高、无按钮换行、无横向溢出，但该尺寸不再用于最终视觉结论。
- 内置浏览器验证来源档案按钮状态可在`紧凑卡片 ↔ 舒展卡片`间切换，排序可在`按更新时间 → 最新优先 → 最早优先 → 按更新时间`间循环。
- 共享控件在持续跟踪真实卡片上把首卡高度从94px降为80px；最早优先时首项日期从默认/最新的`07-25`变为`07-18`。控制台error为0。

## 自动证据

- 前端140/140通过，新增共享排序循环、日期排序和来源入口消费合同。
- TypeScript与生产构建通过；仅保留既有大chunk警告。

## 视口一致性修正

- [P2] 本轮把1280×720右侧窄预览交给南烛枫查看，和已锁定的1702×1066主窗口不一致，改变了卡片比例、留白和首屏密度，无法直接比较修改前后。
- fix：`AGENTS.md`、`docs/decision-log.md`和Product Design长期上下文现统一锁定主预览/最终验收为1702×1066 CSS px、100%缩放、device scale factor 1；右侧/底部分栏只允许临时排查并必须标注为非对比证据。
- standard desktop entry：`启动南枫知识库-统一窗口验收.bat`；`--prepare / --verify`均通过，隔离构建位于`.runtime-qa/standard-viewport-qa-build/release/nanfeng-knowledge-base.exe`，启动前强制校验Tauri主窗口配置为1702×1066。Codex未启动应用或打开正式数据。
- blocker：当前功能尚未取得1702×1066、同主题、同数据、同状态、同裁切的post-fix实现截图，1280×720截图不能代替。

final result: blocked

---

# 2026-08-01 四入口紧凑列表与999条工具栏压力 Design QA

## 输入与范围

- source visual truth：`record-list-date-format-reference.png`、`record-list-compact-density-reference.png`、`record-list-toolbar-overlap-reference.png`、`record-list-toolbar-right-alignment-stress-reference.png`。
- implementation：`docs/screenshots/qa/four-entry-compact-list-small-window-1280x720.png`、`docs/screenshots/qa/source-compact-toolbar-small-window-1280x720.png`、`docs/screenshots/qa/four-entry-toolbar-999-small-window-1280x720.png`。
- viewport：1280×720 CSS px / device scale factor 1。此处是南烛枫明确要求“窗口不大也完整展示”的响应式专项，不替代1702×1066主窗口对比。
- state：持续跟踪6条真实夹具卡；来源档案空库工具栏；持续跟踪999条临时显示压力状态。压力状态只替换显示计数，截图后已恢复真实6条，没有写入任何数据。
- 对照：用户反馈截图与999条实现截图已在同一视觉比较输入中复核。

## 失败与修正

### Iteration 1 — 未通过

- [P1] 首次用0条和6条得出“工具栏无重叠”的结论，未覆盖三位数计数；该结论不充分。
- [P1] 卡片模式与排序没有被验收为一个明确贴右的操作组，旧桌面窗口仍显示明显右侧空隙。
- fix：共享工具栏改为100%双列网格；操作组`justify-self:end`且右内边距为0；入口名允许优先省略，计数、单位和两个操作均禁止收缩。

### Iteration 2 — 响应式几何通过，但桌面未通过

- 1280×720、999条状态实测：工具栏宽278px；摘要宽119px；操作组宽148px；操作组右边缘与工具栏右边缘间距0px；摘要与操作组间距8px。
- `overlap=false`、`actionOverflow=false`、`countOverflow=false`；入口名`持续跟踪`完整显示，999计数完整显示。
- 四入口消费同一`UnifiedNoteListDisplayToolbar`，因此该规则不是持续跟踪页面特判。
- [P1] 南烛枫随后提供v21真实Windows截图：虽然按钮位于摘要右侧，但按钮组右边缘离工具栏右边缘仍有明显空白；因此“贴右通过”结论撤销。

### Iteration 3 — 强制绝对右贴

- fix：不再依赖网格剩余空间；按钮组绝对定位`right:0`，左侧摘要预留156px，按钮自身`justify-content:flex-end`。
- 1280×720、120条状态实测：工具栏宽278px、摘要宽119px、按钮组宽148px；按钮与工具栏右边缘重合，右间距0px；摘要与按钮间距8px。
- `overlap=false`、`actionOverflow=false`、`countOverflow=false`；证据`docs/screenshots/qa/four-entry-toolbar-120-far-right-1280x720.png`。

## 卡片密度结果

- 日期统一为完整`YYYY-MM-DD`；四入口默认紧凑卡片。
- 左侧语义图标为30×30px；标题14px、最多两行；第二行9.5px，只保留真实主题和来源值。
- 6条状态下标题与第二行均无裁切；卡片通常为72px，双行标题的选中卡按内容自然增高。

## 自动证据与边界

- 前端142/142通过，新增999条静态合同和贴右布局合同。
- TypeScript、Vite生产构建与Windows Tauri `--no-bundle`通过；固定入口`.runtime-qa/standard-viewport-v22-build`已完成`--prepare / --verify`。
- v22 EXE为38,039,552 bytes，SHA-256=`ED3733DCEBF6C180947ACFBF472D57D61ECCA7D56447FD1C2F204E7260F0E9D1`。
- 浏览器控制台error为0；紧凑/舒展切换和排序三态循环通过。
- v22的1702×1066真实Windows WebView2仍待南烛枫可见复核；本节不再以浏览器几何替代桌面结论。

final result: blocked（v22代码、响应式专项与隔离构建通过；真实桌面待南烛枫确认）

## 2026-08-01 四入口筛选统一与左摘要恢复

- [P1] v22虽然把右侧操作组固定到`right:0`，却通过压缩父级可用宽度吞掉了左侧`来源档案`；用户截图只剩`120 条`。
- [P1] 来源档案仍使用页面私有筛选浮层，未遵守“四入口共同问题一次修全”的底层统一合同。
- fix：`UnifiedNoteListFilter`成为四入口筛选结构、字段渲染、重置/应用和关闭行为的唯一所有者；来源只传业务字段。
- fix：左摘要与右操作改为互不侵占的独立定位；来源页1280×720专项实测摘要文本`来源档案0条`完整，`clientWidth=scrollWidth=84`，操作组右间距0，`overlap=false`。
- 1280×720仅为响应式专项，不能替代固定1702×1066真实Windows桌面验收。

## 自动证据与边界

- 前端142/142、TypeScript、Vite与Windows Tauri `--no-bundle`通过。
- 固定入口已切至`.runtime-qa/standard-viewport-v23-build`并完成`--prepare / --verify`；EXE为38,040,064 bytes，SHA-256=`894142965C47F67CAC13197BE79B264B139A926B5D9AEF9D42FB91AE27A77102`。
- Codex未启动应用、未打开或写入正式数据。

final result: blocked（代码、响应式几何与v23隔离构建通过；真实桌面待南烛枫确认）

## 2026-08-01 单篇卡快捷操作悬停显示

- 锁定层级：C 交互与状态；不修改卡片布局、五套皮肤、业务动作或四入口数据语义。
- source visual truth：`docs/screenshots/final-core-workspace/note-actions-hover-only-reference.png`，锁定收藏、完整导出、更多三个按钮以鼠标悬停显示为标准，不再把“选中笔记”解释为显示条件。
- 根因：`UnifiedNoteListCard`自身可聚焦，旧`.unified-note-card:focus-within`会在点击选中卡片后持续命中，使操作按钮常驻。
- fix：共享可见性只保留卡片`:hover`、操作区域`:has(:focus-visible)`和卡片`.menu-open`；删除来源档案遗留的页面私有操作可见性样式。四入口共同消费同一规则。

### 对照与交互证据

- 选中隐藏：`docs/screenshots/qa/note-actions-selected-hidden-card-crop.png`；浏览器状态为`selected=true / focusWithin=true / hover=false / opacity=0 / pointer-events=none`。
- 键盘操作显示：`docs/screenshots/qa/note-actions-keyboard-visible-card-crop.png`；实际“更多”按钮`:focus-visible`时`opacity=1 / pointer-events=auto`。
- 菜单稳定性：更多菜单展开后移开卡片仍保持三个按钮可见；点击外部关闭菜单。关闭后如实际操作按钮仍保留键盘焦点，则继续显示，点击卡片恢复为选中隐藏。
- 1280×720只作为响应式交互专项；内置浏览器指针移动未可靠触发CSS`:hover`，因此物理鼠标悬停和1702×1066真实Windows WebView2仍留给固定BAT可见验收，不把选择器合同冒充真实鼠标结论。

### 自动证据与边界

- `UnifiedNoteListCard + NoteListActions`定向测试通过；全量前端143/143、TypeScript通过。
- Vite生产构建与v24固定窗口`--prepare / --verify`通过；EXE为38,040,064 bytes，SHA-256=`CB77C549F0FCCE7F6C59D9F461272D8B7A4093F5FCABD32BAB15C7A22BA3084B`。
- Codex不启动应用、不打开或写入正式数据。

final result: blocked（选中隐藏、键盘焦点和菜单保持的代码/隔离浏览器证据通过；物理鼠标悬停与1702×1066真实桌面待南烛枫确认）

## 2026-08-01 四入口筛选字段语义统一

- source visual truth：`docs/screenshots/final-core-workspace/unified-filter-source-reference.png`、`unified-filter-status-reference.png`、`unified-filter-topic-reference.png`。
- implementation：`docs/screenshots/qa/source-filter-unified-semantics-1280x720-responsive.png`；聚焦裁切为`docs/screenshots/qa/source-filter-unified-semantics-card-crop.png`。
- viewport：实现图为1280×720 CSS px、1×，只作为响应式与交互专项，不替代1702×1066正式桌面。
- state：组合筛选展开；来源、状态、主题和两个日期字段可见；实现截图选择主题`资本开支`。

### Iteration 1 — 发现假统一

- [P1] 来源档案复用了`UnifiedNoteListFilter`外壳，但第一字段消费`sourceType`，因此出现`file`；第二字段消费来源整理状态，因此只有`待确认/已归类`；另三入口第三字段仍是标签。
- fix：共享层新增来源、记录状态、主题和日期字段工厂及统一匹配；来源档案按`sourceOriginLabel`筛选，记录状态从关联Record读取，无侧车来源按普通记录处理；来源整理状态仍留在下方专属行。
- fix：App一次读取正式主题目录并与记录已关联主题合并，把同一主题选项数组同时传给来源档案、我的收藏、持续跟踪和判断更新。

### Post-fix evidence

- 隔离浏览器逐一打开四入口：五个字段均存在；状态选项均为`全部状态/普通记录/持续跟踪/待验证/判断更新`；主题均含`全部主题`和同一`资本开支`；四入口均无`全部来源类型`和`标签`。
- 持续跟踪入口同时选择`行业访谈记录 + 持续跟踪 + 资本开支`后，6条收敛为2条，标题和第二行来源均与条件一致。
- 来源档案浏览器无Tauri正式数据，因此只能确认字段、主题目录和状态选项；正式来源文件名选项仍需v25真实桌面确认。
- 字体、间距、颜色、图像质量和文案均未改视觉Token；本轮只更正字段文案与数据语义。三个参考截图与实现裁切已在同一比较输入中检查，无新增布局遮挡。

### 自动证据与边界

- 前端144/144、TypeScript、Vite及v25固定窗口`--prepare / --verify`通过；EXE为38,041,600 bytes，SHA-256=`0C3106DA7895956EA9CF55E89D8B5EB6BF5482B7EE377F51DC83F4376EA66E59`。
- Codex未启动应用、未打开或写入正式数据。

final result: blocked（四入口字段/选项/匹配的代码与隔离浏览器交互通过；正式来源文件名和1702×1066桌面待南烛枫确认）

## 2026-08-01 图片附件预览全屏与手势

- source visual truth：`docs/screenshots/final-core-workspace/attachment-image-preview-window-reference.png`；它作为默认窗口偏小、图片查看空间不足的失败证据，不锁定截图内容。
- implementation：`docs/screenshots/final-core-workspace/attachment-image-preview-fullscreen-implemented.png`；交互状态为`attachment-image-preview-resize-pan-implemented.png`。
- combined comparison：`docs/screenshots/qa/attachment-image-preview-comparison.png`；参考与实现按相近宽高比置于同一输入，确认实现默认占满1702×1066可用视口、标题栏无重叠、图片完整适配且右下缩放把手不遮挡主体信息。

### 交互与几何证据

- 默认窗口：1686×1050，位于(8,8)，对应视口四周8px安全边距；图片自然尺寸1583×993，画布1684×982，`complete=true / object-fit=contain`。
- 人工调窗：内置浏览器真实指针从右下把手拖动后，窗口由1686×1050变为1408×858；把手与画布使用互斥角落判定，不触发图片平移。
- 左键平移：画布实际拖动后`translate3d(100px, 60px, 0)`；释放后恢复grab指针。
- Ctrl+滚轮：生产组件使用`passive:false`原生wheel监听并检查`ctrlKey`；纯函数测试覆盖光标中心缩放、恢复、25%–800%限制和平移。内置浏览器控制接口未能生成可观测的Ctrl滚轮事件，因此物理鼠标手势保留为BAT真实桌面门槛，不把静态代码冒充桌面已验收。

### 自动证据与边界

- 前端156/156、TypeScript、Vite、v35 Windows Tauri `--no-bundle`及BAT `--prepare / --verify`通过。
- v35 EXE为38,211,584 bytes，SHA-256=`7A1CE3861DD6EA2378BDA6F83E82B304B8981FD3FDEE7C2C33BC95AA1728F02D`。
- Codex未启动应用、未打开或写入正式数据；真实Windows WebView2中的物理Ctrl+滚轮仍待南烛枫确认。

final result: passed（视觉对照、默认全屏、完整适配、人工调窗和左键平移通过；物理Ctrl+滚轮属于明确的真实桌面门槛）

## 2026-08-01 主题结构上下文编辑与统一弹窗

- source visual truth：`docs/screenshots/final-core-workspace/topic-structure-contextual-edit-dialog-reference.png`，1280×801 px。它是顶部按钮堆叠和行内表单过多的失败证据，锁定“操作下沉到对应行、详情统一弹窗”的方向，不作为示例数据或旧控件像素目标。
- implementation：`docs/screenshots/qa/topic-structure-contextual-edit-1702x1066-final.png`，1702×1066 px；弹窗状态为`docs/screenshots/qa/topic-structure-edit-dialog-1702x1066.png`，1702×1066 px；响应式专项为`docs/screenshots/qa/topic-structure-contextual-edit-1280x720.png`，1280×720 px。
- viewport / density：主实现为1702×1066 CSS px、100%缩放、1×；响应式专项为1280×720 CSS px、1×。参考图本身为1280×801，属于失败状态证据，未对其做伪造的像素等宽比较。
- state：参考为旧版“编辑已展开且顶部集中新增”状态；实现为新版“编辑态、对应行操作可见”状态，另独立检查领域编辑、主题编辑、顶层主题新增、子主题新增和领域新增弹窗。
- combined comparison：`docs/screenshots/qa/topic-structure-reference-comparison-20260801.png`把参考问题和1702×1066实现截图置于同一对照输入；两侧状态差异是本次有意替换，不据此做无意义的逐像素判定。

### Findings

- 无P0/P1/P2。顶部已从三个并列按钮收敛为一个`编辑 / 完成编辑`；领域和主题操作与对象同排，列表末尾承担新增领域，未再出现行内表单或嵌套按钮。
- 字体与层级：沿用现有微软雅黑/系统回退和主题管理字号Token；领域、主题、来源数与操作按钮权重清楚，1702×1066与1280×720均无异常换行或截断。
- 间距与布局：1702×1066完整视图中操作与对象直接对应；1280×720几何检查2个领域头和6个主题行全部`fits=true / separated=true`，卡片未横向溢出。
- 色彩与Token：继续使用现有雾蓝表面、橙色编辑强调、玻璃卡和边框Token，没有新增皮肤私有颜色；五套皮肤结构合同未改。
- 图像质量：本轮没有新增产品图像资产；全部操作图标使用既有Lucide `Plus / Pencil / X`，未用文字符号、CSS图形或手写SVG替代。
- 文案与内容：新增、编辑、父级位置和所属领域均在弹窗内给出明确上下文；没有把动态示例数据写入生产组件。
- 交互与可访问性：四类详情共享唯一`data-topic-structure-dialog`所有者；弹窗具备`role=dialog`、`aria-modal`、明确标签，`Escape`和点击遮罩都已在应用内浏览器实际关闭；最终预览控制台error/warn为0。

### Focused region evidence

- 领域编辑弹窗单独截图足以读取输入、说明、取消/保存和关闭按钮；无需再裁切，因为1702×1066原图中控件文字、边界和焦点框均清晰。
- 子主题弹窗实际显示`所属领域：投资研究 / 父级位置：A股与基金市场`；顶层主题弹窗显示`父级位置：领域顶层`，确认不是只有视觉按钮而缺少真实上下文。

### Comparison history

- Iteration 1：首次完整对照未发现可执行P0/P1/P2，因此没有为了“做一次修改”而制造视觉变更。视觉验收夹具最初返回空目录提案触发一条夹具校验提示，修正夹具后新建独立最终预览页重新走完整路径，控制台error/warn为0；产品代码未因夹具问题改动。

### Implementation checklist

- [x] 顶部删除集中式`添加领域 / 添加主题`，只保留编辑状态入口。
- [x] 领域、主题和列表末尾承载对应新增/编辑入口。
- [x] 新增与编辑详情统一弹窗，支持遮罩和Escape关闭。
- [x] 1702×1066主视图、1280×720防重叠、控制台和Windows隔离构建完成。

### Follow-up polish

- 无阻塞项。正式Windows WebView2仍由南烛枫使用v36固定BAT做最终手感确认；该边界不影响本次隔离视觉QA结论。

final result: passed

---

## 2026-08-01 数据与存储卡片收口及实时刷新

- source visual truth：`docs/screenshots/final-core-workspace/settings-storage-card-duplication-reference.png`（999×190，SHA-256=`B3BBFA32D47232A2FE3B751709A6EE7F1CDDEC6DE7CC47B13BA5DAA91D4B67FD`）与`settings-storage-stale-stats-refresh-reference.png`（1256×830，SHA-256=`B6D1FB7C50DAF60C99EE596D60AFF33CB6BEF01AE9F821D510F5D0FD1775B28C`）。前者锁定重复标题、额外范围和不等比例问题；后者锁定外部删除后统计停留旧值的问题。
- implementation：`docs/screenshots/qa/settings-storage-cards-refresh-v39-1702x1066.png`（1702×1066，SHA-256=`229F8B01080DCCA56FCBD25C9E296B0773104DD18C0C3108F27A82D42A74CC05`）。
- combined comparison：`docs/screenshots/qa/settings-storage-cards-refresh-v39-comparison.png`（1280×720，SHA-256=`72B276387CAFC99975896768E164A9B046BE1F2E8DDF60B3A7233F632C146C24`），把失败参考和1702×1066实现聚焦裁切置于同一输入。
- viewport / density：实现为1702×1066 CSS px、浏览器缩放100%、device scale factor 1；参考图是用户失败证据，不以旧高度或数值作为像素目标。
- state：设置 → 数据与存储弹窗打开；高级维护折叠；浏览器演示数据；存储概览与两张主卡完整可见。

### Findings

- 无P0/P1/P2。数据交换与备份恢复均为458.5×120.05px，顶部与底部完全对齐；两个操作区底边同为654.05px，按钮稳定贴底。
- 字体与文案：两卡各只保留一个13px标题和一句11px提示；`批量导入与导出`重复副标题、`完整备份适合换机与灾难恢复`及`备份范围`节点均为0。
- 间距与布局：双卡使用`repeat(2, minmax(0, 1fr))`，高度由同一网格行拉齐；弹窗无横向或纵向溢出，按钮与卡片底边保留一致14px内边距。
- 色彩与Token：继续使用既有淡橙数据交换、淡青备份恢复表面及雾蓝边框；没有新增皮肤私有色或改变五套皮肤。
- 图像质量：本轮没有新增产品图像；刷新、上传、数据库和恢复动作使用Lucide图标，没有手写SVG、文字符号或占位资产。
- 刷新交互：设置概览与主界面容量区各有一个`刷新存储统计`按钮；两个入口均在浏览器实际点击并出现`存储统计已刷新`反馈。App在focus与visibilitychange恢复可见时调用同一并发合并刷新所有者。
- 底层事实：Rust `storage_stats`每次调用都会重新读取数据库文件大小并递归统计导入、附件和备份目录，没有持久缓存；因此界面刷新会消费实时目录结果。

### Comparison history

- Iteration 1：首次实现即消除重复文案并取得等宽等高/贴底几何，无P0/P1/P2；未为了制造迭代而继续修改。补充需求加入刷新后，重新捕获最终实现并更新同屏比较。
- 运行日志仅包含Vite连接、HMR和React开发提示，无error或warn。

### 自动证据与边界

- 前端161/161、TypeScript、Vite生产构建与diff check通过。
- v39 Windows Tauri `--prepare / --verify`通过；EXE 38,212,608 bytes，SHA-256=`531DA085E43D312960CF50677DF7082C57F7E3FFB3A26564D0FF41BC8C48BCAC`。
- Codex未启动Windows应用、未打开或写入正式数据，也没有删除/恢复任何文件。正式Windows中“外部删除备份 → 回到应用自动刷新”的真实数值变化仍待南烛枫用固定BAT确认；这不阻塞本次布局与刷新入口的隔离视觉QA。

final result: passed

---

## 当前最新 QA 结论

- 当前最新验收为`2026-08-02 四套皮肤共享布局与目录收口`章节；同视口实现、交互切换和几何测量通过，正式Windows WebView2仍由v46 BAT确认。

final result: passed

---

## 2026-08-02 来源档案重复标题删除

- source visual truth：`docs/screenshots/final-core-workspace/source-page-duplicate-heading-reference.png`，145×66 px，SHA-256=`49BF19395EA6B0C965EB0B7BBF66FECDF7A166552480365DD16623A13F593E87`。只锁定删除正文顶部重复`来源档案`大标题，不改变侧栏入口、自动整理、搜索、筛选、列表或详情。
- implementation：`KnowledgeWorkspace`来源分支删除标题节点；顶栏改为`source-page-actions-only`，继续承载右上唯一`自动整理待归类来源`按钮，并把标题区下间距从18px压缩为10px。

### 自动证据与边界

- 前端170/170、TypeScript、Vite生产构建与v44 Windows Tauri `--prepare / --verify`通过；EXE为38,218,240 bytes，SHA-256=`3D92664A2168697869111796E87D4D0F169DACDF0E6B74611AAB4AAD387BF3AA`。
- E2E合同同步改为页面标题计数0，并改用保留的顶栏空白区验证更多菜单外部点击关闭；未运行独立Playwright CLI。
- 1702×1066应用内浏览器连续两次本机页面导航超时，已停止对应Vite进程，未用空白页冒充视觉证据。因此本轮确认到代码、契约、生产构建和隔离BAT层；正式Windows的按钮位置与列表上移由南烛枫双击BAT确认。
- Codex未启动Windows应用、未读取或写入正式数据。

final result: blocked

---

## 2026-08-01 知识视图自动摘要首屏

- source visual truth：`docs/screenshots/final-core-workspace/knowledge-auto-overview-above-fold-reference.png`（SHA-256=`2866E3D809995724C3B5C464E95783CB23E1E4F348936D6C51DA190D7AB555D1`）。锁定五类有价值信息及“打开主题即可看到”的方向，不锁定截图里的示例文本、编辑按钮或大卡高度。
- implementation：`docs/screenshots/final-core-workspace/knowledge-auto-overview-above-fold-implemented.png`（1702×1066，SHA-256=`0C27A6C15739D4F218DE82060046789DA41356E09DF4495302F3DB45F4CF5B72`）。
- combined comparison：`docs/screenshots/qa/knowledge-auto-overview-reference-vs-implemented.png`（SHA-256=`8DE297300F7EEDF95B094833D7F98244DAE3A8E26EC36CBC3C21E0A99BFD2A37`）。参考是旧详情局部裁切，实现是标准完整窗口，因此按信息层级与首屏可达性比较，不做无意义的整图像素重合判断。
- viewport / density：实现为1702×1066 CSS px、100%缩放、device scale factor 1，Chrome使用项目既有Playwright配置。

### Findings

- 无P0/P1/P2。当前判断、事实与线索、关键证据、待验证问题和建议下一步全部位于四状态Tab之前；E2E实测摘要底边不超过视口、位于Tab上方且右侧阅读卡无横向溢出。
- 首轮截图发现“事实与线索”和“关键证据”在缺少正式命题时重复同一证据；已把前者改为正式支持命题或自动结论，后者只保留高可信证据/正文锚点，第二轮截图确认分工清晰。
- 自动摘要沿用现有雾蓝、浅橙、浅青和玻璃表面；图标来自既有Lucide，没有新增手写SVG、CSS图形或占位资产。
- 一条当前判断最多两行，四卡各预览两条并提供进入既有阅读状态的链接；没有新增长滚动区或第五个平行Tab。
- 正式知识对象优先；正式对象为空时只从真实笔记和来源正文确定性生成，自动项明确标记，来源证据保留锚点，建议行动不写回正式对象且不伪造执行结果。

### 自动证据与边界

- 前端166/166、TypeScript、Vite生产构建、知识视图1702×1066 E2E 1/1通过。
- E2E验证五类信息可见、当前正式判断优先、摘要位于Tab之前、无需滚动完整可见和无横向溢出；生成纯函数覆盖“正式对象全空”和“正式判断/已验证证据优先”。
- `启动南枫知识库-知识摘要首屏验收.bat --prepare / --verify`通过；v40隔离EXE为38,218,240 bytes，SHA-256=`DE918F56C7FC4033793AED454DF1D80EC7DB9E0AC0F8447F2A4488113F2199C0`。
- 未启动Windows桌面应用、未读取或写入正式数据库；正式Windows WebView2观感与正式主题正文的生成质量仍需南烛枫确认。

final result: passed

---

## 2026-08-02 四套皮肤共享布局与目录收口

- source visual truth：`docs/screenshots/final-core-workspace/classic-skin-shared-layout-reference.png`（SHA-256=`30A4C41F1B2B93FAB3A327813D8F947FA88EB9B7B9CFFBF62460F84A7A6271EB`）锁定原版浅色效果不变但布局位置与场景皮肤一致；`bronze-skin-removal-reference.png`（SHA-256=`2E142233A33D483F105EE5EC92B9D1885504A11E37CE5787FB48B4A08260D000`）锁定铜金发簪删除且不增加替代项。
- implementation：`docs/screenshots/qa/skin-layout-v46-scene-1702x1066.png`与`skin-layout-v46-classic-1702x1066.png`，均为1702×1066 CSS px、100%缩放、device scale factor 1。
- combined comparison：`docs/screenshots/qa/skin-layout-v46-reference-vs-implemented.png`（SHA-256=`EEF4B09BBA27DB49E6F826C90B563239320D48FF9F39B84F07C30578ECD8D25E`）与`skin-layout-v46-scene-vs-classic.png`（SHA-256=`BA985A58E30BE6B298D83FB1DEA9E9F2A0210A2B5F41BFC79F262E38772DF3B7`）。

### Findings

- 无P0/P1/P2。沙漠灯笼与原版浅色的外框几何实测完全一致：侧栏`x=12 / y=12 / 214×1042`，主区`x=240 / y=12 / 1450×1042`；页面无横向溢出。
- 原版浅色计算样式仍为深蓝侧栏`rgb(6,43,86)`、冷灰主区`rgb(238,241,245)`，侧栏/主区圆角为18/20px；仅共享布局位置，没有把场景背景或磨砂材质带入原版浅色。
- 设置页唯一皮肤目录为`沙漠灯笼 / 花房 / 奔马 / 原版浅色`，四张选择卡同排、同宽`208px`、同高`126px`；铜金发簪可见文本计数为0，旧`bronze-botanical`值由读取合同回退默认皮肤。
- 浏览器切换皮肤后控制台error/warn为0；场景背景、磨砂卡和原版浅色预览效果均保持。

### 自动证据与边界

- 定向皮肤目录与几何合同7/7、完整前端179/179、TypeScript、Vite生产构建和v46 Windows Tauri`--prepare / --verify`通过；EXE为34,862,592 bytes，SHA-256=`800862CC9DB8651B1C550EDB18E15C3A8E9F0D8131C8B31482052487E24C0A0A`。没有另行启动Playwright CLI；四套目录、切换、几何、溢出和控制台由应用内浏览器实测。
- 应用内浏览器只使用隔离浏览器仓库，没有读取或写入正式数据库；正式Windows WebView2切换观感由南烛枫双击`启动南枫知识库-四套皮肤统一布局验收.bat`确认。

final result: passed

---

## 2026-08-02 知识四态主要内容优先

- source visual truth：南烛枫提供的四张失败证据已归档为`knowledge-four-mode-redundant-*-heading-reference.png`，分别对应竞争假设、判断演变、笔记与来源和决策版本。它们只锁定“重复说明层挤占主要内容”的问题，不锁定截图中的示例文本、数据数量或裁切尺寸。
- implementation：`KnowledgeReadingWorkspace`删除四态的模式眉题和编号`ReadingSectionHeading`；Tab继续持有模式身份，对象组件继续持有时间线筛选、三栏标题、上版/当前判断和决策链阶段。
- viewport / density：标准目标仍为1702×1066 CSS px、100%缩放、device scale factor 1；正文区统一14px起始内边距。

### Findings

- 代码与结构无P0/P1：四态都直接进入主要内容，旧`knowledge-final-section-heading / knowledge-final-mode-heading / ReadingSectionHeading`不再存在。
- 信息取舍：删除阅读方法、职责复述、编号步骤、主题头重复计数、通用介绍、技术空态、笔记活动状态和决策重复详情网格；空态压缩为`暂无 / 未记录 / 待回写`等最短表达。
- 保留门槛：日期、来源、置信度、有效期、证伪条件、实际风险、时间线筛选和决策阶段能直接帮助判断、定位或操作，继续显示。
- 间距：判断演变的时间线和版本差异使用同一14px节奏；来源三栏取消额外外卡内边距；决策首张版本卡不再有额外顶部说明卡。
- 图像与资产：本轮没有新增产品图像、图标或视觉语言，只减少冗余结构。

### 自动证据与边界

- 前端168/168、TypeScript、Vite生产构建与v41 Windows Tauri `--prepare / --verify`通过；EXE为38,217,216 bytes，SHA-256=`F2C03BD62F2E6B369A12F65C05C596D864E6759B01B888AC6DDA30C1B558E4FA`。
- 应用内浏览器在1702×1066下确认无Tauri桥时显示诚实空态，但无法提供四态正式主题数据；因此没有用空态截图冒充本轮数据承载视觉验收。
- `tests/e2e/knowledge-final-view.spec.ts`已加入四态直接内容、冗余文案为0、14px起始间距和无横向溢出的定向合同；遵守本轮浏览器边界，未另行启动Playwright CLI。
- Codex未启动Windows桌面程序、未读取或写入正式数据库。正式数据四态的同视口观感由南烛枫双击`启动南枫知识库-四态主要内容优先验收.bat`确认。

final result: blocked

---

## 2026-08-02 知识摘要完整内容弹窗

- source visual truth：`docs/screenshots/final-core-workspace/knowledge-overview-truncated-detail-dialog-reference.png`，1274×119 px，SHA-256=`1E9AFF9A047781CDA9BCA4D411BB8235FBA3739C36F967C7B4614CBB7FF3441E`。它只锁定四卡长文本被省略且底部查看不可用的问题，不锁定示例内容和截图裁切。
- implementation：四张摘要卡继续保留两条首屏预览；四个`查看全部`共用一个Portal弹窗，完整渲染当前类别全部摘要，保留自动标记与对应深读入口。
- interaction：关闭按钮、`Escape`、点击遮罩均关闭；打开时聚焦关闭按钮，普通关闭后焦点回到原卡片；长列表只在弹窗正文内滚动。

### 自动证据与边界

- 前端169/169、TypeScript、Vite生产构建、diff check和v42 Windows Tauri `--prepare / --verify`通过；EXE为38,218,240 bytes，SHA-256=`9872FC09219725AF686DFC1D97594FF60F925A89836EF22074D1FE15A3314136`。
- `tests/e2e/knowledge-final-view.spec.ts`已加入关键证据弹窗三条完整内容、无单行省略与Escape关闭合同；依照本轮浏览器边界未直接运行Playwright CLI。
- Codex未启动Windows程序、未读取或写入正式数据。正式WebView2下四卡逐项点击、长文本滚动与五套皮肤观感由南烛枫双击`启动南枫知识库-知识摘要完整内容弹窗验收.bat`确认。

final result: blocked

---

## 2026-08-02 图片预览暗底与中键复位

- source visual truth：`docs/screenshots/final-core-workspace/attachment-image-preview-light-surround-reference.png`，SHA-256=`8434B93FD44E47E0C12DE60B479408125ED8E6ED21267878E7D563E76640C962`。只锁定“图片外围统一暗底突出主体”和“中键恢复当前窗口完整适配”，不锁定截图中的图片内容。
- implementation：`docs/screenshots/qa/attachment-image-preview-dark-middle-reset-1702x1066.png`，1702×1066 CSS px、100%、device scale factor 1，SHA-256=`F6E3D31F8F97852A3711407FAAC407AF5EF93CA1715AC21F7E8EA2C0FA975A5C`。
- combined comparison：`docs/screenshots/qa/attachment-image-preview-dark-reference-vs-implemented.png`，SHA-256=`F447528994C8E076D12B3180B025A38B5D54AEB0F014A5AB4576E3D75B0E3936`。

### Findings

- 无P0/P1/P2。图片分支外壳、标题栏和画布计算色分别为`rgb(11,16,23)`、`rgb(21,28,37)`和`rgb(8,12,18)`，白色或透明图片边界清楚，外围不再与图片主体竞争。
- 暗底只由`.attachment-preview-image`与`.attachment-preview-stage.is-image`持有；PDF、文本、音频、视频和不支持格式继续使用原浅色预览视觉。
- 左键拖动实测把图片位移改为`70×45px`；随后中键点击画布，位移恢复为`0×0px`、图片恢复为`scale(1)`，浏览器默认中键行为被阻止。Ctrl+滚轮、调窗、关闭、Escape和打开原文件保持原合同。
- 应用内浏览器截图后发现暗色标题栏文件名仍可能被后置基础选择器覆盖；最终代码已用更高特异性的图片分支选择器锁定`#eef4fb`，并重新完成生产构建与v43隔离链接。该文字修正未二次截图，但不改变已实测的暗底、图片适配或中键状态。

### 自动证据与边界

- 前端169/169、TypeScript、Vite生产构建与v43 Windows Tauri `--prepare / --verify`通过；EXE为38,218,240 bytes，SHA-256=`F035F5175F1A5CDA420AE4B2D357802E75EFA9B950491CA925E5E8CD2A50BC5E`。
- 新增`启动南枫知识库-图片暗底与中键复位验收.bat`；Codex只执行安全的`--prepare / --verify`，没有启动Windows应用、没有读取或写入正式数据。
- 真实Windows WebView2中的物理中键、Ctrl+滚轮和不同图片透明边缘观感由南烛枫双击BAT确认。

final result: passed
