# 正式旧库内容分类预演摘要

## 结论

已对 2026-07-27 生成的旧库隔离副本执行内容驱动分类 dry-run。分类复用了唯一算法入口 `classifySource`，没有创建知识表、没有修改隔离副本，也没有读取或写回正式库。

当前 8 个原型种子 Topic 只让 7 / 384 条记录达到最低候选阈值，覆盖率约 1.8%；其余 377 条需要人工处理。结果证明原型目录不能充当正式个人主题树，下一阶段应先从真实内容提出“主题目录候选”，由用户确认后再重跑分类，不能通过堆叠关键词或降低阈值制造虚假覆盖率。

## 运行边界

- 输入副本：`.runtime-qa/knowledge-migration-preview-20260727-authorized-v4/legacy-readonly-copy.db`
- 分类标准输入：`.runtime-qa/knowledge-classification-preview-20260727-authorized-v1/classification-input.json`
- 完整 JSON 报告：`.runtime-qa/knowledge-classification-preview-20260727-authorized-v1/classification-preview.json`
- 完整 Markdown 报告：`.runtime-qa/knowledge-classification-preview-20260727-authorized-v1/classification-preview.md`
- 算法：`local-rules-v1`
- 临时目录：`prototype-seed-v1`，状态为 `provisional`
- 临时 Topic / 规则：8 / 5
- FTS5/BM25 外部信号：未提供
- 已确认主题历史：未提供
- 单条正文最多使用 24,000 字符的首段、中段和尾段确定性样本。

完整报告包含真实标题，仅保留在 Git 忽略的 `.runtime-qa`；本文不记录标题、正文或 Record ID。

## 汇总结果

| 指标 | 数量 |
|---|---:|
| 活动记录 | 384 |
| 可自动接受（≥90） | 0 |
| 建议确认（70–89） | 0 |
| 仅候选（45–69） | 7 |
| 人工处理（<45） | 377 |
| 候选分差小于 10 | 0 |
| 超长正文被确定性抽样 | 14 |
| 仍为通用标题 | 22 |

来源类型为 AI 对话 366、普通 JSON 16、Markdown 2。7 条达到候选阈值的记录全部落在临时“开放文件工作流”Topic；其他 7 个种子 Topic 没有形成达到阈值的候选。

首选得分分布：

- 最低：0
- 中位数：5.68
- P90：23.55
- P95：25.03
- 最高：53.68

## 只读证据

- 隔离副本连接为 SQLite `READ_ONLY` + `query_only`。
- 导出前后 `total_changes` 均为 0。
- 导出前后 SHA-256 均为 `21DEEB5A6292D43989CB2295215FBC0C5954AB2ECAF4C79F656959F7B98CF512`。
- 副本 `integrity_check=ok`。
- 分类结果只写入项目 `.runtime-qa` 报告文件。
- 同一标准输入在独立输出目录重跑后，JSON 与 Markdown 报告均逐字节一致；JSON SHA-256 为 `64CE67234F6D05D1AB6C403C05E57DEE36EFAA19F7D1DC30993895925FD57FBA`。

## 下一阶段门槛

1. 从 384 条真实内容中生成有界、可解释的主题目录候选，但不得把单篇标题直接升格为 Topic。
2. 每个候选至少给出代表性内容数量、来源类型、关键词/实体依据和重叠情况。
3. 用户确认 Domain、Topic、别名及应合并/拆分项后，目录才能从 `provisional` 升级。
4. 再接入本地 FTS5/BM25 归一化信号并重跑；仍不得以降低 45/70/90 阈值换取覆盖率。
5. 正式数据库写入、启动 migration 和自动接受依旧需要新的明确授权。

## 补充 ChatGPT 全量会话后的复核

用户随后提供 `conversations-000.json` 至 `conversations-005.json`。六个文件共 517 条会话，与原分类输入中的 100 条 ChatGPT 会话无 `conversation_id` 重叠，文件内部和跨文件也没有重复。

合并后标准输入为 901 条：旧库基础记录 384、新增 ChatGPT 会话 517；平台分布为 ChatGPT 617、Claude 266、其他导入 18。结果为：

| 指标 | 数量 |
|---|---:|
| 总记录 | 901 |
| 达到候选阈值 | 10 |
| 人工处理 | 891 |
| 超长正文被抽样 | 23 |
| 仍为通用标题 | 22 |

完整输入和报告位于 `.runtime-qa/knowledge-classification-preview-20260727-chatgpt-complete-v1/`。JSON 报告 SHA-256 为 `25C98F307EED0AD3BA472965A3F99EA436BEEA9E18F348E1F384E4BE05D526F6`；独立重跑的 JSON 和 Markdown 均逐字节一致。

结论不变：扩充真实会话后，临时目录覆盖率仍约 1.1%，不能作为正式个人 Topic 树。完整 ZIP 的附件审计另见 `docs/audits/2026-07-27-chatgpt-export-bundle/summary.md`。
