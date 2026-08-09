import { FolderOpen } from "lucide-react";
import type { AttachmentItem } from "../domain/models";

/** 所有附件预览共用的“在资源管理器中定位”动作。 */
export function AttachmentLocateButton({
  attachment,
  onRevealAttachment,
  compact = false,
}: {
  attachment: AttachmentItem;
  onRevealAttachment: (attachment: AttachmentItem) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className={`attachment-locate-button ${compact ? "compact" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onRevealAttachment(attachment);
      }}
      aria-label={`在资源管理器中定位文件：${attachment.fileName}`}
      title="打开文件所在目录并选中此文件"
    >
      <FolderOpen size={16} />
      <span>定位文件</span>
    </button>
  );
}
