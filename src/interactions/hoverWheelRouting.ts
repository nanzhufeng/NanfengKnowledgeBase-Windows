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

function findNativeScrollAncestor(origin: HTMLElement, panel: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = origin;
  while (current && current !== panel) {
    if (isVerticalScrollContainer(current)) return current;
    current = current.parentElement;
  }
  return null;
}

/**
 * 悬浮在卡片的标题/工具栏时，仍可滚动该卡片的默认正文区。
 * 鼠标已位于真实滚动层时通常交给浏览器原生滚动；仅当滚轮事务仍锁定旧卡时改投当前卡。
 * 改投与标题区兜底都合并为每帧一次写入，避免 WebView2 大列表反复合成。
 */
export function installHoverWheelRouting(documentRoot: Document): () => void {
  const pending = new Map<HTMLElement, { delta: number; frame: number | null }>();
  let hoveredPanel: HTMLElement | null = null;

  const cancelPendingExcept = (activeTarget: HTMLElement | null) => {
    pending.forEach(({ frame }, target) => {
      if (target === activeTarget) return;
      if (frame !== null) window.cancelAnimationFrame(frame);
      pending.delete(target);
    });
  };

  const scheduleFallbackScroll = (target: HTMLElement, delta: number) => {
    // 一个时刻只允许鼠标当前命中的滚动层持有待执行增量；切换卡片时立即丢弃旧卡尾帧。
    cancelPendingExcept(target);
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

  const handlePointerOver = (event: PointerEvent) => {
    const panel = targetElement(event.target)?.closest<HTMLElement>(HOVER_WHEEL_PANEL_SELECTOR) ?? null;
    if (panel === hoveredPanel) return;
    hoveredPanel = panel;
    // 鼠标一跨卡就撤销上一张卡尚未落地的尾帧，不等待下一次滚轮事件。
    cancelPendingExcept(null);
  };

  const handleWheel = (event: WheelEvent) => {
    if (
      event.defaultPrevented
      || event.ctrlKey
      || event.metaKey
      || event.deltaY === 0
      || Math.abs(event.deltaX) > Math.abs(event.deltaY)
    ) return;

    const eventOrigin = targetElement(event.target);
    const eventPanel = eventOrigin?.closest<HTMLElement>(HOVER_WHEEL_PANEL_SELECTOR) ?? null;
    // Chromium/WebView2 会在一段连续滚轮事务中保留最初的 event.target，即使鼠标已经跨到另一张卡。
    // 每个事件按当前坐标重新命中，避免卡二的惯性事务继续滚动卡二而不是悬浮中的卡三。
    const pointedOrigin = targetElement(documentRoot.elementFromPoint(event.clientX, event.clientY));
    const pointedPanel = pointedOrigin?.closest<HTMLElement>(HOVER_WHEEL_PANEL_SELECTOR) ?? null;
    const origin = pointedPanel ? pointedOrigin : eventOrigin;
    const panel = pointedPanel ?? eventPanel;
    if (!origin || !panel) {
      hoveredPanel = null;
      cancelPendingExcept(null);
      return;
    }
    if (panel !== hoveredPanel) {
      hoveredPanel = panel;
      cancelPendingExcept(null);
    }

    const nativeScroller = findNativeScrollAncestor(origin, panel);
    const eventNativeScroller = eventOrigin && eventPanel
      ? findNativeScrollAncestor(eventOrigin, eventPanel)
      : null;
    const wheelTransactionIsStale = pointedPanel !== null
      && (pointedPanel !== eventPanel || nativeScroller !== eventNativeScroller);
    if (nativeScroller && !wheelTransactionIsStale) {
      cancelPendingExcept(null);
      return;
    }

    const fallback = nativeScroller ?? (panel.matches(HOVER_WHEEL_SCROLL_SELECTOR)
      ? panel
      : panel.querySelector<HTMLElement>(HOVER_WHEEL_SCROLL_SELECTOR));
    if (!fallback || !isVerticalScrollContainer(fallback)) return;

    event.preventDefault();
    scheduleFallbackScroll(fallback, wheelDeltaInPixels(event, fallback.clientHeight));
  };

  documentRoot.addEventListener("pointerover", handlePointerOver, { capture: true, passive: true });
  documentRoot.addEventListener("wheel", handleWheel, { capture: true, passive: false });
  return () => {
    documentRoot.removeEventListener("pointerover", handlePointerOver, { capture: true });
    documentRoot.removeEventListener("wheel", handleWheel, { capture: true });
    pending.forEach(({ frame }) => {
      if (frame !== null) window.cancelAnimationFrame(frame);
    });
    pending.clear();
    hoveredPanel = null;
  };
}
