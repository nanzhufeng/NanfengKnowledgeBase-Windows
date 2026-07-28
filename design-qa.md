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
