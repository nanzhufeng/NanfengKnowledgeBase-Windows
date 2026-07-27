use std::path::PathBuf;

use nanfeng_knowledge_base_lib::maintenance::inspect_formal_knowledge_base;

fn main() {
    if let Err(error) = run() {
        eprintln!("正式知识库只读核对失败：{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut arguments = std::env::args_os().skip(1);
    let data_root = arguments
        .next()
        .map(PathBuf::from)
        .ok_or("缺少正式数据目录绝对路径")?;
    if arguments.next().is_some() {
        return Err("参数过多；仅接受正式数据目录".into());
    }

    let report = inspect_formal_knowledge_base(data_root)?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}
