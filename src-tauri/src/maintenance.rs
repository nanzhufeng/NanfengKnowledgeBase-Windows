use std::fs::{self, File, OpenOptions};
use std::io::{BufReader, Read, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use serde::Serialize;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::chatgpt_export::{self, ChatGptAssetMaterialization};
use crate::database;
use crate::error::{AppError, AppResult};
use crate::importer::{self, ConfirmImportInput};
use crate::paths::AppPaths;
use crate::transfer;

const ISOLATED_MIGRATION_MARKER: &str = ".isolated-knowledge-migration-test";
const FORMAL_KNOWLEDGE_ROOT: &str = r"D:\南枫知识库";
const FORMAL_MIGRATION_CONFIRMATION: &str = "AUTHORIZE_FORMAL_KNOWLEDGE_MIGRATION_V3_20260727";
const FORMAL_PROMPT_CACHE_CONFIRMATION: &str =
    "AUTHORIZE_FORMAL_PROMPT_CACHE_MIGRATION_V14_20260813";
const FORMAL_PROMPT_CACHE_ACCEPTANCE_CONFIRMATION: &str =
    "AUTHORIZE_FORMAL_PROMPT_CACHE_BUSINESS_ACCEPTANCE_20260813";
const FORMAL_AI_EXECUTION_CONTRACT_CONFIRMATION: &str =
    "AUTHORIZE_FORMAL_AI_EXECUTION_CONTRACT_MIGRATION_V15_20260813";
const FORMAL_QWEN_REASONING_AB_CONFIRMATION: &str =
    "AUTHORIZE_FORMAL_QWEN_REASONING_AB_ACCEPTANCE_20260813";
const FORMAL_TAXONOMY_E2E_CONFIRMATION: &str = "AUTHORIZE_FORMAL_TAXONOMY_E2E_ACCEPTANCE_20260813";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatGptImportMaintenanceReport {
    pub data_root: String,
    pub source_zip: String,
    pub source_zip_sha256: String,
    pub database_backup: String,
    pub import_job_id: String,
    pub records_before: i64,
    pub records_after: i64,
    pub imported_records: usize,
    pub skipped_records: usize,
    pub restored_asset_count: usize,
    pub registered_attachment_rows: i64,
    pub restored_asset_bytes: u64,
    pub attachment_manifest: String,
    pub database_integrity: String,
    pub receipt_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeMigrationMaintenanceReport {
    pub data_root: String,
    pub database: String,
    pub schema_versions: Vec<i64>,
    pub active_records: i64,
    pub deleted_records: i64,
    pub source_items: i64,
    pub linked_legacy_sources: i64,
    pub inbox_sources: i64,
    pub attachments: i64,
    pub integrity_check: String,
    pub foreign_key_violations: i64,
    pub migration_backup: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeInspectionMaintenanceReport {
    pub data_root: String,
    pub database: String,
    pub schema_versions: Vec<i64>,
    pub active_records: i64,
    pub source_items: i64,
    pub inbox_sources: i64,
    pub notes: i64,
    pub propositions: i64,
    pub evidence: i64,
    pub turning_points: i64,
    pub integrity_check: String,
    pub foreign_key_violations: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FormalKnowledgeMigrationSnapshot {
    pub database_sha256: String,
    pub schema_versions: Vec<i64>,
    pub active_records: i64,
    pub deleted_records: i64,
    pub source_items: Option<i64>,
    pub linked_legacy_sources: Option<i64>,
    pub inbox_sources: Option<i64>,
    pub attachments: i64,
    pub integrity_check: String,
    pub foreign_key_violations: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormalKnowledgeMigrationReport {
    pub data_root: String,
    pub database: String,
    pub before: FormalKnowledgeMigrationSnapshot,
    pub portable_backup_folder: String,
    pub portable_backup_manifest_sha256: String,
    pub portable_backup_database_sha256: String,
    pub portable_backup_file_count: u64,
    pub portable_backup_total_bytes: u64,
    pub portable_backup_content_integrity: String,
    pub portable_backup_preferences: String,
    pub automatic_database_backup: String,
    pub automatic_database_backup_sha256: String,
    pub after: FormalKnowledgeMigrationSnapshot,
    pub reopened: FormalKnowledgeMigrationSnapshot,
    pub idempotent: bool,
    pub receipt_path: Option<String>,
    pub receipt_write_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormalPromptCacheMigrationReport {
    pub data_root: String,
    pub database: String,
    pub schema_versions_before: Vec<i64>,
    pub schema_versions_after: Vec<i64>,
    pub database_backup: String,
    pub database_backup_sha256: String,
    pub database_backup_bytes: u64,
    pub prompt_cache_column_count: i64,
    pub integrity_check: String,
    pub foreign_key_violations: i64,
    pub records_before: i64,
    pub records_after: i64,
    pub source_items_before: i64,
    pub source_items_after: i64,
    pub taxonomy_revisions_before: i64,
    pub taxonomy_revisions_after: i64,
    pub idempotent: bool,
    pub receipt_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormalAiExecutionContractMigrationReport {
    pub data_root: String,
    pub database: String,
    pub schema_versions_before: Vec<i64>,
    pub schema_versions_after: Vec<i64>,
    pub database_backup: String,
    pub database_backup_sha256: String,
    pub database_backup_bytes: u64,
    pub task_runs: i64,
    pub topic_insight_versions: i64,
    pub source_profile_versions: i64,
    pub taxonomy_revisions: i64,
    pub taxonomy_checkpoints: i64,
    pub recovered_stale_tasks: usize,
    pub execution_contract_column_count: i64,
    pub legacy_rows_backfilled: i64,
    pub integrity_check: String,
    pub foreign_key_violations: i64,
    pub idempotent: bool,
    pub receipt_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormalPromptCacheAcceptanceReport {
    pub task_public_id: String,
    pub provider_channel: String,
    pub model_id: String,
    pub taxonomy_source: String,
    pub real_source_count: usize,
    pub first_profile_usage: crate::ai::models::AiTaskUsage,
    pub second_profile_usage: crate::ai::models::AiTaskUsage,
    pub first_assignment_usage: crate::ai::models::AiTaskUsage,
    pub second_assignment_usage: crate::ai::models::AiTaskUsage,
    pub stable_prefix_hash_match: bool,
    pub cache_key_hash_match: bool,
    pub cache_hit_verified: bool,
    pub ledger_step_count: i64,
    pub ledger_cached_tokens: i64,
    pub ledger_cache_write_tokens: i64,
    pub ledger_cost_usd: Option<f64>,
    pub source_items_unchanged: bool,
    pub taxonomy_revisions_unchanged: bool,
    pub integrity_check: String,
    pub foreign_key_violations: i64,
    pub receipt_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormalQwenReasoningAbReport {
    pub task_public_id: String,
    pub provider_channel: String,
    pub model_id: String,
    pub real_source_count: usize,
    pub taxonomy_topic_count: usize,
    pub thinking_profile_usage: crate::ai::models::AiTaskUsage,
    pub no_thinking_profile_usage: crate::ai::models::AiTaskUsage,
    pub thinking_assignment_usage: crate::ai::models::AiTaskUsage,
    pub no_thinking_assignment_usage: crate::ai::models::AiTaskUsage,
    pub thinking_profile_summaries_non_empty: bool,
    pub no_thinking_profile_summaries_non_empty: bool,
    pub profile_concept_overlap_rate: f64,
    pub profile_candidate_topic_overlap_rate: f64,
    pub assignment_topic_match_count: usize,
    pub assignment_topic_match_rate: f64,
    pub assignment_uncertain_match_count: usize,
    pub assignment_confidence_mean_absolute_delta: f64,
    pub thinking_reasoning_tokens: i64,
    pub no_thinking_reasoning_tokens: i64,
    pub reasoning_token_reduction: i64,
    pub thinking_completion_tokens: i64,
    pub no_thinking_completion_tokens: i64,
    pub completion_token_reduction: i64,
    pub thinking_duration_ms: Option<i64>,
    pub no_thinking_duration_ms: Option<i64>,
    pub duration_reduction_ms: Option<i64>,
    pub ledger_step_count: i64,
    pub ledger_reasoning_tokens: i64,
    pub ledger_cost_usd: Option<f64>,
    pub source_items_unchanged: bool,
    pub topics_unchanged: bool,
    pub taxonomy_revisions_unchanged: bool,
    pub integrity_check: String,
    pub foreign_key_violations: i64,
    pub response_body_persisted: bool,
    pub receipt_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormalTaxonomyEndToEndAcceptanceReport {
    pub task_public_id: String,
    pub provider_channel: String,
    pub profile_model_id: String,
    pub synthesis_model_id: String,
    pub real_source_count: usize,
    pub domain_count: usize,
    pub topic_count: usize,
    pub assignment_count: usize,
    pub integrated_topic_count: usize,
    pub stage_count: i64,
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub reasoning_tokens: i64,
    pub cached_tokens: i64,
    pub total_tokens: i64,
    pub cost_usd: Option<f64>,
    pub prompt_contracts_current: bool,
    pub execution_contract_version: String,
    pub production_tables_unchanged: bool,
    pub integrity_check: String,
    pub foreign_key_violations: i64,
    pub receipt_path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PortableRecoveryQaSnapshot {
    pub database_sha256: String,
    pub import_sha256: String,
    pub attachment_sha256: String,
    pub preferences_sha256: String,
    pub schema_versions: Vec<i64>,
    pub active_records: i64,
    pub source_items: i64,
    pub inbox_sources: i64,
    pub attachment_rows: i64,
    pub integrity_check: String,
    pub foreign_key_violations: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableRecoveryQaReport {
    pub source_root: String,
    pub qa_root: String,
    pub source_database_sha256: String,
    pub baseline: PortableRecoveryQaSnapshot,
    pub backup_folder: String,
    pub backup_manifest_sha256: String,
    pub backup_manifest_file_count: usize,
    pub backup_manifest_bytes: u64,
    pub backup_inventory_file_count: u64,
    pub backup_inventory_bytes: u64,
    pub backup_content_integrity: String,
    pub restored: PortableRecoveryQaSnapshot,
    pub restored_preferences_match: bool,
    pub successful_restore_log: String,
    pub fault_injection_error: String,
    pub rollback_safety_backup: String,
    pub rollback_safety_manifest_verified: bool,
    pub rollback_protected: PortableRecoveryQaSnapshot,
    pub rollback_after_failure: PortableRecoveryQaSnapshot,
    pub rollback_exact_files_match: bool,
    pub restart: PortableRecoveryQaSnapshot,
    pub restart_persisted: bool,
    pub receipt_path: String,
}

pub fn migrate_isolated_knowledge_copy(
    data_root: impl AsRef<Path>,
) -> AppResult<KnowledgeMigrationMaintenanceReport> {
    let data_root = require_absolute_path(data_root.as_ref(), "隔离数据目录")?;
    let normalized = data_root.to_string_lossy().replace('/', "\\");
    if normalized.eq_ignore_ascii_case(r"D:\南枫知识库")
        || normalized.eq_ignore_ascii_case(r"D:\南枫情报台")
    {
        return Err(AppError::Validation(
            "隔离迁移检查器拒绝正式数据目录".to_string(),
        ));
    }
    let marker = data_root.join(ISOLATED_MIGRATION_MARKER);
    if !marker.is_file() {
        return Err(AppError::Validation(format!(
            "缺少隔离迁移标记文件：{}",
            marker.display()
        )));
    }

    let paths = AppPaths::from_root(&data_root)?;
    if !paths.database.is_file() {
        return Err(AppError::NotFound(format!(
            "隔离数据库不存在：{}",
            paths.database.display()
        )));
    }
    let connection = database::open_database(&paths.database)?;
    let integrity_check = database::integrity_check(&connection)?;
    let foreign_key_violations =
        connection.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
            row.get::<_, i64>(0)
        })?;
    let schema_versions = {
        let mut statement =
            connection.prepare("SELECT version FROM schema_migrations ORDER BY version")?;
        let versions = statement
            .query_map([], |row| row.get::<_, i64>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        versions
    };
    let active_records = count_where(&connection, "records", "is_deleted = 0")?;
    let deleted_records = count_where(&connection, "records", "is_deleted = 1")?;
    let source_items = count_where(&connection, "source_items", "1 = 1")?;
    let linked_legacy_sources =
        count_where(&connection, "source_items", "legacy_record_id IS NOT NULL")?;
    let inbox_sources = count_where(&connection, "source_items", "organization_state = 'inbox'")?;
    let attachments = count_where(&connection, "attachments", "1 = 1")?;
    connection.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
    drop(connection);

    let migration_backup = newest_matching_file(&paths.backups, "知识结构迁移前自动备份_", ".db")?
        .ok_or_else(|| AppError::Conflict("隔离迁移没有生成迁移前自动备份".to_string()))?;

    Ok(KnowledgeMigrationMaintenanceReport {
        data_root: data_root.to_string_lossy().into_owned(),
        database: paths.database.to_string_lossy().into_owned(),
        schema_versions,
        active_records,
        deleted_records,
        source_items,
        linked_legacy_sources,
        inbox_sources,
        attachments,
        integrity_check,
        foreign_key_violations,
        migration_backup: migration_backup.to_string_lossy().into_owned(),
    })
}

pub fn inspect_isolated_knowledge_copy(
    data_root: impl AsRef<Path>,
) -> AppResult<KnowledgeInspectionMaintenanceReport> {
    let data_root = require_isolated_root(data_root.as_ref(), "隔离检查目录")?;
    require_isolated_marker(&data_root)?;
    let database = data_root.join("data").join("app.db");
    if !database.is_file() {
        return Err(AppError::NotFound(format!(
            "隔离数据库不存在：{}",
            database.display()
        )));
    }
    let connection = Connection::open_with_flags(
        &database,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    let integrity_check = database::integrity_check(&connection)?;
    let foreign_key_violations =
        connection.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
            row.get::<_, i64>(0)
        })?;
    let schema_versions = {
        let mut statement =
            connection.prepare("SELECT version FROM schema_migrations ORDER BY version")?;
        let versions = statement
            .query_map([], |row| row.get::<_, i64>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        versions
    };
    Ok(KnowledgeInspectionMaintenanceReport {
        data_root: data_root.to_string_lossy().into_owned(),
        database: database.to_string_lossy().into_owned(),
        schema_versions,
        active_records: count_where(&connection, "records", "is_deleted = 0")?,
        source_items: count_where(&connection, "source_items", "1 = 1")?,
        inbox_sources: count_where(&connection, "source_items", "organization_state = 'inbox'")?,
        notes: count_where(&connection, "notes", "1 = 1")?,
        propositions: count_where(&connection, "propositions", "1 = 1")?,
        evidence: count_where(&connection, "evidence", "1 = 1")?,
        turning_points: count_where(&connection, "turning_points", "1 = 1")?,
        integrity_check,
        foreign_key_violations,
    })
}

pub fn inspect_formal_knowledge_base(
    data_root: impl AsRef<Path>,
) -> AppResult<FormalKnowledgeMigrationSnapshot> {
    let data_root = require_exact_formal_knowledge_root(data_root.as_ref())?;
    let database = data_root.join("data").join("app.db");
    if !database.is_file() {
        return Err(AppError::NotFound(format!(
            "正式数据库不存在：{}",
            database.display()
        )));
    }
    let _instance_guard = TcpListener::bind("127.0.0.1:47633").map_err(|error| {
        AppError::Conflict(format!(
            "南枫知识库可能正在运行，已停止正式只读核对：{error}"
        ))
    })?;
    let connection = Connection::open_with_flags(
        &database,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    formal_knowledge_snapshot(&connection, &database)
}

pub fn migrate_formal_prompt_cache_v14(
    data_root: impl AsRef<Path>,
    confirmation: &str,
) -> AppResult<FormalPromptCacheMigrationReport> {
    if confirmation != FORMAL_PROMPT_CACHE_CONFIRMATION {
        return Err(AppError::Validation(
            "Prompt Cache正式迁移确认令牌不匹配，已拒绝写入".to_string(),
        ));
    }
    let data_root = require_exact_formal_knowledge_root(data_root.as_ref())?;
    let paths = AppPaths::from_root(&data_root)?;
    if !paths.database.is_file() {
        return Err(AppError::NotFound(format!(
            "正式数据库不存在：{}",
            paths.database.display()
        )));
    }
    let _instance_guard = TcpListener::bind("127.0.0.1:47633").map_err(|error| {
        AppError::Conflict(format!("南枫知识库可能正在运行，已停止v14迁移：{error}"))
    })?;
    let preflight = Connection::open_with_flags(
        &paths.database,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    preflight.busy_timeout(std::time::Duration::from_secs(5))?;
    let schema_versions_before = schema_versions(&preflight)?;
    if !schema_versions_before.contains(&13) {
        return Err(AppError::Conflict(
            "正式数据库尚未应用migration v13，不能越级应用v14".to_string(),
        ));
    }
    if schema_versions_before.contains(&14) {
        return Err(AppError::Conflict(
            "正式数据库已包含migration v14；本工具拒绝重复创建迁移备份".to_string(),
        ));
    }
    let integrity_before = database::integrity_check(&preflight)?;
    let foreign_keys_before =
        preflight.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
            row.get::<_, i64>(0)
        })?;
    if integrity_before != "ok" || foreign_keys_before != 0 {
        return Err(AppError::Conflict(format!(
            "v14迁移前数据库检查未通过：完整性 {integrity_before}，外键违规 {foreign_keys_before}"
        )));
    }
    let records_before = count_where(&preflight, "records", "1 = 1")?;
    let source_items_before = count_where(&preflight, "source_items", "1 = 1")?;
    let taxonomy_revisions_before = count_where(&preflight, "ai_taxonomy_revisions", "1 = 1")?;
    let backup = transfer::create_backup(&preflight, &paths, "Prompt Cache migration v14前备份")?;
    let backup_connection = Connection::open_with_flags(&backup, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    if schema_versions(&backup_connection)? != schema_versions_before
        || count_where(&backup_connection, "records", "1 = 1")? != records_before
        || count_where(&backup_connection, "source_items", "1 = 1")? != source_items_before
        || count_where(&backup_connection, "ai_taxonomy_revisions", "1 = 1")?
            != taxonomy_revisions_before
        || database::integrity_check(&backup_connection)? != "ok"
    {
        return Err(AppError::Conflict(
            "v14迁移前数据库备份与正式库逻辑状态不一致，已停止迁移".to_string(),
        ));
    }
    drop(backup_connection);
    drop(preflight);

    let migration = (|| -> AppResult<_> {
        let connection = database::open_database(&paths.database)?;
        checkpoint_database(&connection)?;
        let schema_versions_after = schema_versions(&connection)?;
        let prompt_cache_column_count = prompt_cache_column_count(&connection)?;
        let integrity_check = database::integrity_check(&connection)?;
        let foreign_key_violations =
            connection.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
                row.get::<_, i64>(0)
            })?;
        let records_after = count_where(&connection, "records", "1 = 1")?;
        let source_items_after = count_where(&connection, "source_items", "1 = 1")?;
        let taxonomy_revisions_after = count_where(&connection, "ai_taxonomy_revisions", "1 = 1")?;
        if !schema_versions_after.contains(&14)
            || prompt_cache_column_count != 13
            || integrity_check != "ok"
            || foreign_key_violations != 0
            || records_after != records_before
            || source_items_after != source_items_before
            || taxonomy_revisions_after != taxonomy_revisions_before
        {
            return Err(AppError::Conflict(format!(
                "v14迁移后验收失败：版本 {:?}，缓存字段 {}，完整性 {}，外键 {}，记录 {}/{}，来源 {}/{}，修订 {}/{}",
                schema_versions_after,
                prompt_cache_column_count,
                integrity_check,
                foreign_key_violations,
                records_before,
                records_after,
                source_items_before,
                source_items_after,
                taxonomy_revisions_before,
                taxonomy_revisions_after,
            )));
        }
        Ok((
            schema_versions_after,
            prompt_cache_column_count,
            integrity_check,
            foreign_key_violations,
            records_after,
            source_items_after,
            taxonomy_revisions_after,
        ))
    })();
    let (
        schema_versions_after,
        prompt_cache_columns,
        integrity_check,
        foreign_key_violations,
        records_after,
        source_items_after,
        taxonomy_revisions_after,
    ) = match migration {
        Ok(result) => result,
        Err(error) => {
            restore_database_backup(&paths.database, &backup)?;
            return Err(AppError::Conflict(format!(
                "v14迁移失败，已从迁移前备份恢复：{error}"
            )));
        }
    };
    let reopened = database::open_database(&paths.database)?;
    checkpoint_database(&reopened)?;
    let idempotent = schema_versions(&reopened)? == schema_versions_after
        && prompt_cache_column_count(&reopened)? == prompt_cache_columns
        && count_where(&reopened, "records", "1 = 1")? == records_after
        && count_where(&reopened, "source_items", "1 = 1")? == source_items_after
        && count_where(&reopened, "ai_taxonomy_revisions", "1 = 1")? == taxonomy_revisions_after;
    drop(reopened);
    if !idempotent {
        restore_database_backup(&paths.database, &backup)?;
        return Err(AppError::Conflict(
            "v14第二次打开幂等检查失败，已从迁移前备份恢复".to_string(),
        ));
    }
    let receipt_path = paths.logs.join(format!(
        "formal-prompt-cache-migration-v14-{}.json",
        chrono::Utc::now().format("%Y%m%d-%H%M%S-%3f")
    ));
    let report = FormalPromptCacheMigrationReport {
        data_root: data_root.to_string_lossy().into_owned(),
        database: paths.database.to_string_lossy().into_owned(),
        schema_versions_before,
        schema_versions_after,
        database_backup: backup.to_string_lossy().into_owned(),
        database_backup_sha256: sha256_file(&backup)?,
        database_backup_bytes: backup.metadata()?.len(),
        prompt_cache_column_count: prompt_cache_columns,
        integrity_check,
        foreign_key_violations,
        records_before,
        records_after,
        source_items_before,
        source_items_after,
        taxonomy_revisions_before,
        taxonomy_revisions_after,
        idempotent,
        receipt_path: receipt_path.to_string_lossy().into_owned(),
    };
    write_new_json(&receipt_path, &report)?;
    Ok(report)
}

pub fn migrate_formal_ai_execution_contract_v15(
    data_root: impl AsRef<Path>,
    confirmation: &str,
) -> AppResult<FormalAiExecutionContractMigrationReport> {
    if confirmation != FORMAL_AI_EXECUTION_CONTRACT_CONFIRMATION {
        return Err(AppError::Validation(
            "AI执行契约正式迁移确认令牌不匹配，已拒绝写入".to_string(),
        ));
    }
    let data_root = require_exact_formal_knowledge_root(data_root.as_ref())?;
    let paths = AppPaths::from_root(&data_root)?;
    if !paths.database.is_file() {
        return Err(AppError::NotFound(format!(
            "正式数据库不存在：{}",
            paths.database.display()
        )));
    }
    let _instance_guard = TcpListener::bind("127.0.0.1:47633").map_err(|error| {
        AppError::Conflict(format!("南枫知识库可能正在运行，已停止v15迁移：{error}"))
    })?;
    let preflight = Connection::open_with_flags(
        &paths.database,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    preflight.busy_timeout(std::time::Duration::from_secs(5))?;
    let schema_versions_before = schema_versions(&preflight)?;
    if !schema_versions_before.contains(&14) {
        return Err(AppError::Conflict(
            "正式数据库尚未应用migration v14，不能越级应用v15".to_string(),
        ));
    }
    if schema_versions_before.contains(&15) {
        return Err(AppError::Conflict(
            "正式数据库已包含migration v15；本工具拒绝重复创建迁移备份".to_string(),
        ));
    }
    let integrity_before = database::integrity_check(&preflight)?;
    let foreign_keys_before =
        preflight.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
            row.get::<_, i64>(0)
        })?;
    if integrity_before != "ok" || foreign_keys_before != 0 {
        return Err(AppError::Conflict(format!(
            "v15迁移前数据库检查未通过：完整性 {integrity_before}，外键违规 {foreign_keys_before}"
        )));
    }
    let task_runs = count_where(&preflight, "ai_task_runs", "1 = 1")?;
    let topic_insight_versions = count_where(&preflight, "ai_topic_insight_versions", "1 = 1")?;
    let source_profile_versions = count_where(&preflight, "ai_source_profile_versions", "1 = 1")?;
    let taxonomy_revisions = count_where(&preflight, "ai_taxonomy_revisions", "1 = 1")?;
    let taxonomy_checkpoints = count_where(&preflight, "ai_taxonomy_run_checkpoints", "1 = 1")?;
    let backup = transfer::create_backup(&preflight, &paths, "AI执行契约 migration v15前备份")?;
    let backup_connection = Connection::open_with_flags(&backup, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    if schema_versions(&backup_connection)? != schema_versions_before
        || count_where(&backup_connection, "ai_task_runs", "1 = 1")? != task_runs
        || count_where(&backup_connection, "ai_topic_insight_versions", "1 = 1")?
            != topic_insight_versions
        || count_where(&backup_connection, "ai_source_profile_versions", "1 = 1")?
            != source_profile_versions
        || count_where(&backup_connection, "ai_taxonomy_revisions", "1 = 1")? != taxonomy_revisions
        || count_where(&backup_connection, "ai_taxonomy_run_checkpoints", "1 = 1")?
            != taxonomy_checkpoints
        || database::integrity_check(&backup_connection)? != "ok"
    {
        return Err(AppError::Conflict(
            "v15迁移前数据库备份与正式库逻辑状态不一致，已停止迁移".to_string(),
        ));
    }
    drop(backup_connection);
    drop(preflight);

    let migration = (|| -> AppResult<_> {
        let connection = database::open_database(&paths.database)?;
        let recovered_stale_tasks = crate::ai::repository::recover_stale_ai_tasks(&connection)?;
        checkpoint_database(&connection)?;
        let schema_versions_after = schema_versions(&connection)?;
        let execution_contract_columns = execution_contract_column_count(&connection)?;
        let legacy_rows_backfilled = count_execution_contract_rows(&connection, "legacy")?;
        let integrity_check = database::integrity_check(&connection)?;
        let foreign_key_violations =
            connection.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
                row.get::<_, i64>(0)
            })?;
        let expected_legacy_rows = task_runs
            + topic_insight_versions
            + source_profile_versions
            + taxonomy_revisions
            + taxonomy_checkpoints;
        if !schema_versions_after.contains(&15)
            || execution_contract_columns != 5
            || !source_profile_contract_in_primary_key(&connection)?
            || legacy_rows_backfilled != expected_legacy_rows
            || count_where(&connection, "ai_task_runs", "1 = 1")? != task_runs
            || count_where(&connection, "ai_topic_insight_versions", "1 = 1")?
                != topic_insight_versions
            || count_where(&connection, "ai_source_profile_versions", "1 = 1")?
                != source_profile_versions
            || count_where(&connection, "ai_taxonomy_revisions", "1 = 1")? != taxonomy_revisions
            || count_where(&connection, "ai_taxonomy_run_checkpoints", "1 = 1")?
                != taxonomy_checkpoints
            || integrity_check != "ok"
            || foreign_key_violations != 0
        {
            return Err(AppError::Conflict(format!(
                "v15迁移后验收失败：版本 {:?}，契约字段 {}，legacy {}/{}，完整性 {}，外键 {}",
                schema_versions_after,
                execution_contract_columns,
                legacy_rows_backfilled,
                expected_legacy_rows,
                integrity_check,
                foreign_key_violations,
            )));
        }
        Ok((
            schema_versions_after,
            recovered_stale_tasks,
            execution_contract_columns,
            legacy_rows_backfilled,
            integrity_check,
            foreign_key_violations,
        ))
    })();
    let (
        schema_versions_after,
        recovered_stale_tasks,
        execution_contract_columns,
        legacy_rows_backfilled,
        integrity_check,
        foreign_key_violations,
    ) = match migration {
        Ok(result) => result,
        Err(error) => {
            restore_database_backup(&paths.database, &backup)?;
            return Err(AppError::Conflict(format!(
                "v15迁移失败，已从迁移前备份恢复：{error}"
            )));
        }
    };
    let reopened = database::open_database(&paths.database)?;
    checkpoint_database(&reopened)?;
    let idempotent = schema_versions(&reopened)? == schema_versions_after
        && execution_contract_column_count(&reopened)? == execution_contract_columns
        && source_profile_contract_in_primary_key(&reopened)?
        && count_execution_contract_rows(&reopened, "legacy")? == legacy_rows_backfilled;
    drop(reopened);
    if !idempotent {
        restore_database_backup(&paths.database, &backup)?;
        return Err(AppError::Conflict(
            "v15第二次打开幂等检查失败，已从迁移前备份恢复".to_string(),
        ));
    }
    let receipt_path = paths.logs.join(format!(
        "formal-ai-execution-contract-migration-v15-{}.json",
        chrono::Utc::now().format("%Y%m%d-%H%M%S-%3f")
    ));
    let report = FormalAiExecutionContractMigrationReport {
        data_root: data_root.to_string_lossy().into_owned(),
        database: paths.database.to_string_lossy().into_owned(),
        schema_versions_before,
        schema_versions_after,
        database_backup: backup.to_string_lossy().into_owned(),
        database_backup_sha256: sha256_file(&backup)?,
        database_backup_bytes: backup.metadata()?.len(),
        task_runs,
        topic_insight_versions,
        source_profile_versions,
        taxonomy_revisions,
        taxonomy_checkpoints,
        recovered_stale_tasks,
        execution_contract_column_count: execution_contract_columns,
        legacy_rows_backfilled,
        integrity_check,
        foreign_key_violations,
        idempotent,
        receipt_path: receipt_path.to_string_lossy().into_owned(),
    };
    write_new_json(&receipt_path, &report)?;
    Ok(report)
}

pub fn run_formal_prompt_cache_business_acceptance(
    data_root: impl AsRef<Path>,
    confirmation: &str,
) -> AppResult<FormalPromptCacheAcceptanceReport> {
    if confirmation != FORMAL_PROMPT_CACHE_ACCEPTANCE_CONFIRMATION {
        return Err(AppError::Validation(
            "Prompt Cache真实业务验收确认令牌不匹配，已拒绝执行".to_string(),
        ));
    }
    let data_root = require_exact_formal_knowledge_root(data_root.as_ref())?;
    let paths = AppPaths::from_root(&data_root)?;
    let _instance_guard = TcpListener::bind("127.0.0.1:47633").map_err(|error| {
        AppError::Conflict(format!(
            "南枫知识库可能正在运行，已停止真实业务验收：{error}"
        ))
    })?;
    let connection = database::open_database(&paths.database)?;
    if !schema_versions(&connection)?.contains(&14) {
        return Err(AppError::Conflict(
            "正式数据库尚未应用migration v14，已停止真实业务验收".to_string(),
        ));
    }
    let source_items_before = count_where(&connection, "source_items", "1 = 1")?;
    let taxonomy_revisions_before = count_where(&connection, "ai_taxonomy_revisions", "1 = 1")?;
    let (channel, route) = crate::ai::repository::resolve_task_model_route(&connection, None)?;
    let model_id = route.profile_model_id;
    let api_key = crate::ai::credentials::get_api_key(channel)?
        .ok_or_else(|| AppError::Validation(format!("{}未配置API Key", channel.as_str())))?;
    let descriptor = crate::ai::repository::model_descriptor(&connection, channel, &model_id)?;
    let taxonomy = formal_current_taxonomy(&connection)?;
    let materials = formal_acceptance_materials(&connection)?;
    let task_public_id = format!("ai-task-prompt-cache-acceptance-{}", Uuid::new_v4());
    connection.execute(
        "INSERT INTO ai_task_runs(
           public_id, task_kind, provider_channel, model_id, status, started_at
         ) VALUES (?1, 'prompt_cache_acceptance', ?2, ?3, 'running', ?4)",
        params![
            task_public_id,
            channel.as_str(),
            model_id,
            chrono::Utc::now().to_rfc3339()
        ],
    )?;

    let (first_profiles, first_profile_usage) = match crate::ai::client::run_source_profile_batch(
        channel,
        &api_key,
        &model_id,
        &materials[0..1],
        descriptor.as_ref(),
    ) {
        Ok(result) => result,
        Err(error) => {
            crate::ai::repository::fail_task(&connection, &task_public_id, &error.to_string())?;
            return Err(error);
        }
    };
    crate::ai::repository::record_task_model_step(
        &connection,
        &task_public_id,
        "acceptance_profiles_1",
        channel,
        &model_id,
        &first_profile_usage,
    )?;
    if first_profile_usage
        .cost_usd
        .is_some_and(|cost| cost >= 0.04)
    {
        crate::ai::repository::fail_task(
            &connection,
            &task_public_id,
            "首轮成本达到$0.04停止线，未发送后续请求",
        )?;
        return Err(AppError::Conflict(
            "真实业务验收首轮成本达到$0.04停止线，已停止后续请求".to_string(),
        ));
    }
    let (second_profiles, second_profile_usage) = match crate::ai::client::run_source_profile_batch(
        channel,
        &api_key,
        &model_id,
        &materials[1..2],
        descriptor.as_ref(),
    ) {
        Ok(result) => result,
        Err(error) => {
            crate::ai::repository::fail_task(&connection, &task_public_id, &error.to_string())?;
            return Err(error);
        }
    };
    crate::ai::repository::record_task_model_step(
        &connection,
        &task_public_id,
        "acceptance_profiles_2",
        channel,
        &model_id,
        &second_profile_usage,
    )?;
    let (_, first_assignment_usage) = match crate::ai::client::run_taxonomy_assignment_batch(
        channel,
        &api_key,
        &model_id,
        &taxonomy,
        &first_profiles,
        descriptor.as_ref(),
    ) {
        Ok(result) => result,
        Err(error) => {
            crate::ai::repository::fail_task(&connection, &task_public_id, &error.to_string())?;
            return Err(error);
        }
    };
    crate::ai::repository::record_task_model_step(
        &connection,
        &task_public_id,
        "acceptance_assignments_1",
        channel,
        &model_id,
        &first_assignment_usage,
    )?;
    let (_, second_assignment_usage) = match crate::ai::client::run_taxonomy_assignment_batch(
        channel,
        &api_key,
        &model_id,
        &taxonomy,
        &second_profiles,
        descriptor.as_ref(),
    ) {
        Ok(result) => result,
        Err(error) => {
            crate::ai::repository::fail_task(&connection, &task_public_id, &error.to_string())?;
            return Err(error);
        }
    };
    crate::ai::repository::record_task_model_step(
        &connection,
        &task_public_id,
        "acceptance_assignments_2",
        channel,
        &model_id,
        &second_assignment_usage,
    )?;

    let usages = [
        &first_profile_usage,
        &second_profile_usage,
        &first_assignment_usage,
        &second_assignment_usage,
    ];
    let prompt_tokens = usages.iter().map(|usage| usage.prompt_tokens).sum::<i64>();
    let completion_tokens = usages
        .iter()
        .map(|usage| usage.completion_tokens)
        .sum::<i64>();
    let reasoning_tokens = usages
        .iter()
        .map(|usage| usage.reasoning_tokens)
        .sum::<i64>();
    let cached_tokens = usages.iter().map(|usage| usage.cached_tokens).sum::<i64>();
    let total_tokens = usages.iter().map(|usage| usage.total_tokens).sum::<i64>();
    let reported_costs = usages
        .iter()
        .map(|usage| usage.cost_usd)
        .collect::<Option<Vec<_>>>();
    let total_cost = reported_costs.map(|costs| costs.into_iter().sum::<f64>());
    let first_cost_kind = usages[0].cost_kind.as_str();
    let cost_kind = if usages
        .iter()
        .all(|usage| usage.cost_kind == first_cost_kind)
    {
        first_cost_kind
    } else {
        "mixed"
    };
    connection.execute(
        "UPDATE ai_task_runs SET status = 'completed',
           prompt_tokens = ?1, completion_tokens = ?2, reasoning_tokens = ?3,
           cached_tokens = ?4, total_tokens = ?5, cost_usd = ?6,
           cost_kind = ?7, pricing_snapshot_json = ?8, completed_at = ?9
         WHERE public_id = ?10",
        params![
            prompt_tokens,
            completion_tokens,
            reasoning_tokens,
            cached_tokens,
            total_tokens,
            total_cost,
            cost_kind,
            second_assignment_usage.pricing_snapshot_json,
            chrono::Utc::now().to_rfc3339(),
            task_public_id,
        ],
    )?;
    let (ledger_step_count, ledger_cached_tokens, ledger_cache_write_tokens, ledger_cost_usd) =
        connection.query_row(
            "SELECT COUNT(*), COALESCE(SUM(cached_tokens), 0),
                    COALESCE(SUM(cache_write_tokens), 0), SUM(cost_usd)
             FROM ai_task_model_steps WHERE task_public_id = ?1",
            [&task_public_id],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, Option<f64>>(3)?,
                ))
            },
        )?;
    let expected_cache_write_tokens = usages
        .iter()
        .map(|usage| usage.cache_write_tokens)
        .sum::<i64>();
    if ledger_step_count != 4
        || ledger_cached_tokens != cached_tokens
        || ledger_cache_write_tokens != expected_cache_write_tokens
    {
        return Err(AppError::Conflict(
            "Prompt Cache逐阶段账本与供应商usage不一致".to_string(),
        ));
    }
    let integrity_check = database::integrity_check(&connection)?;
    let foreign_key_violations =
        connection.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
            row.get::<_, i64>(0)
        })?;
    let source_items_unchanged =
        count_where(&connection, "source_items", "1 = 1")? == source_items_before;
    let taxonomy_revisions_unchanged =
        count_where(&connection, "ai_taxonomy_revisions", "1 = 1")? == taxonomy_revisions_before;
    if integrity_check != "ok"
        || foreign_key_violations != 0
        || !source_items_unchanged
        || !taxonomy_revisions_unchanged
    {
        return Err(AppError::Conflict(
            "真实业务验收后数据边界或数据库完整性不符合合同".to_string(),
        ));
    }
    let receipt_path = paths.logs.join(format!(
        "formal-prompt-cache-business-acceptance-{}.json",
        chrono::Utc::now().format("%Y%m%d-%H%M%S-%3f")
    ));
    let report = FormalPromptCacheAcceptanceReport {
        task_public_id,
        provider_channel: channel.as_str().to_string(),
        model_id,
        taxonomy_source: "formal_current_domains_topics_read_only".to_string(),
        real_source_count: materials.len(),
        stable_prefix_hash_match: first_assignment_usage.stable_prefix_hash
            == second_assignment_usage.stable_prefix_hash,
        cache_key_hash_match: first_assignment_usage.cache_key_hash
            == second_assignment_usage.cache_key_hash,
        cache_hit_verified: second_assignment_usage.cached_tokens > 0,
        first_profile_usage,
        second_profile_usage,
        first_assignment_usage,
        second_assignment_usage,
        ledger_step_count,
        ledger_cached_tokens,
        ledger_cache_write_tokens,
        ledger_cost_usd,
        source_items_unchanged,
        taxonomy_revisions_unchanged,
        integrity_check,
        foreign_key_violations,
        receipt_path: receipt_path.to_string_lossy().into_owned(),
    };
    write_new_json(&receipt_path, &report)?;
    Ok(report)
}

pub fn run_formal_taxonomy_end_to_end_acceptance(
    data_root: impl AsRef<Path>,
    confirmation: &str,
) -> AppResult<FormalTaxonomyEndToEndAcceptanceReport> {
    if confirmation != FORMAL_TAXONOMY_E2E_CONFIRMATION {
        return Err(AppError::Validation(
            "AI分类全链路真实验收确认令牌不匹配，已拒绝执行".to_string(),
        ));
    }
    let data_root = require_exact_formal_knowledge_root(data_root.as_ref())?;
    let paths = AppPaths::from_root(&data_root)?;
    let _instance_guard = TcpListener::bind("127.0.0.1:47633").map_err(|error| {
        AppError::Conflict(format!(
            "南枫知识库可能正在运行，已停止AI分类全链路真实验收：{error}"
        ))
    })?;
    let connection = database::open_database(&paths.database)?;
    if !schema_versions(&connection)?.contains(&15) {
        return Err(AppError::Conflict(
            "正式数据库尚未应用migration v15，已停止AI分类全链路真实验收".to_string(),
        ));
    }
    let (channel, route) = crate::ai::repository::resolve_task_model_route(&connection, None)?;
    if channel != crate::ai::models::AiProviderChannel::QwenDirect
        || route.profile_model_id != "qwen3.7-flash"
        || route.synthesis_model_id != "qwen3.7-plus"
    {
        return Err(AppError::Conflict(format!(
            "全链路验收只允许冻结的千问Flash/Plus路由；当前为 {}/{}/{}",
            channel.as_str(),
            route.profile_model_id,
            route.synthesis_model_id
        )));
    }
    let api_key = crate::ai::credentials::get_api_key(channel)?
        .ok_or_else(|| AppError::Validation("千问直连未配置API Key".to_string()))?;
    let profile_descriptor =
        crate::ai::repository::model_descriptor(&connection, channel, &route.profile_model_id)?;
    let synthesis_descriptor =
        crate::ai::repository::model_descriptor(&connection, channel, &route.synthesis_model_id)?;
    let materials = formal_acceptance_materials(&connection)?;
    if materials.len() != 2 {
        return Err(AppError::Conflict(
            "全链路真实验收必须且只能读取2条正式来源".to_string(),
        ));
    }
    let production_counts_before = [
        count_where(&connection, "source_items", "1 = 1")?,
        count_where(&connection, "ai_topic_insight_versions", "1 = 1")?,
        count_where(&connection, "ai_source_profile_versions", "1 = 1")?,
        count_where(&connection, "ai_taxonomy_revisions", "1 = 1")?,
        count_where(&connection, "ai_taxonomy_run_checkpoints", "1 = 1")?,
    ];
    let task_public_id = format!("ai-task-taxonomy-e2e-acceptance-{}", Uuid::new_v4());
    connection.execute(
        "INSERT INTO ai_task_runs(
           public_id, task_kind, provider_channel, model_id, status,
           execution_contract_version, started_at
         ) VALUES (?1, 'taxonomy_e2e_acceptance', ?2, ?3, 'running', ?4, ?5)",
        params![
            task_public_id,
            channel.as_str(),
            route.synthesis_model_id,
            crate::ai::prompt_cache::AI_EXECUTION_CONTRACT_VERSION,
            chrono::Utc::now().to_rfc3339()
        ],
    )?;

    let acceptance = (|| -> AppResult<_> {
        let (profiles, profile_usage) = crate::ai::client::run_source_profile_batch(
            channel,
            &api_key,
            &route.profile_model_id,
            &materials,
            profile_descriptor.as_ref(),
        )?;
        crate::ai::repository::record_task_model_step(
            &connection,
            &task_public_id,
            "e2e_profiles",
            channel,
            &route.profile_model_id,
            &profile_usage,
        )?;
        let expected_source_ids = materials
            .iter()
            .map(|item| item.source_item_id)
            .collect::<std::collections::BTreeSet<_>>();
        let profile_source_ids = profiles
            .iter()
            .map(|item| item.source_item_id)
            .collect::<std::collections::BTreeSet<_>>();
        if profiles.len() != materials.len() || profile_source_ids != expected_source_ids {
            return Err(AppError::Conflict(
                "全链路验收的逐篇档案没有一一覆盖2条真实来源".to_string(),
            ));
        }

        let (mut taxonomy, structure_usage) = crate::ai::client::run_taxonomy_structure(
            channel,
            &api_key,
            &route.synthesis_model_id,
            &profiles,
            synthesis_descriptor.as_ref(),
        )?;
        crate::ai::repository::record_task_model_step(
            &connection,
            &task_public_id,
            "e2e_structure",
            channel,
            &route.synthesis_model_id,
            &structure_usage,
        )?;
        if taxonomy.domains.is_empty() || taxonomy.topics.is_empty() {
            return Err(AppError::Conflict(
                "全链路验收未生成有效领域与主题结构".to_string(),
            ));
        }

        let (assignments, assignment_usage) = crate::ai::client::run_taxonomy_assignment_batch(
            channel,
            &api_key,
            &route.profile_model_id,
            &taxonomy,
            &profiles,
            profile_descriptor.as_ref(),
        )?;
        crate::ai::repository::record_task_model_step(
            &connection,
            &task_public_id,
            "e2e_assignments",
            channel,
            &route.profile_model_id,
            &assignment_usage,
        )?;
        let assignment_source_ids = assignments
            .iter()
            .map(|item| item.source_item_id)
            .collect::<std::collections::BTreeSet<_>>();
        if assignments.len() != materials.len() || assignment_source_ids != expected_source_ids {
            return Err(AppError::Conflict(
                "全链路验收的归属结果没有一一覆盖2条真实来源".to_string(),
            ));
        }
        let assigned_topic_keys = assignments
            .iter()
            .map(|item| item.topic_key.as_str())
            .collect::<std::collections::HashSet<_>>();
        let topics_with_sources = taxonomy
            .topics
            .iter()
            .filter(|topic| assigned_topic_keys.contains(topic.key.as_str()))
            .cloned()
            .collect::<Vec<_>>();
        if topics_with_sources.is_empty() {
            return Err(AppError::Conflict(
                "全链路验收没有可执行主题整合的已归属主题".to_string(),
            ));
        }
        let (integrations, integration_usage) =
            crate::ai::client::run_taxonomy_topic_integration_batch(
                channel,
                &api_key,
                &route.synthesis_model_id,
                &topics_with_sources,
                &profiles,
                &assignments,
                synthesis_descriptor.as_ref(),
            )?;
        crate::ai::repository::record_task_model_step(
            &connection,
            &task_public_id,
            "e2e_integrations",
            channel,
            &route.synthesis_model_id,
            &integration_usage,
        )?;
        let integrations_by_topic = integrations
            .into_iter()
            .map(|item| (item.topic_key.clone(), item))
            .collect::<std::collections::HashMap<_, _>>();
        for topic in &mut taxonomy.topics {
            if let Some(integration) = integrations_by_topic.get(&topic.key) {
                topic.integration_markdown = integration.integration_markdown.clone();
                topic.source_item_ids = integration.source_item_ids.clone();
            }
        }
        crate::ai::repository::validate_revision_integrations(&taxonomy, &assignments)?;
        Ok((
            profiles,
            taxonomy,
            assignments,
            vec![
                profile_usage,
                structure_usage,
                assignment_usage,
                integration_usage,
            ],
        ))
    })();
    let (profiles, taxonomy, assignments, usages) = match acceptance {
        Ok(result) => result,
        Err(error) => {
            crate::ai::repository::fail_task(&connection, &task_public_id, &error.to_string())?;
            return Err(error);
        }
    };
    let prompt_tokens = usages.iter().map(|usage| usage.prompt_tokens).sum::<i64>();
    let completion_tokens = usages
        .iter()
        .map(|usage| usage.completion_tokens)
        .sum::<i64>();
    let reasoning_tokens = usages
        .iter()
        .map(|usage| usage.reasoning_tokens)
        .sum::<i64>();
    let cached_tokens = usages.iter().map(|usage| usage.cached_tokens).sum::<i64>();
    let total_tokens = usages.iter().map(|usage| usage.total_tokens).sum::<i64>();
    let cost_usd = usages
        .iter()
        .map(|usage| usage.cost_usd)
        .collect::<Option<Vec<_>>>()
        .map(|values| values.into_iter().sum::<f64>());
    let pricing_snapshots = usages
        .iter()
        .filter_map(|usage| {
            serde_json::from_str::<serde_json::Value>(&usage.pricing_snapshot_json).ok()
        })
        .collect::<Vec<_>>();
    let stage_count = connection.query_row(
        "SELECT COUNT(*) FROM ai_task_model_steps WHERE task_public_id = ?1",
        [&task_public_id],
        |row| row.get::<_, i64>(0),
    )?;
    let prompt_contracts_current: bool = connection.query_row(
        "SELECT COUNT(*) = 4 AND
                SUM(CASE WHEN prompt_contract_version = ?1 THEN 1 ELSE 0 END) = 4
         FROM ai_task_model_steps WHERE task_public_id = ?2",
        params![
            crate::ai::prompt_cache::PROMPT_CONTRACT_VERSION,
            task_public_id
        ],
        |row| row.get(0),
    )?;
    let production_counts_after = [
        count_where(&connection, "source_items", "1 = 1")?,
        count_where(&connection, "ai_topic_insight_versions", "1 = 1")?,
        count_where(&connection, "ai_source_profile_versions", "1 = 1")?,
        count_where(&connection, "ai_taxonomy_revisions", "1 = 1")?,
        count_where(&connection, "ai_taxonomy_run_checkpoints", "1 = 1")?,
    ];
    let production_tables_unchanged = production_counts_before == production_counts_after;
    let integrity_check = database::integrity_check(&connection)?;
    let foreign_key_violations =
        connection.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
            row.get::<_, i64>(0)
        })?;
    if stage_count != 4
        || !prompt_contracts_current
        || !production_tables_unchanged
        || integrity_check != "ok"
        || foreign_key_violations != 0
    {
        crate::ai::repository::fail_task(
            &connection,
            &task_public_id,
            "AI分类全链路验收的账本、数据边界或数据库完整性未通过",
        )?;
        return Err(AppError::Conflict(
            "AI分类全链路验收的账本、数据边界或数据库完整性未通过".to_string(),
        ));
    }
    connection.execute(
        "UPDATE ai_task_runs SET status = 'completed',
           prompt_tokens = ?1, completion_tokens = ?2, reasoning_tokens = ?3,
           cached_tokens = ?4, total_tokens = ?5, cost_usd = ?6,
           cost_kind = ?7, pricing_snapshot_json = ?8, completed_at = ?9
         WHERE public_id = ?10",
        params![
            prompt_tokens,
            completion_tokens,
            reasoning_tokens,
            cached_tokens,
            total_tokens,
            cost_usd,
            if cost_usd.is_some() {
                "aggregated"
            } else {
                "unavailable"
            },
            serde_json::json!({ "kind": "multi_step", "steps": pricing_snapshots }).to_string(),
            chrono::Utc::now().to_rfc3339(),
            task_public_id,
        ],
    )?;
    let integrated_topic_count = taxonomy
        .topics
        .iter()
        .filter(|topic| !topic.integration_markdown.trim().is_empty())
        .count();
    let receipt_path = paths.logs.join(format!(
        "formal-taxonomy-e2e-acceptance-{}.json",
        chrono::Utc::now().format("%Y%m%d-%H%M%S-%3f")
    ));
    let report = FormalTaxonomyEndToEndAcceptanceReport {
        task_public_id,
        provider_channel: channel.as_str().to_string(),
        profile_model_id: route.profile_model_id,
        synthesis_model_id: route.synthesis_model_id,
        real_source_count: materials.len(),
        domain_count: taxonomy.domains.len(),
        topic_count: taxonomy.topics.len(),
        assignment_count: assignments.len(),
        integrated_topic_count,
        stage_count,
        prompt_tokens,
        completion_tokens,
        reasoning_tokens,
        cached_tokens,
        total_tokens,
        cost_usd,
        prompt_contracts_current,
        execution_contract_version: crate::ai::prompt_cache::AI_EXECUTION_CONTRACT_VERSION
            .to_string(),
        production_tables_unchanged,
        integrity_check,
        foreign_key_violations,
        receipt_path: receipt_path.to_string_lossy().into_owned(),
    };
    let _ = profiles;
    write_new_json(&receipt_path, &report)?;
    Ok(report)
}

pub fn run_formal_qwen_reasoning_ab_acceptance(
    data_root: impl AsRef<Path>,
    confirmation: &str,
) -> AppResult<FormalQwenReasoningAbReport> {
    if confirmation != FORMAL_QWEN_REASONING_AB_CONFIRMATION {
        return Err(AppError::Validation(
            "千问思考策略正式A/B确认令牌不匹配，已拒绝执行".to_string(),
        ));
    }
    let data_root = require_exact_formal_knowledge_root(data_root.as_ref())?;
    let paths = AppPaths::from_root(&data_root)?;
    let _instance_guard = TcpListener::bind("127.0.0.1:47633").map_err(|error| {
        AppError::Conflict(format!(
            "南枫知识库可能正在运行，已停止千问思考策略A/B：{error}"
        ))
    })?;
    let connection = database::open_database(&paths.database)?;
    if !schema_versions(&connection)?.contains(&14) {
        return Err(AppError::Conflict(
            "正式数据库尚未应用migration v14，已停止千问思考策略A/B".to_string(),
        ));
    }
    let source_items_before = count_where(&connection, "source_items", "1 = 1")?;
    let topics_before = count_where(&connection, "topics", "1 = 1")?;
    let taxonomy_revisions_before = count_where(&connection, "ai_taxonomy_revisions", "1 = 1")?;
    let task_runs_before = count_where(&connection, "ai_task_runs", "1 = 1")?;
    let model_steps_before = count_where(&connection, "ai_task_model_steps", "1 = 1")?;
    let (channel, route) = crate::ai::repository::resolve_task_model_route(&connection, None)?;
    if channel != crate::ai::models::AiProviderChannel::QwenDirect {
        return Err(AppError::Conflict(
            "正式设置当前不是千问直连，未发送A/B请求".to_string(),
        ));
    }
    let model_id = route.profile_model_id;
    if model_id != crate::ai::models::QWEN_DEFAULT_ORGANIZATION_MODEL {
        return Err(AppError::Conflict(format!(
            "正式批量模型不是{}，未发送A/B请求",
            crate::ai::models::QWEN_DEFAULT_ORGANIZATION_MODEL
        )));
    }
    let api_key = crate::ai::credentials::get_api_key(channel)?
        .ok_or_else(|| AppError::Validation("千问直连未配置API Key".to_string()))?;
    let descriptor = crate::ai::repository::model_descriptor(&connection, channel, &model_id)?;
    let taxonomy = formal_current_taxonomy(&connection)?;
    let materials = formal_acceptance_materials(&connection)?;
    let task_public_id = format!("ai-task-qwen-reasoning-ab-{}", Uuid::new_v4());
    connection.execute(
        "INSERT INTO ai_task_runs(
           public_id, task_kind, provider_channel, model_id, status, started_at
         ) VALUES (?1, 'qwen_reasoning_ab_acceptance', ?2, ?3, 'running', ?4)",
        params![
            task_public_id,
            channel.as_str(),
            model_id,
            chrono::Utc::now().to_rfc3339()
        ],
    )?;

    let thinking_mode = crate::ai::prompt_cache::InferenceReasoningMode::ProviderDefault;
    let no_thinking_mode = crate::ai::prompt_cache::InferenceReasoningMode::Disabled;
    let (thinking_profiles, thinking_profile_usage) =
        match crate::ai::client::run_source_profile_batch_with_reasoning_mode(
            channel,
            &api_key,
            &model_id,
            &materials,
            descriptor.as_ref(),
            thinking_mode,
        ) {
            Ok(result) => result,
            Err(error) => {
                crate::ai::repository::fail_task(&connection, &task_public_id, &error.to_string())?;
                return Err(error);
            }
        };
    crate::ai::repository::record_task_model_step(
        &connection,
        &task_public_id,
        "profiles_thinking_on",
        channel,
        &model_id,
        &thinking_profile_usage,
    )?;
    if thinking_profile_usage.completion_tokens > 5_000 {
        crate::ai::repository::fail_task(
            &connection,
            &task_public_id,
            "思考开启档案阶段超过5000 completion tokens停止线",
        )?;
        return Err(AppError::Conflict(
            "思考开启档案阶段超过5000 completion tokens，已停止后续请求".to_string(),
        ));
    }

    let (no_thinking_profiles, no_thinking_profile_usage) =
        match crate::ai::client::run_source_profile_batch_with_reasoning_mode(
            channel,
            &api_key,
            &model_id,
            &materials,
            descriptor.as_ref(),
            no_thinking_mode,
        ) {
            Ok(result) => result,
            Err(error) => {
                crate::ai::repository::fail_task(&connection, &task_public_id, &error.to_string())?;
                return Err(error);
            }
        };
    crate::ai::repository::record_task_model_step(
        &connection,
        &task_public_id,
        "profiles_thinking_off",
        channel,
        &model_id,
        &no_thinking_profile_usage,
    )?;

    let (thinking_assignments, thinking_assignment_usage) =
        match crate::ai::client::run_taxonomy_assignment_batch_with_reasoning_mode(
            channel,
            &api_key,
            &model_id,
            &taxonomy,
            &thinking_profiles,
            descriptor.as_ref(),
            thinking_mode,
        ) {
            Ok(result) => result,
            Err(error) => {
                crate::ai::repository::fail_task(&connection, &task_public_id, &error.to_string())?;
                return Err(error);
            }
        };
    crate::ai::repository::record_task_model_step(
        &connection,
        &task_public_id,
        "assignments_thinking_on",
        channel,
        &model_id,
        &thinking_assignment_usage,
    )?;
    if thinking_assignment_usage.completion_tokens > 5_000 {
        crate::ai::repository::fail_task(
            &connection,
            &task_public_id,
            "思考开启归属阶段超过5000 completion tokens停止线",
        )?;
        return Err(AppError::Conflict(
            "思考开启归属阶段超过5000 completion tokens，已停止关闭思考对照".to_string(),
        ));
    }

    let (no_thinking_assignments, no_thinking_assignment_usage) =
        match crate::ai::client::run_taxonomy_assignment_batch_with_reasoning_mode(
            channel,
            &api_key,
            &model_id,
            &taxonomy,
            &no_thinking_profiles,
            descriptor.as_ref(),
            no_thinking_mode,
        ) {
            Ok(result) => result,
            Err(error) => {
                crate::ai::repository::fail_task(&connection, &task_public_id, &error.to_string())?;
                return Err(error);
            }
        };
    crate::ai::repository::record_task_model_step(
        &connection,
        &task_public_id,
        "assignments_thinking_off",
        channel,
        &model_id,
        &no_thinking_assignment_usage,
    )?;

    let usages = [
        &thinking_profile_usage,
        &no_thinking_profile_usage,
        &thinking_assignment_usage,
        &no_thinking_assignment_usage,
    ];
    let prompt_tokens = usages.iter().map(|usage| usage.prompt_tokens).sum::<i64>();
    let completion_tokens = usages
        .iter()
        .map(|usage| usage.completion_tokens)
        .sum::<i64>();
    let reasoning_tokens = usages
        .iter()
        .map(|usage| usage.reasoning_tokens)
        .sum::<i64>();
    let cached_tokens = usages.iter().map(|usage| usage.cached_tokens).sum::<i64>();
    let total_tokens = usages.iter().map(|usage| usage.total_tokens).sum::<i64>();
    let total_cost = usages
        .iter()
        .map(|usage| usage.cost_usd)
        .collect::<Option<Vec<_>>>()
        .map(|costs| costs.into_iter().sum::<f64>());
    connection.execute(
        "UPDATE ai_task_runs SET status = 'completed',
           prompt_tokens = ?1, completion_tokens = ?2, reasoning_tokens = ?3,
           cached_tokens = ?4, total_tokens = ?5, cost_usd = ?6,
           cost_kind = ?7, pricing_snapshot_json = ?8, completed_at = ?9
         WHERE public_id = ?10",
        params![
            prompt_tokens,
            completion_tokens,
            reasoning_tokens,
            cached_tokens,
            total_tokens,
            total_cost,
            if total_cost.is_some() {
                "estimated"
            } else {
                "unavailable"
            },
            no_thinking_assignment_usage.pricing_snapshot_json,
            chrono::Utc::now().to_rfc3339(),
            task_public_id,
        ],
    )?;

    let (ledger_step_count, ledger_reasoning_tokens, ledger_cost_usd) = connection.query_row(
        "SELECT COUNT(*), COALESCE(SUM(reasoning_tokens), 0), SUM(cost_usd)
         FROM ai_task_model_steps WHERE task_public_id = ?1",
        [&task_public_id],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, Option<f64>>(2)?,
            ))
        },
    )?;
    if ledger_step_count != 4 || ledger_reasoning_tokens != reasoning_tokens {
        return Err(AppError::Conflict(
            "千问思考策略A/B逐阶段账本与供应商usage不一致".to_string(),
        ));
    }

    let thinking_profile_summaries_non_empty = thinking_profiles
        .iter()
        .all(|profile| !profile.summary.trim().is_empty());
    let no_thinking_profile_summaries_non_empty = no_thinking_profiles
        .iter()
        .all(|profile| !profile.summary.trim().is_empty());
    let profile_concept_overlap_rate =
        profile_term_overlap_rate(&thinking_profiles, &no_thinking_profiles, |profile| {
            &profile.concepts
        });
    let profile_candidate_topic_overlap_rate =
        profile_term_overlap_rate(&thinking_profiles, &no_thinking_profiles, |profile| {
            &profile.candidate_topics
        });
    let no_thinking_assignments_by_id = no_thinking_assignments
        .iter()
        .map(|assignment| (assignment.source_item_id, assignment))
        .collect::<std::collections::HashMap<_, _>>();
    let assignment_topic_match_count = thinking_assignments
        .iter()
        .filter(|assignment| {
            no_thinking_assignments_by_id
                .get(&assignment.source_item_id)
                .is_some_and(|other| other.topic_key == assignment.topic_key)
        })
        .count();
    let assignment_uncertain_match_count = thinking_assignments
        .iter()
        .filter(|assignment| {
            no_thinking_assignments_by_id
                .get(&assignment.source_item_id)
                .is_some_and(|other| other.uncertain == assignment.uncertain)
        })
        .count();
    let assignment_confidence_mean_absolute_delta = thinking_assignments
        .iter()
        .filter_map(|assignment| {
            no_thinking_assignments_by_id
                .get(&assignment.source_item_id)
                .map(|other| (assignment.confidence - other.confidence).abs())
        })
        .sum::<f64>()
        / thinking_assignments.len().max(1) as f64;
    let assignment_topic_match_rate =
        assignment_topic_match_count as f64 / thinking_assignments.len().max(1) as f64;
    let thinking_reasoning_tokens =
        thinking_profile_usage.reasoning_tokens + thinking_assignment_usage.reasoning_tokens;
    let no_thinking_reasoning_tokens =
        no_thinking_profile_usage.reasoning_tokens + no_thinking_assignment_usage.reasoning_tokens;
    let thinking_completion_tokens =
        thinking_profile_usage.completion_tokens + thinking_assignment_usage.completion_tokens;
    let no_thinking_completion_tokens = no_thinking_profile_usage.completion_tokens
        + no_thinking_assignment_usage.completion_tokens;
    let thinking_duration_ms = sum_optional_i64(
        thinking_profile_usage.duration_ms,
        thinking_assignment_usage.duration_ms,
    );
    let no_thinking_duration_ms = sum_optional_i64(
        no_thinking_profile_usage.duration_ms,
        no_thinking_assignment_usage.duration_ms,
    );
    let duration_reduction_ms = thinking_duration_ms
        .zip(no_thinking_duration_ms)
        .map(|(thinking, no_thinking)| thinking - no_thinking);
    let source_items_unchanged =
        count_where(&connection, "source_items", "1 = 1")? == source_items_before;
    let topics_unchanged = count_where(&connection, "topics", "1 = 1")? == topics_before;
    let taxonomy_revisions_unchanged =
        count_where(&connection, "ai_taxonomy_revisions", "1 = 1")? == taxonomy_revisions_before;
    let expected_task_rows =
        count_where(&connection, "ai_task_runs", "1 = 1")? == task_runs_before + 1;
    let expected_step_rows =
        count_where(&connection, "ai_task_model_steps", "1 = 1")? == model_steps_before + 4;
    let integrity_check = database::integrity_check(&connection)?;
    let foreign_key_violations =
        connection.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
            row.get::<_, i64>(0)
        })?;
    if !thinking_profile_summaries_non_empty
        || !no_thinking_profile_summaries_non_empty
        || no_thinking_reasoning_tokens != 0
        || !source_items_unchanged
        || !topics_unchanged
        || !taxonomy_revisions_unchanged
        || !expected_task_rows
        || !expected_step_rows
        || integrity_check != "ok"
        || foreign_key_violations != 0
    {
        return Err(AppError::Conflict(
            "千问思考策略A/B结构、账本或正式数据边界验收失败".to_string(),
        ));
    }
    let receipt_path = paths.logs.join(format!(
        "formal-qwen-reasoning-ab-{}.json",
        chrono::Utc::now().format("%Y%m%d-%H%M%S-%3f")
    ));
    let report = FormalQwenReasoningAbReport {
        task_public_id,
        provider_channel: channel.as_str().to_string(),
        model_id,
        real_source_count: materials.len(),
        taxonomy_topic_count: taxonomy.topics.len(),
        thinking_profile_usage,
        no_thinking_profile_usage,
        thinking_assignment_usage,
        no_thinking_assignment_usage,
        thinking_profile_summaries_non_empty,
        no_thinking_profile_summaries_non_empty,
        profile_concept_overlap_rate,
        profile_candidate_topic_overlap_rate,
        assignment_topic_match_count,
        assignment_topic_match_rate,
        assignment_uncertain_match_count,
        assignment_confidence_mean_absolute_delta,
        thinking_reasoning_tokens,
        no_thinking_reasoning_tokens,
        reasoning_token_reduction: thinking_reasoning_tokens - no_thinking_reasoning_tokens,
        thinking_completion_tokens,
        no_thinking_completion_tokens,
        completion_token_reduction: thinking_completion_tokens - no_thinking_completion_tokens,
        thinking_duration_ms,
        no_thinking_duration_ms,
        duration_reduction_ms,
        ledger_step_count,
        ledger_reasoning_tokens,
        ledger_cost_usd,
        source_items_unchanged,
        topics_unchanged,
        taxonomy_revisions_unchanged,
        integrity_check,
        foreign_key_violations,
        response_body_persisted: false,
        receipt_path: receipt_path.to_string_lossy().into_owned(),
    };
    write_new_json(&receipt_path, &report)?;
    Ok(report)
}

pub fn migrate_formal_knowledge_base(
    data_root: impl AsRef<Path>,
    confirmation: &str,
) -> AppResult<FormalKnowledgeMigrationReport> {
    if confirmation != FORMAL_MIGRATION_CONFIRMATION {
        return Err(AppError::Validation(
            "正式迁移确认令牌不匹配，已拒绝写入正式数据".to_string(),
        ));
    }
    let data_root = require_exact_formal_knowledge_root(data_root.as_ref())?;
    let paths = AppPaths::from_root(&data_root)?;
    if !paths.database.is_file() {
        return Err(AppError::NotFound(format!(
            "正式数据库不存在：{}",
            paths.database.display()
        )));
    }

    // 与桌面应用共用单实例端口。维护期间持有端口，避免迁移和用户写入并发发生。
    let _instance_guard = TcpListener::bind("127.0.0.1:47633").map_err(|error| {
        AppError::Conflict(format!("南枫知识库可能正在运行，已停止正式迁移：{error}"))
    })?;

    let automatic_backups_before =
        matching_files(&paths.backups, "知识结构迁移前自动备份_", ".db")?;
    let preflight_connection = Connection::open_with_flags(
        &paths.database,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    preflight_connection.busy_timeout(std::time::Duration::from_secs(5))?;
    let preflight = formal_knowledge_snapshot(&preflight_connection, &paths.database)?;
    if preflight.schema_versions.contains(&3) {
        return Err(AppError::Conflict(
            "正式数据库已经包含 migration v3；本工具拒绝重复创建正式迁移备份".to_string(),
        ));
    }
    if preflight.integrity_check != "ok" || preflight.foreign_key_violations != 0 {
        return Err(AppError::Conflict(format!(
            "正式数据库升级前检查未通过：完整性 {}，外键违规 {}",
            preflight.integrity_check, preflight.foreign_key_violations
        )));
    }

    // 无界面维护无法读取 WebView localStorage；迁移只改数据库，现有界面设置保持不动。
    // 完整备份仍显式包含空 preferences.json，恢复时不会伪造未读取到的设置。
    let portable_backup = transfer::create_portable_backup(
        &preflight_connection,
        &paths,
        "{}",
        "正式知识结构升级前完整备份",
    )?;
    let portable_preview = transfer::inspect_portable_backup(&portable_backup.folder_path)?;
    let portable_folder = PathBuf::from(&portable_backup.folder_path);
    let portable_database = portable_folder.join("data").join("app.db");
    let portable_manifest = portable_folder.join("manifest.json");
    let before_connection =
        Connection::open_with_flags(&portable_database, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let before = formal_knowledge_snapshot(&before_connection, &portable_database)?;
    drop(before_connection);
    if !formal_snapshots_logically_equal(&preflight, &before)
        || before.integrity_check != "ok"
        || before.foreign_key_violations != 0
        || !portable_preview.restorable
        || portable_preview.content_integrity != "verified_sha256"
    {
        return Err(AppError::Conflict(
            "正式迁移前完整备份与当前数据库逻辑状态不一致，已停止迁移".to_string(),
        ));
    }
    drop(preflight_connection);

    let migration_result =
        run_formal_migration_and_verify(&paths, &before, &automatic_backups_before);
    let (after, reopened, automatic_database_backup) = match migration_result {
        Ok(result) => result,
        Err(error) => {
            return match rollback_formal_database(&paths, &portable_database, &before) {
                Ok(()) => Err(AppError::Conflict(format!(
                    "正式 migration v3 失败，已从完整备份恢复迁移前数据库：{error}"
                ))),
                Err(rollback_error) => Err(AppError::Conflict(format!(
                    "正式 migration v3 失败，数据库自动恢复也失败：{error}；恢复错误：{rollback_error}；完整备份位于 {}",
                    portable_folder.display()
                ))),
            };
        }
    };

    let idempotent = after == reopened;
    let automatic_database_backup_sha256 = sha256_file(&automatic_database_backup)?;
    let mut report = FormalKnowledgeMigrationReport {
        data_root: data_root.to_string_lossy().into_owned(),
        database: paths.database.to_string_lossy().into_owned(),
        before,
        portable_backup_folder: portable_backup.folder_path,
        portable_backup_manifest_sha256: sha256_file(&portable_manifest)?,
        portable_backup_database_sha256: sha256_file(&portable_database)?,
        portable_backup_file_count: portable_backup.file_count,
        portable_backup_total_bytes: portable_backup.total_bytes,
        portable_backup_content_integrity: portable_preview.content_integrity,
        portable_backup_preferences:
            "headless_empty_object; live WebView localStorage was not modified".to_string(),
        automatic_database_backup: automatic_database_backup.to_string_lossy().into_owned(),
        automatic_database_backup_sha256,
        after,
        reopened,
        idempotent,
        receipt_path: None,
        receipt_write_error: None,
    };
    let receipt_path = paths.logs.join(format!(
        "formal-knowledge-migration-v3-{}.json",
        chrono::Utc::now().format("%Y%m%d-%H%M%S-%3f")
    ));
    report.receipt_path = Some(receipt_path.to_string_lossy().into_owned());
    if let Err(error) = write_new_json(&receipt_path, &report) {
        report.receipt_path = None;
        report.receipt_write_error = Some(error.to_string());
    }
    Ok(report)
}

pub fn run_isolated_portable_recovery_qa(
    source_root: impl AsRef<Path>,
    qa_root: impl AsRef<Path>,
) -> AppResult<PortableRecoveryQaReport> {
    const BASELINE_PREFERENCES: &str = r#"{"nanfeng-knowledge-base:qa-layout":"three-column","nanfeng-knowledge-base:qa-density":"compact"}"#;
    const MUTATED_PREFERENCES: &str =
        r#"{"nanfeng-knowledge-base:qa-layout":"mutated-before-restore"}"#;
    const ROLLBACK_PREFERENCES: &str =
        r#"{"nanfeng-knowledge-base:qa-layout":"rollback-protected"}"#;
    const SYNTHETIC_IMPORT: &str = "qa-import-source.txt";
    const SYNTHETIC_ATTACHMENT: &str = "qa-attachment.bin";

    let source_root = require_isolated_root(source_root.as_ref(), "隔离输入目录")?;
    let qa_root = require_isolated_root(qa_root.as_ref(), "隔离演练目录")?;
    require_isolated_marker(&source_root)?;
    if qa_root.exists() {
        return Err(AppError::Conflict(format!(
            "隔离演练目录已存在，拒绝覆盖：{}",
            qa_root.display()
        )));
    }
    fs::create_dir(&qa_root)?;
    fs::write(
        qa_root.join(ISOLATED_MIGRATION_MARKER),
        b"portable-recovery-qa-v1",
    )?;

    let paths = AppPaths::from_root(&qa_root)?;
    let source_database = source_root.join("data").join("app.db");
    if !source_database.is_file() {
        return Err(AppError::NotFound(format!(
            "隔离输入数据库不存在：{}",
            source_database.display()
        )));
    }
    let source_database_sha256 = sha256_file(&source_database)?;
    let source_connection =
        Connection::open_with_flags(&source_database, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let mut target_connection = Connection::open(&paths.database)?;
    database::copy_database(&source_connection, &mut target_connection)?;
    drop(target_connection);
    drop(source_connection);

    fs::write(
        paths.imports_raw.join(SYNTHETIC_IMPORT),
        b"portable recovery qa import baseline\n",
    )?;
    fs::write(
        paths.attachments.join(SYNTHETIC_ATTACHMENT),
        b"portable recovery qa attachment baseline\n",
    )?;

    let mut connection = database::open_database(&paths.database)?;
    checkpoint_database(&connection)?;
    let baseline = portable_recovery_snapshot(
        &connection,
        &paths,
        BASELINE_PREFERENCES,
        SYNTHETIC_IMPORT,
        SYNTHETIC_ATTACHMENT,
    )?;

    let backup = transfer::create_portable_backup(
        &connection,
        &paths,
        BASELINE_PREFERENCES,
        "隔离完整迁移备份演练",
    )?;
    let backup_preview = transfer::inspect_portable_backup(&backup.folder_path)?;
    let backup_folder = PathBuf::from(&backup.folder_path);
    let backup_manifest_path = backup_folder.join("manifest.json");
    let backup_manifest_sha256 = sha256_file(&backup_manifest_path)?;
    let backup_manifest =
        serde_json::from_slice::<serde_json::Value>(&fs::read(&backup_manifest_path)?)?;
    let backup_manifest_files = backup_manifest
        .get("files")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| AppError::Validation("完整迁移备份缺少逐文件清单".to_string()))?;
    let backup_manifest_file_count = backup_manifest_files.len();
    let backup_manifest_bytes = backup_manifest_files
        .iter()
        .filter_map(|entry| entry.get("sizeBytes").and_then(serde_json::Value::as_u64))
        .sum();

    connection.execute_batch(
        "CREATE TABLE qa_restore_mutation(value TEXT NOT NULL);
         INSERT INTO qa_restore_mutation(value) VALUES ('must-disappear-after-restore');",
    )?;
    fs::write(
        paths.imports_raw.join(SYNTHETIC_IMPORT),
        b"mutated import before successful restore\n",
    )?;
    fs::write(
        paths.attachments.join(SYNTHETIC_ATTACHMENT),
        b"mutated attachment before successful restore\n",
    )?;

    let restored_result = transfer::restore_portable_backup(
        &mut connection,
        &paths,
        &backup.folder_path,
        MUTATED_PREFERENCES,
    )?;
    checkpoint_database(&connection)?;
    let restored = portable_recovery_snapshot(
        &connection,
        &paths,
        &restored_result.preferences_json,
        SYNTHETIC_IMPORT,
        SYNTHETIC_ATTACHMENT,
    )?;
    let restore_mutation_exists = table_exists(&connection, "qa_restore_mutation")?;
    let restored_preferences_match =
        json_values_equal(&restored_result.preferences_json, BASELINE_PREFERENCES)?;
    if restore_mutation_exists
        || restored.import_sha256 != baseline.import_sha256
        || restored.attachment_sha256 != baseline.attachment_sha256
        || restored.active_records != baseline.active_records
        || restored.source_items != baseline.source_items
        || restored.attachment_rows != baseline.attachment_rows
        || !restored_preferences_match
    {
        return Err(AppError::Conflict(
            "完整迁移备份恢复后的数据库、文件或界面偏好与基线不一致".to_string(),
        ));
    }

    connection.execute_batch(
        "CREATE TABLE qa_rollback_guard(value TEXT NOT NULL);
         INSERT INTO qa_rollback_guard(value) VALUES ('rollback-protected-state');",
    )?;
    fs::write(
        paths.imports_raw.join(SYNTHETIC_IMPORT),
        b"rollback protected import\n",
    )?;
    fs::write(
        paths.attachments.join(SYNTHETIC_ATTACHMENT),
        b"rollback protected attachment\n",
    )?;
    checkpoint_database(&connection)?;
    let rollback_protected = portable_recovery_snapshot(
        &connection,
        &paths,
        ROLLBACK_PREFERENCES,
        SYNTHETIC_IMPORT,
        SYNTHETIC_ATTACHMENT,
    )?;

    let fault_injection_error = match transfer::restore_portable_backup_with_fault_injection(
        &mut connection,
        &paths,
        &backup.folder_path,
        ROLLBACK_PREFERENCES,
        transfer::PortableRestoreFault::AfterImports,
    ) {
        Ok(_) => {
            return Err(AppError::Conflict(
                "隔离故障注入未让恢复返回失败".to_string(),
            ))
        }
        Err(error) => error.to_string(),
    };
    if !fault_injection_error.contains("隔离恢复演练注入故障") {
        return Err(AppError::Conflict(format!(
            "恢复失败不是预期的隔离故障注入：{fault_injection_error}"
        )));
    }
    checkpoint_database(&connection)?;
    let rollback_after_failure = portable_recovery_snapshot(
        &connection,
        &paths,
        ROLLBACK_PREFERENCES,
        SYNTHETIC_IMPORT,
        SYNTHETIC_ATTACHMENT,
    )?;
    let rollback_guard_preserved = connection.query_row(
        "SELECT COUNT(*) FROM qa_rollback_guard WHERE value = 'rollback-protected-state'",
        [],
        |row| row.get::<_, i64>(0),
    )? == 1;
    let rollback_exact_files_match = rollback_after_failure.import_sha256
        == rollback_protected.import_sha256
        && rollback_after_failure.attachment_sha256 == rollback_protected.attachment_sha256;
    if !rollback_guard_preserved
        || !rollback_exact_files_match
        || rollback_after_failure.active_records != rollback_protected.active_records
        || rollback_after_failure.source_items != rollback_protected.source_items
        || rollback_after_failure.attachment_rows != rollback_protected.attachment_rows
        || rollback_after_failure.integrity_check != "ok"
        || rollback_after_failure.foreign_key_violations != 0
    {
        return Err(AppError::Conflict(
            "故障注入后的自动回滚没有完整保留受保护状态".to_string(),
        ));
    }

    let rollback_safety_backup = newest_matching_directory(&paths.backups, "恢复前完整安全备份_")?
        .ok_or_else(|| AppError::Conflict("故障注入没有生成回滚安全备份".to_string()))?;
    let rollback_safety_preview = transfer::inspect_portable_backup(&rollback_safety_backup)?;
    let rollback_safety_preferences =
        fs::read_to_string(rollback_safety_backup.join("preferences.json"))?;
    let rollback_safety_manifest_verified = rollback_safety_preview.restorable
        && rollback_safety_preview.content_integrity == "verified_sha256"
        && json_values_equal(&rollback_safety_preferences, ROLLBACK_PREFERENCES)?;
    if !rollback_safety_manifest_verified {
        return Err(AppError::Conflict(
            "故障注入的回滚安全备份未通过逐文件或界面偏好检查".to_string(),
        ));
    }

    drop(connection);
    let restart_connection = database::open_database(&paths.database)?;
    checkpoint_database(&restart_connection)?;
    let restart = portable_recovery_snapshot(
        &restart_connection,
        &paths,
        ROLLBACK_PREFERENCES,
        SYNTHETIC_IMPORT,
        SYNTHETIC_ATTACHMENT,
    )?;
    let restart_persisted = restart_connection.query_row(
        "SELECT COUNT(*) FROM qa_rollback_guard WHERE value = 'rollback-protected-state'",
        [],
        |row| row.get::<_, i64>(0),
    )? == 1
        && restart.import_sha256 == rollback_protected.import_sha256
        && restart.attachment_sha256 == rollback_protected.attachment_sha256
        && restart.schema_versions == vec![1, 2, 3]
        && restart.integrity_check == "ok"
        && restart.foreign_key_violations == 0;
    if !restart_persisted {
        return Err(AppError::Conflict(
            "隔离恢复数据在关闭并重开数据库后没有保持一致".to_string(),
        ));
    }
    drop(restart_connection);

    let receipt_path = paths.logs.join("portable-recovery-qa-report.json");
    let mut report = PortableRecoveryQaReport {
        source_root: source_root.to_string_lossy().into_owned(),
        qa_root: qa_root.to_string_lossy().into_owned(),
        source_database_sha256,
        baseline,
        backup_folder: backup.folder_path,
        backup_manifest_sha256,
        backup_manifest_file_count,
        backup_manifest_bytes,
        backup_inventory_file_count: backup.file_count,
        backup_inventory_bytes: backup.total_bytes,
        backup_content_integrity: backup_preview.content_integrity,
        restored,
        restored_preferences_match,
        successful_restore_log: restored_result.log_path,
        fault_injection_error,
        rollback_safety_backup: rollback_safety_backup.to_string_lossy().into_owned(),
        rollback_safety_manifest_verified,
        rollback_protected,
        rollback_after_failure,
        rollback_exact_files_match,
        restart,
        restart_persisted,
        receipt_path: receipt_path.to_string_lossy().into_owned(),
    };
    write_new_json(&receipt_path, &report)?;
    report.receipt_path = receipt_path.to_string_lossy().into_owned();
    Ok(report)
}

pub fn import_chatgpt_export_with_backup(
    data_root: impl AsRef<Path>,
    source_zip: impl AsRef<Path>,
    expected_sha256: &str,
    expected_conversation_count: usize,
    expected_asset_count: usize,
) -> AppResult<ChatGptImportMaintenanceReport> {
    let data_root = require_absolute_path(data_root.as_ref(), "数据目录")?;
    let source_zip = require_absolute_path(source_zip.as_ref(), "ChatGPT 导出包")?;
    if !source_zip.is_file() {
        return Err(AppError::NotFound(format!(
            "ChatGPT 导出包不存在：{}",
            source_zip.display()
        )));
    }

    let inspection = chatgpt_export::inspect_chatgpt_export(&source_zip)
        .map_err(|error| AppError::Validation(error.to_string()))?;
    if !inspection
        .source_zip_sha256
        .eq_ignore_ascii_case(expected_sha256)
    {
        return Err(AppError::Conflict(format!(
            "导出包 SHA-256 不符合预期：{}",
            inspection.source_zip_sha256
        )));
    }
    if inspection.conversation_count != expected_conversation_count {
        return Err(AppError::Conflict(format!(
            "导出包会话数不符合预期：实际 {}，预期 {}",
            inspection.conversation_count, expected_conversation_count
        )));
    }
    if inspection.assets.len() != expected_asset_count {
        return Err(AppError::Conflict(format!(
            "导出包附件实体数不符合预期：实际 {}，预期 {}",
            inspection.assets.len(),
            expected_asset_count
        )));
    }

    let paths = AppPaths::from_root(&data_root)?;
    let mut connection = database::open_database(&paths.database)?;
    let integrity_before = database::integrity_check(&connection)?;
    if integrity_before != "ok" {
        return Err(AppError::Conflict(format!(
            "导入前数据库完整性检查失败：{integrity_before}"
        )));
    }
    let records_before = active_record_count(&connection)?;
    let database_backup = transfer::create_backup(&connection, &paths, "ChatGPT完整导入前备份")?;

    let existing_job = connection
        .query_row(
            "SELECT id, stored_file_path, status
             FROM import_jobs
             WHERE lower(sha256) = lower(?1)
             ORDER BY created_at DESC
             LIMIT 1",
            [inspection.source_zip_sha256.as_str()],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .optional()?;
    let import_job_id = match existing_job {
        Some((_, _, status)) if status == "completed" => {
            return Err(AppError::Conflict(
                "相同 SHA-256 的 ChatGPT 完整导出包已经成功导入，已停止重复写入".to_string(),
            ));
        }
        Some((job_id, stored_file_path, status))
            if status == "preview" && Path::new(&stored_file_path).is_file() =>
        {
            job_id
        }
        _ => {
            let preview = importer::prepare_import(&connection, &paths, &source_zip)?;
            if preview.record_count != expected_conversation_count {
                return Err(AppError::Conflict(format!(
                    "导入预览会话数不符合预期：实际 {}，预期 {}",
                    preview.record_count, expected_conversation_count
                )));
            }
            preview.job_id
        }
    };

    let result = importer::confirm_import(
        &mut connection,
        &paths,
        &ConfirmImportInput {
            job_id: import_job_id.clone(),
            records: Vec::new(),
            allow_duplicate: false,
            duplicate_strategy: "copy".to_string(),
            item_strategies: Vec::new(),
            mapping: serde_json::json!({
                "source": "chatgpt_complete_export_zip",
                "verification": "maintenance_v1"
            }),
        },
    )?;
    if result.status != "completed" || !result.errors.is_empty() {
        return Err(AppError::Conflict(format!(
            "完整导入未成功收口：状态 {}，错误 {}",
            result.status,
            result.errors.join("；")
        )));
    }

    let records_after = active_record_count(&connection)?;
    if records_after - records_before != result.imported_count as i64 {
        return Err(AppError::Conflict(format!(
            "导入前后记录数差异异常：导入器报告 {}，数据库实际增加 {}",
            result.imported_count,
            records_after - records_before
        )));
    }
    let integrity_after = database::integrity_check(&connection)?;
    if integrity_after != "ok" {
        return Err(AppError::Conflict(format!(
            "导入后数据库完整性检查失败：{integrity_after}"
        )));
    }

    let mapping_json: String = connection.query_row(
        "SELECT mapping_json FROM import_jobs WHERE id = ?1",
        [&import_job_id],
        |row| row.get(0),
    )?;
    let mapping: serde_json::Value = serde_json::from_str(&mapping_json)?;
    let manifest_path = mapping
        .get("chatGptAttachmentManifest")
        .and_then(serde_json::Value::as_str)
        .map(PathBuf::from)
        .ok_or_else(|| AppError::Conflict("导入任务缺少 ChatGPT 附件清单".to_string()))?;
    let materialization =
        serde_json::from_slice::<ChatGptAssetMaterialization>(&fs::read(&manifest_path)?)?;
    if materialization.asset_count != expected_asset_count {
        return Err(AppError::Conflict(format!(
            "落盘附件实体数不符合预期：实际 {}，预期 {}",
            materialization.asset_count, expected_asset_count
        )));
    }

    let mut restored_asset_bytes = 0_u64;
    for asset in &materialization.assets {
        let stored_path = Path::new(&asset.stored_file_path);
        let metadata = stored_path.metadata().map_err(|error| {
            AppError::Io(std::io::Error::new(
                error.kind(),
                format!("附件实体缺失：{}：{error}", stored_path.display()),
            ))
        })?;
        if metadata.len() != asset.size_bytes {
            return Err(AppError::Conflict(format!(
                "附件大小不一致：{}",
                stored_path.display()
            )));
        }
        let actual_sha256 = sha256_file(stored_path)?;
        if !actual_sha256.eq_ignore_ascii_case(&asset.sha256) {
            return Err(AppError::Conflict(format!(
                "附件哈希不一致：{}",
                stored_path.display()
            )));
        }
        restored_asset_bytes = restored_asset_bytes.saturating_add(metadata.len());
    }

    let attachment_prefix = format!("{}%", materialization.attachment_directory);
    let registered_attachment_rows = connection.query_row(
        "SELECT COUNT(*) FROM attachments WHERE stored_path LIKE ?1",
        params![attachment_prefix],
        |row| row.get::<_, i64>(0),
    )?;

    let receipt_path = paths
        .logs
        .join(format!("chatgpt-import-{import_job_id}.json"));
    let mut report = ChatGptImportMaintenanceReport {
        data_root: data_root.to_string_lossy().into_owned(),
        source_zip: source_zip.to_string_lossy().into_owned(),
        source_zip_sha256: inspection.source_zip_sha256,
        database_backup: database_backup.to_string_lossy().into_owned(),
        import_job_id,
        records_before,
        records_after,
        imported_records: result.imported_count,
        skipped_records: result.skipped_count,
        restored_asset_count: materialization.asset_count,
        registered_attachment_rows,
        restored_asset_bytes,
        attachment_manifest: manifest_path.to_string_lossy().into_owned(),
        database_integrity: integrity_after,
        receipt_path: receipt_path.to_string_lossy().into_owned(),
    };
    write_new_json(&receipt_path, &report)?;
    report.receipt_path = receipt_path.to_string_lossy().into_owned();
    Ok(report)
}

fn require_absolute_path(path: &Path, label: &str) -> AppResult<PathBuf> {
    if !path.is_absolute() {
        return Err(AppError::Validation(format!("{label}必须使用绝对路径")));
    }
    Ok(path.to_path_buf())
}

fn require_isolated_root(path: &Path, label: &str) -> AppResult<PathBuf> {
    let path = require_absolute_path(path, label)?;
    let normalized = path.to_string_lossy().replace('/', "\\");
    if normalized.eq_ignore_ascii_case(r"D:\南枫知识库")
        || normalized.eq_ignore_ascii_case(r"D:\南枫情报台")
    {
        return Err(AppError::Validation(format!("{label}拒绝使用正式数据目录")));
    }
    if !path
        .components()
        .any(|component| component.as_os_str() == ".runtime-qa")
    {
        return Err(AppError::Validation(format!(
            "{label}必须位于 .runtime-qa 下"
        )));
    }
    Ok(path)
}

fn require_isolated_marker(root: &Path) -> AppResult<()> {
    let marker = root.join(ISOLATED_MIGRATION_MARKER);
    if !marker.is_file() {
        return Err(AppError::Validation(format!(
            "缺少隔离迁移标记文件：{}",
            marker.display()
        )));
    }
    Ok(())
}

fn checkpoint_database(connection: &Connection) -> AppResult<()> {
    connection.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
    Ok(())
}

fn formal_current_taxonomy(
    connection: &Connection,
) -> AppResult<crate::ai::models::AiTaxonomyStructure> {
    let domains = {
        let mut statement = connection.prepare(
            "SELECT id, public_id, name, description
             FROM domains ORDER BY sort_order, id",
        )?;
        let collected = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        collected
    };
    let domain_keys = domains
        .iter()
        .map(|(id, public_id, _, _)| (*id, public_id.clone()))
        .collect::<std::collections::HashMap<_, _>>();
    let domain_proposals = domains
        .into_iter()
        .map(
            |(_, public_id, name, description)| crate::ai::models::AiTaxonomyDomainProposal {
                key: public_id,
                name,
                description,
            },
        )
        .collect::<Vec<_>>();
    let topic_rows = {
        let mut statement = connection.prepare(
            "SELECT id, public_id, domain_id, parent_topic_id, name, description
             FROM topics
             WHERE status NOT IN ('archived', 'merged')
             ORDER BY domain_id, depth, sort_order, id",
        )?;
        let collected = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, Option<i64>>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        collected
    };
    let topic_keys = topic_rows
        .iter()
        .map(|(id, public_id, _, _, _, _)| (*id, public_id.clone()))
        .collect::<std::collections::HashMap<_, _>>();
    let topics = topic_rows
        .into_iter()
        .map(
            |(_, public_id, domain_id, parent_topic_id, name, description)| {
                let domain_key = domain_keys
                    .get(&domain_id)
                    .cloned()
                    .ok_or_else(|| AppError::Conflict("正式主题引用了不存在的领域".to_string()))?;
                let parent_key = parent_topic_id
                    .map(|parent_id| {
                        topic_keys.get(&parent_id).cloned().ok_or_else(|| {
                            AppError::Conflict("正式主题引用了不可用的父主题".to_string())
                        })
                    })
                    .transpose()?;
                Ok(crate::ai::models::AiTaxonomyTopicProposal {
                    key: public_id,
                    domain_key,
                    parent_key,
                    name,
                    description,
                    integration_markdown: String::new(),
                    source_item_ids: Vec::new(),
                })
            },
        )
        .collect::<AppResult<Vec<_>>>()?;
    if domain_proposals.is_empty() || topics.is_empty() {
        return Err(AppError::Conflict(
            "正式领域或主题为空，未发送真实业务请求".to_string(),
        ));
    }
    Ok(crate::ai::models::AiTaxonomyStructure {
        domains: domain_proposals,
        topics,
    })
}

fn formal_acceptance_materials(
    connection: &Connection,
) -> AppResult<Vec<crate::ai::models::AiSourceMaterial>> {
    let mut statement = connection.prepare(
        "SELECT id, title, original_text, content_sha256
         FROM visible_source_items
         WHERE length(trim(original_text)) BETWEEN 800 AND 4000
         ORDER BY length(original_text), id
         LIMIT 2",
    )?;
    let materials = statement
        .query_map([], |row| {
            let original_text = row.get::<_, String>(2)?;
            Ok(crate::ai::models::AiSourceMaterial {
                source_item_id: row.get(0)?,
                title: row.get(1)?,
                content: crate::knowledge::readable_text::classification_text(&original_text),
                content_sha256: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    if materials.len() != 2 {
        return Err(AppError::Conflict(
            "正式库缺少两条800至4000字符的可见来源，未发送真实业务请求".to_string(),
        ));
    }
    Ok(materials)
}

fn profile_term_overlap_rate(
    left: &[crate::ai::models::AiSourceProfile],
    right: &[crate::ai::models::AiSourceProfile],
    select: fn(&crate::ai::models::AiSourceProfile) -> &[String],
) -> f64 {
    let right_by_id = right
        .iter()
        .map(|profile| (profile.source_item_id, profile))
        .collect::<std::collections::HashMap<_, _>>();
    let mut intersection_count = 0usize;
    let mut union_count = 0usize;
    for left_profile in left {
        let Some(right_profile) = right_by_id.get(&left_profile.source_item_id) else {
            continue;
        };
        let left_terms = select(left_profile)
            .iter()
            .map(|term| term.trim().to_lowercase())
            .filter(|term| !term.is_empty())
            .collect::<std::collections::HashSet<_>>();
        let right_terms = select(right_profile)
            .iter()
            .map(|term| term.trim().to_lowercase())
            .filter(|term| !term.is_empty())
            .collect::<std::collections::HashSet<_>>();
        intersection_count += left_terms.intersection(&right_terms).count();
        union_count += left_terms.union(&right_terms).count();
    }
    if union_count == 0 {
        1.0
    } else {
        intersection_count as f64 / union_count as f64
    }
}

fn sum_optional_i64(left: Option<i64>, right: Option<i64>) -> Option<i64> {
    left.zip(right).map(|(left, right)| left + right)
}

fn prompt_cache_column_count(connection: &Connection) -> AppResult<i64> {
    let expected = [
        "reasoning_tokens",
        "cached_tokens",
        "cache_miss_tokens",
        "cache_write_tokens",
        "cache_mode",
        "stable_prefix_hash",
        "cache_key_hash",
        "prompt_contract_version",
        "duration_ms",
        "cache_discount_usd",
        "cache_savings_usd",
        "cost_kind",
        "pricing_snapshot_json",
    ];
    let mut statement = connection.prepare("PRAGMA table_info(ai_task_model_steps)")?;
    let names = statement
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(names
        .iter()
        .filter(|name| expected.contains(&name.as_str()))
        .count() as i64)
}

fn execution_contract_column_count(connection: &Connection) -> AppResult<i64> {
    let mut count = 0_i64;
    for table in [
        "ai_task_runs",
        "ai_taxonomy_run_checkpoints",
        "ai_topic_insight_versions",
        "ai_taxonomy_revisions",
        "ai_source_profile_versions",
    ] {
        let sql = format!("PRAGMA table_info({table})");
        let mut statement = connection.prepare(&sql)?;
        let names = statement
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<Vec<_>, _>>()?;
        if names
            .iter()
            .any(|name| name == "execution_contract_version")
        {
            count += 1;
        }
    }
    Ok(count)
}

fn count_execution_contract_rows(connection: &Connection, version: &str) -> AppResult<i64> {
    let mut count = 0_i64;
    for table in [
        "ai_task_runs",
        "ai_taxonomy_run_checkpoints",
        "ai_topic_insight_versions",
        "ai_taxonomy_revisions",
        "ai_source_profile_versions",
    ] {
        let sql = format!("SELECT COUNT(*) FROM {table} WHERE execution_contract_version = ?1");
        count += connection.query_row(&sql, [version], |row| row.get::<_, i64>(0))?;
    }
    Ok(count)
}

fn source_profile_contract_in_primary_key(connection: &Connection) -> AppResult<bool> {
    let mut statement = connection.prepare("PRAGMA table_info(ai_source_profile_versions)")?;
    let mut columns = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, i64>(5)?))
        })?
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .filter(|(_, primary_key_position)| *primary_key_position > 0)
        .collect::<Vec<_>>();
    columns.sort_by_key(|(_, primary_key_position)| *primary_key_position);
    Ok(columns
        .iter()
        .any(|(name, _)| name == "execution_contract_version"))
}

fn restore_database_backup(database_path: &Path, backup_path: &Path) -> AppResult<()> {
    let source = Connection::open_with_flags(backup_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let mut target = Connection::open_with_flags(
        database_path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    target.busy_timeout(std::time::Duration::from_secs(5))?;
    database::copy_database(&source, &mut target)?;
    checkpoint_database(&target)?;
    if database::integrity_check(&target)? != "ok" {
        return Err(AppError::Conflict(
            "从Prompt Cache迁移备份恢复后完整性检查失败".to_string(),
        ));
    }
    Ok(())
}

fn schema_versions(connection: &Connection) -> AppResult<Vec<i64>> {
    let mut statement =
        connection.prepare("SELECT version FROM schema_migrations ORDER BY version")?;
    let versions = statement
        .query_map([], |row| row.get::<_, i64>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(versions)
}

fn portable_recovery_snapshot(
    connection: &Connection,
    paths: &AppPaths,
    preferences_json: &str,
    import_name: &str,
    attachment_name: &str,
) -> AppResult<PortableRecoveryQaSnapshot> {
    let preferences = serde_json::from_str::<serde_json::Value>(preferences_json)?;
    let normalized_preferences = serde_json::to_vec(&preferences)?;
    let integrity_check = database::integrity_check(connection)?;
    let foreign_key_violations =
        connection.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
            row.get::<_, i64>(0)
        })?;
    Ok(PortableRecoveryQaSnapshot {
        database_sha256: sha256_file(&paths.database)?,
        import_sha256: sha256_file(&paths.imports_raw.join(import_name))?,
        attachment_sha256: sha256_file(&paths.attachments.join(attachment_name))?,
        preferences_sha256: sha256_bytes(&normalized_preferences),
        schema_versions: schema_versions(connection)?,
        active_records: count_where(connection, "records", "is_deleted = 0")?,
        source_items: count_where(connection, "source_items", "1 = 1")?,
        inbox_sources: count_where(connection, "source_items", "organization_state = 'inbox'")?,
        attachment_rows: count_where(connection, "attachments", "1 = 1")?,
        integrity_check,
        foreign_key_violations,
    })
}

fn table_exists(connection: &Connection, name: &str) -> AppResult<bool> {
    Ok(connection.query_row(
        "SELECT EXISTS(
           SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1
         )",
        [name],
        |row| row.get::<_, i64>(0),
    )? != 0)
}

fn require_exact_formal_knowledge_root(path: &Path) -> AppResult<PathBuf> {
    let path = require_absolute_path(path, "正式数据目录")?;
    let expected = PathBuf::from(FORMAL_KNOWLEDGE_ROOT);
    let canonical_path = fs::canonicalize(&path)?;
    let canonical_expected = fs::canonicalize(&expected)?;
    if canonical_path != canonical_expected {
        return Err(AppError::Validation(format!(
            "正式迁移只允许精确目录 {}，实际收到 {}",
            expected.display(),
            path.display()
        )));
    }
    Ok(path)
}

fn formal_knowledge_snapshot(
    connection: &Connection,
    database_path: &Path,
) -> AppResult<FormalKnowledgeMigrationSnapshot> {
    let integrity_check = database::integrity_check(connection)?;
    let foreign_key_violations =
        connection.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
            row.get::<_, i64>(0)
        })?;
    Ok(FormalKnowledgeMigrationSnapshot {
        database_sha256: sha256_file(database_path)?,
        schema_versions: schema_versions(connection)?,
        active_records: count_where(connection, "records", "is_deleted = 0")?,
        deleted_records: count_where(connection, "records", "is_deleted = 1")?,
        source_items: count_if_table_exists(connection, "source_items", "1 = 1")?,
        linked_legacy_sources: count_if_table_exists(
            connection,
            "source_items",
            "legacy_record_id IS NOT NULL",
        )?,
        inbox_sources: count_if_table_exists(
            connection,
            "source_items",
            "organization_state = 'inbox'",
        )?,
        attachments: count_where(connection, "attachments", "1 = 1")?,
        integrity_check,
        foreign_key_violations,
    })
}

fn count_if_table_exists(
    connection: &Connection,
    table: &str,
    predicate: &str,
) -> AppResult<Option<i64>> {
    if !table_exists(connection, table)? {
        return Ok(None);
    }
    count_where(connection, table, predicate).map(Some)
}

fn formal_snapshots_logically_equal(
    left: &FormalKnowledgeMigrationSnapshot,
    right: &FormalKnowledgeMigrationSnapshot,
) -> bool {
    left.schema_versions == right.schema_versions
        && left.active_records == right.active_records
        && left.deleted_records == right.deleted_records
        && left.source_items == right.source_items
        && left.linked_legacy_sources == right.linked_legacy_sources
        && left.inbox_sources == right.inbox_sources
        && left.attachments == right.attachments
        && left.integrity_check == right.integrity_check
        && left.foreign_key_violations == right.foreign_key_violations
}

fn run_formal_migration_and_verify(
    paths: &AppPaths,
    before: &FormalKnowledgeMigrationSnapshot,
    automatic_backups_before: &[PathBuf],
) -> AppResult<(
    FormalKnowledgeMigrationSnapshot,
    FormalKnowledgeMigrationSnapshot,
    PathBuf,
)> {
    let first_connection = database::open_database(&paths.database)?;
    checkpoint_database(&first_connection)?;
    let after = formal_knowledge_snapshot(&first_connection, &paths.database)?;
    drop(first_connection);

    let automatic_backups_after_first =
        matching_files(&paths.backups, "知识结构迁移前自动备份_", ".db")?;
    let new_automatic_backups = automatic_backups_after_first
        .iter()
        .filter(|path| !automatic_backups_before.contains(path))
        .cloned()
        .collect::<Vec<_>>();
    if new_automatic_backups.len() != 1 {
        return Err(AppError::Conflict(format!(
            "正式 migration v3 应生成 1 份数据库自动备份，实际新增 {} 份",
            new_automatic_backups.len()
        )));
    }
    let automatic_database_backup = new_automatic_backups[0].clone();
    let automatic_backup_connection =
        Connection::open_with_flags(&automatic_database_backup, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let automatic_backup_snapshot =
        formal_knowledge_snapshot(&automatic_backup_connection, &automatic_database_backup)?;
    drop(automatic_backup_connection);
    if !formal_snapshots_logically_equal(before, &automatic_backup_snapshot) {
        return Err(AppError::Conflict(
            "migration v3 自动数据库备份与迁移前状态不一致".to_string(),
        ));
    }

    validate_formal_migration_result(before, &after)?;

    let reopened_connection = database::open_database(&paths.database)?;
    checkpoint_database(&reopened_connection)?;
    let reopened = formal_knowledge_snapshot(&reopened_connection, &paths.database)?;
    drop(reopened_connection);
    let automatic_backups_after_reopen =
        matching_files(&paths.backups, "知识结构迁移前自动备份_", ".db")?;
    if automatic_backups_after_reopen != automatic_backups_after_first {
        return Err(AppError::Conflict(
            "第二次打开数据库重复生成了 migration v3 自动备份".to_string(),
        ));
    }
    if after != reopened {
        return Err(AppError::Conflict(
            "第二次打开数据库后关键计数或数据库 SHA-256 发生变化，幂等检查失败".to_string(),
        ));
    }
    Ok((after, reopened, automatic_database_backup))
}

fn validate_formal_migration_result(
    before: &FormalKnowledgeMigrationSnapshot,
    after: &FormalKnowledgeMigrationSnapshot,
) -> AppResult<()> {
    let expected_source_items = before.active_records + before.deleted_records;
    if after.schema_versions != vec![1, 2, 3]
        || after.active_records != before.active_records
        || after.deleted_records != before.deleted_records
        || after.attachments != before.attachments
        || after.source_items != Some(expected_source_items)
        || after.linked_legacy_sources != Some(expected_source_items)
        || after.inbox_sources != Some(expected_source_items)
        || after.integrity_check != "ok"
        || after.foreign_key_violations != 0
    {
        return Err(AppError::Conflict(format!(
            "正式 migration v3 后验收不通过：migration {:?}，活动记录 {}，删除记录 {}，Source Item {:?}，legacy 关联 {:?}，收录箱 {:?}，附件 {}，完整性 {}，外键违规 {}",
            after.schema_versions,
            after.active_records,
            after.deleted_records,
            after.source_items,
            after.linked_legacy_sources,
            after.inbox_sources,
            after.attachments,
            after.integrity_check,
            after.foreign_key_violations
        )));
    }
    Ok(())
}

fn rollback_formal_database(
    paths: &AppPaths,
    portable_database: &Path,
    before: &FormalKnowledgeMigrationSnapshot,
) -> AppResult<()> {
    let source = Connection::open_with_flags(portable_database, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let mut target = Connection::open_with_flags(
        &paths.database,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    target.busy_timeout(std::time::Duration::from_secs(5))?;
    database::copy_database(&source, &mut target)?;
    checkpoint_database(&target)?;
    let restored = formal_knowledge_snapshot(&target, &paths.database)?;
    if !formal_snapshots_logically_equal(before, &restored)
        || restored.integrity_check != "ok"
        || restored.foreign_key_violations != 0
    {
        return Err(AppError::Conflict(
            "从完整备份恢复后，数据库逻辑状态与迁移前不一致".to_string(),
        ));
    }
    Ok(())
}

fn matching_files(directory: &Path, prefix: &str, suffix: &str) -> AppResult<Vec<PathBuf>> {
    let mut files = Vec::new();
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with(prefix) && name.ends_with(suffix) {
            files.push(entry.path());
        }
    }
    files.sort();
    Ok(files)
}

fn json_values_equal(left: &str, right: &str) -> AppResult<bool> {
    Ok(serde_json::from_str::<serde_json::Value>(left)?
        == serde_json::from_str::<serde_json::Value>(right)?)
}

fn newest_matching_directory(directory: &Path, prefix: &str) -> AppResult<Option<PathBuf>> {
    let mut newest: Option<(std::time::SystemTime, PathBuf)> = None;
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.starts_with(prefix) {
            continue;
        }
        let modified = entry.metadata()?.modified()?;
        if newest
            .as_ref()
            .is_none_or(|(current, _)| modified > *current)
        {
            newest = Some((modified, entry.path()));
        }
    }
    Ok(newest.map(|(_, path)| path))
}

fn active_record_count(connection: &Connection) -> AppResult<i64> {
    Ok(connection.query_row(
        "SELECT COUNT(*) FROM records WHERE is_deleted = 0",
        [],
        |row| row.get(0),
    )?)
}

fn count_where(connection: &Connection, table: &str, predicate: &str) -> AppResult<i64> {
    let sql = format!("SELECT COUNT(*) FROM {table} WHERE {predicate}");
    Ok(connection.query_row(&sql, [], |row| row.get(0))?)
}

fn newest_matching_file(
    directory: &Path,
    prefix: &str,
    suffix: &str,
) -> AppResult<Option<PathBuf>> {
    let mut newest: Option<(std::time::SystemTime, PathBuf)> = None;
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.starts_with(prefix) || !name.ends_with(suffix) {
            continue;
        }
        let modified = entry.metadata()?.modified()?;
        if newest
            .as_ref()
            .is_none_or(|(current, _)| modified > *current)
        {
            newest = Some((modified, entry.path()));
        }
    }
    Ok(newest.map(|(_, path)| path))
}

fn sha256_file(path: &Path) -> AppResult<String> {
    let mut reader = BufReader::new(File::open(path)?);
    let mut digest = Sha256::new();
    let mut buffer = vec![0_u8; 1024 * 1024];
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(hex::encode(digest.finalize()))
}

fn sha256_bytes(bytes: &[u8]) -> String {
    let mut digest = Sha256::new();
    digest.update(bytes);
    hex::encode(digest.finalize())
}

fn write_new_json(path: &Path, value: &impl Serialize) -> AppResult<()> {
    let mut file = OpenOptions::new().write(true).create_new(true).open(path)?;
    file.write_all(serde_json::to_string_pretty(value)?.as_bytes())?;
    file.sync_all()?;
    Ok(())
}
