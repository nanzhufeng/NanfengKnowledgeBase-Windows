use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::ai::credentials;
use crate::ai::models::{
    AiModelDescriptor, AiProviderChannel, AiProviderSettingsView, AiSettingsView, AiTaskUsage,
    AiTopicInsightPayload, AiTopicInsightView, AiUsageSummary, SaveAiSettingsInput,
};
use crate::error::{AppError, AppResult};

fn now() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub fn get_settings(connection: &Connection) -> AppResult<AiSettingsView> {
    let active_channel: String = connection.query_row(
        "SELECT active_channel FROM ai_settings WHERE singleton_id = 1",
        [],
        |row| row.get(0),
    )?;
    let mut providers = Vec::new();
    for channel in [
        AiProviderChannel::Openrouter,
        AiProviderChannel::DeepseekDirect,
    ] {
        let (selected_model_id, catalog_json, catalog_refreshed_at): (
            Option<String>,
            String,
            Option<String>,
        ) = connection.query_row(
            "SELECT selected_model_id, catalog_json, catalog_refreshed_at
             FROM ai_provider_settings WHERE channel = ?1",
            [channel.as_str()],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )?;
        let models = serde_json::from_str::<Vec<AiModelDescriptor>>(&catalog_json)
            .unwrap_or_else(|_| Vec::new());
        providers.push(AiProviderSettingsView {
            channel: channel.as_str().to_string(),
            configured: credentials::get_api_key(channel)?.is_some(),
            selected_model_id,
            models,
            catalog_refreshed_at,
        });
    }
    let usage = connection.query_row(
        "SELECT COUNT(*),
                COALESCE(SUM(prompt_tokens), 0),
                COALESCE(SUM(completion_tokens), 0),
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(CASE WHEN cost_usd IS NOT NULL THEN cost_usd ELSE 0 END), 0)
         FROM ai_task_runs WHERE status = 'succeeded'",
        [],
        |row| {
            Ok(AiUsageSummary {
                task_count: row.get(0)?,
                prompt_tokens: row.get(1)?,
                completion_tokens: row.get(2)?,
                total_tokens: row.get(3)?,
                known_cost_usd: row.get(4)?,
            })
        },
    )?;
    Ok(AiSettingsView {
        active_channel,
        providers,
        usage,
    })
}

pub fn save_settings(
    connection: &Connection,
    input: &SaveAiSettingsInput,
) -> AppResult<AiSettingsView> {
    if let Some(api_key) = input.api_key.as_deref() {
        if !api_key.trim().is_empty() {
            credentials::save_api_key(input.active_channel, api_key)?;
        }
    }
    let timestamp = now();
    connection.execute(
        "UPDATE ai_settings SET active_channel = ?1, updated_at = ?2 WHERE singleton_id = 1",
        params![input.active_channel.as_str(), timestamp],
    )?;
    if let Some(model_id) = input.selected_model_id.as_deref() {
        let model_id = model_id.trim();
        if !model_id.is_empty() {
            connection.execute(
                "UPDATE ai_provider_settings
                 SET selected_model_id = ?1, updated_at = ?2 WHERE channel = ?3",
                params![model_id, timestamp, input.active_channel.as_str()],
            )?;
        }
    }
    get_settings(connection)
}

pub fn save_model_catalog(
    connection: &Connection,
    channel: AiProviderChannel,
    models: &[AiModelDescriptor],
) -> AppResult<()> {
    let timestamp = now();
    let selected: Option<String> = connection.query_row(
        "SELECT selected_model_id FROM ai_provider_settings WHERE channel = ?1",
        [channel.as_str()],
        |row| row.get(0),
    )?;
    let selected_still_available = selected
        .as_ref()
        .is_some_and(|id| models.iter().any(|model| model.id == *id));
    let next_selected = if selected_still_available {
        selected
    } else {
        models.first().map(|model| model.id.clone())
    };
    connection.execute(
        "UPDATE ai_provider_settings
         SET selected_model_id = ?1, catalog_json = ?2,
             catalog_refreshed_at = ?3, updated_at = ?3
         WHERE channel = ?4",
        params![
            next_selected,
            serde_json::to_string(models)?,
            timestamp,
            channel.as_str()
        ],
    )?;
    Ok(())
}

pub fn active_selection(connection: &Connection) -> AppResult<(AiProviderChannel, String)> {
    let channel_value: String = connection.query_row(
        "SELECT active_channel FROM ai_settings WHERE singleton_id = 1",
        [],
        |row| row.get(0),
    )?;
    let channel = AiProviderChannel::parse(&channel_value)?;
    let model_id: Option<String> = connection.query_row(
        "SELECT selected_model_id FROM ai_provider_settings WHERE channel = ?1",
        [channel.as_str()],
        |row| row.get(0),
    )?;
    let model_id = model_id
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AppError::Validation("请先在设置中刷新并选择 AI 模型".to_string()))?;
    Ok((channel, model_id))
}

pub fn model_descriptor(
    connection: &Connection,
    channel: AiProviderChannel,
    model_id: &str,
) -> AppResult<Option<AiModelDescriptor>> {
    let catalog_json: String = connection.query_row(
        "SELECT catalog_json FROM ai_provider_settings WHERE channel = ?1",
        [channel.as_str()],
        |row| row.get(0),
    )?;
    Ok(
        serde_json::from_str::<Vec<AiModelDescriptor>>(&catalog_json)
            .unwrap_or_default()
            .into_iter()
            .find(|model| model.id == model_id),
    )
}

pub fn begin_topic_insight_task(
    connection: &Connection,
    topic_id: i64,
    channel: AiProviderChannel,
    model_id: &str,
) -> AppResult<String> {
    let public_id = format!("ai-task-{}", Uuid::new_v4());
    connection.execute(
        "INSERT INTO ai_task_runs(
           public_id, task_kind, topic_id, provider_channel, model_id, status, started_at
         ) VALUES (?1, 'topic_insight', ?2, ?3, ?4, 'running', ?5)",
        params![public_id, topic_id, channel.as_str(), model_id, now()],
    )?;
    Ok(public_id)
}

pub fn fail_task(connection: &Connection, public_id: &str, message: &str) -> AppResult<()> {
    connection.execute(
        "UPDATE ai_task_runs
         SET status = 'failed', error_message = ?1, completed_at = ?2
         WHERE public_id = ?3",
        params![message, now(), public_id],
    )?;
    Ok(())
}

pub fn complete_topic_insight_task(
    connection: &Connection,
    public_id: &str,
    topic_id: i64,
    channel: AiProviderChannel,
    model_id: &str,
    insight: &AiTopicInsightPayload,
    usage: &AiTaskUsage,
) -> AppResult<AiTopicInsightView> {
    let generated_at = now();
    let transaction = connection.unchecked_transaction()?;
    transaction.execute(
        "UPDATE ai_task_runs SET
           status = 'succeeded', prompt_tokens = ?1, completion_tokens = ?2,
           reasoning_tokens = ?3, cached_tokens = ?4, total_tokens = ?5,
           cost_usd = ?6, cost_kind = ?7, pricing_snapshot_json = ?8,
           completed_at = ?9
         WHERE public_id = ?10",
        params![
            usage.prompt_tokens,
            usage.completion_tokens,
            usage.reasoning_tokens,
            usage.cached_tokens,
            usage.total_tokens,
            usage.cost_usd,
            usage.cost_kind,
            usage.pricing_snapshot_json,
            generated_at,
            public_id
        ],
    )?;
    transaction.execute(
        "INSERT INTO ai_topic_insights(
           topic_id, task_public_id, provider_channel, model_id, summary_markdown,
           key_insights_json, evidence_json, open_questions_json,
           topic_management_suggestions_json, generated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(topic_id) DO UPDATE SET
           task_public_id = excluded.task_public_id,
           provider_channel = excluded.provider_channel,
           model_id = excluded.model_id,
           summary_markdown = excluded.summary_markdown,
           key_insights_json = excluded.key_insights_json,
           evidence_json = excluded.evidence_json,
           open_questions_json = excluded.open_questions_json,
           topic_management_suggestions_json = excluded.topic_management_suggestions_json,
           generated_at = excluded.generated_at",
        params![
            topic_id,
            public_id,
            channel.as_str(),
            model_id,
            insight.summary_markdown,
            serde_json::to_string(&insight.key_insights)?,
            serde_json::to_string(&insight.evidence)?,
            serde_json::to_string(&insight.open_questions)?,
            serde_json::to_string(&insight.topic_management_suggestions)?,
            generated_at
        ],
    )?;
    transaction.commit()?;
    get_topic_insight(connection, topic_id)?
        .ok_or_else(|| AppError::NotFound("AI 洞察写入后无法读取".to_string()))
}

pub fn get_topic_insight(
    connection: &Connection,
    topic_id: i64,
) -> AppResult<Option<AiTopicInsightView>> {
    let row = connection
        .query_row(
            "SELECT task_public_id, provider_channel, model_id, summary_markdown,
                    key_insights_json, evidence_json, open_questions_json,
                    topic_management_suggestions_json, generated_at
             FROM ai_topic_insights WHERE topic_id = ?1",
            [topic_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, String>(8)?,
                ))
            },
        )
        .optional()?;
    let Some((
        task_public_id,
        provider_channel,
        model_id,
        summary_markdown,
        key_insights_json,
        evidence_json,
        open_questions_json,
        topic_management_suggestions_json,
        generated_at,
    )) = row
    else {
        return Ok(None);
    };
    Ok(Some(AiTopicInsightView {
        topic_id,
        task_public_id,
        provider_channel,
        model_id,
        payload: AiTopicInsightPayload {
            summary_markdown,
            key_insights: serde_json::from_str(&key_insights_json)?,
            evidence: serde_json::from_str(&evidence_json)?,
            open_questions: serde_json::from_str(&open_questions_json)?,
            topic_management_suggestions: serde_json::from_str(&topic_management_suggestions_json)?,
        },
        generated_at,
    }))
}

#[cfg(test)]
mod tests {
    use crate::ai::models::{AiProviderChannel, AiTaskUsage, AiTopicInsightPayload};
    use crate::database::open_memory_database;

    #[test]
    fn ai_migration_creates_required_tables() {
        let connection = open_memory_database().expect("memory database");
        for table in [
            "ai_settings",
            "ai_provider_settings",
            "ai_task_runs",
            "ai_topic_insights",
        ] {
            let exists: i64 = connection
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1)",
                    [table],
                    |row| row.get(0),
                )
                .expect("table query");
            assert_eq!(exists, 1, "missing table {table}");
        }
    }

    #[test]
    fn topic_insight_and_usage_are_saved_without_changing_topic_objects() {
        let connection = open_memory_database().expect("memory database");
        connection
            .execute(
                "INSERT INTO domains(public_id, name, normalized_name, created_at, updated_at)
             VALUES ('domain-test', '测试领域', '测试领域', '2026-08-10', '2026-08-10')",
                [],
            )
            .expect("domain");
        connection.execute(
            "INSERT INTO topics(public_id, domain_id, name, normalized_name, created_at, updated_at)
             VALUES ('topic-test', 1, '原主题名', '原主题名', '2026-08-10', '2026-08-10')",
            [],
        ).expect("topic");
        let task_id = super::begin_topic_insight_task(
            &connection,
            1,
            AiProviderChannel::Openrouter,
            "openai/test",
        )
        .expect("begin task");
        let insight = AiTopicInsightPayload {
            summary_markdown: "派生总结".to_string(),
            key_insights: Vec::new(),
            evidence: Vec::new(),
            open_questions: vec!["还需验证什么？".to_string()],
            topic_management_suggestions: Vec::new(),
        };
        let usage = AiTaskUsage {
            prompt_tokens: 120,
            completion_tokens: 30,
            total_tokens: 150,
            cost_usd: Some(0.0012),
            cost_kind: "actual".to_string(),
            pricing_snapshot_json: "{}".to_string(),
            ..AiTaskUsage::default()
        };
        let saved = super::complete_topic_insight_task(
            &connection,
            &task_id,
            1,
            AiProviderChannel::Openrouter,
            "openai/test",
            &insight,
            &usage,
        )
        .expect("complete task");
        assert_eq!(saved.payload.summary_markdown, "派生总结");
        let (status, total_tokens, cost): (String, i64, f64) = connection
            .query_row(
                "SELECT status, total_tokens, cost_usd FROM ai_task_runs WHERE public_id = ?1",
                [&task_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("usage row");
        assert_eq!(
            (status.as_str(), total_tokens, cost),
            ("succeeded", 150, 0.0012)
        );
        let topic_name: String = connection
            .query_row("SELECT name FROM topics WHERE id = 1", [], |row| row.get(0))
            .expect("topic name");
        assert_eq!(topic_name, "原主题名");
    }
}
