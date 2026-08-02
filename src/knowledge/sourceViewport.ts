export function centeredSourceScrollTop({
  targetOffsetTop,
  targetHeight,
  viewportHeight,
  scrollHeight,
}: {
  targetOffsetTop: number;
  targetHeight: number;
  viewportHeight: number;
  scrollHeight: number;
}): number {
  const maximum = Math.max(0, scrollHeight - viewportHeight);
  const centered = targetOffsetTop - Math.max(0, viewportHeight - targetHeight) / 2;
  return Math.min(maximum, Math.max(0, centered));
}

export function shouldResetSourceArchiveEntry({
  previousMode,
  nextMode,
  hasNavigationTarget,
}: {
  previousMode: string;
  nextMode: string;
  hasNavigationTarget: boolean;
}): boolean {
  return previousMode !== "sources"
    && nextMode === "sources"
    && !hasNavigationTarget;
}

export function sourceCardIsFullyVisible({
  cardTop,
  cardBottom,
  viewportTop,
  viewportBottom,
  occlusionBottom,
}: {
  cardTop: number;
  cardBottom: number;
  viewportTop: number;
  viewportBottom: number;
  occlusionBottom: number;
}): boolean {
  const visibleTop = Math.max(viewportTop, occlusionBottom);
  return cardTop >= visibleTop && cardBottom <= viewportBottom;
}
