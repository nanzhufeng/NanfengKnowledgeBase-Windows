use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use rusqlite::Connection;
use sha2::{Digest, Sha256};

use crate::error::{AppError, AppResult};
use crate::models::{DataOptimizationPreview, DataOptimizationResult};
use crate::paths::AppPaths;

const INCOMPLETE_BACKUP_GRACE: Duration = Duration::from_secs(24 * 60 * 60);
// 小于这个阈值的空闲页不值得为其重写整库。WAL 合并和无引用附件清理不会受此限制。
const MINIMUM_VACUUM_RECLAIM_BYTES: u64 = 32 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CandidateKind {
    DuplicateBackup,
    IncompleteBackup,
    UnreferencedAttachment,
}

#[derive(Debug, Clone)]
struct CleanupCandidate {
    path: PathBuf,
    bytes: u64,
    kind: CandidateKind,
    identity: String,
}

#[derive(Debug, Clone)]
pub struct DataOptimizationInspection {
    pub preview: DataOptimizationPreview,
    pub candidate_manifest: String,
}

/// 扫描预览和候选清单指纹必须同源生成。令牌由命令层保存此指纹，避免前端仅靠
/// `confirmed: true` 伪造一次清理确认。
pub fn inspect_for_confirmation(
    connection: &Connection,
    paths: &AppPaths,
) -> AppResult<DataOptimizationInspection> {
    inspect_at(connection, paths, SystemTime::now())
}

fn inspect_at(
    connection: &Connection,
    paths: &AppPaths,
    now: SystemTime,
) -> AppResult<DataOptimizationInspection> {
    let candidates = scan_candidates(connection, paths, now, None)?;
    let duplicate_backup_count = candidates
        .iter()
        .filter(|item| item.kind == CandidateKind::DuplicateBackup)
        .count() as u64;
    let duplicate_backup_bytes = candidates
        .iter()
        .filter(|item| item.kind == CandidateKind::DuplicateBackup)
        .map(|item| item.bytes)
        .sum();
    let incomplete_backup_count = candidates
        .iter()
        .filter(|item| item.kind == CandidateKind::IncompleteBackup)
        .count() as u64;
    let incomplete_backup_bytes = candidates
        .iter()
        .filter(|item| item.kind == CandidateKind::IncompleteBackup)
        .map(|item| item.bytes)
        .sum();
    let database_reclaimable_bytes = database_reclaimable_bytes(connection)?;
    let will_vacuum = database_reclaimable_bytes >= MINIMUM_VACUUM_RECLAIM_BYTES;
    let database_wal_bytes = file_bytes(&wal_path(paths))?;
    let unreferenced_attachment_count = candidates
        .iter()
        .filter(|item| item.kind == CandidateKind::UnreferencedAttachment)
        .count() as u64;
    let unreferenced_attachment_bytes = candidates
        .iter()
        .filter(|item| item.kind == CandidateKind::UnreferencedAttachment)
        .map(|item| item.bytes)
        .sum();
    let referenced_attachment_bytes = referenced_attachment_bytes(connection, paths)?;
    let protected_backup_bytes = directory_bytes(&paths.backups)?
        .saturating_sub(duplicate_backup_bytes)
        .saturating_sub(incomplete_backup_bytes);
    let protected_import_bytes = directory_bytes(&paths.imports_raw)?;
    let protected_business_record_count = connection
        .query_row("SELECT COUNT(*) FROM records", [], |row| row.get(0))
        .unwrap_or(0);

    Ok(DataOptimizationInspection {
        candidate_manifest: candidate_manifest(&candidates),
        preview: DataOptimizationPreview {
            confirmation_token: None,
            database_reclaimable_bytes,
            database_wal_bytes,
            will_vacuum,
            duplicate_backup_count,
            duplicate_backup_bytes,
            incomplete_backup_count,
            incomplete_backup_bytes,
            unreferenced_attachment_count,
            unreferenced_attachment_bytes,
            referenced_attachment_bytes,
            protected_backup_bytes,
            protected_import_bytes,
            estimated_reclaimable_bytes: database_wal_bytes
                .saturating_add(duplicate_backup_bytes)
                .saturating_add(incomplete_backup_bytes)
                .saturating_add(unreferenced_attachment_bytes)
                .saturating_add(if will_vacuum {
                    database_reclaimable_bytes
                } else {
                    0
                }),
            protected_business_record_count,
        },
    })
}

pub fn execute(
    connection: &Connection,
    paths: &AppPaths,
    expected_candidate_manifest: &str,
) -> AppResult<DataOptimizationResult> {
    if expected_candidate_manifest.trim().is_empty() {
        return Err(AppError::Validation(
            "数据优化必须先完成一次有效扫描并明确确认".to_string(),
        ));
    }

    let database_bytes_before = file_bytes(&paths.database)?;
    let database_wal_bytes_before = file_bytes(&wal_path(paths))?;
    // WAL checkpoint 只是把已提交页面合并回数据库，并非删除业务数据；不能用直接删 .wal
    // 冒充清理。若仍有读者占用，先停止而不是只释放一部分候选文件。
    let (busy, log_frames, checkpointed_frames): (i64, i64, i64) =
        connection.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?;
    if busy != 0 || log_frames != checkpointed_frames {
        return Err(AppError::Conflict(
            "数据库仍被其他读取任务占用，暂未清理；请关闭其它南枫知识库窗口后重试".to_string(),
        ));
    }
    let integrity_before: String =
        connection.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if integrity_before != "ok" {
        return Err(AppError::Conflict(format!(
            "优化前数据库完整性检查未通过：{integrity_before}；未清理任何文件"
        )));
    }
    let candidates = scan_candidates(connection, paths, SystemTime::now(), None)?;
    if candidate_manifest(&candidates) != expected_candidate_manifest {
        return Err(AppError::Conflict(
            "扫描结果已变化，未执行清理；请重新扫描并确认".to_string(),
        ));
    }
    let mut removed_duplicate_backup_count = 0;
    let mut removed_incomplete_backup_count = 0;
    let mut removed_unreferenced_attachment_count = 0;

    let performed_vacuum = database_reclaimable_bytes(connection)? >= MINIMUM_VACUUM_RECLAIM_BYTES;
    connection.execute_batch("PRAGMA optimize;")?;
    if performed_vacuum {
        connection.execute_batch("VACUUM;")?;
    }

    for candidate in &candidates {
        remove_verified_candidate(candidate, paths)?;
        match candidate.kind {
            CandidateKind::DuplicateBackup => removed_duplicate_backup_count += 1,
            CandidateKind::IncompleteBackup => removed_incomplete_backup_count += 1,
            CandidateKind::UnreferencedAttachment => removed_unreferenced_attachment_count += 1,
        }
    }
    let attachment_root = paths.attachments.canonicalize()?;
    remove_empty_directories(&paths.attachments, &attachment_root, true)?;
    let integrity_check: String =
        connection.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if integrity_check != "ok" {
        return Err(AppError::Conflict(format!(
            "优化后数据库完整性检查未通过：{integrity_check}；未继续修改其它候选文件"
        )));
    }
    let database_bytes_after = file_bytes(&paths.database)?;
    let database_wal_bytes_after = file_bytes(&wal_path(paths))?;
    let removed_bytes: u64 = candidates.iter().map(|item| item.bytes).sum();

    Ok(DataOptimizationResult {
        safety_backup: None,
        removed_duplicate_backup_count,
        removed_incomplete_backup_count,
        removed_unreferenced_attachment_count,
        reclaimed_bytes: removed_bytes
            .saturating_add(database_bytes_before.saturating_sub(database_bytes_after))
            .saturating_add(database_wal_bytes_before.saturating_sub(database_wal_bytes_after)),
        database_bytes_before,
        database_bytes_after,
        database_wal_bytes_before,
        database_wal_bytes_after,
        performed_vacuum,
        integrity_check,
    })
}

fn candidate_manifest(candidates: &[CleanupCandidate]) -> String {
    let mut entries = candidates
        .iter()
        .map(|candidate| {
            let kind = match candidate.kind {
                CandidateKind::DuplicateBackup => "duplicate-backup",
                CandidateKind::IncompleteBackup => "incomplete-backup",
                CandidateKind::UnreferencedAttachment => "unreferenced-attachment",
            };
            format!("{kind}\u{1f}{}", candidate.identity)
        })
        .collect::<Vec<_>>();
    entries.sort();
    let mut hasher = Sha256::new();
    for entry in entries {
        hasher.update((entry.len() as u64).to_le_bytes());
        hasher.update(entry.as_bytes());
    }
    hex::encode(hasher.finalize())
}

fn database_reclaimable_bytes(connection: &Connection) -> AppResult<u64> {
    let page_size: i64 = connection.query_row("PRAGMA page_size", [], |row| row.get(0))?;
    let free_pages: i64 = connection.query_row("PRAGMA freelist_count", [], |row| row.get(0))?;
    Ok((page_size.max(0) as u64).saturating_mul(free_pages.max(0) as u64))
}

fn scan_candidates(
    connection: &Connection,
    paths: &AppPaths,
    now: SystemTime,
    protected_path: Option<&Path>,
) -> AppResult<Vec<CleanupCandidate>> {
    let mut candidates = Vec::new();
    let mut db_groups: BTreeMap<String, Vec<(PathBuf, SystemTime, u64)>> = BTreeMap::new();
    let mut portable_groups: BTreeMap<String, Vec<(PathBuf, SystemTime, u64)>> = BTreeMap::new();

    for entry in fs::read_dir(&paths.backups)? {
        let entry = entry?;
        let path = entry.path();
        let file_type = entry.file_type()?;
        if is_unsafe_reparse_point(&path)?
            || protected_path.is_some_and(|protected| protected == path)
        {
            continue;
        }
        let modified = entry
            .metadata()?
            .modified()
            .unwrap_or(SystemTime::UNIX_EPOCH);
        if file_type.is_file()
            && path
                .extension()
                .is_some_and(|ext| ext.eq_ignore_ascii_case("db"))
        {
            db_groups.entry(sha256_file(&path)?).or_default().push((
                path.clone(),
                modified,
                entry.metadata()?.len(),
            ));
            continue;
        }
        if !file_type.is_dir() {
            continue;
        }
        let building_marker = path.join(".building");
        if building_marker.is_file() {
            let marker_modified = building_marker.metadata()?.modified().unwrap_or(modified);
            if now.duration_since(marker_modified).unwrap_or_default() >= INCOMPLETE_BACKUP_GRACE {
                candidates.push(CleanupCandidate {
                    bytes: directory_bytes(&path)?,
                    path,
                    kind: CandidateKind::IncompleteBackup,
                    identity: String::new(),
                });
            }
            continue;
        }
        let manifest_path = path.join("manifest.json");
        if !manifest_path.is_file() {
            continue;
        }
        let manifest: serde_json::Value = serde_json::from_slice(&fs::read(&manifest_path)?)?;
        if manifest.get("files").is_none() {
            continue;
        }
        // 不信任清单里声明的哈希；对目录里的实际文件重新计算内容指纹。
        let fingerprint = portable_content_fingerprint(&path)?;
        portable_groups.entry(fingerprint).or_default().push((
            path.clone(),
            modified,
            directory_bytes(&path)?,
        ));
    }

    collect_duplicate_candidates(db_groups, &mut candidates);
    collect_duplicate_candidates(portable_groups, &mut candidates);
    let referenced_paths = managed_attachment_paths(connection, paths)?;
    collect_unreferenced_attachment_candidates(
        &paths.attachments,
        &referenced_paths,
        &mut candidates,
    )?;
    for candidate in &mut candidates {
        candidate.identity = candidate_identity(candidate, paths)?;
    }
    Ok(candidates)
}

fn collect_duplicate_candidates(
    groups: BTreeMap<String, Vec<(PathBuf, SystemTime, u64)>>,
    candidates: &mut Vec<CleanupCandidate>,
) {
    for mut group in groups.into_values() {
        if group.len() < 2 {
            continue;
        }
        group.sort_by_key(|(_, modified, _)| *modified);
        group.pop();
        candidates.extend(group.into_iter().map(|(path, _, bytes)| CleanupCandidate {
            path,
            bytes,
            kind: CandidateKind::DuplicateBackup,
            identity: String::new(),
        }));
    }
}

/// `attachments.stored_path` 是运行期读取受控附件的唯一文件所有者；导入任务的
/// mapping_json 只额外保护仍登记的 manifest。其它物理文件既没有数据库引用，
/// 也不会被时间线、预览或恢复入口直接读取。
fn managed_attachment_paths(
    connection: &Connection,
    paths: &AppPaths,
) -> AppResult<BTreeSet<PathBuf>> {
    let root = paths.attachments.canonicalize()?;
    let mut referenced = BTreeSet::new();
    if table_exists(connection, "attachments")? {
        let mut statement = connection.prepare("SELECT stored_path FROM attachments")?;
        for row in statement.query_map([], |row| row.get::<_, String>(0))? {
            add_managed_path(&root, Path::new(&row?), &mut referenced);
        }
    }
    if table_exists(connection, "import_jobs")? {
        let mut statement = connection.prepare("SELECT mapping_json FROM import_jobs")?;
        for row in statement.query_map([], |row| row.get::<_, String>(0))? {
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&row?) {
                collect_json_managed_paths(&root, &value, &mut referenced);
            }
        }
    }
    Ok(referenced)
}

fn table_exists(connection: &Connection, table: &str) -> AppResult<bool> {
    Ok(connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
        [table],
        |row| row.get::<_, i64>(0),
    )? != 0)
}

fn add_managed_path(root: &Path, candidate: &Path, referenced: &mut BTreeSet<PathBuf>) {
    let Ok(canonical) = candidate.canonicalize() else {
        return;
    };
    if canonical.is_file() && canonical.starts_with(root) {
        referenced.insert(canonical);
    }
}

fn collect_json_managed_paths(
    root: &Path,
    value: &serde_json::Value,
    referenced: &mut BTreeSet<PathBuf>,
) {
    match value {
        serde_json::Value::String(text) => add_managed_path(root, Path::new(text), referenced),
        serde_json::Value::Array(values) => {
            for value in values {
                collect_json_managed_paths(root, value, referenced);
            }
        }
        serde_json::Value::Object(values) => {
            for value in values.values() {
                collect_json_managed_paths(root, value, referenced);
            }
        }
        _ => {}
    }
}

fn referenced_attachment_bytes(connection: &Connection, paths: &AppPaths) -> AppResult<u64> {
    Ok(managed_attachment_paths(connection, paths)?
        .into_iter()
        .map(|path| file_bytes(&path).unwrap_or(0))
        .sum())
}

fn collect_unreferenced_attachment_candidates(
    directory: &Path,
    referenced_paths: &BTreeSet<PathBuf>,
    candidates: &mut Vec<CleanupCandidate>,
) -> AppResult<()> {
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let path = entry.path();
        if is_unsafe_reparse_point(&path)? {
            continue;
        }
        if file_type.is_dir() {
            collect_unreferenced_attachment_candidates(&path, referenced_paths, candidates)?;
            continue;
        }
        let canonical = path.canonicalize()?;
        if !referenced_paths.contains(&canonical) {
            candidates.push(CleanupCandidate {
                bytes: entry.metadata()?.len(),
                path,
                kind: CandidateKind::UnreferencedAttachment,
                identity: String::new(),
            });
        }
    }
    Ok(())
}

fn remove_empty_directories(directory: &Path, root: &Path, is_root: bool) -> AppResult<bool> {
    let mut is_empty = true;
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let path = entry.path();
        if is_unsafe_reparse_point(&path)? {
            is_empty = false;
            continue;
        }
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            if !remove_empty_directories(&path, root, false)? {
                is_empty = false;
            }
        } else {
            is_empty = false;
        }
    }
    if is_empty && !is_root {
        ensure_path_within_root(directory, root)?;
        fs::remove_dir(directory)?;
    }
    Ok(is_empty)
}

fn candidate_identity(candidate: &CleanupCandidate, paths: &AppPaths) -> AppResult<String> {
    let root = candidate_root(candidate, paths)?.canonicalize()?;
    let metadata = fs::symlink_metadata(&candidate.path)?;
    if is_unsafe_reparse_point(&candidate.path)? {
        return Err(AppError::Conflict(
            "发现重解析点，已停止清理以保护受控目录之外的文件".to_string(),
        ));
    }
    let canonical = ensure_path_within_root(&candidate.path, &root)?;
    let is_directory = metadata.is_dir();
    if !is_directory && metadata.len() != candidate.bytes {
        return Err(AppError::Conflict(
            "清理候选文件大小已变化，请重新扫描并确认".to_string(),
        ));
    }
    // 仅比较时间和长度仍可能漏掉“同长度且时间被保留”的替换。候选清单是删除
    // 的授权依据，因此对本轮实际候选再计算内容指纹；备份目录包含 manifest / .building
    // 等控制文件，不能复用“排除这些文件”的重复备份指纹。
    let content_fingerprint = if is_directory {
        directory_content_fingerprint(&candidate.path, &root)?
    } else {
        sha256_file(&candidate.path)?
    };
    let modified = metadata
        .modified()
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    Ok(format!(
        "{}\u{1f}{}\u{1f}{}\u{1f}{modified}\u{1f}{is_directory}\u{1f}{content_fingerprint}",
        canonical.to_string_lossy(),
        candidate.bytes,
        candidate_kind_label(candidate.kind),
    ))
}

fn candidate_kind_label(kind: CandidateKind) -> &'static str {
    match kind {
        CandidateKind::DuplicateBackup => "duplicate-backup",
        CandidateKind::IncompleteBackup => "incomplete-backup",
        CandidateKind::UnreferencedAttachment => "unreferenced-attachment",
    }
}

fn candidate_root<'a>(candidate: &CleanupCandidate, paths: &'a AppPaths) -> AppResult<&'a Path> {
    match candidate.kind {
        CandidateKind::DuplicateBackup | CandidateKind::IncompleteBackup => Ok(&paths.backups),
        CandidateKind::UnreferencedAttachment => Ok(&paths.attachments),
    }
}

fn ensure_path_within_root(path: &Path, root: &Path) -> AppResult<PathBuf> {
    let canonical = path.canonicalize()?;
    if !canonical.starts_with(root) || canonical == root {
        return Err(AppError::Conflict(
            "清理候选路径超出受控目录，已停止操作".to_string(),
        ));
    }
    Ok(canonical)
}

fn is_unsafe_reparse_point(path: &Path) -> AppResult<bool> {
    let metadata = fs::symlink_metadata(path)?;
    if metadata.file_type().is_symlink() {
        return Ok(true);
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
        return Ok(metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0);
    }
    #[cfg(not(target_os = "windows"))]
    Ok(false)
}

fn remove_verified_candidate(candidate: &CleanupCandidate, paths: &AppPaths) -> AppResult<()> {
    if candidate_identity(candidate, paths)? != candidate.identity {
        return Err(AppError::Conflict(
            "清理候选文件已变化，未继续删除；请重新扫描并确认".to_string(),
        ));
    }
    let root = candidate_root(candidate, paths)?.canonicalize()?;
    let metadata = fs::symlink_metadata(&candidate.path)?;
    if metadata.is_dir() {
        // 先完整预检，再开始逐层删除。这样扫描结束后若目录中已混入 Junction /
        // 符号链接，不会先删除同目录前面的正常文件而留下半删状态。
        ensure_controlled_directory_tree(&candidate.path, &root)?;
        remove_controlled_directory(&candidate.path, &root)
    } else {
        ensure_path_within_root(&candidate.path, &root)?;
        fs::remove_file(&candidate.path)?;
        Ok(())
    }
}

fn ensure_controlled_directory_tree(directory: &Path, root: &Path) -> AppResult<()> {
    ensure_path_within_root(directory, root)?;
    if is_unsafe_reparse_point(directory)? {
        return Err(AppError::Conflict(
            "发现重解析点，已停止删除备份目录".to_string(),
        ));
    }
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let path = entry.path();
        if is_unsafe_reparse_point(&path)? {
            return Err(AppError::Conflict(
                "备份目录包含重解析点，已停止删除以保护外部文件".to_string(),
            ));
        }
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            ensure_controlled_directory_tree(&path, root)?;
        } else if file_type.is_file() {
            ensure_path_within_root(&path, root)?;
        } else {
            return Err(AppError::Conflict(
                "备份目录包含非常规文件，已停止删除以保护数据".to_string(),
            ));
        }
    }
    Ok(())
}

fn remove_controlled_directory(directory: &Path, root: &Path) -> AppResult<()> {
    ensure_path_within_root(directory, root)?;
    if is_unsafe_reparse_point(directory)? {
        return Err(AppError::Conflict(
            "发现重解析点，已停止删除备份目录".to_string(),
        ));
    }
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let path = entry.path();
        if is_unsafe_reparse_point(&path)? {
            return Err(AppError::Conflict(
                "备份目录包含重解析点，已停止删除以保护外部文件".to_string(),
            ));
        }
        if entry.file_type()?.is_dir() {
            remove_controlled_directory(&path, root)?;
        } else {
            ensure_path_within_root(&path, root)?;
            fs::remove_file(path)?;
        }
    }
    fs::remove_dir(directory)?;
    Ok(())
}

fn wal_path(paths: &AppPaths) -> PathBuf {
    paths.database.with_extension("db-wal")
}

fn sha256_file(path: &Path) -> AppResult<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 256 * 1024];
    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn portable_content_fingerprint(root: &Path) -> AppResult<String> {
    let mut files = Vec::new();
    collect_portable_files(root, root, &mut files)?;
    files.sort();
    let mut hasher = Sha256::new();
    for relative_path in files {
        let relative_text = relative_path.to_string_lossy();
        hasher.update((relative_text.len() as u64).to_le_bytes());
        hasher.update(relative_text.as_bytes());
        let absolute_path = root.join(&relative_path);
        let mut file = fs::File::open(&absolute_path)?;
        let mut buffer = [0_u8; 256 * 1024];
        loop {
            let count = file.read(&mut buffer)?;
            if count == 0 {
                break;
            }
            hasher.update((count as u64).to_le_bytes());
            hasher.update(&buffer[..count]);
        }
    }
    Ok(hex::encode(hasher.finalize()))
}

/// 删除候选的目录指纹必须涵盖所有普通文件，包括 `manifest.json` 与 `.building`，
/// 并且拒绝任何重解析点或非常规文件，避免将重复备份扫描中的宽松规则误用于删除。
fn directory_content_fingerprint(directory: &Path, root: &Path) -> AppResult<String> {
    ensure_controlled_directory_tree(directory, root)?;
    let mut files = Vec::new();
    collect_controlled_directory_files(directory, directory, root, &mut files)?;
    files.sort();
    let mut hasher = Sha256::new();
    for relative_path in files {
        let relative_text = relative_path.to_string_lossy();
        hasher.update((relative_text.len() as u64).to_le_bytes());
        hasher.update(relative_text.as_bytes());
        let absolute_path = directory.join(&relative_path);
        let digest = sha256_file(&absolute_path)?;
        hasher.update(digest.as_bytes());
    }
    Ok(hex::encode(hasher.finalize()))
}

fn collect_controlled_directory_files(
    directory: &Path,
    fingerprint_root: &Path,
    controlled_root: &Path,
    files: &mut Vec<PathBuf>,
) -> AppResult<()> {
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let path = entry.path();
        if is_unsafe_reparse_point(&path)? {
            return Err(AppError::Conflict(
                "备份目录包含重解析点，已停止清理以保护外部文件".to_string(),
            ));
        }
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            collect_controlled_directory_files(&path, fingerprint_root, controlled_root, files)?;
        } else if file_type.is_file() {
            ensure_path_within_root(&path, controlled_root)?;
            let relative_path = path.strip_prefix(fingerprint_root).map_err(|_| {
                AppError::Conflict("备份目录包含越界文件路径，已停止清理".to_string())
            })?;
            files.push(relative_path.to_path_buf());
        } else {
            return Err(AppError::Conflict(
                "备份目录包含非常规文件，已停止清理以保护数据".to_string(),
            ));
        }
    }
    Ok(())
}

fn collect_portable_files(
    root: &Path,
    directory: &Path,
    files: &mut Vec<PathBuf>,
) -> AppResult<()> {
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let path = entry.path();
        if is_unsafe_reparse_point(&path)? {
            continue;
        }
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            collect_portable_files(root, &path, files)?;
            continue;
        }
        let relative_path = path
            .strip_prefix(root)
            .map_err(|_| AppError::Validation("完整备份包含越界文件路径".to_string()))?;
        if matches!(
            relative_path.to_string_lossy().as_ref(),
            "manifest.json" | ".building"
        ) {
            continue;
        }
        files.push(relative_path.to_path_buf());
    }
    Ok(())
}

fn file_bytes(path: &Path) -> AppResult<u64> {
    Ok(path.metadata().map(|metadata| metadata.len()).unwrap_or(0))
}

fn directory_bytes(path: &Path) -> AppResult<u64> {
    let mut total = 0_u64;
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let entry_path = entry.path();
        if is_unsafe_reparse_point(&entry_path)? {
            continue;
        }
        let file_type = entry.file_type()?;
        total = total.saturating_add(if file_type.is_dir() {
            directory_bytes(&entry_path)?
        } else {
            entry.metadata()?.len()
        });
    }
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn preview_only_marks_exact_duplicate_backups() {
        let temp = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(temp.path()).expect("paths");
        let connection = Connection::open(&paths.database).expect("database");
        connection
            .execute_batch("CREATE TABLE records (id INTEGER PRIMARY KEY); INSERT INTO records DEFAULT VALUES;")
            .expect("schema");
        fs::write(paths.backups.join("old.db"), b"same").expect("old");
        std::thread::sleep(Duration::from_millis(5));
        fs::write(paths.backups.join("new.db"), b"same").expect("new");
        fs::write(paths.backups.join("unique.db"), b"unique").expect("unique");

        let preview = inspect_for_confirmation(&connection, &paths)
            .expect("preview")
            .preview;
        assert_eq!(preview.duplicate_backup_count, 1);
        assert_eq!(preview.duplicate_backup_bytes, 4);
        assert_eq!(preview.protected_business_record_count, 1);
    }

    #[test]
    fn execution_requires_explicit_confirmation_and_removes_only_scanned_candidates() {
        let temp = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(temp.path()).expect("paths");
        let connection = Connection::open(&paths.database).expect("database");
        connection
            .execute_batch("CREATE TABLE records (id INTEGER PRIMARY KEY, body TEXT);")
            .expect("schema");
        fs::write(paths.backups.join("copy-a.db"), b"duplicate").expect("copy a");
        std::thread::sleep(Duration::from_millis(5));
        fs::write(paths.backups.join("copy-b.db"), b"duplicate").expect("copy b");

        assert!(execute(&connection, &paths, "").is_err());
        let inspection = inspect_for_confirmation(&connection, &paths).expect("inspection");
        let result = execute(&connection, &paths, &inspection.candidate_manifest).expect("execute");
        assert_eq!(result.removed_duplicate_backup_count, 1);
        assert_eq!(result.safety_backup, None);
        assert_eq!(result.integrity_check, "ok");
    }

    #[test]
    fn preview_and_execution_remove_only_unreferenced_controlled_attachments() {
        let temp = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(temp.path()).expect("paths");
        let connection = Connection::open(&paths.database).expect("database");
        connection
            .execute_batch(
                "CREATE TABLE records (id INTEGER PRIMARY KEY);
             CREATE TABLE attachments (
               id INTEGER PRIMARY KEY,
               record_id INTEGER,
               stored_path TEXT NOT NULL
             );
             INSERT INTO records DEFAULT VALUES;",
            )
            .expect("schema");
        let live = paths.attachments.join("live.bin");
        let orphan = paths.attachments.join("temporary").join("orphan.bin");
        fs::create_dir_all(orphan.parent().expect("parent")).expect("folder");
        fs::write(&live, b"live").expect("live file");
        fs::write(&orphan, b"orphan").expect("orphan file");
        connection
            .execute(
                "INSERT INTO attachments(id, record_id, stored_path) VALUES (1, 1, ?1)",
                [live.to_string_lossy().as_ref()],
            )
            .expect("reference live file");

        let preview = inspect_for_confirmation(&connection, &paths)
            .expect("preview")
            .preview;
        assert_eq!(preview.unreferenced_attachment_count, 1);
        assert_eq!(preview.unreferenced_attachment_bytes, 6);
        assert_eq!(preview.referenced_attachment_bytes, 4);

        let inspection = inspect_for_confirmation(&connection, &paths).expect("inspection");
        let result = execute(&connection, &paths, &inspection.candidate_manifest).expect("execute");
        assert_eq!(result.removed_unreferenced_attachment_count, 1);
        assert!(live.is_file());
        assert!(!orphan.exists());
    }

    #[test]
    fn execution_rejects_a_changed_candidate_manifest_and_preserves_files() {
        let temp = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(temp.path()).expect("paths");
        let connection = Connection::open(&paths.database).expect("database");
        connection
            .execute_batch("CREATE TABLE records (id INTEGER PRIMARY KEY);")
            .expect("schema");
        let first = paths.attachments.join("first-orphan.bin");
        let added_after_scan = paths.attachments.join("added-after-scan.bin");
        fs::write(&first, b"first").expect("first candidate");

        let inspection = inspect_for_confirmation(&connection, &paths).expect("inspection");
        fs::write(&added_after_scan, b"second").expect("changed candidate set");

        assert!(execute(&connection, &paths, &inspection.candidate_manifest).is_err());
        assert!(first.is_file());
        assert!(added_after_scan.is_file());
    }

    #[test]
    fn execution_rejects_an_existing_candidate_replaced_after_scan() {
        let temp = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(temp.path()).expect("paths");
        let connection = Connection::open(&paths.database).expect("database");
        connection
            .execute_batch("CREATE TABLE records (id INTEGER PRIMARY KEY);")
            .expect("schema");
        let orphan = paths.attachments.join("replaceable-orphan.bin");
        fs::write(&orphan, b"before").expect("candidate");

        let inspection = inspect_for_confirmation(&connection, &paths).expect("inspection");
        // 长度保持为 6 字节，确保本测试不依赖“大小变化”这条较弱防线。
        fs::write(&orphan, b"after!").expect("replacement");

        assert!(execute(&connection, &paths, &inspection.candidate_manifest).is_err());
        assert_eq!(fs::read(&orphan).expect("preserved replacement"), b"after!");
    }

    #[test]
    fn portable_backups_must_match_actual_file_bytes() {
        let temp = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(temp.path()).expect("paths");
        let connection = Connection::open(&paths.database).expect("database");
        connection
            .execute_batch("CREATE TABLE records (id INTEGER PRIMARY KEY);")
            .expect("schema");
        for (name, content) in [
            ("portable-a", b"same".as_slice()),
            ("portable-b", b"same"),
            ("portable-c", b"changed"),
        ] {
            let folder = paths.backups.join(name);
            fs::create_dir_all(folder.join("data")).expect("folder");
            fs::write(folder.join("data/app.db"), content).expect("content");
            fs::write(folder.join("manifest.json"), br#"{"files":[]}"#).expect("manifest");
            std::thread::sleep(Duration::from_millis(5));
        }

        let preview = inspect_for_confirmation(&connection, &paths)
            .expect("preview")
            .preview;
        assert_eq!(preview.duplicate_backup_count, 1);
        assert_eq!(preview.duplicate_backup_bytes, 16);
    }
}
