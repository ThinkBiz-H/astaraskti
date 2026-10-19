import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { inventoryApi, categoriesApi, brandsApi } from '@/api/endpoints/catalog';
import { PageHeader, PageLoader, Badge, EmptyState, Pagination, Modal } from '@/components/common/Elements';
import { getErrorMessage } from '@/api/axiosClient';
import { formatDate } from '@/utils/format';
import { Boxes, History, Search } from 'lucide-react';

const STATUS_TONE = { out: 'danger', critical: 'danger', low: 'warning', in_stock: 'success' };
const STATUS_LABEL = { out: 'Out of Stock', critical: 'Critical', low: 'Low Stock', in_stock: 'In Stock' };

function AdjustStockModal({ row, onClose }) {
  const queryClient = useQueryClient();
  const [newStock, setNewStock] = useState(row.availableStock);
  const [note, setNote] = useState('');

  const adjustMutation = useMutation({
    mutationFn: inventoryApi.adjust,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast.success('Stock updated');
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const diff = Number(newStock) - row.availableStock;

  const onSubmit = (e) => {
    e.preventDefault();
    if (diff === 0) { toast.error('New stock must differ from current stock'); return; }
    if (!note.trim()) { toast.error('A reason is required for every stock change'); return; }
    adjustMutation.mutate({
      productId: row.productId,
      variantId: row.variantId || undefined,
      quantity: diff,
      note: note.trim(),
    });
  };

  return (
    <Modal title={`Adjust Stock — ${row.title}${row.variantLabel ? ` (${row.variantLabel})` : ''}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg bg-night-900/5 p-3">
            <p className="text-xs text-night-900/50">Current Available Stock</p>
            <p className="text-lg font-semibold">{row.availableStock}</p>
          </div>
          <div>
            <label className="label-field">New Stock</label>
            <input type="number" min={0} value={newStock} onChange={(e) => setNewStock(e.target.value)} className="input-field" autoFocus />
          </div>
        </div>
        <p className={`text-xs ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-night-900/40'}`}>
          {diff > 0 ? `+${diff}` : diff} change
        </p>
        <div>
          <label className="label-field">Reason (required)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Manual stocktake correction, Restock from supplier" className="input-field" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          <button type="submit" disabled={adjustMutation.isPending} className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryModal({ row, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-movements', row.productId, row.variantId],
    queryFn: () => inventoryApi.movements({ productId: row.productId, variantId: row.variantId || undefined, limit: 30 }),
  });
  const movements = data?.movements || [];

  return (
    <Modal title={`Stock History — ${row.title}${row.variantLabel ? ` (${row.variantLabel})` : ''}`} onClose={onClose} maxWidth="max-w-2xl">
      {isLoading ? <PageLoader /> : movements.length === 0 ? <EmptyState title="No stock movements yet" /> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="table-head">
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Old → New</th>
              <th className="px-2 py-2 text-left">Diff</th>
              <th className="px-2 py-2 text-left">Reason</th>
              <th className="px-2 py-2 text-left">Updated By</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m._id} className="table-row">
                <td className="px-2 py-2 text-night-900/60">{formatDate(m.createdAt)}</td>
                <td className="px-2 py-2">{m.previousStock} → {m.newStock}</td>
                <td className={`px-2 py-2 font-medium ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                <td className="px-2 py-2 text-night-900/60">{m.note || m.type}</td>
                <td className="px-2 py-2 text-night-900/60">{m.performedBy?.name || 'System'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [adjustRow, setAdjustRow] = useState(null);
  const [historyRow, setHistoryRow] = useState(null);

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => categoriesApi.list() });
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: brandsApi.list });

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-summary', page, search, category, brand, stockStatus],
    queryFn: () => inventoryApi.summary({
      page, limit: 15,
      search: search || undefined,
      category: category || undefined,
      brand: brand || undefined,
      stockStatus: stockStatus || undefined,
    }),
  });

  const rows = data?.rows || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div>
      <PageHeader
        title="Inventory"
        description={`${data?.total || 0} stock-keeping units${data?.thresholds ? ` — low stock at ${data.thresholds.lowStockThreshold}, critical at ${data.thresholds.criticalStockThreshold}` : ''}`}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-night-900/30" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search product, SKU, barcode..."
            className="input-field w-64 pl-8"
          />
        </div>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="input-field w-44">
          <option value="">All Categories</option>
          {categories?.categories?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <select value={brand} onChange={(e) => { setBrand(e.target.value); setPage(1); }} className="input-field w-44">
          <option value="">All Brands</option>
          {brands?.brands?.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <select value={stockStatus} onChange={(e) => { setStockStatus(e.target.value); setPage(1); }} className="input-field w-44">
          <option value="">All Stock Status</option>
          <option value="in_stock">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="critical">Critical</option>
          <option value="out">Out of Stock</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : rows.length === 0 ? <EmptyState title="No inventory records found" /> : (
          <table className="w-full">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Current Stock</th>
                <th className="px-4 py-3">Reserved</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.productId}_${r.variantId || 'p'}`} className="table-row">
                  <td className="flex items-center gap-3 px-4 py-3">
                    <img src={r.thumbnail?.url} alt="" className="h-10 w-10 rounded object-cover bg-night-900/5" />
                    <div>
                      <p className="font-medium">{r.title}</p>
                      {r.variantLabel && <p className="text-xs text-night-900/40">{r.variantLabel}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-night-900/60">{r.sku || '—'}</td>
                  <td className="px-4 py-3">{r.currentStock}</td>
                  <td className="px-4 py-3">{r.reservedStock}</td>
                  <td className="px-4 py-3 font-medium">{r.availableStock}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => setAdjustRow(r)} className="text-gold-600" title="Adjust stock"><Boxes size={15} /></button>
                      <button onClick={() => setHistoryRow(r)} className="text-night-900/50" title="View history"><History size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      {adjustRow && <AdjustStockModal row={adjustRow} onClose={() => setAdjustRow(null)} />}
      {historyRow && <HistoryModal row={historyRow} onClose={() => setHistoryRow(null)} />}
    </div>
  );
}
