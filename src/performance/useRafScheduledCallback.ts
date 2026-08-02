import { useCallback, useEffect, useRef } from "react";

/**
 * 将滚动、缩放和 ResizeObserver 产生的高频任务合并到下一帧。
 * 同一帧只执行最后一次调用，避免几何测量反复触发布局和 React 更新。
 */
export function useRafScheduledCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
): (...args: Args) => void {
  const callbackRef = useRef(callback);
  const frameRef = useRef<number | null>(null);
  const argsRef = useRef<Args | null>(null);
  callbackRef.current = callback;

  const schedule = useCallback((...args: Args) => {
    argsRef.current = args;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const latestArgs = argsRef.current;
      argsRef.current = null;
      if (latestArgs) callbackRef.current(...latestArgs);
    });
  }, []);

  useEffect(() => () => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    argsRef.current = null;
  }, []);

  return schedule;
}
