use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeInboxItem {
    pub id: i64,
    pub public_id: String,
    pub legacy_record_id: Option<i64>,
    pub source_type: String,
    pub title: String,
    pub platform: String,
    pub original_text: String,
    pub original_at: Option<String>,
    pub imported_at: String,
    pub read_state: String,
    pub organization_state: String,
    pub duplicate_state: String,
    pub freshness_state: String,
    pub pending_suggestion_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeDomainRow {
    pub id: i64,
    pub public_id: String,
    pub name: String,
    pub description: String,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeTopicRow {
    pub id: i64,
    pub public_id: String,
    pub domain_id: i64,
    pub parent_topic_id: Option<i64>,
    pub name: String,
    pub description: String,
    pub topic_kind: String,
    pub status: String,
    pub depth: i64,
    pub sort_order: i64,
    pub source_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeClassificationSuggestionRow {
    pub id: i64,
    pub public_id: String,
    pub source_item_id: i64,
    pub suggested_topic_id: Option<i64>,
    pub score: f64,
    pub decision: String,
    pub reasons: Vec<String>,
    pub signal_scores_json: String,
    pub classifier_version: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeSuggestionInput {
    pub topic_id: Option<i64>,
    pub score: f64,
    pub decision: String,
    #[serde(default)]
    pub reasons: Vec<String>,
    #[serde(default)]
    pub signal_scores_json: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveKnowledgeSuggestionsInput {
    pub source_item_id: i64,
    pub classifier_version: String,
    pub suggestions: Vec<KnowledgeSuggestionInput>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmKnowledgeClassificationInput {
    pub source_item_id: i64,
    pub topic_id: i64,
    pub suggestion_id: Option<i64>,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeOperationResult {
    pub operation_id: i64,
    pub source_item_id: i64,
    pub topic_id: Option<i64>,
    pub organization_state: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicMergePreview {
    pub source_topic: KnowledgeTopicRow,
    pub target_topic: KnowledgeTopicRow,
    pub source_links_to_move: i64,
    pub duplicate_source_links: i64,
    pub judgments_to_move: i64,
    pub evidence_to_move: i64,
    pub questions_to_move: i64,
    pub relations_to_rewrite: i64,
    pub blockers: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicMergeResult {
    pub operation_id: i64,
    pub source_topic_id: i64,
    pub target_topic_id: i64,
    pub moved_source_count: usize,
    pub source_topic_status: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeTopicsInput {
    pub source_topic_id: i64,
    pub target_topic_id: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicSplitGroup {
    pub key: String,
    pub label: String,
    pub source_item_ids: Vec<i64>,
    pub source_titles: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicSplitPreview {
    pub topic: KnowledgeTopicRow,
    pub groups: Vec<TopicSplitGroup>,
    pub ungrouped_source_ids: Vec<i64>,
    pub note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicRelationSuggestion {
    pub from_topic_id: i64,
    pub from_topic_name: String,
    pub to_topic_id: i64,
    pub to_topic_name: String,
    pub relation_type: String,
    pub confidence: f64,
    pub reason: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTopicRelationInput {
    pub from_topic_id: i64,
    pub to_topic_id: i64,
    pub relation_type: String,
    pub confidence: f64,
    #[serde(default)]
    pub note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicRelationRow {
    pub id: i64,
    pub from_topic_id: i64,
    pub to_topic_id: i64,
    pub relation_type: String,
    pub confidence: f64,
    pub created_by: String,
    pub note: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MergeSourceLinkSnapshot {
    source_item_id: i64,
    role: String,
    confidence: Option<f64>,
    classification_suggestion_id: Option<i64>,
    created_at: String,
    target_had_link: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MergeNoteLinkSnapshot {
    note_id: i64,
    role: String,
    confidence: Option<f64>,
    created_at: String,
    target_had_link: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MergeRelationSnapshot {
    from_topic_id: i64,
    to_topic_id: i64,
    relation_type: String,
    confidence: f64,
    created_by: String,
    note: String,
    created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MergeInverse {
    source_topic_id: i64,
    target_topic_id: i64,
    source_status: String,
    source_links: Vec<MergeSourceLinkSnapshot>,
    judgment_ids: Vec<i64>,
    evidence_ids: Vec<i64>,
    question_ids: Vec<i64>,
    turning_point_ids: Vec<i64>,
    proposition_ids: Vec<i64>,
    note_links: Vec<MergeNoteLinkSnapshot>,
    suggestion_ids: Vec<i64>,
    rule_ids: Vec<i64>,
    original_relations: Vec<MergeRelationSnapshot>,
    inserted_relations: Vec<MergeRelationSnapshot>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicSourceRow {
    pub id: i64,
    pub public_id: String,
    pub title: String,
    pub source_type: String,
    pub original_at: Option<String>,
    pub confidence: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicJudgmentRow {
    pub id: i64,
    pub public_id: String,
    pub statement_markdown: String,
    pub state: String,
    pub confidence: f64,
    pub change_reason: String,
    pub effective_at: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicEvidenceRow {
    pub id: i64,
    pub public_id: String,
    pub source_item_id: i64,
    pub source_title: String,
    pub content_markdown: String,
    pub stance: String,
    pub credibility: f64,
    pub verification_status: String,
    pub validity_status: String,
    pub locator_json: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicQuestionRow {
    pub id: i64,
    pub public_id: String,
    pub question: String,
    pub importance: String,
    pub affects_current_judgment: bool,
    pub status: String,
    pub resolution_note: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeTopicDetail {
    pub topic: KnowledgeTopicRow,
    pub sources: Vec<TopicSourceRow>,
    pub judgments: Vec<TopicJudgmentRow>,
    pub evidence: Vec<TopicEvidenceRow>,
    pub questions: Vec<TopicQuestionRow>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddTopicJudgmentInput {
    pub topic_id: i64,
    pub statement_markdown: String,
    pub confidence: f64,
    #[serde(default = "default_judgment_state")]
    pub state: String,
    #[serde(default)]
    pub change_reason: String,
}

fn default_judgment_state() -> String {
    "current".to_string()
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddTopicEvidenceInput {
    pub topic_id: i64,
    pub source_item_id: i64,
    pub content_markdown: String,
    #[serde(default = "default_evidence_stance")]
    pub stance: String,
    #[serde(default)]
    pub credibility: f64,
    #[serde(default)]
    pub locator_json: String,
}

fn default_evidence_stance() -> String {
    "context".to_string()
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddTopicQuestionInput {
    pub topic_id: i64,
    pub question: String,
    #[serde(default = "default_question_importance")]
    pub importance: String,
    #[serde(default)]
    pub affects_current_judgment: bool,
}

fn default_question_importance() -> String {
    "medium".to_string()
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateKnowledgeDomainInput {
    pub name: String,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateKnowledgeTopicInput {
    pub domain_id: i64,
    pub parent_topic_id: Option<i64>,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_topic_kind")]
    pub topic_kind: String,
}

fn default_topic_kind() -> String {
    "subject".to_string()
}

pub fn backfill_legacy_records(connection: &mut Connection) -> AppResult<usize> {
    let rows = {
        let mut statement = connection.prepare(
            "SELECT r.id, r.title, r.source_text, r.original_at, r.created_at,
                    COALESCE(s.source_type, 'manual'), COALESCE(s.title, ''),
                    s.url, s.local_path, s.external_id
             FROM records r
             LEFT JOIN sources s ON s.id = (
               SELECT first_source.id
               FROM sources first_source
               WHERE first_source.record_id = r.id
               ORDER BY first_source.id
               LIMIT 1
             )
             WHERE NOT EXISTS (
               SELECT 1 FROM source_items source_item
               WHERE source_item.legacy_record_id = r.id
             )
             ORDER BY r.id",
        )?;
        let collected = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, Option<String>>(7)?,
                    row.get::<_, Option<String>>(8)?,
                    row.get::<_, Option<String>>(9)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        collected
    };
    if rows.is_empty() {
        return Ok(0);
    }
    let transaction = connection.transaction()?;
    let mut inserted = 0_usize;
    for (
        record_id,
        title,
        source_text,
        original_at,
        created_at,
        legacy_source_type,
        source_title,
        source_url,
        local_path,
        external_id,
    ) in rows
    {
        let source_type = normalize_source_type(&legacy_source_type, local_path.as_deref());
        let sha256 = hex::encode(Sha256::digest(source_text.as_bytes()));
        let metadata = serde_json::json!({
            "legacyRecordId": record_id,
            "legacySourceType": legacy_source_type,
            "legacyExternalId": external_id,
        });
        inserted += transaction.execute(
            "INSERT OR IGNORE INTO source_items(
               public_id, legacy_record_id, source_type, title, platform,
               original_text, original_json, source_uri, local_path, content_sha256,
               original_at, imported_at, metadata_json, organization_state
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'inbox')",
            params![
                format!("legacy-record-{record_id}"),
                record_id,
                source_type,
                title,
                source_title,
                source_text,
                if matches!(source_type, "json" | "ai_conversation") {
                    Some(source_text.as_str())
                } else {
                    None
                },
                source_url,
                local_path,
                sha256,
                original_at,
                created_at,
                metadata.to_string(),
            ],
        )?;
    }
    transaction.commit()?;
    Ok(inserted)
}

pub fn sync_legacy_record(connection: &mut Connection, record_id: i64) -> AppResult<()> {
    let already_exists = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM source_items WHERE legacy_record_id = ?1)",
        [record_id],
        |row| row.get::<_, i64>(0),
    )? != 0;
    if already_exists {
        return Ok(());
    }
    backfill_legacy_records(connection)?;
    Ok(())
}

pub fn list_inbox(connection: &Connection, limit: usize) -> AppResult<Vec<KnowledgeInboxItem>> {
    let limit = limit.clamp(1, 2_000) as i64;
    let mut statement = connection.prepare(
        "SELECT source.id, source.public_id, source.legacy_record_id, source.source_type,
                source.title, source.platform, source.original_text, source.original_at,
                source.imported_at, source.read_state, source.organization_state,
                source.duplicate_state, source.freshness_state,
                COUNT(suggestion.id)
         FROM source_items source
         LEFT JOIN classification_suggestions suggestion
           ON suggestion.source_item_id = source.id AND suggestion.status = 'pending'
         WHERE source.organization_state = 'inbox' AND source.status = 'active'
         GROUP BY source.id
         ORDER BY COALESCE(source.original_at, source.imported_at) DESC, source.id DESC
         LIMIT ?1",
    )?;
    let rows = statement.query_map([limit], |row| {
        Ok(KnowledgeInboxItem {
            id: row.get(0)?,
            public_id: row.get(1)?,
            legacy_record_id: row.get(2)?,
            source_type: row.get(3)?,
            title: row.get(4)?,
            platform: row.get(5)?,
            original_text: row.get(6)?,
            original_at: row.get(7)?,
            imported_at: row.get(8)?,
            read_state: row.get(9)?,
            organization_state: row.get(10)?,
            duplicate_state: row.get(11)?,
            freshness_state: row.get(12)?,
            pending_suggestion_count: row.get(13)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn list_domains(connection: &Connection) -> AppResult<Vec<KnowledgeDomainRow>> {
    let mut statement = connection.prepare(
        "SELECT id, public_id, name, description, sort_order
         FROM domains ORDER BY sort_order, name",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(KnowledgeDomainRow {
            id: row.get(0)?,
            public_id: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            sort_order: row.get(4)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn list_topics(connection: &Connection) -> AppResult<Vec<KnowledgeTopicRow>> {
    let mut statement = connection.prepare(
        "SELECT topic.id, topic.public_id, topic.domain_id, topic.parent_topic_id,
                topic.name, topic.description, topic.topic_kind, topic.status,
                topic.depth, topic.sort_order, COUNT(source_topic.source_item_id)
         FROM topics topic
         LEFT JOIN source_topics source_topic ON source_topic.topic_id = topic.id
         GROUP BY topic.id
         ORDER BY topic.domain_id, topic.depth, topic.sort_order, topic.name",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(KnowledgeTopicRow {
            id: row.get(0)?,
            public_id: row.get(1)?,
            domain_id: row.get(2)?,
            parent_topic_id: row.get(3)?,
            name: row.get(4)?,
            description: row.get(5)?,
            topic_kind: row.get(6)?,
            status: row.get(7)?,
            depth: row.get(8)?,
            sort_order: row.get(9)?,
            source_count: row.get(10)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn get_topic_detail(connection: &Connection, topic_id: i64) -> AppResult<KnowledgeTopicDetail> {
    let topic = list_topics(connection)?
        .into_iter()
        .find(|topic| topic.id == topic_id)
        .ok_or_else(|| AppError::NotFound("主题不存在".to_string()))?;
    let sources = {
        let mut statement = connection.prepare(
            "SELECT source.id, source.public_id, source.title, source.source_type,
                    source.original_at, source_topic.confidence
             FROM source_topics source_topic
             JOIN source_items source ON source.id = source_topic.source_item_id
             WHERE source_topic.topic_id = ?1
             ORDER BY COALESCE(source.original_at, source.imported_at) DESC, source.id DESC",
        )?;
        let rows = statement.query_map([topic_id], |row| {
            Ok(TopicSourceRow {
                id: row.get(0)?,
                public_id: row.get(1)?,
                title: row.get(2)?,
                source_type: row.get(3)?,
                original_at: row.get(4)?,
                confidence: row.get(5)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    let judgments = {
        let mut statement = connection.prepare(
            "SELECT id, public_id, statement_markdown, state, confidence,
                    change_reason, effective_at, created_at
             FROM judgment_snapshots
             WHERE topic_id = ?1
             ORDER BY effective_at DESC, id DESC",
        )?;
        let rows = statement.query_map([topic_id], |row| {
            Ok(TopicJudgmentRow {
                id: row.get(0)?,
                public_id: row.get(1)?,
                statement_markdown: row.get(2)?,
                state: row.get(3)?,
                confidence: row.get(4)?,
                change_reason: row.get(5)?,
                effective_at: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    let evidence = {
        let mut statement = connection.prepare(
            "SELECT evidence.id, evidence.public_id, evidence.source_item_id,
                    source.title, evidence.content_markdown, evidence.stance,
                    evidence.credibility, evidence.verification_status,
                    evidence.validity_status, evidence.locator_json, evidence.created_at
             FROM evidence
             JOIN source_items source ON source.id = evidence.source_item_id
             WHERE evidence.topic_id = ?1
             ORDER BY evidence.created_at DESC, evidence.id DESC",
        )?;
        let rows = statement.query_map([topic_id], |row| {
            Ok(TopicEvidenceRow {
                id: row.get(0)?,
                public_id: row.get(1)?,
                source_item_id: row.get(2)?,
                source_title: row.get(3)?,
                content_markdown: row.get(4)?,
                stance: row.get(5)?,
                credibility: row.get(6)?,
                verification_status: row.get(7)?,
                validity_status: row.get(8)?,
                locator_json: row.get(9)?,
                created_at: row.get(10)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    let questions = {
        let mut statement = connection.prepare(
            "SELECT id, public_id, question, importance, affects_current_judgment,
                    status, resolution_note, created_at, updated_at
             FROM open_questions
             WHERE topic_id = ?1
             ORDER BY CASE importance WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                      created_at DESC",
        )?;
        let rows = statement.query_map([topic_id], |row| {
            Ok(TopicQuestionRow {
                id: row.get(0)?,
                public_id: row.get(1)?,
                question: row.get(2)?,
                importance: row.get(3)?,
                affects_current_judgment: row.get::<_, i64>(4)? != 0,
                status: row.get(5)?,
                resolution_note: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    Ok(KnowledgeTopicDetail {
        topic,
        sources,
        judgments,
        evidence,
        questions,
    })
}

pub fn preview_topic_merge(
    connection: &Connection,
    source_topic_id: i64,
    target_topic_id: i64,
) -> AppResult<TopicMergePreview> {
    if source_topic_id == target_topic_id {
        return Err(AppError::Validation("不能把主题合并到自身".to_string()));
    }
    let topics = list_topics(connection)?;
    let source_topic = topics
        .iter()
        .find(|topic| topic.id == source_topic_id)
        .cloned()
        .ok_or_else(|| AppError::NotFound("待合并主题不存在".to_string()))?;
    let target_topic = topics
        .iter()
        .find(|topic| topic.id == target_topic_id)
        .cloned()
        .ok_or_else(|| AppError::NotFound("目标主题不存在".to_string()))?;
    let mut blockers = Vec::new();
    if source_topic.status == "merged" {
        blockers.push("待合并主题已经处于 merged 状态".to_string());
    }
    if target_topic.status == "merged" {
        blockers.push("目标主题已经处于 merged 状态".to_string());
    }
    let child_count = connection.query_row(
        "SELECT COUNT(*) FROM topics WHERE parent_topic_id = ?1 AND status <> 'merged'",
        [source_topic_id],
        |row| row.get::<_, i64>(0),
    )?;
    if child_count > 0 {
        blockers.push(format!(
            "待合并主题仍有 {child_count} 个活动子主题；请先移动或合并子主题"
        ));
    }
    let source_current_judgments = connection.query_row(
        "SELECT COUNT(*) FROM judgment_snapshots
         WHERE topic_id = ?1 AND replaced_by_id IS NULL",
        [source_topic_id],
        |row| row.get::<_, i64>(0),
    )?;
    let target_current_judgments = connection.query_row(
        "SELECT COUNT(*) FROM judgment_snapshots
         WHERE topic_id = ?1 AND replaced_by_id IS NULL",
        [target_topic_id],
        |row| row.get::<_, i64>(0),
    )?;
    if source_current_judgments > 0 && target_current_judgments > 0 {
        blockers.push("两个主题都存在当前判断；请先确认保留哪条判断，再执行合并".to_string());
    }
    let source_links_to_move = count_topic_rows(connection, "source_topics", source_topic_id)?;
    let duplicate_source_links = connection.query_row(
        "SELECT COUNT(*)
         FROM source_topics source_link
         WHERE source_link.topic_id = ?1
           AND EXISTS (
             SELECT 1 FROM source_topics target_link
             WHERE target_link.topic_id = ?2
               AND target_link.source_item_id = source_link.source_item_id
           )",
        params![source_topic_id, target_topic_id],
        |row| row.get::<_, i64>(0),
    )?;
    Ok(TopicMergePreview {
        source_topic,
        target_topic,
        source_links_to_move,
        duplicate_source_links,
        judgments_to_move: count_topic_rows(connection, "judgment_snapshots", source_topic_id)?,
        evidence_to_move: count_topic_rows(connection, "evidence", source_topic_id)?,
        questions_to_move: count_topic_rows(connection, "open_questions", source_topic_id)?,
        relations_to_rewrite: connection.query_row(
            "SELECT COUNT(*) FROM topic_relations
             WHERE from_topic_id = ?1 OR to_topic_id = ?1",
            [source_topic_id],
            |row| row.get(0),
        )?,
        blockers,
    })
}

pub fn merge_topics(
    connection: &mut Connection,
    input: &MergeTopicsInput,
) -> AppResult<TopicMergeResult> {
    let preview = preview_topic_merge(connection, input.source_topic_id, input.target_topic_id)?;
    if !preview.blockers.is_empty() {
        return Err(AppError::Conflict(preview.blockers.join("；")));
    }
    let transaction = connection.transaction()?;
    let source_status = preview.source_topic.status.clone();
    let source_links = {
        let mut statement = transaction.prepare(
            "SELECT source_item_id, role, confidence, classification_suggestion_id, created_at,
                    EXISTS(
                      SELECT 1 FROM source_topics target_link
                      WHERE target_link.source_item_id = source_topics.source_item_id
                        AND target_link.topic_id = ?2
                    )
             FROM source_topics
             WHERE topic_id = ?1
             ORDER BY source_item_id",
        )?;
        let links = statement
            .query_map(
                params![input.source_topic_id, input.target_topic_id],
                |row| {
                    Ok(MergeSourceLinkSnapshot {
                        source_item_id: row.get(0)?,
                        role: row.get(1)?,
                        confidence: row.get(2)?,
                        classification_suggestion_id: row.get(3)?,
                        created_at: row.get(4)?,
                        target_had_link: row.get::<_, i64>(5)? != 0,
                    })
                },
            )?
            .collect::<Result<Vec<_>, _>>()?;
        links
    };
    let note_links = {
        let mut statement = transaction.prepare(
            "SELECT note_id, role, confidence, created_at,
                    EXISTS(
                      SELECT 1 FROM note_topics target_link
                      WHERE target_link.note_id = note_topics.note_id
                        AND target_link.topic_id = ?2
                    )
             FROM note_topics
             WHERE topic_id = ?1
             ORDER BY note_id",
        )?;
        let links = statement
            .query_map(
                params![input.source_topic_id, input.target_topic_id],
                |row| {
                    Ok(MergeNoteLinkSnapshot {
                        note_id: row.get(0)?,
                        role: row.get(1)?,
                        confidence: row.get(2)?,
                        created_at: row.get(3)?,
                        target_had_link: row.get::<_, i64>(4)? != 0,
                    })
                },
            )?
            .collect::<Result<Vec<_>, _>>()?;
        links
    };
    let judgment_ids = topic_row_ids(&transaction, "judgment_snapshots", input.source_topic_id)?;
    let evidence_ids = topic_row_ids(&transaction, "evidence", input.source_topic_id)?;
    let question_ids = topic_row_ids(&transaction, "open_questions", input.source_topic_id)?;
    let turning_point_ids = topic_row_ids(&transaction, "turning_points", input.source_topic_id)?;
    let proposition_ids = topic_row_ids(&transaction, "propositions", input.source_topic_id)?;
    let suggestion_ids = topic_row_ids_by_column(
        &transaction,
        "classification_suggestions",
        "suggested_topic_id",
        input.source_topic_id,
    )?;
    let rule_ids = topic_row_ids_by_column(
        &transaction,
        "classification_rules",
        "target_topic_id",
        input.source_topic_id,
    )?;
    let original_relations = read_topic_relations(&transaction, input.source_topic_id)?;

    for link in &source_links {
        transaction.execute(
            "DELETE FROM source_topics WHERE source_item_id = ?1 AND topic_id = ?2",
            params![link.source_item_id, input.source_topic_id],
        )?;
        if !link.target_had_link {
            transaction.execute(
                "INSERT INTO source_topics(
                   source_item_id, topic_id, role, confidence,
                   classification_suggestion_id, created_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    link.source_item_id,
                    input.target_topic_id,
                    link.role,
                    link.confidence,
                    link.classification_suggestion_id,
                    link.created_at,
                ],
            )?;
        }
    }
    for link in &note_links {
        transaction.execute(
            "DELETE FROM note_topics WHERE note_id = ?1 AND topic_id = ?2",
            params![link.note_id, input.source_topic_id],
        )?;
        if !link.target_had_link {
            transaction.execute(
                "INSERT INTO note_topics(note_id, topic_id, role, confidence, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    link.note_id,
                    input.target_topic_id,
                    link.role,
                    link.confidence,
                    link.created_at,
                ],
            )?;
        }
    }
    for table in [
        "judgment_snapshots",
        "evidence",
        "open_questions",
        "turning_points",
        "propositions",
    ] {
        transaction.execute(
            &format!("UPDATE {table} SET topic_id = ?1 WHERE topic_id = ?2"),
            params![input.target_topic_id, input.source_topic_id],
        )?;
    }
    transaction.execute(
        "UPDATE classification_suggestions SET suggested_topic_id = ?1
         WHERE suggested_topic_id = ?2",
        params![input.target_topic_id, input.source_topic_id],
    )?;
    transaction.execute(
        "UPDATE classification_rules SET target_topic_id = ?1 WHERE target_topic_id = ?2",
        params![input.target_topic_id, input.source_topic_id],
    )?;
    transaction.execute(
        "DELETE FROM topic_relations WHERE from_topic_id = ?1 OR to_topic_id = ?1",
        [input.source_topic_id],
    )?;
    let mut inserted_relations = Vec::new();
    for relation in &original_relations {
        let from_topic_id = if relation.from_topic_id == input.source_topic_id {
            input.target_topic_id
        } else {
            relation.from_topic_id
        };
        let to_topic_id = if relation.to_topic_id == input.source_topic_id {
            input.target_topic_id
        } else {
            relation.to_topic_id
        };
        if from_topic_id == to_topic_id {
            continue;
        }
        let changed = transaction.execute(
            "INSERT OR IGNORE INTO topic_relations(
               from_topic_id, to_topic_id, relation_type, confidence,
               created_by, note, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                from_topic_id,
                to_topic_id,
                relation.relation_type,
                relation.confidence,
                relation.created_by,
                relation.note,
                relation.created_at,
            ],
        )?;
        if changed > 0 {
            inserted_relations.push(MergeRelationSnapshot {
                from_topic_id,
                to_topic_id,
                relation_type: relation.relation_type.clone(),
                confidence: relation.confidence,
                created_by: relation.created_by.clone(),
                note: relation.note.clone(),
                created_at: relation.created_at.clone(),
            });
        }
    }
    let now = Utc::now().to_rfc3339();
    transaction.execute(
        "UPDATE topics SET status = 'merged', updated_at = ?1 WHERE id = ?2",
        params![now, input.source_topic_id],
    )?;
    transaction.execute(
        "UPDATE topics SET updated_at = ?1 WHERE id = ?2",
        params![now, input.target_topic_id],
    )?;
    let inverse = MergeInverse {
        source_topic_id: input.source_topic_id,
        target_topic_id: input.target_topic_id,
        source_status,
        source_links,
        judgment_ids,
        evidence_ids,
        question_ids,
        turning_point_ids,
        proposition_ids,
        note_links,
        suggestion_ids,
        rule_ids,
        original_relations,
        inserted_relations,
    };
    transaction.execute(
        "INSERT INTO operation_logs(
           public_id, operation_type, entity_type, entity_public_id,
           before_json, after_json, inverse_json, actor, created_at
         ) VALUES (?1, 'merge_topic', 'topic', ?2, ?3, ?4, ?5, 'user', ?6)",
        params![
            format!("operation-{}", Uuid::new_v4()),
            preview.source_topic.public_id,
            serde_json::to_string(&preview)?,
            serde_json::json!({
                "sourceTopicId": input.source_topic_id,
                "targetTopicId": input.target_topic_id,
                "sourceStatus": "merged"
            })
            .to_string(),
            serde_json::to_string(&inverse)?,
            now,
        ],
    )?;
    let operation_id = transaction.last_insert_rowid();
    transaction.commit()?;
    Ok(TopicMergeResult {
        operation_id,
        source_topic_id: input.source_topic_id,
        target_topic_id: input.target_topic_id,
        moved_source_count: inverse.source_links.len(),
        source_topic_status: "merged".to_string(),
    })
}

pub fn undo_topic_merge(
    connection: &mut Connection,
    operation_id: i64,
) -> AppResult<TopicMergeResult> {
    let transaction = connection.transaction()?;
    let inverse_json = transaction
        .query_row(
            "SELECT inverse_json FROM operation_logs
             WHERE id = ?1 AND operation_type = 'merge_topic' AND undone_at IS NULL",
            [operation_id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|_| AppError::NotFound("找不到可撤销的主题合并操作".to_string()))?;
    let inverse: MergeInverse = serde_json::from_str(&inverse_json)?;
    for link in &inverse.source_links {
        if !link.target_had_link {
            transaction.execute(
                "DELETE FROM source_topics WHERE source_item_id = ?1 AND topic_id = ?2",
                params![link.source_item_id, inverse.target_topic_id],
            )?;
        }
        transaction.execute(
            "INSERT OR REPLACE INTO source_topics(
               source_item_id, topic_id, role, confidence,
               classification_suggestion_id, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                link.source_item_id,
                inverse.source_topic_id,
                link.role,
                link.confidence,
                link.classification_suggestion_id,
                link.created_at,
            ],
        )?;
    }
    for link in &inverse.note_links {
        if !link.target_had_link {
            transaction.execute(
                "DELETE FROM note_topics WHERE note_id = ?1 AND topic_id = ?2",
                params![link.note_id, inverse.target_topic_id],
            )?;
        }
        transaction.execute(
            "INSERT OR REPLACE INTO note_topics(note_id, topic_id, role, confidence, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                link.note_id,
                inverse.source_topic_id,
                link.role,
                link.confidence,
                link.created_at,
            ],
        )?;
    }
    restore_topic_ids(
        &transaction,
        "judgment_snapshots",
        &inverse.judgment_ids,
        inverse.source_topic_id,
    )?;
    restore_topic_ids(
        &transaction,
        "evidence",
        &inverse.evidence_ids,
        inverse.source_topic_id,
    )?;
    restore_topic_ids(
        &transaction,
        "open_questions",
        &inverse.question_ids,
        inverse.source_topic_id,
    )?;
    restore_topic_ids(
        &transaction,
        "turning_points",
        &inverse.turning_point_ids,
        inverse.source_topic_id,
    )?;
    restore_topic_ids(
        &transaction,
        "propositions",
        &inverse.proposition_ids,
        inverse.source_topic_id,
    )?;
    restore_topic_ids_by_column(
        &transaction,
        "classification_suggestions",
        "suggested_topic_id",
        &inverse.suggestion_ids,
        inverse.source_topic_id,
    )?;
    restore_topic_ids_by_column(
        &transaction,
        "classification_rules",
        "target_topic_id",
        &inverse.rule_ids,
        inverse.source_topic_id,
    )?;
    for relation in &inverse.inserted_relations {
        transaction.execute(
            "DELETE FROM topic_relations
             WHERE from_topic_id = ?1 AND to_topic_id = ?2 AND relation_type = ?3",
            params![
                relation.from_topic_id,
                relation.to_topic_id,
                relation.relation_type
            ],
        )?;
    }
    for relation in &inverse.original_relations {
        transaction.execute(
            "INSERT OR IGNORE INTO topic_relations(
               from_topic_id, to_topic_id, relation_type, confidence,
               created_by, note, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                relation.from_topic_id,
                relation.to_topic_id,
                relation.relation_type,
                relation.confidence,
                relation.created_by,
                relation.note,
                relation.created_at,
            ],
        )?;
    }
    let now = Utc::now().to_rfc3339();
    transaction.execute(
        "UPDATE topics SET status = ?1, updated_at = ?2 WHERE id = ?3",
        params![inverse.source_status, now, inverse.source_topic_id],
    )?;
    transaction.execute(
        "UPDATE operation_logs SET undone_at = ?1 WHERE id = ?2",
        params![now, operation_id],
    )?;
    transaction.commit()?;
    Ok(TopicMergeResult {
        operation_id,
        source_topic_id: inverse.source_topic_id,
        target_topic_id: inverse.target_topic_id,
        moved_source_count: inverse.source_links.len(),
        source_topic_status: inverse.source_status,
    })
}

pub fn preview_topic_split(connection: &Connection, topic_id: i64) -> AppResult<TopicSplitPreview> {
    let topic = list_topics(connection)?
        .into_iter()
        .find(|topic| topic.id == topic_id)
        .ok_or_else(|| AppError::NotFound("主题不存在".to_string()))?;
    let mut statement = connection.prepare(
        "SELECT source.source_type, source.id, source.title
         FROM source_topics link
         JOIN source_items source ON source.id = link.source_item_id
         WHERE link.topic_id = ?1
         ORDER BY source.source_type, source.title",
    )?;
    let rows = statement
        .query_map([topic_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let mut groups: Vec<TopicSplitGroup> = Vec::new();
    for (source_type, source_id, title) in rows {
        if let Some(group) = groups.iter_mut().find(|group| group.key == source_type) {
            group.source_item_ids.push(source_id);
            group.source_titles.push(title);
        } else {
            groups.push(TopicSplitGroup {
                key: source_type.clone(),
                label: format!("按来源类型拆分：{source_type}"),
                source_item_ids: vec![source_id],
                source_titles: vec![title],
            });
        }
    }
    Ok(TopicSplitPreview {
        topic,
        groups,
        ungrouped_source_ids: Vec::new(),
        note: "这是只读预览；确认命名和边界后再创建新主题，不会自动移动来源。".to_string(),
    })
}

pub fn suggest_topic_relations(connection: &Connection) -> AppResult<Vec<TopicRelationSuggestion>> {
    let topics = list_topics(connection)?
        .into_iter()
        .filter(|topic| topic.status != "merged")
        .collect::<Vec<_>>();
    let mut suggestions = Vec::new();
    for (index, from) in topics.iter().enumerate() {
        for to in topics.iter().skip(index + 1) {
            let from_name = normalize_name(&from.name);
            let to_name = normalize_name(&to.name);
            let (relation_type, confidence, reason) = if from_name == to_name {
                (
                    "same_topic",
                    100.0,
                    "主题规范化名称完全一致，建议人工确认是否合并".to_string(),
                )
            } else if from_name.chars().count() >= 2
                && to_name.chars().count() >= 2
                && (from_name.contains(&to_name) || to_name.contains(&from_name))
            {
                (
                    "related",
                    88.0,
                    "一个主题名称完整包含另一个主题名称".to_string(),
                )
            } else {
                continue;
            };
            suggestions.push(TopicRelationSuggestion {
                from_topic_id: from.id,
                from_topic_name: from.name.clone(),
                to_topic_id: to.id,
                to_topic_name: to.name.clone(),
                relation_type: relation_type.to_string(),
                confidence,
                reason,
            });
        }
    }
    suggestions.sort_by(|left, right| {
        right
            .confidence
            .total_cmp(&left.confidence)
            .then_with(|| left.from_topic_name.cmp(&right.from_topic_name))
    });
    Ok(suggestions)
}

pub fn create_topic_relation(
    connection: &Connection,
    input: &CreateTopicRelationInput,
) -> AppResult<TopicRelationRow> {
    const RELATION_TYPES: &[&str] = &[
        "same_topic",
        "upstream_downstream",
        "causal",
        "comparison",
        "supports",
        "opposes",
        "prerequisite",
        "follow_up",
        "same_company",
        "same_product",
        "same_event",
        "related",
    ];
    if input.from_topic_id == input.to_topic_id
        || !RELATION_TYPES.contains(&input.relation_type.as_str())
        || !(0.0..=100.0).contains(&input.confidence)
    {
        return Err(AppError::Validation("主题关系参数无效".to_string()));
    }
    let now = Utc::now().to_rfc3339();
    connection.execute(
        "INSERT INTO topic_relations(
           from_topic_id, to_topic_id, relation_type, confidence,
           created_by, note, created_at
         ) VALUES (?1, ?2, ?3, ?4, 'user', ?5, ?6)",
        params![
            input.from_topic_id,
            input.to_topic_id,
            input.relation_type,
            input.confidence,
            input.note.trim(),
            now,
        ],
    )?;
    let id = connection.last_insert_rowid();
    Ok(TopicRelationRow {
        id,
        from_topic_id: input.from_topic_id,
        to_topic_id: input.to_topic_id,
        relation_type: input.relation_type.clone(),
        confidence: input.confidence,
        created_by: "user".to_string(),
        note: input.note.trim().to_string(),
        created_at: now,
    })
}

pub fn add_topic_judgment(
    connection: &mut Connection,
    input: &AddTopicJudgmentInput,
) -> AppResult<TopicJudgmentRow> {
    let statement = input.statement_markdown.trim();
    if statement.is_empty() {
        return Err(AppError::Validation("判断内容不能为空".to_string()));
    }
    if !(0.0..=100.0).contains(&input.confidence) {
        return Err(AppError::Validation(
            "判断置信度必须在 0 到 100 之间".to_string(),
        ));
    }
    if !matches!(
        input.state.as_str(),
        "pending"
            | "tentative"
            | "current"
            | "doubtful"
            | "partially_refuted"
            | "refuted"
            | "expired"
    ) {
        return Err(AppError::Validation("判断状态无效".to_string()));
    }
    let transaction = connection.transaction()?;
    let previous_id = transaction
        .query_row(
            "SELECT id FROM judgment_snapshots
             WHERE topic_id = ?1 AND replaced_by_id IS NULL
             ORDER BY effective_at DESC, id DESC LIMIT 1",
            [input.topic_id],
            |row| row.get::<_, i64>(0),
        )
        .ok();
    let now = Utc::now().to_rfc3339();
    let public_id = format!("judgment-{}", Uuid::new_v4());
    transaction.execute(
        "INSERT INTO judgment_snapshots(
           public_id, topic_id, statement_markdown, state, confidence,
           change_reason, effective_at, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        params![
            public_id,
            input.topic_id,
            statement,
            input.state,
            input.confidence,
            input.change_reason.trim(),
            now,
        ],
    )?;
    let id = transaction.last_insert_rowid();
    if let Some(previous_id) = previous_id {
        transaction.execute(
            "UPDATE judgment_snapshots SET replaced_by_id = ?1 WHERE id = ?2",
            params![id, previous_id],
        )?;
        if !input.change_reason.trim().is_empty() {
            transaction.execute(
                "INSERT INTO turning_points(
                   public_id, topic_id, from_judgment_id, to_judgment_id,
                   title, explanation, occurred_at, created_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
                params![
                    format!("turning-point-{}", Uuid::new_v4()),
                    input.topic_id,
                    previous_id,
                    id,
                    "判断发生变化",
                    input.change_reason.trim(),
                    now,
                ],
            )?;
        }
    }
    transaction.commit()?;
    Ok(TopicJudgmentRow {
        id,
        public_id,
        statement_markdown: statement.to_string(),
        state: input.state.clone(),
        confidence: input.confidence,
        change_reason: input.change_reason.trim().to_string(),
        effective_at: now.clone(),
        created_at: now,
    })
}

pub fn add_topic_evidence(
    connection: &Connection,
    input: &AddTopicEvidenceInput,
) -> AppResult<TopicEvidenceRow> {
    let content = input.content_markdown.trim();
    if content.is_empty() {
        return Err(AppError::Validation("证据内容不能为空".to_string()));
    }
    if !(0.0..=100.0).contains(&input.credibility)
        || !matches!(input.stance.as_str(), "support" | "oppose" | "context")
    {
        return Err(AppError::Validation("证据立场或可信度无效".to_string()));
    }
    connection
        .query_row(
            "SELECT 1 FROM source_topics WHERE source_item_id = ?1 AND topic_id = ?2",
            params![input.source_item_id, input.topic_id],
            |_| Ok(()),
        )
        .map_err(|_| AppError::Validation("证据来源必须先归入当前主题".to_string()))?;
    let now = Utc::now().to_rfc3339();
    let public_id = format!("evidence-{}", Uuid::new_v4());
    let locator_json = if input.locator_json.trim().is_empty() {
        "{}"
    } else {
        serde_json::from_str::<serde_json::Value>(&input.locator_json)?;
        input.locator_json.as_str()
    };
    connection.execute(
        "INSERT INTO evidence(
           public_id, topic_id, source_item_id, content_markdown, stance,
           credibility, locator_json, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            public_id,
            input.topic_id,
            input.source_item_id,
            content,
            input.stance,
            input.credibility,
            locator_json,
            now,
        ],
    )?;
    Ok(get_topic_detail(connection, input.topic_id)?
        .evidence
        .into_iter()
        .find(|item| item.public_id == public_id)
        .ok_or_else(|| AppError::NotFound("证据写入后无法读取".to_string()))?)
}

pub fn add_topic_question(
    connection: &Connection,
    input: &AddTopicQuestionInput,
) -> AppResult<TopicQuestionRow> {
    let question = input.question.trim();
    if question.is_empty() {
        return Err(AppError::Validation("待验证问题不能为空".to_string()));
    }
    if !matches!(input.importance.as_str(), "low" | "medium" | "high") {
        return Err(AppError::Validation("问题重要度无效".to_string()));
    }
    let now = Utc::now().to_rfc3339();
    let public_id = format!("question-{}", Uuid::new_v4());
    connection.execute(
        "INSERT INTO open_questions(
           public_id, topic_id, question, importance, affects_current_judgment,
           created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        params![
            public_id,
            input.topic_id,
            question,
            input.importance,
            input.affects_current_judgment as i64,
            now,
        ],
    )?;
    Ok(get_topic_detail(connection, input.topic_id)?
        .questions
        .into_iter()
        .find(|item| item.public_id == public_id)
        .ok_or_else(|| AppError::NotFound("问题写入后无法读取".to_string()))?)
}

pub fn compile_topic_context(connection: &Connection, topic_id: i64) -> AppResult<String> {
    let detail = get_topic_detail(connection, topic_id)?;
    let mut sections = vec![
        format!("# {}", detail.topic.name),
        detail.topic.description.clone(),
    ];
    if let Some(current) = detail.judgments.first() {
        sections.push(format!(
            "## 当前判断\n\n{}\n\n- 状态：{}\n- 置信度：{}%\n- 生效时间：{}",
            current.statement_markdown,
            current.state,
            current.confidence.round(),
            current.effective_at
        ));
    }
    if !detail.evidence.is_empty() {
        sections.push(format!(
            "## 证据\n\n{}",
            detail
                .evidence
                .iter()
                .map(|item| format!(
                    "- [{}] {}（来源：{}；可信度：{}%；锚点：{}）",
                    item.stance,
                    item.content_markdown,
                    item.source_title,
                    item.credibility.round(),
                    item.locator_json
                ))
                .collect::<Vec<_>>()
                .join("\n")
        ));
    }
    let open_questions = detail
        .questions
        .iter()
        .filter(|question| matches!(question.status.as_str(), "open" | "investigating"))
        .collect::<Vec<_>>();
    if !open_questions.is_empty() {
        sections.push(format!(
            "## 待验证问题\n\n{}",
            open_questions
                .iter()
                .map(|item| format!("- [{}] {}", item.importance, item.question))
                .collect::<Vec<_>>()
                .join("\n")
        ));
    }
    if !detail.sources.is_empty() {
        sections.push(format!(
            "## 来源边界\n\n{}",
            detail
                .sources
                .iter()
                .map(|item| format!(
                    "- `{}` {}（{}；{}）",
                    item.public_id,
                    item.title,
                    item.source_type,
                    item.original_at.as_deref().unwrap_or("时间未知")
                ))
                .collect::<Vec<_>>()
                .join("\n")
        ));
    }
    sections.retain(|section| !section.trim().is_empty());
    Ok(sections.join("\n\n"))
}

pub fn save_classification_suggestions(
    connection: &mut Connection,
    input: &SaveKnowledgeSuggestionsInput,
) -> AppResult<Vec<KnowledgeClassificationSuggestionRow>> {
    if input.classifier_version.trim().is_empty() {
        return Err(AppError::Validation("分类器版本不能为空".to_string()));
    }
    let transaction = connection.transaction()?;
    let source_exists = transaction.query_row(
        "SELECT EXISTS(SELECT 1 FROM source_items WHERE id = ?1 AND organization_state = 'inbox')",
        [input.source_item_id],
        |row| row.get::<_, i64>(0),
    )? != 0;
    if !source_exists {
        return Err(AppError::Validation("来源不存在或已经完成整理".to_string()));
    }
    transaction.execute(
        "DELETE FROM classification_suggestions
         WHERE source_item_id = ?1 AND status = 'pending'",
        [input.source_item_id],
    )?;
    let created_at = Utc::now().to_rfc3339();
    for suggestion in input.suggestions.iter().take(5) {
        if !(0.0..=100.0).contains(&suggestion.score) {
            return Err(AppError::Validation(
                "分类置信度必须在 0 到 100 之间".to_string(),
            ));
        }
        if !matches!(
            suggestion.decision.as_str(),
            "auto_eligible" | "confirm" | "candidates" | "manual"
        ) {
            return Err(AppError::Validation("分类动作无效".to_string()));
        }
        transaction.execute(
            "INSERT INTO classification_suggestions(
               public_id, source_item_id, suggested_topic_id, score, decision,
               reasons_json, signal_scores_json, classifier_version, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                format!("suggestion-{}", Uuid::new_v4()),
                input.source_item_id,
                suggestion.topic_id,
                suggestion.score,
                suggestion.decision,
                serde_json::to_string(&suggestion.reasons)?,
                if suggestion.signal_scores_json.trim().is_empty() {
                    "{}"
                } else {
                    suggestion.signal_scores_json.as_str()
                },
                input.classifier_version,
                created_at,
            ],
        )?;
    }
    transaction.commit()?;
    list_classification_suggestions(connection, input.source_item_id)
}

pub fn list_classification_suggestions(
    connection: &Connection,
    source_item_id: i64,
) -> AppResult<Vec<KnowledgeClassificationSuggestionRow>> {
    let mut statement = connection.prepare(
        "SELECT id, public_id, source_item_id, suggested_topic_id, score, decision,
                reasons_json, signal_scores_json, classifier_version, status, created_at
         FROM classification_suggestions
         WHERE source_item_id = ?1
         ORDER BY score DESC, id",
    )?;
    let rows = statement.query_map([source_item_id], |row| {
        let reasons_json = row.get::<_, String>(6)?;
        Ok(KnowledgeClassificationSuggestionRow {
            id: row.get(0)?,
            public_id: row.get(1)?,
            source_item_id: row.get(2)?,
            suggested_topic_id: row.get(3)?,
            score: row.get(4)?,
            decision: row.get(5)?,
            reasons: serde_json::from_str(&reasons_json).unwrap_or_default(),
            signal_scores_json: row.get(7)?,
            classifier_version: row.get(8)?,
            status: row.get(9)?,
            created_at: row.get(10)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn confirm_classification(
    connection: &mut Connection,
    input: &ConfirmKnowledgeClassificationInput,
) -> AppResult<KnowledgeOperationResult> {
    if !(0.0..=100.0).contains(&input.confidence) {
        return Err(AppError::Validation(
            "分类置信度必须在 0 到 100 之间".to_string(),
        ));
    }
    let transaction = connection.transaction()?;
    let source_state = transaction
        .query_row(
            "SELECT organization_state FROM source_items WHERE id = ?1",
            [input.source_item_id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|_| AppError::NotFound("来源不存在".to_string()))?;
    transaction
        .query_row(
            "SELECT 1 FROM topics WHERE id = ?1 AND status <> 'merged'",
            [input.topic_id],
            |_| Ok(()),
        )
        .map_err(|_| AppError::NotFound("目标主题不存在".to_string()))?;
    let before = serde_json::json!({
        "sourceItemId": input.source_item_id,
        "organizationState": source_state,
    });
    transaction.execute(
        "DELETE FROM source_topics WHERE source_item_id = ?1 AND role = 'primary'",
        [input.source_item_id],
    )?;
    transaction.execute(
        "INSERT INTO source_topics(
           source_item_id, topic_id, role, confidence, classification_suggestion_id, created_at
         ) VALUES (?1, ?2, 'primary', ?3, ?4, ?5)
         ON CONFLICT(source_item_id, topic_id) DO UPDATE SET
           role = 'primary',
           confidence = excluded.confidence,
           classification_suggestion_id = excluded.classification_suggestion_id,
           created_at = excluded.created_at",
        params![
            input.source_item_id,
            input.topic_id,
            input.confidence,
            input.suggestion_id,
            Utc::now().to_rfc3339(),
        ],
    )?;
    transaction.execute(
        "UPDATE source_items SET organization_state = 'organized', read_state = 'read'
         WHERE id = ?1",
        [input.source_item_id],
    )?;
    transaction.execute(
        "UPDATE classification_suggestions
         SET status = CASE WHEN id = ?2 THEN 'accepted' ELSE 'rejected' END,
             reviewed_at = ?3
         WHERE source_item_id = ?1 AND status = 'pending'",
        params![
            input.source_item_id,
            input.suggestion_id,
            Utc::now().to_rfc3339()
        ],
    )?;
    let operation_public_id = format!("operation-{}", Uuid::new_v4());
    let after = serde_json::json!({
        "sourceItemId": input.source_item_id,
        "topicId": input.topic_id,
        "organizationState": "organized",
        "confidence": input.confidence,
        "suggestionId": input.suggestion_id,
    });
    transaction.execute(
        "INSERT INTO operation_logs(
           public_id, operation_type, entity_type, entity_public_id,
           before_json, after_json, inverse_json, actor, created_at
         ) VALUES (?1, 'classification', 'source_item', ?2, ?3, ?4, ?5, 'user', ?6)",
        params![
            operation_public_id,
            input.source_item_id.to_string(),
            before.to_string(),
            after.to_string(),
            before.to_string(),
            Utc::now().to_rfc3339(),
        ],
    )?;
    let operation_id = transaction.last_insert_rowid();
    transaction.commit()?;
    Ok(KnowledgeOperationResult {
        operation_id,
        source_item_id: input.source_item_id,
        topic_id: Some(input.topic_id),
        organization_state: "organized".to_string(),
    })
}

pub fn undo_classification(
    connection: &mut Connection,
    operation_id: i64,
) -> AppResult<KnowledgeOperationResult> {
    let transaction = connection.transaction()?;
    let (source_item_id, undone_at) = transaction
        .query_row(
            "SELECT CAST(entity_public_id AS INTEGER), undone_at
             FROM operation_logs
             WHERE id = ?1 AND operation_type = 'classification'",
            [operation_id],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .map_err(|_| AppError::NotFound("可撤销的分类操作不存在".to_string()))?;
    if undone_at.is_some() {
        return Err(AppError::Conflict("这次分类已经撤销".to_string()));
    }
    transaction.execute(
        "DELETE FROM source_topics WHERE source_item_id = ?1 AND role = 'primary'",
        [source_item_id],
    )?;
    transaction.execute(
        "UPDATE source_items SET organization_state = 'inbox' WHERE id = ?1",
        [source_item_id],
    )?;
    transaction.execute(
        "UPDATE classification_suggestions
         SET status = 'undone'
         WHERE source_item_id = ?1 AND status = 'accepted'",
        [source_item_id],
    )?;
    transaction.execute(
        "UPDATE operation_logs SET undone_at = ?1 WHERE id = ?2",
        params![Utc::now().to_rfc3339(), operation_id],
    )?;
    transaction.commit()?;
    Ok(KnowledgeOperationResult {
        operation_id,
        source_item_id,
        topic_id: None,
        organization_state: "inbox".to_string(),
    })
}

pub fn create_domain(
    connection: &Connection,
    input: &CreateKnowledgeDomainInput,
) -> AppResult<KnowledgeDomainRow> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(AppError::Validation("领域名称不能为空".to_string()));
    }
    let now = Utc::now().to_rfc3339();
    let public_id = format!("domain-{}", Uuid::new_v4());
    connection.execute(
        "INSERT INTO domains(public_id, name, normalized_name, description, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![
            public_id,
            name,
            normalize_name(name),
            input.description.trim(),
            now
        ],
    )?;
    let id = connection.last_insert_rowid();
    Ok(KnowledgeDomainRow {
        id,
        public_id,
        name: name.to_string(),
        description: input.description.trim().to_string(),
        sort_order: 0,
    })
}

pub fn create_topic(
    connection: &Connection,
    input: &CreateKnowledgeTopicInput,
) -> AppResult<KnowledgeTopicRow> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(AppError::Validation("主题名称不能为空".to_string()));
    }
    let depth = match input.parent_topic_id {
        Some(parent_id) => connection
            .query_row(
                "SELECT depth + 1 FROM topics WHERE id = ?1 AND domain_id = ?2",
                params![parent_id, input.domain_id],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|_| AppError::Validation("父主题不存在或不属于当前领域".to_string()))?,
        None => 1,
    };
    let now = Utc::now().to_rfc3339();
    let public_id = format!("topic-{}", Uuid::new_v4());
    connection.execute(
        "INSERT INTO topics(
           public_id, domain_id, parent_topic_id, name, normalized_name,
           description, topic_kind, depth, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
        params![
            public_id,
            input.domain_id,
            input.parent_topic_id,
            name,
            normalize_name(name),
            input.description.trim(),
            input.topic_kind,
            depth,
            now,
        ],
    )?;
    Ok(KnowledgeTopicRow {
        id: connection.last_insert_rowid(),
        public_id,
        domain_id: input.domain_id,
        parent_topic_id: input.parent_topic_id,
        name: name.to_string(),
        description: input.description.trim().to_string(),
        topic_kind: input.topic_kind.clone(),
        status: "active".to_string(),
        depth,
        sort_order: 0,
        source_count: 0,
    })
}

fn count_topic_rows(connection: &Connection, table: &str, topic_id: i64) -> AppResult<i64> {
    Ok(connection.query_row(
        &format!("SELECT COUNT(*) FROM {table} WHERE topic_id = ?1"),
        [topic_id],
        |row| row.get(0),
    )?)
}

fn topic_row_ids(connection: &Connection, table: &str, topic_id: i64) -> AppResult<Vec<i64>> {
    topic_row_ids_by_column(connection, table, "topic_id", topic_id)
}

fn topic_row_ids_by_column(
    connection: &Connection,
    table: &str,
    column: &str,
    topic_id: i64,
) -> AppResult<Vec<i64>> {
    let mut statement = connection.prepare(&format!(
        "SELECT id FROM {table} WHERE {column} = ?1 ORDER BY id"
    ))?;
    let ids = statement
        .query_map([topic_id], |row| row.get::<_, i64>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ids)
}

fn restore_topic_ids(
    connection: &Connection,
    table: &str,
    ids: &[i64],
    topic_id: i64,
) -> AppResult<()> {
    restore_topic_ids_by_column(connection, table, "topic_id", ids, topic_id)
}

fn restore_topic_ids_by_column(
    connection: &Connection,
    table: &str,
    column: &str,
    ids: &[i64],
    topic_id: i64,
) -> AppResult<()> {
    for id in ids {
        connection.execute(
            &format!("UPDATE {table} SET {column} = ?1 WHERE id = ?2"),
            params![topic_id, id],
        )?;
    }
    Ok(())
}

fn read_topic_relations(
    connection: &Connection,
    topic_id: i64,
) -> AppResult<Vec<MergeRelationSnapshot>> {
    let mut statement = connection.prepare(
        "SELECT from_topic_id, to_topic_id, relation_type, confidence,
                created_by, note, created_at
         FROM topic_relations
         WHERE from_topic_id = ?1 OR to_topic_id = ?1
         ORDER BY id",
    )?;
    let relations = statement
        .query_map([topic_id], |row| {
            Ok(MergeRelationSnapshot {
                from_topic_id: row.get(0)?,
                to_topic_id: row.get(1)?,
                relation_type: row.get(2)?,
                confidence: row.get(3)?,
                created_by: row.get(4)?,
                note: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(relations)
}

fn normalize_source_type(source_type: &str, local_path: Option<&str>) -> &'static str {
    let extension = local_path
        .and_then(|path| std::path::Path::new(path).extension())
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    match source_type.to_ascii_lowercase().as_str() {
        "conversation" | "chatgpt" | "claude" => "ai_conversation",
        "markdown" | "md" => "markdown",
        "json" => "json",
        "html" => "html",
        "text" | "txt" => "text",
        "web" | "url" => "web",
        _ => match extension.as_str() {
            "pdf" => "pdf",
            "mp3" | "wav" | "m4a" | "flac" => "audio",
            "mp4" | "mov" | "mkv" | "webm" => "video",
            "srt" | "vtt" | "ass" => "subtitle",
            "png" | "jpg" | "jpeg" | "gif" | "webp" => "image",
            _ => "file",
        },
    }
}

fn normalize_name(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database;
    use crate::models::CreateRecordInput;

    #[test]
    fn legacy_records_enter_real_inbox_and_topics_support_unlimited_depth() {
        let mut connection = database::open_memory_database().expect("database");
        let record = database::create_record(
            &mut connection,
            &CreateRecordInput {
                title: "真实收录箱来源".to_string(),
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
                source_text: "可分类正文".to_string(),
                sources: Vec::new(),
                is_favorite: false,
            },
        )
        .expect("record");
        sync_legacy_record(&mut connection, record.id).expect("sync");
        let inbox = list_inbox(&connection, 20).expect("inbox");
        assert_eq!(inbox.len(), 1);
        assert_eq!(inbox[0].legacy_record_id, Some(record.id));

        let domain = create_domain(
            &connection,
            &CreateKnowledgeDomainInput {
                name: "技术".to_string(),
                description: String::new(),
            },
        )
        .expect("domain");
        let mut parent = None;
        for depth in 1..=5 {
            let topic = create_topic(
                &connection,
                &CreateKnowledgeTopicInput {
                    domain_id: domain.id,
                    parent_topic_id: parent,
                    name: format!("第{depth}层"),
                    description: String::new(),
                    topic_kind: "subject".to_string(),
                },
            )
            .expect("topic");
            assert_eq!(topic.depth, depth);
            parent = Some(topic.id);
        }
    }

    #[test]
    fn classification_confirmation_is_persisted_and_undoable() {
        let mut connection = database::open_memory_database().expect("database");
        let record = database::create_record(
            &mut connection,
            &CreateRecordInput {
                title: "分类确认来源".to_string(),
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
                source_text: "GPU 与本地知识库".to_string(),
                sources: Vec::new(),
                is_favorite: false,
            },
        )
        .expect("record");
        let source_id = list_inbox(&connection, 20).expect("inbox")[0].id;
        let domain = create_domain(
            &connection,
            &CreateKnowledgeDomainInput {
                name: "技术".to_string(),
                description: String::new(),
            },
        )
        .expect("domain");
        let topic = create_topic(
            &connection,
            &CreateKnowledgeTopicInput {
                domain_id: domain.id,
                parent_topic_id: None,
                name: "本地知识库".to_string(),
                description: String::new(),
                topic_kind: "subject".to_string(),
            },
        )
        .expect("topic");
        let suggestions = save_classification_suggestions(
            &mut connection,
            &SaveKnowledgeSuggestionsInput {
                source_item_id: source_id,
                classifier_version: "local-rules-v1".to_string(),
                suggestions: vec![KnowledgeSuggestionInput {
                    topic_id: Some(topic.id),
                    score: 82.0,
                    decision: "confirm".to_string(),
                    reasons: vec!["主题名称命中".to_string()],
                    signal_scores_json: "{}".to_string(),
                }],
            },
        )
        .expect("suggestions");
        let result = confirm_classification(
            &mut connection,
            &ConfirmKnowledgeClassificationInput {
                source_item_id: source_id,
                topic_id: topic.id,
                suggestion_id: Some(suggestions[0].id),
                confidence: 82.0,
            },
        )
        .expect("confirm");
        assert!(list_inbox(&connection, 20).expect("inbox").is_empty());
        add_topic_judgment(
            &mut connection,
            &AddTopicJudgmentInput {
                topic_id: topic.id,
                statement_markdown: "当前判断正文".to_string(),
                confidence: 78.0,
                state: "current".to_string(),
                change_reason: "首次形成判断".to_string(),
            },
        )
        .expect("judgment");
        add_topic_evidence(
            &connection,
            &AddTopicEvidenceInput {
                topic_id: topic.id,
                source_item_id: source_id,
                content_markdown: "原始来源中的证据".to_string(),
                stance: "support".to_string(),
                credibility: 80.0,
                locator_json: r#"{"messageId":"m-1"}"#.to_string(),
            },
        )
        .expect("evidence");
        add_topic_question(
            &connection,
            &AddTopicQuestionInput {
                topic_id: topic.id,
                question: "仍需确认什么？".to_string(),
                importance: "high".to_string(),
                affects_current_judgment: true,
            },
        )
        .expect("question");
        let context = compile_topic_context(&connection, topic.id).expect("context");
        assert!(context.contains("当前判断正文"));
        assert!(context.contains("原始来源中的证据"));
        assert!(context.contains("仍需确认什么"));
        assert!(context.contains("来源边界"));
        undo_classification(&mut connection, result.operation_id).expect("undo");
        assert_eq!(
            list_inbox(&connection, 20).expect("inbox")[0].legacy_record_id,
            Some(record.id)
        );
    }

    #[test]
    fn topic_merge_is_previewed_committed_and_undoable_without_losing_knowledge() {
        let mut connection = database::open_memory_database().expect("database");
        for (title, content) in [("Markdown 来源", "知识库设计"), ("PDF 来源", "知识库证据")]
        {
            database::create_record(
                &mut connection,
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
                    source_text: content.to_string(),
                    sources: Vec::new(),
                    is_favorite: false,
                },
            )
            .expect("record");
        }
        let inbox = list_inbox(&connection, 20).expect("inbox");
        connection
            .execute(
                "UPDATE source_items SET source_type = 'markdown' WHERE id = ?1",
                [inbox[0].id],
            )
            .expect("source type");
        connection
            .execute(
                "UPDATE source_items SET source_type = 'pdf' WHERE id = ?1",
                [inbox[1].id],
            )
            .expect("source type");
        let domain = create_domain(
            &connection,
            &CreateKnowledgeDomainInput {
                name: "知识管理".to_string(),
                description: String::new(),
            },
        )
        .expect("domain");
        let source_topic = create_topic(
            &connection,
            &CreateKnowledgeTopicInput {
                domain_id: domain.id,
                parent_topic_id: None,
                name: "知识库".to_string(),
                description: String::new(),
                topic_kind: "subject".to_string(),
            },
        )
        .expect("source topic");
        let target_topic = create_topic(
            &connection,
            &CreateKnowledgeTopicInput {
                domain_id: domain.id,
                parent_topic_id: None,
                name: "个人知识库".to_string(),
                description: String::new(),
                topic_kind: "subject".to_string(),
            },
        )
        .expect("target topic");
        let related_topic = create_topic(
            &connection,
            &CreateKnowledgeTopicInput {
                domain_id: domain.id,
                parent_topic_id: None,
                name: "知识库工具".to_string(),
                description: String::new(),
                topic_kind: "subject".to_string(),
            },
        )
        .expect("related topic");
        for item in &inbox {
            confirm_classification(
                &mut connection,
                &ConfirmKnowledgeClassificationInput {
                    source_item_id: item.id,
                    topic_id: source_topic.id,
                    suggestion_id: None,
                    confidence: 90.0,
                },
            )
            .expect("classification");
        }
        add_topic_judgment(
            &mut connection,
            &AddTopicJudgmentInput {
                topic_id: source_topic.id,
                statement_markdown: "合并前判断".to_string(),
                confidence: 80.0,
                state: "current".to_string(),
                change_reason: String::new(),
            },
        )
        .expect("judgment");
        add_topic_evidence(
            &connection,
            &AddTopicEvidenceInput {
                topic_id: source_topic.id,
                source_item_id: inbox[0].id,
                content_markdown: "合并前证据".to_string(),
                stance: "support".to_string(),
                credibility: 80.0,
                locator_json: "{}".to_string(),
            },
        )
        .expect("evidence");
        add_topic_question(
            &connection,
            &AddTopicQuestionInput {
                topic_id: source_topic.id,
                question: "合并前问题".to_string(),
                importance: "medium".to_string(),
                affects_current_judgment: false,
            },
        )
        .expect("question");
        create_topic_relation(
            &connection,
            &CreateTopicRelationInput {
                from_topic_id: source_topic.id,
                to_topic_id: related_topic.id,
                relation_type: "related".to_string(),
                confidence: 88.0,
                note: "合并前关系".to_string(),
            },
        )
        .expect("relation");

        let split = preview_topic_split(&connection, source_topic.id).expect("split");
        assert_eq!(split.groups.len(), 2);
        let relation_suggestions = suggest_topic_relations(&connection).expect("relations");
        assert!(relation_suggestions.iter().any(|item| {
            item.from_topic_id == source_topic.id || item.to_topic_id == source_topic.id
        }));
        let preview =
            preview_topic_merge(&connection, source_topic.id, target_topic.id).expect("preview");
        assert!(preview.blockers.is_empty());
        assert_eq!(preview.source_links_to_move, 2);
        let merged = merge_topics(
            &mut connection,
            &MergeTopicsInput {
                source_topic_id: source_topic.id,
                target_topic_id: target_topic.id,
            },
        )
        .expect("merge");
        let target_detail = get_topic_detail(&connection, target_topic.id).expect("target detail");
        assert_eq!(target_detail.sources.len(), 2);
        assert_eq!(target_detail.judgments.len(), 1);
        assert_eq!(target_detail.evidence.len(), 1);
        assert_eq!(target_detail.questions.len(), 1);
        assert_eq!(
            list_topics(&connection)
                .expect("topics")
                .into_iter()
                .find(|topic| topic.id == source_topic.id)
                .expect("source")
                .status,
            "merged"
        );
        undo_topic_merge(&mut connection, merged.operation_id).expect("undo merge");
        let source_detail = get_topic_detail(&connection, source_topic.id).expect("source detail");
        assert_eq!(source_detail.sources.len(), 2);
        assert_eq!(source_detail.judgments.len(), 1);
        assert_eq!(source_detail.evidence.len(), 1);
        assert_eq!(source_detail.questions.len(), 1);
        assert_eq!(
            get_topic_detail(&connection, target_topic.id)
                .expect("target")
                .sources
                .len(),
            0
        );
    }
}
