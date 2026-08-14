# 南枫知识库当前交接

## v156 API Key 输入承托与模型精简（2026-08-14）

- 三张 API Key 卡恢复完整宽度的40px输入框与右侧内嵌眼睛。已配置但未点击眼睛时仅显示遮罩圆点，不把真实Key放进前端；眼睛才按既有显式命令从Windows凭据库短暂读取。没有删除Key入口，只有填入新值并点“保存并更新”才会替换凭据。
- 具体模型列表不再显示“每作者最新三条”的冗余目录：千问直连保留`Flash / Plus / Max`，DeepSeek直连仅保留`Flash / Pro`；OpenRouter只保留`OpenAI Terra`与`Anthropic Sonnet`这两种人工高质量兜底，移除Luna、Opus、重复Pro和经OpenRouter的DeepSeek。旧目录读取时也会过滤；若旧手动选择已被过滤，安全回退自动规划而不继续调用隐藏模型。
- 自动验证：前端220/220、TypeScript、Vite、Rust150/150（1项真实Shell测试按设计忽略）、格式和diff已通过。当前唯一验收程序为`v156-key-field-and-model-curation`：`.runtime-qa/current-acceptance-app/release/nanfeng-knowledge-base.exe`，29,864,960 bytes，SHA-256=`48A8E471BB8C1077A76EC93B3CCC2458912021FCE8A8E82B6D77B75442B9A636`，142文件源码指纹=`35AAFD925538E9F70079B61F7F5AD53D1ADA5541AF4390942584B97928ED5687`。Windows PowerShell 5.1与根BAT`--verify`均通过；未启动应用、未读取/写入正式数据库，未调用真实AI。

## v155 统一任务路由基准（2026-08-14）

- 设置 → AI 自动整理不再把三个 API 平台当成三套独立“路由选择”。现只保留一个`任务路由基准`模型框：默认`自动规划`，或由南烛枫从保留模型中人工指定`通道 + 模型`。API Key 保持三张独立卡，仅负责让`千问直连 / DeepSeek 直连 / OpenRouter`可用与更新各自目录，不再改变路由语义。
- 自动优先级由Rust唯一持有并在创建任务时冻结：已配置千问直连优先（档案/归属`qwen3.7-flash`，结构/整合/常规洞察`qwen3.7-plus`）→ DeepSeek直连（`deepseek-v4-flash → deepseek-v4-pro`）→ OpenRouter（仍仅在其已选供应商家族内分档）。`qwen3.8-max-preview`及OpenRouter高难档必须人工选中，自动不升级。主题洞察批量开始前读取后端`routePreview.topicInsightModelId`，将实际`通道 + 模型`冻结给整批，后续改设置不改变在途任务或断点续跑。
- 模型卡的第一行必须明确显示来源，例如`千问直连 · Qwen · …`、`DeepSeek 直连 · DeepSeek · …`、`OpenRouter · OpenAI/Anthropic/DeepSeek · …`；第二行仅保留本知识库任务场景说明。模型目录仍只保留已核对的千问三档、DeepSeek可用档及OpenRouter每个支持作者的结构化输出候选，避免把无路由价值的模型塞入手动列表。
- 自动验证：前端220/220、TypeScript、Rust149/149（1项真实资源管理器测试按设计忽略）、Vite生产构建、Sites 4/4、Rust格式与`git diff --check`通过。全量浏览器`knowledge-final-view.spec.ts`在本轮路由交互前被暗色皮肤的历史固定RGB断言拦截（期待`rgb(12,16,17)`、实际新场景语义色），非本轮改动范围；此轮没有把它冒充为路由失败。未读取/写入正式库、未调用真实AI。
- 当前唯一验收程序为`v155-unified-ai-routing`：`.runtime-qa/current-acceptance-app/release/nanfeng-knowledge-base.exe`，29,855,744 bytes，SHA-256=`59C332DA90A387E961637ED362D542C6D51BF5FD83EA9C3AA54F8A0BACAEA730`，142文件源码指纹=`5B353A280C95E880BAFB826F95930567C09B556B8526302E455F816084747510`。系统Windows PowerShell 5.1的`--prepare / --verify`与根BAT`--verify`均通过；构建和验证没有启动应用、没有读取或写入正式资料库、没有调用AI。真实WebView2设置页、Key配置和一次真实任务路由仍待南烛枫从根BAT确认。

## v154 AI 调用记录（2026-08-14）

- 设置 → AI 自动整理新增“调用记录”入口；记录页显示最近50条模型调用的成功/失败/中断状态、通道与模型、任务阶段、时间、输入/输出/缓存/推理 token 和失败摘要，并可返回设置。模型步骤优先来自`ai_task_model_steps`；没有步骤账本的历史任务才从`ai_task_runs`回退一条，避免重复。已经成功的前序步骤不会因后续阶段失败而被误标为失败。
- 调用记录只读复用现有账本，不新增迁移、日志表或平行成本源；不保存或展示 Prompt、知识正文、API Key、缓存键、稳定前缀原文或价格快照。设置页辅助说明已压缩，保留模型路由、缓存与成本判断所需内容。
- 自动验证：前端37文件、220/220项通过；Rust148项通过、1项真实资源管理器测试按设计忽略；新增内存SQLite合同覆盖“逐阶段记录 + 旧任务回退 + 无敏感内容”；Vite生产构建、Rust `cargo check`、`cargo fmt --check`和`git diff --check`通过。未启动应用、未读取/写入正式库、未调用真实AI。
- 当前唯一验收程序为`v154-ai-call-history`：`.runtime-qa/current-acceptance-app/release/nanfeng-knowledge-base.exe`，29,858,304 bytes，SHA-256=`11618D0A319D083C8C5E6BFDF643E739E9B4AE20E07C1C369EF4501DDFE4752D`，142文件源码指纹=`E52DA11E5660D906A883EA0124DA3C505E16BF97C93A9CE5950F0FE345ABAE83`。系统Windows PowerShell 5.1 的`--prepare / --verify`及根BAT`--verify`均通过；构建和验证没有启动应用、没有读取或写入正式资料库、没有调用AI。真实WebView2界面与真实历史账本显示仍待南烛枫双击根BAT确认。

## v153 暗色场景玻璃最前景卡统一合同（2026-08-14）

- 南烛枫明确把暗色场景玻璃设为唯一例外：`暗色 + 花房/奔马`的普通最前景业务卡统一使用50%透明度；三套暗色实体皮肤与全部浅色皮肤仍保持不透明。实现没有按页面继续叠加私有颜色，而是新增并统一消费`--dark-frontmost-card/raised/selected/human-surface`四个语义入口，覆盖五入口卡二/卡三、主题树领域组和选中项、正文/消息、列表、详情、知识四状态、设置与回收站等前景卡消费者。
- 控制层明确排除：搜索历史、组合筛选、菜单、弹窗、输入与高密度Markdown块继续消费100%不透明`--dark-surface-* / --knowledge-material-popover/modal-surface`；PDF等原生文档画布保持内容原貌。此前卡二搜索弹层透出后方文字的问题仍由实体`dark-skin-panel`和`z-index:40`共同收口，不会因前景卡50%规则回退。
- 同一验收程序同时包含v152悬浮滚轮归属修复：每个wheel按当前鼠标坐标重新命中真实滚动层，跨卡立即取消旧卡待执行尾帧，避免Chromium/WebView2连续滚轮事务保留旧`event.target`后继续滑动上一张卡。
- 自动验证：前端37文件、219/219项通过；TypeScript、Vite生产构建和`git diff --check`通过。1702×1066 Chrome定向回归3/3通过，分别实算暗色场景业务卡alpha=0.50、暗色实体/浅色业务卡alpha=1.00、搜索与筛选弹层alpha=1.00，并保留卡二/卡三旧目标锁定滚轮回归。证据为`.runtime-qa/dark-glass-frontmost-evidence/dark-scene-frontmost-50-percent-1702x1066.png`与`.runtime-qa/dark-popover-evidence/dark-popover-solid-backing-1702x1066.png`。完整`knowledge-final-view.spec.ts`仍含v145之前按统一近黑固定RGB编写的旧断言，本轮不把该旧单体用例冒充当前材质合同；当前改动由新增的跨模式实算用例覆盖。
- 当前唯一验收程序为`v153-dark-glass-frontmost-contract`：`.runtime-qa/current-acceptance-app/release/nanfeng-knowledge-base.exe`，29,785,600 bytes，SHA-256=`DC1588030A5E0008D998FEF29BA8EE7DF9DC4560665C5E5C46E292D7689B4056`，142文件源码指纹=`436C28FD46D98AD3AA727C96D3B67DA81F99D18ECC729EDC297999294CEADA93`。系统Windows PowerShell 5.1、根BAT`--verify / --path`均通过；构建和验证没有启动应用、没有读取或写入正式库、没有调用AI。真实WebView2中花房/奔马五入口整体观感仍需南烛枫双击根BAT确认。

## v151 AI 推理重阶段超时恢复（2026-08-14）

- 南烛枫截图中的`operation timed out`已用正式库只读证据定位，不是余额、API Key、断点损坏或模型拒答。任务`ai-task-7447c811-b290-4788-8a10-f7d2c91a3361`在`2026-08-14T04:01:47.687Z`保存最后一次归属步骤，随后于`04:04:17.692Z`失败，间隔约150秒，和`src-tauri/src/ai/client.rs`旧全局请求上限150秒精确吻合。检查点为`profiles 893/893、assignments 893/893、integrations 0`，因此已完成档案与归属仍可复用，续跑只从主题整合继续。
- 根因是高质量跨文档阶段与高频轻任务共用150秒总超时；第一批8个主题由`qwen3.7-plus`保留推理，响应超过150秒后，旧恢复器又没有把网络超时识别为可缩批错误，于是整次任务立即中断。现只把`taxonomy_structure / taxonomy_topic_integrations`和单主题洞察的请求上限提高到300秒，Flash档案、归属等高频阶段仍为150秒；实际模型、推理强度、Prompt Cache稳定前缀、结构质量门禁和断点合同均未改变。
- 网络发送改为请求级超时：连接尚未建立的瞬时故障最多补试1次、间隔800毫秒；请求已经发出后发生超时不原样盲重发，交给结构化恢复器把8主题批次逐级二分，只发送更小子集。单项连续3次仍失败即停止并保存断点，避免无限重试与不可控计费。超时报错会明确显示等待上限秒数。供应商未返回usage的超时调用不会伪造Token账本；是否已被供应商计费只能以百炼账单为准。
- 自动验证：Rust格式通过；3项新增超时合同通过；Rust全量147项通过、1项真实打开资源管理器的Shell测试按设计忽略；Vite/Tauri生产构建通过。根BAT在系统Windows PowerShell 5.1下`--verify`返回0。验证没有启动应用、没有调用真实AI、没有续跑任务、没有写正式数据库；因此“主题整合在真实百炼响应下最终完成”仍需南烛枫从断点人工验收。
- 当前唯一验收程序为`v151-ai-timeout-batch-recovery`：`.runtime-qa/current-acceptance-app/release/nanfeng-knowledge-base.exe`，29,787,136 bytes，SHA-256=`2ADA22EC148F72A0738FFA8205357140D81FF6753923DE95CEEF90DDA1ED5229`，142文件源码指纹=`431BF1252C771CA2E27CAA26D2A9F4DACA0E01F32F6C32EF42C7324842F24AEB`。唯一入口仍为根目录`启动南枫知识库-当前验收.bat`。

## v150 Windows 启动器与主窗口恢复（2026-08-14）

- “双击 BAT 打不开”的直接根因不在 EXE、AI 数据或正式 SQLite：根 BAT 曾被保存为 Unix LF 换行，`cmd.exe` 会把后续行的开头吞掉，导致 `rem / set / powershell` 等命令残缺并一闪而过；换行修好后又暴露 Windows PowerShell 5.1 会把无 BOM 的 UTF-8 中文脚本按 ANSI 解码，破坏脚本语法。旧 `--verify` 还在括号块内使用 `%errorlevel%`，会提前展开并把真实失败误报为退出码 0。
- 根 BAT 现固定为 ASCII + CRLF，改用标签分支传播真实退出码；失败窗口会停留供截图。PowerShell 启动器固定为 UTF-8 BOM + CRLF，并在 `-Prepare / -Verify / -Launch` 前校验 BAT 的 ASCII/CRLF 与脚本 BOM，格式不合格直接拒绝构建。构建指纹现同时覆盖 BAT、启动器和启动探针，避免“EXE 已更新、入口仍是旧版”。
- PowerShell 5.1 与 7 的 `Sort-Object` 文化排序会让同一批 142 个文件生成不同源码指纹；现改用 .NET ordinal 排序。`build-info.json`通过显式 UTF-8 读写，不再依赖宿主 PowerShell 的默认编码。两种 PowerShell 已得到相同指纹。
- 启动器新增 `-Launch`：校验 EXE/元数据，识别当前与旧文件名进程，检查 47633 单实例端口，启动后等待 3 秒确认存活并记录`.runtime-qa/current-acceptance-launch.log`。再次启动当前版本时会恢复已有窗口，而不是静默退出。Tauri 主程序启动完成后显式恢复、居中、显示并聚焦`main`窗口，收口旧显示器布局、后台或最小化造成的“进程存在但看不到窗口”。
- 验证证据：根 BAT 在系统 Windows PowerShell 5.1 下`--verify`返回 0；隔离首次启动 3 秒后进程存活，主窗口标题为“南枫知识库”、窗口句柄非 0、47633 归属同一 PID；第二次启动成功恢复已有窗口。还用正式库三个 SQLite 文件的只读临时副本稳定运行 10 秒，排除正式数据内容触发秒退；所有隔离进程和约 800 MB 临时副本均已清理。Codex没有启动正式库程序、没有写正式数据、没有调用AI。
- 当前唯一验收程序为`v150-startup-window-recovery`：`.runtime-qa/current-acceptance-app/release/nanfeng-knowledge-base.exe`，29,778,944 bytes，SHA-256=`56436311C04D9D7EC3FD5D9D09682E105029AB1552B56C4575A840C901CCFA57`，142文件源码指纹=`017F00E798585432E355737959388E9C33D26EEA2343E31C6A95638F7FB4479A`。交付入口仍是根目录`启动南枫知识库-当前验收.bat`；真实正式库窗口路径待南烛枫双击确认。

## v149 AI 手动暂停与单条归属确定性降级（2026-08-14）

- 南烛枫真实全库任务`ai-task-7447c811-b290-4788-8a10-f7d2c91a3361`的失败已做正式库只读核对：断点完整保留`893/893`份语义档案、`240/893`条主题归属、10个领域、36个主题，卡在来源ID 241；任务累计`1,473,361` tokens。最后3次单条归属均返回可解析、长度正常的JSON并记录`85/86/85` completion tokens，但没有形成合法唯一归属。百炼Chat Completions的`json_object`只保证JSON，不执行本地JSON Schema枚举，因此继续重发同一`topicKey`请求无法解决模型自创key、错ID或坏字段。
- `src-tauri/src/ai/client.rs`保留既有批量合法项和最小子集恢复；缩到单条后不再要求供应商回传`sourceItemId/topicKey`，改为只选择0起始的合法主题编号。本地根据编号确定性写入真实来源ID和真实topicKey，并统一复核编号范围、置信度、说明和`uncertain`。供应商仍负责语义判断，本地不做关键词硬归类；编号选择仍异常时继续沿用单条3次止损。新降级阶段使用独立`nanfeng_taxonomy_assignment_choice`缓存身份，稳定主题编号表可跨缺项复用，现有`nfkb-ai-execution-v1`断点无需迁移即可续跑。
- 主题管理的全库/增量分类进度弹窗新增协作式暂停：后端只接受当前活动任务的暂停信号，当前逻辑批次完成并保存checkpoint后不再发新请求；前端关闭进度弹窗并保留“继续上次生成”，重启应用后仍可发现断点。主题洞察的全主题批处理同样在当前主题完成或重试前暂停，剩余主题ID、已完成计数、强制重整模式和实际供应商/模型保存到按已应用分类修订隔离的本地恢复快照；返回页面或重启后显示“继续剩余 N 个主题”，已完成主题不重复生成。分类修订变化、主题删除或模型设置变化均不会把旧队列错误套到新任务。
- 自动验证：Rust 144项通过、1项真实Shell测试按设计忽略；前端217/217、TypeScript、Vite生产构建、Rust格式和`git diff --check`通过。新增覆盖单条编号本地映射/越界拒绝、活动任务暂停所有权、批处理在成功后暂停、重试前暂停、恢复快照分类修订隔离、冻结模型和累计结果合并。没有调用真实AI验证新降级请求，不能把自动合同写成来源241已经生成成功。
- 当前唯一验收程序为`v149-ai-pause-assignment-choice`：`.runtime-qa/current-acceptance-app/release/nanfeng-knowledge-base.exe`，29,777,920 bytes，SHA-256=`3065195EF4E9417EA70322AEB8D5A3737BA21CFB8A367DFFB95F6DA59E37220A`，139文件源码指纹=`2E582AD3B39144A15C6E3C0EBE48AF27715ACA13F2E350C2D92AD3BDBEF865E2`；固定共享缓存`--prepare / --verify`通过。构建未启动应用、未写正式库、未调用AI；正式库只执行了上述只读断点与账本查询。

## 全库 AI 分类不完整批次恢复（2026-08-14）

- 截图中的共同错误已定位：档案阶段固定把 24 条来源交给模型，旧客户端要求一次精确返回 24 条；千问偶发漏一条时，后端直接以“AI 笔记语义档案未完整覆盖本批来源”中断整批，没有补齐、缩批或自动重试。`24/893`继续到`264/893`后再次出现同错，符合不同批次随机漏项，而不是断点数据库损坏。
- `src-tauri/src/ai/client.rs`现统一恢复档案、归属和主题整合：保留唯一合法项，仅重试缺失/重复/无效子集；整批无有效项、JSON 破损或输出长度截断时二分；单条最多 3 次，仍不完整则停止并保留断点，避免无限计费。最终覆盖、顺序、topicKey 和非空内容门禁没有放宽。
- `src-tauri/src/commands.rs`将恢复过程中的每次供应商 usage 分别写入阶段账本并合并任务总量；失败前可取得的用量也随检查点保存。没有模型 usage 的网络/解析失败不会伪造 Token。
- Prompt Cache 请求合同升级为`nfkb-prompt-cache-v3`。OpenRouter继续使用含当前 ID/数量的严格 JSON Schema；千问/DeepSeek 的`json_object`不执行 JSON Schema，因此动态 ID 不再写进 system 前缀，精确覆盖交给本地恢复器，从而保持跨批次稳定前缀和 taxonomy 缓存命中。持久化结果字段、任务语义与模型路由未变，执行合同仍为`nfkb-ai-execution-v1`，现有中断任务可继续。
- 自动验证：Rust 142/142，1 项会真实打开资源管理器的 Shell 测试按设计忽略；恢复、二分、逐项解析、无效/重复清理、三次止损和缓存前缀定向合同通过；TypeScript通过。前端现为211/213，2项失败来自此前未提交的根`AGENTS.md`删去了现行入口名和视觉禁令，而合同测试仍要求这些长期规则；不是本轮 AI Rust 链路失败，本轮没有改该文件。
- 当前唯一验收程序已更新为`v148-ai-taxonomy-batch-recovery`：`.runtime-qa/current-acceptance-app/release/nanfeng-knowledge-base.exe`，29,720,064 bytes，SHA-256=`B651822FC4F32C6EE16E5117B47467243B76574001397F4E8E4F3BA8C3977906`，137文件源码指纹=`0FD85B8F5540F68476DB5E61C603A4D2658F8E35C2261090DC4B417806B7F986`；`--prepare / --verify`与根BAT `--path`通过。首次构建发现共享Cargo缓存的Tauri产物仍引用已移除的v142绝对路径，已只重建Tauri及三个插件的136.5MiB可再生产物，没有清空共享缓存。
- 安全边界：未读取或写入`D:\南枫知识库`，未调用真实 AI，未应用或撤销分类修订。893/901来源继续生成、真实用量与长任务稳定性仍需在新验收程序中由南烛枫明确授权后验证。

## Prompt Cache 后端合同与成本证据（2026-08-13）

- 风险收口已完成：migration v15新增`nfkb-ai-execution-v1`，任务、断点、主题洞察、来源档案与分类修订按执行契约隔离；旧结果为`legacy`只读历史，不参与当前续跑、增量或复用。启动恢复会把上次遗留`running`转为`interrupted`并保留分类断点，主题洞察后台线程异常也会落为失败任务。
- 正式v15已执行：迁移前备份`D:\南枫知识库\backups\AI执行契约 migration v15前备份_20260813-151531-161.db`，794,820,608 bytes，SHA-256=`9428e930bfcd7d7298f5c6d0526eace74ee14f8254a8e5643b722f23d6d19a7d`；schema`1–14 → 1–15`，293行历史契约回填，1条旧运行任务安全中断，完整性`ok`、外键0、重开幂等通过。回执为`D:\南枫知识库\logs\formal-ai-execution-contract-migration-v15-20260813-151556-291.json`。
- 2条真实来源的完整分类链路已通过：任务`ai-task-taxonomy-e2e-acceptance-dceb172e-aa6e-4049-a9d2-6158a5b6221d`依次使用`qwen3.7-flash / qwen3.7-plus / qwen3.7-flash / qwen3.7-plus`完成档案、结构、归属、整合，产生1领域、1主题、2归属、1完整整合和4条阶段账本；只保存用量，不保存输出正文、来源档案或分类修订。回执为`D:\南枫知识库\logs\formal-taxonomy-e2e-acceptance-20260813-151803-389.json`。
- 正式复核：226任务、12阶段账本、1个当前执行契约验收任务、225个legacy任务、1个已中断历史任务、0个running；895记录、901来源、68主题、0来源档案版本、0分类修订保持不变，WAL 0。千问未返回美元价，设置页现显示“成本/缓存节省不可核算”及未知数量，不再显示伪`$0.0000`。
- 当前唯一Windows验收程序为v147：`.runtime-qa/current-acceptance-app/release/nanfeng-knowledge-base.exe`，29,633,024 bytes，SHA-256=`E5C96CEA77789609139B8BE31BD0E7DBCECB5B10224C248980C6BF935D33D469`。元数据记录137文件源码指纹`FA6771CA625940ACE64002186F59796E6554B5E247DE72A276C43628BBA37FBC`、Git HEAD/分支/dirty；BAT启动前执行完整校验并清空数据目录覆盖变量。Codex没有启动该程序。
- 自动验证：Rust 135/135（1项真实Shell测试按设计忽略）、前端213/213、TypeScript、examples编译、格式与diff检查、正式迁移前后只读预检和v147`--verify`通过。未执行901来源全库生成或应用修订；规模质量与真实WebView2观感仍须单独验收。

- `src-tauri/src/ai/prompt_cache.rs`成为 Prompt 稳定前缀、缓存键和供应商请求结构的唯一所有者。固定指令、JSON Schema 与可复用 taxonomy 位于动态批次之前；缓存键只保存 SHA-256，不含标题、正文、用户标识或 Key。`assignments`将 taxonomy 拆为稳定块，当前40条画像批次保持动态；主题洞察共享固定 system/Schema。短前缀不为达到门槛填充无业务价值内容。
- DeepSeek直连继续使用自动 Context Cache；千问官方显式缓存最低为1024 Token，本地估算为避免分词误差仅在达到1536时加入`cache_control: ephemeral`，否则保守使用隐式缓存。千问显式缓存的稳定块必须是独立消息，动态提问位于下一条消息；实测把两者放在同一消息的相邻内容块会反复写缓存而不命中。OpenRouter设置稳定`session_id / prompt_cache_key`，Anthropic长前缀按2048保守阈值使用显式缓存。未启用 OpenRouter 整响应缓存，强制重新生成仍会生成新输出，本地完成结果与断点仍先于 Provider Prompt Cache。
- migration v14只扩展`ai_task_model_steps`逐阶段账本，记录缓存读、未命中、缓存写、模式、不可逆哈希、Prompt合同版本、请求时长、折扣、成本来源与价格快照；不保存原始Prompt。设置页用量摘要增加缓存读取Token。2026-08-13已按南烛枫明确授权应用到正式`D:\南枫知识库`：schema版本`1–13 → 1–14`，13个字段齐全，记录`895→895`、来源`901→901`、taxonomy修订`0→0`，完整性`ok`、外键0、重开幂等通过。
- DeepSeek价格不再永久固定为单一常量：请求时按`2026-08-16T16:00:00Z`生效点及UTC峰谷时段生成价格快照；OpenRouter模型目录接入缓存读/写价格字段，实际返回成本仍优先于估算。
- 隔离真实API已验证：DeepSeek V4 Flash三轮分别为`0 / 7040 / 7040`命中Token，热请求前缀命中率`98.52%`，成功三轮估算成本`$0.001079624`，相对无缓存基线节省`$0.001931776（64.15%）`；千问3.7 Flash修正消息边界后三轮为首轮写入`7107`、后两轮各命中`7107`，热请求前缀命中率`99.54%`。千问响应不返回美元成本，当前本地目录也没有其价格快照，因此只确认Token复用，不伪造金额。两家直连金丝雀均关闭默认思考。
- OpenRouter经南烛枫继续授权后显式冻结仅供测试的`anthropic/claude-haiku-4.5`，没有读取或改写正式设置。三轮为首轮写入`12532`、后两轮各命中`12532`，热请求前缀命中率`99.79%`；实际成本`$0.015761 + $0.0013492 + $0.0013492 = $0.0184594`，相对同模型无缓存三轮基线`$0.037884`节省`$0.0194246（51.27%）`。耗时`6410 / 1864 / 2556ms`仅作三次样本的方向证据，不作为稳定延迟承诺。未启用OpenRouter整响应缓存。
- 正式小批真实业务验收已完成：读取2条长度受控的可见来源和当前正式68主题，按正式设置`qwen_direct / qwen3.7-plus`解析并冻结批量模型为`qwen3.7-flash`；两条临时语义档案和两轮归属只把usage写入专用任务`ai-task-prompt-cache-acceptance-89b52257-c6aa-427c-b72f-1e0a9a7de597`，不保存模型正文、档案或归属，不生成/应用taxonomy修订。归属首轮写入`4119`、第二轮命中`4119`，第二轮稳定前缀命中率`98.66%`；两轮稳定前缀哈希、缓存键完全一致，正式逐阶段账本4/4与供应商usage一致。来源、主题和修订计数保持不变，复核后WAL为0。
- 价值边界：千问没有返回美元成本，本地目录也没有价格快照，因此正式任务只核算Token，不伪造金额。按官方显式缓存写入125%、读取10%的规则，本次两轮归属输入相对无缓存约节省32.11%；单看第二轮热请求输入约节省88.79%。正式任务同时暴露千问Flash默认思考：四轮reasoning分别`1017 / 1377 / 1914 / 2269`，Prompt Cache只降低输入成本，不降低这部分输出推理成本。
- 千问批量阶段现由`ai/client.rs`唯一应用推理策略：`source_profiles / taxonomy_assignments`使用顶层`enable_thinking:false`，`taxonomy_structure / topic_integrations / topic_insight`保持供应商默认思考；页面、设置和模型路由不取得该策略所有权。请求合同升级为`nfkb-prompt-cache-v2`，推理模式进入缓存键身份，避免不同推理语义共用同一审计键。合成金丝雀中档案与归属均完整返回且reasoning为0。
- 2026-08-13正式小批思考开/关A/B已完成：同2条正式来源、同68主题、同`qwen3.7-flash`分别运行档案和归属。概念集合、候选主题集合、最终主题归属均`2/2`一致，待核对状态`2/2`一致，置信度平均绝对差为0；两种模式摘要均非空。思考开启共`3905` reasoning、`4177` completion、`36165ms`，关闭后为`0` reasoning、`293` completion、`2816ms`，completion减少`3884（92.99%）`、样本总耗时减少`33349ms（92.21%）`。关闭思考的归属请求同时命中`4119`缓存Token，因此归属耗时差不能全部归因于推理策略；无显式缓存的档案阶段仍从`17275ms`降至`1227ms`。该2条样本支持在高频强Schema阶段默认关闭思考，但不等于全库长期质量结论。
- 可恢复证据：迁移前SQLite Online Backup为`D:\南枫知识库\backups\Prompt Cache migration v14前备份_20260813-141411-215.db`，794,820,608 bytes，SHA-256=`352ceb480d238a26a8b3c27343024384f7708af0274d614e2b319a7cdd994764`；迁移回执`D:\南枫知识库\logs\formal-prompt-cache-migration-v14-20260813-141436-356.json`，业务验收回执`D:\南枫知识库\logs\formal-prompt-cache-business-acceptance-20260813-141622-472.json`，思考策略A/B回执`D:\南枫知识库\logs\formal-qwen-reasoning-ab-20260813-143854-290.json`。
- 验证边界：正式Prompt Cache验收与思考策略A/B各新增1条已完成专用任务和4条usage步骤；正式库当前任务`225`、阶段账本`8`。两轮均没有保存模型正文、档案或归属，没有改写原始资料、人工判断、主题、正式分类修订或界面设置；来源`901`、主题`68`、分类修订`0`保持不变，完整性`ok`、外键0、WAL 0。千问仍未返回美元成本，不能把Token下降写成已确认金额；未生成Windows验收程序。第一次DeepSeek探索轮仍有一条未返回用量但可能计费的历史请求，不能把成功金丝雀金额冒充全部历史账单。
- 自动验证为Rust全量129项通过、1项真实Shell测试忽略，全部examples编译通过，前端此前全量213/213、TypeScript、Vite与Release check通过；缓存金丝雀位于`src-tauri/examples/prompt_cache_canary.rs`，推理策略金丝雀位于`src-tauri/examples/qwen_reasoning_policy_canary.rs`。实施契约：`plans/prompt-cache-implementation-20260813.md`。
- v146仅保留为推理策略阶段历史证据；现行入口、EXE身份和验证结果以本节顶部v147条目为准，不得再启动或交付v146。

## v145.1 暗色皮肤语义材质合同（2026-08-13）

- 南烛枫以多轮真实截图确认，根因不是零散白卡，而是暗色模式同时有页面私有浅色材质、实体皮肤旧蓝灰常量和 Portal 样式各自抢所有权。现已在`src/styles.css`文件末尾建立唯一暗色语义材质总线：所有组件只消费`panel / raised / input / input-focus / subtle / selected / border / text`角色；五套皮肤分别提供这些角色的色相。暗色不再把全部皮肤压成纯黑，也不会让红棕、金棕皮肤回退为蓝灰。
- 重点修复：红棕实体皮肤的列表面板、内容面和输入面均由暖陶令牌派生；搜索行恢复为透明布局容器，只有圆角搜索框和筛选按钮承担材质；空状态、搜索历史、组合筛选、来源消息卡、Markdown、附件、Portal 和图标底板统一消费当前皮肤暗色面与亮色文字。亮色分支没有变更。
- 新增浏览器回归`tests/e2e/dark-material-contract.spec.ts`：三套实体皮肤逐一实算共享列表/搜索控件颜色，锁定雾蓝、墨绿、红棕不可串色；同时构造并验证空状态、搜索历史和消息卡无浅底。静态合同同步禁止`#20343a`旧蓝灰回写到实体皮肤的`classic-nested-surface`。
- 已验证：定向 Chrome Playwright 4/4、TypeScript、前端单元测试（`npm run test`）和生产 Tauri 构建通过，`git diff --check`通过。已在固定`current-acceptance-build`缓存中原位完成`--prepare / --verify`；唯一当前EXE为`.runtime-qa/current-acceptance-app/release/nanfeng-knowledge-base.exe`，29,610,496 bytes，SHA-256=`F3AD180273FB3B8C70FF3A2F9D62362B6F5F4297324592F796A67384F3C01CD5`。未启动应用、未读取或写入正式SQLite、附件与真实AI；真实WebView2观感待南烛枫验收。

- 基于 v144 的五入口双卡几何新增独立`light / dark`外观偏好；设置页增加唯一`暗色皮肤`开关，五套既有皮肤仍由`knowledgeSkins.ts`统一持有。切换只替换颜色与材质令牌，不改变`主题洞察 / 全部笔记 / 主题管理 / 我的收藏 / 持续跟踪`的导航、栏位、卡片、搜索框、滚动或业务交互。
- 三套实体工作台在暗色下使用对应的雾蓝、鼠尾草、暖陶深色承托与深色实体前景；花房、奔马继续显示原场景背景和外层玻璃，内部中性阅读卡改为不透明深色实体面。暗色花房主导航、辅助导航、计数、底部容量、刷新及正文文字均已提亮；用户确认的原始问题图归档为`docs/screenshots/skin-previews/dark-mode-navigation-contrast-reference-20260813.png`，SHA-256=`35013E0BB82081F11479E21073AEFE6FDD9A558A2D7818759C9A901F72491A89`。
- 根级`--dark-skin-*`现在是唯一皮肤派生层：`panel / raised / input / input-focus / subtle / selected / border / accent`分别由雾蓝、鼠尾草、暖陶、花房、奔马定义；`--dark-control-*`、列表、设置、正文消息、侧栏、弹窗、滑块、皮肤缩略预览和选中态只能消费该层，禁止再写花房绿、暖橙或浅色卡的固定值。暗色的主、辅助、三级文字也统一为亮色语义令牌。
- 追加修复了真实WebView2反馈中遗留的浅色材质：所有Portal二级弹窗及其内层摘要/操作/统计/键帽/输入/选择器、模型选择、回收站动作、待分类空态、来源正文、Markdown引用与代码块现在统一消费深色语义表面和亮色文字；全局输入选区不再使用浏览器默认黑底。设置入口的图标底板改为当前皮肤深输入层，SVG使用同一皮肤强调色。问题参考图已归档为`docs/screenshots/skin-previews/dark-mode-markdown-light-block-reference-20260813.png`、`dark-mode-settings-icon-light-tile-reference-20260813.png`与`dark-mode-input-selection-reference-20260813.png`；本轮定向Chrome回归1/1和既有五皮肤亮暗几何契约1/1通过，TypeScript通过。已原位更新唯一当前验收程序：`.runtime-qa/current-acceptance-app/release/nanfeng-knowledge-base.exe`，29,609,984 bytes，SHA-256=`93C8B49951997A344FB350AF3D515BB1BBAA78CD0CED8472FA412BD8DA90B607`；未启动程序、未读取或写入正式SQLite、附件与真实AI，真实WebView2最终观感仍待南烛枫确认。
- 已验证：TypeScript 与1702×1066隔离Chrome Playwright 1/1通过。测试逐一重载五套暗色皮肤并核验其`panel / raised / selected / accent`，核验陶土已选皮肤卡与缩略图均为陶土深色而非白卡，花房的卡片、弹窗、文字与侧栏几何保持不变；证据为`.runtime-qa/knowledge-final-layout-evidence/dark-terracotta-settings-token-contract-1702x1066.png`。已在固定`current-acceptance-build`共享缓存中原位完成v145 `--prepare / --verify`，唯一当前程序为`.runtime-qa/current-acceptance-app/release/nanfeng-knowledge-base.exe`，29,609,472 bytes，SHA-256=`88B8C8B9CE420E289D0F6C4D90AFEAD7A2A3C6D615C146552EE3A5186248A87A`；未启动应用、未读取或写入正式SQLite、附件与真实AI。真实WebView2观感仍待南烛枫人工确认。

## v144 五入口双卡工作区几何统一（2026-08-13）

- `主题洞察 / 全部笔记 / 主题管理 / 我的收藏 / 持续跟踪`现共用显式`core-workspace-grid / core-workspace-card-two / core-workspace-card-three`结构角色。桌面标准视口沿用全部笔记的卡二规格：24%宽度、14px卡间距、24px/28px/34px页面外边距；卡三统一消费其余空间，两张主卡等高、四边对齐并保持14px圆角。入口切换不再由各页私有`clamp`、固定像素列宽或不同页面内边距推动卡片跳动。
- 五入口卡二搜索框统一纵向位置和45px自身高度。主题洞察与主题管理原先分散在卡二外的搜索、筛选、AI操作、状态说明和主题层级已经收进同一张卡二承托面；只统一几何与承托，不改变功能、列表/树内容、卡三业务结构、滚动职责和五套皮肤材质。
- 新增五入口逐页矩形回归：从主题管理依次切换主题洞察、全部笔记、我的收藏、持续跟踪，逐值比较卡二/卡三的`left/top/right/bottom/width/height`以及搜索框`top/height`；同时继续跑五套皮肤、四知识状态与横向溢出检查。此前决策版本内容在卡三加宽后暴露内在最小宽度，已在内容自身用`min-width:0 / width:100% / max-width:100%`收口，没有用隐藏溢出来掩盖问题。
- 已验证：前端全量210/210、TypeScript、`git diff --check`、Vite生产构建、1702×1066五入口/五皮肤定向Playwright 1/1通过；主题管理可见样图为`.runtime-qa/knowledge-final-layout-evidence/topic-management-compact-toolbar-1702x1066.png`。南烛枫关闭v143后，已在固定`current-acceptance-build`共享缓存中原位完成v144 `--prepare / --verify`，根目录BAT `--path`与元数据一致；唯一当前EXE为29,605,376 bytes，SHA-256=`DF4791BE6889656FFCB6B25126468EF7C9D05C34FAEC6663C8E0CEE34085AE66`。未新增版本化构建缓存、未启动程序；正式SQLite、真实附件和真实AI未读取或调用，真实WebView2五入口切换待南烛枫验收。

## v143 文档全屏预览与历史资料返回层级（2026-08-13）

- PDF、Markdown、TXT等已支持软件内最高层阅读的正文附件，不再把文件名显示成操作按钮；现在与视频大预览入口共用`MonitorPlay + 全屏预览`语义，点击继续进入既有`AttachmentPreview`。文件名仍保留在原位预览内容与最高层预览标题中。
- 视频保持`全屏预览并播放视频`无障碍语义；音频仍只有原位原生播放与`定位文件`；不支持软件内预览的普通文件/归档继续显示文件名入口。附件存储、定位、解码、预览器布局与数据链路均未改。
- 全部附件、图片、视频、音频与文件时间线不再在点击资料卡时先行关闭。点击仍原样执行`setSelectedId(hit.sourceItemId)`让卡三后台同步定位所属笔记，再在时间线之上打开最高层附件预览；关闭预览返回原分类、搜索词、已展开批次、滚动位置和触发卡焦点。预览存在时，时间线暂停自己的`Escape`关闭监听，保证一次按键只退一层；再次明确关闭时间线后才显示已定位笔记。
- 前端全量210/210、定向合同19/19、TypeScript、Vite生产构建与固定共享Cargo缓存中的v143 Tauri编译通过；南烛枫关闭旧程序后，已在固定`current-acceptance-build`缓存中原位完成`--prepare / --verify`，唯一当前应用为`.runtime-qa/current-acceptance-app/release/nanfeng-knowledge-base.exe`，29,603,328 bytes，SHA-256=`3C8166F362A3BB042DB77FA748482E8B6353A57F14ECBAFB0B6FCE4096F328F4`，根目录BAT `--path`与`build-info.json`一致。未新增版本化构建缓存，未启动应用、未读取正式SQLite、未调用真实AI或外部网络；真实附件返回层级待当前WebView2验收。

## 验收构建缓存止增治理（2026-08-13）

- 南烛枫确认先治理源头、不迁移到 E 盘。本机验收缓存继续位于项目 `.runtime-qa`；`scripts/launch-current-acceptance.ps1` 现只使用固定 `current-acceptance-build` 共享 Cargo 目标目录与固定 `current-acceptance-app` 程序目录，不再把版本号写入构建目录名。版本仍由构建标签、Git 提交、EXE SHA-256、测试结果和截图证据定位。
- 已将未运行的 `current-acceptance-v142-build` 原地改为 `current-acceptance-build`，保留 1.93GB 可复用缓存；已复制同一 v142 EXE 到固定当前程序目录并生成 `build-info.json`。已在南烛枫确认后删除 57 个精确匹配的历史 `current-acceptance-v*-(app|build)` 目录，预审可回收 57.8GB；正在运行的 `current-acceptance-v141-app` 自动排除，未移动或替换。
- 当前根目录 BAT 改为固定当前程序路径，并在已有南枫知识库窗口运行时拒绝再启动第二个实例。`scripts/cleanup-acceptance-artifacts.ps1` 改为默认预演：只列出精确匹配 `current-acceptance-v*-(app|build)` 的历史候选，排除运行中的应用、新固定缓存、当前程序、布局证据和构建日志；只有显式 `-Apply` 才尝试删除。不得在未复核候选清单并取得南烛枫“确认清理”前执行该参数。
- 已验证：两个 PowerShell 脚本语法通过；`launch-current-acceptance.ps1 -Verify` 与当前 BAT `--path` 均指向固定 v142 EXE，大小 29,604,864 bytes、SHA-256 `8AD1F9308E22B0AE1E03F44816B675783136E65E366C1CF95D01B3E97DB64BCD`；清理脚本预演确认正在运行的 v141 应用不在可删列表。未执行 `--prepare`、未启动新 EXE、未打开或写入正式 SQLite、未调用真实 AI。
- 清理后 `.runtime-qa` 为 2.04GB，C 盘可用空间为 87.43GB；固定缓存与当前应用仍可通过 `--verify`，当前 BAT `--path` 仍指向固定 v142 EXE。本轮曾开始但随南烛枫取消迁移而中止的 `E:\CodexData\NanfengKnowledgeBase` 不完整复制目录已删除。未执行 `--prepare`、未启动新 EXE、未打开或写入正式 SQLite、未调用真实 AI。实施计划见 `plans/2026-08-13-nanfeng-qa-artifact-retention-v1.md`。

## v142 实体画布铺满与设置卡底层收口（2026-08-13）

- 三套实体皮肤的应用画布与`.main-region`现在共同消费唯一`--entity-canvas`实体承托色，主题洞察、全部笔记、主题管理、收藏、跟踪、回收站和设置不再露出另一层外底，也不再呈现一张悬浮的大圆角灰底卡；两套场景玻璃未改。
- 设置页同级设置卡已统一：`AI 自动整理`接入纯白`--settings-item-surface`，数据与存储、快捷键和当前程序继续使用纯白实体卡；`.settings-list`只负责排列和间距，不再套额外白色底板；路径与`查看全部`文字动作区恢复透明，不再误用搜索/缩略图的灰色渐变控件面。
- 三套实体皮肤侧栏底部容量信息不再继承固定雾蓝字色：说明统一为82%中性白，数值与刷新图标为纯白；两套场景皮肤侧栏未改。
- 保持不变：五个主要入口、全部笔记单一大内容卡、主题管理卡二/卡三、900px设置列、卡片圆角/尺寸/间距、点击范围、微交互、语义色与正式数据/AI链路。
- 当前验证：前端全量209/209、定向合同63/63、TypeScript、Vite生产构建和1702×1066五皮肤核心Playwright 1/1通过。Playwright实算三套实体在主题洞察与设置页的应用画布/主区域`backgroundColor + backgroundImage`完全一致且无背景图，AI入口与设置项均为`rgb(255,255,255)`，卡内文字动作区为透明，侧栏容量说明为`rgba(255,255,255,.82)`、数值为`rgb(255,255,255)`；三套设置页证据位于`.runtime-qa/knowledge-final-layout-evidence/entity-*-settings.png`。Windows v142唯一当前隔离应用已完成`--prepare / --verify`，路径`.runtime-qa/current-acceptance-app/release/nanfeng-knowledge-base.exe`，29,604,864 bytes，SHA-256=`935895F516509FD03EA639A827837A7D6F916DD8FE84CD4E6919E02813723134`；根目录BAT的`--path`指向该单一当前应用。应用未启动、正式SQLite和真实AI未执行，真实WebView2观感待南烛枫从当前BAT确认。

## v141 五套皮肤、纯白前景与模型入口收口（2026-08-13）

- 南烛枫确认皮肤目录为`实体工作台 · 雾蓝 / 实体工作台 · 鼠尾草 / 实体工作台 · 暖陶 / 场景玻璃 · 花房 / 场景玻璃 · 奔马`。前三套没有背景素材和玻璃模糊，后两套继续使用清晰场景背景与苹果式浅玻璃。`沙漠灯笼 / 原版浅色`退出目录，旧本地偏好统一迁移到雾蓝。
- 01/02/03预览只作为 D 色彩与材质参考，不取得页面结构所有权。全部笔记继续保留当前单一大内容卡，主题管理继续使用当前最新卡二/卡三，侧栏激活项几何与交互不变；没有恢复预览里的右侧小卡、旧复杂卡或苹果皮肤布局。
- 新增明确`entity / scene`材质身份，消除旧代码“非 classic 都是场景玻璃”的错误假设。五套皮肤共享同一App与页面DOM，只按材质身份消费实体或场景Token。
- 五套皮肤的普通最前景列表卡、内容卡、详情卡、判断卡与卡内中性白卡统一为完全不透明`#fff`；全部笔记卡二普通列表项已纳入共享规则。外层承托板继续保持各实体配色或场景玻璃，选中态与明确语义状态卡不漂白。
- 主题洞察标题区模型选择已移除。设置页成为唯一模型配置层，单主题/批量洞察直接使用后端固定任务路由；主题管理既有无模型入口合同不变。
- 当前验证：前端全量208/208、TypeScript、Vite生产构建与1702×1066三入口/五皮肤Playwright 1/1通过；E2E实算全部笔记卡二普通项和卡三正文表面均为`rgb(255, 255, 255)`，三套实体主工作区`backdrop-filter:none`，两套场景才消费玻璃模糊，主题洞察无模型选择入口。三套真实页面预览位于`docs/screenshots/skin-previews/implemented-v141/`。v141 Windows Tauri隔离应用完成`--prepare / --verify`，路径`.runtime-qa/current-acceptance-v141-app/release/nanfeng-knowledge-base.exe`，29,604,864 bytes，SHA-256=`F4841A7C06AF0EB10746E121F0FBCD454C290F5CE08DEA953401C4183BDBA94B`；根目录BAT的`--path`已确认只指向v141。未启动应用、未调用真实AI、未打开或写入正式知识库；真实WebView2观感仍待南烛枫人工验收。

更新时间：2026-08-12

仓库：`C:\Users\Administrator\Documents\软件开发\nanfeng-intelligence`

分支：`codex/nanfeng-ai-automation-mvp-20260810`

本轮 AI 开发前保护 checkpoint：`30045e9e9a133802ea0a471baa8dd50370d84f45`

历史冷启动 checkpoint：`f8ff4ab`（仅作追溯，不是当前基线）

> 这是下一轮开发者的动态事实入口。稳定规则看`AGENTS.md`，需求推导看`docs/core-workspace-requirements-traceability.md`，验收分层看`docs/core-workspace-acceptance-matrix.md`。
>
> 当前读取规则：以“当前结论、验证真相、唯一下一步”为动态权威；1–110号记录是按时间保留的历史证据，其中旧入口名、旧 BAT、旧隔离包和旧版本号均不得覆盖现行合同。现行用户可见名称只使用`主题洞察 / 全部笔记 / 主题管理`，内部兼容标识不改名。
>
> 其他项目需要“参考南枫知识库的开发文档”时，统一从`docs/design-system.md`进入；本交接只提供当前实现与验证状态，不是跨项目规则正文。

> v140 全通道固定 AI 任务路由：南烛枫授权由系统按任务合理分配模型。设置页将“模型”明确为`任务路由基准`，后端成为唯一路线所有者：千问固定`Flash → Plus`，明确选 Max 才让主题洞察使用高难档；DeepSeek固定`V4 Flash → V4 Pro`，Pro承担跨文档整合和洞察；OpenRouter只在已选供应商家族内寻找轻量档（Flash/Mini/Haiku/Fast/Luna/Small）与均衡档（Terra/Sonnet/Plus/Pro/Medium），明确选 Sol/Opus/Max/Ultra 才在主题洞察用高难档。目录缺档保守沿用基准，绝不跨供应商自动替换。新增迁移v13：分类检查点保存`profile_model_id`，创建任务即冻结实际逐篇/跨文档模型，续跑和增量不再依赖当前设置或目录；历史断点保守沿用其旧分类模型。根级通用规范已固化为`docs/app-development/ai-task-routing-standard.md`并由根`AGENTS.md`路由。自动验证：前端208/208、TypeScript、Rust119/119（1项真实Shell测试显式忽略）、`git diff --check`与v140隔离`--prepare / --verify`通过。当前验收程序为`.runtime-qa/current-acceptance-v140-app/release/nanfeng-knowledge-base.exe`，38,901,760 bytes，SHA-256=`CD35BE08F2311C46F2B2814167999512EBF459D3094C87649298FBE762492BFC`；根目录 BAT 已指向 v140。未启动应用、未打开或写入正式SQLite、未调用真实AI；正式数据库迁移v13与真实 API/真实 WebView2仍由南烛枫人工验收。

> v139 主题管理模型入口收口：南烛枫确认主题管理中的模型选择与设置页重复，且层级不如设置页。现已从`TopicStructureReadingWorkspace`删除模型标签、触发器、二级模型弹窗及全部临时选择 props；筛选行只保留等宽36px的`全部 / 待处理`。更重要的是，主题管理的全量、增量、应用/撤销后的草稿刷新均不再接收主题洞察的会话模型选择，统一交给后端使用设置页保存的通道与模型；已中断任务继续时保持断点记录的实际模型。主题洞察的会话模型选择与设置页大尺寸模型弹窗保留不变。定向合同7/7、TypeScript、Vite、`git diff --check`及1702×1066 Playwright样板均通过；样板实测主题管理无模型触发器且仅有两个34–38px筛选按钮。v139隔离`--prepare / --verify`通过，程序为`.runtime-qa/current-acceptance-v139-app/release/nanfeng-knowledge-base.exe`，38,875,648 bytes，SHA-256=`8A5D2DCF7C3FBF3E3C5BE5FA031BE1949B3A9B70F0798A0119BE079D37152350`；根目录BAT已指向v139。未启动v139、未打开或写入正式SQLite、未调用真实AI；v138仍由南烛枫运行，须先关闭它再双击当前BAT完成真实WebView2验证。

> v138 千问直连与任务模型路由：新增独立`qwen_direct`通道，API Key仍只保存于 Windows 凭据库，设置与两处工作台均复用既有模型卡片选择器。千问目录不调用不保证支持的通用`GET /models`，而是直接呈现已核对的`qwen3.7-flash / qwen3.7-plus / qwen3.8-max-preview`；首次真实请求才验证 Key、地区和账户模型权限。全库整理按阶段固定：`profiles / assignments`用 Flash，`structure / integrations`用 Plus；单主题洞察默认 Plus，只有用户明确选择 Qwen3.8 Max（预览）才启用高难档。DeepSeek V4 Pro同样只能由用户明确选择，绝不自动跨通道回退或消耗高阶额度。迁移 v12 仅新增千问通道设置行与`ai_task_model_steps`阶段审计表；未打开正式数据库、未执行该迁移、未调用真实 AI。TypeScript、定向前端 Qwen 合同、Rust AI 13/13、Vite、`git diff --check`、v138隔离生成/校验均通过。前端全量有1项既有 Explorer 源码字符串断言失败，和本轮无关。当前验收程序为`.runtime-qa/current-acceptance-v138-app/release/nanfeng-knowledge-base.exe`，38,875,648 bytes，SHA-256=`61311262EE9559D0BA086A1FF4AD4D37F3771288B93EE535FF99EE3C1895B4CA`；根目录`启动南枫知识库-当前验收.bat`只启动它。南烛枫手动启动 v138 时才会对正式 SQLite 应用这项新增 schema migration；应先确认该正式数据写入边界。

> v137 验收 BAT 误报收口：根目录 BAT 原来使用`-ExecutionPolicy Bypass`且隐藏 PowerShell 窗口，这一组合容易触发终端防护的行为式误报。现 BAT 只以可见、固定路径启动已构建的 v137 EXE；不再调用 PowerShell、不绕过策略、不隐藏窗口、不编译、不删除环境变量，批处理注释也只保留ASCII以避免`cmd.exe`代码页误解析。隔离构建/哈希校验仍由`launch-current-acceptance.ps1 -Prepare / -Verify`执行，且该脚本拒绝无参数启动应用。当前 EXE 的 Authenticode 状态是`NotSigned`；长期正式交付仍应使用受信任代码签名的安装包，本地透明 BAT只能降低误报，不能替代签名信誉。

> v137 火绒企业版误报排查与签名门槛：Security Center 显示实际防护为`Huorong Enterprise Security Endpoint Daemon`，Defender处于未启用状态；火绒可读日志未留下本次BAT的规则名称或文件路径，因此具体规则未确证。只读证据确认当前EXE为`NotSigned`，当前用户和本机均没有带私钥的代码签名证书；Windows SDK的`signtool.exe`已存在。新增`scripts/sign-windows-artifact.ps1`：默认只验签，签名必须显式提供受信任代码签名证书指纹、HTTPS时间戳URL和输入文件；脚本拒绝自签名/无私钥/非代码签名用途证书，签后强制`signtool verify /pa /all`及`Get-AuthenticodeSignature=Valid`，最后输出SHA-256。证书采购、导入和实际签名均未执行，且需要南烛枫明确授权。

> v137 主题管理工具栏密度平衡：南烛枫指出 v136 修复竖排后反向放大了模型、筛选与AI操作按钮，而搜索框又在实际 WebView2 中被压成过薄条。现把主题管理工具栏定为明确的紧凑基线：搜索、模型触发器、`全部 / 待处理`均为36px；AI 两个动作维持38px以承载图标和长操作语义；模型触发器的能力副标题在这个窄栏隐藏，完整能力说明只在独立模型弹窗呈现。模型标签不再有额外外框，只有真正可点击的模型选择框。1702×1066样板同时实测搜索和模型触发器均为36px。TypeScript、前端206/206、Vite生产构建、`git diff --check`、主题管理样板与v137隔离`--prepare / --verify`均通过。当前验收程序为`.runtime-qa/current-acceptance-v137-app/release/nanfeng-knowledge-base.exe`，38,840,320 bytes，SHA-256=`E053E7F2396825EB457E9E938C5679D8E0F4B221D1126CB5F2BC929B0DCE6DC8`。未启动应用、未访问正式数据或真实AI；真实 WebView2 待南烛枫从当前 BAT 验收。

> v136 模型选择布局回归修复：南烛枫真实 WebView2 截图确认 v135 有两个不可接受的低级布局错误：模型列表容器默认`stretch`把两项模型拉成半屏大卡；主题管理把模型触发器塞进三等分筛选格，致使文字竖排。现模型列表只按内容高度排列，模型卡固定68px紧凑行，只有累计内容超过560px时列表才滚动；模型弹窗改为内容自适应、最大760px，不再无模型数量依据占满高度。主题管理的模型选择独占第一行，`全部 / 待处理`保留下一行双列；触发器必须有足够单行宽度，禁止文字折成竖排。静态合同和1702×1066四模型 Playwright样板同时锁定卡高64–88px与主题管理触发器宽度大于180px、高度不超过48px。TypeScript、前端206/206、Vite生产构建、`git diff --check`、1702×1066主题管理四模型样板与v136隔离`--prepare / --verify`均通过。当前验收程序为`.runtime-qa/current-acceptance-v136-app/release/nanfeng-knowledge-base.exe`，38,840,320 bytes，SHA-256=`5F34C2A653561BB924002A8C3E86B14DBA1676E3DF428537759ECEFC49239E45`。未启动应用、未访问正式数据库或真实AI；真实 WebView2 待南烛枫从当前 BAT 验收。

> v135 大尺寸 AI 设置与共享模型选择：南烛枫明确 AI 自动整理主设置要在1702×1066下默认约`1366×872`，模型选择必须作为第二层独立弹窗，不能挤占设置窗口；主题洞察与主题管理也要遵循同一标准。现新增唯一`AiModelPicker`：`AiAutomationSettings`、`KnowledgeReadingWorkspace`与`TopicStructureReadingWorkspace`均复用其触发器、供应商色条、型号、保守能力定位、选中态、外部点击关闭与 Escape 行为。主设置的旧尺寸偏好升级为`ai-automation-dialog-v2`，避免旧窗口大小覆盖新的基线；模型弹窗默认`840×760`并在选项较多时仅列表滚动，主设置保持可见，连续两次 Escape 依次关闭模型层和设置层。自动验证：前端206/206、TypeScript、Vite生产构建、`git diff --check`、1702×1066主设置分层对话框 Playwright样板与主题管理四模型样板、v135隔离`--prepare / --verify`均通过。当前验收程序为`.runtime-qa/current-acceptance-v135-app/release/nanfeng-knowledge-base.exe`，38,840,320 bytes，SHA-256=`43D37C8D62A159871F99E0E6D1DE3EEDA7404F2BA427413CBC88D2BAF4FA770A`。未启动v135、未打开或写入`D:\南枫知识库`、未调用真实AI；真实 WebView2 的非空模型目录、保存选择仍待南烛枫从当前 BAT 验收。

> v119 当前覆盖说明：南烛枫真实桌面反馈显示 v117 的所有“定位文件”统一报“Windows 文件管理器无法识别要定位的文件”。根因有两层：v117 把目标文件 PIDL 误作文件夹并传空选择列表；更关键的是，正式附件经安全 `canonicalize` 后成为 `\\?\` 长路径，Windows Shell 的 `ILCreateFromPathW` 不接受该路径形式。现唯一服务先保持原始受控路径校验，再仅为 Shell 移除 `\\?\` 或 `\\?\UNC\` 前缀；随后以“父目录 PIDL + 目标文件绝对 PIDL 选择列表”调用 `SHOpenFolderAndSelectItems`。附件正文、最高层预览、全部/图片/视频/音频/文件时间线与两处单篇导出均自动复用该服务。Rust 110/110（另1项真实打开测试默认忽略）、前端198/198、TypeScript、v119 隔离 `--prepare / --verify` 通过。EXE 38,735,872 bytes，SHA-256=`FD5398E24F125DA566FCE8AE5CC5B3BC464C517C83A635CB4B8E61943B91D24B`。未写入正式数据库、未调用 AI；最终“软件按钮点击后目标文件确实高亮”仍待南烛枫用当前 BAT 确认。

> v130 正文视频全屏预览动作：南烛枫真实截图指出视频原位播放器下方左侧按钮错把`1000155089.mp4`等文件名作为主操作，未表达“打开大预览并播放”。现`SourceAttachmentAsset`仅在视频分支将该按钮替换为`MonitorPlay + 全屏预览`，固定为内容宽度，不再展示文件名；提示与无障碍名称为“全屏预览并播放视频”。点击仍只调用已有`onOpenAttachment → AttachmentPreview`，不改原位`<video controls>`、文件定位、文件存储或音频/其他格式操作。失败图已归档`docs/screenshots/qa/source-video-fullscreen-action-failure-reference-20260812.png`（SHA-256=`9EFCF900736FF19261075BDFD1E5904C414DFD62D3859576CC6390FDF84E7C7C`）。自动验证：前端205/205、TypeScript、Vite生产构建、`git diff --check`与v130隔离`--prepare / --verify`通过；EXE 38,838,784 bytes，SHA-256=`F2EB875416B48209C506E1EB837F51E200102D5CD4816459A0B97E48E88CD08B`。未启动v130、未打开或写入`D:\南枫知识库`；当前仍有v129验收程序运行，真实 WebView2 视频点击链路待南烛枫先关闭旧窗口后从当前 BAT 验收。

> v131 AI 自动整理整卡入口：南烛枫确认 v129 的独立`进入设置`按钮违背“整张卡可进入”的交互，并显得突兀。现入口本身改为唯一原生`button`，图标、标题、说明与右侧区域均直接打开原有二级`PrototypeDialog`；右侧只保留低存在感的`ArrowRight`方向提示，卡片消费共享`lift`焦点/悬浮/按压反馈。模型、密钥、保存、用量与遮罩/Escape关闭逻辑未改。失败图已归档`docs/screenshots/qa/settings-ai-automation-entry-button-failure-reference-20260812.png`（SHA-256=`87D9839D9446B195ABBABFE80BC2FE79162F11F734161EB4D0852D2A984B9238`）。自动验证：前端205/205、TypeScript、1702×1066隔离浏览器样板确认在左侧图标区域点击可打开并由Escape关闭，几何/间距/场景玻璃保持；`git diff --check`通过。v131 隔离`--prepare / --verify`待生成；未启动应用、未打开或写入`D:\南枫知识库`。

> v132 视频专属全屏预览：南烛枫确认音频不需要二级大预览，只有视频需要。现`SourceAttachmentAsset`只在`kind === video`时渲染并响应`MonitorPlay + 全屏预览`；音频不再提供任何大预览入口，仅保留已有原生音频控制和`定位文件`。视频原位控制、最高层`AttachmentPreview`、所有受控文件路径和定位服务不改。自动验证与v132隔离`--prepare / --verify`待生成；未启动应用、未打开或写入`D:\南枫知识库`。

> v134 模型卡片选择与视频专属预览：南烛枫指出原生下拉把模型压成同质文本，不能判断供应商与能力，并明确参考卡片式模型服务选择作为后续软件候选模板。现`AiAutomationSettings`以自定义触发器和弹窗内可滚动`listbox`替代原生`select`：当前选择与每个选项均展示供应商色条、`供应商 · 型号`、文字能力定位和明确选中态；OpenAI/Anthropic/DeepSeek/Qwen固定青绿/暖陶橙/理性蓝/低饱和紫，未知来源中性化。能力定位仅根据目录型号关键词保守推导，不伪造性能/价格。模型触发器不再嵌套在`label`中，保持正确的按钮语义。与v132一起，音频二级大预览已移除，视频全屏预览保留。参考图分别归档`docs/screenshots/qa/ai-model-native-select-failure-reference-20260812.png`（SHA-256=`1AB93057DC62C1E6A4DBE5AFDDC75A7F02B4019EA7863BA8D0A3A579FE334D64`）和`docs/screenshots/qa/ai-model-provider-card-reference-20260812.png`（SHA-256=`79812FDEBEF3552177339423C4AB53A5CB72F62D9217678316F6D78A9E769C57`）。前端205/205、TypeScript、1702×1066浏览器样板、`git diff --check`与v134隔离`--prepare / --verify`通过；EXE 38,838,272 bytes，SHA-256=`EFFAC2C1FA1E923DEBB8838B7B705F00CDDD156DE2694739948129C4B38710C4`。未启动v134、未打开或写入`D:\南枫知识库`；真实WebView2下有模型目录时的卡片观感与选择保存待南烛枫确认。

> v121 回收站“复活”防线：根因是 Source Item 与兼容 Record 的双对象关系没有在所有读取和操作路径上共同守住删除状态。已删除 Record 仍可能留在来源前端会话缓存；再次点来源操作时，旧实现会返回该已删除 Record，App 又无条件插回活动笔记列表。现将该路径设为硬拒绝，并在删除成功时立即清除来源会话缓存。迁移 v11 新建唯一只读入口`visible_source_items`，主题计数、主题详情、来源原文、附件/时间线、分类入口与 AI 全库取材均从此读取；历史回填也跳过已删除 Record。恢复操作是唯一重新可见路径。自动验证：Rust 110/110（另1项真实 Shell 测试默认忽略）、前端198/198、TypeScript、Vite 与 `git diff --check` 通过；v121 隔离 `--prepare / --verify` 通过，EXE 38,735,360 bytes，SHA-256=`F09E37D3F28F9400384B5BF4B926C03F114698DD70CADBF68A67954417856AD8`。未打开正式数据库或真实应用。

> v122 删除可见性反向审计：在 v121 的统一读取模型之上，补齐三条剩余旁路：1）损坏的`legacy_record_id`不再被当作未关联来源而创建替代 Record；读取视图对“关联 Record 缺失”保守隐藏。2）AI 任务完成、应用和撤销都复核`visible_source_items`；运行中的旧草稿遇到已删除/归档来源会中断并保留已持久化进度，不能改写或重新归类该笔记。3）前端移入回收站会失效来源搜索、附件目录、时间线及操作请求缓存；所有删除、恢复、永久删除同步递增知识可见性修订，三个知识入口重新读取正式库。自动验证：Rust 111/111（另1项真实 Shell 测试默认忽略）、前端199/199、TypeScript、Vite、release 检查与`git diff --check`通过；v122 隔离`--prepare / --verify`通过，EXE 38,735,360 bytes，SHA-256=`A034938513005763A9E14958913DA36AE6DBFBF83BF2643F9BEA2B795D979FB1`。正式库和真实应用未打开。

> v123 数据空间引用对账：旧优化只看 SQLite 空闲页、重复备份和失败备份，且执行前会新建永久“优化前安全备份”，导致大块未引用附件和 WAL 未被纳入、甚至抵消回收量。现以附件记录与导入清单建立受控附件引用图；执行前再次扫描，先进行完整性检查与 WAL checkpoint，仅删除无引用的受控附件、可证明重复备份和超时失败备份。完整迁移备份、导入原件、笔记/知识/历史版本及任何语义相似候选一律保留；模型不参与二进制删除裁决。优化器不再创建永久快照，仅在可证明空闲页达到32 MiB时才VACUUM。2026-08-12 对正式目录的只读盘点发现：附件目录中993个、1,769,428,284 bytes文件未被数据库引用，WAL为794,789,232 bytes；完整迁移备份和导入原件按恢复合同保留。本轮未执行清理、未写入正式数据。自动验证：前端199/199、数据优化Rust4/4、附件Rust10/10、设置页Playwright1/1、TypeScript与Vite通过；v123隔离`--prepare / --verify`通过，EXE 38,764,544 bytes，SHA-256=`853C7BDD57501728340F7B2E5A477113A943B41FCCCBB72D25178BA93D7EF76B`。未启动软件，正式桌面扫描与二次确认仍待南烛枫执行。

> v124 历史附件恢复卡实体白底：场景皮肤下该卡错误地单独消费半透明`--glass-card`并参与色彩混合，导致外层场景承托色透入，视觉上丢失白底。现恢复为与同级设置操作卡一致的固定`#f8fafd`实体浅白底和`#dce3ec`边界；布局、按钮、文字和交互角色不变。加入静态合同，禁止该选择器再引用`--glass-card`。自动验证：定向前端20/20、TypeScript与生产构建通过；v124隔离`--prepare / --verify`通过，EXE 38,764,544 bytes，SHA-256=`2BA9DDB61C13DBE19FA0A24CEE11BB4F5F5F1E135515B1AD0CC4F9772184D239`。未启动软件或打开正式数据；正式WebView2效果待南烛枫关闭旧验收程序后启动当前BAT确认。

> v125 数据优化确认与路径防护：修复安全复盘的两项P2风险。`inspect_data_optimization`现由后端保存扫描候选清单指纹并签发一次性、5分钟有效令牌；`optimize_data`只接收令牌，首次调用即消费，候选清单与扫描时不一致即拒绝执行，前端无法再用`confirmed: true`伪造确认。候选删除前会再次验证受控根目录、文件身份与Windows重解析点；备份目录采用逐层受控删除，空附件目录也拒绝穿越重解析点。清理范围、WAL处理、完整备份和原始导入保留规则不变。自动验证：Rust 116通过、1项显式忽略（Shell reveal真实系统动作）；前端200/200、TypeScript与生产构建通过；v125隔离`--prepare / --verify`通过，EXE 38,818,816 bytes，SHA-256=`39D4CB2E80CC1604D319B10676DA66604A5E22D5B328FDF722459D40CF4F8246`。未启动软件或打开正式数据；真实WebView2下的交互和正式库清理均待南烛枫手动确认。

> v126 存储安全复盘全部闭环：复核后不把 v125 当作“风险清零”。① 后端单次、5分钟令牌仍是优化唯一执行凭据，令牌会在首次调用时消费。② 候选清单身份由路径、类型、时间、大小提升为实际文件 SHA-256 或完整目录内容指纹；删除备份目录前先全树验证受控根、普通文件类型和重解析点，任何异常在删除开始前停止。③ Tauri Asset 协议不再递归授权整个`attachments`目录；启动时与各附件查询/恢复/新增入口均只对数据库登记、重新校验仍位于受控根内的单个文件调用`allow_file`。未登记、失效、目录外、符号链接/Junction目标均不会被网页预览路径授权。自动验证：Rust 116通过、1项显式忽略（真实 Shell reveal）；前端201/201、TypeScript、生产构建、定向安全合同与`git diff --check`通过；v126隔离`--prepare / --verify`通过，EXE 38,836,736 bytes，SHA-256=`5187A11814E678A8FC781AE178438F04B9B8AAEEA581C7B310CCF7EC4E2BEEA3`。未启动软件、未扫描或写入`D:\南枫知识库`；真实 WebView2 多格式预览和经用户确认的正式清理仍待人工验收。

> v127 AI 自动整理二级设置入口：设置首页不再展开供应商、API Key、模型与保存按钮，只保留与同页操作项一致、最大宽度900px的实体浅白入口卡；点击`进入设置`后才在统一`PrototypeDialog`中显示原有配置控件。对话框复用既有遮罩点击和 Escape 关闭、窗口尺寸偏好与可调大小能力；模型通道、Windows 凭据库密钥读取、保存、目录刷新和用量统计逻辑未改动。自动验证：定向合同38/38、前端全量202/202、TypeScript、Vite生产构建、`git diff --check`与v127隔离`--prepare / --verify`通过；EXE 38,838,784 bytes，SHA-256=`09258D05082038CD5B2F530139B628F5B44F2BCDA0ABAD158B77F44B7D887A28`。未启动新应用、未调用真实 AI 或打开正式数据库；真实WebView2路径待南烛枫关闭旧版后从当前BAT验收。

> v128 原始导入归档日常读取边界：`imports/raw`仍只作为导入保真、完整备份/恢复和用户明确存储维护的原件区。日常启动、窗口重新获得焦点、可见性恢复、进入设置和普通笔记列表刷新不再递归枚举该目录；存储摘要先显示本地缓存，仅在导入、附件变更、备份/恢复、数据优化或用户明确点击刷新后调用后端统计并更新缓存。正文、搜索和 AI 继续从 SQLite 来源表读取，不以原始归档回退。自动验证：定向合同26/26、前端全量203/203、TypeScript、Vite生产构建、`git diff --check`与 v128 隔离`--prepare / --verify`通过；EXE 38,838,784 bytes，SHA-256=`1B8428B92C357563ADC3075331E848DD444CE40B5444DC1EA8DC377BB769D81F`。未启动软件、未打开或写入`D:\南枫知识库`；真实 WebView2 中首次无缓存空态、显式刷新和导入后统计更新仍待南烛枫按当前 BAT 验收。

> v129 设置页 AI 自动整理入口回归：真实截图确认 v127 的入口卡错误继承了双列操作卡`height:100%`，在设置页面变成接近整页的实体白面；其子内容又被通用首子项规则堆成上下结构。现由入口专用选择器唯一修复为横向图标/文字/按钮、内容自适应的88px高卡；与皮肤区间距18px、与设置列表间距16px。场景皮肤把它纳入设置页一级玻璃承托，原版浅色继续是实体浅表面；二级弹窗、API Key 与模型功能不改。失败图已归档`docs/screenshots/qa/settings-ai-automation-entry-failure-reference-20260812.png`。自动验证：定向合同27/27、1702×1066浏览器几何/材质样板1/1、前端全量204/204、TypeScript、Vite生产构建、`git diff --check`与 v129 隔离`--prepare / --verify`通过；EXE 38,838,784 bytes，SHA-256=`99382763314B18C369199346FDA27DDEBB1814A24FE88D6504CCEF478671FBB3`。未启动软件、未打开或写入`D:\南枫知识库`；真实 WebView2 仍待南烛枫用当前 BAT 确认。

### v121 回收站删除可见性统一边界

- Source Item 不是独立的“复活入口”：其关联 Record 进入回收站后，任何收藏、跟踪、导出等来源侧车动作必须先提示恢复，绝不返回或重建活动 Record。
- 前端删除成功同步移除 `inbox`、搜索结果与会话快照，避免当前页面遗留卡片再次触发操作。
- 读取边界统一为 `source.status = active` 且关联 Record 未删除；主题来源数、正文、证据、附件目录和 AI 分类输入共用该约束。正式恢复后才重新出现。

### v119 Shell 规范路径兼容与精确选择

- 安全边界不变：附件仍只提交 ID 并由 Rust 重读受控归档文件；导出仍限制在规范化后的 `exports` 根目录内。
- Shell 边界明确：只把已经校验通过的 Windows 长路径转换为 Shell 显示路径；普通路径保持原 Unicode/空格/井号字符，UNC 路径恢复为标准 `\\server\share` 形式。
- 选择调用明确：`SHOpenFolderAndSelectItems` 的第一个 PIDL 必须为父目录，`cidl=1`，`apidl` 传入目标文件 PIDL；禁止恢复空选择列表、Explorer 命令行或页面私有实现。

### v117 全软件原生文件定位标准

- 唯一平台实现：`external_open::reveal_path`；Windows 使用 `CoInitializeEx / ILCreateFromPathW / SHOpenFolderAndSelectItems`，源码和合同测试禁止恢复 Explorer 命令行参数。
- 安全输入：附件只接受 ID 并重新读取数据库受控路径；导出文件必须规范化后仍位于 `exports` 根内。不存在、目录外或伪造路径继续拒绝。
- 统一消费者：正文资源、附件最高层预览、五类附件时间线、完整笔记导出和当前记录导出；文件类型不再拥有各自的定位实现。
- 分层证据：真实 MP4 原生 API 调用成功仅证明普通路径接受；v119 额外覆盖正式库使用的长路径转换合同，最终“软件按钮点击后目标文件确实高亮”仍由南烛枫在 v119 当前 BAT 中确认。

> v116 当前覆盖说明：南烛枫真实桌面反馈确认 v112 的“参数带引号”修复仍会让 Explorer 打开默认“文档”目录。只读核对正式库后，截图视频附件 ID `448` 的 `stored_path` 已确认是实际 `.mp4` 归档文件，不存在前端映射到文档的问题；根因是 Rust `Command::arg` 对 Explorer 专用 `/select,"路径"`片段再次转义。现改为 Windows `raw_arg` 原样传递受控、规范化后的 `/select,"实际 mp4 路径"`，使资源管理器直接选中该视频。未写入正式数据库、未启动程序或真实调用 AI；真实 Explorer 选中仍须由南烛枫双击当前 BAT 确认。

### v116 Explorer 精确选中文件

- 前端仍只提交附件 ID，后端仍仅从正式附件记录读取并校验受控 `stored_path`；任意本机路径不能从前端注入。
- 本轮只读事实：视频文件位于 `D:\南枫知识库\attachments\source-attachment-876-d9190457-c699-492f-8601-1f5cd617c4d2\...mp4`，附件 ID `448`、MIME `video/mp4`，路径存在。
- `external_open::reveal_path` 改为 `raw_arg`，保留原始 Explorer 参数格式；Rust 定向测试、TypeScript 与 v116 隔离 `--prepare / --verify` 通过。EXE 38,727,680 bytes，SHA-256=`6BD0340D2F703D36837A1064756B37699783290BC4C8F2256E6631C94BA2ACFF`。

> v112 当前覆盖说明：AI结果已按供应商/模型与输入快照保存，主题洞察和主题管理使用同一模型选择入口。模型切换只读取该模型轨道，不会覆盖其他模型结果，也不自动改变正式分类；正式分类仍只能由用户应用某一`AI Taxonomy Revision`。主题洞察相同模型相同输入会复用既有结果；主题管理新增`AI 补充新增笔记`，以同模型最新完整分类为基线，只处理新增或正文变化笔记，并只重整受影响主题的主题整合及自动来源。`ai_source_profile_versions`禁止跨模型复用；新模型无分类基线、基线撤销或缺少可复用档案时明确要求先全量生成。全量和增量共用持久检查点与断点续跑。附件定位修复为 Explorer 的带引号精确受控文件路径。自动验证：`cargo check`、Rust定向6/6、前端194/194、TypeScript、核心Playwright1/1及定位视频参数单测通过；v112 Windows隔离`--prepare / --verify`通过，EXE 38,725,120 bytes，SHA-256=`1B8D216BA71C0680DF79E71CB6E8CFABEC01D0107BC76AE6722D5BB34127A80D`。未打开正式数据库、未调用真实AI或真实WebView2。

### v112 多模型结果轨道、增量分类与媒体定位

- `ai_topic_insight_versions`保存主题洞察历史；兼容表不再是唯一来源。主题洞察模型选择器只读取所选模型的最新结果。
- `ai_source_profile_versions`以`sourceItemId + providerChannel + modelId + contentSha256`保存可复用档案；分类修订持续保存模型身份和来源快照。
- `AI 补充新增笔记`保留同模型基线的领域/主题和未受影响整合，只请求新增/变更笔记、重新归属，并为受影响主题重新生成整合正文和确定性来源列表。
- 附件“定位文件”修复为向 Explorer 传递带引号的`/select,"实际受控附件路径"`参数；含空格/中文的视频、图片和文档不会再退回默认“文档”目录。前端仍只提交附件ID，后端仍按受控`stored_path`解析实际文件。

> v111 当前覆盖说明：主题洞察卡二与主题管理卡二不再分别读取原始`domains/topics`并各自做显示判断。`getAppliedAiTaxonomyHierarchy`成为两入口唯一共享的前端分类读模型：仅把已应用`AI Taxonomy Revision`中的领域/主题，映射到同一批正式持久化行并提供唯一`topicIds`选择范围；未应用、已撤销，或无法对应到该修订的遗留领域/主题时，两个入口都共同显示空态`待 AI 生成全库分类`，不得有任何一侧回退展示旧分类。主题详情、单主题AI整理与批量AI整理同样只允许作用于该共享范围，不能由旧主题绕过分类应用门禁。前端193/193、TypeScript、Vite、1702×1066核心Playwright 1/1及v111 Windows隔离`--prepare / --verify`通过；EXE 38,598,656 bytes，SHA-256=`C6B9C62C58C163D83512D9F3E12769FF7D82519602B63A0E7D5C4472C290A205`。程序、正式数据库、真实AI API和真实WebView2均未打开或执行。

### v111 主题管理/主题洞察卡二统一已应用分类读模型

- `src/aiTaxonomyPresentation.ts`唯一解释`AI Taxonomy Revision → Domain/Topic`的正式可展示树；两个工作区只接收`AppliedAiTaxonomyHierarchy`，不再接收原始分类列表。
- 父级工作区以该读模型收敛选中主题、详情请求、主题洞察请求和批量AI整理范围；从空态到应用修订后自动选择首个正式主题，反向撤销或缺失映射时清空选择与详情。
- 应用修订是领域/主题正式名称、层级与归属同步的原子边界；测试夹具不得把“已应用修订”和遗留的不同领域结构同时伪造为有效状态。

> v110 当前覆盖说明：已修复真实全库分类在主题整合阶段因模型返回跨主题来源ID（截图为`ai-models`）而整次失败、此前批次全部丢失的问题。主题整合正文仍由AI生成，但来源清单改为由最终笔记归属确定性生成，模型ID误差不再毁掉长任务。新增migration v8检查点：语义档案每24条、归属每40条、主题整合每8个主题分别落盘，同时保存阶段、Token和已知费用；异常、关闭或网络中断后，主题管理自动提示`继续上次生成 / 放弃上次并重新生成 / 稍后处理`，续跑只执行未完成批次，运行弹窗按检查点更新数量与用量。旧v109及以前失败任务没有检查点，无法把已经只存在于进程内的半成品恢复成可续跑任务，不能误报可恢复。全部笔记卡二在WebView2父级flex高度稳定期间分段复测，首次打开不再停在7行保底窗口；设置页底部`当前程序`卡与上一卡保持16px间距。前端192/192、Rust106/106、TypeScript、Vite、1702×1066核心E2E1/1及v110 Windows隔离`--prepare / --verify`通过；EXE 38,598,144 bytes，SHA-256=`195074DE095F44529496E0A758789F31965BB271D12B59F9F11108DA2DBFA461`。程序、正式数据库和真实AI API均未打开或执行。

### v110 AI 全库分类断点续跑与失败止损

- `ai_taxonomy_run_checkpoints`持久化当前来源快照、语义档案、taxonomy、归属、三个offset、阶段和累计用量；正式revision成功后删除检查点，放弃任务时保留任务用量审计但删除可续跑内容。
- 继续前会比对来源ID与正文哈希；笔记集合或正文已变化时拒绝直接续跑，避免把旧分类结果套到新材料或重复计费。
- 中断任务的已完成批次Token/已知费用纳入设置页累计统计；无法从供应商错误响应取得的当前失败请求用量仍不能凭空补记。
- 失败参考：`docs/screenshots/final-core-workspace/ai-taxonomy-integration-source-failure-reference-20260811.png`，SHA-256=`16CF6C5A44681B4B86730FA8DABE2C098F7F44BB2C27C3E3C9F5518DE6A2674C`；断点提示源码证据：`docs/screenshots/qa/ai-taxonomy-resume-prompt-v110-1702x1066.png`，SHA-256=`8F01C8ECA05C796D7C67C4C859575499868BFA22A3BEFBA8B652D67AA0ED4BED`。
- 首次列表短截和设置底部间距参考分别为`source-list-initial-short-reference-20260811.png`（`38A14DA9222374FDECACBB7E34DC97C32D46B08C3979B793CBB07B2F807F83AB`）与`settings-runtime-card-spacing-reference-20260811.png`（`AE0D4C0204443792B2BFD0420EFD0EF91B7B75458AD9884D6CFE0F8512F6FEEE`）。

> v109 当前覆盖说明：主题整合已成为 AI 全库分类修订的强制组成部分，不再只是可空字段。主题管理 AI 在领域、主题和全部有效笔记唯一归属确定后，为每个有归属笔记的主题生成整合正文，并完整绑定该主题全部笔记来源；正文为空、来源为空、遗漏来源、重复来源或跨主题引用都会在草稿持久化与应用两个阶段被拒绝。主题管理显示`主题整合 完成数/有归属主题数`，不完整草稿不能应用；生成成功弹窗明确报告整合数量及自动来源。主题洞察“主题整合”读取同一已应用修订，并只显示该整合绑定的来源。旧空修订显示`待主题管理 AI 生成全库分类并应用`，不会冒充已生成。前端192/192、Rust104/104、TypeScript/Vite、1702×1066核心E2E1/1及v109 Windows隔离`--prepare / --verify`通过；EXE 38,370,816 bytes，SHA-256=`6884CB3835B8540BCCC998D8B61CD399164E6AFF5F765252E5801D7C48ED28BA`。程序、正式数据库和真实AI API均未打开或执行。

### v109 主题管理 AI 主题整合强制闭环

- `run_ai_taxonomy_revision`继续按`语义档案 → 领域/主题 → 全部笔记归属 → 每主题整合`执行；整合`sourceItemIds`必须与该主题全部归属笔记集合完全一致。
- `complete_taxonomy_revision_task`与`apply_taxonomy_revision`双重校验整合正文和自动来源；历史缺字段草稿不能继续应用，新修订不会再产生截图中的空整合状态。
- 主题管理和主题洞察通过同一 applied taxonomy revision 读取唯一整合与唯一来源清单；主题洞察的`AI重新整理`仍不拥有或覆盖主题整合。
- 用户失败证据为`docs/screenshots/final-core-workspace/topic-integration-empty-applied-reference-20260811.png`，SHA-256=`75BCB056DADC23B6ABC0DA7059FCAEE9EBAB5FE8F74D4E0BE7AD2AE9844441C8`。

> v108 当前覆盖说明：AI单主题整理和AI全库分类进度弹窗右侧加载环已统一为正圆。根因是`.knowledge-overview-dialog > header > span`把头部所有直接子`span`都强制套成34×34、10px圆角方盒，覆盖了共享`.save-spinner`的14×14、50%圆形几何；现已收紧为仅首个语义图标`span:first-child`使用圆角方盒，所有`save-spinner`继续由共享圆形样式唯一持有。批量任务列表、页面加载、搜索、导入和附件等既有同类加载环不受方盒规则污染，保持正圆。前端190/190、1702×1066核心E2E1/1、TypeScript/Vite随v108隔离构建通过；v108 Windows隔离`--prepare / --verify`通过，EXE 38,237,696 bytes，SHA-256=`1D23B5405BED6A6DD08A8A83E4BD006BBFAB12B4953427754603C4089893E2F8`。程序、正式数据库和真实AI API均未打开或执行。

### v108 进度加载环统一正圆

- 共享圆形加载环仍由`.save-spinner`唯一持有；弹窗头部方形语义图标只匹配第一个直接子元素，不再影响右侧进度环。
- 单主题AI整理与全库AI分类进度弹窗均以浏览器计算样式验证`border-radius:50%`；批量列表和页面加载继续复用同一圆形环。
- 失败参考为`docs/screenshots/final-core-workspace/ai-progress-square-spinner-reference-20260811.png`，SHA-256=`8718D564757A0C5228063AE8FC7E04309F187C50582032559CF0EFD973DAA993`；当前源码证据为`docs/screenshots/qa/ai-progress-round-spinner-v108-1702x1066.png`，SHA-256=`E55647E79B2CDD225E7C5FD08E679840B5738361FAF9AABDC1E80F9DEF90067A`。

> v107 当前覆盖说明：主题管理卡二、卡三只消费已审核并应用的 AI 全库分类修订；没有已应用修订时，领域/主题、笔记归属、主题边界、主题整合和归纳笔记全部为空，只显示小字`待 AI 生成全库分类`，不再展示旧主题、旧归属、`已归入当前主题`或其他本地兜底。点击`AI 生成全库分类`立即显示不可伪造百分比的持续过程弹窗，成功/失败结果持续到用户确认；成功只产生待审核草稿，应用后才进入正式卡片。主题洞察固定分屏改为上方 AI 成果 1/3、四知识 Tab、下方知识正文 2/3；完整成果弹窗默认约占应用 80%且可调宽高，全软件桌面弹窗默认可人工调整大小。竞争假设、判断演变、待验证问题、知识有效性和决策版本统一消费 AI 结构化结果；判断演变允许来源中的时间顺序、更新和前后证据差异形成来源绑定节点。单主题整理与全库分类均有持续过程和需确认结果弹窗。设置页`当前程序`移到最底部，AI设置卡补16px四角圆角；设置页主卡/设置行与回收站条目恢复场景一级透明磨砂玻璃，内容最前景卡继续不透明。前端189/189、Sites4/4、TypeScript、Vite、Rust103/103、完整Playwright18/18、最新定向核心E2E1/1及v107 Windows隔离`--prepare / --verify`通过；EXE 38,237,696 bytes，SHA-256=`45D93FCF64346BD0BC20485B1255109FF32C4C5B0DFA8D69C052882444466931`。程序、正式数据库和真实AI API均未打开或执行。

### v107 AI 结果所有权、持续反馈与材质边界

- `AI Taxonomy Revision`唯一拥有领域、主题、全部有效笔记唯一归属、每主题整合和整合自动关联的笔记来源；主题管理与主题洞察只读取同一已应用修订的正式整合。
- 主题管理在未应用 AI 修订前保持真实空态；用户点击生成后先看持久过程，再看持久结果和待审核草稿，不能把生成成功直接冒充正式应用。
- `AI Topic Insight`负责主题综述、竞争假设、判断演变、决策与行动、待验证问题和知识有效性；四知识 Tab 只切换下方内容，不改变上方成果或页面坐标。
- `docs/screenshots/final-core-workspace/topic-management-legacy-fallback-reference-20260811.png`记录旧本地归属/无价值文案失败态，SHA-256=`6A6F77E9AB0B13BF2A7E2F3C5BC5983C6131A3599361604E266D577483B2A25B`；当前空态与回收站玻璃证据分别为`docs/screenshots/qa/topic-management-awaiting-ai-v107-1702x1066.png`、`docs/screenshots/qa/trash-glass-cards-v107-1702x1066.png`，SHA-256分别为`A434F771733F2D025345AB00994B74215DD29FB40497FB0250B2BE8D34A49873`、`6D2CDFC6734DDC23822ED8A7C0376B258468A5DF12FC6504B5EC0332AE3EC314`。

> v106 当前覆盖说明：主题洞察卡三已改为固定三段分屏：AI主题洞察占上半区，四个知识Tab固定在中间，当前知识正文占下半区且只有下半区允许纵向滚动。AI成果默认不折叠，固定上半区能显示多少就显示多少；`查看全部`弹窗复用同一内容组件显示完整成果。切换四态时上半区、Tab、下半区和窗口坐标误差≤1px。AI成果内最深独立阅读卡使用共享`surface-lift`，悬停只提升自身。主题管理AI的主题整合同时显示同一次taxonomy revision自动关联的笔记来源。前端189/189、Sites4/4、TypeScript、Vite、Rust103/103、完整Playwright 18/18及v106 Windows隔离`--prepare / --verify`通过；EXE 38,236,160 bytes，SHA-256=`451770FB812832676DC21CEC96F4EF675814441A236DCBD7CB17B68AECD3BB9D`。程序、正式数据库和真实AI API均未打开或执行。

### v106 固定洞察分屏、完整弹窗与来源归属

- `KnowledgeReadingWorkspace.tsx`以`.knowledge-final-stage`唯一持有`1fr / tabs / 1fr`布局；上半区和Tab固定，`.knowledge-final-scroll`是唯一纵向滚动所有者。
- `AiInsightBundleContent`同时服务固定预览与查看全部弹窗，避免两套AI正文漂移；弹窗支持关闭按钮、Escape、遮罩关闭、页面滚动锁定和焦点恢复。
- AI关键洞察、假设、判断、决策、问题和建议卡使用共享卡片互动角色，禁止父子卡同时抬升。
- 主题整合的`sourceItemIds`在主题管理卡三映射为`自动关联笔记来源`标题列表；这属于主题管理AI结果，不由主题洞察AI生成。
- 本轮需求参考：`docs/screenshots/final-core-workspace/ai-insight-full-card-layout-reference-20260810.png`，SHA-256=`90BCF2393F5CDB04EABC1CF75158573218D49383401D39941333806C93F05D6B`；当前源码证据：`docs/screenshots/qa/ai-insight-fixed-split-v106-1702x1066.png`和`docs/screenshots/qa/ai-insight-full-dialog-v106-1702x1066.png`，SHA-256分别为`919CA867A4F7B37CE73D7B9F5C9811DA4A4B2E7CF36D10C7F232ACF76087B577`、`E5D25E2FE851FCA20774612DE1A340DD5ABEA5ACF1620935B505FBC187409341`。

> v105 当前覆盖说明：主题整合的生成所有权已归主题管理 AI。全库分类先生成领域/主题和全部有效笔记唯一归属，再按最终归属为每个主题生成带来源 ID 的整合，一并进入 taxonomy revision；主题管理卡三与主题洞察“主题整合”读取同一当前已应用修订。新增 `get_applied_ai_taxonomy_revision`，使最新待审核草稿与当前正式结果分开读取，草稿不会让正式整合消失。主题洞察“AI 重新整理”只更新主题综述、竞争假设、判断演变和决策与行动；正式人工对象独立保留。截图中“当前正式归属；等待下一次 AI 修订补充解释。”竖排的根因是普通文本被放入18px网格列，现已改为横排流式段落并删除长占位。前端189/189、Sites4/4、TypeScript、Vite、Rust103/103、1702×1066核心E2E 1/1及v105 Windows隔离`--prepare / --verify`通过；EXE 38,234,624 bytes，SHA-256=`A12F2CE6F3E9C999BFF57E309AD0552D96219027972A0BB11AC78DDD127D5421`。程序、正式数据库和真实AI API均未打开或执行。

### v105 主题整合归属与横排修复

- `AI Taxonomy Revision`拥有领域、主题、全部笔记唯一归属和每主题整合；`AI Topic Insight`只拥有综述及三个条件面板。
- 主题管理与主题洞察通过已应用 revision 共享唯一整合；待审核草稿只服务预览，不能覆盖正式内容。
- 竞争假设、判断演变、决策版本直接消费 topic insight AI 结构化结果；材料不足时显示短原因，正式确认记录作为独立数据并列。
- 失败截图：`docs/screenshots/final-core-workspace/topic-management-vertical-copy-reference-20260810.png`，SHA-256=`15821F981062CCE76F8703BEB8BBB1A91B0DF65ECB556C39CECC1E5CF7A02347`；当前源码证据：`docs/screenshots/qa/topic-management-ai-integration-horizontal-v105-1702x1066.png`，SHA-256=`C216808AE565D99148C77D0F8DAABC5C6C561DEC50579B6332ED1D14328CFC32`。

> v104 当前覆盖说明：南烛枫真实WebView2截图确认四个知识面板切换时当前画面会乱跳。根因是`KnowledgeReadingWorkspace`为四态分别保存滚动位置，首次进入其他面板会恢复到0；短面板还会压缩滚动范围，使粘性Tab下坠。v104取消分面板滚动记忆，由右侧唯一滚动区在切换前记录共享视口锚点，并在React布局提交前恢复；面板正文按真实阅读视口维持最小高度，CSS关闭浏览器自动滚动锚定，外部来源返回定位仍由既有导航目标接管。失败回归先测得Tab下跳126px，修复后连续切换`判断演变 → 主题整合 → 决策版本 → 竞争假设`，Tab条、右卡与窗口位置误差均≤1px。前端187/187、TypeScript、Vite、Sites4/4、1702×1066完整核心E2E 1/1及v104 Windows隔离`--prepare / --verify`通过；EXE 38,254,592 bytes，SHA-256=`819E15815DFCAA48B7EA0E40E5340BA52D466C2F06938B075F0C95393C05F276`。程序和正式数据未打开，真实物理点击仍待南烛枫确认。

### v104 四知识面板切换视口稳定

- `knowledge-final-scroll`继续是唯一纵向滚动所有者；Tab切换不再读取目标面板的历史滚动值。
- Tab尚未粘性固定时保留当前`scrollTop`；Tab已固定在视口顶部时保留Tab这一视觉锚点，让新面板从其下方稳定出现。
- 短内容至少填满Tab下方剩余可视区，避免滚动上限收缩；不增加占位知识内容，不改变四态职责、AI结果或皮肤。

> AI-only 语义流水线当前覆盖说明：南烛枫已明确替代此前“AI总览 + 本地分析/本地分类回退”方案。现行代码新增 migration v7：AI 分批逐篇生成语义档案，再生成全库领域/主题结构，最后分批为全部有效笔记生成唯一主主题归属；结果先进入可完整预览的 `taxonomy revision`，应用时事务写入并保存撤销快照。导入和来源页不再触发本地关键词分类；旧确定性分类器、65分阈值、个人目录、分类上下文/候选命令、本地语义生成器、dry-run、补充输入脚本、旧 examples 和原型已从生产入口及前端源码删除。主题洞察改为同一次 AI 调用生成综述及三个有证据才出现的条件面板。生产 Release 不编译旧本地分类/个人目录代码，仅在 `cfg(test)` 下保留历史迁移兼容合同。前端187/187、Sites4/4、TypeScript、Vite、Rust103/103、Release `cargo check`、1702×1066 AI-only核心E2E 1/1及v103 Windows隔离构建/校验通过；真实 API、正式 `D:\南枫知识库`和真实WebView2均未执行。完整合同见`docs/ai-semantic-pipeline.md`。

> v103 当前覆盖说明：当前唯一BAT已切换到`v103-ai-only-semantic-pipeline`。AI未生成时，主题洞察只显示原始笔记、已确认记录和明确等待态，不再生成本地概览、竞争假设、判断演变或决策草案；主题管理只显示AI主题边界、归纳笔记和AI分类修订职责，不再显示自动排除、关键词权重或本地评分。核心E2E已覆盖等待态、卡二共用分类树、主题整合原文回溯、维护入口、四皮肤、单主题/批量AI模拟结果和无本地回退。Windows隔离EXE为38,254,592 bytes，SHA-256=`26C0AFBBAAE169B3A64B6ACA00762CF72C380761CAD892D00AC45222208CD101`；未启动应用、未打开正式数据、未调用真实AI。

### v103 AI-only 语义流水线

- `主题管理`拥有全库AI分类：逐篇语义档案 → 领域/主题体系 → 全来源唯一主归属 → 完整修订预览 → 一次事务应用/撤销。
- `主题洞察`拥有主题成果包：必有主题综述；竞争假设、判断演变、决策与行动只有证据充分时出现；来源ID和原文回溯贯穿结论，不另造第五个知识面板。
- 本地只保留原文解析、搜索、去重、附件、事务、审计、费用和撤销；离线时原文可读，AI区显示等待/失败，不生成替代内容。

> v102 当前覆盖说明：南烛枫最新真实WebView2截图确认v87虽然已把前景RGB提到纯白，但主题树普通项、阅读卡、辅助卡、记录/设置卡及AI卡内白卡仍保留`0.72–0.94`透明度，暖色场景继续透入并导致整体发灰。最新视觉合同明确替代“前景卡保持既有alpha”：三套场景皮肤的所有最前景内容卡、列表卡、判断卡和卡内白卡改为完全不透明的高亮珍珠白；淡绿、淡红、淡紫等语义卡保留低色度色相但同样完全不透明。玻璃通透只由外层侧栏/工作区/内容承托面负责；布局、尺寸、圆角、边缘、模糊职责、AI功能、主题整合主要来源阅读卡及原版浅色不变。前端234/234、Sites4/4、TypeScript、Vite生产构建和1702×1066四皮肤/AI结果态E2E 1/1通过；当前源码证据为`docs/screenshots/qa/foreground-card-opaque-v102-1702x1066.png`与`docs/screenshots/qa/foreground-card-opaque-ai-v102-1702x1066.png`。v102 Windows隔离`--prepare / --verify`通过，EXE 38,298,624 bytes，SHA-256=`FC093F971E1A4D633C909CE902B21C03844B3644DA68E001CCE62F29719235EB`。程序、真实API和正式数据均未打开或执行；最终真实WebView2观感仍待南烛枫双击当前验收BAT确认。

> v0.3.0 Windows 正式发布包：唯一安装资产为`NanfengKnowledgeBase-Windows-v0.3.0-Setup.exe`，大小22,141,639 bytes，SHA-256=`6B36FA596F8D211A984EAC630E4AC1157AE2D55E370E059933C2B0038AC66273`。`package.json`与Tauri版本均为`0.3.0`，NSIS正式安装包合同通过。安装包当前未做代码签名，Windows可能显示SmartScreen提示；这属于发布边界，不影响本地数据与AI功能。正式发布只上传这一份Setup EXE，当前可运行界面预览只保留在README。

> v101 当前覆盖说明：点击`AI 整理全部主题`后立即打开持久过程弹窗，显示当前主题、完整队列、逐项等待/请求/重试/成功/失败状态、总进度和实时统计，不再只改变按钮文字。针对南烛枫真实68主题长批次中的握手EOF、连接中断、90秒超时、响应解析失败和空总结，后端改为全进程复用HTTP连接、单次时限150秒；前端串行主题间隔650ms，对上述瞬时错误自动重试一次，401/403等明确配置错误不盲目重试。最终失败仍保留真实原因。前端234/234、Rust103/103、TypeScript、Vite生产构建、过程/结果/重试E2E和v101 Windows隔离`--prepare / --verify`通过；EXE 38,298,624 bytes，SHA-256=`8C75CF833E63515D9F1778DA49D909CEBE4486F1C6AE7975CF174921A4F4D054`。程序、真实API和正式数据均未打开或执行。

### v101 批量 AI 实时过程与长批次稳定性

- `src/aiTopicBatch.ts`是逐项状态、请求节奏和有限重试唯一所有者；过程弹窗随每次状态变化刷新并自动保持当前主题可见。
- `src-tauri/src/ai/client.rs`使用`OnceLock<Client>`复用同一连接池，不再为每个主题重建客户端和TLS连接；总响应时限由90秒调整为150秒。
- 当前源码视觉证据：`docs/screenshots/qa/ai-batch-live-progress-v101-1702x1066.png`。真实68主题批次的成功率和供应商网络表现必须由南烛枫本人再次执行确认。

> v100 已覆盖说明：批量结果只有全部成功才显示成功；失败结果固定列出主题名称和后端真实错误，须用户确认关闭并可只重试失败项。其自动合同与v100隔离程序已通过，现行过程反馈和网络策略由v101替代。

### v100 批量 AI 整理结果与失败恢复

- `src/aiTopicBatch.ts`保留每个失败主题的原始错误；`KnowledgeWorkspace.tsx`持有结果与失败主题重试；`KnowledgeReadingWorkspace.tsx`持有必须人工确认的结果弹窗。
- E2E明确等待4.5秒确认成功和失败结果均不会自动消失，并确认失败主题`云服务`显示模拟真实错误`HTTP 429`、重试只调用该主题。
- 当前源码视觉证据：`docs/screenshots/qa/ai-batch-failure-result-v100-1702x1066.png`。真实API错误文案、供应商限流和正式WebView2交互仍需南烛枫本人确认。

> v99 已覆盖说明：主题洞察标题区新增`AI 整理全部主题`，与现有单主题整理并列。一次点击后按主题当前顺序串行复用`run_ai_topic_insight`，每个主题继续独立记录Token、费用和派生结果；已合并主题跳过，单个失败不终止后续主题，按钮原位显示进度。前端232/232、Rust102/102、TypeScript、Vite生产构建、两主题顺序E2E和v99 Windows隔离`--prepare / --verify`通过；EXE 38,299,648 bytes，SHA-256=`0B496D8431315B50F09F089F6F31C58AB3D25EA30F94AC7FD4C01398F4F4F3B3`。程序、真实API和正式数据均未打开或执行；旧自动消失汇总已由v100替代。

### v99 一键 AI 整理全部主题

- `src/aiTopicBatch.ts`是批量调度唯一所有者：只负责未合并主题筛选、串行顺序、失败隔离、进度和汇总，不复制模型调用或计费逻辑。
- 当前主题若在批量中完成，页面立即显示其最新AI结果；用户切换主题不打断后台的顺序任务。
- 当前源码视觉证据：`docs/screenshots/qa/ai-organize-all-topics-v99-1702x1066.png`。真实API总费用、供应商限流和长批次运行仍需南烛枫在正式WebView2确认。

> v98 已覆盖说明：来源/证据边界不再占据AI总览主位置。唯一展示策略会兼容现有已保存结果，识别`来源边界 / 证据边界`区并从总览正文分离，放到AI卡片所有主题内容之后，默认仅显示`来源范围 N 条`，主动展开才显示完整来源ID与标题；新提示同时禁止后续模型在`summaryMarkdown`生成边界清单。前端230/230、Rust102/102、TypeScript、Vite生产构建、1702×1066真实组件展开/收起E2E和v98 Windows隔离`--prepare / --verify`通过；EXE 38,300,160 bytes，SHA-256=`50AC4244FECB090B3CB4EF30B7D1088B815EF4A7AA86F14A3EFDCE9BB2C4D22E`。程序、真实API和正式数据均未打开或执行。

### v98 AI 来源范围信息层级

- 核心判断、矛盾、关键洞察与主题建议继续承担主要阅读位置；来源清单只负责按需追溯。
- `src/aiInsightPresentation.ts`是旧结果兼容与展示分层的唯一所有者；不会修改已保存AI结果，也不要求重新生成才能看到折叠效果。
- 南烛枫提供的4条与20条来源截图已归档为失败参考；当前源码证据为`docs/screenshots/qa/ai-insight-boundary-collapsed-v98-1702x1066.png`。

> v97 已覆盖说明：修复 AI 上下文只传标题和正式对象、遗漏来源正文的问题。`compile_topic_context`现在把主题关联来源的可读正文纳入唯一模型上下文，每段保留来源 ID；最多20条、单条最多4000字符、正文区最多60000字符、完整上下文目标上限72000字符。提示明确以`来源正文`为主要分析材料，只有该区不存在时才能说明缺少正文。原文件、主题归属、人工判断和旧 AI 结果均不自动改写；已有结果需由南烛枫点击`AI 重新整理`后更新。前端227/227、Rust102/102、TypeScript、Vite生产构建及v97 Windows隔离`--prepare / --verify`通过；EXE 38,299,136 bytes，SHA-256=`D22965A1102B9F9D7CC9CCE81E15D02D2AC01EA2C18289140E8085A40786720D`。程序、真实 API 和正式数据均未打开或执行。

### v97 AI 来源正文上下文

- 根因已经由代码确认：主题详情读取模型本来就有`content_text`，本地确定性分析也在使用它，但 AI 的`compile_topic_context`此前只拼接来源标题、类型和日期，模型因此只能诚实判断“没有具体内容”。这不是 Key、账户或资料本身失效。
- 当前只修复模型输入边界：按主题已有关联顺序读取可读正文，保留来源 ID 供输出回溯，并用明确上限控制 Token；不重新导入、不修改数据库结构、不改变来源归属。
- 旧 AI 结果仍是历史派生结果，不会因升级自动覆盖。使用 v97 后对目标主题点一次`AI 重新整理`，新结果才会基于正文生成。

> v96 已覆盖说明：主题洞察右侧改为唯一纵向滚动区，AI 洞察、本地分析、四个深读状态均可连续滚动到底；状态标签在到达顶部后保持可见。AI 结果存在时，本地确定性摘要默认收起为`本地分析`，只作为离线、可追溯的核对底座，不再与 AI 总览同屏重复展开；AI 的关键洞察和主题管理建议也按需展开。新任务提示约束总览为3–5句、关键洞察/待验证问题/主题建议各最多3条，避免模型内部重复。前端227/227、Rust101/101、TypeScript、Vite生产构建、1702×1066 Chrome真实组件滚动E2E和v96 Windows隔离`--prepare / --verify`通过；EXE 38,409,728 bytes，SHA-256=`AF5FCEF7CB834485D9C0C17AE6A78625BF18C8FBE44172F4CCAA64C8B8E7A459`。正式WebView2与正式数据未打开或验证。

### v96 AI 洞察阅读与本地规则职责

- AI 洞察是当前主题的首要自动整理摘要，负责更好的语义归纳；它仍是可重建派生层，不覆盖人工判断、证据或主题身份。
- 原本地规则结果继续有价值：无API时可离线生成，能稳定回溯来源，并为竞争假设、证据、有效期和四个深读状态提供底座。AI成功后仅把其摘要折叠，不删除底层对象或深读入口。
- `knowledge-final-scroll`现在是右侧唯一纵向滚动所有者；标题保留固定，AI、本地分析、状态标签和正文进入同一滚动链路，解决AI卡片占满固定区后下方内容无法查看的问题。
- 失败参考：`docs/screenshots/final-core-workspace/ai-insight-scroll-overflow-reference-20260810.png`；当前源码证据：`docs/screenshots/qa/ai-insight-unified-scroll-v96-1702x1066.png`。

> v95 当前覆盖说明：设置页五类主卡片统一为同一900px内容列；API Key 保存后持续显示掩码，切换通道不再表现为丢失，右侧眼睛按钮可在用户明确点击时从 Windows 凭据库读取并显示/隐藏。保存与模型目录更新已拆分：保存成功立即保留，更新失败显示供应商真实错误，不再误报为“AI 设置保存失败”；OpenRouter 非2xx响应也优先透传官方错误。南烛枫已在真实v94 WebView2执行保存与更新，Windows凭据条目只读确认存在，证明Key保存成功；模型目录更新失败的具体原因因v94吞错尚未确认，需用v95重试。前端226/226、Rust100/100、TypeScript、Vite生产构建、1702×1066定向页面验收和v95 Windows隔离`--prepare / --verify`通过；EXE 38,409,216 bytes，SHA-256=`F5109D98CA6A2281390D8444991789532F0D68647A97496C9ABCFFD2F58D4033`。v95真实API重试、正式SQLite和v95真实WebView2尚未执行或确认。

### v95 AI 设置可用性与最小闭环

- 后端唯一边界：`src-tauri/src/ai/`；前端唯一适配器：`src/services/aiRepository.ts`；migration v6只新增`ai_settings / ai_provider_settings / ai_task_runs / ai_topic_insights`。
- 设置页只显示 OpenRouter 和 DeepSeek 直连。API Key 输入后写入 Windows 凭据库；日常读取只返回“是否已配置”，只有用户明确点击眼睛按钮时才通过独立命令读取当前通道密钥。SQLite、日志和普通设置命令返回值均不含密钥。
- OpenRouter 目录动态筛选 OpenAI、Anthropic（Claude）、DeepSeek，各保留最新3个支持结构化输出的文本模型；DeepSeek 直连保留接口当前返回的最新3个。已配置目录超过24小时后，打开设置页会自动刷新。
- 主题洞察标题区提供`用 AI 整理 / AI 重新整理`。输入复用正式`compileTopicContext`，结构化输出包含总结、关键洞察、证据边界、待验证问题与主题管理建议；结果不会触发合并、删除、改名或覆盖人工内容。
- 每次任务记录成功/失败、供应商、模型、输入/输出/推理/缓存 Token。OpenRouter 优先记录接口实际费用，缺失时按目录价格估算；DeepSeek只有能匹配已知官方价格时才估算，无法可靠计价则明确记为不可用。
- 当前验证证明代码、隔离内存数据库、设置页统一列宽和 v95 Windows release 构建闭环；真实v94路径只证明Key已写入Windows凭据库，不证明模型目录成功、供应商响应兼容性、正式库migration v6、v95真实桌面交互或真实金额已通过。

> v93 当前覆盖说明：根目录唯一验收入口为`启动南枫知识库-当前验收.bat`。设置页显示版本、构建标签、EXE大小和运行文件自身SHA-256；媒体明确复位、视频输入所有权、附件有界加载、右键作用域和完整E2E阻断均已修复。下文历史段落中的v92及更早入口、运行包和“完整E2E被遮罩阻断”只作历史证据，不再表示当前状态。
> v93启动器独占锁已实测：第二个`--prepare`在编译前被拒绝并返回非零状态。当前没有第二个Codex开发任务写入仓库；旧v89程序PID29668仍在运行，因此只保留其`*-app`目录，关闭后可重跑`scripts/cleanup-acceptance-artifacts.ps1`删除。

### v115 主题管理工具栏密度

- 根因确认：窄栏工具区把模型筛选、两个状态筛选和两个长AI动作放入同一三列网格，第二行按钮被压缩为多行竖排文字。
- 现改为两层：`模型 / 全部 / 待处理`首行等宽紧凑控制；`AI 全量重新整理 / AI 补充新增笔记`第二行等宽42px动作卡并强制单行；草稿的`应用修订`独占下一整行。功能、模型选择、全量/增量规则和生成范围未变。
- 自动验证：TypeScript、前端198/198、生产构建及v115隔离`--prepare / --verify`通过；EXE 38,726,656 bytes，SHA-256=`8EF5AA2B05228795B9AF66EA1DF8EFF0BD969A2364CB8B06F40E9965A32E3669`。真实WebView2待南烛枫验收。

### v114 全部笔记回看缓存与统一加载提示

- 根因确认：全部笔记卡三为保障列表首屏轻量而按需读取正文，近期缓存仅8篇；附件状态也在切换来源时先清空，因此用户回看刚读过的笔记会重新显示加载占位。
- 正文改为32篇/8MB双上限LRU缓存，命中时同步显示；当前正文稳定后才在交互空闲期预取前后各2篇。已物化附件按来源保存32篇会话缓存，返回刚读过的笔记不重新查询或显示占位；不扫描、预读或常驻全库。
- 新增`src/ui/loadingLabel.ts`作为普通读取等待态唯一文案，统一为`正在加载中..`；AI生成任务仍保留可核对的阶段、模型、Token与费用进度。
- 自动验证：TypeScript、前端198/198、正文/附件合同17/17、生产构建及v114隔离`--prepare / --verify`通过；EXE 38,726,656 bytes，SHA-256=`4E1B36CE4FFD470BA7E8DF3197E0DA8C76D6561960ECA33788A82B9361415EC9`。真实WebView2与正式库体感待南烛枫验收。

### v113 历史资料时间线加载与全格式卡片

- 根因确认：时间线每次打开都重新扫描所有来源的正文声明，并逐来源执行附件查询；随后一次挂载近千张卡片，导致全部附件、图片、视频、音频和文件的首次反馈共同变慢。
- `attachments::list_catalog_source_attachments`现在一次批量读取受控附件元数据，目录扫描不再发生按来源N次查询；原始导出包和附件实体仍不在该读取路径打开。
- 前端首次仅绘制120项，按月多列继续加载；已打开分类立即复用本地结果并后台刷新。时间线仍保留完整目录，不以截断伪装全部结果。音频卡提供原生播放、进度和音量；文件卡按真实格式进入统一软件内预览。
- `AttachmentTimelineDialog`默认占应用约80%，高度由弹窗本身持有、月份列表只消费剩余空间滚动，因此可同时调整宽高。前端附件合同9/9、Rust附件10/10、TypeScript、Vite生产构建、v113隔离`--prepare / --verify`通过；程序、正式数据与真实WebView2未启动或验收。

## 1. 当前结论

1. 产品方向已经锁定为三个核心入口：`主题洞察 / 全部笔记 / 主题管理`。它们不是旧页面改名，而是同一条知识生产链的三个阅读入口。
2. 自动整理是默认前提；人工只处理低置信、冲突或无合适主题的例外。旧记录中心、人工分类中心和 CRUD 首屏方向已明确否决。
3. 当前未提交工作区已按产品主规格、升级思路文档和四张最终功能图重组三个入口：
   - `主题洞察`默认`竞争假设`，可切换`判断演变 / 主题整合 / 决策版本`；
   - `全部笔记`以紧凑列表定位和大幅正文阅读为主体，自动整理信息压缩为必要元数据；
   - `主题管理`以主题边界、自动归类依据、层级关系、别名和可执行待处理事项为主体。
4. 主题洞察四个状态已按单一职责收口：`竞争假设`只管假设/证据/有效期/问题，`判断演变`只管判断变化与唯一时间线，`主题整合`只呈现一个整合成果并从右侧回溯原始笔记/来源，`决策版本`只管决策账本；中栏继续保持领域→主题，不重复增加笔记层。
5. 正式假设、判断或决策为空时，页面读取真实笔记/来源正文，确定性提炼竞争解释、支持/反对片段、阶段判断、开放问题和未执行的决策草案；来源标题不再冒充知识成果，所有派生内容可回到具体来源且不写回正式对象。自动候选必须是可独立理解的完整语义单元，聊天收尾、服务邀约和承接残句不得进入任何自动知识对象；决策草案明确显示来源、形成依据、待确认建议、未执行行动与尚未产生的实际结果。
6. 全部笔记与主题洞察已形成双向定位；来源详情首层只保留`返回上一级 / 查看详情`等详情级动作。`全部笔记 / 我的收藏 / 持续跟踪`三个可见列表的所有单篇条目共用`UnifiedNoteListCard + NoteListActions`；全部笔记的搜索、筛选、显示工具栏、状态行和定位条也已按我的收藏结构放到滚动列表之外，不再使用页面私有`sticky`遮罩。悬停/聚焦显示收藏、完整导出和更多，更多收口查看详情、持续跟踪、复制标题和软删除；菜单点击空白或按 Escape 关闭。`updated`只保留为历史状态与筛选兼容值。
7. 来源列表的顶部/滑块/当前控件只滚动、不改变当前选中来源；正文内文字功能明确称为“搜索”。软删除后来源立即从档案隐藏，恢复记录后重新显示。
8. 主题管理的结构缺口已连接到定向维护区；一级入口统一为`进入主题管理`，二级返回统一为`返回上一级`。领域与主题主卡可进入编辑模式，主题行可展开真实笔记并跳到来源档案。
9. 自动分类合同已按南烛枫要求改为：最高候选严格`>65`自动采用，`45–65`保留候选，`<45`人工处理；新导入与历史待整理使用同一裁决。
10. 手工标签与独立导入导出入口已从左侧导航移除；批量导入导出整合到`设置 → 数据与存储`。
11. 四套皮肤是独立视觉合同：`沙漠灯笼 / 花房 / 奔马 / 原版浅色`。铜金发簪已按南烛枫要求移除；四套共用同一外框几何。当前知识视图的材质处理方法是整套软件的场景材质基线，不等同于沙漠灯笼背景；原版浅色仍保留深蓝侧栏、冷灰工作区和白卡效果。
12. 最新内容闭环已进入代码：通用标题从正文派生；来源附件按来源对象直接读取 legacy 与 v4 关联，JPG/PNG 等图片直接显示；竞争假设删除重复`关键来源锚点`，证据条目保留唯一来源链接；假设核心观点字号略增，链接字号不变。
13. 正文自动跳转的最终根因已确认：即使输入框为空，主题洞察携带的旧证据`locatorJson`仍会在正文加载后被当成自动定位指令执行。现收回这条滚动权限：跨页请求只选中目标笔记并立即消费，普通打开、跨页打开和切换笔记都清空旧查询/高亮并回正文顶部；只有用户在正文搜索框提交本次关键词才定位。正文搜索历史与卡片二历史独立保存，点击历史项只回填，不自动搜索。
14. 所有关联线现统一为卡片到卡片几何：普通记录、来源档案、知识视图和主题管理都由`measureCardToCardConnector`按实时边界测量，左点压左卡右边缘、右点压右卡左边缘，线段只跨间隙；右侧阅读卡统一使用完整橙色线框，不再各页面使用`-2/+4`补偿。
15. 当前前端合同210/210、TypeScript、Vite、1702×1066知识最终视图E2E 1/1与v73 Windows Tauri隔离构建通过。定向合同已锁定控制区必须位于滚动列表之外，生产代码不得恢复`.knowledge-source-filters`、52px伪元素遮罩、`sticky`或负右边距；Chrome与隔离构建不冒充真实WebView2通过。
16. 场景皮肤下收藏/跟踪等记录列表的选中白卡已与其他前景白卡统一使用`--glass-card-strong`，降低透明感；橙色选中框、阴影和皮肤合同未改。
17. 来源档案列表已接入与收藏/跟踪/更新列表相同的单篇笔记操作组件；旧详情头重复动作已移除。
18. 南烛枫确认 v10 的右侧字号仍未完整落实。复盘发现旧测试只证明 CSS 中存在选择器，没有证明真实 DOM 消费；记录摘要、非对话正文和部分 Markdown 子元素存在漏网。当前知识四状态、来源档案正文和记录详情长短正文均显式接入`right-reading-copy-*`语义类，正文/列表/表格/标题按各自既有字号放大`1.3×`，链接、按钮、元数据和左侧列表保持原字号；六张截图继续作为受控参考资产。
19. 动态场景文字已从页面局部颜色提升为共享所有者：`deriveAdaptiveScenePalette`按背景相对亮度选亮/暗前景，按背景冷暖选相反色相，并分别保证主文字`≥5:1`、次要/强调文字`≥4.5:1`；复杂图片使用同方向光晕。图片前景与冷白磨砂卡内文字已拆为两套 Token，页面标题/说明/加载态和回收站嵌套空状态接入真实消费者。
20. 最新可见验收入口已更新为`启动南枫知识库-交互流畅度架构复验.bat`，对应独立目标`.runtime-qa/interaction-performance-v15-build`；Codex只执行了`--prepare / --verify`，没有启动程序或打开正式数据。
21. 导出结果提示改为画面正中心、2px橙色闭合边框和高对比`打开原路径`主动作；竞争假设保持现有排版，判断演变、笔记与来源、决策版本按统一阅读层级完整分组。E2E 已按职责拆清：兼容 Record 工具从辅助入口验收，最终三入口从知识/来源/主题真实布局验收，旧首屏 CRUD、固定关联线宽度和过时图标/菜单断言均已移除；活跃测试计划、领域规则和迁移路线文档明确区分当前入口与历史概念。
22. 知识视图领域已可折叠并在选中主题变化时自动展开所在领域；`我的收藏 / 持续跟踪 / 判断更新`的双主卡改用来源档案同类比例、14px间距和等高布局。1702×1066隔离浏览器实测来源档案左右卡335/1047px，记录入口339/1059px。
23. 本轮完成交互性能架构收口：99 个 Tauri 数据/文件命令改为异步调度；知识 Repository 合并重复 IPC 并有界缓存最近 8 篇正文；三入口按页面职责加载数据；搜索、长正文解析和知识读模型延后/记忆；滚动和 ResizeObserver 统一每帧测量一次并抑制亚像素重绘；长对话和知识卡离屏延迟绘制。功能、四态、五套皮肤、正式数据语义和列表定位未改变。
24. 自动验证更新为前端 125/125、Rust 74/74、Playwright 14/14、TypeScript、Vite 与 Windows Tauri `--no-bundle`通过；新增 200 篇长正文来源摘要性能合同通过。Playwright 统一验证生产构建预览，不再把 Vite 开发冷编译混入交互结论；内置浏览器已核对页面切换、笔记切换、搜索收敛、布局和关联线，无控制台错误。最新可见入口为`启动南枫知识库-交互流畅度架构复验.bat`，Codex 仅执行`--prepare / --verify`，没有启动应用或打开正式数据。
25. 最新阅读顺序按南烛枫同视口反馈再次收口：`判断演变`删除重复的轨迹概览，首屏先读`跨时期证据与知识事件`、再读版本差异；`决策版本`删除版本概览，直接进入完整决策链；决策来源链接并入每张卡片右上元信息。`笔记与来源`无独立笔记时空态在索引卡完整可用区域居中。
26. 来源档案标题区删除重复的职责眉题和已加载总数说明。来源列表的粘性筛选层级高于选中卡；滚动先清除旧关联线，再按下一帧真实边界重算，且只有选中卡完整处于筛选区下方的可读列表视口内才显示关联线，避免旧卡片与线穿透顶部控件。
27. 本轮验证为前端 129/129、Playwright 14/14、TypeScript、Vite 和 Windows Tauri `--no-bundle`通过。新可见入口为`启动南枫知识库-阅读优先与来源滚动修复验收.bat`，隔离目标`.runtime-qa/reading-priority-v16-build`已完成`Prepare / Verify`；Codex未启动该构建、未打开或写入正式数据。准备期间发现已有一个南枫知识库进程在运行，未对该进程做任何操作。
28. 来源档案搜索已从“当前已加载列表过滤”改为正式 Repository 全库查询：标题、平台、来源类型、主题名与完整`original_text`均可命中；搜索记录保存在本机界面偏好中，可清空；`全部加载`只控制列表浏览量，不限制搜索范围。来源标题可在详情区直接修改，并事务同步 legacy Record 标题。
29. 图片、PDF、文本/Markdown/JSON、音频和视频附件统一进入软件内最高层预览；不再把系统外部窗口作为首选。无法可靠内置渲染的格式才显示诚实提示并提供`打开原文件`后备动作。来源列表的单篇 Record 快捷操作默认隐藏，悬停/键盘聚焦时在卡片右侧垂直居中出现，不增加卡片高度；更多菜单含`查看详情`且继续支持外部点击/Escape关闭。
30. 本轮验证更新为前端 134/134、Rust 75/75、Playwright 14/14、TypeScript、Vite 与 Windows Tauri `--no-bundle`通过。新可见入口为`启动南枫知识库-全库搜索与内置预览验收.bat`，隔离目标`.runtime-qa/source-search-preview-v17-build`已完成`Prepare / Verify`；Codex未启动该构建、未打开或写入正式数据。
31. 四个单篇列表已收口为一套`UnifiedNoteListPanel + UnifiedNoteListCard`实现：面板磨砂外壳、条目结构与交互共享；标题下只显示真实`主题 + 来源`，日期固定右上；无意义的`0篇笔记`删除；按内容语义使用不同 Lucide 图标。来源行是否已有 legacy Record 不再决定按钮是否出现；首次执行收藏/导出/跟踪/删除时才按需建立且只建立一个兼容操作侧车，正式 source/topic 和 migration v4 语义不变。领域/主题缩进只移动图标与标题，右侧数量固定列对齐。
32. 本轮验证为前端138/138、定向Rust 1/1、Rust格式、TypeScript、Vite和Windows Tauri`--no-bundle`通过。新可见入口为`启动南枫知识库-四列表统一卡片验收.bat`，隔离目标`.runtime-qa/unified-note-list-v18-build`已完成`Prepare / Verify`；Codex未启动该构建、未打开或写入正式数据。本轮未重新执行Playwright或正式桌面同视口视觉验收。
33. 2026-08-01按南烛枫反馈修复来源档案工具栏偏离：记录入口与来源档案现在共同消费`UnifiedNoteListSearchRow / UnifiedNoteListToolbar / UnifiedNoteListLocator`，来源只保留`全部 / 待确认 / 已归类 / 全部加载`业务差异；搜索恢复完整圆角输入、清除动作与`Ctrl/⌘K`聚焦，状态行删除大橙框、小字号和错误深色滑轨。1702×1066内置浏览器已验证筛选打开、外部点击关闭、搜索聚焦/清除及控制台0错误；空库未显示有数据定位条，真实Windows WebView2仍待可见复验。
34. 本轮前端139/139、TypeScript和Vite生产构建通过；视觉证据与比较历史见`design-qa.md`最后一节及`docs/screenshots/qa/source-toolbar-v19-*.png`。未启动Tauri、未打开或写入正式数据。
35. 2026-08-01南烛枫指出预览窗口尺寸反复变化，无法直接比较修改前后。项目现把所有主预览、前后对比和最终视觉验收锁定为`1702×1066 CSS px / 100% / device scale factor 1`，并要求同主题、同数据、同状态、同裁切；Codex右侧/底部窄分栏和1280×720等视口只可作临时排查或明确的响应式专项，必须标注为“非对比证据”，不得再作为交付窗口或通过结论。`source-display-toolbar-unified-20260801-v2.png`已降级为诊断证据，最后一节Design QA在取得1702×1066 post-fix截图前改为blocked。
36. 固定桌面入口`启动南枫知识库-统一窗口验收.bat`已建立，脚本在准备、校验和启动前都会读取`src-tauri/tauri.conf.json`并强制要求1702×1066；旧隔离目标`.runtime-qa/standard-viewport-qa-build`曾完成`--prepare / --verify`。Codex没有启动应用、没有打开或写入正式数据；南烛枫双击BAT后才会以默认正式数据位置打开该标准窗口。
37. 2026-08-01四入口列表补齐小窗口密度合同：完整`YYYY-MM-DD`、默认紧凑、30px语义图标、标题最多两行、第二行只显示真实主题/来源；显示工具栏的`舒展/紧凑卡片 + 排序`固定为贴右操作组。首次只用0/6条判断“无重叠”被南烛枫否定，现已把999条纳入最小压力合同；1280×720专项实测右间距0px、摘要与操作间距8px，摘要/计数/操作无重叠或溢出。前端142/142、TypeScript、Vite与Windows Tauri通过；固定BAT的新目标`.runtime-qa/standard-viewport-v21-build`已完成`--prepare / --verify`，EXE为38,039,552 bytes，SHA-256=`F4750C8C1D51FD6AAF0007FB835139D92AB8F3CD790295846911AD531A94A203`。旧桌面EXE被运行中窗口占用后停止过时构建，没有关闭用户窗口，也未打开或写入正式数据。
38. 南烛枫在v21真实桌面继续确认操作组没有真正贴到最右，撤销此前“贴右通过”结论。共享工具栏现不再依赖网格剩余空间：操作组绝对定位`right:0`，左侧摘要固定预留156px；120条状态在1280×720实测按钮/工具栏右边缘重合、右间距0px、摘要/操作间距8px且无重叠/溢出。固定BAT已切到`.runtime-qa/standard-viewport-v22-build`并通过`--prepare / --verify`；EXE为38,039,552 bytes，SHA-256=`ED3733DCEBF6C180947ACFBF472D57D61ECCA7D56447FD1C2F204E7260F0E9D1`。Codex未启动应用、未打开或写入正式数据，v22真实桌面仍待南烛枫确认。
39. 南烛枫指出来源档案仍保留页面私有筛选，且v22为右贴错误吞掉左侧`来源档案`摘要。现已新增唯一共享`UnifiedNoteListFilter`，四入口共同消费筛选按钮、组合筛选浮层、字段渲染、重置/应用及外部点击/Escape关闭；来源仅传入来源/状态/主题/日期业务字段。显示工具栏改为左右独立定位：左侧入口名、计数、`条`完整保留，右侧卡片模式/排序继续`right:0`。1280×720空库来源页实测左摘要`clientWidth=scrollWidth=84`、右间距0、左右不重叠；前端142/142、TypeScript、Vite、Windows Tauri及v23 `--prepare / --verify`通过。EXE为38,040,064 bytes，SHA-256=`894142965C47F67CAC13197BE79B264B139A926B5D9AEF9D42FB91AE27A77102`；Codex未启动程序、未打开或写入正式数据，真实桌面仍待确认。
40. 南烛枫进一步锁定右侧收藏/导出/更多的显示标准：鼠标悬停卡片才显示，选中卡片或卡片自身焦点不得常驻；仅键盘实际聚焦操作按钮与菜单展开时保持可见。根因是共享卡片可聚焦而旧`:focus-within`把卡片焦点误判为操作焦点。现已删除来源页遗留私有可见性样式，并由共享`UnifiedNoteListCard`规则一次覆盖四入口；1280×720隔离浏览器确认“选中且卡片聚焦但无悬停”时操作透明度为0、不可点击，操作按钮键盘聚焦与菜单展开时透明度为1。前端143/143、TypeScript、Vite、Windows Tauri及v24 `--prepare / --verify`通过；EXE为38,040,064 bytes，SHA-256=`CB77C549F0FCCE7F6C59D9F461272D8B7A4093F5FCABD32BAB15C7A22BA3084B`。Codex未启动程序、未打开正式数据；物理鼠标悬停和1702×1066正式Windows桌面仍待南烛枫用固定BAT确认。
41. 南烛枫指出v24来源档案的组合筛选仍是假统一：`来源`显示`file`等类型、`状态`显示`待确认/已归类`，另外三个入口仍用`标签`。现已把共享层提升为字段定义、选项生成和匹配的唯一所有者；四入口字段固定为`来源/状态/主题/起始日期/结束日期`。来源档案按卡片同一真实来源名匹配；状态统一为`普通记录/持续跟踪/待验证/判断更新`，无操作侧车的来源按普通记录处理；来源整理状态仍独立保留下方状态行；主题由App一次读取正式主题目录，并与记录已关联主题合并后同时传给四入口。1280×720隔离浏览器四入口字段矩阵全部通过，且来源类型与标签均未出现；组合选择后6条正确收敛为2条。前端144/144、TypeScript、Vite、Windows Tauri及v25 `--prepare / --verify`通过；EXE为38,041,600 bytes，SHA-256=`0C3106DA7895956EA9CF55E89D8B5EB6BF5482B7EE377F51DC83F4376EA66E59`。Codex未启动程序、未打开正式数据；正式来源文件名和1702×1066桌面仍待确认。
42. 2026-08-01来源身份与来源显示已从“导入文件名”收口为migration v5统一目录：`source_collections`唯一持有四入口来源名，`source_import_origins`允许一篇笔记保留多个导入包/零散文件证据，`identity_sha256`按用户可见正文精确去重；提供方稳定ID优先，相似标题只提示、不自动合并。ChatGPT、Claude和零散文件分别统一为`ChatGPT 导入 / Claude 导入 / 零散文件导入`，目录可在共享筛选内重命名并同步四入口，原文件名/路径/哈希不变。正式库只读审计确认`ChatGPT_20260726.zip`517个ID与`conversations-004.json`100个ID交集为0，`conversations.json`实际是Claude结构，不能按文件名猜测删除。前端145/145、Rust82/82、TypeScript、Vite、Rust格式、diff check和v26 Windows Tauri通过；EXE为38,211,584 bytes，SHA-256=`7A78FE3378562ABD3A51C19D5EAC5D13416B13332714BDF5EE6A888616F404F8`。正式migration v5未执行，真实桌面重命名往返待南烛枫授权后验证。
43. 2026-08-01南烛枫指出单篇`052 个人八字丙午年壬辰月.md`已有明确标题，详情却用首个日期“2026年4月5日”充当标题。正式库只读核对确认该Source Item存储标题为历史占位`---`，原文件名与HTML显著标题均为“052 个人八字丙午年壬辰月”；旧读取层过滤HTML后误取`## 日期`。现已把标题优先级统一为`frontmatter显式标题 → 非日期一级/显著标题 → 有意义的原文件名 → 正文首行`，新MD/TXT/HTML导入、migration v5历史通用标题或纯日期标题回填、来源档案及兼容Record共用同一规则，非通用用户标题不覆盖。真实文件结构、新导入和历史回填定向合同通过；全量前端145/145、Rust83/83、TypeScript、Vite、Rust格式、diff check和v26 Windows Tauri通过。重建EXE为38,210,560 bytes，SHA-256=`E1781A38D1E382BF285574299C6ACFE9C2E4E0861FDB54DB3CC8DA484A5676BB`；正式库未写入，需随migration v5授权后才会回填真实标题。
44. 2026-08-01主题管理中栏不再保留平行领域/主题树：知识视图原有列表已抽为唯一`KnowledgeTopicHierarchy`，两个入口直接共用领域卡、主题行、折叠与当前领域自动展开、父子缩进、固定数量列、选中态、空态和滚动；主题管理只保留搜索/待处理筛选/新建等页面业务。旧`topic-final-tree/topic-final-domain-heading` JSX和CSS已删除。前端145/145、TypeScript、Vite、1702×1066知识/来源/主题/五皮肤E2E 1/1及v26 Windows Tauri通过；隔离截图为`.runtime-qa/knowledge-final-layout-evidence/topic-shared-knowledge-hierarchy-1702x1066.png`。重建EXE为38,210,048 bytes，SHA-256=`04335166D5BD94DAACFA64035D7D9E777FD0DA50589C06736F26628D1B7579D1`；程序与正式数据均未打开。
45. 2026-08-01南烛枫确认普通长正文、知识卡核心解释/提取依据和角色会话正文仍稍大，要求三类区域统一按当前尺寸缩小到`0.9`。唯一`NF-RIGHT-READING-TYPE-02` Token现把旧`1.3×`派生值整体乘`0.9`，最终为各自原始字号`1.17×`；正文、表格和Markdown标题同步，链接、按钮、角色/时间元数据、左侧列表、卡片结构与滚动不变。三张失败截图已进入受控设计基线。前端145/145、字号定向4/4、TypeScript、Vite、1702×1066知识/来源/主题/五皮肤E2E 1/1和v26 Windows Tauri通过。重建EXE为38,210,048 bytes，SHA-256=`DD02BE6A5BDE39586887CC5802DFCF58122769E9680E26F7D84717256A3BE94F`；程序与正式数据均未打开。
46. 2026-08-01主题详情标题区的`编辑主题`与下方`进入主题管理`职责重复，标题区按钮已删除；下方唯一维护入口、待处理事项与二级管理动作保持不变。新增静态唯一入口合同与1702×1066 E2E断言：`编辑主题`按钮为0、`进入主题管理`可见且可继续进入维护页。前端146/146、TypeScript、Vite、E2E 1/1和v26 Windows Tauri通过。重建EXE为38,210,048 bytes，SHA-256=`281E3BF36E81FC72030AE7490B52ABF7705433A65C1CBEF8C9BA1C0BA27C9E21`；程序与正式数据均未打开。
47. 2026-08-01南烛枫指出“无正式来源”不应再次变成用户逐个判断的任务。唯一`topicStructurePolicy`现明确把零来源视为中性覆盖状态：有意义的主题继续作为未来资料落点显示；主题管理已从待处理筛选、当前主题事项、右栏全局检查和高级维护统计四处移除“空主题”判断，只保留边界、别名、规则缺口与明确关系建议。合并/清理仍必须依赖独立结构证据，不能从来源数为零推断。前端149/149、TypeScript、Vite、1702×1066知识/来源/主题/五皮肤E2E 1/1及v27 Windows Tauri通过；EXE为38,210,048 bytes，SHA-256=`EBE0586CFC9568252D37DC29C59CFE7A1D6B7FDB617E6371A08013A05F6AEA2B`。程序与正式数据均未打开。
48. 2026-08-01南烛枫指出主题详情`层级与关联`在多数主题中固定显示“领域直属 / 暂无子主题 / 暂无关系 / 0个对象”，没有差异化阅读价值。唯一`topicStructurePolicy.topicHierarchyHasUsefulContent`现规定：顶层叶子主题整块隐藏；只有真实父主题或子主题存在时显示`主题层级`，并只列实际关系。关系建议继续由右侧待处理事项唯一展示，知识对象数量继续由自动归类依据唯一展示。前端151/151、TypeScript、Vite、1702×1066知识/来源/主题/五皮肤E2E 1/1及v28 Windows Tauri通过；EXE为38,210,048 bytes，SHA-256=`5C76329507EE8D273948478ACF1EEEF7BCF264602BAC2B935774A248587DE563`。程序与正式数据均未打开。
49. 2026-08-01南烛枫指出快捷键设置弹窗继承放大尺寸后内容挤在左上、比例和留白失衡。现为快捷键与数据存储分别设置独立弹窗尺寸身份，快捷键不再读取或保存通用弹窗尺寸，使用内容自适应居中布局；摘要改为真实`6项常用快捷操作`，六项快捷键改成两列卡片，小于760px转单列。1280×720和1702×1066定向E2E均验证居中、宽高范围、两列与无裁切；设置相关回归3/3、前端151/151、TypeScript、Vite及v29 Windows Tauri通过。EXE为38,210,048 bytes，SHA-256=`E70FD2D617E2CD900F46D3B306A5EDE58D512CD0D328A4AB089DCB8E81990B`。程序与正式数据均未打开。
50. 2026-08-01南烛枫指出主题管理`返回上一级`紧贴右边且与向上滚动内容视觉穿插。排查确认可见问题属于共享`knowledge-secondary-maintenance`次级维护层；设置和导入返回按钮处于正常文档流，无覆盖结构。共享层现统一为固定控制区与独立正文滚动区，主题管理按钮右移变量改为`clamp(40px, 3vw, 58px)`以向左留白，正文裁切边界固定在按钮下方。1702×1066 E2E验证右侧间距≥38px、按钮与正文间距≥8px、长内容滚动前后按钮及裁切边界位移<1px；前端151/151、TypeScript、Vite、知识/来源/主题/五皮肤E2E 1/1及v30 Windows Tauri通过。EXE为38,210,560 bytes，SHA-256=`32CEE89906A8B93B8F114D5320EB23813B78B1CF4AB441A7FB56335C89871E2B`。程序与正式数据均未打开。
51. 2026-08-01南烛枫询问来源档案顶栏托盘图标的实际作用。代码确认它只是无事件、无状态、无标签的`Inbox`装饰图标；新增功能会与同栏`自动整理待归类来源`和下方来源状态筛选重复，因此按实际价值删除。顶栏现只保留真实整理动作，并增加“一个按钮、零个直属孤立SVG”的1702×1066 E2E合同；同类排查确认主题维护页同尺寸图标已由页面CSS隐藏，知识维护入口本身为隐藏次级区，没有新增可见孤立图标。前端151/151、TypeScript、Vite、知识/来源/主题/五皮肤E2E 1/1及v31 Windows Tauri通过。EXE为38,210,048 bytes，SHA-256=`70B4D5BC620FF83EB3DA84E1A9EE2FFA91F604F724391D36D679943E8A2012FD`。程序与正式数据均未打开。
52. 2026-08-01南烛枫确认来源正文工具区的`正文预览`没有实际意义，要求直接删除。该标签只在正文超过预览上限时显示，不承担状态、操作或警告职责；现已从共享来源正文实现移除，保留`来源正文`标题、搜索、查看详情及内部截断性能策略。新增静态长正文合同与1702×1066 E2E无标签断言；前端152/152、TypeScript、Vite、知识/来源/主题/五皮肤E2E 1/1及v32 Windows Tauri通过。EXE为38,210,048 bytes，SHA-256=`664C54AD829B60706DEAD3621B9D9D7157A203922E7C6FA56273033221945FD0`。程序与正式数据均未打开。
53. 2026-08-01南烛枫要求完整笔记导出弹窗默认更大，并让底部格式说明默认展示。根因是旧弹窗上限仅1120×860、外层与正文存在双重滚动，且历史v2尺寸偏好会覆盖新默认。现将弹窗改为约90vw×90vh、最大1460×980并启用独立v3尺寸身份；标题、导出按钮和底部说明固定，只有中间正文独立滚动。1702×1066标准视口与1280×720响应式专项均验证说明完整可见、弹窗外层无滚动；前端153/153、TypeScript、导出弹窗E2E 1/1、Vite及v33 Windows Tauri通过。EXE为38,210,048 bytes，SHA-256=`82A38CCCB135D012392F02EE265B5164E1F6080FA33E7942DA5BF3FCAF15E5A7`。程序与正式数据均未打开。
54. 2026-08-01南烛枫指出来源详情标题区`返回主题来源 / 查看详情`比例过大且位置偏高。唯一`.knowledge-detail-actions`动作组现统一为30px高度、12px文字、13px图标和6px间距，并从标题区顶边下移24px，与来源标题顶边对齐；条件出现的分类建议动作消费同一组比例，导航、查看详情、右对齐和五套皮肤不变。第一次测量发现18px仍高于标题6px；第二次补丁因相同文本误命中未改变真实规则，按深度排查回到CSS层叠后锁定唯一选择器完成修复。1702×1066 E2E 1/1、前端153/153、TypeScript、Vite及v34 Windows Tauri通过。EXE为38,210,048 bytes，SHA-256=`769CB35091839D0DEAF71CD9D556E8FB3F127569DD2E8DBD756D452124E9B59D`。程序与正式数据均未打开。
55. 2026-08-01南烛枫要求图片附件预览默认全屏、可人工调窗、图片完整显示，并支持Ctrl+滚轮缩放和左键平移。唯一`AttachmentPreview`现默认使用视口减8px四周安全边距，图片按`contain`适配；右下角独立缩放把手避免与图片拖拽抢指针；Ctrl+滚轮改为`passive:false`原生监听并以光标为中心在25%–800%缩放。1702×1066内置浏览器实测默认窗口1686×1050、图片完整加载，窗口缩至1408×858，左键平移100×60px；前端156/156、TypeScript、Vite及v35 Windows Tauri通过。EXE为38,211,584 bytes，SHA-256=`7A1CE3861DD6EA2378BDA6F83E82B304B8981FD3FDEE7C2C33BC95AA1728F02D`。控制接口未能合成可观测Ctrl滚轮，物理Ctrl滚轮和真实Windows WebView2仍待南烛枫用BAT确认；程序与正式数据均未打开。
56. 2026-08-01南烛枫否定主题结构维护页顶部集中堆叠`添加领域 / 添加主题 / 完成编辑`和行内编辑表单。现顶部只保留`编辑 / 完成编辑`；编辑态把`添加主题 / 编辑领域`下沉到领域行，把`添加子主题 / 编辑主题`下沉到主题行，并在列表末尾提供`添加领域`。四类详情由唯一`topicStructureDialog`弹窗承载，支持遮罩与Escape关闭；既有Repository写入、ID和关系语义不变。1702×1066应用内浏览器完成默认态、编辑态、领域/主题/子主题新增和领域/主题编辑弹窗检查；1280×720实测2个领域头与6个主题行均无重叠或横向溢出，最终预览控制台error/warn为0。前端157/157、TypeScript、Vite及v36 Windows Tauri `--no-bundle`通过；EXE为38,212,096 bytes，SHA-256=`FDF03465642245CBED2BC23090C6A6E6A45E2C1FD01F84B67FEC391C91A614E8`。Codex未启动应用、未打开或写入正式数据。
57. 2026-08-01南烛枫确认将设置内存储功能按实际价值重新分层。数据交换页现只保留批量导入与内容导出；`设置 → 数据与存储`新增唯一`备份与恢复`区，把完整备份创建与恢复成对放置；打开目录、完整性检查、索引重建和数据库快照创建/恢复进入默认折叠的`高级维护`。原`数据库备份`统一改称`数据库快照`并显式说明不包含附件、导入原件和界面设置；底层备份格式、恢复预览、恢复前安全备份和失败回滚均未改变。前端158/158、TypeScript、Vite和diff check通过；1702×1066内置浏览器核对默认折叠、展开布局和数据交换导出页无完整备份入口。v37 Windows Tauri `--prepare / --verify`通过；EXE为38,212,096 bytes，SHA-256=`E649847387C74AE79D060EC1397AA86F88155C4571A71BC0E65FA4FCCD2B2A45`。未点击任何备份/恢复按钮，未启动应用、未打开或写入正式数据，Windows真实桌面待确认。
58. 2026-08-01南烛枫指出批量导入导出页应`返回上一级`并直接回到数据与存储窗口，同时旧数据与存储弹窗过小、备份恢复拥挤、数据交换按钮比例过大且窗口不能调节。现由App保存唯一`data-storage`返回目标：普通侧栏导航会清理目标，设置内或快捷键进入数据交换则保留目标，点击`返回上一级`后直接重开数据与存储弹窗。弹窗切换到独立`storage-settings-dialog-v2`尺寸身份，1702×1066默认1040×760，右下角可人工调节且边框尺寸稳定保存；存储概览为四列，数据交换和备份恢复分成0.82/1.45双区，数据交换按钮缩小，备份范围收口为单行说明，高级维护保持折叠。内置浏览器实测弹窗1040×760、内容区976×524且无横向/纵向溢出，实际点击`打开批量导入与导出 → 返回上一级`后弹窗重新出现，运行日志仅含Vite与React开发提示，无error。全视图和聚焦区同屏比较均无P0/P1/P2。前端159/159、TypeScript、Vite、diff check和v38 Windows Tauri `--prepare / --verify`通过；EXE为38,213,632 bytes，SHA-256=`65A89DC7CA9E1E93A327B2E55A40F630E01137020F61928E701A5FEF553BD00D`。未点击备份/恢复、未启动桌面应用、未打开或写入正式数据，真实鼠标调窗与正式桌面仍待南烛枫确认。
59. 2026-08-01南烛枫进一步要求数据交换与备份恢复去除重复说明、统一双卡尺寸，并补充外部删除备份后统计未同步的问题。两张卡现为1:1等宽等高网格，每张只保留一个标题、一句提示和贴底操作区，删除重复`批量导入与导出 / 完整备份适合换机与灾难恢复 / 备份范围`。App新增唯一并发合并的存储刷新所有者：重新获得焦点或恢复可见时自动扫描，主界面容量区和设置`存储概览`共用刷新图标与结果。1702×1066内置浏览器实测两卡均458.5×120.05px、操作底边一致、两个刷新入口均反馈成功、无重复文案/范围节点、日志无error；前后对比无P0/P1/P2。前端161/161、TypeScript、Vite、diff check与v39 Windows Tauri `--prepare / --verify`通过；EXE为38,212,608 bytes，SHA-256=`531DA085E43D312960CF50677DF7082C57F7E3FFB3A26564D0FF41BC8C48BCAC`。底层`storage_stats`每次调用实时扫描数据库、导入原件、附件和备份目录；本轮未删除或恢复文件，正式Windows外部删除后的数值变化仍待南烛枫用固定BAT确认。
60. 2026-08-01南烛枫确认主题排除能力应由软件默认持有，不要求普通用户补写技术规则。个人目录升级为v7：非`职业发展与岗位选择`主题由软件托管`招聘启事 / 岗位职责 / 简历投递`三项0.55排除信号，职业主题不排除；只降低误归类候选分数，不删除来源、不覆盖原文或既有归类。日常主题详情无有效排除项时隐藏整块，有效时只读显示最多五项`自动排除`及“不删除来源”说明；`补充/调整排除规则`、自动归类依据中的`维护`、缺少规则的待处理事项和筛选信号均已删除，高级维护完整编辑保留。问题参考与1702×1066实现证据`topic-exclusion-system-owned-reference.png / topic-exclusion-system-owned-implemented.png`已纳入设计基线。前端163/163、Rust84/84（knowledge 36/36）、TypeScript、Vite、Rust格式与定向E2E通过；未启动桌面应用、未读取或写入正式数据，v7正式目录应用与真实桌面观感待确认。
61. 2026-08-01南烛枫要求把旧详情中有价值的`当前判断 / 已确认事实 / 关键证据 / 待验证问题 / 下一步行动`统一自动生成到知识视图，并解决信息埋在长滚动下方的问题。新增唯一`buildKnowledgeOverview`：正式对象优先，空缺时复用正文派生结果；事实/结论与来源证据分开，自动项明确标记，建议行动不写库、不伪造完成。右侧首屏改为一条当前判断和四张102px紧凑摘要卡，完整内容仍由原四个Tab持有。前端166/166、TypeScript、Vite、1702×1066 Chrome E2E 1/1通过；摘要在Tab之前无需滚动完整可见且无横向溢出。参考、实现与同屏比较已保存，未启动桌面应用、未读取或写入正式数据，正式Windows WebView2及真实主题生成质量待确认。
62. 2026-08-02南烛枫要求本次直接生成BAT，并规定以后完成可见功能默认同步生成或更新中文验收BAT。项目`AGENTS.md`已固化该交付规则；本次新增`启动南枫知识库-知识摘要首屏验收.bat`与唯一`launch-knowledge-overview-qa.ps1`，支持`--prepare / --verify`，默认双击才使用正式数据路径。v40隔离构建和只读校验通过，EXE为38,218,240 bytes，SHA-256=`DE918F56C7FC4033793AED454DF1D80EC7DB9E0AC0F8447F2A4488113F2199C0`；Codex未启动应用、未读取或写入正式数据。
63. 2026-08-02南烛枫指出知识四态的眉题、方法说明、编号步骤卡和低价值小字共同挤占主要内容，并明确把“小字只有帮助判断、定位或操作才保留”提升为所有软件开发的统一标准。全局`docs/app-development/architecture-baseline.md`与长期偏好已固化该规则。知识视图现由Tab唯一表达状态身份，四态正文统一14px起始内边距并直接进入主要对象；删除主题头重复计数、通用介绍、技术空态、笔记活动状态和决策四格重复详情，空态全部压缩；日期、来源、置信度、有效期、证伪条件、真实风险、时间线筛选及决策阶段继续保留。新增四张失败参考、168项前端合同和`启动南枫知识库-四态主要内容优先验收.bat`；TypeScript、Vite及v41隔离`--prepare / --verify`通过，EXE为38,217,216 bytes，SHA-256=`F2C03BD62F2E6B369A12F65C05C596D864E6759B01B888AC6DDA30C1B558E4FA`。未启动桌面程序、未读取或写入正式数据；四态正式内容同视口观感待南烛枫双击BAT确认。
64. 2026-08-02南烛枫指出知识摘要四卡只显示两条截断文本，底部查看操作又无法打开完整内容。四卡现共用唯一`KnowledgeOverviewDialogState`与弹窗实现：卡片保持两条首屏预览，`查看全部`逐条显示该类别全部摘要且不省略；支持关闭、Escape、点击遮罩、焦点恢复、弹窗内部滚动和进入对应既有深读状态。失败截图已纳入设计基线；前端169/169、TypeScript、Vite、diff check与v42 Windows Tauri `--prepare / --verify`通过，EXE为38,218,240 bytes，SHA-256=`9872FC09219725AF686DFC1D97594FF60F925A89836EF22074D1FE15A3314136`。新增`启动南枫知识库-知识摘要完整内容弹窗验收.bat`；Codex未启动程序、未读取或写入正式数据，正式Windows点击与长文本观感待南烛枫双击BAT确认。
65. 2026-08-02南烛枫要求图片预览外围统一暗底突出图片，并规定中键点击图片恢复当前窗口完整适配。唯一`AttachmentPreview`图片分支现独立使用暗色外壳、标题栏和画布，不影响PDF/文本/音视频；中键按下与auxclick都阻止默认行为并复用唯一视口重置，把缩放恢复100%、位移恢复0。1702×1066应用内浏览器实测左键平移70×45px后中键恢复0×0与`scale(1)`，外壳/标题栏/画布计算色为`rgb(11,16,23) / rgb(21,28,37) / rgb(8,12,18)`。前端169/169、TypeScript、Vite与v43 Windows Tauri `--prepare / --verify`通过，EXE为38,218,240 bytes，SHA-256=`F035F5175F1A5CDA420AE4B2D357802E75EFA9B950491CA925E5E8CD2A50BC5E`。新增`启动南枫知识库-图片暗底与中键复位验收.bat`；Codex未启动Windows应用、未读取或写入正式数据，真实物理中键和WebView2观感待南烛枫双击BAT确认。
66. 2026-08-02南烛枫要求删除来源档案正文顶部重复大标题。`KnowledgeWorkspace`来源分支现不再渲染`<h1>来源档案</h1>`，侧栏入口继续承担页面身份；顶栏改为只承载右上唯一`自动整理待归类来源`按钮，下间距由18px压缩为10px，搜索、筛选、列表、详情和分类语义不变。前端170/170、TypeScript、Vite与v44 Windows Tauri `--prepare / --verify`通过，EXE为38,218,240 bytes，SHA-256=`3D92664A2168697869111796E87D4D0F169DACDF0E6B74611AAB4AAD387BF3AA`。新增`启动南枫知识库-来源档案标题删除验收.bat`；本轮应用内浏览器本机导航连续超时，未使用空白页冒充视觉证据，正式Windows位置待南烛枫双击BAT确认。Codex未启动Windows应用、未读取或写入正式数据。
67. 2026-08-02南烛枫将操作流畅度列为最高优先级，明确要求从底层处理来源档案及其他入口卡顿。代码复盘确认旧性能文档与现状冲突：来源点击链实际同时等待目录提案、别名、实体、规则和来源目录，并可能应用目录；随后历史分类在WebView主线程每10条才让权。现新增`knowledgeWorkspaceData.ts`明确入口数据所有权：来源首屏只等轻量档案，筛选/主题名称在450ms交互保护后补齐，主题维护对象只在主题管理读取；同一Repository与会话轻量快照避免重新挂载空白。确定性分类统一迁入独立`classification.worker`，历史升级延后1.2秒、逐条让出主线程、离开入口即取消；收藏/跟踪/判断更新范围切换使用延后渲染，导航计数不再每次点击重复扫描。前端177/177、TypeScript、Vite和v45 Windows Tauri`--prepare / --verify`通过，Worker产物86.08 kB，EXE为38,243,328 bytes，SHA-256=`F7969A88E4650030C3F2DCC5D8F23E225CC815C42BFA85DA6D9884181CC6B1CE`。Playwright 16/17；唯一未过为知识视图直接阅读模式既有横向溢出几何合同，与本轮性能链无调用关系，未擅自改布局。已更新`启动南枫知识库-交互流畅度架构复验.bat`至`.runtime-qa/interaction-performance-v45-build`；Codex未启动应用、未读取或写入正式数据，正式来源规模下的桌面点击体感仍须南烛枫双击BAT确认。
68. 2026-08-02南烛枫要求原版浅色与玻璃皮肤统一布局位置但保持效果，并删除铜金发簪。唯一`knowledgeSkins.ts`目录现固定为`沙漠灯笼 / 花房 / 奔马 / 原版浅色`，旧`bronze-botanical`偏好按未知值回退默认皮肤；资源文件同步删除。外框几何已从场景皮肤私有分支提升到共享`.app-shell / .sidebar / .main-region / .brand`，四套统一12px外边距、14px间隙、214px导航栏、18/20px圆角和内部起点；原版浅色深蓝侧栏、冷灰工作区、白卡以及场景皮肤背景/磨砂效果均不改。设置页改为四列，不保留空槽。前端179/179、TypeScript、Vite生产构建、1702×1066应用内浏览器切换/同屏比较和v46 Windows Tauri`--prepare / --verify`通过；场景/原版侧栏与主区几何完全一致，控制台error/warn为0。EXE为34,862,592 bytes，SHA-256=`800862CC9DB8651B1C550EDB18E15C3A8E9F0D8131C8B31482052487E24C0A0A`。新增`启动南枫知识库-四套皮肤统一布局验收.bat`；Codex未启动Windows应用、未读取或写入正式数据，真实WebView2切换观感待南烛枫双击确认。
69. 2026-08-02南烛枫反馈来源档案中的无效笔记多次删除后仍会重新出现。定向失败合同确认根因：永久删除关联 Record 时，`source_items.legacy_record_id`因`ON DELETE SET NULL`被清空，但 Source Item 仍是`active`，来源查询便把它误判为未关联的新来源。`database::permanently_delete_record`现于同一事务内先归档关联 Source Item，再删除 Record；软删除仍立即隐藏且可从回收站恢复，永久删除后重载不再反弹，原始来源审计行不做物理硬删。新增“来源→软删除→恢复→再次删除→永久删除→重载”Rust合同和`启动南枫知识库-来源删除不反弹验收.bat`。Rust 85/85、TypeScript、Vite生产构建、Rust格式、diff check及v47 Windows Tauri`--prepare / --verify`通过；EXE为34,863,616 bytes，SHA-256=`1AAF0F4859A7A5EEA9187F80A71253D8D34BA5342C2822AD1FD3D9A0985B05AB`。Codex未启动应用、未读取或写入正式数据库；已经因旧逻辑反弹的当前条目，需要用新构建再移入回收站并永久删除一次。
70. 2026-08-02南烛枫反馈图片在内置预览中放大后明显比原文件模糊。代码确认受控附件由Rust逐字节复制、没有JPEG重编码；失真风险来自前端先把`<img>`强制缩成画布100%尺寸，再对适配结果做CSS放大，顶部505%也不是原图像素比例。唯一`AttachmentPreview + imagePreviewViewport`现改为读取`naturalWidth / naturalHeight`建立原始像素渲染面，首次只计算完整适配比例且不放大小图，顶部100%代表原图1:1；Ctrl+滚轮仍以光标为中心缩放，中键恢复当前窗口适配，调窗仅在仍处于适配态时自动重算，已放大/平移检查位置保持。失败参考`attachment-image-preview-quality-loss-reference.png`已纳入设计基线。前端181/181、TypeScript、Vite、Rust附件5/5、diff check及v48 Windows Tauri`--prepare / --verify`通过；EXE为34,864,128 bytes，SHA-256=`C0B4E3D7840E1E3EE699BCA4DB5F8EC14E359B4AC0F532DA222BCFA12A5397DE`。新增`启动南枫知识库-图片原图保真验收.bat`；Codex未启动应用、未读取正式图片或数据库，原文件与真实WebView2并排清晰度仍待南烛枫双击BAT确认。

71. 2026-08-02南烛枫锁定当前知识视图的苹果式浅玻璃处理方法为南枫知识库整套软件的共同场景材质标准，并明确它不是“沙漠灯笼效果”。样式唯一所有者现统一侧栏、页面外壳、浏览区、正文、控件、浮层与弹窗六类配方；沙漠灯笼、花房、奔马只保留各自背景和冷暖环境色，来源、主题、记录入口、设置、回收站、搜索筛选、导入导出和各种状态均消费同一层级规则。旧通用场景样式中的连续等亮白描边已移除，外层在2px窄边内与真实背景融合，正文内卡保持更实；侧栏信息不再靠整组降透明表达层级。来源档案搜索框已从灰色承托面中提亮为统一明亮输入层。原版浅色与媒体专用暗底不被强行玻璃化。项目设计基线、验收矩阵及`develop-nanfeng-knowledge-base / designing-nanzhufeng-app-skins / build-apple-inspired-cross-platform-products`相关Skill已同步。前端185/185、TypeScript、Vite、1702×1066四皮肤与知识/来源/主题E2E 1/1、v50 Windows Tauri`--prepare / --verify`通过；EXE为34,866,176 bytes，SHA-256=`FDEC3D5EF2FC0B4765DF0DEC32D06F192180A03C03230E302414C96FD54FE63C`。最新入口为`启动南枫知识库-场景皮肤材质统一验收.bat`；Codex未启动应用、未读取或写入正式数据，全软件真实WebView2逐页观感待南烛枫双击确认。

72. 2026-08-02南烛枫要求修复来源档案卡片二/三之间必须先点击才能稳定滚动的问题，并明确扩展到全软件全部同类独立滚动卡片；随后补充渐变斜向色阶锯齿、来源卡片二滚动时顶部控制区位移、搜索/筛选不够突出且筛选文字偏重、内部卡偶发纵向亮块，以及顶部全局整理按钮过度占用三张主卡空间。现新增唯一`hoverWheelRouting`所有者：来源档案、三个记录入口、知识视图和主题管理只声明卡片与真实滚动层，文档捕获阶段按悬浮位置立即路由普通纵向滚轮，内层独立滚动区优先，不改变焦点，也不劫持Ctrl/Cmd缩放或横向滚轮。来源卡片二已把搜索、筛选、排序、计数和快速定位从旧整卡滚动+sticky拆为固定控制头，只有`.knowledge-source-list-scroll`滚动；记录、知识和主题主消费者已是同结构并由合同锁定。共享场景材质及竞争假设等局部渐变统一叠加极轻中性抖动纹理，打散色阶但保持现有配色、冷暖、透明度、结构与边缘融合不变。2px双层遮罩收回到侧栏/页面外壳，内部滚动卡和控件不再参与WebView2高风险mask合成；其材质效果保留。四个列表入口统一采用亮于卡片的搜索/筛选表面，筛选点击框保持42px并改为21px胶囊圆角、12px文字和15px图标；知识/主题搜索同步亮度。来源页独立动作栏已删除，三卡从页面顶部直接开始；全局整理动作作为30px`自动整理`按钮进入卡片三既有标题动作组，完整语义保留在可访问名称与提示。前端189/189、TypeScript和1702×1066知识/来源/主题/四皮肤E2E 1/1通过；E2E真实执行卡片二→卡片三标题区→卡片二的无点击滚轮切换，断言固定控制头位移0px，核对搜索/筛选实算样式及整理动作新位置。v51 Windows Tauri已在隔离应用目录完成`--prepare / --verify`，EXE为34,867,200 bytes，SHA-256=`685FB3F579BDF348A23EBC556D6CC962D4D430804F747C63FCD83528C23CD1C6`；Codex未启动应用、未读取或写入正式数据。
73. 2026-08-02南烛枫指出大面积白色空状态卡材质过于单一，且要求卡片一所有入口统一采用回收站示例中的明确点亮态。根因由1702×1066实算样式复现：辅助分组和底部区域的文字色选择器权重高于统一`.nav-item.active`，导致相同背景下核心、辅助和底部入口的选中文字仍不一致。该规则现限定为只作用于`:not(.active)`；全部入口统一使用暖橙文字/计数/侧条、完整浅暖边界、白暖径向+线性渐变和克制抬升。新增统一状态表面Token，用顶部场景高光、冷色中段、底部暖色回响与中性抖动替代空状态的单一白块，不新增硬白描边。前端190/190、TypeScript、1702×1066 E2E 1/1及v52 Windows Tauri`--prepare / --verify`通过；E2E比较核心/辅助/底部三类选中态的背景、阴影、文字与圆角完全一致，并保存`.runtime-qa/knowledge-final-layout-evidence/sidebar-active-and-empty-state-material-1702x1066.png`。EXE为34,868,736 bytes，SHA-256=`6C20E04CF67BEEEA64C138C973423B254F6E8030C33A97FEC2A1680D284DF1AE`；Codex未启动应用、未打开正式数据。
74. 2026-08-02南烛枫指出纵向图片首次打开没有真正完整居中，并强调软件窗口会随时调整、不得按固定尺寸设计；随后明确鼠标中键应让图片快速全屏显示。代码复盘确认不是1702×1066常量，而是两个底层竞态：`onLoad`在弹窗/标题栏完成布局前直接测量画布，以及旧逻辑从浮点缩放值和位移反推是否仍在自动适配态，首次偏差可能被后续调窗误当成用户位置保留。`AttachmentPreview + imagePreviewViewport`现建立明确`fit/custom`模式；图片加载后的layout阶段按真实画布和20px安全留白测量，图片改为画布中心绝对定位，不再让Grid用未缩放自然尺寸盒决定视觉中心。ResizeObserver、window与visualViewport共同跟踪实际尺寸；fit状态随软件窗口和预览器任意变化持续完整适配，只有实际滚轮缩放或拖动才进入custom并保留查看位置。鼠标中键会恢复预览器全屏，再按最新画布归零、完整适配和居中。前端191/191、TypeScript、Vite及v53 Windows Tauri`--prepare / --verify`通过；EXE为34,867,712 bytes，SHA-256=`F41876D2A93C7F587A8EB5042956A37FBEA712CF7E7FE3767840732B52C46BB4`。未启动应用、未读取正式图片或数据库；真实WebView2连续调窗和物理中键仍待南烛枫确认。
75. 2026-08-02南烛枫用当前构建再次确认列表空态左侧纵向亮块仍未消失。按深度排障将截图几何与DOM对齐后确认，亮带位于卡片一`.record-pane`左侧约30px，不是外层背景；上一轮只移除内部双层mask，仍遗漏了该卡片在已经模糊的`.records-workspace`内再次使用`backdrop-filter`。失败合同先复现内部导航卡仍为实时blur；现改为外层工作区只做一次场景取样，卡片一、来源浏览卡、知识/主题树卡及常驻搜索筛选层保留原渐变、透明度、抖动和阴影，但不再建立第二个GPU滤镜合成面；浮层/弹窗和外层磨砂不变。前端192/192、TypeScript、Vite及1702×1066知识/来源/主题/四皮肤E2E 1/1通过；E2E实算确认外层仍为blur，内部导航卡和常驻控制层均为none。v54 Windows Tauri已完成`--prepare / --verify`，EXE为34,867,712 bytes，SHA-256=`E11B1E52CFCC52E42593A17CA317FC153E5EC0E3B16EF3B401C41CE0C68C21EB`。最新入口为`启动南枫知识库-WebView亮块修复验收.bat`；Codex未启动应用、未读取或写入正式数据，真实WebView2 GPU重绘路径仍待南烛枫确认。
76. 2026-08-02南烛枫指出卡片一及卡片二/三最前层表面在不同背景衬托下仍显灰，要求按相对色差统一全软件且不能写死白色数值。根因确认是共享CSS虽已统一材质角色，却仍为导航、工作区、正文和内部卡分别写死低透明度，导致相同数值在不同背景与父层上产生不同视觉亮度，甚至最前层主卡比内部小卡更暗。现由`deriveAdaptiveScenePalette().material`唯一采样背景相对亮度与冷暖，动态派生承托、卡片一直接前景、卡片二/三工作区前景、嵌套内容和高频控制五级表面；`App`只注入语义Token，所有页面按角色消费，语义绿/红等状态色继续叠加在同一明度骨架上。亮背景会先收束承托再提高前景纯白度，暗背景则减少无意义泛白；最前层主卡相对直接父层保持稳定明度差且不低于内部小卡观感。前端194/194、TypeScript、Vite及1702×1066知识/来源/主题/四皮肤E2E 1/1通过。v55 Windows Tauri已完成`--prepare / --verify`，EXE为34,868,224 bytes，SHA-256=`919ADF2FA178B5AD77FAC05052DF1D1A17CA20EB2C91A6D29A025CBEF211D72E`。最新入口为`启动南枫知识库-自适应卡片亮度验收.bat`；Codex未启动应用、未读取或写入正式数据，真实WebView2跨皮肤相对亮度仍待南烛枫确认。
77. 2026-08-02南烛枫真实截图否决v55的抬亮方法：覆盖率升高让苹果玻璃变成实色白板，冷色补偿又造成明显蓝绿染色；同时要求来源固定选项栏继续保留下方卡片滑过时的半透磨砂精华。v56按深度排障重新划定材质所有权：五级材质角色的透明度和模糊职责固定为已确认的苹果玻璃基线，背景自适应只在低色度珍珠白范围内改变明度；其中大面积承托面和嵌套面的材质基准完全中性，RGB最大通道差不超过4，其他方向高光不超过8，不再按背景冷暖生成反向补偿。共享CSS恢复冷/暖/高光多段方向渐变，环境色只由真实背景透入，语义绿/红仍只作用于状态卡。来源筛选头已移入`.knowledge-source-list-scroll`真实滚动层并使用`sticky`固定，卡片从其下方经过时通过固定透明渐变、底部承影与18px淡出表现内容经过；该常驻层保持`backdrop-filter:none`，不恢复v54已排除的WebView2嵌套滤镜亮块。前端195/195、TypeScript、Vite及1702×1066知识/来源/主题/四皮肤E2E 1/1通过；E2E实算验证控制头属于滚动层、位置固定、滚动边缘状态切换且无二次模糊。v56隔离EXE已生成并通过`--verify`，大小34,868,736 bytes，SHA-256=`96292D276E9EB04F041822C779DE7315364D18C156F83B7E12EDE25BC0CB1A39`。最新入口为`启动南枫知识库-苹果玻璃亮度重构验收.bat`；Codex未启动应用、未读取或写入正式数据，真实Windows WebView2的通透度、染色和滚动承影仍待南烛枫双击确认。
78. 2026-08-02南烛枫明确否决v55/v56作为后续视觉基础，要求全部回到v54 WebView亮块修复版的固定材质配方继续。代码已移除`AdaptiveMaterialPalette`、运行时材质Token、蓝噪点资源及对应错误合同，恢复v54的侧栏/导航/工作区/正文/控件固定渐变、透明度、抖动和外层单次模糊职责；来源固定控制头的结构性滚动修复继续保留。随后统一清理`RecordsWorkspace`共享旧详情：`当前判断 / 已确认事实 / 关键证据 / 待验证问题 / 下一步行动 / 历史版本`及其空卡、弹窗和快捷编辑不再出现在普通记录、我的收藏、持续跟踪、判断更新；详情只保留来源标题、摘要/原文、附件、收藏和来源记录编辑，编辑弹窗同步删除旧字段入口。数据库兼容字段、历史数据、导入导出协议和知识视图内正式判断结构均未删除。前端195/195、TypeScript、Vite、1702×1066 Chrome E2E 1/1及v57 Windows Tauri隔离应用`--prepare / --verify`通过；EXE为34,866,176 bytes，SHA-256=`70CDECD2544638501EF70ABD21DA00E1E01E61388DB73052AA8DCAF69D830788`。当前入口为`启动南枫知识库-来源档案统一验收.bat`；Codex未启动应用、未打开或写入正式数据。
79. 2026-08-02南烛枫在v54恢复版上继续指出四类局部精细度问题：卡片一和卡片三的大承托面纯白感抢内容、侧栏选中态右侧被刻意压暗、来源固定筛选区下方内容仍可读且滚动穿插出现白色硬块，以及大卡边缘再次出现连续细白线。v58只在v54固定材质职责上做局部收口：降低侧栏/正文大承托面的纯白色度而保留前景内容卡亮度；选中态改为左右基本等亮的浅暖渐变；固定筛选头改为高遮蔽低白度珍珠雾面，底部以24px中性抖动柔影过渡且移除白色内描边；停用外层2px双向mask，并在导航/工作区/正文材质内部加入低对比边缘渐退，使浅色填充在裁切前自然回落，不再绘制闭环白线。内部常驻卡仍无第二次`backdrop-filter`。前端195/195、TypeScript、Vite、1702×1066知识/来源/主题/四皮肤Chrome E2E 1/1及v58 Windows Tauri隔离应用`--prepare / --verify`通过；EXE为34,866,176 bytes，SHA-256=`2674018EFAB5295C0E634C7F37932CFF53EE68339904DED51972C937487BFC2D`。当前入口为`启动南枫知识库-材质边缘与滚动磨砂验收.bat`；Codex未启动应用、未打开或写入正式数据，真实WebView2边缘与滚动观感待南烛枫确认。
80. 2026-08-02南烛枫纠正知识视图的产品语义：该入口用于整合多篇笔记，数据库`KnowledgeNote`不能直接作为“独立笔记”与主题成果并列。现由`buildKnowledgeTopicIntegration`唯一生成主题阅读模型：多个正式整理分段合并为一个主题成果；无正式整理稿时从多条真实来源正文确定性汇集并保留右侧回溯；单一来源只标为`待聚合`；无内容时使用紧凑空态。原三栏中的独立笔记索引已删除，Tab改为`主题整合`，右栏统一为`关联笔记与来源`。该派生只读、不写回数据库、不伪造人工确认结论。前端198/198、TypeScript、Vite、知识最终视图与知识生产流两条Chrome E2E及v59 Windows Tauri隔离应用`--prepare / --verify`通过；EXE为34,866,688 bytes，SHA-256=`9D43BCD0FA9C98B77FA99A628BED7AAF11A4F4C137B6E54BC7CE58153040C36D`。当前入口为`启动南枫知识库-主题整合阅读验收.bat`；Codex未启动应用、未打开或写入正式数据。
81. 2026-08-03南烛枫指出搜索框默认态有稳定投影，但点击编辑后阴影突然消失。复盘确认根因不是输入框尺寸或背景，而是默认态和`:focus-within`各自重写完整`box-shadow`，且记录、来源、知识和主题存在多份私有聚焦规则；聚焦态因此替换了默认空间投影。现由`--search-control-elevation / inner-highlight / focus-ring`唯一持有搜索状态，默认态为`投影 + 内高光`，聚焦态只在其上叠加焦点环。页面私有聚焦阴影已删除，记录入口、来源档案、知识视图、主题管理及后续共享搜索框统一消费同一组合。前端199/199、TypeScript、Vite、1702×1066四消费者与四皮肤Chrome实算E2E及v60 Windows Tauri隔离应用`--prepare / --verify`通过；当前聚焦截图为`.runtime-qa/knowledge-final-layout-evidence/search-focus-shadow-continuity-1702x1066.png`。EXE为34,866,688 bytes，SHA-256=`0BC70B3588943997680AE90DEC5E6DA7D4141A4465558FF8045285B8A979734A`。当前入口为`启动南枫知识库-搜索框聚焦阴影一致性验收.bat`；Codex未启动应用、未打开或写入正式数据。
82. 2026-08-03南烛枫指出知识内容区前景卡白度略有曝光过度，并补充截图中的卡片二主题项也要同步收敛；四个知识状态共同处理，但`主题整合`的主要来源阅读卡不动。根因是卡片二、假设/证据、判断、辅助回溯和决策卡仍各自写有多组接近纯白的页面值，而不是底板或透明度职责错误。现由`--knowledge-material-browser-* / reading-card-* / reading-support-*`唯一持有低曝光前景角色：保持v54+v58既有透明度、外层单次模糊、中性抖动、语义色和底板，只轻微降低固定珍珠白RGB；卡片二分组/普通项/选中项、竞争假设、判断演变、主题整合辅助回溯和决策版本共同消费。`.knowledge-final-reading-pane.is-content`继续使用原`rgba(255,255,255,.84)`主要来源阅读表面，未进入新规则。前端200/200、TypeScript、Vite、1702×1066四状态/四皮肤Chrome实算E2E 1/1及v61 Windows Tauri隔离应用`--prepare / --verify`通过；本轮当前截图为`.runtime-qa/knowledge-final-layout-evidence/knowledge-card-exposure-v61-1702x1066.png`。EXE为34,866,688 bytes，SHA-256=`3D3FAFFE797F593FFEE9B1C453E57CE231FE1BC07688F6DF073C5A09D6504D1E`。当前入口为`启动南枫知识库-知识卡片曝光层级验收.bat`；Codex未启动应用、未打开或写入正式数据，真实WebView2观感待南烛枫确认。
83. 2026-08-03南烛枫明确“关联笔记与来源”卡片不能整卡进入来源档案：左侧主体要留给当前知识页内的笔记切换，只有最右侧外链图标可以跳转。根因确认是每项原本只有一个整卡`button`，唯一`onClick`直接调用`onOpenSource`。现由`KnowledgeAssets`把每项拆为同级的`.knowledge-final-source-switch`与`.knowledge-final-source-open`两个按钮：主体读取主题详情已有的真实`contentText`并在主要阅读卡原位切换，外链图标独立进入来源档案；选中来源后提供`返回主题整合`，外部反向定位仍只负责点亮对应项。没有改数据库、整合算法、布局或v54+v58/v61材质Token。前端200/200、TypeScript、Vite、1702×1066知识/来源/主题/四皮肤Chrome E2E 1/1及v62 Windows Tauri隔离应用`--prepare / --verify`通过；E2E真实点击确认主体不离页、图标才跳转、返回后仍定位。EXE为34,867,200 bytes，SHA-256=`B28B70EBEACCE33431A821765555D53E7E5E37DCED9C3F0619732D8042B5C42B`。当前入口为`启动南枫知识库-来源切换与链接入口验收.bat`；Codex未启动应用、未打开或写入正式数据，真实WebView2物理点击仍待南烛枫确认。
84. 2026-08-03南烛枫将三个产品入口正式统一为`主题洞察 / 全部笔记 / 主题管理`，并要求来源详情动作改为`返回上一级`。根因确认是旧`App.knowledgeSourceTarget`只保存一次性正文定位，消费后即清除，来源详情只能写死回`主题整合`。现新增由`App.knowledgeSourceReturnTarget`唯一持有的返回上下文：四个主题洞察面板进入笔记时同时记录`topicId + viewMode + sourceItemId`，返回后恢复原面板并聚焦原来源；直接点击`全部笔记`会清除旧来路，按当前笔记默认回到`竞争假设`对应来源。内部`page="knowledge" / page="sources"`、Repository、IPC和数据库表名保持不变，避免破坏兼容性；项目专用skill和当前权威文档已同步新产品名。前端201/201、TypeScript、Vite、两条1702×1066 Chrome流程2/2及v63 Windows Tauri隔离应用`--prepare / --verify`通过；EXE为34,867,712 bytes，SHA-256=`37AC7D354C4CAD9A8E2553749B497EE822B1813FB5EC1790A090F10048AE81F2`。当前入口为`启动南枫知识库-返回上一级与入口命名验收.bat`；Codex未启动应用、未打开或写入正式数据。
85. 2026-08-03南烛枫要求删除侧栏`判断更新`入口，并确认新导入笔记应自动整理进`主题洞察`。只读复盘确认分类器、建议保存和高置信度自动确认本已存在，但两个导入入口各自以异步调用触发，且中断恢复依赖用户进入`全部笔记`，所有权分散。现由`App.organizeImportedKnowledge`唯一编排：Markdown/文本批量导入和JSON映射导入都提交到同一串行队列；应用启动后在空闲阶段扫描没有当前分类版本标记的来源并恢复未完成任务；完成后以`knowledgeOrganizationRevision`刷新`全部笔记 / 主题洞察 / 主题管理`读模型。高置信度结果自动确认主题关联并进入主题洞察；中低置信度只保留候选建议，不为填满页面强行归错主题。侧栏不再渲染`判断更新`，但内部`updated`历史状态、筛选、导入导出协议和数据库兼容语义继续保留。前端202/202、TypeScript、Vite、两条1702×1066 Chrome流程2/2及v64 Windows Tauri隔离应用`--prepare / --verify`通过；EXE为34,866,176 bytes，SHA-256=`64132A9226EFD33E1D67C959D97A793711B6D24836B0162AA15ED4B96F0412E6`。当前入口为`启动南枫知识库-新笔记自动整理验收.bat`；Codex未启动应用、未导入新笔记、未打开或写入正式数据。
86. 2026-08-03南烛枫要求把知识摘要小卡“悬停轻抬升并加强底部阴影”的体验推广到全软件同类小卡，并整理为通用开发规则。现场确认原实现只由场景皮肤私有选择器覆盖知识摘要，记录卡、主题行、关联来源、设置和回收站各有分散规则。现由`NF-MICRO-CARD-LIFT-01`与`data-card-interaction="lift"`唯一持有：精细指针悬停上移2px并加强方向性底部阴影，按下缩放0.985，方向箭头/外链图标前移2px，键盘焦点仅增强投影/焦点环，`prefers-reduced-motion`取消位移与缩放；独立`translate/scale`不覆盖选中卡的横向`transform`。知识摘要、三个统一笔记列表、主题行、关联来源、设置与回收站小卡已接入，静态正文、大面板和表单明确排除；v54+v58/v61材质、透明度、渐变、边缘和布局未改。全局App架构基线、项目AGENTS、设计基线、治理矩阵、项目skill与苹果跨端交互参考已同步。前端203/203、TypeScript、Vite、1702×1066四皮肤Chrome实算E2E 1/1及v65 Windows Tauri隔离应用`--prepare / --verify`通过；EXE为34,867,712 bytes，SHA-256=`7CD8DCD74FBE7CBAEE5BFF77ACBE05187C75D7A49B0AD52D4AAD624008265AF3`。当前入口为`启动南枫知识库-全软件小卡片微交互验收.bat`；Codex未启动应用、未打开或写入正式数据，真实WebView2物理悬停与按压观感待南烛枫确认。
87. 2026-08-03重新审查旧合同后确认五类现行冲突：主规格仍把假数据原型和旧四页面写成当前阶段；AGENTS把中性玻璃写成闭合连续描边；设计/治理/验收仍混用旧入口名；动态交接与下一轮提示仍指向旧基线和旧BAT；统一笔记卡旧`:hover transform`与记录卡旧阴影继续和`NF-MICRO-CARD-LIFT-01`叠加。现已建立文档职责与判定顺序，用户可见名称只使用`主题洞察 / 全部笔记 / 主题管理`，历史名称/截图/BAT/隔离包/版本号只作证据；原型阶段标为已完成，中性玻璃边缘统一为低对比渐退，完整边界只服务选中/焦点/警告；旧1px位移、私有悬停阴影和默认`will-change`已删除，材质/透明度/渐变/布局不变。新增当前合同治理测试，前端205/205、TypeScript、Vite、1702×1066四皮肤E2E 1/1及v65隔离应用重新`--prepare / --verify`通过；EXE为34,867,712 bytes，SHA-256=`337A8EB1B441D3CC3805438CA63EE520B17C6FD793531C46CEFE1087F04F7A77`。未启动应用、未打开正式数据，真实WebView2仍待南烛枫用当前BAT确认。
88. 2026-08-03南烛枫指出全部笔记固定筛选层的阴影会在滚动阈值后一帧跳出、范围过大且方向不像底部承影，同时底部半透模糊质感不足，外壳四角与软件圆角语言不一致。只读复盘确认固定结构本身正确，根因是`data-scroll-edge`从隐藏切换为可见时同时替换整块`box-shadow`并显现24px灰白遮罩。v66保留真实滚动层内的`sticky`固定，仅重构共享滚动控制材质：阴影改为始终存在的窄幅向下接触影，底部渐退缩为14px并常驻，滚动状态不再改变两者；外壳统一14px圆角，白色覆盖率只比旧值略降，使搜索/筛选仍是更亮前景，同时通过高遮蔽中性渐变让滚过内容只留朦胧轮廓。未恢复v54已排除的嵌套`backdrop-filter`，其他布局、筛选功能、列表卡和场景材质职责均未改。前端205/205、TypeScript、Vite、1702×1066四皮肤Chrome E2E 1/1及v66 Windows Tauri隔离应用`--prepare / --verify`通过；E2E实算验证固定头位移0px、滚动前后阴影值相同、渐退始终为1。EXE为34,866,688 bytes，SHA-256=`01F2C0D7ADF146CD54DC90ECF0A12C157E0F7CF2A460C1BE065DB6EA0763C5E4`。当前入口为`启动南枫知识库-固定筛选磨砂与圆角验收.bat`；Codex未启动应用、未打开或写入正式数据，真实WebView2材质观感待南烛枫确认。
89. 2026-08-03对v66做遗漏风险审计后确认两个残留：固定层虽已不消费滚动状态，`KnowledgeWorkspace`仍在每次滚动时写入`data-scroll-edge`，会产生无意义样式失效并保留未来误接状态选择器的入口；共享承影仍含`1px`纯白顶部高光，且14px渐退起始色与外壳末端不同，存在细白线或灰缝风险。v67已删除固定层的滚动属性写入，只保留关联线重算；承影收敛为唯一向下暗影，移除顶部白色高光，渐退统一从外壳底部`232,235,238`同色连续衔接。既有`sticky`、14px圆角、白度/透明度、前景搜索与筛选、列表功能、四皮肤和无内部二次模糊合同均未改变。前端205/205、TypeScript、Vite与Chrome E2E 1/1通过；1702×1066确认固定层无视觉状态属性、滚动位置稳定，1280×720确认圆角和横向边界未裁切。v67 Windows Tauri隔离应用`--prepare / --verify`通过，EXE为34,866,688 bytes，SHA-256=`784D183B7576DF8F97E9D7627FA0D2E1B9C890C8A3BB1B32FCE70E319FFFDB66`。当前入口仍为`启动南枫知识库-固定筛选磨砂与圆角验收.bat`；Codex未启动应用、未打开或写入正式数据，真实WebView2材质观感待南烛枫确认。
90. 2026-08-03南烛枫在v67真实WebView2上滑状态确认两个问题：固定筛选外壳虽有14px圆角，但其真实列表滚动视口仍是矩形，列表卡会从顶部两角露出直角白色信息；固定层下方经过的列表文字仍过于清晰。v68只修复这两个关系：`.knowledge-source-list-scroll`与固定层共同使用14px顶部圆角裁切；固定珍珠雾面与14px渐退提高遮蔽，使滚过文字只保留不可辨认色影。搜索/筛选前景亮度、`sticky`位置、向下承影、无滚动状态属性和无嵌套`backdrop-filter`合同均保持。前端205/205、TypeScript、Vite、1702×1066四皮肤Chrome E2E 1/1及v68 Windows Tauri隔离应用`--prepare / --verify`通过；EXE为34,867,200 bytes，SHA-256=`FE6BB653AB16BFE83B498B7408E993A7E518DE25D549CE9EEB655DEE280AB1FF`。当前入口仍为`启动南枫知识库-固定筛选磨砂与圆角验收.bat`；Codex未启动应用、未打开或写入正式数据，真实WebView2圆角裁切与遮蔽观感待南烛枫确认。
91. 2026-08-03南烛枫复现正文搜索框为空仍跳到过去关键词位置。完整状态链确认并非输入状态本身残留，而是主题洞察传入的旧证据`locatorJson`仍由`KnowledgeWorkspace`在正文加载后自动消费为滚动定位。v69删除这条自动正文锚点执行通道：`knowledgeSourceTarget`只负责打开目标笔记并立即消费；普通打开、跨页打开和切换笔记统一清空正文查询/高亮并把正文容器置顶；只有用户输入本次关键词并点击`搜索`或按Enter才允许调用正文滚动。新增与卡片二同结构的正文最近搜索，使用独立本地偏好键，可清空；点击历史项只回填输入，不自动定位。前端208/208、TypeScript、Vite、1702×1066四皮肤Chrome E2E 1/1及v69 Windows Tauri隔离应用`--prepare / --verify`通过；E2E真实覆盖旧锚点不跳、手动搜索才跳、换笔记回顶部和历史只回填。EXE为34,866,688 bytes，SHA-256=`8E3887E6094D4CFDCBDA5BDADE002430D3FA95EC2CC5FDD1C6C2BF6249513CF3`。当前入口为`启动南枫知识库-正文搜索与历史验收.bat`；Codex未启动应用、未打开或写入正式数据，真实WebView2手感待南烛枫确认。
92. 2026-08-03南烛枫以v69真实WebView2截图确认v68的固定筛选修复无效：滚动后右上仍出现方形白槽，底部`ChatGPT导入`仍清晰可读。复盘确认旧验证只检查滚动元素自身14px圆角和14px渐变是否存在，没有验证原生滚动条合成层、预留槽几何或把真实文字送进遮挡区。v70新增非滚动`.knowledge-source-list-viewport`，由它唯一持有14px圆角、`overflow:hidden`与`isolation:isolate`，内层`.knowledge-source-list-scroll`只负责滚动；固定承托面按Chrome实算向右延伸12px覆盖`scrollbar-gutter`及列表内距。底部珍珠遮蔽从14px改为52px，前84%保持高遮蔽、末端连续渐退，不恢复曾造成WebView2亮条的嵌套`backdrop-filter`。静态合同先失败后通过；前端208/208、TypeScript、Vite、1702×1066 Chrome E2E 1/1及v70 Windows Tauri隔离应用`--prepare / --verify`通过。E2E明确验证外层裁切、右边缘差≤0.5px，并把一整组标题/辅助信息主动送进遮挡区截图；Chrome证据不冒充真实WebView2通过。v70 EXE为34,866,688 bytes，SHA-256=`7BFBB5D79330BE3D9176171B2A65C6CE8E51D5914FD663E1BAFAC0826A0EE15B`。当前入口恢复为`启动南枫知识库-固定筛选磨砂与圆角验收.bat`；Codex未启动应用、未打开或写入正式数据。
93. 2026-08-03南烛枫指出直接打开`全部笔记`时，标题区`自动整理 / 返回上一级 / 查看详情`会不稳定刷新出现。根因不是按钮动效，而是结构所有权错误：`返回上一级`等待异步主题详情后才插入，`查看详情`等待异步正文后才插入；首帧按钮数量和宽度因此变化。v71让标题动作只依赖首帧已有数据：返回目标优先读取列表项同步`primaryTopicId`，异步主题详情只补充内容；查看详情从首帧固定渲染，极快点击时由既有`sourceDetailOpen`等待正文准备后打开。自动整理的动作与禁用语义不变。新增失败后转绿的静态合同，并在Chrome夹具中把正文和主题详情各延迟1.2秒，确认异步数据返回前后三个按钮的文字、数量、位置、宽高完全一致。前端209/209、TypeScript、Vite、1702×1066 Chrome E2E 1/1及v71 Windows Tauri隔离应用`--prepare / --verify`通过；Chrome与隔离构建不冒充真实WebView2完成。v71 EXE为34,867,200 bytes，SHA-256=`CAAFD33A74B6322FF1E219AAD3F705DBA99CF2046555AC2BB8AE776698359E83`。当前入口为`启动南枫知识库-全部笔记标题按钮稳定性验收.bat`；Codex未启动应用、未打开或写入正式数据。
94. 2026-08-03南烛枫指出自动草案大量出现没头没尾的信息，截图中标题为`的话，我可以单独就“数据中心真实净回报率”帮你拆…`。根因是`knowledgeSynthesis`把包含`可以`的聊天服务收尾当作行动候选，同时`conciseTitle`再按24字符硬截断正文；问题因此同时存在于生成层与标题层。v72由`knowledgeSynthesis.ts`唯一修复：去除用户/助手前缀，过滤`如果你愿意 / 我可以继续 / 我可以帮你`等服务邀约及以`的话`开头的上下文残句；决策候选只接受明确建议/判断语句；标题改为完整的`《来源》中的待确认建议`，并把自动链明确为`形成依据 → 待确认建议 → 尚未执行 → 预期/结果`，实际结果说明尚未产生。截图原句已成为失败后转绿回归样本。前端210/210、TypeScript、Vite、1702×1066 Chrome E2E 1/1及v72 Windows Tauri隔离应用`--prepare / --verify`通过；EXE为34,866,688 bytes，SHA-256=`E27D1DDB52C29C60940B9E6443855CD1F6859FFD73325EF9DFB462607CC902D7`。当前入口为`启动南枫知识库-自动草案完整性验收.bat`；Codex未启动应用、未打开或写入正式数据，真实笔记上的草案内容质量待南烛枫确认。
95. 2026-08-03南烛枫再次以真实WebView2截图推翻v70的固定筛选结论：右上仍露方形白槽，定位条下方新增大块直角白色遮罩。逐层比较`全部笔记`与`我的收藏`的真实DOM/CSS后确认两个直接原因：`.knowledge-source-filters::after`本身就是向下延伸52px的矩形伪元素，`margin-right:-12px`又把右圆角中心推出裁切边界；更根本的结构分叉是全部笔记把控制区放进滚动层后用`sticky`模拟固定，而我的收藏的控制区天然位于列表滚动层之外。v73按南烛枫给出的回退方案执行：全部笔记直接复用`UnifiedNoteListPanel → SearchRow / DisplayToolbar / Toolbar / Locator → list viewport`结构，滚动容器只保留笔记卡；删除私有`.knowledge-source-filters`、52px遮罩、`sticky`和负边距，保留搜索、组合筛选、`全部 / 待确认 / 已归类 / 全部加载`与定位功能。前端210/210、TypeScript、Vite、1702×1066定向Chrome E2E 1/1及v73 Windows Tauri隔离应用`--prepare / --verify`通过；1280×720同步验证控制区在滚动层外、列表从定位条下方开始、外层14px裁切且无横向溢出。EXE为34,866,176 bytes，SHA-256=`E90C0F1D58657B965038615EA35BEA6A736B2E8032F5E14A8FD45D39209A735D`。当前入口为`启动南枫知识库-全部笔记筛选外壳验收.bat`；Codex未启动应用、未打开或写入正式数据，真实WebView2仍待南烛枫确认。
96. 2026-08-03南烛枫用10组截图指出v65“全软件小卡片”实际只覆盖少数消费者，并明确每张小卡必须单独产生效果，截图中的整组和小卡外层不得联动。复盘确认动画参数本身有效，失败根因是消费者映射不完整，旧E2E又只悬浮一张知识摘要卡，因而形成假覆盖。v74把`NF-MICRO-CARD-LIFT-01`拆成同所有者的两种语义消费：操作卡`lift`保留按压回落，纯阅读卡`surface-lift`只有悬浮抬升，不伪装点击；角色只挂最深层独立小卡，禁止父容器和嵌套消费。当前判断、核心解释、提取依据、支持/反对证据、待验证/有效期、判断演变来源卡、决策四阶段、主题内部卡和待处理子项已逐卡补齐；竞争假设、决策版本、主题内容区等外壳明确静止。E2E实算悬浮核心解释时只有该卡为`-2px`，兄弟证据卡与竞争假设外壳均为`none`。通用App架构基线、项目设计系统、设计基线、治理/验收矩阵和跨平台动效参考已同步“逐卡、无嵌套、操作/阅读分工”规则。前端210/210、TypeScript、Vite、1702×1066 Chrome E2E 1/1及v74 Windows Tauri隔离应用`--prepare / --verify`通过；EXE为34,866,688 bytes，SHA-256=`68B0B5AA052F6838E4108661787BC5B7BDC75CEAA77111B2A5EDB1829EB78057`。当前入口为`启动南枫知识库-全软件小卡片微交互验收.bat`；Codex未启动应用、未打开或写入正式数据，真实WebView2逐卡悬停手感待南烛枫确认。

### v75 滚动稳定、共享悬浮反馈与数据优化

- 南烛枫的真实 WebView2 截图表明，列表向下滚动后不只是列表文字消失，侧栏、列表卡和右侧阅读面也出现逐块空白；DOM/业务数据未消失，故障边界位于渲染合成层。v74 同时让高达120张重复列表卡长期声明`translate / scale / box-shadow`动画，外层又有场景磨砂合成，是本轮新增的直接高风险组合。
- v75 为`UnifiedNoteListCard`增加`data-card-rendering="repeated-list"`：只对当前悬浮卡使用普通`top:-2px`和即时阴影，不再让整列卡预留`translate / scale / box-shadow`动画；其他低密度小卡继续消费既有微交互。Chrome滚动压力合同反复经过0%/20%/45%/70%/100%等位置后，可见标题、图标、透明度和几何均完整。该证据不能代替真实 WebView2。
- 搜索历史项固定为8px小圆角矩形；全部搜索入口、列表`顶部 / 当前`和知识状态Tab增加同一橙色悬浮反馈；选中笔记卡使用更明确的暖色卡面、橙色标题与暖色元数据。布局、透明材质和大面板不移动。
- 设置新增`优化数据占用`：只读扫描SQLite空闲页、实际字节完全相同的数据库/完整备份，以及带`.building`且超过24小时的未完成备份。执行必须先预览并二次确认，先创建`优化前安全备份`，再清理候选并运行`PRAGMA optimize / VACUUM / integrity_check`。笔记、知识对象、历史版本、附件、导入原件和仅仅“较旧”的唯一备份均不自动删除。
- 自动证据：前端212/212、Rust88/88、TypeScript、Vite、Playwright全量17/17（含1702×1066滚动压力与设置优化预览）、Sites 4/4、Windows Tauri`--no-bundle`隔离构建与独立`--verify`通过；未启动软件，未打开或写入正式数据。

### v76 千条笔记窗口化与 WebView2 滚动稳定性

- 南烛枫随后以真实 WebView2 截图确认 v75 仍会在滚动更深位置出现列表跳洞、右侧正文整块空白以及侧栏同步失绘。由此推翻“只降低卡片 hover 合成即可”的结论：`全部加载`仍会把全部889张来源卡长期挂入 DOM，旧全局滚轮监听还会对每一个原始滚轮事件同步写入`scrollTop`；两者叠加才是当前渲染失稳的直接风险。
- v76 建立`src/performance/fixedVirtualList.ts`为大列表唯一窗口化所有者。`全部笔记`以及普通记录/收藏/跟踪的列表都保留原有数据、筛选、排序、定位和选中语义，但 DOM 仅渲染可视区前后各6行；3,000条数据的纯函数合同证明常驻约20行，定位首/中/末项不越界。未使用`content-visibility`、逐卡`will-change`或全量transform修补。
- 悬浮滚轮改为“原生优先”：鼠标处于真实列表/正文滚动层时不拦截、不同步写入，交由 WebView2 原生滚动；仅停在标题/工具栏等非滚动区时，按帧合并增量转交该卡默认正文，因此右侧卡片悬浮滚动体验保持不变。
- 自动证据：前端211/211、TypeScript、Vite、Sites 4/4、Playwright全量17/17、Rust88/88通过；v76 Windows Tauri`--no-bundle`隔离构建与`--verify`通过。EXE为隔离文件，SHA-256=`115194EFD0347ECE8F479EA6E20F94BEEAF9AA70B0D45B2E5645F12520DB5799`。未启动软件，未打开或写入正式数据；真实WebView2仍必须由南烛枫在889+来源下确认。

### v77 小卡片悬浮落影与裁切收口

- 根因：场景皮肤以更高选择器把`.topic-final-section`和`.topic-final-suggestions > section`的基础投影置为`none`，使通用悬浮投影被覆盖；决策链横向滚动容器仅有8px底部内边距，18px投影被滚动裁切为硬边。
- 修复：细指针悬浮时，非经典皮肤的`lift / surface-lift`显式恢复统一的`--micro-card-hover-shadow-local`；三类横向链路统一预留`10px 2px 28px`投影安全区，保留原有窄左右边距以避免页面级横向溢出。未给大阅读面板、组容器或决策版本套动画。
- 覆盖：主题边界四张内容卡和空态待处理卡保持逐卡`surface-lift`；设置内存储路径信息卡、7张统计卡、数据交换/备份/优化三张功能卡为逐卡`surface-lift`；高级维护5张动作卡为逐卡`lift`。
- 自动结果：前端211/211、TypeScript、Vite、Playwright全量17/17通过；v77 Windows Tauri`--no-bundle`隔离构建与`--verify`通过，EXE为34,942,464 bytes，SHA-256=`8E65559906F544C5F15DCEFB2E8B5E6E320B6058BE1D7A763D3061144689142B`。未启动v77应用，未打开或写入正式数据。
- 真实桌面待验：南烛枫使用`启动南枫知识库-全软件小卡片微交互验收.bat`逐项确认物理悬浮下的底部落影与阴影边缘；隔离构建或Chrome结果不得冒充真实WebView2可见验收。

### v84 历史视频按需恢复与统一播放

> 历史证据：本节的逐项点击恢复合同已被v89默认自动加载替代，不得作为当前入口或当前交互实现。

- 失败根因已锁定：v83只让正文解析层识别到`metadata.attachments[]`的视频声明，页面缺失卡没有恢复动作；既有后端恢复又以整包物化为单位，不能安全支撑用户只打开当前视频。因此截图会停在“视频存在但尚未进入受控目录”，不会生成播放器。
- 现由`attachments::recover_source_attachment`唯一持有按需恢复：要求正文确实声明所点附件ID，优先使用该来源自己的`source_import_origins`，旧库回退时还要求会话ID匹配；`chatgpt_export::materialize_inspected_chatgpt_asset`只提取一个`.dat`实体，识别真实格式并逐字节写入受控附件目录。数据库事务建立附件与来源链接；失败清理输出，重复点击幂等。
- `SourceAttachmentAsset`是唯一正文附件呈现入口。缺失视频卡显示“点击恢复并播放”，确认文案明确只恢复这一条、不扫描或覆盖其他附件；成功后同一正文位置切换为原位`<video controls>`，并复用最高层`AttachmentPreview`打开播放。来源正文与来源详情弹窗共用该链路。
- 自动证据：前端215/215、Rust94/94、TypeScript、Vite生产构建通过；Rust临时库合同真实创建ChatGPT ZIP并验证单实体提取、`video/mp4`识别、来源关联与重复恢复幂等。v84 Windows Tauri隔离应用`--prepare / --verify`通过，SHA-256=`2C57CE30C396E367B7392D8FB5072310993A4B133146DB10A455F3FB1B90F795`。
- 正式边界：Codex没有启动v84程序，没有打开、迁移或写入`D:\南枫知识库`。当前唯一桌面验收入口为`启动南枫知识库-视频附件恢复与播放验收.bat`；真实点击会在用户确认后只写入所点附件，WebView2实际解码与声音播放仍待南烛枫确认。

### v85 卡二首次打开列表短一截

- 真实截图锁定了精确症状：定位条仍显示`1 / 120`，卡二却只挂载7张卡后留出大片空白。数据没有丢失；`viewportHeight=0`时虚拟列表按`1个保底项 + 6个overscan`恰好生成7行。
- 根因是卡二滚动容器在`mode === "sources"`时才挂载，而共享Hook曾在整个`KnowledgeWorkspace`首次挂载时只测量一次；从主题洞察/主题管理切回全部笔记后，ref已有元素但Effect不再执行。
- `useFixedVirtualList`现以显式`enabled`持有条件挂载生命周期，卡二进入时重新测量真实高度并绑定ResizeObserver。没有改筛选、排序、全部加载、卡片行高、数据库或正式数据。
- 自动证据：前端216/216、TypeScript、Vite生产构建通过；1702×1066定向Playwright确认首次进入卡二后最后渲染行覆盖滚动视口底边，且无控制台错误/资源失败。v85隔离应用完成`--prepare / --verify`，SHA-256=`8835D6DCFC911799C7C9E267F960A8078712856AA4B7DF1BDD2B54E9BBEED81F`。完整历史E2E被既有附件分类弹窗关闭流程拦住，不声明全量通过。

### v86 图片与视频统一视觉媒体预览

- 南烛枫真实WebView2截图确认最高层视频虽已能播放，但仍落入通用浅色棋盘舞台，横屏视频只按源尺寸显示、无法尽量铺满；图片现有暗底、居中、fit/custom、Ctrl+滚轮、中键复位和调窗规则没有被视频复用。
- 根因是三个明确分叉：暗色外壳仅选择`.attachment-preview-image`；视频只使用`max-width/max-height`；视口状态、真实尺寸采集、ResizeObserver和鼠标处理全部硬编码为`kind === "image"`。v86新增`mediaPreviewViewport.ts`作为唯一算法所有者，`imagePreviewViewport.ts`只保留兼容别名；`AttachmentPreview`的图片与视频共用同一视觉媒体分支。
- 图片继续以原始像素为上限，小图不强制放大；视频读取`videoWidth × videoHeight`并允许在20px安全留白内完整等比放大，默认居中且尽量铺满软件画面。两者共用暗色外壳、标题栏、纯黑画布、窗口调节、fit/custom、Ctrl+滚轮、平移和中键全屏适配。视频元素自身纯黑；原位正文视频也改为纯黑承托。视频适配态保留点击播放语义，缩放进入custom后内容区可拖动，底部原生控制条始终优先接收指针。
- 自动证据：前端218/218、TypeScript、Vite生产构建通过；隔离页动态生成真实可解码640×360 WebM，1702×1066 Chrome E2E 1/1验证最高层窗口宽高、视频中心误差<2px、视频宽度>1500px、舞台`rgb(8,12,18)`、视频纯黑、Ctrl+滚轮改变视口及中键恢复。v86 Windows Tauri隔离应用完成`--prepare / --verify`，路径`.runtime-qa/visual-media-preview-v86-app/release/nanfeng-knowledge-base.exe`，SHA-256=`E18150096B8EBA780146E59613C28431C45D872DD58D9AA6629661C1E0B7EE82`。程序与正式数据均未打开；真实MP4/WebView2解码、声音、物理鼠标和横竖视频观感待南烛枫双击新BAT确认。

### v87 全入口前景卡统一提亮

- 南烛枫真实WebView2截图确认三套场景皮肤的前景卡整体发灰。根因是v61为卡片二和主题洞察四状态建立的低曝光固定RGB仍被多个入口沿用，另有`.knowledge-final-domain`晚位规则绕过共享材质Token；当前问题不是透明度、模糊或布局错误。
- v87以`--knowledge-material-foreground-card-color`及既有browser/reading分层Token统一提高前景RGB明度，覆盖主题洞察、全部笔记、主题管理、我的收藏、持续跟踪、回收站和设置的内容/列表/判断卡；修正主题领域晚位覆盖。保持既有alpha、外层单次模糊、边缘、圆角、几何和语义色相，不提高大承托层白度，不改原版浅色、浮层/弹窗或`主题整合`主要来源阅读卡。
- 自动证据：前端218/218、TypeScript、Vite生产构建通过；1702×1066定向运行已通过新材质实算并生成`docs/screenshots/qa/foreground-card-brightness-v87-1702x1066.png`。完整历史Playwright随后在既有附件分类弹窗流程被`.prototype-dialog-backdrop`拦截，不声明全量通过，也不把该旧故障归因于本轮材质改动。
- 当前真实边界：浏览器源码效果已确认前景卡提亮而大承托层仍保持层级；v87 Windows Tauri隔离应用已完成`--prepare / --verify`，路径`.runtime-qa/foreground-card-brightness-v87-app/release/nanfeng-knowledge-base.exe`，35,435,520 bytes，SHA-256=`87909B402C57BB1F112FA6EF87AFE7405DFCF48C7BA1A33F9334C38883E00A3E`。Codex未启动应用、未打开或写入正式数据；真实WebView2观感仍待南烛枫确认。

### v88 关联笔记完整卡片与独立滚动

- 南烛枫真实WebView2截图确认“关联笔记与来源”数量越多，单卡越被压扁，第二行来源类型、日期和置信度消失。根因是右侧来源列同时作为固定高度Grid与滚动容器，子项`overflow:hidden`使隐式Grid行的最小高度可降为0，负剩余空间因此被分摊到每一行；内部按钮虽有52px最小高度，外层卡仍先被压缩并裁切。
- v88由`.knowledge-final-source-list`唯一持有`grid-template-rows / grid-auto-rows: max-content`与稳定滚动条槽：标题和每张来源卡只按内容高度排列，数量增加只延长右列滚动内容，不再压缩卡片。组件、数据、三栏比例、材质、主阅读区和“主体原位切换 / 最右外链进入全部笔记”双点击边界均未改。
- 图一失败证据与图二确认基准已保存为`NF-RELATED-SOURCES-COLLAPSE-19 / NF-RELATED-SOURCES-FULL-CARD-20`。1702×1066真实组件夹具使用20张来源卡，实算全部卡片高度不低于52px、全部第二行元数据高度大于0、`scrollHeight > clientHeight`且可滚到最后一张；当前源码截图为`docs/screenshots/qa/related-sources-full-cards-v88-1702x1066.png`。
- 静态合同30/30通过。完整历史Playwright在本轮多卡断言通过后，仍于既有附件分类弹窗遮罩拦截右键步骤；未扩修该无关故障，不声明全量E2E通过。v88 Windows Tauri隔离应用已完成`--prepare / --verify`，路径`.runtime-qa/related-sources-full-cards-v88-app/release/nanfeng-knowledge-base.exe`，35,435,520 bytes，SHA-256=`22715D0CA727300037DCD3515CE20CE8F3804EA4111FAD221A1336C307037BEF`；Codex未启动应用、未打开或写入正式数据，真实WebView2待南烛枫确认。

### v89 附件完整目录、默认加载与月份筛选

- 南烛枫真实WebView2截图确认旧版只有逐个点击过“恢复并预览/播放”的文件才进入受控`attachments`表，分类时间线因此只显示3个已恢复视频；其他图片、视频、PDF、TXT虽然在原文声明中存在，却被搜索静默漏掉。
- v89把附件事实拆为两层：`search_source_attachment_catalog`读取正文声明与已受控实体并集，保证未物化文件立即进入全部/图片/视频/音频/文件筛选；当前笔记正文与附件列表就绪后，`hydrate_source_attachments`按唯一ID顺序自动物化全部缺失实体，单项失败隔离且重复执行幂等。页面不再显示逐项恢复按钮或确认框。
- `SourceAttachmentAsset`默认原位加载图片和音视频，并新增PDF/TXT正文内阅读框；分类时间线按原笔记日期分月，文件增加只延长独立滚动内容。三张真实失败截图已固化到设计基线，只锁定问题与行为方向，不锁定示例数据。
- 自动证据：前端219/219、Rust95/95、TypeScript、Vite生产构建通过。v89 Windows Tauri隔离应用已完成`--prepare / --verify`，路径`.runtime-qa/attachment-default-load-v89-app/release/nanfeng-knowledge-base.exe`，35,557,376 bytes，SHA-256=`9FC494F26A164805879702C339784C35EB10F0E719BD15B93B4FC8782254C9A5`。Codex未启动应用、未打开或写入正式数据；正式ZIP自动加载、磁盘增量和真实WebView2多格式解码待南烛枫确认。

### v90 图片缩略图库与视频代表帧

- 南烛枫真实WebView2截图确认图片/视频时间线虽已完整列出并按月分组，但仍是文件名目录，无法直接辨认图片内容或视频画面，视频也缺少直接播放入口。
- v90新增唯一`AttachmentTimelineMediaCard`：图片卡使用受控原图生成懒加载缩略图；视频卡在WebView内跳过可能纯黑的第0帧抽取代表帧并叠加播放标记。点击图片/视频继续复用既有最高层`AttachmentPreview`，没有复制第二套图片视口或播放器。
- 图片/视频分类打开后，对可恢复但未物化的媒体按来源顺序调用既有批量接口，完成后刷新当前搜索；只生成受控附件副本和内存代表帧，不改写原ZIP或原媒体，单项失败不阻断其他卡片。月份分组、独立滚动、搜索和非媒体列表保持不变。
- 自动证据：前端220/220、TypeScript、Vite生产构建通过。v90 Windows Tauri隔离应用已完成`--prepare / --verify`，路径`.runtime-qa/attachment-media-thumbnails-v90-app/release/nanfeng-knowledge-base.exe`，35,558,400 bytes，SHA-256=`9CFC6F379FE8DD0304C7821FC1BB8891AB7656DC4673AD3CC305DC816FEF9D36`。Codex未启动应用、未打开或写入正式数据；正式WebView2代表帧、正式ZIP物化增量和真实播放待南烛枫确认。

### v91 Markdown受控解码与阅读预览

- 南烛枫真实WebView2截图确认`.md`被作为本地原始文本iframe嵌入正文：WebView按Windows代码页猜测UTF-8字节，产生大量中文乱码；YAML frontmatter、Markdown标记和代码路径原样直出，并形成嵌套横向滚动。
- v91新增后端唯一`read_attachment_text`：只按数据库附件ID读取受控附件目录内且不超过8MB的文本；按UTF-8 BOM、UTF-16 BOM、合法UTF-8、GBK回退顺序解码，不修改原文件。目录外路径、非文本和超限文件拒绝。
- 前端新增唯一`AttachmentTextPreview`，正文原位与最高层预览共同消费；`.md/.markdown`交给既有`MarkdownContent`语义渲染并沿用frontmatter/callout/安全链接合同，TXT/JSON/CSV/LOG等保留纯文本并自动换行。PDF、图片和音视频链路未改。
- 自动证据：前端221/221、Rust96/96、TypeScript、Vite生产构建通过。v91 Windows Tauri隔离应用已完成`--prepare / --verify`，路径`.runtime-qa/markdown-reading-preview-v91-app/release/nanfeng-knowledge-base.exe`，35,588,096 bytes，SHA-256=`61CB55542E7544A6EC40075D83151DBD2E7E8D969767F8D5CC2CAD7974CD86B0`。Codex未启动应用、未打开或写入正式数据；截图中的正式Markdown编码与WebView2最终排版待南烛枫确认。

### v92 全格式附件定位文件

- 南烛枫要求从正文中的视频预览直接打开所在目录并选中视频，同时让图片、PDF、文本等其他文件获得同一能力。v92没有修改原生视频右键菜单，而是在附件操作区提供稳定、可见且跨格式一致的`定位文件`动作。
- 新增唯一`AttachmentLocateButton`：`SourceAttachmentAsset`在图片、音视频、PDF/文本、归档/其他文件分支全部接入；最高层`AttachmentPreview`标题动作区同步接入。月份时间线继续通过最高层预览获得定位能力，不复制第二套平台操作。
- 新增`RecordRepository.revealAttachment → Tauri reveal_attachment → attachments::reveal_attachment → external_open::reveal_path`单一路径。前端只传附件ID；Rust重新取数据库记录并通过`controlled_attachment_file`确认文件仍位于受控附件目录，Windows Explorer用`/select`直接选中文件。定位不打开、复制、移动、改名或改写附件。
- 自动证据：前端222/222、Rust96/96、TypeScript、Vite生产构建通过；目录外伪造附件合同同时确认不能打开、删除或定位。v92 Windows Tauri隔离应用已完成`--prepare / --verify`，路径`.runtime-qa/attachment-file-location-v92-app/release/nanfeng-knowledge-base.exe`，35,713,024 bytes，SHA-256=`694284AC80C52CFF72ACF1908A1349B39A164092C7C8D9BE69A087F0EAACB89F`。Codex未启动应用、未打开或写入正式数据；真实Explorer打开与选中状态待南烛枫确认。

## 2. 冷启动读取顺序

1. `AGENTS.md`
2. `docs/CURRENT_HANDOFF.md`
3. `docs/next-codex-prompt.md`
4. `docs/core-workspace-design-baseline.md`
5. `docs/core-workspace-acceptance-matrix.md`
6. `docs/core-workspace-requirements-traceability.md`
7. `design-qa.md`最后一节

然后检查 Git 根目录、当前分支、`git status`和最近提交。不要先扫描全部聊天、旧审计或历史原型。

## 3. 锁定的产品链

核心对象链：

`来源资料 → 领域/主题 → 命题 → 竞争假设 → 支持/反对证据 → 当前判断/判断演变 → 有效期/失效条件 → 决策 → 行动 → 结果 → 复盘`

三个入口职责：

- `全部笔记`：阅读原始资料和自动整理成果，人工归属仅为低置信度异常入口。
- `主题管理`：合并旧主题浏览器和整理工作台；阅读分类结构和自动化依据，把结构缺口变为待处理事项，维护操作为次级入口。
- `主题洞察`：核心成果入口；按领域、主题、命题、竞争假设、证据、判断演变和决策链持续阅读。

锁定图：

- `docs/screenshots/final-core-workspace/knowledge-view-competing-hypotheses.png`
- `docs/screenshots/final-core-workspace/knowledge-view-judgment-evolution.png`
- `docs/screenshots/final-core-workspace/source-archive-final-layout.png`
- `docs/screenshots/final-core-workspace/topic-structure-final-layout.png`

四张图约束产品组织、页面功能布局和交互状态，不约束皮肤。四套皮肤继续使用既有视觉合同。

## 4. 当前实现

### 4.1 生产代码

- `src/App.tsx`
  - 应用默认进入`主题洞察`；
  - 三个核心入口位于左侧主导航首组；
  - 辅助导航只保留`我的收藏 / 持续跟踪`，不再提供人工`判断更新`入口；内部`updated`状态仅承担历史兼容；
  - 新导入来源统一提交到应用级串行自动整理队列；启动空闲阶段自动恢复未完成分类，完成后驱动三个知识入口刷新；
  - 保存知识主题与来源的双向导航目标；
  - 移除手工标签与独立导入导出导航，批量交换从设置进入；
  - 四套皮肤名单由唯一目录持有，并向弹窗提供当前皮肤变量；已移除的铜金发簪旧偏好回退默认皮肤。
  - 移除顶层重复的`已保存 + 三点`；侧栏容量精简为`知识库占用 / 磁盘可用`两行 G 单位；回收站新增需要明确二次确认的`全部删除`；
  - 设置内数据交换只保留统一`批量导入与导出`入口，存储维护单独分组；导入日志状态固定在最右列。
- `src/components/KnowledgeReadingWorkspace.tsx`
  - 读取真实`KnowledgeTopicDetail`；
  - 默认`竞争假设`，同区切换`判断演变 / 笔记与来源 / 决策版本`；
  - 四状态各自只展示其负责对象，不再混合重复；
  - 正式假设/判断为空时基于已有笔记和来源正文确定性提炼，不再使用来源标题填充；
  - 跨主题事件线只在`判断演变`状态出现；
  - 首屏移除价值不清晰的`时间切片 / 生成研究上下文 / 重复维护`控件，改为当前主题的笔记、来源、判断数量；
  - 不向正式 Repository 写入自动提取结果。
  - 知识领域可折叠；外部定位或切换主题时自动展开当前主题所在领域。
  - `判断演变`按跨时期证据、版本差异和变化原因分层；`笔记与来源`按笔记索引、正文、直接来源分层；`决策版本`直接展示完整决策链，不再重复概览。
  - 关联线位置与长度按选中主题和阅读卡真实边缘测量；知识笔记为空时，`笔记与来源`直接阅读所选来源正文；
  - 正式决策为空时从正文建议/行动句生成可追溯草案，但不伪造实际行动、结果和复盘。
- `src/knowledge/knowledgeSynthesis.ts`
  - 对真实正文做有界语义切分、候选去重和跨来源关联；
  - 派生竞争解释、支持/反对正文片段、阶段判断、开放问题和决策草案；
  - 每项保存来源 ID、标题、正文引文和日期，仅作读取成果，不写库。
- `src/knowledge/knowledgeReadingModel.ts`
  - 组合当前主题与已确认相关主题的来源、笔记、命题、证据、判断、转折、问题和决策事件；
  - 派生到期、待复核和判断依赖风险，不写回数据库；
  - 汇总决策结果与到期复核数量。
- `src/components/TopicStructureReadingWorkspace.tsx`
  - 读取正式领域、主题、规则、别名、关系建议和主题详情；
  - 首屏将结构缺口整理成可执行待处理事项；
  - `进入主题管理`放在待处理事项上方；新建、编辑边界、添加别名、维护规则和关系建议分别进入对应操作。
  - 关联线不再依赖固定栏宽，随窗口和栏宽变化重新测量。
- `src/components/KnowledgeWorkspace.tsx`
  - 全部笔记首屏以大幅原文为主体，紧凑列表显示笔记数与人性化日期；
  - 接收`sourceItemId + locator`导航目标，但`locator`只保留为证据元数据，进入时只选择目标笔记并从正文顶部开始；`返回上一级`按进入前的主题洞察面板回到原面板并聚焦对应来源；直接进入全部笔记时默认回到竞争假设对应来源；
  - 正文位置只由本次手动提交搜索改变；最近搜索独立保存在本地界面偏好中，点击历史词只回填输入；PDF页码、音视频时间码等其他格式继续只显示诚实的定位说明；
  - `查看详情`保留在菜单外；收藏、持续跟踪、MD/DOCX 导出后复制文件和软删除进入三点菜单，空白点击或 Escape 关闭；
  - 来源搜索与筛选位于顶部同一行，状态标签独占下一行；列表定位只滚动不选中，正文文字查找明确称为搜索；
  - 来源图片/附件按来源对象读取 legacy 与 v4 关联；JPG/PNG 等图片按 MIME、附件类型或扩展名直接显示；通用标题由 Rust 读取层从正文补全；
  - 三个核心入口均有细橙关联线和左右同步橙色外框；
  - 主题管理二级页的领域与主题卡可直接进入编辑模式，主题可展开真实笔记并跳到来源档案；
  - 继续复用现有 Repository 和 migration v4 对象。
  - 来源档案新增统一筛选浮层：时间、来源类型、笔记关联；主题管理二级主卡提供`添加领域 / 添加主题 / 编辑结构`三个明确入口；
  - 展开主题时优先展示独立知识笔记，并补充未被笔记关联表覆盖的真实来源记录，两者均可回到来源档案。
  - 来源搜索由 Rust Repository 对全部来源正文执行，不受当前 120 条列表加载窗口限制；搜索历史仅保存在本机界面偏好，`全部加载`为显式低频操作；来源标题可在详情标题区直接修改。
  - 来源列表的 Record 快捷操作不再扩高卡片，默认隐藏并在悬停/焦点时覆盖显示于右侧中部；更多菜单增加列表级`查看详情`。
- `src/components/AttachmentPreview.tsx`、`src/attachments/attachmentPreview.ts`
  - 统一判定图片、PDF、文本、音频、视频和不支持格式；预览通过 portal 固定在应用最上层，支持 Escape/点击遮罩关闭；系统原应用只作为后备入口。
- `src/styles.css`
  - 左侧全高导航、窄中栏、右侧阅读区、细橙关联线、独立滚动和横向时间线；
  - 中栏选中项使用完整橙色渐变边框和锚点设计；
  - 场景皮肤的大工作区完整半透明冷白磨砂底已恢复，弹窗继承当前皮肤；
  - 修正显式`100vh`造成的底部越界，收藏/跟踪/判断更新页使用同一冷白磨砂主承托；
  - 修正场景皮肤将主区高度覆盖为`auto`的分叉，主区和记录工作区统一继承确定父高度，避免异步数据变化造成卡片缩短、跳动和位置偏移；正常上下留白值未改。
  - 以共享右侧阅读字号 Token 统一控制知识成果、来源正文和记录详情主体内容；当前为旧1.3倍版本的0.9，即原始字号1.17倍；显式保护正文链接、来源链接、按钮和元数据字号不变。
  - 场景页面标题、说明和加载态统一消费动态背景前景 Token；回收站空状态使用显式`scene-surface-state`冷白磨砂表面，不再依赖错误的直接子元素选择器，也不再把图片前景色复用到浅色卡片。
  - `我的收藏 / 持续跟踪`的两张主卡复用全部笔记的阅读比例与14px间距；左卡和右卡保持等高，窄视口保留足够列表宽度。
- `src/theme/knowledgeSkins.ts`
  - 运行时采样背景代表色，用 WCAG 相对亮度计算亮/暗方向与最低对比度；暖背景生成偏冷文字，冷背景生成偏暖文字；
  - 场景采样只调整页面文字可读性，不再派生卡片材质；所有场景卡片统一回到v54固定渐变、透明度、抖动与模糊职责；
  - 三套场景皮肤提供采样完成前的安全回退；`原版浅色`继续使用固定浅色界面，不进入场景背景规则。
- `src-tauri/src/commands.rs`、`src-tauri/src/paths.rs`
  - 存储统计增加磁盘剩余量与总容量；
  - 导出文件可作为 Windows 文件对象复制到剪贴板，路径严格限制在导出目录内。
  - 所有数据库、文件、附件、导出和备份命令使用异步 Tauri 调度，避免同步占用 WebView/UI 主线程；SQLite 仍由同一连接锁保证一致性。
- `src/performance/useRafScheduledCallback.ts`、`src/connectionGeometry.ts`
  - scroll、resize 和 ResizeObserver 统一合并到下一动画帧；
  - 关联线几何相同或只有亚像素浮动时不再触发 React 更新。
- `src/services/knowledgeRepository.ts`
  - 相同并发读取合并为一次 IPC；最近 8 篇选中来源正文有界复用；
  - 列表继续只读摘要，完整正文只在选中后读取。
  - 增加全库来源计数、全文搜索和标题修改接口；全文搜索与列表加载窗口彻底解耦。

### 4.2 正式数据与 Repository 边界

- 未修改 migration v1–v6 的既有字段语义；新增 migration v7 只承载AI语义档案、分类修订、归属草稿和撤销快照；
- Rust Repository 扩展主题详情、来源归属附件、全库正文搜索和标题修改；legacy record 回收站状态继续决定来源档案/收录查询可见性，恢复后来源重新出现；
- 未新增假数据到生产组件；
- 未后台打开正式`D:\南枫知识库`；
- 未执行正式数据库截至 migration v7 的任何本轮迁移；
- 未制作安装包或上传 GitHub。

## 5. 验证真相

| 层级 | 当前结果 |
|---|---|
| 前端单元/领域合同 | 190/190 通过；覆盖AI全库分类修订、主题成果包、自动关联来源、固定分屏、完整弹窗、圆形进度加载环、无本地生成回退、仓库与展示合同 |
| TypeScript | 通过 |
| Vite 生产构建 | 通过 |
| Playwright E2E | 完整18/18历史主回归继续有效；v108定向核心E2E1/1复跑通过，并实算单主题整理与全库分类进度弹窗加载环`border-radius:50%`。Chrome结果不冒充WebView2真实观感 |
| Windows Tauri `--no-bundle` | v108当前应用`.runtime-qa/current-acceptance-v108-app/release/nanfeng-knowledge-base.exe`由唯一BAT完成`--prepare / --verify`；最终大小与SHA见本节下方当前入口。未启动应用、正式数据或真实AI |
| Rust 全量 | 103/103通过；AI成果包、taxonomy revision应用/撤销、主题正文上下文、附件、来源、备份恢复和知识数据合同继续通过；旧本地分类兼容代码只在测试配置编译 |
| Rust knowledge 定向测试 | 36/36 通过 |
| Rust attachments 定向测试 | 9/9 通过；确认附件逐字节复制、来源对象跨legacy/v4关联读取、未物化多格式声明可检索，以及批量自动加载幂等/失败隔离 |
| 1584×1000 既有隔离浏览器 | 通过；四个知识状态、来源↔知识双向定位与五套皮肤的上一轮证据仍保留 |
| 内置浏览器视觉核对 | 导出提示在1280×720视口中心坐标(640,360)，2px橙框且显示在导出弹窗上层；截图`docs/screenshots/qa/export-toast-centered-v13.png`。知识仓库无桌面桥，四状态正式内容未冒充已验收 |
| 本轮同视口视觉 QA | 1280×720仅作为明确的小窗口响应式专项：120条时操作组由`right:0`绝对贴右，按钮与工具栏右边缘重合，右间距0px，摘要/操作间距8px，无重叠或溢出；证据`docs/screenshots/qa/four-entry-toolbar-120-far-right-1280x720.png`。该专项不替代1702×1066正式桌面对比 |
| 设置存储分层浏览器 QA | 1702×1066内置浏览器实测两卡等宽等高、操作底边一致、重复文案/范围节点为0；设置与主界面刷新按钮均可操作并同步同一状态，开发日志无error；前后同屏比较无P0/P1/P2。未执行正式Windows外部删除，不代表真实磁盘变化已验收 |
| 新 BAT `--verify` | `启动南枫知识库-当前验收.bat`使用v108源码完成`--prepare / --verify`；未启动程序、未打开正式数据、未调用真实AI |
| 南烛枫真实桌面 | 唯一当前BAT待确认真实MP4声音/进度/音量/全屏、Explorer选中、正式Markdown和多格式长笔记压力；自动验证不得替代 |
| 正式 migration v7 | 未执行；本轮未打开、迁移或写入正式库 |

隔离证据位于`.runtime-qa/knowledge-final-layout-evidence/`；生产组件没有使用这些夹具数据。

## 6. 当前 BAT 与正式数据边界

- 当前且唯一根目录入口：`启动南枫知识库-当前验收.bat`
- 当前界面程序：`.runtime-qa\current-acceptance-v119-app\release\nanfeng-knowledge-base.exe`
- 当前界面程序大小与SHA-256：38,735,872 bytes，`FD5398E24F125DA566FCE8AE5CC5B3BC464C517C83A635CB4B8E61943B91D24B`；设置页最底部“当前程序”卡计算同一运行文件，构建标签为`v119-shell-verbatim-path-safe-locator`。
- 历史验收BAT已移入`docs/archive/acceptance-entrypoints/`并改为不可执行扩展名；旧隔离程序除仍被现有进程占用者外清理。
- BAT 按南烛枫要求默认使用正式数据，不再显示 1/2 选择；只有南烛枫双击才进入真实路径。
- Codex 只执行`--prepare / --verify`；没有启动程序。
- 南烛枫首次双击时可能由应用按既有迁移规则对正式库应用截至 migration v10 的迁移；这一真实路径尚未由本轮 Codex 执行或验收。
- 旧苹果玻璃样板、旧皮肤、旧知识视图和旧图片专项隔离包均不得截图或作为当前场景材质证据；只有明确回归调查时才可引用并标注为旧证据。

## 7. 唯一下一步

当前唯一下一步是由南烛枫关闭其他南枫知识库窗口，双击`启动南枫知识库-当前验收.bat`，依次从正文资源、最高层预览和附件时间线各选择一个视频、图片、音频、PDF/Markdown及普通文件点击`定位文件`，再导出一篇 Markdown 或 DOCX 并点击`定位导出文件`；每次都应打开真实父目录并高亮对应文件，不得只打开默认“文档”或导出根目录。该路径不要求调用 AI，但程序可能按既有启动合同升级正式库，因此必须由南烛枫本人执行。不得把自动合同或原生 API 返回成功冒充完整软件内点击验收：

1. 三个入口是否真正符合文档职责，而非旧页面换名；
2. 场景皮肤是否保持完整磨砂白底；
3. AI不可用或尚未生成时，是否只显示原始笔记、已确认记录和等待/失败态，完全没有本地分析、本地摘要或本地分类回退；
4. 四入口每张卡是否只在鼠标悬停时于右侧中部显示收藏、完整导出和更多；仅选中卡片或让卡片自身获得焦点时必须隐藏，键盘实际聚焦操作按钮或菜单展开时保持显示；显示过程不改变卡片尺寸，更多菜单含查看详情并在空白点击或 Escape 时关闭；
5. 来源列表定位是否只滚动不切换；任何方式打开或切换笔记时正文是否回顶部且不重放旧关键词；正文历史是否只回填，只有本次点击`搜索`才滚动正文；
6. 主题管理是否能生成完整领域/主题体系并把全部有效笔记归入列表；低置信项是否明确待核对，应用前是否可完整预览，应用后是否可撤销；
7. 设置内批量导入导出、弹窗和磁盘容量是否正确；奔马等三套场景皮肤的页面标题/说明/加载态是否随明暗与冷暖保持反差，回收站空状态是否由冷白磨砂稳定承托；
8. 主题洞察是否由一次AI成果包生成主题综述；竞争假设、判断演变、决策与行动是否只在有证据时出现，空面板是否不以占位内容凑数；
9. JPG/PNG 是否默认以全屏预览并完整显示；顶部百分比是否以原图像素为准、100%时能否达到与原文件一致的1:1细节；右下角能否人工调整窗口大小，Ctrl+鼠标滚轮能否以光标为中心缩放，左键能否拖动图片，中键能否恢复当前窗口适配；PDF、文本/Markdown/JSON、音频和视频是否仍在软件最上层预览，点击遮罩或 Escape 是否关闭；不支持格式是否只提供明确后备动作；
10. 从知识证据进入全部笔记时是否只打开目标笔记而不自动定位正文；返回后原主题洞察面板和来源焦点是否仍能正确恢复。
11. 普通记录、全部笔记、主题洞察和主题管理的关联线是否都从左卡边缘准确连到右卡边缘，且右侧关联卡始终显示完整橙色线框。
12. 主题洞察四状态、全部笔记正文和记录详情的主体内容是否按旧版本的`0.9`达到合适阅读密度，同时来源链接、正文链接、按钮、元数据和左侧列表字号保持不变。
13. 判断演变、笔记与来源、决策版本是否都按竞争假设的清晰层级完整显示每个主区块；知识领域折叠后是否稳定，切换主题是否自动展开所在领域。
14. 我的收藏、持续跟踪的左右主卡是否与全部笔记保持相近比例、等高和正常上下留白；侧栏不得重新出现`判断更新`。
15. 搜索一个只存在于未加载正文中的短语是否仍能命中；清空后是否显示可复用历史；`全部加载`是否只改变列表量；标题修改后来源列表、详情和兼容记录是否同步。
16. 全部笔记、我的收藏、持续跟踪的卡片是否统一为语义图标、标题、主题、来源和右上日期；来源卡是否不再重复`0篇笔记`。
17. 主题洞察与主题管理的父子层级是否只缩进图标/标题，右侧数量是否保持一列对齐。
18. AI主题洞察生成后，鼠标停在右侧任意位置是否都能连续滚动到底；页面是否不再出现`本地分析`，而来源范围、原始笔记和结论引用仍可回溯。
19. 把四个知识Tab滚到当前画面顶部后，连续点击`竞争假设 / 判断演变 / 主题整合 / 决策版本`，Tab条和右侧卡片是否始终停在原位置，不向上或向下乱跳。

通过时只更新真实桌面验收状态；失败时只修复明确反馈范围。AI 只在已确认的 OpenRouter / DeepSeek、全库分类修订和主题成果包边界内继续，不主动扩大更多供应商、AI Hub、RAG、云同步、安装包或发布。

## 8. 停止条件与 Git 边界

完成真实桌面反馈后停止，并分层报告：设计已锁定、代码已实现、自动验证通过、BAT 已生成未验收、南烛枫真实桌面已确认、尚未验证风险。

- 不切回`main`；
- 不`reset --hard`、`clean`、`stash`或覆盖未知改动；
- 不后台打开、写入或重建正式数据；
- 不推送远端；只有南烛枫明确说“上传”时才处理正式 Release。
