export type ReadableSourceMessage = {
  role: string;
  text: string;
  createdAt: string | null;
};

export type ReadableSourceContent = {
  messages: ReadableSourceMessage[];
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

function messageText(message: JsonObject): string {
  const directText = nonEmptyString(message.text);
  if (directText) return directText;

  if (!Array.isArray(message.content)) return "";
  return message.content
    .map((block) => nonEmptyString(asObject(block)?.text))
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
}

function roleLabel(value: unknown): string {
  const role = nonEmptyString(value)?.toLocaleLowerCase();
  if (role === "human" || role === "user") return "用户";
  if (role === "assistant" || role === "ai") return "助手";
  if (role === "system") return "系统";
  return nonEmptyString(value) ?? "记录";
}

function makePreview(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 760 ? `${compact.slice(0, 760)}…` : compact;
}

function titleFromText(value: string): string | null {
  const firstLine = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^[#>*_`~\-\s]+/, "")
    .replace(/[*_`~\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!firstLine) return null;

  const characters = Array.from(firstLine);
  return characters.length > 60
    ? `${characters.slice(0, 60).join("")}…`
    : firstLine;
}

export function isGenericImportedTitle(title: string): boolean {
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

  const firstUserMessage = readImportedContent(sourceText).messages
    .find((message) => message.role === "用户");
  return titleFromText(firstUserMessage?.text ?? "") ?? title;
}

export function shouldDisplaySummary(summary: string): boolean {
  const trimmed = summary.trim();
  if (!trimmed) return false;

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
      messageCount: 0,
      preview: "",
      fullText: "",
      isConversation: false,
    };
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    const root = asObject(parsed);
    const chatMessages = root?.chat_messages;
    if (Array.isArray(chatMessages)) {
      const messages = chatMessages
        .map((item): ReadableSourceMessage | null => {
          const message = asObject(item);
          if (!message) return null;
          const text = messageText(message);
          if (!text) return null;
          return {
            role: roleLabel(message.sender),
            text,
            createdAt: nonEmptyString(message.created_at),
          };
        })
        .filter((message): message is ReadableSourceMessage => Boolean(message));

      if (messages.length) {
        const fullText = messages
          .map((message) => `${message.role}\n${message.text}`)
          .join("\n\n");
        return {
          messages,
          messageCount: messages.length,
          preview: makePreview(fullText),
          fullText,
          isConversation: true,
        };
      }
    }

    const fullText = JSON.stringify(parsed, null, 2);
    return {
      messages: [],
      messageCount: 0,
      preview: makePreview(fullText),
      fullText,
      isConversation: false,
    };
  } catch {
    return {
      messages: [],
      messageCount: 0,
      preview: makePreview(trimmed),
      fullText: trimmed,
      isConversation: false,
    };
  }
}
