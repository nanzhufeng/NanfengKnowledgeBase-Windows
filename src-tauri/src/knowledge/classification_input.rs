use std::fs::{self, File, OpenOptions};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};

use chrono::Utc;
use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use thiserror::Error;

const INPUT_FILE_NAME: &str = "classification-input.json";
const PARTIAL_FILE_NAME: &str = "classification-input.json.partial";

#[derive(Debug, Error)]
pub enum ClassificationInputError {
    #[error("文件操作失败：{0}")]
    Io(#[from] std::io::Error),
    #[error("SQLite 操作失败：{0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("JSON 操作失败：{0}")]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    Validation(String),
}

pub type ClassificationInputResult<T> = Result<T, ClassificationInputError>;

#[derive(Debug, Clone)]
pub struct ClassificationInputArtifacts {
    pub input_file: PathBuf,
    pub record_count: usize,
    pub source_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacySourceInput {
    source_type: String,
    title: String,
    url: Option<String>,
    local_path: Option<String>,
    external_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LegacyClassificationRecord {
    record_id: i64,
    record_origin: String,
    title: String,
    legacy_title: String,
    title_resolution_status: String,
    status: String,
    summary: String,
    current_judgment: String,
    confirmed_facts: Vec<String>,
    key_evidence: Vec<String>,
    open_questions: Vec<String>,
    next_actions: Vec<String>,
    notes: String,
    source_text: String,
    tags: Vec<String>,
    sources: Vec<LegacySourceInput>,
    original_at: Option<String>,
    created_at: String,
    updated_at: String,
}

/// 从明确提供的 SQLite 副本流式导出内容分类标准输入。
///
/// 数据库连接固定为只读与 query_only；本函数只生成新的 JSON 文件，不创建知识表，
/// 不执行 migration，也不持久化分类结果。
pub fn export_legacy_classification_input(
    source_database: impl AsRef<Path>,
    output_directory: impl AsRef<Path>,
) -> ClassificationInputResult<ClassificationInputArtifacts> {
    let source_database = source_database.as_ref();
    let output_directory = output_directory.as_ref();
    if !source_database.is_absolute() || !output_directory.is_absolute() {
        return Err(ClassificationInputError::Validation(
            "隔离副本和输出目录都必须使用绝对路径".to_string(),
        ));
    }
    if !source_database.is_file() {
        return Err(ClassificationInputError::Validation(format!(
            "隔离副本不存在：{}",
            source_database.display()
        )));
    }

    fs::create_dir_all(output_directory)?;
    let input_file = output_directory.join(INPUT_FILE_NAME);
    let partial_file = output_directory.join(PARTIAL_FILE_NAME);
    for target in [&input_file, &partial_file] {
        if target.exists() {
            return Err(ClassificationInputError::Validation(format!(
                "为避免覆盖既有分类审计产物，目标文件已存在：{}",
                target.display()
            )));
        }
    }

    let result = export_inner(source_database, &partial_file);
    let (record_count, source_sha256) = match result {
        Ok(value) => value,
        Err(error) => {
            let _ = fs::remove_file(&partial_file);
            return Err(error);
        }
    };
    fs::rename(&partial_file, &input_file)?;

    Ok(ClassificationInputArtifacts {
        input_file,
        record_count,
        source_sha256,
    })
}

fn export_inner(
    source_database: &Path,
    partial_file: &Path,
) -> ClassificationInputResult<(usize, String)> {
    let source_sha256_before = sha256_file(source_database)?;
    let connection = Connection::open_with_flags(
        source_database,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    connection.execute_batch("PRAGMA query_only = ON;")?;
    let query_only =
        connection.query_row("PRAGMA query_only", [], |row| row.get::<_, i64>(0))? == 1;
    if !query_only {
        return Err(ClassificationInputError::Validation(
            "隔离副本连接未进入 query_only，已停止导出".to_string(),
        ));
    }
    let integrity_check =
        connection.query_row("PRAGMA integrity_check", [], |row| row.get::<_, String>(0))?;
    if integrity_check != "ok" {
        return Err(ClassificationInputError::Validation(format!(
            "隔离副本完整性检查失败：{integrity_check}"
        )));
    }
    let total_changes_before = connection.total_changes();
    let record_count = connection.query_row(
        "SELECT COUNT(*) FROM records WHERE is_deleted = 0",
        [],
        |row| row.get::<_, i64>(0),
    )? as usize;

    let output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(partial_file)?;
    let mut writer = BufWriter::new(output);
    write!(
        writer,
        "{{\"reportVersion\":1,\"generatedAt\":{},\"sourceDatabase\":{},\
         \"sourceDatabaseSha256Before\":{},\"sourceConnectionQueryOnly\":true,\
         \"sourceIntegrityCheck\":\"ok\",\"sourceTotalChangesBefore\":{},\
         \"recordCount\":{},\"records\":[",
        serde_json::to_string(&Utc::now().to_rfc3339())?,
        serde_json::to_string(&source_database.to_string_lossy())?,
        serde_json::to_string(&source_sha256_before)?,
        total_changes_before,
        record_count
    )?;

    let mut statement = connection.prepare(
        "
        SELECT
          r.id,
          r.title,
          COALESCE((
            SELECT s.title FROM sources s
            WHERE s.record_id = r.id ORDER BY s.id LIMIT 1
          ), '') AS source_title,
          r.status,
          r.summary,
          r.current_judgment,
          r.confirmed_facts_json,
          r.key_evidence_json,
          r.open_questions_json,
          r.next_actions_json,
          r.notes,
          r.source_text,
          COALESCE((
            SELECT json_group_array(tag_rows.name)
            FROM (
              SELECT t.name
              FROM record_tags rt
              JOIN tags t ON t.id = rt.tag_id
              WHERE rt.record_id = r.id
              ORDER BY t.name
            ) AS tag_rows
          ), '[]') AS tags_json,
          COALESCE((
            SELECT json_group_array(json_object(
              'sourceType', source_rows.source_type,
              'title', source_rows.title,
              'url', source_rows.url,
              'localPath', source_rows.local_path,
              'externalId', source_rows.external_id
            ))
            FROM (
              SELECT source_type, title, url, local_path, external_id
              FROM sources
              WHERE record_id = r.id
              ORDER BY id
            ) AS source_rows
          ), '[]') AS sources_json,
          r.original_at,
          r.created_at,
          r.updated_at
        FROM records r
        WHERE r.is_deleted = 0
        ORDER BY r.id
        ",
    )?;
    let mut rows = statement.query([])?;
    let mut written = 0_usize;
    while let Some(row) = rows.next()? {
        let legacy_title = row.get::<_, String>(1)?;
        let source_title = row.get::<_, String>(2)?;
        let source_text = row.get::<_, String>(11)?;
        let title =
            crate::database::resolve_summary_title(&legacy_title, &source_text, &source_title);
        let title_resolution_status = if title != legacy_title {
            "recovered"
        } else if crate::database::is_generic_record_title(&legacy_title) {
            "unresolved_generic"
        } else {
            "unchanged"
        };
        let record = LegacyClassificationRecord {
            record_id: row.get(0)?,
            record_origin: "legacy_database".to_string(),
            title,
            legacy_title,
            title_resolution_status: title_resolution_status.to_string(),
            status: row.get(3)?,
            summary: row.get(4)?,
            current_judgment: row.get(5)?,
            confirmed_facts: parse_structured_text(&row.get::<_, String>(6)?),
            key_evidence: parse_structured_text(&row.get::<_, String>(7)?),
            open_questions: parse_structured_text(&row.get::<_, String>(8)?),
            next_actions: parse_structured_text(&row.get::<_, String>(9)?),
            notes: row.get(10)?,
            source_text,
            tags: serde_json::from_str(&row.get::<_, String>(12)?).unwrap_or_default(),
            sources: serde_json::from_str(&row.get::<_, String>(13)?).unwrap_or_default(),
            original_at: row.get(14)?,
            created_at: row.get(15)?,
            updated_at: row.get(16)?,
        };
        if written > 0 {
            writer.write_all(b",")?;
        }
        serde_json::to_writer(&mut writer, &record)?;
        written += 1;
    }
    drop(rows);
    drop(statement);

    let total_changes_after = connection.total_changes();
    if total_changes_after != total_changes_before {
        return Err(ClassificationInputError::Validation(
            "分类输入导出对隔离副本产生了写入，已停止".to_string(),
        ));
    }
    drop(connection);
    let source_sha256_after = sha256_file(source_database)?;
    if source_sha256_after != source_sha256_before {
        return Err(ClassificationInputError::Validation(
            "隔离副本哈希在只读导出期间发生变化，已停止".to_string(),
        ));
    }
    if written != record_count {
        return Err(ClassificationInputError::Validation(format!(
            "分类输入数量不一致：预期 {record_count}，实际 {written}"
        )));
    }

    write!(
        writer,
        "],\"sourceTotalChangesAfter\":{},\"sourceDatabaseSha256After\":{}}}",
        total_changes_after,
        serde_json::to_string(&source_sha256_after)?
    )?;
    writer.flush()?;
    writer.get_ref().sync_all()?;
    Ok((record_count, source_sha256_after))
}

fn parse_structured_text(value: &str) -> Vec<String> {
    let Ok(parsed) = serde_json::from_str::<Value>(value) else {
        return (!value.trim().is_empty())
            .then(|| value.trim().to_string())
            .into_iter()
            .collect();
    };
    match parsed {
        Value::Array(items) => items
            .into_iter()
            .filter_map(structured_item_text)
            .filter(|item| !item.trim().is_empty())
            .collect(),
        other => structured_item_text(other).into_iter().collect(),
    }
}

fn structured_item_text(value: Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::String(text) => Some(text),
        Value::Object(object) => {
            let content = object
                .get("content")
                .or_else(|| object.get("title"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            let source = object
                .get("source")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let combined = [content, source]
                .into_iter()
                .filter(|item| !item.trim().is_empty())
                .collect::<Vec<_>>()
                .join("｜");
            (!combined.is_empty()).then_some(combined)
        }
        other => Some(other.to_string()),
    }
}

fn sha256_file(path: &Path) -> ClassificationInputResult<String> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; 256 * 1024];
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode_upper(hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    #[test]
    fn export_is_read_only_streamed_and_refuses_overwrite() {
        let directory = tempfile::tempdir().expect("临时目录");
        let database = directory.path().join("copy.db");
        let connection = crate::database::open_database(&database).expect("旧库");
        connection
            .execute(
                "INSERT INTO records(
                   title, summary, status, current_judgment, confirmed_facts_json,
                   key_evidence_json, open_questions_json, next_actions_json, notes,
                   source_text, created_at, updated_at
                 ) VALUES (
                   'Untitled', '摘要', 'normal', '判断', '[\"事实\"]',
                   '[{\"content\":\"证据\",\"source\":\"来源\"}]', '[\"问题\"]',
                   '[\"行动\"]', '备注',
                   '{\"chat_messages\":[{\"sender\":\"human\",\"text\":\"AI 资本开支是否见顶？\"}]}',
                   '2026-07-27', '2026-07-27'
                 )",
                [],
            )
            .expect("记录");
        connection
            .execute(
                "INSERT INTO sources(record_id, source_type, title, local_path, created_at)
                 VALUES (?1, 'import', 'conversations.json', 'imports/raw/conversations.json', '2026-07-27')",
                params![1],
            )
            .expect("来源");
        drop(connection);

        let source_hash_before = sha256_file(&database).expect("源哈希");
        let output = directory.path().join("output");
        let artifacts = export_legacy_classification_input(&database, &output).expect("分类输入");
        let source_hash_after = sha256_file(&database).expect("源哈希");

        assert_eq!(source_hash_before, source_hash_after);
        assert_eq!(artifacts.record_count, 1);
        assert_eq!(artifacts.source_sha256, source_hash_after);
        let json: Value =
            serde_json::from_slice(&fs::read(&artifacts.input_file).expect("输入文件"))
                .expect("输入 JSON");
        assert_eq!(json["recordCount"], 1);
        assert_eq!(json["sourceTotalChangesBefore"], 0);
        assert_eq!(json["sourceTotalChangesAfter"], 0);
        assert_eq!(json["records"][0]["title"], "AI 资本开支是否见顶？");
        assert_eq!(json["records"][0]["keyEvidence"][0], "证据｜来源");

        let duplicate = export_legacy_classification_input(&database, &output);
        assert!(matches!(
            duplicate,
            Err(ClassificationInputError::Validation(_))
        ));
    }
}
