-- 任务创建时冻结逐篇档案模型，避免模型目录或设置变化后，断点续跑改用另一档位。
ALTER TABLE ai_taxonomy_run_checkpoints
  ADD COLUMN profile_model_id TEXT NOT NULL DEFAULT '';

-- 旧断点没有逐篇模型快照。保守沿用其原分类模型，不把历史任务静默切换到新路由。
UPDATE ai_taxonomy_run_checkpoints
SET profile_model_id = model_id
WHERE profile_model_id = '';
