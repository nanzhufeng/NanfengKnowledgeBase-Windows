ALTER TABLE ai_topic_insights
  ADD COLUMN hypotheses_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE ai_topic_insights
  ADD COLUMN judgment_evolution_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE ai_topic_insights
  ADD COLUMN decisions_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS ai_source_profiles (
  source_item_id INTEGER PRIMARY KEY,
  task_public_id TEXT NOT NULL,
  content_sha256 TEXT,
  profile_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  FOREIGN KEY(source_item_id) REFERENCES source_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_taxonomy_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  task_public_id TEXT NOT NULL UNIQUE,
  provider_channel TEXT NOT NULL,
  model_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft', 'applied', 'superseded', 'undone')),
  domains_json TEXT NOT NULL,
  topics_json TEXT NOT NULL,
  source_count INTEGER NOT NULL,
  assigned_source_count INTEGER NOT NULL,
  uncertain_source_count INTEGER NOT NULL DEFAULT 0,
  before_snapshot_json TEXT NOT NULL DEFAULT '{}',
  apply_snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  applied_at TEXT,
  undone_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_taxonomy_revisions_status_created
  ON ai_taxonomy_revisions(status, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_taxonomy_revision_assignments (
  revision_id INTEGER NOT NULL REFERENCES ai_taxonomy_revisions(id) ON DELETE CASCADE,
  source_item_id INTEGER NOT NULL REFERENCES source_items(id) ON DELETE CASCADE,
  topic_key TEXT NOT NULL,
  confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 100),
  reason TEXT NOT NULL,
  uncertain INTEGER NOT NULL DEFAULT 0 CHECK(uncertain IN (0, 1)),
  PRIMARY KEY(revision_id, source_item_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_taxonomy_assignments_topic
  ON ai_taxonomy_revision_assignments(revision_id, topic_key, uncertain);
