use std::path::PathBuf;

use nanfeng_knowledge_base_lib::maintenance::run_isolated_portable_recovery_qa;

fn main() {
    if let Err(error) = run() {
        eprintln!("隔离完整恢复演练失败：{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut arguments = std::env::args_os().skip(1);
    let source_root = arguments
        .next()
        .map(PathBuf::from)
        .ok_or("缺少隔离输入目录绝对路径")?;
    let qa_root = arguments
        .next()
        .map(PathBuf::from)
        .ok_or("缺少新隔离演练目录绝对路径")?;
    if arguments.next().is_some() {
        return Err("参数过多；仅接受隔离输入目录和新隔离演练目录".into());
    }

    let report = run_isolated_portable_recovery_qa(source_root, qa_root)?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}
