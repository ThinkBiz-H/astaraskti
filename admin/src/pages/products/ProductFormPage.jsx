import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { productsApi, categoriesApi, brandsApi, unitsApi, inventoryApi } from '@/api/endpoints/catalog';
import { PageHeader, PageLoader, TabStrip, Modal, ConfirmDialog, Badge, EmptyState } from '@/components/common/Elements';
import { getErrorMessage } from '@/api/axiosClient';
import { formatCurrency, formatDate } from '@/utils/format';
import { Plus, Trash2, X, Star, Pencil, Boxes } from 'lucide-react';

const TABS = ['General', 'Images & Gallery', 'Inventory', 'Variants', 'SEO', 'Attributes & Specifications', 'Related Products', 'Reviews'];

/* ------------------------------------------------------------------ */
/* Shared key/value editor — used by Product attributes AND (locally)  */
/* by variant attributes.                                              */
/* ------------------------------------------------------------------ */
function KeyValueEditor({ fields, append, remove, register, name }) {
  return (
    <div className="space-y-2">
      {fields.map((field, i) => (
        <div key={field.id} className="flex gap-2">
          <input {...register(`${name}.${i}.key`)} placeholder="Key (e.g. Material)" className="input-field" />
          <input {...register(`${name}.${i}.value`)} placeholder="Value (e.g. Rudraksha)" className="input-field" />
          <button type="button" onClick={() => remove(i)} className="shrink-0 text-red-500"><Trash2 size={16} /></button>
        </div>
      ))}
      <button type="button" onClick={() => append({ key: '', value: '' })} className="flex items-center gap-1 text-xs text-gold-600"><Plus size={13} /> Add</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-select checklist for relatedProducts / crossSell / upSell     */
/* ------------------------------------------------------------------ */
function ProductMultiSelect({ label, excludeId, selected, onChange }) {
  const [q, setQ] = useState('');
  const { data } = useQuery({ queryKey: ['admin-products', 'picker', q], queryFn: () => productsApi.list({ limit: 50, keyword: q || undefined }) });
  const options = (data?.products || []).filter((p) => p._id !== excludeId);

  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div>
      <label className="label-field">{label}</label>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products..." className="input-field mb-2" />
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-night-900/10 p-2">
        {options.length === 0 && <p className="p-2 text-xs text-night-900/40">No products found</p>}
        {options.map((p) => (
          <label key={p._id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-night-900/5">
            <input type="checkbox" checked={selected.includes(p._id)} onChange={() => toggle(p._id)} />
            {p.title}
          </label>
        ))}
      </div>
      {selected.length > 0 && <p className="mt-1 text-xs text-night-900/40">{selected.length} selected</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inventory tab (edit mode only)                                      */
/* ------------------------------------------------------------------ */
function InventoryTab({ product }) {
  const queryClient = useQueryClient();
  const [newStock, setNewStock] = useState('');
  const [note, setNote] = useState('');

  const { data: stockData } = useQuery({
    queryKey: ['product-stock', product._id],
    queryFn: () => inventoryApi.stockByProduct(product._id),
  });
  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ['inventory-movements', product._id],
    queryFn: () => inventoryApi.movements({ productId: product._id, limit: 30 }),
  });

  const available = (stockData?.stock || []).reduce((sum, r) => sum + (r.available || 0), 0);
  const reserved = (stockData?.stock || []).reduce((sum, r) => sum + (r.reserved || 0), 0);

  const adjustMutation = useMutation({
    mutationFn: inventoryApi.adjust,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-stock', product._id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements', product._id] });
      queryClient.invalidateQueries({ queryKey: ['admin-product', product._id] });
      toast.success('Stock updated');
      setNewStock('');
      setNote('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const diff = newStock === '' ? 0 : Number(newStock) - available;

  const submitAdjust = (e) => {
    e.preventDefault();
    if (diff === 0) { toast.error('New stock must differ from current stock'); return; }
    if (!note.trim()) { toast.error('A reason is required for every stock change'); return; }
    adjustMutation.mutate({ productId: product._id, quantity: diff, note: note.trim() });
  };

  if (product.hasVariants) {
    return (
      <div className="card p-6">
        <p className="text-sm text-night-900/60">This product has variants — stock is tracked per variant. Manage it from the <strong>Variants</strong> tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card grid grid-cols-3 gap-4 p-6">
        <div>
          <p className="text-xs text-night-900/50">Available Stock</p>
          <p className="font-display text-2xl">{available}</p>
        </div>
        <div>
          <p className="text-xs text-night-900/50">Reserved Stock</p>
          <p className="font-display text-2xl">{reserved}</p>
        </div>
        <div>
          <p className="text-xs text-night-900/50">Status</p>
          <Badge tone={available <= 0 ? 'danger' : available <= 10 ? 'warning' : 'success'}>
            {available <= 0 ? 'Out of Stock' : available <= 10 ? 'Low Stock' : 'In Stock'}
          </Badge>
        </div>
      </div>

      <form onSubmit={submitAdjust} className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">Adjust Stock</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label-field">New Stock</label><input type="number" min={0} value={newStock} onChange={(e) => setNewStock(e.target.value)} className="input-field" /></div>
          <div className="flex items-end">
            {newStock !== '' && (
              <p className={`text-sm ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-night-900/40'}`}>{diff > 0 ? `+${diff}` : diff} change</p>
            )}
          </div>
        </div>
        <div><label className="label-field">Reason (required)</label><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input-field" placeholder="e.g. Manual stocktake correction, Restock from supplier" /></div>
        <button type="submit" disabled={adjustMutation.isPending} className="btn-primary">Save</button>
      </form>

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-night-900/60">Stock History</h2>
        {movementsLoading ? <PageLoader /> : (movementsData?.movements || []).length === 0 ? <EmptyState title="No stock movements yet" /> : (
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
              {movementsData.movements.map((m) => (
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
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Variants tab (edit mode only)                                       */
/* ------------------------------------------------------------------ */
function VariantStockAdjustModal({ productId, variant, onClose }) {
  const queryClient = useQueryClient();
  const [newStock, setNewStock] = useState(variant.stock);
  const [note, setNote] = useState('');
  const diff = Number(newStock) - variant.stock;

  const adjustMutation = useMutation({
    mutationFn: inventoryApi.adjust,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] });
      toast.success('Variant stock updated');
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const onSubmit = (e) => {
    e.preventDefault();
    if (diff === 0) { toast.error('New stock must differ from current stock'); return; }
    if (!note.trim()) { toast.error('A reason is required for every stock change'); return; }
    adjustMutation.mutate({ productId, variantId: variant._id, quantity: diff, note: note.trim() });
  };

  return (
    <Modal title={`Adjust Stock — ${variant.sku}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div><label className="label-field">New Stock</label><input type="number" min={0} value={newStock} onChange={(e) => setNewStock(e.target.value)} className="input-field" autoFocus /></div>
        <p className={`text-xs ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-night-900/40'}`}>{diff > 0 ? `+${diff}` : diff} change</p>
        <div><label className="label-field">Reason (required)</label><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input-field" /></div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          <button type="submit" disabled={adjustMutation.isPending} className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

function VariantEditor({ productId, variant, onDone }) {
  const isEdit = Boolean(variant);
  const [images, setImages] = useState([]);
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: unitsApi.list });
  const { register, control, handleSubmit } = useForm({
    defaultValues: variant || { attributes: [{ key: '', value: '' }], status: 'active', stock: 0 },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'attributes' });

  const createMutation = useMutation({
    mutationFn: (formData) => productsApi.createVariant(productId, formData),
    onSuccess: () => { toast.success('Variant created'); onDone(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const updateMutation = useMutation({
    mutationFn: (formData) => productsApi.updateVariant(productId, variant._id, formData),
    onSuccess: () => { toast.success('Variant updated'); onDone(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const onSubmit = (vals) => {
    const formData = new FormData();
    formData.append('sku', vals.sku || '');
    formData.append('barcode', vals.barcode || '');
    formData.append('price', vals.price);
    if (vals.salePrice !== '' && vals.salePrice !== undefined) formData.append('salePrice', vals.salePrice);
    if (vals.unit) formData.append('unit', vals.unit);
    formData.append('unitValue', vals.unitValue || 1);
    if (vals.weight) formData.append('weight', vals.weight);
    formData.append('status', vals.status);
    formData.append('isDefault', vals.isDefault ? 'true' : 'false');
    formData.append('attributes', JSON.stringify((vals.attributes || []).filter((a) => a.key)));
    if (!isEdit) formData.append('stock', vals.stock || 0);
    images.forEach((f) => formData.append('images', f));

    if (isEdit) updateMutation.mutate(formData);
    else createMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">{isEdit ? 'Edit Variant' : 'New Variant'}</h3>
        <button type="button" onClick={onDone} className="text-night-900/40"><X size={16} /></button>
      </div>
      <div>
        <label className="label-field">Attributes (e.g. Color: Red, Size: M)</label>
        <KeyValueEditor fields={fields} append={append} remove={remove} register={register} name="attributes" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label-field">SKU</label><input {...register('sku', { required: true })} className="input-field" /></div>
        <div><label className="label-field">Barcode</label><input {...register('barcode')} className="input-field" /></div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div><label className="label-field">Price</label><input type="number" step="0.01" {...register('price', { required: true, min: 0 })} className="input-field" /></div>
        <div><label className="label-field">Sale Price</label><input type="number" step="0.01" {...register('salePrice')} className="input-field" /></div>
        {!isEdit && <div><label className="label-field">Initial Stock</label><input type="number" min={0} {...register('stock', { required: true, min: 0 })} className="input-field" /></div>}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label-field">Unit</label>
          <select {...register('unit')} className="input-field">
            <option value="">— None —</option>
            {units?.units?.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.symbol})</option>)}
          </select>
        </div>
        <div><label className="label-field">Unit Value</label><input type="number" step="0.01" {...register('unitValue')} className="input-field" /></div>
        <div><label className="label-field">Weight (kg)</label><input type="number" step="0.01" {...register('weight')} className="input-field" /></div>
      </div>
      <div className="flex items-center gap-6">
        <select {...register('status')} className="input-field w-40">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('isDefault')} /> Default variant</label>
      </div>
      <div>
        <label className="label-field">Images</label>
        <input type="file" multiple accept="image/*" onChange={(e) => setImages(Array.from(e.target.files))} className="input-field" />
        {variant?.images?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {variant.images.map((img) => <img key={img.publicId} src={img.url} className="h-14 w-14 rounded object-cover" />)}
          </div>
        )}
      </div>
      <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary">{isEdit ? 'Save Variant' : 'Create Variant'}</button>
    </form>
  );
}

function VariantsTab({ product }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [adjustingVariant, setAdjustingVariant] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['product-variants', product._id],
    queryFn: () => productsApi.variants(product._id),
  });

  const deleteMutation = useMutation({
    mutationFn: (variantId) => productsApi.deleteVariant(product._id, variantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', product._id] });
      queryClient.invalidateQueries({ queryKey: ['admin-product', product._id] });
      toast.success('Variant deleted');
      setPendingDelete(null);
    },
    onError: (err) => { toast.error(getErrorMessage(err)); setPendingDelete(null); },
  });

  const variants = data?.variants || [];
  const closeForm = () => {
    setShowForm(false);
    setEditingVariant(null);
    queryClient.invalidateQueries({ queryKey: ['product-variants', product._id] });
    queryClient.invalidateQueries({ queryKey: ['admin-product', product._id] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-night-900/60">Each variant (e.g. Red / Blue / Black) has its own SKU, price, stock and images.</p>
        {!showForm && !editingVariant && <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> Add Variant</button>}
      </div>

      {(showForm || editingVariant) && (
        <VariantEditor productId={product._id} variant={editingVariant} onDone={closeForm} />
      )}

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : variants.length === 0 ? <EmptyState title="No variants yet" description="Add a variant to sell this product in multiple options." /> : (
          <table className="w-full">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v._id} className="table-row">
                  <td className="px-4 py-3">
                    {v.attributes?.map((a) => `${a.key}: ${a.value}`).join(', ') || '—'}
                    {v.isDefault && <Badge tone="gold">Default</Badge>}
                  </td>
                  <td className="px-4 py-3 text-night-900/60">{v.sku}</td>
                  <td className="px-4 py-3">{formatCurrency(v.salePrice > 0 ? v.salePrice : v.price)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setAdjustingVariant(v)} className={v.stock <= 0 ? 'text-red-600' : v.stock <= 10 ? 'text-yellow-600' : ''}>{v.stock}</button>
                  </td>
                  <td className="px-4 py-3"><Badge tone={v.status === 'active' ? 'success' : 'default'}>{v.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => setEditingVariant(v)} className="text-gold-600"><Pencil size={15} /></button>
                      <button onClick={() => setAdjustingVariant(v)} className="text-night-900/50" title="Adjust stock"><Boxes size={15} /></button>
                      <button onClick={() => setPendingDelete(v)} className="text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adjustingVariant && <VariantStockAdjustModal productId={product._id} variant={adjustingVariant} onClose={() => { setAdjustingVariant(null); queryClient.invalidateQueries({ queryKey: ['product-variants', product._id] }); }} />}
      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete variant?"
        description={pendingDelete ? `"${pendingDelete.sku}" will be permanently removed.` : ''}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(pendingDelete._id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reviews tab (edit mode only) — reviews are embedded on the product,  */
/* already returned by getProductById, no separate fetch needed.       */
/* ------------------------------------------------------------------ */
function ReviewsTab({ product }) {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState(null);
  const deleteMutation = useMutation({
    mutationFn: (reviewId) => productsApi.deleteReview(product._id, reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product', product._id] });
      toast.success('Review removed');
      setPendingDelete(null);
    },
    onError: (err) => { toast.error(getErrorMessage(err)); setPendingDelete(null); },
  });

  const reviews = product.reviews || [];
  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-night-900/60">
        <Star size={14} /> {product.rating?.toFixed?.(1) || 0} average · {product.numReviews || 0} reviews
      </div>
      {reviews.length === 0 ? <EmptyState title="No reviews yet" /> : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r._id} className="flex items-start justify-between border-b border-night-900/5 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.user?.name || 'Customer'}</span>
                  <Badge tone="gold">{r.rating} ★</Badge>
                  {r.isVerifiedPurchase && <Badge tone="success">Verified</Badge>}
                </div>
                <p className="mt-1 text-sm text-night-900/70">{r.comment}</p>
                <p className="mt-1 text-xs text-night-900/40">{formatDate(r.createdAt)}</p>
              </div>
              <button onClick={() => setPendingDelete(r)} className="text-red-600"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete review?"
        description="This review will be permanently removed and the product's rating recalculated."
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(pendingDelete._id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                            */
/* ------------------------------------------------------------------ */
export default function ProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [tab, setTab] = useState('General');
  const [images, setImages] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [crossSell, setCrossSell] = useState([]);
  const [upSell, setUpSell] = useState([]);
  const queryClient = useQueryClient();

  const { data: productData, isLoading } = useQuery({
    queryKey: ['admin-product', id],
    queryFn: () => productsApi.getById(id),
    enabled: isEdit,
  });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => categoriesApi.list() });
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: brandsApi.list });
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: unitsApi.list });

  const { register, control, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: { attributes: [{ key: '', value: '' }], status: 'active', dimensions: { unit: 'cm' }, minOrderQuantity: 1 },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'attributes' });
  const categoryId = watch('category');

  const { data: attributeTemplate } = useQuery({
    queryKey: ['attribute-template', categoryId],
    queryFn: () => categoriesApi.attributeTemplate(categoryId),
    enabled: Boolean(categoryId),
  });

  const product = productData?.product;

  useEffect(() => {
    if (product) {
      reset({
        ...product,
        category: product.category?._id,
        brand: product.brand?._id,
        unit: product.unit?._id,
        tags: (product.tags || []).join(', '),
        seoKeywords: (product.seoKeywords || []).join(', '),
        attributes: product.attributes?.length ? product.attributes : [{ key: '', value: '' }],
        dimensions: product.dimensions || { unit: 'cm' },
      });
      setRelatedProducts((product.relatedProducts || []).map((p) => p._id || p));
      setCrossSell((product.crossSell || []).map((p) => p._id || p));
      setUpSell((product.upSell || []).map((p) => p._id || p));
    }
  }, [product, reset]);

  const createMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => { toast.success('Product created'); navigate('/products'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const updateMutation = useMutation({
    mutationFn: (formData) => productsApi.update(id, formData),
    onSuccess: () => {
      toast.success('Product updated');
      queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const onSubmit = (vals) => {
    const formData = new FormData();
    const skip = new Set(['attributes', 'dimensions', 'stock', 'relatedProducts', 'crossSell', 'upSell']);
    Object.entries(vals).forEach(([key, value]) => {
      if (skip.has(key)) return;
      if (value !== undefined && value !== null && value !== '') formData.append(key, value);
    });
    formData.append('attributes', JSON.stringify((vals.attributes || []).filter((a) => a.key)));
    formData.append('dimensions', JSON.stringify(vals.dimensions || {}));
    formData.append('relatedProducts', JSON.stringify(relatedProducts));
    formData.append('crossSell', JSON.stringify(crossSell));
    formData.append('upSell', JSON.stringify(upSell));
    if (!isEdit && vals.stock !== undefined) formData.append('stock', vals.stock);
    images.forEach((file) => formData.append('images', file));

    if (isEdit) updateMutation.mutate(formData);
    else createMutation.mutate(formData);
  };

  const removeImageMutation = useMutation({
    mutationFn: (publicId) => productsApi.removeImage(id, publicId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-product', id] }); toast.success('Image removed'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const setThumbnailMutation = useMutation({
    mutationFn: (publicId) => {
      const fd = new FormData();
      fd.append('thumbnailPublicId', publicId);
      return productsApi.update(id, fd);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-product', id] }); toast.success('Thumbnail updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const availableTabs = useMemo(() => (isEdit ? TABS : TABS.filter((t) => !['Inventory', 'Variants', 'Reviews'].includes(t))), [isEdit]);

  if (isEdit && isLoading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit Product${product ? ` — ${product.title}` : ''}` : 'Add Product'}
        action={<Link to="/products" className="btn-outline">Back to Products</Link>}
      />

      <TabStrip tabs={availableTabs} active={tab} onChange={setTab} />

      {tab === 'General' && (
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="card space-y-4 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">Basic Info</h2>
              <div>
                <label className="label-field">Title</label>
                <input {...register('title', { required: true })} className="input-field" />
                {errors.title && <p className="field-error">Title is required</p>}
              </div>
              <div><label className="label-field">Short Description</label><input {...register('shortDescription')} className="input-field" /></div>
              <div><label className="label-field">Full Description</label><textarea {...register('description')} rows={5} className="input-field" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-field">SKU</label><input {...register('SKU')} className="input-field" /></div>
                <div><label className="label-field">Barcode</label><input {...register('barcode')} className="input-field" /></div>
              </div>
            </div>

            <div className="card space-y-4 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">Pricing{!isEdit && ' & Inventory'}</h2>
              <div className={`grid gap-4 ${isEdit ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <div><label className="label-field">Price</label><input type="number" step="0.01" {...register('price', { required: true, min: 0 })} className="input-field" /></div>
                <div><label className="label-field">Sale Price</label><input type="number" step="0.01" {...register('salePrice', { min: 0 })} className="input-field" /></div>
                {!isEdit && <div><label className="label-field">Initial Stock</label><input type="number" {...register('stock', { required: true, min: 0 })} className="input-field" /></div>}
              </div>
              {isEdit && !product?.hasVariants && (
                <p className="text-xs text-night-900/40">
                  Current stock: <strong>{product?.stock ?? 0}</strong> — manage it from the <button type="button" onClick={() => setTab('Inventory')} className="text-gold-600 underline">Inventory tab</button>.
                </p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Unit</label>
                  <select {...register('unit')} className="input-field">
                    <option value="">— None —</option>
                    {units?.units?.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.symbol})</option>)}
                  </select>
                </div>
                <div><label className="label-field">Weight (kg)</label><input type="number" step="0.01" {...register('weight')} className="input-field" /></div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div><label className="label-field">Length</label><input type="number" step="0.01" {...register('dimensions.length')} className="input-field" /></div>
                <div><label className="label-field">Width</label><input type="number" step="0.01" {...register('dimensions.width')} className="input-field" /></div>
                <div><label className="label-field">Height</label><input type="number" step="0.01" {...register('dimensions.height')} className="input-field" /></div>
                <div>
                  <label className="label-field">Unit</label>
                  <select {...register('dimensions.unit')} className="input-field">
                    <option value="cm">cm</option>
                    <option value="in">in</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-field">Min Order Qty</label><input type="number" min={1} {...register('minOrderQuantity')} className="input-field" /></div>
                <div><label className="label-field">Max Order Qty</label><input type="number" min={1} {...register('maxOrderQuantity')} className="input-field" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-field">Warranty</label><input {...register('warranty')} className="input-field" /></div>
                <div><label className="label-field">Return Policy</label><input {...register('returnPolicy')} className="input-field" /></div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card space-y-4 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">Organization</h2>
              <div>
                <label className="label-field">Category</label>
                <select {...register('category', { required: true })} className="input-field">
                  <option value="">Select category</option>
                  {categories?.categories?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
                {errors.category && <p className="field-error">Category is required</p>}
              </div>
              <div>
                <label className="label-field">Brand</label>
                <select {...register('brand')} className="input-field">
                  <option value="">— None —</option>
                  {brands?.brands?.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
                <Link to="/brands" className="mt-1 inline-block text-xs text-gold-600">+ Manage brands</Link>
              </div>
              <div><label className="label-field">Tags (comma-separated)</label><input {...register('tags')} className="input-field" placeholder="rudraksha, 5-mukhi, energized" /></div>
            </div>

            <div className="card space-y-3 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">Status & Visibility</h2>
              <select {...register('status')} className="input-field">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('featured')} /> Featured</label>
            </div>

            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary w-full">
              {isEdit ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      )}

      {tab === 'Images & Gallery' && (
        <div className="card max-w-2xl space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">Gallery</h2>
          <input type="file" multiple accept="image/*" onChange={(e) => setImages(Array.from(e.target.files))} className="input-field" />
          <div className="flex flex-wrap gap-4">
            {product?.images?.map((img) => (
              <div key={img.publicId} className="relative">
                <img src={img.url} className="h-24 w-24 rounded object-cover" />
                {product.thumbnail?.publicId === img.publicId && <Badge tone="gold">Thumbnail</Badge>}
                <div className="mt-1 flex gap-2 text-xs">
                  {product.thumbnail?.publicId !== img.publicId && (
                    <button type="button" onClick={() => setThumbnailMutation.mutate(img.publicId)} className="text-gold-600">Set thumbnail</button>
                  )}
                  <button type="button" onClick={() => removeImageMutation.mutate(img.publicId)} className="text-red-600">Remove</button>
                </div>
              </div>
            ))}
            {images.map((file, i) => (
              <div key={i} className="relative">
                <img src={URL.createObjectURL(file)} className="h-24 w-24 rounded object-cover" />
                <button type="button" onClick={() => setImages(images.filter((_, idx) => idx !== i))} className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 shadow"><X size={12} /></button>
              </div>
            ))}
          </div>
          {images.length > 0 && (
            <button type="button" onClick={handleSubmit(onSubmit)} disabled={updateMutation.isPending || createMutation.isPending} className="btn-primary">
              Upload Selected Images
            </button>
          )}
        </div>
      )}

      {tab === 'Inventory' && product && <InventoryTab product={product} />}
      {tab === 'Variants' && product && <VariantsTab product={product} />}

      {tab === 'SEO' && (
        <form onSubmit={handleSubmit(onSubmit)} className="card max-w-2xl space-y-4 p-6">
          <div><label className="label-field">SEO Title</label><input {...register('seoTitle')} className="input-field" /></div>
          <div><label className="label-field">SEO Description</label><textarea {...register('seoDescription')} rows={2} className="input-field" /></div>
          <div><label className="label-field">SEO Keywords (comma-separated)</label><input {...register('seoKeywords')} className="input-field" /></div>
          <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary">Save</button>
        </form>
      )}

      {tab === 'Attributes & Specifications' && (
        <form onSubmit={handleSubmit(onSubmit)} className="card max-w-2xl space-y-4 p-6">
          {attributeTemplate?.template?.length > 0 && (
            <p className="text-xs text-night-900/40">
              Category requires: {attributeTemplate.template.filter((t) => t.required).map((t) => t.label).join(', ') || 'none'}
            </p>
          )}
          <KeyValueEditor fields={fields} append={append} remove={remove} register={register} name="attributes" />
          <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary">Save</button>
        </form>
      )}

      {tab === 'Related Products' && (
        <form onSubmit={handleSubmit(onSubmit)} className="card max-w-2xl space-y-6 p-6">
          <ProductMultiSelect label="Related Products" excludeId={id} selected={relatedProducts} onChange={setRelatedProducts} />
          <ProductMultiSelect label="Cross-sell (shown at cart)" excludeId={id} selected={crossSell} onChange={setCrossSell} />
          <ProductMultiSelect label="Up-sell (shown on product page)" excludeId={id} selected={upSell} onChange={setUpSell} />
          <button type="submit" disabled={updateMutation.isPending} className="btn-primary">Save</button>
        </form>
      )}

      {tab === 'Reviews' && product && <ReviewsTab product={product} />}
    </div>
  );
}
