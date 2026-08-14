use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AiProviderChannel {
    Openrouter,
    DeepseekDirect,
    QwenDirect,
}

impl AiProviderChannel {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Openrouter => "openrouter",
            Self::DeepseekDirect => "deepseek_direct",
            Self::QwenDirect => "qwen_direct",
        }
    }

    pub fn parse(value: &str) -> AppResult<Self> {
        match value {
            "openrouter" => Ok(Self::Openrouter),
            "deepseek_direct" => Ok(Self::DeepseekDirect),
            "qwen_direct" => Ok(Self::QwenDirect),
            _ => Err(AppError::Validation(format!(
                "不支持的 AI 接入通道：{value}"
            ))),
        }
    }
}

pub const QWEN_DEFAULT_ORGANIZATION_MODEL: &str = "qwen3.7-flash";
pub const QWEN_COMPLEX_SYNTHESIS_MODEL: &str = "qwen3.7-plus";
pub const QWEN_HARD_JUDGMENT_MODEL: &str = "qwen3.8-max-preview";
pub const DEEPSEEK_DEFAULT_ORGANIZATION_MODEL: &str = "deepseek-v4-flash";
pub const DEEPSEEK_COMPLEX_SYNTHESIS_MODEL: &str = "deepseek-v4-pro";

/// 千问直连没有可安全依赖的模型枚举接口。这里仅保留本产品已核对、
/// 与任务路由对应的三个稳定型号；实际权限仍由首次任务调用确认。
pub fn qwen_model_catalog() -> Vec<AiModelDescriptor> {
    [
        (QWEN_DEFAULT_ORGANIZATION_MODEL, "Qwen3.7 Flash", ""),
        (QWEN_COMPLEX_SYNTHESIS_MODEL, "Qwen3.7 Plus", ""),
        (
            QWEN_HARD_JUDGMENT_MODEL,
            "Qwen3.8 Max（预览）",
            "高难判断 · 仅在主题洞察中明确选择",
        ),
    ]
    .into_iter()
    .map(|(id, name, capability)| AiModelDescriptor {
        id: id.to_string(),
        name: format!("{name} · {capability}"),
        author: "qwen".to_string(),
        canonical_slug: Some(id.to_string()),
        created_at: None,
        context_length: None,
        supported_parameters: vec!["response_format".to_string()],
        pricing: AiModelPricing::default(),
    })
    .collect()
}

/// 手动模型列表只保留南枫知识库确实需要的档位。日常生成由千问/DeepSeek直连承担；
/// OpenRouter只保留可作为人工高质量兜底的 OpenAI Terra 与 Anthropic Sonnet，避免
/// 同系列的 Luna、Opus、重复 Pro 或经 OpenRouter 的 DeepSeek 把选择变成成本噪音。
pub fn is_nanfeng_knowledge_base_model(
    channel: AiProviderChannel,
    model: &AiModelDescriptor,
) -> bool {
    let identity = format!("{} {}", model.id, model.name).to_ascii_lowercase();
    match channel {
        AiProviderChannel::QwenDirect => matches!(
            model.id.as_str(),
            QWEN_DEFAULT_ORGANIZATION_MODEL
                | QWEN_COMPLEX_SYNTHESIS_MODEL
                | QWEN_HARD_JUDGMENT_MODEL
        ),
        AiProviderChannel::DeepseekDirect => matches!(
            model.id.as_str(),
            DEEPSEEK_DEFAULT_ORGANIZATION_MODEL | DEEPSEEK_COMPLEX_SYNTHESIS_MODEL
        ),
        AiProviderChannel::Openrouter => match model.author.to_ascii_lowercase().as_str() {
            "openai" => identity.contains("terra"),
            "anthropic" => identity.contains("sonnet"),
            _ => false,
        },
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AiModelPricing {
    pub prompt: Option<String>,
    pub completion: Option<String>,
    pub request: Option<String>,
    pub cache_hit: Option<String>,
    pub cache_write: Option<String>,
    pub effective_at: Option<String>,
    pub rate_label: Option<String>,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiModelDescriptor {
    pub id: String,
    pub name: String,
    pub author: String,
    pub canonical_slug: Option<String>,
    pub created_at: Option<i64>,
    pub context_length: Option<i64>,
    #[serde(default)]
    pub supported_parameters: Vec<String>,
    #[serde(default)]
    pub pricing: AiModelPricing,
}

/// 一次任务开始时解析并冻结的模型路线。设置中的选择是通道/模型家族的
/// 基准，不是每一个 AI 阶段都直接照搬的模型；断点续跑必须使用这里的快照。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AiTaskModelRoute {
    pub profile_model_id: String,
    pub synthesis_model_id: String,
    pub topic_insight_model_id: String,
}

pub fn task_model_route(
    channel: AiProviderChannel,
    selected_model_id: &str,
    catalog: &[AiModelDescriptor],
) -> AiTaskModelRoute {
    match channel {
        AiProviderChannel::QwenDirect => AiTaskModelRoute {
            profile_model_id: QWEN_DEFAULT_ORGANIZATION_MODEL.to_string(),
            synthesis_model_id: QWEN_COMPLEX_SYNTHESIS_MODEL.to_string(),
            topic_insight_model_id: if selected_model_id == QWEN_HARD_JUDGMENT_MODEL {
                QWEN_HARD_JUDGMENT_MODEL.to_string()
            } else {
                QWEN_COMPLEX_SYNTHESIS_MODEL.to_string()
            },
        },
        AiProviderChannel::DeepseekDirect => AiTaskModelRoute {
            profile_model_id: DEEPSEEK_DEFAULT_ORGANIZATION_MODEL.to_string(),
            synthesis_model_id: DEEPSEEK_COMPLEX_SYNTHESIS_MODEL.to_string(),
            // DeepSeek 直连当前只有已核对的 Flash/Pro 两档；Pro 同时承担
            // 跨文档与少量高难判断，避免自动跳到未审计的更高成本型号。
            topic_insight_model_id: DEEPSEEK_COMPLEX_SYNTHESIS_MODEL.to_string(),
        },
        AiProviderChannel::Openrouter => openrouter_task_model_route(selected_model_id, catalog),
    }
}

fn openrouter_task_model_route(
    selected_model_id: &str,
    catalog: &[AiModelDescriptor],
) -> AiTaskModelRoute {
    let profile_model_id = same_family_candidate(
        selected_model_id,
        catalog,
        &["flash", "mini", "nano", "haiku", "fast", "luna", "small"],
    )
    .unwrap_or_else(|| selected_model_id.to_string());
    let synthesis_model_id = same_family_candidate(
        selected_model_id,
        catalog,
        &["terra", "sonnet", "plus", "pro", "medium", "balanced"],
    )
    .unwrap_or_else(|| selected_model_id.to_string());
    let explicit_hard_choice =
        model_has_tier(selected_model_id, catalog, &["sol", "opus", "max", "ultra"]);
    AiTaskModelRoute {
        profile_model_id,
        synthesis_model_id: synthesis_model_id.clone(),
        // 高难档绝不因目录排序或普通任务自动升级；只有用户把基准明确选到
        // 同家族高难模型时，主题洞察才使用它。
        topic_insight_model_id: if explicit_hard_choice {
            selected_model_id.to_string()
        } else {
            synthesis_model_id
        },
    }
}

fn same_family_candidate(
    selected_model_id: &str,
    catalog: &[AiModelDescriptor],
    tiers: &[&str],
) -> Option<String> {
    let family = model_family(selected_model_id, catalog)?;
    tiers.iter().find_map(|tier| {
        catalog
            .iter()
            .find(|model| {
                model_family(&model.id, catalog).as_deref() == Some(family.as_str())
                    && model_text(model).contains(tier)
            })
            .map(|model| model.id.clone())
    })
}

fn model_has_tier(model_id: &str, catalog: &[AiModelDescriptor], tiers: &[&str]) -> bool {
    let text = catalog
        .iter()
        .find(|model| model.id == model_id)
        .map(model_text)
        .unwrap_or_else(|| model_id.to_lowercase());
    tiers.iter().any(|tier| text.contains(tier))
}

fn model_family(model_id: &str, catalog: &[AiModelDescriptor]) -> Option<String> {
    catalog
        .iter()
        .find(|model| model.id == model_id)
        .map(|model| model.author.trim().to_lowercase())
        .filter(|author| !author.is_empty())
        .or_else(|| {
            model_id
                .split('/')
                .next()
                .map(|part| part.trim().to_lowercase())
        })
        .filter(|family| !family.is_empty())
}

fn model_text(model: &AiModelDescriptor) -> String {
    format!(
        "{} {} {}",
        model.id,
        model.name,
        model.canonical_slug.as_deref().unwrap_or_default()
    )
    .to_lowercase()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderSettingsView {
    pub channel: String,
    pub configured: bool,
    pub selected_model_id: Option<String>,
    pub models: Vec<AiModelDescriptor>,
    pub catalog_refreshed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AiUsageSummary {
    pub task_count: i64,
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub cached_tokens: i64,
    pub cache_write_tokens: i64,
    pub total_tokens: i64,
    pub known_cost_usd: f64,
    pub known_cache_savings_usd: f64,
    pub known_cost_task_count: i64,
    pub unknown_cost_task_count: i64,
    pub known_cache_savings_record_count: i64,
    pub unknown_cache_savings_record_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettingsView {
    /// `active_channel`是旧字段的兼容投影；自动规划时为空。
    pub active_channel: Option<String>,
    pub routing_mode: String,
    pub manual_selection: Option<AiModelSelectionView>,
    pub route_preview: Option<AiTaskRoutePreview>,
    pub providers: Vec<AiProviderSettingsView>,
    pub usage: AiUsageSummary,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiModelSelectionView {
    pub channel: String,
    pub model_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTaskRoutePreview {
    pub provider_channel: String,
    pub profile_model_id: String,
    pub synthesis_model_id: String,
    pub topic_insight_model_id: String,
}

/// 用户可见的 AI 调用账本行。它只携带运行状态和用量，不包含提示词、正文或密钥。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCallHistoryEntry {
    pub task_public_id: String,
    pub task_kind: String,
    pub stage: Option<String>,
    pub provider_channel: String,
    pub model_id: String,
    pub status: String,
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub reasoning_tokens: i64,
    pub cached_tokens: i64,
    pub total_tokens: i64,
    pub occurred_at: String,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAiSettingsInput {
    #[serde(default = "default_ai_routing_mode")]
    pub routing_mode: String,
    #[serde(default)]
    pub manual_selection: Option<AiModelSelectionInput>,
}

fn default_ai_routing_mode() -> String {
    "auto".to_string()
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshAiModelsInput {
    pub channel: AiProviderChannel,
    #[serde(default)]
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiKeyInsight {
    pub title: String,
    pub detail: String,
    #[serde(default)]
    pub source_item_ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiEvidenceReference {
    pub stance: String,
    pub content: String,
    pub source_item_id: Option<i64>,
    pub locator_label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTopicManagementSuggestion {
    pub action: String,
    pub title: String,
    pub reason: String,
    pub target_topic_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCompetingHypothesis {
    pub title: String,
    pub statement: String,
    pub confidence: f64,
    pub invalidation_condition: String,
    #[serde(default)]
    pub source_item_ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiJudgmentEvolutionItem {
    pub occurred_at: Option<String>,
    pub title: String,
    pub from_statement: Option<String>,
    pub to_statement: String,
    pub reason: String,
    #[serde(default)]
    pub source_item_ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiDecisionInsight {
    pub title: String,
    pub basis: String,
    pub action: String,
    pub result: Option<String>,
    pub status: String,
    #[serde(default)]
    pub source_item_ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTopicInsightPayload {
    pub summary_markdown: String,
    #[serde(default)]
    pub key_insights: Vec<AiKeyInsight>,
    #[serde(default)]
    pub evidence: Vec<AiEvidenceReference>,
    #[serde(default)]
    pub open_questions: Vec<String>,
    #[serde(default)]
    pub topic_management_suggestions: Vec<AiTopicManagementSuggestion>,
    #[serde(default)]
    pub hypotheses: Vec<AiCompetingHypothesis>,
    #[serde(default)]
    pub judgment_evolution: Vec<AiJudgmentEvolutionItem>,
    #[serde(default)]
    pub decisions: Vec<AiDecisionInsight>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTopicInsightView {
    pub topic_id: i64,
    pub task_public_id: String,
    pub provider_channel: String,
    pub model_id: String,
    pub input_fingerprint: String,
    pub payload: AiTopicInsightPayload,
    pub generated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiModelSelectionInput {
    pub channel: AiProviderChannel,
    pub model_id: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTaskUsage {
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub reasoning_tokens: i64,
    pub cached_tokens: i64,
    #[serde(default)]
    pub cache_miss_tokens: i64,
    #[serde(default)]
    pub cache_write_tokens: i64,
    pub total_tokens: i64,
    pub cost_usd: Option<f64>,
    pub cost_kind: String,
    pub pricing_snapshot_json: String,
    #[serde(default)]
    pub cache_mode: String,
    #[serde(default)]
    pub stable_prefix_hash: String,
    #[serde(default)]
    pub cache_key_hash: String,
    #[serde(default)]
    pub prompt_contract_version: String,
    #[serde(default)]
    pub duration_ms: Option<i64>,
    #[serde(default)]
    pub cache_discount_usd: Option<f64>,
    #[serde(default)]
    pub cache_savings_usd: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct AiCompletionResult {
    pub insight: AiTopicInsightPayload,
    pub usage: AiTaskUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSourceProfile {
    pub source_item_id: i64,
    pub summary: String,
    #[serde(default)]
    pub concepts: Vec<String>,
    #[serde(default)]
    pub candidate_topics: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct AiSourceMaterial {
    pub source_item_id: i64,
    pub title: String,
    pub content: String,
    pub content_sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTaxonomyDomainProposal {
    pub key: String,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTaxonomyTopicProposal {
    pub key: String,
    pub domain_key: String,
    pub parent_key: Option<String>,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub integration_markdown: String,
    #[serde(default)]
    pub source_item_ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTaxonomyTopicIntegration {
    pub topic_key: String,
    pub integration_markdown: String,
    #[serde(default)]
    pub source_item_ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTaxonomyAssignmentProposal {
    pub source_item_id: i64,
    pub topic_key: String,
    pub confidence: f64,
    pub reason: String,
    pub uncertain: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTaxonomyStructure {
    #[serde(default)]
    pub domains: Vec<AiTaxonomyDomainProposal>,
    #[serde(default)]
    pub topics: Vec<AiTaxonomyTopicProposal>,
}

#[derive(Debug, Clone)]
pub struct AiTaxonomyRunCheckpoint {
    pub task_public_id: String,
    pub execution_contract_version: String,
    pub provider_channel: AiProviderChannel,
    pub model_id: String,
    pub profile_model_id: String,
    pub source_snapshot_json: String,
    pub run_mode: String,
    pub baseline_revision_public_id: Option<String>,
    pub profiles: Vec<AiSourceProfile>,
    pub taxonomy: Option<AiTaxonomyStructure>,
    pub assignments: Vec<AiTaxonomyAssignmentProposal>,
    pub profile_offset: usize,
    pub assignment_offset: usize,
    pub base_assignment_count: usize,
    pub integration_offset: usize,
    pub integration_topic_keys: Vec<String>,
    pub stage: String,
    pub usage: AiTaskUsage,
    pub updated_at: String,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTaxonomyResumeView {
    pub task_public_id: String,
    pub provider_channel: String,
    pub model_id: String,
    pub stage: String,
    pub source_count: i64,
    pub profiled_source_count: i64,
    pub assigned_source_count: i64,
    pub integrated_topic_count: i64,
    pub total_topic_count: i64,
    pub total_tokens: i64,
    pub cost_usd: Option<f64>,
    pub updated_at: String,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTaxonomyRevisionView {
    pub public_id: String,
    pub task_public_id: String,
    pub provider_channel: String,
    pub model_id: String,
    pub status: String,
    pub domains: Vec<AiTaxonomyDomainProposal>,
    pub topics: Vec<AiTaxonomyTopicProposal>,
    pub assignments: Vec<AiTaxonomyAssignmentProposal>,
    pub source_count: i64,
    pub assigned_source_count: i64,
    pub uncertain_source_count: i64,
    pub created_at: String,
    pub applied_at: Option<String>,
    pub undone_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTaxonomyApplyResult {
    pub revision_public_id: String,
    pub created_domains: i64,
    pub created_topics: i64,
    pub assigned_sources: i64,
    pub uncertain_sources: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_picker_excludes_redundant_or_costly_fallbacks() {
        assert!(is_nanfeng_knowledge_base_model(
            AiProviderChannel::Openrouter,
            &descriptor("openai/gpt-5.6-terra", "OpenAI", "GPT-5.6 Terra"),
        ));
        assert!(is_nanfeng_knowledge_base_model(
            AiProviderChannel::Openrouter,
            &descriptor("anthropic/claude-sonnet-5", "Anthropic", "Claude Sonnet 5"),
        ));
        assert!(!is_nanfeng_knowledge_base_model(
            AiProviderChannel::Openrouter,
            &descriptor("openai/gpt-5.6-luna", "OpenAI", "GPT-5.6 Luna"),
        ));
        assert!(!is_nanfeng_knowledge_base_model(
            AiProviderChannel::Openrouter,
            &descriptor("anthropic/claude-opus-5", "Anthropic", "Claude Opus 5"),
        ));
    }

    #[test]
    fn qwen_taxonomy_uses_flash_for_volume_and_plus_for_cross_document_synthesis() {
        let route = task_model_route(
            AiProviderChannel::QwenDirect,
            QWEN_DEFAULT_ORGANIZATION_MODEL,
            &qwen_model_catalog(),
        );
        assert_eq!(route.profile_model_id, QWEN_DEFAULT_ORGANIZATION_MODEL,);
        assert_eq!(route.synthesis_model_id, QWEN_COMPLEX_SYNTHESIS_MODEL,);
        assert_eq!(route.topic_insight_model_id, QWEN_COMPLEX_SYNTHESIS_MODEL,);
        assert_eq!(
            task_model_route(
                AiProviderChannel::QwenDirect,
                QWEN_HARD_JUDGMENT_MODEL,
                &qwen_model_catalog(),
            )
            .topic_insight_model_id,
            QWEN_HARD_JUDGMENT_MODEL,
        );
    }

    #[test]
    fn deepseek_taxonomy_uses_flash_for_volume_and_pro_for_synthesis() {
        let route = task_model_route(AiProviderChannel::DeepseekDirect, "deepseek-v4-flash", &[]);
        assert_eq!(route.profile_model_id, DEEPSEEK_DEFAULT_ORGANIZATION_MODEL,);
        assert_eq!(route.synthesis_model_id, DEEPSEEK_COMPLEX_SYNTHESIS_MODEL,);
        assert_eq!(
            route.topic_insight_model_id,
            DEEPSEEK_COMPLEX_SYNTHESIS_MODEL
        );
    }

    #[test]
    fn openrouter_uses_same_family_tiers_and_never_crosses_provider() {
        let catalog = vec![
            descriptor("openai/gpt-5.6-luna", "OpenAI", "GPT-5.6 Luna"),
            descriptor("openai/gpt-5.6-terra", "OpenAI", "GPT-5.6 Terra"),
            descriptor("openai/gpt-5.6-sol", "OpenAI", "GPT-5.6 Sol"),
            descriptor("anthropic/claude-5-fast", "Anthropic", "Claude 5 Fast"),
        ];
        let route = task_model_route(
            AiProviderChannel::Openrouter,
            "openai/gpt-5.6-sol",
            &catalog,
        );
        assert_eq!(route.profile_model_id, "openai/gpt-5.6-luna");
        assert_eq!(route.synthesis_model_id, "openai/gpt-5.6-terra");
        assert_eq!(route.topic_insight_model_id, "openai/gpt-5.6-sol");

        let fallback = task_model_route(
            AiProviderChannel::Openrouter,
            "anthropic/claude-5-fast",
            &catalog,
        );
        assert_eq!(fallback.profile_model_id, "anthropic/claude-5-fast");
        assert_eq!(fallback.synthesis_model_id, "anthropic/claude-5-fast");
    }

    fn descriptor(id: &str, author: &str, name: &str) -> AiModelDescriptor {
        AiModelDescriptor {
            id: id.to_string(),
            name: name.to_string(),
            author: author.to_string(),
            canonical_slug: None,
            created_at: None,
            context_length: None,
            supported_parameters: Vec::new(),
            pricing: AiModelPricing::default(),
        }
    }
}
