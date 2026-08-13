pub mod client;
pub mod credentials;
pub mod models;
pub mod prompt_cache;
pub mod repository;

pub const AI_AUTOMATION_SCHEMA_SQL: &str = include_str!("../../migrations/0006_ai_automation.sql");
pub const AI_SEMANTIC_PIPELINE_SCHEMA_SQL: &str =
    include_str!("../../migrations/0007_ai_semantic_pipeline.sql");
pub const AI_TAXONOMY_RESUME_SCHEMA_SQL: &str =
    include_str!("../../migrations/0008_ai_taxonomy_resume.sql");
pub const AI_MODEL_TRACKS_SCHEMA_SQL: &str =
    include_str!("../../migrations/0009_ai_model_tracks.sql");
pub const AI_INCREMENTAL_TAXONOMY_SCHEMA_SQL: &str =
    include_str!("../../migrations/0010_ai_incremental_taxonomy.sql");
pub const AI_QWEN_DIRECT_SCHEMA_SQL: &str = include_str!("../../migrations/0012_qwen_direct.sql");
pub const AI_TASK_MODEL_ROUTE_SCHEMA_SQL: &str =
    include_str!("../../migrations/0013_ai_task_model_route.sql");
pub const AI_PROMPT_CACHE_SCHEMA_SQL: &str =
    include_str!("../../migrations/0014_ai_prompt_cache.sql");
pub const AI_EXECUTION_CONTRACT_SCHEMA_SQL: &str =
    include_str!("../../migrations/0015_ai_execution_contract.sql");
