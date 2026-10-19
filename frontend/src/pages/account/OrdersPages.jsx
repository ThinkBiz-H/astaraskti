import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '@/api/endpoints/orders';
import { EmptyState, PageLoader, OrderDetailSkeleton, Badge } from '@/components/common/Elements';
import { formatCurrency, formatDate } from '@/utils/format';
import SEO from '@/components/common/SEO';
import { Package, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/api/axiosClient';
import { STATUS_TONE, TERMINAL_STATUSES } from '@/components/orders/orderStatus';
import { OrderProgressBar } from '@/components/orders/OrderProgressBar';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { ShipmentTrackingCard } from '@/components/orders/ShipmentTrackingCard';
import { OrderSummaryCard } from '@/components/orders/OrderSummaryCard';
import { PaymentInfoCard } from '@/components/orders/PaymentInfoCard';
import { ShippingAddressCard } from '@/components/orders/ShippingAddressCard';
import { OrderActions } from '@/components/orders/OrderActions';

export function OrdersListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => ordersApi.myOrders(),
    // Light polling so a status change (e.g. admin marks Shipped) reflects
    // here without a manual refresh — only worth polling while at least
    // one order is still "in flight".
    refetchInterval: (query) => {
      const orders = query.state.data?.orders || [];
      const hasActive = orders.some((o) => !TERMINAL_STATUSES.includes(o.orderStatus));
      return hasActive ? 15_000 : false;
    },
  });
  const orders = data?.orders || [];

  if (isLoading) return <PageLoader />;
  if (orders.length === 0) {
    return <EmptyState icon={Package} title="No orders yet" description="Your order history will show up here." action={<Link to="/shop" className="btn-primary mt-2">Start Shopping</Link>} />;
  }

  return (
    <>
      <SEO title="My Orders" noindex />
      <h1 className="mb-6 font-display text-2xl">My Orders</h1>
      <div className="space-y-4">
        {orders.map((order) => (
          <Link key={order._id} to={`/account/orders/${order._id}`} className="card block p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">#{order.orderNumber}</p>
                <p className="text-xs text-night-900/50">{formatDate(order.createdAt)} · {order.items?.length} item(s)</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={STATUS_TONE[order.orderStatus] || 'default'}>{order.orderStatus}</Badge>
                <span className="font-display font-semibold">{formatCurrency(order.grandTotal)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

export function OrderDetailsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get('success') === '1';
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.getById(id),
    // Polls while the order is still active so a status/tracking change made
    // by admin shows up here without the customer refreshing the page —
    // stops automatically once the order reaches a terminal state.
    refetchInterval: (query) => {
      const status = query.state.data?.order?.orderStatus;
      return status && !TERMINAL_STATUSES.includes(status) ? 6_000 : false;
    },
  });
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['order', id] });

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(id),
    onSuccess: () => { invalidate(); toast.success('Order cancelled'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const returnMutation = useMutation({
    mutationFn: (payload) => ordersApi.requestReturn(id, payload),
    onSuccess: () => { invalidate(); setShowReturnForm(false); setReturnReason(''); toast.success('Return request submitted'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleDownloadInvoice = async () => {
    try {
      const blob = await ordersApi.downloadInvoice(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download invoice');
    }
  };

  if (isLoading) return <OrderDetailSkeleton />;
  const order = data?.order;
  if (!order) return null;

  return (
    <>
      <SEO title={`Order #${order.orderNumber}`} noindex />
      {isSuccess && (
        <div className="mb-6 flex items-center gap-3 rounded-sm bg-green-50 p-4 text-green-800">
          <CheckCircle2 size={20} /> Your order has been placed successfully!
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Order #{order.orderNumber}</h1>
          <p className="text-xs text-night-900/50">Placed on {formatDate(order.createdAt)}</p>
        </div>
        <Badge tone={STATUS_TONE[order.orderStatus] || 'default'}>{order.orderStatus}</Badge>
      </div>

      <div className="mb-6">
        <OrderProgressBar orderStatus={order.orderStatus} />
      </div>

      {showReturnForm && (
        <div className="card mb-6 space-y-3 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">Request a Return</h2>
          <textarea
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Tell us why you'd like to return this order…"
            className="input-field"
            rows={3}
          />
          <button
            onClick={() => returnMutation.mutate({ reason: returnReason })}
            disabled={!returnReason.trim() || returnMutation.isPending}
            className="btn-primary"
          >
            Submit Return Request
          </button>
        </div>
      )}

      {order.returnRequest && (
        <div className="card mb-6 p-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-night-900/60">Return Request</h2>
          <p className="text-sm">Status: <strong>{order.returnRequest.status}</strong></p>
          <p className="text-sm text-night-900/60">Reason: {order.returnRequest.reason}</p>
          {order.returnRequest.adminComment && (
            <p className="text-sm text-night-900/60">Note from us: {order.returnRequest.adminComment}</p>
          )}
        </div>
      )}

      <div className="mb-6">
        <OrderActions
          order={order}
          cancelling={cancelMutation.isPending}
          onCancel={() => cancelMutation.mutate()}
          onRequestReturn={() => setShowReturnForm((v) => !v)}
          onDownloadInvoice={handleDownloadInvoice}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div id="shipment-tracking-card">
            <ShipmentTrackingCard order={order} enabled />
          </div>

          <div className="card p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-night-900/60">Order Timeline</h2>
            <OrderTimeline order={order} />
          </div>

          <OrderSummaryCard order={order} />
        </div>

        <div className="space-y-6">
          <ShippingAddressCard order={order} />
          <PaymentInfoCard order={order} onChanged={invalidate} />
        </div>
      </div>
    </>
  );
}
