use std::collections::BTreeMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use chrono::Utc;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::database;
use crate::error::{AppError, AppResult};
use crate::models::{IntelligenceRecord, RecordQuery};
use crate::paths::AppPaths;

const PORTABLE_BACKUP_FORMAT: &str = "nanfeng-knowledge-base-portable-backup";
const LEGACY_PORTABLE_BACKUP_FORMAT: &str = "nanfeng-intelligence-portable-backup";
const PORTABLE_BACKUP_FORMAT_VERSION: i64 = 2;
const HASH_BUFFER_BYTES: usize = 256 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum PortableRestoreFault {
    AfterImports,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct PortableFileManifestEntry {
    path: String,
    size_bytes: u64,
    sha256: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub format: String,
    pub file_path: String,
    pub record_count: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRecordsInput {
    #[serde(default)]
    pub record_ids: Vec<i64>,
    #[serde(default)]
    pub query: RecordQuery,
    #[serde(default = "default_export_format")]
    pub format: String,
    #[serde(default)]
    pub include_attachments: bool,
    #[serde(default)]
    pub include_versions: bool,
    #[serde(default)]
    pub include_original_files: bool,
}

fn default_export_format() -> String {
    "json".to_string()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResult {
    pub restored_from: String,
    pub safety_backup: String,
    pub integrity_check: String,
    pub log_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupPreview {
    pub file_path: String,
    pub file_size_bytes: u64,
    pub modified_at: String,
    pub integrity_check: String,
    pub record_count: i64,
    pub deleted_count: i64,
    pub version_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableBackupResult {
    pub folder_path: String,
    pub created_at: String,
    pub record_count: i64,
    pub file_count: u64,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableBackupPreview {
    pub folder_path: String,
    pub created_at: String,
    pub app_version: String,
    pub integrity_check: String,
    pub record_count: i64,
    pub deleted_count: i64,
    pub version_count: i64,
    pub preference_count: usize,
    pub file_count: u64,
    pub total_bytes: u64,
    pub content_integrity: String,
    pub restorable: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableRestoreResult {
    pub restored_from: String,
    pub safety_backup: String,
    pub integrity_check: String,
    pub preferences_json: String,
    pub log_path: String,
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

pub fn write_docx_export(
    paths: &AppPaths,
    file_name: &str,
    bytes: &[u8],
) -> AppResult<ExportResult> {
    const MAX_DOCX_BYTES: usize = 50 * 1024 * 1024;
    if bytes.is_empty() || bytes.len() > MAX_DOCX_BYTES {
        return Err(AppError::Validation(
            "DOCX 文件为空或超过 50 MB，已停止写入".to_string(),
        ));
    }
    if !bytes.starts_with(b"PK") {
        return Err(AppError::Validation(
            "生成结果不是有效的 DOCX 压缩文档".to_string(),
        ));
    }
    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("南枫知识库_完整笔记");
    let destination = paths.exports.join(format!(
        "{}_{}.docx",
        sanitize_file_name(stem),
        Utc::now().format("%Y%m%d-%H%M%S")
    ));
    atomic_write(&destination, bytes)?;
    Ok(ExportResult {
        format: "docx".to_string(),
        file_path: destination.to_string_lossy().into_owned(),
        record_count: 1,
    })
}

pub fn write_markdown_export(
    paths: &AppPaths,
    file_name: &str,
    content: &str,
) -> AppResult<ExportResult> {
    const MAX_MARKDOWN_BYTES: usize = 20 * 1024 * 1024;
    if content.trim().is_empty() || content.len() > MAX_MARKDOWN_BYTES {
        return Err(AppError::Validation(
            "Markdown 内容为空或超过 20 MB，已停止写入".to_string(),
        ));
    }
    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("南枫知识库_完整笔记");
    let destination = paths.exports.join(format!(
        "{}_{}.md",
        sanitize_file_name(stem),
        Utc::now().format("%Y%m%d-%H%M%S")
    ));
    atomic_write(&destination, content.as_bytes())?;
    Ok(ExportResult {
        format: "md".to_string(),
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
        "南枫知识库_全部记录_{}.json",
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

pub fn export_records(
    connection: &Connection,
    paths: &AppPaths,
    input: &ExportRecordsInput,
) -> AppResult<ExportResult> {
    let records = if input.record_ids.is_empty() {
        database::list_records(connection, &input.query)?
    } else {
        let mut records = Vec::with_capacity(input.record_ids.len());
        for record_id in &input.record_ids {
            records.push(database::get_record(connection, *record_id)?);
        }
        records
    };
    if records.is_empty() {
        return Err(AppError::Validation(
            "当前条件下没有可导出的记录".to_string(),
        ));
    }
    let timestamp = Utc::now().format("%Y%m%d-%H%M%S").to_string();
    let format = input.format.to_ascii_lowercase();
    if format == "json" {
        let destination = paths
            .exports
            .join(format!("南枫知识库_筛选记录_{timestamp}.json"));
        atomic_write(
            &destination,
            serde_json::to_string_pretty(&records)?.as_bytes(),
        )?;
        return Ok(ExportResult {
            format,
            file_path: destination.to_string_lossy().into_owned(),
            record_count: records.len(),
        });
    }

    if !matches!(format.as_str(), "md" | "markdown" | "vault") {
        return Err(AppError::Unsupported(
            "批量导出支持 JSON、Markdown 或 Obsidian Vault".to_string(),
        ));
    }
    let is_vault = format == "vault";
    let export_root = paths.exports.join(if is_vault {
        format!("南枫知识库_Vault_{timestamp}")
    } else {
        format!("南枫知识库_Markdown_{timestamp}")
    });
    let records_dir = if is_vault {
        export_root.join("records")
    } else {
        export_root.clone()
    };
    fs::create_dir_all(&records_dir)?;
    if is_vault {
        fs::create_dir_all(export_root.join(".obsidian"))?;
        atomic_write(
            &export_root.join(".obsidian").join("app.json"),
            br#"{"showInlineTitle":true,"alwaysUpdateLinks":true}"#,
        )?;
        atomic_write(
            &export_root.join("README.md"),
            "# 南枫知识库 Codex / Obsidian 工作区\n\n\
             - `records/`：一条记录一个 Markdown，带稳定 ID 与 YAML 元数据。\n\
             - `attachments/`：选择包含附件时复制到这里，笔记使用相对链接。\n\
             - 建议让 Codex 在副本或 Git 分支中整理，再通过南枫知识库导入为新版本。\n\
             - SQLite 仍是应用内检索与状态数据的唯一写入入口。\n"
                .as_bytes(),
        )?;
    }

    for record in &records {
        let file_name = format!("{:06}-{}.md", record.id, sanitize_file_name(&record.title));
        let mut note = record_markdown_with_frontmatter(record);
        if input.include_attachments {
            note.push_str(&attachment_markdown_links(connection, record.id)?);
        }
        atomic_write(&records_dir.join(file_name), note.as_bytes())?;
        if input.include_attachments {
            export_record_attachments(connection, &export_root, record.id)?;
        }
        if input.include_versions {
            let versions_dir = export_root
                .join("versions")
                .join(format!("{:06}", record.id));
            fs::create_dir_all(&versions_dir)?;
            for version in database::list_versions(connection, record.id)? {
                atomic_write(
                    &versions_dir.join(format!("v{:03}.md", version.version_number)),
                    record_markdown_with_frontmatter(&version.snapshot).as_bytes(),
                )?;
            }
        }
        if input.include_original_files {
            export_original_sources(&export_root, record)?;
        }
    }

    Ok(ExportResult {
        format: if is_vault { "vault" } else { "md" }.to_string(),
        file_path: export_root.to_string_lossy().into_owned(),
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

pub fn create_portable_backup(
    connection: &Connection,
    paths: &AppPaths,
    preferences_json: &str,
    prefix: &str,
) -> AppResult<PortableBackupResult> {
    const MAX_PREFERENCES_BYTES: usize = 2 * 1024 * 1024;
    if preferences_json.len() > MAX_PREFERENCES_BYTES {
        return Err(AppError::Validation(
            "界面设置数据超过 2 MB，已停止创建迁移备份".to_string(),
        ));
    }
    let preferences = serde_json::from_str::<serde_json::Value>(preferences_json)?;
    let preference_count = preferences
        .as_object()
        .ok_or_else(|| AppError::Validation("界面设置必须是 JSON 对象".to_string()))?
        .len();
    let created_at = Utc::now().to_rfc3339();
    let timestamp = Utc::now().format("%Y%m%d-%H%M%S-%3f");
    let folder_name = format!("{}_{}", sanitize_file_name(prefix), timestamp);
    let destination = paths.backups.join(&folder_name);
    let database_bytes = paths
        .database
        .metadata()
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    let (_, imports_bytes) = directory_inventory(&paths.imports_raw)?;
    let (_, attachment_bytes) = directory_inventory(&paths.attachments)?;
    let estimated_bytes = database_bytes
        .saturating_add(imports_bytes)
        .saturating_add(attachment_bytes)
        .saturating_add(preferences_json.len() as u64);
    let required_bytes = estimated_bytes.saturating_add(estimated_bytes / 10);
    let available_bytes = fs2::available_space(&paths.backups)?;
    if available_bytes < required_bytes {
        return Err(AppError::Validation(format!(
            "备份空间不足：预计至少需要 {:.2} GB，当前可用 {:.2} GB",
            required_bytes as f64 / 1_073_741_824_f64,
            available_bytes as f64 / 1_073_741_824_f64,
        )));
    }
    if destination.exists() {
        return Err(AppError::Conflict(format!(
            "完整迁移备份目标已存在：{}",
            destination.display()
        )));
    }
    fs::create_dir_all(destination.join("data"))?;
    let building_marker = destination.join(".building");
    fs::write(&building_marker, b"portable-backup-building-v1")?;
    let build_result = (|| -> AppResult<()> {
        let database_path = destination.join("data").join("app.db");
        backup_connection(connection, &database_path)?;
        validate_database_file(&database_path)?;
        copy_directory_contents(&paths.imports_raw, &destination.join("imports").join("raw"))?;
        copy_directory_contents(&paths.attachments, &destination.join("attachments"))?;
        atomic_write(
            &destination.join("preferences.json"),
            serde_json::to_string_pretty(&preferences)?.as_bytes(),
        )?;
        let record_count = connection.query_row("SELECT COUNT(*) FROM records", [], |row| {
            row.get::<_, i64>(0)
        })?;
        let files = portable_file_manifest(&destination)?;
        let manifest = serde_json::json!({
            "format": PORTABLE_BACKUP_FORMAT,
            "formatVersion": PORTABLE_BACKUP_FORMAT_VERSION,
            "appVersion": env!("CARGO_PKG_VERSION"),
            "createdAt": created_at,
            "database": "data/app.db",
            "imports": "imports/raw",
            "attachments": "attachments",
            "preferences": "preferences.json",
            "preferenceCount": preference_count,
            "recordCount": record_count,
            "files": files,
        });
        atomic_write(
            &destination.join("manifest.json"),
            serde_json::to_string_pretty(&manifest)?.as_bytes(),
        )?;
        Ok(())
    })();
    if let Err(error) = build_result {
        let _ = fs::remove_dir_all(&destination);
        return Err(error);
    }
    fs::remove_file(building_marker)?;
    let (file_count, total_bytes) = directory_inventory(&destination)?;
    let record_count = connection.query_row("SELECT COUNT(*) FROM records", [], |row| {
        row.get::<_, i64>(0)
    })?;
    Ok(PortableBackupResult {
        folder_path: destination.to_string_lossy().into_owned(),
        created_at,
        record_count,
        file_count,
        total_bytes,
    })
}

pub fn inspect_portable_backup(source_path: impl AsRef<Path>) -> AppResult<PortableBackupPreview> {
    let source_path = source_path.as_ref();
    if !source_path.is_dir() {
        return Err(AppError::NotFound(
            "选择的完整迁移备份文件夹不存在".to_string(),
        ));
    }
    if source_path.join(".building").exists() {
        return Err(AppError::Validation(
            "完整迁移备份仍在创建中或上次创建未完成".to_string(),
        ));
    }
    let manifest_path = source_path.join("manifest.json");
    let manifest = serde_json::from_slice::<serde_json::Value>(&fs::read(&manifest_path)?)?;
    let format = manifest.get("format").and_then(serde_json::Value::as_str);
    let format_version = manifest
        .get("formatVersion")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or_default();
    if !matches!(
        format,
        Some(PORTABLE_BACKUP_FORMAT) | Some(LEGACY_PORTABLE_BACKUP_FORMAT)
    ) || !matches!(format_version, 1 | PORTABLE_BACKUP_FORMAT_VERSION)
    {
        return Err(AppError::Validation(
            "所选文件夹不是受支持的南枫知识库完整迁移备份".to_string(),
        ));
    }
    let (content_integrity, restorable) = if format_version == PORTABLE_BACKUP_FORMAT_VERSION {
        let expected = serde_json::from_value::<Vec<PortableFileManifestEntry>>(
            manifest
                .get("files")
                .cloned()
                .ok_or_else(|| AppError::Validation("迁移备份缺少逐文件校验清单".to_string()))?,
        )?;
        verify_portable_file_manifest(source_path, &expected)?;
        ("verified_sha256".to_string(), true)
    } else {
        ("legacy_database_only".to_string(), false)
    };
    let database_path = source_path.join("data").join("app.db");
    let integrity_check = validate_database_file(&database_path)?;
    let connection =
        Connection::open_with_flags(&database_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let record_count =
        connection.query_row("SELECT COUNT(*) FROM records", [], |row| row.get(0))?;
    let deleted_count = connection.query_row(
        "SELECT COUNT(*) FROM records WHERE is_deleted = 1",
        [],
        |row| row.get(0),
    )?;
    let version_count =
        connection.query_row("SELECT COUNT(*) FROM record_versions", [], |row| row.get(0))?;
    let preferences = serde_json::from_slice::<serde_json::Value>(&fs::read(
        source_path.join("preferences.json"),
    )?)?;
    let preference_count = preferences
        .as_object()
        .ok_or_else(|| AppError::Validation("迁移备份中的界面设置不是 JSON 对象".to_string()))?
        .len();
    let (file_count, total_bytes) = directory_inventory(source_path)?;
    Ok(PortableBackupPreview {
        folder_path: source_path.to_string_lossy().into_owned(),
        created_at: manifest
            .get("createdAt")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .to_string(),
        app_version: manifest
            .get("appVersion")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("未知")
            .to_string(),
        integrity_check,
        record_count,
        deleted_count,
        version_count,
        preference_count,
        file_count,
        total_bytes,
        content_integrity,
        restorable,
    })
}

pub fn restore_portable_backup(
    connection: &mut Connection,
    paths: &AppPaths,
    source_path: impl AsRef<Path>,
    current_preferences_json: &str,
) -> AppResult<PortableRestoreResult> {
    restore_portable_backup_inner(
        connection,
        paths,
        source_path.as_ref(),
        current_preferences_json,
        None,
    )
}

pub(crate) fn restore_portable_backup_with_fault_injection(
    connection: &mut Connection,
    paths: &AppPaths,
    source_path: impl AsRef<Path>,
    current_preferences_json: &str,
    fault: PortableRestoreFault,
) -> AppResult<PortableRestoreResult> {
    restore_portable_backup_inner(
        connection,
        paths,
        source_path.as_ref(),
        current_preferences_json,
        Some(fault),
    )
}

fn restore_portable_backup_inner(
    connection: &mut Connection,
    paths: &AppPaths,
    source_path: &Path,
    current_preferences_json: &str,
    fault: Option<PortableRestoreFault>,
) -> AppResult<PortableRestoreResult> {
    let preview = inspect_portable_backup(source_path)?;
    if !preview.restorable {
        return Err(AppError::Validation(
            "这是旧版完整迁移备份，只能验证数据库，无法证明附件和导入原件未被篡改；请先在原设备重新创建新版完整备份"
                .to_string(),
        ));
    }
    let safety_backup = create_portable_backup(
        connection,
        paths,
        current_preferences_json,
        "恢复前完整安全备份",
    )?;
    let apply_result = apply_portable_backup(connection, paths, source_path, fault);
    if let Err(error) = apply_result {
        let rollback = apply_portable_backup(
            connection,
            paths,
            Path::new(&safety_backup.folder_path),
            None,
        );
        return match rollback {
            Ok(_) => Err(error),
            Err(rollback_error) => Err(AppError::Conflict(format!(
                "完整恢复失败，自动回滚也失败：{error}；回滚错误：{rollback_error}"
            ))),
        };
    }
    let restored_integrity = database::integrity_check(connection)?;
    if restored_integrity != "ok" {
        let _ = apply_portable_backup(
            connection,
            paths,
            Path::new(&safety_backup.folder_path),
            None,
        );
        return Err(AppError::Conflict(format!(
            "完整恢复后的数据库检查失败：{restored_integrity}；已尝试回滚"
        )));
    }
    let preferences_json = fs::read_to_string(source_path.join("preferences.json"))?;
    let log_path = paths.logs.join(format!(
        "portable-restore-{}.json",
        Utc::now().format("%Y%m%d-%H%M%S-%3f")
    ));
    atomic_write(
        &log_path,
        serde_json::to_string_pretty(&serde_json::json!({
            "completedAt": Utc::now().to_rfc3339(),
            "restoredFrom": source_path.to_string_lossy(),
            "safetyBackup": safety_backup.folder_path,
            "sourcePreview": preview,
            "restoredIntegrity": restored_integrity,
        }))?
        .as_bytes(),
    )?;
    Ok(PortableRestoreResult {
        restored_from: source_path.to_string_lossy().into_owned(),
        safety_backup: safety_backup.folder_path,
        integrity_check: restored_integrity,
        preferences_json,
        log_path: log_path.to_string_lossy().into_owned(),
    })
}

fn apply_portable_backup(
    connection: &mut Connection,
    paths: &AppPaths,
    source_path: &Path,
    fault: Option<PortableRestoreFault>,
) -> AppResult<()> {
    inspect_portable_backup(source_path)?;
    restore_connection_from_path(connection, &source_path.join("data").join("app.db"))?;
    database::apply_migrations(connection)?;
    connection.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;",
    )?;
    replace_directory_contents(&source_path.join("imports").join("raw"), &paths.imports_raw)?;
    if fault == Some(PortableRestoreFault::AfterImports) {
        return Err(AppError::Conflict(
            "隔离恢复演练注入故障：数据库与导入原件替换后停止".to_string(),
        ));
    }
    replace_directory_contents(&source_path.join("attachments"), &paths.attachments)?;
    Ok(())
}

fn replace_directory_contents(source: &Path, destination: &Path) -> AppResult<()> {
    let parent = destination
        .parent()
        .ok_or_else(|| AppError::Validation("受控目录缺少父目录".to_string()))?;
    let nonce = uuid::Uuid::new_v4();
    let stage = parent.join(format!(".restore-stage-{nonce}"));
    let previous = parent.join(format!(".restore-previous-{nonce}"));
    copy_directory_contents(source, &stage)?;
    if destination.exists() {
        fs::rename(destination, &previous)?;
    }
    if let Err(error) = fs::rename(&stage, destination) {
        if previous.exists() {
            let _ = fs::rename(&previous, destination);
        }
        let _ = fs::remove_dir_all(&stage);
        return Err(error.into());
    }
    if previous.exists() {
        fs::remove_dir_all(previous)?;
    }
    Ok(())
}

fn copy_directory_contents(source: &Path, destination: &Path) -> AppResult<()> {
    fs::create_dir_all(destination)?;
    if !source.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if file_type.is_symlink() {
            continue;
        }
        let destination_path = destination.join(entry.file_name());
        if file_type.is_dir() {
            copy_directory_contents(&entry.path(), &destination_path)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), destination_path)?;
        }
    }
    Ok(())
}

fn directory_inventory(path: &Path) -> AppResult<(u64, u64)> {
    if !path.is_dir() {
        return Ok((0, 0));
    }
    let mut file_count = 0_u64;
    let mut total_bytes = 0_u64;
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            let (nested_count, nested_bytes) = directory_inventory(&entry.path())?;
            file_count = file_count.saturating_add(nested_count);
            total_bytes = total_bytes.saturating_add(nested_bytes);
        } else if file_type.is_file() {
            file_count = file_count.saturating_add(1);
            total_bytes = total_bytes.saturating_add(entry.metadata()?.len());
        }
    }
    Ok((file_count, total_bytes))
}

fn portable_file_manifest(root: &Path) -> AppResult<Vec<PortableFileManifestEntry>> {
    let mut files = Vec::new();
    collect_portable_files(root, root, &mut files)?;
    files.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(files)
}

fn collect_portable_files(
    root: &Path,
    current: &Path,
    output: &mut Vec<PortableFileManifestEntry>,
) -> AppResult<()> {
    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if file_type.is_symlink() {
            return Err(AppError::Validation(
                "完整迁移备份中不允许符号链接".to_string(),
            ));
        }
        let path = entry.path();
        if file_type.is_dir() {
            collect_portable_files(root, &path, output)?;
            continue;
        }
        if !file_type.is_file()
            || matches!(
                path.file_name().and_then(|name| name.to_str()),
                Some("manifest.json" | ".building")
            )
        {
            continue;
        }
        let relative = path
            .strip_prefix(root)
            .map_err(|_| AppError::Validation("备份文件路径越过根目录".to_string()))?;
        let relative = relative.to_string_lossy().replace('\\', "/");
        output.push(PortableFileManifestEntry {
            path: relative,
            size_bytes: entry.metadata()?.len(),
            sha256: sha256_file(&path)?,
        });
    }
    Ok(())
}

fn verify_portable_file_manifest(
    root: &Path,
    expected: &[PortableFileManifestEntry],
) -> AppResult<()> {
    let actual = portable_file_manifest(root)?;
    let to_map =
        |items: &[PortableFileManifestEntry]| -> AppResult<BTreeMap<String, (u64, String)>> {
            let mut result = BTreeMap::new();
            for item in items {
                if item.path.is_empty()
                    || item.path.starts_with('/')
                    || item.path.contains("../")
                    || item.path.contains("..\\")
                {
                    return Err(AppError::Validation(
                        "迁移备份校验清单包含危险路径".to_string(),
                    ));
                }
                if result
                    .insert(item.path.clone(), (item.size_bytes, item.sha256.clone()))
                    .is_some()
                {
                    return Err(AppError::Validation(
                        "迁移备份校验清单包含重复文件".to_string(),
                    ));
                }
            }
            Ok(result)
        };
    let expected = to_map(expected)?;
    let actual = to_map(&actual)?;
    if expected != actual {
        return Err(AppError::Validation(
            "完整迁移备份的附件、导入原件或设置文件校验失败，已停止恢复".to_string(),
        ));
    }
    Ok(())
}

fn sha256_file(path: &Path) -> AppResult<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; HASH_BUFFER_BYTES];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
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
    let preview = inspect_backup(source_path)?;
    let safety_backup = create_backup(connection, paths, "恢复前安全备份")?;
    restore_connection_from_path(connection, source_path)?;
    database::apply_migrations(connection)?;
    connection.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;",
    )?;
    let restored_integrity = database::integrity_check(connection)?;
    if restored_integrity != "ok" {
        let rollback_result = restore_connection_from_path(connection, &safety_backup)
            .and_then(|_| database::integrity_check(connection));
        let rollback_note = match rollback_result {
            Ok(result) => format!("已自动回滚恢复前数据库，完整性：{result}"),
            Err(error) => format!("自动回滚失败：{error}"),
        };
        return Err(AppError::Conflict(format!(
            "恢复后的数据库完整性检查失败：{restored_integrity}；{rollback_note}；恢复前安全备份位于 {}",
            safety_backup.to_string_lossy(),
        )));
    }
    let completed_at = Utc::now().to_rfc3339();
    let log_path = paths.logs.join(format!(
        "restore-{}.json",
        Utc::now().format("%Y%m%d-%H%M%S-%3f")
    ));
    let log = serde_json::json!({
        "completedAt": completed_at,
        "restoredFrom": source_path.to_string_lossy(),
        "safetyBackup": safety_backup.to_string_lossy(),
        "sourcePreview": preview,
        "restoredIntegrity": restored_integrity,
    });
    atomic_write(&log_path, serde_json::to_string_pretty(&log)?.as_bytes())?;
    Ok(RestoreResult {
        restored_from: source_path.to_string_lossy().into_owned(),
        safety_backup: safety_backup.to_string_lossy().into_owned(),
        integrity_check: preview.integrity_check,
        log_path: log_path.to_string_lossy().into_owned(),
    })
}

pub fn inspect_backup(source_path: impl AsRef<Path>) -> AppResult<BackupPreview> {
    let source_path = source_path.as_ref();
    if !source_path.is_file() {
        return Err(AppError::NotFound("选择的备份文件不存在".to_string()));
    }
    let metadata = source_path.metadata()?;
    let integrity_check = validate_database_file(source_path)?;
    let connection =
        Connection::open_with_flags(source_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let record_count =
        connection.query_row("SELECT COUNT(*) FROM records", [], |row| row.get(0))?;
    let deleted_count = connection.query_row(
        "SELECT COUNT(*) FROM records WHERE is_deleted = 1",
        [],
        |row| row.get(0),
    )?;
    let version_count =
        connection.query_row("SELECT COUNT(*) FROM record_versions", [], |row| row.get(0))?;
    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| {
            chrono::DateTime::<Utc>::from(std::time::UNIX_EPOCH + duration).to_rfc3339()
        })
        .unwrap_or_default();
    Ok(BackupPreview {
        file_path: source_path.to_string_lossy().into_owned(),
        file_size_bytes: metadata.len(),
        modified_at,
        integrity_check,
        record_count,
        deleted_count,
        version_count,
    })
}

pub fn open_export_directory(paths: &AppPaths) -> AppResult<()> {
    open::that(&paths.exports)
        .map_err(|error| AppError::Io(std::io::Error::other(error.to_string())))
}

fn backup_connection(source: &Connection, destination: &Path) -> AppResult<()> {
    let mut target = Connection::open(destination)?;
    database::copy_database(source, &mut target)?;
    target.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
    Ok(())
}

fn restore_connection_from_path(target: &mut Connection, source_path: &Path) -> AppResult<()> {
    let source =
        Connection::open_with_flags(source_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    database::copy_database(&source, target)?;
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
            "选择的文件不是南枫知识库数据库备份".to_string(),
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

fn record_markdown_with_frontmatter(record: &IntelligenceRecord) -> String {
    let tags = serde_json::to_string(&record.tags).unwrap_or_else(|_| "[]".to_string());
    let original_at = record.original_at.as_deref().unwrap_or("");
    let sources = record
        .sources
        .iter()
        .map(|source| {
            source
                .url
                .as_deref()
                .or(source.local_path.as_deref())
                .unwrap_or(&source.title)
        })
        .collect::<Vec<_>>();
    format!(
        "---\nid: {}\nstatus: {}\ntags: {}\noriginal_at: {:?}\nupdated_at: {:?}\nsources: {}\n---\n\n{}",
        record.id,
        record.status.as_str(),
        tags,
        original_at,
        record.updated_at,
        serde_json::to_string(&sources).unwrap_or_else(|_| "[]".to_string()),
        record_markdown(record)
    )
}

fn export_record_attachments(
    connection: &Connection,
    export_root: &Path,
    record_id: i64,
) -> AppResult<()> {
    let mut statement = connection.prepare(
        "SELECT file_name, stored_path FROM attachments WHERE record_id = ?1 ORDER BY id",
    )?;
    let rows = statement
        .query_map([record_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    if rows.is_empty() {
        return Ok(());
    }
    let target = export_root
        .join("attachments")
        .join(format!("{record_id:06}"));
    fs::create_dir_all(&target)?;
    for (file_name, stored_path) in rows {
        let source = PathBuf::from(stored_path);
        if source.is_file() {
            fs::copy(source, target.join(sanitize_file_name(&file_name)))?;
        }
    }
    Ok(())
}

fn attachment_markdown_links(connection: &Connection, record_id: i64) -> AppResult<String> {
    let mut statement =
        connection.prepare("SELECT file_name FROM attachments WHERE record_id = ?1 ORDER BY id")?;
    let names = statement
        .query_map([record_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    if names.is_empty() {
        return Ok(String::new());
    }
    let links = names
        .iter()
        .map(|name| {
            format!(
                "- [{}](../attachments/{record_id:06}/{})",
                name,
                sanitize_file_name(name)
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    Ok(format!("\n\n## 附件\n\n{links}\n"))
}

fn export_original_sources(export_root: &Path, record: &IntelligenceRecord) -> AppResult<()> {
    let target = export_root
        .join("originals")
        .join(format!("{:06}", record.id));
    let mut copied = false;
    for source in &record.sources {
        let Some(path) = source.local_path.as_deref().map(PathBuf::from) else {
            continue;
        };
        if !path.is_file() {
            continue;
        }
        if !copied {
            fs::create_dir_all(&target)?;
            copied = true;
        }
        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("原始文件");
        fs::copy(&path, target.join(sanitize_file_name(name)))?;
    }
    Ok(())
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
                original_at: None,
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
        let json = export_record(&connection, &paths, first.id, "json").expect("export json");
        let vault = export_records(
            &connection,
            &paths,
            &ExportRecordsInput {
                record_ids: vec![first.id],
                query: RecordQuery::default(),
                format: "vault".to_string(),
                include_attachments: true,
                include_versions: true,
                include_original_files: false,
            },
        )
        .expect("export vault");
        assert!(Path::new(&markdown.file_path).exists());
        assert!(Path::new(&json.file_path).exists());
        assert!(Path::new(&vault.file_path).join("README.md").is_file());
        let vault_note = fs::read_dir(Path::new(&vault.file_path).join("records"))
            .expect("records dir")
            .next()
            .expect("record note")
            .expect("record entry")
            .path();
        assert!(fs::read_to_string(vault_note)
            .expect("note text")
            .contains("id: 1"));
        let backup = create_backup(&connection, &paths, "手动备份").expect("backup");
        let preview = inspect_backup(&backup).expect("inspect backup");
        assert_eq!(preview.integrity_check, "ok");
        assert_eq!(preview.record_count, 1);
        assert_eq!(preview.deleted_count, 0);
        assert_eq!(preview.version_count, 1);

        database::move_to_trash(&connection, first.id).expect("move to trash");
        let restored = restore_backup(&mut connection, &paths, &backup).expect("restore backup");
        assert_eq!(restored.integrity_check, "ok");
        assert!(
            !database::get_record(&connection, first.id)
                .expect("restored record")
                .is_deleted
        );
        assert!(Path::new(&restored.safety_backup).exists());
        assert!(Path::new(&restored.log_path).exists());
    }

    #[test]
    fn portable_backup_preserves_database_files_and_interface_preferences() {
        let directory = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        let record = database::create_record(
            &mut connection,
            &CreateRecordInput {
                title: "换机备份验收".to_string(),
                original_at: None,
                summary: "完整迁移".to_string(),
                status: Default::default(),
                tags: vec!["迁移".to_string()],
                current_judgment: String::new(),
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
        fs::write(paths.imports_raw.join("原始记录.md"), "原始正文").expect("write import");
        fs::write(paths.attachments.join("证据.txt"), "证据内容").expect("write attachment");
        let preferences = r#"{"nanfeng-knowledge-base:recent-searches":"[\"迁移\"]","nanfeng-knowledge-base:dialog-size:test":"{\"width\":900}"}"#;

        let backup = create_portable_backup(&connection, &paths, preferences, "完整迁移备份")
            .expect("backup");
        let preview = inspect_portable_backup(&backup.folder_path).expect("preview");
        assert_eq!(preview.record_count, 1);
        assert_eq!(preview.preference_count, 2);
        assert_eq!(preview.integrity_check, "ok");
        assert!(Path::new(&backup.folder_path)
            .join("imports/raw/原始记录.md")
            .is_file());
        assert!(Path::new(&backup.folder_path)
            .join("attachments/证据.txt")
            .is_file());
        let manifest_path = Path::new(&backup.folder_path).join("manifest.json");
        let original_manifest = fs::read(&manifest_path).expect("original manifest");
        let mut legacy_manifest: serde_json::Value =
            serde_json::from_slice(&original_manifest).expect("manifest json");
        legacy_manifest["format"] =
            serde_json::Value::String(LEGACY_PORTABLE_BACKUP_FORMAT.to_string());
        legacy_manifest["formatVersion"] = serde_json::Value::from(1);
        legacy_manifest
            .as_object_mut()
            .expect("manifest object")
            .remove("files");
        fs::write(
            &manifest_path,
            serde_json::to_vec_pretty(&legacy_manifest).expect("legacy manifest"),
        )
        .expect("write legacy manifest");
        let legacy_preview =
            inspect_portable_backup(&backup.folder_path).expect("legacy backup remains readable");
        assert_eq!(legacy_preview.record_count, 1);
        assert!(!legacy_preview.restorable);
        assert_eq!(legacy_preview.content_integrity, "legacy_database_only");
        assert!(
            restore_portable_backup(&mut connection, &paths, &backup.folder_path, preferences,)
                .is_err()
        );
        fs::write(&manifest_path, original_manifest).expect("restore current manifest");

        database::move_to_trash(&connection, record.id).expect("mutate database");
        fs::write(paths.imports_raw.join("原始记录.md"), "已修改").expect("mutate import");
        fs::remove_file(paths.attachments.join("证据.txt")).expect("remove attachment");
        let restored = restore_portable_backup(
            &mut connection,
            &paths,
            &backup.folder_path,
            r#"{"nanfeng-knowledge-base:recent-searches":"[]"}"#,
        )
        .expect("restore");

        assert!(
            !database::get_record(&connection, record.id)
                .expect("record")
                .is_deleted
        );
        assert_eq!(
            fs::read_to_string(paths.imports_raw.join("原始记录.md")).expect("import text"),
            "原始正文"
        );
        assert_eq!(
            fs::read_to_string(paths.attachments.join("证据.txt")).expect("attachment text"),
            "证据内容"
        );
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&restored.preferences_json)
                .expect("preferences"),
            serde_json::from_str::<serde_json::Value>(preferences).expect("expected preferences")
        );
        assert!(Path::new(&restored.safety_backup).is_dir());
        assert!(Path::new(&restored.log_path).is_file());
    }

    #[test]
    fn portable_backup_rejects_tampered_files_before_restore() {
        let directory = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        fs::write(paths.attachments.join("证据.txt"), "原始内容").expect("attachment");
        let backup = create_portable_backup(&connection, &paths, "{}", "校验备份").expect("backup");
        fs::write(
            Path::new(&backup.folder_path).join("attachments/证据.txt"),
            "被篡改",
        )
        .expect("tamper");

        let error =
            inspect_portable_backup(&backup.folder_path).expect_err("tampered backup must fail");
        assert!(error.to_string().contains("校验失败"));
        assert!(
            restore_portable_backup(&mut connection, &paths, &backup.folder_path, "{}",).is_err()
        );
    }

    #[test]
    fn portable_backup_with_building_marker_is_not_restorable() {
        let directory = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let connection = database::open_database(&paths.database).expect("database");
        let backup =
            create_portable_backup(&connection, &paths, "{}", "未完成标记").expect("backup");
        let marker = Path::new(&backup.folder_path).join(".building");
        fs::write(&marker, "incomplete").expect("marker");

        let error =
            inspect_portable_backup(&backup.folder_path).expect_err("building backup must fail");

        assert!(error.to_string().contains("仍在创建中"));
        fs::remove_file(marker).expect("remove marker");
        assert!(
            inspect_portable_backup(&backup.folder_path)
                .expect("completed backup")
                .restorable
        );
    }

    #[test]
    fn portable_restore_rolls_back_database_and_files_after_injected_failure() {
        let directory = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        fs::write(paths.imports_raw.join("source.txt"), "backup import").expect("import");
        fs::write(paths.attachments.join("asset.txt"), "backup attachment").expect("attachment");
        let backup =
            create_portable_backup(&connection, &paths, "{}", "故障注入源").expect("backup");

        connection
            .execute_batch(
                "CREATE TABLE qa_rollback_guard(value TEXT NOT NULL);
                 INSERT INTO qa_rollback_guard(value) VALUES ('protected');",
            )
            .expect("guard");
        fs::write(paths.imports_raw.join("source.txt"), "protected import")
            .expect("protected import");
        fs::write(paths.attachments.join("asset.txt"), "protected attachment")
            .expect("protected attachment");

        let error = restore_portable_backup_with_fault_injection(
            &mut connection,
            &paths,
            &backup.folder_path,
            r#"{"qa":"protected"}"#,
            PortableRestoreFault::AfterImports,
        )
        .expect_err("fault must fail");

        assert!(error.to_string().contains("隔离恢复演练注入故障"));
        assert_eq!(
            connection
                .query_row("SELECT value FROM qa_rollback_guard", [], |row| row
                    .get::<_, String>(0))
                .expect("guard restored"),
            "protected"
        );
        assert_eq!(
            fs::read_to_string(paths.imports_raw.join("source.txt")).expect("import restored"),
            "protected import"
        );
        assert_eq!(
            fs::read_to_string(paths.attachments.join("asset.txt")).expect("attachment restored"),
            "protected attachment"
        );
        assert_eq!(
            database::integrity_check(&connection).expect("integrity"),
            "ok"
        );
    }

    #[test]
    fn invalid_backup_and_unwritable_destination_fail_without_false_success() {
        let directory = tempdir().expect("tempdir");
        let invalid = directory.path().join("invalid.db");
        fs::write(&invalid, b"not a sqlite backup").expect("invalid fixture");
        assert!(inspect_backup(&invalid).is_err());

        let blocked_parent = directory.path().join("blocked");
        fs::write(&blocked_parent, b"this is a file").expect("blocked parent");
        let destination = blocked_parent.join("export.json");
        assert!(atomic_write(&destination, b"{}").is_err());
        assert!(!destination.exists());
    }

    #[test]
    fn docx_export_uses_controlled_export_directory_and_rejects_invalid_payloads() {
        let directory = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let payload = b"PK\x03\x04minimal-test-docx";
        let result = write_docx_export(&paths, "完整笔记.docx", payload).expect("write docx");
        let destination = Path::new(&result.file_path);

        assert_eq!(result.format, "docx");
        assert!(destination.starts_with(&paths.exports));
        assert_eq!(fs::read(destination).expect("read docx"), payload);
        assert!(write_docx_export(&paths, "invalid.docx", b"not-a-zip").is_err());
    }

    #[test]
    fn markdown_export_uses_complete_content_and_controlled_directory() {
        let directory = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let markdown = "# 完整笔记\n\n## 用户\n\n真实问题\n\n## 助手\n\n真实回答";
        let result =
            write_markdown_export(&paths, "完整笔记.md", markdown).expect("write markdown");
        let destination = Path::new(&result.file_path);

        assert_eq!(result.format, "md");
        assert!(destination.starts_with(&paths.exports));
        assert_eq!(
            fs::read_to_string(destination).expect("read markdown"),
            markdown
        );
        assert!(write_markdown_export(&paths, "empty.md", "   ").is_err());
    }
}
