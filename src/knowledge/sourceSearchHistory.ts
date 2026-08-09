const SOURCE_SEARCH_HISTORY_KEY = "nanfeng-knowledge-base:source-search-history:v1";
const SOURCE_BODY_SEARCH_HISTORY_KEY = "nanfeng-knowledge-base:source-body-search-history:v1";
const MAX_SOURCE_SEARCH_HISTORY = 10;

type StorageReader = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function normalizeSearchTerm(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function readSearchHistory(storage: StorageReader | null, key: string) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "[]");
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

function rememberSearch(value: string, storage: StorageReader | null, key: string) {
  const normalized = normalizeSearchTerm(value);
  if (!storage || !normalized) return readSearchHistory(storage, key);
  const next = [
    normalized,
    ...readSearchHistory(storage, key).filter(
      (item) => item.toLocaleLowerCase("zh-CN") !== normalized.toLocaleLowerCase("zh-CN"),
    ),
  ].slice(0, MAX_SOURCE_SEARCH_HISTORY);
  storage.setItem(key, JSON.stringify(next));
  return next;
}

export function readSourceSearchHistory(
  storage: StorageReader | null = typeof window === "undefined" ? null : window.localStorage,
) {
  return readSearchHistory(storage, SOURCE_SEARCH_HISTORY_KEY);
}

export function rememberSourceSearch(
  value: string,
  storage: StorageReader | null = typeof window === "undefined" ? null : window.localStorage,
) {
  return rememberSearch(value, storage, SOURCE_SEARCH_HISTORY_KEY);
}

export function clearSourceSearchHistory(
  storage: StorageReader | null = typeof window === "undefined" ? null : window.localStorage,
) {
  storage?.removeItem(SOURCE_SEARCH_HISTORY_KEY);
}

export function readSourceBodySearchHistory(
  storage: StorageReader | null = typeof window === "undefined" ? null : window.localStorage,
) {
  return readSearchHistory(storage, SOURCE_BODY_SEARCH_HISTORY_KEY);
}

export function rememberSourceBodySearch(
  value: string,
  storage: StorageReader | null = typeof window === "undefined" ? null : window.localStorage,
) {
  return rememberSearch(value, storage, SOURCE_BODY_SEARCH_HISTORY_KEY);
}

export function clearSourceBodySearchHistory(
  storage: StorageReader | null = typeof window === "undefined" ? null : window.localStorage,
) {
  storage?.removeItem(SOURCE_BODY_SEARCH_HISTORY_KEY);
}
