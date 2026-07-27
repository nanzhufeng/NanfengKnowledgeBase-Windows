use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::AttachmentItem;
use crate::paths::AppPaths;

const MAX_ATTACHMENT_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const COPY_BUFFER_BYTES: usize = 256 * 1024;

#[derive(Debug)]
pub struct PreparedAttachment {
    pub file_name: String,
    pub stored_path: PathBuf,
    pub original_path: String,
    pub size_bytes: i64,
    pub sha256: String,
    pub created_new_file: bool,
}

pub fn list_attachments(connection: &Connection, record_id: i64) -> AppResult<Vec<AttachmentItem>> {
    let mut statement = connection.prepare(
        "SELECT id, record_id, file_name, stored_path, original_path, mime_type,
                size_bytes, sha256, created_at
         FROM attachments
         WHERE record_id = ?1
         ORDER BY created_at DESC, id DESC",
    )?;
    let rows = statement.query_map([record_id], row_to_attachment)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn prepare_attachment(
    paths: &AppPaths,
    record_id: i64,
    source_path: impl AsRef<Path>,
) -> AppResult<PreparedAttachment> {
    let source_path = source_path.as_ref();
    if !source_path.is_file() {
        return Err(AppError::NotFound("选择的附件文件不存在".to_string()));
    }
    let metadata = source_path.metadata()?;
    if metadata.len() > MAX_ATTACHMENT_BYTES {
        return Err(AppError::Validation("单个附件不能超过 2 GB".to_string()));
    }

    let mut source_file = fs::File::open(source_path)?;
    let mut hasher = Sha256::new();
    // 缓冲区必须放在堆上。Windows 工作线程栈较小，1 MB 栈数组会直接触发
    // 0xc00000fd 栈溢出，表现为添加任意文本或视频附件时整个应用退出。
    let mut buffer = vec![0_u8; COPY_BUFFER_BYTES];
    loop {
        let read = source_file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    let sha256 = hex::encode(hasher.finalize());
    let file_name = source_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("附件")
        .to_string();
    let destination = paths.attachments.join(format!(
        "{}_{}_{}",
        record_id,
        &sha256[..12],
        sanitize_file_name(&file_name)
    ));
    let mut created_new_file = false;
    if !destination.exists() {
        let temporary = destination.with_extension(format!("{}.tmp", Uuid::new_v4()));
        let copy_result = (|| -> AppResult<()> {
            let mut input = fs::File::open(source_path)?;
            let mut output = fs::File::create(&temporary)?;
            let mut copy_buffer = vec![0_u8; COPY_BUFFER_BYTES];
            loop {
                let read = input.read(&mut copy_buffer)?;
                if read == 0 {
                    break;
                }
                output.write_all(&copy_buffer[..read])?;
            }
            output.sync_all()?;
            fs::rename(&temporary, &destination)?;
            Ok(())
        })();
        if copy_result.is_err() && temporary.exists() {
            let _ = fs::remove_file(&temporary);
        }
        copy_result?;
        created_new_file = true;
    }
    Ok(PreparedAttachment {
        file_name,
        stored_path: destination,
        original_path: source_path.to_string_lossy().into_owned(),
        size_bytes: metadata.len() as i64,
        sha256,
        created_new_file,
    })
}

pub fn commit_attachment(
    connection: &Connection,
    record_id: i64,
    prepared: PreparedAttachment,
) -> AppResult<AttachmentItem> {
    let record_exists = connection
        .query_row("SELECT 1 FROM records WHERE id = ?1", [record_id], |_| {
            Ok(())
        })
        .optional()?
        .is_some();
    if !record_exists {
        cleanup_prepared(&prepared);
        return Err(AppError::NotFound("记录不存在".to_string()));
    }
    if let Some(existing_id) = connection
        .query_row(
            "SELECT id FROM attachments WHERE record_id = ?1 AND sha256 = ?2 LIMIT 1",
            params![record_id, prepared.sha256],
            |row| row.get::<_, i64>(0),
        )
        .optional()?
    {
        cleanup_prepared(&prepared);
        return get_attachment(connection, existing_id);
    }
    let created_at = Utc::now().to_rfc3339();
    let insert_result = connection.execute(
        "INSERT INTO attachments(
           record_id, file_name, stored_path, original_path, mime_type,
           size_bytes, sha256, created_at
         ) VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6, ?7)",
        params![
            record_id,
            prepared.file_name,
            prepared.stored_path.to_string_lossy(),
            prepared.original_path,
            prepared.size_bytes,
            prepared.sha256,
            created_at,
        ],
    );
    if let Err(error) = insert_result {
        cleanup_prepared(&prepared);
        return Err(error.into());
    }
    get_attachment(connection, connection.last_insert_rowid())
}

#[cfg(test)]
pub fn add_attachment(
    connection: &Connection,
    paths: &AppPaths,
    record_id: i64,
    source_path: impl AsRef<Path>,
) -> AppResult<AttachmentItem> {
    let prepared = prepare_attachment(paths, record_id, source_path)?;
    commit_attachment(connection, record_id, prepared)
}

pub fn open_attachment(
    connection: &Connection,
    paths: &AppPaths,
    attachment_id: i64,
) -> AppResult<()> {
    let attachment = get_attachment(connection, attachment_id)?;
    let path = controlled_attachment_file(paths, &attachment.stored_path)?;
    crate::external_open::open_path(&path)
}

pub fn remove_attachment(
    connection: &mut Connection,
    paths: &AppPaths,
    attachment_id: i64,
) -> AppResult<()> {
    let attachment = get_attachment(connection, attachment_id)?;
    let stored_path = controlled_attachment_file(paths, &attachment.stored_path)?;
    let shared_reference_count = connection.query_row(
        "SELECT COUNT(*) FROM attachments WHERE stored_path = ?1",
        [attachment.stored_path.as_str()],
        |row| row.get::<_, i64>(0),
    )?;
    if shared_reference_count > 1 {
        connection.execute("DELETE FROM attachments WHERE id = ?1", [attachment_id])?;
        return Ok(());
    }
    let staged_path = stored_path.with_extension(format!("deleting-{}", Uuid::new_v4()));
    if stored_path.is_file() {
        fs::rename(&stored_path, &staged_path)?;
    }
    let transaction = connection.transaction()?;
    if let Err(error) =
        transaction.execute("DELETE FROM attachments WHERE id = ?1", [attachment_id])
    {
        if staged_path.is_file() {
            let _ = fs::rename(&staged_path, &stored_path);
        }
        return Err(error.into());
    }
    transaction.commit()?;
    if staged_path.is_file() {
        fs::remove_file(staged_path)?;
    }
    Ok(())
}

fn get_attachment(connection: &Connection, attachment_id: i64) -> AppResult<AttachmentItem> {
    connection
        .query_row(
            "SELECT id, record_id, file_name, stored_path, original_path, mime_type,
                    size_bytes, sha256, created_at
             FROM attachments
             WHERE id = ?1",
            [attachment_id],
            row_to_attachment,
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound("附件不存在".to_string()))
}

fn row_to_attachment(row: &rusqlite::Row<'_>) -> rusqlite::Result<AttachmentItem> {
    Ok(AttachmentItem {
        id: row.get(0)?,
        record_id: row.get(1)?,
        file_name: row.get(2)?,
        stored_path: row.get(3)?,
        original_path: row.get(4)?,
        mime_type: row.get(5)?,
        size_bytes: row.get(6)?,
        sha256: row.get(7)?,
        created_at: row.get(8)?,
    })
}

fn sanitize_file_name(name: &str) -> String {
    name.chars()
        .map(|character| {
            if matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            ) {
                '_'
            } else {
                character
            }
        })
        .collect()
}

fn controlled_attachment_file(paths: &AppPaths, stored_path: &str) -> AppResult<PathBuf> {
    let root = paths.attachments.canonicalize().map_err(|error| {
        AppError::Io(std::io::Error::other(format!(
            "无法核对附件受控目录：{error}"
        )))
    })?;
    let path = PathBuf::from(stored_path);
    let canonical = path
        .canonicalize()
        .map_err(|_| AppError::NotFound("附件归档文件不存在，可从原始路径重新添加".to_string()))?;
    if !canonical.is_file() || !canonical.starts_with(&root) {
        return Err(AppError::Conflict(
            "附件路径不在受控目录中，已阻止访问".to_string(),
        ));
    }
    Ok(canonical)
}

fn cleanup_prepared(prepared: &PreparedAttachment) {
    if prepared.created_new_file && prepared.stored_path.is_file() {
        let _ = fs::remove_file(&prepared.stored_path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database;
    use crate::models::CreateRecordInput;

    #[test]
    fn attachment_is_copied_listed_and_removed_from_controlled_storage() {
        let directory = tempfile::tempdir().expect("temp dir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        let record = database::create_record(
            &mut connection,
            &CreateRecordInput {
                title: "附件测试".to_string(),
                original_at: None,
                summary: String::new(),
                status: Default::default(),
                tags: Vec::new(),
                current_judgment: String::new(),
                confirmed_facts: Vec::new(),
                key_evidence: Vec::new(),
                open_questions: Vec::new(),
                next_actions: Vec::new(),
                notes: String::new(),
                source_text: String::new(),
                sources: Vec::new(),
                is_favorite: false,
            },
        )
        .expect("record");
        let source = directory.path().join("证据.txt");
        fs::write(&source, "附件证据").expect("source file");

        let attachment =
            add_attachment(&connection, &paths, record.id, &source).expect("add attachment");
        let duplicate = add_attachment(&connection, &paths, record.id, &source)
            .expect("deduplicate attachment");
        assert_eq!(duplicate.id, attachment.id);
        assert!(Path::new(&attachment.stored_path).is_file());
        assert_eq!(
            list_attachments(&connection, record.id)
                .expect("list attachments")
                .len(),
            1
        );
        remove_attachment(&mut connection, &paths, attachment.id).expect("remove attachment");
        assert!(!Path::new(&attachment.stored_path).exists());
    }

    #[test]
    fn attachment_archive_does_not_overflow_small_worker_stack() {
        std::thread::Builder::new()
            .name("attachment-small-stack".to_string())
            .stack_size(384 * 1024)
            .spawn(|| {
                let directory = tempfile::tempdir().expect("temp dir");
                let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
                let mut connection = database::open_database(&paths.database).expect("database");
                let record = database::create_record(
                    &mut connection,
                    &CreateRecordInput {
                        title: "视频附件栈测试".to_string(),
                        original_at: None,
                        summary: String::new(),
                        status: Default::default(),
                        tags: Vec::new(),
                        current_judgment: String::new(),
                        confirmed_facts: Vec::new(),
                        key_evidence: Vec::new(),
                        open_questions: Vec::new(),
                        next_actions: Vec::new(),
                        notes: String::new(),
                        source_text: String::new(),
                        sources: Vec::new(),
                        is_favorite: false,
                    },
                )
                .expect("record");
                let source = directory.path().join("sample-video.mp4");
                fs::write(&source, vec![0x5a; 4 * 1024 * 1024]).expect("large attachment");
                let attachment = add_attachment(&connection, &paths, record.id, &source)
                    .expect("archive on small stack");
                assert_eq!(attachment.size_bytes, 4 * 1024 * 1024);
            })
            .expect("spawn worker")
            .join()
            .expect("worker should not overflow");
    }

    #[test]
    fn removing_one_shared_attachment_link_keeps_the_physical_file() {
        let directory = tempfile::tempdir().expect("temp dir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        let create = |connection: &mut Connection, title: &str| {
            database::create_record(
                connection,
                &CreateRecordInput {
                    title: title.to_string(),
                    original_at: None,
                    summary: String::new(),
                    status: Default::default(),
                    tags: Vec::new(),
                    current_judgment: String::new(),
                    confirmed_facts: Vec::new(),
                    key_evidence: Vec::new(),
                    open_questions: Vec::new(),
                    next_actions: Vec::new(),
                    notes: String::new(),
                    source_text: String::new(),
                    sources: Vec::new(),
                    is_favorite: false,
                },
            )
            .expect("record")
        };
        let first_record = create(&mut connection, "共享附件一");
        let second_record = create(&mut connection, "共享附件二");
        let source = directory.path().join("共享证据.txt");
        fs::write(&source, "共享附件证据").expect("source");
        let first =
            add_attachment(&connection, &paths, first_record.id, &source).expect("first link");
        connection
            .execute(
                "INSERT INTO attachments(
                   record_id, file_name, stored_path, original_path, mime_type,
                   size_bytes, sha256, created_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    second_record.id,
                    first.file_name,
                    first.stored_path,
                    first.original_path,
                    first.mime_type,
                    first.size_bytes,
                    first.sha256,
                    first.created_at,
                ],
            )
            .expect("second link");
        let second_id = connection.last_insert_rowid();

        remove_attachment(&mut connection, &paths, first.id).expect("remove first link");
        assert!(Path::new(&first.stored_path).is_file());
        remove_attachment(&mut connection, &paths, second_id).expect("remove last link");
        assert!(!Path::new(&first.stored_path).exists());
    }

    #[test]
    fn restored_database_cannot_open_or_delete_an_arbitrary_local_file() {
        let directory = tempfile::tempdir().expect("temp dir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        let record = database::create_record(
            &mut connection,
            &CreateRecordInput {
                title: "恶意恢复附件路径".to_string(),
                original_at: None,
                summary: String::new(),
                status: Default::default(),
                tags: Vec::new(),
                current_judgment: String::new(),
                confirmed_facts: Vec::new(),
                key_evidence: Vec::new(),
                open_questions: Vec::new(),
                next_actions: Vec::new(),
                notes: String::new(),
                source_text: String::new(),
                sources: Vec::new(),
                is_favorite: false,
            },
        )
        .expect("record");
        let outside = directory.path().join("outside.txt");
        fs::write(&outside, "不可访问").expect("outside");
        connection
            .execute(
                "INSERT INTO attachments(
                   record_id, file_name, stored_path, original_path, mime_type,
                   size_bytes, sha256, created_at
                 ) VALUES (?1, 'outside.txt', ?2, NULL, 'text/plain', 8, 'bad', ?3)",
                params![
                    record.id,
                    outside.to_string_lossy(),
                    Utc::now().to_rfc3339()
                ],
            )
            .expect("insert malicious path");
        let attachment_id = connection.last_insert_rowid();

        let open_error = open_attachment(&connection, &paths, attachment_id)
            .expect_err("outside path must not open");
        assert!(open_error.to_string().contains("受控目录"));
        let remove_error = remove_attachment(&mut connection, &paths, attachment_id)
            .expect_err("outside path must not delete");
        assert!(remove_error.to_string().contains("受控目录"));
        assert!(outside.is_file());
    }
}
