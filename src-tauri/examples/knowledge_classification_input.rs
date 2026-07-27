use std::path::PathBuf;

use nanfeng_knowledge_base_lib::knowledge::classification_input::export_legacy_classification_input;

fn main() {
    if let Err(error) = run() {
        eprintln!("分类输入导出失败：{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut arguments = std::env::args_os().skip(1);
    let source_database = arguments
        .next()
        .map(PathBuf::from)
        .ok_or("缺少隔离副本绝对路径")?;
    let output_directory = arguments
        .next()
        .map(PathBuf::from)
        .ok_or("缺少分类预演输出目录绝对路径")?;
    if arguments.next().is_some() {
        return Err("参数过多；仅接受隔离副本和输出目录".into());
    }

    let artifacts = export_legacy_classification_input(&source_database, &output_directory)?;
    println!("分类标准输入导出完成");
    println!("活动记录：{}", artifacts.record_count);
    println!("副本 SHA-256：{}", artifacts.source_sha256);
    println!("输入文件：{}", artifacts.input_file.display());
    Ok(())
}
