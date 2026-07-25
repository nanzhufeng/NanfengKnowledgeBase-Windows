mod commands;
mod database;
mod error;
mod importer;
mod models;
mod paths;
mod transfer;

use commands::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let paths = paths::AppPaths::from_app(app.handle())?;
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
