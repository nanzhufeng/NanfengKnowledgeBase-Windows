CREATE TABLE IF NOT EXISTS ai_settings (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  active_channel TEXT NOT NULL DEFAULT 'openrouter',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_provider_settings (
  channel TEXT PRIMARY KEY,
  selected_model_id TEXT,
  catalog_json TEXT NOT NULL DEFAULT '[]',
  catalog_refreshed_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_task_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  task_kind TEXT NOT NULL,
  topic_id INTEGER,
  provider_channel TEXT NOT NULL,
  model_id TEXT NOT NULL,
  status TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL,
  cost_kind TEXT NOT NULL DEFAULT 'unavailable',
  pricing_snapshot_json TEXT NOT NULL DEFAULT '{}',
  error_message TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_task_runs_topic_started
  ON ai_task_runs(topic_id, started_at DESC);

CREATE TABLE IF NOT EXISTS ai_topic_insights (
  topic_id INTEGER PRIMARY KEY,
  task_public_id TEXT NOT NULL,
  provider_channel TEXT NOT NULL,
  model_id TEXT NOT NULL,
  summary_markdown TEXT NOT NULL,
  key_insights_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  open_questions_json TEXT NOT NULL DEFAULT '[]',
  topic_management_suggestions_json TEXT NOT NULL DEFAULT '[]',
  generated_at TEXT NOT NULL,
  FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO ai_settings(singleton_id, active_channel, updated_at)
VALUES (1, 'openrouter', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT OR IGNORE INTO ai_provider_settings(channel, updated_at)
VALUES ('openrouter', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT OR IGNORE INTO ai_provider_settings(channel, updated_at)
VALUES ('deepseek_direct', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
