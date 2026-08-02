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

export type ConnectorRect = {
  left: number;
  right: number;
  top: number;
  height: number;
};

export type CardToCardConnector = {
  left: number;
  top: number;
  width: number;
};

export type ConnectorMetrics = CardToCardConnector & {
  opacity?: number;
};

/**
 * 关联线只跨越两张卡片之间的空隙，两个端点圆心分别压在左右卡片边缘。
 * 不在调用处用像素补偿，避免不同页面出现连接点漂移。
 */
export function measureCardToCardConnector(
  container: Pick<ConnectorRect, "left" | "top">,
  sourceCard: ConnectorRect,
  targetCard: Pick<ConnectorRect, "left">,
): CardToCardConnector {
  const left = sourceCard.right - container.left;
  const targetLeft = targetCard.left - container.left;

  return {
    left,
    top: sourceCard.top - container.top + sourceCard.height / 2,
    width: Math.max(0, targetLeft - left),
  };
}

export function connectorMetricsEqual(
  left: ConnectorMetrics | null,
  right: ConnectorMetrics | null,
  epsilon = 0.25,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return Math.abs(left.top - right.top) <= epsilon
    && Math.abs(left.left - right.left) <= epsilon
    && Math.abs(left.width - right.width) <= epsilon
    && Math.abs((left.opacity ?? 1) - (right.opacity ?? 1)) <= 0.01;
}
