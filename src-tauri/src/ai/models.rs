use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AiProviderChannel {
    Openrouter,
    DeepseekDirect,
}

impl AiProviderChannel {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Openrouter => "openrouter",
            Self::DeepseekDirect => "deepseek_direct",
        }
    }

    pub fn parse(value: &str) -> AppResult<Self> {
        match value {
            "openrouter" => Ok(Self::Openrouter),
            "deepseek_direct" => Ok(Self::DeepseekDirect),
            _ => Err(AppError::Validation(format!(
                "不支持的 AI 接入通道：{value}"
            ))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AiModelPricing {
    pub prompt: Option<String>,
    pub completion: Option<String>,
    pub request: Option<String>,
    pub cache_hit: Option<String>,
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
    pub total_tokens: i64,
    pub known_cost_usd: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettingsView {
    pub active_channel: String,
    pub providers: Vec<AiProviderSettingsView>,
    pub usage: AiUsageSummary,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAiSettingsInput {
    pub active_channel: AiProviderChannel,
    pub selected_model_id: Option<String>,
    #[serde(default)]
    pub api_key: Option<String>,
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
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTopicInsightView {
    pub topic_id: i64,
    pub task_public_id: String,
    pub provider_channel: String,
    pub model_id: String,
    pub payload: AiTopicInsightPayload,
    pub generated_at: String,
}

#[derive(Debug, Clone, Default)]
pub struct AiTaskUsage {
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub reasoning_tokens: i64,
    pub cached_tokens: i64,
    pub total_tokens: i64,
    pub cost_usd: Option<f64>,
    pub cost_kind: String,
    pub pricing_snapshot_json: String,
}

#[derive(Debug, Clone)]
pub struct AiCompletionResult {
    pub insight: AiTopicInsightPayload,
    pub usage: AiTaskUsage,
}
