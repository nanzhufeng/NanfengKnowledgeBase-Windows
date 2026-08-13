CREATE TABLE IF NOT EXISTS ai_taxonomy_run_checkpoints (
  task_public_id TEXT PRIMARY KEY,
  provider_channel TEXT NOT NULL,
  model_id TEXT NOT NULL,
  source_snapshot_json TEXT NOT NULL,
  profiles_json TEXT NOT NULL DEFAULT '[]',
  taxonomy_json TEXT,
  assignments_json TEXT NOT NULL DEFAULT '[]',
  profile_offset INTEGER NOT NULL DEFAULT 0,
  assignment_offset INTEGER NOT NULL DEFAULT 0,
  integration_offset INTEGER NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'profiles',
  updated_at TEXT NOT NULL,
  FOREIGN KEY(task_public_id) REFERENCES ai_task_runs(public_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_taxonomy_checkpoints_updated
  ON ai_taxonomy_run_checkpoints(updated_at DESC);
