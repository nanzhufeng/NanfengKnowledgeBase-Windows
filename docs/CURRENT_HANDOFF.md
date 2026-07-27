# 当前交接

> 更新时间：2026-07-27
> 项目：南枫知识库 `0.2.0`
> 仓库：`C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence`
> 当前分支：`codex/nanfeng-knowledge-production-checkpoint-20260727`
> 代码 checkpoint：`bf7d97e`
> checkpoint 记录提交：`6c35261`
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
→ 合并/关系治理
→ 本地研究上下文
```

正式应用默认显示收录箱、主题浏览器和整理工作台；假数据原型不再是运行入口。旧 `Record` 继续作为来源档案兼容层，知识结构由独立表和仓库管理。

当前最重要的边界：**代码和 901 条隔离副本已验证，正式 `D:\南枫知识库` 尚未执行 migration v3。**

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
- 主题判断快照、证据、待验证问题。
- 带来源边界的本地研究上下文编译，不依赖模型。
- 主题合并影响预览、事务提交和撤销。
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

## 三、数据现状与保护边界

### 正式数据已有事实

- 当前正式数据根：`D:\南枫知识库`。
- 活动记录：901。
- 附件数据库登记：446。
- ChatGPT 完整导出已导入 517 条会话，恢复 718 个附件实体；同一记录内内容完全相同的实体去重后形成 446 条附件登记。
- 旧目录 `D:\南枫情报台` 仅作为保留的兼容来源，不删除、不覆盖。

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

## 四、最新验证等级

以下结果对应代码 checkpoint `bf7d97e`：

| 验证层级 | 结果 |
|---|---|
| 前端单元/领域合同 | 46/46 通过 |
| Rust/SQLite 合同 | 53/53 通过 |
| Sites 回退合同 | 4/4 通过 |
| Playwright 无界面交互 | 16/16 通过 |
| TypeScript | 通过 |
| Vite 生产构建 | 通过 |
| `git diff --check` | 通过 |
| 901 条隔离 migration v3 | 通过 |
| 最新知识 UI 的真实 Tauri 命令桥 | 未执行 |
| 完整迁移备份真实恢复演练 | 未执行 |
| 正式数据 migration v3 | 未执行 |
| 当前版本安装包/升级覆盖 | 未执行 |
| GitHub 发布 | 未执行 |

不能把自动测试、生产构建或隔离迁移表述为正式数据与完整桌面链路已完成。

## 五、仍需继续处理

### P0：正式数据升级前必须关闭

1. 在新的 `.runtime-qa` 隔离根完成完整迁移备份创建、检查、恢复和失败回滚演练。
2. 以隐藏后台 Tauri 进程验证最新知识命令桥、migration v3 和重启持久化。
3. 验证后再次核对数据库、附件、偏好、哈希、完整性和外键。

### P1：知识系统生产能力

1. 生成并由用户确认个人主题目录；现有 `prototype-seed-v1` 只可作为覆盖测试，不能成为正式主题树。
2. 接入 SQLite FTS5/BM25 归一化分类信号，仍由 `classifySource` 统一组合评分。
3. 增加主题别名与旧路径重定向；当前合并能保全对象并撤销，但没有完成重定向。
4. 独立 Note CRUD、Proposition 和 Turning Point 尚未形成完整生产用例。
5. 拆分提交不属于当前首版，除非用户重新确认产品边界。

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
| 只读审计与隔离工具 | `src-tauri/src/knowledge/audit.rs`、`classification_input.rs`、`legacy_preview.rs`、`src-tauri/src/maintenance.rs` |
| ChatGPT 完整导出 | `src-tauri/src/chatgpt_export.rs`、`src-tauri/src/importer.rs` |
| 附件和备份 | `src-tauri/src/attachments.rs`、`src-tauri/src/transfer.rs` |
| 验收合同 | `docs/test-plan.md`、`docs/audits/2026-07-27-knowledge-production-checkpoint/acceptance-matrix.md` |

## 八、接手时的 Git 规则

- 先运行 `git status --short` 和 `git log -3 --oneline --decorate`。
- 当前成果位于本地 `codex/nanfeng-knowledge-production-checkpoint-20260727`，不要误回到 `main`。
- 不执行 `reset --hard`、`clean`、`stash` 或覆盖未知改动。
- 本分支未推送；不要把“本地 checkpoint”描述成“GitHub 已更新”。
- 本文件所在 HEAD 是最新交接包；接手时以 `git log -1` 为准，不需要把完整聊天历史重新读取。

## 九、下一件事

唯一候选任务：**隔离完整恢复演练 + 隐藏 Tauri 命令桥与重启持久化验证。**

直接使用 `docs/next-codex-prompt.md` 开启新对话。该任务完成并有可恢复证据前，不得进入正式数据 migration v3、安装包或 GitHub 发布。
