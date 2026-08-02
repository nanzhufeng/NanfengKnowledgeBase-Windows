import type { AttachmentItem } from "../domain/models";
import type { ReadableSourceAsset } from "../domain/importedContent";

function decoded(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizedKey(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const withoutProtocol = decoded(value.trim()).replace(/^[a-z-]+:\/\//i, "");
  const fragment = withoutProtocol.split("#").at(-1) ?? withoutProtocol;
  const basename = fragment.split(/[\\/]/).at(-1) ?? fragment;
  const normalized = basename
    .replace(/[?#].*$/, "")
    .replace(/\.dat$/i, "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .trim();
  return normalized || null;
}

function stem(value: string): string {
  return value.replace(/\.[a-z0-9]{1,8}$/i, "");
}

function attachmentKeys(attachment: AttachmentItem): string[] {
  return [
    normalizedKey(attachment.fileName),
    normalizedKey(attachment.originalPath),
    normalizedKey(attachment.storedPath),
  ].filter((value): value is string => Boolean(value));
}

export function resolveSourceAssetAttachment(
  asset: ReadableSourceAsset,
  attachments: AttachmentItem[],
): AttachmentItem | null {
  const assetKeys = [
    normalizedKey(asset.fileUuid),
    normalizedKey(asset.fileName),
  ].filter((value): value is string => Boolean(value));

  for (const assetKey of assetKeys) {
    const exact = attachments.find((attachment) => attachmentKeys(attachment).includes(assetKey));
    if (exact) return exact;
  }

  const assetStems = new Set(assetKeys.map(stem).filter((value) => value.length >= 8));
  const stemMatches = attachments.filter((attachment) =>
    attachmentKeys(attachment).some((key) => assetStems.has(stem(key))),
  );
  return stemMatches.length === 1 ? stemMatches[0] : null;
}

export function sourceAssetIsImage(
  asset: ReadableSourceAsset,
  attachment: AttachmentItem | null,
): boolean {
  if (asset.kind === "image") return true;
  const mimeType = asset.mimeType ?? attachment?.mimeType ?? "";
  if (mimeType.toLocaleLowerCase().startsWith("image/")) return true;
  return [asset.fileName, attachment?.fileName, attachment?.storedPath]
    .some((value) => /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(value ?? ""));
}
