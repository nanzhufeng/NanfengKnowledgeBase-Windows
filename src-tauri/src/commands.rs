use std::net::TcpListener;
use std::sync::{Mutex, MutexGuard};

use rusqlite::{Connection, OptionalExtension};
use tauri::State;

use crate::database;
use crate::error::{AppError, AppResult, CommandError};
use crate::importer::{ConfirmImportInput, ImportJobSummary, ImportPreview, ImportResult};
use crate::models::{
    AppendVersionInput, AttachmentItem, CreateRecordInput, CreateTagInput, DataLocation,
    DeleteVersionInput, FavoriteUpdate, IntelligenceRecord, PatchRecordInput, PermanentDeleteInput,
    RecordMutation, RecordQuery, RecordSummary, RecordVersion, RenameTagInput, RestoreVersionInput,
    StorageStats, TagItem, UpdateJudgmentInput, UpdateRecordInput, UpdateStatusInput,
};
use crate::paths::AppPaths;
use crate::transfer::{
    BackupPreview, ExportRecordsInput, ExportResult, PortableBackupPreview, PortableBackupResult,
    PortableRestoreResult, RestoreResult,
};

pub struct AppState {
    connection: Mutex<Connection>,
    paths: AppPaths,
    _instance_guard: TcpListener,
}

impl AppState {
    pub fn new(connection: Connection, paths: AppPaths, instance_guard: TcpListener) -> Self {
        Self {
            connection: Mutex::new(connection),
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

#[tauri::command]
pub fn get_data_location(state: State<'_, AppState>) -> DataLocation {
    state.paths.location()
}

#[tauri::command]
pub fn get_storage_stats(state: State<'_, AppState>) -> Result<StorageStats, CommandError> {
    let connection = command(state.connection())?;
    command(state.paths.storage_stats(&connection))
}

#[tauri::command]
pub fn open_data_directory(state: State<'_, AppState>) -> Result<(), CommandError> {
    command(
        open::that(&state.paths.root)
            .map_err(|error| AppError::Io(std::io::Error::other(error.to_string()))),
    )
}

#[tauri::command]
pub fn list_records(
    state: State<'_, AppState>,
    query: RecordQuery,
) -> Result<Vec<IntelligenceRecord>, CommandError> {
    let connection = command(state.connection())?;
    command(database::list_records(&connection, &query))
}

#[tauri::command]
pub fn list_record_summaries(
    state: State<'_, AppState>,
    query: RecordQuery,
) -> Result<Vec<RecordSummary>, CommandError> {
    let connection = command(state.connection())?;
    command(database::list_record_summaries(&connection, &query))
}

#[tauri::command]
pub fn get_record(
    state: State<'_, AppState>,
    record_id: i64,
) -> Result<IntelligenceRecord, CommandError> {
    let connection = command(state.connection())?;
    command(database::get_record(&connection, record_id))
}

#[tauri::command]
pub fn create_record(
    state: State<'_, AppState>,
    input: CreateRecordInput,
) -> Result<IntelligenceRecord, CommandError> {
    let mut connection = command(state.connection())?;
    command(database::create_record(&mut connection, &input))
}

#[tauri::command]
pub fn update_record(
    state: State<'_, AppState>,
    record_id: i64,
    input: UpdateRecordInput,
) -> Result<IntelligenceRecord, CommandError> {
    let mut connection = command(state.connection())?;
    command(database::update_record(&mut connection, record_id, &input))
}

#[tauri::command]
pub fn patch_record(
    state: State<'_, AppState>,
    record_id: i64,
    input: PatchRecordInput,
) -> Result<RecordMutation, CommandError> {
    let mut connection = command(state.connection())?;
    command(database::patch_record(&mut connection, record_id, &input))
}

#[tauri::command]
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

#[tauri::command]
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

#[tauri::command]
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

#[tauri::command]
pub fn move_to_trash(
    state: State<'_, AppState>,
    record_id: i64,
) -> Result<IntelligenceRecord, CommandError> {
    let connection = command(state.connection())?;
    command(database::move_to_trash(&connection, record_id))
}

#[tauri::command]
pub fn restore_record(
    state: State<'_, AppState>,
    record_id: i64,
) -> Result<IntelligenceRecord, CommandError> {
    let connection = command(state.connection())?;
    command(database::restore_record(&connection, record_id))
}

#[tauri::command]
pub fn permanently_delete_record(
    state: State<'_, AppState>,
    input: PermanentDeleteInput,
) -> Result<(), CommandError> {
    let mut connection = command(state.connection())?;
    command(database::permanently_delete_record(&mut connection, &input))
}

#[tauri::command]
pub fn append_version(
    state: State<'_, AppState>,
    input: AppendVersionInput,
) -> Result<RecordVersion, CommandError> {
    let mut connection = command(state.connection())?;
    command(database::append_version(&mut connection, &input))
}

#[tauri::command]
pub fn list_versions(
    state: State<'_, AppState>,
    record_id: i64,
) -> Result<Vec<RecordVersion>, CommandError> {
    let connection = command(state.connection())?;
    command(database::list_versions(&connection, record_id))
}

#[tauri::command]
pub fn delete_version(
    state: State<'_, AppState>,
    input: DeleteVersionInput,
) -> Result<(), CommandError> {
    let connection = command(state.connection())?;
    command(database::delete_version(&connection, &input))
}

#[tauri::command]
pub fn restore_version(
    state: State<'_, AppState>,
    input: RestoreVersionInput,
) -> Result<RecordVersion, CommandError> {
    let mut connection = command(state.connection())?;
    command(database::restore_version(&mut connection, &input))
}

#[tauri::command]
pub fn list_tags(state: State<'_, AppState>) -> Result<Vec<TagItem>, CommandError> {
    let connection = command(state.connection())?;
    command(database::list_tags(&connection))
}

#[tauri::command]
pub fn create_tag(
    state: State<'_, AppState>,
    input: CreateTagInput,
) -> Result<TagItem, CommandError> {
    let connection = command(state.connection())?;
    command(database::create_tag(&connection, &input))
}

#[tauri::command]
pub fn rename_tag(
    state: State<'_, AppState>,
    input: RenameTagInput,
) -> Result<TagItem, CommandError> {
    let connection = command(state.connection())?;
    command(database::rename_tag(&connection, &input))
}

#[tauri::command]
pub fn delete_tag(state: State<'_, AppState>, tag_id: i64) -> Result<(), CommandError> {
    let connection = command(state.connection())?;
    command(database::delete_tag(&connection, tag_id))
}

#[tauri::command]
pub fn rebuild_search_index(state: State<'_, AppState>) -> Result<(), CommandError> {
    let connection = command(state.connection())?;
    command(database::rebuild_search_index(&connection))
}

#[tauri::command]
pub fn run_integrity_check(state: State<'_, AppState>) -> Result<String, CommandError> {
    let connection = command(state.connection())?;
    command(database::integrity_check(&connection))
}

#[tauri::command]
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

#[tauri::command]
pub fn confirm_import(
    state: State<'_, AppState>,
    input: ConfirmImportInput,
) -> Result<ImportResult, CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::importer::confirm_import(&mut connection, &input))
}

#[tauri::command]
pub fn cancel_import(state: State<'_, AppState>, job_id: String) -> Result<(), CommandError> {
    let connection = command(state.connection())?;
    command(crate::importer::cancel_import(&connection, &job_id))
}

#[tauri::command]
pub fn list_import_jobs(state: State<'_, AppState>) -> Result<Vec<ImportJobSummary>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::importer::list_import_jobs(&connection))
}

#[tauri::command]
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

#[tauri::command]
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

#[tauri::command]
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

#[tauri::command]
pub fn export_all_json(state: State<'_, AppState>) -> Result<ExportResult, CommandError> {
    let connection = command(state.connection())?;
    command(crate::transfer::export_all_json(&connection, &state.paths))
}

#[tauri::command]
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

#[tauri::command]
pub fn create_backup(state: State<'_, AppState>) -> Result<String, CommandError> {
    let connection = command(state.connection())?;
    command(
        crate::transfer::create_backup(&connection, &state.paths, "手动备份")
            .map(|path| path.to_string_lossy().into_owned()),
    )
}

#[tauri::command]
pub fn restore_backup(
    state: State<'_, AppState>,
    source_path: String,
) -> Result<RestoreResult, CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::transfer::restore_backup(
        &mut connection,
        &state.paths,
        source_path,
    ))
}

#[tauri::command]
pub fn inspect_backup(source_path: String) -> Result<BackupPreview, CommandError> {
    command(crate::transfer::inspect_backup(source_path))
}

#[tauri::command]
pub fn create_portable_backup(
    state: State<'_, AppState>,
    preferences_json: String,
) -> Result<PortableBackupResult, CommandError> {
    let connection = command(state.connection())?;
    command(crate::transfer::create_portable_backup(
        &connection,
        &state.paths,
        &preferences_json,
        "南枫情报台_完整迁移备份",
    ))
}

#[tauri::command]
pub fn inspect_portable_backup(source_path: String) -> Result<PortableBackupPreview, CommandError> {
    command(crate::transfer::inspect_portable_backup(source_path))
}

#[tauri::command]
pub fn restore_portable_backup(
    state: State<'_, AppState>,
    source_path: String,
    current_preferences_json: String,
) -> Result<PortableRestoreResult, CommandError> {
    let mut connection = command(state.connection())?;
    command(crate::transfer::restore_portable_backup(
        &mut connection,
        &state.paths,
        source_path,
        &current_preferences_json,
    ))
}

#[tauri::command]
pub fn open_export_directory(state: State<'_, AppState>) -> Result<(), CommandError> {
    command(crate::transfer::open_export_directory(&state.paths))
}

#[tauri::command]
pub fn list_attachments(
    state: State<'_, AppState>,
    record_id: i64,
) -> Result<Vec<AttachmentItem>, CommandError> {
    let connection = command(state.connection())?;
    command(crate::attachments::list_attachments(&connection, record_id))
}

#[tauri::command]
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

#[tauri::command]
pub fn open_attachment(state: State<'_, AppState>, attachment_id: i64) -> Result<(), CommandError> {
    let connection = command(state.connection())?;
    command(crate::attachments::open_attachment(
        &connection,
        attachment_id,
    ))
}

#[tauri::command]
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
