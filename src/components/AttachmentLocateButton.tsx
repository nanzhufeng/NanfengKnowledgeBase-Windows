import { FolderOpen } from "lucide-react";
import { attachmentPreviewKind } from "../attachments/attachmentPreview";
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
  const kind = attachmentPreviewKind(attachment);
  const targetLabel = kind === "video" ? "视频文件" : kind === "image" ? "图片文件" : kind === "pdf" ? "PDF 文件" : "文件";
  return (
    <button
      type="button"
      className={`attachment-locate-button ${compact ? "compact" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onRevealAttachment(attachment);
      }}
      aria-label={`在资源管理器中定位${targetLabel}：${attachment.fileName}`}
      title={`打开${targetLabel}所在目录并选中此文件`}
    >
      <FolderOpen size={16} />
      <span>定位文件</span>
    </button>
  );
}
