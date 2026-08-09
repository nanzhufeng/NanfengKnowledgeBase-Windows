use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fs::{self, File, OpenOptions};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use thiserror::Error;
use zip::ZipArchive;

const MAX_ENTRY_COUNT: usize = 20_000;
const MAX_TOTAL_UNCOMPRESSED_BYTES: u64 = 8 * 1024 * 1024 * 1024;
const MAX_SINGLE_ENTRY_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const MAX_JSON_ENTRY_BYTES: u64 = 512 * 1024 * 1024;
const SIGNATURE_BYTES: usize = 64;

#[derive(Debug, Error)]
pub enum ChatGptExportError {
    #[error("文件操作失败：{0}")]
    Io(#[from] std::io::Error),
    #[error("ZIP 解析失败：{0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("JSON 解析失败：{0}")]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    Validation(String),
}

pub type ChatGptExportResult<T> = Result<T, ChatGptExportError>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub struct MessageAttachmentLink {
    pub conversation_id: String,
    pub message_id: String,
    pub attachment_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatGptAssetInspection {
    pub attachment_id: String,
    pub dat_entry_name: String,
    pub original_file_name: Option<String>,
    pub library_file_name: Option<String>,
    pub declared_extension: Option<String>,
    pub declared_mime: Option<String>,
    pub detected_extension: String,
    pub detected_mime: String,
    pub detection_source: String,
    pub size_bytes: u64,
    pub message_links: Vec<MessageAttachmentLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatGptExportInspection {
    pub report_version: u32,
    pub source_zip: String,
    pub source_zip_sha256: String,
    pub archive_entry_count: usize,
    pub total_uncompressed_bytes: u64,
    pub conversation_shard_count: usize,
    pub conversation_count: usize,
    pub message_attachment_occurrence_count: usize,
    pub message_attachment_link_count: usize,
    pub unique_message_attachment_count: usize,
    pub linked_asset_count: usize,
    pub unlinked_asset_count: usize,
    pub named_asset_count: usize,
    pub library_metadata_asset_count: usize,
    pub assets: Vec<ChatGptAssetInspection>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreservedChatGptAsset {
    pub attachment_id: String,
    pub original_dat_entry_name: String,
    pub original_file_name: Option<String>,
    pub stored_file_name: String,
    pub stored_file_path: String,
    pub sha256: String,
    pub size_bytes: u64,
    pub detected_extension: String,
    pub detected_mime: String,
    pub message_links: Vec<MessageAttachmentLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatGptExportPreservation {
    pub report_version: u32,
    pub source_zip: String,
    pub archived_zip: String,
    pub source_zip_sha256: String,
    pub attachment_directory: String,
    pub manifest_path: String,
    pub asset_count: usize,
    pub assets: Vec<PreservedChatGptAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatGptAssetMaterialization {
    pub report_version: u32,
    pub archived_zip: String,
    pub source_zip_sha256: String,
    pub attachment_directory: String,
    pub manifest_path: String,
    pub asset_count: usize,
    pub assets: Vec<PreservedChatGptAsset>,
}

#[derive(Debug, Clone, Default)]
struct LibraryAssetMetadata {
    file_name: Option<String>,
    extension: Option<String>,
    mime: Option<String>,
}

#[derive(Debug, Clone)]
struct EntryMetadata {
    name: String,
    size: u64,
}

pub fn inspect_chatgpt_export(
    source_zip: impl AsRef<Path>,
) -> ChatGptExportResult<ChatGptExportInspection> {
    let source_zip = source_zip.as_ref();
    if !source_zip.is_absolute() {
        return Err(ChatGptExportError::Validation(
            "ChatGPT 导出包必须使用绝对路径".to_string(),
        ));
    }
    if !source_zip.is_file() {
        return Err(ChatGptExportError::Validation(format!(
            "ChatGPT 导出包不存在：{}",
            source_zip.display()
        )));
    }

    let source_zip_sha256 = sha256_file(source_zip)?;
    let file = File::open(source_zip)?;
    let mut archive = ZipArchive::new(BufReader::new(file))?;
    let entries = validate_archive_entries(&mut archive)?;
    let entry_names = entries
        .iter()
        .map(|entry| entry.name.to_ascii_lowercase())
        .collect::<HashSet<_>>();

    let asset_names =
        read_optional_json_object(&mut archive, "conversation_asset_file_names.json")?
            .into_iter()
            .filter_map(|(key, value)| {
                value
                    .as_str()
                    .map(|name| (key.to_ascii_lowercase(), name.to_string()))
            })
            .collect::<HashMap<_, _>>();
    let library_metadata = read_library_metadata(&mut archive)?;
    let shard_names = entries
        .iter()
        .map(|entry| entry.name.as_str())
        .filter(|name| is_conversation_shard(name))
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    if shard_names.is_empty() {
        return Err(ChatGptExportError::Validation(
            "导出包内未找到 conversations-*.json".to_string(),
        ));
    }

    let mut conversation_count = 0_usize;
    let mut attachment_occurrence_count = 0_usize;
    let mut warnings = Vec::new();
    let mut links_by_entry = BTreeMap::<String, BTreeSet<MessageAttachmentLink>>::new();
    for shard_name in &shard_names {
        let shard = read_json_entry(&mut archive, shard_name)?;
        let conversations = shard
            .as_array()
            .ok_or_else(|| ChatGptExportError::Validation(format!("{shard_name} 不是会话数组")))?;
        conversation_count += conversations.len();
        for conversation in conversations {
            let Some(conversation_object) = conversation.as_object() else {
                continue;
            };
            let conversation_id = string_field(conversation_object, "conversation_id")
                .or_else(|| string_field(conversation_object, "id"))
                .unwrap_or_default();
            let Some(mapping) = conversation_object
                .get("mapping")
                .and_then(Value::as_object)
            else {
                continue;
            };
            for node in mapping.values().filter_map(Value::as_object) {
                let Some(message) = node.get("message").and_then(Value::as_object) else {
                    continue;
                };
                let message_id = string_field(message, "id").unwrap_or_default();
                let mut references = Vec::new();
                collect_attachment_references(&Value::Object(message.clone()), &mut references);
                for reference in references {
                    attachment_occurrence_count += 1;
                    let normalized = normalize_attachment_entry_name(&reference);
                    if !entry_names.contains(&normalized) {
                        // 导出包偶尔只保留对话中的媒体声明，不再包含二进制实体。
                        // 保留声明并给出可见警告，不能因一个缺失媒体让整包无法导入。
                        warnings.push(format!(
                            "消息声明了附件 {reference}，但导出包未携带可恢复实体"
                        ));
                        continue;
                    }
                    links_by_entry
                        .entry(normalized.clone())
                        .or_default()
                        .insert(MessageAttachmentLink {
                            conversation_id: conversation_id.clone(),
                            message_id: message_id.clone(),
                            attachment_id: attachment_id_from_entry(&normalized),
                        });
                }
            }
        }
    }

    let dat_entries = entries
        .iter()
        .filter(|entry| entry.name.to_ascii_lowercase().ends_with(".dat"))
        .cloned()
        .collect::<Vec<_>>();
    if dat_entries.is_empty() {
        return Err(ChatGptExportError::Validation(
            "导出包内没有 .dat 附件实体".to_string(),
        ));
    }

    let mut assets = Vec::with_capacity(dat_entries.len());
    for entry in dat_entries {
        let entry_key = entry.name.to_ascii_lowercase();
        let original_file_name = asset_names.get(&entry_key).cloned();
        let attachment_id = attachment_id_from_entry(&entry_key);
        let metadata = library_metadata
            .get(&attachment_id.to_ascii_lowercase())
            .cloned()
            .unwrap_or_default();
        let signature = read_entry_prefix(&mut archive, &entry.name)?;
        let detected = detect_asset_format(
            &signature,
            original_file_name.as_deref(),
            metadata.file_name.as_deref(),
            metadata.extension.as_deref(),
            metadata.mime.as_deref(),
        );
        if detected.source == "fallback" {
            warnings.push(format!("{} 无法可靠识别格式，按 .bin 保存", entry.name));
        }
        assets.push(ChatGptAssetInspection {
            attachment_id,
            dat_entry_name: entry.name.clone(),
            original_file_name,
            library_file_name: metadata.file_name,
            declared_extension: metadata.extension,
            declared_mime: metadata.mime,
            detected_extension: detected.extension,
            detected_mime: detected.mime,
            detection_source: detected.source,
            size_bytes: entry.size,
            message_links: links_by_entry
                .remove(&entry_key)
                .unwrap_or_default()
                .into_iter()
                .collect(),
        });
    }
    assets.sort_by(|left, right| left.dat_entry_name.cmp(&right.dat_entry_name));

    let linked_asset_count = assets
        .iter()
        .filter(|asset| !asset.message_links.is_empty())
        .count();
    let message_attachment_link_count = assets.iter().map(|asset| asset.message_links.len()).sum();
    let total_uncompressed_bytes = entries.iter().map(|entry| entry.size).sum();
    Ok(ChatGptExportInspection {
        report_version: 2,
        source_zip: source_zip.to_string_lossy().into_owned(),
        source_zip_sha256,
        archive_entry_count: entries.len(),
        total_uncompressed_bytes,
        conversation_shard_count: shard_names.len(),
        conversation_count,
        message_attachment_occurrence_count: attachment_occurrence_count,
        message_attachment_link_count,
        unique_message_attachment_count: linked_asset_count,
        linked_asset_count,
        unlinked_asset_count: assets.len().saturating_sub(linked_asset_count),
        named_asset_count: assets
            .iter()
            .filter(|asset| asset.original_file_name.is_some())
            .count(),
        library_metadata_asset_count: assets
            .iter()
            .filter(|asset| asset.library_file_name.is_some())
            .count(),
        assets,
        warnings,
    })
}

pub fn read_chatgpt_conversations(source_zip: impl AsRef<Path>) -> ChatGptExportResult<Vec<Value>> {
    let source_zip = source_zip.as_ref();
    let file = File::open(source_zip)?;
    let mut archive = ZipArchive::new(BufReader::new(file))?;
    let entries = validate_archive_entries(&mut archive)?;
    let mut shard_names = entries
        .iter()
        .map(|entry| entry.name.as_str())
        .filter(|name| is_conversation_shard(name))
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    shard_names.sort();
    if shard_names.is_empty() {
        return Err(ChatGptExportError::Validation(
            "导出包内未找到 conversations-*.json".to_string(),
        ));
    }
    let mut conversations = Vec::new();
    for shard_name in shard_names {
        let value = read_json_entry(&mut archive, &shard_name)?;
        let rows = value
            .as_array()
            .ok_or_else(|| ChatGptExportError::Validation(format!("{shard_name} 不是会话数组")))?;
        conversations.extend(rows.iter().cloned());
    }
    Ok(conversations)
}

pub fn materialize_chatgpt_assets(
    archived_zip: impl AsRef<Path>,
    attachment_directory: impl AsRef<Path>,
    manifest_path: impl AsRef<Path>,
) -> ChatGptExportResult<ChatGptAssetMaterialization> {
    let archived_zip = archived_zip.as_ref();
    let attachment_directory = attachment_directory.as_ref();
    let manifest_path = manifest_path.as_ref();
    if manifest_path.exists() {
        return Err(ChatGptExportError::Validation(format!(
            "为避免覆盖既有附件清单，目标已存在：{}",
            manifest_path.display()
        )));
    }
    if attachment_directory.exists() {
        return Err(ChatGptExportError::Validation(format!(
            "为避免混入既有附件，目标目录已存在：{}",
            attachment_directory.display()
        )));
    }
    let inspection = inspect_chatgpt_export(archived_zip)?;
    let manifest_parent = manifest_path
        .parent()
        .ok_or_else(|| ChatGptExportError::Validation("附件清单目标缺少父目录".to_string()))?;
    if let Some(parent) = attachment_directory.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::create_dir(attachment_directory)?;
    if manifest_parent != attachment_directory {
        fs::create_dir_all(manifest_parent)?;
    }
    let assets =
        match extract_inspected_assets(archived_zip, attachment_directory, &inspection.assets) {
            Ok(assets) => assets,
            Err(error) => {
                // 解包可能已写入部分文件；失败时清理本次新建目录，保证用户可直接重试。
                let _ = fs::remove_dir_all(attachment_directory);
                return Err(error);
            }
        };
    let materialization = ChatGptAssetMaterialization {
        report_version: 1,
        archived_zip: archived_zip.to_string_lossy().into_owned(),
        source_zip_sha256: inspection.source_zip_sha256,
        attachment_directory: attachment_directory.to_string_lossy().into_owned(),
        manifest_path: manifest_path.to_string_lossy().into_owned(),
        asset_count: assets.len(),
        assets,
    };
    if let Err(error) = write_new_json(manifest_path, &materialization) {
        let _ = fs::remove_file(manifest_path);
        let _ = fs::remove_dir_all(attachment_directory);
        return Err(error);
    }
    Ok(materialization)
}

/// 只物化一次用户明确点击的 ChatGPT 附件。调用方必须先使用同一归档的
/// `inspect_chatgpt_export` 结果完成来源与消息归属校验，避免为单个预览解压整包素材。
pub fn materialize_inspected_chatgpt_asset(
    archived_zip: impl AsRef<Path>,
    attachment_directory: impl AsRef<Path>,
    inspected_asset: &ChatGptAssetInspection,
) -> ChatGptExportResult<PreservedChatGptAsset> {
    let archived_zip = archived_zip.as_ref();
    let attachment_directory = attachment_directory.as_ref();
    if attachment_directory.exists() {
        return Err(ChatGptExportError::Validation(format!(
            "为避免混入既有附件，目标目录已存在：{}",
            attachment_directory.display()
        )));
    }
    if let Some(parent) = attachment_directory.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::create_dir(attachment_directory)?;
    let assets = match extract_inspected_assets(
        archived_zip,
        attachment_directory,
        std::slice::from_ref(inspected_asset),
    ) {
        Ok(assets) => assets,
        Err(error) => {
            let _ = fs::remove_dir_all(attachment_directory);
            return Err(error);
        }
    };
    assets.into_iter().next().ok_or_else(|| {
        let _ = fs::remove_dir_all(attachment_directory);
        ChatGptExportError::Validation("没有生成选中的附件实体".to_string())
    })
}

pub fn preserve_chatgpt_export(
    source_zip: impl AsRef<Path>,
    archived_zip: impl AsRef<Path>,
    attachment_directory: impl AsRef<Path>,
    manifest_path: impl AsRef<Path>,
) -> ChatGptExportResult<ChatGptExportPreservation> {
    let source_zip = source_zip.as_ref();
    let archived_zip = archived_zip.as_ref();
    let attachment_directory = attachment_directory.as_ref();
    let manifest_path = manifest_path.as_ref();
    for target in [archived_zip, manifest_path] {
        if target.exists() {
            return Err(ChatGptExportError::Validation(format!(
                "为避免覆盖既有原件，目标已存在：{}",
                target.display()
            )));
        }
    }
    if attachment_directory.exists() {
        return Err(ChatGptExportError::Validation(format!(
            "为避免混入既有附件，目标目录已存在：{}",
            attachment_directory.display()
        )));
    }

    let inspection = inspect_chatgpt_export(source_zip)?;
    let archived_parent = archived_zip
        .parent()
        .ok_or_else(|| ChatGptExportError::Validation("ZIP 归档目标缺少父目录".to_string()))?;
    let manifest_parent = manifest_path
        .parent()
        .ok_or_else(|| ChatGptExportError::Validation("附件清单目标缺少父目录".to_string()))?;
    fs::create_dir_all(archived_parent)?;
    if let Some(parent) = attachment_directory.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::create_dir(attachment_directory)?;
    if manifest_parent != attachment_directory {
        fs::create_dir_all(manifest_parent)?;
    }

    copy_new_with_hash(
        source_zip,
        archived_zip,
        Some(&inspection.source_zip_sha256),
    )?;
    let preserved_assets =
        extract_inspected_assets(source_zip, attachment_directory, &inspection.assets)?;

    let preservation = ChatGptExportPreservation {
        report_version: 1,
        source_zip: source_zip.to_string_lossy().into_owned(),
        archived_zip: archived_zip.to_string_lossy().into_owned(),
        source_zip_sha256: inspection.source_zip_sha256,
        attachment_directory: attachment_directory.to_string_lossy().into_owned(),
        manifest_path: manifest_path.to_string_lossy().into_owned(),
        asset_count: preserved_assets.len(),
        assets: preserved_assets,
    };
    write_new_json(manifest_path, &preservation)?;
    Ok(preservation)
}

fn extract_inspected_assets(
    source_zip: &Path,
    attachment_directory: &Path,
    inspected_assets: &[ChatGptAssetInspection],
) -> ChatGptExportResult<Vec<PreservedChatGptAsset>> {
    let file = File::open(source_zip)?;
    let mut archive = ZipArchive::new(BufReader::new(file))?;
    let mut preserved_assets = Vec::with_capacity(inspected_assets.len());
    for asset in inspected_assets {
        let stored_file_name = stored_asset_file_name(asset);
        let stored_path = attachment_directory.join(&stored_file_name);
        let mut source = archive.by_name(&asset.dat_entry_name)?;
        let output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&stored_path)?;
        let mut writer = BufWriter::new(output);
        let mut hasher = Sha256::new();
        let copied = copy_and_hash(&mut source, &mut writer, &mut hasher)?;
        writer.flush()?;
        writer.get_ref().sync_all()?;
        if copied != asset.size_bytes {
            return Err(ChatGptExportError::Validation(format!(
                "{} 解压后大小不一致：预期 {}，实际 {}",
                asset.dat_entry_name, asset.size_bytes, copied
            )));
        }
        preserved_assets.push(PreservedChatGptAsset {
            attachment_id: asset.attachment_id.clone(),
            original_dat_entry_name: asset.dat_entry_name.clone(),
            original_file_name: asset.original_file_name.clone(),
            stored_file_name,
            stored_file_path: stored_path.to_string_lossy().into_owned(),
            sha256: hex::encode_upper(hasher.finalize()),
            size_bytes: copied,
            detected_extension: asset.detected_extension.clone(),
            detected_mime: asset.detected_mime.clone(),
            message_links: asset.message_links.clone(),
        });
    }
    Ok(preserved_assets)
}

fn write_new_json(path: &Path, value: &impl Serialize) -> ChatGptExportResult<()> {
    let manifest_file = OpenOptions::new().write(true).create_new(true).open(path)?;
    let mut manifest_writer = BufWriter::new(manifest_file);
    serde_json::to_writer_pretty(&mut manifest_writer, value)?;
    manifest_writer.write_all(b"\n")?;
    manifest_writer.flush()?;
    manifest_writer.get_ref().sync_all()?;
    Ok(())
}

fn validate_archive_entries<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
) -> ChatGptExportResult<Vec<EntryMetadata>> {
    if archive.len() > MAX_ENTRY_COUNT {
        return Err(ChatGptExportError::Validation(format!(
            "ZIP 条目超过安全上限：{} > {MAX_ENTRY_COUNT}",
            archive.len()
        )));
    }
    let mut seen = HashSet::new();
    let mut total = 0_u64;
    let mut entries = Vec::with_capacity(archive.len());
    for index in 0..archive.len() {
        let file = archive.by_index(index)?;
        if file.enclosed_name().is_none() {
            return Err(ChatGptExportError::Validation(format!(
                "ZIP 包含不安全路径：{}",
                file.name()
            )));
        }
        if file.is_dir() {
            continue;
        }
        if file.encrypted() {
            return Err(ChatGptExportError::Validation(format!(
                "ZIP 包含加密条目，无法保证可恢复性：{}",
                file.name()
            )));
        }
        if file.size() > MAX_SINGLE_ENTRY_BYTES {
            return Err(ChatGptExportError::Validation(format!(
                "ZIP 单个条目超过安全上限：{}",
                file.name()
            )));
        }
        total = total
            .checked_add(file.size())
            .ok_or_else(|| ChatGptExportError::Validation("ZIP 解压体积计算溢出".to_string()))?;
        if total > MAX_TOTAL_UNCOMPRESSED_BYTES {
            return Err(ChatGptExportError::Validation(format!(
                "ZIP 解压总体积超过安全上限：{total}"
            )));
        }
        let normalized = file.name().to_ascii_lowercase();
        if !seen.insert(normalized) {
            return Err(ChatGptExportError::Validation(format!(
                "ZIP 包含重复条目名：{}",
                file.name()
            )));
        }
        entries.push(EntryMetadata {
            name: file.name().to_string(),
            size: file.size(),
        });
    }
    Ok(entries)
}

fn is_conversation_shard(name: &str) -> bool {
    let file_name = Path::new(name)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    file_name.starts_with("conversations-") && file_name.ends_with(".json")
}

fn read_optional_json_object<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    name: &str,
) -> ChatGptExportResult<serde_json::Map<String, Value>> {
    match archive.by_name(name) {
        Ok(mut file) => {
            validate_json_size(name, file.size())?;
            let value: Value = serde_json::from_reader(&mut file)?;
            value
                .as_object()
                .cloned()
                .ok_or_else(|| ChatGptExportError::Validation(format!("{name} 不是 JSON 对象")))
        }
        Err(zip::result::ZipError::FileNotFound) => Ok(serde_json::Map::new()),
        Err(error) => Err(error.into()),
    }
}

fn read_json_entry<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    name: &str,
) -> ChatGptExportResult<Value> {
    let mut file = archive.by_name(name)?;
    validate_json_size(name, file.size())?;
    Ok(serde_json::from_reader(&mut file)?)
}

fn validate_json_size(name: &str, size: u64) -> ChatGptExportResult<()> {
    if size > MAX_JSON_ENTRY_BYTES {
        return Err(ChatGptExportError::Validation(format!(
            "JSON 条目超过解析上限：{name}"
        )));
    }
    Ok(())
}

fn read_library_metadata<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
) -> ChatGptExportResult<HashMap<String, LibraryAssetMetadata>> {
    let value = match archive.by_name("library_files.json") {
        Ok(mut file) => {
            validate_json_size("library_files.json", file.size())?;
            serde_json::from_reader::<_, Value>(&mut file)?
        }
        Err(zip::result::ZipError::FileNotFound) => return Ok(HashMap::new()),
        Err(error) => return Err(error.into()),
    };
    let rows = value
        .as_array()
        .ok_or_else(|| ChatGptExportError::Validation("library_files.json 不是数组".to_string()))?;
    let mut result = HashMap::new();
    for row in rows.iter().filter_map(Value::as_object) {
        let Some(file_id) = string_field(row, "file_id") else {
            continue;
        };
        result.insert(
            file_id.to_ascii_lowercase(),
            LibraryAssetMetadata {
                file_name: string_field(row, "file_name"),
                extension: string_field(row, "file_extension")
                    .map(|value| normalize_extension(&value)),
                mime: string_field(row, "mime_type"),
            },
        );
    }
    Ok(result)
}

fn string_field(object: &serde_json::Map<String, Value>, field: &str) -> Option<String> {
    object
        .get(field)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn collect_attachment_references(value: &Value, output: &mut Vec<String>) {
    match value {
        Value::Object(object) => {
            // 新版 ChatGPT 把用户上传媒体存为 metadata.attachments[] 的
            // id/name/mime_type 组合。不能把任何 message.id 都当附件，只接受
            // 同时带文件描述的对象，避免消息节点误关联。
            let looks_like_attachment = object.contains_key("mime_type")
                && (object.contains_key("name") || object.contains_key("file_name"));
            if looks_like_attachment {
                if let Some(reference) = string_field(object, "id") {
                    output.push(reference);
                }
            }
            for (key, child) in object {
                if matches!(key.as_str(), "asset_pointer" | "file_id" | "file_uuid") {
                    if let Some(reference) = child.as_str() {
                        if !reference.trim().is_empty() {
                            output.push(reference.to_string());
                        }
                    }
                }
                collect_attachment_references(child, output);
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_attachment_references(item, output);
            }
        }
        _ => {}
    }
}

fn normalize_attachment_entry_name(reference: &str) -> String {
    let value = reference
        .split('?')
        .next()
        .unwrap_or(reference)
        .replace('\\', "/");
    let value = value
        .rsplit('/')
        .next()
        .unwrap_or(&value)
        .split("://")
        .last()
        .unwrap_or(&value);
    let value = value.to_ascii_lowercase();
    if value.ends_with(".dat") {
        value
    } else {
        format!("{value}.dat")
    }
}

fn attachment_id_from_entry(entry_name: &str) -> String {
    Path::new(entry_name)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(entry_name)
        .strip_suffix(".dat")
        .unwrap_or(entry_name)
        .to_string()
}

fn read_entry_prefix<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    name: &str,
) -> ChatGptExportResult<Vec<u8>> {
    let mut file = archive.by_name(name)?;
    let mut prefix = vec![0_u8; SIGNATURE_BYTES.min(file.size() as usize)];
    file.read_exact(&mut prefix)?;
    Ok(prefix)
}

#[derive(Debug, Clone)]
struct DetectedFormat {
    extension: String,
    mime: String,
    source: String,
}

fn detect_asset_format(
    signature: &[u8],
    original_file_name: Option<&str>,
    library_file_name: Option<&str>,
    declared_extension: Option<&str>,
    declared_mime: Option<&str>,
) -> DetectedFormat {
    let metadata_extension = declared_extension
        .map(normalize_extension)
        .or_else(|| extension_from_name(original_file_name))
        .or_else(|| extension_from_name(library_file_name))
        .or_else(|| declared_mime.and_then(extension_from_mime));
    if let Some((extension, mime)) = magic_format(signature) {
        if extension == "zip" && metadata_extension.as_deref() == Some("docx") {
            return DetectedFormat {
                extension: "docx".to_string(),
                mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    .to_string(),
                source: "signature+metadata".to_string(),
            };
        }
        return DetectedFormat {
            extension: extension.to_string(),
            mime: mime.to_string(),
            source: "signature".to_string(),
        };
    }
    if let Some(extension) = metadata_extension {
        return DetectedFormat {
            mime: mime_from_extension(&extension)
                .or(declared_mime)
                .unwrap_or("application/octet-stream")
                .to_string(),
            extension,
            source: "metadata".to_string(),
        };
    }
    DetectedFormat {
        extension: "bin".to_string(),
        mime: "application/octet-stream".to_string(),
        source: "fallback".to_string(),
    }
}

fn magic_format(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some(("png", "image/png"))
    } else if bytes.starts_with(b"\xff\xd8\xff") {
        Some(("jpg", "image/jpeg"))
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some(("gif", "image/gif"))
    } else if bytes.starts_with(b"%PDF-") {
        Some(("pdf", "application/pdf"))
    } else if bytes.starts_with(b"PK\x03\x04")
        || bytes.starts_with(b"PK\x05\x06")
        || bytes.starts_with(b"PK\x07\x08")
    {
        Some(("zip", "application/zip"))
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WAVE" {
        Some(("wav", "audio/wav"))
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some(("webp", "image/webp"))
    } else if bytes.len() >= 12 && &bytes[4..8] == b"ftyp" {
        Some(("mp4", "video/mp4"))
    } else if bytes.starts_with(b"ID3")
        || (bytes.len() >= 2 && bytes[0] == 0xff && bytes[1] & 0xe0 == 0xe0)
    {
        Some(("mp3", "audio/mpeg"))
    } else {
        None
    }
}

fn extension_from_name(name: Option<&str>) -> Option<String> {
    Path::new(name?)
        .extension()
        .and_then(|value| value.to_str())
        .map(normalize_extension)
        .filter(|value| !value.is_empty())
}

fn normalize_extension(value: &str) -> String {
    value
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase()
        .chars()
        .filter(char::is_ascii_alphanumeric)
        .take(12)
        .collect()
}

fn extension_from_mime(mime: &str) -> Option<String> {
    let extension = match mime.to_ascii_lowercase().as_str() {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "application/pdf" => "pdf",
        "application/zip" => "zip",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => "docx",
        "text/markdown" => "md",
        "text/plain" => "txt",
        "text/csv" => "csv",
        "application/json" => "json",
        "text/html" => "html",
        "video/mp4" => "mp4",
        "audio/wav" | "audio/x-wav" => "wav",
        "audio/mpeg" => "mp3",
        _ => return None,
    };
    Some(extension.to_string())
}

fn mime_from_extension(extension: &str) -> Option<&'static str> {
    match extension {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "pdf" => Some("application/pdf"),
        "zip" => Some("application/zip"),
        "docx" => Some("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        "md" | "markdown" => Some("text/markdown"),
        "txt" => Some("text/plain"),
        "csv" => Some("text/csv"),
        "json" => Some("application/json"),
        "html" | "htm" => Some("text/html"),
        "mp4" => Some("video/mp4"),
        "wav" => Some("audio/wav"),
        "mp3" => Some("audio/mpeg"),
        _ => None,
    }
}

fn stored_asset_file_name(asset: &ChatGptAssetInspection) -> String {
    let attachment_id = sanitize_file_component(&asset.attachment_id);
    let preferred_name = asset
        .original_file_name
        .as_deref()
        .or(asset.library_file_name.as_deref());
    let stem = preferred_name
        .and_then(|name| Path::new(name).file_stem())
        .and_then(|value| value.to_str())
        .map(sanitize_file_component)
        .filter(|value| !value.is_empty());
    match stem {
        Some(stem) => format!("{attachment_id}__{stem}.{}", asset.detected_extension),
        None => format!("{attachment_id}.{}", asset.detected_extension),
    }
}

fn sanitize_file_component(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|character| {
            if character.is_control()
                || matches!(
                    character,
                    '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
                )
            {
                '_'
            } else {
                character
            }
        })
        .collect::<String>();
    let sanitized = sanitized.trim().trim_matches('.').trim().to_string();
    if sanitized.is_empty() {
        "unnamed".to_string()
    } else {
        sanitized.chars().take(120).collect()
    }
}

fn sha256_file(path: &Path) -> ChatGptExportResult<String> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; 1024 * 1024];
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode_upper(hasher.finalize()))
}

fn copy_new_with_hash(
    source: &Path,
    target: &Path,
    expected_sha256: Option<&str>,
) -> ChatGptExportResult<String> {
    let mut reader = BufReader::new(File::open(source)?);
    let output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(target)?;
    let mut writer = BufWriter::new(output);
    let mut hasher = Sha256::new();
    copy_and_hash(&mut reader, &mut writer, &mut hasher)?;
    writer.flush()?;
    writer.get_ref().sync_all()?;
    let hash = hex::encode_upper(hasher.finalize());
    if expected_sha256.is_some_and(|expected| !expected.eq_ignore_ascii_case(&hash)) {
        return Err(ChatGptExportError::Validation(
            "归档 ZIP 与原始 ZIP 的 SHA-256 不一致".to_string(),
        ));
    }
    Ok(hash)
}

fn copy_and_hash(
    reader: &mut impl Read,
    writer: &mut impl Write,
    hasher: &mut Sha256,
) -> ChatGptExportResult<u64> {
    let mut total = 0_u64;
    let mut buffer = vec![0_u8; 1024 * 1024];
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        writer.write_all(&buffer[..read])?;
        hasher.update(&buffer[..read]);
        total += read as u64;
    }
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;
    use zip::write::SimpleFileOptions;
    use zip::{CompressionMethod, ZipWriter};

    fn write_test_export(path: &Path) {
        let file = File::create(path).expect("test zip");
        let mut zip = ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        zip.start_file("conversations-000.json", options)
            .expect("conversation entry");
        zip.write_all(
            serde_json::to_string(&serde_json::json!([{
                "id": "conversation-1",
                "mapping": {
                    "node-1": {
                        "message": {
                            "id": "message-1",
                            "content": {
                                "content_type": "multimodal_text",
                                "parts": [{
                                    "asset_pointer": "sediment://file_abc"
                                }]
                            }
                        }
                    },
                    "node-2": {
                        "message": {
                            "id": "message-2",
                            "content": {
                                "parts": [{
                                    "asset_pointer": "file-service://file-picture"
                                }]
                            }
                        }
                    }
                }
            }]))
            .expect("conversation json")
            .as_bytes(),
        )
        .expect("conversation bytes");
        zip.start_file("conversation_asset_file_names.json", options)
            .expect("name map");
        zip.write_all(br#"{"file_abc.dat":"notes.md","file-picture.dat":"photo.jpeg"}"#)
            .expect("name map bytes");
        zip.start_file("library_files.json", options)
            .expect("library");
        zip.write_all(
            br#"[{"file_id":"file_abc","file_name":"notes.md","file_extension":"md","mime_type":"text/markdown"}]"#,
        )
        .expect("library bytes");
        zip.start_file("file_abc.dat", options).expect("md asset");
        zip.write_all(b"# original markdown\n").expect("md bytes");
        zip.start_file("file-picture.dat", options)
            .expect("image asset");
        zip.write_all(b"\x89PNG\r\n\x1a\nPNG DATA")
            .expect("png bytes");
        zip.finish().expect("finish zip");
    }

    #[test]
    fn inspection_maps_messages_and_restores_formats() {
        let directory = tempfile::tempdir().expect("tempdir");
        let source = directory.path().join("export.zip");
        write_test_export(&source);

        let inspection = inspect_chatgpt_export(&source).expect("inspect");

        assert_eq!(inspection.conversation_count, 1);
        assert_eq!(inspection.message_attachment_occurrence_count, 2);
        assert_eq!(inspection.unique_message_attachment_count, 2);
        assert_eq!(inspection.linked_asset_count, 2);
        assert_eq!(inspection.assets[0].detected_extension, "png");
        assert_eq!(inspection.assets[0].detection_source, "signature");
        assert_eq!(inspection.assets[1].detected_extension, "md");
        assert_eq!(inspection.assets[1].detection_source, "metadata");
        assert_eq!(
            inspection.assets[1].message_links[0].conversation_id,
            "conversation-1"
        );
    }

    #[test]
    fn metadata_attachment_id_is_collected_without_treating_message_id_as_file() {
        let message = serde_json::json!({
            "id": "message-1",
            "metadata": {
                "attachments": [{
                    "id": "file_000000003d3081f5812c4bd6b7b107a8",
                    "name": "original.mp4",
                    "mime_type": "video/mp4",
                    "size": 19633733
                }]
            }
        });
        let mut references = Vec::new();
        collect_attachment_references(&message, &mut references);
        assert_eq!(references, vec!["file_000000003d3081f5812c4bd6b7b107a8"]);
    }

    #[test]
    fn preservation_keeps_zip_and_writes_byte_identical_assets() {
        let directory = tempfile::tempdir().expect("tempdir");
        let source = directory.path().join("export.zip");
        write_test_export(&source);
        let archived = directory.path().join("archive").join("original.zip");
        let attachments = directory.path().join("attachments");
        let manifest = directory.path().join("manifest").join("assets.json");

        let result =
            preserve_chatgpt_export(&source, &archived, &attachments, &manifest).expect("preserve");

        assert_eq!(result.asset_count, 2);
        assert_eq!(
            sha256_file(&source).expect("source hash"),
            sha256_file(&archived).expect("archive hash")
        );
        assert!(manifest.is_file());
        let markdown = result
            .assets
            .iter()
            .find(|asset| asset.detected_extension == "md")
            .expect("markdown asset");
        assert_eq!(
            fs::read(&markdown.stored_file_path).expect("stored markdown"),
            b"# original markdown\n"
        );
    }

    #[test]
    fn unsafe_zip_path_is_rejected() {
        let directory = tempfile::tempdir().expect("tempdir");
        let source = directory.path().join("unsafe.zip");
        let file = File::create(&source).expect("unsafe zip");
        let mut zip = ZipWriter::new(file);
        zip.start_file(
            "../escape.dat",
            SimpleFileOptions::default().compression_method(CompressionMethod::Deflated),
        )
        .expect("unsafe entry");
        zip.write_all(b"unsafe").expect("unsafe bytes");
        zip.finish().expect("finish unsafe zip");

        let error = inspect_chatgpt_export(&source).expect_err("unsafe path");
        assert!(error.to_string().contains("不安全路径"));
    }
}
