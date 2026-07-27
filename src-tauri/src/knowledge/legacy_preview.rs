use std::collections::BTreeMap;

use rusqlite::{Connection, Result};
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LegacyTopicCandidate {
    pub name: String,
    pub normalized_name: String,
    pub record_count: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LegacyNamedCount {
    pub name: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LegacyTitleCollision {
    pub title: String,
    pub record_count: usize,
    pub record_ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LegacyRecordMappingPreview {
    pub record_id: i64,
    pub title: String,
    pub legacy_title: String,
    pub title_resolution_status: String,
    pub tags: Vec<String>,
    pub source_link_count: usize,
    pub creates_source_item: bool,
    pub creates_note: bool,
    pub proposed_primary_topic: Option<String>,
    pub topic_review_status: String,
    pub malformed_structured_field_count: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LegacyMigrationPreview {
    pub legacy_record_count: usize,
    pub deleted_record_count: usize,
    pub source_item_candidate_count: usize,
    pub note_candidate_count: usize,
    pub note_source_candidate_count: usize,
    pub legacy_source_link_count: usize,
    pub single_tag_candidate_count: usize,
    pub ambiguous_primary_topic_record_count: usize,
    pub unclassified_record_count: usize,
    pub malformed_structured_field_count: usize,
    pub recovered_title_record_count: usize,
    pub unresolved_generic_title_record_count: usize,
    pub duplicate_title_record_count: usize,
    pub topic_candidates: Vec<LegacyTopicCandidate>,
    pub duplicate_title_groups: Vec<LegacyTitleCollision>,
    pub status_counts: Vec<LegacyNamedCount>,
    pub source_type_counts: Vec<LegacyNamedCount>,
    pub record_mappings: Vec<LegacyRecordMappingPreview>,
    pub preview_limit: usize,
    pub truncated: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug)]
struct LegacyRecordRow {
    id: i64,
    title: String,
    source_title: String,
    status: String,
    summary: String,
    current_judgment: String,
    confirmed_facts_json: String,
    key_evidence_json: String,
    open_questions_json: String,
    next_actions_json: String,
    notes: String,
    source_text: String,
    tags_json: String,
    source_link_count: i64,
}

/// 只读扫描旧 `Record` 结构并生成映射建议。
///
/// 该函数只执行 SELECT，不创建表、不更新旧数据，也不会自动把标签或标题写成主题。
pub(crate) fn preview_legacy_record_migration(
    connection: &Connection,
    max_items: usize,
) -> Result<LegacyMigrationPreview> {
    let deleted_record_count = connection.query_row(
        "SELECT COUNT(*) FROM records WHERE is_deleted = 1",
        [],
        |row| row.get::<_, i64>(0),
    )? as usize;

    let rows = {
        let mut statement = connection.prepare(
            "
            SELECT
              r.id,
              r.title,
              COALESCE((
                SELECT s.title
                FROM sources s
                WHERE s.record_id = r.id
                ORDER BY s.id
                LIMIT 1
              ), '') AS source_title,
              r.status,
              r.summary,
              r.current_judgment,
              r.confirmed_facts_json,
              r.key_evidence_json,
              r.open_questions_json,
              r.next_actions_json,
              r.notes,
              r.source_text,
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
              (SELECT COUNT(*) FROM sources s WHERE s.record_id = r.id)
            FROM records r
            WHERE r.is_deleted = 0
            ORDER BY r.id
            ",
        )?;
        let collected = statement
            .query_map([], |row| {
                Ok(LegacyRecordRow {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    source_title: row.get(2)?,
                    status: row.get(3)?,
                    summary: row.get(4)?,
                    current_judgment: row.get(5)?,
                    confirmed_facts_json: row.get(6)?,
                    key_evidence_json: row.get(7)?,
                    open_questions_json: row.get(8)?,
                    next_actions_json: row.get(9)?,
                    notes: row.get(10)?,
                    source_text: row.get(11)?,
                    tags_json: row.get(12)?,
                    source_link_count: row.get(13)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        collected
    };

    let mut topic_counts = BTreeMap::<String, (String, usize)>::new();
    let mut title_groups = BTreeMap::<String, (String, Vec<i64>)>::new();
    let mut status_counts = BTreeMap::<String, usize>::new();
    let mut source_item_candidate_count = 0;
    let mut note_candidate_count = 0;
    let mut note_source_candidate_count = 0;
    let mut legacy_source_link_count = 0;
    let mut single_tag_candidate_count = 0;
    let mut ambiguous_primary_topic_record_count = 0;
    let mut unclassified_record_count = 0;
    let mut malformed_structured_field_count = 0;
    let mut recovered_title_record_count = 0;
    let mut unresolved_generic_title_record_count = 0;
    let mut record_mappings = Vec::with_capacity(max_items.min(rows.len()));

    for row in &rows {
        *status_counts.entry(row.status.clone()).or_default() += 1;
        let proposed_title =
            crate::database::resolve_summary_title(&row.title, &row.source_text, &row.source_title);
        let title_resolution_status = if proposed_title != row.title {
            recovered_title_record_count += 1;
            "recovered"
        } else if crate::database::is_generic_record_title(&row.title) {
            unresolved_generic_title_record_count += 1;
            "unresolved_generic"
        } else {
            "unchanged"
        };
        let normalized_title = normalize_name(&proposed_title);
        let title_entry = title_groups
            .entry(normalized_title)
            .or_insert_with(|| (proposed_title.clone(), Vec::new()));
        title_entry.1.push(row.id);

        let tags = parse_tags(&row.tags_json);
        for tag in &tags {
            let normalized = normalize_name(tag);
            let entry = topic_counts
                .entry(normalized)
                .or_insert_with(|| (tag.trim().to_string(), 0));
            entry.1 += 1;
        }

        let source_link_count = usize::try_from(row.source_link_count.max(0)).unwrap_or(0);
        legacy_source_link_count += source_link_count;
        let creates_source_item = !row.source_text.trim().is_empty() || source_link_count > 0;
        if creates_source_item {
            source_item_candidate_count += 1;
        }

        let structured_fields = [
            &row.confirmed_facts_json,
            &row.key_evidence_json,
            &row.open_questions_json,
            &row.next_actions_json,
        ];
        let mut row_malformed_count = 0;
        let has_structured_content = structured_fields.iter().any(|value| {
            let (has_content, malformed) = structured_value_has_content(value);
            if malformed {
                row_malformed_count += 1;
            }
            has_content
        });
        malformed_structured_field_count += row_malformed_count;

        let creates_note = has_structured_content
            || !row.summary.trim().is_empty()
            || !row.current_judgment.trim().is_empty()
            || !row.notes.trim().is_empty();
        if creates_note {
            note_candidate_count += 1;
        }
        if creates_note && creates_source_item {
            note_source_candidate_count += 1;
        }

        let (proposed_primary_topic, topic_review_status) = match tags.as_slice() {
            [] => {
                unclassified_record_count += 1;
                (None, "unclassified")
            }
            [only] => {
                single_tag_candidate_count += 1;
                (Some(only.clone()), "single_tag_candidate")
            }
            _ => {
                ambiguous_primary_topic_record_count += 1;
                (None, "ambiguous_multiple_tags")
            }
        };

        if record_mappings.len() < max_items {
            record_mappings.push(LegacyRecordMappingPreview {
                record_id: row.id,
                title: proposed_title,
                legacy_title: row.title.clone(),
                title_resolution_status: title_resolution_status.to_string(),
                tags,
                source_link_count,
                creates_source_item,
                creates_note,
                proposed_primary_topic,
                topic_review_status: topic_review_status.to_string(),
                malformed_structured_field_count: row_malformed_count,
            });
        }
    }

    let topic_candidates = topic_counts
        .into_iter()
        .map(
            |(normalized_name, (name, record_count))| LegacyTopicCandidate {
                name,
                normalized_name,
                record_count,
            },
        )
        .collect::<Vec<_>>();
    let duplicate_title_groups = title_groups
        .into_values()
        .filter_map(|(title, record_ids)| {
            (record_ids.len() > 1).then_some(LegacyTitleCollision {
                title,
                record_count: record_ids.len(),
                record_ids,
            })
        })
        .collect::<Vec<_>>();
    let duplicate_title_record_count = duplicate_title_groups
        .iter()
        .map(|group| group.record_count)
        .sum();
    let status_counts = status_counts
        .into_iter()
        .map(|(name, count)| LegacyNamedCount { name, count })
        .collect();
    let source_type_counts = read_source_type_counts(connection)?;

    let mut warnings = vec![
        "旧标签仅作为主题候选；即使只有一个标签，也必须经过确认后才能成为主主题。".to_string(),
        "旧记录标题不会自动升格为主题，避免按记录数量生成碎片主题。".to_string(),
        "预演只读取 records、record_tags、tags 和 sources，不执行任何写入。".to_string(),
    ];
    if deleted_record_count > 0 {
        warnings.push(format!(
            "已排除 {deleted_record_count} 条回收站记录；正式迁移前需单独决定是否纳入。"
        ));
    }
    if malformed_structured_field_count > 0 {
        warnings.push(format!(
            "发现 {malformed_structured_field_count} 个无法解析的结构化字段；正式迁移前必须人工处理。"
        ));
    }
    if unresolved_generic_title_record_count > 0 {
        warnings.push(format!(
            "有 {unresolved_generic_title_record_count} 条通用标题无法从来源恢复，正式迁移前需要人工命名。"
        ));
    }
    if !duplicate_title_groups.is_empty() {
        warnings.push(format!(
            "恢复标题后仍有 {} 组、{duplicate_title_record_count} 条重名记录；重名不是自动合并依据。",
            duplicate_title_groups.len()
        ));
    }

    Ok(LegacyMigrationPreview {
        legacy_record_count: rows.len(),
        deleted_record_count,
        source_item_candidate_count,
        note_candidate_count,
        note_source_candidate_count,
        legacy_source_link_count,
        single_tag_candidate_count,
        ambiguous_primary_topic_record_count,
        unclassified_record_count,
        malformed_structured_field_count,
        recovered_title_record_count,
        unresolved_generic_title_record_count,
        duplicate_title_record_count,
        topic_candidates,
        duplicate_title_groups,
        status_counts,
        source_type_counts,
        record_mappings,
        preview_limit: max_items,
        truncated: rows.len() > max_items,
        warnings,
    })
}

fn read_source_type_counts(connection: &Connection) -> Result<Vec<LegacyNamedCount>> {
    let mut statement = connection.prepare(
        "
        SELECT s.source_type, COUNT(*)
        FROM sources s
        JOIN records r ON r.id = s.record_id
        WHERE r.is_deleted = 0
        GROUP BY s.source_type
        ORDER BY s.source_type
        ",
    )?;
    let collected = statement
        .query_map([], |row| {
            Ok(LegacyNamedCount {
                name: row.get(0)?,
                count: row.get::<_, i64>(1)?.max(0) as usize,
            })
        })?
        .collect();
    collected
}

fn parse_tags(value: &str) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(value)
        .unwrap_or_default()
        .into_iter()
        .map(|tag| tag.trim().to_string())
        .filter(|tag| !tag.is_empty())
        .collect()
}

fn normalize_name(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn structured_value_has_content(value: &str) -> (bool, bool) {
    match serde_json::from_str::<Value>(value) {
        Ok(Value::Null) => (false, false),
        Ok(Value::Array(items)) => (!items.is_empty(), false),
        Ok(Value::Object(items)) => (!items.is_empty(), false),
        Ok(Value::String(text)) => (!text.trim().is_empty(), false),
        Ok(_) => (true, false),
        Err(_) => (!value.trim().is_empty(), true),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    fn seeded_database() -> Connection {
        let connection = crate::database::open_memory_database().expect("旧结构内存库");
        let rows = [
            (
                "AI 资本开支",
                "季度整理",
                "投入仍在增长",
                r#"["资本开支持续增加"]"#,
                r#"[{"content":"财报","source":"Q2"}]"#,
                "[]",
                "[]",
                "",
                "完整会话原文",
                0,
            ),
            (
                "跨地区账户",
                "",
                "",
                "[]",
                "[]",
                r#"["地区设置是否一致"]"#,
                "[]",
                "需要继续核对",
                "",
                0,
            ),
            (
                "Untitled",
                "",
                "",
                "[]",
                "[]",
                "[]",
                "[]",
                "",
                r#"{
                  "current_node":"answer",
                  "mapping":{
                    "user":{
                      "id":"user",
                      "parent":null,
                      "message":{
                        "author":{"role":"user"},
                        "content":{"content_type":"text","parts":["应该恢复的用户标题"]}
                      }
                    },
                    "answer":{
                      "id":"answer",
                      "parent":"user",
                      "message":{
                        "author":{"role":"assistant"},
                        "content":{"content_type":"text","parts":["回答"]}
                      }
                    }
                  }
                }"#,
                0,
            ),
            (
                "回收站记录",
                "",
                "",
                "[]",
                "[]",
                "[]",
                "[]",
                "",
                "不应进入预演",
                1,
            ),
        ];
        for (index, row) in rows.into_iter().enumerate() {
            connection
                .execute(
                    "INSERT INTO records(
                       title, summary, status, current_judgment,
                       confirmed_facts_json, key_evidence_json, open_questions_json,
                       next_actions_json, notes, source_text, is_deleted,
                       created_at, updated_at
                     ) VALUES (
                       ?1, ?2, 'normal', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
                       '2026-07-26', '2026-07-26'
                     )",
                    params![row.0, row.1, row.2, row.3, row.4, row.5, row.6, row.7, row.8, row.9],
                )
                .unwrap_or_else(|error| panic!("插入记录 {index}: {error}"));
        }

        for name in ["资本开支", "账户", "地区"] {
            connection
                .execute(
                    "INSERT INTO tags(name, created_at) VALUES (?1, '2026-07-26')",
                    [name],
                )
                .expect("标签");
        }
        connection
            .execute(
                "INSERT INTO record_tags(record_id, tag_id)
                 SELECT 1, id FROM tags WHERE name = '资本开支'",
                [],
            )
            .expect("单标签");
        connection
            .execute(
                "INSERT INTO record_tags(record_id, tag_id)
                 SELECT 2, id FROM tags WHERE name IN ('账户', '地区')",
                [],
            )
            .expect("多标签");
        connection
            .execute(
                "INSERT INTO sources(
                   record_id, source_type, title, created_at
                 ) VALUES (1, 'json', 'conversations.json', '2026-07-26')",
                [],
            )
            .expect("来源");
        connection
    }

    #[test]
    fn preview_maps_legacy_records_without_promoting_titles() {
        let connection = seeded_database();
        let changes_before = connection.total_changes();
        let preview = preview_legacy_record_migration(&connection, 20).expect("只读迁移预演");

        assert_eq!(connection.total_changes(), changes_before);
        assert_eq!(preview.legacy_record_count, 3);
        assert_eq!(preview.deleted_record_count, 1);
        assert_eq!(preview.source_item_candidate_count, 2);
        assert_eq!(preview.note_candidate_count, 2);
        assert_eq!(preview.note_source_candidate_count, 1);
        assert_eq!(preview.legacy_source_link_count, 1);
        assert_eq!(preview.single_tag_candidate_count, 1);
        assert_eq!(preview.ambiguous_primary_topic_record_count, 1);
        assert_eq!(preview.unclassified_record_count, 1);
        assert_eq!(preview.recovered_title_record_count, 1);
        assert_eq!(preview.unresolved_generic_title_record_count, 0);
        assert_eq!(
            preview
                .topic_candidates
                .iter()
                .map(|candidate| candidate.name.as_str())
                .collect::<Vec<_>>(),
            vec!["地区", "账户", "资本开支"]
        );
        assert!(!preview
            .topic_candidates
            .iter()
            .any(|candidate| candidate.name == "AI 资本开支"));
        assert_eq!(
            preview.record_mappings[0].proposed_primary_topic.as_deref(),
            Some("资本开支")
        );
        assert_eq!(
            preview.record_mappings[1].topic_review_status,
            "ambiguous_multiple_tags"
        );
        assert_eq!(preview.record_mappings[2].title, "应该恢复的用户标题");
    }

    #[test]
    fn preview_is_bounded_and_flags_malformed_structured_fields() {
        let connection = seeded_database();
        connection
            .execute(
                "UPDATE records SET confirmed_facts_json = 'not-json' WHERE id = 1",
                [],
            )
            .expect("构造坏数据");
        let changes_before = connection.total_changes();
        let preview = preview_legacy_record_migration(&connection, 1).expect("预演");

        assert_eq!(connection.total_changes(), changes_before);
        assert_eq!(preview.record_mappings.len(), 1);
        assert!(preview.truncated);
        assert_eq!(preview.malformed_structured_field_count, 1);
        assert!(preview
            .warnings
            .iter()
            .any(|warning| warning.contains("无法解析")));
    }
}
