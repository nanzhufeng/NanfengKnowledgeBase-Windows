import { describe, expect, it } from "vitest";
import {
  clearSourceBodySearchHistory,
  clearSourceSearchHistory,
  readSourceBodySearchHistory,
  readSourceSearchHistory,
  rememberSourceBodySearch,
  rememberSourceSearch,
} from "./sourceSearchHistory";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("source search history", () => {
  it("normalizes, deduplicates and keeps the newest term first", () => {
    const storage = memoryStorage();
    rememberSourceSearch("  数据中心   利润 ", storage);
    rememberSourceSearch("AI 基础设施", storage);
    rememberSourceSearch("数据中心 利润", storage);
    expect(readSourceSearchHistory(storage)).toEqual(["数据中心 利润", "AI 基础设施"]);
  });

  it("clears persisted history", () => {
    const storage = memoryStorage();
    rememberSourceSearch("全文检索", storage);
    clearSourceSearchHistory(storage);
    expect(readSourceSearchHistory(storage)).toEqual([]);
  });

  it("keeps正文搜索历史 separate from卡二搜索历史", () => {
    const storage = memoryStorage();
    rememberSourceSearch("全部笔记关键词", storage);
    rememberSourceBodySearch("正文定位关键词", storage);
    expect(readSourceSearchHistory(storage)).toEqual(["全部笔记关键词"]);
    expect(readSourceBodySearchHistory(storage)).toEqual(["正文定位关键词"]);

    clearSourceBodySearchHistory(storage);
    expect(readSourceBodySearchHistory(storage)).toEqual([]);
    expect(readSourceSearchHistory(storage)).toEqual(["全部笔记关键词"]);
  });
});
