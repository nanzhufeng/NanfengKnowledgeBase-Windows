mod commands;
mod database;
mod error;
mod importer;
mod models;
mod paths;
mod transfer;

use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

use commands::AppState;
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let paths = paths::AppPaths::from_app(app.handle())?;
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .clear_targets()
                    .target(Target::new(TargetKind::Folder {
                        path: paths.logs.clone(),
                        file_name: Some("nanfeng-intelligence".to_string()),
                    }))
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;
            install_panic_log(paths.logs.clone());
            log::info!("应用启动，数据目录：{}", paths.root.display());

            let connection = database::open_database(&paths.database)?;
            app.manage(AppState::new(connection, paths));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_data_location,
            commands::open_data_directory,
            commands::list_records,
            commands::get_record,
            commands::create_record,
            commands::update_record,
            commands::set_favorite,
            commands::move_to_trash,
            commands::restore_record,
            commands::permanently_delete_record,
            commands::append_version,
            commands::list_versions,
            commands::restore_version,
            commands::list_tags,
            commands::create_tag,
            commands::rename_tag,
            commands::delete_tag,
            commands::rebuild_search_index,
            commands::run_integrity_check,
            commands::prepare_import,
            commands::confirm_import,
            commands::export_record,
            commands::export_all_json,
            commands::create_backup,
            commands::restore_backup,
            commands::open_export_directory,
        ])
        .run(tauri::generate_context!())
        .expect("南枫情报台启动失败");
}

fn install_panic_log(log_directory: PathBuf) {
    let previous_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        let _ = std::fs::create_dir_all(&log_directory);
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_directory.join("panic.log"))
        {
            let _ = writeln!(
                file,
                "\n[{}] panic: {}\n{}",
                chrono::Local::now().to_rfc3339(),
                panic_info,
                std::backtrace::Backtrace::force_capture()
            );
        }
        previous_hook(panic_info);
    }));
}
