use std::path::Path;

use serde_json::Value;
use sha2::{Digest, Sha256};

use super::readable_text;

pub(crate) const CHATGPT_COLLECTION_KEY: &str = "chatgpt-import";
pub(crate) const CLAUDE_COLLECTION_KEY: &str = "claude-import";
pub(crate) const LOOSE_FILES_COLLECTION_KEY: &str = "loose-files-import";
pub(crate) const JSON_COLLECTION_KEY: &str = "json-import";
pub(crate) const MANUAL_COLLECTION_KEY: &str = "manual-records";
pub(crate) const OTHER_COLLECTION_KEY: &str = "other-imports";

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SourceCollectionIdentity {
    pub canonical_key: String,
    pub default_name: String,
    pub collection_kind: String,
}

pub(crate) fn infer_source_collection(
    source_type: &str,
    current_name: &str,
    local_path: Option<&str>,
    original_text: &str,
) -> SourceCollectionIdentity {
    let normalized_type = source_type.trim().to_ascii_lowercase();
    let normalized_name = current_name.trim().to_ascii_lowercase();
    let json = serde_json::from_str::<Value>(original_text.trim()).ok();
    let object = json.as_ref().and_then(Value::as_object);

    if object.is_some_and(|value| value.get("mapping").is_some())
        || matches!(normalized_type.as_str(), "chatgpt" | "chatgpt_export")
        || normalized_name.contains("chatgpt")
    {
        return built_in(CHATGPT_COLLECTION_KEY, "ChatGPT 导入", "ai_provider");
    }
    if object.is_some_and(|value| value.get("chat_messages").is_some())
        || normalized_type == "claude"
        || normalized_name.contains("claude")
    {
        return built_in(CLAUDE_COLLECTION_KEY, "Claude 导入", "ai_provider");
    }

    let extension = local_path
        .and_then(|value| Path::new(value).extension())
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if matches!(
        normalized_type.as_str(),
        "markdown"
            | "text"
            | "html"
            | "pdf"
            | "audio"
            | "video"
            | "subtitle"
            | "transcript"
            | "image"
            | "file"
    ) || matches!(
        extension.as_str(),
        "md" | "markdown"
            | "txt"
            | "html"
            | "htm"
            | "doc"
            | "docx"
            | "pdf"
            | "rtf"
            | "odt"
            | "csv"
            | "xlsx"
            | "xls"
            | "jpg"
            | "jpeg"
            | "png"
            | "webp"
            | "mp3"
            | "wav"
            | "mp4"
            | "mov"
    ) {
        return built_in(LOOSE_FILES_COLLECTION_KEY, "零散文件导入", "loose_files");
    }

    if object.is_some() || normalized_type == "json" || extension == "json" {
        return built_in(JSON_COLLECTION_KEY, "JSON 导入", "structured_import");
    }

    if normalized_type == "manual" && local_path.is_none() {
        if current_name.trim().is_empty() || current_name.trim() == "手动记录" {
            return built_in(MANUAL_COLLECTION_KEY, "手动记录", "manual");
        }
        let digest = hex::encode(Sha256::digest(current_name.trim().as_bytes()));
        return SourceCollectionIdentity {
            canonical_key: format!("manual-{}", &digest[..16]),
            default_name: current_name.trim().to_string(),
            collection_kind: "manual".to_string(),
        };
    }

    built_in(OTHER_COLLECTION_KEY, "其他导入", "other")
}

fn built_in(key: &str, name: &str, kind: &str) -> SourceCollectionIdentity {
    SourceCollectionIdentity {
        canonical_key: key.to_string(),
        default_name: name.to_string(),
        collection_kind: kind.to_string(),
    }
}

pub(crate) fn content_identity_sha256(original_text: &str) -> Option<String> {
    let identity_text = readable_text::identity_text(original_text);
    (!identity_text.is_empty()).then(|| hex::encode(Sha256::digest(identity_text.as_bytes())))
}

pub(crate) fn external_item_id(original_text: &str) -> Option<String> {
    let value = serde_json::from_str::<Value>(original_text.trim()).ok()?;
    let object = value.as_object()?;
    ["conversation_id", "conversationId", "uuid", "id"]
        .iter()
        .find_map(|key| object.get(*key).and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_shape_overrides_misleading_file_name() {
        let claude = serde_json::json!({
            "uuid": "claude-1",
            "chat_messages": [{"sender": "human", "text": "问题"}]
        });
        assert_eq!(
            infer_source_collection(
                "import",
                "conversations.json",
                Some("conversations.json"),
                &claude.to_string()
            )
            .canonical_key,
            CLAUDE_COLLECTION_KEY
        );

        let chatgpt = serde_json::json!({
            "conversation_id": "chatgpt-1",
            "mapping": {}
        });
        assert_eq!(
            infer_source_collection(
                "import",
                "conversations-004.json",
                Some("conversations-004.json"),
                &chatgpt.to_string()
            )
            .canonical_key,
            CHATGPT_COLLECTION_KEY
        );
    }

    #[test]
    fn standalone_formats_share_one_collection() {
        for file_name in ["note.md", "brief.docx", "scan.pdf"] {
            assert_eq!(
                infer_source_collection("import", file_name, Some(file_name), "正文").canonical_key,
                LOOSE_FILES_COLLECTION_KEY
            );
        }
    }

    #[test]
    fn visible_content_identity_ignores_json_metadata() {
        let left = serde_json::json!({
            "conversation_id": "same",
            "mapping": {
                "1": {"parent": null, "message": {"author": {"role": "user"}, "content": {"content_type": "text", "parts": ["同一正文"]}}}
            },
            "current_node": "1",
            "update_time": 1
        });
        let right = serde_json::json!({
            "conversation_id": "same",
            "mapping": {
                "1": {"parent": null, "message": {"author": {"role": "user"}, "content": {"content_type": "text", "parts": ["同一正文"]}}}
            },
            "current_node": "1",
            "update_time": 2,
            "default_model_slug": "different"
        });
        assert_eq!(
            content_identity_sha256(&left.to_string()),
            content_identity_sha256(&right.to_string())
        );
    }
}
