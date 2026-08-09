use crate::ai::models::AiProviderChannel;
use crate::error::{AppError, AppResult};

const SERVICE_NAME: &str = "南枫知识库-AI";

#[cfg(windows)]
fn entry(channel: AiProviderChannel) -> AppResult<keyring::Entry> {
    keyring::Entry::new(SERVICE_NAME, channel.as_str())
        .map_err(|error| AppError::Conflict(format!("无法访问 Windows 凭据库：{error}")))
}

#[cfg(windows)]
pub fn save_api_key(channel: AiProviderChannel, api_key: &str) -> AppResult<()> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err(AppError::Validation("API Key 不能为空".to_string()));
    }
    entry(channel)?
        .set_password(key)
        .map_err(|error| AppError::Conflict(format!("API Key 保存失败：{error}")))
}

#[cfg(windows)]
pub fn get_api_key(channel: AiProviderChannel) -> AppResult<Option<String>> {
    match entry(channel)?.get_password() {
        Ok(value) if !value.trim().is_empty() => Ok(Some(value)),
        Ok(_) => Ok(None),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(AppError::Conflict(format!("API Key 读取失败：{error}"))),
    }
}

#[cfg(not(windows))]
pub fn save_api_key(_channel: AiProviderChannel, _api_key: &str) -> AppResult<()> {
    Err(AppError::Unsupported(
        "当前版本只支持在 Windows 凭据库保存 API Key".to_string(),
    ))
}

#[cfg(not(windows))]
pub fn get_api_key(_channel: AiProviderChannel) -> AppResult<Option<String>> {
    Ok(None)
}
