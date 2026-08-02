use std::fs;
use std::io::Read;
use std::path::Path;

use chrono::{NaiveDate, Utc};
use encoding_rs::GBK;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::database;
use crate::error::{AppError, AppResult};
use crate::models::{
    CreateRecordInput, EvidenceItem, IntelligenceRecord, RecordSourceInput, RecordStatus,
};
use crate::paths::AppPaths;

const LARGE_IMPORT_WARNING_BYTES: u64 = 50 * 1024 * 1024;
const MAX_IMPORT_BYTES: u64 = 200 * 1024 * 1024;
const MAX_CHATGPT_EXPORT_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const MAX_PREVIEW_RECORDS: usize = 32;
const MAX_PREVIEW_SOURCE_CHARS: usize = 32_000;
const MAX_DUPLICATE_CANDIDATES: usize = 200;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub job_id: String,
    pub source_file_name: String,
    pub stored_file_path: String,
    pub sha256: String,
    pub file_kind: String,
    pub size_bytes: u64,
    pub duplicate: bool,
    pub raw_preview: String,
    pub record_count: usize,
    pub records: Vec<CreateRecordInput>,
    pub boundary_options: Vec<ImportBoundaryOption>,
    pub duplicate_candidates: Vec<DuplicateCandidate>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateCandidate {
    pub item_index: usize,
    pub record_id: Option<i64>,
    pub duplicate_of_item_index: Option<usize>,
    pub title: String,
    pub reason: String,
    pub score: f64,
    pub exact: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportBoundaryOption {
    pub field: String,
    pub record_count: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmImportInput {
    pub job_id: String,
    #[allow(dead_code)]
    #[serde(default)]
    pub records: Vec<CreateRecordInput>,
    #[serde(default)]
    pub allow_duplicate: bool,
    #[serde(default = "default_duplicate_strategy")]
    pub duplicate_strategy: String,
    #[serde(default)]
    pub item_strategies: Vec<String>,
    #[serde(default)]
    pub mapping: serde_json::Value,
}

fn default_duplicate_strategy() -> String {
    "skip".to_string()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub job_id: String,
    pub status: String,
    pub imported_count: usize,
    pub first_imported_record: Option<ImportedRecordRef>,
    pub imported_source_item_ids: Vec<i64>,
    pub skipped_count: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedRecordRef {
    pub id: i64,
    pub title: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportJobSummary {
    pub id: String,
    pub source_file_name: String,
    pub status: String,
    pub success_count: i64,
    pub skip_count: i64,
    pub failure_count: i64,
    pub created_at: String,
    pub completed_at: Option<String>,
}

pub fn list_import_jobs(connection: &Connection) -> AppResult<Vec<ImportJobSummary>> {
    let mut statement = connection.prepare(
        "SELECT id, source_file_name, status, success_count, skip_count,
                failure_count, created_at, completed_at
         FROM import_jobs
         ORDER BY created_at DESC
         LIMIT 50",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(ImportJobSummary {
            id: row.get(0)?,
            source_file_name: row.get(1)?,
            status: row.get(2)?,
            success_count: row.get(3)?,
            skip_count: row.get(4)?,
            failure_count: row.get(5)?,
            created_at: row.get(6)?,
            completed_at: row.get(7)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn prepare_import(
    connection: &Connection,
    paths: &AppPaths,
    source_path: impl AsRef<Path>,
) -> AppResult<ImportPreview> {
    let source_path = source_path.as_ref();
    if !source_path.is_file() {
        return Err(AppError::NotFound("选择的导入文件不存在".to_string()));
    }
    let metadata = source_path.metadata()?;

    let source_file_name = source_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::Validation("文件名无法识别".to_string()))?
        .to_string();
    let file_kind = source_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let is_chatgpt_export = file_kind == "zip";
    validate_import_size(metadata.len(), is_chatgpt_export)?;
    if !matches!(
        file_kind.as_str(),
        "json" | "md" | "markdown" | "txt" | "html" | "htm" | "zip"
    ) {
        return Err(AppError::Unsupported(
            "仅支持 ChatGPT 完整导出 ZIP、JSON、Markdown、TXT 和 HTML 文件".to_string(),
        ));
    }

    let zip_inspection = if is_chatgpt_export {
        Some(
            crate::chatgpt_export::inspect_chatgpt_export(source_path)
                .map_err(chatgpt_export_error)?,
        )
    } else {
        None
    };
    let bytes = if is_chatgpt_export {
        None
    } else {
        Some(fs::read(source_path)?)
    };
    let sha256 = zip_inspection
        .as_ref()
        .map(|inspection| inspection.source_zip_sha256.to_ascii_lowercase())
        .unwrap_or_else(|| hex::encode(Sha256::digest(bytes.as_deref().unwrap_or_default())));
    let safe_name = sanitize_file_name(&source_file_name);
    let stored_path = paths
        .imports_raw
        .join(format!("{}_{}", &sha256[..16], safe_name));
    archive_source_file(source_path, &stored_path, &sha256)?;

    let hash_duplicate = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM import_jobs WHERE sha256 = ?1 AND status = 'completed')",
        params![sha256],
        |row| row.get::<_, i64>(0),
    )? != 0;
    let mut warnings = Vec::new();
    if metadata.len() > LARGE_IMPORT_WARNING_BYTES {
        warnings.push("文件超过 50 MB，归档和解析可能需要更长时间".to_string());
    }
    if hash_duplicate {
        warnings.push("检测到相同 SHA-256 的已完成导入；默认阻止重复写入".to_string());
    }

    let archived = stored_path.to_string_lossy().into_owned();
    let (full_records, raw_preview, boundary_options) = if let Some(inspection) = zip_inspection {
        warnings.push(format!(
            "完整导出包包含 {} 条会话、{} 个附件实体；确认导入后将恢复附件扩展名并保存消息映射清单",
            inspection.conversation_count,
            inspection.assets.len()
        ));
        warnings.push(format!(
            "{} 个附件由消息直接关联，{} 个文件库资产将作为未直接关联原件一并保留",
            inspection.linked_asset_count, inspection.unlinked_asset_count
        ));
        let records = parse_chatgpt_export_records(
            &stored_path,
            &source_file_name,
            &archived,
            &mut warnings,
        )?;
        let preview = serde_json::to_string_pretty(&serde_json::json!({
            "kind": "chatgpt_export",
            "conversationShards": inspection.conversation_shard_count,
            "conversations": inspection.conversation_count,
            "attachmentEntities": inspection.assets.len(),
            "linkedAttachments": inspection.linked_asset_count,
            "unlinkedAssets": inspection.unlinked_asset_count,
            "sourceZipSha256": inspection.source_zip_sha256,
        }))?;
        (records, preview, Vec::new())
    } else {
        let bytes = bytes.unwrap_or_default();
        let (decoded, used_gbk) = decode_text(&bytes);
        if used_gbk {
            warnings.push("文件不是 UTF-8，已按 GBK/GB18030 兼容方式解码".to_string());
        }
        let boundary_options = detect_boundary_options(&decoded, &file_kind);
        let records = parse_records(
            &decoded,
            &file_kind,
            &source_file_name,
            &archived,
            &mut warnings,
        )?;
        (
            records,
            decoded.chars().take(16_000).collect(),
            boundary_options,
        )
    };
    let mut duplicate_candidates = detect_duplicate_candidates(connection, &full_records)?;
    let exact_duplicate_count = duplicate_candidates
        .iter()
        .filter(|item| item.exact)
        .count();
    let similar_candidate_count = duplicate_candidates.len() - exact_duplicate_count;
    if exact_duplicate_count > 0 {
        warnings.push(format!(
            "发现 {exact_duplicate_count} 条来源身份或可见正文完全相同的笔记；确认后只复用已有笔记并追加来源证据，不创建副本"
        ));
    }
    if similar_candidate_count > 0 {
        warnings.push(format!(
            "另有 {similar_candidate_count} 条标题相似候选；相似标题不会被自动当作重复"
        ));
    }
    if duplicate_candidates.len() > MAX_DUPLICATE_CANDIDATES {
        warnings.push(format!(
            "重复候选较多，界面仅展示前 {MAX_DUPLICATE_CANDIDATES} 项；完整导入仍按所选全局策略执行"
        ));
        duplicate_candidates.truncate(MAX_DUPLICATE_CANDIDATES);
    }
    let duplicate = hash_duplicate || duplicate_candidates.iter().any(|candidate| candidate.exact);
    let record_count = full_records.len();
    let records = full_records
        .iter()
        .take(MAX_PREVIEW_RECORDS)
        .cloned()
        .map(preview_record)
        .collect::<Vec<_>>();
    if record_count > records.len() {
        warnings.push(format!(
            "文件共识别到 {record_count} 条记录；界面仅展示前 {} 条样本，确认后仍会从归档原文件完整导入",
            records.len()
        ));
    }
    let job_id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    connection.execute(
        "INSERT INTO import_jobs(
          id, source_file_name, stored_file_path, sha256, mapping_json, status,
          success_count, skip_count, failure_count, error_log_json, created_at
        ) VALUES (?1, ?2, ?3, ?4, '{}', 'preview', 0, 0, 0, '[]', ?5)",
        params![job_id, source_file_name, archived, sha256, created_at],
    )?;

    Ok(ImportPreview {
        job_id,
        source_file_name,
        stored_file_path: archived,
        sha256,
        file_kind,
        size_bytes: metadata.len(),
        duplicate,
        raw_preview,
        record_count,
        records,
        boundary_options,
        duplicate_candidates,
        warnings,
    })
}

fn detect_boundary_options(text: &str, file_kind: &str) -> Vec<ImportBoundaryOption> {
    if file_kind != "json" {
        return Vec::new();
    }
    serde_json::from_str::<Value>(text)
        .ok()
        .and_then(|root| root.as_object().cloned())
        .map(|object| {
            object
                .into_iter()
                .filter_map(|(field, value)| {
                    let items = value.as_array()?;
                    if items
                        .iter()
                        .any(|item| item.as_object().is_some_and(|map| !map.is_empty()))
                    {
                        Some(ImportBoundaryOption {
                            field,
                            record_count: items.len(),
                        })
                    } else {
                        None
                    }
                })
                .collect()
        })
        .unwrap_or_default()
}

fn detect_duplicate_candidates(
    connection: &Connection,
    records: &[CreateRecordInput],
) -> AppResult<Vec<DuplicateCandidate>> {
    let mut statement = connection.prepare(
        "SELECT r.id, r.title, r.created_at, r.updated_at,
                COALESCE((SELECT s.external_id FROM sources s
                          WHERE s.record_id = r.id AND s.external_id IS NOT NULL
                          ORDER BY s.id LIMIT 1), '')
         FROM records r
         WHERE r.is_deleted = 0",
    )?;
    let existing = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let mut candidates = Vec::new();
    let mut seen_import_identities = std::collections::HashMap::<String, (usize, String)>::new();
    for (item_index, record) in records.iter().enumerate() {
        let primary_source = record.sources.first();
        let external_id = primary_source
            .and_then(|source| source.external_id.as_deref())
            .filter(|value| !value.trim().is_empty())
            .map(str::to_string)
            .or_else(|| crate::knowledge::source_identity::external_item_id(&record.source_text));
        let source_type = primary_source
            .map(|source| source.source_type.as_str())
            .unwrap_or("import");
        let source_name = primary_source
            .map(|source| source.title.as_str())
            .unwrap_or("导入文件");
        let local_path = primary_source.and_then(|source| source.local_path.as_deref());
        let collection = crate::knowledge::source_identity::infer_source_collection(
            source_type,
            source_name,
            local_path,
            &record.source_text,
        );
        let content_identity =
            crate::knowledge::source_identity::content_identity_sha256(&record.source_text);
        let import_identity = external_id
            .as_deref()
            .map(|value| format!("external:{}:{}", collection.canonical_key, value.trim()))
            .or_else(|| {
                content_identity
                    .as_ref()
                    .map(|value| format!("content:{value}"))
            });
        if let Some(identity) = import_identity.as_ref() {
            if let Some((previous_index, previous_title)) = seen_import_identities.get(identity) {
                candidates.push(DuplicateCandidate {
                    item_index,
                    record_id: None,
                    duplicate_of_item_index: Some(*previous_index),
                    title: previous_title.clone(),
                    reason: "本次导入中来源身份或可见正文相同".to_string(),
                    score: 1.0,
                    exact: true,
                });
                continue;
            }
            seen_import_identities.insert(identity.clone(), (item_index, record.title.clone()));
        }
        if let Some(exact) = crate::knowledge::repository::find_exact_source_match(
            connection,
            source_type,
            source_name,
            local_path,
            &record.source_text,
            external_id.as_deref(),
        )? {
            candidates.push(DuplicateCandidate {
                item_index,
                record_id: exact.legacy_record_id,
                duplicate_of_item_index: None,
                title: exact.title,
                reason: exact.reason,
                score: 1.0,
                exact: true,
            });
            continue;
        }
        let source_date = record
            .original_at
            .as_deref()
            .map(|value| value.get(..10).unwrap_or(value).to_string())
            .or_else(|| import_source_date(&record.source_text));
        let normalized_title = normalize_title(&record.title);
        let mut seen = std::collections::HashSet::new();
        for (record_id, title, created_at, updated_at, existing_external_id) in &existing {
            let existing_title = normalize_title(title);
            let similarity = title_similarity(&normalized_title, &existing_title);
            let (reason, score) = if external_id
                .as_deref()
                .is_some_and(|value| value == existing_external_id)
            {
                ("来源 ID 相同", 1.0)
            } else if normalized_title == existing_title
                && source_date.as_deref().is_some_and(|date| {
                    created_at.starts_with(date) || updated_at.starts_with(date)
                })
            {
                ("标题与日期相同", 1.0)
            } else if normalized_title == existing_title {
                ("标题相同", 0.98)
            } else if similarity >= 0.86 {
                ("标题高度相似", similarity)
            } else {
                continue;
            };
            if seen.insert(*record_id) {
                candidates.push(DuplicateCandidate {
                    item_index,
                    record_id: Some(*record_id),
                    duplicate_of_item_index: None,
                    title: title.clone(),
                    reason: reason.to_string(),
                    score,
                    exact: false,
                });
            }
        }
    }
    Ok(candidates)
}

fn import_source_date(source_text: &str) -> Option<String> {
    let value = serde_json::from_str::<Value>(source_text).ok()?;
    let object = value.as_object()?;
    ["updatedAt", "updated_at", "createdAt", "created_at", "date"]
        .iter()
        .find_map(|key| object.get(*key).and_then(Value::as_str))
        .map(|value| value.get(..10).unwrap_or(value).to_string())
}

fn normalize_title(title: &str) -> String {
    title
        .chars()
        .filter(|character| !character.is_whitespace() && !character.is_ascii_punctuation())
        .flat_map(char::to_lowercase)
        .collect()
}

fn title_similarity(left: &str, right: &str) -> f64 {
    if left.is_empty() || right.is_empty() {
        return 0.0;
    }
    if left == right {
        return 1.0;
    }
    fn bigrams(value: &str) -> std::collections::HashSet<String> {
        let chars = value.chars().collect::<Vec<_>>();
        if chars.len() < 2 {
            return [value.to_string()].into_iter().collect();
        }
        chars.windows(2).map(|pair| pair.iter().collect()).collect()
    }
    let left = bigrams(left);
    let right = bigrams(right);
    let intersection = left.intersection(&right).count() as f64;
    let union = left.union(&right).count() as f64;
    if union == 0.0 {
        0.0
    } else {
        intersection / union
    }
}

fn validate_import_size(size_bytes: u64, is_chatgpt_export: bool) -> AppResult<()> {
    let limit = if is_chatgpt_export {
        MAX_CHATGPT_EXPORT_BYTES
    } else {
        MAX_IMPORT_BYTES
    };
    if size_bytes > limit {
        return Err(AppError::Validation(if is_chatgpt_export {
            "ChatGPT 完整导出 ZIP 不能超过 2 GB".to_string()
        } else {
            "单个导入文件不能超过 200 MB".to_string()
        }));
    }
    Ok(())
}

pub fn confirm_import(
    connection: &mut Connection,
    paths: &AppPaths,
    input: &ConfirmImportInput,
) -> AppResult<ImportResult> {
    let job = connection
        .query_row(
            "SELECT sha256, stored_file_path, status, source_file_name
             FROM import_jobs WHERE id = ?1",
            params![input.job_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound("导入预览已失效，请重新选择文件".to_string()))?;
    if job.2 != "preview" {
        return Err(AppError::Conflict(
            "该导入任务已经处理，不能重复提交".to_string(),
        ));
    }
    let archived_path = Path::new(&job.1);
    if !archived_path.is_file() {
        return Err(AppError::NotFound(
            "归档原文件不存在，已停止导入以避免不完整数据".to_string(),
        ));
    }
    let file_kind = Path::new(&job.3)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let mut parse_warnings = Vec::new();
    validate_import_size(archived_path.metadata()?.len(), file_kind == "zip")?;
    let mut records = if file_kind == "zip" {
        parse_chatgpt_export_records(archived_path, &job.3, &job.1, &mut parse_warnings)?
    } else {
        let archived_bytes = fs::read(archived_path)?;
        let (decoded, _) = decode_text(&archived_bytes);
        parse_records_for_confirmation(
            &decoded,
            &file_kind,
            &job.3,
            &job.1,
            &input.mapping,
            &mut parse_warnings,
        )?
    };
    if records.is_empty() {
        return Err(AppError::Validation("没有可导入的记录".to_string()));
    }
    let duplicate = connection.query_row(
        "SELECT EXISTS(
              SELECT 1 FROM import_jobs
              WHERE sha256 = ?1 AND status = 'completed' AND id <> ?2
            )",
        params![job.0, input.job_id],
        |row| row.get::<_, i64>(0),
    )? != 0;
    let default_strategy = if input.allow_duplicate {
        "copy"
    } else {
        input.duplicate_strategy.as_str()
    };
    if !matches!(default_strategy, "skip" | "copy" | "version" | "manual") {
        return Err(AppError::Validation("未知的重复导入策略".to_string()));
    }
    if duplicate && default_strategy == "skip" {
        connection.execute(
            "UPDATE import_jobs SET status = 'cancelled', skip_count = ?2, completed_at = ?3 WHERE id = ?1",
            params![input.job_id, records.len() as i64, Utc::now().to_rfc3339()],
        )?;
        return Ok(ImportResult {
            job_id: input.job_id.clone(),
            status: "cancelled".to_string(),
            imported_count: 0,
            first_imported_record: None,
            imported_source_item_ids: Vec::new(),
            skipped_count: records.len(),
            errors: Vec::new(),
        });
    }
    let chatgpt_assets = if file_kind == "zip" {
        let asset_directory = paths
            .attachments
            .join(format!("chatgpt-export-{}", input.job_id));
        let manifest_path = asset_directory.join("attachment-manifest.json");
        Some(
            crate::chatgpt_export::materialize_chatgpt_assets(
                archived_path,
                &asset_directory,
                &manifest_path,
            )
            .map_err(chatgpt_export_error)?,
        )
    } else {
        None
    };
    let duplicate_item_indices = if default_strategy == "skip" {
        detect_duplicate_candidates(connection, &records)?
            .into_iter()
            .filter(|candidate| candidate.exact)
            .map(|candidate| candidate.item_index)
            .collect::<std::collections::HashSet<_>>()
    } else {
        std::collections::HashSet::new()
    };

    let mut imported_count = 0usize;
    let mut first_imported_record = None;
    let mut imported_source_item_ids = Vec::new();
    let mut imported_title_samples = Vec::new();
    let mut imported_conversation_ids = std::collections::HashMap::<String, i64>::new();
    let mut errors = Vec::new();
    let mut skipped_count = 0usize;
    for (index, original) in records.drain(..).enumerate() {
        let mut record_input = original;
        if record_input.sources.is_empty() {
            record_input.sources.push(RecordSourceInput {
                source_type: "import".to_string(),
                title: Path::new(&job.1)
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("导入文件")
                    .to_string(),
                url: None,
                local_path: Some(job.1.clone()),
                external_id: Some(job.0.clone()),
            });
        }
        let primary_source = record_input.sources.first();
        let external_id = primary_source
            .and_then(|source| source.external_id.as_deref())
            .filter(|value| !value.trim().is_empty())
            .map(str::to_string)
            .or_else(|| {
                crate::knowledge::source_identity::external_item_id(&record_input.source_text)
            });
        let source_type = primary_source
            .map(|source| source.source_type.as_str())
            .unwrap_or("import");
        let source_name = primary_source
            .map(|source| source.title.as_str())
            .unwrap_or("导入文件");
        let local_path = primary_source.and_then(|source| source.local_path.as_deref());
        if let Some(existing) = crate::knowledge::repository::find_exact_source_match(
            connection,
            source_type,
            source_name,
            local_path,
            &record_input.source_text,
            external_id.as_deref(),
        )? {
            crate::knowledge::repository::register_import_origin(
                connection,
                existing.source_item_id,
                &input.job_id,
                &job.3,
                &job.1,
                &job.0,
                external_id.as_deref(),
            )?;
            connection.execute(
                "INSERT INTO import_job_items(
                   import_job_id, item_index, status, record_id, reason_code, message, raw_json
                 ) VALUES (?1, ?2, 'skipped', ?3, 'exact_duplicate_reused', ?4, ?5)",
                params![
                    input.job_id,
                    index as i64,
                    existing.legacy_record_id,
                    format!("{}，已复用已有笔记并追加导入来源证据", existing.reason),
                    import_item_audit_json(&record_input)?
                ],
            )?;
            if let (Some(item_external_id), Some(record_id)) =
                (external_id.as_deref(), existing.legacy_record_id)
            {
                imported_conversation_ids.insert(item_external_id.to_string(), record_id);
            }
            skipped_count += 1;
            continue;
        }
        let strategy = if default_strategy == "manual" {
            input
                .item_strategies
                .get(index)
                .map(String::as_str)
                .unwrap_or("skip")
        } else if default_strategy == "skip" {
            if duplicate_item_indices.contains(&index) {
                "skip"
            } else {
                "copy"
            }
        } else {
            default_strategy
        };
        if strategy == "skip" {
            connection.execute(
                "INSERT INTO import_job_items(
                  import_job_id, item_index, status, reason_code, message, raw_json
                ) VALUES (?1, ?2, 'skipped', 'user_skipped', '按导入策略跳过', ?3)",
                params![
                    input.job_id,
                    index as i64,
                    import_item_audit_json(&record_input)?
                ],
            )?;
            skipped_count += 1;
            continue;
        }
        let write_result = if strategy == "version" {
            import_as_version(connection, &record_input)
        } else if strategy == "copy" {
            database::create_record(connection, &record_input)
        } else {
            Err(AppError::Validation(format!(
                "第 {} 条记录使用了未知导入策略",
                index + 1
            )))
        };
        match write_result {
            Ok(record) => {
                connection.execute(
                    "INSERT INTO import_job_items(
                      import_job_id, item_index, status, record_id, message, raw_json
                    ) VALUES (?1, ?2, 'success', ?3, '导入成功', ?4)",
                    params![
                        input.job_id,
                        index as i64,
                        record.id,
                        import_item_audit_json(&record_input)?
                    ],
                )?;
                if first_imported_record.is_none() {
                    first_imported_record = Some(ImportedRecordRef {
                        id: record.id,
                        title: record.title.clone(),
                    });
                }
                let source_item_id = connection.query_row(
                    "SELECT id FROM source_items WHERE legacy_record_id = ?1",
                    [record.id],
                    |row| row.get::<_, i64>(0),
                )?;
                crate::knowledge::repository::register_import_origin(
                    connection,
                    source_item_id,
                    &input.job_id,
                    &job.3,
                    &job.1,
                    &job.0,
                    external_id.as_deref(),
                )?;
                imported_source_item_ids.push(source_item_id);
                if let Some(external_id) = record_input
                    .sources
                    .iter()
                    .find_map(|source| source.external_id.as_deref())
                    .filter(|value| !value.trim().is_empty())
                {
                    imported_conversation_ids.insert(external_id.to_string(), record.id);
                }
                imported_count += 1;
                if imported_title_samples.len() < 100 {
                    imported_title_samples.push(record.title);
                }
            }
            Err(error) => {
                let message = error.to_string();
                connection.execute(
                    "INSERT INTO import_job_items(
                      import_job_id, item_index, status, reason_code, message, raw_json
                    ) VALUES (?1, ?2, 'failed', 'record_write_failed', ?3, ?4)",
                    params![
                        input.job_id,
                        index as i64,
                        message,
                        import_item_audit_json(&record_input)?
                    ],
                )?;
                errors.push(message);
            }
        }
    }
    let linked_attachment_count = if let Some(assets) = &chatgpt_assets {
        match register_chatgpt_assets(
            connection,
            archived_path,
            assets,
            &imported_conversation_ids,
        ) {
            Ok(count) => count,
            Err(error) => {
                errors.push(format!("附件映射写入失败：{error}"));
                0
            }
        }
    } else {
        0
    };

    let status = if errors.is_empty() {
        "completed"
    } else if imported_count == 0 {
        "failed"
    } else {
        "partial"
    };
    connection.execute(
        "UPDATE import_jobs SET
          mapping_json = ?2, status = ?3, success_count = ?4, skip_count = ?5,
          failure_count = ?6, error_log_json = ?7, completed_at = ?8
        WHERE id = ?1",
        params![
            input.job_id,
            serde_json::to_string(&serde_json::json!({
                "mapping": input.mapping,
                "duplicateStrategy": default_strategy,
                "itemStrategies": input.item_strategies,
                "recordTitleSamples": imported_title_samples,
                "recordTitleSamplesTruncated": imported_count > 100,
                "parseWarnings": parse_warnings,
                "chatGptAttachmentManifest": chatgpt_assets.as_ref().map(|assets| &assets.manifest_path),
                "chatGptAttachmentCount": chatgpt_assets.as_ref().map(|assets| assets.asset_count),
                "chatGptLinkedAttachmentRows": linked_attachment_count,
            }))?,
            status,
            imported_count as i64,
            skipped_count as i64,
            errors.len() as i64,
            serde_json::to_string(&errors)?,
            Utc::now().to_rfc3339()
        ],
    )?;

    Ok(ImportResult {
        job_id: input.job_id.clone(),
        status: status.to_string(),
        imported_count,
        first_imported_record,
        imported_source_item_ids,
        skipped_count,
        errors,
    })
}

fn import_item_audit_json(record: &CreateRecordInput) -> AppResult<String> {
    Ok(serde_json::to_string(&serde_json::json!({
        "title": record.title,
        "status": record.status,
        "tags": record.tags,
        "sourceCount": record.sources.len(),
        "sourceTextBytes": record.source_text.len(),
        "sourceTextSha256": hex::encode(Sha256::digest(record.source_text.as_bytes())),
    }))?)
}

fn register_chatgpt_assets(
    connection: &Connection,
    archived_zip: &Path,
    materialization: &crate::chatgpt_export::ChatGptAssetMaterialization,
    imported_conversation_ids: &std::collections::HashMap<String, i64>,
) -> AppResult<usize> {
    let mut inserted = 0_usize;
    let created_at = Utc::now().to_rfc3339();
    for asset in &materialization.assets {
        let mut record_ids = std::collections::BTreeSet::new();
        for conversation_id in asset
            .message_links
            .iter()
            .map(|link| link.conversation_id.as_str())
            .filter(|value| !value.is_empty())
        {
            if let Some(record_id) = imported_conversation_ids.get(conversation_id) {
                record_ids.insert(*record_id);
                continue;
            }
            let existing = connection
                .query_row(
                    "SELECT record_id FROM sources
                     WHERE external_id = ?1
                     ORDER BY id DESC LIMIT 1",
                    [conversation_id],
                    |row| row.get::<_, i64>(0),
                )
                .optional()?;
            if let Some(record_id) = existing {
                record_ids.insert(record_id);
            }
        }
        if record_ids.is_empty() {
            continue;
        }
        let file_name = asset
            .original_file_name
            .as_deref()
            .unwrap_or(&asset.stored_file_name);
        let original_path = format!(
            "{}#{}",
            archived_zip.to_string_lossy(),
            asset.original_dat_entry_name
        );
        for record_id in record_ids {
            let exists = connection.query_row(
                "SELECT EXISTS(
                   SELECT 1 FROM attachments
                   WHERE record_id = ?1 AND sha256 = ?2
                 )",
                params![record_id, asset.sha256.to_ascii_lowercase()],
                |row| row.get::<_, i64>(0),
            )? != 0;
            if exists {
                continue;
            }
            connection.execute(
                "INSERT INTO attachments(
                   record_id, file_name, stored_path, original_path, mime_type,
                   size_bytes, sha256, created_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    record_id,
                    file_name,
                    asset.stored_file_path,
                    original_path,
                    asset.detected_mime,
                    asset.size_bytes as i64,
                    asset.sha256.to_ascii_lowercase(),
                    created_at,
                ],
            )?;
            inserted += 1;
        }
    }
    Ok(inserted)
}

pub fn cancel_import(connection: &Connection, job_id: &str) -> AppResult<()> {
    let changed = connection.execute(
        "UPDATE import_jobs
         SET status = 'cancelled', completed_at = ?2
         WHERE id = ?1 AND status = 'preview'",
        params![job_id, Utc::now().to_rfc3339()],
    )?;
    if changed == 0 {
        return Err(AppError::Conflict(
            "导入任务不存在或已经结束，不能再次取消".to_string(),
        ));
    }
    Ok(())
}

fn import_as_version(
    connection: &mut Connection,
    input: &CreateRecordInput,
) -> AppResult<IntelligenceRecord> {
    let existing_id = connection
        .query_row(
            "SELECT id FROM records
             WHERE is_deleted = 0 AND lower(trim(title)) = lower(trim(?1))
             ORDER BY updated_at DESC LIMIT 1",
            params![input.title],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;
    let Some(record_id) = existing_id else {
        return database::create_record(connection, input);
    };
    let update = crate::models::UpdateRecordInput {
        title: input.title.clone(),
        summary: input.summary.clone(),
        status: input.status.clone(),
        tags: input.tags.clone(),
        current_judgment: input.current_judgment.clone(),
        confirmed_facts: input.confirmed_facts.clone(),
        key_evidence: input.key_evidence.clone(),
        open_questions: input.open_questions.clone(),
        next_actions: input.next_actions.clone(),
        notes: input.notes.clone(),
        source_text: input.source_text.clone(),
        sources: input.sources.clone(),
    };
    database::update_record(connection, record_id, &update)?;
    database::append_version(
        connection,
        &crate::models::AppendVersionInput {
            record_id,
            version_title: "导入版本".to_string(),
            change_note: "由重复导入追加，保留原历史版本".to_string(),
        },
    )?;
    database::get_record(connection, record_id)
}

fn preview_record(mut record: CreateRecordInput) -> CreateRecordInput {
    if record.source_text.chars().count() <= MAX_PREVIEW_SOURCE_CHARS {
        return record;
    }
    record.source_text = serde_json::from_str::<Value>(&record.source_text)
        .ok()
        .map(|value| {
            let projected = project_json_value(&value, 0, 8, 200);
            let serialized = serde_json::to_string(&projected).unwrap_or_default();
            if serialized.chars().count() <= MAX_PREVIEW_SOURCE_CHARS {
                serialized
            } else {
                serde_json::to_string(&project_json_value(&value, 0, 4, 80)).unwrap_or_default()
            }
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            let mut preview = record
                .source_text
                .chars()
                .take(MAX_PREVIEW_SOURCE_CHARS)
                .collect::<String>();
            preview.push_str("\n\n…（界面仅展示样本，确认后从归档原文件读取完整内容）");
            preview
        });
    record
}

fn project_json_value(
    value: &Value,
    depth: usize,
    max_entries: usize,
    max_string_chars: usize,
) -> Value {
    if depth >= 4 {
        return match value {
            Value::String(text) => Value::String(truncate_chars(text, max_string_chars)),
            Value::Number(_) | Value::Bool(_) | Value::Null => value.clone(),
            Value::Array(items) => Value::String(format!("数组，共 {} 项", items.len())),
            Value::Object(map) => Value::String(format!("对象，共 {} 个字段", map.len())),
        };
    }
    match value {
        Value::String(text) => Value::String(truncate_chars(text, max_string_chars)),
        Value::Array(items) => Value::Array(
            items
                .iter()
                .take(max_entries)
                .map(|item| project_json_value(item, depth + 1, max_entries, max_string_chars))
                .collect(),
        ),
        Value::Object(map) => Value::Object(
            map.iter()
                .take(max_entries)
                .map(|(key, item)| {
                    (
                        key.clone(),
                        project_json_value(item, depth + 1, max_entries, max_string_chars),
                    )
                })
                .collect(),
        ),
        _ => value.clone(),
    }
}

fn truncate_chars(value: &str, limit: usize) -> String {
    let mut chars = value.chars();
    let result = chars.by_ref().take(limit).collect::<String>();
    if chars.next().is_some() {
        format!("{result}…")
    } else {
        result
    }
}

fn parse_records_for_confirmation(
    text: &str,
    file_kind: &str,
    file_name: &str,
    archived_path: &str,
    mapping: &Value,
    warnings: &mut Vec<String>,
) -> AppResult<Vec<CreateRecordInput>> {
    if file_kind != "json" {
        return parse_records(text, file_kind, file_name, archived_path, warnings);
    }

    let root: Value = serde_json::from_str(text)?;
    let boundary = mapping
        .get("__boundary")
        .and_then(Value::as_str)
        .unwrap_or("auto");
    let selected = select_json_values(&root, boundary)?;
    let valid_values = selected
        .into_iter()
        .enumerate()
        .filter_map(|(index, value)| match value {
            Value::Object(map) if !map.is_empty() => Some(Value::Object(map)),
            _ => {
                warnings.push(format!("JSON 第 {} 项不是有效对象，已跳过", index + 1));
                None
            }
        })
        .collect::<Vec<_>>();
    if valid_values.is_empty() {
        return Err(AppError::Validation(
            "所选记录边界中没有可导入的对象".to_string(),
        ));
    }

    let source = RecordSourceInput {
        source_type: "import".to_string(),
        title: file_name.to_string(),
        url: None,
        local_path: Some(archived_path.to_string()),
        external_id: None,
    };
    let serialized = if valid_values.len() == 1 {
        serde_json::to_string(&valid_values[0])?
    } else {
        serde_json::to_string(&valid_values)?
    };
    let mut records = parse_json_records(&serialized, source, warnings)?;
    let explicit_mapping = mapping.as_object().is_some_and(|entries| {
        entries.iter().any(|(key, value)| {
            key != "__boundary" && value.as_str().is_some_and(|field| !field.trim().is_empty())
        })
    });
    if explicit_mapping || boundary != "auto" {
        for (index, record) in records.iter_mut().enumerate() {
            if let Some(Value::Object(raw)) = valid_values.get(index) {
                apply_field_mapping(record, raw, mapping, index);
                record.source_text = serde_json::to_string(&valid_values[index])?;
            }
        }
    }
    Ok(records)
}

fn select_json_values(root: &Value, boundary: &str) -> AppResult<Vec<Value>> {
    if boundary != "auto" {
        return root
            .as_object()
            .and_then(|object| object.get(boundary))
            .and_then(Value::as_array)
            .map(|items| items.to_vec())
            .ok_or_else(|| {
                AppError::Validation(format!(
                    "记录边界“{boundary}”在归档原文件中不存在或不是数组"
                ))
            });
    }
    match root {
        Value::Array(items) => Ok(items.to_vec()),
        Value::Object(object) => object
            .get("records")
            .and_then(Value::as_array)
            .map(|items| items.to_vec())
            .map_or_else(|| Ok(vec![root.clone()]), Ok),
        _ => Err(AppError::Validation(
            "JSON 顶层必须是对象、对象数组或包含 records 数组".to_string(),
        )),
    }
}

fn apply_field_mapping(
    record: &mut CreateRecordInput,
    raw: &serde_json::Map<String, Value>,
    mapping: &Value,
    index: usize,
) {
    let mapped_string = |target: &str| -> Option<String> {
        let field = mapping.get(target)?.as_str()?;
        match raw.get(field)? {
            Value::String(value) => Some(value.clone()),
            Value::Number(value) => Some(value.to_string()),
            Value::Bool(value) => Some(value.to_string()),
            _ => None,
        }
    };
    let mapped_array = |target: &str| -> Option<Vec<String>> {
        let field = mapping.get(target)?.as_str()?;
        match raw.get(field)? {
            Value::Array(items) => Some(
                items
                    .iter()
                    .filter_map(|item| match item {
                        Value::String(value) => Some(value.clone()),
                        Value::Number(value) => Some(value.to_string()),
                        _ => None,
                    })
                    .collect(),
            ),
            Value::String(value) => Some(
                value
                    .split([',', '，', ';', '\n'])
                    .map(str::trim)
                    .filter(|item| !item.is_empty())
                    .map(str::to_string)
                    .collect(),
            ),
            _ => None,
        }
    };

    if let Some(title) = mapped_string("title").filter(|value| !value.trim().is_empty()) {
        record.title = title;
    } else if record.title.trim().is_empty() {
        record.title = format!("未命名导入记录 {}", index + 1);
    }
    if let Some(value) = mapped_string("summary") {
        record.summary = value;
    }
    if let Some(value) = mapped_string("status").and_then(|value| RecordStatus::parse(value.trim()))
    {
        record.status = value;
    }
    if let Some(value) = mapped_array("tags") {
        record.tags = value;
    }
    if let Some(value) = mapped_string("currentJudgment") {
        record.current_judgment = value;
    }
    if let Some(value) = mapped_array("confirmedFacts") {
        record.confirmed_facts = value;
    }
    if let Some(value) = mapped_array("openQuestions") {
        record.open_questions = value;
    }
    if let Some(value) = mapped_array("nextActions") {
        record.next_actions = value;
    }
    if let Some(value) = mapped_string("notes") {
        record.notes = value;
    }
}

fn parse_records(
    text: &str,
    file_kind: &str,
    file_name: &str,
    archived_path: &str,
    warnings: &mut Vec<String>,
) -> AppResult<Vec<CreateRecordInput>> {
    let source = RecordSourceInput {
        source_type: "import".to_string(),
        title: file_name.to_string(),
        url: None,
        local_path: Some(archived_path.to_string()),
        external_id: None,
    };
    match file_kind {
        "json" => parse_json_records(text, source, warnings),
        "md" | "markdown" => Ok(vec![parse_text_record(text, source, true)]),
        "txt" => Ok(vec![parse_text_record(text, source, false)]),
        "html" | "htm" => {
            let sanitized = ammonia::clean(text);
            let plain = html_to_text(&sanitized);
            Ok(vec![parse_text_record(&plain, source, false)])
        }
        _ => Err(AppError::Unsupported("不支持的导入格式".to_string())),
    }
}

fn parse_chatgpt_export_records(
    archived_path: &Path,
    file_name: &str,
    archived_path_text: &str,
    warnings: &mut Vec<String>,
) -> AppResult<Vec<CreateRecordInput>> {
    let conversations = crate::chatgpt_export::read_chatgpt_conversations(archived_path)
        .map_err(chatgpt_export_error)?;
    let text = serde_json::to_string(&conversations)?;
    let source = RecordSourceInput {
        source_type: "chatgpt_export".to_string(),
        title: file_name.to_string(),
        url: None,
        local_path: Some(archived_path_text.to_string()),
        external_id: None,
    };
    parse_json_records(&text, source, warnings)
}

fn chatgpt_export_error(error: crate::chatgpt_export::ChatGptExportError) -> AppError {
    AppError::Validation(format!("ChatGPT 完整导出包无效：{error}"))
}

fn parse_json_records(
    text: &str,
    source: RecordSourceInput,
    warnings: &mut Vec<String>,
) -> AppResult<Vec<CreateRecordInput>> {
    let root: Value = serde_json::from_str(text)?;
    let values: Vec<&Value> = match &root {
        Value::Array(items) => items.iter().collect(),
        Value::Object(map) if map.get("records").and_then(Value::as_array).is_some() => map
            ["records"]
            .as_array()
            .map(|items| items.iter().collect())
            .unwrap_or_default(),
        Value::Object(_) => vec![&root],
        _ => {
            return Err(AppError::Validation(
                "JSON 顶层必须是对象、对象数组或包含 records 数组".to_string(),
            ))
        }
    };
    let mut records = Vec::new();
    for (index, value) in values.iter().enumerate() {
        let item_number = index + 1;
        let Some(object) = value.as_object() else {
            warnings.push(format!("JSON 第 {item_number} 项不是对象，已跳过"));
            continue;
        };
        if object.is_empty() {
            warnings.push(format!("JSON 第 {item_number} 项为空对象，已跳过"));
            continue;
        }
        let title = match string_value(object, &["title", "name"])
            .and_then(|value| title_from_text(&value))
            .filter(|title| !is_generic_title(title))
        {
            Some(title) => title,
            None => {
                let generated = title_from_chat_messages(object)
                    .or_else(|| title_from_chatgpt_mapping(object))
                    .or_else(|| {
                        [
                            "summary",
                            "description",
                            "currentJudgment",
                            "current_judgment",
                            "judgment",
                            "content",
                            "text",
                            "body",
                            "notes",
                        ]
                        .iter()
                        .find_map(|key| {
                            object
                                .get(*key)
                                .and_then(Value::as_str)
                                .and_then(title_from_text)
                                .filter(|title| !is_generic_title(title))
                        })
                    })
                    .unwrap_or_else(|| format!("未命名导入记录 {item_number}"));
                warnings.push(format!(
                    "JSON 第 {item_number} 项缺少 title，已生成标题“{generated}”"
                ));
                generated
            }
        };
        let status = string_value(object, &["status"])
            .and_then(|value| RecordStatus::parse(value.trim()))
            .unwrap_or_default();
        let mut tags = string_array(object, &["tags"]);
        tags.extend(string_array(object, &["topics"]));
        tags.sort();
        tags.dedup();
        let source_text = match string_value(object, &["sourceText", "source_text"]) {
            Some(source_text) => source_text,
            None => serde_json::to_string(value)?,
        };
        let key_evidence = object
            .get("keyEvidence")
            .or_else(|| object.get("key_evidence"))
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| match item {
                        Value::String(content) => Some(EvidenceItem {
                            content: content.clone(),
                            source: String::new(),
                        }),
                        Value::Object(map) => Some(EvidenceItem {
                            content: string_value(map, &["content", "title"]).unwrap_or_default(),
                            source: string_value(map, &["source"]).unwrap_or_default(),
                        }),
                        _ => None,
                    })
                    .filter(|item| !item.content.trim().is_empty())
                    .collect()
            })
            .unwrap_or_default();
        let mut sources = vec![source.clone()];
        if let Some(source_title) = string_value(object, &["source"]) {
            sources[0].title = source_title;
        }
        sources[0].external_id = string_value(
            object,
            &[
                "conversation_id",
                "externalId",
                "external_id",
                "sourceId",
                "source_id",
                "uuid",
            ],
        );
        if sources[0].external_id.is_none() && object.get("mapping").is_some() {
            sources[0].external_id = string_value(object, &["id"]);
        }
        records.push(CreateRecordInput {
            title,
            original_at: database::derive_original_at(&serde_json::to_string(value)?),
            summary: string_value(object, &["summary", "description"]).unwrap_or_default(),
            status,
            tags,
            current_judgment: string_value(
                object,
                &["currentJudgment", "current_judgment", "judgment"],
            )
            .unwrap_or_default(),
            confirmed_facts: string_array(object, &["confirmedFacts", "confirmed_facts", "facts"]),
            key_evidence,
            open_questions: string_array(object, &["openQuestions", "open_questions", "questions"]),
            next_actions: string_array(object, &["nextActions", "next_actions", "actions"]),
            notes: string_value(object, &["notes"]).unwrap_or_default(),
            source_text,
            sources,
            is_favorite: object
                .get("isFavorite")
                .or_else(|| object.get("is_favorite"))
                .and_then(Value::as_bool)
                .unwrap_or(false),
        });
    }
    if records.len() > 1 {
        warnings.push(format!("识别到 {} 条记录，将按顺序导入", records.len()));
    }
    if records.is_empty() {
        return Err(AppError::Validation(
            "JSON 中没有可导入的对象记录".to_string(),
        ));
    }
    Ok(records)
}

fn parse_text_record(text: &str, source: RecordSourceInput, markdown: bool) -> CreateRecordInput {
    let lines = text.lines().map(str::trim).collect::<Vec<_>>();
    let mut body_start = 0;
    let mut frontmatter_title = None;
    if markdown && lines.first().is_some_and(|line| *line == "---") {
        if let Some(closing_index) = lines.iter().skip(1).position(|line| *line == "---") {
            let closing_index = closing_index + 1;
            frontmatter_title = lines[1..closing_index].iter().find_map(|line| {
                let (key, value) = line.split_once(':')?;
                if !key.trim().eq_ignore_ascii_case("title") {
                    return None;
                }
                let title = value
                    .trim()
                    .trim_matches(|character| matches!(character, '\'' | '"'));
                (!title.is_empty()).then_some(title)
            });
            body_start = closing_index + 1;
        }
    }
    let non_empty = lines[body_start..]
        .iter()
        .copied()
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>();
    let body_title = non_empty.first().copied().unwrap_or("未命名导入记录");
    let title = readable_markdown_title(text, Some(&source.title)).unwrap_or_else(|| {
        frontmatter_title
            .unwrap_or(body_title)
            .trim_start_matches('#')
            .trim()
            .to_string()
    });
    let summary_index = usize::from(frontmatter_title.is_none());
    let summary = non_empty
        .get(summary_index)
        .copied()
        .unwrap_or_default()
        .trim_start_matches('#')
        .trim();
    CreateRecordInput {
        title,
        original_at: None,
        summary: summary.to_string(),
        status: RecordStatus::Normal,
        tags: Vec::new(),
        current_judgment: String::new(),
        confirmed_facts: Vec::new(),
        key_evidence: Vec::new(),
        open_questions: Vec::new(),
        next_actions: Vec::new(),
        notes: String::new(),
        source_text: text.to_string(),
        sources: vec![source],
        is_favorite: false,
    }
}

fn visible_html_text(line: &str) -> String {
    let mut result = String::new();
    let mut inside_tag = false;
    for character in line.chars() {
        match character {
            '<' => inside_tag = true,
            '>' => {
                inside_tag = false;
                result.push(' ');
            }
            _ if !inside_tag => result.push(character),
            _ => {}
        }
    }
    result
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn usable_markdown_title(value: &str) -> bool {
    let trimmed = value.trim();
    !trimmed.is_empty()
        && trimmed.chars().count() <= 100
        && trimmed.chars().any(char::is_alphanumeric)
        && !trimmed.starts_with("---")
        && ![
            "tags:",
            "tag:",
            "aliases:",
            "cssclasses:",
            "created:",
            "updated:",
            "date:",
        ]
        .iter()
        .any(|prefix| trimmed.to_ascii_lowercase().starts_with(prefix))
        && !trimmed.eq_ignore_ascii_case("bazi monthly journal")
        && !trimmed.eq_ignore_ascii_case("restored visual edition")
        && !trimmed.eq_ignore_ascii_case("visual edition")
}

fn compact_markdown_title(value: &str) -> Option<String> {
    let compact = visible_html_text(value)
        .trim()
        .trim_matches(|character: char| {
            character.is_whitespace()
                || matches!(character, '#' | '>' | '*' | '_' | '`' | '~' | '-')
        })
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if !usable_markdown_title(&compact) {
        return None;
    }
    let mut characters = compact.chars();
    let title = characters.by_ref().take(60).collect::<String>();
    Some(if characters.next().is_some() {
        format!("{title}…")
    } else {
        title
    })
}

pub(crate) fn date_only_title(value: &str) -> bool {
    let trimmed = value.trim();
    ["%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y年%m月%d日"]
        .iter()
        .any(|format| NaiveDate::parse_from_str(trimmed, format).is_ok())
}

pub(crate) fn readable_markdown_title(
    text: &str,
    source_file_name: Option<&str>,
) -> Option<String> {
    let lines = text
        .trim_start_matches('\u{feff}')
        .lines()
        .collect::<Vec<_>>();
    let mut body_start = 0;
    if lines.first().is_some_and(|line| line.trim() == "---") {
        if let Some(closing_offset) = lines.iter().skip(1).position(|line| line.trim() == "---") {
            let closing_index = closing_offset + 1;
            if let Some(title) = lines[1..closing_index].iter().find_map(|line| {
                let (key, value) = line.split_once(':')?;
                if !key.trim().eq_ignore_ascii_case("title") {
                    return None;
                }
                let value = value.trim();
                compact_markdown_title(
                    value.trim_matches(|character| matches!(character, '\'' | '"')),
                )
            }) {
                return Some(title);
            }
            body_start = closing_index + 1;
        }
    }
    let body = &lines[body_start..];
    if let Some(title) = body.iter().find_map(|line| {
        let trimmed = line.trim();
        trimmed
            .strip_prefix("# ")
            .and_then(compact_markdown_title)
            .filter(|title| !date_only_title(title))
    }) {
        return Some(title);
    }
    let html_titles = body
        .iter()
        .filter(|line| line.contains('<') && line.contains('>'))
        .filter_map(|line| compact_markdown_title(line))
        .filter(|title| !date_only_title(title))
        .collect::<Vec<_>>();
    if let Some(title) = html_titles.iter().find(|title| {
        title
            .chars()
            .any(|character| ('\u{3400}'..='\u{9fff}').contains(&character))
    }) {
        return Some(title.clone());
    }
    if let Some(title) = html_titles.into_iter().next() {
        return Some(title);
    }
    if let Some(file_name) = source_file_name {
        if let Some(stem) = Path::new(file_name)
            .file_stem()
            .and_then(|value| value.to_str())
        {
            if let Some(title) = compact_markdown_title(stem) {
                if !matches!(
                    title.to_ascii_lowercase().as_str(),
                    "note" | "document" | "untitled"
                ) {
                    return Some(title);
                }
            }
        }
    }
    body.iter().find_map(|line| compact_markdown_title(line))
}

fn string_value(object: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| object.get(*key).and_then(Value::as_str))
        .map(str::to_string)
}

fn string_array(object: &serde_json::Map<String, Value>, keys: &[&str]) -> Vec<String> {
    keys.iter()
        .find_map(|key| object.get(*key).and_then(Value::as_array))
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

pub(crate) fn title_from_chat_messages(object: &serde_json::Map<String, Value>) -> Option<String> {
    object
        .get("chat_messages")
        .and_then(Value::as_array)?
        .iter()
        .filter_map(Value::as_object)
        .find_map(|message| {
            let sender = message
                .get("sender")
                .and_then(Value::as_str)?
                .trim()
                .to_ascii_lowercase();
            if !matches!(sender.as_str(), "human" | "user") {
                return None;
            }

            message
                .get("text")
                .and_then(Value::as_str)
                .and_then(title_from_text)
                .or_else(|| {
                    let content = message.get("content")?.as_array()?;
                    content
                        .iter()
                        .filter_map(Value::as_object)
                        .find_map(|block| {
                            block
                                .get("text")
                                .and_then(Value::as_str)
                                .and_then(title_from_text)
                        })
                })
        })
}

pub(crate) fn title_from_chatgpt_mapping(
    object: &serde_json::Map<String, Value>,
) -> Option<String> {
    let mapping = object.get("mapping")?.as_object()?;
    let mut current = object
        .get("current_node")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| mapping.keys().next().cloned())?;
    let mut visited = std::collections::HashSet::new();
    let mut lineage = Vec::new();
    while visited.insert(current.clone()) {
        let node = mapping.get(&current)?.as_object()?;
        lineage.push(node);
        let Some(parent) = node.get("parent").and_then(Value::as_str) else {
            break;
        };
        current = parent.to_string();
    }
    lineage.reverse();

    lineage.into_iter().find_map(|node| {
        let message = node.get("message")?.as_object()?;
        let role = message.get("author")?.as_object()?.get("role")?.as_str()?;
        if role != "user" {
            return None;
        }
        let content = message.get("content")?.as_object()?;
        if !matches!(
            content.get("content_type").and_then(Value::as_str),
            Some("text" | "multimodal_text")
        ) {
            return None;
        }
        content
            .get("parts")?
            .as_array()?
            .iter()
            .filter_map(Value::as_str)
            .find_map(title_from_text)
    })
}

pub(crate) fn is_generic_title(title: &str) -> bool {
    let normalized = title
        .trim()
        .trim_matches(|character: char| {
            character.is_whitespace()
                || matches!(character, '#' | '>' | '*' | '_' | '`' | '~' | '-')
        })
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase();
    let is_conversation_file_stem = matches!(normalized.as_str(), "conversation" | "conversations")
        || [
            "conversation-",
            "conversations-",
            "conversation_",
            "conversations_",
        ]
        .iter()
        .any(|prefix| {
            normalized
                .strip_prefix(prefix)
                .is_some_and(|suffix| suffix.parse::<usize>().is_ok())
        });

    matches!(
        normalized.as_str(),
        "conversation overview"
            | "conversation summary"
            | "untitled"
            | "new chat"
            | "new conversation"
            | "无标题"
            | "未命名"
    ) || is_conversation_file_stem
        || normalized
            .strip_prefix("未命名导入记录")
            .is_some_and(|suffix| {
                suffix.trim().is_empty() || suffix.trim().parse::<usize>().is_ok()
            })
}

fn title_from_text(text: &str) -> Option<String> {
    let first_line = text
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())?
        .trim_start_matches('#')
        .trim();
    if first_line.is_empty() {
        return None;
    }
    let mut chars = first_line.chars();
    let title = chars.by_ref().take(60).collect::<String>();
    Some(if chars.next().is_some() {
        format!("{title}…")
    } else {
        title
    })
}

fn decode_text(bytes: &[u8]) -> (String, bool) {
    if let Ok(text) = std::str::from_utf8(bytes) {
        return (text.trim_start_matches('\u{feff}').to_string(), false);
    }
    let (decoded, _, _) = GBK.decode(bytes);
    (decoded.into_owned(), true)
}

fn sanitize_file_name(name: &str) -> String {
    name.chars()
        .map(|character| {
            if matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            ) {
                '_'
            } else {
                character
            }
        })
        .collect()
}

fn archive_source_file(source: &Path, destination: &Path, expected_sha256: &str) -> AppResult<()> {
    if destination.exists() {
        if sha256_path(destination)?.eq_ignore_ascii_case(expected_sha256) {
            return Ok(());
        }
        return Err(AppError::Conflict(format!(
            "导入归档中已有同名但内容不一致的文件，已停止覆盖：{}",
            destination.display()
        )));
    }
    let temporary = destination.with_extension(format!("partial-{}", Uuid::new_v4()));
    let result = (|| -> AppResult<()> {
        let copied = fs::copy(source, &temporary)?;
        if copied != source.metadata()?.len() {
            return Err(AppError::Conflict("导入原件归档大小不一致".to_string()));
        }
        fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(&temporary)?
            .sync_all()?;
        fs::rename(&temporary, destination)?;
        Ok(())
    })();
    if result.is_err() && temporary.is_file() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

fn sha256_path(path: &Path) -> AppResult<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; 1024 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn html_to_text(html: &str) -> String {
    let mut result = String::new();
    let mut inside_tag = false;
    for character in html.chars() {
        match character {
            '<' => inside_tag = true,
            '>' => {
                inside_tag = false;
                if !result.ends_with('\n') {
                    result.push('\n');
                }
            }
            _ if !inside_tag => result.push(character),
            _ => {}
        }
    }
    result
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database;
    use std::io::Write as _;
    use tempfile::tempdir;
    use zip::write::SimpleFileOptions;
    use zip::{CompressionMethod, ZipWriter};

    #[test]
    fn import_size_policy_allows_200_mb_and_rejects_larger_files() {
        assert!(validate_import_size(MAX_IMPORT_BYTES, false).is_ok());
        let error = validate_import_size(MAX_IMPORT_BYTES + 1, false)
            .expect_err("files larger than 200 MB must be rejected");
        assert!(matches!(error, AppError::Validation(message) if message.contains("200 MB")));
        assert!(validate_import_size(MAX_CHATGPT_EXPORT_BYTES, true).is_ok());
        assert!(LARGE_IMPORT_WARNING_BYTES < MAX_IMPORT_BYTES);
    }

    #[test]
    fn chatgpt_zip_import_preserves_original_assets_and_message_mapping() {
        let directory = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        let source = directory.path().join("chatgpt-export.zip");
        let file = fs::File::create(&source).expect("zip");
        let mut zip = ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        zip.start_file("conversations-000.json", options)
            .expect("conversations");
        zip.write_all(
            serde_json::to_string(&serde_json::json!([{
                "id": "conversation-1",
                "title": "带图片的完整对话",
                "create_time": 1_700_000_000.0,
                "mapping": {
                    "node": {
                        "message": {
                            "id": "message-1",
                            "author": {"role": "user"},
                            "content": {
                                "content_type": "multimodal_text",
                                "parts": [
                                    "请分析这张图片",
                                    {"asset_pointer": "sediment://file_image"}
                                ]
                            }
                        }
                    }
                }
            }]))
            .expect("json")
            .as_bytes(),
        )
        .expect("conversation bytes");
        zip.start_file("conversation_asset_file_names.json", options)
            .expect("names");
        zip.write_all(r#"{"file_image.dat":"原始截图.jpeg"}"#.as_bytes())
            .expect("name bytes");
        zip.start_file("library_files.json", options)
            .expect("library");
        zip.write_all(
            r#"[{"file_id":"file_image","file_name":"原始截图.jpeg","file_extension":"jpeg","mime_type":"image/jpeg"}]"#
                .as_bytes(),
        )
        .expect("library bytes");
        zip.start_file("file_image.dat", options).expect("asset");
        zip.write_all(b"\x89PNG\r\n\x1a\nimage")
            .expect("asset bytes");
        zip.finish().expect("finish");

        let preview = prepare_import(&connection, &paths, &source).expect("preview");
        assert_eq!(preview.file_kind, "zip");
        assert_eq!(preview.record_count, 1);
        assert_eq!(
            preview.records[0].sources[0].external_id.as_deref(),
            Some("conversation-1")
        );
        assert!(preview
            .warnings
            .iter()
            .any(|warning| warning.contains("1 个附件实体")));

        let result = confirm_import(
            &mut connection,
            &paths,
            &ConfirmImportInput {
                job_id: preview.job_id.clone(),
                records: preview.records,
                allow_duplicate: false,
                duplicate_strategy: "copy".to_string(),
                item_strategies: Vec::new(),
                mapping: serde_json::json!({}),
            },
        )
        .expect("confirm");
        assert_eq!(result.imported_count, 1);

        let mapping: Value = serde_json::from_str(
            &connection
                .query_row(
                    "SELECT mapping_json FROM import_jobs WHERE id = ?1",
                    [&preview.job_id],
                    |row| row.get::<_, String>(0),
                )
                .expect("mapping"),
        )
        .expect("mapping json");
        let manifest = Path::new(
            mapping["chatGptAttachmentManifest"]
                .as_str()
                .expect("manifest path"),
        );
        assert!(manifest.is_file());
        let manifest_json: Value =
            serde_json::from_slice(&fs::read(manifest).expect("manifest")).expect("manifest json");
        assert_eq!(manifest_json["assetCount"], 1);
        assert_eq!(manifest_json["assets"][0]["detectedExtension"], "png");
        assert_eq!(
            manifest_json["assets"][0]["messageLinks"][0]["conversationId"],
            "conversation-1"
        );
        assert!(Path::new(
            manifest_json["assets"][0]["storedFilePath"]
                .as_str()
                .expect("stored path")
        )
        .is_file());
        let imported_record_id = result
            .first_imported_record
            .as_ref()
            .expect("imported record")
            .id;
        let attachment = crate::attachments::list_attachments(&connection, imported_record_id)
            .expect("linked attachments");
        assert_eq!(attachment.len(), 1);
        assert_eq!(attachment[0].file_name, "原始截图.jpeg");
        assert!(attachment[0]
            .original_path
            .as_deref()
            .is_some_and(|value| value.ends_with("#file_image.dat")));
    }

    #[test]
    fn json_import_recovers_missing_titles_and_skips_invalid_items() {
        let source = RecordSourceInput {
            source_type: "import".to_string(),
            title: "mixed.json".to_string(),
            url: None,
            local_path: Some("imports/raw/mixed.json".to_string()),
            external_id: None,
        };
        let mut warnings = Vec::new();
        let records = parse_json_records(
            r#"[
                {"title":"正常标题"},
                {"summary":"从摘要生成标题"},
                {"content":"从正文生成标题"},
                {},
                "无效字符串",
                {"status":"tracking","tags":["无标题"]}
            ]"#,
            source,
            &mut warnings,
        )
        .expect("mixed JSON should remain importable");

        assert_eq!(records.len(), 4);
        assert_eq!(records[0].title, "正常标题");
        assert_eq!(records[1].title, "从摘要生成标题");
        assert_eq!(records[2].title, "从正文生成标题");
        assert_eq!(records[3].title, "未命名导入记录 6");
        assert!(warnings
            .iter()
            .any(|warning| warning.contains("第 4 项为空对象")));
        assert!(warnings
            .iter()
            .any(|warning| warning.contains("第 5 项不是对象")));
        assert!(warnings
            .iter()
            .any(|warning| warning.contains("第 6 项缺少 title")));
    }

    #[test]
    fn markdown_import_uses_frontmatter_title_and_never_uses_delimiter_as_title() {
        let source = RecordSourceInput {
            source_type: "import".to_string(),
            title: "note.md".to_string(),
            url: None,
            local_path: Some("imports/raw/note.md".to_string()),
            external_id: None,
        };
        let with_title = parse_text_record(
            "---\ntitle: \"清明家族记录\"\ntags: [家族]\n---\n# 正文标题\n正文摘要",
            source.clone(),
            true,
        );
        assert_eq!(with_title.title, "清明家族记录");
        assert_eq!(with_title.summary, "正文标题");

        let without_title =
            parse_text_record("---\ntags: [家族]\n---\n# 清明祭祖\n家族线索", source, true);
        assert_eq!(without_title.title, "清明祭祖");
        assert_eq!(without_title.summary, "家族线索");

        let styled_html = parse_text_record(
            "---\ntags: [领域, 个人, 八字]\n---\n\
             <div style=\"font-size:13px\">Bazi Monthly Journal · Restored Visual Edition</div>\n\
             <div style=\"font-size:30px\">052 个人八字丙午年壬辰月</div>\n\
             ## 2026年4月5日",
            RecordSourceInput {
                source_type: "import".to_string(),
                title: "052 个人八字丙午年壬辰月.md".to_string(),
                url: None,
                local_path: Some("imports/raw/styled.md".to_string()),
                external_id: None,
            },
            true,
        );
        assert_eq!(styled_html.title, "052 个人八字丙午年壬辰月");

        let date_heading = parse_text_record(
            "# 2026年4月5日\n正文",
            RecordSourceInput {
                source_type: "import".to_string(),
                title: "个人阶段记录.md".to_string(),
                url: None,
                local_path: Some("imports/raw/个人阶段记录.md".to_string()),
                external_id: None,
            },
            true,
        );
        assert_eq!(date_heading.title, "个人阶段记录");

        let plain_text = parse_text_record(
            "2026年4月5日\n正文",
            RecordSourceInput {
                source_type: "import".to_string(),
                title: "项目复盘.txt".to_string(),
                url: None,
                local_path: Some("imports/raw/项目复盘.txt".to_string()),
                external_id: None,
            },
            false,
        );
        assert_eq!(plain_text.title, "项目复盘");
    }

    #[test]
    fn invalid_json_is_archived_without_partial_records_and_bom_is_supported() {
        let directory = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let connection = database::open_database(&paths.database).expect("database");
        let invalid = directory.path().join("错误 数据#1.json");
        fs::write(&invalid, br#"{"title":"incomplete""#).expect("write invalid json");

        let error = prepare_import(&connection, &paths, &invalid)
            .expect_err("malformed JSON must not create a preview");
        assert!(matches!(error, AppError::Serialization(_)));
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM records", [], |row| row
                    .get::<_, i64>(0))
                .expect("record count"),
            0
        );
        assert_eq!(
            fs::read_dir(&paths.imports_raw)
                .expect("archived imports")
                .count(),
            1
        );

        let bom = directory.path().join("中文 BOM.json");
        fs::write(
            &bom,
            b"\xEF\xBB\xBF{\"title\":\"BOM \xE5\xAF\xBC\xE5\x85\xA5\"}",
        )
        .expect("write bom json");
        let preview = prepare_import(&connection, &paths, &bom).expect("prepare bom json");
        assert_eq!(preview.record_count, 1);
        assert_eq!(preview.records[0].title, "BOM 导入");
        assert!(Path::new(&preview.stored_file_path).is_file());
    }

    #[test]
    fn batch_json_source_text_is_scoped_to_each_item() {
        let source = RecordSourceInput {
            source_type: "import".to_string(),
            title: "conversations.json".to_string(),
            url: None,
            local_path: Some("imports/raw/conversations.json".to_string()),
            external_id: None,
        };
        let first_payload = "甲".repeat(4_096);
        let second_payload = "乙".repeat(4_096);
        let input = serde_json::json!([
            {"name":"第一条","summary":"摘要甲","chat_messages":[{"text": first_payload}]},
            {"name":"第二条","summary":"摘要乙","chat_messages":[{"text": second_payload}]}
        ])
        .to_string();
        let mut warnings = Vec::new();
        let records =
            parse_json_records(&input, source, &mut warnings).expect("batch JSON should parse");

        assert_eq!(records.len(), 2);
        assert!(records[0].source_text.contains("摘要甲"));
        assert!(!records[0].source_text.contains("摘要乙"));
        assert!(records[1].source_text.contains("摘要乙"));
        assert!(!records[1].source_text.contains("摘要甲"));
        assert!(
            records
                .iter()
                .map(|record| record.source_text.len())
                .sum::<usize>()
                < input.len() * 2
        );
    }

    #[test]
    fn conversation_import_prefers_first_user_message_over_generic_title() {
        let source = RecordSourceInput {
            source_type: "import".to_string(),
            title: "conversation.json".to_string(),
            url: None,
            local_path: Some("imports/raw/conversation.json".to_string()),
            external_id: None,
        };
        let input = serde_json::json!({
            "name": "**Conversation Overview**",
            "summary": "**Conversation Overview**",
            "chat_messages": [
                {"sender": "assistant", "text": "先出现的助手内容"},
                {
                    "sender": "human",
                    "text": "我的 MAC Air 是 8G 内存，Mac Pro 是 32G 内存，为什么占用差这么多？"
                }
            ]
        })
        .to_string();
        let mut warnings = Vec::new();
        let records = parse_json_records(&input, source, &mut warnings)
            .expect("conversation JSON should parse");

        assert_eq!(records.len(), 1);
        assert_eq!(
            records[0].title,
            "我的 MAC Air 是 8G 内存，Mac Pro 是 32G 内存，为什么占用差这么多？"
        );
        assert!(warnings
            .iter()
            .any(|warning| warning.contains("缺少 title")));
    }

    #[test]
    fn chatgpt_mapping_import_uses_first_user_message_when_title_is_generic() {
        let source = RecordSourceInput {
            source_type: "import".to_string(),
            title: "conversations.json".to_string(),
            url: None,
            local_path: Some("imports/raw/conversations.json".to_string()),
            external_id: None,
        };
        let input = serde_json::json!({
            "title": "Untitled",
            "current_node": "answer",
            "create_time": 1700000000.0,
            "mapping": {
                "root": {"parent": null, "message": null},
                "user": {
                    "parent": "root",
                    "message": {
                        "author": {"role": "user"},
                        "content": {
                            "content_type": "multimodal_text",
                            "parts": [
                                {"content_type": "image_asset_pointer", "asset_pointer": "sediment://file_1"},
                                "NotebookLM 里多余邮箱无法删除，应该怎么处理？"
                            ]
                        }
                    }
                },
                "answer": {
                    "parent": "user",
                    "message": {
                        "author": {"role": "assistant"},
                        "content": {"content_type": "text", "parts": ["实际回答"]}
                    }
                }
            }
        })
        .to_string();
        let mut warnings = Vec::new();
        let records = parse_json_records(&input, source, &mut warnings)
            .expect("ChatGPT mapping JSON should parse");

        assert_eq!(records.len(), 1);
        assert_eq!(
            records[0].title,
            "NotebookLM 里多余邮箱无法删除，应该怎么处理？"
        );
        assert!(records[0].source_text.contains("\"mapping\""));
        assert_eq!(
            records[0].original_at.as_deref(),
            Some("2023-11-14T22:13:20+00:00")
        );
    }

    #[test]
    fn conversation_source_file_stems_are_generic_titles() {
        for title in [
            "conversation",
            "conversations",
            "conversation-004",
            "conversations_004",
        ] {
            assert!(is_generic_title(title), "{title} 应被视为通用文件名");
        }
        assert!(!is_generic_title("对话导入与自动分类设计"));
    }

    #[test]
    fn json_import_archives_previews_and_writes_records() {
        let directory = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        let source = directory.path().join("sample.json");
        fs::write(
            &source,
            r#"{"title":"导入验收","status":"tracking","tags":["导入"],"current_judgment":"本地解析"}"#,
        )
        .expect("write source");

        let preview = prepare_import(&connection, &paths, &source).expect("preview");
        assert_eq!(preview.records.len(), 1);
        assert!(std::path::PathBuf::from(&preview.stored_file_path).exists());
        assert!(!preview.duplicate);

        let result = confirm_import(
            &mut connection,
            &paths,
            &ConfirmImportInput {
                job_id: preview.job_id,
                records: preview.records,
                allow_duplicate: false,
                duplicate_strategy: "copy".to_string(),
                item_strategies: Vec::new(),
                mapping: serde_json::json!({}),
            },
        )
        .expect("confirm");
        assert_eq!(result.status, "completed");
        assert_eq!(result.imported_count, 1);
        assert_eq!(
            result
                .first_imported_record
                .as_ref()
                .map(|record| record.title.as_str()),
            Some("导入验收")
        );
    }

    #[test]
    fn completed_hash_is_detected_as_duplicate() {
        let directory = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        let source = directory.path().join("sample.txt");
        fs::write(&source, "重复文件\n正文").expect("write source");

        let first = prepare_import(&connection, &paths, &source).expect("first preview");
        confirm_import(
            &mut connection,
            &paths,
            &ConfirmImportInput {
                job_id: first.job_id,
                records: first.records,
                allow_duplicate: false,
                duplicate_strategy: "copy".to_string(),
                item_strategies: Vec::new(),
                mapping: serde_json::json!({}),
            },
        )
        .expect("first import");
        let second = prepare_import(&connection, &paths, &source).expect("second preview");
        assert!(second.duplicate);
        assert!(second
            .duplicate_candidates
            .iter()
            .any(|candidate| candidate.exact));
        let error = confirm_import(
            &mut connection,
            &paths,
            &ConfirmImportInput {
                job_id: second.job_id,
                records: second.records,
                allow_duplicate: false,
                duplicate_strategy: "skip".to_string(),
                item_strategies: Vec::new(),
                mapping: serde_json::json!({}),
            },
        )
        .expect("duplicate should be handled by skip strategy");
        assert_eq!(error.status, "cancelled");
        assert_eq!(error.skipped_count, 1);
    }

    #[test]
    fn skip_strategy_only_skips_record_level_duplicates() {
        let directory = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        let first_file = directory.path().join("first.json");
        fs::write(&first_file, r#"{"title":"已有记录"}"#).expect("write first");
        let first = prepare_import(&connection, &paths, &first_file).expect("first preview");
        confirm_import(
            &mut connection,
            &paths,
            &ConfirmImportInput {
                job_id: first.job_id,
                records: first.records,
                allow_duplicate: false,
                duplicate_strategy: "copy".to_string(),
                item_strategies: Vec::new(),
                mapping: serde_json::json!({"title":"title"}),
            },
        )
        .expect("first import");

        let batch_file = directory.path().join("batch.json");
        fs::write(
            &batch_file,
            r#"[{"title":"已有记录"},{"title":"全新记录"}]"#,
        )
        .expect("write batch");
        let batch = prepare_import(&connection, &paths, &batch_file).expect("batch preview");
        assert!(batch.duplicate);
        let result = confirm_import(
            &mut connection,
            &paths,
            &ConfirmImportInput {
                job_id: batch.job_id,
                records: batch.records,
                allow_duplicate: false,
                duplicate_strategy: "skip".to_string(),
                item_strategies: Vec::new(),
                mapping: serde_json::json!({"title":"title"}),
            },
        )
        .expect("import unique item");
        assert_eq!(result.imported_count, 1);
        assert_eq!(result.skipped_count, 1);
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM records", [], |row| row
                    .get::<_, i64>(0))
                .expect("record count"),
            2
        );
    }

    #[test]
    fn large_json_preview_is_bounded_but_confirmation_reads_full_archive() {
        let directory = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        let source = directory.path().join("large.json");
        let items = (0..40)
            .map(|index| {
                serde_json::json!({
                    "name": format!("大文件记录 {index}"),
                    "body": format!("完整正文-{index}-{}", "长内容".repeat(20_000)),
                })
            })
            .collect::<Vec<_>>();
        fs::write(
            &source,
            serde_json::to_vec(&serde_json::json!({ "items": items })).expect("serialize source"),
        )
        .expect("write source");

        let preview = prepare_import(&connection, &paths, &source).expect("prepare large import");
        assert_eq!(preview.record_count, 1);
        assert_eq!(preview.records.len(), 1);
        assert!(preview.records[0].source_text.len() < 100_000);
        assert_eq!(
            preview
                .boundary_options
                .iter()
                .find(|option| option.field == "items")
                .map(|option| option.record_count),
            Some(40)
        );

        let result = confirm_import(
            &mut connection,
            &paths,
            &ConfirmImportInput {
                job_id: preview.job_id,
                records: preview.records,
                allow_duplicate: false,
                duplicate_strategy: "copy".to_string(),
                item_strategies: Vec::new(),
                mapping: serde_json::json!({
                    "__boundary": "items",
                    "title": "name",
                    "summary": "",
                }),
            },
        )
        .expect("confirm full archive");
        assert_eq!(result.imported_count, 40);
        assert!(serde_json::to_vec(&result).expect("serialize result").len() < 1_000);
        let last_source_length = connection
            .query_row(
                "SELECT length(source_text) FROM records WHERE title = '大文件记录 39'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .expect("full source text");
        assert!(last_source_length > 50_000);
        let largest_audit_item = connection
            .query_row(
                "SELECT COALESCE(MAX(length(raw_json)), 0) FROM import_job_items",
                [],
                |row| row.get::<_, i64>(0),
            )
            .expect("bounded audit row");
        assert!(largest_audit_item < 1_000);
    }

    #[test]
    fn duplicate_can_append_version_or_be_cancelled_with_audit_state() {
        let directory = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        let source = directory.path().join("version.json");
        fs::write(
            &source,
            r#"{"title":"重复版本记录","currentJudgment":"第一版"}"#,
        )
        .expect("write source");
        let first = prepare_import(&connection, &paths, &source).expect("first preview");
        let first_result = confirm_import(
            &mut connection,
            &paths,
            &ConfirmImportInput {
                job_id: first.job_id,
                records: first.records,
                allow_duplicate: false,
                duplicate_strategy: "copy".to_string(),
                item_strategies: Vec::new(),
                mapping: serde_json::json!({"title":"title"}),
            },
        )
        .expect("first import");
        let record_id = first_result
            .first_imported_record
            .as_ref()
            .expect("first imported record")
            .id;

        fs::write(
            &source,
            r#"{"title":"重复版本记录","currentJudgment":"第二版"}"#,
        )
        .expect("update source");
        let second = prepare_import(&connection, &paths, &source).expect("second preview");
        let second_result = confirm_import(
            &mut connection,
            &paths,
            &ConfirmImportInput {
                job_id: second.job_id,
                records: second.records,
                allow_duplicate: false,
                duplicate_strategy: "version".to_string(),
                item_strategies: Vec::new(),
                mapping: serde_json::json!({"currentJudgment":"currentJudgment"}),
            },
        )
        .expect("append imported version");
        assert_eq!(
            second_result
                .first_imported_record
                .as_ref()
                .expect("versioned record")
                .id,
            record_id
        );
        let updated = database::get_record(&connection, record_id).expect("updated record");
        assert_eq!(updated.current_judgment, "第二版");
        assert_eq!(updated.version_count, 2);

        let cancelled = prepare_import(&connection, &paths, &source).expect("cancel preview");
        cancel_import(&connection, &cancelled.job_id).expect("cancel import");
        let jobs = list_import_jobs(&connection).expect("list jobs");
        assert!(jobs
            .iter()
            .any(|job| job.id == cancelled.job_id && job.status == "cancelled"));
    }

    #[test]
    fn exact_note_from_another_container_reuses_record_and_keeps_both_origins() {
        let directory = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        let first_file = directory.path().join("conversations-004.json");
        let second_file = directory.path().join("ChatGPT_new.json");
        let mapping = serde_json::json!({
            "1": {
                "parent": null,
                "message": {
                    "author": {"role": "user"},
                    "content": {"content_type": "text", "parts": ["不能重复保留的同一篇笔记"]}
                }
            }
        });
        fs::write(
            &first_file,
            serde_json::to_vec(&serde_json::json!({
                "title": "同一笔记",
                "conversation_id": "container-a",
                "mapping": mapping.clone(),
                "current_node": "1",
                "update_time": 1
            }))
            .expect("first json"),
        )
        .expect("first file");
        fs::write(
            &second_file,
            serde_json::to_vec(&serde_json::json!({
                "title": "改过标题但正文相同",
                "conversation_id": "container-b",
                "mapping": mapping,
                "current_node": "1",
                "update_time": 2,
                "default_model_slug": "changed"
            }))
            .expect("second json"),
        )
        .expect("second file");

        let first = prepare_import(&connection, &paths, &first_file).expect("first preview");
        let first_result = confirm_import(
            &mut connection,
            &paths,
            &ConfirmImportInput {
                job_id: first.job_id,
                records: first.records,
                allow_duplicate: false,
                duplicate_strategy: "copy".to_string(),
                item_strategies: Vec::new(),
                mapping: serde_json::json!({}),
            },
        )
        .expect("first import");
        assert_eq!(first_result.imported_count, 1);

        let second = prepare_import(&connection, &paths, &second_file).expect("second preview");
        assert!(second.duplicate);
        assert!(second
            .duplicate_candidates
            .iter()
            .any(|candidate| { candidate.exact && candidate.reason == "可见正文相同" }));
        let second_result = confirm_import(
            &mut connection,
            &paths,
            &ConfirmImportInput {
                job_id: second.job_id,
                records: second.records,
                allow_duplicate: true,
                duplicate_strategy: "copy".to_string(),
                item_strategies: Vec::new(),
                mapping: serde_json::json!({}),
            },
        )
        .expect("reuse exact note");
        assert_eq!(second_result.imported_count, 0);
        assert_eq!(second_result.skipped_count, 1);
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM records", [], |row| row
                    .get::<_, i64>(0))
                .expect("record count"),
            1
        );
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM source_import_origins", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("origin count"),
            2
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT display_name FROM source_collections WHERE canonical_key = 'chatgpt-import'",
                    [],
                    |row| row.get::<_, String>(0),
                )
                .expect("collection name"),
            "ChatGPT 导入"
        );
    }
}
