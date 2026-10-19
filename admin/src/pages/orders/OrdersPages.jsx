import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ordersApi, paymentsAdminApi } from '@/api/endpoints/orders';
import { PageHeader, PageLoader, Pagination, Badge, EmptyState } from '@/components/common/Elements';
import { formatCurrency, formatDate } from '@/utils/format';
import { getErrorMessage } from '@/api/axiosClient';
import { Download, Printer, Mail, Truck, PackageCheck, XCircle, FileText, RefreshCw, RotateCcw, IndianRupee } from 'lucide-react';

// Kept in the exact order of the backend's status machine
// (backend/utils/orderStatusMachine.js) so the dropdown only ever offers
// statuses the API will actually accept.
const ORDER_STATUSES = [
  'Pending', 'Confirmed', 'Processing', 'Packed', 'Ready To Ship', 'Shipped',
  'Out For Delivery', 'Delivered', 'Cancelled', 'Returned', 'Refunded',
];
const STATUS_TONE = {
  Pending: 'warning', Confirmed: 'info', Processing: 'info', Packed: 'info',
  'Ready To Ship': 'info', Shipped: 'gold', 'Out For Delivery': 'gold',
  Delivered: 'success', Cancelled: 'danger', Returned: 'danger', Refunded: 'danger',
};

// Mirrors backend/utils/orderStatusMachine.js's TRANSITIONS exactly — the
// backend stays authoritative (an illegal pick still fails server-side),
// this just stops the dropdown from offering choices that can never work.
const TRANSITIONS = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Processing', 'Cancelled'],
  Processing: ['Packed', 'Cancelled'],
  Packed: ['Ready To Ship', 'Cancelled'],
  'Ready To Ship': ['Shipped', 'Cancelled'],
  Shipped: ['Out For Delivery', 'Returned', 'Cancelled'],
  'Out For Delivery': ['Delivered', 'Out For Delivery', 'Returned'],
  Delivered: ['Returned'],
  Cancelled: ['Refunded'],
  Returned: ['Refunded'],
  Refunded: [],
};

// Mirrors backend/services/order.service.js's ORDER_STATUS_NOTIFICATIONS
// copy — display-only, so the admin can see exactly what the customer will
// be notified before saving. Not a new endpoint, just the same known copy.
const STATUS_NOTIFICATION_PREVIEW = {
  Confirmed: '✅ Order Confirmed — Your order has been confirmed.',
  Processing: '⚙️ Order Processing — Your order is now being processed.',
  Packed: '📦 Packed — Your order has been packed.',
  'Ready To Ship': '📦 Ready to Ship — Your order is ready to ship.',
  Shipped: '🚚 Shipped — Your order is on the way.',
  'Out For Delivery': '📍 Out for Delivery — Your order will arrive today.',
  Delivered: '🎉 Delivered — Your order has been delivered.',
  Cancelled: '❌ Cancelled — Your order has been cancelled.',
  Returned: '↩️ Returned — Your order has been returned.',
  Refunded: '💰 Refund Completed — Refund has been credited.',
};

export function OrdersListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', page, status],
    queryFn: () => ordersApi.list({ page, limit: 15, status: status || undefined }),
  });

  const orders = data?.orders || [];
  const totalPages = Math.max(1, Math.ceil((data?.pagination?.total ?? data?.total ?? 0) / 15));

  return (
    <div>
      <PageHeader title="Orders" description={`${data?.pagination?.total ?? data?.total ?? 0} orders`} />
      <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input-field mb-4 max-w-xs">
        <option value="">All Statuses</option>
        {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : orders.length === 0 ? <EmptyState title="No orders found" /> : (
          <table className="w-full">
            <thead><tr className="table-head">
              <th className="px-4 py-3">Order</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Payment</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Date</th>
            </tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id} className="table-row">
                  <td className="px-4 py-3"><Link to={`/orders/${o._id}`} className="font-medium text-gold-600">#{o.orderNumber}</Link></td>
                  <td className="px-4 py-3">{o.user?.name || o.user?.mobile}</td>
                  <td className="px-4 py-3">{formatCurrency(o.grandTotal)}</td>
                  <td className="px-4 py-3"><Badge tone={o.paymentStatus === 'Paid' ? 'success' : 'warning'}>{o.paymentStatus}</Badge></td>
                  <td className="px-4 py-3"><Badge tone={STATUS_TONE[o.orderStatus] || 'default'}>{o.orderStatus}</Badge></td>
                  <td className="px-4 py-3 text-night-900/50">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}

function SectionCard({ title, action, children }) {
  return (
    <div className="card p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export function OrderDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-order', id], queryFn: () => ordersApi.getById(id) });
  const [statusForm, setStatusForm] = useState({
    orderStatus: '', trackingNumber: '', trackingUrl: '', courierName: '', courierPartner: '',
    estimatedDeliveryDate: '', note: '', deliveryFailed: false,
  });
  const [adminNote, setAdminNote] = useState('');
  const [liveTracking, setLiveTracking] = useState(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-order', id] });

  const updateMutation = useMutation({
    mutationFn: (payload) => ordersApi.updateStatus(id, payload),
    onSuccess: () => { invalidate(); toast.success('Order updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const noteMutation = useMutation({
    mutationFn: (payload) => ordersApi.updateStatus(id, payload),
    onSuccess: () => { invalidate(); toast.success('Admin note saved'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const shipmentMutation = useMutation({
    mutationFn: () => ordersApi.createShipment(id, {}),
    onSuccess: () => { invalidate(); toast.success('Shipment created & AWB assigned'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const pickupMutation = useMutation({
    mutationFn: () => ordersApi.requestPickup(id),
    onSuccess: () => { invalidate(); toast.success('Pickup requested'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const cancelShipmentMutation = useMutation({
    mutationFn: () => ordersApi.cancelShipment(id),
    onSuccess: () => { invalidate(); toast.success('Shipment cancelled'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const manifestMutation = useMutation({
    mutationFn: () => ordersApi.generateManifest(id),
    onSuccess: () => { invalidate(); toast.success('Manifest generated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const invoiceMutation = useMutation({
    mutationFn: () => ordersApi.generateShiprocketInvoice(id),
    onSuccess: () => { invalidate(); toast.success('Shiprocket invoice generated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const resendEmailMutation = useMutation({
    mutationFn: () => ordersApi.resendEmail(id),
    onSuccess: () => toast.success('Order email resent to customer'),
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const trackMutation = useMutation({
    mutationFn: () => ordersApi.track(id),
    onSuccess: (res) => { setLiveTracking(res); toast.success('Tracking refreshed'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const reviewReturnMutation = useMutation({
    mutationFn: (payload) => ordersApi.reviewReturnRequest(id, payload),
    onSuccess: () => { invalidate(); toast.success('Return request updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const ndrMutation = useMutation({
    mutationFn: (payload) => ordersApi.ndrAction(id, payload),
    onSuccess: () => { invalidate(); toast.success('NDR action submitted to courier'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const refundMutation = useMutation({
    mutationFn: (payload) => paymentsAdminApi.refund(id, payload),
    onSuccess: () => { invalidate(); toast.success('Refund initiated'); setRefundForm({ amount: '', reason: '' }); setShowRefundForm(false); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundForm, setRefundForm] = useState({ amount: '', reason: '' });

  const order = data?.order;

  const handleDownloadInvoice = async () => {
    setDownloading(true);
    try {
      const res = await ordersApi.downloadInvoice(id);
      downloadBlob(res.data, `Invoice-${order.orderNumber}.pdf`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintInvoice = async () => {
    setPrinting(true);
    try {
      const res = await ordersApi.downloadInvoice(id);
      const url = window.URL.createObjectURL(res.data);
      const win = window.open(url, '_blank');
      if (win) {
        win.onload = () => win.print();
      } else {
        toast.error('Please allow pop-ups to print the invoice');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPrinting(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (!order) return null;

  const addr = order.shippingAddress || {};
  const canCreateShipment = ['Confirmed', 'Processing', 'Packed', 'Ready To Ship'].includes(order.orderStatus) && !order.shiprocket?.shipmentId;
  const hasShipment = !!order.shiprocket?.shipmentId;

  return (
    <div>
      <PageHeader
        title={`Order #${order.orderNumber}`}
        description={`Placed ${formatDate(order.createdAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Badge tone={STATUS_TONE[order.orderStatus] || 'default'}>{order.orderStatus}</Badge>
            <Badge tone={order.paymentStatus === 'Paid' ? 'success' : 'warning'}>{order.paymentStatus}</Badge>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <button onClick={handleDownloadInvoice} disabled={downloading} className="btn-outline flex items-center gap-2">
          <Download size={15} /> Download Invoice
        </button>
        <button onClick={handlePrintInvoice} disabled={printing} className="btn-outline flex items-center gap-2">
          <Printer size={15} /> Print Invoice
        </button>
        <button onClick={() => resendEmailMutation.mutate()} disabled={resendEmailMutation.isPending} className="btn-outline flex items-center gap-2">
          <Mail size={15} /> Resend Order Email
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <SectionCard title="Ordered Products">
            <div className="space-y-3">
              {order.items?.map((item, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-night-900/5 pb-3 text-sm last:border-0">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.title} className="h-14 w-14 rounded-lg object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-night-900/5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-night-900/50">
                      {item.sku && `SKU: ${item.sku}`} {item.unitValue && `· ${item.unitValue}`}
                      {(item.color || item.size) && ` · ${[item.color, item.size].filter(Boolean).join(' / ')}`}
                    </p>
                    <p className="text-xs text-night-900/50">Qty: {item.quantity} × {formatCurrency(item.price)}</p>
                  </div>
                  <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Payment Summary">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-night-900/60">Subtotal</span><span>{formatCurrency(order.subTotal)}</span></div>
              {order.coupon?.code && (
                <div className="flex justify-between text-green-700">
                  <span>Coupon ({order.coupon.code})</span><span>− {formatCurrency(order.coupon.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between"><span className="text-night-900/60">Shipping</span><span>{formatCurrency(order.shippingCharge)}</span></div>
              <div className="flex justify-between"><span className="text-night-900/60">GST / Tax</span><span>{formatCurrency(order.tax)}</span></div>
              <div className="mt-2 flex justify-between border-t border-night-900/10 pt-2 font-display text-lg font-semibold">
                <span>Grand Total</span><span>{formatCurrency(order.grandTotal)}</span>
              </div>
              <div className="flex justify-between pt-2 text-night-900/60"><span>Payment Method</span><span className="uppercase">{order.paymentMethod}</span></div>
              {order.paymentInfo?.razorpayPaymentId && (
                <div className="flex justify-between text-night-900/60"><span>Razorpay Payment ID</span><span>{order.paymentInfo.razorpayPaymentId}</span></div>
              )}
            </div>

            {order.paymentMethod === 'razorpay' && ['Paid', 'Partially Refunded'].includes(order.paymentStatus) && (
              <div className="mt-4 border-t border-night-900/10 pt-3">
                {!showRefundForm ? (
                  <button onClick={() => setShowRefundForm(true)} className="btn-outline flex items-center gap-2 text-sm">
                    <IndianRupee size={14} /> Initiate Refund
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder={`Amount (max ${order.grandTotal})`}
                      value={refundForm.amount}
                      onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                      className="input-field"
                    />
                    <input
                      placeholder="Reason"
                      value={refundForm.reason}
                      onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
                      className="input-field"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => refundMutation.mutate({ amount: refundForm.amount || undefined, reason: refundForm.reason })}
                        disabled={refundMutation.isPending}
                        className="btn-primary"
                      >
                        Confirm Refund
                      </button>
                      <button onClick={() => setShowRefundForm(false)} className="btn-outline">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <SectionCard title="Customer Details">
              <p className="text-sm"><strong>{order.user?.name}</strong></p>
              <p className="text-sm text-night-900/60">{order.user?.email}</p>
              <p className="text-sm text-night-900/60">{order.user?.mobile}</p>
            </SectionCard>

            <SectionCard title="Shipping Address">
              <p className="text-sm">{addr.fullName}</p>
              <p className="text-sm text-night-900/60">{addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}</p>
              <p className="text-sm text-night-900/60">{addr.city}, {addr.state} {addr.pincode}</p>
              <p className="text-sm text-night-900/60">{addr.mobile}</p>
            </SectionCard>
          </div>

          <SectionCard title="Billing Address">
            <p className="text-xs text-night-900/40">Same as shipping address (this store does not collect a separate billing address at checkout).</p>
          </SectionCard>

          <SectionCard title="Order Notes">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-night-900/50">Customer-facing note</p>
                <p className="text-sm">{order.shippingNotes || '—'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-night-900/50">Internal admin notes (never shown to customer)</p>
                <textarea
                  className="input-field"
                  rows={3}
                  defaultValue={order.adminNotes || ''}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Add an internal note…"
                />
                <button
                  onClick={() => noteMutation.mutate({ adminNote: adminNote || order.adminNotes || ' ' })}
                  disabled={noteMutation.isPending}
                  className="btn-outline mt-2"
                >
                  Save Note
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Shipping / Shiprocket"
            action={
              <button onClick={() => trackMutation.mutate()} disabled={trackMutation.isPending} className="flex items-center gap-1 text-xs text-gold-600">
                <RefreshCw size={13} /> Refresh Tracking
              </button>
            }
          >
            <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><p className="text-xs text-night-900/50">Courier</p><p>{order.courier?.courierName || '—'}</p></div>
              <div><p className="text-xs text-night-900/50">AWB / Tracking No.</p><p>{order.tracking?.number || '—'}</p></div>
              <div><p className="text-xs text-night-900/50">Shipment Status</p><p>{order.tracking?.shipmentStatus || 'Not Shipped'}</p></div>
              <div><p className="text-xs text-night-900/50">Estimated Delivery</p><p>{order.tracking?.estimatedDeliveryDate ? formatDate(order.tracking.estimatedDeliveryDate) : '—'}</p></div>
              <div><p className="text-xs text-night-900/50">Delivery Attempts</p><p>{order.tracking?.deliveryAttempts || 0}</p></div>
              {order.tracking?.url && (
                <div><p className="text-xs text-night-900/50">Track Link</p><a href={order.tracking.url} target="_blank" rel="noreferrer" className="text-gold-600">Open</a></div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {canCreateShipment && (
                <button onClick={() => shipmentMutation.mutate()} disabled={shipmentMutation.isPending} className="btn-primary flex items-center gap-2">
                  <Truck size={15} /> Create Shipment (Assign AWB)
                </button>
              )}
              {hasShipment && !order.shiprocket?.pickupScheduledAt && (
                <button onClick={() => pickupMutation.mutate()} disabled={pickupMutation.isPending} className="btn-outline flex items-center gap-2">
                  <PackageCheck size={15} /> Request Pickup
                </button>
              )}
              {hasShipment && (
                <>
                  <button onClick={() => manifestMutation.mutate()} disabled={manifestMutation.isPending} className="btn-outline flex items-center gap-2">
                    <FileText size={15} /> Generate Manifest
                  </button>
                  <button onClick={() => invoiceMutation.mutate()} disabled={invoiceMutation.isPending} className="btn-outline flex items-center gap-2">
                    <FileText size={15} /> Generate Shiprocket Invoice
                  </button>
                  <button onClick={() => cancelShipmentMutation.mutate()} disabled={cancelShipmentMutation.isPending} className="btn-outline flex items-center gap-2 text-red-600">
                    <XCircle size={15} /> Cancel Shipment
                  </button>
                </>
              )}
              {order.tracking?.shipmentStatus === 'Delivery Failed' && (
                <>
                  <button onClick={() => ndrMutation.mutate({ action: 're-attempt' })} disabled={ndrMutation.isPending} className="btn-outline flex items-center gap-2">
                    <RotateCcw size={15} /> NDR: Re-attempt Delivery
                  </button>
                  <button onClick={() => ndrMutation.mutate({ action: 'return' })} disabled={ndrMutation.isPending} className="btn-outline flex items-center gap-2 text-red-600">
                    <RotateCcw size={15} /> NDR: Return to Origin
                  </button>
                </>
              )}
            </div>

            {(order.shiprocket?.manifestUrl || order.shiprocket?.invoiceUrl || order.shiprocket?.labelUrl) && (
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                {order.shiprocket?.labelUrl && <a href={order.shiprocket.labelUrl} target="_blank" rel="noreferrer" className="text-gold-600">Shipping Label</a>}
                {order.shiprocket?.manifestUrl && <a href={order.shiprocket.manifestUrl} target="_blank" rel="noreferrer" className="text-gold-600">Manifest</a>}
                {order.shiprocket?.invoiceUrl && <a href={order.shiprocket.invoiceUrl} target="_blank" rel="noreferrer" className="text-gold-600">Shiprocket Invoice</a>}
              </div>
            )}

            {liveTracking?.live?.checkpoints?.length > 0 && (
              <div className="mt-4 border-t border-night-900/10 pt-3">
                <p className="mb-2 text-xs font-medium text-night-900/50">Live Courier Checkpoints</p>
                <div className="space-y-1.5 text-xs">
                  {liveTracking.live.checkpoints.map((c, i) => (
                    <div key={i} className="flex justify-between text-night-900/60">
                      <span>{c.activity || c.status}</span>
                      <span>{c.date || c.location}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          {order.returnRequest && (
            <SectionCard title="Return Request">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-night-900/60">Status</span>
                  <Badge tone={order.returnRequest.status === 'Approved' ? 'success' : order.returnRequest.status === 'Rejected' ? 'danger' : 'warning'}>
                    {order.returnRequest.status}
                  </Badge>
                </div>
                <p><span className="text-night-900/60">Reason:</span> {order.returnRequest.reason}</p>
                {order.returnRequest.comment && <p><span className="text-night-900/60">Customer comment:</span> {order.returnRequest.comment}</p>}
                {order.returnRequest.adminComment && <p><span className="text-night-900/60">Admin comment:</span> {order.returnRequest.adminComment}</p>}
                {order.returnRequest.shiprocket?.shipmentId && (
                  <p><span className="text-night-900/60">Reverse pickup shipment:</span> {order.returnRequest.shiprocket.shipmentId}</p>
                )}
                <p><span className="text-night-900/60">Refund status:</span> {order.returnRequest.refund?.status || 'Not Applicable'}</p>

                {order.returnRequest.status === 'Requested' && (
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => reviewReturnMutation.mutate({ status: 'Approved' })}
                      disabled={reviewReturnMutation.isPending}
                      className="btn-primary"
                    >
                      Approve Return
                    </button>
                    <button
                      onClick={() => reviewReturnMutation.mutate({ status: 'Rejected', adminComment: 'Not eligible for return' })}
                      disabled={reviewReturnMutation.isPending}
                      className="btn-outline text-red-600"
                    >
                      Reject Return
                    </button>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          <SectionCard title="Order Timeline / Status History">
            <div className="space-y-2 text-sm">
              {order.statusHistory?.map((h, i) => (
                <div key={i} className="flex justify-between border-b border-night-900/5 pb-2 last:border-0">
                  <span><Badge tone={STATUS_TONE[h.status] || 'default'}>{h.status}</Badge> {h.note && <span className="ml-2 text-night-900/60">{h.note}</span>}</span>
                  <span className="text-night-900/40">{formatDate(h.changedAt || h.createdAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="card h-fit space-y-3 p-6 lg:sticky lg:top-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">Update Order Status</h2>
          <select
            value={statusForm.orderStatus}
            onChange={(e) => setStatusForm({ ...statusForm, orderStatus: e.target.value })}
            className="input-field"
          >
            <option value="">Select new status</option>
            {(TRANSITIONS[order.orderStatus] || []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {statusForm.orderStatus && STATUS_NOTIFICATION_PREVIEW[statusForm.orderStatus] && (
            <p className="rounded-sm bg-night-900/5 p-2 text-xs text-night-900/60">
              Customer will see: {STATUS_NOTIFICATION_PREVIEW[statusForm.orderStatus]}
            </p>
          )}
          <input
            placeholder="Tracking Number"
            value={statusForm.trackingNumber}
            onChange={(e) => setStatusForm({ ...statusForm, trackingNumber: e.target.value })}
            className="input-field"
          />
          <input
            placeholder="Tracking URL"
            value={statusForm.trackingUrl}
            onChange={(e) => setStatusForm({ ...statusForm, trackingUrl: e.target.value })}
            className="input-field"
          />
          <input
            placeholder="Courier Partner (e.g. Shiprocket, Delhivery, Manual)"
            value={statusForm.courierPartner}
            onChange={(e) => setStatusForm({ ...statusForm, courierPartner: e.target.value })}
            className="input-field"
          />
          <input
            placeholder="Courier Name"
            value={statusForm.courierName}
            onChange={(e) => setStatusForm({ ...statusForm, courierName: e.target.value })}
            className="input-field"
          />
          <input
            type="date"
            placeholder="Estimated Delivery Date"
            value={statusForm.estimatedDeliveryDate}
            onChange={(e) => setStatusForm({ ...statusForm, estimatedDeliveryDate: e.target.value })}
            className="input-field"
          />
          <textarea
            placeholder="Note (shown in order timeline)"
            value={statusForm.note}
            onChange={(e) => setStatusForm({ ...statusForm, note: e.target.value })}
            className="input-field"
            rows={2}
          />
          {statusForm.orderStatus === 'Out For Delivery' && (
            <label className="flex items-center gap-2 text-sm text-night-900/60">
              <input
                type="checkbox"
                checked={statusForm.deliveryFailed}
                onChange={(e) => setStatusForm({ ...statusForm, deliveryFailed: e.target.checked })}
              />
              This delivery attempt failed
            </label>
          )}
          <button
            onClick={() => updateMutation.mutate(Object.fromEntries(Object.entries(statusForm).filter(([, v]) => v !== '' && v !== false)))}
            disabled={updateMutation.isPending}
            className="btn-primary w-full"
          >
            Update Order
          </button>
        </div>
      </div>
    </div>
  );
}
