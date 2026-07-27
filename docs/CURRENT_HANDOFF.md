# 当前交接

> 更新时间：2026-07-27
> 项目：南枫知识库 `0.2.0`
> 仓库：`C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence`
> 当前分支：`codex/nanfeng-knowledge-production-checkpoint-20260727`
> 当前代码 checkpoint：`c5f6468`
> 当前状态：分类 v5、全收录箱断点续算和 fresh 隔离全量审计已完成；v5 BAT 已生成，待用户验收
> 远端状态：本分支无 upstream，未推送；GitHub Release 未执行

## 新对话读取顺序

1. `AGENTS.md`
2. 本文件
3. `docs/next-codex-prompt.md`
4. 任务需要时再读 `docs/domain-rules.md`、`docs/test-plan.md` 和主规格

不要先扫描 `docs/audits/`、旧原型或完整聊天记录。

## 当前实现层级

正式应用已经接入本地知识生产链路：

```text
原件归档
→ 内容提取与 Source Item
→ 收录箱
→ 本地确定性分类建议
→ 人工确认/撤销
→ Topic、Note、判断、证据、问题和关键转折
```

- 正式入口是 `src/components/KnowledgeWorkspace.tsx`，不存在浏览器假数据回退。
- 收录箱首屏只读 120 条轻量摘要，选中后按需读取正文；空会话默认隐藏但不删除。
- 长正文默认流畅预览，“查看详情”使用大弹窗；正文格式已统一到 Markdown/会话角色卡。
- 桌面宽屏只滚动左侧列表，页头和右卡固定。
- 图片、附件和外部链接由 Rust 原生打开路径所有。
- Domain/Topic 可编辑；Note、Proposition、Judgment、Evidence、Open Question、Turning Point、合并预览/提交/撤销均已接入正式仓库。

## 分类 v5

### 结构

- 算法：`local-rules-v5`
- 个人目录：`nanzhufeng-personal-catalog-v5`
- 目录：10 个领域、68 个可编辑主题
- 分类唯一内核：`src/knowledge/deterministicClassifier.ts`
- 自动整理唯一编排：`src/services/knowledgeAutoOrganizer.ts`

### 核心规则

- 标题是最高密度证据；正文只读开头 12,000 字核心可见内容，避免长对话后半段偶然词反客为主。
- 正文规则权重低于标题；同一主题多个独立短语可累积。
- FTS5/BM25 只能增强用户可见投影中真实出现的主题词。
- 原始 JSON 中的模型名、搜索元数据、附件指针和隐藏内容不参与分类。
- 候选仍须达到 45 分并具备直接主题证据；90 分以下不自动确认。
- `Untitled`、单字或错误标题不会被跳过，只要正文主体清晰仍可生成候选。

### 全收录箱升级

- 首次加载 v5 后自动读取最多 2,000 条收录箱来源，覆盖当前正式 901 条，不限于首屏 120 条。
- 通过当前算法版本的持久化完成标记断点续算；重启只处理未完成来源。
- 有候选保存最多 5 条；无候选保存 `topic_id = NULL` 的完成标记。
- 全量升级不自动确认，不改写来源正文，不覆盖已有人工确认归类或用户规则。
- 旧版本建议不再阻塞当前版本重算。

## fresh 隔离全量审计

正式库只通过 SQLite 只读在线备份进入全新隔离根，未使用多轮调试累积的旧副本：

`.runtime-qa\classification-v5-fresh-audit-20260727-222915-335`

结果：

| 项目 | 结果 |
|---|---:|
| 收录箱来源 | 901 |
| 有候选 | 885 |
| 无候选 | 16 |
| `confirm` | 495 |
| `candidates` | 390 |
| `auto_eligible` | 0 |
| 清晰正文无候选 | 2 |
| 主题 | 68 |
| 有效规则 | 1,091 |
| 只读导出 | `query_only=true` |
| 导出前后写入 | 0 / 0 |
| 完整性 | `ok` |

16 条无候选中，14 条为空记录或极短占位；另外 2 条只有补充内容/记录请求，没有可判断的业务主题。脱敏摘要：

`docs/audits/2026-07-27-classification-v5-full-coverage/summary.md`

## 验证层级

| 层级 | 结果 |
|---|---|
| 前端单元/领域合同 | 70/70 |
| Rust/SQLite | 70/70 |
| Sites 回退 | 4/4 |
| Playwright | 18/18 |
| TypeScript | 通过 |
| Vite 生产构建 | 通过 |
| `git diff --check` | 通过 |
| fresh 901 条隔离分类 | 885 有候选、16 无主体/空占位 |
| Windows `--no-bundle` EXE | 通过 |
| 正式 v5 桌面运行 | 未执行，待 BAT 验收 |
| GitHub Release | 未执行 |

自动测试、隔离审计和构建不能表述成正式桌面用户路径已验证。

## 正式数据事实与保护边界

- 正式根：`D:\南枫知识库`
- 旧兼容根：`D:\南枫情报台`
- 活动 Record / Source Item / 收录箱：901
- 附件登记：446
- migration：1、2、3
- 正式 migration v3、完整备份、恢复演练和独立只读复核已完成。
- 本轮分类开发只对正式库做只读在线备份；没有批量写入 v5 建议。
- 启动 v5 后会写分类建议和无候选完成标记，但不会修改来源正文或自动确认候选。

## BAT

- 入口：`启动南枫知识库-测试版.bat`
- 指向：`.runtime-qa\knowledge-base-build-v5\release\nanfeng-knowledge-base.exe`
- EXE 大小：15,338,496 字节
- SHA-256：`8794324F74900EAE82D90E0DCA34B6446B2A403536825ADAA950E7F56CD47669`
- 构建时未覆盖或结束当前仍运行的旧测试版。

## 仍未完成

1. 用户关闭当前旧测试窗口后，用 v5 BAT 做真实桌面验收。
2. 首次启动等待后台处理 901 条来源；不需要逐条点“按新版重新计算”。
3. 复核整体分类体验、前台打开图片/链接、空内容过滤、详情弹窗和滚动布局。
4. Inno Setup 7 暂缓。
5. 安装包和 GitHub Release 暂缓；只有用户明确说“上传”才执行。

## Git 规则

- 不切回 `main`。
- 不 `reset --hard`、`clean`、`stash` 或覆盖未知改动。
- 当前代码 checkpoint：`c5f6468`。
- 本地 checkpoint 不等于 GitHub 已更新。

## 唯一下一步

关闭当前旧测试窗口后运行仓库根 `启动南枫知识库-测试版.bat`，完成分类 v5 的一次真实桌面验收。不要再让用户逐条寻找遗漏；若有问题，应读取当前版本的全量完成统计和具体失败项后定向修复。
