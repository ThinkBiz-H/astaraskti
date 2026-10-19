// Pure computation from the order's actual tracking.estimatedDeliveryDate —
// renders nothing (returns null) when that field isn't set, so this never
// fabricates a delivery date for an order that has none.
export function getDeliveryEstimate(estimatedDeliveryDate, orderStatus) {
  if (!estimatedDeliveryDate) return null;
  if (['Delivered', 'Cancelled', 'Returned', 'Refunded'].includes(orderStatus)) return null;

  const eta = new Date(estimatedDeliveryDate);
  const now = new Date();
  const etaDay = new Date(eta.getFullYear(), eta.getMonth(), eta.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((etaDay - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: 'Delivery Delayed', detail: `Originally expected ${eta.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`, delayed: true };
  }
  if (diffDays === 0) {
    return { label: 'Arriving Today', detail: null, delayed: false };
  }
  if (diffDays === 1) {
    return { label: 'Arriving Tomorrow', detail: null, delayed: false };
  }
  return { label: `${diffDays} Days Left`, detail: `Expected by ${eta.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`, delayed: false };
}
