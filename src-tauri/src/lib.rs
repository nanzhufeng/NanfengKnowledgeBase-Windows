pub mod ai;
mod attachments;
pub mod chatgpt_export;
mod commands;
mod data_optimization;
mod database;
mod error;
mod external_open;
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
            let connection = database::open_database(&paths.database)?;
            let recovered_ai_tasks = ai::repository::recover_stale_ai_tasks(&connection)?;
            // Asset protocol 采用“已登记附件逐文件授权”：拒绝把整个附件目录作为
            // WebView 可读根目录，附件记录外的文件不能仅凭路径被页面加载。
            attachments::allow_known_attachment_assets(app.handle(), &connection, &paths)?;
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
            if recovered_ai_tasks > 0 {
                log::warn!("已安全中断 {} 个上次遗留的 AI 任务", recovered_ai_tasks);
            }

            app.manage(AppState::new(connection, paths, instance_guard));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_runtime_build_info,
            commands::get_ai_settings,
            commands::save_ai_settings,
            commands::reveal_ai_api_key,
            commands::refresh_ai_models,
            commands::get_ai_topic_insight,
            commands::run_ai_topic_insight,
            commands::get_latest_ai_taxonomy_revision,
            commands::get_applied_ai_taxonomy_revision,
            commands::get_resumable_ai_taxonomy_run,
            commands::discard_ai_taxonomy_run,
            commands::run_ai_taxonomy_revision,
            commands::run_ai_incremental_taxonomy_revision,
            commands::apply_ai_taxonomy_revision,
            commands::undo_ai_taxonomy_revision,
            commands::get_data_location,
            commands::inspect_data_migration,
            commands::migrate_data_directory,
            commands::rollback_data_directory_switch,
            commands::get_storage_stats,
            commands::inspect_data_optimization,
            commands::optimize_data,
            commands::open_data_directory,
            commands::copy_exported_file,
            commands::list_knowledge_inbox,
            commands::list_knowledge_source_archive,
            commands::count_knowledge_source_archive,
            commands::search_knowledge_source_archive,
            commands::update_knowledge_source_title,
            commands::list_knowledge_source_collections,
            commands::rename_knowledge_source_collection,
            commands::ensure_knowledge_source_action_record,
            commands::get_knowledge_source_original_text,
            commands::list_knowledge_source_attachments,
            commands::recover_knowledge_source_attachment,
            commands::search_knowledge_source_attachment_catalog,
            commands::hydrate_knowledge_source_attachments,
            commands::list_knowledge_domains,
            commands::list_knowledge_topics,
            commands::list_knowledge_topic_aliases,
            commands::create_knowledge_topic_alias,
            commands::update_knowledge_topic_alias,
            commands::delete_knowledge_topic_alias,
            commands::list_knowledge_entities,
            commands::create_knowledge_entity,
            commands::update_knowledge_entity,
            commands::delete_knowledge_entity,
            commands::create_knowledge_domain,
            commands::update_knowledge_domain,
            commands::create_knowledge_topic,
            commands::update_knowledge_topic,
            commands::confirm_knowledge_classification,
            commands::undo_knowledge_classification,
            commands::get_knowledge_topic_detail,
            commands::list_knowledge_notes,
            commands::get_knowledge_note,
            commands::create_knowledge_note,
            commands::update_knowledge_note,
            commands::archive_knowledge_note,
            commands::create_knowledge_proposition,
            commands::update_knowledge_proposition,
            commands::supersede_knowledge_proposition,
            commands::create_knowledge_decision,
            commands::update_knowledge_decision,
            commands::create_knowledge_turning_point,
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
            commands::reveal_exported_file,
            commands::list_attachments,
            commands::search_attachments,
            commands::inspect_legacy_attachment_recovery,
            commands::recover_legacy_attachment_recovery,
            commands::add_attachment,
            commands::open_attachment,
            commands::reveal_attachment,
            commands::read_attachment_text,
            commands::open_external_url,
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
