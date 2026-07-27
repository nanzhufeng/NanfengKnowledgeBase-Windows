use std::path::PathBuf;

use nanfeng_knowledge_base_lib::knowledge::audit::generate_read_only_migration_audit;

fn main() {
    if let Err(error) = run() {
        eprintln!("迁移预演失败：{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut arguments = std::env::args_os().skip(1);
    let source_database = arguments
        .next()
        .map(PathBuf::from)
        .ok_or("缺少正式数据库绝对路径")?;
    let output_directory = arguments
        .next()
        .map(PathBuf::from)
        .ok_or("缺少审计输出目录绝对路径")?;
    if arguments.next().is_some() {
        return Err("参数过多；仅接受正式数据库和审计输出目录".into());
    }

    let artifacts = generate_read_only_migration_audit(&source_database, &output_directory)?;
    println!("只读迁移预演完成");
    println!("活动记录：{}", artifacts.active_record_count);
    println!("回收站记录：{}", artifacts.deleted_record_count);
    println!("主题候选：{}", artifacts.topic_candidate_count);
    println!("多标签歧义：{}", artifacts.ambiguous_record_count);
    println!("未分类：{}", artifacts.unclassified_record_count);
    println!("恢复标题：{}", artifacts.recovered_title_record_count);
    println!(
        "仍为通用标题：{}",
        artifacts.unresolved_generic_title_record_count
    );
    println!("重名记录：{}", artifacts.duplicate_title_record_count);
    println!("副本 SHA-256：{}", artifacts.copy_sha256);
    println!("Markdown 报告：{}", artifacts.markdown_report.display());
    println!("JSON 报告：{}", artifacts.json_report.display());
    println!("隔离副本：{}", artifacts.database_copy.display());
    Ok(())
}
