-- 每个模型分别保存来源档案，增量分类可复用未变化笔记的已有 AI 结果。
CREATE TABLE IF NOT EXISTS ai_source_profile_versions (
  source_item_id INTEGER NOT NULL REFERENCES source_items(id) ON DELETE CASCADE,
  provider_channel TEXT NOT NULL,
  model_id TEXT NOT NULL,
  content_sha256 TEXT NOT NULL DEFAULT '',
  task_public_id TEXT NOT NULL,
  profile_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  PRIMARY KEY(source_item_id, provider_channel, model_id, content_sha256)
);

CREATE INDEX IF NOT EXISTS idx_ai_source_profile_versions_model_source
  ON ai_source_profile_versions(provider_channel, model_id, source_item_id, generated_at DESC);

-- 将能够识别出处的旧档案迁入对应模型版本；无法判断模型的旧档案保持只读历史。
INSERT OR IGNORE INTO ai_source_profile_versions(
  source_item_id, provider_channel, model_id, content_sha256,
  task_public_id, profile_json, generated_at
)
SELECT profile.source_item_id, revision.provider_channel, revision.model_id,
  COALESCE(profile.content_sha256, ''), profile.task_public_id,
  profile.profile_json, profile.generated_at
FROM ai_source_profiles profile
JOIN ai_taxonomy_revisions revision
  ON revision.task_public_id = profile.task_public_id;

ALTER TABLE ai_taxonomy_run_checkpoints
  ADD COLUMN run_mode TEXT NOT NULL DEFAULT 'full';

ALTER TABLE ai_taxonomy_run_checkpoints
  ADD COLUMN baseline_revision_public_id TEXT;

ALTER TABLE ai_taxonomy_run_checkpoints
  ADD COLUMN base_assignment_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE ai_taxonomy_run_checkpoints
  ADD COLUMN integration_topic_keys_json TEXT NOT NULL DEFAULT '[]';
