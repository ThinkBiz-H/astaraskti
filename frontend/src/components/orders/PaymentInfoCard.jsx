import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { CreditCard, Download, RotateCw } from 'lucide-react';
import { ordersApi, paymentsApi } from '@/api/endpoints/orders';
import { useRazorpay } from '@/hooks/useRazorpay';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { Badge } from '@/components/common/Elements';
import { formatCurrency, formatDate } from '@/utils/format';
import { getErrorMessage } from '@/api/axiosClient';
import { RAZORPAY_KEY_ID } from '@/utils/constants';

const PAYMENT_STATUS_TONE = {
  Pending: 'warning', Paid: 'success', Failed: 'danger', Refunded: 'gold', 'Partially Refunded': 'gold',
};

export function PaymentInfoCard({ order, onChanged }) {
  const user = useSelector(selectCurrentUser);
  const { openCheckout } = useRazorpay();
  const [downloading, setDownloading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const { data: txData } = useQuery({
    queryKey: ['order-transactions', order._id],
    queryFn: () => paymentsApi.transactions(order._id),
    enabled: order.paymentMethod === 'razorpay',
  });
  const transactions = txData?.transactions || [];
  const successfulPayment = transactions.find((t) => t.type === 'payment' && t.status === 'Success');

  const invoiceMutation = useMutation({
    mutationFn: async () => {
      setDownloading(true);
      const blob = await ordersApi.downloadInvoice(order._id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${order.orderNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onSettled: () => setDownloading(false),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const canRetryPayment = order.paymentMethod === 'razorpay' && order.paymentStatus !== 'Paid' && ['Pending', 'Confirmed'].includes(order.orderStatus);

  const handleRetryPayment = async () => {
    setRetrying(true);
    try {
      const result = await paymentsApi.retry(order._id);
      await openCheckout({
        key: result.razorpayKeyId || RAZORPAY_KEY_ID,
        amount: result.razorpayOrder.amount,
        currency: result.razorpayOrder.currency,
        order_id: result.razorpayOrder.id,
        name: 'Astro Sanatan Shakti',
        description: `Order ${order.orderNumber}`,
        prefill: { name: user?.name, email: user?.email, contact: user?.mobile },
        theme: { color: '#7A1F2B' },
        handler: async (response) => {
          try {
            await paymentsApi.verify({
              orderId: order._id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success('Payment successful!');
            onChanged?.();
          } catch (err) {
            toast.error(getErrorMessage(err));
          }
        },
        modal: { ondismiss: () => paymentsApi.cancelled({ orderId: order._id }).catch(() => {}) },
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRetrying(false);
    }
  };

  const refund = order.returnRequest?.refund;

  return (
    <div className="card space-y-3 p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-night-900/60">
        <CreditCard size={15} /> Payment
      </h2>

      <div className="flex items-center justify-between text-sm">
        <span className="text-night-900/60">Method</span>
        <span className="font-medium">
          {order.paymentMethod === 'cod' ? <Badge tone="default">Cash on Delivery</Badge> : 'Razorpay (Online)'}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-night-900/60">Status</span>
        <Badge tone={PAYMENT_STATUS_TONE[order.paymentStatus] || 'default'}>{order.paymentStatus}</Badge>
      </div>
      {successfulPayment && (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-night-900/60">Transaction ID</span>
            <span className="font-mono text-xs">{successfulPayment.razorpayPaymentId}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-night-900/60">Paid On</span>
            <span>{formatDate(successfulPayment.createdAt)}</span>
          </div>
        </>
      )}
      {order.paymentMethod === 'cod' && order.paymentStatus === 'Paid' && order.deliveredAt && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-night-900/60">Paid On</span>
          <span>{formatDate(order.deliveredAt)} (on delivery)</span>
        </div>
      )}

      {refund && refund.status !== 'Not Applicable' && (
        <div className="space-y-1.5 border-t border-night-900/10 pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-night-900/60">Refund Status</span>
            <Badge tone={refund.status === 'Completed' ? 'success' : refund.status === 'Failed' ? 'danger' : 'warning'}>{refund.status}</Badge>
          </div>
          {refund.amount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-night-900/60">Refund Amount</span>
              <span className="font-medium">{formatCurrency(refund.amount)}</span>
            </div>
          )}
          {refund.processedAt && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-night-900/60">Refunded On</span>
              <span>{formatDate(refund.processedAt)}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-night-900/10 pt-3">
        <button onClick={() => invoiceMutation.mutate()} disabled={downloading} className="btn-outline flex items-center justify-center gap-1.5 text-sm">
          <Download size={14} /> {downloading ? 'Downloading…' : 'Download Invoice'}
        </button>
        {canRetryPayment && (
          <button onClick={handleRetryPayment} disabled={retrying} className="btn-primary flex items-center justify-center gap-1.5 text-sm">
            <RotateCw size={14} /> {retrying ? 'Processing…' : 'Retry Payment'}
          </button>
        )}
      </div>
    </div>
  );
}
