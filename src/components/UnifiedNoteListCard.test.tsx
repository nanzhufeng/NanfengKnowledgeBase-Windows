/// <reference types="node" />

import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NoteListActions } from "./NoteListActions";
import {
  UnifiedNoteListCard,
  UnifiedNoteListDisplayToolbar,
  UnifiedNoteListFilter,
  UnifiedNoteListLocator,
  UnifiedNoteListSearchRow,
  UnifiedNoteListToolbar,
  UNIFIED_NOTE_FILTER_ALL,
  createUnifiedNoteSourceFilterField,
  createUnifiedNoteStatusFilterField,
  createUnifiedNoteTopicFilterField,
  createUnifiedNoteDateFilterFields,
  matchesUnifiedNoteFilter,
  cycleUnifiedNoteListSortMode,
  formatNoteCardDate,
  resolveNoteIconKey,
  sortUnifiedNoteListItems,
} from "./UnifiedNoteListCard";

describe("UnifiedNoteListCard", () => {
  it("uses differentiated semantic icons instead of a repeated file badge", () => {
    expect(resolveNoteIconKey("港版 iPhone 绑定汇丰 Apple Pay")).toBe("chip");
    expect(resolveNoteIconKey("地缘 AI 投资复盘", "投资研究")).toBe("finance");
    expect(resolveNoteIconKey("影视 AI 工具开发建议", "影视、动画与 VFX")).toBe("media");
    expect(resolveNoteIconKey("数据导出确认循环", "软件开发")).toBe("software");
  });

  it("is the single list-card implementation for Record views and every source row", () => {
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    const workspace = readFileSync(new URL("./KnowledgeWorkspace.tsx", import.meta.url), "utf8");

    expect(app).toContain("<UnifiedNoteListPanel");
    expect(app).toContain("<UnifiedNoteListCard");
    expect(workspace).toContain("visibleSources.map((item) =>");
    expect(workspace).toContain("<UnifiedNoteListPanel");
    expect(workspace).toContain("<UnifiedNoteListCard");
    expect(workspace).toContain("ensureSourceActionTarget");
    expect(workspace).toContain("onSourceActionRecordCreated(record, item.primaryTopicName)");
    expect(workspace).not.toContain("linkedNoteCount} 篇笔记");
  });

  it("keeps Record views and the source archive on the same functional toolbar structure", () => {
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    const workspace = readFileSync(new URL("./KnowledgeWorkspace.tsx", import.meta.url), "utf8");
    const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    const toolbar = renderToStaticMarkup(
      <>
        <UnifiedNoteListSearchRow>搜索</UnifiedNoteListSearchRow>
        <UnifiedNoteListFilter
          open
          active={false}
          fields={[
            {
              id: "source",
              label: "来源",
              type: "select",
              value: "all",
              options: [{ value: "all", label: "全部来源" }],
              onChange: () => undefined,
            },
          ]}
          onOpenChange={() => undefined}
          onReset={() => undefined}
        />
        <UnifiedNoteListToolbar>工具栏</UnifiedNoteListToolbar>
        <UnifiedNoteListDisplayToolbar
          label="来源档案"
          count={4}
          countLabel="条来源"
          compactMode
          sortMode="default"
          onToggleCompact={() => undefined}
          onCycleSort={() => undefined}
        />
        <UnifiedNoteListLocator
          count={4}
          value={1}
          currentIndex={2}
          itemLabel="记录"
          onLocate={() => undefined}
        />
      </>,
    );

    for (const owner of [app, workspace]) {
      expect(owner).toContain("<UnifiedNoteListSearchRow");
      expect(owner).toContain("<UnifiedNoteListDisplayToolbar");
      expect(owner).toContain("<UnifiedNoteListLocator");
    }
    expect(toolbar).toContain("unified-note-list-search-row");
    expect(toolbar).toContain("unified-note-list-filter-wrap");
    expect(toolbar).toContain("unified-note-list-filter-popover");
    expect(toolbar).toContain("组合筛选");
    expect(toolbar).toContain("unified-note-list-toolbar");
    expect(toolbar).toContain("unified-note-list-locator");
    expect(toolbar).toContain("顶部");
    expect(toolbar).toContain("2 / 4");
    expect(toolbar).toContain("当前");
    expect(toolbar).toContain('aria-label="拖动快速定位记录"');
    expect(toolbar).toContain("舒展卡片");
    expect(toolbar).toContain("按更新时间");
    expect(workspace).toContain('placeholder="搜索来源"');
    expect(app).toContain("<UnifiedNoteListFilter");
    expect(workspace).toContain("<UnifiedNoteListFilter");
    for (const owner of [app, workspace]) {
      expect(owner).toContain("createUnifiedNoteSourceFilterField");
      expect(owner).toContain("createUnifiedNoteStatusFilterField");
      expect(owner).toContain("createUnifiedNoteTopicFilterField");
    }
    expect(workspace).toContain("? sourceCollections.map((collection) => collection.displayName)");
    expect(workspace).toContain(": inbox.map(sourceOriginLabel)");
    expect(workspace).toContain('label: "管理来源名称"');
    expect(workspace).toContain("repository.listSourceCollections()");
    expect(app).toContain("topicValues={unifiedNoteTopicValues}");
    expect(app).toContain("filterTopicValues={unifiedNoteTopicValues}");
    expect(workspace).toContain("topicValues: filterTopicValues");
    expect(workspace).not.toContain("全部来源类型");
    expect(workspace).not.toContain("sourceKindFilter");
    expect(app).not.toContain('label: "标签"');
    expect(workspace).not.toContain("knowledge-source-filter-popover");
    expect(workspace).not.toContain("筛选来源档案");
    expect(workspace).toContain("全部加载 ${sourceArchiveTotal}");
    expect(workspace).toContain('compact={sourceCompactMode}');
    expect(styles).toContain("grid-template-columns: minmax(300px, 24%) minmax(0, 1fr)");
    expect(styles).toContain(".unified-note-list-display-toolbar button");
  });

  it("owns real-source, record-status, and topic filter semantics in one shared layer", () => {
    const sourceField = createUnifiedNoteSourceFilterField({
      value: UNIFIED_NOTE_FILTER_ALL,
      sourceValues: ["ChatGPT 导入", "Claude 导入", "ChatGPT 导入"],
      onChange: () => undefined,
    });
    const statusField = createUnifiedNoteStatusFilterField({
      value: UNIFIED_NOTE_FILTER_ALL,
      onChange: () => undefined,
    });
    const topicField = createUnifiedNoteTopicFilterField({
      value: UNIFIED_NOTE_FILTER_ALL,
      topicValues: ["软件开发", "影视、动画与VFX合成", "软件开发"],
      onChange: () => undefined,
    });
    const dateFields = createUnifiedNoteDateFilterFields({
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      onDateFromChange: () => undefined,
      onDateToChange: () => undefined,
    });

    expect(sourceField.options?.[0]).toEqual({ value: "all", label: "全部来源" });
    expect(sourceField.options).toContainEqual({
      value: "ChatGPT 导入",
      label: "ChatGPT 导入",
    });
    expect(sourceField.options).toHaveLength(3);
    expect(statusField.options).toEqual([
      { value: "all", label: "全部状态" },
      { value: "normal", label: "普通记录" },
      { value: "tracking", label: "持续跟踪" },
      { value: "verification", label: "待验证" },
      { value: "updated", label: "判断更新" },
    ]);
    expect(topicField.options?.[0]).toEqual({ value: "all", label: "全部主题" });
    expect(topicField.options).toContainEqual({ value: "软件开发", label: "软件开发" });
    expect(topicField.options).toHaveLength(3);
    expect(dateFields.map(({ id, label, type }) => ({ id, label, type }))).toEqual([
      { id: "date-from", label: "起始日期", type: "date" },
      { id: "date-to", label: "结束日期", type: "date" },
    ]);
    expect(matchesUnifiedNoteFilter("软件开发", "all")).toBe(true);
    expect(matchesUnifiedNoteFilter("软件开发", "软件开发")).toBe(true);
    expect(matchesUnifiedNoteFilter("软件开发", "影视、动画与VFX合成")).toBe(false);
  });

  it("cycles and sorts both list consumers through one date-order contract", () => {
    expect(cycleUnifiedNoteListSortMode("default")).toBe("desc");
    expect(cycleUnifiedNoteListSortMode("desc")).toBe("asc");
    expect(cycleUnifiedNoteListSortMode("asc")).toBe("default");

    const items = [
      { id: 1, date: "2026-07-20T00:00:00Z" },
      { id: 2, date: "2026-07-25T00:00:00Z" },
    ];
    expect(sortUnifiedNoteListItems(items, "default", (item) => item.date)).toBe(items);
    expect(sortUnifiedNoteListItems(items, "desc", (item) => item.date).map((item) => item.id))
      .toEqual([2, 1]);
    expect(sortUnifiedNoteListItems(items, "asc", (item) => item.date).map((item) => item.id))
      .toEqual([1, 2]);
  });

  it("uses one compact information-density contract across all four list entrances", () => {
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    const workspace = readFileSync(new URL("./KnowledgeWorkspace.tsx", import.meta.url), "utf8");
    const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

    expect(formatNoteCardDate("2026-07-25T08:00:00Z")).toBe("2026-07-25");
    expect(app).toContain("const [compactMode, setCompactMode] = useState(true)");
    expect(workspace).toContain("const [sourceCompactMode, setSourceCompactMode] = useState(true)");
    expect(styles).toContain("grid-template-columns: 30px minmax(0, 1fr)");
    expect(styles).toContain("-webkit-line-clamp: 2");
    expect(styles).toContain(".unified-note-meta-label");
    expect(styles).toContain(".unified-note-list-display-toolbar {");
  });

  it("pins the display actions to the far right and reserves the count at three digits", () => {
    const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    const toolbar = renderToStaticMarkup(
      <UnifiedNoteListDisplayToolbar
        label="来源档案"
        count={999}
        countLabel="条来源"
        compactMode
        sortMode="default"
        onToggleCompact={() => undefined}
        onCycleSort={() => undefined}
      />,
    );

    expect(toolbar).toContain('aria-label="来源档案 999 条来源"');
    expect(toolbar).toContain(">999<");
    expect(toolbar).toContain("舒展卡片");
    expect(toolbar).toContain("按更新时间");
    expect(styles).toContain("--unified-display-actions-width: 148px;");
    expect(styles).toContain("display: block;\n  width: 100%;");
    expect(styles).toContain("position: absolute;\n  top: 50%;\n  right: 0;");
    expect(styles).toContain("justify-content: flex-end;");
    expect(styles).toContain("left: 3px;\n  width: max-content;\n  max-width: calc(100% - var(--unified-display-actions-width) - 11px);");
    expect(styles).toContain("flex: 0 0 auto;");
  });

  it("indents hierarchy labels without shifting the shared count column", () => {
    const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    const knowledgeTree = readFileSync(new URL("./KnowledgeReadingWorkspace.tsx", import.meta.url), "utf8");
    const topicTree = readFileSync(new URL("./TopicStructureReadingWorkspace.tsx", import.meta.url), "utf8");
    const sharedHierarchy = readFileSync(new URL("./KnowledgeTopicHierarchy.tsx", import.meta.url), "utf8");

    expect(knowledgeTree).toContain("<KnowledgeTopicHierarchy");
    expect(topicTree).toContain("<KnowledgeTopicHierarchy");
    expect(knowledgeTree).not.toContain('"--topic-depth"');
    expect(topicTree).not.toContain('"--topic-depth"');
    expect(sharedHierarchy).toContain('"--topic-depth"');
    expect(sharedHierarchy).toContain('className="knowledge-final-domain-heading"');
    expect(styles).toContain("grid-template-columns: calc(18px + var(--topic-depth, 0) * 16px) minmax(0, 1fr) 32px");
    expect(styles).toContain("justify-self: end");
  });

  it("keeps topic, source, top-right date and the same three actions in one card contract", () => {
    const html = renderToStaticMarkup(
      <UnifiedNoteListCard
        sourceId={9}
        selected
        menuOpen={false}
        iconKey="media"
        title="影视 AI 工具开发建议"
        theme="影视、动画与 VFX"
        source="ChatGPT 导入"
        date="2026-07-25T08:00:00Z"
        actions={
          <NoteListActions
            isFavorite={false}
            menuOpen={false}
            onToggleFavorite={() => undefined}
            onExport={() => undefined}
            onToggleMenu={() => undefined}
          >
            <button type="button">查看详情</button>
          </NoteListActions>
        }
        onSelect={() => undefined}
      />,
    );

    expect(html).toContain("影视 AI 工具开发建议");
    expect(html).toContain("影视、动画与 VFX");
    expect(html).toContain("ChatGPT 导入");
    expect(html).toContain("2026-07-25");
    expect(html).toContain("unified-note-meta-label");
    expect(html).toContain('aria-label="收藏"');
    expect(html).toContain('aria-label="导出完整笔记"');
    expect(html).toContain('aria-label="更多"');
  });

  it("reveals quick actions only for hover, keyboard-visible action focus, or an open menu", () => {
    const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

    expect(styles).toContain(
      ".unified-note-card:hover .unified-note-actions .note-list-quick-actions",
    );
    expect(styles).toContain(
      ".unified-note-actions:has(:focus-visible) .note-list-quick-actions",
    );
    expect(styles).toContain(
      ".unified-note-card.menu-open .unified-note-actions .note-list-quick-actions",
    );
    expect(styles).not.toContain(
      ".unified-note-card:focus-within .unified-note-actions .note-list-quick-actions",
    );
    expect(styles).not.toContain(".source-list-note-actions");
  });
});
