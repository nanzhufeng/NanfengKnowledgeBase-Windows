use std::fs;
use std::path::Path;

use chrono::Utc;
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
    pub records: Vec<CreateRecordInput>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmImportInput {
    pub job_id: String,
    pub records: Vec<CreateRecordInput>,
    #[serde(default)]
    pub allow_duplicate: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub job_id: String,
    pub status: String,
    pub imported_records: Vec<IntelligenceRecord>,
    pub skipped_count: usize,
    pub errors: Vec<String>,
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
    validate_import_size(metadata.len())?;

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
    if !matches!(
        file_kind.as_str(),
        "json" | "md" | "markdown" | "txt" | "html" | "htm"
    ) {
        return Err(AppError::Unsupported(
            "仅支持 JSON、Markdown、TXT 和 HTML 文件".to_string(),
        ));
    }

    let bytes = fs::read(source_path)?;
    let sha256 = hex::encode(Sha256::digest(&bytes));
    let safe_name = sanitize_file_name(&source_file_name);
    let stored_path = paths
        .imports_raw
        .join(format!("{}_{}", &sha256[..16], safe_name));
    if !stored_path.exists() {
        fs::copy(source_path, &stored_path)?;
    }

    let duplicate = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM import_jobs WHERE sha256 = ?1 AND status = 'completed')",
        params![sha256],
        |row| row.get::<_, i64>(0),
    )? != 0;
    let (decoded, used_gbk) = decode_text(&bytes);
    let mut warnings = Vec::new();
    if metadata.len() > LARGE_IMPORT_WARNING_BYTES {
        warnings.push("文件超过 50 MB，归档和解析可能需要更长时间".to_string());
    }
    if used_gbk {
        warnings.push("文件不是 UTF-8，已按 GBK/GB18030 兼容方式解码".to_string());
    }
    if duplicate {
        warnings.push("检测到相同 SHA-256 的已完成导入；默认阻止重复写入".to_string());
    }

    let archived = stored_path.to_string_lossy().into_owned();
    let records = parse_records(
        &decoded,
        &file_kind,
        &source_file_name,
        &archived,
        &mut warnings,
    )?;
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
        raw_preview: decoded.chars().take(16_000).collect(),
        records,
        warnings,
    })
}

fn validate_import_size(size_bytes: u64) -> AppResult<()> {
    if size_bytes > MAX_IMPORT_BYTES {
        return Err(AppError::Validation(
            "单个导入文件不能超过 200 MB".to_string(),
        ));
    }
    Ok(())
}

pub fn confirm_import(
    connection: &mut Connection,
    input: &ConfirmImportInput,
) -> AppResult<ImportResult> {
    if input.records.is_empty() {
        return Err(AppError::Validation("没有可导入的记录".to_string()));
    }
    let job = connection
        .query_row(
            "SELECT sha256, stored_file_path, status FROM import_jobs WHERE id = ?1",
            params![input.job_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
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
    let duplicate = connection.query_row(
        "SELECT EXISTS(
              SELECT 1 FROM import_jobs
              WHERE sha256 = ?1 AND status = 'completed' AND id <> ?2
            )",
        params![job.0, input.job_id],
        |row| row.get::<_, i64>(0),
    )? != 0;
    if duplicate && !input.allow_duplicate {
        connection.execute(
            "UPDATE import_jobs SET status = 'cancelled', skip_count = ?2, completed_at = ?3 WHERE id = ?1",
            params![input.job_id, input.records.len() as i64, Utc::now().to_rfc3339()],
        )?;
        return Err(AppError::Conflict(
            "相同文件已经导入；如确需重复导入，请明确勾选允许重复".to_string(),
        ));
    }

    let mut imported_records = Vec::new();
    let mut errors = Vec::new();
    for (index, original) in input.records.iter().enumerate() {
        let mut record_input = original.clone();
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
        match database::create_record(connection, &record_input) {
            Ok(record) => {
                connection.execute(
                    "INSERT INTO import_job_items(
                      import_job_id, item_index, status, record_id, message, raw_json
                    ) VALUES (?1, ?2, 'success', ?3, '导入成功', ?4)",
                    params![
                        input.job_id,
                        index as i64,
                        record.id,
                        serde_json::to_string(original)?
                    ],
                )?;
                imported_records.push(record);
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
                        serde_json::to_string(original)?
                    ],
                )?;
                errors.push(message);
            }
        }
    }

    let status = if errors.is_empty() {
        "completed"
    } else if imported_records.is_empty() {
        "failed"
    } else {
        "partial"
    };
    connection.execute(
        "UPDATE import_jobs SET
          mapping_json = ?2, status = ?3, success_count = ?4, failure_count = ?5,
          error_log_json = ?6, completed_at = ?7
        WHERE id = ?1",
        params![
            input.job_id,
            serde_json::to_string(&input.records)?,
            status,
            imported_records.len() as i64,
            errors.len() as i64,
            serde_json::to_string(&errors)?,
            Utc::now().to_rfc3339()
        ],
    )?;

    Ok(ImportResult {
        job_id: input.job_id.clone(),
        status: status.to_string(),
        imported_records,
        skipped_count: 0,
        errors,
    })
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
        {
            Some(title) => title,
            None => {
                let generated = [
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
        records.push(CreateRecordInput {
            title,
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
    let non_empty = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>();
    let title_line = non_empty.first().copied().unwrap_or("未命名导入记录");
    let title = if markdown {
        title_line.trim_start_matches('#').trim()
    } else {
        title_line
    };
    let summary = non_empty
        .get(1)
        .copied()
        .unwrap_or_default()
        .trim_start_matches('#')
        .trim();
    CreateRecordInput {
        title: title.to_string(),
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
    use tempfile::tempdir;

    #[test]
    fn import_size_policy_allows_200_mb_and_rejects_larger_files() {
        assert!(validate_import_size(MAX_IMPORT_BYTES).is_ok());
        let error = validate_import_size(MAX_IMPORT_BYTES + 1)
            .expect_err("files larger than 200 MB must be rejected");
        assert!(matches!(error, AppError::Validation(message) if message.contains("200 MB")));
        assert!(LARGE_IMPORT_WARNING_BYTES < MAX_IMPORT_BYTES);
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
            &ConfirmImportInput {
                job_id: preview.job_id,
                records: preview.records,
                allow_duplicate: false,
            },
        )
        .expect("confirm");
        assert_eq!(result.status, "completed");
        assert_eq!(result.imported_records[0].title, "导入验收");
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
            &ConfirmImportInput {
                job_id: first.job_id,
                records: first.records,
                allow_duplicate: false,
            },
        )
        .expect("first import");
        let second = prepare_import(&connection, &paths, &source).expect("second preview");
        assert!(second.duplicate);
        let error = confirm_import(
            &mut connection,
            &ConfirmImportInput {
                job_id: second.job_id,
                records: second.records,
                allow_duplicate: false,
            },
        )
        .expect_err("duplicate must be blocked");
        assert!(matches!(error, AppError::Conflict(_)));
    }
}
