use std::fs::File;
use std::io::{BufReader, Read};
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex, MutexGuard};

use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::State;

use crate::database;
use crate::error::{AppError, AppResult, CommandError};
use crate::importer::{ConfirmImportInput, ImportJobSummary, ImportPreview, ImportResult};
use crate::models::{
    AppendVersionInput, AttachmentItem, AttachmentSearchHit, CreateRecordInput, CreateTagInput,
    DataLocation, DataMigrationPreview, DataMigrationResult, DataOptimizationPreview,
    DataOptimizationResult, DeleteVersionInput, FavoriteUpdate, IntelligenceRecord,
    LegacyAttachmentRecoveryPreview, LegacyAttachmentRecoveryResult, PatchRecordInput,
    PermanentDeleteInput, RecordMutation, RecordQuery, RecordSummary, RecordVersion,
    RenameTagInput, RestoreVersionInput, StorageStats, TagItem, UpdateJudgmentInput,
    UpdateRecordInput, UpdateStatusInput,
};
use crate::paths::AppPaths;
use crate::transfer::{
    BackupPreview, ExportRecordsInput, ExportResult, PortableBackupPreview, PortableBackupResult,
    PortableRestoreResult, RestoreResult,
};

pub struct AppState {
    connection: Arc<Mutex<Connection>>,
    paths: AppPaths,
    _instance_guard: TcpListener,
}

impl AppState {
    pub fn new(connection: Connection, paths: AppPaths, instance_guard: TcpListener) -> Self {
        Self {
            connection: Arc::new(Mutex::new(connection)),
            paths,
            _instance_guard: instance_guard,
        }
    }

    fn connection(&self) -> AppResult<MutexGuard<'_, Connection>> {
        self.connection
            .lock()
            .map_err(|_| AppError::Conflict("数据库连接暂时不可用，请重启应用后重试".to_string()))
    }
}

fn command<T>(result: AppResult<T>) -> Result<T, CommandError> {
    result.map_err(CommandError::from)
}

fn background_task_error(error: impl std::fmt::Display) -> CommandError {
    CommandError::from(AppError::Conflict(format!("后台文件任务异常结束：{error}")))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeBuildInfo {
    version: &'static str,
    build_label: &'static str,
    executable_size_bytes: u64,
    executable_sha256: String,
}

#[tauri::command(async)]
pub async fn get_runtime_build_info() -> Result<RuntimeBuildInfo, CommandError> {
    tauri::async_runtime::spawn_blocking(|| -> AppResult<RuntimeBuildInfo> {
        let executable = std::env::current_exe().map_err(AppError::Io)?;
        let executable_size_bytes = executable.metadata().map_err(AppError::Io)?.len();
        let file = File::open(&executable).map_err(AppError::Io)?;
        let mut reader = BufReader::new(file);
        let mut hasher = Sha256::new();
        let mut buffer = [0_u8; 1024 * 1024];
        loop {
            let count = reader.read(&mut buffer).map_err(AppError::Io)?;
            if count == 0 {
                break;
            }
            hasher.update(&buffer[..count]);
        }
        Ok(RuntimeBuildInfo {
            version: env!("CARGO_PKG_VERSION"),
            build_label: option_env!("NF_BUILD_LABEL").unwrap_or("development"),
            executable_size_bytes,
            executable_sha256: hex::encode_upper(hasher.finalize()),
        })
    })
    .await
    .map_err(background_task_error)?
    .map_err(CommandError::from)
}

#[tauri::command(async)]
pub fn get_data_location(state: State<'_, AppState>) -> DataLocation {
    state.paths.location()
}

#[tauri::command(async)]
pub fn get_ai_settings(
    state: State<'_, AppState>,
) -> Result<crate::ai::models::AiSettingsView, CommandError> {
    let connection = command(state.connection())?;
    command(crate::ai::repository::get_settings(&connection))
}

#[tauri::command(async)]
pub fn save_ai_settings(
    state: State<'_, AppState>,
    input: crate::ai::models::SaveAiSettingsInput,
) -> Result<crate::ai::models::AiSettingsView, CommandError> {
    let connection = command(state.connection())?;
    command(crate::ai::repository::save_settings(&connection, &input))
}

#[tauri::command(async)]
pub async fn refresh_ai_models(
    state: State<'_, AppState>,
    input: crate::ai::models::RefreshAiModelsInput,
) -> Result<crate::ai::models::AiSettingsView, CommandError> {
    if let Some(api_key) = input.api_key.as_deref() {
        if !api_key.trim().is_empty() {
            command(crate::ai::credentials::save_api_key(input.channel, api_key))?;
        }
    }
    let api_key = command(crate::ai::credentials::get_api_key(input.channel))?
        .ok_or_else(|| CommandError::from(AppError::Validation("请先填写并保存 API Key".to_string())))?;
    let channel = input.channel;
    let models = tauri::async_runtime::spawn_blocking(move || {
        crate::ai::client::refresh_models(channel, &api_key)
    })
    .await
    .map_err(background_task_error)?
    .map_err(CommandError::from)?;
    let connection = command(state.connection())?;
    command(crate::ai::repository::save_model_catalog(
        &connection,
        channel,
        &models,
    ))?;
    command(crate::ai::repository::get_settings(&connection))
}

#[tauri::command(async)]
pub fn get_ai_topic_insight(
    state: State<'_, AppState>,
    topic_id: i64,
) -> Result<Option<crate::ai::models::AiTopicInsightView>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::ai::repository::get_topic_insight(&connection, topic_id))
}

#[tauri::command(async)]
pub async fn run_ai_topic_insight(
    state: State<'_, AppState>,
    topic_id: i64,
) -> Result<crate::ai::models::AiTopicInsightView, CommandError> {
    let (channel, model_id, descriptor, context, task_public_id) = {
        let connection = command(state.connection())?;
        let (channel, model_id) = command(crate::ai::repository::active_selection(&connection))?;
        let descriptor = command(crate::ai::repository::model_descriptor(
            &connection,
            channel,
            &model_id,
        ))?;
        let context = command(crate::knowledge::repository::compile_topic_context(
            &connection,
            topic_id,
        ))?;
        let task_public_id = command(crate::ai::repository::begin_topic_insight_task(
            &connection,
            topic_id,
            channel,
            &model_id,
        ))?;
        (channel, model_id, descriptor, context, task_public_id)
    };
    let api_key = match crate::ai::credentials::get_api_key(channel) {
        Ok(Some(value)) => value,
        Ok(None) => {
            let message = "当前 AI 通道尚未保存 API Key";
            if let Ok(connection) = state.connection() {
                let _ = crate::ai::repository::fail_task(&connection, &task_public_id, message);
            }
            return Err(CommandError::from(AppError::Validation(message.to_string())));
        }
        Err(error) => {
            let message = error.to_string();
            if let Ok(connection) = state.connection() {
                let _ = crate::ai::repository::fail_task(&connection, &task_public_id, &message);
            }
            return Err(CommandError::from(error));
        }
    };
    let run_channel = channel;
    let run_model_id = model_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        crate::ai::client::run_topic_insight(
            run_channel,
            &api_key,
            &run_model_id,
            &context,
            descriptor.as_ref(),
        )
    })
    .await
    .map_err(background_task_error)?;
    match result {
        Ok(result) => {
            let connection = command(state.connection())?;
            command(crate::ai::repository::complete_topic_insight_task(
                &connection,
                &task_public_id,
                topic_id,
                channel,
                &model_id,
                &result.insight,
                &result.usage,
            ))
        }
        Err(error) => {
            let message = error.to_string();
            if let Ok(connection) = state.connection() {
                let _ = crate::ai::repository::fail_task(&connection, &task_public_id, &message);
            }
            Err(CommandError::from(error))
        }
    }
}

#[tauri::command(async)]
pub async fn inspect_data_migration(
    state: State<'_, AppState>,
    target_root: String,
) -> Result<DataMigrationPreview, CommandError> {
    let paths = state.paths.clone();
    tauri::async_runtime::spawn_blocking(move || paths.inspect_data_migration(target_root))
        .await
        .map_err(background_task_error)?
        .map_err(CommandError::from)
}

#[tauri::command(async)]
pub async fn migrate_data_directory(
    state: State<'_, AppState>,
    target_root: String,
    confirmed: bool,
) -> Result<DataMigrationResult, CommandError> {
    if !confirmed {
        return Err(CommandError::from(AppError::Validation(
            "需要用户确认后才会复制并切换数据目录".to_string(),
        )));
    }
    let connection = Arc::clone(&state.connection);
    let paths = state.paths.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let connection = connection.lock().map_err(|_| {
            AppError::Conflict("数据库连接暂时不可用，请重启应用后重试".to_string())
        })?;
        paths.migrate_data_directory(&connection, target_root)
    })
    .await
    .map_err(background_task_error)?
    .map_err(CommandError::from)
}

#[tauri::command(async)]
pub fn rollback_data_directory_switch(state: State<'_, AppState>) -> Result<String, CommandError> {
    command(state.paths.rollback_next_data_root())
}

#[tauri::command(async)]
pub fn get_storage_stats(state: State<'_, AppState>) -> Result<StorageStats, CommandError> {
    let connection = command(state.connection())?;
    command(state.paths.storage_stats(&connection))
}

#[tauri::command(async)]
pub async fn inspect_data_optimization(
    state: State<'_, AppState>,
) -> Result<DataOptimizationPreview, CommandError> {
    let connection = Arc::clone(&state.connection);
    let paths = state.paths.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let connection = connection.lock().map_err(|_| {
            AppError::Conflict("数据库连接暂时不可用，请重启应用后重试".to_string())
        })?;
        crate::data_optimization::inspect(&connection, &paths)
    })
    .await
    .map_err(background_task_error)?
    .map_err(CommandError::from)
}

#[tauri::command(async)]
pub async fn optimize_data(
    state: State<'_, AppState>,
    confirmed: bool,
) -> Result<DataOptimizationResult, CommandError> {
    let connection = Arc::clone(&state.connection);
    let paths = state.paths.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let connection = connection.lock().map_err(|_| {
            AppError::Conflict("数据库连接暂时不可用，请重启应用后重试".to_string())
        })?;
        crate::data_optimization::execute(&connection, &paths, confirmed)
    })
    .await
    .map_err(background_task_error)?
    .map_err(CommandError::from)
}

#[tauri::command(async)]
pub fn open_data_directory(state: State<'_, AppState>) -> Result<(), CommandError> {
    command(
        open::that(&state.paths.root)
            .map_err(|error| AppError::Io(std::io::Error::other(error.to_string()))),
    )
}

#[tauri::command(async)]
pub fn copy_exported_file(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<(), CommandError> {
    let requested = PathBuf::from(file_path);
    let canonical = command(requested.canonicalize().map_err(AppError::Io))?;
    let export_root = command(state.paths.exports.canonicalize().map_err(AppError::Io))?;
    if !canonical.is_file() || !canonical.starts_with(&export_root) {
        return Err(CommandError::from(AppError::Validation(
            "只能复制由南枫知识库导出目录生成的文件".to_string(),
        )));
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let status = command(
            Command::new("powershell.exe")
                .creation_flags(CREATE_NO_WINDOW)
                .args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-STA",
                    "-Command",
                    "Add-Type -AssemblyName System.Windows.Forms; \
                     $files = New-Object System.Collections.Specialized.StringCollection; \
                     [void]$files.Add((Resolve-Path -LiteralPath $args[0]).Path); \
                     [System.Windows.Forms.Clipboard]::SetFileDropList($files)",
                ])
                .arg(canonical.as_os_str())
                .status()
                .map_err(AppError::Io),
        )?;
        if !status.success() {
            return Err(CommandError::from(AppError::Conflict(
                "文件已导出，但复制到 Windows 剪贴板失败".to_string(),
            )));
        }
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    Err(CommandError::from(AppError::Validation(
        "当前系统暂不支持复制文件对象".to_string(),
    )))
}

#[tauri::command(async)]
pub fn list_knowledge_inbox(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<crate::knowledge::repository::KnowledgeInboxItem>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::list_inbox(
        &connection,
        limit.unwrap_or(500),
    ))
}

#[tauri::command(async)]
pub fn list_knowledge_source_archive(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<crate::knowledge::repository::KnowledgeInboxItem>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::list_source_archive(
        &connection,
        limit.unwrap_or(500),
    ))
}

#[tauri::command(async)]
pub fn count_knowledge_source_archive(state: State<'_, AppState>) -> Result<i64, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::count_source_archive(
        &connection,
    ))
}

#[tauri::command(async)]
pub fn search_knowledge_source_archive(
    state: State<'_, AppState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<crate::knowledge::repository::KnowledgeInboxItem>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::search_source_archive(
        &connection,
        &query,
        limit.unwrap_or(2_000),
    ))
}

#[tauri::command(async)]
pub fn update_knowledge_source_title(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::UpdateKnowledgeSourceTitleInput,
) -> Result<crate::knowledge::repository::KnowledgeSourceTitleUpdate, CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::knowledge::repository::update_source_title(
        &mut connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn list_knowledge_source_collections(
    state: State<'_, AppState>,
) -> Result<Vec<crate::knowledge::repository::SourceCollectionRow>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::list_source_collections(
        &connection,
    ))
}

#[tauri::command(async)]
pub fn rename_knowledge_source_collection(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::RenameSourceCollectionInput,
) -> Result<crate::knowledge::repository::SourceCollectionRow, CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::knowledge::repository::rename_source_collection(
        &mut connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn ensure_knowledge_source_action_record(
    state: State<'_, AppState>,
    source_item_id: i64,
) -> Result<crate::models::IntelligenceRecord, CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::database::ensure_source_action_record(
        &mut connection,
        source_item_id,
    ))
}

#[tauri::command(async)]
pub fn get_knowledge_source_original_text(
    state: State<'_, AppState>,
    source_item_id: i64,
) -> Result<String, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::get_source_original_text(
        &connection,
        source_item_id,
    ))
}

#[tauri::command(async)]
pub fn list_knowledge_source_attachments(
    state: State<'_, AppState>,
    source_item_id: i64,
) -> Result<Vec<AttachmentItem>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::attachments::list_source_attachments(
        &connection,
        source_item_id,
    ))
}

#[tauri::command(async)]
pub async fn recover_knowledge_source_attachment(
    state: State<'_, AppState>,
    source_item_id: i64,
    attachment_id: String,
    confirmed: bool,
) -> Result<AttachmentItem, CommandError> {
    if !confirmed {
        return Err(CommandError::from(AppError::Validation(
            "需要用户确认后才会从历史导出包恢复附件".to_string(),
        )));
    }
    let connection = Arc::clone(&state.connection);
    let paths = state.paths.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut connection = connection.lock().map_err(|_| {
            AppError::Conflict("数据库连接暂时不可用，请重启应用后重试".to_string())
        })?;
        crate::attachments::recover_source_attachment(
            &mut connection,
            &paths,
            source_item_id,
            &attachment_id,
        )
    })
    .await
    .map_err(background_task_error)?
    .map_err(CommandError::from)
}

#[tauri::command(async)]
pub fn search_knowledge_source_attachment_catalog(
    state: State<'_, AppState>,
    keyword: Option<String>,
    category: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<crate::models::SourceAttachmentCatalogHit>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::attachments::search_source_attachment_catalog(
        &connection,
        keyword,
        category,
        limit,
    ))
}

#[tauri::command(async)]
pub async fn hydrate_knowledge_source_attachments(
    state: State<'_, AppState>,
    source_item_id: i64,
    attachment_ids: Vec<String>,
) -> Result<crate::models::SourceAttachmentHydrationResult, CommandError> {
    let connection = Arc::clone(&state.connection);
    let paths = state.paths.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut connection = connection.lock().map_err(|_| {
            AppError::Conflict("数据库连接暂时不可用，请重启应用后重试".to_string())
        })?;
        Ok::<_, AppError>(crate::attachments::hydrate_source_attachments(
            &mut connection,
            &paths,
            source_item_id,
            attachment_ids,
        ))
    })
    .await
    .map_err(background_task_error)?
    .map_err(CommandError::from)
}

#[tauri::command(async)]
pub fn list_knowledge_domains(
    state: State<'_, AppState>,
) -> Result<Vec<crate::knowledge::repository::KnowledgeDomainRow>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::list_domains(&connection))
}

#[tauri::command(async)]
pub fn list_knowledge_topics(
    state: State<'_, AppState>,
) -> Result<Vec<crate::knowledge::repository::KnowledgeTopicRow>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::list_topics(&connection))
}

#[tauri::command(async)]
pub fn get_personal_topic_catalog_proposal(
) -> crate::knowledge::personal_catalog::PersonalCatalogProposal {
    crate::knowledge::repository::get_personal_catalog_proposal()
}

#[tauri::command(async)]
pub fn apply_personal_topic_catalog(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::ApplyPersonalCatalogInput,
) -> Result<crate::knowledge::repository::ApplyPersonalCatalogResult, CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::knowledge::repository::apply_personal_catalog(
        &mut connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn list_knowledge_topic_aliases(
    state: State<'_, AppState>,
    topic_id: Option<i64>,
) -> Result<Vec<crate::knowledge::repository::TopicAliasRow>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::list_topic_aliases(
        &connection,
        topic_id,
    ))
}

#[tauri::command(async)]
pub fn create_knowledge_topic_alias(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::CreateTopicAliasInput,
) -> Result<crate::knowledge::repository::TopicAliasRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::create_topic_alias(
        &connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn update_knowledge_topic_alias(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::UpdateTopicAliasInput,
) -> Result<crate::knowledge::repository::TopicAliasRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::update_topic_alias(
        &connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn delete_knowledge_topic_alias(
    state: State<'_, AppState>,
    id: i64,
) -> Result<crate::knowledge::repository::KnowledgeDeleteResult, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::delete_topic_alias(
        &connection,
        id,
    ))
}

#[tauri::command(async)]
pub fn list_knowledge_entities(
    state: State<'_, AppState>,
) -> Result<Vec<crate::knowledge::repository::EntityDictionaryRow>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::list_entity_dictionary(
        &connection,
    ))
}

#[tauri::command(async)]
pub fn create_knowledge_entity(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::CreateEntityDictionaryInput,
) -> Result<crate::knowledge::repository::EntityDictionaryRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::create_entity_dictionary_entry(&connection, &input))
}

#[tauri::command(async)]
pub fn update_knowledge_entity(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::UpdateEntityDictionaryInput,
) -> Result<crate::knowledge::repository::EntityDictionaryRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::update_entity_dictionary_entry(&connection, &input))
}

#[tauri::command(async)]
pub fn delete_knowledge_entity(
    state: State<'_, AppState>,
    id: i64,
) -> Result<crate::knowledge::repository::KnowledgeDeleteResult, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::delete_entity_dictionary_entry(&connection, id))
}

#[tauri::command(async)]
pub fn list_knowledge_classification_rules(
    state: State<'_, AppState>,
) -> Result<Vec<crate::knowledge::repository::ClassificationRuleRow>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::list_classification_rules(
        &connection,
    ))
}

#[tauri::command(async)]
pub fn create_knowledge_classification_rule(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::CreateClassificationRuleInput,
) -> Result<crate::knowledge::repository::ClassificationRuleRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::create_classification_rule(
        &connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn update_knowledge_classification_rule(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::UpdateClassificationRuleInput,
) -> Result<crate::knowledge::repository::ClassificationRuleRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::update_classification_rule(
        &connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn delete_knowledge_classification_rule(
    state: State<'_, AppState>,
    id: i64,
) -> Result<crate::knowledge::repository::KnowledgeDeleteResult, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::delete_classification_rule(
        &connection,
        id,
    ))
}

#[tauri::command(async)]
pub fn prepare_knowledge_classification_context(
    state: State<'_, AppState>,
    source_item_id: i64,
) -> Result<crate::knowledge::repository::KnowledgeClassificationContext, CommandError> {
    let connection = command(state.connection())?;
    command(
        crate::knowledge::repository::prepare_classification_context(&connection, source_item_id),
    )
}

#[tauri::command(async)]
pub fn create_knowledge_domain(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::CreateKnowledgeDomainInput,
) -> Result<crate::knowledge::repository::KnowledgeDomainRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::create_domain(
        &connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn update_knowledge_domain(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::UpdateKnowledgeDomainInput,
) -> Result<crate::knowledge::repository::KnowledgeDomainRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::update_domain(
        &connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn create_knowledge_topic(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::CreateKnowledgeTopicInput,
) -> Result<crate::knowledge::repository::KnowledgeTopicRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::create_topic(
        &connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn update_knowledge_topic(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::UpdateKnowledgeTopicInput,
) -> Result<crate::knowledge::repository::KnowledgeTopicRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::update_topic(
        &connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn save_knowledge_classification_suggestions(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::SaveKnowledgeSuggestionsInput,
) -> Result<Vec<crate::knowledge::repository::KnowledgeClassificationSuggestionRow>, CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::knowledge::repository::save_classification_suggestions(&mut connection, &input))
}

#[tauri::command(async)]
pub fn list_knowledge_classification_suggestions(
    state: State<'_, AppState>,
    source_item_id: i64,
) -> Result<Vec<crate::knowledge::repository::KnowledgeClassificationSuggestionRow>, CommandError> {
    let connection = command(state.connection())?;
    command(
        crate::knowledge::repository::list_classification_suggestions(&connection, source_item_id),
    )
}

#[tauri::command(async)]
pub fn list_knowledge_classification_run_source_ids(
    state: State<'_, AppState>,
    classifier_version: String,
) -> Result<Vec<i64>, CommandError> {
    let connection = command(state.connection())?;
    command(
        crate::knowledge::repository::list_classification_run_source_ids(
            &connection,
            &classifier_version,
        ),
    )
}

#[tauri::command(async)]
pub fn confirm_knowledge_classification(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::ConfirmKnowledgeClassificationInput,
) -> Result<crate::knowledge::repository::KnowledgeOperationResult, CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::knowledge::repository::confirm_classification(
        &mut connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn undo_knowledge_classification(
    state: State<'_, AppState>,
    operation_id: i64,
) -> Result<crate::knowledge::repository::KnowledgeOperationResult, CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::knowledge::repository::undo_classification(
        &mut connection,
        operation_id,
    ))
}

#[tauri::command(async)]
pub fn get_knowledge_topic_detail(
    state: State<'_, AppState>,
    topic_id: i64,
) -> Result<crate::knowledge::repository::KnowledgeTopicDetail, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::get_topic_detail(
        &connection,
        topic_id,
    ))
}

#[tauri::command(async)]
pub fn list_knowledge_notes(
    state: State<'_, AppState>,
    topic_id: Option<i64>,
    include_archived: Option<bool>,
) -> Result<Vec<crate::knowledge::repository::KnowledgeNoteRow>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::list_notes(
        &connection,
        topic_id,
        include_archived.unwrap_or(false),
    ))
}

#[tauri::command(async)]
pub fn get_knowledge_note(
    state: State<'_, AppState>,
    note_id: i64,
) -> Result<crate::knowledge::repository::KnowledgeNoteRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::get_note(&connection, note_id))
}

#[tauri::command(async)]
pub fn create_knowledge_note(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::CreateKnowledgeNoteInput,
) -> Result<crate::knowledge::repository::KnowledgeNoteRow, CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::knowledge::repository::create_note(
        &mut connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn update_knowledge_note(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::UpdateKnowledgeNoteInput,
) -> Result<crate::knowledge::repository::KnowledgeNoteRow, CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::knowledge::repository::update_note(
        &mut connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn archive_knowledge_note(
    state: State<'_, AppState>,
    note_id: i64,
) -> Result<crate::knowledge::repository::KnowledgeNoteRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::archive_note(
        &connection,
        note_id,
    ))
}

#[tauri::command(async)]
pub fn create_knowledge_proposition(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::CreateTopicPropositionInput,
) -> Result<crate::knowledge::repository::TopicPropositionRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::create_proposition(
        &connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn update_knowledge_proposition(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::UpdateTopicPropositionInput,
) -> Result<crate::knowledge::repository::TopicPropositionRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::update_proposition(
        &connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn supersede_knowledge_proposition(
    state: State<'_, AppState>,
    proposition_id: i64,
) -> Result<crate::knowledge::repository::TopicPropositionRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::supersede_proposition(
        &connection,
        proposition_id,
    ))
}

#[tauri::command(async)]
pub fn create_knowledge_decision(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::CreateTopicDecisionInput,
) -> Result<crate::knowledge::repository::TopicDecisionRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::create_decision(
        &connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn update_knowledge_decision(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::UpdateTopicDecisionInput,
) -> Result<crate::knowledge::repository::TopicDecisionRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::update_decision(
        &connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn create_knowledge_turning_point(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::CreateTopicTurningPointInput,
) -> Result<crate::knowledge::repository::TopicTurningPointRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::create_turning_point(
        &connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn add_knowledge_topic_judgment(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::AddTopicJudgmentInput,
) -> Result<crate::knowledge::repository::TopicJudgmentRow, CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::knowledge::repository::add_topic_judgment(
        &mut connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn add_knowledge_topic_evidence(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::AddTopicEvidenceInput,
) -> Result<crate::knowledge::repository::TopicEvidenceRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::add_topic_evidence(
        &connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn add_knowledge_topic_question(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::AddTopicQuestionInput,
) -> Result<crate::knowledge::repository::TopicQuestionRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::add_topic_question(
        &connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn compile_knowledge_topic_context(
    state: State<'_, AppState>,
    topic_id: i64,
) -> Result<String, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::compile_topic_context(
        &connection,
        topic_id,
    ))
}

#[tauri::command(async)]
pub fn preview_knowledge_topic_merge(
    state: State<'_, AppState>,
    source_topic_id: i64,
    target_topic_id: i64,
) -> Result<crate::knowledge::repository::TopicMergePreview, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::preview_topic_merge(
        &connection,
        source_topic_id,
        target_topic_id,
    ))
}

#[tauri::command(async)]
pub fn merge_knowledge_topics(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::MergeTopicsInput,
) -> Result<crate::knowledge::repository::TopicMergeResult, CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::knowledge::repository::merge_topics(
        &mut connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn undo_knowledge_topic_merge(
    state: State<'_, AppState>,
    operation_id: i64,
) -> Result<crate::knowledge::repository::TopicMergeResult, CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::knowledge::repository::undo_topic_merge(
        &mut connection,
        operation_id,
    ))
}

#[tauri::command(async)]
pub fn preview_knowledge_topic_split(
    state: State<'_, AppState>,
    topic_id: i64,
) -> Result<crate::knowledge::repository::TopicSplitPreview, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::preview_topic_split(
        &connection,
        topic_id,
    ))
}

#[tauri::command(async)]
pub fn suggest_knowledge_topic_relations(
    state: State<'_, AppState>,
) -> Result<Vec<crate::knowledge::repository::TopicRelationSuggestion>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::suggest_topic_relations(
        &connection,
    ))
}

#[tauri::command(async)]
pub fn create_knowledge_topic_relation(
    state: State<'_, AppState>,
    input: crate::knowledge::repository::CreateTopicRelationInput,
) -> Result<crate::knowledge::repository::TopicRelationRow, CommandError> {
    let connection = command(state.connection())?;
    command(crate::knowledge::repository::create_topic_relation(
        &connection,
        &input,
    ))
}

#[tauri::command(async)]
pub fn list_records(
    state: State<'_, AppState>,
    query: RecordQuery,
) -> Result<Vec<IntelligenceRecord>, CommandError> {
    let connection = command(state.connection())?;
    command(database::list_records(&connection, &query))
}

#[tauri::command(async)]
pub fn list_record_summaries(
    state: State<'_, AppState>,
    query: RecordQuery,
) -> Result<Vec<RecordSummary>, CommandError> {
    let connection = command(state.connection())?;
    command(database::list_record_summaries(&connection, &query))
}

#[tauri::command(async)]
pub fn get_record(
    state: State<'_, AppState>,
    record_id: i64,
) -> Result<IntelligenceRecord, CommandError> {
    let connection = command(state.connection())?;
    command(database::get_record(&connection, record_id))
}

#[tauri::command(async)]
pub fn create_record(
    state: State<'_, AppState>,
    input: CreateRecordInput,
) -> Result<IntelligenceRecord, CommandError> {
    let mut connection = command(state.connection())?;
    command(database::create_record(&mut connection, &input))
}

#[tauri::command(async)]
pub fn update_record(
    state: State<'_, AppState>,
    record_id: i64,
    input: UpdateRecordInput,
) -> Result<IntelligenceRecord, CommandError> {
    let mut connection = command(state.connection())?;
    command(database::update_record(&mut connection, record_id, &input))
}

#[tauri::command(async)]
pub fn patch_record(
    state: State<'_, AppState>,
    record_id: i64,
    input: PatchRecordInput,
) -> Result<RecordMutation, CommandError> {
    let mut connection = command(state.connection())?;
    command(database::patch_record(&mut connection, record_id, &input))
}

#[tauri::command(async)]
pub fn set_favorite(
    state: State<'_, AppState>,
    record_id: i64,
    is_favorite: bool,
) -> Result<FavoriteUpdate, CommandError> {
    let connection = command(state.connection())?;
    let update = command(database::set_favorite(&connection, record_id, is_favorite))?;
    log::info!(
        "收藏状态已更新：record_id={}, is_favorite={}",
        record_id,
        is_favorite
    );
    Ok(update)
}

#[tauri::command(async)]
pub fn update_current_judgment(
    state: State<'_, AppState>,
    input: UpdateJudgmentInput,
) -> Result<RecordMutation, CommandError> {
    let connection = command(state.connection())?;
    command(database::update_current_judgment(
        &connection,
        input.record_id,
        &input.current_judgment,
    ))
}

#[tauri::command(async)]
pub fn update_status(
    state: State<'_, AppState>,
    input: UpdateStatusInput,
) -> Result<RecordMutation, CommandError> {
    let connection = command(state.connection())?;
    command(database::update_status(
        &connection,
        input.record_id,
        &input.status,
    ))
}

#[tauri::command(async)]
pub fn move_to_trash(
    state: State<'_, AppState>,
    record_id: i64,
) -> Result<IntelligenceRecord, CommandError> {
    let connection = command(state.connection())?;
    command(database::move_to_trash(&connection, record_id))
}

#[tauri::command(async)]
pub fn restore_record(
    state: State<'_, AppState>,
    record_id: i64,
) -> Result<IntelligenceRecord, CommandError> {
    let connection = command(state.connection())?;
    command(database::restore_record(&connection, record_id))
}

#[tauri::command(async)]
pub fn permanently_delete_record(
    state: State<'_, AppState>,
    input: PermanentDeleteInput,
) -> Result<(), CommandError> {
    let mut connection = command(state.connection())?;
    command(database::permanently_delete_record(&mut connection, &input))
}

#[tauri::command(async)]
pub fn append_version(
    state: State<'_, AppState>,
    input: AppendVersionInput,
) -> Result<RecordVersion, CommandError> {
    let mut connection = command(state.connection())?;
    command(database::append_version(&mut connection, &input))
}

#[tauri::command(async)]
pub fn list_versions(
    state: State<'_, AppState>,
    record_id: i64,
) -> Result<Vec<RecordVersion>, CommandError> {
    let connection = command(state.connection())?;
    command(database::list_versions(&connection, record_id))
}

#[tauri::command(async)]
pub fn delete_version(
    state: State<'_, AppState>,
    input: DeleteVersionInput,
) -> Result<(), CommandError> {
    let connection = command(state.connection())?;
    command(database::delete_version(&connection, &input))
}

#[tauri::command(async)]
pub fn restore_version(
    state: State<'_, AppState>,
    input: RestoreVersionInput,
) -> Result<RecordVersion, CommandError> {
    let mut connection = command(state.connection())?;
    command(database::restore_version(&mut connection, &input))
}

#[tauri::command(async)]
pub fn list_tags(state: State<'_, AppState>) -> Result<Vec<TagItem>, CommandError> {
    let connection = command(state.connection())?;
    command(database::list_tags(&connection))
}

#[tauri::command(async)]
pub fn create_tag(
    state: State<'_, AppState>,
    input: CreateTagInput,
) -> Result<TagItem, CommandError> {
    let connection = command(state.connection())?;
    command(database::create_tag(&connection, &input))
}

#[tauri::command(async)]
pub fn rename_tag(
    state: State<'_, AppState>,
    input: RenameTagInput,
) -> Result<TagItem, CommandError> {
    let connection = command(state.connection())?;
    command(database::rename_tag(&connection, &input))
}

#[tauri::command(async)]
pub fn delete_tag(state: State<'_, AppState>, tag_id: i64) -> Result<(), CommandError> {
    let connection = command(state.connection())?;
    command(database::delete_tag(&connection, tag_id))
}

#[tauri::command(async)]
pub fn rebuild_search_index(state: State<'_, AppState>) -> Result<(), CommandError> {
    let connection = command(state.connection())?;
    command(database::rebuild_search_index(&connection))
}

#[tauri::command(async)]
pub fn run_integrity_check(state: State<'_, AppState>) -> Result<String, CommandError> {
    let connection = command(state.connection())?;
    command(database::integrity_check(&connection))
}

#[tauri::command(async)]
pub fn prepare_import(
    state: State<'_, AppState>,
    source_path: String,
) -> Result<ImportPreview, CommandError> {
    let connection = command(state.connection())?;
    command(crate::importer::prepare_import(
        &connection,
        &state.paths,
        source_path,
    ))
}

#[tauri::command(async)]
pub fn confirm_import(
    state: State<'_, AppState>,
    input: ConfirmImportInput,
) -> Result<ImportResult, CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::importer::confirm_import(
        &mut connection,
        &state.paths,
        &input,
    ))
}

#[tauri::command(async)]
pub fn cancel_import(state: State<'_, AppState>, job_id: String) -> Result<(), CommandError> {
    let connection = command(state.connection())?;
    command(crate::importer::cancel_import(&connection, &job_id))
}

#[tauri::command(async)]
pub fn list_import_jobs(state: State<'_, AppState>) -> Result<Vec<ImportJobSummary>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::importer::list_import_jobs(&connection))
}

#[tauri::command(async)]
pub fn export_record(
    state: State<'_, AppState>,
    record_id: i64,
    format: String,
) -> Result<ExportResult, CommandError> {
    let connection = command(state.connection())?;
    command(crate::transfer::export_record(
        &connection,
        &state.paths,
        record_id,
        &format,
    ))
}

#[tauri::command(async)]
pub fn write_docx_export(
    state: State<'_, AppState>,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<ExportResult, CommandError> {
    command(crate::transfer::write_docx_export(
        &state.paths,
        &file_name,
        &bytes,
    ))
}

#[tauri::command(async)]
pub fn write_markdown_export(
    state: State<'_, AppState>,
    file_name: String,
    content: String,
) -> Result<ExportResult, CommandError> {
    command(crate::transfer::write_markdown_export(
        &state.paths,
        &file_name,
        &content,
    ))
}

#[tauri::command(async)]
pub fn export_all_json(state: State<'_, AppState>) -> Result<ExportResult, CommandError> {
    let connection = command(state.connection())?;
    command(crate::transfer::export_all_json(&connection, &state.paths))
}

#[tauri::command(async)]
pub fn export_records(
    state: State<'_, AppState>,
    input: ExportRecordsInput,
) -> Result<ExportResult, CommandError> {
    let connection = command(state.connection())?;
    command(crate::transfer::export_records(
        &connection,
        &state.paths,
        &input,
    ))
}

#[tauri::command(async)]
pub async fn create_backup(state: State<'_, AppState>) -> Result<String, CommandError> {
    let connection = Arc::clone(&state.connection);
    let paths = state.paths.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let connection = connection.lock().map_err(|_| {
            AppError::Conflict("数据库连接暂时不可用，请重启应用后重试".to_string())
        })?;
        crate::transfer::create_backup(&connection, &paths, "手动备份")
            .map(|path| path.to_string_lossy().into_owned())
    })
    .await
    .map_err(background_task_error)?
    .map_err(CommandError::from)
}

#[tauri::command(async)]
pub async fn restore_backup(
    state: State<'_, AppState>,
    source_path: String,
) -> Result<RestoreResult, CommandError> {
    let connection = Arc::clone(&state.connection);
    let paths = state.paths.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut connection = connection.lock().map_err(|_| {
            AppError::Conflict("数据库连接暂时不可用，请重启应用后重试".to_string())
        })?;
        crate::transfer::restore_backup(&mut connection, &paths, source_path)
    })
    .await
    .map_err(background_task_error)?
    .map_err(CommandError::from)
}

#[tauri::command(async)]
pub async fn inspect_backup(source_path: String) -> Result<BackupPreview, CommandError> {
    tauri::async_runtime::spawn_blocking(move || crate::transfer::inspect_backup(source_path))
        .await
        .map_err(background_task_error)?
        .map_err(CommandError::from)
}

#[tauri::command(async)]
pub async fn create_portable_backup(
    state: State<'_, AppState>,
    preferences_json: String,
) -> Result<PortableBackupResult, CommandError> {
    let connection = Arc::clone(&state.connection);
    let paths = state.paths.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let connection = connection.lock().map_err(|_| {
            AppError::Conflict("数据库连接暂时不可用，请重启应用后重试".to_string())
        })?;
        crate::transfer::create_portable_backup(
            &connection,
            &paths,
            &preferences_json,
            "南枫知识库_完整迁移备份",
        )
    })
    .await
    .map_err(background_task_error)?
    .map_err(CommandError::from)
}

#[tauri::command(async)]
pub async fn inspect_portable_backup(
    source_path: String,
) -> Result<PortableBackupPreview, CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::transfer::inspect_portable_backup(source_path)
    })
    .await
    .map_err(background_task_error)?
    .map_err(CommandError::from)
}

#[tauri::command(async)]
pub async fn restore_portable_backup(
    state: State<'_, AppState>,
    source_path: String,
    current_preferences_json: String,
) -> Result<PortableRestoreResult, CommandError> {
    let connection = Arc::clone(&state.connection);
    let paths = state.paths.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut connection = connection.lock().map_err(|_| {
            AppError::Conflict("数据库连接暂时不可用，请重启应用后重试".to_string())
        })?;
        crate::transfer::restore_portable_backup(
            &mut connection,
            &paths,
            source_path,
            &current_preferences_json,
        )
    })
    .await
    .map_err(background_task_error)?
    .map_err(CommandError::from)
}

#[tauri::command(async)]
pub fn open_export_directory(state: State<'_, AppState>) -> Result<(), CommandError> {
    command(crate::transfer::open_export_directory(&state.paths))
}

#[tauri::command(async)]
pub fn reveal_exported_file(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<(), CommandError> {
    command(crate::transfer::reveal_exported_file(
        &state.paths,
        &file_path,
    ))
}

#[tauri::command(async)]
pub fn list_attachments(
    state: State<'_, AppState>,
    record_id: i64,
) -> Result<Vec<AttachmentItem>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::attachments::list_attachments(&connection, record_id))
}

#[tauri::command(async)]
pub fn search_attachments(
    state: State<'_, AppState>,
    keyword: Option<String>,
    category: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<AttachmentSearchHit>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::attachments::search_attachments(
        &connection,
        keyword,
        category,
        limit,
    ))
}

#[tauri::command(async)]
pub fn inspect_legacy_attachment_recovery(
    state: State<'_, AppState>,
    source_directory: Option<String>,
) -> Result<LegacyAttachmentRecoveryPreview, CommandError> {
    let connection = command(state.connection())?;
    command(crate::attachments::inspect_legacy_attachment_recovery(
        &connection,
        source_directory.as_deref(),
    ))
}

#[tauri::command(async)]
pub async fn recover_legacy_attachment_recovery(
    state: State<'_, AppState>,
    confirmed: bool,
    source_directory: Option<String>,
) -> Result<LegacyAttachmentRecoveryResult, CommandError> {
    if !confirmed {
        return Err(CommandError::from(AppError::Validation(
            "需要用户确认后才会恢复历史附件".to_string(),
        )));
    }
    let connection = Arc::clone(&state.connection);
    let paths = state.paths.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let connection = connection.lock().map_err(|_| {
            AppError::Conflict("数据库连接暂时不可用，请重启应用后重试".to_string())
        })?;
        crate::attachments::recover_legacy_attachments(
            &connection,
            &paths,
            source_directory.as_deref(),
        )
    })
    .await
    .map_err(background_task_error)?
    .map_err(CommandError::from)
}

#[tauri::command(async)]
pub async fn add_attachment(
    state: State<'_, AppState>,
    record_id: i64,
    source_path: String,
) -> Result<AttachmentItem, CommandError> {
    {
        let connection = command(state.connection())?;
        let exists = command(
            connection
                .query_row("SELECT 1 FROM records WHERE id = ?1", [record_id], |_| {
                    Ok(())
                })
                .optional()
                .map_err(AppError::from),
        )?
        .is_some();
        if !exists {
            return Err(CommandError::from(AppError::NotFound(
                "记录不存在".to_string(),
            )));
        }
    }

    let paths = state.paths.clone();
    let prepared = tauri::async_runtime::spawn_blocking(move || {
        crate::attachments::prepare_attachment(&paths, record_id, source_path)
    })
    .await
    .map_err(|error| {
        CommandError::from(AppError::Conflict(format!(
            "附件后台归档任务异常结束：{error}"
        )))
    })?
    .map_err(CommandError::from)?;

    let connection = command(state.connection())?;
    command(crate::attachments::commit_attachment(
        &connection,
        record_id,
        prepared,
    ))
}

#[tauri::command(async)]
pub fn open_attachment(state: State<'_, AppState>, attachment_id: i64) -> Result<(), CommandError> {
    let connection = command(state.connection())?;
    command(crate::attachments::open_attachment(
        &connection,
        &state.paths,
        attachment_id,
    ))
}

#[tauri::command(async)]
pub fn reveal_attachment(
    state: State<'_, AppState>,
    attachment_id: i64,
) -> Result<(), CommandError> {
    let connection = command(state.connection())?;
    command(crate::attachments::reveal_attachment(
        &connection,
        &state.paths,
        attachment_id,
    ))
}

#[tauri::command(async)]
pub fn read_attachment_text(
    state: State<'_, AppState>,
    attachment_id: i64,
) -> Result<String, CommandError> {
    let connection = command(state.connection())?;
    command(crate::attachments::read_attachment_text(
        &connection,
        &state.paths,
        attachment_id,
    ))
}

#[tauri::command(async)]
pub fn open_external_url(url: String) -> Result<(), CommandError> {
    command(crate::external_open::open_url(&url))
}

#[tauri::command(async)]
pub fn remove_attachment(
    state: State<'_, AppState>,
    attachment_id: i64,
) -> Result<(), CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::attachments::remove_attachment(
        &mut connection,
        &state.paths,
        attachment_id,
    ))
}
