use std::collections::HashSet;
use std::path::Path;

use serde_json::{Map, Value};

const MAX_CLASSIFICATION_CHARACTERS: usize = 120_000;
const DEFAULT_SYNTHESIS_CHARACTERS: usize = 36_000;

fn generic_title(title: &str) -> bool {
    let normalized = title
        .trim()
        .trim_matches(|character: char| {
            matches!(character, '#' | '>' | '*' | '_' | '`' | '~' | '-' | ' ')
        })
        .to_lowercase();
    normalized.is_empty()
        || matches!(
            normalized.as_str(),
            "conversation overview"
                | "conversation summary"
                | "untitled"
                | "new chat"
                | "new conversation"
                | "无标题"
                | "未命名"
        )
        || title.trim() == "---"
        || normalized.starts_with("未命名导入记录")
        || normalized == "conversation"
        || normalized == "conversations"
        || normalized
            .strip_prefix("conversation-")
            .or_else(|| normalized.strip_prefix("conversation_"))
            .or_else(|| normalized.strip_prefix("conversations-"))
            .or_else(|| normalized.strip_prefix("conversations_"))
            .is_some_and(|suffix| suffix.chars().all(|character| character.is_ascii_digit()))
}

fn meaningful_title_line(line: &str) -> Option<String> {
    let mut cleaned = line
        .trim()
        .trim_start_matches(|character: char| {
            matches!(
                character,
                '#' | '>' | '*' | '_' | '`' | '~' | '-' | '•' | ' '
            )
        })
        .trim();
    if let Some(title) = cleaned
        .strip_prefix("title:")
        .or_else(|| cleaned.strip_prefix("title："))
    {
        cleaned = title.trim();
    }
    let lower = cleaned.to_lowercase();
    if cleaned.is_empty()
        || cleaned == "---"
        || cleaned.starts_with('<')
        || cleaned.ends_with(':')
        || cleaned.ends_with('：')
        || cleaned.starts_with("用户")
        || cleaned.starts_with("助手")
        || [
            "tags:",
            "aliases:",
            "cssclasses:",
            "created:",
            "updated:",
            "date:",
        ]
        .iter()
        .any(|prefix| lower.starts_with(prefix))
    {
        return None;
    }
    let compact = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    let length = compact.chars().count();
    if !(4..=240).contains(&length) {
        return None;
    }
    Some(compact.chars().take(60).collect::<String>())
}

fn standalone_source_name(source_name: &str) -> bool {
    Path::new(source_name)
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "md" | "markdown" | "txt" | "html" | "htm" | "doc" | "docx" | "rtf" | "odt" | "pdf"
            )
        })
}

/// 只修正展示标题，不写回来源或正式记录。
///
/// 单篇文件拥有有效文件名时，先恢复其显式标题或文件名；正文中的日期只能作为
/// 没有其他标题证据时的最后回退，不能覆盖已有文件标题。
pub fn display_title(title: &str, original_text: &str, source_name: Option<&str>) -> String {
    let standalone_source = source_name.filter(|value| standalone_source_name(value));
    let replaceable_date = standalone_source.is_some() && crate::importer::date_only_title(title);
    if !generic_title(title) && !replaceable_date {
        return title.trim().to_string();
    }
    if let Some(source_name) = standalone_source {
        if let Some(derived) =
            crate::importer::readable_markdown_title(original_text, Some(source_name))
                .filter(|value| !generic_title(value))
        {
            return derived;
        }
    }
    let readable = classification_text(original_text);
    let mut lines = readable.lines();
    let candidates: Vec<&str> = if readable.trim_start().starts_with("---") {
        lines
            .by_ref()
            .skip(1)
            .take_while(|line| line.trim() != "---")
            .for_each(drop);
        lines.collect()
    } else {
        readable.lines().collect()
    };
    candidates
        .into_iter()
        .find_map(meaningful_title_line)
        .unwrap_or_else(|| title.trim().to_string())
}

/// 为主题阅读页提供有界的真实正文，避免把完整大文件塞进读模型。
pub fn synthesis_text(original_text: &str) -> String {
    classification_text(original_text)
        .chars()
        .take(DEFAULT_SYNTHESIS_CHARACTERS)
        .collect()
}

/// 为分类器生成只包含用户可见语义的有界文本。
///
/// `source_items.original_text` 继续保真保存原始 JSON；模型名、搜索元数据、
/// 附件指针和内部字段不得作为主题证据。
pub fn classification_text(original_text: &str) -> String {
    extract_readable_text(original_text)
        .chars()
        .take(MAX_CLASSIFICATION_CHARACTERS)
        .collect::<String>()
        .trim()
        .to_string()
}

/// 为去重生成完整、稳定且只包含用户可见语义的正文。
/// 元数据、模型名、附件指针和 JSON 字段顺序不会改变笔记身份。
pub fn identity_text(original_text: &str) -> String {
    let readable = extract_readable_text(original_text);
    readable
        .lines()
        .map(|line| line.split_whitespace().collect::<Vec<_>>().join(" "))
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn extract_readable_text(original_text: &str) -> String {
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

    extracted.trim().to_string()
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
    fn replaces_generic_source_title_from_visible_content_without_writing_source() {
        let source = serde_json::json!({
            "chat_messages": [
                {"sender": "human", "text": "港版 iPhone 绑定汇丰香港 Apple Pay 是否可行？"},
                {"sender": "assistant", "text": "需要同时检查地区、银行卡与 App Store 账户。"}
            ]
        });
        assert_eq!(
            display_title("---", &source.to_string(), None),
            "港版 iPhone 绑定汇丰香港 Apple Pay 是否可行？"
        );
        assert_eq!(
            display_title("已经有价值的标题", &source.to_string(), None),
            "已经有价值的标题"
        );
        assert_eq!(
            display_title(
                "---",
                "---\ntags: [知识库]\ncreated: 2026-07-29\n---\n# 自动分类后的知识成果应该如何组织\n正文",
                Some("知识成果.md"),
            ),
            "自动分类后的知识成果应该如何组织"
        );
        assert_eq!(
            display_title(
                "---",
                "---\ntags: [领域, 个人, 八字]\n---\n\
                 <div style=\"font-size:13px\">Bazi Monthly Journal · Restored Visual Edition</div>\n\
                 <div style=\"font-size:30px\">052 个人八字丙午年壬辰月</div>\n\
                 ## 2026年4月5日",
                Some("052 个人八字丙午年壬辰月.md"),
            ),
            "052 个人八字丙午年壬辰月"
        );
    }

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
