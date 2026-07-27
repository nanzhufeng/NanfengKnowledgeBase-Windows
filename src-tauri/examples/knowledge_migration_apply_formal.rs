use std::path::PathBuf;

use nanfeng_knowledge_base_lib::maintenance::migrate_formal_knowledge_base;

fn main() {
    if let Err(error) = run() {
        eprintln!("正式知识迁移失败：{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut arguments = std::env::args_os().skip(1);
    let data_root = arguments
        .next()
        .map(PathBuf::from)
        .ok_or("缺少正式数据目录绝对路径")?;
    let confirmation = arguments
        .next()
        .ok_or("缺少正式迁移确认令牌")?
        .to_string_lossy()
        .into_owned();
    if arguments.next().is_some() {
        return Err("参数过多；仅接受正式数据目录和确认令牌".into());
    }

    let report = migrate_formal_knowledge_base(data_root, &confirmation)?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}
