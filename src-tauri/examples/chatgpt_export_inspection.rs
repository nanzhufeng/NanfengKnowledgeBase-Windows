use std::fs::OpenOptions;
use std::io::{BufWriter, Write};
use std::path::PathBuf;

use nanfeng_knowledge_base_lib::chatgpt_export::inspect_chatgpt_export;

fn main() {
    let arguments = std::env::args_os().skip(1).collect::<Vec<_>>();
    if arguments.len() != 2 {
        eprintln!(
            "用法：cargo run --example chatgpt_export_inspection -- <ChatGPT导出.zip> <检查报告.json>"
        );
        std::process::exit(2);
    }
    let source = PathBuf::from(&arguments[0]);
    let output = PathBuf::from(&arguments[1]);
    if !source.is_absolute() || !output.is_absolute() {
        eprintln!("源 ZIP 和报告路径都必须是绝对路径");
        std::process::exit(2);
    }
    if output.exists() {
        eprintln!("为避免覆盖既有审计证据，报告已存在：{}", output.display());
        std::process::exit(2);
    }
    if let Some(parent) = output.parent() {
        if let Err(error) = std::fs::create_dir_all(parent) {
            eprintln!("无法创建报告目录：{error}");
            std::process::exit(1);
        }
    }

    let report = match inspect_chatgpt_export(&source) {
        Ok(report) => report,
        Err(error) => {
            eprintln!("ChatGPT 导出包检查失败：{error}");
            std::process::exit(1);
        }
    };
    let file = match OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&output)
    {
        Ok(file) => file,
        Err(error) => {
            eprintln!("无法创建报告：{error}");
            std::process::exit(1);
        }
    };
    let mut writer = BufWriter::new(file);
    if let Err(error) = serde_json::to_writer_pretty(&mut writer, &report) {
        eprintln!("无法写入报告：{error}");
        std::process::exit(1);
    }
    if let Err(error) = writer.write_all(b"\n") {
        eprintln!("无法结束报告：{error}");
        std::process::exit(1);
    }
    if let Err(error) = writer.flush() {
        eprintln!("无法刷新报告：{error}");
        std::process::exit(1);
    }

    println!("ChatGPT 完整导出包检查完成");
    println!("会话：{}", report.conversation_count);
    println!("附件实体：{}", report.assets.len());
    println!("消息直接关联附件：{}", report.linked_asset_count);
    println!("未直接关联附件：{}", report.unlinked_asset_count);
    println!("报告：{}", output.display());
}
