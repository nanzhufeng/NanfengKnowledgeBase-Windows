mod attachments;
pub mod chatgpt_export;
mod commands;
mod database;
mod error;
mod importer;
pub mod knowledge;
pub mod maintenance;
mod models;
mod paths;
mod transfer;

use std::fs::OpenOptions;
use std::io::Write;
use std::net::TcpListener;
use std::path::PathBuf;

use commands::AppState;
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let instance_guard = match TcpListener::bind("127.0.0.1:47633") {
                Ok(listener) => listener,
                Err(error) => {
                    eprintln!("南枫知识库已经在运行，本次重复启动已安全退出：{error}");
                    std::process::exit(0);
                }
            };
            instance_guard.set_nonblocking(true)?;
            let paths = paths::AppPaths::from_app(app.handle())?;
            app.asset_protocol_scope()
                .allow_directory(&paths.attachments, true)?;
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .clear_targets()
                    .target(Target::new(TargetKind::Folder {
                        path: paths.logs.clone(),
                        file_name: Some("nanfeng-knowledge-base".to_string()),
                    }))
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;
            install_panic_log(paths.logs.clone());
            log::info!("应用启动，数据目录：{}", paths.root.display());

            let connection = database::open_database(&paths.database)?;
            app.manage(AppState::new(connection, paths, instance_guard));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_data_location,
            commands::get_storage_stats,
            commands::open_data_directory,
            commands::list_knowledge_inbox,
            commands::list_knowledge_domains,
            commands::list_knowledge_topics,
            commands::prepare_knowledge_classification_context,
            commands::create_knowledge_domain,
            commands::create_knowledge_topic,
            commands::save_knowledge_classification_suggestions,
            commands::list_knowledge_classification_suggestions,
            commands::confirm_knowledge_classification,
            commands::undo_knowledge_classification,
            commands::get_knowledge_topic_detail,
            commands::add_knowledge_topic_judgment,
            commands::add_knowledge_topic_evidence,
            commands::add_knowledge_topic_question,
            commands::compile_knowledge_topic_context,
            commands::preview_knowledge_topic_merge,
            commands::merge_knowledge_topics,
            commands::undo_knowledge_topic_merge,
            commands::preview_knowledge_topic_split,
            commands::suggest_knowledge_topic_relations,
            commands::create_knowledge_topic_relation,
            commands::list_records,
            commands::list_record_summaries,
            commands::get_record,
            commands::create_record,
            commands::update_record,
            commands::patch_record,
            commands::set_favorite,
            commands::update_current_judgment,
            commands::update_status,
            commands::move_to_trash,
            commands::restore_record,
            commands::permanently_delete_record,
            commands::append_version,
            commands::list_versions,
            commands::delete_version,
            commands::restore_version,
            commands::list_tags,
            commands::create_tag,
            commands::rename_tag,
            commands::delete_tag,
            commands::rebuild_search_index,
            commands::run_integrity_check,
            commands::prepare_import,
            commands::confirm_import,
            commands::cancel_import,
            commands::list_import_jobs,
            commands::export_record,
            commands::write_docx_export,
            commands::write_markdown_export,
            commands::export_all_json,
            commands::export_records,
            commands::create_backup,
            commands::restore_backup,
            commands::inspect_backup,
            commands::create_portable_backup,
            commands::inspect_portable_backup,
            commands::restore_portable_backup,
            commands::open_export_directory,
            commands::list_attachments,
            commands::add_attachment,
            commands::open_attachment,
            commands::remove_attachment,
        ])
        .run(tauri::generate_context!())
        .expect("南枫知识库启动失败");
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
