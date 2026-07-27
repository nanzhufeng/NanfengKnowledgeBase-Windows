use serde::Serialize;

pub const PERSONAL_CATALOG_VERSION: &str = "nanzhufeng-personal-catalog-v1";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PersonalCatalogDomain {
    pub key: String,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PersonalCatalogTopic {
    pub key: String,
    pub domain_key: String,
    pub parent_key: Option<String>,
    pub name: String,
    pub description: String,
    pub topic_kind: String,
    pub aliases: Vec<String>,
    pub entities: Vec<String>,
    pub keywords: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PersonalCatalogProposal {
    pub version: String,
    pub status: String,
    pub title: String,
    pub note: String,
    pub domains: Vec<PersonalCatalogDomain>,
    pub topics: Vec<PersonalCatalogTopic>,
}

pub fn personal_catalog_proposal() -> PersonalCatalogProposal {
    PersonalCatalogProposal {
        version: PERSONAL_CATALOG_VERSION.to_string(),
        status: "proposal".to_string(),
        title: "南烛枫个人主题目录 v1".to_string(),
        note: "根据当前已确认的投资、AI、软件开发、海外账号、汽车、南京租房、影视/VFX 和音视频转写方向生成。确认只补充缺失项，不覆盖已有目录。"
            .to_string(),
        domains: vec![
            domain("investment", "投资研究", "公司、行业、资产与投资判断"),
            domain("ai-software", "AI 与软件", "模型、Agent、软件开发与知识工作流"),
            domain("vfx", "影视、动画与 VFX", "合成、动画、镜头复盘与媒体处理"),
            domain("accounts", "海外账号", "账号、支付、地区与风控事项"),
            domain("automotive", "汽车与出行", "车型、用车、产业与出行决策"),
            domain("life", "长期事务", "居住、设备、环境与长期生活事项"),
        ],
        topics: vec![
            topic(
                "investment-ai-infra",
                "investment",
                None,
                "AI 基础设施",
                "算力、数据中心、云厂商与产业链",
                &["AI 算力", "数据中心产业链"],
                &["GPU", "云厂商", "数据中心"],
                &["资本开支", "算力", "电力", "折旧"],
            ),
            topic(
                "investment-ai-capex",
                "investment",
                Some("investment-ai-infra"),
                "资本开支与现金流",
                "AI 资本开支周期、折旧和自由现金流",
                &["AI 资本开支", "CapEx"],
                &["GPU", "自由现金流"],
                &["资本开支", "现金流", "折旧", "训练集群", "推理基础设施"],
            ),
            topic(
                "ai-model-cost",
                "ai-software",
                None,
                "模型与成本",
                "大模型能力、价格、额度和推理成本",
                &["模型价格", "Token 成本"],
                &["ChatGPT", "Claude", "Gemini"],
                &["模型", "API", "token", "推理", "价格", "额度"],
            ),
            topic(
                "ai-agent-workflow",
                "ai-software",
                None,
                "Agent 与 Codex 工作流",
                "代理工具、上下文、插件和自动化协作",
                &["Codex 工作流", "Agent 工作流"],
                &["Codex", "Claude", "MCP"],
                &["代理", "工具调用", "上下文", "插件", "自动化"],
            ),
            topic(
                "ai-software-development",
                "ai-software",
                None,
                "软件开发",
                "面向工作流自动化和实用工具的软件工程",
                &["编程开发", "开发工具"],
                &["Windows", "Android", "GitHub"],
                &["代码", "调试", "测试", "构建", "桌面软件"],
            ),
            topic(
                "ai-knowledge-workflow",
                "ai-software",
                None,
                "知识库与检索",
                "本地优先知识库、搜索、证据和开放文件交换",
                &["个人知识库", "开放文件工作流"],
                &["SQLite", "Markdown", "Obsidian"],
                &["知识库", "检索", "证据", "本地优先", "回滚"],
            ),
            topic(
                "vfx-compositing",
                "vfx",
                None,
                "合成工作流",
                "Fusion、颜色管理、镜头合成和复盘",
                &["Fusion 合成", "VFX 合成"],
                &["Fusion", "ACES"],
                &["镜头", "合成", "预乘", "去边", "颜色空间", "运动模糊"],
            ),
            topic(
                "vfx-animation",
                "vfx",
                None,
                "动画与动效",
                "动画设计、运动语言和界面动效",
                &["Motion Design", "动效设计"],
                &["After Effects"],
                &["动画", "动效", "关键帧", "缓动", "转场"],
            ),
            topic(
                "vfx-transcription",
                "vfx",
                None,
                "音视频转写",
                "字幕、语音识别、时间码和内容整理",
                &["字幕整理", "视频转写"],
                &["Whisper", "SRT", "VTT"],
                &["字幕", "转写", "时间码", "音频", "视频"],
            ),
            topic(
                "accounts-risk",
                "accounts",
                None,
                "账号风控与封禁",
                "Google、Apple、支付和地区账号的登录与风控",
                &["海外账号风控", "账号被封"],
                &["Google", "Apple", "Gmail"],
                &["风控", "封禁", "登录", "地区", "验证", "支付"],
            ),
            topic(
                "automotive-models",
                "automotive",
                None,
                "车型研究与选择",
                "车型、配置、使用成本和购买判断",
                &["选车", "车型比较"],
                &["极氪", "特斯拉"],
                &["车型", "配置", "续航", "智驾", "价格", "用车"],
            ),
            topic(
                "life-nanjing-rent",
                "life",
                None,
                "南京租房",
                "区域、租金、通勤和居住环境比较",
                &["南京租房决策", "租房候选"],
                &["南京", "河西", "江宁"],
                &["租金", "通勤", "噪音", "停车", "区域", "居住"],
            ),
            topic(
                "life-equipment",
                "life",
                None,
                "设备与工作环境",
                "电脑、显示器、音频设备与工作空间",
                &["工作环境", "硬件设备"],
                &["Windows", "Mac", "显示器"],
                &["设备", "硬件", "噪音", "温度", "音频"],
            ),
        ],
    }
}

fn domain(key: &str, name: &str, description: &str) -> PersonalCatalogDomain {
    PersonalCatalogDomain {
        key: key.to_string(),
        name: name.to_string(),
        description: description.to_string(),
    }
}

fn topic(
    key: &str,
    domain_key: &str,
    parent_key: Option<&str>,
    name: &str,
    description: &str,
    aliases: &[&str],
    entities: &[&str],
    keywords: &[&str],
) -> PersonalCatalogTopic {
    PersonalCatalogTopic {
        key: key.to_string(),
        domain_key: domain_key.to_string(),
        parent_key: parent_key.map(str::to_string),
        name: name.to_string(),
        description: description.to_string(),
        topic_kind: "subject".to_string(),
        aliases: aliases.iter().map(|value| (*value).to_string()).collect(),
        entities: entities.iter().map(|value| (*value).to_string()).collect(),
        keywords: keywords.iter().map(|value| (*value).to_string()).collect(),
    }
}
