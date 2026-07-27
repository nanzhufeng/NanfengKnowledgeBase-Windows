use std::collections::{HashMap, HashSet};
use std::path::Path;

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::knowledge::personal_catalog;

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

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClassificationSourceContext {
    pub id: String,
    pub title: String,
    pub text: String,
    pub kind: String,
    pub platform: Option<String>,
    pub file_name: Option<String>,
    pub file_path: Option<String>,
    pub folder_path: Option<String>,
    pub tags: Vec<String>,
    pub json_fields: HashMap<String, String>,
    pub imported_at: String,
    pub batch_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClassificationTopicContext {
    pub id: String,
    pub primary_domain_id: String,
    pub path: Vec<String>,
    pub name: String,
    pub aliases: Vec<String>,
    pub entities: Vec<String>,
    pub keywords: Vec<String>,
    pub search_document: String,
    pub status: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClassificationRuleContext {
    pub id: String,
    pub topic_id: String,
    pub field: String,
    pub operator: String,
    pub effect: String,
    pub value: String,
    pub json_field: Option<String>,
    pub strength: f64,
    pub reason: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClassificationHistoryContext {
    pub confirmed_topic_counts: HashMap<String, i64>,
    pub recent_topic_ids: Vec<String>,
    pub batch_topic_ids: HashMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClassificationSearchSignal {
    pub topic_id: String,
    pub normalized_score: f64,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeClassificationContext {
    pub source: ClassificationSourceContext,
    pub topics: Vec<ClassificationTopicContext>,
    pub rules: Vec<ClassificationRuleContext>,
    pub history: ClassificationHistoryContext,
    pub search_signals: Vec<ClassificationSearchSignal>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyPersonalCatalogInput {
    pub version: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplyPersonalCatalogResult {
    pub version: String,
    pub created_domains: usize,
    pub existing_domains: usize,
    pub created_topics: usize,
    pub existing_topics: usize,
    pub created_aliases: usize,
    pub created_entities: usize,
    pub created_rules: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TopicAliasRow {
    pub id: i64,
    pub topic_id: i64,
    pub alias: String,
    pub alias_type: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTopicAliasInput {
    pub topic_id: i64,
    pub alias: String,
    pub alias_type: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTopicAliasInput {
    pub id: i64,
    pub alias: String,
    pub alias_type: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EntityDictionaryRow {
    pub id: i64,
    pub canonical_name: String,
    pub entity_type: String,
    pub aliases: Vec<String>,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEntityDictionaryInput {
    pub canonical_name: String,
    pub entity_type: String,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEntityDictionaryInput {
    pub id: i64,
    pub canonical_name: String,
    pub entity_type: String,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClassificationRuleRow {
    pub id: i64,
    pub public_id: String,
    pub rule_type: String,
    pub pattern: String,
    pub target_domain_id: Option<i64>,
    pub target_topic_id: Option<i64>,
    pub weight: f64,
    pub priority: i64,
    pub enabled: bool,
    pub config_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateClassificationRuleInput {
    pub rule_type: String,
    pub pattern: String,
    pub target_domain_id: Option<i64>,
    pub target_topic_id: Option<i64>,
    pub weight: f64,
    pub priority: i64,
    pub enabled: bool,
    #[serde(default)]
    pub config_json: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateClassificationRuleInput {
    pub id: i64,
    pub rule_type: String,
    pub pattern: String,
    pub target_domain_id: Option<i64>,
    pub target_topic_id: Option<i64>,
    pub weight: f64,
    pub priority: i64,
    pub enabled: bool,
    #[serde(default)]
    pub config_json: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeDeleteResult {
    pub id: i64,
    pub deleted: bool,
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
    pub redirect_aliases: Vec<String>,
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
    #[serde(default)]
    inserted_redirect_alias_ids: Vec<i64>,
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
    pub locator_label: String,
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

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TopicPropositionRow {
    pub id: i64,
    pub public_id: String,
    pub topic_id: i64,
    pub statement_markdown: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TopicTurningPointRow {
    pub id: i64,
    pub public_id: String,
    pub topic_id: i64,
    pub from_judgment_id: Option<i64>,
    pub from_statement_markdown: Option<String>,
    pub to_judgment_id: i64,
    pub to_statement_markdown: String,
    pub title: String,
    pub explanation: String,
    pub occurred_at: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeNoteRow {
    pub id: i64,
    pub public_id: String,
    pub title: String,
    pub body_markdown: String,
    pub summary: String,
    pub note_type: String,
    pub status: String,
    pub organization_state: String,
    pub primary_topic_id: i64,
    pub related_topic_ids: Vec<i64>,
    pub source_item_ids: Vec<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateKnowledgeNoteInput {
    pub title: String,
    #[serde(default)]
    pub body_markdown: String,
    #[serde(default)]
    pub summary: String,
    pub note_type: String,
    pub status: String,
    pub organization_state: String,
    pub primary_topic_id: i64,
    #[serde(default)]
    pub related_topic_ids: Vec<i64>,
    #[serde(default)]
    pub source_item_ids: Vec<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateKnowledgeNoteInput {
    pub id: i64,
    pub title: String,
    #[serde(default)]
    pub body_markdown: String,
    #[serde(default)]
    pub summary: String,
    pub note_type: String,
    pub status: String,
    pub organization_state: String,
    pub primary_topic_id: i64,
    #[serde(default)]
    pub related_topic_ids: Vec<i64>,
    #[serde(default)]
    pub source_item_ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeTopicDetail {
    pub topic: KnowledgeTopicRow,
    pub sources: Vec<TopicSourceRow>,
    pub judgments: Vec<TopicJudgmentRow>,
    pub evidence: Vec<TopicEvidenceRow>,
    pub questions: Vec<TopicQuestionRow>,
    pub notes: Vec<KnowledgeNoteRow>,
    pub propositions: Vec<TopicPropositionRow>,
    pub turning_points: Vec<TopicTurningPointRow>,
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
    #[serde(default = "default_evidence_verification_status")]
    pub verification_status: String,
    #[serde(default = "default_evidence_validity_status")]
    pub validity_status: String,
    #[serde(default)]
    pub locator_json: String,
}

fn default_evidence_stance() -> String {
    "context".to_string()
}

fn default_evidence_verification_status() -> String {
    "unverified".to_string()
}

fn default_evidence_validity_status() -> String {
    "active".to_string()
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTopicPropositionInput {
    pub topic_id: i64,
    pub statement_markdown: String,
    #[serde(default = "default_proposition_status")]
    pub status: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTopicPropositionInput {
    pub id: i64,
    pub statement_markdown: String,
    pub status: String,
}

fn default_proposition_status() -> String {
    "open".to_string()
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTopicTurningPointInput {
    pub topic_id: i64,
    pub from_judgment_id: Option<i64>,
    pub to_judgment_id: i64,
    pub title: String,
    #[serde(default)]
    pub explanation: String,
    #[serde(default)]
    pub occurred_at: String,
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

pub fn prepare_classification_context(
    connection: &Connection,
    source_item_id: i64,
) -> AppResult<KnowledgeClassificationContext> {
    let (
        public_id,
        title,
        text,
        source_type,
        platform,
        local_path,
        metadata_json,
        imported_at,
        legacy_record_id,
    ) = connection
        .query_row(
            "SELECT public_id, title, original_text, source_type, platform, local_path,
                    metadata_json, imported_at, legacy_record_id
             FROM source_items
             WHERE id = ?1 AND status = 'active'",
            [source_item_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, Option<i64>>(8)?,
                ))
            },
        )
        .map_err(|_| AppError::NotFound("待分类来源不存在".to_string()))?;
    let metadata = serde_json::from_str::<serde_json::Value>(&metadata_json)
        .unwrap_or_else(|_| serde_json::json!({}));
    let batch_id = metadata
        .get("batchId")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let mut json_fields = HashMap::new();
    if let Some(object) = metadata.as_object() {
        for (key, value) in object {
            if let Some(value) = value.as_str() {
                json_fields.insert(key.clone(), value.to_string());
            }
        }
    }
    let tags = if let Some(record_id) = legacy_record_id {
        let mut statement = connection.prepare(
            "SELECT tag.name
             FROM record_tags record_tag
             JOIN tags tag ON tag.id = record_tag.tag_id
             WHERE record_tag.record_id = ?1
             ORDER BY tag.name",
        )?;
        let tags = statement
            .query_map([record_id], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        tags
    } else {
        metadata
            .get("tags")
            .and_then(serde_json::Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(serde_json::Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default()
    };
    let file_name = local_path
        .as_deref()
        .and_then(|path| Path::new(path).file_name())
        .map(|name| name.to_string_lossy().into_owned());
    let folder_path = local_path
        .as_deref()
        .and_then(|path| Path::new(path).parent())
        .map(|parent| parent.to_string_lossy().into_owned());
    let source = ClassificationSourceContext {
        id: public_id,
        title,
        text,
        kind: source_type,
        platform: (!platform.trim().is_empty()).then_some(platform),
        file_name,
        file_path: local_path,
        folder_path,
        tags,
        json_fields,
        imported_at,
        batch_id: batch_id.clone(),
    };

    let topic_rows = list_topics(connection)?;
    let persisted_rules = read_persisted_classification_rules(connection)?;
    let entity_dictionary = read_entity_dictionary(connection)?;
    let mut topics = Vec::with_capacity(topic_rows.len());
    for topic in &topic_rows {
        let aliases = read_topic_aliases(connection, topic.id)?;
        let topic_rules = persisted_rules
            .iter()
            .filter(|rule| rule.topic_id == topic.id.to_string())
            .collect::<Vec<_>>();
        let mut entities = topic_rules
            .iter()
            .filter(|rule| rule.field == "text" && rule.id.starts_with("entity:"))
            .map(|rule| rule.value.clone())
            .collect::<Vec<_>>();
        expand_entities(&mut entities, &entity_dictionary);
        let mut keywords = topic_rules
            .iter()
            .filter(|rule| rule.field == "text")
            .map(|rule| rule.value.clone())
            .collect::<Vec<_>>();
        keywords.extend(split_search_terms(&topic.description));
        deduplicate_strings(&mut entities);
        deduplicate_strings(&mut keywords);
        let mut search_parts = vec![topic.name.clone(), topic.description.clone()];
        search_parts.extend(aliases.iter().cloned());
        search_parts.extend(entities.iter().cloned());
        search_parts.extend(keywords.iter().cloned());
        topics.push(ClassificationTopicContext {
            id: topic.id.to_string(),
            primary_domain_id: topic.domain_id.to_string(),
            path: topic_path(connection, topic.id)?,
            name: topic.name.clone(),
            aliases,
            entities,
            keywords,
            search_document: search_parts
                .into_iter()
                .filter(|value| !value.trim().is_empty())
                .collect::<Vec<_>>()
                .join("\n"),
            status: if topic.status == "merged" {
                "archived".to_string()
            } else {
                topic.status.clone()
            },
            updated_at: connection.query_row(
                "SELECT updated_at FROM topics WHERE id = ?1",
                [topic.id],
                |row| row.get(0),
            )?,
        });
    }

    let history = read_classification_history(connection, batch_id.as_deref())?;
    let search_signals = normalized_bm25_signals(connection, source_item_id, &source, &topics)?;
    Ok(KnowledgeClassificationContext {
        source,
        topics,
        rules: persisted_rules,
        history,
        search_signals,
    })
}

pub fn get_personal_catalog_proposal() -> personal_catalog::PersonalCatalogProposal {
    personal_catalog::personal_catalog_proposal()
}

pub fn apply_personal_catalog(
    connection: &mut Connection,
    input: &ApplyPersonalCatalogInput,
) -> AppResult<ApplyPersonalCatalogResult> {
    if input.version != personal_catalog::PERSONAL_CATALOG_VERSION {
        return Err(AppError::Validation(
            "个人主题目录版本已变化，请重新审阅后确认".to_string(),
        ));
    }
    let proposal = personal_catalog::personal_catalog_proposal();
    let transaction = connection.transaction()?;
    let now = Utc::now().to_rfc3339();
    let mut result = ApplyPersonalCatalogResult {
        version: proposal.version.clone(),
        created_domains: 0,
        existing_domains: 0,
        created_topics: 0,
        existing_topics: 0,
        created_aliases: 0,
        created_entities: 0,
        created_rules: 0,
    };
    let mut domain_ids = HashMap::new();
    for domain in &proposal.domains {
        let normalized_name = normalize_name(&domain.name);
        let existing_id = transaction
            .query_row(
                "SELECT id FROM domains WHERE normalized_name = ?1",
                [normalized_name.as_str()],
                |row| row.get::<_, i64>(0),
            )
            .optional()?;
        let domain_id = if let Some(id) = existing_id {
            result.existing_domains += 1;
            id
        } else {
            transaction.execute(
                "INSERT INTO domains(
                   public_id, name, normalized_name, description, sort_order, created_at, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
                params![
                    format!("catalog-domain-{}", domain.key),
                    domain.name,
                    normalized_name,
                    domain.description,
                    result.created_domains as i64,
                    now,
                ],
            )?;
            result.created_domains += 1;
            transaction.last_insert_rowid()
        };
        domain_ids.insert(domain.key.clone(), domain_id);
    }

    let mut topic_ids = HashMap::new();
    for topic in &proposal.topics {
        let domain_id = *domain_ids
            .get(&topic.domain_key)
            .ok_or_else(|| AppError::Conflict("目录提案引用了不存在的领域".to_string()))?;
        let parent_topic_id = topic
            .parent_key
            .as_ref()
            .map(|key| {
                topic_ids
                    .get(key)
                    .copied()
                    .ok_or_else(|| AppError::Conflict("目录提案的父主题顺序或引用无效".to_string()))
            })
            .transpose()?;
        let normalized_name = normalize_name(&topic.name);
        let existing_id = transaction
            .query_row(
                "SELECT id FROM topics
                 WHERE domain_id = ?1 AND ifnull(parent_topic_id, 0) = ifnull(?2, 0)
                   AND normalized_name = ?3",
                params![domain_id, parent_topic_id, normalized_name],
                |row| row.get::<_, i64>(0),
            )
            .optional()?;
        let topic_id = if let Some(id) = existing_id {
            result.existing_topics += 1;
            id
        } else {
            let depth = parent_topic_id
                .map(|parent_id| {
                    transaction.query_row(
                        "SELECT depth + 1 FROM topics WHERE id = ?1",
                        [parent_id],
                        |row| row.get::<_, i64>(0),
                    )
                })
                .transpose()?
                .unwrap_or(1);
            transaction.execute(
                "INSERT INTO topics(
                   public_id, domain_id, parent_topic_id, name, normalized_name,
                   description, topic_kind, depth, sort_order, created_at, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
                params![
                    format!("catalog-topic-{}", topic.key),
                    domain_id,
                    parent_topic_id,
                    topic.name,
                    normalized_name,
                    topic.description,
                    topic.topic_kind,
                    depth,
                    result.created_topics as i64,
                    now,
                ],
            )?;
            result.created_topics += 1;
            transaction.last_insert_rowid()
        };
        topic_ids.insert(topic.key.clone(), topic_id);

        for alias in &topic.aliases {
            result.created_aliases += transaction.execute(
                "INSERT OR IGNORE INTO topic_aliases(
                   topic_id, alias, normalized_alias, alias_type, created_at
                 ) VALUES (?1, ?2, ?3, 'name', ?4)",
                params![topic_id, alias, normalize_name(alias), now],
            )?;
        }
        for entity in &topic.entities {
            result.created_entities += transaction.execute(
                "INSERT OR IGNORE INTO entity_dictionary(
                   canonical_name, normalized_name, entity_type, aliases_json,
                   description, created_at, updated_at
                 ) VALUES (?1, ?2, ?3, '[]', '', ?4, ?4)",
                params![
                    entity,
                    normalize_name(entity),
                    infer_entity_type(entity),
                    now
                ],
            )?;
        }
        for (rule_type, patterns, weight) in [
            ("exact_alias", &topic.aliases, 0.8_f64),
            ("entity", &topic.entities, 0.9_f64),
            ("keyword", &topic.keywords, 0.75_f64),
        ] {
            for (index, pattern) in patterns.iter().enumerate() {
                let exists = transaction.query_row(
                    "SELECT EXISTS(
                       SELECT 1 FROM classification_rules
                       WHERE rule_type = ?1 AND pattern = ?2 AND target_topic_id = ?3
                     )",
                    params![rule_type, pattern, topic_id],
                    |row| row.get::<_, i64>(0),
                )? != 0;
                if exists {
                    continue;
                }
                transaction.execute(
                    "INSERT INTO classification_rules(
                       public_id, rule_type, pattern, target_domain_id, target_topic_id,
                       weight, priority, enabled, config_json, created_at, updated_at
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 1, '{}', ?7, ?7)",
                    params![
                        format!("catalog-rule-{}-{rule_type}-{index}", topic.key),
                        rule_type,
                        pattern,
                        domain_id,
                        topic_id,
                        weight,
                        now,
                    ],
                )?;
                result.created_rules += 1;
            }
        }
    }
    transaction.commit()?;
    Ok(result)
}

pub fn list_topic_aliases(
    connection: &Connection,
    topic_id: Option<i64>,
) -> AppResult<Vec<TopicAliasRow>> {
    let mut statement = connection.prepare(
        "SELECT id, topic_id, alias, alias_type, created_at
         FROM topic_aliases
         WHERE ?1 IS NULL OR topic_id = ?1
         ORDER BY topic_id, alias_type, alias",
    )?;
    let rows = statement.query_map([topic_id], topic_alias_from_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn create_topic_alias(
    connection: &Connection,
    input: &CreateTopicAliasInput,
) -> AppResult<TopicAliasRow> {
    validate_topic_alias(
        connection,
        input.topic_id,
        &input.alias,
        &input.alias_type,
        None,
    )?;
    let now = Utc::now().to_rfc3339();
    connection.execute(
        "INSERT INTO topic_aliases(topic_id, alias, normalized_alias, alias_type, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            input.topic_id,
            input.alias.trim(),
            normalize_name(&input.alias),
            input.alias_type,
            now
        ],
    )?;
    get_topic_alias(connection, connection.last_insert_rowid())
}

pub fn update_topic_alias(
    connection: &Connection,
    input: &UpdateTopicAliasInput,
) -> AppResult<TopicAliasRow> {
    let topic_id = connection
        .query_row(
            "SELECT topic_id FROM topic_aliases WHERE id = ?1",
            [input.id],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|_| AppError::NotFound("主题别名不存在".to_string()))?;
    validate_topic_alias(
        connection,
        topic_id,
        &input.alias,
        &input.alias_type,
        Some(input.id),
    )?;
    connection.execute(
        "UPDATE topic_aliases
         SET alias = ?1, normalized_alias = ?2, alias_type = ?3
         WHERE id = ?4",
        params![
            input.alias.trim(),
            normalize_name(&input.alias),
            input.alias_type,
            input.id
        ],
    )?;
    get_topic_alias(connection, input.id)
}

pub fn delete_topic_alias(connection: &Connection, id: i64) -> AppResult<KnowledgeDeleteResult> {
    Ok(KnowledgeDeleteResult {
        id,
        deleted: connection.execute("DELETE FROM topic_aliases WHERE id = ?1", [id])? == 1,
    })
}

pub fn list_entity_dictionary(connection: &Connection) -> AppResult<Vec<EntityDictionaryRow>> {
    let mut statement = connection.prepare(
        "SELECT id, canonical_name, entity_type, aliases_json, description, created_at, updated_at
         FROM entity_dictionary ORDER BY entity_type, canonical_name",
    )?;
    let rows = statement.query_map([], entity_dictionary_from_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn create_entity_dictionary_entry(
    connection: &Connection,
    input: &CreateEntityDictionaryInput,
) -> AppResult<EntityDictionaryRow> {
    let aliases = validate_entity_dictionary_input(
        &input.canonical_name,
        &input.entity_type,
        &input.aliases,
    )?;
    let now = Utc::now().to_rfc3339();
    connection.execute(
        "INSERT INTO entity_dictionary(
           canonical_name, normalized_name, entity_type, aliases_json,
           description, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        params![
            input.canonical_name.trim(),
            normalize_name(&input.canonical_name),
            input.entity_type,
            serde_json::to_string(&aliases)?,
            input.description.trim(),
            now,
        ],
    )?;
    get_entity_dictionary_entry(connection, connection.last_insert_rowid())
}

pub fn update_entity_dictionary_entry(
    connection: &Connection,
    input: &UpdateEntityDictionaryInput,
) -> AppResult<EntityDictionaryRow> {
    let aliases = validate_entity_dictionary_input(
        &input.canonical_name,
        &input.entity_type,
        &input.aliases,
    )?;
    let changed = connection.execute(
        "UPDATE entity_dictionary
         SET canonical_name = ?1, normalized_name = ?2, entity_type = ?3,
             aliases_json = ?4, description = ?5, updated_at = ?6
         WHERE id = ?7",
        params![
            input.canonical_name.trim(),
            normalize_name(&input.canonical_name),
            input.entity_type,
            serde_json::to_string(&aliases)?,
            input.description.trim(),
            Utc::now().to_rfc3339(),
            input.id,
        ],
    )?;
    if changed != 1 {
        return Err(AppError::NotFound("实体词典条目不存在".to_string()));
    }
    get_entity_dictionary_entry(connection, input.id)
}

pub fn delete_entity_dictionary_entry(
    connection: &Connection,
    id: i64,
) -> AppResult<KnowledgeDeleteResult> {
    Ok(KnowledgeDeleteResult {
        id,
        deleted: connection.execute("DELETE FROM entity_dictionary WHERE id = ?1", [id])? == 1,
    })
}

pub fn list_classification_rules(connection: &Connection) -> AppResult<Vec<ClassificationRuleRow>> {
    let mut statement = connection.prepare(
        "SELECT id, public_id, rule_type, pattern, target_domain_id, target_topic_id,
                weight, priority, enabled, config_json, created_at, updated_at
         FROM classification_rules
         ORDER BY enabled DESC, priority DESC, id",
    )?;
    let rows = statement.query_map([], classification_rule_from_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn create_classification_rule(
    connection: &Connection,
    input: &CreateClassificationRuleInput,
) -> AppResult<ClassificationRuleRow> {
    validate_classification_rule(
        connection,
        &input.rule_type,
        &input.pattern,
        input.target_domain_id,
        input.target_topic_id,
        input.weight,
        &input.config_json,
        None,
    )?;
    let now = Utc::now().to_rfc3339();
    connection.execute(
        "INSERT INTO classification_rules(
           public_id, rule_type, pattern, target_domain_id, target_topic_id,
           weight, priority, enabled, config_json, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
        params![
            format!("rule-{}", Uuid::new_v4()),
            input.rule_type,
            input.pattern.trim(),
            input.target_domain_id,
            input.target_topic_id,
            input.weight,
            input.priority,
            input.enabled as i64,
            normalized_json_object(&input.config_json)?,
            now,
        ],
    )?;
    get_classification_rule(connection, connection.last_insert_rowid())
}

pub fn update_classification_rule(
    connection: &Connection,
    input: &UpdateClassificationRuleInput,
) -> AppResult<ClassificationRuleRow> {
    validate_classification_rule(
        connection,
        &input.rule_type,
        &input.pattern,
        input.target_domain_id,
        input.target_topic_id,
        input.weight,
        &input.config_json,
        Some(input.id),
    )?;
    let changed = connection.execute(
        "UPDATE classification_rules
         SET rule_type = ?1, pattern = ?2, target_domain_id = ?3, target_topic_id = ?4,
             weight = ?5, priority = ?6, enabled = ?7, config_json = ?8, updated_at = ?9
         WHERE id = ?10",
        params![
            input.rule_type,
            input.pattern.trim(),
            input.target_domain_id,
            input.target_topic_id,
            input.weight,
            input.priority,
            input.enabled as i64,
            normalized_json_object(&input.config_json)?,
            Utc::now().to_rfc3339(),
            input.id,
        ],
    )?;
    if changed != 1 {
        return Err(AppError::NotFound("分类规则不存在".to_string()));
    }
    get_classification_rule(connection, input.id)
}

pub fn delete_classification_rule(
    connection: &Connection,
    id: i64,
) -> AppResult<KnowledgeDeleteResult> {
    Ok(KnowledgeDeleteResult {
        id,
        deleted: connection.execute("DELETE FROM classification_rules WHERE id = ?1", [id])? == 1,
    })
}

pub fn list_notes(
    connection: &Connection,
    topic_id: Option<i64>,
    include_archived: bool,
) -> AppResult<Vec<KnowledgeNoteRow>> {
    let mut statement = connection.prepare(
        "SELECT note.id
         FROM notes note
         WHERE (?1 IS NULL OR EXISTS(
           SELECT 1 FROM note_topics link
           WHERE link.note_id = note.id AND link.topic_id = ?1
         ))
           AND (?2 = 1 OR note.status <> 'archived')
         ORDER BY note.updated_at DESC, note.id DESC",
    )?;
    let ids = statement
        .query_map(params![topic_id, include_archived as i64], |row| {
            row.get::<_, i64>(0)
        })?
        .collect::<Result<Vec<_>, _>>()?;
    ids.into_iter().map(|id| get_note(connection, id)).collect()
}

pub fn get_note(connection: &Connection, note_id: i64) -> AppResult<KnowledgeNoteRow> {
    let (
        id,
        public_id,
        title,
        body_markdown,
        summary,
        note_type,
        status,
        organization_state,
        created_at,
        updated_at,
    ) = connection
        .query_row(
            "SELECT id, public_id, title, body_markdown, summary, note_type,
                    status, organization_state, created_at, updated_at
             FROM notes WHERE id = ?1",
            [note_id],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, String>(9)?,
                ))
            },
        )
        .map_err(|_| AppError::NotFound("笔记不存在".to_string()))?;
    let mut topic_statement = connection.prepare(
        "SELECT topic_id, role FROM note_topics WHERE note_id = ?1 ORDER BY role, topic_id",
    )?;
    let topic_links = topic_statement
        .query_map([note_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let primary_topic_id = topic_links
        .iter()
        .find(|(_, role)| role == "primary")
        .map(|(topic_id, _)| *topic_id)
        .ok_or_else(|| AppError::Conflict("笔记缺少主要主题".to_string()))?;
    let related_topic_ids = topic_links
        .into_iter()
        .filter_map(|(topic_id, role)| (role == "secondary").then_some(topic_id))
        .collect();
    let mut source_statement = connection.prepare(
        "SELECT DISTINCT source_item_id FROM note_sources
         WHERE note_id = ?1 ORDER BY source_item_id",
    )?;
    let source_item_ids = source_statement
        .query_map([note_id], |row| row.get::<_, i64>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(KnowledgeNoteRow {
        id,
        public_id,
        title,
        body_markdown,
        summary,
        note_type,
        status,
        organization_state,
        primary_topic_id,
        related_topic_ids,
        source_item_ids,
        created_at,
        updated_at,
    })
}

pub fn create_note(
    connection: &mut Connection,
    input: &CreateKnowledgeNoteInput,
) -> AppResult<KnowledgeNoteRow> {
    let (related_topic_ids, source_item_ids) = validate_note_input(
        connection,
        &input.title,
        &input.note_type,
        &input.status,
        &input.organization_state,
        input.primary_topic_id,
        &input.related_topic_ids,
        &input.source_item_ids,
    )?;
    let transaction = connection.transaction()?;
    let now = Utc::now().to_rfc3339();
    transaction.execute(
        "INSERT INTO notes(
           public_id, title, body_markdown, summary, note_type,
           status, organization_state, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
        params![
            format!("note-{}", Uuid::new_v4()),
            input.title.trim(),
            input.body_markdown,
            input.summary.trim(),
            input.note_type,
            input.status,
            input.organization_state,
            now,
        ],
    )?;
    let note_id = transaction.last_insert_rowid();
    write_note_links(
        &transaction,
        note_id,
        input.primary_topic_id,
        &related_topic_ids,
        &source_item_ids,
        &now,
    )?;
    transaction.commit()?;
    get_note(connection, note_id)
}

pub fn update_note(
    connection: &mut Connection,
    input: &UpdateKnowledgeNoteInput,
) -> AppResult<KnowledgeNoteRow> {
    get_note(connection, input.id)?;
    let (related_topic_ids, source_item_ids) = validate_note_input(
        connection,
        &input.title,
        &input.note_type,
        &input.status,
        &input.organization_state,
        input.primary_topic_id,
        &input.related_topic_ids,
        &input.source_item_ids,
    )?;
    let transaction = connection.transaction()?;
    let now = Utc::now().to_rfc3339();
    transaction.execute(
        "UPDATE notes
         SET title = ?1, body_markdown = ?2, summary = ?3, note_type = ?4,
             status = ?5, organization_state = ?6, updated_at = ?7
         WHERE id = ?8",
        params![
            input.title.trim(),
            input.body_markdown,
            input.summary.trim(),
            input.note_type,
            input.status,
            input.organization_state,
            now,
            input.id,
        ],
    )?;
    transaction.execute("DELETE FROM note_topics WHERE note_id = ?1", [input.id])?;
    transaction.execute("DELETE FROM note_sources WHERE note_id = ?1", [input.id])?;
    write_note_links(
        &transaction,
        input.id,
        input.primary_topic_id,
        &related_topic_ids,
        &source_item_ids,
        &now,
    )?;
    transaction.commit()?;
    get_note(connection, input.id)
}

pub fn archive_note(connection: &Connection, note_id: i64) -> AppResult<KnowledgeNoteRow> {
    let changed = connection.execute(
        "UPDATE notes SET status = 'archived', updated_at = ?1 WHERE id = ?2",
        params![Utc::now().to_rfc3339(), note_id],
    )?;
    if changed != 1 {
        return Err(AppError::NotFound("笔记不存在".to_string()));
    }
    get_note(connection, note_id)
}

pub fn list_propositions(
    connection: &Connection,
    topic_id: i64,
) -> AppResult<Vec<TopicPropositionRow>> {
    let mut statement = connection.prepare(
        "SELECT id, public_id, topic_id, statement_markdown, status, created_at, updated_at
         FROM propositions
         WHERE topic_id = ?1
         ORDER BY CASE status
           WHEN 'supported' THEN 0 WHEN 'open' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END,
           updated_at DESC, id DESC",
    )?;
    let rows = statement.query_map([topic_id], |row| {
        Ok(TopicPropositionRow {
            id: row.get(0)?,
            public_id: row.get(1)?,
            topic_id: row.get(2)?,
            statement_markdown: row.get(3)?,
            status: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn create_proposition(
    connection: &Connection,
    input: &CreateTopicPropositionInput,
) -> AppResult<TopicPropositionRow> {
    validate_proposition(input.statement_markdown.as_str(), input.status.as_str())?;
    require_active_topic(connection, input.topic_id)?;
    let now = Utc::now().to_rfc3339();
    connection.execute(
        "INSERT INTO propositions(
           public_id, topic_id, statement_markdown, status, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![
            format!("proposition-{}", Uuid::new_v4()),
            input.topic_id,
            input.statement_markdown.trim(),
            input.status,
            now,
        ],
    )?;
    get_proposition(connection, connection.last_insert_rowid())
}

pub fn update_proposition(
    connection: &Connection,
    input: &UpdateTopicPropositionInput,
) -> AppResult<TopicPropositionRow> {
    validate_proposition(input.statement_markdown.as_str(), input.status.as_str())?;
    let changed = connection.execute(
        "UPDATE propositions
         SET statement_markdown = ?1, status = ?2, updated_at = ?3
         WHERE id = ?4",
        params![
            input.statement_markdown.trim(),
            input.status,
            Utc::now().to_rfc3339(),
            input.id,
        ],
    )?;
    if changed != 1 {
        return Err(AppError::NotFound("命题不存在".to_string()));
    }
    get_proposition(connection, input.id)
}

pub fn supersede_proposition(
    connection: &Connection,
    proposition_id: i64,
) -> AppResult<TopicPropositionRow> {
    let proposition = get_proposition(connection, proposition_id)?;
    update_proposition(
        connection,
        &UpdateTopicPropositionInput {
            id: proposition.id,
            statement_markdown: proposition.statement_markdown,
            status: "superseded".to_string(),
        },
    )
}

pub fn list_turning_points(
    connection: &Connection,
    topic_id: i64,
) -> AppResult<Vec<TopicTurningPointRow>> {
    let mut statement = connection.prepare(
        "SELECT point.id, point.public_id, point.topic_id,
                point.from_judgment_id, previous.statement_markdown,
                point.to_judgment_id, current.statement_markdown,
                point.title, point.explanation, point.occurred_at, point.created_at
         FROM turning_points point
         LEFT JOIN judgment_snapshots previous ON previous.id = point.from_judgment_id
         JOIN judgment_snapshots current ON current.id = point.to_judgment_id
         WHERE point.topic_id = ?1
         ORDER BY point.occurred_at DESC, point.id DESC",
    )?;
    let rows = statement.query_map([topic_id], |row| {
        Ok(TopicTurningPointRow {
            id: row.get(0)?,
            public_id: row.get(1)?,
            topic_id: row.get(2)?,
            from_judgment_id: row.get(3)?,
            from_statement_markdown: row.get(4)?,
            to_judgment_id: row.get(5)?,
            to_statement_markdown: row.get(6)?,
            title: row.get(7)?,
            explanation: row.get(8)?,
            occurred_at: row.get(9)?,
            created_at: row.get(10)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn create_turning_point(
    connection: &Connection,
    input: &CreateTopicTurningPointInput,
) -> AppResult<TopicTurningPointRow> {
    require_active_topic(connection, input.topic_id)?;
    if input.title.trim().is_empty() {
        return Err(AppError::Validation("转折标题不能为空".to_string()));
    }
    if input.explanation.trim().is_empty() {
        return Err(AppError::Validation(
            "请说明这次变化为什么构成关键转折".to_string(),
        ));
    }
    if input.from_judgment_id == Some(input.to_judgment_id) {
        return Err(AppError::Validation(
            "转折前后的判断快照不能相同".to_string(),
        ));
    }
    let (_, to_effective_at) =
        require_topic_judgment(connection, input.topic_id, input.to_judgment_id)?;
    if let Some(from_judgment_id) = input.from_judgment_id {
        let (_, from_effective_at) =
            require_topic_judgment(connection, input.topic_id, from_judgment_id)?;
        if from_effective_at > to_effective_at {
            return Err(AppError::Validation(
                "改变前的判断不能晚于改变后的判断".to_string(),
            ));
        }
    }
    let duplicate = connection
        .query_row(
            "SELECT id FROM turning_points
             WHERE topic_id = ?1
               AND from_judgment_id IS ?2
               AND to_judgment_id = ?3",
            params![input.topic_id, input.from_judgment_id, input.to_judgment_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;
    if duplicate.is_some() {
        return Err(AppError::Conflict(
            "这两个判断快照之间已经存在转折点".to_string(),
        ));
    }
    let occurred_at = if input.occurred_at.trim().is_empty() {
        to_effective_at
    } else {
        input.occurred_at.trim().to_string()
    };
    let now = Utc::now().to_rfc3339();
    connection.execute(
        "INSERT INTO turning_points(
           public_id, topic_id, from_judgment_id, to_judgment_id,
           title, explanation, occurred_at, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            format!("turning-point-{}", Uuid::new_v4()),
            input.topic_id,
            input.from_judgment_id,
            input.to_judgment_id,
            input.title.trim(),
            input.explanation.trim(),
            occurred_at,
            now,
        ],
    )?;
    let id = connection.last_insert_rowid();
    list_turning_points(connection, input.topic_id)?
        .into_iter()
        .find(|point| point.id == id)
        .ok_or_else(|| AppError::NotFound("转折点写入后无法读取".to_string()))
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
                locator_label: evidence_locator_label(&row.get::<_, String>(9)?),
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
        notes: list_notes(connection, Some(topic_id), true)?,
        topic,
        sources,
        judgments,
        evidence,
        questions,
        propositions: list_propositions(connection, topic_id)?,
        turning_points: list_turning_points(connection, topic_id)?,
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
    let mut redirect_aliases = read_topic_aliases(connection, source_topic_id)?;
    redirect_aliases.insert(0, source_topic.name.clone());
    redirect_aliases.push(topic_path(connection, source_topic_id)?.join(" / "));
    deduplicate_strings(&mut redirect_aliases);
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
        redirect_aliases,
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
    let mut inserted_redirect_alias_ids = Vec::new();
    for alias in &preview.redirect_aliases {
        let changed = transaction.execute(
            "INSERT OR IGNORE INTO topic_aliases(
               topic_id, alias, normalized_alias, alias_type, created_at
             ) VALUES (?1, ?2, ?3, 'redirect', ?4)",
            params![input.target_topic_id, alias, normalize_name(alias), now],
        )?;
        if changed == 1 {
            inserted_redirect_alias_ids.push(transaction.last_insert_rowid());
        }
    }
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
        inserted_redirect_alias_ids,
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
    for alias_id in &inverse.inserted_redirect_alias_ids {
        transaction.execute(
            "DELETE FROM topic_aliases WHERE id = ?1 AND topic_id = ?2",
            params![alias_id, inverse.target_topic_id],
        )?;
    }
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
    if !matches!(
        input.verification_status.as_str(),
        "unverified" | "verified" | "disputed"
    ) || !matches!(
        input.validity_status.as_str(),
        "active" | "possibly_outdated" | "expired"
    ) {
        return Err(AppError::Validation(
            "证据验证状态或有效状态无效".to_string(),
        ));
    }
    let source_type = connection
        .query_row(
            "SELECT source.source_type
             FROM source_topics link
             JOIN source_items source ON source.id = link.source_item_id
             WHERE link.source_item_id = ?1 AND link.topic_id = ?2",
            params![input.source_item_id, input.topic_id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|_| AppError::Validation("证据来源必须先归入当前主题".to_string()))?;
    let now = Utc::now().to_rfc3339();
    let public_id = format!("evidence-{}", Uuid::new_v4());
    let locator_json =
        validate_evidence_locator(source_type.as_str(), input.locator_json.as_str())?;
    connection.execute(
        "INSERT INTO evidence(
           public_id, topic_id, source_item_id, content_markdown, stance,
           credibility, verification_status, validity_status, locator_json, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            public_id,
            input.topic_id,
            input.source_item_id,
            content,
            input.stance,
            input.credibility,
            input.verification_status,
            input.validity_status,
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
                    item.locator_label
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
    let active_propositions = detail
        .propositions
        .iter()
        .filter(|proposition| proposition.status != "superseded")
        .collect::<Vec<_>>();
    if !active_propositions.is_empty() {
        sections.push(format!(
            "## 命题\n\n{}",
            active_propositions
                .iter()
                .map(|item| format!("- [{}] {}", item.status, item.statement_markdown))
                .collect::<Vec<_>>()
                .join("\n")
        ));
    }
    if !detail.turning_points.is_empty() {
        sections.push(format!(
            "## 关键转折\n\n{}",
            detail
                .turning_points
                .iter()
                .map(|item| format!(
                    "- {}（{}）：{}",
                    item.title, item.occurred_at, item.explanation
                ))
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
    let top_suggestion = transaction
        .query_row(
            "SELECT id, suggested_topic_id
             FROM classification_suggestions
             WHERE source_item_id = ?1 AND status = 'pending'
             ORDER BY score DESC, id
             LIMIT 1",
            [input.source_item_id],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Option<i64>>(1)?)),
        )
        .optional()?;
    if let Some(suggestion_id) = input.suggestion_id {
        let suggestion_topic_id = transaction
            .query_row(
                "SELECT suggested_topic_id
                 FROM classification_suggestions
                 WHERE id = ?1 AND source_item_id = ?2 AND status = 'pending'",
                params![suggestion_id, input.source_item_id],
                |row| row.get::<_, Option<i64>>(0),
            )
            .map_err(|_| AppError::Validation("选择的分类建议无效或已经处理".to_string()))?;
        if suggestion_topic_id != Some(input.topic_id) {
            return Err(AppError::Validation(
                "选择的分类建议与目标主题不一致".to_string(),
            ));
        }
    }
    let feedback_kind = match top_suggestion {
        Some((top_id, Some(top_topic_id)))
            if input.suggestion_id == Some(top_id) && top_topic_id == input.topic_id =>
        {
            "accepted_suggestion"
        }
        Some(_) => "modified_suggestion",
        None => "manual_classification",
    };
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
    let reviewed_at = Utc::now().to_rfc3339();
    transaction.execute(
        "UPDATE classification_suggestions
         SET status = 'rejected', reviewed_at = ?2
         WHERE source_item_id = ?1 AND status = 'pending'",
        params![input.source_item_id, reviewed_at],
    )?;
    if let Some((top_id, _)) = top_suggestion {
        if feedback_kind == "modified_suggestion" {
            transaction.execute(
                "UPDATE classification_suggestions SET status = 'modified' WHERE id = ?1",
                [top_id],
            )?;
        }
    }
    if let Some(suggestion_id) = input.suggestion_id {
        transaction.execute(
            "UPDATE classification_suggestions SET status = 'accepted' WHERE id = ?1",
            [suggestion_id],
        )?;
    }
    let operation_public_id = format!("operation-{}", Uuid::new_v4());
    let after = serde_json::json!({
        "sourceItemId": input.source_item_id,
        "topicId": input.topic_id,
        "organizationState": "organized",
        "confidence": input.confidence,
        "suggestionId": input.suggestion_id,
        "classificationFeedback": {
            "kind": feedback_kind,
            "topSuggestedTopicId": top_suggestion.and_then(|(_, topic_id)| topic_id),
            "chosenTopicId": input.topic_id,
        },
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
         WHERE source_item_id = ?1 AND status IN ('accepted', 'modified')",
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

fn read_topic_aliases(connection: &Connection, topic_id: i64) -> AppResult<Vec<String>> {
    let mut statement = connection.prepare(
        "SELECT alias FROM topic_aliases WHERE topic_id = ?1 ORDER BY alias_type, alias",
    )?;
    let aliases = statement
        .query_map([topic_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(aliases)
}

fn topic_path(connection: &Connection, topic_id: i64) -> AppResult<Vec<String>> {
    let mut current_id = Some(topic_id);
    let mut domain_id = None;
    let mut path = Vec::new();
    let mut seen = HashSet::new();
    while let Some(id) = current_id {
        if !seen.insert(id) {
            return Err(AppError::Conflict(
                "主题层级存在循环，无法生成主路径".to_string(),
            ));
        }
        let (name, parent_id, current_domain_id) = connection
            .query_row(
                "SELECT name, parent_topic_id, domain_id FROM topics WHERE id = ?1",
                [id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<i64>>(1)?,
                        row.get::<_, i64>(2)?,
                    ))
                },
            )
            .map_err(|_| AppError::NotFound("主题不存在".to_string()))?;
        domain_id = Some(current_domain_id);
        path.push(name);
        current_id = parent_id;
    }
    path.reverse();
    if let Some(domain_id) = domain_id {
        let domain_name = connection.query_row(
            "SELECT name FROM domains WHERE id = ?1",
            [domain_id],
            |row| row.get::<_, String>(0),
        )?;
        path.insert(0, domain_name);
    }
    Ok(path)
}

fn read_persisted_classification_rules(
    connection: &Connection,
) -> AppResult<Vec<ClassificationRuleContext>> {
    let mut statement = connection.prepare(
        "SELECT public_id, rule_type, pattern, target_topic_id, weight, enabled
         FROM classification_rules
         WHERE target_topic_id IS NOT NULL
         ORDER BY priority DESC, id",
    )?;
    let rows = statement.query_map([], |row| {
        let public_id = row.get::<_, String>(0)?;
        let rule_type = row.get::<_, String>(1)?;
        let (field, operator) = match rule_type.as_str() {
            "exact_alias" => ("title", "contains"),
            "file_path" => ("file_path", "contains"),
            "source" => ("platform", "contains"),
            "legacy_tag" => ("tag", "contains"),
            "keyword" | "negative_keyword" | "stopword" | "entity" | "domain_hint" => {
                ("text", "contains")
            }
            _ => ("text", "contains"),
        };
        let value = row.get::<_, String>(2)?;
        Ok(ClassificationRuleContext {
            id: format!("{rule_type}:{public_id}"),
            topic_id: row.get::<_, i64>(3)?.to_string(),
            field: field.to_string(),
            operator: operator.to_string(),
            effect: if matches!(rule_type.as_str(), "negative_keyword" | "stopword") {
                "exclude".to_string()
            } else {
                "include".to_string()
            },
            value: value.clone(),
            json_field: None,
            strength: row.get::<_, f64>(4)?.clamp(0.0, 1.0),
            reason: format!("用户规则命中「{value}」"),
            enabled: row.get::<_, i64>(5)? != 0,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn read_entity_dictionary(connection: &Connection) -> AppResult<Vec<(String, Vec<String>)>> {
    let mut statement = connection
        .prepare("SELECT canonical_name, aliases_json FROM entity_dictionary ORDER BY id")?;
    let rows = statement.query_map([], |row| {
        let aliases_json = row.get::<_, String>(1)?;
        Ok((
            row.get::<_, String>(0)?,
            serde_json::from_str::<Vec<String>>(&aliases_json).unwrap_or_default(),
        ))
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn expand_entities(entities: &mut Vec<String>, dictionary: &[(String, Vec<String>)]) {
    let seeds = entities
        .iter()
        .map(|value| normalize_name(value))
        .collect::<HashSet<_>>();
    for (canonical, aliases) in dictionary {
        let matches = seeds.contains(&normalize_name(canonical))
            || aliases
                .iter()
                .any(|alias| seeds.contains(&normalize_name(alias)));
        if matches {
            entities.push(canonical.clone());
            entities.extend(aliases.iter().cloned());
        }
    }
}

fn read_classification_history(
    connection: &Connection,
    batch_id: Option<&str>,
) -> AppResult<ClassificationHistoryContext> {
    let mut confirmed_topic_counts = HashMap::new();
    let mut statement = connection.prepare(
        "SELECT topic_id, COUNT(*)
         FROM source_topics
         WHERE role = 'primary'
         GROUP BY topic_id
         ORDER BY topic_id",
    )?;
    let counts =
        statement.query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)))?;
    for count in counts {
        let (topic_id, count) = count?;
        confirmed_topic_counts.insert(topic_id.to_string(), count);
    }

    let mut recent_statement = connection.prepare(
        "SELECT topic_id
         FROM source_topics
         WHERE role = 'primary'
         GROUP BY topic_id
         ORDER BY MAX(created_at) DESC, topic_id
         LIMIT 8",
    )?;
    let recent_topic_ids = recent_statement
        .query_map([], |row| Ok(row.get::<_, i64>(0)?.to_string()))?
        .collect::<Result<Vec<_>, _>>()?;

    let mut batch_topic_ids = HashMap::new();
    if let Some(batch_id) = batch_id {
        let mut batch_statement = connection.prepare(
            "SELECT DISTINCT link.topic_id
             FROM source_items source
             JOIN source_topics link ON link.source_item_id = source.id
             WHERE json_extract(source.metadata_json, '$.batchId') = ?1
               AND link.role = 'primary'
             ORDER BY link.topic_id",
        )?;
        let topic_ids = batch_statement
            .query_map([batch_id], |row| Ok(row.get::<_, i64>(0)?.to_string()))?
            .collect::<Result<Vec<_>, _>>()?;
        if !topic_ids.is_empty() {
            batch_topic_ids.insert(batch_id.to_string(), topic_ids);
        }
    }
    Ok(ClassificationHistoryContext {
        confirmed_topic_counts,
        recent_topic_ids,
        batch_topic_ids,
    })
}

fn normalized_bm25_signals(
    connection: &Connection,
    source_item_id: i64,
    source: &ClassificationSourceContext,
    topics: &[ClassificationTopicContext],
) -> AppResult<Vec<ClassificationSearchSignal>> {
    let mut raw_scores = Vec::new();
    let source_haystack = format!("{} {}", source.title, source.text).to_lowercase();
    for topic in topics.iter().filter(|topic| topic.status != "archived") {
        let mut terms = vec![topic.name.clone()];
        terms.extend(topic.aliases.iter().cloned());
        terms.extend(topic.entities.iter().cloned());
        terms.extend(topic.keywords.iter().cloned());
        terms.extend(split_search_terms(&topic.search_document));
        deduplicate_strings(&mut terms);
        terms.retain(|term| (3..=48).contains(&term.chars().count()));
        terms.truncate(20);
        if terms.is_empty() {
            continue;
        }
        let expression = terms
            .iter()
            .map(|term| format!("\"{}\"", term.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(" OR ");
        let raw_score = connection
            .query_row(
                "SELECT -bm25(source_items_fts, 8.0, 1.0)
                 FROM source_items_fts
                 WHERE rowid = ?1 AND source_items_fts MATCH ?2",
                params![source_item_id, expression],
                |row| row.get::<_, f64>(0),
            )
            .optional()?
            .unwrap_or(0.0)
            .max(0.0);
        if raw_score > 0.0 {
            let matched_terms = terms
                .iter()
                .filter(|term| source_haystack.contains(&term.to_lowercase()))
                .count();
            raw_scores.push((topic.id.clone(), raw_score, matched_terms));
        }
    }
    let maximum = raw_scores
        .iter()
        .map(|(_, score, _)| *score)
        .fold(0.0_f64, f64::max);
    if maximum <= 0.0 {
        return Ok(Vec::new());
    }
    Ok(raw_scores
        .into_iter()
        .map(|(topic_id, raw_score, matched_terms)| {
            let coverage = (0.55 + 0.15 * matched_terms.min(3) as f64).min(1.0);
            let normalized_score = ((raw_score / maximum) * coverage * 10_000.0).round() / 10_000.0;
            ClassificationSearchSignal {
                topic_id,
                normalized_score,
                reason: format!(
                    "SQLite FTS5/BM25 命中 {matched_terms} 个主题词，归一化相关度 {}%",
                    (normalized_score * 100.0).round()
                ),
            }
        })
        .collect())
}

fn split_search_terms(value: &str) -> Vec<String> {
    value
        .split(|character: char| {
            character.is_whitespace()
                || matches!(
                    character,
                    ',' | '，' | '、' | ';' | '；' | ':' | '：' | '/' | '\\' | '|' | '\n'
                )
        })
        .map(str::trim)
        .filter(|term| (2..=48).contains(&term.chars().count()))
        .map(str::to_string)
        .collect()
}

fn deduplicate_strings(values: &mut Vec<String>) {
    let mut seen = HashSet::new();
    values.retain(|value| {
        let normalized = normalize_name(value);
        !normalized.is_empty() && seen.insert(normalized)
    });
}

fn topic_alias_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TopicAliasRow> {
    Ok(TopicAliasRow {
        id: row.get(0)?,
        topic_id: row.get(1)?,
        alias: row.get(2)?,
        alias_type: row.get(3)?,
        created_at: row.get(4)?,
    })
}

fn get_topic_alias(connection: &Connection, id: i64) -> AppResult<TopicAliasRow> {
    connection
        .query_row(
            "SELECT id, topic_id, alias, alias_type, created_at
             FROM topic_aliases WHERE id = ?1",
            [id],
            topic_alias_from_row,
        )
        .map_err(|_| AppError::NotFound("主题别名不存在".to_string()))
}

fn validate_topic_alias(
    connection: &Connection,
    topic_id: i64,
    alias: &str,
    alias_type: &str,
    current_id: Option<i64>,
) -> AppResult<()> {
    if alias.trim().is_empty() {
        return Err(AppError::Validation("主题别名不能为空".to_string()));
    }
    if !matches!(
        alias_type,
        "name" | "abbreviation" | "redirect" | "legacy_tag"
    ) {
        return Err(AppError::Validation("主题别名类型无效".to_string()));
    }
    connection
        .query_row(
            "SELECT 1 FROM topics WHERE id = ?1 AND status <> 'merged'",
            [topic_id],
            |_| Ok(()),
        )
        .map_err(|_| AppError::NotFound("目标主题不存在".to_string()))?;
    let duplicate = connection.query_row(
        "SELECT EXISTS(
           SELECT 1 FROM topic_aliases
           WHERE topic_id = ?1 AND normalized_alias = ?2
             AND (?3 IS NULL OR id <> ?3)
         )",
        params![topic_id, normalize_name(alias), current_id],
        |row| row.get::<_, i64>(0),
    )? != 0;
    if duplicate {
        return Err(AppError::Conflict("该主题别名已经存在".to_string()));
    }
    Ok(())
}

fn entity_dictionary_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<EntityDictionaryRow> {
    let aliases_json = row.get::<_, String>(3)?;
    Ok(EntityDictionaryRow {
        id: row.get(0)?,
        canonical_name: row.get(1)?,
        entity_type: row.get(2)?,
        aliases: serde_json::from_str(&aliases_json).unwrap_or_default(),
        description: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

fn get_entity_dictionary_entry(connection: &Connection, id: i64) -> AppResult<EntityDictionaryRow> {
    connection
        .query_row(
            "SELECT id, canonical_name, entity_type, aliases_json, description,
                    created_at, updated_at
             FROM entity_dictionary WHERE id = ?1",
            [id],
            entity_dictionary_from_row,
        )
        .map_err(|_| AppError::NotFound("实体词典条目不存在".to_string()))
}

fn validate_entity_dictionary_input(
    canonical_name: &str,
    entity_type: &str,
    aliases: &[String],
) -> AppResult<Vec<String>> {
    if canonical_name.trim().is_empty() {
        return Err(AppError::Validation("实体标准名称不能为空".to_string()));
    }
    if !matches!(
        entity_type,
        "company"
            | "person"
            | "product"
            | "model"
            | "industry"
            | "place"
            | "project"
            | "custom"
            | "other"
    ) {
        return Err(AppError::Validation("实体类型无效".to_string()));
    }
    let mut aliases = aliases
        .iter()
        .map(|alias| alias.trim().to_string())
        .filter(|alias| !alias.is_empty())
        .collect::<Vec<_>>();
    deduplicate_strings(&mut aliases);
    aliases.retain(|alias| normalize_name(alias) != normalize_name(canonical_name));
    Ok(aliases)
}

fn classification_rule_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<ClassificationRuleRow> {
    Ok(ClassificationRuleRow {
        id: row.get(0)?,
        public_id: row.get(1)?,
        rule_type: row.get(2)?,
        pattern: row.get(3)?,
        target_domain_id: row.get(4)?,
        target_topic_id: row.get(5)?,
        weight: row.get(6)?,
        priority: row.get(7)?,
        enabled: row.get::<_, i64>(8)? != 0,
        config_json: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

fn get_classification_rule(connection: &Connection, id: i64) -> AppResult<ClassificationRuleRow> {
    connection
        .query_row(
            "SELECT id, public_id, rule_type, pattern, target_domain_id, target_topic_id,
                    weight, priority, enabled, config_json, created_at, updated_at
             FROM classification_rules WHERE id = ?1",
            [id],
            classification_rule_from_row,
        )
        .map_err(|_| AppError::NotFound("分类规则不存在".to_string()))
}

#[allow(clippy::too_many_arguments)]
fn validate_classification_rule(
    connection: &Connection,
    rule_type: &str,
    pattern: &str,
    target_domain_id: Option<i64>,
    target_topic_id: Option<i64>,
    weight: f64,
    config_json: &str,
    current_id: Option<i64>,
) -> AppResult<()> {
    if !matches!(
        rule_type,
        "keyword"
            | "exact_alias"
            | "negative_keyword"
            | "file_path"
            | "entity"
            | "source"
            | "legacy_tag"
            | "stopword"
            | "domain_hint"
    ) {
        return Err(AppError::Validation("分类规则类型无效".to_string()));
    }
    if pattern.trim().is_empty() {
        return Err(AppError::Validation("分类规则匹配内容不能为空".to_string()));
    }
    if !(0.0..=1.0).contains(&weight) {
        return Err(AppError::Validation(
            "分类规则强度必须在 0 到 1 之间".to_string(),
        ));
    }
    normalized_json_object(config_json)?;
    if rule_type != "stopword" && target_topic_id.is_none() && target_domain_id.is_none() {
        return Err(AppError::Validation(
            "分类规则必须指定目标领域或主题".to_string(),
        ));
    }
    if let Some(domain_id) = target_domain_id {
        connection
            .query_row("SELECT 1 FROM domains WHERE id = ?1", [domain_id], |_| {
                Ok(())
            })
            .map_err(|_| AppError::NotFound("分类规则目标领域不存在".to_string()))?;
    }
    if let Some(topic_id) = target_topic_id {
        let topic_domain_id = connection
            .query_row(
                "SELECT domain_id FROM topics WHERE id = ?1 AND status <> 'merged'",
                [topic_id],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|_| AppError::NotFound("分类规则目标主题不存在".to_string()))?;
        if target_domain_id.is_some_and(|domain_id| domain_id != topic_domain_id) {
            return Err(AppError::Validation(
                "分类规则的目标领域与目标主题不一致".to_string(),
            ));
        }
    }
    let duplicate = connection.query_row(
        "SELECT EXISTS(
           SELECT 1 FROM classification_rules
           WHERE rule_type = ?1 AND pattern = ?2
             AND ifnull(target_domain_id, 0) = ifnull(?3, 0)
             AND ifnull(target_topic_id, 0) = ifnull(?4, 0)
             AND (?5 IS NULL OR id <> ?5)
         )",
        params![
            rule_type,
            pattern.trim(),
            target_domain_id,
            target_topic_id,
            current_id
        ],
        |row| row.get::<_, i64>(0),
    )? != 0;
    if duplicate {
        return Err(AppError::Conflict("相同分类规则已经存在".to_string()));
    }
    Ok(())
}

fn normalized_json_object(value: &str) -> AppResult<String> {
    if value.trim().is_empty() {
        return Ok("{}".to_string());
    }
    let value = serde_json::from_str::<serde_json::Value>(value)?;
    if !value.is_object() {
        return Err(AppError::Validation(
            "分类规则附加配置必须是 JSON 对象".to_string(),
        ));
    }
    Ok(value.to_string())
}

fn infer_entity_type(value: &str) -> &'static str {
    match value {
        "Claude" | "ChatGPT" | "Gemini" => "model",
        "Codex" | "Fusion" | "Whisper" | "SQLite" | "Markdown" | "Obsidian" | "After Effects" => {
            "product"
        }
        "Google" | "Apple" | "极氪" | "特斯拉" => "company",
        "南京" | "河西" | "江宁" => "place",
        _ => "other",
    }
}

fn validate_proposition(statement_markdown: &str, status: &str) -> AppResult<()> {
    if statement_markdown.trim().is_empty() {
        return Err(AppError::Validation("命题内容不能为空".to_string()));
    }
    if !matches!(status, "open" | "supported" | "rejected" | "superseded") {
        return Err(AppError::Validation("命题状态无效".to_string()));
    }
    Ok(())
}

fn get_proposition(connection: &Connection, proposition_id: i64) -> AppResult<TopicPropositionRow> {
    connection
        .query_row(
            "SELECT id, public_id, topic_id, statement_markdown, status, created_at, updated_at
             FROM propositions WHERE id = ?1",
            [proposition_id],
            |row| {
                Ok(TopicPropositionRow {
                    id: row.get(0)?,
                    public_id: row.get(1)?,
                    topic_id: row.get(2)?,
                    statement_markdown: row.get(3)?,
                    status: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .map_err(|_| AppError::NotFound("命题不存在".to_string()))
}

fn require_topic_judgment(
    connection: &Connection,
    topic_id: i64,
    judgment_id: i64,
) -> AppResult<(String, String)> {
    connection
        .query_row(
            "SELECT statement_markdown, effective_at
             FROM judgment_snapshots
             WHERE id = ?1 AND topic_id = ?2",
            params![judgment_id, topic_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| AppError::Validation("转折点引用的判断快照不属于当前主题".to_string()))
}

fn validate_evidence_locator(source_type: &str, locator_json: &str) -> AppResult<String> {
    let raw = locator_json.trim();
    if raw.is_empty() || raw == "{}" {
        return Ok("{}".to_string());
    }
    let parsed = serde_json::from_str::<serde_json::Value>(raw)?;
    let object = parsed
        .as_object()
        .ok_or_else(|| AppError::Validation("证据锚点必须是 JSON 对象".to_string()))?;
    let legacy = [
        ("messageId", "message"),
        ("timecode", "timecode"),
        ("page", "page"),
        ("subtitleLine", "subtitle_line"),
        ("paragraph", "html_paragraph"),
        ("heading", "markdown_heading"),
        ("jsonPath", "json_path"),
        ("fragment", "file_fragment"),
    ]
    .into_iter()
    .find_map(|(field, kind)| {
        object
            .get(field)
            .and_then(|value| value.as_str())
            .map(|value| (kind, value))
    });
    let kind = object
        .get("kind")
        .and_then(|value| value.as_str())
        .or_else(|| legacy.map(|(kind, _)| kind))
        .unwrap_or("none");
    let value = object
        .get("value")
        .and_then(|value| value.as_str())
        .or_else(|| legacy.map(|(_, value)| value))
        .unwrap_or("")
        .trim();
    let quote = object
        .get("quote")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    if !matches!(
        kind,
        "none"
            | "message"
            | "timecode"
            | "subtitle_line"
            | "page"
            | "html_paragraph"
            | "markdown_heading"
            | "json_path"
            | "file_fragment"
            | "text_quote"
    ) {
        return Err(AppError::Validation("证据锚点类型无效".to_string()));
    }
    if kind == "none" {
        return Ok("{}".to_string());
    }
    if value.is_empty() {
        return Err(AppError::Validation("精确锚点值不能为空".to_string()));
    }
    if value.chars().count() > 500 || quote.chars().count() > 2_000 {
        return Err(AppError::Validation("证据锚点或短引用过长".to_string()));
    }
    let source_matches = match kind {
        "message" => matches!(source_type, "ai_conversation" | "json"),
        "timecode" => matches!(source_type, "audio" | "video" | "subtitle" | "transcript"),
        "subtitle_line" => matches!(source_type, "subtitle" | "transcript"),
        "page" => source_type == "pdf",
        "html_paragraph" => matches!(source_type, "html" | "web"),
        "markdown_heading" => source_type == "markdown",
        "json_path" => matches!(source_type, "json" | "ai_conversation"),
        "file_fragment" | "text_quote" => true,
        _ => false,
    };
    if !source_matches {
        return Err(AppError::Validation(format!(
            "锚点类型 {kind} 不适用于来源类型 {source_type}"
        )));
    }
    if kind == "page" && value.parse::<u32>().ok().filter(|page| *page > 0).is_none() {
        return Err(AppError::Validation("PDF 页码必须是正整数".to_string()));
    }
    Ok(serde_json::json!({
        "kind": kind,
        "value": value,
        "quote": quote,
    })
    .to_string())
}

fn evidence_locator_label(locator_json: &str) -> String {
    let Ok(parsed) = serde_json::from_str::<serde_json::Value>(locator_json) else {
        return "锚点格式异常".to_string();
    };
    let Some(object) = parsed.as_object() else {
        return "锚点格式异常".to_string();
    };
    let (kind, value) = if let (Some(kind), Some(value)) = (
        object.get("kind").and_then(|value| value.as_str()),
        object.get("value").and_then(|value| value.as_str()),
    ) {
        (kind, value)
    } else {
        [
            ("messageId", "消息"),
            ("timecode", "时间码"),
            ("page", "页码"),
            ("subtitleLine", "字幕行"),
            ("paragraph", "HTML 段落"),
            ("heading", "Markdown 标题"),
            ("jsonPath", "JSON 路径"),
            ("fragment", "文件片段"),
        ]
        .into_iter()
        .find_map(|(field, label)| {
            object
                .get(field)
                .and_then(|value| value.as_str())
                .map(|value| (label, value))
        })
        .unwrap_or(("none", ""))
    };
    let label = match kind {
        "message" => "消息",
        "timecode" => "时间码",
        "subtitle_line" => "字幕行",
        "page" => "PDF 页码",
        "html_paragraph" => "HTML 段落",
        "markdown_heading" => "Markdown 标题",
        "json_path" => "JSON 路径",
        "file_fragment" => "文件片段",
        "text_quote" => "短文本引用",
        "none" => return "未提供精确锚点".to_string(),
        other => other,
    };
    if value.is_empty() {
        "未提供精确锚点".to_string()
    } else {
        format!("{label}：{value}")
    }
}

fn validate_note_input(
    connection: &Connection,
    title: &str,
    note_type: &str,
    status: &str,
    organization_state: &str,
    primary_topic_id: i64,
    related_topic_ids: &[i64],
    source_item_ids: &[i64],
) -> AppResult<(Vec<i64>, Vec<i64>)> {
    if title.trim().is_empty() {
        return Err(AppError::Validation("笔记标题不能为空".to_string()));
    }
    if !matches!(
        note_type,
        "normal" | "research" | "conclusion" | "review" | "decision" | "project" | "summary"
    ) {
        return Err(AppError::Validation("笔记类型无效".to_string()));
    }
    if !matches!(status, "draft" | "active" | "archived") {
        return Err(AppError::Validation("笔记状态无效".to_string()));
    }
    if !matches!(organization_state, "inbox" | "organized") {
        return Err(AppError::Validation("笔记整理状态无效".to_string()));
    }
    require_active_topic(connection, primary_topic_id)?;
    let mut related_topic_ids = related_topic_ids.to_vec();
    related_topic_ids.sort_unstable();
    related_topic_ids.dedup();
    related_topic_ids.retain(|topic_id| *topic_id != primary_topic_id);
    for topic_id in &related_topic_ids {
        require_active_topic(connection, *topic_id)?;
    }
    let mut source_item_ids = source_item_ids.to_vec();
    source_item_ids.sort_unstable();
    source_item_ids.dedup();
    for source_item_id in &source_item_ids {
        connection
            .query_row(
                "SELECT 1 FROM source_items WHERE id = ?1 AND status = 'active'",
                [source_item_id],
                |_| Ok(()),
            )
            .map_err(|_| AppError::NotFound("笔记关联的来源不存在".to_string()))?;
    }
    Ok((related_topic_ids, source_item_ids))
}

fn require_active_topic(connection: &Connection, topic_id: i64) -> AppResult<()> {
    connection
        .query_row(
            "SELECT 1 FROM topics WHERE id = ?1 AND status NOT IN ('archived', 'merged')",
            [topic_id],
            |_| Ok(()),
        )
        .map_err(|_| AppError::NotFound("笔记关联的主题不存在或不可用".to_string()))
}

fn write_note_links(
    connection: &Connection,
    note_id: i64,
    primary_topic_id: i64,
    related_topic_ids: &[i64],
    source_item_ids: &[i64],
    created_at: &str,
) -> AppResult<()> {
    connection.execute(
        "INSERT INTO note_topics(note_id, topic_id, role, confidence, created_at)
         VALUES (?1, ?2, 'primary', 100, ?3)",
        params![note_id, primary_topic_id, created_at],
    )?;
    for topic_id in related_topic_ids {
        connection.execute(
            "INSERT INTO note_topics(note_id, topic_id, role, confidence, created_at)
             VALUES (?1, ?2, 'secondary', NULL, ?3)",
            params![note_id, topic_id, created_at],
        )?;
    }
    for source_item_id in source_item_ids {
        connection.execute(
            "INSERT INTO note_sources(
               note_id, source_item_id, relation_type, locator_json, created_at
             ) VALUES (?1, ?2, 'derived_from', '{}', ?3)",
            params![note_id, source_item_id, created_at],
        )?;
    }
    Ok(())
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
                verification_status: "verified".to_string(),
                validity_status: "active".to_string(),
                locator_json:
                    r#"{"kind":"text_quote","value":"GPU 与本地知识库","quote":"GPU 与本地知识库"}"#
                        .to_string(),
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
    fn classification_context_uses_persisted_rules_entities_history_and_bm25() {
        let mut connection = database::open_memory_database().expect("database");
        let domain = create_domain(
            &connection,
            &CreateKnowledgeDomainInput {
                name: "AI 与软件".to_string(),
                description: String::new(),
            },
        )
        .expect("domain");
        let target_topic = create_topic(
            &connection,
            &CreateKnowledgeTopicInput {
                domain_id: domain.id,
                parent_topic_id: None,
                name: "模型与成本".to_string(),
                description: "Claude API token 推理价格".to_string(),
                topic_kind: "subject".to_string(),
            },
        )
        .expect("target topic");
        create_topic(
            &connection,
            &CreateKnowledgeTopicInput {
                domain_id: domain.id,
                parent_topic_id: None,
                name: "代码编辑器".to_string(),
                description: "IDE 插件快捷键".to_string(),
                topic_kind: "subject".to_string(),
            },
        )
        .expect("other topic");
        let now = Utc::now().to_rfc3339();
        connection
            .execute(
                "INSERT INTO topic_aliases(
                   topic_id, alias, normalized_alias, alias_type, created_at
                 ) VALUES (?1, '模型价格', '模型价格', 'name', ?2)",
                params![target_topic.id, now],
            )
            .expect("alias");
        connection
            .execute(
                "INSERT INTO entity_dictionary(
                   canonical_name, normalized_name, aliases_json, created_at, updated_at
                 ) VALUES ('Claude', 'claude', '[\"Anthropic\"]', ?1, ?1)",
                [now.as_str()],
            )
            .expect("dictionary");
        connection
            .execute(
                "INSERT INTO classification_rules(
                   public_id, rule_type, pattern, target_topic_id, weight,
                   priority, enabled, created_at, updated_at
                 ) VALUES
                   ('rule-entity-claude', 'entity', 'Claude', ?1, 0.9, 10, 1, ?2, ?2),
                   ('rule-keyword-token', 'keyword', 'token', ?1, 0.8, 5, 1, ?2, ?2)",
                params![target_topic.id, now],
            )
            .expect("rules");

        database::create_record(
            &mut connection,
            &CreateRecordInput {
                title: "历史 Claude API 成本".to_string(),
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
                source_text: "Claude API token 价格".to_string(),
                sources: Vec::new(),
                is_favorite: false,
            },
        )
        .expect("historical source");
        let historical_source = list_inbox(&connection, 20)
            .expect("historical inbox")
            .into_iter()
            .find(|item| item.title == "历史 Claude API 成本")
            .expect("historical row");
        confirm_classification(
            &mut connection,
            &ConfirmKnowledgeClassificationInput {
                source_item_id: historical_source.id,
                topic_id: target_topic.id,
                suggestion_id: None,
                confidence: 95.0,
            },
        )
        .expect("historical confirmation");

        database::create_record(
            &mut connection,
            &CreateRecordInput {
                title: "Claude token 推理价格观察".to_string(),
                original_at: None,
                summary: String::new(),
                status: Default::default(),
                tags: vec!["模型".to_string()],
                current_judgment: String::new(),
                confirmed_facts: Vec::new(),
                key_evidence: Vec::new(),
                open_questions: Vec::new(),
                next_actions: Vec::new(),
                notes: String::new(),
                source_text: "Anthropic 调整 Claude API token 成本".to_string(),
                sources: Vec::new(),
                is_favorite: false,
            },
        )
        .expect("target source");
        let source = list_inbox(&connection, 20)
            .expect("target inbox")
            .into_iter()
            .find(|item| item.title == "Claude token 推理价格观察")
            .expect("target row");

        let first =
            prepare_classification_context(&connection, source.id).expect("classification context");
        let second =
            prepare_classification_context(&connection, source.id).expect("deterministic context");
        assert_eq!(first, second);
        let topic = first
            .topics
            .iter()
            .find(|topic| topic.id == target_topic.id.to_string())
            .expect("target topic context");
        assert_eq!(topic.path, vec!["AI 与软件", "模型与成本"]);
        assert!(topic.aliases.contains(&"模型价格".to_string()));
        assert!(topic.entities.contains(&"Claude".to_string()));
        assert!(topic.entities.contains(&"Anthropic".to_string()));
        assert!(first.rules.iter().any(|rule| {
            rule.topic_id == target_topic.id.to_string()
                && rule.value == "token"
                && rule.strength == 0.8
        }));
        assert_eq!(
            first
                .history
                .confirmed_topic_counts
                .get(&target_topic.id.to_string()),
            Some(&1)
        );
        assert!(first
            .history
            .recent_topic_ids
            .contains(&target_topic.id.to_string()));
        let signal = first
            .search_signals
            .iter()
            .find(|signal| signal.topic_id == target_topic.id.to_string())
            .expect("bm25 signal");
        assert!(signal.normalized_score > 0.0);
        assert!(signal.reason.contains("FTS5/BM25"));
    }

    #[test]
    fn personal_catalog_preview_is_read_only_and_apply_is_additive_and_idempotent() {
        let mut connection = database::open_memory_database().expect("database");
        let proposal = get_personal_catalog_proposal();
        assert_eq!(proposal.version, personal_catalog::PERSONAL_CATALOG_VERSION);
        assert!(!proposal.domains.is_empty());
        assert!(!proposal.topics.is_empty());
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM domains", [], |row| row
                    .get::<_, i64>(0))
                .expect("domain count"),
            0
        );

        let first = apply_personal_catalog(
            &mut connection,
            &ApplyPersonalCatalogInput {
                version: proposal.version.clone(),
            },
        )
        .expect("first apply");
        assert_eq!(first.created_domains, proposal.domains.len());
        assert_eq!(first.created_topics, proposal.topics.len());
        assert!(first.created_aliases > 0);
        assert!(first.created_entities > 0);
        assert!(first.created_rules > 0);
        let topic_count = connection
            .query_row("SELECT COUNT(*) FROM topics", [], |row| {
                row.get::<_, i64>(0)
            })
            .expect("topic count");

        let second = apply_personal_catalog(
            &mut connection,
            &ApplyPersonalCatalogInput {
                version: proposal.version,
            },
        )
        .expect("second apply");
        assert_eq!(second.created_domains, 0);
        assert_eq!(second.created_topics, 0);
        assert_eq!(second.created_aliases, 0);
        assert_eq!(second.created_entities, 0);
        assert_eq!(second.created_rules, 0);
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM topics", [], |row| row
                    .get::<_, i64>(0))
                .expect("stable topic count"),
            topic_count
        );
    }

    #[test]
    fn classification_knowledge_crud_validates_updates_duplicates_and_deletes() {
        let connection = database::open_memory_database().expect("database");
        let domain = create_domain(
            &connection,
            &CreateKnowledgeDomainInput {
                name: "测试领域".to_string(),
                description: String::new(),
            },
        )
        .expect("domain");
        let topic = create_topic(
            &connection,
            &CreateKnowledgeTopicInput {
                domain_id: domain.id,
                parent_topic_id: None,
                name: "测试主题".to_string(),
                description: String::new(),
                topic_kind: "subject".to_string(),
            },
        )
        .expect("topic");

        let alias = create_topic_alias(
            &connection,
            &CreateTopicAliasInput {
                topic_id: topic.id,
                alias: "旧名称".to_string(),
                alias_type: "redirect".to_string(),
            },
        )
        .expect("alias");
        let alias = update_topic_alias(
            &connection,
            &UpdateTopicAliasInput {
                id: alias.id,
                alias: "历史名称".to_string(),
                alias_type: "legacy_tag".to_string(),
            },
        )
        .expect("updated alias");
        assert_eq!(alias.alias, "历史名称");
        assert!(create_topic_alias(
            &connection,
            &CreateTopicAliasInput {
                topic_id: topic.id,
                alias: "历史名称".to_string(),
                alias_type: "name".to_string(),
            }
        )
        .is_err());

        let entity = create_entity_dictionary_entry(
            &connection,
            &CreateEntityDictionaryInput {
                canonical_name: "Microsoft".to_string(),
                entity_type: "company".to_string(),
                aliases: vec!["微软".to_string(), "MSFT".to_string()],
                description: "公司实体".to_string(),
            },
        )
        .expect("entity");
        let entity = update_entity_dictionary_entry(
            &connection,
            &UpdateEntityDictionaryInput {
                id: entity.id,
                canonical_name: "Microsoft".to_string(),
                entity_type: "company".to_string(),
                aliases: vec!["微软".to_string()],
                description: "更新后的公司实体".to_string(),
            },
        )
        .expect("updated entity");
        assert_eq!(entity.aliases, vec!["微软"]);

        let rule = create_classification_rule(
            &connection,
            &CreateClassificationRuleInput {
                rule_type: "keyword".to_string(),
                pattern: "Azure".to_string(),
                target_domain_id: Some(domain.id),
                target_topic_id: Some(topic.id),
                weight: 0.8,
                priority: 5,
                enabled: true,
                config_json: "{}".to_string(),
            },
        )
        .expect("rule");
        let rule = update_classification_rule(
            &connection,
            &UpdateClassificationRuleInput {
                id: rule.id,
                rule_type: "negative_keyword".to_string(),
                pattern: "招聘".to_string(),
                target_domain_id: Some(domain.id),
                target_topic_id: Some(topic.id),
                weight: 0.6,
                priority: 10,
                enabled: false,
                config_json: r#"{"reason":"排除招聘信息"}"#.to_string(),
            },
        )
        .expect("updated rule");
        assert_eq!(rule.rule_type, "negative_keyword");
        assert!(!rule.enabled);
        assert!(create_classification_rule(
            &connection,
            &CreateClassificationRuleInput {
                rule_type: "keyword".to_string(),
                pattern: String::new(),
                target_domain_id: Some(domain.id),
                target_topic_id: Some(topic.id),
                weight: 2.0,
                priority: 0,
                enabled: true,
                config_json: "[]".to_string(),
            }
        )
        .is_err());

        assert!(
            delete_topic_alias(&connection, alias.id)
                .expect("delete alias")
                .deleted
        );
        assert!(
            delete_entity_dictionary_entry(&connection, entity.id)
                .expect("delete entity")
                .deleted
        );
        assert!(
            delete_classification_rule(&connection, rule.id)
                .expect("delete rule")
                .deleted
        );
    }

    #[test]
    fn classification_correction_is_saved_as_feedback_and_remains_undoable() {
        let mut connection = database::open_memory_database().expect("database");
        database::create_record(
            &mut connection,
            &CreateRecordInput {
                title: "需要纠正的来源".to_string(),
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
                source_text: "实际属于软件开发".to_string(),
                sources: Vec::new(),
                is_favorite: false,
            },
        )
        .expect("source");
        let source_id = list_inbox(&connection, 20).expect("inbox")[0].id;
        let domain = create_domain(
            &connection,
            &CreateKnowledgeDomainInput {
                name: "纠正测试".to_string(),
                description: String::new(),
            },
        )
        .expect("domain");
        let wrong = create_topic(
            &connection,
            &CreateKnowledgeTopicInput {
                domain_id: domain.id,
                parent_topic_id: None,
                name: "错误主题".to_string(),
                description: String::new(),
                topic_kind: "subject".to_string(),
            },
        )
        .expect("wrong topic");
        let correct = create_topic(
            &connection,
            &CreateKnowledgeTopicInput {
                domain_id: domain.id,
                parent_topic_id: None,
                name: "正确主题".to_string(),
                description: String::new(),
                topic_kind: "subject".to_string(),
            },
        )
        .expect("correct topic");
        let suggestions = save_classification_suggestions(
            &mut connection,
            &SaveKnowledgeSuggestionsInput {
                source_item_id: source_id,
                classifier_version: "local-rules-v1".to_string(),
                suggestions: vec![
                    KnowledgeSuggestionInput {
                        topic_id: Some(wrong.id),
                        score: 91.0,
                        decision: "auto_eligible".to_string(),
                        reasons: vec!["错误高分".to_string()],
                        signal_scores_json: "{}".to_string(),
                    },
                    KnowledgeSuggestionInput {
                        topic_id: Some(correct.id),
                        score: 80.0,
                        decision: "confirm".to_string(),
                        reasons: vec!["正确候选".to_string()],
                        signal_scores_json: "{}".to_string(),
                    },
                ],
            },
        )
        .expect("suggestions");
        let correct_suggestion_id = suggestions
            .iter()
            .find(|suggestion| suggestion.suggested_topic_id == Some(correct.id))
            .expect("correct suggestion")
            .id;
        let result = confirm_classification(
            &mut connection,
            &ConfirmKnowledgeClassificationInput {
                source_item_id: source_id,
                topic_id: correct.id,
                suggestion_id: Some(correct_suggestion_id),
                confidence: 80.0,
            },
        )
        .expect("corrected classification");
        let reviewed =
            list_classification_suggestions(&connection, source_id).expect("reviewed suggestions");
        assert!(reviewed.iter().any(|item| {
            item.suggested_topic_id == Some(wrong.id) && item.status == "modified"
        }));
        assert!(reviewed.iter().any(|item| {
            item.suggested_topic_id == Some(correct.id) && item.status == "accepted"
        }));
        let after_json = connection
            .query_row(
                "SELECT after_json FROM operation_logs WHERE id = ?1",
                [result.operation_id],
                |row| row.get::<_, String>(0),
            )
            .expect("feedback log");
        assert!(after_json.contains("modified_suggestion"));
        assert!(after_json.contains(&format!("\"chosenTopicId\":{}", correct.id)));

        undo_classification(&mut connection, result.operation_id).expect("undo");
        assert!(list_classification_suggestions(&connection, source_id)
            .expect("undone suggestions")
            .iter()
            .filter(|item| matches!(item.suggested_topic_id, Some(id) if id == wrong.id || id == correct.id))
            .all(|item| item.status == "undone" || item.status == "rejected"));
    }

    #[test]
    fn note_crud_preserves_sources_and_updates_topic_links_transactionally() {
        let mut connection = database::open_memory_database().expect("database");
        database::create_record(
            &mut connection,
            &CreateRecordInput {
                title: "笔记来源".to_string(),
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
                source_text: "必须保持不变的原始正文".to_string(),
                sources: Vec::new(),
                is_favorite: false,
            },
        )
        .expect("source");
        let source = list_inbox(&connection, 20).expect("inbox")[0].clone();
        let domain = create_domain(
            &connection,
            &CreateKnowledgeDomainInput {
                name: "笔记测试".to_string(),
                description: String::new(),
            },
        )
        .expect("domain");
        let first_topic = create_topic(
            &connection,
            &CreateKnowledgeTopicInput {
                domain_id: domain.id,
                parent_topic_id: None,
                name: "主要主题".to_string(),
                description: String::new(),
                topic_kind: "subject".to_string(),
            },
        )
        .expect("first topic");
        let second_topic = create_topic(
            &connection,
            &CreateKnowledgeTopicInput {
                domain_id: domain.id,
                parent_topic_id: None,
                name: "相关主题".to_string(),
                description: String::new(),
                topic_kind: "subject".to_string(),
            },
        )
        .expect("second topic");

        let created = create_note(
            &mut connection,
            &CreateKnowledgeNoteInput {
                title: "研究笔记".to_string(),
                body_markdown: "初始整理内容".to_string(),
                summary: "摘要".to_string(),
                note_type: "research".to_string(),
                status: "draft".to_string(),
                organization_state: "organized".to_string(),
                primary_topic_id: first_topic.id,
                related_topic_ids: vec![first_topic.id, second_topic.id, second_topic.id],
                source_item_ids: vec![source.id, source.id],
            },
        )
        .expect("created note");
        assert_eq!(created.primary_topic_id, first_topic.id);
        assert_eq!(created.related_topic_ids, vec![second_topic.id]);
        assert_eq!(created.source_item_ids, vec![source.id]);
        assert_eq!(
            get_topic_detail(&connection, first_topic.id)
                .expect("first detail")
                .notes
                .len(),
            1
        );
        assert_eq!(
            get_topic_detail(&connection, second_topic.id)
                .expect("second detail")
                .notes
                .len(),
            1
        );

        let updated = update_note(
            &mut connection,
            &UpdateKnowledgeNoteInput {
                id: created.id,
                title: "更新后的研究笔记".to_string(),
                body_markdown: "更新后的独立 Note 正文".to_string(),
                summary: "新摘要".to_string(),
                note_type: "conclusion".to_string(),
                status: "active".to_string(),
                organization_state: "organized".to_string(),
                primary_topic_id: second_topic.id,
                related_topic_ids: vec![first_topic.id],
                source_item_ids: vec![source.id],
            },
        )
        .expect("updated note");
        assert_eq!(updated.primary_topic_id, second_topic.id);
        assert_eq!(updated.related_topic_ids, vec![first_topic.id]);
        assert_eq!(
            connection
                .query_row(
                    "SELECT original_text FROM source_items WHERE id = ?1",
                    [source.id],
                    |row| row.get::<_, String>(0),
                )
                .expect("source text"),
            "必须保持不变的原始正文"
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH '更新后的'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("note fts"),
            1
        );

        let archived = archive_note(&connection, created.id).expect("archive");
        assert_eq!(archived.status, "archived");
        assert!(list_notes(&connection, Some(second_topic.id), false)
            .expect("active notes")
            .is_empty());
        assert_eq!(
            list_notes(&connection, Some(second_topic.id), true)
                .expect("all notes")
                .len(),
            1
        );
    }

    #[test]
    fn propositions_and_user_confirmed_turning_points_have_independent_lifecycles() {
        let mut connection = database::open_memory_database().expect("database");
        let domain = create_domain(
            &connection,
            &CreateKnowledgeDomainInput {
                name: "判断演化".to_string(),
                description: String::new(),
            },
        )
        .expect("domain");
        let topic = create_topic(
            &connection,
            &CreateKnowledgeTopicInput {
                domain_id: domain.id,
                parent_topic_id: None,
                name: "渲染策略".to_string(),
                description: String::new(),
                topic_kind: "subject".to_string(),
            },
        )
        .expect("topic");
        let proposition = create_proposition(
            &connection,
            &CreateTopicPropositionInput {
                topic_id: topic.id,
                statement_markdown: "离线渲染更适合当前项目".to_string(),
                status: "open".to_string(),
            },
        )
        .expect("proposition");
        let proposition = update_proposition(
            &connection,
            &UpdateTopicPropositionInput {
                id: proposition.id,
                statement_markdown: "离线渲染在当前交付周期内更稳定".to_string(),
                status: "supported".to_string(),
            },
        )
        .expect("updated proposition");
        assert_eq!(proposition.status, "supported");

        let first = add_topic_judgment(
            &mut connection,
            &AddTopicJudgmentInput {
                topic_id: topic.id,
                statement_markdown: "先使用实时渲染".to_string(),
                confidence: 65.0,
                state: "tentative".to_string(),
                change_reason: String::new(),
            },
        )
        .expect("first judgment");
        let second = add_topic_judgment(
            &mut connection,
            &AddTopicJudgmentInput {
                topic_id: topic.id,
                statement_markdown: "改用离线渲染".to_string(),
                confidence: 88.0,
                state: "current".to_string(),
                change_reason: "交付稳定性要求提高".to_string(),
            },
        )
        .expect("second judgment");
        assert!(
            list_turning_points(&connection, topic.id)
                .expect("turning points before confirmation")
                .is_empty(),
            "填写变化原因不能自动升格为关键转折"
        );
        let turning_point = create_turning_point(
            &connection,
            &CreateTopicTurningPointInput {
                topic_id: topic.id,
                from_judgment_id: Some(first.id),
                to_judgment_id: second.id,
                title: "从实时切换到离线".to_string(),
                explanation: "稳定性证据改变了交付判断".to_string(),
                occurred_at: String::new(),
            },
        )
        .expect("confirmed turning point");
        assert_eq!(
            turning_point.from_statement_markdown.as_deref(),
            Some("先使用实时渲染")
        );
        assert_eq!(turning_point.to_statement_markdown, "改用离线渲染");
        assert!(create_turning_point(
            &connection,
            &CreateTopicTurningPointInput {
                topic_id: topic.id,
                from_judgment_id: Some(first.id),
                to_judgment_id: second.id,
                title: "重复".to_string(),
                explanation: "不应重复".to_string(),
                occurred_at: String::new(),
            },
        )
        .is_err());

        let proposition = supersede_proposition(&connection, proposition.id).expect("supersede");
        assert_eq!(proposition.status, "superseded");
        let detail = get_topic_detail(&connection, topic.id).expect("detail");
        assert_eq!(detail.propositions.len(), 1);
        assert_eq!(detail.turning_points.len(), 1);
        let context = compile_topic_context(&connection, topic.id).expect("context");
        assert!(context.contains("关键转折"));
        assert!(!context.contains("离线渲染在当前交付周期内更稳定"));
    }

    #[test]
    fn evidence_locator_is_typed_canonical_and_source_aware() {
        let canonical =
            validate_evidence_locator("pdf", r#"{"kind":"page","value":"12","quote":"关键表格"}"#)
                .expect("pdf locator");
        assert_eq!(evidence_locator_label(&canonical), "PDF 页码：12");
        assert!(validate_evidence_locator(
            "markdown",
            r#"{"kind":"page","value":"12","quote":""}"#
        )
        .is_err());
        assert!(
            validate_evidence_locator("video", r#"{"kind":"timecode","value":"","quote":""}"#)
                .is_err()
        );
        assert_eq!(
            validate_evidence_locator("text", "{}").expect("empty locator"),
            "{}"
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
        create_topic_alias(
            &connection,
            &CreateTopicAliasInput {
                topic_id: source_topic.id,
                alias: "旧知识库名称".to_string(),
                alias_type: "name".to_string(),
            },
        )
        .expect("source alias");
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
                verification_status: "unverified".to_string(),
                validity_status: "active".to_string(),
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
        assert!(preview
            .redirect_aliases
            .contains(&"旧知识库名称".to_string()));
        assert!(preview
            .redirect_aliases
            .contains(&"知识管理 / 知识库".to_string()));
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
        let redirected_aliases =
            list_topic_aliases(&connection, Some(target_topic.id)).expect("redirect aliases");
        assert!(redirected_aliases.iter().any(|alias| {
            alias.alias == "旧知识库名称" && alias.alias_type == "redirect"
        }));
        assert!(redirected_aliases.iter().any(|alias| {
            alias.alias == "知识管理 / 知识库" && alias.alias_type == "redirect"
        }));
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
        assert!(list_topic_aliases(&connection, Some(target_topic.id))
            .expect("redirect aliases after undo")
            .is_empty());
    }
}
