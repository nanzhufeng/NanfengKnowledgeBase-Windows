CREATE TABLE source_collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_key TEXT NOT NULL UNIQUE CHECK (length(trim(canonical_key)) > 0),
  display_name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(display_name)) > 0),
  collection_kind TEXT NOT NULL CHECK (collection_kind IN (
    'ai_provider', 'loose_files', 'structured_import', 'manual', 'web', 'other'
  )),
  user_renamed INTEGER NOT NULL DEFAULT 0 CHECK (user_renamed IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE source_items
  ADD COLUMN source_collection_id INTEGER REFERENCES source_collections(id) ON DELETE RESTRICT;

ALTER TABLE source_items
  ADD COLUMN identity_sha256 TEXT;

CREATE TABLE source_import_origins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_item_id INTEGER NOT NULL REFERENCES source_items(id) ON DELETE CASCADE,
  import_job_id TEXT REFERENCES import_jobs(id) ON DELETE SET NULL,
  source_file_name TEXT NOT NULL,
  stored_file_path TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  item_external_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (source_item_id, import_job_id)
);

CREATE INDEX idx_source_items_collection
  ON source_items(source_collection_id, status);

CREATE INDEX idx_source_items_identity
  ON source_items(identity_sha256, status);

CREATE INDEX idx_source_import_origins_external
  ON source_import_origins(item_external_id);
