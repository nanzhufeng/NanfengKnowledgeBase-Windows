use std::ffi::OsStr;
use std::path::Path;

use crate::error::{AppError, AppResult};

#[cfg(windows)]
fn allow_external_app_foreground() {
    // 当前点击来自前台窗口。把本次前台激活权限交给系统默认应用，
    // 避免图片查看器或浏览器只在任务栏闪烁、仍需用户再次点击。
    unsafe {
        windows_sys::Win32::UI::WindowsAndMessaging::AllowSetForegroundWindow(u32::MAX);
    }
}

#[cfg(not(windows))]
fn allow_external_app_foreground() {}

fn open_target(target: impl AsRef<OsStr>) -> AppResult<()> {
    allow_external_app_foreground();
    // Windows 使用 ShellExecuteExW + SW_SHOWNORMAL 直接交给系统默认应用，
    // 避免经 PowerShell Start-Process 中转后只在任务栏生成后台窗口。
    open::that_detached(target)
        .map_err(|error| AppError::Io(std::io::Error::other(error.to_string())))
}

pub fn open_path(path: &Path) -> AppResult<()> {
    open_target(path.as_os_str())
}

pub fn open_url(url: &str) -> AppResult<()> {
    let target = url.trim();
    let scheme = target
        .split_once(':')
        .map(|(scheme, _)| scheme.to_ascii_lowercase())
        .ok_or_else(|| AppError::Validation("外部链接缺少协议".to_string()))?;
    if !matches!(scheme.as_str(), "http" | "https" | "mailto" | "tel") {
        return Err(AppError::Validation(
            "只允许打开 http、https、mailto 或 tel 外部链接".to_string(),
        ));
    }
    open_target(target)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn external_url_requires_an_explicit_safe_scheme() {
        for target in [
            "javascript:alert(1)",
            "file:///C:/secret.txt",
            "relative/path",
        ] {
            assert!(open_url(target).is_err());
        }
    }
}
