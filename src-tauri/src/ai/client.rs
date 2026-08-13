use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use chrono::{DateTime, Timelike, Utc};
use reqwest::blocking::Client;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::ai::models::{
    AiCompletionResult, AiModelDescriptor, AiModelPricing, AiProviderChannel, AiSourceMaterial,
    AiSourceProfile, AiTaskUsage, AiTaxonomyAssignmentProposal, AiTaxonomyStructure,
    AiTaxonomyTopicIntegration, AiTaxonomyTopicProposal, AiTopicInsightPayload,
};
use crate::ai::prompt_cache::{self, InferenceReasoningMode, PromptCacheMetadata};
use crate::error::{AppError, AppResult};

const OPENROUTER_API: &str = "https://openrouter.ai/api/v1";
const DEEPSEEK_API: &str = "https://api.deepseek.com";
const QWEN_API: &str = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const MAX_MODELS_PER_AUTHOR: usize = 3;
static HTTP_CLIENT: OnceLock<Result<Client, String>> = OnceLock::new();

fn http_client() -> AppResult<&'static Client> {
    match HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .connect_timeout(Duration::from_secs(20))
            .timeout(Duration::from_secs(150))
            .tcp_keepalive(Duration::from_secs(30))
            .pool_idle_timeout(Duration::from_secs(90))
            .build()
            .map_err(|error| error.to_string())
    }) {
        Ok(client) => Ok(client),
        Err(error) => Err(AppError::Conflict(format!(
            "AI 网络客户端初始化失败：{error}"
        ))),
    }
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
    input_cache_read: Option<String>,
    input_cache_write: Option<String>,
}

pub fn refresh_models(
    channel: AiProviderChannel,
    api_key: &str,
) -> AppResult<Vec<AiModelDescriptor>> {
    match channel {
        AiProviderChannel::Openrouter => refresh_openrouter_models(api_key),
        AiProviderChannel::DeepseekDirect => refresh_deepseek_models(api_key),
        // Model Studio's generic compatible endpoint does not guarantee GET /models.
        // Keep this catalog local and let the authenticated completion request verify access.
        AiProviderChannel::QwenDirect => Ok(crate::ai::models::qwen_model_catalog()),
    }
}

fn refresh_openrouter_models(api_key: &str) -> AppResult<Vec<AiModelDescriptor>> {
    let response = http_client()?
        .get(format!("{OPENROUTER_API}/models"))
        .query(&[("output_modalities", "text"), ("sort", "newest")])
        .bearer_auth(api_key)
        .send()
        .map_err(|error| AppError::Conflict(format!("OpenRouter 模型目录刷新失败：{error}")))?;
    let value = checked_json(response)?;
    let payload: OpenRouterModelsResponse = serde_json::from_value(value)
        .map_err(|error| AppError::Conflict(format!("OpenRouter 模型目录解析失败：{error}")))?;
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
                    cache_hit: model.pricing.input_cache_read,
                    cache_write: model.pricing.input_cache_write,
                    source: Some("openrouter-model-catalog".to_string()),
                    ..AiModelPricing::default()
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
    deepseek_pricing_at(model_id, Utc::now())
}

fn deepseek_pricing_at(model_id: &str, timestamp: DateTime<Utc>) -> AiModelPricing {
    let new_pricing_at = DateTime::parse_from_rfc3339("2026-08-16T16:00:00Z")
        .expect("valid DeepSeek pricing timestamp")
        .with_timezone(&Utc);
    let (prompt, completion, cache_hit, effective_at, rate_label) = if timestamp < new_pricing_at {
        match model_id {
            "deepseek-v4-flash" => (
                Some("0.00000014"),
                Some("0.00000028"),
                Some("0.0000000028"),
                None,
                Some("legacy"),
            ),
            "deepseek-v4-pro" => (
                Some("0.000000435"),
                Some("0.00000087"),
                Some("0.000000003625"),
                None,
                Some("legacy"),
            ),
            _ => (None, None, None, None, None),
        }
    } else {
        let peak = (1..4).contains(&timestamp.hour()) || (6..10).contains(&timestamp.hour());
        match (model_id, peak) {
            ("deepseek-v4-flash", false) => (
                Some("0.00000022"),
                Some("0.00000066"),
                Some("0.000000007"),
                Some("2026-08-16T16:00:00Z"),
                Some("off-peak"),
            ),
            ("deepseek-v4-flash", true) => (
                Some("0.00000044"),
                Some("0.00000132"),
                Some("0.000000014"),
                Some("2026-08-16T16:00:00Z"),
                Some("peak"),
            ),
            ("deepseek-v4-pro", false) => (
                Some("0.00000066"),
                Some("0.00000198"),
                Some("0.000000022"),
                Some("2026-08-16T16:00:00Z"),
                Some("off-peak"),
            ),
            ("deepseek-v4-pro", true) => (
                Some("0.00000132"),
                Some("0.00000396"),
                Some("0.000000044"),
                Some("2026-08-16T16:00:00Z"),
                Some("peak"),
            ),
            _ => (None, None, None, None, None),
        }
    };
    AiModelPricing {
        prompt: prompt.map(str::to_string),
        completion: completion.map(str::to_string),
        request: None,
        cache_hit: cache_hit.map(str::to_string),
        cache_write: None,
        effective_at: effective_at.map(str::to_string),
        rate_label: rate_label.map(str::to_string),
        source: Some("https://api-docs.deepseek.com/quick_start/pricing/".to_string()),
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
    let request = prompt_cache::structured_request(
        channel,
        model_id,
        "topic_insight",
        "nanfeng_topic_insight",
        system_prompt(),
        None,
        &user_prompt(&context),
        topic_insight_schema(),
        0.2,
        InferenceReasoningMode::ProviderDefault,
    );
    let base = match channel {
        AiProviderChannel::Openrouter => OPENROUTER_API,
        AiProviderChannel::DeepseekDirect => DEEPSEEK_API,
        AiProviderChannel::QwenDirect => QWEN_API,
    };
    let started = Instant::now();
    let response = http_client()?
        .post(format!("{base}/chat/completions"))
        .bearer_auth(api_key)
        .json(&request.body)
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
    let usage = parse_usage(
        channel,
        model_id,
        &value,
        descriptor,
        &request.cache,
        started.elapsed(),
    );
    Ok(AiCompletionResult { insight, usage })
}

/// 只供隔离金丝雀验证 Prompt Cache。调用方必须使用合成材料；本函数不读取数据库、
/// 不保存响应正文，并把输出限制在 128 Token，避免验证过程扩大费用。
pub fn run_prompt_cache_canary(
    channel: AiProviderChannel,
    api_key: &str,
    model_id: &str,
    stable_context: &str,
    dynamic_suffix: &str,
) -> AppResult<AiTaskUsage> {
    let schema = json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["ok", "batch"],
        "properties": {
            "ok": {"type": "boolean"},
            "batch": {"type": "string"}
        }
    });
    let request = prompt_cache::structured_request(
        channel,
        model_id,
        "prompt_cache_canary",
        "nanfeng_prompt_cache_canary",
        "这是南枫知识库 Prompt Cache 隔离金丝雀。只依据合成内容返回 JSON，不处理真实知识资料。",
        Some(stable_context),
        dynamic_suffix,
        schema,
        0.0,
        if channel == AiProviderChannel::DeepseekDirect || channel == AiProviderChannel::QwenDirect
        {
            InferenceReasoningMode::Disabled
        } else {
            InferenceReasoningMode::ProviderDefault
        },
    );
    let mut body = request.body;
    body["max_tokens"] = Value::from(128);
    let base = match channel {
        AiProviderChannel::Openrouter => OPENROUTER_API,
        AiProviderChannel::DeepseekDirect => DEEPSEEK_API,
        AiProviderChannel::QwenDirect => QWEN_API,
    };
    let started = Instant::now();
    let response = http_client()?
        .post(format!("{base}/chat/completions"))
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .map_err(|error| AppError::Conflict(format!("Prompt Cache 金丝雀请求失败：{error}")))?;
    let value = checked_json(response)?;
    let content = value
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::Conflict("Prompt Cache 金丝雀缺少响应正文".to_string()))?;
    serde_json::from_str::<Value>(strip_json_fence(content)).map_err(|error| {
        AppError::Conflict(format!("Prompt Cache 金丝雀响应不是 JSON：{error}"))
    })?;
    Ok(parse_usage(
        channel,
        model_id,
        &value,
        None,
        &request.cache,
        started.elapsed(),
    ))
}

pub fn run_source_profile_batch(
    channel: AiProviderChannel,
    api_key: &str,
    model_id: &str,
    sources: &[AiSourceMaterial],
    descriptor: Option<&AiModelDescriptor>,
) -> AppResult<(Vec<AiSourceProfile>, AiTaskUsage)> {
    run_source_profile_batch_with_reasoning_mode(
        channel,
        api_key,
        model_id,
        sources,
        descriptor,
        structured_reasoning_mode(channel, "nanfeng_source_profiles"),
    )
}

pub(crate) fn run_source_profile_batch_with_reasoning_mode(
    channel: AiProviderChannel,
    api_key: &str,
    model_id: &str,
    sources: &[AiSourceMaterial],
    descriptor: Option<&AiModelDescriptor>,
    reasoning_mode: InferenceReasoningMode,
) -> AppResult<(Vec<AiSourceProfile>, AiTaskUsage)> {
    let materials = sources
        .iter()
        .map(|source| {
            format!(
                "## 来源 {}\n标题：{}\n正文：{}",
                source.source_item_id,
                source.title,
                truncate_chars(&source.content, 4_000),
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n");
    let schema = json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["profiles"],
        "properties": {
            "profiles": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["sourceItemId", "summary", "concepts", "candidateTopics"],
                    "properties": {
                        "sourceItemId": {"type": "integer"},
                        "summary": {"type": "string"},
                        "concepts": {"type": "array", "items": {"type": "string"}},
                        "candidateTopics": {"type": "array", "items": {"type": "string"}}
                    }
                }
            }
        }
    });
    let value = run_structured_completion_with_reasoning_mode(
        channel,
        api_key,
        model_id,
        "nanfeng_source_profiles",
        "你负责逐篇理解知识库原始笔记。只依据输入正文，为每个来源返回一条简短语义档案。不得漏掉或增加来源 ID；summary 最多 80 个汉字，concepts 和 candidateTopics 各最多 5 项。不要进行最终领域分类。",
        None,
        &materials,
        schema,
        descriptor,
        reasoning_mode,
    )?;
    let profiles = serde_json::from_value::<ProfileBatch>(value.0)
        .map_err(|error| AppError::Conflict(format!("AI 笔记语义档案结构无效：{error}")))?
        .profiles;
    let expected = sources
        .iter()
        .map(|item| item.source_item_id)
        .collect::<HashSet<_>>();
    let actual = profiles
        .iter()
        .map(|item| item.source_item_id)
        .collect::<HashSet<_>>();
    if expected != actual || profiles.len() != sources.len() {
        return Err(AppError::Conflict(
            "AI 笔记语义档案未完整覆盖本批来源".to_string(),
        ));
    }
    Ok((profiles, value.1))
}

pub fn run_taxonomy_structure(
    channel: AiProviderChannel,
    api_key: &str,
    model_id: &str,
    profiles: &[AiSourceProfile],
    descriptor: Option<&AiModelDescriptor>,
) -> AppResult<(AiTaxonomyStructure, AiTaskUsage)> {
    let context = profiles
        .iter()
        .map(|item| {
            format!(
                "- 来源 {}：{}；概念：{}；候选主题：{}",
                item.source_item_id,
                item.summary,
                item.concepts.join("、"),
                item.candidate_topics.join("、"),
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let schema = taxonomy_structure_schema();
    let value = run_structured_completion(
        channel,
        api_key,
        model_id,
        "nanfeng_taxonomy_structure",
        "你负责为个人知识库生成稳定、可阅读的完整领域与主题体系。合并同义主题，避免过细分类；领域通常 3 至 12 个，主题名称应能长期容纳同类笔记。key 使用简短稳定的英文小写短横线标识。每个 topic 的 domainKey 必须存在；parentKey 只能引用同领域 topic，最多两层。只返回分类结构，不返回笔记归属。",
        None,
        &context,
        schema,
        descriptor,
    )?;
    let taxonomy = serde_json::from_value::<AiTaxonomyStructure>(value.0)
        .map_err(|error| AppError::Conflict(format!("AI 领域主题结构无效：{error}")))?;
    validate_taxonomy_structure(&taxonomy)?;
    Ok((taxonomy, value.1))
}

pub fn run_taxonomy_assignment_batch(
    channel: AiProviderChannel,
    api_key: &str,
    model_id: &str,
    taxonomy: &AiTaxonomyStructure,
    profiles: &[AiSourceProfile],
    descriptor: Option<&AiModelDescriptor>,
) -> AppResult<(Vec<AiTaxonomyAssignmentProposal>, AiTaskUsage)> {
    run_taxonomy_assignment_batch_with_reasoning_mode(
        channel,
        api_key,
        model_id,
        taxonomy,
        profiles,
        descriptor,
        structured_reasoning_mode(channel, "nanfeng_taxonomy_assignments"),
    )
}

pub(crate) fn run_taxonomy_assignment_batch_with_reasoning_mode(
    channel: AiProviderChannel,
    api_key: &str,
    model_id: &str,
    taxonomy: &AiTaxonomyStructure,
    profiles: &[AiSourceProfile],
    descriptor: Option<&AiModelDescriptor>,
    reasoning_mode: InferenceReasoningMode,
) -> AppResult<(Vec<AiTaxonomyAssignmentProposal>, AiTaskUsage)> {
    let taxonomy_json = serde_json::to_string(taxonomy)?;
    let profiles_json = serde_json::to_string(profiles)?;
    let stable_context = format!("领域主题体系：\n{taxonomy_json}");
    let dynamic_context = format!("待归类笔记：\n{profiles_json}");
    let schema = json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["assignments"],
        "properties": {
            "assignments": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["sourceItemId", "topicKey", "confidence", "reason", "uncertain"],
                    "properties": {
                        "sourceItemId": {"type": "integer"},
                        "topicKey": {"type": "string"},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 100},
                        "reason": {"type": "string"},
                        "uncertain": {"type": "boolean"}
                    }
                }
            }
        }
    });
    let value = run_structured_completion_with_reasoning_mode(
        channel,
        api_key,
        model_id,
        "nanfeng_taxonomy_assignments",
        "你负责把每一篇笔记归入给定主题体系。每个来源必须且只能返回一条主主题归属，不得增加或遗漏来源 ID；topicKey 必须来自输入体系。confidence 低于 70 或存在多义性时 uncertain 必须为 true。reason 用一句话说明内容边界，不用关键词计分。",
        Some(&stable_context),
        &dynamic_context,
        schema,
        descriptor,
        reasoning_mode,
    )?;
    let assignments = serde_json::from_value::<AssignmentBatch>(value.0)
        .map_err(|error| AppError::Conflict(format!("AI 笔记归属结构无效：{error}")))?
        .assignments;
    let expected = profiles
        .iter()
        .map(|item| item.source_item_id)
        .collect::<HashSet<_>>();
    let actual = assignments
        .iter()
        .map(|item| item.source_item_id)
        .collect::<HashSet<_>>();
    let topic_keys = taxonomy
        .topics
        .iter()
        .map(|item| item.key.as_str())
        .collect::<HashSet<_>>();
    if expected != actual || assignments.len() != profiles.len() {
        return Err(AppError::Conflict(
            "AI 分类结果未完整覆盖本批笔记".to_string(),
        ));
    }
    if assignments
        .iter()
        .any(|item| !topic_keys.contains(item.topic_key.as_str()))
    {
        return Err(AppError::Conflict(
            "AI 分类结果引用了不存在的主题".to_string(),
        ));
    }
    Ok((assignments, value.1))
}

pub fn run_taxonomy_topic_integration_batch(
    channel: AiProviderChannel,
    api_key: &str,
    model_id: &str,
    topics: &[AiTaxonomyTopicProposal],
    profiles: &[AiSourceProfile],
    assignments: &[AiTaxonomyAssignmentProposal],
    descriptor: Option<&AiModelDescriptor>,
) -> AppResult<(Vec<AiTaxonomyTopicIntegration>, AiTaskUsage)> {
    let profile_by_id = profiles
        .iter()
        .map(|profile| (profile.source_item_id, profile))
        .collect::<HashMap<_, _>>();
    let input_topics = topics
        .iter()
        .map(|topic| {
            let sources = assignments
                .iter()
                .filter(|assignment| assignment.topic_key == topic.key)
                .filter_map(|assignment| profile_by_id.get(&assignment.source_item_id))
                .map(|profile| {
                    json!({
                        "sourceItemId": profile.source_item_id,
                        "summary": profile.summary,
                        "concepts": profile.concepts,
                    })
                })
                .collect::<Vec<_>>();
            json!({
                "topicKey": topic.key,
                "name": topic.name,
                "description": topic.description,
                "sources": sources,
            })
        })
        .collect::<Vec<_>>();
    let schema = json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["integrations"],
        "properties": {
            "integrations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["topicKey", "integrationMarkdown", "sourceItemIds"],
                    "properties": {
                        "topicKey": {"type": "string"},
                        "integrationMarkdown": {"type": "string"},
                        "sourceItemIds": {"type": "array", "items": {"type": "integer"}}
                    }
                }
            }
        }
    });
    let value = run_structured_completion(
        channel,
        api_key,
        model_id,
        "nanfeng_taxonomy_topic_integrations",
        "你负责在全库分类已经确定后，为每个主题生成一份可直接阅读的主题整合。只依据该主题下给出的来源语义档案，综合共同结论、差异、边界和仍待验证之处；不要逐篇复述，不要编造事实，不要输出分类说明。每个 integrationMarkdown 使用 3 至 6 句完整中文，来源不足时如实说明现有材料边界。每个输入主题必须且只能返回一项，sourceItemIds 必须完整返回该主题输入中的全部来源，不得遗漏或增加。",
        None,
        &serde_json::to_string(&input_topics)?,
        schema,
        descriptor,
    )?;
    let mut integrations = serde_json::from_value::<IntegrationBatch>(value.0)
        .map_err(|error| AppError::Conflict(format!("AI 主题整合结构无效：{error}")))?
        .integrations;
    let expected_topic_keys = topics
        .iter()
        .map(|topic| topic.key.as_str())
        .collect::<HashSet<_>>();
    let actual_topic_keys = integrations
        .iter()
        .map(|integration| integration.topic_key.as_str())
        .collect::<HashSet<_>>();
    if expected_topic_keys != actual_topic_keys || integrations.len() != topics.len() {
        return Err(AppError::Conflict(
            "AI 主题整合未完整覆盖本批主题".to_string(),
        ));
    }
    for integration in &mut integrations {
        if integration.integration_markdown.trim().is_empty() {
            return Err(AppError::Conflict(format!(
                "AI 主题整合为空：{}",
                integration.topic_key
            )));
        }
        // 来源清单由已经确认的主题归属唯一决定，不再让模型的 ID 误差毁掉整次长任务。
        integration.source_item_ids =
            canonical_taxonomy_topic_source_ids(&integration.topic_key, assignments);
    }
    Ok((integrations, value.1))
}

fn canonical_taxonomy_topic_source_ids(
    topic_key: &str,
    assignments: &[AiTaxonomyAssignmentProposal],
) -> Vec<i64> {
    let mut source_ids = assignments
        .iter()
        .filter(|assignment| assignment.topic_key == topic_key)
        .map(|assignment| assignment.source_item_id)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    source_ids.sort_unstable();
    source_ids
}

#[derive(Debug, Deserialize)]
struct ProfileBatch {
    profiles: Vec<AiSourceProfile>,
}

#[derive(Debug, Deserialize)]
struct AssignmentBatch {
    assignments: Vec<AiTaxonomyAssignmentProposal>,
}

#[derive(Debug, Deserialize)]
struct IntegrationBatch {
    integrations: Vec<AiTaxonomyTopicIntegration>,
}

fn taxonomy_structure_schema() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["domains", "topics"],
        "properties": {
            "domains": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["key", "name", "description"],
                    "properties": {
                        "key": {"type": "string"},
                        "name": {"type": "string"},
                        "description": {"type": "string"}
                    }
                }
            },
            "topics": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["key", "domainKey", "parentKey", "name", "description"],
                    "properties": {
                        "key": {"type": "string"},
                        "domainKey": {"type": "string"},
                        "parentKey": {"type": ["string", "null"]},
                        "name": {"type": "string"},
                        "description": {"type": "string"}
                    }
                }
            }
        }
    })
}

fn validate_taxonomy_structure(taxonomy: &AiTaxonomyStructure) -> AppResult<()> {
    if taxonomy.domains.is_empty() || taxonomy.topics.is_empty() {
        return Err(AppError::Conflict(
            "AI 没有生成可用的领域主题体系".to_string(),
        ));
    }
    let domain_keys = taxonomy
        .domains
        .iter()
        .map(|item| item.key.as_str())
        .collect::<HashSet<_>>();
    let topic_keys = taxonomy
        .topics
        .iter()
        .map(|item| item.key.as_str())
        .collect::<HashSet<_>>();
    if domain_keys.len() != taxonomy.domains.len() || topic_keys.len() != taxonomy.topics.len() {
        return Err(AppError::Conflict("AI 领域或主题 key 存在重复".to_string()));
    }
    if taxonomy.topics.iter().any(|topic| {
        !domain_keys.contains(topic.domain_key.as_str())
            || topic
                .parent_key
                .as_ref()
                .is_some_and(|key| !topic_keys.contains(key.as_str()))
    }) {
        return Err(AppError::Conflict("AI 主题层级引用无效".to_string()));
    }
    Ok(())
}

fn run_structured_completion(
    channel: AiProviderChannel,
    api_key: &str,
    model_id: &str,
    schema_name: &str,
    system: &str,
    stable_user: Option<&str>,
    user: &str,
    schema: Value,
    descriptor: Option<&AiModelDescriptor>,
) -> AppResult<(Value, AiTaskUsage)> {
    let reasoning_mode = structured_reasoning_mode(channel, schema_name);
    run_structured_completion_with_reasoning_mode(
        channel,
        api_key,
        model_id,
        schema_name,
        system,
        stable_user,
        user,
        schema,
        descriptor,
        reasoning_mode,
    )
}

#[allow(clippy::too_many_arguments)]
fn run_structured_completion_with_reasoning_mode(
    channel: AiProviderChannel,
    api_key: &str,
    model_id: &str,
    schema_name: &str,
    system: &str,
    stable_user: Option<&str>,
    user: &str,
    schema: Value,
    descriptor: Option<&AiModelDescriptor>,
    reasoning_mode: InferenceReasoningMode,
) -> AppResult<(Value, AiTaskUsage)> {
    let request = prompt_cache::structured_request(
        channel,
        model_id,
        schema_name,
        schema_name,
        system,
        stable_user,
        user,
        schema,
        0.1,
        reasoning_mode,
    );
    let base = match channel {
        AiProviderChannel::Openrouter => OPENROUTER_API,
        AiProviderChannel::DeepseekDirect => DEEPSEEK_API,
        AiProviderChannel::QwenDirect => QWEN_API,
    };
    let started = Instant::now();
    let response = http_client()?
        .post(format!("{base}/chat/completions"))
        .bearer_auth(api_key)
        .json(&request.body)
        .send()
        .map_err(|error| AppError::Conflict(format!("AI 语义整理请求失败：{error}")))?;
    let response = checked_json(response)?;
    let content = response
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::Conflict("AI 返回结果缺少正文".to_string()))?;
    let value = serde_json::from_str(strip_json_fence(content))
        .map_err(|error| AppError::Conflict(format!("AI 返回 JSON 无法解析：{error}")))?;
    Ok((
        value,
        parse_usage(
            channel,
            model_id,
            &response,
            descriptor,
            &request.cache,
            started.elapsed(),
        ),
    ))
}

fn structured_reasoning_mode(
    channel: AiProviderChannel,
    schema_name: &str,
) -> InferenceReasoningMode {
    if channel == AiProviderChannel::QwenDirect
        && matches!(
            schema_name,
            "nanfeng_source_profiles" | "nanfeng_taxonomy_assignments"
        )
    {
        InferenceReasoningMode::Disabled
    } else {
        InferenceReasoningMode::ProviderDefault
    }
}

fn topic_insight_schema() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["summaryMarkdown", "keyInsights", "evidence", "openQuestions", "topicManagementSuggestions", "hypotheses", "judgmentEvolution", "decisions"],
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
            },
            "hypotheses": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["title", "statement", "confidence", "invalidationCondition", "sourceItemIds"],
                    "properties": {
                        "title": {"type": "string"},
                        "statement": {"type": "string"},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 100},
                        "invalidationCondition": {"type": "string"},
                        "sourceItemIds": {"type": "array", "items": {"type": "integer"}}
                    }
                }
            },
            "judgmentEvolution": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["occurredAt", "title", "fromStatement", "toStatement", "reason", "sourceItemIds"],
                    "properties": {
                        "occurredAt": {"type": ["string", "null"]},
                        "title": {"type": "string"},
                        "fromStatement": {"type": ["string", "null"]},
                        "toStatement": {"type": "string"},
                        "reason": {"type": "string"},
                        "sourceItemIds": {"type": "array", "items": {"type": "integer"}}
                    }
                }
            },
            "decisions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["title", "basis", "action", "result", "status", "sourceItemIds"],
                    "properties": {
                        "title": {"type": "string"},
                        "basis": {"type": "string"},
                        "action": {"type": "string"},
                        "result": {"type": ["string", "null"]},
                        "status": {"type": "string", "enum": ["proposed", "in_progress", "completed", "unknown"]},
                        "sourceItemIds": {"type": "array", "items": {"type": "integer"}}
                    }
                }
            }
        }
    })
}

fn system_prompt() -> &'static str {
    "你是南枫知识库的主题洞察编辑。只依据输入材料整理，不补造事实，输出简体中文 JSON。你需要一次生成同一份主题成果包，避免各面板互相矛盾。summaryMarkdown 写 3 至 5 句可独立阅读的主题综述。hypotheses 仅在材料存在两种以上合理解释时生成，最多 4 条。judgmentEvolution 用来表达材料中的判断如何形成或变化：只要来源具有可识别的先后时间、更新关系、新旧证据、阶段差异或立场变化，就生成 1 至 4 个按时间排序的节点；第一个节点可以把 fromStatement 设为 null，occurredAt 无可靠日期时设为 null，但每个节点必须绑定实际 sourceItemIds。只有材料完全没有时间或更新线索时才返回空数组。decisions 仅在材料明确记录决策、行动或结果时生成，不得把建议伪装成已执行决定。没有可靠材料的条件面板必须返回空数组。每个关键结论都用 sourceItemIds 绑定输入来源；来源 ID 必须来自输入。evidence 作为跨面板证据索引，不另造事实。openQuestions 最多 3 条，并优先写能够验证竞争假设或判断变化的问题；topicManagementSuggestions 最多 3 条且只提出建议，不直接改动分类。"
}

fn user_prompt(context: &str) -> String {
    format!("请整理下面这个主题，并严格返回约定结构。\n\n{context}")
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
    model_id: &str,
    response: &Value,
    descriptor: Option<&AiModelDescriptor>,
    cache: &PromptCacheMetadata,
    duration: Duration,
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
        .or_else(|| {
            usage
                .pointer("/input_tokens_details/cached_tokens")
                .and_then(Value::as_i64)
        })
        .or_else(|| usage.get("prompt_cache_hit_tokens").and_then(Value::as_i64))
        .or_else(|| usage.get("cache_read_input_tokens").and_then(Value::as_i64))
        .unwrap_or(0);
    let cache_write_tokens = usage
        .pointer("/prompt_tokens_details/cache_write_tokens")
        .and_then(Value::as_i64)
        .or_else(|| {
            usage
                .pointer("/prompt_tokens_details/cache_creation_input_tokens")
                .and_then(Value::as_i64)
        })
        .or_else(|| {
            usage
                .pointer("/input_tokens_details/cache_write_tokens")
                .and_then(Value::as_i64)
        })
        .or_else(|| {
            usage
                .get("cache_creation_input_tokens")
                .and_then(Value::as_i64)
        })
        .unwrap_or(0);
    let cache_miss_tokens = usage
        .get("prompt_cache_miss_tokens")
        .and_then(Value::as_i64)
        .unwrap_or_else(|| {
            prompt_tokens
                .saturating_sub(cached_tokens)
                .saturating_sub(cache_write_tokens)
        });
    let reasoning_tokens = usage
        .pointer("/completion_tokens_details/reasoning_tokens")
        .and_then(Value::as_i64)
        .unwrap_or(0);
    let actual_cost = usage.get("cost").and_then(Value::as_f64);
    let pricing = if channel == AiProviderChannel::DeepseekDirect {
        Some(deepseek_pricing(model_id))
    } else {
        descriptor.map(|model| model.pricing.clone())
    };
    let estimated_cost = pricing.as_ref().and_then(|pricing| {
        estimate_cost(
            pricing,
            prompt_tokens,
            completion_tokens,
            cached_tokens,
            cache_write_tokens,
        )
    });
    let provider_cache_discount = response
        .get("cache_discount")
        .and_then(Value::as_f64)
        .or_else(|| usage.get("cache_discount").and_then(Value::as_f64));
    let cache_savings_usd = provider_cache_discount.or_else(|| {
        let counterfactual = pricing
            .as_ref()
            .and_then(|pricing| estimate_cost(pricing, prompt_tokens, completion_tokens, 0, 0))?;
        estimated_cost.map(|actual| counterfactual - actual)
    });
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
        cache_miss_tokens,
        cache_write_tokens,
        total_tokens,
        cost_usd,
        cost_kind: cost_kind.to_string(),
        pricing_snapshot_json: pricing
            .as_ref()
            .and_then(|pricing| serde_json::to_string(pricing).ok())
            .unwrap_or_else(|| "{}".to_string()),
        cache_mode: cache.mode.clone(),
        stable_prefix_hash: cache.stable_prefix_hash.clone(),
        cache_key_hash: cache.cache_key_hash.clone(),
        prompt_contract_version: cache.prompt_contract_version.clone(),
        duration_ms: Some(duration.as_millis().min(i64::MAX as u128) as i64),
        cache_discount_usd: provider_cache_discount,
        cache_savings_usd,
    }
}

fn estimate_cost(
    pricing: &AiModelPricing,
    prompt_tokens: i64,
    completion_tokens: i64,
    cached_tokens: i64,
    cache_write_tokens: i64,
) -> Option<f64> {
    let prompt = pricing.prompt.as_deref()?.parse::<f64>().ok()?;
    let completion = pricing.completion.as_deref()?.parse::<f64>().ok()?;
    let request = pricing
        .request
        .as_deref()
        .and_then(|value| value.parse::<f64>().ok())
        .unwrap_or(0.0);
    let cache_hit = pricing
        .cache_hit
        .as_deref()
        .and_then(|value| value.parse::<f64>().ok());
    let billed_cached = cached_tokens.clamp(0, prompt_tokens);
    let billed_cache_write = cache_write_tokens.clamp(0, prompt_tokens - billed_cached);
    let cache_write = pricing
        .cache_write
        .as_deref()
        .and_then(|value| value.parse::<f64>().ok())
        .unwrap_or(prompt);
    let uncached = prompt_tokens
        .saturating_sub(billed_cached)
        .saturating_sub(billed_cache_write);
    Some(
        uncached as f64 * prompt
            + billed_cached as f64 * cache_hit.unwrap_or(prompt)
            + billed_cache_write as f64 * cache_write
            + completion_tokens as f64 * completion
            + request,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

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
        let pricing = AiModelPricing {
            prompt: Some("0.000001".to_string()),
            completion: Some("0.000002".to_string()),
            ..AiModelPricing::default()
        };
        assert_eq!(estimate_cost(&pricing, 1_000, 500, 0, 0), Some(0.002));
    }

    #[test]
    fn charges_cache_reads_and_writes_with_their_own_prices() {
        let pricing = AiModelPricing {
            prompt: Some("1".to_string()),
            completion: Some("2".to_string()),
            cache_hit: Some("0.1".to_string()),
            cache_write: Some("1.25".to_string()),
            ..AiModelPricing::default()
        };
        assert_eq!(estimate_cost(&pricing, 100, 10, 40, 20), Some(89.0));
    }

    #[test]
    fn switches_deepseek_pricing_by_effective_time_and_peak_window() {
        let legacy = deepseek_pricing_at(
            "deepseek-v4-flash",
            Utc.with_ymd_and_hms(2026, 8, 16, 15, 59, 59).unwrap(),
        );
        assert_eq!(legacy.prompt.as_deref(), Some("0.00000014"));

        let off_peak = deepseek_pricing_at(
            "deepseek-v4-flash",
            Utc.with_ymd_and_hms(2026, 8, 16, 16, 0, 0).unwrap(),
        );
        assert_eq!(off_peak.prompt.as_deref(), Some("0.00000022"));
        assert_eq!(off_peak.cache_hit.as_deref(), Some("0.000000007"));

        let peak = deepseek_pricing_at(
            "deepseek-v4-pro",
            Utc.with_ymd_and_hms(2026, 8, 17, 6, 0, 0).unwrap(),
        );
        assert_eq!(peak.prompt.as_deref(), Some("0.00000132"));
        assert_eq!(peak.rate_label.as_deref(), Some("peak"));
    }

    #[test]
    fn parses_provider_cache_read_write_miss_and_discount_fields() {
        let response = json!({
            "usage": {
                "prompt_tokens": 2000,
                "completion_tokens": 200,
                "total_tokens": 2200,
                "cost": 0.12,
                "prompt_tokens_details": {
                    "cached_tokens": 900,
                    "cache_write_tokens": 300
                }
            },
            "cache_discount": 0.04
        });
        let metadata = PromptCacheMetadata {
            mode: "explicit".to_string(),
            stable_prefix_hash: "stable".to_string(),
            cache_key_hash: "key".to_string(),
            prompt_contract_version: "v1".to_string(),
        };
        let usage = parse_usage(
            AiProviderChannel::Openrouter,
            "openai/test",
            &response,
            None,
            &metadata,
            Duration::from_millis(321),
        );
        assert_eq!(usage.cached_tokens, 900);
        assert_eq!(usage.cache_write_tokens, 300);
        assert_eq!(usage.cache_miss_tokens, 800);
        assert_eq!(usage.cost_usd, Some(0.12));
        assert_eq!(usage.cost_kind, "actual");
        assert_eq!(usage.cache_discount_usd, Some(0.04));
        assert_eq!(usage.cache_savings_usd, Some(0.04));
        assert_eq!(usage.duration_ms, Some(321));
    }

    #[test]
    fn parses_qwen_explicit_cache_creation_field() {
        let response = json!({
            "usage": {
                "prompt_tokens": 7140,
                "completion_tokens": 21,
                "total_tokens": 7161,
                "prompt_tokens_details": {
                    "cached_tokens": 0,
                    "cache_creation_input_tokens": 7107
                }
            }
        });
        let metadata = PromptCacheMetadata {
            mode: "explicit".to_string(),
            stable_prefix_hash: "stable".to_string(),
            cache_key_hash: "key".to_string(),
            prompt_contract_version: "v1".to_string(),
        };
        let usage = parse_usage(
            AiProviderChannel::QwenDirect,
            "qwen3.7-flash",
            &response,
            None,
            &metadata,
            Duration::from_millis(1),
        );
        assert_eq!(usage.cache_write_tokens, 7107);
        assert_eq!(usage.cache_miss_tokens, 33);
    }

    #[test]
    fn disables_qwen_reasoning_only_for_high_volume_structured_stages() {
        assert_eq!(
            structured_reasoning_mode(AiProviderChannel::QwenDirect, "nanfeng_source_profiles"),
            InferenceReasoningMode::Disabled
        );
        assert_eq!(
            structured_reasoning_mode(
                AiProviderChannel::QwenDirect,
                "nanfeng_taxonomy_assignments"
            ),
            InferenceReasoningMode::Disabled
        );
        assert_eq!(
            structured_reasoning_mode(AiProviderChannel::QwenDirect, "nanfeng_taxonomy_structure"),
            InferenceReasoningMode::ProviderDefault
        );
        assert_eq!(
            structured_reasoning_mode(
                AiProviderChannel::QwenDirect,
                "nanfeng_taxonomy_topic_integrations"
            ),
            InferenceReasoningMode::ProviderDefault
        );
        assert_eq!(
            structured_reasoning_mode(AiProviderChannel::DeepseekDirect, "nanfeng_source_profiles"),
            InferenceReasoningMode::ProviderDefault
        );
    }

    #[test]
    fn topic_insight_prompt_requires_one_source_bound_conditional_bundle() {
        let prompt = system_prompt();
        assert!(prompt.contains("一次生成同一份主题成果包"));
        assert!(prompt.contains("summaryMarkdown 写 3 至 5 句"));
        assert!(prompt.contains("hypotheses 仅在材料存在两种以上合理解释时生成"));
        assert!(
            prompt.contains("只要来源具有可识别的先后时间、更新关系、新旧证据、阶段差异或立场变化")
        );
        assert!(prompt.contains("不得把建议伪装成已执行决定"));
        assert!(prompt.contains("每个关键结论都用 sourceItemIds"));
        assert!(prompt.contains("topicManagementSuggestions 最多 3 条"));
    }

    #[test]
    fn reuses_one_http_client_for_batch_connections() {
        let first = http_client().expect("first client");
        let second = http_client().expect("second client");
        assert!(std::ptr::eq(first, second));
    }

    #[test]
    fn topic_integration_sources_are_derived_from_confirmed_assignments() {
        let assignments = vec![
            AiTaxonomyAssignmentProposal {
                source_item_id: 9,
                topic_key: "topic-ai".to_string(),
                confidence: 0.9,
                reason: "匹配".to_string(),
                uncertain: false,
            },
            AiTaxonomyAssignmentProposal {
                source_item_id: 3,
                topic_key: "topic-ai".to_string(),
                confidence: 0.8,
                reason: "匹配".to_string(),
                uncertain: false,
            },
            AiTaxonomyAssignmentProposal {
                source_item_id: 21,
                topic_key: "topic-other".to_string(),
                confidence: 0.7,
                reason: "其他主题".to_string(),
                uncertain: false,
            },
        ];

        assert_eq!(
            canonical_taxonomy_topic_source_ids("topic-ai", &assignments),
            vec![3, 9]
        );
    }
}
