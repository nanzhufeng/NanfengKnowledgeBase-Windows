use std::env;
use std::path::PathBuf;

use nanfeng_knowledge_base_lib::maintenance::import_chatgpt_export_with_backup;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut arguments = env::args_os().skip(1);
    let data_root = arguments
        .next()
        .map(PathBuf::from)
        .ok_or("缺少新数据目录参数")?;
    let source_zip = arguments
        .next()
        .map(PathBuf::from)
        .ok_or("缺少 ChatGPT 导出 ZIP 参数")?;
    let expected_sha256 = arguments
        .next()
        .and_then(|value| value.into_string().ok())
        .ok_or("缺少预期 SHA-256 参数")?;
    if arguments.next().is_some() {
        return Err("参数过多".into());
    }

    let report =
        import_chatgpt_export_with_backup(data_root, source_zip, &expected_sha256, 517, 718)?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}
