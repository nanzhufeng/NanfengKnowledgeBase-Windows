use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::time::Duration;

use nanfeng_knowledge_base_lib::maintenance;
use rusqlite::{Connection, OpenFlags};
use serde_json::json;

const FORMAL_ROOT: &str = r"D:\南枫知识库";

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let arguments = std::env::args().skip(1).collect::<Vec<_>>();
    let root = PathBuf::from(FORMAL_ROOT);
    let database_path = root.join("data").join("app.db");
    validate_formal_database(&database_path)?;
    if arguments.iter().any(|argument| argument == "--preflight") {
        return preflight(&database_path);
    }
    if arguments
        .iter()
        .any(|argument| argument == "--backup-and-migrate-v14")
    {
        let report = maintenance::migrate_formal_prompt_cache_v14(
            &root,
            "AUTHORIZE_FORMAL_PROMPT_CACHE_MIGRATION_V14_20260813",
        )
        .map_err(|error| error.to_string())?;
        println!(
            "{}",
            serde_json::to_string(&report).map_err(|error| error.to_string())?
        );
        return Ok(());
    }
    if arguments
        .iter()
        .any(|argument| argument == "--backup-and-migrate-v15")
    {
        let report = maintenance::migrate_formal_ai_execution_contract_v15(
            &root,
            "AUTHORIZE_FORMAL_AI_EXECUTION_CONTRACT_MIGRATION_V15_20260813",
        )
        .map_err(|error| error.to_string())?;
        println!(
            "{}",
            serde_json::to_string(&report).map_err(|error| error.to_string())?
        );
        return Ok(());
    }
    if arguments
        .iter()
        .any(|argument| argument == "--execute-business-acceptance")
    {
        let report = maintenance::run_formal_prompt_cache_business_acceptance(
            &root,
            "AUTHORIZE_FORMAL_PROMPT_CACHE_BUSINESS_ACCEPTANCE_20260813",
        )
        .map_err(|error| error.to_string())?;
        println!(
            "{}",
            serde_json::to_string(&report).map_err(|error| error.to_string())?
        );
        return Ok(());
    }
    if arguments
        .iter()
        .any(|argument| argument == "--execute-qwen-reasoning-ab")
    {
        let report = maintenance::run_formal_qwen_reasoning_ab_acceptance(
            &root,
            "AUTHORIZE_FORMAL_QWEN_REASONING_AB_ACCEPTANCE_20260813",
        )
        .map_err(|error| error.to_string())?;
        println!(
            "{}",
            serde_json::to_string(&report).map_err(|error| error.to_string())?
        );
        return Ok(());
    }
    if arguments
        .iter()
        .any(|argument| argument == "--execute-taxonomy-e2e")
    {
        let report = maintenance::run_formal_taxonomy_end_to_end_acceptance(
            &root,
            "AUTHORIZE_FORMAL_TAXONOMY_E2E_ACCEPTANCE_20260813",
        )
        .map_err(|error| error.to_string())?;
        println!(
            "{}",
            serde_json::to_string(&report).map_err(|error| error.to_string())?
        );
        return Ok(());
    }
    Err(
        "未指定安全模式；可用 --preflight、--backup-and-migrate-v14、--backup-and-migrate-v15、--execute-business-acceptance、--execute-qwen-reasoning-ab 或 --execute-taxonomy-e2e"
            .to_string(),
    )
}

fn validate_formal_database(database_path: &Path) -> Result<(), String> {
    if !database_path.is_file() {
        return Err(format!("正式数据库不存在：{}", database_path.display()));
    }
    let actual = database_path
        .canonicalize()
        .map_err(|error| format!("无法解析正式数据库路径：{error}"))?;
    let expected = PathBuf::from(FORMAL_ROOT)
        .join("data")
        .join("app.db")
        .canonicalize()
        .map_err(|error| format!("无法解析预期正式数据库路径：{error}"))?;
    if actual != expected {
        return Err(format!("数据库路径不匹配，已停止：{}", actual.display()));
    }
    Ok(())
}

fn read_only_connection(database_path: &Path) -> Result<Connection, String> {
    let connection = Connection::open_with_flags(
        database_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|error| format!("只读打开正式数据库失败：{error}"))?;
    connection
        .busy_timeout(Duration::from_secs(5))
        .map_err(|error| format!("设置只读超时失败：{error}"))?;
    connection
        .execute_batch("PRAGMA query_only = ON; PRAGMA foreign_keys = ON;")
        .map_err(|error| format!("设置只读连接失败：{error}"))?;
    Ok(connection)
}

fn preflight(database_path: &Path) -> Result<(), String> {
    let _instance_guard = TcpListener::bind("127.0.0.1:47633")
        .map_err(|error| format!("南枫知识库可能正在运行，已停止只读预检：{error}"))?;
    let connection = read_only_connection(database_path)?;
    let quick_check: String = connection
        .query_row("PRAGMA quick_check", [], |row| row.get(0))
        .map_err(|error| format!("quick_check失败：{error}"))?;
    let foreign_key_errors = connection
        .prepare("PRAGMA foreign_key_check")
        .and_then(|mut statement| {
            let mut rows = statement.query([])?;
            let mut count = 0_i64;
            while rows.next()?.is_some() {
                count += 1;
            }
            Ok(count)
        })
        .map_err(|error| format!("foreign_key_check失败：{error}"))?;
    let migrations = connection
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .and_then(|mut statement| {
            statement
                .query_map([], |row| row.get::<_, i64>(0))?
                .collect::<Result<Vec<_>, _>>()
        })
        .map_err(|error| format!("读取migration版本失败：{error}"))?;
    let counts = safe_counts(&connection)?;
    let active = connection
        .query_row(
            "SELECT settings.active_channel,
                    COALESCE(provider.selected_model_id, '')
             FROM ai_settings settings
             LEFT JOIN ai_provider_settings provider
               ON provider.channel = settings.active_channel
             WHERE settings.singleton_id = 1",
            [],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(|error| format!("读取AI选择失败：{error}"))?;
    println!(
        "{}",
        json!({
            "mode": "preflight",
            "database": database_path.display().to_string(),
            "databaseBytes": database_path.metadata().map(|item| item.len()).unwrap_or(0),
            "walBytes": database_path.with_extension("db-wal").metadata().map(|item| item.len()).unwrap_or(0),
            "quickCheck": quick_check,
            "foreignKeyErrors": foreign_key_errors,
            "migrations": migrations,
            "counts": counts,
            "activeChannel": active.0,
            "selectedModel": active.1,
        })
    );
    Ok(())
}

fn safe_counts(connection: &Connection) -> Result<serde_json::Value, String> {
    let mut values = serde_json::Map::new();
    for (name, sql) in [
        ("records", "SELECT COUNT(*) FROM records"),
        ("sourceItems", "SELECT COUNT(*) FROM source_items"),
        (
            "visibleSources",
            "SELECT COUNT(*) FROM visible_source_items",
        ),
        ("topics", "SELECT COUNT(*) FROM topics"),
        ("aiTaskRuns", "SELECT COUNT(*) FROM ai_task_runs"),
        (
            "aiTaskModelSteps",
            "SELECT COUNT(*) FROM ai_task_model_steps",
        ),
        (
            "taxonomyRevisions",
            "SELECT COUNT(*) FROM ai_taxonomy_revisions",
        ),
        (
            "appliedTaxonomyRevisions",
            "SELECT COUNT(*) FROM ai_taxonomy_revisions WHERE status = 'applied'",
        ),
        (
            "profileVersions",
            "SELECT COUNT(*) FROM ai_source_profile_versions",
        ),
        (
            "runningAiTasks",
            "SELECT COUNT(*) FROM ai_task_runs WHERE status = 'running'",
        ),
        (
            "interruptedAiTasks",
            "SELECT COUNT(*) FROM ai_task_runs WHERE status = 'interrupted'",
        ),
        (
            "taxonomyE2eAcceptanceCompleted",
            "SELECT COUNT(*) FROM ai_task_runs
             WHERE task_kind = 'taxonomy_e2e_acceptance' AND status = 'completed'",
        ),
        (
            "currentExecutionContractTasks",
            "SELECT COUNT(*) FROM ai_task_runs
             WHERE execution_contract_version = 'nfkb-ai-execution-v1'",
        ),
        (
            "legacyExecutionContractTasks",
            "SELECT COUNT(*) FROM ai_task_runs
             WHERE execution_contract_version = 'legacy'",
        ),
    ] {
        let value: i64 = connection
            .query_row(sql, [], |row| row.get(0))
            .map_err(|error| format!("读取{name}计数失败：{error}"))?;
        values.insert(name.to_string(), value.into());
    }
    Ok(values.into())
}
