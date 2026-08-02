import type { ReactNode } from "react";
import { FileDown, MoreHorizontal, Star } from "lucide-react";

export function NoteListActions({
  isFavorite,
  menuOpen,
  onToggleFavorite,
  onExport,
  onToggleMenu,
  children,
  className = "",
}: {
  isFavorite: boolean;
  menuOpen: boolean;
  onToggleFavorite: () => void;
  onExport: () => void;
  onToggleMenu: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`note-list-actions ${className}`.trim()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="quick-actions note-list-quick-actions">
        <button
          type="button"
          className={isFavorite ? "active" : ""}
          title={isFavorite ? "取消收藏" : "收藏笔记"}
          aria-label={isFavorite ? "取消收藏" : "收藏"}
          onClick={onToggleFavorite}
        >
          <Star size={17} fill={isFavorite ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          title="导出完整笔记"
          aria-label="导出完整笔记"
          onClick={onExport}
        >
          <FileDown size={17} />
        </button>
        <button
          type="button"
          title="更多操作"
          aria-label="更多"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
        >
          <MoreHorizontal size={17} />
        </button>
      </div>
      {menuOpen ? (
        <div
          className="action-menu record-action-menu note-list-action-menu"
          role="menu"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
