use serde::Serialize;
use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("{0}")]
    Validation(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Conflict(String),
    #[error("数据库操作失败：{0}")]
    Database(#[from] rusqlite::Error),
    #[error("文件操作失败：{0}")]
    Io(#[from] std::io::Error),
    #[error("数据序列化失败：{0}")]
    Serialization(#[from] serde_json::Error),
    #[error("{0}")]
    Unsupported(String),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: &'static str,
    pub message: String,
}

impl From<AppError> for CommandError {
    fn from(error: AppError) -> Self {
        let code = match &error {
            AppError::Validation(_) => "validation_error",
            AppError::NotFound(_) => "not_found",
            AppError::Conflict(_) => "conflict",
            AppError::Database(_) => "database_error",
            AppError::Io(_) => "file_error",
            AppError::Serialization(_) => "serialization_error",
            AppError::Unsupported(_) => "unsupported",
        };
        Self {
            code,
            message: error.to_string(),
        }
    }
}
