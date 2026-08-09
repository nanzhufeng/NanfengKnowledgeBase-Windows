# 全部笔记历史搜索与右键上下文统一合同 v81

## 根因

- `我的收藏 / 持续跟踪`的搜索由`App.tsx::RecordList`持有；`全部笔记`由`KnowledgeWorkspace.tsx`持有。此前只在前者局部加入六类范围，组件外观和搜索状态没有共享。
- 应用右键菜单只读取`App.selectedRecord`；全部笔记当前选中对象是`KnowledgeInboxItem`，因此复制、搜索和导出被误判为没有当前笔记。
- 旧右键搜索只写入`recordSearch`，不会驱动全部笔记的`sourceSearch`；旧验收 BAT 还错误指向附件预览隔离包，双击不会看到最新代码。

## 唯一所有者

- 六类范围统一由`UnifiedHistoricalSearchScope`持有，全部笔记、我的收藏和持续跟踪共同消费。
- 全部笔记正文仍由`KnowledgeRepository.searchSourceArchive`检索；附件按`RecordRepository.searchAttachments`的受控索引检索，不扫描外部目录。
- 当前笔记右键上下文由`KnowledgeWorkspace`注册给应用菜单；来源缺少兼容 Record 时，仅在用户执行导出等动作时调用既有`ensureSourceActionRecord`建立一次操作侧车。
- 跨入口右键搜索使用带`requestId`的一次性指令，由全部笔记搜索所有者消费后立即清除。

## 交互与排版

- 搜索浮层统一为约312px的苹果式玻璃弹层；标题、六类范围、最近使用分区明确。
- 六类范围使用三列两行小圆角矩形，不使用胶囊；每个按钮拥有独立悬浮与选中反馈。
- 组合筛选采用两列网格，主题字段、辅助动作和底部操作横跨整行。
- 未选中文字时，右键搜索回退为搜索当前笔记标题；复制、搜索和导出在存在当前笔记时均可用。

## 验证边界

- 前端合同、TypeScript、Vite和1702×1066 Playwright路径验证代码与浏览器交互。
- Windows隔离BAT只证明当前源码已构建且文件可校验；不会启动软件或打开正式数据。
- 正式`D:\南枫知识库`中的附件命中、右键导出和WebView2视觉仍由南烛枫双击BAT确认。
