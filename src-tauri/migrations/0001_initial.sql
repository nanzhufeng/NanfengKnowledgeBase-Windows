CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'normal'
    CHECK (status IN ('normal', 'tracking', 'verification', 'updated')),
  current_judgment TEXT NOT NULL DEFAULT '',
  confirmed_facts_json TEXT NOT NULL DEFAULT '[]',
  key_evidence_json TEXT NOT NULL DEFAULT '[]',
  open_questions_json TEXT NOT NULL DEFAULT '[]',
  next_actions_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  source_text TEXT NOT NULL DEFAULT '',
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
  is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS record_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  version_title TEXT NOT NULL DEFAULT '',
  change_note TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (record_id, version_number)
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  color_key TEXT NOT NULL DEFAULT 'blue',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS record_tags (
  record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (record_id, tag_id)
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'manual',
  title TEXT NOT NULL DEFAULT '',
  url TEXT,
  local_path TEXT,
  external_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER REFERENCES records(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  original_path TEXT,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  source_file_name TEXT NOT NULL,
  stored_file_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  mapping_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL
    CHECK (status IN ('preview', 'completed', 'partial', 'failed', 'cancelled')),
  success_count INTEGER NOT NULL DEFAULT 0,
  skip_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  error_log_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS import_job_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_job_id TEXT NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'skipped', 'failed')),
  record_id INTEGER REFERENCES records(id) ON DELETE SET NULL,
  reason_code TEXT,
  message TEXT NOT NULL DEFAULT '',
  raw_json TEXT,
  UNIQUE (import_job_id, item_index)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_records_deleted_updated
  ON records (is_deleted, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_records_status
  ON records (status, is_deleted, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_record_versions_record
  ON record_versions (record_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_sources_record
  ON sources (record_id);
CREATE INDEX IF NOT EXISTS idx_sources_title
  ON sources (title);
CREATE INDEX IF NOT EXISTS idx_attachments_sha256
  ON attachments (sha256);
CREATE INDEX IF NOT EXISTS idx_import_jobs_sha256
  ON import_jobs (sha256);

CREATE VIRTUAL TABLE IF NOT EXISTS records_fts USING fts5(
  title,
  summary,
  current_judgment,
  confirmed_facts_json,
  key_evidence_json,
  open_questions_json,
  notes,
  source_text,
  content='records',
  content_rowid='id',
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS records_fts_insert AFTER INSERT ON records BEGIN
  INSERT INTO records_fts(
    rowid,
    title,
    summary,
    current_judgment,
    confirmed_facts_json,
    key_evidence_json,
    open_questions_json,
    notes,
    source_text
  ) VALUES (
    new.id,
    new.title,
    new.summary,
    new.current_judgment,
    new.confirmed_facts_json,
    new.key_evidence_json,
    new.open_questions_json,
    new.notes,
    new.source_text
  );
END;

CREATE TRIGGER IF NOT EXISTS records_fts_delete AFTER DELETE ON records BEGIN
  INSERT INTO records_fts(
    records_fts,
    rowid,
    title,
    summary,
    current_judgment,
    confirmed_facts_json,
    key_evidence_json,
    open_questions_json,
    notes,
    source_text
  ) VALUES (
    'delete',
    old.id,
    old.title,
    old.summary,
    old.current_judgment,
    old.confirmed_facts_json,
    old.key_evidence_json,
    old.open_questions_json,
    old.notes,
    old.source_text
  );
END;

CREATE TRIGGER IF NOT EXISTS records_fts_update AFTER UPDATE ON records BEGIN
  INSERT INTO records_fts(
    records_fts,
    rowid,
    title,
    summary,
    current_judgment,
    confirmed_facts_json,
    key_evidence_json,
    open_questions_json,
    notes,
    source_text
  ) VALUES (
    'delete',
    old.id,
    old.title,
    old.summary,
    old.current_judgment,
    old.confirmed_facts_json,
    old.key_evidence_json,
    old.open_questions_json,
    old.notes,
    old.source_text
  );
  INSERT INTO records_fts(
    rowid,
    title,
    summary,
    current_judgment,
    confirmed_facts_json,
    key_evidence_json,
    open_questions_json,
    notes,
    source_text
  ) VALUES (
    new.id,
    new.title,
    new.summary,
    new.current_judgment,
    new.confirmed_facts_json,
    new.key_evidence_json,
    new.open_questions_json,
    new.notes,
    new.source_text
  );
END;
