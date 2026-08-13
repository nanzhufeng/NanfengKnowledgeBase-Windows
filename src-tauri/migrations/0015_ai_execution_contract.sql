-- AI 执行契约用于隔离不同提示词、结构化输出和推理策略产生的结果。
-- 历史记录保留为只读证据，但不会被当前任务静默复用。
ALTER TABLE ai_task_runs
  ADD COLUMN execution_contract_version TEXT NOT NULL DEFAULT 'legacy';

ALTER TABLE ai_taxonomy_run_checkpoints
  ADD COLUMN execution_contract_version TEXT NOT NULL DEFAULT 'legacy';

ALTER TABLE ai_topic_insight_versions
  ADD COLUMN execution_contract_version TEXT NOT NULL DEFAULT 'legacy';

ALTER TABLE ai_taxonomy_revisions
  ADD COLUMN execution_contract_version TEXT NOT NULL DEFAULT 'legacy';

-- 原主键没有执行契约，无法同时保存同一正文在不同契约下的版本，因此重建表。
CREATE TABLE ai_source_profile_versions_v15 (
  source_item_id INTEGER NOT NULL REFERENCES source_items(id) ON DELETE CASCADE,
  provider_channel TEXT NOT NULL,
  model_id TEXT NOT NULL,
  content_sha256 TEXT NOT NULL DEFAULT '',
  execution_contract_version TEXT NOT NULL DEFAULT 'legacy',
  task_public_id TEXT NOT NULL,
  profile_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  PRIMARY KEY(
    source_item_id,
    provider_channel,
    model_id,
    content_sha256,
    execution_contract_version
  )
);

INSERT INTO ai_source_profile_versions_v15(
  source_item_id, provider_channel, model_id, content_sha256,
  execution_contract_version, task_public_id, profile_json, generated_at
)
SELECT source_item_id, provider_channel, model_id, content_sha256,
  'legacy', task_public_id, profile_json, generated_at
FROM ai_source_profile_versions;

DROP TABLE ai_source_profile_versions;
ALTER TABLE ai_source_profile_versions_v15 RENAME TO ai_source_profile_versions;

CREATE INDEX idx_ai_source_profile_versions_model_source
  ON ai_source_profile_versions(
    provider_channel,
    model_id,
    execution_contract_version,
    source_item_id,
    generated_at DESC
  );

CREATE INDEX idx_ai_topic_insight_versions_contract_lookup
  ON ai_topic_insight_versions(
    topic_id,
    provider_channel,
    model_id,
    execution_contract_version,
    input_fingerprint,
    generated_at DESC
  );

CREATE INDEX idx_ai_taxonomy_revisions_contract_created
  ON ai_taxonomy_revisions(
    provider_channel,
    model_id,
    execution_contract_version,
    id DESC
  );
