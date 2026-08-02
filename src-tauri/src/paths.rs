use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::Manager;

use crate::database;
use crate::error::{AppError, AppResult};
use crate::models::{DataLocation, StorageStats};
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
        #[cfg(target_os = "windows")]
        {
            return Self::from_preferred_with_legacy_roots(
                PathBuf::from(r"D:\南枫知识库"),
                &[PathBuf::from(r"D:\南枫情报台"), app_data_root],
            );
        }
        #[cfg(not(target_os = "windows"))]
        Self::from_root(app_data_root)
    }

    fn from_preferred_with_legacy_roots(
        preferred_root: PathBuf,
        legacy_roots: &[PathBuf],
    ) -> AppResult<Self> {
        let migration_source = legacy_roots
            .iter()
            .find(|root| root.join("data").join("app.db").is_file());
        if let Some(source) = migration_source {
            if directory_is_missing_or_empty(&preferred_root)? {
                if let Err(error) = migrate_legacy_data(source, &preferred_root) {
                    eprintln!("迁移到默认数据目录失败，将继续使用原目录：{}", error);
                    return Self::from_root(source);
                }
            }
        }

        match Self::from_root(&preferred_root) {
            Ok(paths) => Ok(paths),
            Err(error) => {
                eprintln!("默认数据目录不可用，将继续使用原目录：{}", error);
                let fallback_root = migration_source
                    .or_else(|| legacy_roots.last())
                    .ok_or_else(|| AppError::Validation("缺少可用的数据目录".to_string()))?;
                Self::from_root(fallback_root)
            }
        }
    }

    pub fn from_root(root: impl AsRef<Path>) -> AppResult<Self> {
        let root = root.as_ref().to_path_buf();
        let paths = Self {
            database: root.join("data").join("app.db"),
            imports_raw: root.join("imports").join("raw"),
            attachments: root.join("attachments"),
            exports: root.join("exports"),
            backups: root.join("backups"),
            logs: root.join("logs"),
            root,
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
}
