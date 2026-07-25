export function connectionOpacity(
  cardCenterY: number,
  listTop: number,
  listBottom: number,
  fadeDistance = 64,
): number {
  const edgeDistance = Math.min(
    cardCenterY - listTop,
    listBottom - cardCenterY,
  );
  return Math.max(0, Math.min(1, edgeDistance / Math.max(1, fadeDistance)));
}
