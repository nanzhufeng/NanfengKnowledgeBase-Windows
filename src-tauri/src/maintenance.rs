use std::fs::{self, File, OpenOptions};
use std::io::{BufReader, Read, Write};
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::chatgpt_export::{self, ChatGptAssetMaterialization};
use crate::database;
use crate::error::{AppError, AppResult};
use crate::importer::{self, ConfirmImportInput};
use crate::paths::AppPaths;
use crate::transfer;

const ISOLATED_MIGRATION_MARKER: &str = ".isolated-knowledge-migration-test";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatGptImportMaintenanceReport {
    pub data_root: String,
    pub source_zip: String,
    pub source_zip_sha256: String,
    pub database_backup: String,
    pub import_job_id: String,
    pub records_before: i64,
    pub records_after: i64,
    pub imported_records: usize,
    pub skipped_records: usize,
    pub restored_asset_count: usize,
    pub registered_attachment_rows: i64,
    pub restored_asset_bytes: u64,
    pub attachment_manifest: String,
    pub database_integrity: String,
    pub receipt_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeMigrationMaintenanceReport {
    pub data_root: String,
    pub database: String,
    pub schema_versions: Vec<i64>,
    pub active_records: i64,
    pub deleted_records: i64,
    pub source_items: i64,
    pub linked_legacy_sources: i64,
    pub inbox_sources: i64,
    pub attachments: i64,
    pub integrity_check: String,
    pub foreign_key_violations: i64,
    pub migration_backup: String,
}

pub fn migrate_isolated_knowledge_copy(
    data_root: impl AsRef<Path>,
) -> AppResult<KnowledgeMigrationMaintenanceReport> {
    let data_root = require_absolute_path(data_root.as_ref(), "隔离数据目录")?;
    let normalized = data_root.to_string_lossy().replace('/', "\\");
    if normalized.eq_ignore_ascii_case(r"D:\南枫知识库")
        || normalized.eq_ignore_ascii_case(r"D:\南枫情报台")
    {
        return Err(AppError::Validation(
            "隔离迁移检查器拒绝正式数据目录".to_string(),
        ));
    }
    let marker = data_root.join(ISOLATED_MIGRATION_MARKER);
    if !marker.is_file() {
        return Err(AppError::Validation(format!(
            "缺少隔离迁移标记文件：{}",
            marker.display()
        )));
    }

    let paths = AppPaths::from_root(&data_root)?;
    if !paths.database.is_file() {
        return Err(AppError::NotFound(format!(
            "隔离数据库不存在：{}",
            paths.database.display()
        )));
    }
    let connection = database::open_database(&paths.database)?;
    let integrity_check = database::integrity_check(&connection)?;
    let foreign_key_violations =
        connection.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
            row.get::<_, i64>(0)
        })?;
    let schema_versions = {
        let mut statement =
            connection.prepare("SELECT version FROM schema_migrations ORDER BY version")?;
        let versions = statement
            .query_map([], |row| row.get::<_, i64>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        versions
    };
    let active_records = count_where(&connection, "records", "is_deleted = 0")?;
    let deleted_records = count_where(&connection, "records", "is_deleted = 1")?;
    let source_items = count_where(&connection, "source_items", "1 = 1")?;
    let linked_legacy_sources =
        count_where(&connection, "source_items", "legacy_record_id IS NOT NULL")?;
    let inbox_sources = count_where(&connection, "source_items", "organization_state = 'inbox'")?;
    let attachments = count_where(&connection, "attachments", "1 = 1")?;
    connection.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
    drop(connection);

    let migration_backup = newest_matching_file(&paths.backups, "知识结构迁移前自动备份_", ".db")?
        .ok_or_else(|| AppError::Conflict("隔离迁移没有生成迁移前自动备份".to_string()))?;

    Ok(KnowledgeMigrationMaintenanceReport {
        data_root: data_root.to_string_lossy().into_owned(),
        database: paths.database.to_string_lossy().into_owned(),
        schema_versions,
        active_records,
        deleted_records,
        source_items,
        linked_legacy_sources,
        inbox_sources,
        attachments,
        integrity_check,
        foreign_key_violations,
        migration_backup: migration_backup.to_string_lossy().into_owned(),
    })
}

pub fn import_chatgpt_export_with_backup(
    data_root: impl AsRef<Path>,
    source_zip: impl AsRef<Path>,
    expected_sha256: &str,
    expected_conversation_count: usize,
    expected_asset_count: usize,
) -> AppResult<ChatGptImportMaintenanceReport> {
    let data_root = require_absolute_path(data_root.as_ref(), "数据目录")?;
    let source_zip = require_absolute_path(source_zip.as_ref(), "ChatGPT 导出包")?;
    if !source_zip.is_file() {
        return Err(AppError::NotFound(format!(
            "ChatGPT 导出包不存在：{}",
            source_zip.display()
        )));
    }

    let inspection = chatgpt_export::inspect_chatgpt_export(&source_zip)
        .map_err(|error| AppError::Validation(error.to_string()))?;
    if !inspection
        .source_zip_sha256
        .eq_ignore_ascii_case(expected_sha256)
    {
        return Err(AppError::Conflict(format!(
            "导出包 SHA-256 不符合预期：{}",
            inspection.source_zip_sha256
        )));
    }
    if inspection.conversation_count != expected_conversation_count {
        return Err(AppError::Conflict(format!(
            "导出包会话数不符合预期：实际 {}，预期 {}",
            inspection.conversation_count, expected_conversation_count
        )));
    }
    if inspection.assets.len() != expected_asset_count {
        return Err(AppError::Conflict(format!(
            "导出包附件实体数不符合预期：实际 {}，预期 {}",
            inspection.assets.len(),
            expected_asset_count
        )));
    }

    let paths = AppPaths::from_root(&data_root)?;
    let mut connection = database::open_database(&paths.database)?;
    let integrity_before = database::integrity_check(&connection)?;
    if integrity_before != "ok" {
        return Err(AppError::Conflict(format!(
            "导入前数据库完整性检查失败：{integrity_before}"
        )));
    }
    let records_before = active_record_count(&connection)?;
    let database_backup = transfer::create_backup(&connection, &paths, "ChatGPT完整导入前备份")?;

    let existing_job = connection
        .query_row(
            "SELECT id, stored_file_path, status
             FROM import_jobs
             WHERE lower(sha256) = lower(?1)
             ORDER BY created_at DESC
             LIMIT 1",
            [inspection.source_zip_sha256.as_str()],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .optional()?;
    let import_job_id = match existing_job {
        Some((_, _, status)) if status == "completed" => {
            return Err(AppError::Conflict(
                "相同 SHA-256 的 ChatGPT 完整导出包已经成功导入，已停止重复写入".to_string(),
            ));
        }
        Some((job_id, stored_file_path, status))
            if status == "preview" && Path::new(&stored_file_path).is_file() =>
        {
            job_id
        }
        _ => {
            let preview = importer::prepare_import(&connection, &paths, &source_zip)?;
            if preview.record_count != expected_conversation_count {
                return Err(AppError::Conflict(format!(
                    "导入预览会话数不符合预期：实际 {}，预期 {}",
                    preview.record_count, expected_conversation_count
                )));
            }
            preview.job_id
        }
    };

    let result = importer::confirm_import(
        &mut connection,
        &paths,
        &ConfirmImportInput {
            job_id: import_job_id.clone(),
            records: Vec::new(),
            allow_duplicate: false,
            duplicate_strategy: "copy".to_string(),
            item_strategies: Vec::new(),
            mapping: serde_json::json!({
                "source": "chatgpt_complete_export_zip",
                "verification": "maintenance_v1"
            }),
        },
    )?;
    if result.status != "completed" || !result.errors.is_empty() {
        return Err(AppError::Conflict(format!(
            "完整导入未成功收口：状态 {}，错误 {}",
            result.status,
            result.errors.join("；")
        )));
    }

    let records_after = active_record_count(&connection)?;
    if records_after - records_before != result.imported_count as i64 {
        return Err(AppError::Conflict(format!(
            "导入前后记录数差异异常：导入器报告 {}，数据库实际增加 {}",
            result.imported_count,
            records_after - records_before
        )));
    }
    let integrity_after = database::integrity_check(&connection)?;
    if integrity_after != "ok" {
        return Err(AppError::Conflict(format!(
            "导入后数据库完整性检查失败：{integrity_after}"
        )));
    }

    let mapping_json: String = connection.query_row(
        "SELECT mapping_json FROM import_jobs WHERE id = ?1",
        [&import_job_id],
        |row| row.get(0),
    )?;
    let mapping: serde_json::Value = serde_json::from_str(&mapping_json)?;
    let manifest_path = mapping
        .get("chatGptAttachmentManifest")
        .and_then(serde_json::Value::as_str)
        .map(PathBuf::from)
        .ok_or_else(|| AppError::Conflict("导入任务缺少 ChatGPT 附件清单".to_string()))?;
    let materialization =
        serde_json::from_slice::<ChatGptAssetMaterialization>(&fs::read(&manifest_path)?)?;
    if materialization.asset_count != expected_asset_count {
        return Err(AppError::Conflict(format!(
            "落盘附件实体数不符合预期：实际 {}，预期 {}",
            materialization.asset_count, expected_asset_count
        )));
    }

    let mut restored_asset_bytes = 0_u64;
    for asset in &materialization.assets {
        let stored_path = Path::new(&asset.stored_file_path);
        let metadata = stored_path.metadata().map_err(|error| {
            AppError::Io(std::io::Error::new(
                error.kind(),
                format!("附件实体缺失：{}：{error}", stored_path.display()),
            ))
        })?;
        if metadata.len() != asset.size_bytes {
            return Err(AppError::Conflict(format!(
                "附件大小不一致：{}",
                stored_path.display()
            )));
        }
        let actual_sha256 = sha256_file(stored_path)?;
        if !actual_sha256.eq_ignore_ascii_case(&asset.sha256) {
            return Err(AppError::Conflict(format!(
                "附件哈希不一致：{}",
                stored_path.display()
            )));
        }
        restored_asset_bytes = restored_asset_bytes.saturating_add(metadata.len());
    }

    let attachment_prefix = format!("{}%", materialization.attachment_directory);
    let registered_attachment_rows = connection.query_row(
        "SELECT COUNT(*) FROM attachments WHERE stored_path LIKE ?1",
        params![attachment_prefix],
        |row| row.get::<_, i64>(0),
    )?;

    let receipt_path = paths
        .logs
        .join(format!("chatgpt-import-{import_job_id}.json"));
    let mut report = ChatGptImportMaintenanceReport {
        data_root: data_root.to_string_lossy().into_owned(),
        source_zip: source_zip.to_string_lossy().into_owned(),
        source_zip_sha256: inspection.source_zip_sha256,
        database_backup: database_backup.to_string_lossy().into_owned(),
        import_job_id,
        records_before,
        records_after,
        imported_records: result.imported_count,
        skipped_records: result.skipped_count,
        restored_asset_count: materialization.asset_count,
        registered_attachment_rows,
        restored_asset_bytes,
        attachment_manifest: manifest_path.to_string_lossy().into_owned(),
        database_integrity: integrity_after,
        receipt_path: receipt_path.to_string_lossy().into_owned(),
    };
    write_new_json(&receipt_path, &report)?;
    report.receipt_path = receipt_path.to_string_lossy().into_owned();
    Ok(report)
}

fn require_absolute_path(path: &Path, label: &str) -> AppResult<PathBuf> {
    if !path.is_absolute() {
        return Err(AppError::Validation(format!("{label}必须使用绝对路径")));
    }
    Ok(path.to_path_buf())
}

fn active_record_count(connection: &Connection) -> AppResult<i64> {
    Ok(connection.query_row(
        "SELECT COUNT(*) FROM records WHERE is_deleted = 0",
        [],
        |row| row.get(0),
    )?)
}

fn count_where(connection: &Connection, table: &str, predicate: &str) -> AppResult<i64> {
    let sql = format!("SELECT COUNT(*) FROM {table} WHERE {predicate}");
    Ok(connection.query_row(&sql, [], |row| row.get(0))?)
}

fn newest_matching_file(
    directory: &Path,
    prefix: &str,
    suffix: &str,
) -> AppResult<Option<PathBuf>> {
    let mut newest: Option<(std::time::SystemTime, PathBuf)> = None;
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.starts_with(prefix) || !name.ends_with(suffix) {
            continue;
        }
        let modified = entry.metadata()?.modified()?;
        if newest
            .as_ref()
            .is_none_or(|(current, _)| modified > *current)
        {
            newest = Some((modified, entry.path()));
        }
    }
    Ok(newest.map(|(_, path)| path))
}

fn sha256_file(path: &Path) -> AppResult<String> {
    let mut reader = BufReader::new(File::open(path)?);
    let mut digest = Sha256::new();
    let mut buffer = vec![0_u8; 1024 * 1024];
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(hex::encode(digest.finalize()))
}

fn write_new_json(path: &Path, value: &impl Serialize) -> AppResult<()> {
    let mut file = OpenOptions::new().write(true).create_new(true).open(path)?;
    file.write_all(serde_json::to_string_pretty(value)?.as_bytes())?;
    file.sync_all()?;
    Ok(())
}
