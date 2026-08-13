-- Prompt Cache 只记录用量、价格和不可逆哈希，不保存原始提示词或知识正文。
ALTER TABLE ai_task_model_steps ADD COLUMN reasoning_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_task_model_steps ADD COLUMN cached_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_task_model_steps ADD COLUMN cache_miss_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_task_model_steps ADD COLUMN cache_write_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_task_model_steps ADD COLUMN cache_mode TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE ai_task_model_steps ADD COLUMN stable_prefix_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_task_model_steps ADD COLUMN cache_key_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_task_model_steps ADD COLUMN prompt_contract_version TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_task_model_steps ADD COLUMN duration_ms INTEGER;
ALTER TABLE ai_task_model_steps ADD COLUMN cache_discount_usd REAL;
ALTER TABLE ai_task_model_steps ADD COLUMN cache_savings_usd REAL;
ALTER TABLE ai_task_model_steps ADD COLUMN cost_kind TEXT NOT NULL DEFAULT 'unavailable';
ALTER TABLE ai_task_model_steps ADD COLUMN pricing_snapshot_json TEXT NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_ai_task_model_steps_cache_key
  ON ai_task_model_steps(cache_key_hash, created_at);
