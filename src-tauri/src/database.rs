use std::path::Path;
use std::time::Duration;

use chrono::{DateTime, TimeZone, Utc};
use rusqlite::backup::Backup;
use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection, OpenFlags, OptionalExtension, Transaction};

use crate::error::{AppError, AppResult};
use crate::knowledge;
use crate::models::{
    AppendVersionInput, CreateRecordInput, CreateTagInput, DeleteVersionInput, EvidenceItem,
    FavoriteUpdate, IntelligenceRecord, PatchRecordInput, PermanentDeleteInput, RecordMutation,
    RecordQuery, RecordSource, RecordSourceInput, RecordStatus, RecordSummary, RecordVersion,
    RenameTagInput, RestoreVersionInput, TagItem, UpdateRecordInput,
};

const INITIAL_MIGRATION: &str = include_str!("../migrations/0001_initial.sql");
const INITIAL_MIGRATION_VERSION: i64 = 1;
const ORIGINAL_AT_MIGRATION: &str = include_str!("../migrations/0002_original_at.sql");
const ORIGINAL_AT_MIGRATION_VERSION: i64 = 2;
const KNOWLEDGE_MIGRATION_VERSION: i64 = 3;
const KNOWLEDGE_REASONING_MIGRATION_VERSION: i64 = 4;
const BACKUP_PAGES_PER_STEP: i32 = 512;
const BACKUP_PAUSE: Duration = Duration::from_millis(1);

struct RecordRow {
    id: i64,
    title: String,
    summary: String,
    status: String,
    current_judgment: String,
    confirmed_facts_json: String,
    key_evidence_json: String,
    open_questions_json: String,
    next_actions_json: String,
    notes: String,
    source_text: String,
    is_favorite: bool,
    is_deleted: bool,
    original_at: Option<String>,
    created_at: String,
    updated_at: String,
    deleted_at: Option<String>,
}

pub fn open_database(path: &Path) -> AppResult<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut connection = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_CREATE
            | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    configure_connection(&connection)?;
    create_pre_knowledge_migration_backup(&connection, path)?;
    apply_migrations(&mut connection)?;
    Ok(connection)
}

pub(crate) fn copy_database(source: &Connection, target: &mut Connection) -> AppResult<()> {
    let backup = Backup::new(source, target)?;
    backup.run_to_completion(BACKUP_PAGES_PER_STEP, BACKUP_PAUSE, None)?;
    Ok(())
}

#[cfg(test)]
pub fn open_memory_database() -> AppResult<Connection> {
    let mut connection = Connection::open_in_memory()?;
    configure_connection(&connection)?;
    apply_migrations(&mut connection)?;
    Ok(connection)
}

fn configure_connection(connection: &Connection) -> AppResult<()> {
    connection.busy_timeout(Duration::from_secs(5))?;
    connection.execute_batch(
        "
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
    ",
    )?;
    Ok(())
}

pub(crate) fn apply_migrations(connection: &mut Connection) -> AppResult<()> {
    connection.execute_batch(
        "
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    ",
    )?;
    apply_migration(connection, INITIAL_MIGRATION_VERSION, INITIAL_MIGRATION)?;
    let original_at_added = apply_migration(
        connection,
        ORIGINAL_AT_MIGRATION_VERSION,
        ORIGINAL_AT_MIGRATION,
    )?;
    if original_at_added {
        backfill_original_dates(connection)?;
    }
    apply_migration(
        connection,
        KNOWLEDGE_MIGRATION_VERSION,
        knowledge::schema::KNOWLEDGE_SCHEMA_SQL,
    )?;
    apply_migration(
        connection,
        KNOWLEDGE_REASONING_MIGRATION_VERSION,
        knowledge::schema::KNOWLEDGE_REASONING_SCHEMA_SQL,
    )?;
    knowledge::repository::backfill_legacy_records(connection)?;
    Ok(())
}

fn create_pre_knowledge_migration_backup(connection: &Connection, path: &Path) -> AppResult<()> {
    let has_migration_table = connection.query_row(
        "SELECT EXISTS(
           SELECT 1 FROM sqlite_master
           WHERE type = 'table' AND name = 'schema_migrations'
         )",
        [],
        |row| row.get::<_, i64>(0),
    )? != 0;
    if !has_migration_table {
        return Ok(());
    }
    let already_applied = connection
        .query_row(
            "SELECT 1 FROM schema_migrations WHERE version = ?1",
            [KNOWLEDGE_REASONING_MIGRATION_VERSION],
            |_| Ok(()),
        )
        .optional()?
        .is_some();
    if already_applied {
        return Ok(());
    }
    let data_directory = path
        .parent()
        .ok_or_else(|| AppError::Validation("数据库路径缺少数据目录".to_string()))?;
    let root = data_directory
        .parent()
        .ok_or_else(|| AppError::Validation("数据库路径缺少知识库根目录".to_string()))?;
    let backup_directory = root.join("backups");
    std::fs::create_dir_all(&backup_directory)?;
    let destination = backup_directory.join(format!(
        "知识结构迁移前自动备份_{}.db",
        Utc::now().format("%Y%m%d-%H%M%S-%3f")
    ));
    let mut target = Connection::open(&destination)?;
    copy_database(connection, &mut target)?;
    let integrity: String = target.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if integrity != "ok" {
        let _ = std::fs::remove_file(&destination);
        return Err(AppError::Conflict(format!(
            "知识结构迁移前自动备份完整性检查失败：{integrity}"
        )));
    }
    Ok(())
}

fn apply_migration(connection: &mut Connection, version: i64, sql: &str) -> AppResult<bool> {
    let applied = connection
        .query_row(
            "SELECT 1 FROM schema_migrations WHERE version = ?1",
            [version],
            |_| Ok(()),
        )
        .optional()?
        .is_some();
    if applied {
        return Ok(false);
    }
    let transaction = connection.transaction()?;
    transaction.execute_batch(sql)?;
    transaction.execute(
        "INSERT INTO schema_migrations(version, applied_at) VALUES (?1, ?2)",
        params![version, now()],
    )?;
    transaction.commit()?;
    Ok(true)
}

fn backfill_original_dates(connection: &Connection) -> AppResult<()> {
    let rows = {
        let mut statement =
            connection.prepare("SELECT id, source_text FROM records WHERE original_at IS NULL")?;
        let collected = statement
            .query_map([], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        collected
    };
    for (record_id, source_text) in rows {
        if let Some(original_at) = derive_original_at(&source_text) {
            connection.execute(
                "UPDATE records SET original_at = ?1 WHERE id = ?2",
                params![original_at, record_id],
            )?;
        }
    }
    Ok(())
}

pub fn list_records(
    connection: &Connection,
    query: &RecordQuery,
) -> AppResult<Vec<IntelligenceRecord>> {
    let mut sql = String::from("SELECT r.id FROM records r WHERE 1 = 1");
    let mut values: Vec<Value> = Vec::new();

    if query.deleted_only {
        sql.push_str(" AND r.is_deleted = 1");
    } else if !query.include_deleted {
        sql.push_str(" AND r.is_deleted = 0");
    }
    if let Some(status) = &query.status {
        sql.push_str(" AND r.status = ?");
        values.push(Value::Text(status.as_str().to_string()));
    }
    if query.favorites_only {
        sql.push_str(" AND r.is_favorite = 1");
    }
    if let Some(tag) = normalized_optional(&query.tag) {
        sql.push_str(
            " AND EXISTS (
        SELECT 1 FROM record_tags rt
        JOIN tags t ON t.id = rt.tag_id
        WHERE rt.record_id = r.id AND t.name = ?
      )",
        );
        values.push(Value::Text(tag));
    }
    if let Some(source) = normalized_optional(&query.source) {
        sql.push_str(
            " AND EXISTS (
        SELECT 1 FROM sources s
        WHERE s.record_id = r.id AND (s.title LIKE ? OR s.source_type = ?)
      )",
        );
        values.push(Value::Text(format!("%{source}%")));
        values.push(Value::Text(source));
    }
    if let Some(date_from) = normalized_optional(&query.date_from) {
        sql.push_str(" AND COALESCE(r.original_at, r.updated_at) >= ?");
        values.push(Value::Text(date_from));
    }
    if let Some(date_to) = normalized_optional(&query.date_to) {
        sql.push_str(" AND COALESCE(r.original_at, r.updated_at) <= ?");
        values.push(Value::Text(date_to));
    }
    if let Some(search) = normalized_optional(&query.search) {
        if search.chars().count() >= 3 {
            sql.push_str(
                " AND r.id IN (
          SELECT rowid FROM records_fts WHERE records_fts MATCH ?
        )",
            );
            values.push(Value::Text(format!("\"{}\"", search.replace('"', "\"\""))));
        } else {
            let pattern = format!("%{search}%");
            sql.push_str(
                " AND (
          r.title LIKE ? OR r.summary LIKE ? OR r.current_judgment LIKE ?
          OR r.confirmed_facts_json LIKE ? OR r.key_evidence_json LIKE ?
          OR r.open_questions_json LIKE ? OR r.notes LIKE ? OR r.source_text LIKE ?
          OR EXISTS (
            SELECT 1 FROM record_tags rt
            JOIN tags t ON t.id = rt.tag_id
            WHERE rt.record_id = r.id AND t.name LIKE ?
          )
          OR EXISTS (
            SELECT 1 FROM sources s
            WHERE s.record_id = r.id AND s.title LIKE ?
          )
        )",
            );
            for _ in 0..10 {
                values.push(Value::Text(pattern.clone()));
            }
        }
    }

    sql.push_str(match query.sort.as_deref() {
        Some("oldest") => " ORDER BY COALESCE(r.original_at, r.updated_at) ASC, r.id ASC",
        Some("title") => " ORDER BY r.title COLLATE NOCASE ASC, r.id ASC",
        Some("created_desc") => " ORDER BY COALESCE(r.original_at, r.created_at) DESC, r.id DESC",
        _ => " ORDER BY r.updated_at DESC, r.id DESC",
    });

    let mut statement = connection.prepare(&sql)?;
    let ids = statement
        .query_map(params_from_iter(values), |row| row.get::<_, i64>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    ids.into_iter()
        .map(|id| load_record(connection, id))
        .collect()
}

pub fn list_record_summaries(
    connection: &Connection,
    query: &RecordQuery,
) -> AppResult<Vec<RecordSummary>> {
    let mut sql = String::from(
        "
        SELECT
          r.id,
          r.title,
          r.summary,
          r.status,
          r.is_favorite,
          r.is_deleted,
          r.original_at,
          r.created_at,
          r.updated_at,
          r.deleted_at,
          COALESCE((
            SELECT json_group_array(tag_rows.name)
            FROM (
              SELECT t.name
              FROM record_tags rt
              JOIN tags t ON t.id = rt.tag_id
              WHERE rt.record_id = r.id
              ORDER BY t.name
            ) AS tag_rows
          ), '[]') AS tags_json,
          COALESCE((
            SELECT s.title
            FROM sources s
            WHERE s.record_id = r.id
            ORDER BY s.id
            LIMIT 1
          ), '') AS source_title,
          (SELECT COUNT(*) FROM record_versions rv WHERE rv.record_id = r.id) AS version_count,
          CASE
            WHEN lower(trim(r.title)) IN (
              'conversation overview', '**conversation overview**', 'untitled',
              '未命名导入记录', '未命名记录'
            ) THEN r.source_text
            ELSE ''
          END AS title_source_text
        FROM records r
        WHERE 1 = 1",
    );
    let mut values: Vec<Value> = Vec::new();
    append_record_filters(&mut sql, &mut values, query);
    let search = normalized_optional(&query.search);
    if let Some(keyword) = &search {
        let pattern = format!("%{keyword}%");
        sql.push_str(
            " ORDER BY CASE
                WHEN r.title LIKE ? THEN 0
                WHEN r.current_judgment LIKE ? THEN 1
                WHEN r.summary LIKE ? THEN 2
                ELSE 3
              END,
              r.updated_at DESC,
              r.id DESC",
        );
        values.push(Value::Text(pattern.clone()));
        values.push(Value::Text(pattern.clone()));
        values.push(Value::Text(pattern));
    } else {
        append_record_sort(&mut sql, query);
    }

    let mut statement = connection.prepare(&sql)?;
    let rows = statement.query_map(params_from_iter(values), |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, i64>(4)? != 0,
            row.get::<_, i64>(5)? != 0,
            row.get::<_, Option<String>>(6)?,
            row.get::<_, String>(7)?,
            row.get::<_, String>(8)?,
            row.get::<_, Option<String>>(9)?,
            row.get::<_, String>(10)?,
            row.get::<_, String>(11)?,
            row.get::<_, i64>(12)?,
            row.get::<_, String>(13)?,
        ))
    })?;

    rows.map(|row| {
        let (
            id,
            title,
            summary,
            status,
            is_favorite,
            is_deleted,
            original_at,
            created_at,
            updated_at,
            deleted_at,
            tags_json,
            source_title,
            version_count,
            title_source_text,
        ) = row?;
        let status = RecordStatus::parse(&status)
            .ok_or_else(|| AppError::Unsupported(format!("数据库中存在未知记录状态：{status}")))?;
        let display_title = resolve_summary_title(&title, &title_source_text, &source_title);
        let search_snippet = match search.as_deref() {
            Some(keyword) => load_search_snippet(connection, id, keyword)?,
            None => summary.clone(),
        };
        Ok(RecordSummary {
            id,
            title,
            display_title,
            summary,
            status,
            tags: serde_json::from_str(&tags_json)?,
            source_title,
            search_snippet,
            is_favorite,
            is_deleted,
            original_at,
            created_at,
            updated_at,
            deleted_at,
            version_count,
        })
    })
    .collect()
}

pub fn get_record(connection: &Connection, record_id: i64) -> AppResult<IntelligenceRecord> {
    load_record(connection, record_id)
}

pub fn create_record(
    connection: &mut Connection,
    input: &CreateRecordInput,
) -> AppResult<IntelligenceRecord> {
    validate_title(&input.title)?;
    let timestamp = now();
    let transaction = connection.transaction()?;
    transaction.execute(
        "
    INSERT INTO records(
      title, summary, status, current_judgment, confirmed_facts_json,
      key_evidence_json, open_questions_json, next_actions_json, notes,
      source_text, is_favorite, is_deleted, original_at, created_at, updated_at
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, ?12, ?13, ?13
    )
    ",
        params![
            input.title.trim(),
            input.summary.trim(),
            input.status.as_str(),
            input.current_judgment,
            json(&input.confirmed_facts)?,
            json(&input.key_evidence)?,
            json(&input.open_questions)?,
            json(&input.next_actions)?,
            input.notes,
            input.source_text,
            input.is_favorite as i64,
            input
                .original_at
                .clone()
                .or_else(|| derive_original_at(&input.source_text)),
            timestamp,
        ],
    )?;
    let record_id = transaction.last_insert_rowid();
    replace_tags(&transaction, record_id, &input.tags)?;
    replace_sources(&transaction, record_id, &input.sources, &timestamp)?;
    let record = load_record(&transaction, record_id)?;
    insert_version(&transaction, &record, "初始版本", "创建记录", Some(1))?;
    transaction.commit()?;
    knowledge::repository::sync_legacy_record(connection, record_id)?;
    load_record(connection, record_id)
}

pub fn update_record(
    connection: &mut Connection,
    record_id: i64,
    input: &UpdateRecordInput,
) -> AppResult<IntelligenceRecord> {
    validate_title(&input.title)?;
    ensure_record_exists(connection, record_id)?;
    let timestamp = now();
    let transaction = connection.transaction()?;
    transaction.execute(
        "
    UPDATE records SET
      title = ?1,
      summary = ?2,
      status = ?3,
      current_judgment = ?4,
      confirmed_facts_json = ?5,
      key_evidence_json = ?6,
      open_questions_json = ?7,
      next_actions_json = ?8,
      notes = ?9,
      source_text = ?10,
      original_at = COALESCE(original_at, ?11),
      updated_at = ?12
    WHERE id = ?13
    ",
        params![
            input.title.trim(),
            input.summary.trim(),
            input.status.as_str(),
            input.current_judgment,
            json(&input.confirmed_facts)?,
            json(&input.key_evidence)?,
            json(&input.open_questions)?,
            json(&input.next_actions)?,
            input.notes,
            input.source_text,
            derive_original_at(&input.source_text),
            timestamp,
            record_id,
        ],
    )?;
    replace_tags(&transaction, record_id, &input.tags)?;
    replace_sources(&transaction, record_id, &input.sources, &timestamp)?;
    transaction.commit()?;
    load_record(connection, record_id)
}

pub fn patch_record(
    connection: &mut Connection,
    record_id: i64,
    input: &PatchRecordInput,
) -> AppResult<RecordMutation> {
    ensure_record_exists(connection, record_id)?;
    if let Some(title) = &input.title {
        validate_title(title)?;
    }
    let updated_at = now();
    let transaction = connection.transaction()?;
    if let Some(title) = &input.title {
        transaction.execute(
            "UPDATE records SET title = ?1 WHERE id = ?2",
            params![title.trim(), record_id],
        )?;
    }
    if let Some(summary) = &input.summary {
        transaction.execute(
            "UPDATE records SET summary = ?1 WHERE id = ?2",
            params![summary.trim(), record_id],
        )?;
    }
    if let Some(status) = &input.status {
        transaction.execute(
            "UPDATE records SET status = ?1 WHERE id = ?2",
            params![status.as_str(), record_id],
        )?;
    }
    if let Some(current_judgment) = &input.current_judgment {
        transaction.execute(
            "UPDATE records SET current_judgment = ?1 WHERE id = ?2",
            params![current_judgment, record_id],
        )?;
    }
    if let Some(confirmed_facts) = &input.confirmed_facts {
        transaction.execute(
            "UPDATE records SET confirmed_facts_json = ?1 WHERE id = ?2",
            params![json(confirmed_facts)?, record_id],
        )?;
    }
    if let Some(key_evidence) = &input.key_evidence {
        transaction.execute(
            "UPDATE records SET key_evidence_json = ?1 WHERE id = ?2",
            params![json(key_evidence)?, record_id],
        )?;
    }
    if let Some(open_questions) = &input.open_questions {
        transaction.execute(
            "UPDATE records SET open_questions_json = ?1 WHERE id = ?2",
            params![json(open_questions)?, record_id],
        )?;
    }
    if let Some(next_actions) = &input.next_actions {
        transaction.execute(
            "UPDATE records SET next_actions_json = ?1 WHERE id = ?2",
            params![json(next_actions)?, record_id],
        )?;
    }
    if let Some(notes) = &input.notes {
        transaction.execute(
            "UPDATE records SET notes = ?1 WHERE id = ?2",
            params![notes, record_id],
        )?;
    }
    if let Some(source_text) = &input.source_text {
        transaction.execute(
            "UPDATE records
             SET source_text = ?1, original_at = COALESCE(original_at, ?2)
             WHERE id = ?3",
            params![source_text, derive_original_at(source_text), record_id],
        )?;
    }
    if let Some(tags) = &input.tags {
        replace_tags(&transaction, record_id, tags)?;
    }
    if let Some(sources) = &input.sources {
        replace_sources(&transaction, record_id, sources, &updated_at)?;
    }
    transaction.execute(
        "UPDATE records SET updated_at = ?1 WHERE id = ?2",
        params![updated_at, record_id],
    )?;
    transaction.commit()?;
    Ok(RecordMutation {
        record_id,
        updated_at,
    })
}

pub fn set_favorite(
    connection: &Connection,
    record_id: i64,
    is_favorite: bool,
) -> AppResult<FavoriteUpdate> {
    let updated_at = now();
    let changed = connection.execute(
        "UPDATE records SET is_favorite = ?1, updated_at = ?2 WHERE id = ?3",
        params![is_favorite as i64, updated_at, record_id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound("记录不存在".to_string()));
    }
    Ok(FavoriteUpdate {
        record_id,
        is_favorite,
        updated_at,
    })
}

pub fn update_current_judgment(
    connection: &Connection,
    record_id: i64,
    current_judgment: &str,
) -> AppResult<RecordMutation> {
    let updated_at = now();
    let changed = connection.execute(
        "UPDATE records SET current_judgment = ?1, updated_at = ?2 WHERE id = ?3",
        params![current_judgment, updated_at, record_id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound("记录不存在".to_string()));
    }
    Ok(RecordMutation {
        record_id,
        updated_at,
    })
}

pub fn update_status(
    connection: &Connection,
    record_id: i64,
    status: &RecordStatus,
) -> AppResult<RecordMutation> {
    let updated_at = now();
    let changed = connection.execute(
        "UPDATE records SET status = ?1, updated_at = ?2 WHERE id = ?3",
        params![status.as_str(), updated_at, record_id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound("记录不存在".to_string()));
    }
    Ok(RecordMutation {
        record_id,
        updated_at,
    })
}

pub fn move_to_trash(connection: &Connection, record_id: i64) -> AppResult<IntelligenceRecord> {
    let timestamp = now();
    let changed = connection.execute(
        "
    UPDATE records
    SET is_deleted = 1, deleted_at = ?1, updated_at = ?1
    WHERE id = ?2 AND is_deleted = 0
    ",
        params![timestamp, record_id],
    )?;
    if changed == 0 {
        ensure_record_exists(connection, record_id)?;
    }
    load_record(connection, record_id)
}

pub fn restore_record(connection: &Connection, record_id: i64) -> AppResult<IntelligenceRecord> {
    let changed = connection.execute(
        "
    UPDATE records
    SET is_deleted = 0, deleted_at = NULL, updated_at = ?1
    WHERE id = ?2 AND is_deleted = 1
    ",
        params![now(), record_id],
    )?;
    if changed == 0 {
        ensure_record_exists(connection, record_id)?;
    }
    load_record(connection, record_id)
}

pub fn permanently_delete_record(
    connection: &mut Connection,
    input: &PermanentDeleteInput,
) -> AppResult<()> {
    let record = load_record(connection, input.record_id)?;
    if !record.is_deleted {
        return Err(AppError::Conflict(
            "记录必须先进入回收站，才能永久删除".to_string(),
        ));
    }
    let transaction = connection.transaction()?;
    transaction.execute("DELETE FROM records WHERE id = ?1", [input.record_id])?;
    transaction.commit()?;
    Ok(())
}

pub fn append_version(
    connection: &mut Connection,
    input: &AppendVersionInput,
) -> AppResult<RecordVersion> {
    let transaction = connection.transaction()?;
    let record = load_record(&transaction, input.record_id)?;
    let version = insert_version(
        &transaction,
        &record,
        input.version_title.trim(),
        input.change_note.trim(),
        None,
    )?;
    transaction.commit()?;
    Ok(version)
}

pub fn list_versions(connection: &Connection, record_id: i64) -> AppResult<Vec<RecordVersion>> {
    ensure_record_exists(connection, record_id)?;
    let mut statement = connection.prepare(
        "
    SELECT id, record_id, version_number, version_title, change_note,
           snapshot_json, created_at
    FROM record_versions
    WHERE record_id = ?1
    ORDER BY version_number DESC
    ",
    )?;
    let rows = statement.query_map([record_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, String>(6)?,
        ))
    })?;
    rows.map(|row| {
        let (id, record_id, version_number, version_title, change_note, snapshot_json, created_at) =
            row?;
        Ok(RecordVersion {
            id,
            record_id,
            version_number,
            version_title,
            change_note,
            snapshot: serde_json::from_str(&snapshot_json)?,
            created_at,
        })
    })
    .collect()
}

pub fn delete_version(connection: &Connection, input: &DeleteVersionInput) -> AppResult<()> {
    ensure_record_exists(connection, input.record_id)?;
    let version_count = connection.query_row(
        "SELECT COUNT(*) FROM record_versions WHERE record_id = ?1",
        [input.record_id],
        |row| row.get::<_, i64>(0),
    )?;
    if version_count <= 1 {
        return Err(AppError::Conflict(
            "至少保留一个历史版本，不能删除最后一个版本".to_string(),
        ));
    }
    let changed = connection.execute(
        "DELETE FROM record_versions WHERE id = ?1 AND record_id = ?2",
        params![input.version_id, input.record_id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound("历史版本不存在".to_string()));
    }
    Ok(())
}

pub fn restore_version(
    connection: &mut Connection,
    input: &RestoreVersionInput,
) -> AppResult<RecordVersion> {
    let version = get_version(connection, input.record_id, input.version_id)?;
    let transaction = connection.transaction()?;
    let timestamp = now();
    transaction.execute(
        "
    UPDATE records SET
      title = ?1,
      summary = ?2,
      status = ?3,
      current_judgment = ?4,
      confirmed_facts_json = ?5,
      key_evidence_json = ?6,
      open_questions_json = ?7,
      next_actions_json = ?8,
      notes = ?9,
      source_text = ?10,
      original_at = ?11,
      updated_at = ?12
    WHERE id = ?13
    ",
        params![
            version.snapshot.title,
            version.snapshot.summary,
            version.snapshot.status.as_str(),
            version.snapshot.current_judgment,
            json(&version.snapshot.confirmed_facts)?,
            json(&version.snapshot.key_evidence)?,
            json(&version.snapshot.open_questions)?,
            json(&version.snapshot.next_actions)?,
            version.snapshot.notes,
            version.snapshot.source_text,
            version.snapshot.original_at,
            timestamp,
            input.record_id,
        ],
    )?;
    replace_tags(&transaction, input.record_id, &version.snapshot.tags)?;
    let source_inputs = version
        .snapshot
        .sources
        .iter()
        .map(source_to_input)
        .collect::<Vec<_>>();
    replace_sources(&transaction, input.record_id, &source_inputs, &timestamp)?;
    let restored = load_record(&transaction, input.record_id)?;
    let new_version = insert_version(
        &transaction,
        &restored,
        &format!("恢复自 v{}", version.version_number),
        "恢复旧版本并生成新版本，未覆盖历史",
        None,
    )?;
    transaction.commit()?;
    Ok(new_version)
}

pub fn list_tags(connection: &Connection) -> AppResult<Vec<TagItem>> {
    let mut statement = connection.prepare(
        "
    SELECT t.id, t.name, t.color_key, t.created_at,
           COUNT(CASE WHEN r.is_deleted = 0 THEN 1 END) AS record_count
    FROM tags t
    LEFT JOIN record_tags rt ON rt.tag_id = t.id
    LEFT JOIN records r ON r.id = rt.record_id
    GROUP BY t.id
    ORDER BY record_count DESC, t.name ASC
    ",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(TagItem {
            id: row.get(0)?,
            name: row.get(1)?,
            color_key: row.get(2)?,
            created_at: row.get(3)?,
            record_count: row.get(4)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn create_tag(connection: &Connection, input: &CreateTagInput) -> AppResult<TagItem> {
    let name = normalize_required(&input.name, "标签名称不能为空")?;
    let timestamp = now();
    connection
        .execute(
            "INSERT INTO tags(name, color_key, created_at) VALUES (?1, ?2, ?3)",
            params![name, input.color_key, timestamp],
        )
        .map_err(map_unique_tag_error)?;
    let id = connection.last_insert_rowid();
    get_tag(connection, id)
}

pub fn rename_tag(connection: &Connection, input: &RenameTagInput) -> AppResult<TagItem> {
    let name = normalize_required(&input.name, "标签名称不能为空")?;
    let changed = connection
        .execute(
            "UPDATE tags SET name = ?1 WHERE id = ?2",
            params![name, input.tag_id],
        )
        .map_err(map_unique_tag_error)?;
    if changed == 0 {
        return Err(AppError::NotFound("标签不存在".to_string()));
    }
    get_tag(connection, input.tag_id)
}

pub fn delete_tag(connection: &Connection, tag_id: i64) -> AppResult<()> {
    let changed = connection.execute("DELETE FROM tags WHERE id = ?1", [tag_id])?;
    if changed == 0 {
        return Err(AppError::NotFound("标签不存在".to_string()));
    }
    Ok(())
}

pub fn rebuild_search_index(connection: &Connection) -> AppResult<()> {
    connection.execute(
        "INSERT INTO records_fts(records_fts) VALUES ('rebuild')",
        [],
    )?;
    Ok(())
}

pub fn integrity_check(connection: &Connection) -> AppResult<String> {
    Ok(connection.query_row("PRAGMA integrity_check", [], |row| row.get(0))?)
}

fn load_record(connection: &Connection, record_id: i64) -> AppResult<IntelligenceRecord> {
    let row = connection
        .query_row(
            "
      SELECT id, title, summary, status, current_judgment,
             confirmed_facts_json, key_evidence_json, open_questions_json,
             next_actions_json, notes, source_text, is_favorite, is_deleted,
             original_at, created_at, updated_at, deleted_at
      FROM records
      WHERE id = ?1
      ",
            [record_id],
            |row| {
                Ok(RecordRow {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    summary: row.get(2)?,
                    status: row.get(3)?,
                    current_judgment: row.get(4)?,
                    confirmed_facts_json: row.get(5)?,
                    key_evidence_json: row.get(6)?,
                    open_questions_json: row.get(7)?,
                    next_actions_json: row.get(8)?,
                    notes: row.get(9)?,
                    source_text: row.get(10)?,
                    is_favorite: row.get::<_, i64>(11)? != 0,
                    is_deleted: row.get::<_, i64>(12)? != 0,
                    original_at: row.get(13)?,
                    created_at: row.get(14)?,
                    updated_at: row.get(15)?,
                    deleted_at: row.get(16)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound("记录不存在".to_string()))?;

    let status = RecordStatus::parse(&row.status).ok_or_else(|| {
        AppError::Unsupported(format!("数据库中存在未知记录状态：{}", row.status))
    })?;
    let tags = load_tags_for_record(connection, record_id)?;
    let sources = load_sources_for_record(connection, record_id)?;
    let version_count = connection.query_row(
        "SELECT COUNT(*) FROM record_versions WHERE record_id = ?1",
        [record_id],
        |version_row| version_row.get(0),
    )?;

    Ok(IntelligenceRecord {
        id: row.id,
        title: row.title,
        summary: row.summary,
        status,
        tags,
        current_judgment: row.current_judgment,
        confirmed_facts: serde_json::from_str(&row.confirmed_facts_json)?,
        key_evidence: serde_json::from_str::<Vec<EvidenceItem>>(&row.key_evidence_json)?,
        open_questions: serde_json::from_str(&row.open_questions_json)?,
        next_actions: serde_json::from_str(&row.next_actions_json)?,
        notes: row.notes,
        source_text: row.source_text,
        sources,
        is_favorite: row.is_favorite,
        is_deleted: row.is_deleted,
        original_at: row.original_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
        version_count,
    })
}

fn load_tags_for_record(connection: &Connection, record_id: i64) -> AppResult<Vec<String>> {
    let mut statement = connection.prepare(
        "
    SELECT t.name
    FROM tags t
    JOIN record_tags rt ON rt.tag_id = t.id
    WHERE rt.record_id = ?1
    ORDER BY t.name ASC
    ",
    )?;
    let tags = statement
        .query_map([record_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tags)
}

fn load_sources_for_record(
    connection: &Connection,
    record_id: i64,
) -> AppResult<Vec<RecordSource>> {
    let mut statement = connection.prepare(
        "
    SELECT id, record_id, source_type, title, url, local_path, external_id, created_at
    FROM sources
    WHERE record_id = ?1
    ORDER BY id ASC
    ",
    )?;
    let rows = statement.query_map([record_id], |row| {
        Ok(RecordSource {
            id: row.get(0)?,
            record_id: row.get(1)?,
            source_type: row.get(2)?,
            title: row.get(3)?,
            url: row.get(4)?,
            local_path: row.get(5)?,
            external_id: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn replace_tags(transaction: &Transaction<'_>, record_id: i64, tags: &[String]) -> AppResult<()> {
    transaction.execute("DELETE FROM record_tags WHERE record_id = ?1", [record_id])?;
    for tag in normalize_tags(tags) {
        transaction.execute(
            "
      INSERT INTO tags(name, color_key, created_at)
      VALUES (?1, 'blue', ?2)
      ON CONFLICT(name) DO NOTHING
      ",
            params![tag, now()],
        )?;
        let tag_id: i64 =
            transaction.query_row("SELECT id FROM tags WHERE name = ?1", [&tag], |row| {
                row.get(0)
            })?;
        transaction.execute(
            "INSERT OR IGNORE INTO record_tags(record_id, tag_id) VALUES (?1, ?2)",
            params![record_id, tag_id],
        )?;
    }
    Ok(())
}

fn replace_sources(
    transaction: &Transaction<'_>,
    record_id: i64,
    sources: &[RecordSourceInput],
    timestamp: &str,
) -> AppResult<()> {
    transaction.execute("DELETE FROM sources WHERE record_id = ?1", [record_id])?;
    for source in sources {
        transaction.execute(
            "
      INSERT INTO sources(
        record_id, source_type, title, url, local_path, external_id, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      ",
            params![
                record_id,
                normalize_source_type(&source.source_type),
                source.title.trim(),
                normalized_optional(&source.url),
                normalized_optional(&source.local_path),
                normalized_optional(&source.external_id),
                timestamp,
            ],
        )?;
    }
    Ok(())
}

fn insert_version(
    transaction: &Transaction<'_>,
    record: &IntelligenceRecord,
    version_title: &str,
    change_note: &str,
    explicit_number: Option<i64>,
) -> AppResult<RecordVersion> {
    let version_number = match explicit_number {
        Some(number) => number,
        None => transaction.query_row(
            "
      SELECT COALESCE(MAX(version_number), 0) + 1
      FROM record_versions
      WHERE record_id = ?1
      ",
            [record.id],
            |row| row.get(0),
        )?,
    };
    let created_at = now();
    let title = if version_title.trim().is_empty() {
        format!("版本 v{version_number}")
    } else {
        version_title.trim().to_string()
    };
    let snapshot_json = json(record)?;
    transaction.execute(
        "
    INSERT INTO record_versions(
      record_id, version_number, version_title, change_note, snapshot_json, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    ",
        params![
            record.id,
            version_number,
            title,
            change_note,
            snapshot_json,
            created_at,
        ],
    )?;
    Ok(RecordVersion {
        id: transaction.last_insert_rowid(),
        record_id: record.id,
        version_number,
        version_title: title,
        change_note: change_note.to_string(),
        snapshot: record.clone(),
        created_at,
    })
}

fn get_version(
    connection: &Connection,
    record_id: i64,
    version_id: i64,
) -> AppResult<RecordVersion> {
    connection
        .query_row(
            "
      SELECT id, record_id, version_number, version_title, change_note,
             snapshot_json, created_at
      FROM record_versions
      WHERE id = ?1 AND record_id = ?2
      ",
            params![version_id, record_id],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                ))
            },
        )
        .optional()?
        .map(
            |(
                id,
                record_id,
                version_number,
                version_title,
                change_note,
                snapshot_json,
                created_at,
            )| {
                Ok::<RecordVersion, AppError>(RecordVersion {
                    id,
                    record_id,
                    version_number,
                    version_title,
                    change_note,
                    snapshot: serde_json::from_str(&snapshot_json)?,
                    created_at,
                })
            },
        )
        .transpose()?
        .ok_or_else(|| AppError::NotFound("历史版本不存在".to_string()))
}

fn get_tag(connection: &Connection, tag_id: i64) -> AppResult<TagItem> {
    connection
        .query_row(
            "
      SELECT t.id, t.name, t.color_key, t.created_at,
             COUNT(CASE WHEN r.is_deleted = 0 THEN 1 END)
      FROM tags t
      LEFT JOIN record_tags rt ON rt.tag_id = t.id
      LEFT JOIN records r ON r.id = rt.record_id
      WHERE t.id = ?1
      GROUP BY t.id
      ",
            [tag_id],
            |row| {
                Ok(TagItem {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color_key: row.get(2)?,
                    created_at: row.get(3)?,
                    record_count: row.get(4)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound("标签不存在".to_string()))
}

fn ensure_record_exists(connection: &Connection, record_id: i64) -> AppResult<()> {
    let exists = connection
        .query_row("SELECT 1 FROM records WHERE id = ?1", [record_id], |_| {
            Ok(())
        })
        .optional()?
        .is_some();
    if exists {
        Ok(())
    } else {
        Err(AppError::NotFound("记录不存在".to_string()))
    }
}

fn validate_title(title: &str) -> AppResult<()> {
    normalize_required(title, "记录标题不能为空").map(|_| ())
}

fn normalize_required(value: &str, message: &str) -> AppResult<String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        Err(AppError::Validation(message.to_string()))
    } else {
        Ok(normalized.to_string())
    }
}

fn normalized_optional(value: &Option<String>) -> Option<String> {
    value
        .as_ref()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .map(ToOwned::to_owned)
}

fn append_record_filters(sql: &mut String, values: &mut Vec<Value>, query: &RecordQuery) {
    if query.deleted_only {
        sql.push_str(" AND r.is_deleted = 1");
    } else if !query.include_deleted {
        sql.push_str(" AND r.is_deleted = 0");
    }
    if let Some(status) = &query.status {
        sql.push_str(" AND r.status = ?");
        values.push(Value::Text(status.as_str().to_string()));
    }
    if query.favorites_only {
        sql.push_str(" AND r.is_favorite = 1");
    }
    if let Some(tag) = normalized_optional(&query.tag) {
        sql.push_str(
            " AND EXISTS (
              SELECT 1 FROM record_tags rt
              JOIN tags t ON t.id = rt.tag_id
              WHERE rt.record_id = r.id AND t.name = ?
            )",
        );
        values.push(Value::Text(tag));
    }
    if let Some(source) = normalized_optional(&query.source) {
        sql.push_str(
            " AND EXISTS (
              SELECT 1 FROM sources s
              WHERE s.record_id = r.id AND (s.title LIKE ? OR s.source_type = ?)
            )",
        );
        values.push(Value::Text(format!("%{source}%")));
        values.push(Value::Text(source));
    }
    if let Some(date_from) = normalized_optional(&query.date_from) {
        sql.push_str(" AND COALESCE(r.original_at, r.updated_at) >= ?");
        values.push(Value::Text(date_from));
    }
    if let Some(date_to) = normalized_optional(&query.date_to) {
        sql.push_str(" AND COALESCE(r.original_at, r.updated_at) <= ?");
        values.push(Value::Text(date_to));
    }
    if let Some(search) = normalized_optional(&query.search) {
        if search.chars().count() >= 3 {
            sql.push_str(
                " AND r.id IN (
                  SELECT rowid FROM records_fts WHERE records_fts MATCH ?
                )",
            );
            values.push(Value::Text(format!("\"{}\"", search.replace('"', "\"\""))));
        } else {
            let pattern = format!("%{search}%");
            sql.push_str(
                " AND (
                  r.title LIKE ? OR r.summary LIKE ? OR r.current_judgment LIKE ?
                  OR r.confirmed_facts_json LIKE ? OR r.key_evidence_json LIKE ?
                  OR r.open_questions_json LIKE ? OR r.notes LIKE ? OR r.source_text LIKE ?
                  OR EXISTS (
                    SELECT 1 FROM record_tags rt
                    JOIN tags t ON t.id = rt.tag_id
                    WHERE rt.record_id = r.id AND t.name LIKE ?
                  )
                  OR EXISTS (
                    SELECT 1 FROM sources s
                    WHERE s.record_id = r.id AND s.title LIKE ?
                  )
                )",
            );
            for _ in 0..10 {
                values.push(Value::Text(pattern.clone()));
            }
        }
    }
}

fn append_record_sort(sql: &mut String, query: &RecordQuery) {
    sql.push_str(match query.sort.as_deref() {
        Some("oldest") => " ORDER BY COALESCE(r.original_at, r.updated_at) ASC, r.id ASC",
        Some("title") => " ORDER BY r.title COLLATE NOCASE ASC, r.id ASC",
        Some("created_desc") => " ORDER BY COALESCE(r.original_at, r.created_at) DESC, r.id DESC",
        _ => " ORDER BY r.updated_at DESC, r.id DESC",
    });
}

pub fn derive_original_at(source_text: &str) -> Option<String> {
    let value = serde_json::from_str::<serde_json::Value>(source_text).ok()?;
    let object = value.as_object()?;
    const DATE_KEYS: [&str; 18] = [
        "update_time",
        "updated_at",
        "updatedAt",
        "updateTime",
        "create_time",
        "created_at",
        "createdAt",
        "createTime",
        "conversation_start_time",
        "conversationStartTime",
        "timestamp",
        "time",
        "date",
        "published_at",
        "publishedAt",
        "publish_time",
        "start_time",
        "startTime",
    ];
    DATE_KEYS
        .iter()
        .find_map(|key| object.get(*key).and_then(normalize_original_date))
}

fn normalize_original_date(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::Number(number) => {
            let raw = number.as_f64()?;
            let milliseconds = raw.abs() >= 100_000_000_000.0;
            let seconds = if milliseconds { raw / 1000.0 } else { raw };
            let whole = seconds.trunc() as i64;
            let nanos = ((seconds.fract().abs()) * 1_000_000_000.0) as u32;
            Utc.timestamp_opt(whole, nanos)
                .single()
                .map(|date| date.to_rfc3339())
        }
        serde_json::Value::String(text) => normalize_original_date_string(text),
        _ => None,
    }
}

fn normalize_original_date_string(text: &str) -> Option<String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(number) = trimmed.parse::<f64>() {
        return normalize_original_date(&serde_json::json!(number));
    }
    if let Ok(parsed) = DateTime::parse_from_rfc3339(trimmed) {
        return Some(parsed.to_rfc3339());
    }
    for format in [
        "%Y-%m-%d %H:%M:%S%.f",
        "%Y/%m/%d %H:%M:%S%.f",
        "%Y-%m-%dT%H:%M:%S%.f",
    ] {
        if let Ok(parsed) = chrono::NaiveDateTime::parse_from_str(trimmed, format) {
            return Some(Utc.from_utc_datetime(&parsed).to_rfc3339());
        }
    }
    for format in ["%Y-%m-%d", "%Y/%m/%d"] {
        if let Ok(parsed) = chrono::NaiveDate::parse_from_str(trimmed, format) {
            return parsed
                .and_hms_opt(0, 0, 0)
                .map(|value| Utc.from_utc_datetime(&value).to_rfc3339());
        }
    }
    None
}

pub(crate) fn is_generic_record_title(title: &str) -> bool {
    let normalized = title.trim().trim_matches('*').trim();
    crate::importer::is_generic_title(title)
        || matches!(normalized, "未命名导入记录" | "未命名记录")
        || normalized.chars().all(|character| character == '-')
        || (normalized.contains('<') && normalized.contains('>'))
}

pub(crate) fn resolve_summary_title(title: &str, source_text: &str, source_title: &str) -> String {
    if !is_generic_record_title(title) || source_text.is_empty() {
        return title.to_string();
    }
    serde_json::from_str::<serde_json::Value>(source_text)
        .ok()
        .and_then(|value| {
            let object = value.as_object()?;
            crate::importer::title_from_chat_messages(object)
                .or_else(|| crate::importer::title_from_chatgpt_mapping(object))
        })
        .or_else(|| first_user_text(source_text))
        .map(|value| {
            let compact = value.split_whitespace().collect::<Vec<_>>().join(" ");
            compact.chars().take(48).collect::<String>()
        })
        .filter(|value| !value.is_empty())
        .or_else(|| crate::importer::readable_markdown_title(source_text, Some(source_title)))
        .filter(|value| !is_generic_record_title(value))
        .unwrap_or_else(|| title.to_string())
}

fn first_user_text(source_text: &str) -> Option<String> {
    let value = serde_json::from_str::<serde_json::Value>(source_text).ok()?;
    fn visit(value: &serde_json::Value) -> Option<String> {
        match value {
            serde_json::Value::Array(items) => items.iter().find_map(visit),
            serde_json::Value::Object(map) => {
                let role = map
                    .get("role")
                    .or_else(|| map.get("sender"))
                    .or_else(|| map.get("author").and_then(|author| author.get("role")))
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default();
                if matches!(role.to_ascii_lowercase().as_str(), "user" | "human") {
                    for key in ["content", "text", "message"] {
                        if let Some(value) = map.get(key) {
                            if let Some(text) = visible_text(value) {
                                if !text.trim().is_empty() {
                                    return Some(text);
                                }
                            }
                        }
                    }
                }
                for key in [
                    "messages",
                    "chat_messages",
                    "conversation",
                    "mapping",
                    "items",
                ] {
                    if let Some(found) = map.get(key).and_then(visit) {
                        return Some(found);
                    }
                }
                map.values().find_map(visit)
            }
            _ => None,
        }
    }
    fn visible_text(value: &serde_json::Value) -> Option<String> {
        match value {
            serde_json::Value::String(text) => Some(text.clone()),
            serde_json::Value::Array(items) => {
                let joined = items
                    .iter()
                    .filter_map(visible_text)
                    .collect::<Vec<_>>()
                    .join("\n");
                (!joined.is_empty()).then_some(joined)
            }
            serde_json::Value::Object(map) => {
                let block_type = map
                    .get("type")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or("text");
                if matches!(block_type, "thinking" | "tool_use" | "tool_result") {
                    return None;
                }
                map.get("text")
                    .or_else(|| map.get("content"))
                    .and_then(visible_text)
            }
            _ => None,
        }
    }
    visit(&value)
}

fn load_search_snippet(
    connection: &Connection,
    record_id: i64,
    keyword: &str,
) -> AppResult<String> {
    let snippet = connection.query_row(
        "
        SELECT CASE
          WHEN instr(lower(title), lower(?2)) > 0 THEN title
          WHEN instr(lower(current_judgment), lower(?2)) > 0 THEN
            substr(current_judgment, max(1, instr(lower(current_judgment), lower(?2)) - 60), 220)
          WHEN instr(lower(summary), lower(?2)) > 0 THEN
            substr(summary, max(1, instr(lower(summary), lower(?2)) - 60), 220)
          WHEN instr(lower(confirmed_facts_json), lower(?2)) > 0 THEN
            substr(confirmed_facts_json, max(1, instr(lower(confirmed_facts_json), lower(?2)) - 60), 220)
          WHEN instr(lower(key_evidence_json), lower(?2)) > 0 THEN
            substr(key_evidence_json, max(1, instr(lower(key_evidence_json), lower(?2)) - 60), 220)
          WHEN instr(lower(open_questions_json), lower(?2)) > 0 THEN
            substr(open_questions_json, max(1, instr(lower(open_questions_json), lower(?2)) - 60), 220)
          WHEN instr(lower(notes), lower(?2)) > 0 THEN
            substr(notes, max(1, instr(lower(notes), lower(?2)) - 60), 220)
          WHEN instr(lower(source_text), lower(?2)) > 0 THEN
            substr(source_text, max(1, instr(lower(source_text), lower(?2)) - 60), 220)
          ELSE summary
        END
        FROM records
        WHERE id = ?1
        ",
        params![record_id, keyword],
        |row| row.get::<_, String>(0),
    )?;
    Ok(if snippet.chars().count() > 220 {
        format!("{}…", snippet.chars().take(220).collect::<String>())
    } else {
        snippet
    })
}

fn normalize_tags(tags: &[String]) -> Vec<String> {
    let mut normalized = tags
        .iter()
        .map(|tag| tag.trim())
        .filter(|tag| !tag.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    normalized.sort();
    normalized.dedup();
    normalized
}

fn normalize_source_type(value: &str) -> String {
    let normalized = value.trim();
    if normalized.is_empty() {
        "manual".to_string()
    } else {
        normalized.to_string()
    }
}

fn source_to_input(source: &RecordSource) -> RecordSourceInput {
    RecordSourceInput {
        source_type: source.source_type.clone(),
        title: source.title.clone(),
        url: source.url.clone(),
        local_path: source.local_path.clone(),
        external_id: source.external_id.clone(),
    }
}

fn json<T: serde::Serialize + ?Sized>(value: &T) -> AppResult<String> {
    Ok(serde_json::to_string(value)?)
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn map_unique_tag_error(error: rusqlite::Error) -> AppError {
    if matches!(
      error,
      rusqlite::Error::SqliteFailure(ref details, _)
        if details.code == rusqlite::ErrorCode::ConstraintViolation
    ) {
        AppError::Conflict("标签名称已存在".to_string())
    } else {
        AppError::Database(error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_input(title: &str) -> CreateRecordInput {
        CreateRecordInput {
            title: title.to_string(),
            original_at: None,
            summary: "AI 基础设施投入短期压制自由现金流".to_string(),
            status: RecordStatus::Tracking,
            tags: vec!["资本开支".to_string(), "云计算".to_string()],
            current_judgment: "短期承压，长期取决于商业化效率。".to_string(),
            confirmed_facts: vec!["资本开支持续增加".to_string()],
            key_evidence: vec![EvidenceItem {
                content: "资本开支增速高于收入增速".to_string(),
                source: "财报".to_string(),
            }],
            open_questions: vec!["新增算力何时转化为收入？".to_string()],
            next_actions: vec!["跟踪下一季度指引".to_string()],
            notes: String::new(),
            source_text: "谷歌、微软和亚马逊均提高资本开支。".to_string(),
            sources: vec![RecordSourceInput {
                source_type: "chatgpt".to_string(),
                title: "AI 资本开支研究".to_string(),
                url: None,
                local_path: None,
                external_id: Some("chat-001".to_string()),
            }],
            is_favorite: false,
        }
    }

    #[test]
    fn migrations_are_repeatable_and_fts5_is_available() {
        let mut connection = open_memory_database().expect("open database");
        apply_migrations(&mut connection).expect("repeat migrations");
        let table_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE name = 'records_fts'",
                [],
                |row| row.get(0),
            )
            .expect("read fts table");
        assert_eq!(table_count, 1);
    }

    #[test]
    fn reasoning_migration_creates_one_verified_pre_migration_backup_and_is_idempotent() {
        let directory = tempfile::tempdir().expect("temp dir");
        let data_directory = directory.path().join("data");
        std::fs::create_dir_all(&data_directory).expect("data directory");
        let path = data_directory.join("app.db");
        {
            let mut connection = Connection::open(&path).expect("v3 database");
            configure_connection(&connection).expect("configure");
            connection
                .execute_batch(
                    "CREATE TABLE schema_migrations (
                       version INTEGER PRIMARY KEY,
                       applied_at TEXT NOT NULL
                     );",
                )
                .expect("migration table");
            apply_migration(
                &mut connection,
                INITIAL_MIGRATION_VERSION,
                INITIAL_MIGRATION,
            )
            .expect("migration 1");
            apply_migration(
                &mut connection,
                ORIGINAL_AT_MIGRATION_VERSION,
                ORIGINAL_AT_MIGRATION,
            )
            .expect("migration 2");
            apply_migration(
                &mut connection,
                KNOWLEDGE_MIGRATION_VERSION,
                knowledge::schema::KNOWLEDGE_SCHEMA_SQL,
            )
            .expect("migration 3");
            connection
                .execute_batch(
                    "INSERT INTO domains(
                       public_id, name, normalized_name, created_at, updated_at
                     ) VALUES ('domain-v3', '迁移验证', '迁移验证', '2026-07-28', '2026-07-28');
                     INSERT INTO topics(
                       public_id, domain_id, name, normalized_name, created_at, updated_at
                     ) VALUES (
                       'topic-v3', last_insert_rowid(), '推理结构', '推理结构',
                       '2026-07-28', '2026-07-28'
                     );
                     INSERT INTO propositions(
                       public_id, topic_id, statement_markdown, created_at, updated_at
                     ) VALUES (
                       'proposition-v3', last_insert_rowid(), '迁移前命题',
                       '2026-07-28', '2026-07-28'
                     );",
                )
                .expect("v3 knowledge rows");
        }

        let connection = open_database(&path).expect("apply reasoning migration");
        let proposition_kind: String = connection
            .query_row(
                "SELECT proposition_kind FROM propositions WHERE public_id = 'proposition-v3'",
                [],
                |row| row.get(0),
            )
            .expect("migrated proposition");
        assert_eq!(proposition_kind, "claim");
        assert_eq!(integrity_check(&connection).expect("integrity"), "ok");
        drop(connection);

        let backup_directory = directory.path().join("backups");
        let backups = std::fs::read_dir(&backup_directory)
            .expect("backup directory")
            .collect::<Result<Vec<_>, _>>()
            .expect("backup entries");
        assert_eq!(backups.len(), 1);
        let backup = Connection::open(backups[0].path()).expect("backup database");
        assert_eq!(
            backup
                .query_row("PRAGMA integrity_check", [], |row| row.get::<_, String>(0))
                .expect("backup integrity"),
            "ok"
        );
        assert_eq!(
            backup
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('propositions')
                     WHERE name = 'proposition_kind'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("pre-migration shape"),
            0
        );
        drop(backup);

        drop(open_database(&path).expect("idempotent reopen"));
        assert_eq!(
            std::fs::read_dir(&backup_directory)
                .expect("backup directory after reopen")
                .count(),
            1
        );
    }

    #[test]
    fn record_crud_versions_search_and_trash_share_one_truth() {
        let mut connection = open_memory_database().expect("open database");
        let created = create_record(&mut connection, &sample_input("AI资本开支与自由现金流"))
            .expect("create record");
        assert_eq!(created.version_count, 1);
        assert_eq!(created.tags, vec!["云计算", "资本开支"]);

        let search = list_records(
            &connection,
            &RecordQuery {
                search: Some("资本开支".to_string()),
                ..RecordQuery::default()
            },
        )
        .expect("search records");
        assert_eq!(search.len(), 1);

        let short_search = list_records(
            &connection,
            &RecordQuery {
                search: Some("谷歌".to_string()),
                ..RecordQuery::default()
            },
        )
        .expect("short search");
        assert_eq!(short_search.len(), 1);

        let mut update = UpdateRecordInput {
            title: created.title.clone(),
            summary: created.summary.clone(),
            status: RecordStatus::Updated,
            tags: created.tags.clone(),
            current_judgment: "判断已经更新。".to_string(),
            confirmed_facts: created.confirmed_facts.clone(),
            key_evidence: created.key_evidence.clone(),
            open_questions: created.open_questions.clone(),
            next_actions: created.next_actions.clone(),
            notes: created.notes.clone(),
            source_text: created.source_text.clone(),
            sources: created.sources.iter().map(source_to_input).collect(),
        };
        let updated = update_record(&mut connection, created.id, &update).expect("update record");
        assert_eq!(updated.current_judgment, "判断已经更新。");

        let v2 = append_version(
            &mut connection,
            &AppendVersionInput {
                record_id: created.id,
                version_title: "更新判断".to_string(),
                change_note: "补充证据".to_string(),
            },
        )
        .expect("append version");
        assert_eq!(v2.version_number, 2);

        update.current_judgment = "第三次判断。".to_string();
        update_record(&mut connection, created.id, &update).expect("update again");
        let restored = restore_version(
            &mut connection,
            &RestoreVersionInput {
                record_id: created.id,
                version_id: v2.id,
            },
        )
        .expect("restore version");
        assert_eq!(restored.version_number, 3);
        assert_eq!(
            get_record(&connection, created.id)
                .expect("read restored")
                .current_judgment,
            "判断已经更新。"
        );

        let favorite = set_favorite(&connection, created.id, true).expect("favorite record");
        assert_eq!(favorite.record_id, created.id);
        assert!(favorite.is_favorite);
        assert!(
            serde_json::to_vec(&favorite)
                .expect("serialize favorite update")
                .len()
                < 200
        );
        assert_eq!(
            list_records(
                &connection,
                &RecordQuery {
                    favorites_only: true,
                    ..RecordQuery::default()
                }
            )
            .expect("favorite records")
            .len(),
            1
        );

        move_to_trash(&connection, created.id).expect("move to trash");
        assert!(list_records(&connection, &RecordQuery::default())
            .expect("active records")
            .is_empty());
        assert_eq!(
            list_records(
                &connection,
                &RecordQuery {
                    deleted_only: true,
                    ..RecordQuery::default()
                }
            )
            .expect("trash")
            .len(),
            1
        );
        restore_record(&connection, created.id).expect("restore record");
        assert_eq!(
            list_records(&connection, &RecordQuery::default())
                .expect("active after restore")
                .len(),
            1
        );
    }

    #[test]
    fn persisted_database_survives_reopen() {
        let directory = tempfile::tempdir().expect("temp dir");
        let path = directory.path().join("app.db");
        let record_id = {
            let mut connection = open_database(&path).expect("open database");
            create_record(&mut connection, &sample_input("持久化记录"))
                .expect("create record")
                .id
        };
        let connection = open_database(&path).expect("reopen database");
        assert_eq!(
            get_record(&connection, record_id)
                .expect("read persisted record")
                .title,
            "持久化记录"
        );
        assert_eq!(integrity_check(&connection).expect("integrity"), "ok");
    }

    #[test]
    fn lightweight_summaries_do_not_transfer_large_source_text() {
        let mut connection = open_memory_database().expect("open database");
        let mut input = sample_input("大正文记录");
        input.summary = "用于列表展示的短摘要".to_string();
        input.source_text = format!("正文命中词{}", "很长的原文".repeat(200_000));
        let created = create_record(&mut connection, &input).expect("create large record");

        let summaries =
            list_record_summaries(&connection, &RecordQuery::default()).expect("list summaries");
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].id, created.id);
        assert_eq!(summaries[0].summary, "用于列表展示的短摘要");
        assert!(
            serde_json::to_vec(&summaries)
                .expect("serialize summaries")
                .len()
                < 2_000
        );

        let body_hit = list_record_summaries(
            &connection,
            &RecordQuery {
                search: Some("正文命中词".to_string()),
                ..RecordQuery::default()
            },
        )
        .expect("search source body");
        assert_eq!(body_hit.len(), 1);
    }

    #[test]
    fn targeted_updates_preserve_sources_and_return_small_results() {
        let mut connection = open_memory_database().expect("open database");
        let mut input = sample_input("局部更新记录");
        input.sources.push(RecordSourceInput {
            source_type: "report".to_string(),
            title: "第二来源".to_string(),
            url: Some("https://example.com/report".to_string()),
            local_path: None,
            external_id: Some("report-2".to_string()),
        });
        let created = create_record(&mut connection, &input).expect("create record");

        let judgment =
            update_current_judgment(&connection, created.id, "局部保存后的判断").expect("judgment");
        let status =
            update_status(&connection, created.id, &RecordStatus::Updated).expect("status");
        assert!(
            serde_json::to_vec(&judgment)
                .expect("serialize judgment mutation")
                .len()
                < 160
        );
        assert!(
            serde_json::to_vec(&status)
                .expect("serialize status mutation")
                .len()
                < 160
        );

        let reloaded = get_record(&connection, created.id).expect("reload record");
        assert_eq!(reloaded.current_judgment, "局部保存后的判断");
        assert_eq!(reloaded.status, RecordStatus::Updated);
        assert_eq!(reloaded.sources.len(), 2);
        assert_eq!(reloaded.sources[1].title, "第二来源");
    }

    #[test]
    fn patch_record_changes_only_requested_fields_and_preserves_other_sources() {
        let mut connection = open_memory_database().expect("open database");
        let mut input = sample_input("局部字段补丁");
        input.sources.push(RecordSourceInput {
            source_type: "report".to_string(),
            title: "第二来源".to_string(),
            url: None,
            local_path: None,
            external_id: None,
        });
        let created = create_record(&mut connection, &input).expect("create record");
        patch_record(
            &mut connection,
            created.id,
            &PatchRecordInput {
                notes: Some("只修改备注".to_string()),
                ..PatchRecordInput::default()
            },
        )
        .expect("patch record");
        let reloaded = get_record(&connection, created.id).expect("reload");
        assert_eq!(reloaded.notes, "只修改备注");
        assert_eq!(reloaded.source_text, created.source_text);
        assert_eq!(reloaded.sources.len(), 2);
    }

    #[test]
    fn one_thousand_record_summary_read_is_bounded() {
        let mut connection = open_memory_database().expect("open database");
        let transaction = connection.transaction().expect("transaction");
        let payload = "研究正文".repeat(2_500);
        for index in 0..1_000 {
            transaction
                .execute(
                    "INSERT INTO records(
                       title, summary, status, current_judgment, confirmed_facts_json,
                       key_evidence_json, open_questions_json, next_actions_json, notes,
                       source_text, is_favorite, is_deleted, created_at, updated_at
                     ) VALUES (?1, ?2, 'normal', '', '[]', '[]', '[]', '[]', '', ?3, 0, 0, ?4, ?4)",
                    params![
                        format!("性能记录 {index}"),
                        format!("摘要 {index}"),
                        payload,
                        now(),
                    ],
                )
                .expect("insert fixture");
        }
        transaction.commit().expect("commit fixture");

        let started = std::time::Instant::now();
        let summaries =
            list_record_summaries(&connection, &RecordQuery::default()).expect("list summaries");
        let elapsed = started.elapsed();
        assert_eq!(summaries.len(), 1_000);
        assert!(
            elapsed < Duration::from_secs(3),
            "summary read took {elapsed:?}"
        );
        assert!(
            serde_json::to_vec(&summaries)
                .expect("serialize summaries")
                .len()
                < 1_000_000
        );
    }

    #[test]
    fn locked_database_fails_without_corrupting_data() {
        let directory = tempfile::tempdir().expect("temp dir");
        let path = directory.path().join("locked.db");
        let mut first = open_database(&path).expect("first connection");
        let created = create_record(&mut first, &sample_input("锁库测试")).expect("create record");
        let second = open_database(&path).expect("second connection");
        second
            .busy_timeout(Duration::from_millis(60))
            .expect("short timeout");
        first
            .execute_batch("BEGIN EXCLUSIVE")
            .expect("exclusive transaction");
        let result = update_current_judgment(&second, created.id, "不能写入");
        assert!(result.is_err());
        first.execute_batch("ROLLBACK").expect("rollback lock");
        assert_eq!(integrity_check(&first).expect("integrity"), "ok");
        assert_ne!(
            get_record(&first, created.id)
                .expect("record intact")
                .current_judgment,
            "不能写入"
        );
    }

    #[test]
    fn permanent_delete_requires_trash_but_not_retyping_title() {
        let mut connection = open_memory_database().expect("open database");
        let created =
            create_record(&mut connection, &sample_input("需要确认删除")).expect("create record");
        assert!(permanently_delete_record(
            &mut connection,
            &PermanentDeleteInput {
                record_id: created.id,
            },
        )
        .is_err());
        move_to_trash(&connection, created.id).expect("move to trash");
        permanently_delete_record(
            &mut connection,
            &PermanentDeleteInput {
                record_id: created.id,
            },
        )
        .expect("permanent delete");
        assert!(get_record(&connection, created.id).is_err());
    }

    #[test]
    fn original_dates_support_iso_unix_seconds_and_milliseconds() {
        let iso =
            derive_original_at(r#"{"created_at":"2024-05-06T07:08:09+08:00"}"#).expect("ISO date");
        assert!(iso.starts_with("2024-05-06T07:08:09"));

        let seconds = derive_original_at(r#"{"create_time":1714950489}"#).expect("Unix seconds");
        let milliseconds =
            derive_original_at(r#"{"update_time":1714950489000}"#).expect("Unix milliseconds");
        assert_eq!(seconds, milliseconds);
    }

    #[test]
    fn deleting_one_history_version_preserves_current_record() {
        let mut connection = open_memory_database().expect("open database");
        let created =
            create_record(&mut connection, &sample_input("版本删除")).expect("create record");
        let second = append_version(
            &mut connection,
            &AppendVersionInput {
                record_id: created.id,
                version_title: "第二版".to_string(),
                change_note: String::new(),
            },
        )
        .expect("append version");
        delete_version(
            &connection,
            &DeleteVersionInput {
                record_id: created.id,
                version_id: second.id,
            },
        )
        .expect("delete version");
        assert_eq!(
            list_versions(&connection, created.id)
                .expect("versions")
                .len(),
            1
        );
        assert_eq!(
            get_record(&connection, created.id).expect("record").title,
            "版本删除"
        );
    }
}
