use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::Manager;

use crate::error::{AppError, AppResult};
use crate::models::DataLocation;

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
        if let Some(override_root) = std::env::var_os("NANFENG_INTELLIGENCE_DATA_DIR") {
            return Self::from_root(PathBuf::from(override_root));
        }
        let legacy_root = app
            .path()
            .app_data_dir()
            .map_err(|error| AppError::Io(std::io::Error::other(error.to_string())))?;
        #[cfg(target_os = "windows")]
        {
            return Self::from_preferred_or_legacy(PathBuf::from(r"D:\南枫情报台"), legacy_root);
        }
        #[cfg(not(target_os = "windows"))]
        Self::from_root(legacy_root)
    }

    fn from_preferred_or_legacy(preferred_root: PathBuf, legacy_root: PathBuf) -> AppResult<Self> {
        if legacy_root.join("data").join("app.db").is_file()
            && directory_is_missing_or_empty(&preferred_root)?
        {
            if let Err(error) = migrate_legacy_data(&legacy_root, &preferred_root) {
                eprintln!("迁移到默认数据目录失败，将继续使用原目录：{}", error);
                return Self::from_root(legacy_root);
            }
        }

        match Self::from_root(&preferred_root) {
            Ok(paths) => Ok(paths),
            Err(error) => {
                eprintln!("默认数据目录不可用，将继续使用原目录：{}", error);
                Self::from_root(legacy_root)
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
    let stage = parent.join(format!(".南枫情报台-迁移中-{}-{nonce}", std::process::id()));
    copy_directory(source, &stage)?;

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

fn copy_directory(source: &Path, target: &Path) -> AppResult<()> {
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_directory(&source_path, &target_path)?;
        } else {
            fs::copy(source_path, target_path)?;
        }
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
        fs::write(legacy.join("data").join("app.db"), b"database").expect("legacy db");
        fs::write(legacy.join("data").join("app.db-wal"), b"wal").expect("legacy wal");

        let paths = AppPaths::from_preferred_or_legacy(preferred.clone(), legacy.clone())
            .expect("select preferred");

        assert_eq!(paths.root, preferred);
        assert_eq!(fs::read(&paths.database).expect("migrated db"), b"database");
        assert_eq!(
            fs::read(paths.database.with_file_name("app.db-wal")).expect("migrated wal"),
            b"wal"
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

        let paths = AppPaths::from_preferred_or_legacy(preferred.clone(), legacy)
            .expect("select existing preferred");

        assert_eq!(paths.root, preferred);
        assert_eq!(
            fs::read(paths.root.join("keep.txt")).expect("marker"),
            b"keep"
        );
    }
}
