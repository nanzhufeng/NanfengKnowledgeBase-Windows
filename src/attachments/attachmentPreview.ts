import type { AttachmentItem } from "../domain/models";

export type AttachmentPreviewKind = "image" | "pdf" | "text" | "audio" | "video" | "unsupported";

const extensionOf = (fileName: string) => fileName.split(".").at(-1)?.toLocaleLowerCase() ?? "";

export function attachmentPreviewKind(attachment: AttachmentItem): AttachmentPreviewKind {
  const mime = attachment.mimeType?.toLocaleLowerCase() ?? "";
  const extension = extensionOf(attachment.fileName);
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif"].includes(extension)) {
    return "image";
  }
  if (mime === "application/pdf" || extension === "pdf") return "pdf";
  if (
    mime.startsWith("text/")
    || ["txt", "md", "markdown", "json", "csv", "log", "xml", "yaml", "yml"].includes(extension)
  ) {
    return "text";
  }
  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(extension)) {
    return "audio";
  }
  if (mime.startsWith("video/") || ["mp4", "webm", "mov", "m4v", "ogv"].includes(extension)) {
    return "video";
  }
  return "unsupported";
}
