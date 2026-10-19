import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import SEO from '@/components/common/SEO';
import { EmptyState, AppImage } from '@/components/common/Elements';
import { formatCurrency } from '@/utils/format';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';

export default function CartPage() {
  const {
    items, subTotal, tax, grandTotal, appliedCoupon, isLoading, isApplyingCoupon,
    updateQuantity, removeItem, applyCoupon, removeCoupon,
  } = useCart();
  const [couponCode, setCouponCode] = useState('');
  const navigate = useNavigate();

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    applyCoupon(couponCode.trim()).then(() => setCouponCode(''));
  };

  if (!isLoading && items.length === 0) {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Explore our sacred collection and find something meaningful."
          action={<Link to="/shop" className="btn-primary mt-2">Continue Shopping</Link>}
        />
      </div>
    );
  }

  return (
    <>
      <SEO title="Shopping Cart" noindex />
      <div className="container-page py-10">
        <h1 className="mb-8 font-display text-3xl">Shopping Cart</h1>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {items.map((item) => (
              <div key={`${item.product._id}-${item.variant?._id || ''}`} className="flex gap-4 border-b border-night-900/10 pb-5">
                <AppImage src={item.product.thumbnail?.url} alt={item.product.title} className="h-24 w-24 rounded-sm object-cover" />
                <div className="flex-1">
                  <Link to={`/product/${item.product.slug}`} className="font-medium">{item.product.title}</Link>
                  {(item.color || item.size) && (
                    <p className="text-xs text-night-900/50">{[item.color, item.size].filter(Boolean).join(' / ')}</p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center rounded-sm border border-night-900/15">
                      <button
                        onClick={() => updateQuantity({ productId: item.product._id, quantity: Math.max(1, item.quantity - 1), variantId: item.variant?._id })}
                        className="p-2"
                      ><Minus size={13} /></button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity({ productId: item.product._id, quantity: item.quantity + 1, variantId: item.variant?._id })}
                        className="p-2"
                      ><Plus size={13} /></button>
                    </div>
                    <span className="font-medium">{formatCurrency(item.itemTotal)}</span>
                  </div>
                </div>
                <button onClick={() => removeItem(item.product._id)} className="text-night-900/40 hover:text-maroon-700" aria-label="Remove">
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>

          <div className="card h-fit space-y-4 p-6">
            <h2 className="font-display text-xl">Order Summary</h2>

            {appliedCoupon ? (
              <div className="flex items-center justify-between rounded-sm bg-green-50 px-3 py-2 text-sm text-green-700">
                <span>Coupon <strong>{appliedCoupon.code}</strong> applied</span>
                <button onClick={() => removeCoupon()} className="text-xs underline">Remove</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Coupon code"
                  className="input-field"
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                />
                <button onClick={handleApplyCoupon} disabled={isApplyingCoupon} className="btn-outline shrink-0">
                  {isApplyingCoupon ? 'Applying…' : 'Apply'}
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex justify-between text-sm text-night-900/70">
                <span>Subtotal</span>
                <span>{formatCurrency(subTotal)}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-sm text-green-700">
                  <span>Coupon Discount</span>
                  <span>− {formatCurrency(appliedCoupon.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-night-900/70">
                <span>GST (18%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <p className="text-xs text-night-900/40">Shipping calculated at checkout.</p>
              <div className="mt-2 flex justify-between border-t border-night-900/10 pt-2 font-display text-lg font-semibold">
                <span>Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <button onClick={() => navigate('/checkout')} className="btn-primary w-full">Proceed to Checkout</button>
          </div>
        </div>
      </div>
    </>
  );
}
