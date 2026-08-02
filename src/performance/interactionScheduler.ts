export type IdleWorkOptions = {
  delayMs?: number;
  timeoutMs?: number;
};

type IdleCallbackHost = typeof globalThis & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * 把非首屏工作放到一次明确的交互安静期之后。延迟用于保护刚完成的点击和首帧，
 * requestIdleCallback 用于避免后台维护与紧随其后的滚动、选择操作争抢主线程。
 */
export function scheduleIdleWork(
  work: () => void,
  options: IdleWorkOptions = {},
): () => void {
  const { delayMs = 600, timeoutMs = 2_000 } = options;
  let cancelled = false;
  let idleHandle: number | null = null;
  const host = globalThis as IdleCallbackHost;
  const timer = host.setTimeout(() => {
    if (cancelled) return;
    if (host.requestIdleCallback) {
      idleHandle = host.requestIdleCallback(() => {
        if (!cancelled) work();
      }, { timeout: timeoutMs });
      return;
    }
    work();
  }, delayMs);

  return () => {
    cancelled = true;
    host.clearTimeout(timer);
    if (idleHandle !== null) {
      host.cancelIdleCallback?.(idleHandle);
    }
  };
}

/**
 * 长任务每处理一个独立单元都经过这里，把输入、布局和绘制机会还给 WebView。
 */
export async function yieldToInteraction(signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return false;
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
  return !signal?.aborted;
}
