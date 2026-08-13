-- AI 结果按供应商/模型与输入快照保存；旧单主题结果保留为首条历史版本。
CREATE TABLE IF NOT EXISTS ai_topic_insight_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  task_public_id TEXT NOT NULL UNIQUE,
  provider_channel TEXT NOT NULL,
  model_id TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  summary_markdown TEXT NOT NULL,
  key_insights_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  open_questions_json TEXT NOT NULL DEFAULT '[]',
  topic_management_suggestions_json TEXT NOT NULL DEFAULT '[]',
  hypotheses_json TEXT NOT NULL DEFAULT '[]',
  judgment_evolution_json TEXT NOT NULL DEFAULT '[]',
  decisions_json TEXT NOT NULL DEFAULT '[]',
  generated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_topic_insight_versions_lookup
  ON ai_topic_insight_versions(topic_id, provider_channel, model_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_topic_insight_versions_dedup
  ON ai_topic_insight_versions(topic_id, provider_channel, model_id, input_fingerprint);

INSERT OR IGNORE INTO ai_topic_insight_versions(
  topic_id, task_public_id, provider_channel, model_id, input_fingerprint,
  summary_markdown, key_insights_json, evidence_json, open_questions_json,
  topic_management_suggestions_json, hypotheses_json, judgment_evolution_json,
  decisions_json, generated_at
)
SELECT topic_id, task_public_id, provider_channel, model_id, 'legacy:' || task_public_id,
  summary_markdown, key_insights_json, evidence_json, open_questions_json,
  topic_management_suggestions_json, hypotheses_json, judgment_evolution_json,
  decisions_json, generated_at
FROM ai_topic_insights;

ALTER TABLE ai_taxonomy_revisions
  ADD COLUMN source_snapshot_json TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_ai_taxonomy_revisions_model_created
  ON ai_taxonomy_revisions(provider_channel, model_id, created_at DESC);
