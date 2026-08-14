use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::ai::credentials;
use crate::ai::models::{
    is_nanfeng_knowledge_base_model, task_model_route, AiCallHistoryEntry, AiModelDescriptor,
    AiModelSelectionInput, AiModelSelectionView, AiProviderChannel, AiProviderSettingsView,
    AiSettingsView, AiSourceMaterial, AiSourceProfile, AiTaskModelRoute, AiTaskRoutePreview,
    AiTaskUsage, AiTaxonomyApplyResult, AiTaxonomyAssignmentProposal, AiTaxonomyDomainProposal,
    AiTaxonomyResumeView, AiTaxonomyRevisionView, AiTaxonomyRunCheckpoint, AiTaxonomyStructure,
    AiTaxonomyTopicProposal, AiTopicInsightPayload, AiTopicInsightView, AiUsageSummary,
    SaveAiSettingsInput,
};
use crate::ai::prompt_cache::AI_EXECUTION_CONTRACT_VERSION;
use crate::error::{AppError, AppResult};

fn now() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub fn get_settings(connection: &Connection) -> AppResult<AiSettingsView> {
    let routing_storage: String = connection.query_row(
        "SELECT active_channel FROM ai_settings WHERE singleton_id = 1",
        [],
        |row| row.get(0),
    )?;
    let mut providers = Vec::new();
    for channel in [
        AiProviderChannel::Openrouter,
        AiProviderChannel::DeepseekDirect,
        AiProviderChannel::QwenDirect,
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
        let mut models = if channel == AiProviderChannel::QwenDirect && catalog_json == "[]" {
            crate::ai::models::qwen_model_catalog()
        } else {
            serde_json::from_str::<Vec<AiModelDescriptor>>(&catalog_json)
                .unwrap_or_else(|_| Vec::new())
        };
        models.retain(|model| is_nanfeng_knowledge_base_model(channel, model));
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
                COALESCE(SUM(cached_tokens), 0),
                COALESCE((
                  SELECT SUM(step.cache_write_tokens)
                  FROM ai_task_model_steps step
                  JOIN ai_task_runs run ON run.public_id = step.task_public_id
                  WHERE run.status IN ('succeeded', 'interrupted', 'failed')
                    AND run.total_tokens > 0
                ), 0),
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(CASE WHEN cost_usd IS NOT NULL THEN cost_usd ELSE 0 END), 0),
                COALESCE((
                  SELECT SUM(step.cache_savings_usd)
                  FROM ai_task_model_steps step
                  JOIN ai_task_runs run ON run.public_id = step.task_public_id
                  WHERE run.status IN ('succeeded', 'interrupted', 'failed')
                    AND run.total_tokens > 0
                ), 0),
                COALESCE(SUM(CASE WHEN cost_usd IS NOT NULL THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN cost_usd IS NULL THEN 1 ELSE 0 END), 0),
                COALESCE((
                  SELECT COUNT(*) FROM ai_task_model_steps step
                  JOIN ai_task_runs run ON run.public_id = step.task_public_id
                  WHERE run.status IN ('succeeded', 'interrupted', 'failed')
                    AND run.total_tokens > 0 AND step.cache_savings_usd IS NOT NULL
                ), 0),
                COALESCE((
                  SELECT COUNT(*) FROM ai_task_model_steps step
                  JOIN ai_task_runs run ON run.public_id = step.task_public_id
                  WHERE run.status IN ('succeeded', 'interrupted', 'failed')
                    AND run.total_tokens > 0 AND step.cached_tokens > 0
                    AND step.cache_savings_usd IS NULL
                ), 0) + COALESCE((
                  SELECT COUNT(*) FROM ai_task_runs run
                  WHERE run.status IN ('succeeded', 'interrupted', 'failed')
                    AND run.total_tokens > 0 AND run.cached_tokens > 0
                    AND NOT EXISTS(
                      SELECT 1 FROM ai_task_model_steps step
                      WHERE step.task_public_id = run.public_id
                    )
                ), 0)
         FROM ai_task_runs
         WHERE status IN ('succeeded', 'interrupted', 'failed') AND total_tokens > 0",
        [],
        |row| {
            Ok(AiUsageSummary {
                task_count: row.get(0)?,
                prompt_tokens: row.get(1)?,
                completion_tokens: row.get(2)?,
                cached_tokens: row.get(3)?,
                cache_write_tokens: row.get(4)?,
                total_tokens: row.get(5)?,
                known_cost_usd: row.get(6)?,
                known_cache_savings_usd: row.get(7)?,
                known_cost_task_count: row.get(8)?,
                unknown_cost_task_count: row.get(9)?,
                known_cache_savings_record_count: row.get(10)?,
                unknown_cache_savings_record_count: row.get(11)?,
            })
        },
    )?;
    let manual_channel = routing_storage
        .strip_prefix("manual:")
        .map(AiProviderChannel::parse)
        .transpose()?;
    let manual_selection = manual_channel.and_then(|channel| {
        providers
            .iter()
            .find(|provider| provider.channel == channel.as_str())
            .and_then(|provider| {
                provider.selected_model_id.as_ref().filter(|model_id| {
                    provider
                        .models
                        .iter()
                        .any(|model| model.id == model_id.as_str())
                })
            })
            .map(|model_id| AiModelSelectionView {
                channel: channel.as_str().to_string(),
                model_id: model_id.clone(),
            })
    });
    let route_preview = resolve_task_model_route(connection, None)
        .ok()
        .map(|(channel, route)| AiTaskRoutePreview {
            provider_channel: channel.as_str().to_string(),
            profile_model_id: route.profile_model_id,
            synthesis_model_id: route.synthesis_model_id,
            topic_insight_model_id: route.topic_insight_model_id,
        });
    Ok(AiSettingsView {
        active_channel: manual_channel.map(|channel| channel.as_str().to_string()),
        routing_mode: if manual_selection.is_some() {
            "manual"
        } else {
            "auto"
        }
        .to_string(),
        manual_selection,
        route_preview,
        providers,
        usage,
    })
}

/// 统一读取逐阶段调用和旧版任务汇总。历史任务没有阶段审计时只回退一行，
/// 避免为了展示记录另建日志或误把同一任务重复列出。
pub fn list_call_history(
    connection: &Connection,
    limit: u32,
) -> AppResult<Vec<AiCallHistoryEntry>> {
    let safe_limit = i64::from(limit.clamp(1, 100));
    let mut statement = connection.prepare(
        "SELECT task_public_id, task_kind, stage, provider_channel, model_id, status,
                prompt_tokens, completion_tokens, reasoning_tokens, cached_tokens,
                total_tokens, occurred_at, error_message
           FROM (
             SELECT step.task_public_id,
                    run.task_kind,
                    step.stage,
                    step.provider_channel,
                    step.model_id,
                    'succeeded' AS status,
                    step.prompt_tokens,
                    step.completion_tokens,
                    step.reasoning_tokens,
                    step.cached_tokens,
                    step.total_tokens,
                    step.created_at AS occurred_at,
                    NULL AS error_message
               FROM ai_task_model_steps step
               JOIN ai_task_runs run ON run.public_id = step.task_public_id
             UNION ALL
             SELECT run.public_id,
                    run.task_kind,
                    NULL AS stage,
                    run.provider_channel,
                    run.model_id,
                    run.status,
                    run.prompt_tokens,
                    run.completion_tokens,
                    run.reasoning_tokens,
                    run.cached_tokens,
                    run.total_tokens,
                    COALESCE(run.completed_at, run.started_at) AS occurred_at,
                    run.error_message
               FROM ai_task_runs run
              WHERE NOT EXISTS (
                SELECT 1 FROM ai_task_model_steps step
                 WHERE step.task_public_id = run.public_id
              )
           )
          WHERE occurred_at IS NOT NULL
          ORDER BY occurred_at DESC
          LIMIT ?1",
    )?;
    let rows = statement.query_map([safe_limit], |row| {
        Ok(AiCallHistoryEntry {
            task_public_id: row.get(0)?,
            task_kind: row.get(1)?,
            stage: row.get(2)?,
            provider_channel: row.get(3)?,
            model_id: row.get(4)?,
            status: row.get(5)?,
            prompt_tokens: row.get(6)?,
            completion_tokens: row.get(7)?,
            reasoning_tokens: row.get(8)?,
            cached_tokens: row.get(9)?,
            total_tokens: row.get(10)?,
            occurred_at: row.get(11)?,
            error_message: row.get(12)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

pub fn record_task_model_step(
    connection: &Connection,
    task_public_id: &str,
    stage: &str,
    channel: AiProviderChannel,
    model_id: &str,
    usage: &AiTaskUsage,
) -> AppResult<()> {
    connection.execute(
        "INSERT INTO ai_task_model_steps(
           task_public_id, stage, provider_channel, model_id,
           prompt_tokens, completion_tokens, reasoning_tokens, cached_tokens,
           cache_miss_tokens, cache_write_tokens, total_tokens, cost_usd,
           cache_mode, stable_prefix_hash, cache_key_hash, prompt_contract_version,
           duration_ms, cache_discount_usd, cache_savings_usd,
           cost_kind, pricing_snapshot_json, created_at
         ) VALUES (
           ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
           ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22
         )",
        params![
            task_public_id,
            stage,
            channel.as_str(),
            model_id,
            usage.prompt_tokens,
            usage.completion_tokens,
            usage.reasoning_tokens,
            usage.cached_tokens,
            usage.cache_miss_tokens,
            usage.cache_write_tokens,
            usage.total_tokens,
            usage.cost_usd,
            usage.cache_mode,
            usage.stable_prefix_hash,
            usage.cache_key_hash,
            usage.prompt_contract_version,
            usage.duration_ms,
            usage.cache_discount_usd,
            usage.cache_savings_usd,
            usage.cost_kind,
            usage.pricing_snapshot_json,
            now(),
        ],
    )?;
    Ok(())
}

pub fn save_settings(
    connection: &Connection,
    input: &SaveAiSettingsInput,
) -> AppResult<AiSettingsView> {
    let timestamp = now();
    match input.routing_mode.trim() {
        "auto" => {
            connection.execute(
                "UPDATE ai_settings SET active_channel = 'auto', updated_at = ?1 WHERE singleton_id = 1",
                [timestamp],
            )?;
        }
        "manual" => {
            let selection = input
                .manual_selection
                .as_ref()
                .ok_or_else(|| AppError::Validation("手动路由需要选择一个可用模型".to_string()))?;
            let model_id = selection.model_id.trim();
            if model_id.is_empty() {
                return Err(AppError::Validation("请选择一个具体模型".to_string()));
            }
            if credentials::get_api_key(selection.channel)?.is_none() {
                return Err(AppError::Validation(
                    "请先保存该模型对应的 API Key".to_string(),
                ));
            }
            if !model_catalog(connection, selection.channel)?
                .iter()
                .any(|model| model.id == model_id)
            {
                return Err(AppError::Validation(
                    "所选模型不在当前可用目录中，请更新对应模型目录".to_string(),
                ));
            }
            connection.execute(
                "UPDATE ai_provider_settings
                 SET selected_model_id = ?1, updated_at = ?2 WHERE channel = ?3",
                params![model_id, timestamp, selection.channel.as_str()],
            )?;
            connection.execute(
                "UPDATE ai_settings SET active_channel = ?1, updated_at = ?2 WHERE singleton_id = 1",
                params![format!("manual:{}", selection.channel.as_str()), timestamp],
            )?;
        }
        _ => return Err(AppError::Validation("不支持的任务路由模式".to_string())),
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

fn stored_manual_selection(
    connection: &Connection,
) -> AppResult<Option<(AiProviderChannel, String)>> {
    let routing_storage: String = connection.query_row(
        "SELECT active_channel FROM ai_settings WHERE singleton_id = 1",
        [],
        |row| row.get(0),
    )?;
    let Some(channel_value) = routing_storage.strip_prefix("manual:") else {
        return Ok(None);
    };
    let channel = AiProviderChannel::parse(channel_value)?;
    let model_id: Option<String> = connection.query_row(
        "SELECT selected_model_id FROM ai_provider_settings WHERE channel = ?1",
        [channel.as_str()],
        |row| row.get(0),
    )?;
    let Some(model_id) = model_id.filter(|value| !value.trim().is_empty()) else {
        return Ok(None);
    };
    if !model_catalog(connection, channel)?
        .iter()
        .any(|model| model.id == model_id)
    {
        return Ok(None);
    }
    Ok(Some((channel, model_id)))
}

fn automatic_channel_priority() -> [AiProviderChannel; 3] {
    [
        AiProviderChannel::QwenDirect,
        AiProviderChannel::DeepseekDirect,
        AiProviderChannel::Openrouter,
    ]
}

fn automatic_task_model_route(
    connection: &Connection,
) -> AppResult<(AiProviderChannel, AiTaskModelRoute)> {
    // 南枫知识库自动任务先使用已验证的千问 Flash/Plus 组合：高频阶段成本和延迟可控，
    // 跨文档阶段使用 Plus。千问未配置时才降到 DeepSeek 直连，最后使用 OpenRouter。
    for channel in automatic_channel_priority() {
        if credentials::get_api_key(channel)?.is_none() {
            continue;
        }
        let catalog = model_catalog(connection, channel)?;
        let selected_model_id = match channel {
            AiProviderChannel::QwenDirect => crate::ai::models::QWEN_COMPLEX_SYNTHESIS_MODEL.to_string(),
            AiProviderChannel::DeepseekDirect => crate::ai::models::DEEPSEEK_COMPLEX_SYNTHESIS_MODEL.to_string(),
            AiProviderChannel::Openrouter => connection
                .query_row(
                    "SELECT selected_model_id FROM ai_provider_settings WHERE channel = 'openrouter'",
                    [],
                    |row| row.get::<_, Option<String>>(0),
                )?
                .filter(|model_id| catalog.iter().any(|model| model.id == *model_id))
                .or_else(|| catalog.first().map(|model| model.id.clone()))
                .ok_or_else(|| AppError::Validation("OpenRouter 尚无可用模型目录，请更新模型目录".to_string()))?,
        };
        return Ok((
            channel,
            task_model_route(channel, &selected_model_id, &catalog),
        ));
    }
    Err(AppError::Validation(
        "请先在 API Key 中配置千问、DeepSeek 或 OpenRouter".to_string(),
    ))
}

fn resolve_selection(
    connection: &Connection,
    requested: Option<AiModelSelectionInput>,
) -> AppResult<(AiProviderChannel, String)> {
    if requested.is_none() {
        if let Some(selection) = stored_manual_selection(connection)? {
            return Ok(selection);
        }
        let (channel, route) = automatic_task_model_route(connection)?;
        return Ok((channel, route.synthesis_model_id));
    };
    let requested = requested.expect("checked above");
    let model_id = requested.model_id.trim().to_string();
    if model_id.is_empty() {
        return Err(AppError::Validation("请选择可用的 AI 模型".to_string()));
    }
    if credentials::get_api_key(requested.channel)?.is_none() {
        return Err(AppError::Validation(
            "请先保存该模型对应的 API Key".to_string(),
        ));
    }
    Ok((requested.channel, model_id))
}

pub fn resolve_topic_insight_selection(
    connection: &Connection,
    requested: Option<AiModelSelectionInput>,
) -> AppResult<(AiProviderChannel, String)> {
    let (channel, route) = resolve_task_model_route(connection, requested)?;
    Ok((channel, route.topic_insight_model_id))
}

pub fn resolve_taxonomy_selection(
    connection: &Connection,
    requested: Option<AiModelSelectionInput>,
) -> AppResult<(AiProviderChannel, String)> {
    let (channel, route) = resolve_task_model_route(connection, requested)?;
    Ok((channel, route.synthesis_model_id))
}

pub fn resolve_task_model_route(
    connection: &Connection,
    requested: Option<AiModelSelectionInput>,
) -> AppResult<(AiProviderChannel, AiTaskModelRoute)> {
    if requested.is_none() {
        if stored_manual_selection(connection)?.is_none() {
            return automatic_task_model_route(connection);
        }
    }
    let (channel, selected_model_id) = resolve_selection(connection, requested)?;
    let catalog = model_catalog(connection, channel)?;
    Ok((
        channel,
        task_model_route(channel, &selected_model_id, &catalog),
    ))
}

fn model_catalog(
    connection: &Connection,
    channel: AiProviderChannel,
) -> AppResult<Vec<AiModelDescriptor>> {
    let catalog_json: String = connection.query_row(
        "SELECT catalog_json FROM ai_provider_settings WHERE channel = ?1",
        [channel.as_str()],
        |row| row.get(0),
    )?;
    let mut catalog = if channel == AiProviderChannel::QwenDirect && catalog_json == "[]" {
        crate::ai::models::qwen_model_catalog()
    } else {
        serde_json::from_str(&catalog_json).unwrap_or_default()
    };
    catalog.retain(|model| is_nanfeng_knowledge_base_model(channel, model));
    Ok(catalog)
}

pub fn model_descriptor(
    connection: &Connection,
    channel: AiProviderChannel,
    model_id: &str,
) -> AppResult<Option<AiModelDescriptor>> {
    Ok(model_catalog(connection, channel)?
        .into_iter()
        .find(|model| model.id == model_id))
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
           public_id, task_kind, topic_id, provider_channel, model_id, status,
           execution_contract_version, started_at
         ) VALUES (?1, 'topic_insight', ?2, ?3, ?4, 'running', ?5, ?6)",
        params![
            public_id,
            topic_id,
            channel.as_str(),
            model_id,
            AI_EXECUTION_CONTRACT_VERSION,
            now()
        ],
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

/// 单实例锁已建立后，数据库中仍为 running 的记录只能来自上一次异常退出。
/// 分类任务保留断点并转为 interrupted；其他任务同样显式结束，避免永久悬挂。
pub fn recover_stale_ai_tasks(connection: &Connection) -> AppResult<usize> {
    let recovered_at = now();
    let message = "上次程序退出时 AI 任务未完成，已在本次启动时安全中断";
    let changed = connection.execute(
        "UPDATE ai_task_runs
         SET status = 'interrupted', error_message = ?1, completed_at = ?2
         WHERE status = 'running'",
        params![message, recovered_at],
    )?;
    Ok(changed)
}

pub fn complete_topic_insight_task(
    connection: &Connection,
    public_id: &str,
    topic_id: i64,
    channel: AiProviderChannel,
    model_id: &str,
    input_fingerprint: &str,
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
           topic_management_suggestions_json, hypotheses_json,
           judgment_evolution_json, decisions_json, generated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
         ON CONFLICT(topic_id) DO UPDATE SET
           task_public_id = excluded.task_public_id,
           provider_channel = excluded.provider_channel,
           model_id = excluded.model_id,
           summary_markdown = excluded.summary_markdown,
           key_insights_json = excluded.key_insights_json,
           evidence_json = excluded.evidence_json,
           open_questions_json = excluded.open_questions_json,
           topic_management_suggestions_json = excluded.topic_management_suggestions_json,
           hypotheses_json = excluded.hypotheses_json,
           judgment_evolution_json = excluded.judgment_evolution_json,
           decisions_json = excluded.decisions_json,
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
            serde_json::to_string(&insight.hypotheses)?,
            serde_json::to_string(&insight.judgment_evolution)?,
            serde_json::to_string(&insight.decisions)?,
            generated_at
        ],
    )?;
    transaction.execute(
        "INSERT INTO ai_topic_insight_versions(
           topic_id, task_public_id, provider_channel, model_id, input_fingerprint,
           execution_contract_version,
           summary_markdown, key_insights_json, evidence_json, open_questions_json,
           topic_management_suggestions_json, hypotheses_json,
           judgment_evolution_json, decisions_json, generated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            topic_id,
            public_id,
            channel.as_str(),
            model_id,
            input_fingerprint,
            AI_EXECUTION_CONTRACT_VERSION,
            insight.summary_markdown,
            serde_json::to_string(&insight.key_insights)?,
            serde_json::to_string(&insight.evidence)?,
            serde_json::to_string(&insight.open_questions)?,
            serde_json::to_string(&insight.topic_management_suggestions)?,
            serde_json::to_string(&insight.hypotheses)?,
            serde_json::to_string(&insight.judgment_evolution)?,
            serde_json::to_string(&insight.decisions)?,
            generated_at,
        ],
    )?;
    transaction.commit()?;
    get_topic_insight_for_model(connection, topic_id, channel, model_id)?
        .ok_or_else(|| AppError::NotFound("AI 洞察写入后无法读取".to_string()))
}

pub fn get_topic_insight(
    connection: &Connection,
    topic_id: i64,
) -> AppResult<Option<AiTopicInsightView>> {
    get_topic_insight_by_query(
        connection,
        "WHERE topic_id = ?1 ORDER BY generated_at DESC LIMIT 1",
        params![topic_id],
    )
}

pub fn get_topic_insight_for_model(
    connection: &Connection,
    topic_id: i64,
    channel: AiProviderChannel,
    model_id: &str,
) -> AppResult<Option<AiTopicInsightView>> {
    get_topic_insight_by_query(
        connection,
        "WHERE topic_id = ?1 AND provider_channel = ?2 AND model_id = ?3
         ORDER BY generated_at DESC LIMIT 1",
        params![topic_id, channel.as_str(), model_id],
    )
}

pub fn get_reusable_topic_insight(
    connection: &Connection,
    topic_id: i64,
    channel: AiProviderChannel,
    model_id: &str,
    input_fingerprint: &str,
) -> AppResult<Option<AiTopicInsightView>> {
    get_topic_insight_by_query(
        connection,
        "WHERE topic_id = ?1 AND provider_channel = ?2 AND model_id = ?3
           AND input_fingerprint = ?4 AND execution_contract_version = ?5
           ORDER BY generated_at DESC LIMIT 1",
        params![
            topic_id,
            channel.as_str(),
            model_id,
            input_fingerprint,
            AI_EXECUTION_CONTRACT_VERSION
        ],
    )
}

fn get_topic_insight_by_query(
    connection: &Connection,
    where_clause: &str,
    query_params: impl rusqlite::Params,
) -> AppResult<Option<AiTopicInsightView>> {
    let query = format!(
        "SELECT topic_id, task_public_id, provider_channel, model_id, input_fingerprint, summary_markdown,
                key_insights_json, evidence_json, open_questions_json,
                topic_management_suggestions_json, hypotheses_json,
                judgment_evolution_json, decisions_json, generated_at
         FROM ai_topic_insight_versions {where_clause}"
    );
    let row = connection
        .query_row(&query, query_params, |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, String>(9)?,
                row.get::<_, String>(10)?,
                row.get::<_, String>(11)?,
                row.get::<_, String>(12)?,
                row.get::<_, String>(13)?,
            ))
        })
        .optional()?;
    let Some((
        topic_id,
        task_public_id,
        provider_channel,
        model_id,
        input_fingerprint,
        summary_markdown,
        key_insights_json,
        evidence_json,
        open_questions_json,
        topic_management_suggestions_json,
        hypotheses_json,
        judgment_evolution_json,
        decisions_json,
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
        input_fingerprint,
        payload: AiTopicInsightPayload {
            summary_markdown,
            key_insights: serde_json::from_str(&key_insights_json)?,
            evidence: serde_json::from_str(&evidence_json)?,
            open_questions: serde_json::from_str(&open_questions_json)?,
            topic_management_suggestions: serde_json::from_str(&topic_management_suggestions_json)?,
            hypotheses: serde_json::from_str(&hypotheses_json)?,
            judgment_evolution: serde_json::from_str(&judgment_evolution_json)?,
            decisions: serde_json::from_str(&decisions_json)?,
        },
        generated_at,
    }))
}

pub fn list_source_materials(connection: &Connection) -> AppResult<Vec<AiSourceMaterial>> {
    let mut statement = connection.prepare(
        "SELECT source.id, source.title, source.original_text, source.content_sha256
         FROM visible_source_items source
         WHERE length(trim(source.original_text)) > 0
         ORDER BY source.id",
    )?;
    let rows = statement.query_map([], |row| {
        let original_text = row.get::<_, String>(2)?;
        Ok(AiSourceMaterial {
            source_item_id: row.get(0)?,
            title: row.get(1)?,
            content: crate::knowledge::readable_text::classification_text(&original_text),
            content_sha256: row.get(3)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn begin_taxonomy_revision_task(
    connection: &Connection,
    channel: AiProviderChannel,
    model_id: &str,
    profile_model_id: &str,
    materials: &[AiSourceMaterial],
) -> AppResult<String> {
    let public_id = format!("ai-task-{}", Uuid::new_v4());
    let timestamp = now();
    let transaction = connection.unchecked_transaction()?;
    transaction.execute(
        "INSERT INTO ai_task_runs(
           public_id, task_kind, provider_channel, model_id, status,
           execution_contract_version, started_at
         ) VALUES (?1, 'taxonomy_revision', ?2, ?3, 'running', ?4, ?5)",
        params![
            public_id,
            channel.as_str(),
            model_id,
            AI_EXECUTION_CONTRACT_VERSION,
            timestamp
        ],
    )?;
    transaction.execute(
        "INSERT INTO ai_taxonomy_run_checkpoints(
           task_public_id, provider_channel, model_id, profile_model_id, source_snapshot_json,
           execution_contract_version, profiles_json, assignments_json, stage, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, '[]', '[]', 'profiles', ?7)",
        params![
            public_id,
            channel.as_str(),
            model_id,
            profile_model_id,
            taxonomy_source_snapshot(materials)?,
            AI_EXECUTION_CONTRACT_VERSION,
            timestamp,
        ],
    )?;
    transaction.commit()?;
    Ok(public_id)
}

/// 以同一供应商和模型的最新分类为基线，仅处理新增或正文发生变化的笔记。
/// 基线的领域/主题不会重新生成；受影响主题会在后续阶段重新整合全部关联笔记。
pub fn begin_incremental_taxonomy_revision_task(
    connection: &Connection,
    channel: AiProviderChannel,
    model_id: &str,
    profile_model_id: &str,
    materials: &[AiSourceMaterial],
) -> AppResult<(String, Vec<AiSourceMaterial>)> {
    let baseline =
        get_latest_taxonomy_revision_for_model_and_contract(connection, channel, model_id)?
            .ok_or_else(|| {
                AppError::Validation(
                    "当前模型尚无可复用的全库分类；请先运行一次“AI 全量重新整理”".to_string(),
                )
            })?;
    if baseline.status == "undone" {
        return Err(AppError::Validation(
            "当前模型最新分类已撤销；请先运行一次“AI 全量重新整理”建立新基线".to_string(),
        ));
    }
    validate_revision_integrations(
        &AiTaxonomyStructure {
            domains: baseline.domains.clone(),
            topics: baseline.topics.clone(),
        },
        &baseline.assignments,
    )?;
    let snapshot_json: String = connection.query_row(
        "SELECT source_snapshot_json FROM ai_taxonomy_revisions WHERE public_id = ?1",
        [&baseline.public_id],
        |row| row.get(0),
    )?;
    let baseline_snapshot = serde_json::from_str::<Vec<(i64, Option<String>)>>(&snapshot_json)?
        .into_iter()
        .collect::<std::collections::HashMap<_, _>>();
    let changed_materials = materials
        .iter()
        .filter(|material| {
            baseline_snapshot.get(&material.source_item_id) != Some(&material.content_sha256)
        })
        .cloned()
        .collect::<Vec<_>>();
    if changed_materials.is_empty() {
        return Err(AppError::Conflict(
            "当前模型没有新增或变更的笔记；已保留并沿用现有分类结果".to_string(),
        ));
    }
    let changed_ids = changed_materials
        .iter()
        .map(|item| item.source_item_id)
        .collect::<std::collections::HashSet<_>>();
    let unchanged_materials = materials
        .iter()
        .filter(|item| !changed_ids.contains(&item.source_item_id))
        .cloned()
        .collect::<Vec<_>>();
    // 增量整合必须能复用同一任务档位、同正文版本的已有档案；绝不从其他
    // 供应商或其他模型借用。路由在任务开始时已冻结，断点/增量不重新推导。
    let _ =
        load_model_source_profiles(connection, channel, profile_model_id, &unchanged_materials)?;
    let retained_assignments = baseline
        .assignments
        .iter()
        .filter(|assignment| !changed_ids.contains(&assignment.source_item_id))
        .cloned()
        .collect::<Vec<_>>();
    let affected_topic_keys = baseline
        .assignments
        .iter()
        .filter(|assignment| changed_ids.contains(&assignment.source_item_id))
        .map(|assignment| assignment.topic_key.clone())
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let public_id = format!("ai-task-{}", Uuid::new_v4());
    let timestamp = now();
    let transaction = connection.unchecked_transaction()?;
    transaction.execute(
        "INSERT INTO ai_task_runs(
           public_id, task_kind, provider_channel, model_id, status,
           execution_contract_version, started_at
         ) VALUES (?1, 'taxonomy_incremental', ?2, ?3, 'running', ?4, ?5)",
        params![
            public_id,
            channel.as_str(),
            model_id,
            AI_EXECUTION_CONTRACT_VERSION,
            timestamp
        ],
    )?;
    transaction.execute(
        "INSERT INTO ai_taxonomy_run_checkpoints(
           task_public_id, provider_channel, model_id, profile_model_id, source_snapshot_json,
           profiles_json, taxonomy_json, assignments_json, run_mode,
           baseline_revision_public_id, base_assignment_count,
           integration_topic_keys_json, execution_contract_version, stage, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, '[]', ?6, ?7, 'incremental', ?8, ?9, ?10, ?11, 'profiles', ?12)",
        params![
            public_id,
            channel.as_str(),
            model_id,
            profile_model_id,
            taxonomy_source_snapshot(materials)?,
            serde_json::to_string(&AiTaxonomyStructure {
                domains: baseline.domains,
                topics: baseline.topics
            })?,
            serde_json::to_string(&retained_assignments)?,
            baseline.public_id,
            retained_assignments.len() as i64,
            serde_json::to_string(&affected_topic_keys)?,
            AI_EXECUTION_CONTRACT_VERSION,
            timestamp,
        ],
    )?;
    transaction.commit()?;
    Ok((public_id, changed_materials))
}

fn taxonomy_source_snapshot(materials: &[AiSourceMaterial]) -> AppResult<String> {
    let snapshot = materials
        .iter()
        .map(|item| (item.source_item_id, item.content_sha256.as_deref()))
        .collect::<Vec<_>>();
    Ok(serde_json::to_string(&snapshot)?)
}

pub fn load_model_source_profiles(
    connection: &Connection,
    channel: AiProviderChannel,
    model_id: &str,
    materials: &[AiSourceMaterial],
) -> AppResult<Vec<AiSourceProfile>> {
    let mut profiles = Vec::with_capacity(materials.len());
    for material in materials {
        let profile_json = connection
            .query_row(
                "SELECT profile_json FROM ai_source_profile_versions
             WHERE source_item_id = ?1 AND provider_channel = ?2 AND model_id = ?3
               AND content_sha256 = ?4 AND execution_contract_version = ?5
             ORDER BY generated_at DESC LIMIT 1",
                params![
                    material.source_item_id,
                    channel.as_str(),
                    model_id,
                    material.content_sha256.as_deref().unwrap_or(""),
                    AI_EXECUTION_CONTRACT_VERSION
                ],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        let profile_json = profile_json.ok_or_else(|| {
            AppError::Conflict(format!(
                "当前模型缺少笔记“{}”的可复用 AI 档案；请先运行一次全量重新整理",
                material.title,
            ))
        })?;
        profiles.push(serde_json::from_str(&profile_json)?);
    }
    Ok(profiles)
}

pub fn incremental_materials_for_checkpoint(
    connection: &Connection,
    checkpoint: &AiTaxonomyRunCheckpoint,
    materials: &[AiSourceMaterial],
) -> AppResult<Vec<AiSourceMaterial>> {
    let baseline_public_id = checkpoint
        .baseline_revision_public_id
        .as_deref()
        .ok_or_else(|| {
            AppError::Conflict("增量 AI 分类断点缺少分类基线，不能继续以免重复计费".to_string())
        })?;
    let snapshot_json: String = connection.query_row(
        "SELECT source_snapshot_json FROM ai_taxonomy_revisions WHERE public_id = ?1",
        [baseline_public_id],
        |row| row.get(0),
    )?;
    let baseline_snapshot = serde_json::from_str::<Vec<(i64, Option<String>)>>(&snapshot_json)?
        .into_iter()
        .collect::<std::collections::HashMap<_, _>>();
    Ok(materials
        .iter()
        .filter(|material| {
            baseline_snapshot.get(&material.source_item_id) != Some(&material.content_sha256)
        })
        .cloned()
        .collect())
}

pub fn checkpoint_matches_materials(
    checkpoint: &AiTaxonomyRunCheckpoint,
    materials: &[AiSourceMaterial],
) -> AppResult<bool> {
    Ok(checkpoint.source_snapshot_json == taxonomy_source_snapshot(materials)?)
}

pub fn checkpoint_matches_execution_contract(checkpoint: &AiTaxonomyRunCheckpoint) -> bool {
    checkpoint.execution_contract_version == AI_EXECUTION_CONTRACT_VERSION
}

pub fn save_taxonomy_checkpoint(
    connection: &Connection,
    checkpoint: &AiTaxonomyRunCheckpoint,
) -> AppResult<()> {
    let timestamp = now();
    let transaction = connection.unchecked_transaction()?;
    transaction.execute(
        "UPDATE ai_taxonomy_run_checkpoints SET
           profiles_json = ?1, taxonomy_json = ?2, assignments_json = ?3,
           profile_offset = ?4, assignment_offset = ?5, integration_offset = ?6,
           integration_topic_keys_json = ?7, profile_model_id = ?8,
           execution_contract_version = ?9, stage = ?10, updated_at = ?11
         WHERE task_public_id = ?12",
        params![
            serde_json::to_string(&checkpoint.profiles)?,
            checkpoint
                .taxonomy
                .as_ref()
                .map(serde_json::to_string)
                .transpose()?,
            serde_json::to_string(&checkpoint.assignments)?,
            checkpoint.profile_offset as i64,
            checkpoint.assignment_offset as i64,
            checkpoint.integration_offset as i64,
            serde_json::to_string(&checkpoint.integration_topic_keys)?,
            checkpoint.profile_model_id,
            checkpoint.execution_contract_version,
            checkpoint.stage,
            timestamp,
            checkpoint.task_public_id,
        ],
    )?;
    transaction.execute(
        "UPDATE ai_task_runs SET
           status = 'running', prompt_tokens = ?1, completion_tokens = ?2,
           reasoning_tokens = ?3, cached_tokens = ?4, total_tokens = ?5,
           cost_usd = ?6, cost_kind = ?7, pricing_snapshot_json = ?8,
           error_message = NULL, completed_at = NULL
         WHERE public_id = ?9",
        params![
            checkpoint.usage.prompt_tokens,
            checkpoint.usage.completion_tokens,
            checkpoint.usage.reasoning_tokens,
            checkpoint.usage.cached_tokens,
            checkpoint.usage.total_tokens,
            checkpoint.usage.cost_usd,
            checkpoint.usage.cost_kind,
            checkpoint.usage.pricing_snapshot_json,
            checkpoint.task_public_id,
        ],
    )?;
    transaction.commit()?;
    Ok(())
}

pub fn interrupt_taxonomy_task(
    connection: &Connection,
    checkpoint: &AiTaxonomyRunCheckpoint,
    message: &str,
) -> AppResult<()> {
    save_taxonomy_checkpoint(connection, checkpoint)?;
    connection.execute(
        "UPDATE ai_task_runs SET status = 'interrupted', error_message = ?1, completed_at = ?2
         WHERE public_id = ?3",
        params![message, now(), checkpoint.task_public_id],
    )?;
    Ok(())
}

pub fn load_taxonomy_checkpoint(
    connection: &Connection,
    task_public_id: &str,
) -> AppResult<Option<AiTaxonomyRunCheckpoint>> {
    let row = connection
        .query_row(
            "SELECT checkpoint.provider_channel, checkpoint.model_id, checkpoint.profile_model_id,
                    checkpoint.source_snapshot_json, checkpoint.run_mode,
                    checkpoint.baseline_revision_public_id, checkpoint.profiles_json,
                    checkpoint.taxonomy_json, checkpoint.assignments_json,
                    checkpoint.profile_offset, checkpoint.assignment_offset,
                    checkpoint.base_assignment_count, checkpoint.integration_offset,
                    checkpoint.integration_topic_keys_json, checkpoint.stage, checkpoint.updated_at,
                    checkpoint.execution_contract_version,
                    task.prompt_tokens, task.completion_tokens, task.reasoning_tokens,
                    task.cached_tokens, task.total_tokens, task.cost_usd, task.cost_kind,
                    task.pricing_snapshot_json, task.error_message
             FROM ai_taxonomy_run_checkpoints checkpoint
             JOIN ai_task_runs task ON task.public_id = checkpoint.task_public_id
             WHERE checkpoint.task_public_id = ?1",
            [task_public_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, Option<String>>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, i64>(9)?,
                    row.get::<_, i64>(10)?,
                    row.get::<_, i64>(11)?,
                    row.get::<_, i64>(12)?,
                    row.get::<_, String>(13)?,
                    row.get::<_, String>(14)?,
                    row.get::<_, String>(15)?,
                    row.get::<_, String>(16)?,
                    row.get::<_, i64>(17)?,
                    row.get::<_, i64>(18)?,
                    row.get::<_, i64>(19)?,
                    row.get::<_, i64>(20)?,
                    row.get::<_, i64>(21)?,
                    row.get::<_, Option<f64>>(22)?,
                    row.get::<_, String>(23)?,
                    row.get::<_, String>(24)?,
                    row.get::<_, Option<String>>(25)?,
                ))
            },
        )
        .optional()?;
    let Some((
        provider_channel,
        model_id,
        profile_model_id,
        source_snapshot_json,
        run_mode,
        baseline_revision_public_id,
        profiles_json,
        taxonomy_json,
        assignments_json,
        profile_offset,
        assignment_offset,
        base_assignment_count,
        integration_offset,
        integration_topic_keys_json,
        stage,
        updated_at,
        execution_contract_version,
        prompt_tokens,
        completion_tokens,
        reasoning_tokens,
        cached_tokens,
        total_tokens,
        cost_usd,
        cost_kind,
        pricing_snapshot_json,
        last_error,
    )) = row
    else {
        return Ok(None);
    };
    Ok(Some(AiTaxonomyRunCheckpoint {
        task_public_id: task_public_id.to_string(),
        execution_contract_version,
        provider_channel: AiProviderChannel::parse(&provider_channel)?,
        model_id,
        profile_model_id,
        source_snapshot_json,
        run_mode,
        baseline_revision_public_id,
        profiles: serde_json::from_str(&profiles_json)?,
        taxonomy: taxonomy_json
            .as_deref()
            .map(serde_json::from_str)
            .transpose()?,
        assignments: serde_json::from_str(&assignments_json)?,
        profile_offset: profile_offset.max(0) as usize,
        assignment_offset: assignment_offset.max(0) as usize,
        base_assignment_count: base_assignment_count.max(0) as usize,
        integration_offset: integration_offset.max(0) as usize,
        integration_topic_keys: serde_json::from_str(&integration_topic_keys_json)?,
        stage,
        usage: AiTaskUsage {
            prompt_tokens,
            completion_tokens,
            reasoning_tokens,
            cached_tokens,
            total_tokens,
            cost_usd,
            cost_kind,
            pricing_snapshot_json,
            ..AiTaskUsage::default()
        },
        updated_at,
        last_error,
    }))
}

fn checkpoint_resume_view(checkpoint: &AiTaxonomyRunCheckpoint) -> AppResult<AiTaxonomyResumeView> {
    let source_count =
        serde_json::from_str::<Vec<(i64, Option<String>)>>(&checkpoint.source_snapshot_json)?.len()
            as i64;
    let assigned_topic_keys = checkpoint
        .assignments
        .iter()
        .map(|item| item.topic_key.as_str())
        .collect::<std::collections::HashSet<_>>();
    Ok(AiTaxonomyResumeView {
        task_public_id: checkpoint.task_public_id.clone(),
        provider_channel: checkpoint.provider_channel.as_str().to_string(),
        model_id: checkpoint.model_id.clone(),
        stage: checkpoint.stage.clone(),
        source_count,
        profiled_source_count: checkpoint.profile_offset as i64,
        assigned_source_count: checkpoint.assignment_offset as i64,
        integrated_topic_count: checkpoint.integration_offset as i64,
        total_topic_count: assigned_topic_keys.len() as i64,
        total_tokens: checkpoint.usage.total_tokens,
        cost_usd: checkpoint.usage.cost_usd,
        updated_at: checkpoint.updated_at.clone(),
        last_error: checkpoint.last_error.clone(),
    })
}

pub fn get_resumable_taxonomy_run(
    connection: &Connection,
) -> AppResult<Option<AiTaxonomyResumeView>> {
    let task_public_id = connection
        .query_row(
            "SELECT checkpoint.task_public_id
             FROM ai_taxonomy_run_checkpoints checkpoint
             JOIN ai_task_runs task ON task.public_id = checkpoint.task_public_id
             WHERE task.status IN ('running', 'interrupted', 'failed')
             ORDER BY checkpoint.updated_at DESC LIMIT 1",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()?;
    task_public_id
        .map(|task_public_id| {
            load_taxonomy_checkpoint(connection, &task_public_id)?
                .map(|checkpoint| checkpoint_resume_view(&checkpoint))
                .transpose()
        })
        .transpose()
        .map(Option::flatten)
}

pub fn discard_taxonomy_checkpoint(connection: &Connection, task_public_id: &str) -> AppResult<()> {
    let transaction = connection.unchecked_transaction()?;
    transaction.execute(
        "DELETE FROM ai_taxonomy_run_checkpoints WHERE task_public_id = ?1",
        [task_public_id],
    )?;
    transaction.execute(
        "UPDATE ai_task_runs SET status = 'abandoned', completed_at = ?1
         WHERE public_id = ?2 AND status IN ('running', 'interrupted', 'failed')",
        params![now(), task_public_id],
    )?;
    transaction.commit()?;
    Ok(())
}

pub fn complete_taxonomy_revision_task(
    connection: &Connection,
    task_public_id: &str,
    channel: AiProviderChannel,
    model_id: &str,
    profile_model_id: &str,
    materials: &[AiSourceMaterial],
    profiles: &[AiSourceProfile],
    taxonomy: &AiTaxonomyStructure,
    assignments: &[AiTaxonomyAssignmentProposal],
    usage: &AiTaskUsage,
) -> AppResult<AiTaxonomyRevisionView> {
    validate_revision(materials, taxonomy, assignments)?;
    ensure_taxonomy_sources_visible(
        connection,
        materials.iter().map(|material| material.source_item_id),
    )?;
    let created_at = now();
    let revision_public_id = format!("taxonomy-revision-{}", Uuid::new_v4());
    let transaction = connection.unchecked_transaction()?;
    transaction.execute(
        "UPDATE ai_task_runs SET
           status = 'succeeded', prompt_tokens = ?1, completion_tokens = ?2,
           reasoning_tokens = ?3, cached_tokens = ?4, total_tokens = ?5,
           cost_usd = ?6, cost_kind = ?7, pricing_snapshot_json = ?8,
           completed_at = ?9 WHERE public_id = ?10",
        params![
            usage.prompt_tokens,
            usage.completion_tokens,
            usage.reasoning_tokens,
            usage.cached_tokens,
            usage.total_tokens,
            usage.cost_usd,
            usage.cost_kind,
            usage.pricing_snapshot_json,
            created_at,
            task_public_id
        ],
    )?;
    for profile in profiles {
        let material = materials
            .iter()
            .find(|item| item.source_item_id == profile.source_item_id)
            .ok_or_else(|| AppError::Conflict("AI 档案引用了不存在的来源".to_string()))?;
        transaction.execute(
            "INSERT INTO ai_source_profiles(
               source_item_id, task_public_id, content_sha256, profile_json, generated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(source_item_id) DO UPDATE SET
               task_public_id = excluded.task_public_id,
               content_sha256 = excluded.content_sha256,
               profile_json = excluded.profile_json,
               generated_at = excluded.generated_at",
            params![
                profile.source_item_id,
                task_public_id,
                material.content_sha256,
                serde_json::to_string(profile)?,
                created_at,
            ],
        )?;
        transaction.execute(
            "INSERT INTO ai_source_profile_versions(
               source_item_id, provider_channel, model_id, content_sha256,
               execution_contract_version, task_public_id, profile_json, generated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(
               source_item_id, provider_channel, model_id, content_sha256,
               execution_contract_version
             )
             DO UPDATE SET task_public_id = excluded.task_public_id,
               profile_json = excluded.profile_json, generated_at = excluded.generated_at",
            params![
                profile.source_item_id,
                channel.as_str(),
                profile_model_id,
                material.content_sha256.as_deref().unwrap_or(""),
                AI_EXECUTION_CONTRACT_VERSION,
                task_public_id,
                serde_json::to_string(profile)?,
                created_at,
            ],
        )?;
    }
    let uncertain_count = assignments.iter().filter(|item| item.uncertain).count() as i64;
    transaction.execute(
        "INSERT INTO ai_taxonomy_revisions(
           public_id, task_public_id, provider_channel, model_id, status,
           domains_json, topics_json, source_count, assigned_source_count,
           uncertain_source_count, source_snapshot_json, execution_contract_version, created_at
         ) VALUES (?1, ?2, ?3, ?4, 'draft', ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            revision_public_id,
            task_public_id,
            channel.as_str(),
            model_id,
            serde_json::to_string(&taxonomy.domains)?,
            serde_json::to_string(&taxonomy.topics)?,
            materials.len() as i64,
            assignments.len() as i64,
            uncertain_count,
            taxonomy_source_snapshot(materials)?,
            AI_EXECUTION_CONTRACT_VERSION,
            created_at,
        ],
    )?;
    let revision_id = transaction.last_insert_rowid();
    for assignment in assignments {
        transaction.execute(
            "INSERT INTO ai_taxonomy_revision_assignments(
               revision_id, source_item_id, topic_key, confidence, reason, uncertain
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                revision_id,
                assignment.source_item_id,
                assignment.topic_key,
                assignment.confidence,
                assignment.reason,
                assignment.uncertain,
            ],
        )?;
    }
    transaction.execute(
        "DELETE FROM ai_taxonomy_run_checkpoints WHERE task_public_id = ?1",
        [task_public_id],
    )?;
    transaction.commit()?;
    get_taxonomy_revision(connection, &revision_public_id)?
        .ok_or_else(|| AppError::NotFound("AI 分类修订写入后无法读取".to_string()))
}

fn validate_revision(
    materials: &[AiSourceMaterial],
    taxonomy: &AiTaxonomyStructure,
    assignments: &[AiTaxonomyAssignmentProposal],
) -> AppResult<()> {
    let source_ids = materials
        .iter()
        .map(|item| item.source_item_id)
        .collect::<std::collections::HashSet<_>>();
    let assignment_ids = assignments
        .iter()
        .map(|item| item.source_item_id)
        .collect::<std::collections::HashSet<_>>();
    let topic_keys = taxonomy
        .topics
        .iter()
        .map(|item| item.key.as_str())
        .collect::<std::collections::HashSet<_>>();
    if source_ids != assignment_ids || assignments.len() != materials.len() {
        return Err(AppError::Conflict(
            "AI 分类修订没有完整覆盖全部有效笔记".to_string(),
        ));
    }
    if assignments
        .iter()
        .any(|item| !topic_keys.contains(item.topic_key.as_str()))
    {
        return Err(AppError::Conflict(
            "AI 分类修订包含无效主题归属".to_string(),
        ));
    }
    validate_revision_integrations(taxonomy, assignments)?;
    Ok(())
}

/// AI 任务可能在运行期间遇到用户把来源移入回收站。草稿、续跑和应用都只能消费
/// 当前可见来源，不能借由旧快照再次改写已删除笔记的分类状态。
fn ensure_taxonomy_sources_visible(
    connection: &Connection,
    source_item_ids: impl IntoIterator<Item = i64>,
) -> AppResult<()> {
    let source_item_ids = source_item_ids
        .into_iter()
        .collect::<std::collections::BTreeSet<_>>();
    for source_item_id in source_item_ids {
        let exists = connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM visible_source_items WHERE id = ?1)",
            [source_item_id],
            |row| row.get::<_, i64>(0),
        )? != 0;
        if !exists {
            return Err(AppError::Conflict(
                "AI 分类任务包含已删除或已归档的笔记；请移除旧草稿后重新生成".to_string(),
            ));
        }
    }
    Ok(())
}

pub(crate) fn validate_revision_integrations(
    taxonomy: &AiTaxonomyStructure,
    assignments: &[AiTaxonomyAssignmentProposal],
) -> AppResult<()> {
    let mut assigned_sources_by_topic =
        std::collections::HashMap::<&str, std::collections::HashSet<i64>>::new();
    for assignment in assignments {
        assigned_sources_by_topic
            .entry(assignment.topic_key.as_str())
            .or_default()
            .insert(assignment.source_item_id);
    }

    for (topic_key, assigned_source_ids) in assigned_sources_by_topic {
        let topic = taxonomy
            .topics
            .iter()
            .find(|item| item.key == topic_key)
            .ok_or_else(|| AppError::Conflict("AI 主题整合引用了不存在的主题".to_string()))?;
        if topic.integration_markdown.trim().is_empty() {
            return Err(AppError::Conflict(format!(
                "AI 主题整合为空：{}",
                topic.name
            )));
        }
        if topic.source_item_ids.is_empty() {
            return Err(AppError::Conflict(format!(
                "AI 主题整合缺少自动关联笔记来源：{}",
                topic.name
            )));
        }
        let integration_source_ids = topic
            .source_item_ids
            .iter()
            .copied()
            .collect::<std::collections::HashSet<_>>();
        if integration_source_ids != assigned_source_ids
            || topic.source_item_ids.len() != assigned_source_ids.len()
        {
            return Err(AppError::Conflict(format!(
                "AI 主题整合未完整绑定当前主题的全部笔记：{}",
                topic.name
            )));
        }
    }
    Ok(())
}

pub fn get_latest_taxonomy_revision(
    connection: &Connection,
) -> AppResult<Option<AiTaxonomyRevisionView>> {
    let public_id = connection
        .query_row(
            "SELECT public_id FROM ai_taxonomy_revisions ORDER BY id DESC LIMIT 1",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()?;
    match public_id {
        Some(public_id) => get_taxonomy_revision(connection, &public_id),
        None => Ok(None),
    }
}

pub fn get_latest_taxonomy_revision_for_model(
    connection: &Connection,
    channel: AiProviderChannel,
    model_id: &str,
) -> AppResult<Option<AiTaxonomyRevisionView>> {
    let public_id = connection
        .query_row(
            "SELECT public_id FROM ai_taxonomy_revisions
             WHERE provider_channel = ?1 AND model_id = ?2
             ORDER BY id DESC LIMIT 1",
            params![channel.as_str(), model_id],
            |row| row.get::<_, String>(0),
        )
        .optional()?;
    match public_id {
        Some(public_id) => get_taxonomy_revision(connection, &public_id),
        None => Ok(None),
    }
}

fn get_latest_taxonomy_revision_for_model_and_contract(
    connection: &Connection,
    channel: AiProviderChannel,
    model_id: &str,
) -> AppResult<Option<AiTaxonomyRevisionView>> {
    let public_id = connection
        .query_row(
            "SELECT public_id FROM ai_taxonomy_revisions
             WHERE provider_channel = ?1 AND model_id = ?2
               AND execution_contract_version = ?3
             ORDER BY id DESC LIMIT 1",
            params![channel.as_str(), model_id, AI_EXECUTION_CONTRACT_VERSION],
            |row| row.get::<_, String>(0),
        )
        .optional()?;
    match public_id {
        Some(public_id) => get_taxonomy_revision(connection, &public_id),
        None => Ok(None),
    }
}

pub fn get_applied_taxonomy_revision(
    connection: &Connection,
) -> AppResult<Option<AiTaxonomyRevisionView>> {
    let public_id = connection
        .query_row(
            "SELECT public_id FROM ai_taxonomy_revisions
             WHERE status = 'applied'
             ORDER BY id DESC LIMIT 1",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()?;
    match public_id {
        Some(public_id) => get_taxonomy_revision(connection, &public_id),
        None => Ok(None),
    }
}

pub fn get_taxonomy_revision(
    connection: &Connection,
    public_id: &str,
) -> AppResult<Option<AiTaxonomyRevisionView>> {
    let row = connection
        .query_row(
            "SELECT id, task_public_id, provider_channel, model_id, status,
                domains_json, topics_json, source_count, assigned_source_count,
                uncertain_source_count, created_at, applied_at, undone_at
         FROM ai_taxonomy_revisions WHERE public_id = ?1",
            [public_id],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, i64>(7)?,
                    row.get::<_, i64>(8)?,
                    row.get::<_, i64>(9)?,
                    row.get::<_, String>(10)?,
                    row.get::<_, Option<String>>(11)?,
                    row.get::<_, Option<String>>(12)?,
                ))
            },
        )
        .optional()?;
    let Some((
        revision_id,
        task_public_id,
        provider_channel,
        model_id,
        status,
        domains_json,
        topics_json,
        source_count,
        assigned_source_count,
        uncertain_source_count,
        created_at,
        applied_at,
        undone_at,
    )) = row
    else {
        return Ok(None);
    };
    let mut statement = connection.prepare(
        "SELECT source_item_id, topic_key, confidence, reason, uncertain
         FROM ai_taxonomy_revision_assignments WHERE revision_id = ?1 ORDER BY source_item_id",
    )?;
    let assignments = statement
        .query_map([revision_id], |row| {
            Ok(AiTaxonomyAssignmentProposal {
                source_item_id: row.get(0)?,
                topic_key: row.get(1)?,
                confidence: row.get(2)?,
                reason: row.get(3)?,
                uncertain: row.get::<_, i64>(4)? != 0,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Some(AiTaxonomyRevisionView {
        public_id: public_id.to_string(),
        task_public_id,
        provider_channel,
        model_id,
        status,
        domains: serde_json::from_str::<Vec<AiTaxonomyDomainProposal>>(&domains_json)?,
        topics: serde_json::from_str::<Vec<AiTaxonomyTopicProposal>>(&topics_json)?,
        assignments,
        source_count,
        assigned_source_count,
        uncertain_source_count,
        created_at,
        applied_at,
        undone_at,
    }))
}

fn normalized_name(value: &str) -> String {
    value.trim().to_lowercase()
}

pub fn apply_taxonomy_revision(
    connection: &Connection,
    public_id: &str,
) -> AppResult<AiTaxonomyApplyResult> {
    let revision = get_taxonomy_revision(connection, public_id)?
        .ok_or_else(|| AppError::NotFound("AI 分类修订不存在".to_string()))?;
    if revision.status != "draft" {
        return Err(AppError::Conflict(
            "只有待审核的 AI 分类修订可以应用".to_string(),
        ));
    }
    validate_revision_integrations(
        &AiTaxonomyStructure {
            domains: revision.domains.clone(),
            topics: revision.topics.clone(),
        },
        &revision.assignments,
    )?;
    ensure_taxonomy_sources_visible(
        connection,
        revision
            .assignments
            .iter()
            .map(|assignment| assignment.source_item_id),
    )?;
    let transaction = connection.unchecked_transaction()?;
    let previous_links = {
        let mut statement = transaction.prepare(
            "SELECT source_item_id, topic_id, confidence FROM source_topics WHERE role = 'primary' ORDER BY source_item_id",
        )?;
        let rows = statement.query_map([], |row| {
            Ok(serde_json::json!({
                "sourceItemId": row.get::<_, i64>(0)?,
                "topicId": row.get::<_, i64>(1)?,
                "confidence": row.get::<_, Option<f64>>(2)?,
            }))
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    let previous_statuses = {
        let mut statement = transaction.prepare("SELECT id, status FROM topics ORDER BY id")?;
        let rows = statement.query_map([], |row| {
            Ok(serde_json::json!({
                "topicId": row.get::<_, i64>(0)?, "status": row.get::<_, String>(1)?,
            }))
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    let before_snapshot = serde_json::json!({
        "primaryLinks": previous_links,
        "topicStatuses": previous_statuses,
    });
    let now_value = now();
    let mut domain_ids = std::collections::HashMap::new();
    let mut created_domains = 0_i64;
    for domain in &revision.domains {
        let normalized = normalized_name(&domain.name);
        let id = transaction
            .query_row(
                "SELECT id FROM domains WHERE normalized_name = ?1",
                [&normalized],
                |row| row.get::<_, i64>(0),
            )
            .optional()?;
        let id = match id {
            Some(id) => {
                transaction.execute(
                    "UPDATE domains SET description = ?1, updated_at = ?2 WHERE id = ?3",
                    params![domain.description, now_value, id],
                )?;
                id
            }
            None => {
                transaction.execute(
                    "INSERT INTO domains(public_id, name, normalized_name, description, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                    params![format!("domain-{}", Uuid::new_v4()), domain.name, normalized, domain.description, now_value],
                )?;
                created_domains += 1;
                transaction.last_insert_rowid()
            }
        };
        domain_ids.insert(domain.key.clone(), id);
    }
    let mut topic_ids = std::collections::HashMap::new();
    let mut created_topics = 0_i64;
    for topic in revision
        .topics
        .iter()
        .filter(|item| item.parent_key.is_none())
    {
        let domain_id = *domain_ids
            .get(&topic.domain_key)
            .ok_or_else(|| AppError::Conflict("AI 主题缺少有效领域".to_string()))?;
        let normalized = normalized_name(&topic.name);
        let id = transaction.query_row(
            "SELECT id FROM topics WHERE domain_id = ?1 AND parent_topic_id IS NULL AND normalized_name = ?2",
            params![domain_id, normalized],
            |row| row.get::<_, i64>(0),
        ).optional()?;
        let id = upsert_revision_topic(
            &transaction,
            id,
            domain_id,
            None,
            topic,
            &now_value,
            &mut created_topics,
        )?;
        topic_ids.insert(topic.key.clone(), id);
    }
    for topic in revision
        .topics
        .iter()
        .filter(|item| item.parent_key.is_some())
    {
        let domain_id = *domain_ids
            .get(&topic.domain_key)
            .ok_or_else(|| AppError::Conflict("AI 子主题缺少有效领域".to_string()))?;
        let parent_id = topic
            .parent_key
            .as_ref()
            .and_then(|key| topic_ids.get(key))
            .copied()
            .ok_or_else(|| AppError::Conflict("AI 子主题缺少有效父主题".to_string()))?;
        let normalized = normalized_name(&topic.name);
        let id = transaction.query_row(
            "SELECT id FROM topics WHERE domain_id = ?1 AND parent_topic_id = ?2 AND normalized_name = ?3",
            params![domain_id, parent_id, normalized],
            |row| row.get::<_, i64>(0),
        ).optional()?;
        let id = upsert_revision_topic(
            &transaction,
            id,
            domain_id,
            Some(parent_id),
            topic,
            &now_value,
            &mut created_topics,
        )?;
        topic_ids.insert(topic.key.clone(), id);
    }
    let generated_topic_ids = topic_ids
        .values()
        .copied()
        .collect::<std::collections::HashSet<_>>();
    let existing_topic_ids = {
        let mut statement =
            transaction.prepare("SELECT id FROM topics WHERE status <> 'merged'")?;
        let rows = statement.query_map([], |row| row.get::<_, i64>(0))?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    for topic_id in existing_topic_ids
        .into_iter()
        .filter(|id| !generated_topic_ids.contains(id))
    {
        // AI 分类替代没有人工锁定或正式知识对象的旧空主题；带人工成果的主题继续保留，
        // 避免一次全库重组覆盖已经确认的判断、证据、笔记或决策。
        transaction.execute(
            "UPDATE topics SET status = 'archived', updated_at = ?1
             WHERE id = ?2 AND manual_locked = 0
               AND NOT EXISTS(SELECT 1 FROM judgment_snapshots WHERE topic_id = ?2)
               AND NOT EXISTS(SELECT 1 FROM evidence WHERE topic_id = ?2)
               AND NOT EXISTS(SELECT 1 FROM propositions WHERE topic_id = ?2)
               AND NOT EXISTS(SELECT 1 FROM decisions WHERE topic_id = ?2)
               AND NOT EXISTS(SELECT 1 FROM note_topics WHERE topic_id = ?2)",
            params![now_value, topic_id],
        )?;
    }
    let source_ids = revision
        .assignments
        .iter()
        .map(|item| item.source_item_id)
        .collect::<Vec<_>>();
    for source_id in &source_ids {
        transaction.execute(
            "DELETE FROM source_topics WHERE source_item_id = ?1 AND role = 'primary'",
            [source_id],
        )?;
    }
    for assignment in &revision.assignments {
        let topic_id = *topic_ids
            .get(&assignment.topic_key)
            .ok_or_else(|| AppError::Conflict("AI 笔记归属缺少有效主题".to_string()))?;
        transaction.execute(
            "INSERT INTO source_topics(source_item_id, topic_id, role, confidence, created_at)
             VALUES (?1, ?2, 'primary', ?3, ?4)",
            params![
                assignment.source_item_id,
                topic_id,
                assignment.confidence,
                now_value
            ],
        )?;
        let updated = transaction.execute(
            "UPDATE source_items
             SET organization_state = 'organized'
             WHERE id = ?1
               AND EXISTS(SELECT 1 FROM visible_source_items WHERE id = ?1)",
            [assignment.source_item_id],
        )?;
        if updated != 1 {
            return Err(AppError::Conflict(
                "AI 分类应用期间有笔记被删除或归档；本次修改已取消".to_string(),
            ));
        }
    }
    transaction.execute(
        "UPDATE ai_taxonomy_revisions SET status = 'superseded'
         WHERE status = 'applied' AND public_id <> ?1",
        [public_id],
    )?;
    transaction.execute(
        "UPDATE ai_taxonomy_revisions
         SET status = 'applied', before_snapshot_json = ?1, applied_at = ?2
         WHERE public_id = ?3",
        params![before_snapshot.to_string(), now_value, public_id],
    )?;
    transaction.commit()?;
    Ok(AiTaxonomyApplyResult {
        revision_public_id: public_id.to_string(),
        created_domains,
        created_topics,
        assigned_sources: revision.assignments.len() as i64,
        uncertain_sources: revision.uncertain_source_count,
    })
}

fn upsert_revision_topic(
    transaction: &rusqlite::Transaction<'_>,
    existing_id: Option<i64>,
    domain_id: i64,
    parent_topic_id: Option<i64>,
    topic: &AiTaxonomyTopicProposal,
    timestamp: &str,
    created_topics: &mut i64,
) -> AppResult<i64> {
    if let Some(id) = existing_id {
        transaction.execute(
            "UPDATE topics SET name = ?1, description = ?2, status = 'active', updated_at = ?3 WHERE id = ?4",
            params![topic.name, topic.description, timestamp, id],
        )?;
        return Ok(id);
    }
    transaction.execute(
        "INSERT INTO topics(
           public_id, domain_id, parent_topic_id, name, normalized_name,
           description, topic_kind, depth, status, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'subject', ?7, 'active', ?8, ?8)",
        params![
            format!("topic-{}", Uuid::new_v4()),
            domain_id,
            parent_topic_id,
            topic.name,
            normalized_name(&topic.name),
            topic.description,
            if parent_topic_id.is_some() { 2 } else { 1 },
            timestamp,
        ],
    )?;
    *created_topics += 1;
    Ok(transaction.last_insert_rowid())
}

pub fn undo_taxonomy_revision(connection: &Connection, public_id: &str) -> AppResult<()> {
    let (status, snapshot_json): (String, String) = connection
        .query_row(
            "SELECT status, before_snapshot_json FROM ai_taxonomy_revisions WHERE public_id = ?1",
            [public_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| AppError::NotFound("AI 分类修订不存在".to_string()))?;
    if status != "applied" {
        return Err(AppError::Conflict(
            "只有当前已应用的 AI 分类修订可以撤销".to_string(),
        ));
    }
    let snapshot: serde_json::Value = serde_json::from_str(&snapshot_json)?;
    let transaction = connection.unchecked_transaction()?;
    for assignment in get_taxonomy_revision(connection, public_id)?
        .into_iter()
        .flat_map(|item| item.assignments)
    {
        if !is_taxonomy_source_visible(&transaction, assignment.source_item_id)? {
            continue;
        }
        transaction.execute(
            "DELETE FROM source_topics WHERE source_item_id = ?1 AND role = 'primary'",
            [assignment.source_item_id],
        )?;
        transaction.execute(
            "UPDATE source_items SET organization_state = 'inbox' WHERE id = ?1",
            [assignment.source_item_id],
        )?;
    }
    if let Some(links) = snapshot
        .get("primaryLinks")
        .and_then(serde_json::Value::as_array)
    {
        for link in links {
            let source_id = link.get("sourceItemId").and_then(serde_json::Value::as_i64);
            let Some(source_id) = source_id else {
                continue;
            };
            if !is_taxonomy_source_visible(&transaction, source_id)? {
                continue;
            }
            transaction.execute(
                "INSERT OR REPLACE INTO source_topics(source_item_id, topic_id, role, confidence, created_at)
                 VALUES (?1, ?2, 'primary', ?3, ?4)",
                params![
                    source_id,
                    link.get("topicId").and_then(serde_json::Value::as_i64),
                    link.get("confidence").and_then(serde_json::Value::as_f64),
                    now(),
                ],
            )?;
            transaction.execute(
                "UPDATE source_items SET organization_state = 'organized' WHERE id = ?1",
                [source_id],
            )?;
        }
    }
    if let Some(statuses) = snapshot
        .get("topicStatuses")
        .and_then(serde_json::Value::as_array)
    {
        for item in statuses {
            if let (Some(topic_id), Some(topic_status)) = (
                item.get("topicId").and_then(serde_json::Value::as_i64),
                item.get("status").and_then(serde_json::Value::as_str),
            ) {
                transaction.execute(
                    "UPDATE topics SET status = ?1 WHERE id = ?2",
                    params![topic_status, topic_id],
                )?;
            }
        }
    }
    transaction.execute(
        "UPDATE ai_taxonomy_revisions SET status = 'undone', undone_at = ?1 WHERE public_id = ?2",
        params![now(), public_id],
    )?;
    transaction.commit()?;
    Ok(())
}

fn is_taxonomy_source_visible(connection: &Connection, source_item_id: i64) -> AppResult<bool> {
    Ok(connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM visible_source_items WHERE id = ?1)",
        [source_item_id],
        |row| row.get::<_, i64>(0),
    )? != 0)
}

#[cfg(test)]
mod tests {
    use super::automatic_channel_priority;
    use crate::ai::models::{
        AiProviderChannel, AiSourceMaterial, AiSourceProfile, AiTaskUsage,
        AiTaxonomyAssignmentProposal, AiTaxonomyDomainProposal, AiTaxonomyStructure,
        AiTaxonomyTopicProposal, AiTopicInsightPayload,
    };
    use crate::database::open_memory_database;

    #[test]
    fn automatic_route_prioritizes_qwen_then_deepseek_then_openrouter() {
        assert_eq!(
            automatic_channel_priority(),
            [
                AiProviderChannel::QwenDirect,
                AiProviderChannel::DeepseekDirect,
                AiProviderChannel::Openrouter,
            ]
        );
    }

    #[test]
    fn ai_migration_creates_required_tables() {
        let connection = open_memory_database().expect("memory database");
        for table in [
            "ai_settings",
            "ai_provider_settings",
            "ai_task_runs",
            "ai_topic_insights",
            "ai_topic_insight_versions",
            "ai_source_profiles",
            "ai_source_profile_versions",
            "ai_taxonomy_revisions",
            "ai_taxonomy_revision_assignments",
            "ai_taxonomy_run_checkpoints",
            "ai_task_model_steps",
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
    fn task_model_step_persists_prompt_cache_evidence_without_prompt_content() {
        let connection = open_memory_database().expect("memory database");
        connection
            .execute(
                "INSERT INTO ai_task_runs(
                   public_id, task_kind, provider_channel, model_id, status, started_at
                 ) VALUES ('task-cache-1', 'taxonomy_revision', 'qwen_direct',
                           'qwen3.7-flash', 'running', '2026-08-13T00:00:00Z')",
                [],
            )
            .expect("insert task");
        let usage = AiTaskUsage {
            prompt_tokens: 2_000,
            completion_tokens: 200,
            reasoning_tokens: 50,
            cached_tokens: 900,
            cache_miss_tokens: 800,
            cache_write_tokens: 300,
            total_tokens: 2_200,
            cost_usd: Some(0.01),
            cost_kind: "estimated".to_string(),
            pricing_snapshot_json: "{\"source\":\"test\"}".to_string(),
            cache_mode: "explicit".to_string(),
            stable_prefix_hash: "stable-hash".to_string(),
            cache_key_hash: "cache-key-hash".to_string(),
            prompt_contract_version: "nfkb-prompt-cache-v1".to_string(),
            duration_ms: Some(1234),
            cache_discount_usd: Some(0.02),
            cache_savings_usd: Some(0.02),
        };
        super::record_task_model_step(
            &connection,
            "task-cache-1",
            "assignments",
            AiProviderChannel::QwenDirect,
            "qwen3.7-flash",
            &usage,
        )
        .expect("record cache step");
        let stored: (i64, i64, i64, String, String, Option<i64>) = connection
            .query_row(
                "SELECT cached_tokens, cache_miss_tokens, cache_write_tokens,
                        cache_mode, cache_key_hash, duration_ms
                 FROM ai_task_model_steps WHERE task_public_id = 'task-cache-1'",
                [],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                    ))
                },
            )
            .expect("read cache step");
        assert_eq!(
            stored,
            (
                900,
                800,
                300,
                "explicit".to_string(),
                "cache-key-hash".to_string(),
                Some(1234)
            )
        );
    }

    #[test]
    fn usage_summary_distinguishes_unknown_cost_and_legacy_cache_savings() {
        let connection = open_memory_database().expect("memory database");
        connection
            .execute(
                "INSERT INTO ai_task_runs(
               public_id, task_kind, provider_channel, model_id, status,
               prompt_tokens, cached_tokens, total_tokens, cost_usd,
               execution_contract_version, started_at, completed_at
             ) VALUES ('legacy-cost-task', 'topic_insight', 'qwen_direct', 'qwen3.7-plus',
                       'succeeded', 2000, 900, 2200, NULL, 'legacy',
                       '2026-08-13', '2026-08-13')",
                [],
            )
            .expect("legacy usage task");

        let settings = super::get_settings(&connection).expect("settings usage summary");
        assert_eq!(settings.usage.task_count, 1);
        assert_eq!(settings.usage.known_cost_task_count, 0);
        assert_eq!(settings.usage.unknown_cost_task_count, 1);
        assert_eq!(settings.usage.known_cost_usd, 0.0);
        assert_eq!(settings.usage.known_cache_savings_record_count, 0);
        assert_eq!(settings.usage.unknown_cache_savings_record_count, 1);
        assert_eq!(settings.usage.known_cache_savings_usd, 0.0);
    }

    #[test]
    fn call_history_unifies_stage_ledger_and_legacy_task_without_sensitive_content() {
        let connection = open_memory_database().expect("memory database");
        connection
            .execute(
                "INSERT INTO ai_task_runs(
                   public_id, task_kind, provider_channel, model_id, status,
                   prompt_tokens, completion_tokens, total_tokens, started_at, completed_at
                 ) VALUES ('stage-task', 'taxonomy_revision', 'qwen_direct', 'qwen3.7-flash',
                           'succeeded', 100, 20, 120, '2026-08-13T00:00:00Z', '2026-08-13T00:01:00Z')",
                [],
            )
            .expect("insert stage task");
        super::record_task_model_step(
            &connection,
            "stage-task",
            "assignments",
            AiProviderChannel::QwenDirect,
            "qwen3.7-flash",
            &AiTaskUsage {
                prompt_tokens: 100,
                completion_tokens: 20,
                cached_tokens: 60,
                total_tokens: 120,
                ..AiTaskUsage::default()
            },
        )
        .expect("record stage");
        connection
            .execute(
                "INSERT INTO ai_task_runs(
                   public_id, task_kind, provider_channel, model_id, status, error_message,
                   started_at, completed_at
                 ) VALUES ('legacy-failure', 'topic_insight', 'deepseek_direct', 'deepseek-v4-pro',
                           'failed', '连接超时', '2026-08-12T00:00:00Z', '2026-08-12T00:01:00Z')",
                [],
            )
            .expect("insert legacy task");

        let history = super::list_call_history(&connection, 50).expect("call history");
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].task_public_id, "stage-task");
        assert_eq!(history[0].stage.as_deref(), Some("assignments"));
        assert_eq!(history[0].status, "succeeded");
        assert_eq!(history[0].cached_tokens, 60);
        let legacy = history
            .iter()
            .find(|entry| entry.task_public_id == "legacy-failure")
            .expect("legacy row");
        assert_eq!(legacy.stage, None);
        assert_eq!(legacy.status, "failed");
        assert_eq!(legacy.error_message.as_deref(), Some("连接超时"));
    }

    #[test]
    fn taxonomy_checkpoint_persists_progress_usage_and_resume_choice() {
        let connection = open_memory_database().expect("memory database");
        let materials = vec![
            AiSourceMaterial {
                source_item_id: 1,
                title: "第一篇".to_string(),
                content: "正文一".to_string(),
                content_sha256: Some("hash-one".to_string()),
            },
            AiSourceMaterial {
                source_item_id: 2,
                title: "第二篇".to_string(),
                content: "正文二".to_string(),
                content_sha256: Some("hash-two".to_string()),
            },
        ];
        let task_id = super::begin_taxonomy_revision_task(
            &connection,
            AiProviderChannel::Openrouter,
            "openai/test",
            "openai/test-profile",
            &materials,
        )
        .expect("begin checkpointed taxonomy");
        let mut checkpoint = super::load_taxonomy_checkpoint(&connection, &task_id)
            .expect("load checkpoint")
            .expect("checkpoint");
        checkpoint.profiles.push(AiSourceProfile {
            source_item_id: 1,
            summary: "第一篇语义档案".to_string(),
            concepts: vec!["概念".to_string()],
            candidate_topics: vec!["主题".to_string()],
        });
        checkpoint.profile_offset = 1;
        checkpoint.stage = "profiles".to_string();
        checkpoint.usage.total_tokens = 321;
        checkpoint.usage.prompt_tokens = 250;
        super::interrupt_taxonomy_task(&connection, &checkpoint, "模拟网络中断")
            .expect("save interrupted checkpoint");

        let resume = super::get_resumable_taxonomy_run(&connection)
            .expect("read resumable run")
            .expect("resumable run");
        assert_eq!(resume.task_public_id, task_id);
        assert_eq!(resume.profiled_source_count, 1);
        assert_eq!(resume.source_count, 2);
        assert_eq!(resume.total_tokens, 321);
        assert_eq!(resume.last_error.as_deref(), Some("模拟网络中断"));
        let loaded = super::load_taxonomy_checkpoint(&connection, &task_id)
            .expect("reload checkpoint")
            .expect("checkpoint remains");
        assert_eq!(loaded.profile_model_id, "openai/test-profile");
        assert!(super::checkpoint_matches_execution_contract(&loaded));
        assert!(super::checkpoint_matches_materials(&loaded, &materials).expect("same materials"));
        let mut changed_materials = materials.clone();
        changed_materials[0].content_sha256 = Some("changed".to_string());
        assert!(
            !super::checkpoint_matches_materials(&loaded, &changed_materials)
                .expect("changed materials")
        );

        super::discard_taxonomy_checkpoint(&connection, &task_id).expect("discard checkpoint");
        assert!(super::get_resumable_taxonomy_run(&connection)
            .expect("read after discard")
            .is_none());
    }

    #[test]
    fn legacy_execution_contract_cannot_resume_or_reuse_current_results() {
        let connection = open_memory_database().expect("memory database");
        connection
            .execute(
                "INSERT INTO domains(public_id, name, normalized_name, created_at, updated_at)
             VALUES ('domain-contract', '契约领域', '契约领域', '2026-08-13', '2026-08-13')",
                [],
            )
            .expect("domain");
        connection.execute(
            "INSERT INTO topics(public_id, domain_id, name, normalized_name, created_at, updated_at)
             VALUES ('topic-contract', 1, '契约主题', '契约主题', '2026-08-13', '2026-08-13')",
            [],
        ).expect("topic");
        connection
            .execute(
                "INSERT INTO source_items(
               public_id, source_type, title, original_text, imported_at, organization_state
             ) VALUES ('source-contract', 'markdown', '契约笔记', '正文', '2026-08-13', 'inbox')",
                [],
            )
            .expect("source");
        let task_id = super::begin_topic_insight_task(
            &connection,
            1,
            AiProviderChannel::Openrouter,
            "openai/test",
        )
        .expect("begin insight");
        super::complete_topic_insight_task(
            &connection,
            &task_id,
            1,
            AiProviderChannel::Openrouter,
            "openai/test",
            "fingerprint",
            &AiTopicInsightPayload {
                summary_markdown: "契约结果".to_string(),
                key_insights: Vec::new(),
                evidence: Vec::new(),
                open_questions: Vec::new(),
                topic_management_suggestions: Vec::new(),
                hypotheses: Vec::new(),
                judgment_evolution: Vec::new(),
                decisions: Vec::new(),
            },
            &AiTaskUsage::default(),
        )
        .expect("complete insight");
        connection
            .execute(
                "UPDATE ai_topic_insight_versions
             SET execution_contract_version = 'legacy' WHERE task_public_id = ?1",
                [&task_id],
            )
            .expect("downgrade result contract");
        assert!(super::get_reusable_topic_insight(
            &connection,
            1,
            AiProviderChannel::Openrouter,
            "openai/test",
            "fingerprint",
        )
        .expect("reuse lookup")
        .is_none());

        let materials = vec![AiSourceMaterial {
            source_item_id: 1,
            title: "契约笔记".to_string(),
            content: "正文".to_string(),
            content_sha256: Some("contract-sha".to_string()),
        }];
        let profile = AiSourceProfile {
            source_item_id: 1,
            summary: "当前契约档案".to_string(),
            concepts: Vec::new(),
            candidate_topics: Vec::new(),
        };
        connection
            .execute(
                "INSERT INTO ai_source_profile_versions(
               source_item_id, provider_channel, model_id, content_sha256,
               execution_contract_version, task_public_id, profile_json, generated_at
             ) VALUES (1, 'openrouter', 'openai/test-profile', 'contract-sha',
                       'nfkb-ai-execution-v1', 'profile-task', ?1, '2026-08-13')",
                [serde_json::to_string(&profile).expect("profile json")],
            )
            .expect("profile version");
        assert_eq!(
            super::load_model_source_profiles(
                &connection,
                AiProviderChannel::Openrouter,
                "openai/test-profile",
                &materials,
            )
            .expect("current profile reuse")
            .len(),
            1
        );
        connection
            .execute(
                "UPDATE ai_source_profile_versions SET execution_contract_version = 'legacy'",
                [],
            )
            .expect("downgrade profile contract");
        assert!(super::load_model_source_profiles(
            &connection,
            AiProviderChannel::Openrouter,
            "openai/test-profile",
            &materials,
        )
        .is_err());
        let taxonomy_task = super::begin_taxonomy_revision_task(
            &connection,
            AiProviderChannel::Openrouter,
            "openai/test",
            "openai/test-profile",
            &materials,
        )
        .expect("begin taxonomy");
        connection
            .execute(
                "UPDATE ai_taxonomy_run_checkpoints
             SET execution_contract_version = 'legacy' WHERE task_public_id = ?1",
                [&taxonomy_task],
            )
            .expect("downgrade checkpoint contract");
        let checkpoint = super::load_taxonomy_checkpoint(&connection, &taxonomy_task)
            .expect("load checkpoint")
            .expect("checkpoint");
        assert!(!super::checkpoint_matches_execution_contract(&checkpoint));
    }

    #[test]
    fn startup_recovery_interrupts_stale_tasks_and_preserves_checkpoint() {
        let connection = open_memory_database().expect("memory database");
        let materials = vec![AiSourceMaterial {
            source_item_id: 1,
            title: "恢复测试".to_string(),
            content: "正文".to_string(),
            content_sha256: Some("recovery-sha".to_string()),
        }];
        let taxonomy_task = super::begin_taxonomy_revision_task(
            &connection,
            AiProviderChannel::Openrouter,
            "openai/test",
            "openai/test",
            &materials,
        )
        .expect("taxonomy task");
        connection
            .execute(
                "INSERT INTO ai_task_runs(
               public_id, task_kind, provider_channel, model_id, status,
               execution_contract_version, started_at
             ) VALUES ('stale-topic-task', 'topic_insight', 'openrouter', 'openai/test',
                       'running', 'nfkb-ai-execution-v1', '2026-08-13')",
                [],
            )
            .expect("stale topic task");

        assert_eq!(
            super::recover_stale_ai_tasks(&connection).expect("recover"),
            2
        );
        for task_id in [&taxonomy_task, "stale-topic-task"] {
            let (status, message): (String, Option<String>) = connection
                .query_row(
                    "SELECT status, error_message FROM ai_task_runs WHERE public_id = ?1",
                    [task_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .expect("recovered task");
            assert_eq!(status, "interrupted");
            assert!(message
                .as_deref()
                .unwrap_or_default()
                .contains("上次程序退出"));
        }
        assert!(super::load_taxonomy_checkpoint(&connection, &taxonomy_task)
            .expect("checkpoint query")
            .is_some());
        assert_eq!(
            super::recover_stale_ai_tasks(&connection).expect("idempotent recover"),
            0
        );
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
            hypotheses: Vec::new(),
            judgment_evolution: Vec::new(),
            decisions: Vec::new(),
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
            "context-sha-v1",
            &insight,
            &usage,
        )
        .expect("complete task");
        assert_eq!(saved.payload.summary_markdown, "派生总结");
        assert_eq!(saved.input_fingerprint, "context-sha-v1");
        let reusable = super::get_reusable_topic_insight(
            &connection,
            1,
            AiProviderChannel::Openrouter,
            "openai/test",
            "context-sha-v1",
        )
        .expect("query reusable insight")
        .expect("saved insight");
        assert_eq!(reusable.task_public_id, task_id);
        let second_task = super::begin_topic_insight_task(
            &connection,
            1,
            AiProviderChannel::DeepseekDirect,
            "deepseek-chat",
        )
        .expect("begin second model task");
        super::complete_topic_insight_task(
            &connection,
            &second_task,
            1,
            AiProviderChannel::DeepseekDirect,
            "deepseek-chat",
            "context-sha-v1",
            &AiTopicInsightPayload {
                summary_markdown: "另一个模型的派生总结".to_string(),
                ..insight.clone()
            },
            &usage,
        )
        .expect("complete second model task");
        let first_model = super::get_topic_insight_for_model(
            &connection,
            1,
            AiProviderChannel::Openrouter,
            "openai/test",
        )
        .expect("read first model")
        .expect("first model insight");
        assert_eq!(first_model.payload.summary_markdown, "派生总结");
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

    #[test]
    fn taxonomy_revision_requires_ai_integration_and_bound_sources() {
        let assignments = vec![AiTaxonomyAssignmentProposal {
            source_item_id: 1,
            topic_key: "new-topic".to_string(),
            confidence: 76.0,
            reason: "正文属于新主题边界".to_string(),
            uncertain: false,
        }];
        let taxonomy = AiTaxonomyStructure {
            domains: Vec::new(),
            topics: vec![AiTaxonomyTopicProposal {
                key: "new-topic".to_string(),
                domain_key: "new-domain".to_string(),
                parent_key: None,
                name: "新主题".to_string(),
                description: "AI 主题边界".to_string(),
                integration_markdown: String::new(),
                source_item_ids: Vec::new(),
            }],
        };

        let error = super::validate_revision_integrations(&taxonomy, &assignments)
            .expect_err("missing integration must fail");
        assert!(error.to_string().contains("AI 主题整合为空"));

        let invalid_sources = AiTaxonomyStructure {
            domains: Vec::new(),
            topics: vec![AiTaxonomyTopicProposal {
                integration_markdown: "AI 生成的主题整合".to_string(),
                source_item_ids: vec![999],
                ..taxonomy.topics[0].clone()
            }],
        };
        let error = super::validate_revision_integrations(&invalid_sources, &assignments)
            .expect_err("foreign source must fail");
        assert!(error.to_string().contains("未完整绑定当前主题的全部笔记"));
    }

    #[test]
    fn incremental_taxonomy_only_queues_new_material_for_the_same_model() {
        let connection = open_memory_database().expect("memory database");
        connection.execute(
            "INSERT INTO source_items(public_id, source_type, title, original_text, imported_at, organization_state)
             VALUES ('source-one', 'markdown', '旧笔记', '旧正文', '2026-08-10', 'organized')",
            [],
        ).expect("source");
        let baseline_materials = vec![AiSourceMaterial {
            source_item_id: 1,
            title: "旧笔记".to_string(),
            content: "旧正文".to_string(),
            content_sha256: Some("old-sha".to_string()),
        }];
        let task_id = super::begin_taxonomy_revision_task(
            &connection,
            AiProviderChannel::Openrouter,
            "openai/test",
            "openai/test",
            &baseline_materials,
        )
        .expect("begin full task");
        let profile = AiSourceProfile {
            source_item_id: 1,
            summary: "旧笔记档案".to_string(),
            concepts: vec!["旧概念".to_string()],
            candidate_topics: vec!["稳定主题".to_string()],
        };
        let taxonomy = AiTaxonomyStructure {
            domains: vec![AiTaxonomyDomainProposal {
                key: "domain".to_string(),
                name: "领域".to_string(),
                description: "边界".to_string(),
            }],
            topics: vec![AiTaxonomyTopicProposal {
                key: "topic".to_string(),
                domain_key: "domain".to_string(),
                parent_key: None,
                name: "稳定主题".to_string(),
                description: "边界".to_string(),
                integration_markdown: "旧主题整合".to_string(),
                source_item_ids: vec![1],
            }],
        };
        let assignments = vec![AiTaxonomyAssignmentProposal {
            source_item_id: 1,
            topic_key: "topic".to_string(),
            confidence: 90.0,
            reason: "旧笔记归属".to_string(),
            uncertain: false,
        }];
        super::complete_taxonomy_revision_task(
            &connection,
            &task_id,
            AiProviderChannel::Openrouter,
            "openai/test",
            "openai/test",
            &baseline_materials,
            &[profile],
            &taxonomy,
            &assignments,
            &AiTaskUsage::default(),
        )
        .expect("complete full task");
        let current_materials = vec![
            baseline_materials[0].clone(),
            AiSourceMaterial {
                source_item_id: 2,
                title: "新笔记".to_string(),
                content: "新正文".to_string(),
                content_sha256: Some("new-sha".to_string()),
            },
        ];
        let (_incremental_task, queued) = super::begin_incremental_taxonomy_revision_task(
            &connection,
            AiProviderChannel::Openrouter,
            "openai/test",
            "openai/test",
            &current_materials,
        )
        .expect("begin incremental task");
        assert_eq!(queued.len(), 1);
        assert_eq!(queued[0].source_item_id, 2);
        let checkpoint = super::load_taxonomy_checkpoint(&connection, &_incremental_task)
            .expect("load checkpoint")
            .expect("checkpoint");
        assert_eq!(checkpoint.run_mode, "incremental");
        assert_eq!(checkpoint.base_assignment_count, 1);
        assert_eq!(checkpoint.assignments[0].source_item_id, 1);
    }

    #[test]
    fn taxonomy_revision_is_previewed_applied_and_undone_as_one_transaction() {
        let connection = open_memory_database().expect("memory database");
        connection
            .execute(
                "INSERT INTO domains(public_id, name, normalized_name, created_at, updated_at)
             VALUES ('domain-old', '旧领域', '旧领域', '2026-08-10', '2026-08-10')",
                [],
            )
            .expect("old domain");
        connection.execute(
            "INSERT INTO topics(public_id, domain_id, name, normalized_name, created_at, updated_at)
             VALUES ('topic-old', 1, '旧主题', '旧主题', '2026-08-10', '2026-08-10')",
            [],
        ).expect("old topic");
        connection.execute(
            "INSERT INTO source_items(
               public_id, source_type, title, original_text, imported_at, organization_state
             ) VALUES ('source-one', 'markdown', '测试笔记', '测试正文', '2026-08-10', 'organized')",
            [],
        ).expect("source");
        connection
            .execute(
                "INSERT INTO source_topics(source_item_id, topic_id, role, confidence, created_at)
             VALUES (1, 1, 'primary', 88, '2026-08-10')",
                [],
            )
            .expect("old assignment");
        let materials = vec![AiSourceMaterial {
            source_item_id: 1,
            title: "测试笔记".to_string(),
            content: "测试正文".to_string(),
            content_sha256: None,
        }];
        let task_id = super::begin_taxonomy_revision_task(
            &connection,
            AiProviderChannel::Openrouter,
            "openai/test",
            "openai/test",
            &materials,
        )
        .expect("begin taxonomy");
        let profiles = vec![AiSourceProfile {
            source_item_id: 1,
            summary: "笔记在讨论新的稳定主题".to_string(),
            concepts: vec!["测试".to_string()],
            candidate_topics: vec!["新主题".to_string()],
        }];
        let taxonomy = AiTaxonomyStructure {
            domains: vec![AiTaxonomyDomainProposal {
                key: "new-domain".to_string(),
                name: "新领域".to_string(),
                description: "AI 领域边界".to_string(),
            }],
            topics: vec![AiTaxonomyTopicProposal {
                key: "new-topic".to_string(),
                domain_key: "new-domain".to_string(),
                parent_key: None,
                name: "新主题".to_string(),
                description: "AI 主题边界".to_string(),
                integration_markdown: "AI 汇总后的主题整合内容。".to_string(),
                source_item_ids: vec![1],
            }],
        };
        let assignments = vec![AiTaxonomyAssignmentProposal {
            source_item_id: 1,
            topic_key: "new-topic".to_string(),
            confidence: 76.0,
            reason: "正文属于新主题边界".to_string(),
            uncertain: false,
        }];
        let revision = super::complete_taxonomy_revision_task(
            &connection,
            &task_id,
            AiProviderChannel::Openrouter,
            "openai/test",
            "openai/test",
            &materials,
            &profiles,
            &taxonomy,
            &assignments,
            &AiTaskUsage::default(),
        )
        .expect("complete taxonomy");
        assert_eq!(revision.status, "draft");
        assert_eq!(revision.assignments.len(), 1);
        assert_eq!(
            revision.topics[0].integration_markdown,
            "AI 汇总后的主题整合内容。"
        );
        assert_eq!(revision.topics[0].source_item_ids, vec![1]);

        connection
            .execute(
                "UPDATE source_items SET status = 'archived' WHERE id = 1",
                [],
            )
            .expect("archive source while AI draft is awaiting review");
        let error = super::apply_taxonomy_revision(&connection, &revision.public_id)
            .expect_err("deleted source must block stale AI draft application");
        assert!(error.to_string().contains("已删除或已归档"));
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM domains WHERE public_id = 'domain-new'",
                    [],
                    |row| { row.get::<_, i64>(0) }
                )
                .expect("no stale AI domain was created"),
            0,
        );

        connection
            .execute("UPDATE source_items SET status = 'active' WHERE id = 1", [])
            .expect("restore source for the normal apply path");

        let applied = super::apply_taxonomy_revision(&connection, &revision.public_id)
            .expect("apply taxonomy");
        assert_eq!(applied.assigned_sources, 1);
        assert_eq!(
            super::get_applied_taxonomy_revision(&connection)
                .expect("read applied taxonomy")
                .expect("applied taxonomy")
                .public_id,
            revision.public_id,
        );
        let current_topic: String = connection.query_row(
            "SELECT topic.name FROM source_topics link JOIN topics topic ON topic.id = link.topic_id
             WHERE link.source_item_id = 1 AND link.role = 'primary'",
            [],
            |row| row.get(0),
        ).expect("applied topic");
        assert_eq!(current_topic, "新主题");

        super::undo_taxonomy_revision(&connection, &revision.public_id).expect("undo taxonomy");
        let restored_topic: String = connection.query_row(
            "SELECT topic.name FROM source_topics link JOIN topics topic ON topic.id = link.topic_id
             WHERE link.source_item_id = 1 AND link.role = 'primary'",
            [],
            |row| row.get(0),
        ).expect("restored topic");
        assert_eq!(restored_topic, "旧主题");
        assert_eq!(
            super::get_taxonomy_revision(&connection, &revision.public_id)
                .expect("read revision")
                .expect("revision")
                .status,
            "undone",
        );
        assert!(super::get_applied_taxonomy_revision(&connection)
            .expect("read applied taxonomy after undo")
            .is_none());
    }
}
