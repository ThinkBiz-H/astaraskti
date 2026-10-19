import { Link } from 'react-router-dom';
import { AppImage } from '@/components/common/Elements';
import { formatCurrency } from '@/utils/format';

export function OrderSummaryCard({ order }) {
  return (
    <div className="card space-y-4 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">Order Summary</h2>

      <div className="space-y-3">
        {order.items?.map((item, i) => {
          const variantLabel = item.variant?.attributes?.length
            ? item.variant.attributes.map((a) => `${a.key}: ${a.value}`).join(', ')
            : [item.color, item.size].filter(Boolean).join(' / ') || null;
          return (
            <div key={i} className="flex gap-3 border-b border-night-900/5 pb-3 last:border-0 last:pb-0">
              {item.thumbnail && (
                <Link to={item.product?.slug ? `/product/${item.product.slug}` : '#'}>
                  <AppImage src={item.thumbnail} alt={item.title} className="h-16 w-16 shrink-0 rounded-sm object-cover" />
                </Link>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                {variantLabel && <p className="text-xs text-night-900/50">{variantLabel}</p>}
                {item.sku && <p className="text-xs text-night-900/40">SKU: {item.sku}</p>}
                <p className="mt-1 text-xs text-night-900/60">Qty: {item.quantity} × {formatCurrency(item.price)}</p>
              </div>
              <p className="shrink-0 text-sm font-medium">{formatCurrency(item.price * item.quantity)}</p>
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5 border-t border-night-900/10 pt-3 text-sm">
        <div className="flex justify-between text-night-900/70">
          <span>Subtotal</span>
          <span>{formatCurrency(order.subTotal)}</span>
        </div>
        {order.coupon?.discountAmount > 0 && (
          <div className="flex justify-between text-green-700">
            <span>Coupon Discount {order.coupon.code ? `(${order.coupon.code})` : ''}</span>
            <span>−{formatCurrency(order.coupon.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-night-900/70">
          <span>GST</span>
          <span>{formatCurrency(order.tax)}</span>
        </div>
        <div className="flex justify-between text-night-900/70">
          <span>Shipping</span>
          <span>{order.shippingCharge > 0 ? formatCurrency(order.shippingCharge) : 'Free'}</span>
        </div>
        <div className="flex justify-between border-t border-night-900/10 pt-2 font-display text-base font-semibold text-night-900">
          <span>Grand Total</span>
          <span>{formatCurrency(order.grandTotal)}</span>
        </div>
        {order.coupon?.discountAmount > 0 && (
          <p className="pt-1 text-right text-xs font-medium text-green-700">
            You saved {formatCurrency(order.coupon.discountAmount)} on this order
          </p>
        )}
      </div>
    </div>
  );
}
