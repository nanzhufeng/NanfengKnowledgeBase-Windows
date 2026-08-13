-- 千问直连使用与其他通道隔离的 Windows 凭据项；模型目录由程序内置的
-- 已核对型号提供，避免把不受支持的 GET /models 当作连接校验。
INSERT OR IGNORE INTO ai_provider_settings(channel, updated_at)
VALUES ('qwen_direct', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- 一个全库 AI 任务可能由不同模型完成不同阶段。保留逐阶段审计，避免只把
-- "Flash → Plus" 写成一个不精确的模型名，也便于核对用量归属。
CREATE TABLE IF NOT EXISTS ai_task_model_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_public_id TEXT NOT NULL REFERENCES ai_task_runs(public_id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  provider_channel TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_task_model_steps_task
  ON ai_task_model_steps(task_public_id, id);
