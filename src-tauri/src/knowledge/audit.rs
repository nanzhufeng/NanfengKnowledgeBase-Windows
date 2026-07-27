use std::fs::{self, File, OpenOptions};
use std::io::{BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

use chrono::{DateTime, Utc};
use rusqlite::backup::Backup;
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use sha2::{Digest, Sha256};
use thiserror::Error;

use super::legacy_preview::{
    preview_legacy_record_migration, LegacyMigrationPreview, LegacyRecordMappingPreview,
};

const COPY_FILE_NAME: &str = "legacy-readonly-copy.db";
const JSON_REPORT_FILE_NAME: &str = "migration-preview.json";
const MARKDOWN_REPORT_FILE_NAME: &str = "migration-preview.md";

#[derive(Debug, Error)]
pub enum MigrationAuditError {
    #[error("文件操作失败：{0}")]
    Io(#[from] std::io::Error),
    #[error("SQLite 操作失败：{0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("报告序列化失败：{0}")]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    Validation(String),
}

pub type MigrationAuditResult<T> = Result<T, MigrationAuditError>;

#[derive(Debug, Clone)]
pub struct MigrationAuditArtifacts {
    pub output_directory: PathBuf,
    pub database_copy: PathBuf,
    pub json_report: PathBuf,
    pub markdown_report: PathBuf,
    pub active_record_count: usize,
    pub deleted_record_count: usize,
    pub topic_candidate_count: usize,
    pub ambiguous_record_count: usize,
    pub unclassified_record_count: usize,
    pub recovered_title_record_count: usize,
    pub unresolved_generic_title_record_count: usize,
    pub duplicate_title_record_count: usize,
    pub copy_sha256: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceFileSnapshot {
    path: String,
    exists: bool,
    size_bytes: u64,
    modified_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MigrationAuditReport {
    report_version: u32,
    generated_at: String,
    source_database: String,
    source_size_bytes: u64,
    source_modified_at: Option<String>,
    source_connection_query_only: bool,
    source_total_changes_before: u64,
    source_total_changes_after: u64,
    source_files_before: Vec<SourceFileSnapshot>,
    source_files_after: Vec<SourceFileSnapshot>,
    copy_database: String,
    copy_size_bytes: u64,
    copy_sha256: String,
    copy_integrity_check: String,
    copy_total_changes_before_preview: u64,
    copy_total_changes_after_preview: u64,
    schema_versions: Vec<i64>,
    migration_preview: LegacyMigrationPreview,
}

/// 从只读正式库连接创建一致的 SQLite 副本，并只在副本上生成完整迁移预演报告。
///
/// 此入口不会创建正式知识表，也不会调用应用 migration。输出目录必须位于正式数据根目录之外，
/// 且三个目标文件均不得预先存在。
pub fn generate_read_only_migration_audit(
    source_database: impl AsRef<Path>,
    output_directory: impl AsRef<Path>,
) -> MigrationAuditResult<MigrationAuditArtifacts> {
    let source_database = source_database.as_ref();
    let output_directory = output_directory.as_ref();
    validate_audit_paths(source_database, output_directory)?;

    fs::create_dir_all(output_directory)?;
    let database_copy = output_directory.join(COPY_FILE_NAME);
    let json_report = output_directory.join(JSON_REPORT_FILE_NAME);
    let markdown_report = output_directory.join(MARKDOWN_REPORT_FILE_NAME);
    for target in [&database_copy, &json_report, &markdown_report] {
        if target.exists() {
            return Err(MigrationAuditError::Validation(format!(
                "为避免覆盖既有审计产物，目标文件已存在：{}",
                target.display()
            )));
        }
    }

    let source_metadata_before = source_database.metadata()?;
    let source_files_before = source_file_snapshots(source_database)?;
    let source_size_bytes = source_metadata_before.len();
    let source_modified_at = source_metadata_before
        .modified()
        .ok()
        .map(DateTime::<Utc>::from)
        .map(|value| value.to_rfc3339());

    let source = Connection::open_with_flags(
        source_database,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    source.execute_batch("PRAGMA query_only = ON;")?;
    ensure_legacy_database(&source)?;
    let source_connection_query_only =
        source.query_row("PRAGMA query_only", [], |row| row.get::<_, i64>(0))? == 1;
    if !source_connection_query_only {
        return Err(MigrationAuditError::Validation(
            "正式数据库连接未进入 query_only，已停止审计".to_string(),
        ));
    }
    let source_total_changes_before = source.total_changes();

    OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&database_copy)?;
    let mut target = Connection::open_with_flags(
        &database_copy,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    {
        let backup = Backup::new(&source, &mut target)?;
        backup.run_to_completion(64, Duration::from_millis(25), None)?;
    }
    drop(target);

    let source_total_changes_after = source.total_changes();
    if source_total_changes_after != source_total_changes_before {
        return Err(MigrationAuditError::Validation(
            "只读源连接出现变更计数，已停止审计".to_string(),
        ));
    }
    drop(source);
    let source_files_after = source_file_snapshots(source_database)?;

    let copy = Connection::open_with_flags(
        &database_copy,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    copy.execute_batch("PRAGMA query_only = ON;")?;
    let copy_integrity_check =
        copy.query_row("PRAGMA integrity_check", [], |row| row.get::<_, String>(0))?;
    if copy_integrity_check != "ok" {
        return Err(MigrationAuditError::Validation(format!(
            "隔离副本完整性检查失败：{copy_integrity_check}"
        )));
    }
    let schema_versions = read_schema_versions(&copy)?;
    let copy_total_changes_before_preview = copy.total_changes();
    let migration_preview = preview_legacy_record_migration(&copy, usize::MAX)?;
    let copy_total_changes_after_preview = copy.total_changes();
    if copy_total_changes_after_preview != copy_total_changes_before_preview {
        return Err(MigrationAuditError::Validation(
            "迁移预演对隔离副本产生了写入，已停止生成报告".to_string(),
        ));
    }
    drop(copy);

    let copy_size_bytes = database_copy.metadata()?.len();
    let copy_sha256 = sha256_file(&database_copy)?;
    let report = MigrationAuditReport {
        report_version: 2,
        generated_at: Utc::now().to_rfc3339(),
        source_database: source_database.to_string_lossy().into_owned(),
        source_size_bytes,
        source_modified_at,
        source_connection_query_only,
        source_total_changes_before,
        source_total_changes_after,
        source_files_before,
        source_files_after,
        copy_database: database_copy.to_string_lossy().into_owned(),
        copy_size_bytes,
        copy_sha256: copy_sha256.clone(),
        copy_integrity_check,
        copy_total_changes_before_preview,
        copy_total_changes_after_preview,
        schema_versions,
        migration_preview,
    };

    write_new_file(
        &json_report,
        serde_json::to_string_pretty(&report)?.as_bytes(),
    )?;
    write_new_file(&markdown_report, render_markdown_report(&report).as_bytes())?;

    Ok(MigrationAuditArtifacts {
        output_directory: output_directory.to_path_buf(),
        database_copy,
        json_report,
        markdown_report,
        active_record_count: report.migration_preview.legacy_record_count,
        deleted_record_count: report.migration_preview.deleted_record_count,
        topic_candidate_count: report.migration_preview.topic_candidates.len(),
        ambiguous_record_count: report
            .migration_preview
            .ambiguous_primary_topic_record_count,
        unclassified_record_count: report.migration_preview.unclassified_record_count,
        recovered_title_record_count: report.migration_preview.recovered_title_record_count,
        unresolved_generic_title_record_count: report
            .migration_preview
            .unresolved_generic_title_record_count,
        duplicate_title_record_count: report.migration_preview.duplicate_title_record_count,
        copy_sha256,
    })
}

fn validate_audit_paths(
    source_database: &Path,
    output_directory: &Path,
) -> MigrationAuditResult<()> {
    if !source_database.is_absolute() || !output_directory.is_absolute() {
        return Err(MigrationAuditError::Validation(
            "正式数据库和输出目录都必须使用绝对路径".to_string(),
        ));
    }
    if !source_database.is_file() {
        return Err(MigrationAuditError::Validation(format!(
            "正式数据库不存在：{}",
            source_database.display()
        )));
    }
    let source_root = source_database
        .parent()
        .and_then(Path::parent)
        .ok_or_else(|| MigrationAuditError::Validation("正式数据库路径层级无效".to_string()))?;
    if output_directory.starts_with(source_root) {
        return Err(MigrationAuditError::Validation(format!(
            "审计输出不得写入正式数据根目录：{}",
            source_root.display()
        )));
    }
    Ok(())
}

fn ensure_legacy_database(connection: &Connection) -> MigrationAuditResult<()> {
    let required_tables = ["records", "record_tags", "tags", "sources"];
    for table in required_tables {
        let exists = connection.query_row(
            "SELECT EXISTS(
               SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1
             )",
            [table],
            |row| row.get::<_, i64>(0),
        )?;
        if exists != 1 {
            return Err(MigrationAuditError::Validation(format!(
                "所选数据库缺少旧结构表：{table}"
            )));
        }
    }
    Ok(())
}

fn read_schema_versions(connection: &Connection) -> MigrationAuditResult<Vec<i64>> {
    let has_table = connection.query_row(
        "SELECT EXISTS(
           SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'
         )",
        [],
        |row| row.get::<_, i64>(0),
    )?;
    if has_table == 0 {
        return Ok(Vec::new());
    }
    let mut statement =
        connection.prepare("SELECT version FROM schema_migrations ORDER BY version")?;
    let versions = statement
        .query_map([], |row| row.get::<_, i64>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(versions)
}

fn sha256_file(path: &Path) -> MigrationAuditResult<String> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; 256 * 1024];
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode_upper(hasher.finalize()))
}

fn source_file_snapshots(source_database: &Path) -> MigrationAuditResult<Vec<SourceFileSnapshot>> {
    let paths = [
        source_database.to_path_buf(),
        PathBuf::from(format!("{}-wal", source_database.display())),
        PathBuf::from(format!("{}-shm", source_database.display())),
    ];
    paths
        .into_iter()
        .map(|path| {
            let metadata = fs::metadata(&path);
            match metadata {
                Ok(metadata) => Ok(SourceFileSnapshot {
                    path: path.to_string_lossy().into_owned(),
                    exists: true,
                    size_bytes: metadata.len(),
                    modified_at: metadata
                        .modified()
                        .ok()
                        .map(DateTime::<Utc>::from)
                        .map(|value| value.to_rfc3339()),
                }),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    Ok(SourceFileSnapshot {
                        path: path.to_string_lossy().into_owned(),
                        exists: false,
                        size_bytes: 0,
                        modified_at: None,
                    })
                }
                Err(error) => Err(MigrationAuditError::Io(error)),
            }
        })
        .collect()
}

fn write_new_file(path: &Path, contents: &[u8]) -> MigrationAuditResult<()> {
    let mut file = OpenOptions::new().write(true).create_new(true).open(path)?;
    file.write_all(contents)?;
    file.sync_all()?;
    Ok(())
}

fn render_markdown_report(report: &MigrationAuditReport) -> String {
    let preview = &report.migration_preview;
    let mut topic_candidates = preview.topic_candidates.clone();
    topic_candidates.sort_by(|left, right| {
        right
            .record_count
            .cmp(&left.record_count)
            .then_with(|| left.normalized_name.cmp(&right.normalized_name))
    });

    let mut markdown = format!(
        "# 南枫知识库 legacy Record 迁移预演\n\n\
         > 本报告由正式数据库的只读在线备份副本生成。未创建知识表、未执行 migration、未写回正式库。\n\n\
         ## 审计证据\n\n\
         | 项目 | 结果 |\n\
         |---|---|\n\
         | 生成时间 | `{}` |\n\
         | 正式数据库 | `{}` |\n\
         | 正式库只读连接 | `{}` |\n\
         | 正式库连接变更计数 | `{} → {}` |\n\
         | 隔离副本 | `{}` |\n\
         | 副本完整性 | `{}` |\n\
         | 副本 SHA-256 | `{}` |\n\
         | 副本预演变更计数 | `{} → {}` |\n\
         | 旧 schema 版本 | `{}` |\n\n\
         ## 汇总\n\n\
         | 指标 | 数量 |\n\
         |---|---:|\n\
         | 活动 Record | {} |\n\
         | 回收站 Record（默认排除） | {} |\n\
         | Source Item 候选 | {} |\n\
         | Note 候选 | {} |\n\
         | Note → Source 候选 | {} |\n\
         | 旧来源链接 | {} |\n\
         | 主题候选 | {} |\n\
         | 单标签待确认 | {} |\n\
         | 多标签歧义 | {} |\n\
         | 未分类 | {} |\n\
         | 坏结构化字段 | {} |\n\n",
        report.generated_at,
        escape_markdown_cell(&report.source_database),
        if report.source_connection_query_only {
            "是"
        } else {
            "否"
        },
        report.source_total_changes_before,
        report.source_total_changes_after,
        escape_markdown_cell(&report.copy_database),
        report.copy_integrity_check,
        report.copy_sha256,
        report.copy_total_changes_before_preview,
        report.copy_total_changes_after_preview,
        report
            .schema_versions
            .iter()
            .map(i64::to_string)
            .collect::<Vec<_>>()
            .join(", "),
        preview.legacy_record_count,
        preview.deleted_record_count,
        preview.source_item_candidate_count,
        preview.note_candidate_count,
        preview.note_source_candidate_count,
        preview.legacy_source_link_count,
        preview.topic_candidates.len(),
        preview.single_tag_candidate_count,
        preview.ambiguous_primary_topic_record_count,
        preview.unclassified_record_count,
        preview.malformed_structured_field_count,
    );

    markdown.push_str(
        "### 标题与来源结构\n\n\
         | 指标 | 数量 |\n\
         |---|---:|\n",
    );
    markdown.push_str(&format!(
        "| 从来源恢复标题 | {} |\n\
         | 仍无法恢复的通用标题 | {} |\n\
         | 恢复后重名记录 | {} |\n\
         | 恢复后重名组 | {} |\n\n",
        preview.recovered_title_record_count,
        preview.unresolved_generic_title_record_count,
        preview.duplicate_title_record_count,
        preview.duplicate_title_groups.len()
    ));

    markdown
        .push_str("### 正式库文件证据\n\n| 文件 | 阶段 | 大小 | 修改时间 |\n|---|---|---:|---|\n");
    for (stage, snapshots) in [
        ("打开前", &report.source_files_before),
        ("关闭后", &report.source_files_after),
    ] {
        for snapshot in snapshots {
            markdown.push_str(&format!(
                "| {} | {} | {} | {} |\n",
                escape_markdown_cell(&snapshot.path),
                stage,
                snapshot.size_bytes,
                snapshot.modified_at.as_deref().unwrap_or("不存在")
            ));
        }
    }

    markdown.push_str("\n### 记录状态\n\n| 状态 | 数量 |\n|---|---:|\n");
    for item in &preview.status_counts {
        markdown.push_str(&format!(
            "| {} | {} |\n",
            escape_markdown_cell(&item.name),
            item.count
        ));
    }
    markdown.push_str("\n### 来源类型\n\n| 来源类型 | 数量 |\n|---|---:|\n");
    for item in &preview.source_type_counts {
        markdown.push_str(&format!(
            "| {} | {} |\n",
            escape_markdown_cell(&item.name),
            item.count
        ));
    }

    markdown.push_str("## 主题候选\n\n| 候选主题 | 引用 Record 数 |\n|---|---:|\n");
    for candidate in &topic_candidates {
        markdown.push_str(&format!(
            "| {} | {} |\n",
            escape_markdown_cell(&candidate.name),
            candidate.record_count
        ));
    }

    markdown.push_str(
        "\n## 恢复标题后的重名组\n\n\
         | 迁移标题 | Record 数 | Record ID |\n\
         |---|---:|---|\n",
    );
    for collision in &preview.duplicate_title_groups {
        markdown.push_str(&format!(
            "| {} | {} | {} |\n",
            escape_markdown_cell(&collision.title),
            collision.record_count,
            collision
                .record_ids
                .iter()
                .map(i64::to_string)
                .collect::<Vec<_>>()
                .join("、")
        ));
    }

    markdown.push_str(
        "\n## 逐记录映射\n\n\
         | Record ID | 原标题 | 迁移标题 | 标题处理 | 标签 | Source | Note | 主题处理 | 坏字段 |\n\
         |---:|---|---|---|---|:---:|:---:|---|---:|\n",
    );
    for mapping in &preview.record_mappings {
        markdown.push_str(&render_mapping_row(mapping));
    }

    markdown.push_str("\n## 警告\n\n");
    for warning in &preview.warnings {
        markdown.push_str(&format!("- {}\n", warning));
    }
    markdown
}

fn render_mapping_row(mapping: &LegacyRecordMappingPreview) -> String {
    let topic_status = match mapping.topic_review_status.as_str() {
        "single_tag_candidate" => mapping
            .proposed_primary_topic
            .as_deref()
            .map(|topic| format!("待确认：{topic}"))
            .unwrap_or_else(|| "待确认".to_string()),
        "ambiguous_multiple_tags" => "歧义：需选择主主题".to_string(),
        _ => "未分类".to_string(),
    };
    format!(
        "| {} | {} | {} | {} | {} | {} | {} | {} | {} |\n",
        mapping.record_id,
        escape_markdown_cell(&mapping.legacy_title),
        escape_markdown_cell(&mapping.title),
        escape_markdown_cell(&mapping.title_resolution_status),
        escape_markdown_cell(&mapping.tags.join("、")),
        if mapping.creates_source_item {
            "是"
        } else {
            "否"
        },
        if mapping.creates_note { "是" } else { "否" },
        escape_markdown_cell(&topic_status),
        mapping.malformed_structured_field_count,
    )
}

fn escape_markdown_cell(value: &str) -> String {
    value
        .replace('|', "\\|")
        .replace(['\r', '\n'], " ")
        .replace('`', "\\`")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn audit_uses_read_only_source_and_generates_complete_reports() {
        let directory = tempfile::tempdir().expect("临时目录");
        let source_root = directory.path().join("formal-source");
        let source_database = source_root.join("data").join("app.db");
        fs::create_dir_all(source_database.parent().expect("data dir")).expect("创建 data");
        let connection = crate::database::open_database(&source_database).expect("旧库");
        connection
            .execute(
                "INSERT INTO records(
                   title, summary, status, current_judgment, confirmed_facts_json,
                   key_evidence_json, open_questions_json, next_actions_json,
                   notes, source_text, created_at, updated_at
                 ) VALUES (
                   'AI 知识库', '摘要', 'normal', '继续验证', '[\"事实\"]',
                   '[]', '[]', '[]', '', '完整来源', '2026-07-27', '2026-07-27'
                 )",
                [],
            )
            .expect("记录");
        connection
            .execute(
                "INSERT INTO tags(name, created_at) VALUES ('知识库', '2026-07-27')",
                [],
            )
            .expect("标签");
        connection
            .execute(
                "INSERT INTO record_tags(record_id, tag_id) VALUES (1, 1)",
                [],
            )
            .expect("记录标签");
        connection
            .execute(
                "INSERT INTO sources(record_id, source_type, title, created_at)
                 VALUES (1, 'markdown', 'source.md', '2026-07-27')",
                [],
            )
            .expect("来源");
        drop(connection);

        let source_hash_before = sha256_file(&source_database).expect("源哈希");
        let output_directory = directory.path().join("audit-output");
        let artifacts =
            generate_read_only_migration_audit(&source_database, &output_directory).expect("审计");
        let source_hash_after = sha256_file(&source_database).expect("源哈希");

        assert_eq!(source_hash_before, source_hash_after);
        assert_eq!(artifacts.active_record_count, 1);
        assert_eq!(artifacts.deleted_record_count, 0);
        assert_eq!(artifacts.topic_candidate_count, 1);
        assert_eq!(artifacts.ambiguous_record_count, 0);
        assert_eq!(artifacts.unclassified_record_count, 0);
        assert_eq!(artifacts.recovered_title_record_count, 0);
        assert_eq!(artifacts.unresolved_generic_title_record_count, 0);
        assert_eq!(artifacts.duplicate_title_record_count, 0);
        assert!(artifacts.database_copy.is_file());
        assert!(artifacts.json_report.is_file());
        assert!(artifacts.markdown_report.is_file());

        let copy =
            Connection::open_with_flags(&artifacts.database_copy, OpenFlags::SQLITE_OPEN_READ_ONLY)
                .expect("副本");
        let integrity: String = copy
            .query_row("PRAGMA integrity_check", [], |row| row.get(0))
            .expect("完整性");
        let record_count: i64 = copy
            .query_row("SELECT COUNT(*) FROM records", [], |row| row.get(0))
            .expect("记录数");
        assert_eq!(integrity, "ok");
        assert_eq!(record_count, 1);

        let report_text = fs::read_to_string(&artifacts.markdown_report).expect("报告");
        assert!(report_text.contains("正式库连接变更计数"));
        assert!(report_text.contains("0 → 0"));
        assert!(report_text.contains("知识库"));

        let json: serde_json::Value =
            serde_json::from_slice(&fs::read(&artifacts.json_report).expect("JSON"))
                .expect("解析 JSON");
        assert_eq!(json["copyIntegrityCheck"], "ok");
        assert_eq!(json["reportVersion"], 2);
        assert_eq!(json["migrationPreview"]["legacyRecordCount"], 1);
    }

    #[test]
    fn audit_rejects_output_inside_formal_data_root() {
        let directory = tempfile::tempdir().expect("临时目录");
        let source_database = directory.path().join("formal").join("data").join("app.db");
        fs::create_dir_all(source_database.parent().expect("data dir")).expect("创建 data");
        let connection = crate::database::open_database(&source_database).expect("旧库");
        drop(connection);

        let result = generate_read_only_migration_audit(
            &source_database,
            directory.path().join("formal").join("audit"),
        );
        assert!(matches!(result, Err(MigrationAuditError::Validation(_))));
    }

    #[test]
    fn markdown_escapes_record_titles_and_tags() {
        let mapping = LegacyRecordMappingPreview {
            record_id: 7,
            title: "标题 | 换行\n测试".to_string(),
            legacy_title: "原标题".to_string(),
            title_resolution_status: "recovered".to_string(),
            tags: vec!["A|B".to_string()],
            source_link_count: 0,
            creates_source_item: true,
            creates_note: false,
            proposed_primary_topic: Some("A|B".to_string()),
            topic_review_status: "single_tag_candidate".to_string(),
            malformed_structured_field_count: 0,
        };
        let row = render_mapping_row(&mapping);
        assert!(row.contains("标题 \\| 换行 测试"));
        assert!(row.contains("A\\|B"));
        assert!(!row.contains('\n') || row.ends_with('\n'));
    }
}
