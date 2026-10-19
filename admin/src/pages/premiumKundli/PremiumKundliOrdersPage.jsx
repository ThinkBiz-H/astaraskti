import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { premiumKundliAdminApi } from '@/api/endpoints/orders';
import { PageHeader, PageLoader, Pagination, Badge, EmptyState, Modal } from '@/components/common/Elements';
import { formatCurrency, formatDate } from '@/utils/format';
import { getErrorMessage } from '@/api/axiosClient';
import { Search, Download, Upload, RefreshCw, Mail, FileDown } from 'lucide-react';

const PAYMENT_TONE = { Pending: 'warning', Paid: 'success', Failed: 'danger' };
const KUNDLI_TONE = { Pending: 'default', Processing: 'info', Generated: 'success', Failed: 'danger' };
const KUNDLI_STATUSES = ['Pending', 'Processing', 'Generated', 'Failed'];

function UpdateStatusModal({ order, onClose }) {
  const queryClient = useQueryClient();
  const [kundliStatus, setKundliStatus] = useState(order.kundliStatus);
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);

  const mutation = useMutation({
    mutationFn: (payload) => premiumKundliAdminApi.updateStatus(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['premium-kundli-orders'] });
      toast.success('Order updated');
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const onSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({ orderId: order._id, kundliStatus, note, file: file || undefined });
  };

  return (
    <Modal title={`Update Order — ${order.orderNumber}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label-field">Kundli Status</label>
          <select value={kundliStatus} onChange={(e) => setKundliStatus(e.target.value)} className="input-field">
            {KUNDLI_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label-field">Note</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input-field" />
        </div>
        <div>
          <label className="label-field">Upload Report (PDF / Image / Audio / Video)</label>
          <input type="file" accept=".pdf,image/*,audio/*,video/*" onChange={(e) => setFile(e.target.files[0])} className="input-field" />
          <p className="mt-1 text-xs text-night-900/40">Uploading a file automatically marks this order "Generated" and notifies + emails the customer.</p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">{mutation.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function PremiumKundliOrdersPage() {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [kundliStatus, setKundliStatus] = useState('');
  const [editingOrder, setEditingOrder] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['premium-kundli-orders', page, keyword, paymentStatus, kundliStatus],
    queryFn: () => premiumKundliAdminApi.list({
      page, limit: 15,
      keyword: keyword || undefined,
      paymentStatus: paymentStatus || undefined,
      kundliStatus: kundliStatus || undefined,
    }),
  });

  const orders = data?.orders || [];
  const totalPages = data?.pagination?.totalPages || 1;

  const regenerateMutation = useMutation({
    mutationFn: premiumKundliAdminApi.regenerate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['premium-kundli-orders'] });
      toast.success('Regeneration triggered');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const resendEmailMutation = useMutation({
    mutationFn: premiumKundliAdminApi.resendEmail,
    onSuccess: () => toast.success('Email resent'),
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await premiumKundliAdminApi.exportCsv();
      const url = window.URL.createObjectURL(blob.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `premium-kundli-orders-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Premium Kundli Orders"
        description={`${data?.total || 0} orders`}
        action={
          <button onClick={handleExport} disabled={exporting} className="btn-outline flex items-center gap-2">
            <FileDown size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-night-900/30" />
          <input
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            placeholder="Search name, email, mobile, order#..."
            className="input-field w-72 pl-8"
          />
        </div>
        <select value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }} className="input-field w-40">
          <option value="">All Payment</option>
          <option value="Pending">Pending</option>
          <option value="Paid">Paid</option>
          <option value="Failed">Failed</option>
        </select>
        <select value={kundliStatus} onChange={(e) => { setKundliStatus(e.target.value); setPage(1); }} className="input-field w-40">
          <option value="">All Kundli Status</option>
          {KUNDLI_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : orders.length === 0 ? <EmptyState title="No Premium Kundli orders yet" /> : (
          <table className="w-full">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Kundli Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id} className="table-row">
                  <td className="px-4 py-3 font-medium">{o.fullName}<p className="text-xs text-night-900/40">#{o.orderNumber}</p></td>
                  <td className="px-4 py-3 text-night-900/60">{o.mobile}</td>
                  <td className="px-4 py-3 text-night-900/60">{o.email}</td>
                  <td className="px-4 py-3">{formatCurrency(o.amount)}</td>
                  <td className="px-4 py-3"><Badge tone={PAYMENT_TONE[o.paymentStatus] || 'default'}>{o.paymentStatus}</Badge></td>
                  <td className="px-4 py-3"><Badge tone={KUNDLI_TONE[o.kundliStatus] || 'default'}>{o.kundliStatus}</Badge></td>
                  <td className="px-4 py-3 text-night-900/60">{formatDate(o.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={() => setEditingOrder(o)} className="flex items-center gap-1 text-xs text-gold-600"><Upload size={13} /> Update</button>
                      {o.pdfUrl && <a href={o.pdfUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-green-700"><Download size={13} /> PDF</a>}
                      {o.paymentStatus === 'Paid' && (
                        <button
                          onClick={() => regenerateMutation.mutate(o._id)}
                          disabled={regenerateMutation.isPending}
                          className="flex items-center gap-1 text-xs text-blue-600"
                        >
                          <RefreshCw size={13} /> Regenerate
                        </button>
                      )}
                      <button
                        onClick={() => resendEmailMutation.mutate(o._id)}
                        disabled={resendEmailMutation.isPending}
                        className="flex items-center gap-1 text-xs text-night-900/60"
                      >
                        <Mail size={13} /> Resend Email
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      {editingOrder && <UpdateStatusModal order={editingOrder} onClose={() => setEditingOrder(null)} />}
    </div>
  );
}
