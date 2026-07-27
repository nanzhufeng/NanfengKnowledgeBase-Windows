# 当前交接

> 更新时间：2026-07-27
> 项目：南枫知识库 `0.2.0`
> 仓库：`C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence`
> 当前分支：`codex/nanfeng-knowledge-production-checkpoint-20260727`
> 代码 checkpoint：`6d0180f`
> 恢复验收 checkpoint：`fbe4c15`
> 当前工作区：正式 migration v3 已执行并完成无界面复核
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

完整迁移备份、失败自动回滚、隐藏 Tauri 命令桥和重启持久化已经在隔离根验证。南烛枫于 2026-07-27 单独授权后，正式 `D:\南枫知识库` 已完成 migration v3、完整迁移备份、第二次打开幂等检查和独立只读复核。当前最重要的边界：**数据库升级门槛已经关闭，但可见 BAT 长时间交互与优雅退出仍未验收；安装包和发布也未执行。**

## 二、已实现的当前代码事实

### 正式入口与仓库

- `src/App.tsx` 接入正式知识工作区。
- `src/components/KnowledgeWorkspace.tsx` 提供收录箱、主题浏览器和整理工作台。
- `src/services/knowledgeRepository.ts` 是前端到 Tauri 知识命令的唯一适配器。
- `src-tauri/src/knowledge/repository.rs` 持有知识结构读写、事务和撤销规则。
- `src-tauri/src/database.rs` 的 migration v3 创建知识表并幂等回填 legacy Record。
- 浏览器没有 Tauri 桥接时只显示诚实空状态，不注入业务假数据。

### 已接入的知识能力

- Domain、任意深度 Topic/Subtopic 创建与读取。
- legacy Record 幂等生成 Source Item 并进入收录箱。
- 分类建议持久化、人工确认、操作日志与撤销。
- 分类入口通过一个正式 Tauri 命令读取 SQLite 中的主题、别名/实体规则、用户规则、历史确认和归一化 FTS5/BM25 信号，再统一交给 `classifySource` 评分。
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

当前知识生产代码、隐藏 IPC 工具和正式迁移维护入口对应代码 checkpoint `6d0180f`：

| 验证层级 | 结果 |
|---|---|
| 前端单元/领域合同 | 52/52 通过 |
| Rust/SQLite 合同 | 62/62 通过 |
| Sites 回退合同 | 4/4 通过 |
| Playwright 无界面交互 | 17/17 通过；其中 1 条覆盖知识生产 UI→受控 Tauri 桥参数 |
| TypeScript | 通过 |
| Vite 生产构建 | 通过 |
| `git diff --check` | 通过 |
| 901 条隔离 migration v3 | 通过 |
| 完整迁移备份创建/检查/恢复 | 隔离 qa4 通过 |
| 故障注入后的自动回滚 | 隔离 qa4 通过 |
| 最新知识生产命令的真实 Tauri 桥 | 隐藏 WebView2 IPC 通过；新对象写入与强制重启读回通过 |
| 重启持久化 | 强制进程重启后通过；优雅退出未验证 |
| 正式数据 migration v3 | 已执行；完整备份、前后 SHA-256、第二次打开幂等、完整性和外键均通过 |
| 当前版本安装包/升级覆盖 | 未执行 |
| GitHub 发布 | 未执行 |

不能把自动测试、生产构建或隔离迁移表述为正式数据与完整桌面链路已完成。

## 五、仍需继续处理

### P0：正式数据升级已关闭

正式 `D:\南枫知识库` 已完成 migration v3。完整数据备份与 migration 自动数据库备份均保留，正式回执和脱敏审计摘要已记录；本轮没有删除或覆盖 `D:\南枫情报台`。

### P1：知识系统生产能力

以下代码能力已经完成：个人目录审阅确认、分类规则/主题别名/实体词典 CRUD、分类纠正反馈、合并旧路径重定向、独立 Note、Proposition、用户确认的 Turning Point 和来源类型感知的精确证据锚点。

拆分提交仍不属于当前首版；只有南烛枫重新确认产品边界后才实施。主规格中的竞争假设、决策结果、知识有效期、研究债务、笔记合并拆分和本地模型等属于后续增强，不是本轮正式升级阻塞项。

### P2：发布前用户验收

1. 用户通过 BAT 连续验收收藏、长正文、批量导入、不同类型附件和知识工作区。
2. 通过后再重新构建、安装、升级覆盖和卸载验证。
3. 用户明确要求发布后，才同步默认分支、tag、GitHub Release 和安装器哈希。

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
| 附件和备份 | `src-tauri/src/attachments.rs`、`src-tauri/src/transfer.rs` |
| 隔离恢复验收 | `src-tauri/src/maintenance.rs`、`src-tauri/examples/portable_recovery_qa.rs` |
| 验收合同 | `docs/test-plan.md`、`docs/audits/2026-07-27-knowledge-production-checkpoint/acceptance-matrix.md` |

## 八、接手时的 Git 规则

- 先运行 `git status --short` 和 `git log -3 --oneline --decorate`。
- 当前成果位于本地 `codex/nanfeng-knowledge-production-checkpoint-20260727`，不要误回到 `main`。
- 不执行 `reset --hard`、`clean`、`stash` 或覆盖未知改动。
- 本分支未推送；不要把“本地 checkpoint”描述成“GitHub 已更新”。
- 当前代码 checkpoint 为 `6d0180f`；接手时先以 `git status` 和 `git log -1` 为准，不需要把完整聊天历史重新读取。

## 九、下一件事

当前没有继续扩大代码范围的默认任务。下一道门槛是：**等待南烛枫明确允许打开可见窗口后，通过 `启动南枫知识库-测试版.bat` 连续验收收藏、长正文、批量导入、不同类型附件、知识工作区与优雅退出。**

本轮“无可见窗口”边界没有被正式迁移授权扩大；因此不能把无界面数据库验收冒充可见桌面用户验收。BAT 验收通过后，安装包/升级覆盖/卸载和 GitHub 发布仍是后续独立门槛，不得自动开始。
