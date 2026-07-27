use std::fs::{File, OpenOptions};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};

use chrono::Utc;
use nanfeng_knowledge_base_lib::knowledge::prepare_classification_context;
use rusqlite::{Connection, OpenFlags};
use serde_json::json;
use sha2::{Digest, Sha256};

fn main() {
    if let Err(error) = run() {
        eprintln!("分类上下文导出失败：{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut arguments = std::env::args_os().skip(1);
    let source_database = arguments
        .next()
        .map(PathBuf::from)
        .ok_or("缺少隔离数据库绝对路径")?;
    let output_file = arguments
        .next()
        .map(PathBuf::from)
        .ok_or("缺少输出 JSON 绝对路径")?;
    if arguments.next().is_some() {
        return Err("参数过多；仅接受隔离数据库和输出 JSON".into());
    }
    if !source_database.is_absolute() || !output_file.is_absolute() {
        return Err("隔离数据库和输出 JSON 都必须使用绝对路径".into());
    }
    if !source_database.is_file() {
        return Err(format!("隔离数据库不存在：{}", source_database.display()).into());
    }
    if output_file.exists() {
        return Err(format!("为保护既有证据，输出文件已存在：{}", output_file.display()).into());
    }
    if let Some(parent) = output_file.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let sha256_before = sha256_file(&source_database)?;
    let connection = Connection::open_with_flags(
        &source_database,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    connection.execute_batch("PRAGMA query_only = ON;")?;
    let query_only = connection.query_row("PRAGMA query_only", [], |row| row.get::<_, i64>(0))?;
    if query_only != 1 {
        return Err("隔离数据库连接未进入 query_only".into());
    }
    let integrity =
        connection.query_row("PRAGMA integrity_check", [], |row| row.get::<_, String>(0))?;
    if integrity != "ok" {
        return Err(format!("隔离数据库完整性检查失败：{integrity}").into());
    }
    let total_changes_before = connection.total_changes();
    let source_ids = {
        let mut statement = connection.prepare(
            "SELECT id
             FROM source_items
             WHERE organization_state = 'inbox' AND status = 'active'
             ORDER BY id",
        )?;
        let collected = statement
            .query_map([], |row| row.get::<_, i64>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        collected
    };
    let source_count = source_ids.len();
    let Some(first_source_id) = source_ids.first().copied() else {
        return Err("隔离数据库没有待分类来源".into());
    };
    let first = prepare_classification_context(&connection, first_source_id)?;

    let output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&output_file)?;
    let mut writer = BufWriter::new(output);
    write!(
        writer,
        "{{\"reportVersion\":1,\"generatedAt\":{},\"sourceDatabase\":{},\
         \"sourceDatabaseSha256Before\":{},\"sourceConnectionQueryOnly\":true,\
         \"sourceIntegrityCheck\":\"ok\",\"sourceTotalChangesBefore\":{},\
         \"sourceCount\":{},\"topics\":{},\"rules\":{},\"records\":[",
        serde_json::to_string(&Utc::now().to_rfc3339())?,
        serde_json::to_string(&source_database.to_string_lossy())?,
        serde_json::to_string(&sha256_before)?,
        total_changes_before,
        source_count,
        serde_json::to_string(&first.topics)?,
        serde_json::to_string(&first.rules)?,
    )?;

    for (index, source_id) in source_ids.into_iter().enumerate() {
        let context = if source_id == first_source_id {
            first.clone()
        } else {
            prepare_classification_context(&connection, source_id)?
        };
        if index > 0 {
            writer.write_all(b",")?;
        }
        serde_json::to_writer(
            &mut writer,
            &json!({
                "sourceItemId": source_id,
                "source": context.source,
                "history": context.history,
                "searchSignals": context.search_signals,
            }),
        )?;
        if (index + 1) % 100 == 0 {
            eprintln!("已导出 {}/{}", index + 1, source_count);
        }
    }

    let total_changes_after = connection.total_changes();
    if total_changes_after != total_changes_before {
        return Err("分类上下文导出对隔离数据库产生了写入".into());
    }
    drop(connection);
    let sha256_after = sha256_file(&source_database)?;
    if sha256_after != sha256_before {
        return Err("隔离数据库哈希在只读导出期间发生变化".into());
    }
    write!(
        writer,
        "],\"sourceTotalChangesAfter\":{},\"sourceDatabaseSha256After\":{}}}",
        total_changes_after,
        serde_json::to_string(&sha256_after)?,
    )?;
    writer.flush()?;
    writer.get_ref().sync_all()?;

    println!("分类上下文导出完成");
    println!("来源：{source_count}");
    println!("副本 SHA-256：{sha256_after}");
    println!("输出：{}", output_file.display());
    Ok(())
}

fn sha256_file(path: &Path) -> Result<String, std::io::Error> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; 256 * 1024];
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode_upper(hasher.finalize()))
}
