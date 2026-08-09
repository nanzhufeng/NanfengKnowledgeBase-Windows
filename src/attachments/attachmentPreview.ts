import type { AttachmentItem } from "../domain/models";

/**
 * 所有入口都通过同一份分类结果决定展示方式。文件名只是保底：新归档文件会由
 * Rust 侧保存 MIME，历史附件仍可依靠扩展名获得稳定的可用预览。
 */
export type AttachmentPreviewKind = "image" | "pdf" | "text" | "audio" | "video" | "archive" | "unsupported";

const extensionOf = (fileName: string) => fileName.split(".").at(-1)?.toLocaleLowerCase() ?? "";

export function attachmentPreviewKind(attachment: AttachmentItem): AttachmentPreviewKind {
  const mime = attachment.mimeType?.toLocaleLowerCase() ?? "";
  const extension = extensionOf(attachment.fileName);
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif", "heic", "heif"].includes(extension)) {
    return "image";
  }
  if (mime === "application/pdf" || extension === "pdf") return "pdf";
  if (
    mime.startsWith("text/")
    || ["txt", "md", "markdown", "json", "csv", "log", "xml", "yaml", "yml"].includes(extension)
  ) {
    return "text";
  }
  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "oga", "m4a", "flac", "aac", "opus"].includes(extension)) {
    return "audio";
  }
  if (mime.startsWith("video/") || ["mp4", "webm", "mov", "m4v", "ogv", "mkv", "avi"].includes(extension)) {
    return "video";
  }
  if (
    mime.includes("zip")
    || ["zip", "7z", "rar", "tar", "gz", "gzip", "bz2", "xz", "tgz", "tbz", "txz"].includes(extension)
  ) return "archive";
  return "unsupported";
}
