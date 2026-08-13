use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::Manager;

use crate::database;
use crate::error::{AppError, AppResult};
use crate::models::{DataLocation, DataMigrationPreview, DataMigrationResult, StorageStats};
use rusqlite::Connection;

#[derive(Debug, Clone)]
pub struct AppPaths {
    pub root: PathBuf,
    pub database: PathBuf,
    pub imports_raw: PathBuf,
    pub attachments: PathBuf,
    pub exports: PathBuf,
    pub backups: PathBuf,
    pub logs: PathBuf,
    location_config: Option<PathBuf>,
}

const DATA_LOCATION_CONFIG_FILE: &str = "data-location.json";
const MIGRATION_COPY_BUFFER_BYTES: usize = 256 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DataLocationConfig {
    active_root: String,
    previous_root: Option<String>,
}

impl AppPaths {
    pub fn from_app(app: &tauri::AppHandle) -> AppResult<Self> {
        if let Some(override_root) = std::env::var_os("NANFENG_KNOWLEDGE_BASE_DATA_DIR") {
            return Self::from_root(PathBuf::from(override_root));
        }
        // 兼容旧版自动化与测试环境，暂不移除原环境变量。
        if let Some(override_root) = std::env::var_os("NANFENG_INTELLIGENCE_DATA_DIR") {
            return Self::from_root(PathBuf::from(override_root));
        }
        let app_data_root = app
            .path()
            .app_data_dir()
            .map_err(|error| AppError::Io(std::io::Error::other(error.to_string())))?;
        let location_config = app
            .path()
            .app_config_dir()
            .map_err(|error| AppError::Io(std::io::Error::other(error.to_string())))?
            .join(DATA_LOCATION_CONFIG_FILE);
        if let Some(configured_root) = read_configured_root(&location_config)? {
            return Self::from_root_with_config(configured_root, Some(location_config));
        }
        #[cfg(target_os = "windows")]
        {
            return Self::from_preferred_with_legacy_roots_and_config(
                PathBuf::from(r"D:\南枫知识库"),
                &[PathBuf::from(r"D:\南枫情报台"), app_data_root],
                Some(location_config),
            );
        }
        #[cfg(not(target_os = "windows"))]
        Self::from_root_with_config(app_data_root, Some(location_config))
    }

    #[cfg(test)]
    fn from_preferred_with_legacy_roots(
        preferred_root: PathBuf,
        legacy_roots: &[PathBuf],
    ) -> AppResult<Self> {
        Self::from_preferred_with_legacy_roots_and_config(preferred_root, legacy_roots, None)
    }

    fn from_preferred_with_legacy_roots_and_config(
        preferred_root: PathBuf,
        legacy_roots: &[PathBuf],
        location_config: Option<PathBuf>,
    ) -> AppResult<Self> {
        let migration_source = legacy_roots
            .iter()
            .find(|root| root.join("data").join("app.db").is_file());
        if let Some(source) = migration_source {
            if directory_is_missing_or_empty(&preferred_root)? {
                if let Err(error) = migrate_legacy_data(source, &preferred_root) {
                    eprintln!("迁移到默认数据目录失败，将继续使用原目录：{}", error);
                    return Self::from_root_with_config(source, location_config);
                }
            }
        }

        match Self::from_root_with_config(&preferred_root, location_config.clone()) {
            Ok(paths) => Ok(paths),
            Err(error) => {
                eprintln!("默认数据目录不可用，将继续使用原目录：{}", error);
                let fallback_root = migration_source
                    .or_else(|| legacy_roots.last())
                    .ok_or_else(|| AppError::Validation("缺少可用的数据目录".to_string()))?;
                Self::from_root_with_config(fallback_root, location_config)
            }
        }
    }

    pub fn from_root(root: impl AsRef<Path>) -> AppResult<Self> {
        Self::from_root_with_config(root, None)
    }

    fn from_root_with_config(
        root: impl AsRef<Path>,
        location_config: Option<PathBuf>,
    ) -> AppResult<Self> {
        let root = root.as_ref().to_path_buf();
        let paths = Self {
            database: root.join("data").join("app.db"),
            imports_raw: root.join("imports").join("raw"),
            attachments: root.join("attachments"),
            exports: root.join("exports"),
            backups: root.join("backups"),
            logs: root.join("logs"),
            root,
            location_config,
        };
        paths.ensure_directories()?;
        Ok(paths)
    }

    pub fn ensure_directories(&self) -> AppResult<()> {
        let database_dir = self
            .database
            .parent()
            .ok_or_else(|| AppError::Validation("数据库路径缺少父目录".to_string()))?;
        for directory in [
            database_dir,
            self.imports_raw.as_path(),
            self.attachments.as_path(),
            self.exports.as_path(),
            self.backups.as_path(),
            self.logs.as_path(),
        ] {
            fs::create_dir_all(directory)?;
        }
        Ok(())
    }

    pub fn location(&self) -> DataLocation {
        DataLocation {
            root: self.root.to_string_lossy().into_owned(),
            database: self.database.to_string_lossy().into_owned(),
            imports: self.imports_raw.to_string_lossy().into_owned(),
            attachments: self.attachments.to_string_lossy().into_owned(),
            exports: self.exports.to_string_lossy().into_owned(),
            backups: self.backups.to_string_lossy().into_owned(),
            logs: self.logs.to_string_lossy().into_owned(),
        }
    }

    pub fn inspect_data_migration(
        &self,
        target_root: impl AsRef<Path>,
    ) -> AppResult<DataMigrationPreview> {
        let target_root = normalize_root(target_root.as_ref())?;
        validate_migration_target(&self.root, &target_root)?;
        let (file_count, total_bytes) = directory_inventory(&self.root)?;
        let required_bytes = total_bytes
            .saturating_add(total_bytes / 10)
            .saturating_add(32 * 1024 * 1024);
        let available_bytes = fs2::available_space(target_root.parent().unwrap_or(&target_root))?;
        if available_bytes < required_bytes {
            return Err(AppError::Validation(format!(
                "目标磁盘空间不足：迁移至少需要 {:.2} GB，当前可用 {:.2} GB",
                required_bytes as f64 / 1_073_741_824_f64,
                available_bytes as f64 / 1_073_741_824_f64,
            )));
        }
        Ok(DataMigrationPreview {
            source_root: self.root.to_string_lossy().into_owned(),
            target_root: target_root.to_string_lossy().into_owned(),
            file_count,
            total_bytes,
            required_bytes,
            available_bytes,
            target_is_empty: directory_is_missing_or_empty(&target_root)?,
        })
    }

    /// 只在调用方已经取得明确确认后执行。源目录始终不改写、不删除。
    pub fn migrate_data_directory(
        &self,
        connection: &Connection,
        target_root: impl AsRef<Path>,
    ) -> AppResult<DataMigrationResult> {
        let preview = self.inspect_data_migration(target_root)?;
        let target_root = PathBuf::from(&preview.target_root);
        let target_parent = target_root
            .parent()
            .ok_or_else(|| AppError::Validation("目标数据目录缺少父目录".to_string()))?;
        fs::create_dir_all(target_parent)?;
        let stage = target_parent.join(format!(".南枫知识库-数据迁移中-{}", uuid::Uuid::new_v4()));
        let copy_result = (|| -> AppResult<()> {
            fs::create_dir_all(&stage)?;
            let database_path = stage.join("data").join("app.db");
            fs::create_dir_all(database_path.parent().expect("database parent"))?;
            let mut target_connection = Connection::open(&database_path)?;
            database::copy_database(connection, &mut target_connection)?;
            let integrity: String =
                target_connection.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
            if integrity != "ok" {
                return Err(AppError::Conflict(format!(
                    "复制后的数据库完整性检查失败：{integrity}"
                )));
            }
            drop(target_connection);
            copy_directory_verified_except_database(&self.root, &stage, &self.database)?;
            let source_records: i64 =
                connection.query_row("SELECT COUNT(*) FROM records", [], |row| row.get(0))?;
            let copied_connection = Connection::open_with_flags(
                &database_path,
                rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
            )?;
            let copied_records: i64 =
                copied_connection
                    .query_row("SELECT COUNT(*) FROM records", [], |row| row.get(0))?;
            if source_records != copied_records {
                return Err(AppError::Conflict(
                    "复制后的数据库记录数与原库不一致".to_string(),
                ));
            }
            Ok(())
        })();
        if let Err(error) = copy_result {
            let _ = fs::remove_dir_all(&stage);
            return Err(error);
        }
        if target_root.exists() {
            fs::remove_dir(&target_root)?;
        }
        fs::rename(&stage, &target_root)?;
        if let Err(error) = self.persist_next_root(&target_root) {
            let rollback_stage = target_parent.join(format!(
                ".南枫知识库-未切换迁移副本-{}",
                uuid::Uuid::new_v4()
            ));
            let _ = fs::rename(&target_root, &rollback_stage);
            return Err(error);
        }
        Ok(DataMigrationResult {
            source_root: self.root.to_string_lossy().into_owned(),
            target_root: target_root.to_string_lossy().into_owned(),
            copied_file_count: preview.file_count,
            copied_bytes: preview.total_bytes,
            integrity_check: "ok".to_string(),
            restart_required: true,
        })
    }

    pub fn rollback_next_data_root(&self) -> AppResult<String> {
        let config_path = self.location_config.as_ref().ok_or_else(|| {
            AppError::Validation("当前运行环境使用临时数据目录，不能修改下次启动路径".to_string())
        })?;
        let config = read_location_config(config_path)?
            .ok_or_else(|| AppError::NotFound("没有可撤销的数据目录切换".to_string()))?;
        let previous_root = config
            .previous_root
            .ok_or_else(|| AppError::NotFound("没有可撤销的数据目录切换".to_string()))?;
        write_location_config(
            config_path,
            &DataLocationConfig {
                active_root: previous_root.clone(),
                previous_root: Some(config.active_root),
            },
        )?;
        Ok(previous_root)
    }

    fn persist_next_root(&self, target_root: &Path) -> AppResult<()> {
        let config_path = self.location_config.as_ref().ok_or_else(|| {
            AppError::Validation("当前运行环境使用临时数据目录，不能修改下次启动路径".to_string())
        })?;
        write_location_config(
            config_path,
            &DataLocationConfig {
                active_root: target_root.to_string_lossy().into_owned(),
                previous_root: Some(self.root.to_string_lossy().into_owned()),
            },
        )
    }

    pub fn storage_stats(&self, connection: &Connection) -> AppResult<StorageStats> {
        let database_bytes = file_size(&self.database)?;
        let imports_bytes = directory_size(&self.imports_raw)?;
        let attachments_bytes = directory_size(&self.attachments)?;
        let backups_bytes = directory_size(&self.backups)?;
        let record_count = connection.query_row(
            "SELECT COUNT(*) FROM records WHERE is_deleted = 0",
            [],
            |row| row.get(0),
        )?;
        let last_backup_at = newest_file_modified_at(&self.backups)?;
        let disk_available_bytes = fs2::available_space(&self.root)?;
        let disk_total_bytes = fs2::total_space(&self.root)?;
        Ok(StorageStats {
            record_count,
            database_bytes,
            imports_bytes,
            attachments_bytes,
            backups_bytes,
            total_bytes: database_bytes + imports_bytes + attachments_bytes + backups_bytes,
            disk_available_bytes,
            disk_total_bytes,
            last_backup_at,
        })
    }
}

fn file_size(path: &Path) -> AppResult<u64> {
    Ok(if path.is_file() {
        path.metadata()?.len()
    } else {
        0
    })
}

fn read_configured_root(config_path: &Path) -> AppResult<Option<PathBuf>> {
    Ok(read_location_config(config_path)?.map(|config| PathBuf::from(config.active_root)))
}

fn read_location_config(config_path: &Path) -> AppResult<Option<DataLocationConfig>> {
    if !config_path.is_file() {
        return Ok(None);
    }
    let bytes = fs::read(config_path)?;
    serde_json::from_slice(&bytes)
        .map(Some)
        .map_err(|error| AppError::Validation(format!("数据目录配置无法读取：{error}")))
}

fn write_location_config(config_path: &Path, config: &DataLocationConfig) -> AppResult<()> {
    let parent = config_path
        .parent()
        .ok_or_else(|| AppError::Validation("数据目录配置缺少父目录".to_string()))?;
    fs::create_dir_all(parent)?;
    let temporary = config_path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
    let mut file = fs::File::create(&temporary)?;
    file.write_all(serde_json::to_string_pretty(config)?.as_bytes())?;
    file.sync_all()?;
    fs::rename(temporary, config_path)?;
    Ok(())
}

fn normalize_root(root: &Path) -> AppResult<PathBuf> {
    if root.as_os_str().is_empty() {
        return Err(AppError::Validation("请选择一个数据目录".to_string()));
    }
    let absolute = if root.is_absolute() {
        root.to_path_buf()
    } else {
        std::env::current_dir()?.join(root)
    };
    Ok(absolute.components().collect())
}

fn validate_migration_target(source_root: &Path, target_root: &Path) -> AppResult<()> {
    let source_root = normalize_root(source_root)?;
    if target_root == source_root {
        return Err(AppError::Validation(
            "目标目录与当前数据目录相同，无需迁移".to_string(),
        ));
    }
    if target_root.starts_with(&source_root) || source_root.starts_with(target_root) {
        return Err(AppError::Validation(
            "新数据目录不能是当前目录的父目录或子目录".to_string(),
        ));
    }
    if !directory_is_missing_or_empty(target_root)? {
        return Err(AppError::Conflict(
            "目标数据目录已有内容。请新建或选择一个空目录，避免覆盖任何文件。".to_string(),
        ));
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
        let entry_type = entry.file_type()?;
        if entry_type.is_dir() {
            let (nested_count, nested_bytes) = directory_inventory(&entry.path())?;
            file_count = file_count.saturating_add(nested_count);
            total_bytes = total_bytes.saturating_add(nested_bytes);
        } else if entry_type.is_file() {
            file_count = file_count.saturating_add(1);
            total_bytes = total_bytes.saturating_add(entry.metadata()?.len());
        }
    }
    Ok((file_count, total_bytes))
}

/// 保留未来新增的受控目录与文件，但永不复制正在写入的 SQLite 主库、WAL 或 SHM。
fn copy_directory_verified_except_database(
    source: &Path,
    destination: &Path,
    database_path: &Path,
) -> AppResult<()> {
    fs::create_dir_all(destination)?;
    if !source.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        if source_path == database_path
            || source_path == database_path.with_extension("db-wal")
            || source_path == database_path.with_extension("db-shm")
        {
            continue;
        }
        let destination_path = destination.join(entry.file_name());
        let entry_type = entry.file_type()?;
        if entry_type.is_dir() {
            copy_directory_verified_except_database(
                &source_path,
                &destination_path,
                database_path,
            )?;
        } else if entry_type.is_file() {
            copy_file_verified(&source_path, &destination_path)?;
        }
    }
    Ok(())
}

fn copy_file_verified(source: &Path, destination: &Path) -> AppResult<()> {
    let temporary = destination.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
    let copy_result = (|| -> AppResult<()> {
        let mut input = fs::File::open(source)?;
        let mut output = fs::File::create(&temporary)?;
        let mut buffer = vec![0_u8; MIGRATION_COPY_BUFFER_BYTES];
        let mut source_hasher = Sha256::new();
        loop {
            let read = input.read(&mut buffer)?;
            if read == 0 {
                break;
            }
            source_hasher.update(&buffer[..read]);
            output.write_all(&buffer[..read])?;
        }
        output.sync_all()?;
        drop(output);
        let copied_hash = sha256_file(&temporary)?;
        if hex::encode(source_hasher.finalize()) != copied_hash {
            return Err(AppError::Conflict(format!(
                "文件校验失败：{}",
                source.display()
            )));
        }
        fs::rename(&temporary, destination)?;
        Ok(())
    })();
    if copy_result.is_err() && temporary.exists() {
        let _ = fs::remove_file(&temporary);
    }
    copy_result
}

fn sha256_file(path: &Path) -> AppResult<String> {
    let mut file = fs::File::open(path)?;
    let mut buffer = vec![0_u8; MIGRATION_COPY_BUFFER_BYTES];
    let mut hasher = Sha256::new();
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn directory_size(path: &Path) -> AppResult<u64> {
    if !path.is_dir() {
        return Ok(0);
    }
    let mut total = 0_u64;
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let entry_path = entry.path();
        total = total.saturating_add(if entry.file_type()?.is_dir() {
            directory_size(&entry_path)?
        } else {
            entry.metadata()?.len()
        });
    }
    Ok(total)
}

fn newest_file_modified_at(path: &Path) -> AppResult<Option<String>> {
    if !path.is_dir() {
        return Ok(None);
    }
    let mut newest = None;
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        let modified = entry.metadata()?.modified()?;
        if newest.is_none_or(|current| modified > current) {
            newest = Some(modified);
        }
    }
    Ok(newest.map(|time| chrono::DateTime::<chrono::Utc>::from(time).to_rfc3339()))
}

fn directory_is_missing_or_empty(path: &Path) -> AppResult<bool> {
    if !path.exists() {
        return Ok(true);
    }
    if !path.is_dir() {
        return Ok(false);
    }
    Ok(fs::read_dir(path)?.next().is_none())
}

fn migrate_legacy_data(source: &Path, target: &Path) -> AppResult<()> {
    let parent = target
        .parent()
        .ok_or_else(|| AppError::Validation("默认数据目录缺少父目录".to_string()))?;
    fs::create_dir_all(parent)?;

    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let stage = parent.join(format!(".南枫知识库-迁移中-{}-{nonce}", std::process::id()));
    let source_database = source.join("data").join("app.db");
    let target_database = stage.join("data").join("app.db");
    copy_directory_without_database(source, &stage, &source_database)?;
    if source_database.is_file() {
        if let Some(parent) = target_database.parent() {
            fs::create_dir_all(parent)?;
        }
        backup_database(&source_database, &target_database)?;
    }

    if target.exists() {
        if !directory_is_missing_or_empty(target)? {
            return Err(AppError::Conflict(
                "默认数据目录已有内容，已停止旧数据迁移".to_string(),
            ));
        }
        fs::remove_dir(target)?;
    }
    fs::rename(stage, target)?;
    Ok(())
}

fn copy_directory_without_database(
    source: &Path,
    target: &Path,
    source_database: &Path,
) -> AppResult<()> {
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if source_path == source_database
            || source_path == source_database.with_extension("db-wal")
            || source_path == source_database.with_extension("db-shm")
        {
            continue;
        }
        if entry.file_type()?.is_dir() {
            copy_directory_without_database(&source_path, &target_path, source_database)?;
        } else {
            fs::copy(source_path, target_path)?;
        }
    }
    Ok(())
}

fn backup_database(source_path: &Path, target_path: &Path) -> AppResult<()> {
    let source =
        Connection::open_with_flags(source_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let mut target = Connection::open(target_path)?;
    database::copy_database(&source, &mut target)?;
    let integrity: String = target.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if integrity != "ok" {
        return Err(AppError::Conflict(format!(
            "旧数据迁移后的数据库完整性检查失败：{integrity}"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_preferred_root_receives_legacy_data_without_removing_source() {
        let directory = tempfile::tempdir().expect("temp dir");
        let legacy = directory.path().join("legacy");
        let preferred = directory.path().join("preferred");
        fs::create_dir_all(legacy.join("data")).expect("legacy data dir");
        let legacy_database = legacy.join("data").join("app.db");
        let connection = Connection::open(&legacy_database).expect("legacy db");
        connection
            .execute_batch(
                "CREATE TABLE marker(value TEXT NOT NULL);
                 INSERT INTO marker(value) VALUES ('database');",
            )
            .expect("legacy fixture");
        drop(connection);

        let paths =
            AppPaths::from_preferred_with_legacy_roots(preferred.clone(), &[legacy.clone()])
                .expect("select preferred");

        assert_eq!(paths.root, preferred);
        assert_eq!(
            Connection::open(&paths.database)
                .expect("migrated db")
                .query_row("SELECT value FROM marker", [], |row| row
                    .get::<_, String>(0))
                .expect("migrated marker"),
            "database"
        );
        assert!(legacy.join("data").join("app.db").is_file());
    }

    #[test]
    fn populated_preferred_root_is_never_overwritten_by_legacy_data() {
        let directory = tempfile::tempdir().expect("temp dir");
        let legacy = directory.path().join("legacy");
        let preferred = directory.path().join("preferred");
        fs::create_dir_all(legacy.join("data")).expect("legacy data dir");
        fs::create_dir_all(&preferred).expect("preferred dir");
        fs::write(legacy.join("data").join("app.db"), b"legacy").expect("legacy db");
        fs::write(preferred.join("keep.txt"), b"keep").expect("preferred marker");

        let paths = AppPaths::from_preferred_with_legacy_roots(preferred.clone(), &[legacy])
            .expect("select existing preferred");

        assert_eq!(paths.root, preferred);
        assert_eq!(
            fs::read(paths.root.join("keep.txt")).expect("marker"),
            b"keep"
        );
    }

    #[test]
    fn first_legacy_root_with_database_has_migration_priority() {
        let directory = tempfile::tempdir().expect("temp dir");
        let preferred = directory.path().join("preferred");
        let branded_legacy = directory.path().join("old-brand");
        let app_data_legacy = directory.path().join("app-data");
        for (root, marker) in [
            (&branded_legacy, "old-brand"),
            (&app_data_legacy, "app-data"),
        ] {
            fs::create_dir_all(root.join("data")).expect("legacy data dir");
            let connection = Connection::open(root.join("data").join("app.db")).expect("db");
            connection
                .execute_batch(&format!(
                    "CREATE TABLE marker(value TEXT NOT NULL);
                     INSERT INTO marker(value) VALUES ('{marker}');"
                ))
                .expect("fixture");
        }

        let paths = AppPaths::from_preferred_with_legacy_roots(
            preferred,
            &[branded_legacy.clone(), app_data_legacy],
        )
        .expect("migrate");
        let marker: String = Connection::open(paths.database)
            .expect("migrated db")
            .query_row("SELECT value FROM marker", [], |row| row.get(0))
            .expect("marker");

        assert_eq!(marker, "old-brand");
        assert!(branded_legacy.join("data").join("app.db").is_file());
    }

    #[test]
    fn data_directory_migration_copies_and_verifies_without_removing_the_source() {
        let directory = tempfile::tempdir().expect("temp dir");
        let mut paths = AppPaths::from_root(directory.path().join("source")).expect("paths");
        paths.location_config = Some(
            directory
                .path()
                .join("config")
                .join(DATA_LOCATION_CONFIG_FILE),
        );
        fs::write(
            paths.attachments.join("evidence.bin"),
            b"attachment evidence",
        )
        .expect("attachment");
        fs::write(paths.imports_raw.join("original.json"), b"original source").expect("import");
        let connection = database::open_database(&paths.database).expect("database");
        connection
            .execute_batch("CREATE TABLE IF NOT EXISTS migration_marker(value TEXT); INSERT INTO migration_marker(value) VALUES ('kept');")
            .expect("marker");
        let target = directory.path().join("selected-empty-root");

        let preview = paths.inspect_data_migration(&target).expect("preview");
        assert!(preview.target_is_empty);
        let result = paths
            .migrate_data_directory(&connection, &target)
            .expect("migrate");

        assert!(result.restart_required);
        assert!(paths.database.is_file());
        assert_eq!(
            fs::read(paths.attachments.join("evidence.bin")).expect("source"),
            b"attachment evidence"
        );
        assert_eq!(
            fs::read(target.join("attachments").join("evidence.bin")).expect("copy"),
            b"attachment evidence"
        );
        assert_eq!(
            Connection::open(target.join("data").join("app.db"))
                .expect("copied db")
                .query_row("SELECT value FROM migration_marker", [], |row| row
                    .get::<_, String>(0))
                .expect("marker"),
            "kept"
        );
        let configured = read_location_config(paths.location_config.as_ref().expect("config"))
            .expect("read config")
            .expect("config exists");
        assert_eq!(configured.active_root, target.to_string_lossy());
        assert_eq!(
            configured.previous_root.as_deref(),
            Some(paths.root.to_string_lossy().as_ref())
        );
    }
}
