# Design QA

## 对照证据

- source visual truth：`C:\Users\Administrator\.codex\generated_images\019f97f2-696b-7c40-90c3-b7211c57ce2d\call_tOlY06Hml4mopKbUTt91f9qd.png`
- source pixels：1488 × 1058；为同视口比较归一化到 1440 × 1024。
- implementation：`docs/screenshots/implementation-1440x1024.png`
- implementation pixels / CSS viewport：1440 × 1024；device scale factor 1。
- state：全部记录、搜索“资本开支”、第 3 条记录选中、详情阅读模式、历史版本收起。
- full-view evidence：`docs/screenshots/design-qa-comparison.png`
- focused evidence：`docs/screenshots/design-qa-focus-judgment.png`
- responsive evidence：`docs/screenshots/implementation-1440x900.png`、`docs/screenshots/implementation-1366x768.png`
- density inspection：`docs/screenshots/implementation-1440x900-density-2x-simulated.png` 仅用于 2× 像素密度检查，不等同真实 Windows 200% DPI。

## Findings

未发现仍需修复的 P0、P1 或 P2 问题。

- 字体与排版：系统中文字体、标题权重、正文行高和标签层级与参考稿一致；实现中的次级正文略克制，属于可接受的 P3 差异。
- 间距与布局：三栏比例、详情面板起点、标题、判断卡和语义卡节奏已对齐；1366 × 768 无页面级横向溢出。
- 颜色与 Token：深普鲁士蓝导航、冷灰工作区、白卡和红/橙/绿语义色与参考一致。
- 图像与图标：界面没有位图内容；所有可见功能图标来自 Lucide React，没有用字符、Emoji 或 CSS 图形替代。
- 文案与内容：标题、判断、事实、证据、问题、行动和版本内容与参考稿及产品草案一致。
- 交互状态：选中、编辑、保存、折叠、版本和导入映射已在浏览器验证；悬停投影与快捷操作由精细指针媒体查询控制。

## Comparison history

### Iteration 1

- [P2] 详情区起点偏右、宽度不足，标题与判断卡整体偏高。
- evidence：初始实现 `implementation-1440x1024.png` 与源稿的完整对照。
- fix：记录列上限由 464 px 收紧到 424 px；详情面板下移 20 px；增加标题区和判断卡纵向空间；调整语义卡两行高度。

### Iteration 2

- post-fix evidence：`docs/screenshots/design-qa-comparison.png`。
- result：三大区域比例、详情标题坐标和卡片纵向节奏已对齐，无剩余 P0/P1/P2。

### Iteration 3

- [P2] 选中记录与详情面板的关联线被记录列表裁切，滚动条轨道形成一道硬切，冷灰底层没有连续贯穿两栏。
- evidence：用户反馈截图 `codex-clipboard-407ef71c-4db1-478b-95b1-1c8ba823b99a.png`。
- fix：关联线改为工作区层独立绘制，使用运行时几何跟随选中卡片；隐藏记录列表滚动条轨道；工作区与主区域统一使用冷灰最底层背景。
- post-fix evidence：`docs/screenshots/implementation-1440x900.png`。
- result：关联线宽 30 px、与选中卡片中心偏差 0 px；记录列表 `scrollWidth === clientWidth`，无横向溢出或滚动条硬切；左右两栏底层背景连续。

### Iteration 4

- [P2] 关联线锚点使用负像素估算定位，圆心没有与 1 px 线段形成可直接验证的同轴合同；部分可见按钮仍是静态装饰。
- evidence：用户反馈截图 `codex-clipboard-69e43b1d-f436-47a9-aeb4-1c9798990b10.png`。
- fix：锚点改为独立 8 px 元素，以 `top: 50%` 和 `translateY(-50%)` 对齐线段中心；为筛选、排序、收藏、分享、菜单、详情展开、历史查看、设置和快捷键补齐阶段 1 本地交互。
- post-fix evidence：`docs/screenshots/design-qa-comparison.png`、`docs/screenshots/implementation-1440x900.png`。
- result：1440 × 900 下线段中心 y=438 px，左右锚点中心 y=438 px，偏差均为 0 px；页面横向溢出为 0；主流程按钮逐项浏览器验证通过。

## Primary interactions tested

- 搜索框与记录选中。
- 进入编辑、修改当前判断、720 ms 后出现“本地草稿已保存”。
- 完成编辑、追加版本、出现 v4 成功提示并展开历史版本。
- 进入导入中心、载入 JSON 示例、继续字段映射、完成导入预览。
- 浏览器控制台错误：0。
- 来源筛选、默认/最新/最早排序、列表与详情收藏同步、记录分享、记录/全局菜单、详情全集弹层、历史版本预览、设置预览、标签菜单、持续跟踪/判断更新视图与 Ctrl/⌘ + Enter 完成编辑。

## Follow-up polish

- P3：在真实 Windows 触控板与鼠标环境复核悬停阴影的主观力度。
- P3：进入 Tauri 阶段后补真实 150% / 200% 系统 DPI 截图。

final result: passed
