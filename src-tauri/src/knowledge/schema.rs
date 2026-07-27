#[cfg(test)]
use rusqlite::{Connection, Error, Result};

#[cfg(test)]
pub(crate) const KNOWLEDGE_SCHEMA_VERSION: i64 = 2;

pub(crate) const KNOWLEDGE_SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS knowledge_schema_contract (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  normalized_name TEXT NOT NULL UNIQUE CHECK (length(trim(normalized_name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE RESTRICT,
  parent_topic_id INTEGER REFERENCES topics(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  normalized_name TEXT NOT NULL CHECK (length(trim(normalized_name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  topic_kind TEXT NOT NULL DEFAULT 'subject'
    CHECK (topic_kind IN ('category', 'subject', 'project', 'entity', 'system')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'watching', 'paused', 'archived', 'merged')),
  depth INTEGER NOT NULL DEFAULT 1 CHECK (depth >= 1),
  sort_order INTEGER NOT NULL DEFAULT 0,
  manual_locked INTEGER NOT NULL DEFAULT 0 CHECK (manual_locked IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (parent_topic_id IS NULL OR parent_topic_id <> id),
  UNIQUE (domain_id, parent_topic_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS topic_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  alias TEXT NOT NULL CHECK (length(trim(alias)) > 0),
  normalized_alias TEXT NOT NULL CHECK (length(trim(normalized_alias)) > 0),
  alias_type TEXT NOT NULL DEFAULT 'name'
    CHECK (alias_type IN ('name', 'abbreviation', 'redirect', 'legacy_tag')),
  created_at TEXT NOT NULL,
  UNIQUE (topic_id, normalized_alias)
);

CREATE TABLE IF NOT EXISTS topic_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  to_topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL
    CHECK (relation_type IN (
      'same_topic', 'upstream_downstream', 'causal', 'comparison',
      'supports', 'opposes', 'prerequisite', 'follow_up',
      'same_company', 'same_product', 'same_event', 'related'
    )),
  confidence REAL NOT NULL DEFAULT 100 CHECK (confidence BETWEEN 0 AND 100),
  created_by TEXT NOT NULL DEFAULT 'user'
    CHECK (created_by IN ('user', 'rule', 'classifier', 'migration')),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  CHECK (from_topic_id <> to_topic_id),
  UNIQUE (from_topic_id, to_topic_id, relation_type)
);

CREATE TABLE IF NOT EXISTS source_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  legacy_record_id INTEGER UNIQUE REFERENCES records(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL
    CHECK (source_type IN (
      'ai_conversation', 'web', 'json', 'markdown', 'text', 'html',
      'pdf', 'audio', 'video', 'subtitle', 'transcript', 'image',
      'manual', 'file'
    )),
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  platform TEXT NOT NULL DEFAULT '',
  original_text TEXT NOT NULL DEFAULT '',
  original_json TEXT,
  source_uri TEXT,
  local_path TEXT,
  mime_type TEXT,
  content_sha256 TEXT,
  author TEXT,
  original_at TEXT,
  imported_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  read_state TEXT NOT NULL DEFAULT 'unread'
    CHECK (read_state IN ('unread', 'read')),
  organization_state TEXT NOT NULL DEFAULT 'inbox'
    CHECK (organization_state IN ('inbox', 'organized')),
  duplicate_state TEXT NOT NULL DEFAULT 'unknown'
    CHECK (duplicate_state IN ('unknown', 'unique', 'duplicate')),
  freshness_state TEXT NOT NULL DEFAULT 'current'
    CHECK (freshness_state IN ('current', 'possibly_outdated', 'outdated')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  UNIQUE (legacy_record_id)
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  body_markdown TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  note_type TEXT NOT NULL DEFAULT 'normal'
    CHECK (note_type IN (
      'normal', 'research', 'conclusion', 'review',
      'decision', 'project', 'summary'
    )),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  organization_state TEXT NOT NULL DEFAULT 'inbox'
    CHECK (organization_state IN ('inbox', 'organized')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS note_sources (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  source_item_id INTEGER NOT NULL REFERENCES source_items(id) ON DELETE RESTRICT,
  relation_type TEXT NOT NULL DEFAULT 'derived_from'
    CHECK (relation_type IN ('derived_from', 'quotes', 'summarizes', 'references')),
  locator_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  PRIMARY KEY (note_id, source_item_id, relation_type)
);

CREATE TABLE IF NOT EXISTS note_topics (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT 'secondary' CHECK (role IN ('primary', 'secondary')),
  confidence REAL CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 100),
  created_at TEXT NOT NULL,
  PRIMARY KEY (note_id, topic_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_note_topics_one_primary
  ON note_topics(note_id) WHERE role = 'primary';

CREATE TABLE IF NOT EXISTS source_topics (
  source_item_id INTEGER NOT NULL REFERENCES source_items(id) ON DELETE CASCADE,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT 'secondary' CHECK (role IN ('primary', 'secondary')),
  confidence REAL CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 100),
  classification_suggestion_id INTEGER REFERENCES classification_suggestions(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (source_item_id, topic_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_source_topics_one_primary
  ON source_topics(source_item_id) WHERE role = 'primary';

CREATE TABLE IF NOT EXISTS judgment_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  source_note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL,
  statement_markdown TEXT NOT NULL CHECK (length(trim(statement_markdown)) > 0),
  state TEXT NOT NULL DEFAULT 'current'
    CHECK (state IN (
      'pending', 'tentative', 'current', 'doubtful',
      'partially_refuted', 'refuted', 'expired'
    )),
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  change_reason TEXT NOT NULL DEFAULT '',
  unresolved_questions_json TEXT NOT NULL DEFAULT '[]',
  effective_at TEXT NOT NULL,
  replaced_by_id INTEGER REFERENCES judgment_snapshots(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  CHECK (replaced_by_id IS NULL OR replaced_by_id <> id)
);

CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  source_item_id INTEGER NOT NULL REFERENCES source_items(id) ON DELETE RESTRICT,
  note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL,
  content_markdown TEXT NOT NULL CHECK (length(trim(content_markdown)) > 0),
  stance TEXT NOT NULL DEFAULT 'context'
    CHECK (stance IN ('support', 'oppose', 'context')),
  credibility REAL NOT NULL DEFAULT 0 CHECK (credibility BETWEEN 0 AND 100),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'verified', 'disputed')),
  validity_status TEXT NOT NULL DEFAULT 'active'
    CHECK (validity_status IN ('active', 'possibly_outdated', 'expired')),
  locator_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS open_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  question TEXT NOT NULL CHECK (length(trim(question)) > 0),
  importance TEXT NOT NULL DEFAULT 'medium'
    CHECK (importance IN ('low', 'medium', 'high')),
  affects_current_judgment INTEGER NOT NULL DEFAULT 0
    CHECK (affects_current_judgment IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  resolution_note TEXT NOT NULL DEFAULT '',
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS turning_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  from_judgment_id INTEGER REFERENCES judgment_snapshots(id) ON DELETE SET NULL,
  to_judgment_id INTEGER NOT NULL REFERENCES judgment_snapshots(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  explanation TEXT NOT NULL DEFAULT '',
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (from_judgment_id IS NULL OR from_judgment_id <> to_judgment_id)
);

CREATE TABLE IF NOT EXISTS entity_dictionary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_name TEXT NOT NULL CHECK (length(trim(canonical_name)) > 0),
  normalized_name TEXT NOT NULL UNIQUE CHECK (length(trim(normalized_name)) > 0),
  entity_type TEXT NOT NULL DEFAULT 'other',
  aliases_json TEXT NOT NULL DEFAULT '[]',
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classification_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  rule_type TEXT NOT NULL
    CHECK (rule_type IN (
      'keyword', 'exact_alias', 'negative_keyword', 'file_path',
      'entity', 'source', 'legacy_tag', 'stopword', 'domain_hint'
    )),
  pattern TEXT NOT NULL CHECK (length(trim(pattern)) > 0),
  target_domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
  target_topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
  weight REAL NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classification_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  source_item_id INTEGER REFERENCES source_items(id) ON DELETE CASCADE,
  note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
  suggested_domain_id INTEGER REFERENCES domains(id) ON DELETE SET NULL,
  suggested_topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  score REAL NOT NULL CHECK (score BETWEEN 0 AND 100),
  decision TEXT NOT NULL
    CHECK (decision IN ('auto_eligible', 'confirm', 'candidates', 'manual')),
  reasons_json TEXT NOT NULL DEFAULT '[]',
  signal_scores_json TEXT NOT NULL DEFAULT '{}',
  classifier_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'modified', 'rejected', 'undone')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  CHECK (source_item_id IS NOT NULL OR note_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS propositions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  statement_markdown TEXT NOT NULL CHECK (length(trim(statement_markdown)) > 0),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'supported', 'rejected', 'superseded')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  decision_markdown TEXT NOT NULL CHECK (length(trim(decision_markdown)) > 0),
  decided_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'reversed', 'superseded')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topic_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  operation_type TEXT NOT NULL
    CHECK (operation_type IN ('merge', 'split_preview', 'move', 'rename', 'classification', 'relation')),
  status TEXT NOT NULL DEFAULT 'preview'
    CHECK (status IN ('preview', 'committed', 'undone', 'cancelled')),
  source_topic_ids_json TEXT NOT NULL DEFAULT '[]',
  target_topic_ids_json TEXT NOT NULL DEFAULT '[]',
  before_snapshot_json TEXT NOT NULL DEFAULT '{}',
  after_snapshot_json TEXT NOT NULL DEFAULT '{}',
  undo_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  committed_at TEXT,
  undone_at TEXT
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  operation_type TEXT NOT NULL CHECK (length(trim(operation_type)) > 0),
  entity_type TEXT NOT NULL CHECK (length(trim(entity_type)) > 0),
  entity_public_id TEXT NOT NULL CHECK (length(trim(entity_public_id)) > 0),
  before_json TEXT NOT NULL DEFAULT '{}',
  after_json TEXT NOT NULL DEFAULT '{}',
  inverse_json TEXT NOT NULL DEFAULT '{}',
  actor TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  undone_at TEXT
);

CREATE TABLE IF NOT EXISTS attachment_links (
  attachment_id INTEGER NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  source_item_id INTEGER REFERENCES source_items(id) ON DELETE CASCADE,
  note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  CHECK (source_item_id IS NOT NULL OR note_id IS NOT NULL),
  UNIQUE (attachment_id, source_item_id, note_id)
);

CREATE INDEX IF NOT EXISTS idx_topics_domain_parent
  ON topics(domain_id, parent_topic_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_topics_unique_path
  ON topics(domain_id, ifnull(parent_topic_id, 0), normalized_name);
CREATE INDEX IF NOT EXISTS idx_topic_aliases_normalized
  ON topic_aliases(normalized_alias);
CREATE INDEX IF NOT EXISTS idx_source_items_original_at
  ON source_items(original_at DESC);
CREATE INDEX IF NOT EXISTS idx_note_sources_source
  ON note_sources(source_item_id);
CREATE INDEX IF NOT EXISTS idx_note_topics_topic
  ON note_topics(topic_id, role);
CREATE INDEX IF NOT EXISTS idx_source_topics_topic
  ON source_topics(topic_id, role);
CREATE INDEX IF NOT EXISTS idx_judgments_topic_time
  ON judgment_snapshots(topic_id, effective_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_topic
  ON evidence(topic_id, validity_status, stance);
CREATE INDEX IF NOT EXISTS idx_open_questions_topic
  ON open_questions(topic_id, status, importance);
CREATE INDEX IF NOT EXISTS idx_classification_suggestions_status
  ON classification_suggestions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_operation_logs_entity
  ON operation_logs(entity_type, entity_public_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS topics_validate_insert BEFORE INSERT ON topics BEGIN
  SELECT CASE
    WHEN new.parent_topic_id IS NULL AND new.depth <> 1
    THEN RAISE(ABORT, 'root topic depth must be 1')
  END;
  SELECT CASE
    WHEN new.parent_topic_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM topics parent
      WHERE parent.id = new.parent_topic_id
        AND parent.domain_id = new.domain_id
        AND new.depth = parent.depth + 1
    )
    THEN RAISE(ABORT, 'topic parent must share domain and have previous depth')
  END;
END;

CREATE TRIGGER IF NOT EXISTS topics_validate_update BEFORE UPDATE ON topics BEGIN
  SELECT CASE
    WHEN new.parent_topic_id IS NULL AND new.depth <> 1
    THEN RAISE(ABORT, 'root topic depth must be 1')
  END;
  SELECT CASE
    WHEN new.parent_topic_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM topics parent
      WHERE parent.id = new.parent_topic_id
        AND parent.domain_id = new.domain_id
        AND new.depth = parent.depth + 1
    )
    THEN RAISE(ABORT, 'topic parent must share domain and have previous depth')
  END;
  SELECT CASE
    WHEN new.parent_topic_id IS NOT NULL AND EXISTS (
      WITH RECURSIVE descendants(id) AS (
        SELECT id FROM topics WHERE parent_topic_id = new.id
        UNION ALL
        SELECT child.id
        FROM topics child
        JOIN descendants parent_tree ON child.parent_topic_id = parent_tree.id
      )
      SELECT 1 FROM descendants WHERE id = new.parent_topic_id
    )
    THEN RAISE(ABORT, 'topic hierarchy cannot contain a cycle')
  END;
END;

CREATE VIRTUAL TABLE IF NOT EXISTS source_items_fts USING fts5(
  title,
  original_text,
  content='source_items',
  content_rowid='id',
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS source_items_fts_insert AFTER INSERT ON source_items BEGIN
  INSERT INTO source_items_fts(rowid, title, original_text)
  VALUES (new.id, new.title, new.original_text);
END;

CREATE TRIGGER IF NOT EXISTS source_items_fts_delete AFTER DELETE ON source_items BEGIN
  INSERT INTO source_items_fts(source_items_fts, rowid, title, original_text)
  VALUES ('delete', old.id, old.title, old.original_text);
END;

CREATE TRIGGER IF NOT EXISTS source_items_fts_update AFTER UPDATE ON source_items BEGIN
  INSERT INTO source_items_fts(source_items_fts, rowid, title, original_text)
  VALUES ('delete', old.id, old.title, old.original_text);
  INSERT INTO source_items_fts(rowid, title, original_text)
  VALUES (new.id, new.title, new.original_text);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title,
  body_markdown,
  content='notes',
  content_rowid='id',
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, body_markdown)
  VALUES (new.id, new.title, new.body_markdown);
END;

CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body_markdown)
  VALUES ('delete', old.id, old.title, old.body_markdown);
END;

CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body_markdown)
  VALUES ('delete', old.id, old.title, old.body_markdown);
  INSERT INTO notes_fts(rowid, title, body_markdown)
  VALUES (new.id, new.title, new.body_markdown);
END;

INSERT OR IGNORE INTO knowledge_schema_contract(singleton, version, created_at)
VALUES (1, 2, 'production-v2');
"#;

/// 建立知识对象的正式持久化合同；应用迁移与内存合同测试共用同一 SQL。
#[cfg(test)]
pub(crate) fn create_knowledge_schema(connection: &mut Connection) -> Result<()> {
    connection.execute_batch("PRAGMA foreign_keys = ON;")?;
    let transaction = connection.transaction()?;
    transaction.execute_batch(KNOWLEDGE_SCHEMA_SQL)?;
    let stored_version = transaction.query_row(
        "SELECT version FROM knowledge_schema_contract WHERE singleton = 1",
        [],
        |row| row.get::<_, i64>(0),
    )?;
    if stored_version != KNOWLEDGE_SCHEMA_VERSION {
        return Err(Error::InvalidQuery);
    }
    transaction.commit()
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    fn prepared_database() -> Connection {
        let mut connection = crate::database::open_memory_database().expect("旧结构内存库");
        create_knowledge_schema(&mut connection).expect("知识结构合同");
        connection
    }

    fn insert_domain_and_topic(connection: &Connection) -> (i64, i64) {
        connection
            .execute(
                "INSERT INTO domains(
                   public_id, name, normalized_name, created_at, updated_at
                 ) VALUES ('domain-tech', '科技', '科技', '2026-07-26', '2026-07-26')",
                [],
            )
            .expect("领域");
        let domain_id = connection.last_insert_rowid();
        connection
            .execute(
                "INSERT INTO topics(
                   public_id, domain_id, name, normalized_name, created_at, updated_at
                 ) VALUES ('topic-kb', ?1, '知识库', '知识库', '2026-07-26', '2026-07-26')",
                [domain_id],
            )
            .expect("主题");
        (domain_id, connection.last_insert_rowid())
    }

    #[test]
    fn schema_is_idempotent_and_contains_core_tables() {
        let mut connection = crate::database::open_memory_database().expect("旧结构内存库");
        create_knowledge_schema(&mut connection).expect("首次创建");
        create_knowledge_schema(&mut connection).expect("重复创建");

        let names = [
            "domains",
            "topics",
            "source_items",
            "notes",
            "judgment_snapshots",
            "evidence",
            "open_questions",
            "classification_suggestions",
            "topic_operations",
            "operation_logs",
        ];
        for name in names {
            let exists: i64 = connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master
                     WHERE type = 'table' AND name = ?1",
                    [name],
                    |row| row.get(0),
                )
                .expect("查询表");
            assert_eq!(exists, 1, "缺少表 {name}");
        }
    }

    #[test]
    fn schema_rejects_invalid_hierarchy_and_scores() {
        let connection = prepared_database();
        let (domain_id, topic_id) = insert_domain_and_topic(&connection);

        let self_parent = connection.execute(
            "UPDATE topics SET parent_topic_id = id WHERE id = ?1",
            [topic_id],
        );
        assert!(self_parent.is_err());

        let invalid_child_depth = connection.execute(
            "INSERT INTO topics(
               public_id, domain_id, parent_topic_id, name, normalized_name,
               depth, created_at, updated_at
             ) VALUES (
               'topic-invalid-depth', ?1, ?2, '错误层级', '错误层级',
               1, '2026-07-26', '2026-07-26'
             )",
            params![domain_id, topic_id],
        );
        assert!(invalid_child_depth.is_err());

        let duplicate_primary = (|| -> Result<()> {
            connection.execute(
                "INSERT INTO notes(
                   public_id, title, created_at, updated_at
                 ) VALUES ('note-1', '研究笔记', '2026-07-26', '2026-07-26')",
                [],
            )?;
            let note_id = connection.last_insert_rowid();
            connection.execute(
                "INSERT INTO topics(
                   public_id, domain_id, name, normalized_name, created_at, updated_at
                 ) VALUES ('topic-app', ?1, '应用', '应用', '2026-07-26', '2026-07-26')",
                [domain_id],
            )?;
            let second_topic_id = connection.last_insert_rowid();
            connection.execute(
                "INSERT INTO note_topics(note_id, topic_id, role, created_at)
                 VALUES (?1, ?2, 'primary', '2026-07-26')",
                params![note_id, topic_id],
            )?;
            connection.execute(
                "INSERT INTO note_topics(note_id, topic_id, role, created_at)
                 VALUES (?1, ?2, 'primary', '2026-07-26')",
                params![note_id, second_topic_id],
            )?;
            Ok(())
        })();
        assert!(duplicate_primary.is_err());

        connection
            .execute(
                "INSERT INTO source_items(
                   public_id, source_type, title, imported_at
                 ) VALUES ('source-1', 'markdown', '来源', '2026-07-26')",
                [],
            )
            .expect("来源");
        let source_id = connection.last_insert_rowid();
        let invalid_score = connection.execute(
            "INSERT INTO classification_suggestions(
               public_id, source_item_id, suggested_topic_id, score, decision,
               classifier_version, created_at
             ) VALUES ('suggestion-1', ?1, ?2, 101, 'confirm', 'v1', '2026-07-26')",
            params![source_id, topic_id],
        );
        assert!(invalid_score.is_err());

        let self_relation = connection.execute(
            "INSERT INTO topic_relations(
               from_topic_id, to_topic_id, relation_type, created_at
             ) VALUES (?1, ?1, 'related_to', '2026-07-26')",
            [topic_id],
        );
        assert!(self_relation.is_err());
    }

    #[test]
    fn source_and_note_full_text_indexes_follow_writes() {
        let connection = prepared_database();
        connection
            .execute(
                "INSERT INTO source_items(
                   public_id, source_type, title, original_text, imported_at
                 ) VALUES (
                   'source-search', 'markdown', '南枫知识库',
                   '这是可检索的知识演化来源', '2026-07-26'
                 )",
                [],
            )
            .expect("来源");
        connection
            .execute(
                "INSERT INTO notes(
                   public_id, title, body_markdown, created_at, updated_at
                 ) VALUES (
                   'note-search', '主题研究',
                   '知识库需要保留原始来源与判断演化。', '2026-07-26', '2026-07-26'
                 )",
                [],
            )
            .expect("笔记");

        let source_hits: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM source_items_fts
                 WHERE source_items_fts MATCH '知识库'",
                [],
                |row| row.get(0),
            )
            .expect("来源检索");
        let note_hits: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH '知识库'",
                [],
                |row| row.get(0),
            )
            .expect("笔记检索");
        assert_eq!(source_hits, 1);
        assert_eq!(note_hits, 1);
    }
}
