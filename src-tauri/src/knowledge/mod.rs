pub mod audit;
pub mod classification_input;
#[allow(dead_code)]
pub(crate) mod legacy_preview;
pub(crate) mod personal_catalog;
pub(crate) mod readable_text;
pub(crate) mod repository;
pub(crate) mod schema;
pub(crate) mod source_identity;

// 只读全量分类审计复用生产仓库生成的同一上下文，不复制评分输入规则。
pub use personal_catalog::PERSONAL_CATALOG_VERSION;
pub use repository::{
    apply_personal_catalog, prepare_classification_context, ApplyPersonalCatalogInput,
};
