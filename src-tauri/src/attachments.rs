use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet, VecDeque};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use chrono::Utc;
use encoding_rs::GBK;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::{
    AttachmentItem, AttachmentSearchHit, LegacyAttachmentRecoveryPreview,
    LegacyAttachmentRecoveryResult, SourceAttachmentCatalogHit, SourceAttachmentHydrationFailure,
    SourceAttachmentHydrationResult,
};
use crate::paths::AppPaths;

const MAX_ATTACHMENT_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const COPY_BUFFER_BYTES: usize = 256 * 1024;
const MAX_LEGACY_RECOVERY_SCAN_FILES: usize = 50_000;
const MAX_TEXT_PREVIEW_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
struct LegacySourceAsset {
    record_id: i64,
    file_name: String,
}

#[derive(Debug)]
pub struct PreparedAttachment {
    pub file_name: String,
    pub stored_path: PathBuf,
    pub original_path: String,
    pub mime_type: Option<String>,
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

/// 附件检索只读取受控归档的元数据，不解压原始包，也不会把 OCR/转写伪装成已有能力。
pub fn search_attachments(
    connection: &Connection,
    keyword: Option<String>,
    category: Option<String>,
    limit: Option<usize>,
) -> AppResult<Vec<AttachmentSearchHit>> {
    let keyword = keyword.unwrap_or_default().trim().to_string();
    let category = category
        .unwrap_or_else(|| "all".to_string())
        .to_ascii_lowercase();
    if !matches!(
        category.as_str(),
        "all" | "image" | "video" | "audio" | "file"
    ) {
        return Err(AppError::Validation("附件筛选类型不受支持".to_string()));
    }
    let mut sql = String::from(
        "SELECT a.id, a.record_id, a.file_name, a.stored_path, a.original_path, a.mime_type,
                a.size_bytes, a.sha256, a.created_at, r.title, r.summary, r.original_at
         FROM attachments a JOIN records r ON r.id = a.record_id
         WHERE r.is_deleted = 0",
    );
    let mut values = Vec::<rusqlite::types::Value>::new();
    if !keyword.is_empty() {
        sql.push_str(" AND (a.file_name LIKE ? OR COALESCE(a.mime_type, '') LIKE ?)");
        let pattern = format!("%{keyword}%");
        values.push(rusqlite::types::Value::Text(pattern.clone()));
        values.push(rusqlite::types::Value::Text(pattern));
    }
    match category.as_str() {
        "image" => sql.push_str(" AND (lower(COALESCE(a.mime_type, '')) LIKE 'image/%' OR lower(a.file_name) GLOB '*.[jp][pn]g' OR lower(a.file_name) GLOB '*.jpeg' OR lower(a.file_name) GLOB '*.webp' OR lower(a.file_name) GLOB '*.gif' OR lower(a.file_name) GLOB '*.heic' OR lower(a.file_name) GLOB '*.avif')"),
        "video" => sql.push_str(" AND (lower(COALESCE(a.mime_type, '')) LIKE 'video/%' OR lower(a.file_name) GLOB '*.mp4' OR lower(a.file_name) GLOB '*.mov' OR lower(a.file_name) GLOB '*.webm' OR lower(a.file_name) GLOB '*.mkv' OR lower(a.file_name) GLOB '*.avi')"),
        "audio" => sql.push_str(" AND (lower(COALESCE(a.mime_type, '')) LIKE 'audio/%' OR lower(a.file_name) GLOB '*.mp3' OR lower(a.file_name) GLOB '*.wav' OR lower(a.file_name) GLOB '*.m4a' OR lower(a.file_name) GLOB '*.flac' OR lower(a.file_name) GLOB '*.aac' OR lower(a.file_name) GLOB '*.opus')"),
        "file" => sql.push_str(" AND NOT (lower(COALESCE(a.mime_type, '')) LIKE 'image/%' OR lower(COALESCE(a.mime_type, '')) LIKE 'video/%' OR lower(COALESCE(a.mime_type, '')) LIKE 'audio/%' OR lower(a.file_name) GLOB '*.[jp][pn]g' OR lower(a.file_name) GLOB '*.jpeg' OR lower(a.file_name) GLOB '*.webp' OR lower(a.file_name) GLOB '*.gif' OR lower(a.file_name) GLOB '*.heic' OR lower(a.file_name) GLOB '*.avif' OR lower(a.file_name) GLOB '*.mp4' OR lower(a.file_name) GLOB '*.mov' OR lower(a.file_name) GLOB '*.webm' OR lower(a.file_name) GLOB '*.mkv' OR lower(a.file_name) GLOB '*.avi' OR lower(a.file_name) GLOB '*.mp3' OR lower(a.file_name) GLOB '*.wav' OR lower(a.file_name) GLOB '*.m4a' OR lower(a.file_name) GLOB '*.flac' OR lower(a.file_name) GLOB '*.aac' OR lower(a.file_name) GLOB '*.opus')"),
        _ => {}
    }
    sql.push_str(" ORDER BY COALESCE(r.original_at, a.created_at) DESC, a.id DESC LIMIT ?");
    values.push(rusqlite::types::Value::Integer(
        limit.unwrap_or(80).clamp(1, 160) as i64,
    ));
    let mut statement = connection.prepare(&sql)?;
    let rows = statement.query_map(rusqlite::params_from_iter(values), |row| {
        Ok(AttachmentSearchHit {
            attachment: row_to_attachment(row)?,
            record_title: row.get(9)?,
            record_summary: row.get(10)?,
            record_original_at: row.get(11)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn list_source_attachments(
    connection: &Connection,
    source_item_id: i64,
) -> AppResult<Vec<AttachmentItem>> {
    let mut statement = connection.prepare(
        "SELECT DISTINCT attachment.id, attachment.record_id, attachment.file_name,
                attachment.stored_path, attachment.original_path, attachment.mime_type,
                attachment.size_bytes, attachment.sha256, attachment.created_at
         FROM source_items source
         JOIN attachments attachment
           ON attachment.record_id = source.legacy_record_id
           OR EXISTS (
             SELECT 1
             FROM attachment_links link
             WHERE link.attachment_id = attachment.id
               AND link.source_item_id = source.id
           )
         WHERE source.id = ?1
         ORDER BY attachment.created_at DESC, attachment.id DESC",
    )?;
    let rows = statement.query_map([source_item_id], row_to_attachment)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

/// 历史资料筛选的事实来源是“正文声明目录 + 已受控实体”，而不是仅有 attachments 表。
/// 此函数只读 JSON 与元数据，不解压归档；因此未恢复附件也能立即出现在全部分类里。
pub fn search_source_attachment_catalog(
    connection: &Connection,
    keyword: Option<String>,
    category: Option<String>,
    limit: Option<usize>,
) -> AppResult<Vec<SourceAttachmentCatalogHit>> {
    let keyword = keyword.unwrap_or_default().trim().to_ascii_lowercase();
    let category = category
        .unwrap_or_else(|| "all".to_string())
        .to_ascii_lowercase();
    if !matches!(
        category.as_str(),
        "all" | "image" | "video" | "audio" | "file"
    ) {
        return Err(AppError::Validation("附件筛选类型不受支持".to_string()));
    }

    let mut statement = connection.prepare(
        "SELECT source.id, source.legacy_record_id, source.title, source.original_text,
                COALESCE(source.original_at, record.original_at, source.imported_at),
                COALESCE(record.summary, '')
         FROM source_items source
         LEFT JOIN records record ON record.id = source.legacy_record_id
         WHERE source.status = 'active' AND (record.id IS NULL OR record.is_deleted = 0)
         ORDER BY COALESCE(source.original_at, record.original_at, source.imported_at) DESC,
                  source.id DESC",
    )?;
    let sources = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<i64>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, String>(5)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut hits = Vec::new();
    for (source_item_id, record_id, title, original_text, original_at, summary) in sources {
        let attachments = list_source_attachments(connection, source_item_id)?;
        let mut matched_attachment_ids = HashSet::new();
        let declarations = serde_json::from_str::<Value>(&original_text)
            .map(|value| collect_declared_attachments(&value))
            .unwrap_or_default();

        for declaration in declarations.into_values() {
            let attachment = attachments
                .iter()
                .find(|candidate| declared_attachment_matches(candidate, &declaration))
                .cloned();
            if let Some(candidate) = attachment.as_ref() {
                matched_attachment_ids.insert(candidate.id);
            }
            let file_name = declaration.file_name.clone().unwrap_or_else(|| {
                let short_id = declaration
                    .attachment_id
                    .chars()
                    .take(18)
                    .collect::<String>();
                format!("附件 {short_id}")
            });
            let mime_type = declaration
                .mime_type
                .clone()
                .or_else(|| attachment.as_ref().and_then(|item| item.mime_type.clone()));
            if !catalog_hit_matches(
                &keyword,
                &category,
                &file_name,
                mime_type.as_deref(),
                &title,
            ) {
                continue;
            }
            hits.push(SourceAttachmentCatalogHit {
                key: format!("source:{source_item_id}:{}", declaration.attachment_id),
                source_item_id,
                record_id,
                file_uuid: Some(declaration.attachment_id),
                file_name,
                mime_type,
                size_bytes: declaration
                    .size_bytes
                    .or_else(|| attachment.as_ref().map(|item| item.size_bytes)),
                availability: if attachment.is_some() {
                    "ready"
                } else {
                    "recoverable"
                }
                .to_string(),
                attachment,
                record_title: title.clone(),
                record_summary: summary.clone(),
                record_original_at: original_at.clone(),
            });
        }

        // 手工添加或旧版已归档、但原始 JSON 没有稳定声明 ID 的文件仍必须保留。
        for attachment in attachments {
            if matched_attachment_ids.contains(&attachment.id)
                || !catalog_hit_matches(
                    &keyword,
                    &category,
                    &attachment.file_name,
                    attachment.mime_type.as_deref(),
                    &title,
                )
            {
                continue;
            }
            hits.push(SourceAttachmentCatalogHit {
                key: format!("attachment:{}", attachment.id),
                source_item_id,
                record_id: Some(attachment.record_id),
                file_uuid: attachment_declared_id(&attachment),
                file_name: attachment.file_name.clone(),
                mime_type: attachment.mime_type.clone(),
                size_bytes: Some(attachment.size_bytes),
                availability: "ready".to_string(),
                attachment: Some(attachment),
                record_title: title.clone(),
                record_summary: summary.clone(),
                record_original_at: original_at.clone(),
            });
        }
    }

    hits.sort_by(|left, right| {
        right
            .record_original_at
            .cmp(&left.record_original_at)
            .then_with(|| {
                left.file_name
                    .to_ascii_lowercase()
                    .cmp(&right.file_name.to_ascii_lowercase())
            })
            .then_with(|| left.key.cmp(&right.key))
    });
    if let Some(limit) = limit {
        hits.truncate(limit.clamp(1, 100_000));
    }
    Ok(hits)
}

/// 当前打开来源按声明 ID 顺序自动物化；单个失败不阻断同一笔记里的其他文件。
pub fn hydrate_source_attachments(
    connection: &mut Connection,
    paths: &AppPaths,
    source_item_id: i64,
    attachment_ids: Vec<String>,
) -> SourceAttachmentHydrationResult {
    let mut attachments = Vec::new();
    let mut failures = Vec::new();
    let mut seen = HashSet::new();
    for attachment_id in attachment_ids {
        let normalized_key = attachment_id.trim().to_ascii_lowercase();
        if normalized_key.is_empty() || !seen.insert(normalized_key) {
            continue;
        }
        match recover_source_attachment(connection, paths, source_item_id, &attachment_id) {
            Ok(attachment) => attachments.push(attachment),
            Err(error) => failures.push(SourceAttachmentHydrationFailure {
                attachment_id,
                message: error.to_string(),
            }),
        }
    }
    SourceAttachmentHydrationResult {
        attachments,
        failures,
    }
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
    let mime_type = infer_attachment_mime(source_path, &file_name)?;
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
        mime_type,
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
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            record_id,
            prepared.file_name,
            prepared.stored_path.to_string_lossy(),
            prepared.original_path,
            prepared.mime_type,
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

/// 只允许按数据库中的附件 ID 定位受控归档文件，前端不能提交任意本机路径。
pub fn reveal_attachment(
    connection: &Connection,
    paths: &AppPaths,
    attachment_id: i64,
) -> AppResult<()> {
    let attachment = get_attachment(connection, attachment_id)?;
    let path = controlled_attachment_file(paths, &attachment.stored_path)?;
    crate::external_open::reveal_path(&path)
}

/// 文本附件必须由受控读取入口解码，不能交给 WebView 猜测系统代码页。
/// 优先保留 UTF-8，并兼容 Windows 常见的 UTF-16 与 GBK 历史文件。
pub fn read_attachment_text(
    connection: &Connection,
    paths: &AppPaths,
    attachment_id: i64,
) -> AppResult<String> {
    let attachment = get_attachment(connection, attachment_id)?;
    if !is_text_attachment(&attachment) {
        return Err(AppError::Validation("该附件不是可读取的文本格式".to_string()));
    }
    let path = controlled_attachment_file(paths, &attachment.stored_path)?;
    let size = path.metadata()?.len();
    if size > MAX_TEXT_PREVIEW_BYTES {
        return Err(AppError::Validation(
            "文本附件超过 8 MB，请使用原应用打开".to_string(),
        ));
    }
    Ok(decode_attachment_text(&fs::read(path)?))
}

fn is_text_attachment(attachment: &AttachmentItem) -> bool {
    let mime = attachment
        .mime_type
        .as_deref()
        .unwrap_or_default()
        .to_ascii_lowercase();
    let extension = Path::new(&attachment.file_name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    mime.starts_with("text/")
        || matches!(
            mime.as_str(),
            "application/json" | "application/xml" | "application/yaml"
        )
        || matches!(
            extension.as_str(),
            "txt" | "md" | "markdown" | "json" | "csv" | "log" | "xml" | "yaml" | "yml"
        )
}

fn decode_attachment_text(bytes: &[u8]) -> String {
    if let Some(content) = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
        return String::from_utf8_lossy(content).into_owned();
    }
    if let Some(content) = bytes.strip_prefix(&[0xFF, 0xFE]) {
        let units = content
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect::<Vec<_>>();
        return String::from_utf16_lossy(&units);
    }
    if let Some(content) = bytes.strip_prefix(&[0xFE, 0xFF]) {
        let units = content
            .chunks_exact(2)
            .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
            .collect::<Vec<_>>();
        return String::from_utf16_lossy(&units);
    }
    if let Ok(content) = std::str::from_utf8(bytes) {
        return content.to_string();
    }
    let (decoded, _, _) = GBK.decode(bytes);
    decoded.into_owned()
}

/// 历史版本已导入对话正文、但尚未建立附件行时，先仅统计恢复来源。
/// 这个函数不复制 ZIP 内容、不写数据库，供设置页的确认弹窗使用。
pub fn inspect_legacy_attachment_recovery(
    connection: &Connection,
    source_directory: Option<&str>,
) -> AppResult<LegacyAttachmentRecoveryPreview> {
    let archive_count = connection.query_row(
        "SELECT COUNT(*) FROM import_jobs WHERE lower(source_file_name) LIKE '%.zip'",
        [],
        |row| row.get::<_, i64>(0),
    )?;
    let missing_assets = legacy_source_assets_without_attachment(connection)?;
    let record_count = missing_assets
        .iter()
        .map(|asset| asset.record_id)
        .collect::<BTreeSet<_>>()
        .len() as i64;
    let recoverable_attachment_count = source_directory
        .filter(|path| !path.trim().is_empty())
        .map(|path| {
            let candidates = scan_legacy_attachment_directory(Path::new(path))?;
            Ok::<_, AppError>(
                missing_assets
                    .iter()
                    .filter(|asset| has_unique_candidate(asset, &candidates))
                    .count() as i64,
            )
        })
        .transpose()?
        .unwrap_or(0);
    Ok(LegacyAttachmentRecoveryPreview {
        archive_count,
        record_count,
        recoverable_attachment_count,
        unresolved_attachment_count: missing_assets.len() as i64 - recoverable_attachment_count,
    })
}

/// 仅由用户在设置中确认后执行。ChatGPT ZIP 会再次物化已有素材；其他历史导入会
/// 从用户明确选择的文件夹按原文件名精确匹配。不会删除原文件、已有附件或笔记正文。
pub fn recover_legacy_attachments(
    connection: &Connection,
    paths: &AppPaths,
    source_directory: Option<&str>,
) -> AppResult<LegacyAttachmentRecoveryResult> {
    let archive_paths = {
        let mut statement = connection.prepare(
            "SELECT stored_file_path FROM import_jobs WHERE lower(source_file_name) LIKE '%.zip'",
        )?;
        let rows = statement.query_map([], |row| row.get::<_, String>(0))?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    let mut conversation_records = std::collections::HashMap::<String, i64>::new();
    {
        let mut statement = connection.prepare(
            "SELECT s.external_id, s.record_id FROM sources s JOIN records r ON r.id = s.record_id
             WHERE s.external_id IS NOT NULL AND trim(s.external_id) <> ''
               AND (r.source_text LIKE '%file-service://%' OR r.source_text LIKE '%sediment://%')",
        )?;
        for row in statement.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })? {
            let (external_id, record_id) = row?;
            conversation_records.insert(external_id, record_id);
        }
    }
    let mut recovered = 0_i64;
    for archive in &archive_paths {
        let archived_zip = Path::new(archive);
        if !archived_zip.is_file() {
            continue;
        }
        let output = paths
            .attachments
            .join(format!("legacy-chatgpt-recovery-{}", Uuid::new_v4()));
        let manifest = output.join("attachment-manifest.json");
        let materialization =
            crate::chatgpt_export::materialize_chatgpt_assets(archived_zip, &output, &manifest)
                .map_err(|error| {
                    AppError::Validation(format!("无法读取历史 ChatGPT 附件包：{error}"))
                })?;
        for asset in materialization.assets {
            let record_ids = asset
                .message_links
                .iter()
                .filter_map(|link| conversation_records.get(&link.conversation_id).copied())
                .collect::<std::collections::BTreeSet<_>>();
            for record_id in record_ids {
                let exists = connection.query_row(
                    "SELECT EXISTS(SELECT 1 FROM attachments WHERE record_id = ?1 AND sha256 = ?2)",
                    params![record_id, asset.sha256.to_ascii_lowercase()],
                    |row| row.get::<_, i64>(0),
                )? != 0;
                if exists {
                    continue;
                }
                connection.execute(
                    "INSERT INTO attachments(record_id, file_name, stored_path, original_path, mime_type, size_bytes, sha256, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![record_id, asset.original_file_name.as_deref().unwrap_or(&asset.stored_file_name), asset.stored_file_path,
                        format!("{}#{}", archived_zip.to_string_lossy(), asset.original_dat_entry_name), asset.detected_mime,
                        asset.size_bytes as i64, asset.sha256.to_ascii_lowercase(), Utc::now().to_rfc3339()],
                )?;
                recovered += 1;
            }
        }
    }
    let mut failed = 0_i64;
    let mut unresolved = 0_i64;
    if let Some(source_directory) = source_directory.filter(|path| !path.trim().is_empty()) {
        let candidates = scan_legacy_attachment_directory(Path::new(source_directory))?;
        for asset in legacy_source_assets_without_attachment(connection)? {
            let Some(candidate) = unique_candidate_path(&asset, &candidates) else {
                unresolved += 1;
                continue;
            };
            match prepare_attachment(paths, asset.record_id, candidate)
                .and_then(|prepared| commit_attachment(connection, asset.record_id, prepared))
            {
                Ok(_) => recovered += 1,
                Err(_) => failed += 1,
            }
        }
    }
    Ok(LegacyAttachmentRecoveryResult {
        archive_count: archive_paths.len() as i64,
        recovered_attachment_count: recovered,
        unresolved_attachment_count: unresolved,
        failed_attachment_count: failed,
    })
}

/// 恢复来源正文里明确声明的一条历史 ChatGPT 附件。
///
/// 该入口只接受正文中真实声明过的附件 ID；优先检查这篇来源自己的导入原件，
/// 旧库缺少来源 origin 时才回退到历史 ZIP，并要求会话 ID 同时匹配。成功后只
/// 物化一个实体、建立来源关联并返回统一 AttachmentItem，重复点击保持幂等。
pub fn recover_source_attachment(
    connection: &mut Connection,
    paths: &AppPaths,
    source_item_id: i64,
    requested_attachment_id: &str,
) -> AppResult<AttachmentItem> {
    let attachment_id = normalize_requested_attachment_id(requested_attachment_id)?;
    let (record_id, original_text) = connection
        .query_row(
            "SELECT legacy_record_id, original_text FROM source_items WHERE id = ?1 AND status = 'active'",
            [source_item_id],
            |row| Ok((row.get::<_, Option<i64>>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound("这篇笔记不存在或已归档".to_string()))?;
    let record_id = record_id.ok_or_else(|| {
        AppError::Conflict("这篇笔记尚未建立附件归档记录，暂时不能恢复媒体".to_string())
    })?;
    let source_json = serde_json::from_str::<Value>(&original_text).map_err(|_| {
        AppError::Validation("原始对话不是可校验的 JSON，不能安全恢复附件".to_string())
    })?;
    let declaration = find_declared_attachment(&source_json, &attachment_id)
        .ok_or_else(|| AppError::Validation("这篇笔记没有声明所选附件，已停止恢复".to_string()))?;

    if let Some(existing) =
        find_existing_source_attachment(connection, source_item_id, record_id, &attachment_id)?
    {
        ensure_attachment_source_link(connection, existing.id, source_item_id)?;
        return Ok(existing);
    }

    let mut external_ids = BTreeSet::new();
    let mut archives = Vec::<(PathBuf, bool)>::new();
    {
        let mut statement = connection.prepare(
            "SELECT stored_file_path, item_external_id
             FROM source_import_origins
             WHERE source_item_id = ?1
             ORDER BY created_at DESC, id DESC",
        )?;
        for row in statement.query_map([source_item_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })? {
            let (stored_path, external_id) = row?;
            if let Some(external_id) = external_id
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
            {
                external_ids.insert(external_id);
            }
            if stored_path.to_ascii_lowercase().ends_with(".zip") {
                archives.push((PathBuf::from(stored_path), true));
            }
        }
    }
    {
        let mut statement = connection.prepare(
            "SELECT external_id FROM sources
             WHERE record_id = ?1 AND external_id IS NOT NULL AND trim(external_id) <> ''",
        )?;
        for row in statement.query_map([record_id], |row| row.get::<_, String>(0))? {
            external_ids.insert(row?);
        }
    }
    {
        let existing_paths = archives
            .iter()
            .map(|(path, _)| path.to_string_lossy().to_ascii_lowercase())
            .collect::<BTreeSet<_>>();
        let mut statement = connection.prepare(
            "SELECT stored_file_path FROM import_jobs
             WHERE lower(source_file_name) LIKE '%.zip'
             ORDER BY created_at DESC",
        )?;
        for row in statement.query_map([], |row| row.get::<_, String>(0))? {
            let path = PathBuf::from(row?);
            if !existing_paths.contains(&path.to_string_lossy().to_ascii_lowercase()) {
                archives.push((path, false));
            }
        }
    }
    if archives.is_empty() {
        return Err(AppError::NotFound(
            "没有找到这篇笔记对应的 ChatGPT 原始导出包".to_string(),
        ));
    }

    let mut inspected_archive_count = 0_usize;
    let mut located = None;
    for (archive_path, is_direct_origin) in archives {
        if !archive_path.is_file() {
            continue;
        }
        let inspection = match crate::chatgpt_export::inspect_chatgpt_export(&archive_path) {
            Ok(inspection) => inspection,
            Err(_) => continue,
        };
        inspected_archive_count += 1;
        let Some(asset) = inspection
            .assets
            .into_iter()
            .find(|asset| asset.attachment_id.eq_ignore_ascii_case(&attachment_id))
        else {
            continue;
        };
        let belongs_to_source = is_direct_origin
            || asset.message_links.iter().any(|link| {
                external_ids
                    .iter()
                    .any(|external_id| external_id == &link.conversation_id)
            });
        if belongs_to_source {
            located = Some((archive_path, asset));
            break;
        }
    }
    let (archive_path, inspected_asset) = located.ok_or_else(|| {
        if inspected_archive_count == 0 {
            AppError::NotFound("历史 ChatGPT 导出包已丢失或无法读取".to_string())
        } else {
            AppError::NotFound("原对话声明了这条附件，但历史导出包没有携带可恢复实体".to_string())
        }
    })?;
    let output_directory = paths.attachments.join(format!(
        "source-attachment-{}-{}",
        source_item_id,
        Uuid::new_v4()
    ));
    let materialized = crate::chatgpt_export::materialize_inspected_chatgpt_asset(
        &archive_path,
        &output_directory,
        &inspected_asset,
    )
    .map_err(|error| AppError::Validation(format!("附件恢复失败：{error}")))?;

    let database_result = (|| -> AppResult<i64> {
        let transaction = connection.transaction()?;
        let sha256 = materialized.sha256.to_ascii_lowercase();
        let existing_id = transaction
            .query_row(
                "SELECT id FROM attachments WHERE record_id = ?1 AND sha256 = ?2 LIMIT 1",
                params![record_id, sha256],
                |row| row.get::<_, i64>(0),
            )
            .optional()?;
        let attachment_id_row = if let Some(existing_id) = existing_id {
            let _ = fs::remove_dir_all(&output_directory);
            existing_id
        } else {
            let file_name = declaration
                .file_name
                .as_deref()
                .or(materialized.original_file_name.as_deref())
                .unwrap_or(&materialized.stored_file_name);
            transaction.execute(
                "INSERT INTO attachments(
                   record_id, file_name, stored_path, original_path, mime_type,
                   size_bytes, sha256, created_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    record_id,
                    file_name,
                    materialized.stored_file_path,
                    format!(
                        "{}#{}",
                        archive_path.to_string_lossy(),
                        materialized.original_dat_entry_name
                    ),
                    declaration
                        .mime_type
                        .as_deref()
                        .unwrap_or(&materialized.detected_mime),
                    materialized.size_bytes as i64,
                    sha256,
                    Utc::now().to_rfc3339(),
                ],
            )?;
            transaction.last_insert_rowid()
        };
        ensure_attachment_source_link(&transaction, attachment_id_row, source_item_id)?;
        transaction.commit()?;
        Ok(attachment_id_row)
    })();
    let attachment_id_row = match database_result {
        Ok(attachment_id_row) => attachment_id_row,
        Err(error) => {
            let _ = fs::remove_dir_all(&output_directory);
            return Err(error);
        }
    };
    get_attachment(connection, attachment_id_row)
}

#[derive(Debug, Clone, Default)]
struct DeclaredAttachment {
    attachment_id: String,
    file_name: Option<String>,
    mime_type: Option<String>,
    size_bytes: Option<i64>,
}

fn normalize_requested_attachment_id(value: &str) -> AppResult<String> {
    let mut normalized = value.trim().to_ascii_lowercase();
    if let Some((_, pointer)) = normalized.split_once("://") {
        normalized = pointer.to_string();
    }
    if normalized.ends_with(".dat") {
        normalized.truncate(normalized.len() - 4);
    }
    if normalized.is_empty()
        || normalized.len() > 160
        || !normalized
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-'))
    {
        return Err(AppError::Validation("附件唯一 ID 不合法".to_string()));
    }
    Ok(normalized)
}

fn find_declared_attachment(value: &Value, attachment_id: &str) -> Option<DeclaredAttachment> {
    match value {
        Value::Array(items) => items
            .iter()
            .find_map(|item| find_declared_attachment(item, attachment_id)),
        Value::Object(object) => {
            let object_id = [
                "asset_pointer",
                "file_id",
                "file_uuid",
                "fileUuid",
                "attachment_id",
                "attachmentId",
            ]
            .iter()
            .find_map(|key| object.get(*key).and_then(Value::as_str))
            .or_else(|| {
                let has_attachment_metadata = [
                    "name",
                    "file_name",
                    "fileName",
                    "filename",
                    "mime_type",
                    "mimeType",
                ]
                .iter()
                .any(|key| object.get(*key).and_then(Value::as_str).is_some());
                has_attachment_metadata
                    .then(|| object.get("id").and_then(Value::as_str))
                    .flatten()
            })
            .and_then(|value| normalize_declared_attachment_id(value));
            let file_name = ["name", "file_name", "fileName", "filename"]
                .iter()
                .find_map(|key| object.get(*key).and_then(Value::as_str))
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string);
            let mime_type = ["mime_type", "mimeType", "content_type", "contentType"]
                .iter()
                .find_map(|key| object.get(*key).and_then(Value::as_str))
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string);
            if object_id.is_some_and(|value| value.eq_ignore_ascii_case(attachment_id))
                && (file_name.is_some() || mime_type.is_some())
            {
                return Some(DeclaredAttachment {
                    attachment_id: attachment_id.to_string(),
                    file_name,
                    mime_type,
                    size_bytes: declared_size_bytes(object),
                });
            }
            object
                .values()
                .find_map(|item| find_declared_attachment(item, attachment_id))
        }
        _ => None,
    }
}

fn normalize_declared_attachment_id(value: &str) -> Option<String> {
    let mut normalized = value.trim().to_ascii_lowercase();
    if let Some((_, pointer)) = normalized.split_once("://") {
        normalized = pointer.to_string();
    }
    if normalized.ends_with(".dat") {
        normalized.truncate(normalized.len() - 4);
    }
    (!normalized.is_empty()
        && normalized.len() <= 160
        && normalized
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-')))
    .then_some(normalized)
}

fn declared_size_bytes(object: &serde_json::Map<String, Value>) -> Option<i64> {
    ["size_bytes", "size", "file_size", "fileSize"]
        .iter()
        .find_map(|key| object.get(*key).and_then(Value::as_i64))
        .filter(|value| *value >= 0)
}

fn collect_declared_attachments(value: &Value) -> BTreeMap<String, DeclaredAttachment> {
    fn visit(value: &Value, output: &mut BTreeMap<String, DeclaredAttachment>) {
        match value {
            Value::Array(items) => items.iter().for_each(|item| visit(item, output)),
            Value::Object(object) => {
                let file_name = ["name", "file_name", "fileName", "filename"]
                    .iter()
                    .find_map(|key| object.get(*key).and_then(Value::as_str))
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string);
                let explicit_mime = [
                    "mime_type",
                    "mimeType",
                    "file_type",
                    "fileType",
                    "media_type",
                    "mediaType",
                ]
                .iter()
                .find_map(|key| object.get(*key).and_then(Value::as_str))
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string);
                let content_type = ["content_type", "contentType"]
                    .iter()
                    .find_map(|key| object.get(*key).and_then(Value::as_str))
                    .unwrap_or_default()
                    .to_ascii_lowercase();
                let mime_type = explicit_mime.or_else(|| {
                    if content_type.starts_with("image_") {
                        Some("image/unknown".to_string())
                    } else if content_type.starts_with("video_") {
                        Some("video/unknown".to_string())
                    } else if content_type.starts_with("audio_") {
                        Some("audio/unknown".to_string())
                    } else {
                        None
                    }
                });
                let candidate = [
                    "asset_pointer",
                    "file_id",
                    "file_uuid",
                    "fileUuid",
                    "attachment_id",
                    "attachmentId",
                ]
                .iter()
                .find_map(|key| object.get(*key).and_then(Value::as_str))
                .or_else(|| {
                    (file_name.is_some() || mime_type.is_some())
                        .then(|| object.get("id").and_then(Value::as_str))
                        .flatten()
                })
                .and_then(normalize_declared_attachment_id);
                if let Some(attachment_id) = candidate {
                    let declaration = DeclaredAttachment {
                        attachment_id: attachment_id.clone(),
                        file_name,
                        mime_type,
                        size_bytes: declared_size_bytes(object),
                    };
                    output
                        .entry(attachment_id)
                        .and_modify(|current| {
                            current.file_name = current
                                .file_name
                                .clone()
                                .or_else(|| declaration.file_name.clone());
                            current.mime_type = current
                                .mime_type
                                .clone()
                                .or_else(|| declaration.mime_type.clone());
                            current.size_bytes = current.size_bytes.or(declaration.size_bytes);
                        })
                        .or_insert(declaration);
                }
                object.values().for_each(|item| visit(item, output));
            }
            _ => {}
        }
    }
    let mut output = BTreeMap::new();
    visit(value, &mut output);
    output
}

fn attachment_declared_id(attachment: &AttachmentItem) -> Option<String> {
    if let Some(original_path) = attachment.original_path.as_deref() {
        if let Some((_, entry)) = original_path.rsplit_once('#') {
            if let Some(id) = normalize_declared_attachment_id(
                Path::new(entry)
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or(entry),
            ) {
                return Some(id);
            }
        }
    }
    Path::new(&attachment.stored_path)
        .file_name()
        .and_then(|name| name.to_str())
        .and_then(|name| name.split_once("__").map(|(id, _)| id))
        .and_then(normalize_declared_attachment_id)
}

fn declared_attachment_matches(
    attachment: &AttachmentItem,
    declaration: &DeclaredAttachment,
) -> bool {
    attachment_declared_id(attachment)
        .is_some_and(|value| value.eq_ignore_ascii_case(&declaration.attachment_id))
        || declaration
            .file_name
            .as_deref()
            .is_some_and(|name| attachment.file_name.eq_ignore_ascii_case(name))
}

fn catalog_hit_matches(
    keyword: &str,
    category: &str,
    file_name: &str,
    mime_type: Option<&str>,
    record_title: &str,
) -> bool {
    let searchable = format!(
        "{file_name}\n{}\n{record_title}",
        mime_type.unwrap_or_default()
    )
    .to_ascii_lowercase();
    if !keyword.is_empty() && !searchable.contains(keyword) {
        return false;
    }
    let name = file_name.to_ascii_lowercase();
    let mime = mime_type.unwrap_or_default().to_ascii_lowercase();
    let image = mime.starts_with("image/")
        || [
            ".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".avif", ".bmp", ".svg",
        ]
        .iter()
        .any(|suffix| name.ends_with(suffix));
    let video = mime.starts_with("video/")
        || [".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v", ".mpeg"]
            .iter()
            .any(|suffix| name.ends_with(suffix));
    let audio = mime.starts_with("audio/")
        || [".mp3", ".wav", ".m4a", ".flac", ".aac", ".opus", ".ogg"]
            .iter()
            .any(|suffix| name.ends_with(suffix));
    match category {
        "image" => image,
        "video" => video,
        "audio" => audio,
        "file" => !image && !video && !audio,
        _ => true,
    }
}

fn find_existing_source_attachment(
    connection: &Connection,
    source_item_id: i64,
    record_id: i64,
    attachment_id: &str,
) -> AppResult<Option<AttachmentItem>> {
    let attachment_id = attachment_id.to_ascii_lowercase();
    Ok(list_source_attachments(connection, source_item_id)?
        .into_iter()
        .find(|attachment| {
            attachment
                .original_path
                .as_deref()
                .unwrap_or_default()
                .to_ascii_lowercase()
                .contains(&format!("#{attachment_id}.dat"))
                || attachment
                    .stored_path
                    .to_ascii_lowercase()
                    .contains(&format!("{attachment_id}__"))
                || (attachment.record_id == record_id
                    && attachment.file_name.eq_ignore_ascii_case(&attachment_id))
        }))
}

fn ensure_attachment_source_link(
    connection: &Connection,
    attachment_id: i64,
    source_item_id: i64,
) -> AppResult<()> {
    connection.execute(
        "INSERT INTO attachment_links(attachment_id, source_item_id, note_id, created_at)
         SELECT ?1, ?2, NULL, ?3
         WHERE NOT EXISTS(
           SELECT 1 FROM attachment_links
           WHERE attachment_id = ?1 AND source_item_id = ?2 AND note_id IS NULL
         )",
        params![attachment_id, source_item_id, Utc::now().to_rfc3339()],
    )?;
    Ok(())
}

fn legacy_source_assets_without_attachment(
    connection: &Connection,
) -> AppResult<Vec<LegacySourceAsset>> {
    let mut statement = connection.prepare(
        "SELECT r.id, r.source_text
         FROM records r
         WHERE r.is_deleted = 0
           AND (r.source_text LIKE '%\"files\"%' OR r.source_text LIKE '%\"attachments\"%')",
    )?;
    let mut expected = BTreeSet::new();
    for row in statement.query_map([], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
    })? {
        let (record_id, source_text) = row?;
        let Ok(value) = serde_json::from_str::<Value>(&source_text) else {
            continue;
        };
        let mut file_names = BTreeSet::new();
        collect_declared_attachment_file_names(&value, &mut file_names);
        if file_names.is_empty() {
            continue;
        }
        let existing = existing_attachment_file_keys(connection, record_id)?;
        for file_name in file_names {
            if !existing.contains(&normalized_file_key(&file_name)) {
                expected.insert(LegacySourceAsset {
                    record_id,
                    file_name,
                });
            }
        }
    }
    Ok(expected.into_iter().collect())
}

fn collect_declared_attachment_file_names(value: &Value, output: &mut BTreeSet<String>) {
    match value {
        Value::Array(items) => items
            .iter()
            .for_each(|item| collect_declared_attachment_file_names(item, output)),
        Value::Object(object) => {
            for key in ["files", "attachments"] {
                if let Some(Value::Array(items)) = object.get(key) {
                    for item in items {
                        let Some(file) = item.as_object() else {
                            continue;
                        };
                        let name = file
                            .get("file_name")
                            .or_else(|| file.get("fileName"))
                            .and_then(Value::as_str)
                            .map(str::trim)
                            .filter(|name| !name.is_empty());
                        if let Some(name) = name {
                            output.insert(name.to_string());
                        }
                    }
                }
            }
            object
                .values()
                .for_each(|item| collect_declared_attachment_file_names(item, output));
        }
        _ => {}
    }
}

fn existing_attachment_file_keys(
    connection: &Connection,
    record_id: i64,
) -> AppResult<BTreeSet<String>> {
    let mut statement = connection.prepare(
        "SELECT file_name, original_path, stored_path FROM attachments WHERE record_id = ?1",
    )?;
    let mut keys = BTreeSet::new();
    for row in statement.query_map([record_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, String>(2)?,
        ))
    })? {
        let (file_name, original_path, stored_path) = row?;
        for value in [Some(file_name), original_path, Some(stored_path)]
            .into_iter()
            .flatten()
        {
            keys.insert(normalized_file_key(&value));
        }
    }
    Ok(keys)
}

fn normalized_file_key(value: &str) -> String {
    Path::new(value.trim())
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(value.trim())
        .trim()
        .to_lowercase()
}

fn scan_legacy_attachment_directory(root: &Path) -> AppResult<HashMap<String, Vec<PathBuf>>> {
    if !root.is_dir() {
        return Err(AppError::Validation(
            "请选择包含原始图片、视频和文件的文件夹".to_string(),
        ));
    }
    let mut result = HashMap::<String, Vec<PathBuf>>::new();
    let mut folders = VecDeque::from([root.to_path_buf()]);
    let mut scanned_files = 0_usize;
    while let Some(folder) = folders.pop_front() {
        for entry in fs::read_dir(&folder)? {
            let entry = entry?;
            let file_type = entry.file_type()?;
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                folders.push_back(entry.path());
                continue;
            }
            if !file_type.is_file() {
                continue;
            }
            scanned_files += 1;
            if scanned_files > MAX_LEGACY_RECOVERY_SCAN_FILES {
                return Err(AppError::Validation(format!(
                    "所选文件夹超过 {MAX_LEGACY_RECOVERY_SCAN_FILES} 个文件，请选择更精确的历史附件文件夹"
                )));
            }
            let name = entry.file_name().to_string_lossy().into_owned();
            result
                .entry(normalized_file_key(&name))
                .or_default()
                .push(entry.path());
        }
    }
    Ok(result)
}

fn unique_candidate_path<'a>(
    asset: &LegacySourceAsset,
    candidates: &'a HashMap<String, Vec<PathBuf>>,
) -> Option<&'a PathBuf> {
    let paths = candidates.get(&normalized_file_key(&asset.file_name))?;
    (paths.len() == 1).then(|| &paths[0])
}

fn has_unique_candidate(
    asset: &LegacySourceAsset,
    candidates: &HashMap<String, Vec<PathBuf>>,
) -> bool {
    unique_candidate_path(asset, candidates).is_some()
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

/// 文件扩展名是用户可见的兜底；对常见媒体和归档格式还读取文件头，避免扩展名
/// 被改写后把视频、音频或 ZIP 误当作无类型二进制文件。
fn infer_attachment_mime(path: &Path, file_name: &str) -> AppResult<Option<String>> {
    let mut header = [0_u8; 32];
    let mut input = fs::File::open(path)?;
    let read = input.read(&mut header)?;
    let bytes = &header[..read];
    let detected = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if bytes.starts_with(b"\xff\xd8\xff") {
        Some("image/jpeg")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("image/gif")
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WAVE") {
        Some("audio/wav")
    } else if bytes.starts_with(b"fLaC") {
        Some("audio/flac")
    } else if bytes.starts_with(b"OggS") {
        Some("audio/ogg")
    } else if bytes.starts_with(b"ID3") {
        Some("audio/mpeg")
    } else if bytes.get(4..8) == Some(b"ftyp") {
        Some("video/mp4")
    } else if bytes.starts_with(b"\x1aE\xdf\xa3") {
        Some("video/webm")
    } else if bytes.starts_with(b"%PDF-") {
        Some("application/pdf")
    } else if bytes.starts_with(b"PK\x03\x04") || bytes.starts_with(b"PK\x05\x06") {
        Some("application/zip")
    } else if bytes.starts_with(b"7z\xbc\xaf\x27\x1c") {
        Some("application/x-7z-compressed")
    } else if bytes.starts_with(b"Rar!\x1a\x07") {
        Some("application/vnd.rar")
    } else {
        None
    };
    if let Some(mime) = detected {
        return Ok(Some(mime.to_string()));
    }
    let extension = Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let by_extension = match extension.as_str() {
        "webp" => Some("image/webp"),
        "bmp" => Some("image/bmp"),
        "svg" => Some("image/svg+xml"),
        "avif" => Some("image/avif"),
        "heic" | "heif" => Some("image/heic"),
        "mp3" => Some("audio/mpeg"),
        "m4a" => Some("audio/mp4"),
        "aac" => Some("audio/aac"),
        "opus" => Some("audio/opus"),
        "mov" => Some("video/quicktime"),
        "mkv" => Some("video/x-matroska"),
        "avi" => Some("video/x-msvideo"),
        "txt" | "md" | "log" => Some("text/plain"),
        "json" => Some("application/json"),
        "csv" => Some("text/csv"),
        "xml" => Some("application/xml"),
        "yaml" | "yml" => Some("application/yaml"),
        "tar" => Some("application/x-tar"),
        "gz" | "tgz" => Some("application/gzip"),
        "bz2" => Some("application/x-bzip2"),
        "xz" => Some("application/x-xz"),
        _ => None,
    };
    Ok(by_extension.map(str::to_string))
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
    use crate::models::{CreateRecordInput, RecordSourceInput};
    use std::io::Write;
    use zip::write::SimpleFileOptions;
    use zip::{CompressionMethod, ZipWriter};

    fn write_chatgpt_video_export(path: &Path, attachment_id: &str, conversation_id: &str) {
        let file = fs::File::create(path).expect("video export");
        let mut zip = ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        let conversation = serde_json::json!({
            "id": conversation_id,
            "mapping": {
                "video-node": {
                    "message": {
                        "id": "video-message",
                        "metadata": {
                            "attachments": [{
                                "id": attachment_id,
                                "name": "原对话视频.mp4",
                                "mime_type": "video/mp4",
                                "size": 24
                            }]
                        }
                    }
                }
            }
        });
        zip.start_file("conversations-000.json", options)
            .expect("conversation entry");
        zip.write_all(
            serde_json::to_string(&serde_json::json!([conversation]))
                .expect("conversation json")
                .as_bytes(),
        )
        .expect("conversation bytes");
        zip.start_file("conversation_asset_file_names.json", options)
            .expect("name map");
        zip.write_all(
            serde_json::to_string(&serde_json::json!({
                format!("{attachment_id}.dat"): "原对话视频.mp4"
            }))
            .expect("name map json")
            .as_bytes(),
        )
        .expect("name map bytes");
        zip.start_file(format!("{attachment_id}.dat"), options)
            .expect("video asset");
        zip.write_all(b"\0\0\0\x18ftypmp42video-fixture")
            .expect("video bytes");
        zip.finish().expect("finish video export");
    }

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
    fn text_attachment_preview_preserves_utf8_and_decodes_windows_gbk() {
        assert_eq!(decode_attachment_text("# 中文标题\n正文".as_bytes()), "# 中文标题\n正文");
        let (gbk, _, _) = GBK.encode("# 中文标题\n正文");
        assert_eq!(decode_attachment_text(&gbk), "# 中文标题\n正文");
    }

    #[test]
    fn attachment_search_filters_controlled_file_categories_without_scanning_the_client() {
        let directory = tempfile::tempdir().expect("temp dir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        let record = database::create_record(
            &mut connection,
            &CreateRecordInput {
                title: "媒体搜索归属笔记".to_string(),
                original_at: None,
                summary: "附件搜索必须返回原笔记".to_string(),
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
        let image = directory.path().join("市场截图.png");
        let audio = directory.path().join("访谈.wav");
        fs::write(&image, b"\x89PNG\r\n\x1a\nfixture").expect("image");
        fs::write(&audio, b"RIFFxxxxWAVEfmt ").expect("audio");
        add_attachment(&connection, &paths, record.id, &image).expect("image attachment");
        add_attachment(&connection, &paths, record.id, &audio).expect("audio attachment");

        let images = search_attachments(
            &connection,
            Some("市场".to_string()),
            Some("image".to_string()),
            None,
        )
        .expect("search images");
        assert_eq!(images.len(), 1);
        assert_eq!(images[0].record_title, "媒体搜索归属笔记");
        assert_eq!(images[0].attachment.file_name, "市场截图.png");
        assert!(search_attachments(
            &connection,
            Some("市场".to_string()),
            Some("audio".to_string()),
            None,
        )
        .expect("search audio")
        .is_empty());
    }

    #[test]
    fn source_attachment_catalog_lists_every_declared_type_before_materialization() {
        let directory = tempfile::tempdir().expect("temp dir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        database::create_record(
            &mut connection,
            &CreateRecordInput {
                title: "完整附件目录".to_string(),
                original_at: Some("2026-07-23T08:00:00Z".to_string()),
                summary: String::new(),
                status: Default::default(),
                tags: Vec::new(),
                current_judgment: String::new(),
                confirmed_facts: Vec::new(),
                key_evidence: Vec::new(),
                open_questions: Vec::new(),
                next_actions: Vec::new(),
                notes: String::new(),
                source_text: serde_json::json!({
                    "message": {
                        "metadata": {
                            "attachments": [
                                {"id": "image-one", "name": "截图.png", "mime_type": "image/png", "size": 11},
                                {"id": "video-one", "name": "演示.mp4", "mime_type": "video/mp4", "size": 12},
                                {"id": "pdf-one", "name": "报告.pdf", "mime_type": "application/pdf", "size": 13},
                                {"id": "text-one", "name": "说明.txt", "mime_type": "text/plain", "size": 14}
                            ]
                        }
                    }
                }).to_string(),
                sources: Vec::new(),
                is_favorite: false,
            },
        )
        .expect("record");

        let all =
            search_source_attachment_catalog(&connection, None, Some("all".to_string()), None)
                .expect("catalog");
        assert_eq!(all.len(), 4);
        assert!(all.iter().all(|hit| hit.attachment.is_none()));
        assert!(all.iter().all(|hit| hit.availability == "recoverable"));
        assert_eq!(
            search_source_attachment_catalog(&connection, None, Some("image".to_string()), None,)
                .expect("images")
                .len(),
            1
        );
        assert_eq!(
            search_source_attachment_catalog(&connection, None, Some("video".to_string()), None,)
                .expect("videos")
                .len(),
            1
        );
        assert_eq!(
            search_source_attachment_catalog(&connection, None, Some("file".to_string()), None,)
                .expect("files")
                .len(),
            2
        );
    }

    #[test]
    fn legacy_folder_recovery_copies_only_uniquely_named_declared_assets() {
        let directory = tempfile::tempdir().expect("temp dir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        let record = database::create_record(
            &mut connection,
            &CreateRecordInput {
                title: "历史图片恢复".to_string(),
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
                source_text: r#"{"chat_messages":[{"files":[{"file_uuid":"image-1","file_name":"历史截图.png"}]}]}"#.to_string(),
                sources: Vec::new(),
                is_favorite: false,
            },
        )
        .expect("record");
        let source_directory = directory.path().join("legacy-assets");
        fs::create_dir_all(&source_directory).expect("source directory");
        let source = source_directory.join("历史截图.png");
        fs::write(&source, b"\x89PNG\r\n\x1a\nfixture").expect("image");

        let preview = inspect_legacy_attachment_recovery(
            &connection,
            Some(source_directory.to_string_lossy().as_ref()),
        )
        .expect("preview");
        assert_eq!(preview.record_count, 1);
        assert_eq!(preview.recoverable_attachment_count, 1);
        assert_eq!(preview.unresolved_attachment_count, 0);

        let result = recover_legacy_attachments(
            &connection,
            &paths,
            Some(source_directory.to_string_lossy().as_ref()),
        )
        .expect("recover");
        assert_eq!(result.recovered_attachment_count, 1);
        assert_eq!(result.unresolved_attachment_count, 0);
        assert_eq!(result.failed_attachment_count, 0);
        let attachments = list_attachments(&connection, record.id).expect("attachments");
        assert_eq!(attachments.len(), 1);
        assert_eq!(attachments[0].file_name, "历史截图.png");
        assert_eq!(attachments[0].mime_type.as_deref(), Some("image/png"));
        assert!(Path::new(&attachments[0].stored_path).is_file());

        let repeat = recover_legacy_attachments(
            &connection,
            &paths,
            Some(source_directory.to_string_lossy().as_ref()),
        )
        .expect("repeat");
        assert_eq!(repeat.recovered_attachment_count, 0);
        assert_eq!(
            list_attachments(&connection, record.id)
                .expect("deduplicated")
                .len(),
            1
        );
    }

    #[test]
    fn source_attachments_follow_the_source_item_instead_of_ui_legacy_lookup() {
        let directory = tempfile::tempdir().expect("temp dir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        let record = database::create_record(
            &mut connection,
            &CreateRecordInput {
                title: "来源附件测试".to_string(),
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
                source_text: "包含截图".to_string(),
                sources: Vec::new(),
                is_favorite: false,
            },
        )
        .expect("record");
        let source_item_id = connection
            .query_row(
                "SELECT id FROM source_items WHERE legacy_record_id = ?1",
                [record.id],
                |row| row.get::<_, i64>(0),
            )
            .expect("source item");
        let image = directory.path().join("截图.jpg");
        fs::write(&image, b"jpeg bytes").expect("source image");
        let attachment =
            add_attachment(&connection, &paths, record.id, &image).expect("attachment");

        let source_attachments =
            list_source_attachments(&connection, source_item_id).expect("source attachments");
        assert_eq!(source_attachments, vec![attachment]);
    }

    #[test]
    fn chatgpt_attachment_is_restored_once_and_batch_hydration_is_fault_isolated() {
        let directory = tempfile::tempdir().expect("temp dir");
        let paths = AppPaths::from_root(directory.path().join("app")).expect("paths");
        let mut connection = database::open_database(&paths.database).expect("database");
        let attachment_id = "file_000000003d3081f5812c4bd6b7b107a8";
        let conversation_id = "conversation-video";
        let conversation = serde_json::json!({
            "id": conversation_id,
            "mapping": {
                "video-node": {
                    "message": {
                        "metadata": {
                            "attachments": [{
                                "id": attachment_id,
                                "name": "原对话视频.mp4",
                                "mime_type": "video/mp4",
                                "size": 24
                            }]
                        }
                    }
                }
            }
        });
        let record = database::create_record(
            &mut connection,
            &CreateRecordInput {
                title: "历史视频恢复".to_string(),
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
                source_text: serde_json::to_string(&conversation).expect("source json"),
                sources: vec![RecordSourceInput {
                    source_type: "file".to_string(),
                    title: "ChatGPT 导入".to_string(),
                    url: None,
                    local_path: None,
                    external_id: Some(conversation_id.to_string()),
                }],
                is_favorite: false,
            },
        )
        .expect("record");
        let source_item_id = connection
            .query_row(
                "SELECT id FROM source_items WHERE legacy_record_id = ?1",
                [record.id],
                |row| row.get::<_, i64>(0),
            )
            .expect("source item");
        let export = directory.path().join("chatgpt-export.zip");
        write_chatgpt_video_export(&export, attachment_id, conversation_id);
        connection
            .execute(
                "INSERT INTO import_jobs(
                   id, source_file_name, stored_file_path, sha256, mapping_json, status,
                   success_count, skip_count, failure_count, error_log_json, created_at, completed_at
                 ) VALUES ('video-job', 'chatgpt-export.zip', ?1, 'fixture', '{}', 'completed',
                           1, 0, 0, '[]', ?2, ?2)",
                params![export.to_string_lossy(), Utc::now().to_rfc3339()],
            )
            .expect("import job");
        connection
            .execute(
                "INSERT INTO source_import_origins(
                   source_item_id, import_job_id, source_file_name, stored_file_path,
                   file_sha256, item_external_id, created_at
                 ) VALUES (?1, 'video-job', 'chatgpt-export.zip', ?2, 'fixture', ?3, ?4)",
                params![
                    source_item_id,
                    export.to_string_lossy(),
                    conversation_id,
                    Utc::now().to_rfc3339(),
                ],
            )
            .expect("source origin");

        let restored =
            recover_source_attachment(&mut connection, &paths, source_item_id, attachment_id)
                .expect("restore clicked video");
        assert_eq!(restored.file_name, "原对话视频.mp4");
        assert_eq!(restored.mime_type.as_deref(), Some("video/mp4"));
        assert!(Path::new(&restored.stored_path).is_file());
        assert!(restored
            .original_path
            .as_deref()
            .is_some_and(|path| path.ends_with(&format!("#{attachment_id}.dat"))));
        assert_eq!(
            list_source_attachments(&connection, source_item_id)
                .expect("linked source attachments")
                .len(),
            1
        );

        let repeated = recover_source_attachment(
            &mut connection,
            &paths,
            source_item_id,
            &format!("{attachment_id}.DAT"),
        )
        .expect("idempotent repeat");
        assert_eq!(repeated.id, restored.id);
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM attachments", [], |row| row
                    .get::<_, i64>(0))
                .expect("attachment count"),
            1
        );

        let hydrated = hydrate_source_attachments(
            &mut connection,
            &paths,
            source_item_id,
            vec![attachment_id.to_string(), "missing-asset".to_string()],
        );
        assert_eq!(hydrated.attachments.len(), 1);
        assert_eq!(hydrated.attachments[0].id, restored.id);
        assert_eq!(hydrated.failures.len(), 1);
        assert_eq!(hydrated.failures[0].attachment_id, "missing-asset");
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
        let reveal_error = reveal_attachment(&connection, &paths, attachment_id)
            .expect_err("outside path must not reveal");
        assert!(reveal_error.to_string().contains("受控目录"));
        let remove_error = remove_attachment(&mut connection, &paths, attachment_id)
            .expect_err("outside path must not delete");
        assert!(remove_error.to_string().contains("受控目录"));
        assert!(outside.is_file());
    }
}
