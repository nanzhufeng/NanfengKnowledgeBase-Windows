const SOURCE_SEARCH_HISTORY_KEY = "nanfeng-knowledge-base:source-search-history:v1";
const MAX_SOURCE_SEARCH_HISTORY = 10;

type StorageReader = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function normalizeSearchTerm(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function readSourceSearchHistory(
  storage: StorageReader | null = typeof window === "undefined" ? null : window.localStorage,
) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(SOURCE_SEARCH_HISTORY_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .map(normalizeSearchTerm)
      .filter(Boolean)
      .slice(0, MAX_SOURCE_SEARCH_HISTORY);
  } catch {
    return [];
  }
}

export function rememberSourceSearch(
  value: string,
  storage: StorageReader | null = typeof window === "undefined" ? null : window.localStorage,
) {
  const normalized = normalizeSearchTerm(value);
  if (!storage || !normalized) return readSourceSearchHistory(storage);
  const next = [
    normalized,
    ...readSourceSearchHistory(storage).filter(
      (item) => item.toLocaleLowerCase("zh-CN") !== normalized.toLocaleLowerCase("zh-CN"),
    ),
  ].slice(0, MAX_SOURCE_SEARCH_HISTORY);
  storage.setItem(SOURCE_SEARCH_HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function clearSourceSearchHistory(
  storage: StorageReader | null = typeof window === "undefined" ? null : window.localStorage,
) {
  storage?.removeItem(SOURCE_SEARCH_HISTORY_KEY);
}
