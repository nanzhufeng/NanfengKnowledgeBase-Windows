use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use crate::ai::models::AiProviderChannel;

pub const PROMPT_CONTRACT_VERSION: &str = "nfkb-prompt-cache-v2";
/// 任何会改变 AI 结果语义、结构化输出或阶段推理策略的修改都必须升级此版本。
pub const AI_EXECUTION_CONTRACT_VERSION: &str = "nfkb-ai-execution-v1";
// 本地只做保守估算，不能冒充供应商分词结果。阈值留出安全余量，避免在
// 1024 token 边界附近把实际不够长的前缀记为“已请求显式缓存”。
const QWEN_EXPLICIT_CACHE_MIN_ESTIMATED_TOKENS: usize = 1_536;
const ANTHROPIC_EXPLICIT_CACHE_MIN_ESTIMATED_TOKENS: usize = 2_048;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InferenceReasoningMode {
    ProviderDefault,
    Disabled,
}

impl InferenceReasoningMode {
    fn cache_key_fragment(self) -> &'static str {
        match self {
            Self::ProviderDefault => "provider-default",
            Self::Disabled => "disabled",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PromptCacheMetadata {
    pub mode: String,
    pub stable_prefix_hash: String,
    pub cache_key_hash: String,
    pub prompt_contract_version: String,
}

#[derive(Debug, Clone)]
pub struct PromptRequest {
    pub body: Value,
    pub cache: PromptCacheMetadata,
}

#[allow(clippy::too_many_arguments)]
pub fn structured_request(
    channel: AiProviderChannel,
    model_id: &str,
    stage: &str,
    schema_name: &str,
    system: &str,
    stable_user: Option<&str>,
    dynamic_user: &str,
    schema: Value,
    temperature: f64,
    reasoning_mode: InferenceReasoningMode,
) -> PromptRequest {
    let schema_text = serde_json::to_string(&schema).unwrap_or_else(|_| "{}".to_string());
    let system_content = match channel {
        AiProviderChannel::Openrouter => system.to_string(),
        AiProviderChannel::DeepseekDirect | AiProviderChannel::QwenDirect => {
            format!("{system}\nJSON Schema：{schema_text}")
        }
    };
    let stable_prompt = format!(
        "system:\n{system_content}\nresponse_schema:\n{schema_text}\nstable_context:\n{}",
        stable_user.unwrap_or_default()
    );
    let stable_prefix_hash = sha256_hex(&stable_prompt);
    let cache_key_hash = sha256_hex(&format!(
        "{PROMPT_CONTRACT_VERSION}|{}|{model_id}|{stage}|{}|{stable_prefix_hash}",
        channel.as_str(),
        reasoning_mode.cache_key_fragment(),
    ));
    let explicit_cache_threshold = match channel {
        AiProviderChannel::QwenDirect => Some(QWEN_EXPLICIT_CACHE_MIN_ESTIMATED_TOKENS),
        AiProviderChannel::Openrouter
            if model_id.to_ascii_lowercase().starts_with("anthropic/") =>
        {
            Some(ANTHROPIC_EXPLICIT_CACHE_MIN_ESTIMATED_TOKENS)
        }
        _ => None,
    };
    let explicit_cache = explicit_cache_threshold
        .is_some_and(|threshold| estimated_tokens(&stable_prompt) >= threshold);
    let mode = if explicit_cache {
        "explicit"
    } else if channel == AiProviderChannel::QwenDirect {
        "implicit"
    } else {
        "automatic"
    };
    let messages = build_messages(
        channel,
        &system_content,
        stable_user,
        dynamic_user,
        explicit_cache,
    );
    let mut body = match channel {
        AiProviderChannel::Openrouter => json!({
            "model": model_id,
            "messages": messages,
            "temperature": temperature,
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": schema_name, "strict": true, "schema": schema}
            }
        }),
        AiProviderChannel::DeepseekDirect | AiProviderChannel::QwenDirect => json!({
            "model": model_id,
            "messages": messages,
            "temperature": temperature,
            "response_format": {"type": "json_object"}
        }),
    };
    if channel == AiProviderChannel::Openrouter {
        body["session_id"] = Value::String(format!("nfkb-{}", &cache_key_hash[..48]));
        body["prompt_cache_key"] = Value::String(cache_key_hash.clone());
    }
    if reasoning_mode == InferenceReasoningMode::Disabled {
        match channel {
            AiProviderChannel::QwenDirect => {
                // 百炼 Chat Completions 要求 enable_thinking 与 model/messages 同级。
                body["enable_thinking"] = Value::Bool(false);
            }
            AiProviderChannel::DeepseekDirect => {
                body["thinking"] = json!({"type": "disabled"});
            }
            AiProviderChannel::Openrouter => {}
        }
    }
    PromptRequest {
        body,
        cache: PromptCacheMetadata {
            mode: mode.to_string(),
            stable_prefix_hash,
            cache_key_hash,
            prompt_contract_version: PROMPT_CONTRACT_VERSION.to_string(),
        },
    }
}

fn build_messages(
    channel: AiProviderChannel,
    system: &str,
    stable_user: Option<&str>,
    dynamic_user: &str,
    explicit_cache: bool,
) -> Value {
    match (
        stable_user.filter(|value| !value.is_empty()),
        explicit_cache,
    ) {
        (Some(stable), true) if channel == AiProviderChannel::QwenDirect => json!([
            {"role": "system", "content": system},
            {"role": "user", "content": [
                {"type": "text", "text": stable, "cache_control": {"type": "ephemeral"}}
            ]},
            {"role": "user", "content": dynamic_user}
        ]),
        (Some(stable), true) => json!([
            {"role": "system", "content": system},
            {"role": "user", "content": [
                {"type": "text", "text": stable, "cache_control": {"type": "ephemeral"}},
                {"type": "text", "text": dynamic_user}
            ]}
        ]),
        (Some(stable), false) => json!([
            {"role": "system", "content": system},
            {"role": "user", "content": format!("{stable}\n\n{dynamic_user}")}
        ]),
        (None, true) => json!([
            {"role": "system", "content": [
                {"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}
            ]},
            {"role": "user", "content": dynamic_user}
        ]),
        (None, false) => json!([
            {"role": "system", "content": system},
            {"role": "user", "content": dynamic_user}
        ]),
    }
}

fn estimated_tokens(value: &str) -> usize {
    let mut ascii = 0usize;
    let mut non_ascii = 0usize;
    for character in value.chars() {
        if character.is_ascii() {
            ascii += 1;
        } else {
            non_ascii += 1;
        }
    }
    ascii.div_ceil(4) + non_ascii
}

fn sha256_hex(value: &str) -> String {
    hex::encode(Sha256::digest(value.as_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn schema() -> Value {
        json!({"type": "object", "properties": {"ok": {"type": "boolean"}}})
    }

    #[test]
    fn dynamic_suffix_does_not_change_cache_key() {
        let first = structured_request(
            AiProviderChannel::DeepseekDirect,
            "deepseek-v4-flash",
            "assignments",
            "test",
            "固定规则",
            Some("固定 taxonomy"),
            "批次一",
            schema(),
            0.1,
            InferenceReasoningMode::ProviderDefault,
        );
        let second = structured_request(
            AiProviderChannel::DeepseekDirect,
            "deepseek-v4-flash",
            "assignments",
            "test",
            "固定规则",
            Some("固定 taxonomy"),
            "批次二",
            schema(),
            0.1,
            InferenceReasoningMode::ProviderDefault,
        );
        assert_eq!(first.cache.cache_key_hash, second.cache.cache_key_hash);
        assert_ne!(first.body, second.body);
    }

    #[test]
    fn model_or_stable_context_changes_cache_key() {
        let base = structured_request(
            AiProviderChannel::Openrouter,
            "openai/test",
            "assignments",
            "test",
            "固定规则",
            Some("taxonomy-a"),
            "动态",
            schema(),
            0.1,
            InferenceReasoningMode::ProviderDefault,
        );
        let changed = structured_request(
            AiProviderChannel::Openrouter,
            "openai/test-2",
            "assignments",
            "test",
            "固定规则",
            Some("taxonomy-b"),
            "动态",
            schema(),
            0.1,
            InferenceReasoningMode::ProviderDefault,
        );
        assert_ne!(base.cache.cache_key_hash, changed.cache.cache_key_hash);
        assert!(!base.cache.cache_key_hash.contains("taxonomy"));
    }

    #[test]
    fn qwen_marks_only_a_long_stable_prefix_for_explicit_cache() {
        let long_taxonomy = "稳定主题体系".repeat(1_100);
        let explicit = structured_request(
            AiProviderChannel::QwenDirect,
            "qwen3.7-flash",
            "assignments",
            "test",
            "固定规则",
            Some(&long_taxonomy),
            "动态批次",
            schema(),
            0.1,
            InferenceReasoningMode::ProviderDefault,
        );
        assert_eq!(explicit.cache.mode, "explicit");
        assert_eq!(
            explicit
                .body
                .pointer("/messages/1/content/0/cache_control/type"),
            Some(&Value::String("ephemeral".to_string()))
        );
        assert_eq!(
            explicit.body.pointer("/messages/2/content"),
            Some(&Value::String("动态批次".to_string()))
        );

        let implicit = structured_request(
            AiProviderChannel::QwenDirect,
            "qwen3.7-flash",
            "profiles",
            "test",
            "短规则",
            None,
            "动态批次",
            schema(),
            0.1,
            InferenceReasoningMode::ProviderDefault,
        );
        assert_eq!(implicit.cache.mode, "implicit");
        assert!(implicit
            .body
            .pointer("/messages/0/content/0/cache_control")
            .is_none());
    }

    #[test]
    fn qwen_near_minimum_estimate_stays_implicit_to_avoid_false_eligibility() {
        let boundary_context = "a".repeat(4_200);
        let request = structured_request(
            AiProviderChannel::QwenDirect,
            "qwen3.7-flash",
            "assignments",
            "test",
            "固定规则",
            Some(&boundary_context),
            "动态批次",
            schema(),
            0.1,
            InferenceReasoningMode::Disabled,
        );
        assert_eq!(request.cache.mode, "implicit");
        assert!(request
            .body
            .pointer("/messages/1/content/0/cache_control")
            .is_none());
    }

    #[test]
    fn qwen_disabled_reasoning_is_top_level_and_part_of_cache_identity() {
        let default = structured_request(
            AiProviderChannel::QwenDirect,
            "qwen3.7-flash",
            "profiles",
            "test",
            "固定规则",
            None,
            "动态批次",
            schema(),
            0.1,
            InferenceReasoningMode::ProviderDefault,
        );
        let disabled = structured_request(
            AiProviderChannel::QwenDirect,
            "qwen3.7-flash",
            "profiles",
            "test",
            "固定规则",
            None,
            "动态批次",
            schema(),
            0.1,
            InferenceReasoningMode::Disabled,
        );

        assert_eq!(
            disabled.body.get("enable_thinking"),
            Some(&Value::Bool(false))
        );
        assert_ne!(default.cache.cache_key_hash, disabled.cache.cache_key_hash);
        assert_eq!(
            disabled.cache.prompt_contract_version,
            PROMPT_CONTRACT_VERSION
        );
    }
}
