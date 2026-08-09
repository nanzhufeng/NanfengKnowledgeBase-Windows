import { describe, expect, it } from "vitest";
import {
  calculateFixedVirtualListRange,
  fixedVirtualListScrollTop,
} from "./fixedVirtualList";

describe("fixed virtual list", () => {
  it("只保留可视范围及缓冲行，而不是将千条数据同时渲染", () => {
    const range = calculateFixedVirtualListRange({
      itemCount: 3_000,
      itemHeight: 82,
      scrollTop: 82 * 1_200,
      viewportHeight: 640,
      overscan: 6,
    });

    expect(range.totalHeight).toBe(246_000);
    expect(range.start).toBe(1_194);
    expect(range.end - range.start).toBeLessThan(24);
  });

  it("定位条可以准确定位到首、中、末项且不越过滚动边界", () => {
    expect(fixedVirtualListScrollTop({
      index: 0,
      itemCount: 1_000,
      itemHeight: 82,
      viewportHeight: 656,
    })).toBe(0);
    expect(fixedVirtualListScrollTop({
      index: 500,
      itemCount: 1_000,
      itemHeight: 82,
      viewportHeight: 656,
    })).toBe(40_713);
    expect(fixedVirtualListScrollTop({
      index: 999,
      itemCount: 1_000,
      itemHeight: 82,
      viewportHeight: 656,
    })).toBe(81_344);
  });
});
