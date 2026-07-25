use std::fs;
use std::path::{Path, PathBuf};

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
        let root = app
            .path()
            .app_data_dir()
            .map_err(|error| AppError::Io(std::io::Error::other(error.to_string())))?;
        Self::from_root(root)
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
