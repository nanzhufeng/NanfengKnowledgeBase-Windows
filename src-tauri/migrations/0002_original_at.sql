ALTER TABLE records ADD COLUMN original_at TEXT;

CREATE INDEX IF NOT EXISTS idx_records_original_at
  ON records (original_at DESC);
