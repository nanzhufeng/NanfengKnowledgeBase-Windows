use std::collections::BTreeMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use rusqlite::Connection;
use sha2::{Digest, Sha256};

use crate::error::{AppError, AppResult};
use crate::models::{DataOptimizationPreview, DataOptimizationResult};
use crate::paths::AppPaths;
use crate::transfer;

const INCOMPLETE_BACKUP_GRACE: Duration = Duration::from_secs(24 * 60 * 60);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CandidateKind {
    Duplicate,
    Incomplete,
}

#[derive(Debug, Clone)]
struct CleanupCandidate {
    path: PathBuf,
    bytes: u64,
    kind: CandidateKind,
}

pub fn inspect(connection: &Connection, paths: &AppPaths) -> AppResult<DataOptimizationPreview> {
    inspect_at(connection, paths, SystemTime::now())
}

fn inspect_at(
    connection: &Connection,
    paths: &AppPaths,
    now: SystemTime,
) -> AppResult<DataOptimizationPreview> {
    let candidates = scan_candidates(paths, now, None)?;
    let duplicate_backup_count = candidates
        .iter()
        .filter(|item| item.kind == CandidateKind::Duplicate)
        .count() as u64;
    let duplicate_backup_bytes = candidates
        .iter()
        .filter(|item| item.kind == CandidateKind::Duplicate)
        .map(|item| item.bytes)
        .sum();
    let incomplete_backup_count = candidates
        .iter()
        .filter(|item| item.kind == CandidateKind::Incomplete)
        .count() as u64;
    let incomplete_backup_bytes = candidates
        .iter()
        .filter(|item| item.kind == CandidateKind::Incomplete)
        .map(|item| item.bytes)
        .sum();
    let database_reclaimable_bytes = database_reclaimable_bytes(connection)?;
    let protected_business_record_count = connection
        .query_row("SELECT COUNT(*) FROM records", [], |row| row.get(0))
        .unwrap_or(0);

    Ok(DataOptimizationPreview {
        database_reclaimable_bytes,
        duplicate_backup_count,
        duplicate_backup_bytes,
        incomplete_backup_count,
        incomplete_backup_bytes,
        estimated_reclaimable_bytes: database_reclaimable_bytes
            .saturating_add(duplicate_backup_bytes)
            .saturating_add(incomplete_backup_bytes),
        protected_business_record_count,
    })
}

pub fn execute(
    connection: &Connection,
    paths: &AppPaths,
    confirmed: bool,
) -> AppResult<DataOptimizationResult> {
    if !confirmed {
        return Err(AppError::Validation(
            "数据优化必须先查看扫描结果并明确确认".to_string(),
        ));
    }

    let database_bytes_before = file_bytes(&paths.database)?;
    let safety_backup = transfer::create_backup(connection, paths, "优化前安全备份")?;
    let candidates = scan_candidates(paths, SystemTime::now(), Some(&safety_backup))?;
    let mut removed_duplicate_backup_count = 0;
    let mut removed_incomplete_backup_count = 0;

    for candidate in &candidates {
        if candidate.path.is_dir() {
            fs::remove_dir_all(&candidate.path)?;
        } else {
            fs::remove_file(&candidate.path)?;
        }
        match candidate.kind {
            CandidateKind::Duplicate => removed_duplicate_backup_count += 1,
            CandidateKind::Incomplete => removed_incomplete_backup_count += 1,
        }
    }

    connection.execute_batch("PRAGMA optimize;")?;
    if database_reclaimable_bytes(connection)? > 0 {
        connection.execute_batch("VACUUM;")?;
    }
    let integrity_check: String =
        connection.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if integrity_check != "ok" {
        return Err(AppError::Conflict(format!(
            "优化后数据库完整性检查未通过：{integrity_check}；安全快照位于 {}",
            safety_backup.display()
        )));
    }
    let database_bytes_after = file_bytes(&paths.database)?;
    let removed_bytes: u64 = candidates.iter().map(|item| item.bytes).sum();

    Ok(DataOptimizationResult {
        safety_backup: safety_backup.to_string_lossy().into_owned(),
        removed_duplicate_backup_count,
        removed_incomplete_backup_count,
        reclaimed_bytes: removed_bytes
            .saturating_add(database_bytes_before.saturating_sub(database_bytes_after)),
        database_bytes_before,
        database_bytes_after,
        integrity_check,
    })
}

fn database_reclaimable_bytes(connection: &Connection) -> AppResult<u64> {
    let page_size: i64 = connection.query_row("PRAGMA page_size", [], |row| row.get(0))?;
    let free_pages: i64 = connection.query_row("PRAGMA freelist_count", [], |row| row.get(0))?;
    Ok((page_size.max(0) as u64).saturating_mul(free_pages.max(0) as u64))
}

fn scan_candidates(
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
        if file_type.is_symlink() || protected_path.is_some_and(|protected| protected == path) {
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
                    kind: CandidateKind::Incomplete,
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
            kind: CandidateKind::Duplicate,
        }));
    }
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

fn collect_portable_files(
    root: &Path,
    directory: &Path,
    files: &mut Vec<PathBuf>,
) -> AppResult<()> {
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if file_type.is_symlink() {
            continue;
        }
        let path = entry.path();
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
        let file_type = entry.file_type()?;
        if file_type.is_symlink() {
            continue;
        }
        total = total.saturating_add(if file_type.is_dir() {
            directory_bytes(&entry.path())?
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

        let preview = inspect(&connection, &paths).expect("preview");
        assert_eq!(preview.duplicate_backup_count, 1);
        assert_eq!(preview.duplicate_backup_bytes, 4);
        assert_eq!(preview.protected_business_record_count, 1);
    }

    #[test]
    fn execution_requires_explicit_confirmation_and_keeps_safety_snapshot() {
        let temp = tempdir().expect("tempdir");
        let paths = AppPaths::from_root(temp.path()).expect("paths");
        let connection = Connection::open(&paths.database).expect("database");
        connection
            .execute_batch("CREATE TABLE records (id INTEGER PRIMARY KEY, body TEXT);")
            .expect("schema");
        fs::write(paths.backups.join("copy-a.db"), b"duplicate").expect("copy a");
        std::thread::sleep(Duration::from_millis(5));
        fs::write(paths.backups.join("copy-b.db"), b"duplicate").expect("copy b");

        assert!(execute(&connection, &paths, false).is_err());
        let result = execute(&connection, &paths, true).expect("execute");
        assert_eq!(result.removed_duplicate_backup_count, 1);
        assert!(Path::new(&result.safety_backup).is_file());
        assert_eq!(result.integrity_check, "ok");
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

        let preview = inspect(&connection, &paths).expect("preview");
        assert_eq!(preview.duplicate_backup_count, 1);
        assert_eq!(preview.duplicate_backup_bytes, 16);
    }
}
