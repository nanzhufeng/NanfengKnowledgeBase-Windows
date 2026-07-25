use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;
use tauri::State;

use crate::database;
use crate::error::{AppError, AppResult, CommandError};
use crate::importer::{ConfirmImportInput, ImportPreview, ImportResult};
use crate::models::{
    AppendVersionInput, CreateRecordInput, CreateTagInput, DataLocation, IntelligenceRecord,
    PermanentDeleteInput, RecordQuery, RecordVersion, RenameTagInput, RestoreVersionInput, TagItem,
    UpdateRecordInput,
};
use crate::paths::AppPaths;
use crate::transfer::{ExportResult, RestoreResult};

pub struct AppState {
    connection: Mutex<Connection>,
    paths: AppPaths,
}

impl AppState {
    pub fn new(connection: Connection, paths: AppPaths) -> Self {
        Self {
            connection: Mutex::new(connection),
            paths,
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
pub fn set_favorite(
    state: State<'_, AppState>,
    record_id: i64,
    is_favorite: bool,
) -> Result<IntelligenceRecord, CommandError> {
    let connection = command(state.connection())?;
    command(database::set_favorite(&connection, record_id, is_favorite))
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
pub fn export_all_json(state: State<'_, AppState>) -> Result<ExportResult, CommandError> {
    let connection = command(state.connection())?;
    command(crate::transfer::export_all_json(&connection, &state.paths))
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
pub fn open_export_directory(state: State<'_, AppState>) -> Result<(), CommandError> {
    command(crate::transfer::open_export_directory(&state.paths))
}
