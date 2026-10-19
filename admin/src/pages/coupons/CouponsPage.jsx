import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { couponsApi } from '@/api/endpoints/orders';
import { PageHeader, PageLoader, Badge, EmptyState } from '@/components/common/Elements';
import { getErrorMessage } from '@/api/axiosClient';
import { formatDate } from '@/utils/format';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function CouponsPage() {
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-coupons'], queryFn: () => couponsApi.list() });
  const { register, handleSubmit, reset } = useForm();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });

  const createMutation = useMutation({
    mutationFn: couponsApi.create,
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Coupon created'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => couponsApi.update(id, payload),
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Coupon updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const deleteMutation = useMutation({
    mutationFn: couponsApi.remove,
    onSuccess: () => { invalidate(); toast.success('Coupon deleted'); },
  });
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => couponsApi.update(id, { isActive }),
    onSuccess: () => { invalidate(); toast.success('Coupon status updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const startEdit = (coupon) => {
    setEditing(coupon || 'new');
    reset(coupon ? { ...coupon, expiry: coupon.expiry?.split('T')[0] } : {
      code: '', discount: '', type: 'percentage', expiry: '', minimumOrder: 0, usageLimit: 100, perUserLimit: 1, appliesTo: ['product'], isActive: true, description: '',
    });
  };

  const onSubmit = (vals) => {
    const payload = {
      ...vals,
      appliesTo: Array.isArray(vals.appliesTo) ? vals.appliesTo : [vals.appliesTo].filter(Boolean),
    };
    if (editing?._id) updateMutation.mutate({ id: editing._id, payload });
    else createMutation.mutate(payload);
  };

  const coupons = data?.coupons || [];

  return (
    <div>
      <PageHeader title="Coupons" action={<button onClick={() => startEdit(null)} className="btn-primary"><Plus size={16} /> Add Coupon</button>} />

      {editing && (
        <form onSubmit={handleSubmit(onSubmit)} className="card mb-6 grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
          <input {...register('code', { required: true })} placeholder="Coupon Code" className="input-field uppercase" />
          <select {...register('type')} className="input-field">
            <option value="percentage">Percentage</option>
            <option value="flat">Flat Amount</option>
          </select>
          <input type="number" step="0.01" {...register('discount', { required: true })} placeholder="Discount Value" className="input-field" />
          <input type="date" {...register('expiry', { required: true })} className="input-field" />
          <input type="number" {...register('minimumOrder')} placeholder="Minimum Order Amount" className="input-field" />
          <input type="number" {...register('maximumDiscount')} placeholder="Max Discount (optional)" className="input-field" />
          <input type="number" {...register('usageLimit')} placeholder="Total Usage Limit" className="input-field" />
          <input type="number" {...register('perUserLimit')} placeholder="Per-User Limit" className="input-field" />
          <textarea {...register('description')} placeholder="Description (internal / customer-facing note)" className="input-field sm:col-span-3" rows={2} />
          <div className="flex items-center gap-4 text-sm sm:col-span-1">
            <label className="flex items-center gap-1"><input type="checkbox" value="product" {...register('appliesTo')} /> Products</label>
            <label className="flex items-center gap-1"><input type="checkbox" value="consultation" {...register('appliesTo')} /> Consultations</label>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" {...register('isActive')} /> Active
          </label>
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : coupons.length === 0 ? <EmptyState title="No coupons yet" /> : (
          <table className="w-full">
            <thead><tr className="table-head">
              <th className="px-4 py-3">Code</th><th className="px-4 py-3">Discount</th><th className="px-4 py-3">Applies To</th>
              <th className="px-4 py-3">Used</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
            </tr></thead>
            <tbody>
              {coupons.map((c) => {
                const expired = new Date(c.expiry) < new Date();
                return (
                <tr key={c._id} className="table-row">
                  <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                  <td className="px-4 py-3">{c.type === 'percentage' ? `${c.discount}%` : `₹${c.discount}`}</td>
                  <td className="px-4 py-3">
                    {(c.appliesTo || ['product']).map((a) => <Badge key={a} tone="gold">{a}</Badge>)}
                  </td>
                  <td className="px-4 py-3">{c.usedCount || 0} / {c.usageLimit}</td>
                  <td className="px-4 py-3 text-night-900/50">{formatDate(c.expiry)}{expired && ' (expired)'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActiveMutation.mutate({ id: c._id, isActive: !c.isActive })}>
                      <Badge tone={c.isActive ? 'success' : 'default'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => startEdit(c)} className="text-gold-600"><Pencil size={15} /></button>
                      <button onClick={() => deleteMutation.mutate(c._id)} className="text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
