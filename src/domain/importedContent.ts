export type ReadableSourceMessage = {
  role: string;
  text: string;
  createdAt: string | null;
  assets: ReadableSourceAsset[];
};

export type ReadableSourceAsset = {
  fileUuid: string | null;
  fileName: string;
  kind: "image" | "file";
  mimeType: string | null;
  sizeBytes: number | null;
};

export type ReadableSourceContent = {
  messages: ReadableSourceMessage[];
  previewMessages: ReadableSourceMessage[];
  messageCount: number;
  preview: string;
  fullText: string;
  isConversation: boolean;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function visibleContentText(message: JsonObject): string {
  if (!Array.isArray(message.content)) return "";

  return message.content
    .map((block) => asObject(block))
    .filter((block): block is JsonObject => Boolean(block))
    .filter((block) => {
      const type = nonEmptyString(block.type)?.toLocaleLowerCase();
      return (!type || type === "text")
        && block.hidden !== true
        && block.hidden_in_chat !== true;
    })
    .map((block) => nonEmptyString(block.text))
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
}

function messageText(message: JsonObject): string {
  const visibleText = visibleContentText(message);
  if (visibleText) return visibleText;

  return nonEmptyString(message.text) ?? "";
}

function roleLabel(value: unknown): string {
  const role = nonEmptyString(value)?.toLocaleLowerCase();
  if (role === "human" || role === "user") return "用户";
  if (role === "assistant" || role === "ai") return "助手";
  if (role === "system") return "系统";
  return nonEmptyString(value) ?? "记录";
}

function isImageFile(fileName: string, mimeType: string | null): boolean {
  return mimeType?.toLocaleLowerCase().startsWith("image/") === true
    || /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i.test(fileName);
}

function imageReferences(value: unknown, references: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((item) => imageReferences(item, references));
    return;
  }
  const object = asObject(value);
  if (!object) return;
  if (nonEmptyString(object.type)?.toLocaleLowerCase() === "image") {
    const fileUuid = nonEmptyString(object.file_uuid) ?? nonEmptyString(object.fileUuid);
    if (fileUuid) references.add(fileUuid);
  }
  Object.values(object).forEach((item) => imageReferences(item, references));
}

function messageAssets(message: JsonObject): ReadableSourceAsset[] {
  const imageUuids = new Set<string>();
  imageReferences(message.content, imageUuids);

  const fileByUuid = new Map<string, ReadableSourceAsset>();
  const standalone: ReadableSourceAsset[] = [];
  const addAsset = (value: unknown) => {
    const file = asObject(value);
    if (!file) return;
    const fileUuid = nonEmptyString(file.file_uuid) ?? nonEmptyString(file.fileUuid);
    const fileName = nonEmptyString(file.file_name) ?? nonEmptyString(file.fileName);
    const mimeType = nonEmptyString(file.file_type)
      ?? nonEmptyString(file.fileType)
      ?? nonEmptyString(file.media_type)
      ?? nonEmptyString(file.mediaType);
    if (!fileName && !fileUuid) return;
    const displayName = fileName ?? `图片 ${fileUuid?.slice(0, 8) ?? ""}`.trim();
    const rawSize = file.file_size ?? file.fileSize;
    const asset: ReadableSourceAsset = {
      fileUuid,
      fileName: displayName,
      kind: imageUuids.has(fileUuid ?? "") || isImageFile(displayName, mimeType) ? "image" : "file",
      mimeType,
      sizeBytes: typeof rawSize === "number" && Number.isFinite(rawSize) ? rawSize : null,
    };
    if (fileUuid) fileByUuid.set(fileUuid, asset);
    else standalone.push(asset);
  };

  if (Array.isArray(message.files)) message.files.forEach(addAsset);
  if (Array.isArray(message.attachments)) message.attachments.forEach(addAsset);
  imageUuids.forEach((fileUuid) => {
    if (!fileByUuid.has(fileUuid)) {
      fileByUuid.set(fileUuid, {
        fileUuid,
        fileName: `图片 ${fileUuid.slice(0, 8)}`,
        kind: "image",
        mimeType: null,
        sizeBytes: null,
      });
    }
  });

  const deduplicated = new Map<string, ReadableSourceAsset>();
  [...fileByUuid.values(), ...standalone].forEach((asset) => {
    const key = asset.fileUuid ?? `${asset.fileName}:${asset.sizeBytes ?? ""}`;
    deduplicated.set(key, asset);
  });
  return [...deduplicated.values()];
}

function cleanVisibleText(value: string): string {
  return value
    .replace(/\uE200cite[\s\S]*?\uE201/gu, "")
    .replace(/[\uE200-\uE20F]/gu, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function unixDateTime(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const milliseconds = Math.abs(value) < 10_000_000_000 ? value * 1_000 : value;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function chatGptMessageAssets(content: JsonObject): ReadableSourceAsset[] {
  if (!Array.isArray(content.parts)) return [];
  const assets = content.parts
    .map(asObject)
    .filter((part): part is JsonObject => Boolean(part))
    .filter((part) => /_asset_pointer$/i.test(nonEmptyString(part.content_type) ?? ""))
    .map((part): ReadableSourceAsset | null => {
      const pointer = nonEmptyString(part.asset_pointer);
      if (!pointer) return null;
      const fileUuid = pointer.replace(/^[a-z]+:\/\//i, "");
      const contentType = nonEmptyString(part.content_type)?.toLocaleLowerCase() ?? "";
      const kind = contentType.startsWith("image_") ? "image" : "file";
      const rawSize = part.size_bytes;
      const shortId = fileUuid.length > 22
        ? `${fileUuid.slice(0, 18)}…`
        : fileUuid;
      return {
        fileUuid,
        fileName: nonEmptyString(part.file_name)
          ?? nonEmptyString(part.name)
          ?? `${kind === "image" ? "图片" : "文件"} ${shortId}`,
        kind,
        mimeType: nonEmptyString(part.mime_type),
        sizeBytes: typeof rawSize === "number" && Number.isFinite(rawSize) ? rawSize : null,
      };
    })
    .filter((asset): asset is ReadableSourceAsset => Boolean(asset));

  return [...new Map(assets.map((asset) => [asset.fileUuid ?? asset.fileName, asset])).values()];
}

function chatGptMessageText(content: JsonObject): string {
  const contentType = nonEmptyString(content.content_type)?.toLocaleLowerCase();
  if (contentType !== "text" && contentType !== "multimodal_text") return "";
  const parts = Array.isArray(content.parts) ? content.parts : [];
  return cleanVisibleText(parts
    .map((part) => {
      if (typeof part === "string") return part;
      const object = asObject(part);
      if (!object || /_asset_pointer$/i.test(nonEmptyString(object.content_type) ?? "")) return "";
      return nonEmptyString(object.text) ?? nonEmptyString(object.content) ?? "";
    })
    .filter(Boolean)
    .join("\n\n"));
}

function chatGptMappingMessages(root: JsonObject): ReadableSourceMessage[] {
  const mapping = asObject(root.mapping);
  if (!mapping) return [];

  const resolveCreatedAt = (node: JsonObject) => {
    const message = asObject(node.message);
    return typeof message?.create_time === "number" ? message.create_time : 0;
  };
  let currentNodeId = nonEmptyString(root.current_node);
  if (!currentNodeId || !asObject(mapping[currentNodeId])) {
    currentNodeId = Object.entries(mapping)
      .filter(([, value]) => Boolean(asObject(value)))
      .sort(([, left], [, right]) =>
        resolveCreatedAt(asObject(right) ?? {}) - resolveCreatedAt(asObject(left) ?? {}))[0]?.[0] ?? null;
  }
  if (!currentNodeId) return [];

  const lineage: JsonObject[] = [];
  const visited = new Set<string>();
  while (currentNodeId && !visited.has(currentNodeId)) {
    visited.add(currentNodeId);
    const node = asObject(mapping[currentNodeId]);
    if (!node) break;
    lineage.push(node);
    currentNodeId = nonEmptyString(node.parent);
  }

  return lineage
    .reverse()
    .map((node): ReadableSourceMessage | null => {
      const message = asObject(node.message);
      const author = asObject(message?.author);
      const role = nonEmptyString(author?.role)?.toLocaleLowerCase();
      if (!message || (role !== "user" && role !== "assistant")) return null;
      const content = asObject(message.content);
      if (!content) return null;
      const text = chatGptMessageText(content);
      const assets = chatGptMessageAssets(content);
      if (!text && !assets.length) return null;
      return {
        role: roleLabel(role),
        text,
        createdAt: unixDateTime(message.create_time),
        assets,
      };
    })
    .filter((message): message is ReadableSourceMessage => Boolean(message));
}

function makePreview(value: string): string {
  const readable = value.trim();
  const characters = Array.from(readable);
  return characters.length > 2_400
    ? `${characters.slice(0, 2_400).join("").trimEnd()}\n\n……`
    : readable;
}

function makePreviewMessages(messages: ReadableSourceMessage[]): ReadableSourceMessage[] {
  let remaining = 2_400;
  const preview: ReadableSourceMessage[] = [];
  for (const message of messages) {
    if (remaining <= 0 && preview.length) break;
    const characters = Array.from(message.text);
    const allowance = remaining;
    const truncated = characters.length > allowance;
    const text = truncated
      ? `${characters.slice(0, allowance).join("").trimEnd()}\n\n……`
      : message.text;
    if (text || message.assets.length) preview.push({ ...message, text });
    remaining -= Math.min(characters.length, allowance);
    if (truncated) break;
  }
  return preview;
}

function conversationContent(messages: ReadableSourceMessage[]): ReadableSourceContent {
  const fullText = messages
    .map((message) => `${message.role}\n${message.text}`)
    .join("\n\n");
  const previewText = messages
    .map((message) => [
      `### ${message.role}`,
      message.text,
      ...message.assets.map((asset) =>
        asset.kind === "image"
          ? `![${asset.fileName}](attachment:${asset.fileUuid ?? asset.fileName})`
          : `- 附件：${asset.fileName}`),
    ].filter(Boolean).join("\n\n"))
    .join("\n\n---\n\n");
  return {
    messages,
    previewMessages: makePreviewMessages(messages),
    messageCount: messages.length,
    preview: makePreview(previewText),
    fullText,
    isConversation: true,
  };
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitleCandidate(value: string): string {
  return decodeHtmlText(value)
    .replace(/^[#>*_`~\-\s]+/, "")
    .replace(/[*_`~\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function usableTitleCandidate(value: string): boolean {
  if (!value || value.length > 100) return false;
  if (/^(?:---+|tags?|aliases|cssclasses|created|updated|date)\s*:/i.test(value)) return false;
  if (/^(?:bazi monthly journal|restored visual edition|visual edition)$/i.test(value)) return false;
  return /[\p{L}\p{N}]/u.test(value);
}

export function titleFromText(value: string): string | null {
  const lines = value.replace(/^\uFEFF/, "").split(/\r?\n/);
  let bodyStart = 0;
  let frontmatterTitle: string | null = null;
  if (lines[0]?.trim() === "---") {
    const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (closingIndex > 0) {
      const titleEntry = lines
        .slice(1, closingIndex)
        .map((line) => line.match(/^\s*title\s*:\s*(.+?)\s*$/i)?.[1]?.trim())
        .find(Boolean);
      frontmatterTitle = titleEntry?.replace(/^(['"])(.*)\1$/, "$2").trim() ?? null;
      bodyStart = closingIndex + 1;
    }
  }

  const bodyLines = lines.slice(bodyStart);
  const levelOneHeading = bodyLines
    .map((line) => line.match(/^\s*#\s+(.+?)\s*$/)?.[1] ?? "")
    .map(cleanTitleCandidate)
    .find(usableTitleCandidate);
  const htmlCandidates = bodyLines
    .filter((line) => /<[^>]+>/.test(line))
    .map(cleanTitleCandidate)
    .filter(usableTitleCandidate);
  const readableHtmlTitle = htmlCandidates.find((line) => /[\u3400-\u9fff]/.test(line))
    ?? htmlCandidates[0];
  const firstReadableLine = bodyLines
    .map(cleanTitleCandidate)
    .find(usableTitleCandidate);
  const firstLine = [
    frontmatterTitle ? cleanTitleCandidate(frontmatterTitle) : "",
    levelOneHeading ?? "",
    readableHtmlTitle ?? "",
    firstReadableLine ?? "",
  ].find(usableTitleCandidate) ?? "";
  if (!firstLine) return null;

  const characters = Array.from(firstLine);
  return characters.length > 60
    ? `${characters.slice(0, 60).join("")}…`
    : firstLine;
}

export function isGenericImportedTitle(title: string): boolean {
  if (/^\s*-{3,}\s*$/.test(title) || /<[^>]+>/.test(title)) return true;
  const normalized = title
    .trim()
    .replace(/^[#>*_`~\-\s]+|[*_`~\s]+$/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();

  return [
    "conversation overview",
    "conversation summary",
    "untitled",
    "new chat",
    "new conversation",
    "无标题",
    "未命名",
  ].includes(normalized) || /^未命名导入记录(?:\s+\d+)?$/.test(normalized);
}

export function resolveImportedTitle(title: string, sourceText: string): string {
  if (!isGenericImportedTitle(title)) return title;

  const importedContent = readImportedContent(sourceText);
  const firstUserMessage = importedContent.messages
    .find((message) => message.role === "用户");
  return titleFromText(firstUserMessage?.text ?? "")
    ?? titleFromText(importedContent.fullText)
    ?? title;
}

export function shouldDisplaySummary(summary: string): boolean {
  const trimmed = summary.trim();
  if (!trimmed) return false;
  if (/^(?:---+|tags?|aliases|cssclasses|created|updated|date)\s*:/i.test(trimmed)
    || /<[^>]+>/.test(trimmed)) return false;

  const latinCount = trimmed.match(/[A-Za-z]/g)?.length ?? 0;
  const chineseCount = trimmed.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const languageCharacterCount = latinCount + chineseCount;
  const isEnglishDominant = latinCount >= 12
    && languageCharacterCount > 0
    && latinCount / languageCharacterCount >= 0.7;

  return !isEnglishDominant;
}

export function readImportedContent(sourceText: string): ReadableSourceContent {
  const trimmed = sourceText.trim();
  if (!trimmed) {
    return {
      messages: [],
      previewMessages: [],
      messageCount: 0,
      preview: "",
      fullText: "",
      isConversation: false,
    };
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    const root = asObject(parsed);
    const chatGptMessages = root ? chatGptMappingMessages(root) : [];
    if (chatGptMessages.length) return conversationContent(chatGptMessages);

    const chatMessages = root?.chat_messages;
    if (Array.isArray(chatMessages)) {
      const messages = chatMessages
        .map((item): ReadableSourceMessage | null => {
          const message = asObject(item);
          if (!message) return null;
          const text = messageText(message);
          const assets = messageAssets(message);
          if (!text && !assets.length) return null;
          return {
            role: roleLabel(message.sender),
            text,
            createdAt: nonEmptyString(message.created_at),
            assets,
          };
        })
        .filter((message): message is ReadableSourceMessage => Boolean(message));

      if (messages.length) return conversationContent(messages);
    }

    const fullText = JSON.stringify(parsed, null, 2);
    return {
      messages: [],
      previewMessages: [],
      messageCount: 0,
      preview: makePreview(fullText),
      fullText,
      isConversation: false,
    };
  } catch {
    return {
      messages: [],
      previewMessages: [],
      messageCount: 0,
      preview: makePreview(trimmed),
      fullText: trimmed,
      isConversation: false,
    };
  }
}
