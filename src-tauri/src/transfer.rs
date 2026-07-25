use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use chrono::Utc;
use rusqlite::backup::Backup;
use rusqlite::Connection;
use serde::Serialize;

use crate::database;
use crate::error::{AppError, AppResult};
use crate::models::{IntelligenceRecord, RecordQuery};
use crate::paths::AppPaths;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub format: String,
    pub file_path: String,
    pub record_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResult {
    pub restored_from: String,
    pub safety_backup: String,
    pub integrity_check: String,
}

pub fn export_record(
    connection: &Connection,
    paths: &AppPaths,
    record_id: i64,
    format: &str,
) -> AppResult<ExportResult> {
    let record = database::get_record(connection, record_id)?;
    let safe_title = sanitize_file_name(&record.title);
    let timestamp = Utc::now().format("%Y%m%d-%H%M%S");
    let normalized_format = format.to_ascii_lowercase();
    let (extension, content) = match normalized_format.as_str() {
        "md" | "markdown" => ("md", record_markdown(&record)),
        "json" => ("json", serde_json::to_string_pretty(&record)?),
        _ => {
            return Err(AppError::Unsupported(
                "单条记录仅支持导出 Markdown 或 JSON".to_string(),
            ))
        }
    };
    let destination = paths
        .exports
        .join(format!("{safe_title}_{timestamp}.{extension}"));
    atomic_write(&destination, content.as_bytes())?;
    Ok(ExportResult {
        format: extension.to_string(),
        file_path: destination.to_string_lossy().into_owned(),
        record_count: 1,
    })
}

pub fn export_all_json(connection: &Connection, paths: &AppPaths) -> AppResult<ExportResult> {
    let records = database::list_records(
        connection,
        &RecordQuery {
            include_deleted: true,
            ..RecordQuery::default()
        },
    )?;
    let destination = paths.exports.join(format!(
        "南枫情报台_全部记录_{}.json",
        Utc::now().format("%Y%m%d-%H%M%S")
    ));
    atomic_write(
        &destination,
        serde_json::to_string_pretty(&records)?.as_bytes(),
    )?;
    Ok(ExportResult {
        format: "json".to_string(),
        file_path: destination.to_string_lossy().into_owned(),
        record_count: records.len(),
    })
}

pub fn create_backup(
    connection: &Connection,
    paths: &AppPaths,
    prefix: &str,
) -> AppResult<PathBuf> {
    let safe_prefix = sanitize_file_name(prefix);
    let destination = paths.backups.join(format!(
        "{}_{}.db",
        safe_prefix,
        Utc::now().format("%Y%m%d-%H%M%S-%3f")
    ));
    backup_connection(connection, &destination)?;
    validate_database_file(&destination)?;
    Ok(destination)
}

pub fn restore_backup(
    connection: &mut Connection,
    paths: &AppPaths,
    source_path: impl AsRef<Path>,
) -> AppResult<RestoreResult> {
    let source_path = source_path.as_ref();
    if !source_path.is_file() {
        return Err(AppError::NotFound("选择的备份文件不存在".to_string()));
    }
    let source_integrity = validate_database_file(source_path)?;
    let safety_backup = create_backup(connection, paths, "恢复前安全备份")?;
    let source =
        Connection::open_with_flags(source_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    {
        let backup = Backup::new(&source, connection)?;
        backup.run_to_completion(8, Duration::from_millis(20), None)?;
    }
    connection.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;",
    )?;
    let restored_integrity = database::integrity_check(connection)?;
    if restored_integrity != "ok" {
        return Err(AppError::Conflict(format!(
            "恢复后的数据库完整性检查失败：{restored_integrity}；恢复前安全备份位于 {}",
            safety_backup.to_string_lossy()
        )));
    }
    Ok(RestoreResult {
        restored_from: source_path.to_string_lossy().into_owned(),
        safety_backup: safety_backup.to_string_lossy().into_owned(),
        integrity_check: source_integrity,
    })
}

pub fn open_export_directory(paths: &AppPaths) -> AppResult<()> {
    open::that(&paths.exports)
        .map_err(|error| AppError::Io(std::io::Error::other(error.to_string())))
}

fn backup_connection(source: &Connection, destination: &Path) -> AppResult<()> {
    let mut target = Connection::open(destination)?;
    let backup = Backup::new(source, &mut target)?;
    backup.run_to_completion(8, Duration::from_millis(20), None)?;
    drop(backup);
    target.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
    Ok(())
}

fn validate_database_file(path: &Path) -> AppResult<String> {
    let connection = Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let result: String = connection.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if result != "ok" {
        return Err(AppError::Validation(format!(
            "备份数据库完整性检查失败：{result}"
        )));
    }
    let has_records: i64 = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'records')",
        [],
        |row| row.get(0),
    )?;
    if has_records == 0 {
        return Err(AppError::Validation(
            "选择的文件不是南枫情报台数据库备份".to_string(),
        ));
    }
    Ok(result)
}

fn record_markdown(record: &IntelligenceRecord) -> String {
    let mut sections = vec![
        format!("# {}", record.title),
        record.summary.clone(),
        "## 当前判断".to_string(),
        record.current_judgment.clone(),
        "## 已确认事实".to_string(),
        bullet_list(&record.confirmed_facts),
        "## 关键证据".to_string(),
        record
            .key_evidence
            .iter()
            .map(|item| {
                format!(
                    "- {}{}",
                    item.content,
                    if item.source.is_empty() {
                        String::new()
                    } else {
                        format!("（{}）", item.source)
                    }
                )
            })
            .collect::<Vec<_>>()
            .join("\n"),
        "## 待验证问题".to_string(),
        bullet_list(&record.open_questions),
        "## 下一步行动".to_string(),
        bullet_list(&record.next_actions),
        "## 备注".to_string(),
        record.notes.clone(),
    ];
    sections.retain(|section| !section.trim().is_empty());
    sections.join("\n\n")
}

fn bullet_list(items: &[String]) -> String {
    items
        .iter()
        .map(|item| format!("- {item}"))
        .collect::<Vec<_>>()
        .join("\n")
}

fn atomic_write(destination: &Path, bytes: &[u8]) -> AppResult<()> {
    let temporary = destination.with_extension(format!(
        "{}.tmp",
        destination
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("file")
    ));
    fs::write(&temporary, bytes)?;
    fs::rename(&temporary, destination)?;
    Ok(())
}

fn sanitize_file_name(name: &str) -> String {
    let cleaned = name
        .chars()
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
        .collect::<String>();
    if cleaned.trim().is_empty() {
        "未命名记录".to_string()
    } else {
        cleaned
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::CreateRecordInput;
    use tempfile::tempdir;

    #[test]
    fn export_backup_and_restore_preserve_data() {
        let directory = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        let first = database::create_record(
            &mut connection,
            &CreateRecordInput {
                title: "备份验收".to_string(),
                summary: "原始数据".to_string(),
                status: Default::default(),
                tags: Vec::new(),
                current_judgment: "第一版".to_string(),
                confirmed_facts: Vec::new(),
                key_evidence: Vec::new(),
                open_questions: Vec::new(),
                next_actions: Vec::new(),
                notes: String::new(),
                source_text: String::new(),
                sources: Vec::new(),
                is_favorite: false,
            },
        )
        .expect("create record");

        let markdown = export_record(&connection, &paths, first.id, "md").expect("export markdown");
        assert!(Path::new(&markdown.file_path).exists());
        let backup = create_backup(&connection, &paths, "手动备份").expect("backup");

        database::move_to_trash(&connection, first.id).expect("move to trash");
        let restored = restore_backup(&mut connection, &paths, &backup).expect("restore backup");
        assert_eq!(restored.integrity_check, "ok");
        assert!(
            !database::get_record(&connection, first.id)
                .expect("restored record")
                .is_deleted
        );
        assert!(Path::new(&restored.safety_backup).exists());
    }
}
