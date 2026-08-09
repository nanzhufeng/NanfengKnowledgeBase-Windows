use std::collections::{HashMap, HashSet};
use std::time::Duration;

use reqwest::blocking::Client;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::ai::models::{
    AiCompletionResult, AiModelDescriptor, AiModelPricing, AiProviderChannel, AiTaskUsage,
    AiTopicInsightPayload,
};
use crate::error::{AppError, AppResult};

const OPENROUTER_API: &str = "https://openrouter.ai/api/v1";
const DEEPSEEK_API: &str = "https://api.deepseek.com";
const MAX_MODELS_PER_AUTHOR: usize = 3;

fn http_client() -> AppResult<Client> {
    Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|error| AppError::Conflict(format!("AI 网络客户端初始化失败：{error}")))
}

fn checked_json(response: reqwest::blocking::Response) -> AppResult<Value> {
    let status = response.status();
    let value: Value = response
        .json()
        .map_err(|error| AppError::Conflict(format!("AI 服务返回了无法解析的数据：{error}")))?;
    if !status.is_success() {
        let message = value
            .pointer("/error/message")
            .and_then(Value::as_str)
            .or_else(|| value.get("message").and_then(Value::as_str))
            .unwrap_or("未知错误");
        return Err(AppError::Conflict(format!(
            "AI 服务请求失败（HTTP {}）：{}",
            status.as_u16(),
            message
        )));
    }
    Ok(value)
}

#[derive(Debug, Deserialize)]
struct OpenRouterModelsResponse {
    data: Vec<OpenRouterModel>,
}

#[derive(Debug, Deserialize)]
struct OpenRouterModel {
    id: String,
    name: String,
    canonical_slug: Option<String>,
    created: Option<i64>,
    context_length: Option<i64>,
    #[serde(default)]
    supported_parameters: Vec<String>,
    #[serde(default)]
    pricing: OpenRouterPricing,
}

#[derive(Debug, Default, Deserialize)]
struct OpenRouterPricing {
    prompt: Option<String>,
    completion: Option<String>,
    request: Option<String>,
}

pub fn refresh_models(
    channel: AiProviderChannel,
    api_key: &str,
) -> AppResult<Vec<AiModelDescriptor>> {
    match channel {
        AiProviderChannel::Openrouter => refresh_openrouter_models(api_key),
        AiProviderChannel::DeepseekDirect => refresh_deepseek_models(api_key),
    }
}

fn refresh_openrouter_models(api_key: &str) -> AppResult<Vec<AiModelDescriptor>> {
    let response = http_client()?
        .get(format!("{OPENROUTER_API}/models"))
        .query(&[("output_modalities", "text"), ("sort", "newest")])
        .bearer_auth(api_key)
        .send()
        .map_err(|error| AppError::Conflict(format!("OpenRouter 模型目录刷新失败：{error}")))?;
    let status = response.status();
    let payload: OpenRouterModelsResponse = response.json().map_err(|error| {
        AppError::Conflict(format!(
            "OpenRouter 模型目录解析失败（HTTP {status}）：{error}"
        ))
    })?;
    if !status.is_success() {
        return Err(AppError::Conflict(format!(
            "OpenRouter 模型目录刷新失败（HTTP {}）",
            status.as_u16()
        )));
    }
    Ok(select_latest_openrouter_models(payload.data))
}

fn select_latest_openrouter_models(models: Vec<OpenRouterModel>) -> Vec<AiModelDescriptor> {
    let mut per_author: HashMap<&'static str, Vec<OpenRouterModel>> = HashMap::new();
    for model in models {
        let Some(prefix) = model.id.split('/').next() else {
            continue;
        };
        let author = match prefix.to_ascii_lowercase().as_str() {
            "openai" => "openai",
            "anthropic" => "anthropic",
            "deepseek" => "deepseek",
            _ => continue,
        };
        if model.id.contains(":free")
            || model.id.contains(":extended")
            || model.id.contains(":exacto")
        {
            continue;
        }
        let supports_structured = model.supported_parameters.iter().any(|parameter| {
            matches!(parameter.as_str(), "structured_outputs" | "response_format")
        });
        if supports_structured {
            per_author.entry(author).or_default().push(model);
        }
    }

    let mut selected = Vec::new();
    for author in ["openai", "anthropic", "deepseek"] {
        let Some(mut candidates) = per_author.remove(author) else {
            continue;
        };
        candidates.sort_by_key(|model| std::cmp::Reverse(model.created.unwrap_or_default()));
        let mut canonical_seen = HashSet::new();
        for model in candidates {
            let canonical_key = model
                .canonical_slug
                .clone()
                .unwrap_or_else(|| model.id.clone());
            if !canonical_seen.insert(canonical_key) {
                continue;
            }
            selected.push(AiModelDescriptor {
                id: model.id,
                name: model.name,
                author: author.to_string(),
                canonical_slug: model.canonical_slug,
                created_at: model.created,
                context_length: model.context_length,
                supported_parameters: model.supported_parameters,
                pricing: AiModelPricing {
                    prompt: model.pricing.prompt,
                    completion: model.pricing.completion,
                    request: model.pricing.request,
                    cache_hit: None,
                },
            });
            if selected.iter().filter(|item| item.author == author).count() >= MAX_MODELS_PER_AUTHOR
            {
                break;
            }
        }
    }
    selected
}

fn refresh_deepseek_models(api_key: &str) -> AppResult<Vec<AiModelDescriptor>> {
    let response = http_client()?
        .get(format!("{DEEPSEEK_API}/models"))
        .bearer_auth(api_key)
        .send()
        .map_err(|error| AppError::Conflict(format!("DeepSeek 模型目录刷新失败：{error}")))?;
    let value = checked_json(response)?;
    let models = value
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| AppError::Conflict("DeepSeek 模型目录缺少 data 字段".to_string()))?;
    let mut descriptors = models
        .iter()
        .filter_map(|model| model.get("id").and_then(Value::as_str))
        .map(|id| AiModelDescriptor {
            id: id.to_string(),
            name: id.to_string(),
            author: "deepseek".to_string(),
            canonical_slug: None,
            created_at: None,
            context_length: None,
            supported_parameters: vec!["response_format".to_string()],
            pricing: deepseek_pricing(id),
        })
        .collect::<Vec<_>>();
    descriptors.sort_by(|left, right| right.id.cmp(&left.id));
    descriptors.truncate(MAX_MODELS_PER_AUTHOR);
    Ok(descriptors)
}

fn deepseek_pricing(model_id: &str) -> AiModelPricing {
    let (prompt, completion, cache_hit) = match model_id {
        "deepseek-v4-flash" => (Some("0.00000014"), Some("0.00000028"), Some("0.0000000028")),
        "deepseek-v4-pro" => (
            Some("0.000000435"),
            Some("0.00000087"),
            Some("0.000000003625"),
        ),
        _ => (None, None, None),
    };
    AiModelPricing {
        prompt: prompt.map(str::to_string),
        completion: completion.map(str::to_string),
        request: None,
        cache_hit: cache_hit.map(str::to_string),
    }
}

pub fn run_topic_insight(
    channel: AiProviderChannel,
    api_key: &str,
    model_id: &str,
    context: &str,
    descriptor: Option<&AiModelDescriptor>,
) -> AppResult<AiCompletionResult> {
    let context = truncate_chars(context, 80_000);
    let body = match channel {
        AiProviderChannel::Openrouter => openrouter_request_body(model_id, &context),
        AiProviderChannel::DeepseekDirect => deepseek_request_body(model_id, &context),
    };
    let base = match channel {
        AiProviderChannel::Openrouter => OPENROUTER_API,
        AiProviderChannel::DeepseekDirect => DEEPSEEK_API,
    };
    let response = http_client()?
        .post(format!("{base}/chat/completions"))
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .map_err(|error| AppError::Conflict(format!("AI 主题整理请求失败：{error}")))?;
    let value = checked_json(response)?;
    let content = value
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::Conflict("AI 返回结果缺少正文".to_string()))?;
    let insight: AiTopicInsightPayload = serde_json::from_str(strip_json_fence(content))
        .map_err(|error| AppError::Conflict(format!("AI 返回内容不符合主题洞察结构：{error}")))?;
    if insight.summary_markdown.trim().is_empty() {
        return Err(AppError::Conflict("AI 返回的主题总结为空".to_string()));
    }
    let usage = parse_usage(channel, &value, descriptor);
    Ok(AiCompletionResult { insight, usage })
}

fn topic_insight_schema() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["summaryMarkdown", "keyInsights", "evidence", "openQuestions", "topicManagementSuggestions"],
        "properties": {
            "summaryMarkdown": {"type": "string"},
            "keyInsights": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["title", "detail", "sourceItemIds"],
                    "properties": {
                        "title": {"type": "string"},
                        "detail": {"type": "string"},
                        "sourceItemIds": {"type": "array", "items": {"type": "integer"}}
                    }
                }
            },
            "evidence": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["stance", "content", "sourceItemId", "locatorLabel"],
                    "properties": {
                        "stance": {"type": "string", "enum": ["support", "oppose", "context"]},
                        "content": {"type": "string"},
                        "sourceItemId": {"type": ["integer", "null"]},
                        "locatorLabel": {"type": ["string", "null"]}
                    }
                }
            },
            "openQuestions": {"type": "array", "items": {"type": "string"}},
            "topicManagementSuggestions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["action", "title", "reason", "targetTopicName"],
                    "properties": {
                        "action": {"type": "string", "enum": ["relate", "rename", "merge", "new_topic", "boundary"]},
                        "title": {"type": "string"},
                        "reason": {"type": "string"},
                        "targetTopicName": {"type": ["string", "null"]}
                    }
                }
            }
        }
    })
}

fn system_prompt() -> &'static str {
    "你是南枫知识库的主题整理助手。只依据输入材料整理，不补造事实。输出简体中文 JSON。总结要指出核心判断、证据边界、矛盾和待验证项。主题管理建议只提出建议，不执行重命名、合并、删除或覆盖人工结论。"
}

fn user_prompt(context: &str) -> String {
    format!("请整理下面这个主题，并严格返回约定结构。\n\n{context}")
}

fn openrouter_request_body(model_id: &str, context: &str) -> Value {
    json!({
        "model": model_id,
        "messages": [
            {"role": "system", "content": system_prompt()},
            {"role": "user", "content": user_prompt(context)}
        ],
        "temperature": 0.2,
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "nanfeng_topic_insight", "strict": true, "schema": topic_insight_schema()}
        }
    })
}

fn deepseek_request_body(model_id: &str, context: &str) -> Value {
    json!({
        "model": model_id,
        "messages": [
            {"role": "system", "content": format!("{}\nJSON Schema：{}", system_prompt(), topic_insight_schema())},
            {"role": "user", "content": user_prompt(context)}
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    })
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

fn strip_json_fence(value: &str) -> &str {
    let trimmed = value.trim();
    if let Some(inner) = trimmed
        .strip_prefix("```json")
        .or_else(|| trimmed.strip_prefix("```"))
    {
        return inner.strip_suffix("```").unwrap_or(inner).trim();
    }
    trimmed
}

fn parse_usage(
    channel: AiProviderChannel,
    response: &Value,
    descriptor: Option<&AiModelDescriptor>,
) -> AiTaskUsage {
    let usage = response.get("usage").unwrap_or(&Value::Null);
    let prompt_tokens = usage
        .get("prompt_tokens")
        .and_then(Value::as_i64)
        .unwrap_or(0);
    let completion_tokens = usage
        .get("completion_tokens")
        .and_then(Value::as_i64)
        .unwrap_or(0);
    let total_tokens = usage
        .get("total_tokens")
        .and_then(Value::as_i64)
        .unwrap_or(prompt_tokens + completion_tokens);
    let cached_tokens = usage
        .pointer("/prompt_tokens_details/cached_tokens")
        .and_then(Value::as_i64)
        .or_else(|| usage.get("prompt_cache_hit_tokens").and_then(Value::as_i64))
        .unwrap_or(0);
    let reasoning_tokens = usage
        .pointer("/completion_tokens_details/reasoning_tokens")
        .and_then(Value::as_i64)
        .unwrap_or(0);
    let actual_cost = usage.get("cost").and_then(Value::as_f64);
    let estimated_cost = descriptor
        .and_then(|model| estimate_cost(model, prompt_tokens, completion_tokens, cached_tokens));
    let (cost_usd, cost_kind) = if channel == AiProviderChannel::Openrouter && actual_cost.is_some()
    {
        (actual_cost, "actual")
    } else if estimated_cost.is_some() {
        (estimated_cost, "estimated")
    } else {
        (None, "unavailable")
    };
    AiTaskUsage {
        prompt_tokens,
        completion_tokens,
        reasoning_tokens,
        cached_tokens,
        total_tokens,
        cost_usd,
        cost_kind: cost_kind.to_string(),
        pricing_snapshot_json: descriptor
            .and_then(|model| serde_json::to_string(&model.pricing).ok())
            .unwrap_or_else(|| "{}".to_string()),
    }
}

fn estimate_cost(
    model: &AiModelDescriptor,
    prompt_tokens: i64,
    completion_tokens: i64,
    cached_tokens: i64,
) -> Option<f64> {
    let prompt = model.pricing.prompt.as_deref()?.parse::<f64>().ok()?;
    let completion = model.pricing.completion.as_deref()?.parse::<f64>().ok()?;
    let request = model
        .pricing
        .request
        .as_deref()
        .and_then(|value| value.parse::<f64>().ok())
        .unwrap_or(0.0);
    let cache_hit = model
        .pricing
        .cache_hit
        .as_deref()
        .and_then(|value| value.parse::<f64>().ok());
    let billed_cached = cached_tokens.clamp(0, prompt_tokens);
    let uncached = prompt_tokens.saturating_sub(billed_cached);
    Some(
        uncached as f64 * prompt
            + billed_cached as f64 * cache_hit.unwrap_or(prompt)
            + completion_tokens as f64 * completion
            + request,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_latest_three_structured_models_per_supported_author() {
        let mut models = Vec::new();
        for created in 1..=4 {
            models.push(OpenRouterModel {
                id: format!("openai/model-{created}"),
                name: format!("Model {created}"),
                canonical_slug: None,
                created: Some(created),
                context_length: Some(1000),
                supported_parameters: vec!["response_format".to_string()],
                pricing: OpenRouterPricing::default(),
            });
        }
        models.push(OpenRouterModel {
            id: "other/model".to_string(),
            name: "Other".to_string(),
            canonical_slug: None,
            created: Some(99),
            context_length: None,
            supported_parameters: vec!["response_format".to_string()],
            pricing: OpenRouterPricing::default(),
        });
        let selected = select_latest_openrouter_models(models);
        assert_eq!(selected.len(), 3);
        assert_eq!(selected[0].id, "openai/model-4");
    }

    #[test]
    fn estimates_catalog_price_per_token() {
        let model = AiModelDescriptor {
            id: "test".to_string(),
            name: "test".to_string(),
            author: "test".to_string(),
            canonical_slug: None,
            created_at: None,
            context_length: None,
            supported_parameters: Vec::new(),
            pricing: AiModelPricing {
                prompt: Some("0.000001".to_string()),
                completion: Some("0.000002".to_string()),
                request: None,
                cache_hit: None,
            },
        };
        assert_eq!(estimate_cost(&model, 1_000, 500, 0), Some(0.002));
    }
}
