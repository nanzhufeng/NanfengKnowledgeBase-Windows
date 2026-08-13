-- Source Item 与兼容 Record 共同决定用户可见性。
-- 回收站只允许通过显式 restore 回到该视图；所有用户读取、附件目录和 AI 取材
-- 都必须从此视图开始，不能自行遗漏 Record 的软删除状态。
DROP VIEW IF EXISTS visible_source_items;

CREATE VIEW visible_source_items AS
SELECT source.*
FROM source_items source
LEFT JOIN records legacy_record ON legacy_record.id = source.legacy_record_id
WHERE source.status = 'active'
  -- 关联了旧 Record 但找不到该 Record 的损坏来源也必须保守隐藏，
  -- 不能把它误当成“从未删除”而重新出现在用户视图。
  AND (source.legacy_record_id IS NULL OR legacy_record.is_deleted = 0);
