use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RecordStatus {
    Normal,
    Tracking,
    Verification,
    Updated,
}

impl Default for RecordStatus {
    fn default() -> Self {
        Self::Normal
    }
}

impl RecordStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Normal => "normal",
            Self::Tracking => "tracking",
            Self::Verification => "verification",
            Self::Updated => "updated",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "normal" => Some(Self::Normal),
            "tracking" => Some(Self::Tracking),
            "verification" => Some(Self::Verification),
            "updated" => Some(Self::Updated),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceItem {
    pub content: String,
    #[serde(default)]
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct RecordSourceInput {
    #[serde(default = "default_source_type")]
    pub source_type: String,
    #[serde(default)]
    pub title: String,
    pub url: Option<String>,
    pub local_path: Option<String>,
    pub external_id: Option<String>,
}

fn default_source_type() -> String {
    "manual".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecordSource {
    pub id: i64,
    pub record_id: i64,
    pub source_type: String,
    pub title: String,
    pub url: Option<String>,
    pub local_path: Option<String>,
    pub external_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentItem {
    pub id: i64,
    pub record_id: i64,
    pub file_name: String,
    pub stored_path: String,
    pub original_path: Option<String>,
    pub mime_type: Option<String>,
    pub size_bytes: i64,
    pub sha256: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntelligenceRecord {
    pub id: i64,
    pub title: String,
    pub summary: String,
    pub status: RecordStatus,
    pub tags: Vec<String>,
    pub current_judgment: String,
    pub confirmed_facts: Vec<String>,
    pub key_evidence: Vec<EvidenceItem>,
    pub open_questions: Vec<String>,
    pub next_actions: Vec<String>,
    pub notes: String,
    pub source_text: String,
    pub sources: Vec<RecordSource>,
    pub is_favorite: bool,
    pub is_deleted: bool,
    #[serde(default)]
    pub original_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub version_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecordSummary {
    pub id: i64,
    pub title: String,
    pub display_title: String,
    pub summary: String,
    pub status: RecordStatus,
    pub tags: Vec<String>,
    pub source_title: String,
    pub primary_topic_name: Option<String>,
    pub search_snippet: String,
    pub is_favorite: bool,
    pub is_deleted: bool,
    pub original_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub version_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteUpdate {
    pub record_id: i64,
    pub is_favorite: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecordMutation {
    pub record_id: i64,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateJudgmentInput {
    pub record_id: i64,
    pub current_judgment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatusInput {
    pub record_id: i64,
    pub status: RecordStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecordInput {
    pub title: String,
    #[serde(default)]
    pub original_at: Option<String>,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub status: RecordStatus,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub current_judgment: String,
    #[serde(default)]
    pub confirmed_facts: Vec<String>,
    #[serde(default)]
    pub key_evidence: Vec<EvidenceItem>,
    #[serde(default)]
    pub open_questions: Vec<String>,
    #[serde(default)]
    pub next_actions: Vec<String>,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub source_text: String,
    #[serde(default)]
    pub sources: Vec<RecordSourceInput>,
    #[serde(default)]
    pub is_favorite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecordInput {
    pub title: String,
    pub summary: String,
    pub status: RecordStatus,
    pub tags: Vec<String>,
    pub current_judgment: String,
    pub confirmed_facts: Vec<String>,
    pub key_evidence: Vec<EvidenceItem>,
    pub open_questions: Vec<String>,
    pub next_actions: Vec<String>,
    pub notes: String,
    pub source_text: String,
    pub sources: Vec<RecordSourceInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PatchRecordInput {
    pub title: Option<String>,
    pub summary: Option<String>,
    pub status: Option<RecordStatus>,
    pub tags: Option<Vec<String>>,
    pub current_judgment: Option<String>,
    pub confirmed_facts: Option<Vec<String>>,
    pub key_evidence: Option<Vec<EvidenceItem>>,
    pub open_questions: Option<Vec<String>>,
    pub next_actions: Option<Vec<String>>,
    pub notes: Option<String>,
    pub source_text: Option<String>,
    pub sources: Option<Vec<RecordSourceInput>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RecordQuery {
    pub search: Option<String>,
    pub status: Option<RecordStatus>,
    pub tag: Option<String>,
    pub source: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    #[serde(default)]
    pub favorites_only: bool,
    #[serde(default)]
    pub include_deleted: bool,
    #[serde(default)]
    pub deleted_only: bool,
    pub sort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordVersion {
    pub id: i64,
    pub record_id: i64,
    pub version_number: i64,
    pub version_title: String,
    pub change_note: String,
    pub snapshot: IntelligenceRecord,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppendVersionInput {
    pub record_id: i64,
    #[serde(default)]
    pub version_title: String,
    #[serde(default)]
    pub change_note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreVersionInput {
    pub record_id: i64,
    pub version_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermanentDeleteInput {
    pub record_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteVersionInput {
    pub record_id: i64,
    pub version_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagItem {
    pub id: i64,
    pub name: String,
    pub color_key: String,
    pub record_count: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTagInput {
    pub name: String,
    #[serde(default = "default_color_key")]
    pub color_key: String,
}

fn default_color_key() -> String {
    "blue".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameTagInput {
    pub tag_id: i64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataLocation {
    pub root: String,
    pub database: String,
    pub imports: String,
    pub attachments: String,
    pub exports: String,
    pub backups: String,
    pub logs: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StorageStats {
    pub record_count: i64,
    pub database_bytes: u64,
    pub imports_bytes: u64,
    pub attachments_bytes: u64,
    pub backups_bytes: u64,
    pub total_bytes: u64,
    pub disk_available_bytes: u64,
    pub disk_total_bytes: u64,
    pub last_backup_at: Option<String>,
}
