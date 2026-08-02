import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NoteListActions } from "./NoteListActions";

describe("NoteListActions", () => {
  it("renders the shared favorite, export and more controls", () => {
    const html = renderToStaticMarkup(
      <NoteListActions
        isFavorite={false}
        menuOpen={false}
        onToggleFavorite={() => undefined}
        onExport={() => undefined}
        onToggleMenu={() => undefined}
      >
        <button type="button">加入持续跟踪</button>
      </NoteListActions>,
    );

    expect(html).toContain('aria-label="收藏"');
    expect(html).toContain('aria-label="导出完整笔记"');
    expect(html).toContain('aria-label="更多"');
    expect(html).not.toContain("加入持续跟踪");
  });

  it("renders context actions only while the more menu is open", () => {
    const html = renderToStaticMarkup(
      <NoteListActions
        isFavorite
        menuOpen
        onToggleFavorite={() => undefined}
        onExport={() => undefined}
        onToggleMenu={() => undefined}
      >
        <button type="button" role="menuitem">停止持续跟踪</button>
      </NoteListActions>,
    );

    expect(html).toContain('aria-label="取消收藏"');
    expect(html).toContain('role="menu"');
    expect(html).toContain("停止持续跟踪");
  });
});
