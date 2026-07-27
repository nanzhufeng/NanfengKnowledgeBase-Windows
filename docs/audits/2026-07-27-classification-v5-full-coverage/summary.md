# 分类 v5 全收录箱隔离审计摘要

> 日期：2026-07-27
> 代码 checkpoint：`c5f6468`
> 数据边界：正式库只读在线备份；目录应用、上下文导出和分类审计均在 `.runtime-qa` 隔离副本完成

## 结论

- 901 条收录箱来源全部进入 `local-rules-v5`，没有只审截图样本或首屏 120 条。
- 885 条生成证据充分候选；16 条诚实保持无候选。
- 16 条无候选中，14 条为空记录或极短占位；另外 2 条只有补充内容/记录请求，没有可判断的业务主题。
- `Untitled`、单字或错误标题仍会使用用户可见正文识别，不能因标题质量差被静默跳过。
- 目录共 10 个领域、68 个主题；导出上下文包含 1,091 条当前有效规则。
- 无候选结果也会保存当前算法版本的完成标记，界面不会反复重算或误称尚未处理。
- 全量升级只写分类建议和无匹配完成标记，不改写来源正文，不自动确认任何结果。

## 隔离数据证据

| 项目 | 结果 |
|---|---:|
| Source Item | 901 |
| 有候选 | 885 |
| 无候选 | 16 |
| `confirm` | 495 |
| `candidates` | 390 |
| `auto_eligible` | 0 |
| 主题 | 68 |
| 有效规则 | 1,091 |
| 只读导出 | `query_only=true` |
| 导出前后连接写入 | 0 / 0 |
| `integrity_check` | `ok` |

隔离根：`.runtime-qa\classification-v5-fresh-audit-20260727-222915-335`

完整报告：`.runtime-qa\classification-v5-fresh-audit-20260727-222915-335\report\classification-coverage-report.json`

## 验证层级

- 前端单元测试：70/70。
- Rust/SQLite：70/70。
- Playwright：18/18。
- Sites 回退：4/4。
- TypeScript、Vite 生产构建、`git diff --check`：通过。
- v5 `--no-bundle` Windows EXE：构建通过。

这些证据证明代码、隔离全量数据和构建层级通过；正式库尚未运行 v5 全量升级，真实桌面体验仍由 BAT 验收确认。
