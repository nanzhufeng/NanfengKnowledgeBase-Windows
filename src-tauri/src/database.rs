use std::path::Path;
use std::time::Duration;

use chrono::Utc;
use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection, OpenFlags, OptionalExtension, Transaction};

use crate::error::{AppError, AppResult};
use crate::models::{
    AppendVersionInput, CreateRecordInput, CreateTagInput, EvidenceItem, IntelligenceRecord,
    PermanentDeleteInput, RecordQuery, RecordSource, RecordSourceInput, RecordStatus,
    RecordVersion, RenameTagInput, RestoreVersionInput, TagItem, UpdateRecordInput,
};

const INITIAL_MIGRATION: &str = include_str!("../migrations/0001_initial.sql");
const INITIAL_MIGRATION_VERSION: i64 = 1;

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
    apply_migrations(&mut connection)?;
    Ok(connection)
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

fn apply_migrations(connection: &mut Connection) -> AppResult<()> {
    connection.execute_batch(
        "
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    ",
    )?;
    let applied = connection
        .query_row(
            "SELECT 1 FROM schema_migrations WHERE version = ?1",
            [INITIAL_MIGRATION_VERSION],
            |_| Ok(()),
        )
        .optional()?
        .is_some();
    if applied {
        return Ok(());
    }

    let transaction = connection.transaction()?;
    transaction.execute_batch(INITIAL_MIGRATION)?;
    transaction.execute(
        "INSERT INTO schema_migrations(version, applied_at) VALUES (?1, ?2)",
        params![INITIAL_MIGRATION_VERSION, now()],
    )?;
    transaction.commit()?;
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
        sql.push_str(" AND r.updated_at >= ?");
        values.push(Value::Text(date_from));
    }
    if let Some(date_to) = normalized_optional(&query.date_to) {
        sql.push_str(" AND r.updated_at <= ?");
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
        Some("oldest") => " ORDER BY r.updated_at ASC, r.id ASC",
        Some("title") => " ORDER BY r.title COLLATE NOCASE ASC, r.id ASC",
        Some("created_desc") => " ORDER BY r.created_at DESC, r.id DESC",
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
      source_text, is_favorite, is_deleted, created_at, updated_at
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, ?12, ?12
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
            timestamp,
        ],
    )?;
    let record_id = transaction.last_insert_rowid();
    replace_tags(&transaction, record_id, &input.tags)?;
    replace_sources(&transaction, record_id, &input.sources, &timestamp)?;
    let record = load_record(&transaction, record_id)?;
    insert_version(&transaction, &record, "初始版本", "创建记录", Some(1))?;
    transaction.commit()?;
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
      updated_at = ?11
    WHERE id = ?12
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
            timestamp,
            record_id,
        ],
    )?;
    replace_tags(&transaction, record_id, &input.tags)?;
    replace_sources(&transaction, record_id, &input.sources, &timestamp)?;
    transaction.commit()?;
    load_record(connection, record_id)
}

pub fn set_favorite(
    connection: &Connection,
    record_id: i64,
    is_favorite: bool,
) -> AppResult<IntelligenceRecord> {
    let changed = connection.execute(
        "UPDATE records SET is_favorite = ?1, updated_at = ?2 WHERE id = ?3",
        params![is_favorite as i64, now(), record_id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound("记录不存在".to_string()));
    }
    load_record(connection, record_id)
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
    if input.confirmation_title != record.title {
        return Err(AppError::Validation(
            "确认文字必须与记录标题完全一致".to_string(),
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
      updated_at = ?11
    WHERE id = ?12
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
             created_at, updated_at, deleted_at
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
                    created_at: row.get(13)?,
                    updated_at: row.get(14)?,
                    deleted_at: row.get(15)?,
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
    fn permanent_delete_requires_trash_and_exact_title() {
        let mut connection = open_memory_database().expect("open database");
        let created =
            create_record(&mut connection, &sample_input("需要确认删除")).expect("create record");
        assert!(permanently_delete_record(
            &mut connection,
            &PermanentDeleteInput {
                record_id: created.id,
                confirmation_title: created.title.clone(),
            },
        )
        .is_err());
        move_to_trash(&connection, created.id).expect("move to trash");
        assert!(permanently_delete_record(
            &mut connection,
            &PermanentDeleteInput {
                record_id: created.id,
                confirmation_title: "错误标题".to_string(),
            },
        )
        .is_err());
        permanently_delete_record(
            &mut connection,
            &PermanentDeleteInput {
                record_id: created.id,
                confirmation_title: created.title,
            },
        )
        .expect("permanent delete");
        assert!(get_record(&connection, created.id).is_err());
    }
}
