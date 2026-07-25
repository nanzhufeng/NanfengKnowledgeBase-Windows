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

## Primary interactions tested

- 搜索框与记录选中。
- 进入编辑、修改当前判断、720 ms 后出现“本地草稿已保存”。
- 完成编辑、追加版本、出现 v4 成功提示并展开历史版本。
- 进入导入中心、载入 JSON 示例、继续字段映射、完成导入预览。
- 浏览器控制台错误：0。

## Follow-up polish

- P3：在真实 Windows 触控板与鼠标环境复核悬停阴影的主观力度。
- P3：进入 Tauri 阶段后补真实 150% / 200% 系统 DPI 截图。

final result: passed
