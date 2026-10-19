import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { productsApi, categoriesApi, brandsApi } from '@/api/endpoints/catalog';
import { PageHeader, PageLoader, Pagination, Badge, EmptyState, ConfirmDialog } from '@/components/common/Elements';
import { getErrorMessage } from '@/api/axiosClient';
import { formatCurrency } from '@/utils/format';
import { Plus, Pencil, Trash2, RotateCcw, Star, Search } from 'lucide-react';

const updateField = (id, patch) => {
  const fd = new FormData();
  Object.entries(patch).forEach(([k, v]) => fd.append(k, v));
  return productsApi.update(id, fd);
};

export default function ProductsListPage() {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const queryClient = useQueryClient();

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => categoriesApi.list() });
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: brandsApi.list });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', page, keyword, category, brand, status, stockStatus, showDeleted],
    queryFn: () => productsApi.list({
      page, limit: 15,
      keyword: keyword || undefined,
      category: category || undefined,
      brand: brand || undefined,
      status: status || undefined,
      stockStatus: stockStatus || undefined,
      includeDeleted: showDeleted ? 'true' : undefined,
    }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-products'] });

  const deleteMutation = useMutation({
    mutationFn: productsApi.remove,
    onSuccess: () => { invalidate(); toast.success('Product deleted'); setPendingDelete(null); },
    onError: (err) => { toast.error(getErrorMessage(err)); setPendingDelete(null); },
  });
  const restoreMutation = useMutation({
    mutationFn: productsApi.restore,
    onSuccess: () => { invalidate(); toast.success('Product restored'); },
  });
  const fieldMutation = useMutation({
    mutationFn: ({ id, patch }) => updateField(id, patch),
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const products = data?.products || [];
  const total = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 1;

  return (
    <div>
      <PageHeader
        title="Products"
        description={`${total} products`}
        action={<Link to="/products/new" className="btn-primary"><Plus size={16} /> Add Product</Link>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-night-900/30" />
          <input
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            placeholder="Search products..."
            className="input-field w-64 pl-8"
          />
        </div>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="input-field w-40">
          <option value="">All Categories</option>
          {categories?.categories?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <select value={brand} onChange={(e) => { setBrand(e.target.value); setPage(1); }} className="input-field w-40">
          <option value="">All Brands</option>
          {brands?.brands?.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input-field w-36">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="draft">Draft</option>
        </select>
        <select value={stockStatus} onChange={(e) => { setStockStatus(e.target.value); setPage(1); }} className="input-field w-36">
          <option value="">All Stock</option>
          <option value="in_stock">In Stock</option>
          <option value="out">Out of Stock</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-night-900/60">
          <input type="checkbox" checked={showDeleted} onChange={(e) => { setShowDeleted(e.target.checked); setPage(1); }} /> Show deleted
        </label>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : products.length === 0 ? <EmptyState title="No products found" /> : (
          <table className="w-full">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Featured</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id} className="table-row">
                  <td className="flex items-center gap-3 px-4 py-3">
                    <img src={p.thumbnail?.url} alt={p.title} className="h-10 w-10 rounded object-cover bg-night-900/5" />
                    <span className="font-medium">{p.title}</span>
                  </td>
                  <td className="px-4 py-3 text-night-900/60">{p.category?.name}</td>
                  <td className="px-4 py-3">{formatCurrency(p.salePrice > 0 ? p.salePrice : p.price)}</td>
                  <td className="px-4 py-3">
                    {p.hasVariants ? <span className="text-night-900/40">Per variant</span> : (
                      <span className={p.stock <= 0 ? 'text-red-600' : p.stock <= 10 ? 'text-yellow-600' : ''}>{p.stock}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.isDeleted ? <Badge tone="danger">Deleted</Badge> : (
                      <select
                        value={p.status}
                        onChange={(e) => fieldMutation.mutate({ id: p._id, patch: { status: e.target.value } })}
                        className="rounded border border-night-900/10 bg-transparent px-2 py-1 text-xs"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="draft">Draft</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => fieldMutation.mutate({ id: p._id, patch: { featured: !p.featured } })}
                      disabled={p.isDeleted}
                      className={p.featured ? 'text-gold-500' : 'text-night-900/20'}
                    >
                      <Star size={17} fill={p.featured ? 'currentColor' : 'none'} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link to={`/products/${p._id}/edit`} className="text-gold-600"><Pencil size={15} /></Link>
                      {p.isDeleted ? (
                        <button onClick={() => restoreMutation.mutate(p._id)} className="text-green-600"><RotateCcw size={15} /></button>
                      ) : (
                        <button onClick={() => setPendingDelete(p)} className="text-red-600"><Trash2 size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete product?"
        description={pendingDelete ? `"${pendingDelete.title}" will be soft-deleted — hidden from the storefront but recoverable from here with "Show deleted".` : ''}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(pendingDelete._id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
