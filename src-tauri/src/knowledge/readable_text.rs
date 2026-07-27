use std::collections::HashSet;

use serde_json::{Map, Value};

const MAX_CLASSIFICATION_CHARACTERS: usize = 120_000;

/// 为分类器生成只包含用户可见语义的有界文本。
///
/// `source_items.original_text` 继续保真保存原始 JSON；模型名、搜索元数据、
/// 附件指针和内部字段不得作为主题证据。
pub fn classification_text(original_text: &str) -> String {
    let trimmed = original_text.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let extracted = match serde_json::from_str::<Value>(trimmed) {
        Ok(Value::Object(root)) => {
            let chatgpt = chatgpt_mapping_text(&root);
            if !chatgpt.is_empty() {
                chatgpt
            } else {
                let conversation = chat_messages_text(&root);
                if !conversation.is_empty() {
                    conversation
                } else {
                    semantic_json_text(&root)
                }
            }
        }
        Ok(_) => String::new(),
        Err(_) => trimmed.to_string(),
    };

    extracted
        .chars()
        .take(MAX_CLASSIFICATION_CHARACTERS)
        .collect::<String>()
        .trim()
        .to_string()
}

fn non_empty_string(value: Option<&Value>) -> Option<&str> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn chat_messages_text(root: &Map<String, Value>) -> String {
    let Some(messages) = root.get("chat_messages").and_then(Value::as_array) else {
        return String::new();
    };
    messages
        .iter()
        .filter_map(Value::as_object)
        .filter_map(|message| {
            let role = non_empty_string(message.get("sender"))
                .unwrap_or_default()
                .to_ascii_lowercase();
            if !matches!(role.as_str(), "user" | "human" | "assistant" | "ai") {
                return None;
            }
            visible_message_text(message)
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn visible_message_text(message: &Map<String, Value>) -> Option<String> {
    if let Some(blocks) = message.get("content").and_then(Value::as_array) {
        let text = blocks
            .iter()
            .filter_map(Value::as_object)
            .filter(|block| {
                let block_type = non_empty_string(block.get("type"))
                    .unwrap_or("text")
                    .to_ascii_lowercase();
                matches!(block_type.as_str(), "text" | "")
                    && block.get("hidden").and_then(Value::as_bool) != Some(true)
                    && block.get("hidden_in_chat").and_then(Value::as_bool) != Some(true)
            })
            .filter_map(|block| non_empty_string(block.get("text")))
            .collect::<Vec<_>>()
            .join("\n\n");
        if !text.is_empty() {
            return Some(text);
        }
    }
    non_empty_string(message.get("text")).map(str::to_string)
}

fn chatgpt_mapping_text(root: &Map<String, Value>) -> String {
    let Some(mapping) = root.get("mapping").and_then(Value::as_object) else {
        return String::new();
    };
    let mut current_id = non_empty_string(root.get("current_node"))
        .filter(|id| mapping.get(*id).and_then(Value::as_object).is_some())
        .map(str::to_string)
        .or_else(|| latest_chatgpt_node_id(mapping));
    let mut lineage = Vec::new();
    let mut visited = HashSet::new();
    while let Some(id) = current_id {
        if !visited.insert(id.clone()) {
            break;
        }
        let Some(node) = mapping.get(&id).and_then(Value::as_object) else {
            break;
        };
        lineage.push(node);
        current_id = non_empty_string(node.get("parent")).map(str::to_string);
    }
    lineage.reverse();

    lineage
        .into_iter()
        .filter_map(chatgpt_node_text)
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn latest_chatgpt_node_id(mapping: &Map<String, Value>) -> Option<String> {
    mapping
        .iter()
        .filter_map(|(id, value)| {
            let node = value.as_object()?;
            let created_at = node
                .get("message")
                .and_then(Value::as_object)
                .and_then(|message| message.get("create_time"))
                .and_then(Value::as_f64)
                .unwrap_or_default();
            Some((id, created_at))
        })
        .max_by(|left, right| left.1.total_cmp(&right.1))
        .map(|(id, _)| id.clone())
}

fn chatgpt_node_text(node: &Map<String, Value>) -> Option<String> {
    let message = node.get("message").and_then(Value::as_object)?;
    let role = message
        .get("author")
        .and_then(Value::as_object)
        .and_then(|author| non_empty_string(author.get("role")))
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !matches!(role.as_str(), "user" | "assistant") {
        return None;
    }
    let content = message.get("content").and_then(Value::as_object)?;
    let content_type = non_empty_string(content.get("content_type"))
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !matches!(content_type.as_str(), "text" | "multimodal_text") {
        return None;
    }
    let parts = content.get("parts").and_then(Value::as_array)?;
    let text = parts
        .iter()
        .filter_map(|part| match part {
            Value::String(text) => (!text.trim().is_empty()).then(|| text.trim().to_string()),
            Value::Object(object) => {
                let part_type = non_empty_string(object.get("content_type"))
                    .unwrap_or_default()
                    .to_ascii_lowercase();
                if part_type.ends_with("_asset_pointer") {
                    None
                } else {
                    non_empty_string(object.get("text"))
                        .or_else(|| non_empty_string(object.get("content")))
                        .map(str::to_string)
                }
            }
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("\n\n");
    (!text.is_empty()).then_some(text)
}

fn semantic_json_text(root: &Map<String, Value>) -> String {
    const SEMANTIC_KEYS: &[&str] = &[
        "title",
        "name",
        "summary",
        "currentJudgment",
        "current_judgment",
        "confirmedFacts",
        "confirmed_facts",
        "keyEvidence",
        "key_evidence",
        "openQuestions",
        "open_questions",
        "nextActions",
        "next_actions",
        "notes",
        "text",
        "content",
        "body",
        "description",
    ];
    SEMANTIC_KEYS
        .iter()
        .filter_map(|key| root.get(*key))
        .flat_map(semantic_value_text)
        .filter(|value| !value.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn semantic_value_text(value: &Value) -> Vec<String> {
    match value {
        Value::String(text) => vec![text.trim().to_string()],
        Value::Array(items) => items.iter().flat_map(semantic_value_text).collect(),
        Value::Object(object) => ["text", "content", "title", "summary", "body", "source"]
            .iter()
            .filter_map(|key| object.get(*key))
            .flat_map(semantic_value_text)
            .collect(),
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claude_conversation_excludes_internal_metadata_from_classification() {
        let source = serde_json::json!({
            "name": "A股交易新规解析",
            "model": "Claude",
            "metadata": {"provider": "Google", "subtitle": "SRT", "color": "ACES"},
            "chat_messages": [
                {"sender": "human", "text": "A股盘后固定价格交易规则是什么？"},
                {"sender": "assistant", "content": [
                    {"type": "text", "text": "上交所与深交所调整了股票交易机制。"},
                    {"type": "thinking", "text": "GPU 模型成本"}
                ]}
            ]
        })
        .to_string();

        let text = classification_text(&source);
        assert!(text.contains("A股盘后固定价格交易规则"));
        assert!(text.contains("上交所与深交所"));
        assert!(!text.contains("Claude"));
        assert!(!text.contains("Google"));
        assert!(!text.contains("SRT"));
        assert!(!text.contains("ACES"));
        assert!(!text.contains("GPU"));
    }

    #[test]
    fn chatgpt_mapping_uses_only_current_visible_lineage() {
        let source = serde_json::json!({
            "current_node": "answer",
            "model_slug": "Claude",
            "mapping": {
                "root": {"parent": null, "message": null},
                "question": {
                    "parent": "root",
                    "message": {
                        "author": {"role": "user"},
                        "create_time": 1,
                        "content": {"content_type": "text", "parts": ["如何选择美国银行卡？"]}
                    }
                },
                "answer": {
                    "parent": "question",
                    "message": {
                        "author": {"role": "assistant"},
                        "create_time": 2,
                        "content": {"content_type": "text", "parts": ["比较 HSBC HK、Wise 和 Charles Schwab。"]}
                    }
                },
                "abandoned": {
                    "parent": "question",
                    "message": {
                        "author": {"role": "assistant"},
                        "create_time": 3,
                        "content": {"content_type": "text", "parts": ["SRT ACES GPU"]}
                    }
                }
            }
        })
        .to_string();

        let text = classification_text(&source);
        assert!(text.contains("美国银行卡"));
        assert!(text.contains("HSBC HK"));
        assert!(!text.contains("SRT"));
        assert!(!text.contains("ACES"));
        assert!(!text.contains("GPU"));
        assert!(!text.contains("Claude"));
    }

    #[test]
    fn empty_conversation_has_no_classifiable_text() {
        let source = serde_json::json!({
            "account": "",
            "uuid": "6c472386-2875-4e9f-a804-0ee16303efa5",
            "chat_messages": [],
            "name": "",
            "summary": ""
        })
        .to_string();

        assert!(classification_text(&source).is_empty());
    }
}
