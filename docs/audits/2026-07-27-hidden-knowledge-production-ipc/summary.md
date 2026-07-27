# 隐藏知识生产 IPC 验收摘要

> 日期：2026-07-27  
> 分支：`codex/nanfeng-knowledge-production-checkpoint-20260727`  
> 代码 checkpoint：`08ddaec`  
> 数据边界：仅 `.runtime-qa/hidden-knowledge-production-20260727-qa4` 的脱敏新建数据库；未读写正式数据目录。

## 验收链路

- 使用 `src-tauri/tauri.hidden-qa.conf.json` 强制 `visible:false`。
- `scripts/run-hidden-knowledge-ipc-qa.mjs` 启动真实 Tauri debug 进程和 WebView2，通过正式 `window.__TAURI_INTERNALS__.invoke` 调用命令。
- 首次启动创建脱敏 Record/Source、Domain、两个 Topic、Note、两个 Judgment、Proposition、Evidence 和 Turning Point。
- 强制结束完整进程树后，以同一隔离根第二次隐藏启动，并按首次返回的 ID 逐项读回。
- 最后使用只读 `knowledge_inspect_isolated` 检查 migration、计数、完整性和外键。

## 结果

| 项目 | 结果 |
|---|---:|
| migration | 1、2、3 |
| 活动 Record / Source Item | 1 / 1 |
| Note | 1 |
| Proposition | 1 |
| Evidence | 1 |
| Turning Point | 1 |
| Evidence 锚点 | `短文本引用：离线渲染在最终交付中表现更稳定。` |
| 第二次启动按原 ID 读回 | 全部通过 |
| `integrity_check` | `ok` |
| 外键违规 | 0 |
| 可见窗口 | 否 |

机器可读回执：

- `.runtime-qa/hidden-knowledge-production-20260727-qa4/logs/hidden-knowledge-ipc-report.json`
- `.runtime-qa/hidden-knowledge-production-20260727-qa4/logs/hidden-tauri-ipc.log`

## 自动回归

- 前端：52/52
- Rust：62/62
- Sites：4/4
- Playwright：17/17
- TypeScript：通过
- Vite 生产构建：通过
- `git diff --check`：通过

## 边界

- 本验收只证明新知识对象经过真实隐藏 Tauri IPC 可写入、重启持久化且数据库合同完整。
- 没有证明正式 `D:\南枫知识库` 已迁移。
- 没有验证可见 BAT 长时间交互或优雅退出；进程仍按隐藏 QA 合同强制结束。
- 没有生成安装包或执行发布。
