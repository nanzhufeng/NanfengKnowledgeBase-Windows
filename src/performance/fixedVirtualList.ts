import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

export type FixedVirtualListRange = {
  start: number;
  end: number;
  totalHeight: number;
};

export function calculateFixedVirtualListRange({
  itemCount,
  itemHeight,
  scrollTop,
  viewportHeight,
  overscan = 6,
}: {
  itemCount: number;
  itemHeight: number;
  scrollTop: number;
  viewportHeight: number;
  overscan?: number;
}): FixedVirtualListRange {
  const safeCount = Math.max(0, itemCount);
  const safeHeight = Math.max(1, itemHeight);
  const safeTop = Math.max(0, scrollTop);
  const visibleEnd = safeTop + Math.max(0, viewportHeight);
  const firstVisible = Math.min(safeCount, Math.floor(safeTop / safeHeight));
  const lastVisibleExclusive = Math.min(safeCount, Math.ceil(visibleEnd / safeHeight));

  return {
    start: Math.max(0, firstVisible - overscan),
    end: Math.min(safeCount, Math.max(lastVisibleExclusive, 1) + overscan),
    totalHeight: safeCount * safeHeight,
  };
}

export function fixedVirtualListScrollTop({
  index,
  itemCount,
  itemHeight,
  viewportHeight,
  align = "center",
}: {
  index: number;
  itemCount: number;
  itemHeight: number;
  viewportHeight: number;
  align?: "start" | "center" | "end";
}): number {
  const safeCount = Math.max(0, itemCount);
  const safeHeight = Math.max(1, itemHeight);
  const safeIndex = Math.min(Math.max(0, index), Math.max(0, safeCount - 1));
  const maxScrollTop = Math.max(0, safeCount * safeHeight - Math.max(0, viewportHeight));
  const itemTop = safeIndex * safeHeight;
  const alignedTop = align === "start"
    ? itemTop
    : align === "end"
      ? itemTop - viewportHeight + safeHeight
      : itemTop - viewportHeight / 2 + safeHeight / 2;
  return Math.min(maxScrollTop, Math.max(0, alignedTop));
}

/**
 * 固定行高列表的唯一窗口化实现。
 * 数据数组仍由原读取模型持有；此 Hook 只限制同时挂载到 DOM 的行数，
 * 避免大量卡片、阴影和图标同时进入 WebView2 合成树。
 */
export function useFixedVirtualList({
  scrollElementRef,
  itemCount,
  itemHeight,
  overscan = 6,
  enabled = true,
}: {
  scrollElementRef: RefObject<HTMLElement | null>;
  itemCount: number;
  itemHeight: number;
  overscan?: number;
  /**
   * 条件渲染的列表必须把当前可见状态传进来。
   * 这样容器真正挂载时会重新测量并绑定 ResizeObserver，避免一直沿用 0 高度的保底 7 行。
   */
  enabled?: boolean;
}) {
  const [metrics, setMetrics] = useState({ scrollTop: 0, viewportHeight: 0 });
  const frameRef = useRef<number | null>(null);

  const updateMetrics = useCallback(() => {
    const element = scrollElementRef.current;
    if (!element) return;
    const next = {
      scrollTop: element.scrollTop,
      viewportHeight: element.clientHeight,
    };
    setMetrics((current) => (
      Math.abs(current.scrollTop - next.scrollTop) < .5
        && current.viewportHeight === next.viewportHeight
        ? current
        : next
    ));
  }, [scrollElementRef]);

  const scheduleMetricsUpdate = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      updateMetrics();
    });
  }, [updateMetrics]);

  useLayoutEffect(() => {
    if (!enabled) return undefined;
    updateMetrics();
    const element = scrollElementRef.current;
    if (!element) return undefined;
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(scheduleMetricsUpdate);
    observer?.observe(element);
    window.addEventListener("resize", scheduleMetricsUpdate);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", scheduleMetricsUpdate);
    };
  }, [enabled, scheduleMetricsUpdate, scrollElementRef, updateMetrics]);

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
  }, []);

  const range = useMemo(() => calculateFixedVirtualListRange({
    itemCount,
    itemHeight,
    scrollTop: metrics.scrollTop,
    viewportHeight: metrics.viewportHeight,
    overscan,
  }), [itemCount, itemHeight, metrics.scrollTop, metrics.viewportHeight, overscan]);

  const visibleIndexes = useMemo(
    () => Array.from({ length: Math.max(0, range.end - range.start) }, (_, offset) => range.start + offset),
    [range.end, range.start],
  );

  const scrollToIndex = useCallback((index: number, align: "start" | "center" | "end" = "center") => {
    const element = scrollElementRef.current;
    if (!element) return;
    element.scrollTop = fixedVirtualListScrollTop({
      index,
      itemCount,
      itemHeight,
      viewportHeight: element.clientHeight,
      align,
    });
    updateMetrics();
  }, [itemCount, itemHeight, scrollElementRef, updateMetrics]);

  return {
    ...range,
    itemHeight,
    visibleIndexes,
    onScroll: scheduleMetricsUpdate,
    scrollToIndex,
  };
}
