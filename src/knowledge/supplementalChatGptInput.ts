import { isGenericImportedTitle, resolveImportedTitle } from "../domain/importedContent";
import type {
  LegacyClassificationInput,
  LegacyClassificationInputRecord,
  SupplementalSourceEvidence,
} from "./legacyClassificationDryRun";

export type SupplementalChatGptSource = {
  filePath: string;
  fileName: string;
  sha256: string;
  conversations: unknown[];
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function conversationId(conversation: JsonObject): string | null {
  return stringValue(conversation.conversation_id) ?? stringValue(conversation.id);
}

function unixTimestamp(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const milliseconds = Math.abs(value) < 10_000_000_000 ? value * 1_000 : value;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function existingConversationIds(input: LegacyClassificationInput): Set<string> {
  const ids = new Set<string>();
  input.records.forEach((record) => {
    try {
      const root = asObject(JSON.parse(record.sourceText));
      const id = root ? conversationId(root) : null;
      if (root?.mapping && id) ids.add(id);
    } catch {
      // 非 ChatGPT JSON 记录不参与 conversation_id 去重。
    }
  });
  return ids;
}

export function mergeSupplementalChatGptConversations(
  input: LegacyClassificationInput,
  sources: SupplementalChatGptSource[],
): LegacyClassificationInput {
  if (!sources.length) throw new Error("至少需要一份补充 ChatGPT 导出文件");
  const existingIds = existingConversationIds(input);
  const seenSupplemental = new Set<string>();
  const sourceEvidence: SupplementalSourceEvidence[] = [];
  const appended: LegacyClassificationInputRecord[] = [];
  let overlapSkippedCount = 0;
  let crossFileDuplicateCount = 0;
  let nextRecordId = Math.max(0, ...input.records.map((record) => record.recordId)) + 1;

  for (const source of sources) {
    const localIds = new Set<string>();
    let missingConversationIdCount = 0;
    for (const value of source.conversations) {
      const conversation = asObject(value);
      const id = conversation ? conversationId(conversation) : null;
      if (!conversation || !id || !asObject(conversation.mapping)) {
        missingConversationIdCount += 1;
        continue;
      }
      if (localIds.has(id) || seenSupplemental.has(id)) {
        crossFileDuplicateCount += 1;
        continue;
      }
      localIds.add(id);
      seenSupplemental.add(id);
      if (existingIds.has(id)) {
        overlapSkippedCount += 1;
        continue;
      }

      const sourceText = JSON.stringify(conversation);
      const legacyTitle = stringValue(conversation.title) ?? "Untitled";
      const title = resolveImportedTitle(legacyTitle, sourceText);
      const originalAt = unixTimestamp(conversation.create_time)
        ?? unixTimestamp(conversation.update_time);
      appended.push({
        recordId: nextRecordId,
        recordOrigin: "supplemental_chatgpt",
        title,
        legacyTitle,
        titleResolutionStatus: title !== legacyTitle
          ? "recovered"
          : isGenericImportedTitle(legacyTitle)
            ? "unresolved_generic"
            : "unchanged",
        status: "normal",
        summary: "",
        currentJudgment: "",
        confirmedFacts: [],
        keyEvidence: [],
        openQuestions: [],
        nextActions: [],
        notes: "",
        sourceText,
        tags: [],
        sources: [{
          sourceType: "import",
          title: source.fileName,
          url: null,
          localPath: source.filePath,
          externalId: id,
        }],
        originalAt,
        createdAt: originalAt ?? input.generatedAt,
        updatedAt: unixTimestamp(conversation.update_time) ?? originalAt ?? input.generatedAt,
      });
      nextRecordId += 1;
    }
    sourceEvidence.push({
      filePath: source.filePath,
      fileName: source.fileName,
      sha256: source.sha256,
      rowCount: source.conversations.length,
      uniqueConversationIds: localIds.size,
      missingConversationIdCount,
    });
  }

  const normalizedBaseRecords = input.records.map((record) => ({
    ...record,
    recordOrigin: record.recordOrigin ?? "legacy_database" as const,
  }));
  return {
    ...input,
    reportVersion: 2,
    recordCount: normalizedBaseRecords.length + appended.length,
    records: [...normalizedBaseRecords, ...appended],
    supplementalSources: sourceEvidence,
    supplementalMerge: {
      baseRecordCount: input.records.length,
      existingChatGptConversationCount: existingIds.size,
      suppliedConversationCount: sources.reduce(
        (total, source) => total + source.conversations.length,
        0,
      ),
      suppliedUniqueConversationCount: seenSupplemental.size,
      overlapSkippedCount,
      crossFileDuplicateCount,
      addedConversationCount: appended.length,
    },
  };
}
