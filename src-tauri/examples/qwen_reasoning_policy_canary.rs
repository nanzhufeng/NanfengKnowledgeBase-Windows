use nanfeng_knowledge_base_lib::ai::client::{
    run_source_profile_batch, run_taxonomy_assignment_batch,
};
use nanfeng_knowledge_base_lib::ai::credentials;
use nanfeng_knowledge_base_lib::ai::models::{
    AiProviderChannel, AiSourceMaterial, AiTaxonomyDomainProposal, AiTaxonomyStructure,
    AiTaxonomyTopicProposal, QWEN_DEFAULT_ORGANIZATION_MODEL,
};
use serde_json::json;

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let arguments = std::env::args().skip(1).collect::<Vec<_>>();
    if arguments.iter().any(|argument| argument == "--preflight") {
        let configured = credentials::get_api_key(AiProviderChannel::QwenDirect)
            .map_err(|error| error.to_string())?
            .is_some();
        println!(
            "{}",
            json!({"channel": "qwen_direct", "configured": configured})
        );
        return Ok(());
    }
    if !arguments
        .iter()
        .any(|argument| argument == "--execute-isolated")
    {
        return Err(
            "缺少 --execute-isolated；未读取正式库，也未发送网络请求。先运行 --preflight。"
                .to_string(),
        );
    }

    let channel = AiProviderChannel::QwenDirect;
    let api_key = credentials::get_api_key(channel)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "千问直连未配置 API Key，未发送请求。".to_string())?;
    let sources = synthetic_sources();
    let (profiles, profile_usage) = run_source_profile_batch(
        channel,
        &api_key,
        QWEN_DEFAULT_ORGANIZATION_MODEL,
        &sources,
        None,
    )
    .map_err(|error| error.to_string())?;
    let (assignments, assignment_usage) = run_taxonomy_assignment_batch(
        channel,
        &api_key,
        QWEN_DEFAULT_ORGANIZATION_MODEL,
        &synthetic_taxonomy(),
        &profiles,
        None,
    )
    .map_err(|error| error.to_string())?;

    let reasoning_disabled_verified =
        profile_usage.reasoning_tokens == 0 && assignment_usage.reasoning_tokens == 0;
    println!(
        "{}",
        json!({
            "mode": "isolated-synthetic",
            "channel": channel.as_str(),
            "model": QWEN_DEFAULT_ORGANIZATION_MODEL,
            "sourceCount": sources.len(),
            "profileCount": profiles.len(),
            "assignmentCount": assignments.len(),
            "profileUsage": profile_usage,
            "assignmentUsage": assignment_usage,
            "reasoningDisabledVerified": reasoning_disabled_verified,
            "formalDatabaseRead": false,
            "responseBodyPersisted": false,
        })
    );
    if !reasoning_disabled_verified {
        return Err("千问批量阶段仍返回 reasoning Token，停止启用该策略。".to_string());
    }
    Ok(())
}

fn synthetic_sources() -> Vec<AiSourceMaterial> {
    vec![
        AiSourceMaterial {
            source_item_id: 9_001,
            title: "合成镜头版本检查".to_string(),
            content: "这是完全合成的测试资料。镜头进入合成后，需要核对素材版本、帧范围、色彩空间和交付命名。审核记录只描述虚构项目，不对应任何真实客户、人员或文件。发现版本差异时先保留证据，再由制作负责人确认是否回退。".repeat(3),
            content_sha256: Some("synthetic-vfx-version".to_string()),
        },
        AiSourceMaterial {
            source_item_id: 9_002,
            title: "动画审核反馈归档".to_string(),
            content: "这是完全合成的测试资料。动画审核按镜头记录动作节奏、表演意图和修改轮次，反馈需要区分必须修改与可选建议。资料中的角色、镜头和日期均为虚构，仅用于验证结构化分类，不含正式知识库内容。".repeat(3),
            content_sha256: Some("synthetic-animation-review".to_string()),
        },
    ]
}

fn synthetic_taxonomy() -> AiTaxonomyStructure {
    AiTaxonomyStructure {
        domains: vec![AiTaxonomyDomainProposal {
            key: "synthetic-production".to_string(),
            name: "合成制作".to_string(),
            description: "只用于隔离测试的虚构领域".to_string(),
        }],
        topics: vec![
            AiTaxonomyTopicProposal {
                key: "synthetic-vfx".to_string(),
                domain_key: "synthetic-production".to_string(),
                parent_key: None,
                name: "合成版本管理".to_string(),
                description: "虚构的合成版本测试主题".to_string(),
                integration_markdown: String::new(),
                source_item_ids: Vec::new(),
            },
            AiTaxonomyTopicProposal {
                key: "synthetic-animation".to_string(),
                domain_key: "synthetic-production".to_string(),
                parent_key: None,
                name: "动画审核".to_string(),
                description: "虚构的动画审核测试主题".to_string(),
                integration_markdown: String::new(),
                source_item_ids: Vec::new(),
            },
        ],
    }
}
