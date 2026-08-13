use std::ffi::OsStr;
use std::path::Path;

use crate::error::{AppError, AppResult};

#[cfg(windows)]
mod windows_shell {
    use std::iter::once;
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;
    use std::ptr;

    use windows_sys::Win32::Foundation::RPC_E_CHANGED_MODE;
    use windows_sys::Win32::System::Com::{
        CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED,
    };
    use windows_sys::Win32::UI::Shell::{ILCreateFromPathW, ILFree, SHOpenFolderAndSelectItems};

    use crate::error::{AppError, AppResult};

    struct ComApartment {
        must_uninitialize: bool,
    }

    impl ComApartment {
        fn enter() -> AppResult<Self> {
            let result = unsafe { CoInitializeEx(ptr::null(), COINIT_APARTMENTTHREADED as u32) };
            if result >= 0 {
                return Ok(Self {
                    must_uninitialize: true,
                });
            }
            // Tauri 的异步线程可能已经用另一种 apartment 模型初始化 COM。
            // 此时线程仍具备 COM 环境，只是不应由本调用反向 CoUninitialize。
            if result == RPC_E_CHANGED_MODE {
                return Ok(Self {
                    must_uninitialize: false,
                });
            }
            Err(AppError::Conflict(format!(
                "Windows 文件管理器初始化失败（HRESULT 0x{:08X}）",
                result as u32
            )))
        }
    }

    impl Drop for ComApartment {
        fn drop(&mut self) {
            if self.must_uninitialize {
                unsafe { CoUninitialize() };
            }
        }
    }

    struct ItemIdList(*mut windows_sys::Win32::UI::Shell::Common::ITEMIDLIST);

    impl Drop for ItemIdList {
        fn drop(&mut self) {
            unsafe { ILFree(self.0) };
        }
    }

    /// Rust 的 canonicalize 在 Windows 会返回 `\\?\` 长路径。
    /// 该形式可安全用于文件 I/O，但 Shell 的 `ILCreateFromPathW` 只接受普通
    /// 显示路径；这里仅在交给 Shell 前移除前缀，受控目录校验仍使用原始路径。
    fn path_to_wide(path: &Path) -> Vec<u16> {
        const VERBATIM_PREFIX: [u16; 4] = [b'\\' as u16, b'\\' as u16, b'?' as u16, b'\\' as u16];
        const VERBATIM_UNC_PREFIX: [u16; 8] = [
            b'\\' as u16,
            b'\\' as u16,
            b'?' as u16,
            b'\\' as u16,
            b'U' as u16,
            b'N' as u16,
            b'C' as u16,
            b'\\' as u16,
        ];

        let source = path.as_os_str().encode_wide().collect::<Vec<_>>();
        let mut shell_path = Vec::with_capacity(source.len() + 1);
        if source.starts_with(&VERBATIM_UNC_PREFIX) {
            shell_path.extend_from_slice(&[b'\\' as u16, b'\\' as u16]);
            shell_path.extend_from_slice(&source[VERBATIM_UNC_PREFIX.len()..]);
        } else if source.starts_with(&VERBATIM_PREFIX) {
            shell_path.extend_from_slice(&source[VERBATIM_PREFIX.len()..]);
        } else {
            shell_path.extend_from_slice(&source);
        }
        shell_path.extend(once(0));
        shell_path
    }

    pub(super) fn reveal_path(path: &Path) -> AppResult<()> {
        let _com = ComApartment::enter()?;
        let parent_path = path
            .parent()
            .ok_or_else(|| AppError::Validation("要定位的文件缺少父目录".to_string()))?;
        let wide_parent_path = path_to_wide(parent_path);
        let parent = ItemIdList(unsafe { ILCreateFromPathW(wide_parent_path.as_ptr()) });
        if parent.0.is_null() {
            return Err(AppError::Conflict(
                "Windows 文件管理器无法识别目标文件夹".to_string(),
            ));
        }

        let wide_path = path_to_wide(path);
        let item = ItemIdList(unsafe { ILCreateFromPathW(wide_path.as_ptr()) });
        if item.0.is_null() {
            return Err(AppError::Conflict(
                "Windows 文件管理器无法识别要定位的文件".to_string(),
            ));
        }

        // Shell 的第一个 PIDL 必须是“要打开的文件夹”；待选中文件通过 apidl
        // 作为独立的绝对 PIDL 传入。上一版把文件 PIDL 误当文件夹且 cidl=0，
        // 会导致所有文件类型均被 Shell 拒绝。
        let selected = [item.0 as *const _];
        let result = unsafe {
            SHOpenFolderAndSelectItems(parent.0, selected.len() as u32, selected.as_ptr(), 0)
        };
        if result < 0 {
            return Err(AppError::Conflict(format!(
                "Windows 文件管理器未能选中目标文件（HRESULT 0x{:08X}）",
                result as u32
            )));
        }
        Ok(())
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn wide_path_preserves_unicode_and_has_one_terminal_null() {
            let path =
                Path::new(r"D:\南枫知识库\attachments\2026-07-24 这是皮条客最好的时代 #AI.mp4");
            let wide = path_to_wide(path);
            assert_eq!(wide.last(), Some(&0));
            assert_eq!(wide.iter().filter(|value| **value == 0).count(), 1);
            assert_eq!(
                String::from_utf16_lossy(&wide[..wide.len() - 1]),
                path.to_string_lossy()
            );
        }

        #[test]
        fn wide_path_converts_verbatim_paths_to_shell_display_paths() {
            let drive_path = Path::new(r"\\?\D:\南枫知识库\attachments\example #1.png");
            let unc_path = Path::new(r"\\?\UNC\server\share\南枫知识库\example #1.png");

            let drive_wide = path_to_wide(drive_path);
            let unc_wide = path_to_wide(unc_path);

            assert_eq!(
                String::from_utf16_lossy(&drive_wide[..drive_wide.len() - 1]),
                r"D:\南枫知识库\attachments\example #1.png"
            );
            assert_eq!(
                String::from_utf16_lossy(&unc_wide[..unc_wide.len() - 1]),
                r"\\server\share\南枫知识库\example #1.png"
            );
        }

        #[test]
        #[ignore = "会真实打开 Windows 资源管理器；仅在显式提供 NF_REVEAL_TEST_PATH 时运行"]
        fn native_shell_accepts_an_existing_file() {
            let path = std::env::var_os("NF_REVEAL_TEST_PATH")
                .map(std::path::PathBuf::from)
                .expect("NF_REVEAL_TEST_PATH must point to a real file");
            assert!(path.is_file(), "integration test target must exist");
            reveal_path(&path).expect("Windows Shell should select the exact file");
        }
    }
}

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

/// 在系统文件管理器中显示文件，并在 Windows 上直接选中目标。
/// 调用方必须先完成自己的受控目录与文件存在性校验。
pub fn reveal_path(path: &Path) -> AppResult<()> {
    if !path.is_file() {
        return Err(AppError::NotFound("要定位的文件不存在".to_string()));
    }
    allow_external_app_foreground();
    #[cfg(target_os = "windows")]
    {
        return windows_shell::reveal_path(path);
    }
    #[cfg(not(target_os = "windows"))]
    open_target(
        path.parent()
            .ok_or_else(|| AppError::Validation("文件缺少父目录".to_string()))?
            .as_os_str(),
    )
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
