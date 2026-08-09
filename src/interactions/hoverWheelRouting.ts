const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;
const DEFAULT_LINE_HEIGHT = 16;
const HOVER_WHEEL_PANEL_SELECTOR = "[data-hover-wheel-panel]";
const HOVER_WHEEL_SCROLL_SELECTOR = "[data-hover-wheel-scroll]";

function targetElement(target: EventTarget | null): HTMLElement | null {
  if (target instanceof HTMLElement) return target;
  return target instanceof Node ? target.parentElement : null;
}

function isVerticalScrollContainer(element: HTMLElement): boolean {
  const overflowY = getComputedStyle(element).overflowY;
  return /^(auto|scroll|overlay)$/.test(overflowY)
    && element.scrollHeight > element.clientHeight;
}

function wheelDeltaInPixels(event: WheelEvent, viewportHeight: number): number {
  if (event.deltaMode === DOM_DELTA_LINE) return event.deltaY * DEFAULT_LINE_HEIGHT;
  if (event.deltaMode === DOM_DELTA_PAGE) return event.deltaY * Math.max(viewportHeight, 1);
  return event.deltaY;
}

function hasNativeScrollAncestor(origin: HTMLElement, panel: HTMLElement): boolean {
  let current: HTMLElement | null = origin;
  while (current && current !== panel) {
    if (isVerticalScrollContainer(current)) return true;
    current = current.parentElement;
  }
  return false;
}

/**
 * 悬浮在卡片的标题/工具栏时，仍可滚动该卡片的默认正文区。
 * 鼠标已位于真实滚动层时完全交给浏览器原生滚动，绝不逐个 wheel 事件写 scrollTop；
 * 仅在必要的兜底路径上合并为每帧一次写入，避免 WebView2 大列表反复合成。
 */
export function installHoverWheelRouting(documentRoot: Document): () => void {
  const pending = new Map<HTMLElement, { delta: number; frame: number | null }>();

  const scheduleFallbackScroll = (target: HTMLElement, delta: number) => {
    const current = pending.get(target) ?? { delta: 0, frame: null };
    current.delta += delta;
    pending.set(target, current);
    if (current.frame !== null) return;
    current.frame = window.requestAnimationFrame(() => {
      current.frame = null;
      const maxScrollTop = Math.max(0, target.scrollHeight - target.clientHeight);
      if (maxScrollTop > 0 && current.delta !== 0) {
        target.scrollTop = Math.min(maxScrollTop, Math.max(0, target.scrollTop + current.delta));
      }
      current.delta = 0;
      pending.delete(target);
    });
  };

  const handleWheel = (event: WheelEvent) => {
    if (
      event.defaultPrevented
      || event.ctrlKey
      || event.metaKey
      || event.deltaY === 0
      || Math.abs(event.deltaX) > Math.abs(event.deltaY)
    ) return;

    const origin = targetElement(event.target);
    const panel = origin?.closest<HTMLElement>(HOVER_WHEEL_PANEL_SELECTOR);
    if (!origin || !panel || hasNativeScrollAncestor(origin, panel)) return;

    const fallback = panel.matches(HOVER_WHEEL_SCROLL_SELECTOR)
      ? panel
      : panel.querySelector<HTMLElement>(HOVER_WHEEL_SCROLL_SELECTOR);
    if (!fallback || !isVerticalScrollContainer(fallback)) return;

    event.preventDefault();
    scheduleFallbackScroll(fallback, wheelDeltaInPixels(event, fallback.clientHeight));
  };

  documentRoot.addEventListener("wheel", handleWheel, { capture: true, passive: false });
  return () => {
    documentRoot.removeEventListener("wheel", handleWheel, { capture: true });
    pending.forEach(({ frame }) => {
      if (frame !== null) window.cancelAnimationFrame(frame);
    });
    pending.clear();
  };
}
