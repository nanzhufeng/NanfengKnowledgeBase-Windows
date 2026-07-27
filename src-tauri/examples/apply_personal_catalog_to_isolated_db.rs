use std::path::{Path, PathBuf};

use nanfeng_knowledge_base_lib::knowledge::{
    apply_personal_catalog, ApplyPersonalCatalogInput, PERSONAL_CATALOG_VERSION,
};
use rusqlite::{Connection, OpenFlags};
use serde_json::json;
use sha2::{Digest, Sha256};

fn main() {
    if let Err(error) = run() {
        eprintln!("隔离目录升级失败：{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let database = std::env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .ok_or("缺少隔离数据库绝对路径")?;
    if !database.is_absolute() || !database.is_file() {
        return Err("必须提供已存在的隔离数据库绝对路径".into());
    }
    let canonical = database.canonicalize()?;
    let normalized = canonical
        .to_string_lossy()
        .replace('\\', "/")
        .to_lowercase();
    if !normalized.contains("/.runtime-qa/") {
        return Err("只允许写入仓库 .runtime-qa 下的隔离数据库".into());
    }
    if normalized.starts_with("d:/南枫知识库/") || normalized.starts_with("d:/南枫情报台/")
    {
        return Err("拒绝写入正式数据目录".into());
    }

    let sha256_before = sha256_file(&canonical)?;
    let mut connection = Connection::open_with_flags(
        &canonical,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    let before_changes = connection.total_changes();
    let result = apply_personal_catalog(
        &mut connection,
        &ApplyPersonalCatalogInput {
            version: PERSONAL_CATALOG_VERSION.to_string(),
        },
    )?;
    let integrity =
        connection.query_row("PRAGMA integrity_check", [], |row| row.get::<_, String>(0))?;
    let foreign_key_violations =
        connection.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
            row.get::<_, i64>(0)
        })?;
    if integrity != "ok" || foreign_key_violations != 0 {
        return Err(format!(
            "升级后数据库校验失败：integrity={integrity}, foreign_keys={foreign_key_violations}"
        )
        .into());
    }
    let after_changes = connection.total_changes();
    drop(connection);

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "database": canonical,
            "sha256Before": sha256_before,
            "sha256After": sha256_file(&canonical)?,
            "totalChanges": after_changes.saturating_sub(before_changes),
            "catalogVersion": PERSONAL_CATALOG_VERSION,
            "result": result,
            "integrityCheck": integrity,
            "foreignKeyViolations": foreign_key_violations,
        }))?
    );
    Ok(())
}

fn sha256_file(path: &Path) -> Result<String, std::io::Error> {
    let bytes = std::fs::read(path)?;
    Ok(hex::encode_upper(Sha256::digest(bytes)))
}
