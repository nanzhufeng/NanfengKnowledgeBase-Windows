use nanfeng_knowledge_base_lib::ai::client::run_prompt_cache_canary;
use nanfeng_knowledge_base_lib::ai::credentials;
use nanfeng_knowledge_base_lib::ai::models::{
    AiProviderChannel, DEEPSEEK_DEFAULT_ORGANIZATION_MODEL, QWEN_DEFAULT_ORGANIZATION_MODEL,
};
use serde_json::json;

const REQUEST_COUNT: usize = 3;
const MAX_ESTIMATED_COST_USD: f64 = 0.02;

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let arguments = std::env::args().skip(1).collect::<Vec<_>>();
    if arguments.iter().any(|argument| argument == "--preflight") {
        return preflight();
    }
    if !arguments
        .iter()
        .any(|argument| argument == "--execute-isolated")
    {
        return Err(
            "缺少 --execute-isolated；未发送任何网络请求。先运行 --preflight。".to_string(),
        );
    }
    let channel = argument_value(&arguments, "--channel")
        .ok_or_else(|| "缺少 --channel".to_string())
        .and_then(|value| AiProviderChannel::parse(value).map_err(|error| error.to_string()))?;
    let default_model = match channel {
        AiProviderChannel::DeepseekDirect => DEEPSEEK_DEFAULT_ORGANIZATION_MODEL,
        AiProviderChannel::QwenDirect => QWEN_DEFAULT_ORGANIZATION_MODEL,
        AiProviderChannel::Openrouter => "",
    };
    let model_id = argument_value(&arguments, "--model")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(default_model);
    if model_id.is_empty() {
        return Err("OpenRouter 金丝雀必须显式提供 --model，未发送请求。".to_string());
    }
    let api_key = credentials::get_api_key(channel)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| format!("{} 未配置 API Key，未发送请求。", channel.as_str()))?;
    let stable_context = synthetic_stable_context();
    let mut estimated_cost = 0.0f64;
    for index in 1..=REQUEST_COUNT {
        let usage = run_prompt_cache_canary(
            channel,
            &api_key,
            model_id,
            &stable_context,
            &format!("合成批次 {index}：只返回 ok=true 与 batch=synthetic-{index}。"),
        )
        .map_err(|error| error.to_string())?;
        if let Some(cost) = usage.cost_usd {
            estimated_cost += cost;
        }
        println!(
            "{}",
            json!({
                "request": index,
                "channel": channel.as_str(),
                "model": model_id,
                "promptTokens": usage.prompt_tokens,
                "completionTokens": usage.completion_tokens,
                "cachedTokens": usage.cached_tokens,
                "cacheMissTokens": usage.cache_miss_tokens,
                "cacheWriteTokens": usage.cache_write_tokens,
                "cacheMode": usage.cache_mode,
                "costUsd": usage.cost_usd,
                "costKind": usage.cost_kind,
                "cacheSavingsUsd": usage.cache_savings_usd,
                "durationMs": usage.duration_ms,
            })
        );
        if estimated_cost >= MAX_ESTIMATED_COST_USD {
            println!(
                "{}",
                json!({
                    "stopped": true,
                    "reason": "estimated-cost-limit",
                    "estimatedCostUsd": estimated_cost,
                    "limitUsd": MAX_ESTIMATED_COST_USD,
                })
            );
            break;
        }
    }
    Ok(())
}

fn preflight() -> Result<(), String> {
    for channel in [
        AiProviderChannel::DeepseekDirect,
        AiProviderChannel::QwenDirect,
        AiProviderChannel::Openrouter,
    ] {
        let configured = credentials::get_api_key(channel)
            .map_err(|error| error.to_string())?
            .is_some();
        println!(
            "{}",
            json!({"channel": channel.as_str(), "configured": configured})
        );
    }
    Ok(())
}

fn argument_value<'a>(arguments: &'a [String], name: &str) -> Option<&'a str> {
    arguments
        .windows(2)
        .find(|pair| pair[0] == name)
        .map(|pair| pair[1].as_str())
}

fn synthetic_stable_context() -> String {
    let paragraph = "合成知识体系只用于测试公共前缀复用。领域为影视工作流，主题为镜头管理、动画审核、VFX合成与交付检查；所有名称和内容均为虚构，不对应任何正式资料。";
    std::iter::repeat(paragraph)
        .take(160)
        .collect::<Vec<_>>()
        .join("\n")
}
