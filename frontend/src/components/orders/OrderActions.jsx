import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { X, ShoppingCart, Truck, MessageCircle, AlertCircle, Star } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { contactApi } from '@/api/endpoints/misc';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { getErrorMessage } from '@/api/axiosClient';
import { canCancelOrder, canReturnOrder } from './orderStatus';

function RaiseComplaintModal({ order, onClose }) {
  const user = useSelector(selectCurrentUser);
  const [message, setMessage] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      contactApi.submitEnquiry({
        name: user?.name || 'Customer',
        email: user?.email || '',
        mobile: user?.mobile || '',
        subject: `Complaint - Order #${order.orderNumber}`,
        message: message.trim(),
      }),
    onSuccess: () => { toast.success('Complaint raised — our team will reach out to you'); onClose(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg">Raise a Complaint</h2>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <p className="mb-3 text-xs text-night-900/50">Order #{order.orderNumber}</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the issue with this order…"
          className="input-field"
          rows={4}
        />
        <button
          onClick={() => mutation.mutate()}
          disabled={!message.trim() || mutation.isPending}
          className="btn-primary mt-4 w-full"
        >
          {mutation.isPending ? 'Submitting…' : 'Submit Complaint'}
        </button>
      </div>
    </div>
  );
}

export function OrderActions({ order, onCancel, cancelling, onRequestReturn, onDownloadInvoice }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [showComplaint, setShowComplaint] = useState(false);

  const handleBuyAgain = () => {
    (order.items || []).forEach((item) => {
      addToCart({ productId: item.product?._id || item.product, variantId: item.variant?._id || item.variant, quantity: item.quantity });
    });
    navigate('/cart');
  };

  const handleTrackOrder = () => {
    document.getElementById('shipment-tracking-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const firstProductSlug = order.items?.[0]?.product?.slug;

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={onDownloadInvoice} className="btn-outline text-sm">Download Invoice</button>

      {canCancelOrder(order.orderStatus) && (
        <button onClick={onCancel} disabled={cancelling} className="btn-outline text-sm text-maroon-700">Cancel Order</button>
      )}
      {canReturnOrder(order) && (
        <button onClick={onRequestReturn} className="btn-outline text-sm text-maroon-700">Return Order</button>
      )}
      {order.orderStatus === 'Delivered' && (
        <button onClick={handleBuyAgain} className="btn-outline flex items-center gap-1.5 text-sm"><ShoppingCart size={14} /> Buy Again</button>
      )}
      {!['Delivered', 'Cancelled', 'Returned', 'Refunded'].includes(order.orderStatus) && (
        <button onClick={handleTrackOrder} className="btn-outline flex items-center gap-1.5 text-sm"><Truck size={14} /> Track Order</button>
      )}
      {order.orderStatus === 'Delivered' && firstProductSlug && (
        <button onClick={() => navigate(`/product/${firstProductSlug}`)} className="btn-outline flex items-center gap-1.5 text-sm"><Star size={14} /> Write Review</button>
      )}
      <button onClick={() => navigate('/contact')} className="btn-outline flex items-center gap-1.5 text-sm"><MessageCircle size={14} /> Contact Support</button>
      <button onClick={() => setShowComplaint(true)} className="btn-outline flex items-center gap-1.5 text-sm text-maroon-700"><AlertCircle size={14} /> Raise Complaint</button>

      {showComplaint && <RaiseComplaintModal order={order} onClose={() => setShowComplaint(false)} />}
    </div>
  );
}
