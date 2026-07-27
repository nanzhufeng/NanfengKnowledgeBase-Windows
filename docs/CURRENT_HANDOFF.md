# 当前交接

> 更新时间：2026-07-27
> 项目：南枫知识库 `0.2.0`
> 仓库：`C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence`
> 当前分支：`codex/nanfeng-knowledge-production-checkpoint-20260727`
> 代码 checkpoint：`9965ad5`
> 恢复验收 checkpoint：`fbe4c15`
> 当前工作区：性能优化、阅读体验、自动分类、正式数据复核与本地 NSIS 安装生命周期均已完成对应层级验证
> 远端状态：本分支无 upstream，未推送；`origin/main` 不包含本轮知识生产链路

## 新对话读取顺序

只按以下顺序读取，不要先扫描全部历史文档：

1. `AGENTS.md`：稳定规则、安全边界和入口。
2. 本文件：当前代码事实、验证等级、阻塞和唯一下一步。
3. `docs/next-codex-prompt.md`：下一轮可执行任务合同。
4. 任务需要时再读：
   - 产品边界：`docs/product-brief.md`
   - 概念所有权：`docs/architecture-governance.md`
   - 业务规则：`docs/domain-rules.md`
   - 验收标准：`docs/test-plan.md`
   - 最高规格：`docs/南枫知识库_产品定义与自动分类主规格.md`

`docs/audits/`、旧原型代码和历史提交只用于追溯，不是默认开工入口。

## 一、项目当前处于什么阶段

项目已经越过“假数据原型、领域合同和只读预演”阶段，当前代码完成了正式知识生产链路接入：

```text
原件归档
→ 内容提取与标准化
→ Source Item 进入收录箱
→ 本地确定性分类建议
→ 人工确认/撤销
→ Topic、判断、证据、问题
→ 独立 Note、命题与人工确认的关键转折
→ 合并/关系治理
→ 本地研究上下文
```

正式应用默认显示收录箱、主题浏览器和整理工作台；假数据原型不再是运行入口。旧 `Record` 继续作为来源档案兼容层，知识结构由独立表和仓库管理。

完整迁移备份、失败自动回滚、隐藏 Tauri 命令桥和重启持久化已经在隔离根验证。南烛枫于 2026-07-27 分别授权后，正式 `D:\南枫知识库` 已完成 migration v3 和独立只读复核；BAT 已完成知识工作区、长正文、收藏恢复、附件打开入口、隔离批量导入和优雅退出验收；南烛枫已确认性能优化后“流畅度好多了”。本轮进一步完成收录箱独立滚动、统一正文渲染、领域/主题编辑和导入自动分类。当前最重要的边界：**新 BAT 等待南烛枫确认外部图片/链接前台唤起；GitHub 发布未执行。**

## 二、已实现的当前代码事实

### 正式入口与仓库

- `src/App.tsx` 接入正式知识工作区。
- `src/components/KnowledgeWorkspace.tsx` 提供收录箱、主题浏览器和整理工作台。
- `src/services/knowledgeRepository.ts` 是前端到 Tauri 知识命令的唯一适配器。
- `src-tauri/src/knowledge/repository.rs` 持有知识结构读写、事务和撤销规则。
- `src-tauri/src/database.rs` 的 migration v3 创建知识表并幂等回填 legacy Record。
- 浏览器没有 Tauri 桥接时只显示诚实空状态，不注入业务假数据。
- 收录箱列表默认只加载 120 条轻量摘要，完整正文仅在选中后读取；超过 20,000 字默认使用流畅预览，用户可主动展开。
- 切换来源会先清空旧正文，避免一帧显示上一条内容；非来源页不再预取旧记录详情、版本和附件。
- 桌面宽屏收录箱只让左侧来源列表滚动；页头和右侧阅读/分类卡保持固定。正文区占用分类区之外的剩余高度，主题归属区独立滚动。
- 当前判断、普通 TXT/Markdown、Claude/ChatGPT 等平台会话统一经过 `MarkdownContent` 和 `ReadableMessageContent`；自然换行、标题、列表、链接与角色卡不再由页面各写一套格式。

### 已接入的知识能力

- Domain、任意深度 Topic/Subtopic 创建、读取和编辑；重命名或修改描述保留原 ID 与已有关系。
- legacy Record 幂等生成 Source Item 并进入收录箱。
- 分类建议持久化、人工确认、操作日志与撤销。
- 分类入口通过一个正式 Tauri 命令读取 SQLite 中的主题、别名/实体规则、用户规则、历史确认和归一化 FTS5/BM25 信号，再统一交给 `classifySource` 评分。
- 新导入成功后由 `knowledgeAutoOrganizer` 对新增 Source Item 去重并生成建议；没有主题时先增量启用既有可编辑个人目录。只有 `auto_eligible`（≥90）建议自动确认并记录可撤销操作，其余保留人工确认。
- 收录箱提供“自动整理已加载来源”，用于对已有待整理来源补算建议；不改写来源正文。
- 可审阅个人目录提案经用户勾选确认后才增量写入；重复确认幂等，不覆盖已有主题。
- 主题别名、实体词典和分类规则具备正式 CRUD；分类纠正保存明确反馈并继续可撤销。
- 主题判断快照、证据、待验证问题。
- 证据锚点按来源类型校验消息 ID、时间码、字幕行、PDF 页码、HTML 段落、Markdown 标题、JSON 路径、文件片段或短引用，并生成可读定位。
- 独立 Note 支持创建、编辑、软归档、状态恢复、一个主要主题、多个相关主题和多个来源；保存不覆盖 Source Item 正文。
- Proposition 支持独立创建、编辑和保留历史的 superseded 状态。
- Turning Point 只在用户明确选择前后判断并确认后写入；填写变化原因不再自动升格为关键转折。
- 无界面浏览器桥接验收已实际操作 Note、Proposition、时间码 Evidence 和 Turning Point，并核对发往 Tauri 的四组命令参数。
- 带来源边界的本地研究上下文编译，不依赖模型。
- 主题合并影响预览、事务提交和撤销。
- 被合并主题的旧名称和完整旧路径以 redirect 别名写入目标主题；撤销只移除本次插入的重定向。
- 同时拥有当前判断的两个主题禁止直接合并。
- 主题拆分只提供只读分组预览，符合首版产品边界。
- 关系建议只生成确定性候选，人工确认后才写入。

### 导入、附件、备份和安全

- JSON、Markdown、TXT、HTML 和 ChatGPT 完整导出 ZIP 支持归档后解析。
- ChatGPT ZIP 建立“消息 → 附件 ID → `.dat` 实体”映射，恢复格式并保存原文件。
- 导入预览有界；确认时由 Rust 重读归档原件，不把完整正文往返 WebView。
- 远程 Markdown 图片默认不自动联网。
- 附件打开、删除和恢复限制在 canonical 受控路径。
- 图片附件和外部链接统一由 Rust `external_open` 所有；Windows 使用 `AllowSetForegroundWindow` 后直接调用 `ShellExecuteExW + SW_SHOWNORMAL`，不再经 PowerShell `Start-Process` 中转。
- 完整迁移备份协议 v2 逐文件记录 SHA-256；旧版无哈希备份只可预览。
- 备份和恢复使用后台工作线程，并在恢复前检查空间、文件集合、大小和哈希。
- 大型 Windows 备份不再依赖构建目录原子改名；最终目录以 `.building` 标记未完成，manifest 最后写入，检查器拒绝仍带标记的备份。
- 隔离维护工具可在数据库与导入原件替换后注入确定性故障，用于验证自动回滚；生产 Tauri 恢复命令不暴露该故障入口。

## 三、数据现状与保护边界

### 正式数据已有事实

- 当前正式数据根：`D:\南枫知识库`。
- 活动记录：901。
- Source Item：901；legacy Record 关联：901；收录箱：901。
- 附件数据库登记：446。
- migration：1、2、3；`integrity_check=ok`；外键违规 0。
- ChatGPT 完整导出已导入 517 条会话，恢复 718 个附件实体；同一记录内内容完全相同的实体去重后形成 446 条附件登记。
- 旧目录 `D:\南枫情报台` 仅作为保留的兼容来源，不删除、不覆盖。

### 正式 migration v3 证据

- 升级前只读核对：migration 1、2；活动 Record 901；删除 Record 0；附件登记 446；知识表不存在；`integrity_check=ok`；外键违规 0。
- 完整备份：`D:\南枫知识库\backups\正式知识结构升级前完整备份_20260727-071304-178`。
- 完整备份共 729 个文件、2,370,812,749 字节；无 `.building` 标记；逐文件清单状态 `verified_sha256`。
- manifest SHA-256：`f0dd16ba18fcdc82997db2e7d1ecb02a78e00b5e205cc44b6497f8658663a13d`。
- 升级前一致数据库与 migration 自动数据库备份 SHA-256：`c4e957f08430eddd381336c2b3494491beb58ee4f9d6395e9884b616e1d371cc`。
- migration 后正式数据库 SHA-256：`7a65927e0019318f42db15d4fe9839ee3ab5fc5b602e5c93cc38ef952293ba22`。
- migration 后与第二次打开均为 migration 1、2、3；901 活动 Record、901 Source Item、901 legacy 关联、901 收录箱、446 附件；`integrity_check=ok`；外键违规 0；SHA-256 和计数不变。
- 正式回执：`D:\南枫知识库\logs\formal-knowledge-migration-v3-20260727-071615-115.json`。
- 无界面维护无法读取 WebView localStorage，因此完整备份中的 `preferences.json` 是诚实的空对象；迁移未修改现有 WebView 界面设置，失败回滚路径只恢复数据库。
- 脱敏摘要：`docs/audits/2026-07-27-formal-knowledge-migration/summary.md`。

### 可见 BAT 验收证据

- `启动南枫知识库-测试版.bat --rebuild` 和普通启动均能打开正式知识库。
- Windows `tasklist` 会把长进程名截断，BAT 原先因此误报程序已退出；`b962159` 已改为匹配稳定进程名前缀。
- 修复后 `latest.log` 记录“程序已成功启动”；应用已运行时 BAT 返回退出码 2 并提示先关闭。
- 收录箱、主题浏览器、整理工作台、来源档案和 68 条对话的长正文已可见加载。
- 现有收藏完成取消后恢复，最终收藏数仍为 1。
- PNG 与 WAV 附件登记可见并能调用 Windows 打开流程；本机没有对应默认应用，因此停在“选择应用”并取消。
- 正式根的批量导入页和多文件选择器已打开并取消，未创建新导入任务。
- 隔离根通过 BAT 选择 JSON 与 Markdown 两个脱敏文件，预览 3 条并成功导入 3 条；migration 1/2/3、3 Record、3 Source Item、`integrity_check=ok`、外键 0。
- 本轮另在 `.runtime-qa/visible-layout-auto-20260727-qa1/data` 预览并导入 12 条脱敏 JSON 记录；成功 12、跳过 0、失败 0。导入后自动建立可编辑默认目录，分析 12 条并保留 12 条待确认建议。
- 可见收录箱确认左侧列表独立滚动，页头和右侧正文/主题归属卡不随左侧移动；浏览器端契约进一步精确验证页头和右卡位移为 0。
- 两次独立普通关闭分别约 0.52 秒和 1.55 秒完成退出。
- 收藏恢复会更新该记录的 `updated_at`，因此当前数据库 SHA-256 为 `37cf4e9278f9afad5d1cedbf4d593a7b0341c518c7b3f8865b8554f3a7ca6b48`；计数、migration、完整性、外键和最终收藏状态保持正确。
- 脱敏摘要：`docs/audits/2026-07-27-visible-bat-acceptance/summary.md`。

### 性能优化与安装生命周期证据

- 性能根因是启动时向 React 传输最多 500 条完整 `original_text`，并在收录箱页预取旧记录详情、版本和附件。
- `d3fae13` 将列表改为轻量摘要、120 条分页和选中后正文按需读取；`ab91841` 增加切换清空与 20,000 字流畅预览。
- 当前 BAT：`启动南枫知识库-测试版.bat`；其测试 EXE 位于被忽略的 `.runtime-qa/knowledge-base-build/release/`。
- 可见只读检查确认正式库首屏 120 条、长正文预览和展开/恢复按钮工作；南烛枫已确认流畅度明显改善。
- 本轮 BAT 测试 EXE 已在 `.runtime-qa/knowledge-base-build/release/nanfeng-knowledge-base.exe` 重新生成。外部打开已改用 Windows 原生 ShellExecute；自动桌面检查在点击测试链接后因无法可靠确认浏览器 URL 而按安全规则停止，因此“浏览器/图片查看器是否直接前台显示”仍由南烛枫用 BAT 最终确认。
- 脱敏摘要：`docs/audits/2026-07-27-reading-auto-organization/summary.md`。
- NSIS `0.2.0` 安装器 SHA-256：`E252C46EE8728E1FBA1AAFA468E79A2CFC158D6C2BCE7133C4FB75DBD564BF4B`；大小 4,126,201 字节。
- 全新安装、隔离启动、优雅退出和卸载通过；隔离数据库 migration 1/2/3、完整性 `ok`、外键 0。
- `0.1.0 → 0.2.0` 升级保留 1 条脱敏记录，并生成 1 个 Source Item 和 1 条收录箱来源；旧程序目录和旧卸载项被移除。
- 旧版运行时，新安装器退出码 2，旧版保持、新版不安装；关闭旧版后升级退出码 0。
- 新版只读打开正式库并关闭后，数据库 SHA-256 仍为 `37cf4e9278f9afad5d1cedbf4d593a7b0341c518c7b3f8865b8554f3a7ca6b48`，计数、完整性和外键不变。
- 卸载后程序目录和卸载项移除，正式库与隔离升级数据均保留。
- 脱敏摘要：`docs/audits/2026-07-27-windows-installer-lifecycle/summary.md`。

### 本轮知识迁移证据

只在 `.runtime-qa/knowledge-v3-20260727-qa1/` 的隔离副本执行：

| 检查项 | 结果 |
|---|---:|
| 活动 Record | 901 |
| Source Item | 901 |
| 收录箱 | 901 |
| 附件登记 | 446 |
| migration | 1、2、3 |
| `integrity_check` | `ok` |
| 外键违规 | 0 |
| 第二次执行 | 数量不变、未重复回填 |

隔离工具要求 `.isolated-knowledge-migration-test` 标记，并拒绝正式新旧数据根。

### 完整恢复与隐藏 Tauri 证据

- 完整恢复根：`.runtime-qa/portable-recovery-20260727-qa4`
- 隐藏 Tauri 根：`.runtime-qa/hidden-tauri-bridge-20260727-qa1`
- 最新知识生产隐藏 IPC 根：`.runtime-qa/hidden-knowledge-production-20260727-qa4`
- 完整备份 manifest：6 个受校验文件，653,213,880 字节，`verified_sha256`
- 成功恢复、故障自动回滚和数据库重开均保持 901 Record、901 Source Item、446 附件登记、migration 1/2/3、`integrity_check=ok`、外键 0。
- 脱敏合成导入原件、附件和界面偏好在恢复后哈希一致；故障回滚后的受保护文件哈希精确一致。
- 实际隐藏 Tauri/WebView2 经正式 IPC 创建脱敏 Domain/Topic；强制结束后第二次隐藏启动仍读到相同 ID，收录箱 901、完整性 `ok`。
- 最新隐藏 IPC 又经正式命令创建并重启读回 Source、Note、Proposition、Evidence、两个 Judgment 和 Turning Point；migration 1/2/3、对象计数、精确锚点、`integrity_check=ok`、外键 0 均通过。
- capability 不允许 WebView 自行关闭窗口，因此只验证了强制进程重启后的 SQLite 恢复与持久化，未验证优雅退出。
- 脱敏摘要：`docs/audits/2026-07-27-portable-recovery-hidden-tauri/summary.md`
- 最新知识生产 IPC 摘要：`docs/audits/2026-07-27-hidden-knowledge-production-ipc/summary.md`

## 四、最新验证等级

当前知识生产核心代码、隐藏 IPC 工具和正式迁移维护入口对应 checkpoint `6d0180f`；性能优化对应 `d3fae13`、`ab91841`；安装升级修复对应 `8f6559b`；阅读布局、统一正文、前台唤起和自动分类对应 `9965ad5`：

| 验证层级 | 结果 |
|---|---|
| 前端单元/领域合同 | 55/55 通过 |
| Rust/SQLite 合同 | 65/65 通过 |
| Sites 回退合同 | 4/4 通过 |
| Playwright 无界面交互 | 18/18 通过；新增收录箱独立滚动、右侧固定和统一会话卡合同 |
| TypeScript | 通过 |
| Vite 生产构建 | 通过 |
| `git diff --check` | 通过 |
| 901 条隔离 migration v3 | 通过 |
| 完整迁移备份创建/检查/恢复 | 隔离 qa4 通过 |
| 故障注入后的自动回滚 | 隔离 qa4 通过 |
| 最新知识生产命令的真实 Tauri 桥 | 隐藏 WebView2 IPC 通过；新对象写入与强制重启读回通过 |
| 重启与退出 | 强制进程重启后的持久化通过；可见普通退出两次通过 |
| 正式数据 migration v3 | 已执行；完整备份、前后 SHA-256、第二次打开幂等、完整性和外键均通过 |
| 可见 BAT 用户路径 | 启动、知识工作区、长正文、收藏恢复、附件入口、隔离批量导入、自动目录/建议、独立滚动和优雅退出通过 |
| 当前版本安装包/升级覆盖/卸载 | 本地 NSIS 全新安装、0.1.0 升级、运行中保护、正式数据保留和卸载通过 |
| 性能优化 BAT 主观体验 | 南烛枫已确认明显改善 |
| 外部图片/链接前台显示 | 代码、Rust 合同和生产构建通过；待南烛枫用最新 BAT 确认真实默认应用前台行为 |
| GitHub 发布 | 未执行 |

不能把自动测试、生产构建或隔离迁移表述为正式数据与完整桌面链路已完成。

## 五、仍需继续处理

### P0：正式数据升级已关闭

正式 `D:\南枫知识库` 已完成 migration v3。完整数据备份与 migration 自动数据库备份均保留，正式回执和脱敏审计摘要已记录；本轮没有删除或覆盖 `D:\南枫情报台`。

### P1：知识系统生产能力

以下代码能力已经完成：个人目录审阅确认、分类规则/主题别名/实体词典 CRUD、分类纠正反馈、合并旧路径重定向、独立 Note、Proposition、用户确认的 Turning Point 和来源类型感知的精确证据锚点。

拆分提交仍不属于当前首版；只有南烛枫重新确认产品边界后才实施。主规格中的竞争假设、决策结果、知识有效期、研究债务、笔记合并拆分和本地模型等属于后续增强，不是本轮正式升级阻塞项。

### P2：发布前用户验收

1. BAT 的功能路径和性能主观反馈已通过；最新 BAT 等待南烛枫确认图片/外部链接是否直接出现在前台，并复核本轮阅读布局与自动分类体验。
2. 本地 NSIS 全新安装、旧版升级、运行中保护、正式数据保留和卸载已通过。
3. 南烛枫已明确暂不安装 Inno Setup 7；不要自行切换打包链路。
4. 只有用户明确说“上传”后，才同步默认分支、tag、GitHub Release 和安装器哈希。

## 六、已排除的旧方向

- `src/prototypes/knowledge-evolution/` 是历史设计/测试资产，不是当前生产入口。
- `docs/audits/2026-07-26-*` 和早期 2026-07-27 审计记录各自阶段事实，不可覆盖本文件顶部的当前状态。
- 不继续扩充 `Record` 承担 Topic、Note、Evidence 等全部职责。
- 不通过模型或 Codex 临时修改导入内容来获得正确展示。
- 不让 Codex、Obsidian 或第三方工具直接写 SQLite。
- 不以降低分类阈值、堆关键词或自动执行低置信操作代替用户确认。

## 七、关键代码地图

| 范围 | 主要文件 |
|---|---|
| 正式应用入口 | `src/App.tsx`、`src/components/KnowledgeWorkspace.tsx` |
| 前端知识合同与适配器 | `src/knowledge/domain.ts`、`src/knowledge/deterministicClassifier.ts`、`src/services/knowledgeRepository.ts` |
| 数据库与 migration | `src-tauri/src/database.rs`、`src-tauri/src/knowledge/schema.rs` |
| 知识仓库 | `src-tauri/src/knowledge/repository.rs` |
| 只读审计、隔离与正式迁移工具 | `src-tauri/src/knowledge/audit.rs`、`classification_input.rs`、`legacy_preview.rs`、`src-tauri/src/maintenance.rs`、`src-tauri/examples/knowledge_inspect_formal.rs`、`knowledge_migration_apply_formal.rs` |
| ChatGPT 完整导出 | `src-tauri/src/chatgpt_export.rs`、`src-tauri/src/importer.rs` |
| 附件、外部打开和备份 | `src-tauri/src/attachments.rs`、`src-tauri/src/external_open.rs`、`src-tauri/src/transfer.rs` |
| 隔离恢复验收 | `src-tauri/src/maintenance.rs`、`src-tauri/examples/portable_recovery_qa.rs` |
| 验收合同 | `docs/test-plan.md`、`docs/audits/2026-07-27-knowledge-production-checkpoint/acceptance-matrix.md` |

## 八、接手时的 Git 规则

- 先运行 `git status --short` 和 `git log -3 --oneline --decorate`。
- 当前成果位于本地 `codex/nanfeng-knowledge-production-checkpoint-20260727`，不要误回到 `main`。
- 不执行 `reset --hard`、`clean`、`stash` 或覆盖未知改动。
- 本分支未推送；不要把“本地 checkpoint”描述成“GitHub 已更新”。
- 当前代码 checkpoint 为 `9965ad5`；接手时先以 `git status` 和 `git log -1` 为准，不需要把完整聊天历史重新读取。

## 九、下一件事

当前没有继续扩大代码范围的默认任务。下一道门槛是：**由南烛枫运行 `启动南枫知识库-测试版.bat`，确认图片和外部链接是否直接出现在前台，并复核独立滚动、统一正文和自动分类体验。**

若仍有问题，下一轮只复现具体动作并定向修复；不要凭感觉扩大重构。GitHub 发布必须等待南烛枫明确说“上传”；Inno Setup 7 也保持暂缓。
