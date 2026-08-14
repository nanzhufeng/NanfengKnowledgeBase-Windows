/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const agents = readProjectFile("AGENTS.md");
const masterSpec = readProjectFile("docs/南枫知识库_产品定义与自动分类主规格.md");
const architecture = readProjectFile("docs/architecture-governance.md");
const designBaseline = readProjectFile("docs/core-workspace-design-baseline.md");
const acceptance = readProjectFile("docs/core-workspace-acceptance-matrix.md");
const nextPrompt = readProjectFile("docs/next-codex-prompt.md");
const appShell = readProjectFile("src/App.tsx");
const knowledgeWorkspace = readProjectFile("src/components/KnowledgeWorkspace.tsx");
const unifiedNoteList = readProjectFile("src/components/UnifiedNoteListCard.tsx");
const tauriBootstrap = readProjectFile("src-tauri/src/lib.rs");
const attachmentService = readProjectFile("src-tauri/src/attachments.rs");
const dataOptimization = readProjectFile("src-tauri/src/data_optimization.rs");
const appPaths = readProjectFile("src-tauri/src/paths.rs");
const aiAutomationSettings = readProjectFile("src/components/AiAutomationSettings.tsx");
const aiModelPicker = readProjectFile("src/components/AiModelPicker.tsx");
const readingWorkspace = readProjectFile("src/components/KnowledgeReadingWorkspace.tsx");
const topicWorkspace = readProjectFile("src/components/TopicStructureReadingWorkspace.tsx");
const aiModels = readProjectFile("src-tauri/src/ai/models.rs");
const aiClient = readProjectFile("src-tauri/src/ai/client.rs");
const aiPromptCache = readProjectFile("src-tauri/src/ai/prompt_cache.rs");
const aiRepository = readProjectFile("src-tauri/src/ai/repository.rs");
const aiRepositoryClient = readProjectFile("src/services/aiRepository.ts");
const aiCommands = readProjectFile("src-tauri/src/commands.rs");
const styles = readProjectFile("src/styles.css");

describe("当前合同治理", () => {
  it("用户可见入口、内部兼容标识与历史证据边界明确", () => {
    for (const contract of [agents, masterSpec, architecture, designBaseline, acceptance, nextPrompt]) {
      expect(contract).toContain("主题洞察");
      expect(contract).toContain("全部笔记");
      expect(contract).toContain("主题管理");
    }
    expect(masterSpec).toContain("现行合同说明（2026-08-03）");
    expect(architecture).toContain("当前合同判定顺序");
    expect(designBaseline).toContain("只用于证据定位");
    expect(nextPrompt).toContain("当前分支：`codex/nanfeng-ai-automation-mvp-20260810`");
    expect(nextPrompt).toContain("AI 开发前保护 checkpoint：`30045e9e9a133802ea0a471baa8dd50370d84f45`");
  });

  it("旧阶段和旧视觉规则不能重新取得当前所有权", () => {
    expect(agents).not.toContain("闭合连续描边");
    expect(agents).toContain("禁止连续等亮白线、闭环白描边和统一渐变描边");
    expect(masterSpec).toContain("历史阶段：第一阶段 UI 原型（已完成，不再作为当前入口）");
    expect(masterSpec).not.toContain("第一阶段只用假数据，不接数据库。");
    expect(acceptance).not.toContain("最新入口为`启动南枫知识库-苹果玻璃亮度重构验收.bat`");
    expect(acceptance).not.toContain("| 待执行 |");
  });

  it("历史资料范围在搜索浮层内可见且桌面右键由应用接管", () => {
    expect(appShell).toContain("历史资料搜索");
    expect(appShell).toContain("UnifiedHistoricalSearchScope");
    expect(knowledgeWorkspace).toContain("UnifiedHistoricalSearchScope");
    expect(knowledgeWorkspace).toContain("searchSourceAttachmentCatalog(query, sourceSearchCategory)");
    expect(knowledgeWorkspace).toContain("groupSourceAttachmentsByMonth(visibleHits)");
    expect(knowledgeWorkspace).toContain("AttachmentTimelineDialog");
    expect(knowledgeWorkspace).toContain("coveredByPreview={attachmentPreviewOpen}");
    expect(knowledgeWorkspace).toContain("setSelectedId(hit.sourceItemId)");
    expect(knowledgeWorkspace).toContain("markSourceTextMatches");
    expect(knowledgeWorkspace).toContain("已跳转到正文匹配位置，并以黄色标记");
    expect(unifiedNoteList).toContain("搜索范围");
    expect(unifiedNoteList).toContain('{ value: "video", label: "视频" }');
    expect(appShell).toContain('document.addEventListener("contextmenu", openContextMenu)');
    expect(appShell).toContain("[data-note-context-menu='true']");
    expect(appShell).toContain("input, textarea, select");
    expect(appShell).toContain("video, audio, iframe, a[href]");
    expect(appShell).toContain("currentSourceContextRef");
    expect(appShell).toContain("搜索当前笔记标题");
    expect(appShell).toContain("导出当前笔记");
    expect(knowledgeWorkspace).toContain("onCurrentSourceContextChange");
    expect(knowledgeWorkspace).toContain("ensureSourceActionTarget(selected)");
    expect(appShell).not.toContain("网页捕获");
  });

  it("附件预览按单文件授权，清理候选先验证完整内容和目录树", () => {
    expect(tauriBootstrap).toContain("attachments::allow_known_attachment_assets");
    expect(tauriBootstrap).not.toContain("allow_directory(&paths.attachments, true)");
    expect(attachmentService).toContain("asset_protocol_scope().allow_file(&path)");
    expect(dataOptimization).toContain("directory_content_fingerprint");
    expect(dataOptimization).toContain("ensure_controlled_directory_tree");
  });

  it("原始导入归档只用于保真与明确存储操作，日常来源阅读从数据库读取", () => {
    expect(appPaths).toContain('imports_raw: root.join("imports").join("raw")');
    expect(appShell).toContain("readCachedStorageStats");
    expect(appShell).not.toContain('window.addEventListener("focus", refreshWhenActive)');
    expect(appShell).not.toContain('document.addEventListener("visibilitychange", refreshWhenActive)');
    expect(appShell).toContain("await reloadCollections(recordId);\n              await refreshStorageStats();");
    expect(appShell).toContain("await reloadCollections();\n              await refreshStorageStats();");
  });

  it("AI 自动整理在设置页只保留入口，详细配置复用可外部关闭的二级弹窗", () => {
    expect(appShell).toContain("<AiAutomationSettingsEntry onOpen={() => setAiAutomationSettingsOpen(true)} />");
    expect(appShell).toContain('className="ai-automation-dialog"');
    expect(appShell).toContain('sizePreferenceKey="ai-automation-dialog-v2"');
    expect(appShell).toContain('onClose={() => setAiAutomationSettingsOpen(false)}');
    expect(aiAutomationSettings).toContain("export function AiAutomationSettingsEntry");
    expect(aiAutomationSettings).toContain('className="settings-action-section ai-automation-entry"');
    expect(aiAutomationSettings).toContain('data-card-interaction="lift"');
    expect(aiAutomationSettings).toContain("onClick={onOpen}");
    expect(aiAutomationSettings).toContain('data-card-cue="forward"');
    expect(aiAutomationSettings).not.toContain('className="secondary-button"');
    expect(aiAutomationSettings).toContain('className="ai-settings-panel"');
    expect(aiAutomationSettings).not.toContain('className="ai-settings-panel elevated-card"');
    expect(aiAutomationSettings).toContain("AiModelPickerTrigger");
    expect(aiAutomationSettings).toContain("AiModelPickerDialog");
    expect(aiAutomationSettings).toContain("调用记录");
    expect(aiAutomationSettings).toContain("最近 50 条");
    expect(aiAutomationSettings).toContain("repository.listCallHistory()");
    expect(aiRepositoryClient).toContain('invokeAi("list_ai_call_history", { limit })');
    expect(aiRepositoryClient).toContain("aiCallHistoryEntrySchema");
    expect(aiRepositoryClient).toContain("errorMessage: z.string().nullable()");
    expect(aiAutomationSettings).not.toContain('<select value={modelId}');
    expect(aiModelPicker).toContain('className="ai-model-picker-trigger"');
    expect(aiModelPicker).toContain('className={`ai-model-option ${presentation.tone}${selected ? " selected" : ""}`}');
    expect(aiModelPicker).toContain('className="ai-model-picker-dialog"');
    expect(aiModelPicker).toContain('aria-label="选择 AI 模型"');
    expect(readingWorkspace).not.toContain("AiModelPicker");
    expect(readingWorkspace).not.toContain("aiModelSelection");
    expect(topicWorkspace).not.toContain("AiModelPicker");
    expect(topicWorkspace).not.toContain("aiModelSelection");
    expect(knowledgeWorkspace).not.toContain("setAiModelSelection");
    expect(topicWorkspace).toContain("const selectedResume = Boolean(aiResume);");
    expect(knowledgeWorkspace).toContain("aiRepository.runTaxonomyRevision(resumeTaskPublicId)");
    expect(knowledgeWorkspace).toContain("aiRepository.runIncrementalTaxonomyRevision()");
    expect(readingWorkspace).not.toContain('aria-label="主题洞察生成模型"\n                      value=');
    expect(topicWorkspace).not.toContain('aria-label="主题管理生成模型"\n                    value=');
    expect(styles).toContain(".ai-model-option.openai");
    expect(styles).toContain(".ai-model-option.anthropic");
    expect(styles).toContain(".ai-model-option.deepseek");
    expect(styles).toMatch(/\.settings-action-section\.ai-automation-entry\s*\{[\s\S]*?background:\s*var\(--settings-item-surface\);/);
    expect(styles).toMatch(/\.prototype-dialog\.ai-automation-dialog\s*\{[\s\S]*?width:\s*min\(1366px,[\s\S]*?height:\s*min\(872px,/);
    expect(styles).toContain(".ai-call-history-panel");
    expect(styles).toContain(".ai-call-history-item");
    expect(styles).toMatch(/\.ai-model-picker-dialog\s*\{[\s\S]*?width:\s*min\(840px,[\s\S]*?max-height:\s*min\(760px,/);
    expect(styles).toMatch(/\.ai-model-picker-options\s*\{[\s\S]*?align-content:\s*start;[\s\S]*?grid-auto-rows:\s*max-content;/);
    expect(styles).toMatch(/\.topic-final-filter-controls,\s*\.topic-final-ai-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
    expect(styles).toMatch(/\.settings-page > :is\([\s\S]*?\.ai-automation-entry,[\s\S]*?\.settings-list/);
  });

  it("所有模型从统一路由入口接入，并明确标注直连或 OpenRouter 来源", () => {
    expect(aiAutomationSettings).toContain('qwen_direct: "千问直连"');
    expect(aiAutomationSettings).toContain("任务路由基准");
    expect(aiAutomationSettings).toContain("routingMode");
    expect(aiAutomationSettings).toContain("manualSelection");
    expect(aiAutomationSettings).toContain("调用记录");
    expect(aiModelPicker).toContain("千问直连");
    expect(aiModelPicker).toContain("DeepSeek 直连");
    expect(aiModelPicker).toContain("OpenRouter");
    expect(aiModelPicker).toContain("自动规划");
    expect(knowledgeWorkspace).toContain("settings.routePreview");
    expect(knowledgeWorkspace).toContain("route.topicInsightModelId");
    expect(aiAutomationSettings).toContain("ai-api-key-saved-mask");
    expect(styles).toMatch(/\.ai-api-key-control input\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-height:\s*40px;/);
    expect(aiModels).toContain('QWEN_DEFAULT_ORGANIZATION_MODEL: &str = "qwen3.7-flash"');
    expect(aiModels).toContain('DEEPSEEK_DEFAULT_ORGANIZATION_MODEL: &str = "deepseek-v4-flash"');
    expect(aiModels).toContain("openrouter_task_model_route");
    expect(aiModels).toContain("same_family_candidate");
    expect(aiModels).toContain("AiTaskModelRoute");
    expect(aiModels).toContain('QWEN_COMPLEX_SYNTHESIS_MODEL: &str = "qwen3.7-plus"');
    expect(aiModels).toContain('QWEN_HARD_JUDGMENT_MODEL: &str = "qwen3.8-max-preview"');
    expect(aiModels).toContain("is_nanfeng_knowledge_base_model");
    expect(aiRepository).toContain("resolve_task_model_route");
    expect(aiRepository).toContain("automatic_task_model_route");
    expect(aiRepository).toContain("manual:");
    expect(aiClient).toContain("QWEN_API");
    expect(aiClient).toContain("keeps_only_knowledge_base_relevant_openrouter_fallbacks");
    expect(aiClient).toContain("prompt_cache::structured_request");
    expect(aiPromptCache).toContain('"cache_control"');
    expect(aiPromptCache).toContain('body["session_id"]');
    expect(aiPromptCache).toContain('body["prompt_cache_key"]');
    expect(aiPromptCache).toContain("PROMPT_CONTRACT_VERSION");
    expect(aiRepository).toContain("record_task_model_step");
    expect(aiCommands).toContain("resolve_task_model_route");
    expect(aiCommands).toContain("profile_model_id");
    expect(aiClient).not.toContain("DeepseekDirect => QWEN_API");
  });
});
